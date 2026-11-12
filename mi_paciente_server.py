"""Servidor local de Mi Paciente: frontend estático y API SQLite de cuentas."""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import re
import secrets
import sqlite3
import threading
import time
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from datetime import time as hora_del_dia
from html import escape as html_escape
from http.cookies import SimpleCookie
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from zoneinfo import ZoneInfo
from urllib.error import HTTPError
from urllib.parse import urlencode, urlsplit
from urllib.request import Request, urlopen


BASE_DIR = Path(__file__).resolve().parent


def load_env_file() -> None:
    """Carga .env sin sobrescribir variables definidas por el sistema."""
    env_path = BASE_DIR / ".env"
    if not env_path.is_file():
        return
    for raw_line in env_path.read_text(encoding="utf-8-sig").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        name, value = line.split("=", 1)
        name = name.strip()
        if not re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*", name):
            continue
        value = value.strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in {"'", '"'}:
            value = value[1:-1]
        if name not in os.environ:
            os.environ[name] = value


load_env_file()
if os.environ.get("LOCALAPPDATA"):
    DEFAULT_DB_PATH = Path(os.environ["LOCALAPPDATA"]) / "MiPaciente" / "mi_paciente.sqlite3"
else:
    DEFAULT_DB_PATH = Path.home() / ".local" / "share" / "mi-paciente" / "mi_paciente.sqlite3"
DB_PATH = Path(os.environ.get("MI_PACIENTE_DB", DEFAULT_DB_PATH))
PBKDF2_ITERATIONS = 310_000
SESSION_DAYS = 14
SESSION_COOKIE = "mi_paciente_session"
EMAIL_RE = re.compile(r"^[^\s@]{1,64}@[^\s@]{1,189}\.[^\s@]{2,63}$")
PHONE_RE = re.compile(r"^\+?[0-9][0-9\s().-]{5,23}$")
VERIFICATION_CODE_TTL_MINUTES = 10
VERIFICATION_RESEND_SECONDS = 60
VERIFICATION_MAX_ATTEMPTS = 5
REPORT_TYPES = {
    "Error al iniciar sesión",
    "No recibí el código de verificación",
    "Error al guardar un recordatorio",
    "La página no carga o se ve mal",
    "Otro problema",
}
TECH_REPORT_RATE_LIMIT_SECONDS = 30
_TECH_REPORT_LAST_BY_IP: dict[str, float] = {}
_TECH_REPORT_RATE_LOCK = threading.Lock()
_TECH_REPORT_SEND_LOCK = threading.Lock()

# ---- Zona horaria, citas y notificaciones -------------------------------------------
try:
    ZONA_HORARIA = ZoneInfo("America/Bogota")
except Exception:  # Windows sin el paquete tzdata: Colombia no usa horario de verano (UTC-5).
    ZONA_HORARIA = timezone(timedelta(hours=-5), "America/Bogota")
TIPOS_CITA = {"Cita de control", "Cita prioritaria"}
FECHA_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
HORA_RE = re.compile(r"^([01]\d|2[0-3]):[0-5]\d$")
CLAVE_SOLICITUD_RE = re.compile(r"^[A-Za-z0-9_-]{8,64}$")
HORA_RECORDATORIO_DIA = hora_del_dia(8, 0)      # recordatorio habitual: 8:00 a. m.
HORA_MINIMA_RECORDATORIO = hora_del_dia(6, 0)   # nunca se envían avisos de madrugada
ANTELACION_MINIMA = timedelta(minutes=30)       # el recordatorio debe llegar al menos 30 min antes
SEPARACION_MINIMA = timedelta(minutes=15)       # separación mínima respecto a la confirmación
GRACIA_RECORDATORIO_LIBRE = timedelta(hours=1)  # dieta/medicamentos/ejercicio: tolerancia de retraso
MAX_INTENTOS_ENVIO = 5
MAX_REINTENTOS_MANUALES = 5
ESPERA_REINTENTO_MANUAL = timedelta(seconds=60)
HORIZONTE_CITAS = timedelta(days=730)
CANALES_VALIDOS = {"SMS", "Correo electrónico", "WhatsApp"}


class ConfiguracionFaltante(RuntimeError):
    """Falta configurar el servicio de mensajería (no sirve reintentar hasta configurarlo)."""


class EnvioPermanente(RuntimeError):
    """Error que no se corrige reintentando (número inválido, rechazo del proveedor, etc.)."""


def ahora_bogota() -> datetime:
    return datetime.now(ZONA_HORARIA)


def ahora_utc() -> datetime:
    return ahora_bogota().astimezone(timezone.utc)


def con_punto(texto: str) -> str:
    return texto if texto.endswith(".") else texto + "."


def utc_texto(momento: datetime) -> str:
    return momento.astimezone(timezone.utc).replace(microsecond=0).isoformat()


def utc_desde_texto(texto: str) -> datetime:
    return datetime.fromisoformat(texto).astimezone(timezone.utc)


def cita_datetime(fecha: str, hora: str) -> datetime:
    return datetime.strptime(f"{fecha} {hora}", "%Y-%m-%d %H:%M").replace(tzinfo=ZONA_HORARIA)


def fecha_legible(fecha: str) -> str:
    return datetime.strptime(fecha, "%Y-%m-%d").strftime("%d/%m/%Y")


def hora_legible(hora: str) -> str:
    momento = datetime.strptime(hora, "%H:%M")
    return f"{momento.hour % 12 or 12}:{momento.minute:02d} {'a. m.' if momento.hour < 12 else 'p. m.'}"


def planificar_recordatorio_dia(cita: datetime, ahora: datetime) -> datetime | None:
    """Momento (aware) del recordatorio del día de la cita, o None si ya no hay tiempo útil."""
    if cita <= ahora:
        return None
    ocho = datetime.combine(cita.date(), HORA_RECORDATORIO_DIA, tzinfo=cita.tzinfo)
    primero_posible = ahora + SEPARACION_MINIMA
    preferido = ocho if ahora < ocho else cita - timedelta(hours=1)
    envio = max(preferido, primero_posible)
    ultimo_posible = cita - ANTELACION_MINIMA
    if envio > ultimo_posible:
        envio = ultimo_posible
    if envio < primero_posible:
        return None
    if envio.timetz().replace(tzinfo=None) < HORA_MINIMA_RECORDATORIO and envio.date() == cita.date():
        return None
    return envio


def planificar_notificaciones(tipo: str, canal: str, cita: datetime, ahora: datetime) -> list[tuple[str, datetime, datetime]]:
    """Lista de (clase, enviar_en, vence_en). Cada aviso se gestiona de forma independiente."""
    plan: list[tuple[str, datetime, datetime]] = []
    if tipo in TIPOS_CITA or canal == "Correo electrónico":
        plan.append(("CONFIRMACION", ahora, cita))
    if tipo in TIPOS_CITA:
        envio = planificar_recordatorio_dia(cita, ahora)
        if envio is not None:
            plan.append(("RECORDATORIO_DIA", envio, cita))
    else:
        plan.append(("RECORDATORIO", cita, cita + GRACIA_RECORDATORIO_LIBRE))
    return plan


MENSAJE_TELEFONO_CO = "Escribe un celular colombiano de 10 dígitos que empiece por 3 (por ejemplo 300 123 4567) o un número internacional con +."


def normalizar_telefono_movil(contacto: str) -> str:
    """Devuelve el celular en formato internacional (+573001234567) o lanza ValueError."""
    limpio = str(contacto or "").strip()
    if limpio.lower().startswith("whatsapp:"):
        limpio = limpio.split(":", 1)[1].strip()
    if not re.fullmatch(r"\+?[0-9\s().-]{6,28}", limpio) or not re.search(r"\d", limpio):
        raise ValueError("El número de celular no es válido.")
    digitos = re.sub(r"\D", "", limpio)
    internacional = limpio.startswith("+")
    if not internacional and digitos.startswith("00"):
        digitos, internacional = digitos[2:], True
    codigo_pais = re.sub(r"\D", "", os.environ.get("MI_PACIENTE_COUNTRY_CODE", "57")) or "57"
    if not internacional:
        if codigo_pais == "57" and len(digitos) == 12 and digitos.startswith("57"):
            pass
        else:
            digitos = codigo_pais + digitos
    if digitos.startswith("57"):
        if not re.fullmatch(r"3\d{9}", digitos[2:]):
            raise ValueError(MENSAJE_TELEFONO_CO)
    elif not 8 <= len(digitos) <= 15:
        raise ValueError("El número internacional debe tener entre 8 y 15 dígitos, incluido el código de país.")
    return f"+{digitos}"


def enmascarar_telefono(e164: str) -> str:
    return f"{e164[:3]} ••• ••• {e164[-4:]}"


def enmascarar_correo(correo: str) -> str:
    usuario, _, dominio = str(correo).partition("@")
    return f"{usuario[:1]}***@{dominio}" if dominio else "***"


def mensaje_canal_sin_configurar(canal: str) -> str | None:
    """None si el canal está configurado; si no, un mensaje comprensible."""
    if canal == "Correo electrónico":
        api_key = os.environ.get("BREVO_API_KEY", "").strip()
        remitente = os.environ.get(
            "MI_PACIENTE_SMTP_FROM", "latidoseguro.usc@gmail.com"
        ).strip()
        if not api_key or not remitente:
            return "Configura BREVO_API_KEY y el correo remitente de Brevo en el servidor."
        return None
    variable = "MI_PACIENTE_TWILIO_WHATSAPP_FROM" if canal == "WhatsApp" else "MI_PACIENTE_TWILIO_SMS_FROM"
    if not all(os.environ.get(nombre, "").strip() for nombre in (
        "MI_PACIENTE_TWILIO_ACCOUNT_SID", "MI_PACIENTE_TWILIO_AUTH_TOKEN", variable
    )):
        return f"El envío de {canal} no está configurado en el servidor."
    return None


def sanear_error(error: object) -> str:
    """Texto de error sin credenciales, apto para guardar en la base y registrar."""
    texto = " ".join((str(error).strip() or type(error).__name__).split())
    for nombre in (
        "MI_PACIENTE_TWILIO_AUTH_TOKEN",
        "MI_PACIENTE_TWILIO_ACCOUNT_SID",
        "MI_PACIENTE_SMTP_PASSWORD",
        "BREVO_API_KEY",
    ):
        secreto = os.environ.get(nombre, "")
        if len(secreto) >= 4:
            texto = texto.replace(secreto, "***")
    return texto[:300]


