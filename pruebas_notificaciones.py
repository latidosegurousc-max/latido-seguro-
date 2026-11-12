"""Pruebas del calendario, las citas y las notificaciones de Latido Seguro.

Ejecutar:  python pruebas_notificaciones.py
No envía mensajes reales: Twilio y SMTP se sustituyen por simulaciones. Usa una base SQLite temporal.
"""
from __future__ import annotations

import hashlib
import http.client
import json
import os
import sqlite3
import tempfile
import threading
import unittest
from datetime import datetime, timedelta, timezone
from http.server import ThreadingHTTPServer
from pathlib import Path

TMP = tempfile.mkdtemp(prefix="mipaciente_test_")
os.environ["MI_PACIENTE_DB"] = str(Path(TMP) / "pruebas.sqlite3")
for variable in list(os.environ):
    if variable.startswith("MI_PACIENTE_TWILIO") or variable.startswith("MI_PACIENTE_SMTP"):
        del os.environ[variable]

import mi_paciente_server as srv  # noqa: E402

ZONA = srv.ZONA_HORARIA
HORA_FIJA = {"ahora": datetime(2026, 10, 27, 10, 0, tzinfo=ZONA)}
srv.ahora_bogota = lambda: HORA_FIJA["ahora"]


def fijar(año, mes, dia, hora=10, minuto=0):
    HORA_FIJA["ahora"] = datetime(año, mes, dia, hora, minuto, tzinfo=ZONA)


class Falso:
    """Registra los envíos simulados y permite forzar errores."""
    def __init__(self):
        self.reiniciar()

    def reiniciar(self):
        self.mensajes, self.correos, self.error = [], [], None

    def twilio(self, contacto, mensaje, es_whatsapp):
        if self.error:
            raise self.error
        self.mensajes.append((contacto, mensaje, es_whatsapp))
        return f"SM{len(self.mensajes):030d}"

    def correo(self, destinatario, asunto, mensaje, es_html=False):
        if self.error:
            raise self.error
        self.correos.append((destinatario, asunto, mensaje))


FALSO = Falso()
PACIENTES: dict = {}
srv._enviar_mensaje_twilio = FALSO.twilio
srv._enviar_correo = FALSO.correo


def configurar_canales(activo: bool):
    for nombre in ("MI_PACIENTE_TWILIO_ACCOUNT_SID", "MI_PACIENTE_TWILIO_AUTH_TOKEN",
                   "MI_PACIENTE_TWILIO_SMS_FROM", "MI_PACIENTE_TWILIO_WHATSAPP_FROM",
                   "MI_PACIENTE_SMTP_HOST", "MI_PACIENTE_SMTP_FROM"):
        if activo:
            os.environ[nombre] = "valor-de-prueba-1234"
        else:
            os.environ.pop(nombre, None)


def nuevo_paciente(correo, telefono, documento, clave="ClaveSegura123"):
    sal = os.urandom(16)
    with srv.connect_db() as c:
        cur = c.execute(
            """INSERT INTO patients (email, password_salt, password_hash, first_name, last_name,
               document_type, document_number, phone, created_at, email_verified)
               VALUES (?, ?, ?, 'Ana', 'Prueba', 'CC', ?, ?, ?, 1)""",
            (correo, sal, srv.password_digest(clave, sal), documento, telefono, datetime.now(timezone.utc).isoformat()))
        return cur.lastrowid


def sesion(paciente_id):
    token = f"token-{paciente_id}-{os.urandom(4).hex()}"
    with srv.connect_db() as c:
        c.execute("INSERT INTO sessions VALUES (?, ?, ?)", (
            hashlib.sha256(token.encode()).digest(), paciente_id,
            (datetime.now(timezone.utc) + timedelta(days=1)).isoformat()))
    return token