def connect_db() -> sqlite3.Connection:
    connection = sqlite3.connect(DB_PATH, timeout=10)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    return connection


@contextmanager
def db_session():
    """Confirma o revierte la transacción y siempre cierra la conexión."""
    connection = connect_db()
    try:
        yield connection
        connection.commit()
    except BaseException:
        connection.rollback()
        raise
    finally:
        connection.close()


@contextmanager
def transaccion():
    """Transacción de escritura atómica (BEGIN IMMEDIATE). No se usa durante envíos externos."""
    connection = connect_db()
    try:
        connection.execute("BEGIN IMMEDIATE")
        yield connection
        connection.commit()
    except BaseException:
        connection.rollback()
        raise
    finally:
        connection.close()


@contextmanager
def lectura():
    connection = connect_db()
    try:
        yield connection
    finally:
        connection.close()


def initialize_database() -> None:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    try:  # WAL: el vigilante y las peticiones web no se bloquean entre sí
        modo = connect_db()
        modo.execute("PRAGMA journal_mode=WAL")
        modo.close()
    except sqlite3.Error:
        pass
    with db_session() as connection:
        connection.executescript(
            """
            CREATE TABLE IF NOT EXISTS patients (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT NOT NULL COLLATE NOCASE UNIQUE,
                password_salt BLOB NOT NULL,
                password_hash BLOB NOT NULL,
                first_name TEXT NOT NULL,
                last_name TEXT NOT NULL,
                document_type TEXT NOT NULL CHECK (document_type IN ('CC', 'TI')),
                document_number TEXT NOT NULL,
                phone TEXT NOT NULL,
                created_at TEXT NOT NULL,
                email_verified INTEGER NOT NULL DEFAULT 1 CHECK (email_verified IN (0, 1)),
                codigo_verificacion TEXT,
                verification_expires_at TEXT,
                verification_sent_at TEXT,
                verification_attempts INTEGER NOT NULL DEFAULT 0,
                UNIQUE (document_type, document_number)
            );
            CREATE TABLE IF NOT EXISTS sessions (
                token_hash BLOB PRIMARY KEY,
                patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
                expires_at TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS sessions_expiry_idx ON sessions(expires_at);
            CREATE TABLE IF NOT EXISTS reminders (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
                reminder_type TEXT NOT NULL,
                specialist TEXT NOT NULL DEFAULT '',
                reminder_date TEXT NOT NULL,
                reminder_time TEXT NOT NULL,
                detail TEXT NOT NULL DEFAULT '',
                channel TEXT NOT NULL,
                contact TEXT NOT NULL,
                created_at TEXT NOT NULL,
                delivery_status TEXT NOT NULL DEFAULT 'PENDIENTE',
                delivery_attempts INTEGER NOT NULL DEFAULT 0,
                delivery_next_attempt TEXT,
                delivery_error TEXT NOT NULL DEFAULT '',
                delivery_sent_at TEXT,
                delivery_started_at TEXT
            );
            CREATE INDEX IF NOT EXISTS reminders_patient_date_idx
                ON reminders(patient_id, reminder_date, reminder_time);
            CREATE TABLE IF NOT EXISTS technical_reports (
                report_id TEXT PRIMARY KEY,
                sent_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS notifications (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                reminder_id INTEGER NOT NULL REFERENCES reminders(id) ON DELETE CASCADE,
                patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
                kind TEXT NOT NULL CHECK (kind IN ('CONFIRMACION', 'RECORDATORIO_DIA', 'RECORDATORIO')),
                channel TEXT NOT NULL,
                contact TEXT NOT NULL,
                send_at TEXT NOT NULL,
                expires_at TEXT,
                status TEXT NOT NULL DEFAULT 'PENDIENTE',
                attempts INTEGER NOT NULL DEFAULT 0,
                manual_retries INTEGER NOT NULL DEFAULT 0,
                next_attempt TEXT,
                last_attempt_at TEXT,
                error TEXT NOT NULL DEFAULT '',
                started_at TEXT,
                sent_at TEXT,
                provider_ref TEXT NOT NULL DEFAULT '',
                created_at TEXT NOT NULL,
                UNIQUE (reminder_id, kind, channel)
            );
            CREATE INDEX IF NOT EXISTS notifications_due_idx ON notifications(status, send_at);
            CREATE INDEX IF NOT EXISTS notifications_patient_idx ON notifications(patient_id);
            """
        )
        patient_columns = {
            row["name"] for row in connection.execute("PRAGMA table_info(patients)")
        }
        patient_migrations = {
            "email_verified": "INTEGER NOT NULL DEFAULT 1 CHECK (email_verified IN (0, 1))",
            "codigo_verificacion": "TEXT",
            "verification_expires_at": "TEXT",
            "verification_sent_at": "TEXT",
            "verification_attempts": "INTEGER NOT NULL DEFAULT 0",
        }
        for column, definition in patient_migrations.items():
            if column not in patient_columns:
                connection.execute(
                    f"ALTER TABLE patients ADD COLUMN {column} {definition}"
                )

        reminder_columns = {
            row["name"] for row in connection.execute("PRAGMA table_info(reminders)")
        }
        delivery_columns = {
            "delivery_status": "TEXT NOT NULL DEFAULT 'PENDIENTE'",
            "delivery_attempts": "INTEGER NOT NULL DEFAULT 0",
            "delivery_next_attempt": "TEXT",
            "delivery_error": "TEXT NOT NULL DEFAULT ''",
            "delivery_sent_at": "TEXT",
            "delivery_started_at": "TEXT",
        }
        if "specialist" not in reminder_columns:
            connection.execute("ALTER TABLE reminders ADD COLUMN specialist TEXT NOT NULL DEFAULT ''")
        if "client_key" not in reminder_columns:
            connection.execute("ALTER TABLE reminders ADD COLUMN client_key TEXT")
        for column, definition in delivery_columns.items():
            if column not in reminder_columns:
                connection.execute(
                    f"ALTER TABLE reminders ADD COLUMN {column} {definition}"
                )
        connection.execute(
            """CREATE INDEX IF NOT EXISTS reminders_due_idx
               ON reminders(delivery_status, delivery_next_attempt, reminder_date, reminder_time)"""
        )
        stale_cutoff = (datetime.now(timezone.utc) - timedelta(minutes=5)).isoformat()
        connection.execute(
            """UPDATE reminders
               SET delivery_status = 'PENDIENTE', delivery_started_at = NULL
               WHERE delivery_status = 'PROCESANDO'
                 AND (delivery_started_at IS NULL OR delivery_started_at <= ?)""",
            (stale_cutoff,),
        )
        connection.execute(
            """CREATE UNIQUE INDEX IF NOT EXISTS reminders_client_key_idx
               ON reminders(patient_id, client_key) WHERE client_key IS NOT NULL"""
        )
        _migrar_recordatorios_existentes(connection)
        _recuperar_notificaciones_al_arrancar(connection)


def patient_public_data(row: sqlite3.Row) -> dict[str, object]:
    return {
        "id": row["id"],
        "email": row["email"],
        "first_name": row["first_name"],
        "last_name": row["last_name"],
        "document_type": row["document_type"],
        "document_number": row["document_number"],
        "phone": row["phone"],
        "email_verified": bool(row["email_verified"]),
    }


def notificacion_public_data(row: sqlite3.Row) -> dict[str, object]:
    programada = utc_desde_texto(row["send_at"]).astimezone(ZONA_HORARIA)
    enviada = utc_desde_texto(row["sent_at"]).astimezone(ZONA_HORARIA) if row["sent_at"] else None
    return {
        "id": row["id"],
        "clase": row["kind"],
        "estado": row["status"],
        "canal": row["channel"],
        "programada_para": programada.strftime("%Y-%m-%d %H:%M"),
        "enviada_en": enviada.strftime("%Y-%m-%d %H:%M") if enviada else "",
        "intentos": row["attempts"],
        "motivo": row["error"],
    }


def cargar_notificaciones(connection: sqlite3.Connection, reminder_ids: list[int]) -> dict[int, list[dict[str, object]]]:
    agrupadas: dict[int, list[dict[str, object]]] = {int(i): [] for i in reminder_ids}
    if not reminder_ids:
        return agrupadas
    marcas = ",".join("?" for _ in reminder_ids)
    for fila in connection.execute(
        f"SELECT * FROM notifications WHERE reminder_id IN ({marcas}) ORDER BY send_at, id", reminder_ids
    ):
        agrupadas[int(fila["reminder_id"])].append(notificacion_public_data(fila))
    return agrupadas


def reminder_public_data(row: sqlite3.Row, notificaciones: list[dict[str, object]] | None = None) -> dict[str, object]:
    return {
        "id": row["id"],
        "tipo": row["reminder_type"],
        "fecha": row["reminder_date"],
        "hora": row["reminder_time"],
        "especialista": row["specialist"],
        "detalle": row["detail"],
        "canal": row["channel"],
        "contacto": row["contact"],
        "es_cita": row["reminder_type"] in TIPOS_CITA,
        "notificaciones": notificaciones or [],
    }


def password_digest(password: str, salt: bytes) -> bytes:
    return hashlib.pbkdf2_hmac(
        "sha256", password.encode("utf-8"), salt, PBKDF2_ITERATIONS
    )


def _retraso_reintento(intentos: int) -> int:
    return min(3600, 30 * (2 ** min(max(intentos - 1, 0), 7)))


def _texto_recordatorio(recordatorio: dict[str, object]) -> str:
    fecha = datetime.strptime(str(recordatorio["reminder_date"]), "%Y-%m-%d").strftime("%d/%m/%Y")
    hora = datetime.strptime(str(recordatorio["reminder_time"]), "%H:%M").strftime("%I:%M %p")
    texto = (
        f"Hola, este es tu recordatorio de Mi Paciente: "
        f"{recordatorio['reminder_type']} el {fecha} a las {hora}."
    )
    detalle = str(recordatorio.get("detail", "")).strip()
    return f"{texto} Detalle: {detalle}" if detalle else texto


def _enviar_correo(
    destinatario: str,
    asunto: str,
    mensaje: str,
    es_html: bool = False,
    adjuntos: list[dict[str, str]] | None = None,
) -> None:
    api_key = os.environ.get("BREVO_API_KEY")
    if not api_key:
        raise ConfiguracionFaltante("Configura BREVO_API_KEY en Render.")

    remitente = os.environ.get(
        "MI_PACIENTE_SMTP_FROM", "latidoseguro.usc@gmail.com"
    ).strip()
    url = "https://api.brevo.com/v3/smtp/email"
    headers = {
        "api-key": api_key,
        "Content-Type": "application/json",
        "Accept": "application/json",
    }
    payload = {
        "sender": {"email": remitente, "name": "Latido Seguro"},
        "to": [{"email": destinatario}],
        "subject": asunto,
    }
    if es_html:
        payload["htmlContent"] = mensaje
    else:
        payload["textContent"] = mensaje
    if adjuntos:
        payload["attachment"] = adjuntos

    solicitud = Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers=headers,
        method="POST",
    )
    try:
        with urlopen(solicitud, timeout=20) as respuesta:
            if respuesta.status not in (200, 201):
                raise RuntimeError(f"Brevo respondió con estado {respuesta.status}")
    except Exception as error:
        raise RuntimeError(f"Error al enviar con Brevo: {sanear_error(error)}") from error


def _escapar_texto_ics(texto: str) -> str:
    return (
        texto.replace("\\", "\\\\")
        .replace(";", "\\;")
        .replace(",", "\\,")
        .replace("\r\n", "\\n")
        .replace("\n", "\\n")
        .replace("\r", "\\n")
    )


def generar_ics(
    tipo: str,
    fecha: str,
    hora: str,
    detalle: str,
    reminder_id: int,
) -> str:
    """Genera un evento iCalendar de una hora, con fechas en UTC y UID estable."""
    inicio_local = cita_datetime(fecha, hora)
    inicio_utc = inicio_local.astimezone(timezone.utc)
    fin_utc = inicio_utc + timedelta(hours=1)
    descripcion = detalle.strip() or "Recordatorio creado en Latido Seguro."
    lineas = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//Latido Seguro//Recordatorio//ES",
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH",
        "BEGIN:VEVENT",
        f"UID:recordatorio-{reminder_id}@latidoseguro.com",
        f"DTSTAMP:{datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')}",
        f"DTSTART:{inicio_utc.strftime('%Y%m%dT%H%M%SZ')}",
        f"DTEND:{fin_utc.strftime('%Y%m%dT%H%M%SZ')}",
        f"SUMMARY:{_escapar_texto_ics('Recordatorio: ' + tipo)}",
        f"DESCRIPTION:{_escapar_texto_ics(descripcion)}",
        "END:VEVENT",
        "END:VCALENDAR",
    ]
    return "\r\n".join(lineas) + "\r\n"


def _construir_correo_html(titulo: str, contenido_html: str) -> str:
    contacto_html = """
    <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #2D68C4; text-align: center; font-size: 13px; color: #53565A;">
        <p style="margin: 0 0 10px 0; font-weight: bold; color: #0033A0;">Contáctanos por:</p>
        <p style="margin: 0 0 5px 0;">📞 Línea de atención: (602) 485 7164</p>
        <p style="margin: 0 0 5px 0;">✉️ Correo: latidoseguro.usc@gmail.com</p>
        <p style="margin: 0 0 5px 0;">📍 Dirección: Clínica Al Alba, Cali</p>
    </div>
    """

    return f"""<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
        body {{ font-family: 'Segoe UI', Arial, sans-serif; background-color: #F5F7FA; margin: 0; padding: 0; }}
        .container {{ max-width: 600px; margin: 20px auto; background: #FFFFFF; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,51,160,0.05); }}
        .banner {{ background: #0033A0; padding: 40px 20px; text-align: center; color: #FFFFFF; }}
        .banner h1 {{ margin: 0; font-size: 24px; font-weight: bold; letter-spacing: 0.5px; }}
        .banner p {{ margin: 10px 0 0 0; color: #00A3E0; font-size: 16px; }}
        .content {{ padding: 30px; color: #53565A; line-height: 1.6; }}
        .content h2 {{ color: #0033A0; font-size: 20px; margin-top: 0; }}
        .box {{ background: #E8EFF8 !important; color: #0033A0 !important; padding: 20px; margin: 20px 0; border-radius: 8px; border-left: 4px solid #2D68C4; }}
        .box p, .box strong {{ color: #0033A0 !important; margin: 8px 0; }}
        .box.aviso {{ background: #E8EFF8 !important; border-left: 4px solid #00A3E0; }}
        .box.aviso p, .box.aviso strong {{ color: #0033A0 !important; }}
        .btn {{ display: inline-block; background: #0033A0; color: #FFFFFF !important; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: bold; margin-top: 20px; }}
    </style>
</head>
<body>
    <div class="container">
        <div class="banner">
            <h1>Latido Seguro</h1>
            <p>Tu salud es nuestra mayor prioridad</p>
        </div>
        <div class="content">
            <h2>{html_escape(titulo)}</h2>
            {contenido_html}
            {contacto_html}
        </div>
    </div>
</body>
</html>"""

def enviar_reporte_tecnico(tipo: str, detalle: str, correo_paciente: str) -> bool:
    administrador = (
        os.environ.get("MI_PACIENTE_REPORT_TO", "").strip()
        or os.environ.get("MI_PACIENTE_SMTP_FROM", "").strip()
        or "latidoseguro.usc@gmail.com"
    )
    asunto = f"Nuevo Reporte Técnico: {tipo}"
    mensaje = (
        "Hola, equipo de Latido Seguro.\n\n"
        "Un usuario ha reportado un problema en la plataforma:\n\n"
        f"Reportado por: {correo_paciente}\n"
        f"Tipo de problema: {tipo}\n"
        f"Detalle: {detalle if detalle else 'Sin detalle adicional'}\n\n"
        "Por favor, revisen el sistema."
    )
    try:
        _enviar_correo(administrador, asunto, mensaje)
        return True
    except Exception as error:
        print(f"Error al enviar el reporte técnico: {type(error).__name__}")
        return False


def enviar_correo_confirmacion(
    destinatario: str,
    tipo: str,
    fecha: str,
    hora: str,
    especialista: str,
    detalle: str,
) -> bool:
    plataforma_url = html_escape(
        os.environ.get("MI_PACIENTE_PUBLIC_URL", "http://127.0.0.1:8000/").strip()
        or "http://127.0.0.1:8000/",
        quote=True,
    )
    contenido = f"""
    <p>Hola,</p>
    <p>Has creado exitosamente un nuevo evento en <strong>Latido Seguro</strong>. Aquí están los detalles:</p>
    <div class="box">
        <p style="margin: 5px 0;"><strong>Tipo de evento:</strong> {html_escape(tipo)}</p>
        <p style="margin: 5px 0;"><strong>Especialista:</strong> {html_escape(especialista or 'No especificado')}</p>
        <p style="margin: 5px 0;"><strong>Fecha:</strong> {html_escape(fecha)}</p>
        <p style="margin: 5px 0;"><strong>Hora:</strong> {html_escape(hora)}</p>
        <p style="margin: 5px 0;"><strong>Detalle:</strong> {html_escape(detalle or 'Sin detalle adicional')}</p>
    </div>
    <div class="box aviso" style="background: #E8EFF8; border-left: 4px solid #00A3E0;">
        <p style="margin: 0; font-size: 13px; color: #0033A0;">
            ⚠️ <strong>Importante:</strong> Esto es un recordatorio personal...
        </p>
    </div>
    <p>Recibirás otro correo recordatorio cuando se acerque la fecha.</p>
    <a href="{plataforma_url}" class="btn">Ir a mi cuenta</a>
    """
    mensaje_html = _construir_correo_html("Confirmación de agendamiento", contenido)

    try:
        _enviar_correo(
            destinatario,
            "Confirmación: Has creado una cita en Latido Seguro",
            mensaje_html,
            es_html=True,
        )
        return True
    except Exception as error:
        print(f"Error al enviar confirmación ({type(error).__name__}).")
        return False

def enviar_correo_recordatorio(destinatario: str, tipo: str, fecha: str, hora: str) -> bool:
    contenido = f"""
    <p>Hola,</p>
    <p>Te recordamos que tienes un evento programado en <strong>Latido Seguro</strong>.</p>
    <div class="box">
        <p style="margin: 5px 0;"><strong>Tipo:</strong> {html_escape(tipo)}</p>
        <p style="margin: 5px 0;"><strong>Fecha:</strong> {html_escape(fecha)}</p>
        <p style="margin: 5px 0;"><strong>Hora:</strong> {html_escape(hora)}</p>
    </div>
    <p>Por favor, ingresa a la plataforma para más detalles.</p>
    """
    mensaje_html = _construir_correo_html("¡Tienes un recordatorio!", contenido)

    try:
        _enviar_correo(
            destinatario,
            "Recordatorio en Latido Seguro",
            mensaje_html,
            es_html=True,
        )
        return True
    except Exception as error:
        print(f"Error al enviar el correo del recordatorio ({type(error).__name__}).")
        return False

def _normalizar_telefono(contacto: str) -> str:
    try:
        return normalizar_telefono_movil(contacto)
    except ValueError as error:
        raise EnvioPermanente(str(error)) from None