class Base(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        srv.initialize_database()
        cls.servidor = ThreadingHTTPServer(("127.0.0.1", 0), srv.MiPacienteHandler)
        cls.puerto = cls.servidor.server_address[1]
        threading.Thread(target=cls.servidor.serve_forever, daemon=True).start()
        if not PACIENTES:  # los pacientes se crean una sola vez para todas las clases de prueba
            for clave, (correo, telefono, doc) in {
                "ana": ("ana@example.com", "300 123 4567", "1001"),
                "beto": ("beto@example.com", "+57 311 765 4321", "1002"),
                "mala": ("mala@example.com", "12345678", "1003"),
            }.items():
                PACIENTES[clave] = nuevo_paciente(correo, telefono, doc)
                PACIENTES["tok_" + clave] = sesion(PACIENTES[clave])
        cls.ana, cls.beto, cls.mala = PACIENTES["ana"], PACIENTES["beto"], PACIENTES["mala"]
        cls.tok_ana, cls.tok_beto, cls.tok_mala = PACIENTES["tok_ana"], PACIENTES["tok_beto"], PACIENTES["tok_mala"]

    @classmethod
    def tearDownClass(cls):
        cls.servidor.shutdown()

    def setUp(self):
        fijar(2026, 10, 27, 10, 0)
        FALSO.reiniciar()
        configurar_canales(True)
        with srv.connect_db() as c:
            c.execute("DELETE FROM reminders")

    def api(self, metodo, ruta, cuerpo=None, token=None, crudo=None):
        conexion = http.client.HTTPConnection("127.0.0.1", self.puerto, timeout=15)
        cabeceras = {"Content-Type": "application/json"}
        if token:
            cabeceras["Cookie"] = f"{srv.SESSION_COOKIE}={token}"
        datos = crudo if crudo is not None else (json.dumps(cuerpo) if cuerpo is not None else None)
        conexion.request(metodo, ruta, body=datos, headers=cabeceras)
        r = conexion.getresponse()
        texto = r.read().decode("utf-8")
        conexion.close()
        try:
            return r.status, json.loads(texto)
        except json.JSONDecodeError:
            return r.status, texto

    def crear(self, token=None, sin_sesion=False, **extra):
        cuerpo = {"tipo": "Cita de control", "especialista": "Cardiólogo clínico", "fecha": "2026-10-30",
                  "hora": "15:00", "detalle": "", "canal": "SMS", "usar_contacto_registrado": True}
        cuerpo.update(extra)
        return self.api("POST", "/guardar-recordatorio", cuerpo, None if sin_sesion else (token or self.tok_ana))

    def notificaciones(self, reminder_id=None):
        with srv.connect_db() as c:
            filtro, args = ("WHERE reminder_id = ?", (reminder_id,)) if reminder_id else ("", ())
            return [dict(f) for f in c.execute(f"SELECT * FROM notifications {filtro} ORDER BY id", args)]


class PruebasFrontera(Base):
    def test_01_login_real_y_sesion(self):
        estado, datos = self.api("POST", "/api/login", {"email": "ana@example.com", "password": "ClaveSegura123"})
        self.assertEqual(estado, 200, datos)
        self.assertEqual(datos["user"]["email"], "ana@example.com")
        estado, _ = self.api("POST", "/api/login", {"email": "ana@example.com", "password": "incorrecta"})
        self.assertEqual(estado, 401)
        estado, datos = self.api("GET", "/api/me", token=self.tok_ana)
        self.assertEqual((estado, datos["user"]["phone"]), (200, "300 123 4567"))

    def test_02_telefono_guardado_recuperado_y_enmascarado(self):
        estado, datos = self.api("GET", "/api/contacto-notificaciones", token=self.tok_ana)
        self.assertEqual(estado, 200)
        self.assertTrue(datos["telefono"]["valido"])
        self.assertEqual(datos["telefono"]["enmascarado"], "+57 ••• ••• 4567")
        self.assertNotIn("3001234567", json.dumps(datos))
        self.assertEqual(datos["correo"]["enmascarado"], "a***@example.com")
        self.assertTrue(datos["canales_configurados"]["SMS"])
        estado, datos = self.api("GET", "/api/contacto-notificaciones", token=self.tok_mala)
        self.assertFalse(datos["telefono"]["valido"])
        self.assertTrue(datos["telefono"]["problema"])
        self.assertEqual(self.api("GET", "/api/contacto-notificaciones")[0], 401)

    def test_normalizacion_telefonos(self):
        n = srv.normalizar_telefono_movil
        self.assertEqual(n("300 123 4567"), "+573001234567")
        self.assertEqual(n("(300) 123-4567"), "+573001234567")
        self.assertEqual(n("573001234567"), "+573001234567")
        self.assertEqual(n("+57 300 123 4567"), "+573001234567")
        self.assertEqual(n("0057 300 123 4567"), "+573001234567")
        self.assertEqual(n("whatsapp:+573001234567"), "+573001234567")
        self.assertEqual(n("+1 415 555 2671"), "+14155552671")
        for malo in ["", "abc", "6024857164", "200 123 4567", "+57 300 123 456", "123", "+57 1 2345 6789"]:
            with self.assertRaises(ValueError, msg=malo):
                n(malo)

    def test_03_04_rechaza_fechas_pasadas_y_datos_invalidos(self):
        casos = [
            {"fecha": "2026-10-26"}, {"fecha": "2026-10-27", "hora": "09:59"}, {"fecha": "2026-10-27", "hora": "10:00"},
            {"fecha": "2026-13-45"}, {"fecha": "30/10/2026"}, {"hora": "25:00"}, {"hora": "9:00"}, {"hora": "15:00:00"},
            {"fecha": "2031-01-01"}, {"tipo": "Cita inventada"}, {"canal": "Paloma mensajera"},
            {"especialista": "Brujo"}, {"detalle": "x" * 121},
            {"usar_contacto_registrado": False, "contacto": "123"},
            {"canal": "Correo electrónico", "usar_contacto_registrado": False, "contacto": "no-es-correo"},
        ]
        for caso in casos:
            estado, datos = self.crear(**caso)
            self.assertEqual(estado, 400, (caso, datos))
        with srv.connect_db() as c:
            self.assertEqual(c.execute("SELECT COUNT(*) FROM reminders").fetchone()[0], 0)
        self.assertEqual(self.notificaciones(), [])
        self.assertEqual(FALSO.mensajes, [])
        self.assertEqual(self.api("POST", "/guardar-recordatorio", crudo="{no es json", token=self.tok_ana)[0], 400)
        self.assertEqual(self.crear(sin_sesion=True)[0], 401)

    def test_05_cita_asociada_al_paciente_autenticado(self):
        estado, datos = self.crear(patient_id=self.beto, paciente_id=self.beto)
        self.assertEqual(estado, 201, datos)
        with srv.connect_db() as c:
            fila = c.execute("SELECT patient_id, contact FROM reminders").fetchone()
        self.assertEqual(fila["patient_id"], self.ana)
        self.assertEqual(fila["contact"], "+573001234567")
        # Con "usar mi teléfono registrado" no se puede enviar a otro número manipulando el formulario.
        self.crear(contacto="+573119999999", hora="16:00")
        with srv.connect_db() as c:
            contactos = {f[0] for f in c.execute("SELECT contact FROM reminders")}
        self.assertEqual(contactos, {"+573001234567"})
        # Otro paciente no ve, borra ni modifica la cita ajena.
        self.assertEqual(self.api("GET", "/recordatorios", token=self.tok_beto)[1]["recordatorios"], [])
        rid = datos["recordatorio"]["id"]
        self.assertEqual(self.api("POST", "/eliminar-recordatorio", {"id": rid}, self.tok_beto)[0], 404)
        self.assertEqual(self.api("POST", "/actualizar-recordatorio", {"id": rid, "fecha": "2026-11-01", "hora": "10:00"}, self.tok_beto)[0], 404)
        self.assertEqual(self.api("POST", "/reintentar-notificacion", {"id": self.notificaciones()[0]["id"]}, self.tok_beto)[0], 404)

    def test_06_telefono_registrado_invalido_se_informa_y_se_puede_corregir(self):
        estado, datos = self.crear(token=self.tok_mala)
        self.assertEqual(estado, 400)
        self.assertEqual(datos["codigo"], "telefono_invalido")
        estado, datos = self.crear(token=self.tok_mala, usar_contacto_registrado=False, contacto="311 222 3344")
        self.assertEqual(estado, 201, datos)
        with srv.connect_db() as c:
            self.assertEqual(c.execute("SELECT phone FROM patients WHERE id = ?", (self.mala,)).fetchone()[0], "12345678")


class PruebasNotificaciones(Base):
    def test_07_08_confirmacion_inmediata_con_datos_reales_y_sms(self):
        estado, datos = self.crear(detalle="dolor de pecho")
        self.assertEqual(estado, 201, datos)
        self.assertTrue(datos["creado"])
        self.assertEqual(len(FALSO.mensajes), 1)
        contacto, texto, es_wa = FALSO.mensajes[0]
        self.assertEqual(contacto, "+573001234567")
        self.assertFalse(es_wa)
        self.assertEqual(texto, "Latido Seguro: tu cita ha sido programada para el 30/10/2026 a las 3:00 p. m. "
                                "Tipo de cita: Cita de control. Recuerda consultar los detalles de tu cita en la plataforma.")
        self.assertNotIn("Cardiólogo", texto)
        self.assertNotIn("dolor", texto)
        estados = {n["clase"]: n for n in datos["recordatorio"]["notificaciones"]}
        self.assertEqual(estados["CONFIRMACION"]["estado"], "ENVIADO")
        self.assertEqual(estados["RECORDATORIO_DIA"]["estado"], "PENDIENTE")

    def test_confirmacion_por_whatsapp_y_correo(self):
        self.crear(canal="WhatsApp")
        self.assertTrue(FALSO.mensajes[0][2])
        self.crear(canal="Correo electrónico", hora="16:00")
        self.assertEqual(FALSO.correos[0][0], "ana@example.com")
        self.assertIn("Tu cita ha sido programada para el <strong>30/10/2026</strong> a las <strong>4:00 p. m.</strong>.", FALSO.correos[0][2])
        self.assertNotIn("Cardiólogo", FALSO.correos[0][2])

    def test_09_10_recordatorio_a_las_8am_de_bogota(self):
        estado, datos = self.crear()
        n = [x for x in self.notificaciones() if x["kind"] == "RECORDATORIO_DIA"][0]
        self.assertEqual(n["send_at"], "2026-10-30T13:00:00+00:00")  # 8:00 en Bogotá (UTC-5)
        self.assertEqual(n["expires_at"], "2026-10-30T20:00:00+00:00")
        self.assertEqual(datos["recordatorio"]["notificaciones"][-1]["programada_para"], "2026-10-30 08:00")
        # Antes de las 8:00 no se envía; después, sí y con el texto exacto.
        FALSO.reiniciar()
        fijar(2026, 10, 30, 7, 59)
        srv.procesar_notificaciones_pendientes()
        self.assertEqual(FALSO.mensajes, [])
        fijar(2026, 10, 30, 8, 0)
        srv.procesar_notificaciones_pendientes()
        self.assertEqual(len(FALSO.mensajes), 1)
        self.assertEqual(FALSO.mensajes[0][1], "Latido Seguro: te recordamos que hoy tienes una cita programada a las 3:00 p. m. "
                                               "Tipo de cita: Cita de control. Consulta los detalles en tu cuenta.")

    def test_reglas_de_planificacion(self):
        def plan(ahora, cita):
            r = srv.planificar_recordatorio_dia(cita, ahora)
            return r.strftime("%Y-%m-%d %H:%M") if r else None
        d = lambda *a: datetime(*a, tzinfo=ZONA)
        self.assertEqual(plan(d(2026, 10, 27, 10), d(2026, 10, 30, 15)), "2026-10-30 08:00")
        self.assertEqual(plan(d(2026, 10, 30, 6, 0), d(2026, 10, 30, 15)), "2026-10-30 08:00")      # antes de las 8 del mismo día
        self.assertEqual(plan(d(2026, 10, 30, 9, 0), d(2026, 10, 30, 15)), "2026-10-30 14:00")      # tarde: 1 h antes
        self.assertEqual(plan(d(2026, 10, 30, 14, 0), d(2026, 10, 30, 15)), "2026-10-30 14:15")
        self.assertIsNone(plan(d(2026, 10, 30, 14, 40), d(2026, 10, 30, 15)))                        # sin tiempo útil
        self.assertIsNone(plan(d(2026, 10, 30, 15, 1), d(2026, 10, 30, 15)))                         # ya pasó
        self.assertEqual(plan(d(2026, 10, 27, 10), d(2026, 10, 30, 7)), "2026-10-30 06:30")         # cita muy temprano
        self.assertIsNone(plan(d(2026, 10, 27, 10), d(2026, 10, 30, 6)))                             # no hay avisos de madrugada
        self.assertIsNone(plan(d(2026, 10, 30, 7, 50), d(2026, 10, 30, 8, 10)))

    def test_cita_creada_tarde_el_mismo_dia_programa_aviso_posterior_y_anterior_a_la_cita(self):
        fijar(2026, 10, 27, 11, 0)
        estado, _ = self.crear(fecha="2026-10-27", hora="16:00")
        self.assertEqual(estado, 201)
        n = [x for x in self.notificaciones() if x["kind"] == "RECORDATORIO_DIA"][0]
        self.assertEqual(n["send_at"], "2026-10-27T20:00:00+00:00")  # 15:00 Bogotá, 1 h antes
        FALSO.reiniciar()
        self.crear(fecha="2026-10-27", hora="11:30", canal="WhatsApp")  # demasiado cerca: sin recordatorio del día
        self.assertEqual([x["kind"] for x in self.notificaciones() if x["channel"] == "WhatsApp"], ["CONFIRMACION"])

    def test_dieta_medicamentos_mantienen_aviso_unico_a_la_hora(self):
        estado, datos = self.crear(tipo="Medicamentos", fecha="2026-10-28", hora="09:00")
        self.assertEqual(estado, 201)
        self.assertEqual(FALSO.mensajes, [])  # sin confirmación por SMS (comportamiento anterior)
        self.assertEqual([n["kind"] for n in self.notificaciones()], ["RECORDATORIO"])
        fijar(2026, 10, 28, 9, 0)
        srv.procesar_notificaciones_pendientes()
        self.assertEqual(len(FALSO.mensajes), 1)
        self.assertIn("recordatorio de Mi Paciente", FALSO.mensajes[0][1])

    def test_11_reiniciar_servidor_no_pierde_pendientes_ni_envia_atrasados(self):
        self.crear(fecha="2026-10-30", hora="15:00")
        self.crear(fecha="2026-10-28", hora="09:00", hora_extra=None)
        pendientes = [(n["id"], n["status"]) for n in self.notificaciones()]
        srv.initialize_database()  # "reinicio"
        self.assertEqual([(n["id"], n["status"]) for n in self.notificaciones()], pendientes)
        # Envío colgado >5 min vuelve a la cola
        with srv.connect_db() as c:
            c.execute("UPDATE notifications SET status='PROCESANDO', started_at=? WHERE kind='RECORDATORIO_DIA'",
                      (srv.utc_texto(srv.ahora_utc() - timedelta(minutes=10)),))
        srv.initialize_database()
        self.assertTrue(all(n["status"] != "PROCESANDO" for n in self.notificaciones()))
        # Servidor apagado durante la cita: se marca VENCIDO y no se envía.
        FALSO.reiniciar()
        fijar(2026, 10, 30, 18, 0)
        srv.initialize_database()
        srv.procesar_notificaciones_pendientes()
        dia = [n for n in self.notificaciones() if n["kind"] == "RECORDATORIO_DIA"]
        self.assertTrue(all(n["status"] == "VENCIDO" for n in dia))
        self.assertEqual(FALSO.mensajes, [])

    def test_12_error_de_mensajeria_no_borra_la_cita(self):
        FALSO.error = RuntimeError("Twilio caído")
        estado, datos = self.crear()
        self.assertEqual(estado, 201)
        conf = [n for n in datos["recordatorio"]["notificaciones"] if n["clase"] == "CONFIRMACION"][0]
        self.assertEqual(conf["estado"], "PENDIENTE")  # pendiente de reintento, NO "enviado"
        self.assertEqual(conf["intentos"], 1)
        self.assertIn("Twilio caído", conf["motivo"])
        with srv.connect_db() as c:
            self.assertEqual(c.execute("SELECT COUNT(*) FROM reminders").fetchone()[0], 1)
        self.assertEqual(len(self.api("GET", "/recordatorios", token=self.tok_ana)[1]["recordatorios"]), 1)

    def test_12b_sin_credenciales_la_cita_se_conserva_con_mensaje_claro(self):
        configurar_canales(False)
        estado, datos = self.crear()
        self.assertEqual(estado, 201)
        estados = {n["clase"]: n for n in datos["recordatorio"]["notificaciones"]}
        self.assertEqual(estados["CONFIRMACION"]["estado"], "SIN_CONFIGURAR")
        self.assertIn("no está configurado", estados["CONFIRMACION"]["motivo"])
        self.assertEqual(FALSO.mensajes, [])
        srv.procesar_notificaciones_pendientes()
        self.assertEqual(FALSO.mensajes, [])
        # Tras configurar y reiniciar, los avisos útiles salen.
        configurar_canales(True)
        srv.initialize_database()
        srv.procesar_notificaciones_pendientes()
        self.assertEqual(len(FALSO.mensajes), 1)

    def test_13_reintentos_con_espera_limite_y_sin_duplicados(self):
        FALSO.error = RuntimeError("fallo temporal")
        _, datos = self.crear()
        rid = datos["recordatorio"]["id"]
        total = len(self.notificaciones())
        for intento in range(2, srv.MAX_INTENTOS_ENVIO + 1):
            fijar(2026, 10, 27, 10, 0)
            with srv.connect_db() as c:  # saltar la espera de reintento
                c.execute("UPDATE notifications SET next_attempt = NULL WHERE status='PENDIENTE'")
            srv.procesar_notificaciones_pendientes()
        conf = [n for n in self.notificaciones(rid) if n["kind"] == "CONFIRMACION"][0]
        self.assertEqual((conf["status"], conf["attempts"]), ("FALLIDO", srv.MAX_INTENTOS_ENVIO))
        self.assertEqual(len(self.notificaciones()), total)       # reintentar no crea avisos nuevos
        self.assertEqual(FALSO.mensajes, [])
        # La espera crece (backoff) y respeta next_attempt:
        self.assertGreater(srv._retraso_reintento(3), srv._retraso_reintento(1))
        # El fallo de la confirmación no impide el recordatorio del día.
        FALSO.error = None
        fijar(2026, 10, 30, 8, 0)
        srv.procesar_notificaciones_pendientes()
        self.assertEqual(len(FALSO.mensajes), 1)
        self.assertIn("hoy tienes una cita", FALSO.mensajes[0][1])
        # Reintento manual controlado
        with srv.connect_db() as c:
            c.execute("UPDATE notifications SET last_attempt_at = ? WHERE id = ?",
                      (srv.utc_texto(srv.ahora_utc() - timedelta(minutes=5)), conf["id"]))
        estado, datos = self.api("POST", "/reintentar-notificacion", {"id": conf["id"]}, self.tok_ana)
        self.assertEqual(estado, 200, datos)
        self.assertEqual(datos["notificacion"]["estado"], "ENVIADO")

    def test_13b_error_permanente_no_se_reintenta_y_reintento_manual_es_un_solo_intento(self):
        FALSO.error = srv.EnvioPermanente("Número inválido")
        _, datos = self.crear()
        conf = [n for n in datos["recordatorio"]["notificaciones"] if n["clase"] == "CONFIRMACION"][0]
        self.assertEqual((conf["estado"], conf["intentos"]), ("FALLIDO", 1))
        self.assertEqual(self.api("POST", "/reintentar-notificacion", {"id": conf["id"]}, self.tok_ana)[0], 429)  # espera de 1 min
        with srv.connect_db() as c:
            c.execute("UPDATE notifications SET last_attempt_at = ?", (srv.utc_texto(srv.ahora_utc() - timedelta(minutes=5)),))
        FALSO.error = None
        estado, datos = self.api("POST", "/reintentar-notificacion", {"id": conf["id"]}, self.tok_ana)
        self.assertEqual((estado, datos["notificacion"]["estado"]), (200, "ENVIADO"))
        self.assertEqual(len(FALSO.mensajes), 1)
        self.assertEqual(self.api("POST", "/reintentar-notificacion", {"id": conf["id"]}, self.tok_ana)[0], 409)  # ya enviado

    def test_doble_clic_no_duplica_citas_ni_mensajes(self):
        clave = "clave-unica-123456"
        resultados = []
        hilos = [threading.Thread(target=lambda: resultados.append(self.crear(clave_solicitud=clave))) for _ in range(6)]
        [h.start() for h in hilos]
        [h.join() for h in hilos]
        self.assertEqual(sorted(r[0] for r in resultados).count(201), 1, resultados)
        self.assertTrue(all(r[0] in (200, 201) for r in resultados))
        with srv.connect_db() as c:
            self.assertEqual(c.execute("SELECT COUNT(*) FROM reminders").fetchone()[0], 1)
        self.assertEqual(len(FALSO.mensajes), 1)
        self.assertEqual(len(self.notificaciones()), 2)
        # Sin clave: una cita idéntica se rechaza
        self.assertEqual(self.crear()[0], 409)

    def test_dos_procesos_no_envian_el_mismo_aviso(self):
        self.crear()
        fijar(2026, 10, 30, 9, 0)
        reservas = []
        hilos = [threading.Thread(target=lambda: reservas.append(srv._reservar_notificaciones())) for _ in range(8)]
        [h.start() for h in hilos]
        [h.join() for h in hilos]
        self.assertEqual(sum(len(r) for r in reservas), 1)

    def test_14_cita_cancelada_no_genera_avisos(self):
        _, datos = self.crear()
        rid = datos["recordatorio"]["id"]
        FALSO.reiniciar()
        self.assertEqual(self.api("POST", "/eliminar-recordatorio", {"id": rid}, self.tok_ana)[0], 200)
        self.assertEqual(self.notificaciones(), [])
        fijar(2026, 10, 30, 9, 0)
        srv.procesar_notificaciones_pendientes()
        self.assertEqual(FALSO.mensajes, [])

    def test_cambio_de_fecha_actualiza_avisos_pendientes(self):
        _, datos = self.crear()
        rid = datos["recordatorio"]["id"]
        estado, datos = self.api("POST", "/actualizar-recordatorio", {"id": rid, "fecha": "2026-11-05", "hora": "09:30"}, self.tok_ana)
        self.assertEqual(estado, 200, datos)
        dia = [n for n in self.notificaciones(rid) if n["kind"] == "RECORDATORIO_DIA"]
        self.assertEqual(len(dia), 1)
        self.assertEqual(dia[0]["send_at"], "2026-11-05T13:00:00+00:00")
        self.assertEqual(dia[0]["expires_at"], "2026-11-05T14:30:00+00:00")
        self.assertEqual(self.api("POST", "/actualizar-recordatorio", {"id": rid, "fecha": "2026-10-01", "hora": "09:30"}, self.tok_ana)[0], 400)
        # Si la nueva hora no deja tiempo para el aviso del día, el pendiente se descarta.
        self.api("POST", "/actualizar-recordatorio", {"id": rid, "fecha": "2026-10-27", "hora": "10:20"}, self.tok_ana)
        self.assertEqual([n for n in self.notificaciones(rid) if n["kind"] == "RECORDATORIO_DIA"], [])

    def test_recordatorio_diario_una_sola_vez_por_cita_y_canal(self):
        self.crear()
        fijar(2026, 10, 30, 9, 0)
        FALSO.reiniciar()
        for _ in range(4):
            srv.procesar_notificaciones_pendientes()
        self.assertEqual(len(FALSO.mensajes), 1)
        with self.assertRaises(sqlite3.IntegrityError):
            with srv.connect_db() as c:
                n = c.execute("SELECT * FROM notifications WHERE kind='RECORDATORIO_DIA'").fetchone()
                c.execute("""INSERT INTO notifications (reminder_id, patient_id, kind, channel, contact, send_at, created_at)
                             VALUES (?, ?, 'RECORDATORIO_DIA', ?, ?, ?, ?)""",
                          (n["reminder_id"], n["patient_id"], n["channel"], n["contact"], n["send_at"], n["created_at"]))

    def test_errores_sin_credenciales(self):
        os.environ["MI_PACIENTE_TWILIO_AUTH_TOKEN"] = "secreto-super-largo-999"
        self.assertNotIn("secreto-super-largo-999", srv.sanear_error(RuntimeError("fallo con secreto-super-largo-999 dentro")))
        os.environ.pop("MI_PACIENTE_TWILIO_AUTH_TOKEN")


class PruebasMigracion(unittest.TestCase):
    def test_15_base_existente_se_migra_sin_perder_datos(self):
        ruta = Path(TMP) / "antigua.sqlite3"
        conexion = sqlite3.connect(ruta)
        conexion.executescript("""
            CREATE TABLE patients (id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT NOT NULL COLLATE NOCASE UNIQUE,
              password_salt BLOB NOT NULL, password_hash BLOB NOT NULL, first_name TEXT NOT NULL, last_name TEXT NOT NULL,
              document_type TEXT NOT NULL, document_number TEXT NOT NULL, phone TEXT NOT NULL, created_at TEXT NOT NULL);
            CREATE TABLE sessions (token_hash BLOB PRIMARY KEY, patient_id INTEGER NOT NULL, expires_at TEXT NOT NULL);
            CREATE TABLE reminders (id INTEGER PRIMARY KEY AUTOINCREMENT, patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
              reminder_type TEXT NOT NULL, reminder_date TEXT NOT NULL, reminder_time TEXT NOT NULL, detail TEXT NOT NULL DEFAULT '',
              channel TEXT NOT NULL, contact TEXT NOT NULL, created_at TEXT NOT NULL);
            INSERT INTO patients VALUES (1,'v@e.com',x'00',x'00','Vieja','Cuenta','CC','9','300 123 4567','2026-01-01');
            INSERT INTO reminders (patient_id, reminder_type, reminder_date, reminder_time, channel, contact, created_at) VALUES
              (1,'Cita de control','2026-11-10','10:00','SMS','300 123 4567','2026-10-01'),
              (1,'Cita de control','2026-01-10','10:00','SMS','300 123 4567','2026-01-01'),
              (1,'Medicamentos','2026-11-10','07:00','SMS','300 123 4567','2026-10-01'),
              (1,'Dieta','2026-02-10','07:00','Correo electrónico','v@e.com','2026-01-01');
        """)
        conexion.commit()
        conexion.close()
        anterior, srv.DB_PATH = srv.DB_PATH, ruta
        try:
            srv.initialize_database()
            srv.initialize_database()  # idempotente
            with srv.connect_db() as c:
                self.assertEqual(c.execute("SELECT COUNT(*) FROM reminders").fetchone()[0], 4)
                self.assertEqual(c.execute("SELECT email FROM patients").fetchone()[0], "v@e.com")
                filas = {(f["reminder_id"], f["kind"]): f["status"] for f in c.execute("SELECT * FROM notifications")}
                columnas = {f["name"] for f in c.execute("PRAGMA table_info(reminders)")}
            self.assertEqual(filas[(1, "RECORDATORIO_DIA")], "PENDIENTE")
            self.assertEqual(filas[(2, "RECORDATORIO")], "VENCIDO")
            self.assertEqual(filas[(3, "RECORDATORIO")], "PENDIENTE")
            self.assertEqual(filas[(4, "RECORDATORIO")], "VENCIDO")
            self.assertEqual(len(filas), 4)
            self.assertIn("client_key", columnas)
        finally:
            srv.DB_PATH = anterior


class PruebasEstaticos(Base):
    def test_no_se_sirven_archivos_sensibles(self):
        for ruta in ["/mi_paciente_server.py", "/.env", "/_env", "/Codigo%20terminal.docx", "/pruebas.sqlite3", "/LEEME_NUEVA_CUENTA.txt"]:
            self.assertEqual(self.api("GET", ruta)[0], 404, ruta)


if __name__ == "__main__":
    unittest.main(verbosity=2)