def _enviar_mensaje_twilio(contacto: str, mensaje: str, es_whatsapp: bool) -> str:
    """Envía por Twilio y devuelve el SID. Solo retorna si Twilio aceptó el mensaje."""
    cuenta = os.environ.get("MI_PACIENTE_TWILIO_ACCOUNT_SID", "").strip()
    token = os.environ.get("MI_PACIENTE_TWILIO_AUTH_TOKEN", "").strip()
    variable_remitente = (
        "MI_PACIENTE_TWILIO_WHATSAPP_FROM" if es_whatsapp
        else "MI_PACIENTE_TWILIO_SMS_FROM"
    )
    remitente = os.environ.get(variable_remitente, "").strip()
    if not cuenta or not token or not remitente:
        raise ConfiguracionFaltante(
            f"Configura MI_PACIENTE_TWILIO_ACCOUNT_SID, MI_PACIENTE_TWILIO_AUTH_TOKEN y {variable_remitente}."
        )

    destino = _normalizar_telefono(contacto)
    if es_whatsapp:
        if not remitente.lower().startswith("whatsapp:"):
            remitente = f"whatsapp:{remitente}"
        destino = f"whatsapp:{destino}"
    url = f"https://api.twilio.com/2010-04-01/Accounts/{cuenta}/Messages.json"
    datos = urlencode({"To": destino, "From": remitente, "Body": mensaje}).encode("utf-8")
    autorizacion = base64.b64encode(f"{cuenta}:{token}".encode("utf-8")).decode("ascii")
    solicitud = Request(
        url,
        data=datos,
        headers={
            "Authorization": f"Basic {autorizacion}",
            "Content-Type": "application/x-www-form-urlencoded",
        },
        method="POST",
    )
    try:
        with urlopen(solicitud, timeout=20) as respuesta:
            estado_http = respuesta.status
            cuerpo = respuesta.read(65536)
    except HTTPError as error:
        try:
            detalle = json.loads(error.read(65536).decode("utf-8"))
        except Exception:
            detalle = {}
        texto = f"Twilio rechazó el mensaje (HTTP {error.code}"
        if detalle.get("code"):
            texto += f", código {detalle['code']}"
        texto += f"): {detalle.get('message', 'sin detalle')}"
        if 400 <= error.code < 500 and error.code != 429:
            raise EnvioPermanente(texto) from None
        raise RuntimeError(texto) from None
    if not 200 <= estado_http < 300:
        raise RuntimeError(f"Twilio respondió con estado HTTP {estado_http}.")
    try:
        respuesta_json = json.loads(cuerpo.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError):
        respuesta_json = {}
    sid = str(respuesta_json.get("sid", "")).strip()
    if not sid:
        raise RuntimeError("Twilio no devolvió el identificador del mensaje; no se puede confirmar el envío.")
    if respuesta_json.get("status") in {"failed", "undelivered"}:
        raise RuntimeError(f"Twilio reportó el mensaje como {respuesta_json['status']}.")
    return sid


def _enviar_correo_cita(
    clase: str,
    destinatario: str,
    tipo: str,
    fecha: str,
    hora: str,
    detalle: str,
    reminder_id: int,
) -> None:
    """Correo de confirmación o de recordatorio del día. Lanza excepción si falla (a diferencia de los antiguos)."""
    es_cita = tipo in TIPOS_CITA
    fecha_visible = fecha_legible(fecha)
    hora_visible = hora_legible(hora)
    plataforma_url = html_escape(
        os.environ.get("MI_PACIENTE_PUBLIC_URL", "http://127.0.0.1:8000/").strip() or "http://127.0.0.1:8000/",
        quote=True,
    )
    if clase == "CONFIRMACION":
        asunto = "Latido Seguro: tu cita ha sido programada" if es_cita else "Latido Seguro: recordatorio creado"
        titulo = "Confirmación de tu cita" if es_cita else "Recordatorio creado"
        frase = (
            f"Tu cita ha sido programada para el <strong>{html_escape(fecha_visible)}</strong> a las <strong>{html_escape(hora_visible)}</strong>"
            if es_cita else
            f"Has creado un recordatorio para el <strong>{html_escape(fecha_visible)}</strong> a las <strong>{html_escape(hora_visible)}</strong>"
        )
        cierre = "Recibirás un recordatorio el día de tu cita." if es_cita else "Te avisaremos a la hora indicada."
    else:
        asunto = "Latido Seguro: hoy tienes una cita"
        titulo = "Recordatorio de tu cita"
        frase = f"Te recordamos que hoy tienes una cita programada a las <strong>{html_escape(hora_visible)}</strong>"
        cierre = "Consulta los detalles en tu cuenta."
    contenido = f"""
    <p>Hola,</p>
    <p>{con_punto(frase) if not frase.endswith('</strong>') else frase}.</p>
    <div class="box">
        <p style="margin: 5px 0;"><strong>Tipo:</strong> {html_escape(tipo)}</p>
        <p style="margin: 5px 0;"><strong>Fecha:</strong> {html_escape(fecha_visible)}</p>
        <p style="margin: 5px 0;"><strong>Hora:</strong> {html_escape(hora_visible)}</p>
    </div>
    <p>{cierre} Recuerda consultar los detalles en la plataforma.</p>
    <a href="{plataforma_url}" class="btn">Ir a mi cuenta</a>
    """
    adjuntos = None
    if clase == "CONFIRMACION":
        ics = generar_ics(tipo, fecha, hora, detalle, reminder_id)
        adjuntos = [{
            "name": f"recordatorio-{reminder_id}.ics",
            "content": base64.b64encode(ics.encode("utf-8")).decode("ascii"),
        }]
    _enviar_correo(
        destinatario,
        asunto,
        _construir_correo_html(titulo, contenido),
        es_html=True,
        adjuntos=adjuntos,
    )


def texto_sms_cita(clase: str, tipo: str, fecha: str, hora: str) -> str:
    """Texto de SMS/WhatsApp. No incluye detalles médicos (especialista, detalle libre)."""
    if clase == "CONFIRMACION":
        return (
            f"Latido Seguro: tu cita ha sido programada para el {fecha} a las {con_punto(hora)} "
            f"Tipo de cita: {tipo}. Recuerda consultar los detalles de tu cita en la plataforma."
        )
    return (
        f"Latido Seguro: te recordamos que hoy tienes una cita programada a las {con_punto(hora)} "
        f"Tipo de cita: {tipo}. Consulta los detalles en tu cuenta."
    )


def _despachar_notificacion(notificacion: dict[str, object]) -> str:
    """Envía una notificación por su canal. Devuelve la referencia del proveedor ('' si no hay)."""
    canal = str(notificacion["channel"])
    contacto = str(notificacion["contact"])
    clase = str(notificacion["kind"])
    if clase == "RECORDATORIO":  # dieta, medicamentos y ejercicio: aviso a la hora indicada (comportamiento anterior)
        _enviar_recordatorio({**notificacion, "channel": canal, "contact": contacto})
        return ""
    tipo = str(notificacion["reminder_type"])
    fecha = str(notificacion["reminder_date"])
    hora = str(notificacion["reminder_time"])
    if canal == "Correo electrónico":
        detalle = str(notificacion.get("detail", ""))
        _enviar_correo_cita(
            clase,
            contacto,
            tipo,
            fecha,
            hora,
            detalle,
            int(notificacion["reminder_id"]),
        )
        return ""
    if canal in {"SMS", "WhatsApp"}:
        return _enviar_mensaje_twilio(contacto, texto_sms_cita(clase, tipo, fecha, hora), es_whatsapp=(canal == "WhatsApp"))
    raise EnvioPermanente("El canal guardado para el aviso no es válido.")


def _enviar_recordatorio(recordatorio: dict[str, object]) -> None:
    canal = str(recordatorio["channel"])
    contacto = str(recordatorio["contact"])
    if canal == "Correo electrónico":
        fecha = datetime.strptime(str(recordatorio["reminder_date"]), "%Y-%m-%d").strftime("%d/%m/%Y")
        hora = datetime.strptime(str(recordatorio["reminder_time"]), "%H:%M").strftime("%I:%M %p")
        enviado = enviar_correo_recordatorio(
            contacto,
            str(recordatorio["reminder_type"]),
            fecha,
            hora,
        )
        if not enviado:
            raise RuntimeError("No se pudo enviar el correo del recordatorio.")
    elif canal in {"SMS", "WhatsApp"}:
        mensaje = _texto_recordatorio(recordatorio)
        _enviar_mensaje_twilio(contacto, mensaje, es_whatsapp=(canal == "WhatsApp"))
    else:
        raise RuntimeError("El canal guardado para el recordatorio no es válido.")


def _insertar_notificacion(
    connection: sqlite3.Connection,
    reminder_id: int,
    patient_id: int,
    clase: str,
    canal: str,
    contacto: str,
    enviar_en: datetime,
    vence_en: datetime | None,
    estado: str = "PENDIENTE",
    error: str = "",
    intentos: int = 0,
    enviada_en: str | None = None,
) -> int:
    cursor = connection.execute(
        """INSERT INTO notifications
           (reminder_id, patient_id, kind, channel, contact, send_at, expires_at, status,
            attempts, error, sent_at, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            reminder_id, patient_id, clase, canal, contacto, utc_texto(enviar_en),
            utc_texto(vence_en) if vence_en else None, estado, intentos, error, enviada_en,
            utc_texto(ahora_utc()),
        ),
    )
    return int(cursor.lastrowid)


def _migrar_recordatorios_existentes(connection: sqlite3.Connection) -> None:
    """Crea los avisos de los recordatorios anteriores a esta versión sin borrar ni alterar nada."""
    ahora = ahora_bogota()
    filas = connection.execute(
        """SELECT r.* FROM reminders AS r
           WHERE NOT EXISTS (SELECT 1 FROM notifications AS n WHERE n.reminder_id = r.id)"""
    ).fetchall()
    for fila in filas:
        try:
            cita = cita_datetime(fila["reminder_date"], fila["reminder_time"])
        except ValueError:
            print(f"Recordatorio #{fila['id']} con fecha inválida: {fila['reminder_date']} {fila['reminder_time']}")
            continue
        base = (fila["id"], fila["patient_id"])
        canal, contacto, tipo = fila["channel"], fila["contact"], fila["reminder_type"]
        if fila["delivery_status"] == "ENVIADO":
            _insertar_notificacion(connection, *base, "RECORDATORIO", canal, contacto, cita, cita,
                                   "ENVIADO", intentos=int(fila["delivery_attempts"]) + 1,
                                   enviada_en=fila["delivery_sent_at"])
        elif tipo in TIPOS_CITA:
            envio = planificar_recordatorio_dia(cita, ahora) if cita > ahora else None
            if envio is not None:
                _insertar_notificacion(connection, *base, "RECORDATORIO_DIA", canal, contacto, envio, cita)
            else:
                _insertar_notificacion(connection, *base, "RECORDATORIO", canal, contacto, cita, cita, "VENCIDO")
        else:
            vence = cita + GRACIA_RECORDATORIO_LIBRE
            estado = "PENDIENTE" if vence > ahora else "VENCIDO"
            _insertar_notificacion(connection, *base, "RECORDATORIO", canal, contacto, cita, vence, estado,
                                   error=str(fila["delivery_error"] or ""), intentos=int(fila["delivery_attempts"]))


def _liberar_envios_colgados(connection: sqlite3.Connection) -> None:
    """Un envío 'PROCESANDO' por más de 5 minutos se considera interrumpido y vuelve a la cola."""
    limite = utc_texto(ahora_utc() - timedelta(minutes=5))
    connection.execute(
        """UPDATE notifications SET status = 'PENDIENTE', started_at = NULL
           WHERE status = 'PROCESANDO' AND (started_at IS NULL OR started_at <= ?)""",
        (limite,),
    )


def _recuperar_notificaciones_al_arrancar(connection: sqlite3.Connection) -> None:
    """Tras un reinicio: libera envíos colgados, reactiva los que esperaban configuración y vence los inútiles."""
    ahora = utc_texto(ahora_utc())
    _liberar_envios_colgados(connection)
    connection.execute(
        """UPDATE notifications SET status = 'PENDIENTE', error = ''
           WHERE status = 'SIN_CONFIGURAR'"""
    )
    connection.execute(
        """UPDATE notifications
           SET status = 'VENCIDO', next_attempt = NULL,
               error = 'La cita o el aviso ya pasó mientras el servidor estaba apagado.'
           WHERE status = 'PENDIENTE' AND expires_at IS NOT NULL AND expires_at <= ?""",
        (ahora,),
    )


SELECT_NOTIFICACIONES = """SELECT n.*, r.reminder_type, r.reminder_date, r.reminder_time, r.detail, r.specialist
   FROM notifications AS n
   JOIN reminders AS r ON r.id = n.reminder_id
   JOIN patients AS p ON p.id = n.patient_id"""


def _marcar_vencidas() -> None:
    ahora = utc_texto(ahora_utc())
    with transaccion() as connection:
        _liberar_envios_colgados(connection)
        connection.execute(
            """UPDATE notifications
               SET status = 'VENCIDO', next_attempt = NULL, started_at = NULL,
                   error = CASE WHEN error = '' THEN 'Ya pasó el momento útil para enviar este aviso.' ELSE error END
               WHERE status IN ('PENDIENTE', 'SIN_CONFIGURAR')
                 AND expires_at IS NOT NULL AND expires_at <= ?""",
            (ahora,),
        )


def _reservar_notificaciones(limite: int = 25, notificacion_id: int | None = None) -> list[dict[str, object]]:
    """Reserva de forma atómica las notificaciones listas para enviar (PENDIENTE -> PROCESANDO)."""
    ahora = utc_texto(ahora_utc())
    filtro_id = " AND n.id = ?" if notificacion_id is not None else ""
    parametros: list[object] = [ahora, ahora, ahora]
    if notificacion_id is not None:
        parametros.append(notificacion_id)
    parametros.append(limite)
    reservadas: list[dict[str, object]] = []
    with transaccion() as connection:
        filas = connection.execute(
            f"""{SELECT_NOTIFICACIONES}
                WHERE p.email_verified = 1 AND n.status = 'PENDIENTE'
                  AND n.send_at <= ?
                  AND (n.next_attempt IS NULL OR n.next_attempt <= ?)
                  AND (n.expires_at IS NULL OR n.expires_at > ?){filtro_id}
                ORDER BY n.send_at, n.id LIMIT ?""",
            parametros,
        ).fetchall()
        iniciado = utc_texto(ahora_utc())
        for fila in filas:
            cursor = connection.execute(
                """UPDATE notifications SET status = 'PROCESANDO', started_at = ?
                   WHERE id = ? AND status = 'PENDIENTE'""",
                (iniciado, fila["id"]),
            )
            if cursor.rowcount == 1:
                reservadas.append(dict(fila))
    return reservadas


def _marcar_notificacion_enviada(notificacion_id: int, referencia: str) -> None:
    ahora = utc_texto(ahora_utc())
    with transaccion() as connection:
        connection.execute(
            """UPDATE notifications
               SET status = 'ENVIADO', sent_at = ?, last_attempt_at = ?, provider_ref = ?,
                   attempts = attempts + 1, next_attempt = NULL, error = '', started_at = NULL
               WHERE id = ? AND status = 'PROCESANDO'""",
            (ahora, ahora, referencia, notificacion_id),
        )


def _registrar_fallo_notificacion(notificacion: dict[str, object], error: Exception) -> None:
    ahora = ahora_utc()
    texto = sanear_error(error)
    intentos = int(notificacion["attempts"])
    proximo: str | None = None
    if isinstance(error, ConfiguracionFaltante):
        estado = "SIN_CONFIGURAR"
        texto = mensaje_canal_sin_configurar(str(notificacion["channel"])) or texto
    else:
        intentos += 1
        if isinstance(error, EnvioPermanente) or intentos >= MAX_INTENTOS_ENVIO:
            estado = "FALLIDO"
        else:
            estado = "PENDIENTE"
            proximo = utc_texto(ahora + timedelta(seconds=_retraso_reintento(intentos)))
    with transaccion() as connection:
        connection.execute(
            """UPDATE notifications
               SET status = ?, attempts = ?, next_attempt = ?, error = ?, last_attempt_at = ?, started_at = NULL
               WHERE id = ? AND status = 'PROCESANDO'""",
            (estado, intentos, proximo, texto, utc_texto(ahora), notificacion["id"]),
        )
    print(f"Aviso #{notificacion['id']} ({notificacion['kind']}, {notificacion['channel']}): {estado}, intento {intentos}: {texto}")


def _procesar_notificacion(notificacion: dict[str, object]) -> None:
    """Envía una notificación ya reservada. La base no está bloqueada durante la llamada externa."""
    with lectura() as connection:
        sigue_vigente = connection.execute(
            "SELECT 1 FROM reminders WHERE id = ?", (notificacion["reminder_id"],)
        ).fetchone()
    if not sigue_vigente:  # la cita se canceló mientras se reservaba el aviso
        return
    try:
        referencia = _despachar_notificacion(notificacion)
    except Exception as error:
        _registrar_fallo_notificacion(notificacion, error)
        return
    _marcar_notificacion_enviada(int(notificacion["id"]), referencia)
    print(f"Aviso #{notificacion['id']} ({notificacion['kind']}) enviado por {notificacion['channel']}.")


def intentar_envio_inmediato(notificacion_id: int) -> None:
    for notificacion in _reservar_notificaciones(1, notificacion_id):
        _procesar_notificacion(notificacion)


def procesar_notificaciones_pendientes(limite: int = 25) -> int:
    _marcar_vencidas()
    reservadas = _reservar_notificaciones(limite)
    for notificacion in reservadas:
        _procesar_notificacion(notificacion)
    return len(reservadas)


def vigilante_recordatorios(detener: threading.Event) -> None:
    print("🧠 Cerebro vigilante activado. Revisando cada 30 segundos...")
    while not detener.is_set():
        try:
            procesar_notificaciones_pendientes()
        except Exception as error:
            print(f"Error en el vigilante de recordatorios: {sanear_error(error)}")
        detener.wait(30)


def reprogramar_notificaciones(connection: sqlite3.Connection, recordatorio: sqlite3.Row, cita: datetime, ahora: datetime) -> None:
    """Ajusta los avisos NO enviados cuando cambia la fecha u hora de la cita. Los ya enviados no se tocan."""
    tipo, canal, contacto = recordatorio["reminder_type"], recordatorio["channel"], recordatorio["contact"]
    existentes = {
        fila["kind"]: fila
        for fila in connection.execute("SELECT * FROM notifications WHERE reminder_id = ?", (recordatorio["id"],))
    }
    for clase, enviar_en, vence_en in planificar_notificaciones(tipo, canal, cita, ahora):
        actual = existentes.pop(clase, None)
        if actual is None:
            _insertar_notificacion(connection, recordatorio["id"], recordatorio["patient_id"], clase, canal, contacto, enviar_en, vence_en)
        elif actual["status"] != "ENVIADO":
            estado = "PENDIENTE" if actual["status"] in {"PENDIENTE", "VENCIDO"} else actual["status"]
            connection.execute(
                """UPDATE notifications SET send_at = ?, expires_at = ?, status = ?, attempts = 0,
                          next_attempt = NULL, error = '', started_at = NULL WHERE id = ?""",
                (utc_texto(enviar_en), utc_texto(vence_en), estado, actual["id"]),
            )
    for clase, actual in existentes.items():  # avisos que ya no tienen sentido (p. ej. no hay tiempo para el del día)
        if actual["status"] != "ENVIADO":
            connection.execute("DELETE FROM notifications WHERE id = ?", (actual["id"],))



class MiPacienteHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(BASE_DIR), **kwargs)

    def send_head(self):
        requested = Path(self.translate_path(self.path)).resolve()
        requested_name = requested.name.casefold()
        if (
            requested_name.startswith((".env", "_env"))
            or requested_name.startswith(DB_PATH.name.casefold())
            or requested.suffix.casefold() in {".py", ".pyc", ".docx", ".sqlite3", ".db", ".txt"}
        ):
            self.send_error(404, "Not found")
            return None
        return super().send_head()

    def list_directory(self, _path):
        self.send_error(404, "Not found")
        return None

    def end_headers(self) -> None:
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "strict-origin-when-cross-origin")
        self.send_header("Access-Control-Allow-Origin", "https://latidoseguro.com")
        self.send_header("Access-Control-Allow-Credentials", "true")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        super().end_headers()

    def send_json(self, status: int, payload: dict[str, object]) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def read_json(self) -> dict[str, object] | None:
        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            return None
        if length < 1 or length > 16_384:
            return None
        try:
            payload = json.loads(self.rfile.read(length).decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError):
            return None
        return payload if isinstance(payload, dict) else None

    def session_token(self) -> str | None:
        cookie = SimpleCookie()
        try:
            cookie.load(self.headers.get("Cookie", ""))
        except Exception:
            return None
        morsel = cookie.get(SESSION_COOKIE)
        return morsel.value if morsel else None

    def current_patient(self) -> sqlite3.Row | None:
        token = self.session_token()
        if not token:
            return None
        token_hash = hashlib.sha256(token.encode("ascii", "ignore")).digest()
        now = datetime.now(timezone.utc).isoformat()
        with db_session() as connection:
            row = connection.execute(
                """SELECT p.* FROM sessions s JOIN patients p ON p.id = s.patient_id
                   WHERE s.token_hash = ? AND s.expires_at > ?""",
                (token_hash, now),
            ).fetchone()
        return row

    def set_session_cookie(self, token: str, max_age: int) -> None:
        secure = "; Secure" if os.environ.get("MI_PACIENTE_HTTPS") == "1" else ""
        self.send_header(
            "Set-Cookie",
            f"{SESSION_COOKIE}={token}; HttpOnly; SameSite=Lax; Path=/; Max-Age={max_age}{secure}",
        )

    def create_session(self, patient_id: int) -> None:
        token = secrets.token_urlsafe(32)
        token_hash = hashlib.sha256(token.encode("ascii")).digest()
        expires = datetime.now(timezone.utc) + timedelta(days=SESSION_DAYS)
        with db_session() as connection:
            connection.execute("DELETE FROM sessions WHERE expires_at <= ?", (datetime.now(timezone.utc).isoformat(),))
            connection.execute(
                "INSERT INTO sessions (token_hash, patient_id, expires_at) VALUES (?, ?, ?)",
                (token_hash, patient_id, expires.isoformat()),
            )
            patient = connection.execute("SELECT * FROM patients WHERE id = ?", (patient_id,)).fetchone()

        body = json.dumps({"user": patient_public_data(patient)}, ensure_ascii=False).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.set_session_cookie(token, SESSION_DAYS * 24 * 60 * 60)
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self) -> None:
        self.send_response(204)
        self.end_headers()

    def do_GET(self) -> None:
        route = urlsplit(self.path).path
        if route == "/api/me":
            patient = self.current_patient()
            if not patient:
                self.send_json(401, {"error": "No hay una sesión iniciada."})
                return
            self.send_json(200, {"user": patient_public_data(patient)})
            return
        if route == "/recordatorios":
            patient = self.current_patient()
            if not patient:
                self.send_json(401, {"error": "Inicia sesión para consultar tus recordatorios."})
                return
            with db_session() as connection:
                rows = connection.execute(
                    """SELECT * FROM reminders WHERE patient_id = ?
                       ORDER BY reminder_date, reminder_time, id""",
                    (patient["id"],),
                ).fetchall()
                notificaciones = cargar_notificaciones(connection, [int(row["id"]) for row in rows])
            self.send_json(200, {"recordatorios": [reminder_public_data(row, notificaciones[int(row["id"])]) for row in rows]})
            return
        if route == "/api/contacto-notificaciones":
            self.notification_contact_info()
            return
        super().do_GET()

    def do_POST(self) -> None:
        route = urlsplit(self.path).path
        if route == "/api/register":
            self.register_patient()
        elif route == "/api/verify-email":
            self.verify_email()
        elif route == "/api/resend-verification":
            self.resend_verification()
        elif route == "/api/login":
            self.login_patient()
        elif route == "/api/logout":
            self.logout_patient()
        elif route == "/api/reportar-problema":
            self.report_technical_problem()
        elif route == "/guardar-recordatorio":
            self.save_reminder()
        elif route == "/eliminar-recordatorio":
            self.delete_reminder()
        elif route == "/actualizar-recordatorio":
            self.update_reminder()
        elif route == "/reintentar-notificacion":
            self.retry_notification()
        else:
            self.send_json(404, {"error": "Ruta no encontrada."})

    def report_technical_problem(self) -> None:
        data = self.read_json()
        if data is None:
            self.send_json(400, {"error": "No se pudo leer el reporte."})
            return

        raw_type = data.get("tipo", "")
        raw_detail = data.get("detalle", "")
        raw_email = data.get("correo", "")
        report_type = " ".join(raw_type.split()) if isinstance(raw_type, str) else ""
        detail = " ".join(raw_detail.split()) if isinstance(raw_detail, str) else ""
        contact_email = raw_email.strip().lower() if isinstance(raw_email, str) else ""
        report_id = str(data.get("id", "")).strip()

        if report_type not in REPORT_TYPES:
            self.send_json(400, {"error": "Selecciona un tipo de problema válido."})
            return
        if len(detail) > 500:
            self.send_json(400, {"error": "El detalle puede tener hasta 500 caracteres."})
            return
        if contact_email and (len(contact_email) > 254 or not EMAIL_RE.fullmatch(contact_email)):
            self.send_json(400, {"error": "Ingresa un correo de contacto válido."})
            return
        if not re.fullmatch(r"[A-Za-z0-9_-]{16,80}", report_id):
            self.send_json(400, {"error": "El identificador del reporte no es válido."})
            return

        client_ip = self.client_address[0]
        now_monotonic = time.monotonic()
        with _TECH_REPORT_RATE_LOCK:
            last_submission = _TECH_REPORT_LAST_BY_IP.get(client_ip, 0.0)
            if now_monotonic - last_submission < TECH_REPORT_RATE_LIMIT_SECONDS:
                self.send_json(429, {"error": "Espera un momento antes de enviar otro reporte."})
                return
            _TECH_REPORT_LAST_BY_IP[client_ip] = now_monotonic
            for address, submitted_at in list(_TECH_REPORT_LAST_BY_IP.items()):
                if now_monotonic - submitted_at > 600:
                    _TECH_REPORT_LAST_BY_IP.pop(address, None)

        recipient = (
            os.environ.get("MI_PACIENTE_REPORT_TO", "").strip()
            or os.environ.get("MI_PACIENTE_SMTP_FROM", "").strip()
            or "latidoseguro.usc@gmail.com"
        )
        if not EMAIL_RE.fullmatch(recipient):
            self.send_json(503, {"error": "El correo de destino de los reportes no está configurado."})
            return

        with _TECH_REPORT_SEND_LOCK:
            with db_session() as connection:
                already_sent = connection.execute(
                    "SELECT 1 FROM technical_reports WHERE report_id = ?",
                    (report_id,),
                ).fetchone()
            if already_sent:
                self.send_json(200, {"ok": True, "duplicado": True})
                return

            received_at = datetime.now(timezone.utc)
            if not enviar_reporte_tecnico(report_type, detail, contact_email):
                self.send_json(503, {"error": "No fue posible enviar el reporte al correo."})
                return

            with db_session() as connection:
                connection.execute(
                    "INSERT OR IGNORE INTO technical_reports (report_id, sent_at) VALUES (?, ?)",
                    (report_id, received_at.isoformat()),
                )

        self.send_json(200, {"ok": True})
    def _validar_fecha_hora(self, data: dict[str, object]):
        """Devuelve (fecha, hora, cita, ahora) validadas en hora de Colombia o responde el error y devuelve None."""
        fecha = str(data.get("fecha", "")).strip()
        hora = str(data.get("hora", "")).strip()
        if not FECHA_RE.fullmatch(fecha) or not HORA_RE.fullmatch(hora):
            self.send_json(400, {"error": "La fecha o la hora de la cita no son válidas."})
            return None
        try:
            cita = cita_datetime(fecha, hora)
        except ValueError:
            self.send_json(400, {"error": "La fecha o la hora de la cita no son válidas."})
            return None
        ahora = ahora_bogota()
        if cita <= ahora:
            self.send_json(400, {"error": "Elige una fecha y hora futuras (hora de Colombia)."})
            return None
        if cita > ahora + HORIZONTE_CITAS:
            self.send_json(400, {"error": "Elige una fecha dentro de los próximos dos años."})
            return None
        return fecha, hora, cita, ahora

    def _respuesta_recordatorio(self, estado: int, reminder_id: int, creado: bool) -> None:
        with lectura() as connection:
            fila = connection.execute("SELECT * FROM reminders WHERE id = ?", (reminder_id,)).fetchone()
            notificaciones = cargar_notificaciones(connection, [reminder_id])
        self.send_json(estado, {"recordatorio": reminder_public_data(fila, notificaciones[reminder_id]), "creado": creado})

    def save_reminder(self) -> None:
        patient = self.current_patient()
        if not patient:
            self.send_json(401, {"error": "Inicia sesión para guardar un recordatorio."})
            return
        data = self.read_json()
        if data is None:
            self.send_json(400, {"error": "No se pudo leer el recordatorio."})
            return

        reminder_type = str(data.get("tipo", "")).strip()
        specialist = str(data.get("especialista", "")).strip()
        detail = " ".join(str(data.get("detalle", "")).split())
        channel = str(data.get("canal", "")).strip()
        contact = " ".join(str(data.get("contacto", "")).split())
        usar_registrado = data.get("usar_contacto_registrado") is True
        clave = str(data.get("clave_solicitud", "")).strip()
        clave = clave if CLAVE_SOLICITUD_RE.fullmatch(clave) else ""
        valid_types = {"Cita de control", "Cita prioritaria", "Dieta", "Medicamentos", "Ejercicio"}
        valid_specialists = {
            "Cardiólogo clínico",
            "Cardiólogo intervencionista / Hemodinamista",
            "Electrofisiólogo cardíaco",
            "Cardiólogo pediatra",
            "Cirujano cardiovascular",
        }

        if reminder_type not in valid_types:
            self.send_json(400, {"error": "Selecciona una opción válida para el recordatorio."})
            return
        if reminder_type == "Cita de control":
            if specialist not in valid_specialists:
                self.send_json(400, {"error": "Selecciona una especialidad válida para la cita de control."})
                return
        else:
            specialist = ""
        validado = self._validar_fecha_hora(data)
        if validado is None:
            return
        reminder_date, reminder_time, cita, ahora = validado
        if len(detail) > 120:
            self.send_json(400, {"error": "El detalle puede tener hasta 120 caracteres."})
            return
        if channel not in CANALES_VALIDOS:
            self.send_json(400, {"error": "Selecciona un canal de notificación."})
            return

        # El destino se resuelve en el servidor: con el contacto registrado se usa SIEMPRE el de la cuenta autenticada.
        if channel == "Correo electrónico":
            contact = str(patient["email"]) if usar_registrado else contact
            if not contact or len(contact) > 254 or not EMAIL_RE.fullmatch(contact):
                self.send_json(400, {"error": "Escribe un correo válido para recibir el aviso."})
                return
        else:
            bruto = str(patient["phone"]) if usar_registrado else contact
            try:
                contact = normalizar_telefono_movil(bruto)
            except ValueError as error:
                if usar_registrado:
                    mensaje = f"El número registrado en tu cuenta no es válido. {error} Escribe otro número para esta cita."
                else:
                    mensaje = str(error)
                self.send_json(400, {"error": mensaje, "codigo": "telefono_invalido"})
                return

        sin_configurar = mensaje_canal_sin_configurar(channel)
        created_at = datetime.now(timezone.utc).isoformat()
        plan = planificar_notificaciones(reminder_type, channel, cita, ahora)
        existente_id: int | None = None
        confirmacion_id: int | None = None
        try:
            with transaccion() as connection:
                if clave:
                    previa = connection.execute(
                        "SELECT id FROM reminders WHERE patient_id = ? AND client_key = ?", (patient["id"], clave)
                    ).fetchone()
                    if previa:
                        existente_id = int(previa["id"])
                if existente_id is None and reminder_type in TIPOS_CITA:
                    igual = connection.execute(
                        """SELECT id FROM reminders WHERE patient_id = ? AND reminder_type = ?
                           AND reminder_date = ? AND reminder_time = ? AND specialist = ?""",
                        (patient["id"], reminder_type, reminder_date, reminder_time, specialist),
                    ).fetchone()
                    if igual:
                        self.send_json(409, {"error": "Ya tienes una cita igual programada para esa fecha y hora."})
                        return
                if existente_id is None:
                    cursor = connection.execute(
                        """INSERT INTO reminders
                           (patient_id, reminder_type, reminder_date, reminder_time, detail, specialist,
                            channel, contact, created_at, client_key)
                           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                        (patient["id"], reminder_type, reminder_date, reminder_time, detail, specialist,
                         channel, contact, created_at, clave or None),
                    )
                    reminder_id = int(cursor.lastrowid)
                    for clase, enviar_en, vence_en in plan:
                        nuevo = _insertar_notificacion(
                            connection, reminder_id, int(patient["id"]), clase, channel, contact, enviar_en, vence_en,
                            estado="SIN_CONFIGURAR" if sin_configurar else "PENDIENTE",
                            error=sin_configurar or "",
                        )
                        if clase == "CONFIRMACION":
                            confirmacion_id = nuevo
        except sqlite3.IntegrityError:
            with lectura() as connection:
                previa = connection.execute(
                    "SELECT id FROM reminders WHERE patient_id = ? AND client_key = ?", (patient["id"], clave)
                ).fetchone()
            if not previa:
                self.send_json(500, {"error": "No se pudo guardar la cita. Inténtalo de nuevo."})
                return
            existente_id = int(previa["id"])

        if existente_id is not None:  # solicitud repetida (doble clic o reintento de red): no se duplica nada
            self._respuesta_recordatorio(200, existente_id, creado=False)
            return
        # La cita ya está guardada. El envío ocurre después y su resultado nunca borra la cita.
        if confirmacion_id is not None and not sin_configurar and patient["email_verified"]:
            try:
                intentar_envio_inmediato(confirmacion_id)
            except Exception as error:
                print(f"No se pudo procesar la confirmación #{confirmacion_id}: {sanear_error(error)}")
        self._respuesta_recordatorio(201, reminder_id, creado=True)

    def update_reminder(self) -> None:
        patient = self.current_patient()
        if not patient:
            self.send_json(401, {"error": "Inicia sesión para modificar una cita."})
            return
        data = self.read_json() or {}
        try:
            reminder_id = int(data.get("id"))
        except (TypeError, ValueError):
            reminder_id = 0
        if reminder_id < 1:
            self.send_json(400, {"error": "El identificador de la cita no es válido."})
            return
        validado = self._validar_fecha_hora(data)
        if validado is None:
            return
        fecha, hora, cita, ahora = validado
        with transaccion() as connection:
            fila = connection.execute(
                "SELECT * FROM reminders WHERE id = ? AND patient_id = ?", (reminder_id, patient["id"])
            ).fetchone()
            if not fila:
                self.send_json(404, {"error": "No se encontró esa cita."})
                return
            if connection.execute(
                "SELECT 1 FROM notifications WHERE reminder_id = ? AND status = 'PROCESANDO'", (reminder_id,)
            ).fetchone():
                self.send_json(409, {"error": "Se está enviando un aviso de esta cita. Inténtalo de nuevo en unos segundos."})
                return
            connection.execute(
                "UPDATE reminders SET reminder_date = ?, reminder_time = ? WHERE id = ?", (fecha, hora, reminder_id)
            )
            actualizada = connection.execute("SELECT * FROM reminders WHERE id = ?", (reminder_id,)).fetchone()
            reprogramar_notificaciones(connection, actualizada, cita, ahora)
        self._respuesta_recordatorio(200, reminder_id, creado=False)

    def retry_notification(self) -> None:
        patient = self.current_patient()
        if not patient:
            self.send_json(401, {"error": "Inicia sesión para reintentar un aviso."})
            return
        data = self.read_json() or {}
        try:
            notificacion_id = int(data.get("id"))
        except (TypeError, ValueError):
            notificacion_id = 0
        if notificacion_id < 1:
            self.send_json(400, {"error": "El identificador del aviso no es válido."})
            return
        ahora = ahora_utc()
        with transaccion() as connection:
            fila = connection.execute(
                "SELECT * FROM notifications WHERE id = ? AND patient_id = ?", (notificacion_id, patient["id"])
            ).fetchone()
            if not fila:
                self.send_json(404, {"error": "No se encontró ese aviso."})
                return
            if fila["status"] != "FALLIDO":
                self.send_json(409, {"error": "Solo se pueden reintentar los avisos que fallaron."})
                return
            if fila["expires_at"] and utc_desde_texto(fila["expires_at"]) <= ahora:
                connection.execute("UPDATE notifications SET status = 'VENCIDO' WHERE id = ?", (notificacion_id,))
                self.send_json(409, {"error": "La cita ya pasó; no tiene sentido reenviar este aviso."})
                return
            if fila["manual_retries"] >= MAX_REINTENTOS_MANUALES:
                self.send_json(429, {"error": "Alcanzaste el límite de reintentos para este aviso."})
                return
            if fila["last_attempt_at"] and ahora - utc_desde_texto(fila["last_attempt_at"]) < ESPERA_REINTENTO_MANUAL:
                self.send_json(429, {"error": "Espera un minuto antes de volver a intentarlo."})
                return
            # Un reintento manual equivale a UN intento nuevo; no crea otra notificación.
            connection.execute(
                """UPDATE notifications SET status = 'PENDIENTE', next_attempt = NULL, error = '',
                          attempts = ?, manual_retries = manual_retries + 1 WHERE id = ?""",
                (MAX_INTENTOS_ENVIO - 1, notificacion_id),
            )
        try:
            intentar_envio_inmediato(notificacion_id)
        except Exception as error:
            print(f"No se pudo reintentar el aviso #{notificacion_id}: {sanear_error(error)}")
        with lectura() as connection:
            fila = connection.execute("SELECT * FROM notifications WHERE id = ?", (notificacion_id,)).fetchone()
        self.send_json(200, {"notificacion": notificacion_public_data(fila)})

    def notification_contact_info(self) -> None:
        patient = self.current_patient()
        if not patient:
            self.send_json(401, {"error": "Inicia sesión para consultar tus datos de contacto."})
            return
        telefono = {"registrado": bool(str(patient["phone"]).strip()), "valido": False, "enmascarado": "", "problema": ""}
        try:
            telefono["enmascarado"] = enmascarar_telefono(normalizar_telefono_movil(str(patient["phone"])))
            telefono["valido"] = True
        except ValueError as error:
            telefono["problema"] = str(error)
            digitos = re.sub(r"\D", "", str(patient["phone"]))
            telefono["enmascarado"] = f"•••• {digitos[-4:]}" if len(digitos) >= 4 else ""
        self.send_json(200, {
            "telefono": telefono,
            "correo": {"enmascarado": enmascarar_correo(str(patient["email"])), "valido": bool(EMAIL_RE.fullmatch(str(patient["email"])))},
            "canales_configurados": {canal: mensaje_canal_sin_configurar(canal) is None for canal in sorted(CANALES_VALIDOS)},
            "zona_horaria": "America/Bogota",
        })

    def delete_reminder(self) -> None:
        patient = self.current_patient()
        if not patient:
            self.send_json(401, {"error": "Inicia sesión para eliminar un recordatorio."})
            return
        data = self.read_json()
        try:
            reminder_id = int(data.get("id")) if data else 0
        except (TypeError, ValueError):
            reminder_id = 0
        if reminder_id < 1:
            self.send_json(400, {"error": "El identificador del recordatorio no es válido."})
            return
        with db_session() as connection:
            cursor = connection.execute(
                "DELETE FROM reminders WHERE id = ? AND patient_id = ?",
                (reminder_id, patient["id"]),
            )
        if cursor.rowcount == 0:
            self.send_json(404, {"error": "No se encontró ese recordatorio."})
            return
        self.send_json(200, {"ok": True})

    def send_verification_code(self, patient_id: int, email: str) -> int:
        """Guarda el código en patients antes de enviarlo; devuelve espera restante."""
        with db_session() as connection:
            patient = connection.execute(
                """SELECT email_verified, verification_sent_at
                   FROM patients WHERE id = ?""",
                (patient_id,),
            ).fetchone()
        if not patient or patient["email_verified"]:
            raise RuntimeError("No hay una verificación pendiente para esta cuenta.")

        now = datetime.now(timezone.utc)
        last_sent_value = patient["verification_sent_at"]
        if last_sent_value:
            last_sent = datetime.fromisoformat(last_sent_value)
            seconds_since_send = (now - last_sent).total_seconds()
            retry_after = max(0, VERIFICATION_RESEND_SECONDS - int(seconds_since_send))
            if retry_after:
                return retry_after

        code = str(secrets.randbelow(900_000) + 100_000)
        expires_at = now + timedelta(minutes=VERIFICATION_CODE_TTL_MINUTES)
        with db_session() as connection:
            cursor = connection.execute(
                """UPDATE patients
                   SET codigo_verificacion = ?,
                       verification_expires_at = ?,
                       verification_attempts = 0
                   WHERE id = ? AND email_verified = 0""",
                (code, expires_at.isoformat(), patient_id),
            )
            if cursor.rowcount != 1:
                raise RuntimeError("No hay una verificación pendiente para esta cuenta.")

        # El código ya está persistido en la fila del paciente antes del envío SMTP.
        _enviar_correo(
            email,
            "Verifica tu cuenta en Mi Paciente",
            f"Tu código de verificación es: {code}\n\n"
            f"Ingresa este código en la página para activar tu cuenta. "
            f"Vence en {VERIFICATION_CODE_TTL_MINUTES} minutos.",
        )
        sent_at = datetime.now(timezone.utc).isoformat()
        with db_session() as connection:
            connection.execute(
                "UPDATE patients SET verification_sent_at = ? WHERE id = ?",
                (sent_at, patient_id),
            )
        return 0

    def resend_verification(self) -> None:
        data = self.read_json()
        email = str(data.get("email", "")).strip().lower() if data else ""
        if not EMAIL_RE.fullmatch(email):
            self.send_json(400, {"error": "Escribe un correo electrónico válido."})
            return

        with db_session() as connection:
            patient = connection.execute(
                "SELECT id, email, email_verified FROM patients WHERE email = ?",
                (email,),
            ).fetchone()
        if not patient or patient["email_verified"]:
            self.send_json(404, {"error": "No hay una verificación pendiente para ese correo."})
            return
        try:
            retry_after = self.send_verification_code(int(patient["id"]), patient["email"])
        except Exception:
            self.send_json(
                503,
                {"error": "No se pudo enviar el código. Revisa la configuración SMTP del servidor."},
            )
            return
        if retry_after:
            self.send_json(
                429,
                {
                    "error": f"Espera {retry_after} segundos antes de solicitar otro código.",
                    "retry_after": retry_after,
                },
            )
            return
        self.send_json(200, {"ok": True, "message": "Enviamos un nuevo código a tu correo."})

    def verify_email(self) -> None:
        data = self.read_json()
        if data is None:
            self.send_json(400, {"error": "No se pudo leer el código."})
            return
        email = str(data.get("email", "")).strip().lower()
        code = str(data.get("code", "")).strip()
        if not EMAIL_RE.fullmatch(email) or not re.fullmatch(r"\d{6}", code):
            self.send_json(400, {"error": "Escribe el correo y el código de seis dígitos."})
            return

        now = datetime.now(timezone.utc)
        with db_session() as connection:
            patient = connection.execute(
                "SELECT * FROM patients WHERE email = ?", (email,)
            ).fetchone()
            if not patient or patient["email_verified"] or not patient["codigo_verificacion"]:
                self.send_json(400, {"error": "El código no es válido. Solicita uno nuevo."})
                return

            expires_value = patient["verification_expires_at"]
            if not expires_value or datetime.fromisoformat(expires_value) <= now:
                connection.execute(
                    """UPDATE patients
                       SET codigo_verificacion = NULL,
                           verification_expires_at = NULL,
                           verification_sent_at = NULL,
                           verification_attempts = 0
                       WHERE id = ?""",
                    (patient["id"],),
                )
                self.send_json(400, {"error": "El código venció. Solicita uno nuevo."})
                return

            if patient["verification_attempts"] >= VERIFICATION_MAX_ATTEMPTS:
                connection.execute(
                    """UPDATE patients SET codigo_verificacion = NULL,
                       verification_expires_at = NULL WHERE id = ?""",
                    (patient["id"],),
                )
                self.send_json(
                    429,
                    {"error": "Se alcanzó el límite de intentos. Solicita un código nuevo."},
                )
                return

            if not hmac.compare_digest(code, patient["codigo_verificacion"]):
                attempts = int(patient["verification_attempts"]) + 1
                if attempts >= VERIFICATION_MAX_ATTEMPTS:
                    connection.execute(
                        """UPDATE patients SET codigo_verificacion = NULL,
                           verification_expires_at = NULL,
                           verification_attempts = ? WHERE id = ?""",
                        (attempts, patient["id"]),
                    )
                    self.send_json(
                        429,
                        {"error": "Se alcanzó el límite de intentos. Solicita un código nuevo."},
                    )
                else:
                    connection.execute(
                        "UPDATE patients SET verification_attempts = ? WHERE id = ?",
                        (attempts, patient["id"]),
                    )
                    self.send_json(
                        400,
                        {
                            "error": f"El código no coincide. Te quedan {VERIFICATION_MAX_ATTEMPTS - attempts} intentos."
                        },
                    )
                return

            connection.execute(
                """UPDATE patients SET email_verified = 1,
                   codigo_verificacion = NULL, verification_expires_at = NULL,
                   verification_sent_at = NULL, verification_attempts = 0
                   WHERE id = ?""",
                (patient["id"],),
            )
            patient_id = int(patient["id"])

        self.create_session(patient_id)

    def register_patient(self) -> None:
        data = self.read_json()
        if data is None:
            self.send_json(400, {"error": "No se pudo leer el formulario."})
            return

        email = str(data.get("email", "")).strip().lower()
        password = str(data.get("password", ""))
        first_name = " ".join(str(data.get("first_name", "")).split())
        last_name = " ".join(str(data.get("last_name", "")).split())
        document_type = str(data.get("document_type", ""))
        document_number = str(data.get("document_number", "")).strip()
        phone = " ".join(str(data.get("phone", "")).split())

        if not EMAIL_RE.fullmatch(email):
            self.send_json(400, {"error": "Escribe un correo electrónico válido."})
            return
        if not (10 <= len(password) <= 128) or not re.search(r"[a-z]", password) or not re.search(r"[A-Z]", password) or not re.search(r"\d", password):
            self.send_json(400, {"error": "La contraseña debe tener al menos 10 caracteres, con mayúscula, minúscula y número."})
            return
        if not first_name or len(first_name) > 80 or not last_name or len(last_name) > 80:
            self.send_json(400, {"error": "Escribe el nombre y apellido (máximo 80 caracteres cada uno)."})
            return
        if document_type not in {"CC", "TI"} or not re.fullmatch(r"\d{5,20}", document_number):
            self.send_json(400, {"error": "Verifica el tipo y número del documento."})
            return
        if not PHONE_RE.fullmatch(phone) or not 7 <= len(re.sub(r"\D", "", phone)) <= 20:
            self.send_json(400, {"error": "Escribe un número celular válido."})
            return

        salt = secrets.token_bytes(16)
        digest = password_digest(password, salt)
        created_at = datetime.now(timezone.utc).isoformat()
        try:
            with db_session() as connection:
                cursor = connection.execute(
                    """INSERT INTO patients
                       (email, password_salt, password_hash, first_name, last_name,
                        document_type, document_number, phone, created_at, email_verified)
                       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)""",
                    (email, salt, digest, first_name, last_name, document_type, document_number, phone, created_at),
                )
                patient_id = cursor.lastrowid
        except sqlite3.IntegrityError:
            with db_session() as connection:
                existing_email = connection.execute(
                    "SELECT id, email, email_verified FROM patients WHERE email = ?",
                    (email,),
                ).fetchone()
            if existing_email:
                if existing_email["email_verified"]:
                    self.send_json(409, {"error": "Ya existe una cuenta con ese correo. Inicia sesión."})
                    return
                try:
                    retry_after = self.send_verification_code(
                        int(existing_email["id"]), existing_email["email"]
                    )
                except Exception:
                    self.send_json(
                        503,
                        {
                            "error": "No se pudo enviar el código. Revisa la configuración SMTP del servidor.",
                            "verification_required": True,
                            "email": existing_email["email"],
                        },
                    )
                    return
                message = (
                    "Ya enviamos un código recientemente. Revisa tu correo o solicita otro en un momento."
                    if retry_after
                    else "Enviamos un código de verificación a tu correo."
                )
                self.send_json(
                    202,
                    {
                        "status": "ok",
                        "mensaje": message,
                        "verification_required": True,
                        "email": existing_email["email"],
                    },
                )
            else:
                self.send_json(409, {"error": "Ya existe una cuenta con ese tipo y número de documento."})
            return

        try:
            retry_after = self.send_verification_code(int(patient_id), email)
        except Exception:
            self.send_json(
                503,
                {
                    "error": "La cuenta quedó pendiente, pero no se pudo enviar el código. Revisa el correo SMTP del servidor.",
                    "verification_required": True,
                    "email": email,
                },
            )
            return
        self.send_json(
            202,
            {
                "status": "ok",
                "mensaje": (
                    "Ya enviamos un código recientemente. Revisa tu correo."
                    if retry_after
                    else "Revisa tu correo para verificar la cuenta."
                ),
                "verification_required": True,
                "email": email,
            },
        )

    def login_patient(self) -> None:
        data = self.read_json()
        if data is None:
            self.send_json(400, {"error": "No se pudo leer el formulario."})
            return
        email = str(data.get("email", "")).strip().lower()
        password = str(data.get("password", ""))
        if len(email) > 254 or len(password) > 128:
            self.send_json(401, {"error": "Correo o contraseña incorrectos."})
            return

        with db_session() as connection:
            patient = connection.execute("SELECT * FROM patients WHERE email = ?", (email,)).fetchone()
        if not patient:
            password_digest(password[:128], b"mi-paciente-dummy-salt")
            self.send_json(401, {"error": "Correo o contraseña incorrectos."})
            return

        computed = password_digest(password, patient["password_salt"])
        if not hmac.compare_digest(computed, patient["password_hash"]):
            self.send_json(401, {"error": "Correo o contraseña incorrectos."})
            return
        if not patient["email_verified"]:
            try:
                retry_after = self.send_verification_code(int(patient["id"]), patient["email"])
            except Exception:
                self.send_json(
                    503,
                    {
                        "error": "Tu correo aún no está verificado y no se pudo enviar el código.",
                        "verification_required": True,
                        "email": patient["email"],
                    },
                )
                return
            message = (
                "Tu correo aún no está verificado. Ingresa el código que enviamos."
                if retry_after
                else "Tu correo aún no está verificado. Enviamos un nuevo código."
            )
            self.send_json(
                403,
                {
                    "error": message,
                    "verification_required": True,
                    "email": patient["email"],
                },
            )
            return
        self.create_session(int(patient["id"]))

    def logout_patient(self) -> None:
        token = self.session_token()
        if token:
            token_hash = hashlib.sha256(token.encode("ascii", "ignore")).digest()
            with db_session() as connection:
                connection.execute("DELETE FROM sessions WHERE token_hash = ?", (token_hash,))
        self.send_response(200)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", "2")
        self.send_header("Cache-Control", "no-store")
        self.set_session_cookie("", 0)
        self.end_headers()
        self.wfile.write(b"{}")


def main() -> None:
    initialize_database()
    host = os.environ.get("MI_PACIENTE_HOST", "127.0.0.1")
    port = int(os.environ.get("MI_PACIENTE_PORT", "8000"))
    server = ThreadingHTTPServer((host, port), MiPacienteHandler)
    detener_vigilante = threading.Event()
    vigilante = threading.Thread(
        target=vigilante_recordatorios,
        args=(detener_vigilante,),
        name="vigilante-recordatorios",
        daemon=True,
    )
    vigilante.start()
    print(f"Mi Paciente está disponible en http://{host}:{port}")
    print("Presiona Ctrl+C para detener el servidor.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nServidor detenido.")
    finally:
        detener_vigilante.set()
        vigilante.join(timeout=5)
        server.server_close()


if __name__ == "__main__":
    main()
