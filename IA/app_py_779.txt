import os
import re
import math
import time
from functools import wraps
from dotenv import load_dotenv
import mysql.connector
from mysql.connector import Error
import folium
from flask import Flask, render_template, request, redirect, url_for, session, jsonify
from flask_wtf.csrf import CSRFProtect
from werkzeug.security import generate_password_hash, check_password_hash

from datetime import datetime, timedelta

load_dotenv()

app = Flask(__name__)
app.secret_key = os.getenv('SECRET_KEY')
csrf = CSRFProtect(app)

DB_CONFIG = {
    'host': os.getenv('DB_HOST'),
    'user': os.getenv('DB_USER'),
    'password': os.getenv('DB_PASSWORD'),
    'database': os.getenv('DB_NAME')
}
DURACION_DEMO_SEGUNDOS = 300

# ==========================================
# CONEXIÓN Y UTILIDADES DE BASE DE DATOS
# ==========================================
def get_db_connection():
    try:
        return mysql.connector.connect(**DB_CONFIG)
    except Error as e:
        print(f"Error al conectar a MySQL: {e}")
        return None

# ==========================================
# DECORADORES Y AUXILIARES DE VALIDACIÓN
# ==========================================
def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'usuario' not in session:
            return redirect(url_for('index'))
        return f(*args, **kwargs)
    return decorated_function

def admin_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'usuario' not in session:
            return redirect(url_for('index'))
        if session.get('rol') != 'admin':
            return redirect(url_for('dashboard'))
        return f(*args, **kwargs)
    return decorated_function

def validar_telefono(telf):
    return bool(re.fullmatch(r'[67]\d{7}', telf))

def validar_ci(ci):
    return bool(re.fullmatch(r'\d+', ci))

def validar_placa(placa):
    return bool(re.fullmatch(r'\d{3,4}-[A-Z]{3}', placa.strip().upper()))


def obtener_historial_fatiga(id_usuario=None, rol=None):
    conn = get_db_connection()
    if not conn:
        return []

    cursor = conn.cursor(dictionary=True)
    if rol == 'admin':
        cursor.execute("""
            SELECT r.idRegistroDormida, CONCAT(c.primerNombreConductor, ' ', c.apellidoPaterno) as conductor,
                   b.placa, r.fechaDormida, r.telemetriaEstado
            FROM RegistroFatiga r
            LEFT JOIN Conductor c ON r.idConductor = c.idConductor
            LEFT JOIN Bus b ON r.idBus = b.idBus
            ORDER BY r.fechaDormida DESC
        """)
        rows = cursor.fetchall()
    else:
        cursor.execute("""
            SELECT r.idRegistroDormida, CONCAT(c.primerNombreConductor, ' ', c.apellidoPaterno) as conductor,
                   b.placa, r.fechaDormida
            FROM RegistroFatiga r
            LEFT JOIN Conductor c ON r.idConductor = c.idConductor
            LEFT JOIN Bus b ON r.idBus = b.idBus
            WHERE c.idUsuario = %s
            ORDER BY r.fechaDormida DESC
        """, (id_usuario,))
        rows = cursor.fetchall()

    cursor.close()
    conn.close()
    return rows


def cambiar_estado_viaje(id_viaje, estado, id_usuario=None, admin=False):
    conn = get_db_connection()
    if not conn:
        return None

    cursor = conn.cursor()
    fecha_limite_viaje = datetime.now() - timedelta(seconds=DURACION_DEMO_SEGUNDOS)
    try:
        if admin:
            cursor.execute("""
                UPDATE Viaje
                SET estado = %s
                WHERE idViaje = %s
                  AND (
                      estado = 'Detenido'
                      OR (estado = 'En Ruta' AND fechaSalida > %s)
                  )
            """, (estado, id_viaje, fecha_limite_viaje))
        else:
            cursor.execute("""
                UPDATE Viaje v
                JOIN Conductor c ON c.idConductor = v.idConductor
                SET v.estado = %s
                WHERE v.idViaje = %s
                  AND (
                      v.estado = 'Detenido'
                      OR (v.estado = 'En Ruta' AND v.fechaSalida > %s)
                  )
                  AND c.idUsuario = %s
            """, (estado, id_viaje, fecha_limite_viaje, id_usuario))
        conn.commit()
        return cursor.rowcount > 0
    except Error as e:
        print(f"Error al cambiar estado del viaje {id_viaje}: {e}")
        return None
    finally:
        cursor.close()
        conn.close()


def obtener_viaje_por_usuario(id_usuario):
    conn = get_db_connection()
    if not conn:
        return None

    cursor = conn.cursor(dictionary=True)
    cursor.execute("""
        SELECT v.*, b.placa
        FROM Viaje v
        JOIN Conductor c ON v.idConductor = c.idConductor
        JOIN Bus b ON v.idBus = b.idBus
        WHERE c.idUsuario = %s
        ORDER BY v.idViaje DESC
        LIMIT 1
    """, (id_usuario,))
    viaje = cursor.fetchone()
    cursor.close()
    conn.close()
    return viaje

# ==========================================
# INICIALIZACIÓN DE BD
# ==========================================
def init_db():
    conn = get_db_connection()
    if conn and conn.is_connected():
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT * FROM Usuario WHERE username = %s", ('admin',))
        user = cursor.fetchone()
        
        if not user:
            pass_admin_hash = generate_password_hash('admin123')
            pass_chofer_hash = generate_password_hash('123456')

            cursor.execute("INSERT INTO Usuario (username, passwordHash) VALUES (%s, %s)", ('admin', pass_admin_hash))
            user_id = cursor.lastrowid
            cursor.execute("""
                INSERT INTO Administrador (idUsuario, primerNombreAdmin, apellidoPaternoAdmin, ci, telf)
                VALUES (%s, 'Nathan', 'Torrico', '1234567', '70000000')
            """, (user_id,))
            
            cursor.execute("INSERT INTO Bus (placa, marca, modelo, estado) VALUES (%s, %s, %s, %s)", ('2451-AZU', 'Scania', '2022', 'Activo'))
            id_bus = cursor.lastrowid

            cursor.execute("""
                INSERT INTO Camara (idBus, estadoCamara, modeloCamara, ultimoMantenimiento)
                VALUES (%s, 'Activa', 'Logitech C920 Cabina', CURDATE())
            """, (id_bus,))
            
            cursor.execute("INSERT INTO Usuario (username, passwordHash) VALUES (%s, %s)", ('chofer1', pass_chofer_hash))
            c_user_id = cursor.lastrowid
            cursor.execute("""
                INSERT INTO Conductor (idUsuario, primerNombreConductor, segundoNombreConductor, apellidoPaterno, apellidoMaterno, ci, telf, categoriaLicenciaConducir)
                VALUES (%s, 'Juan', 'Carlos', 'Pérez', 'Gómez', '5487921', '71234567', 'A')
            """, (c_user_id,))
            
            conn.commit()
            
        cursor.close()
        conn.close()

# ==========================================
# RUTAS DE AUTENTICACIÓN
# ==========================================
@app.route('/')
def index():
    if 'usuario' in session:
        return redirect(url_for('dashboard'))
    return render_template('login.html')

@app.route('/login', methods=['POST'])
def login():
    username = request.form.get('username', '').strip()
    password = request.form.get('password', '').strip()
    
    conn = get_db_connection()
    if not conn:
        return render_template('login.html', error="Error de conexión con la base de datos")
        
    cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT idUsuario, passwordHash FROM Usuario WHERE username = %s", (username,))
    user = cursor.fetchone()
    
    if user and check_password_hash(user['passwordHash'], password):
        session['usuario'] = username
        session['id_usuario'] = user['idUsuario']
        
        cursor.execute("SELECT idAdministrador FROM Administrador WHERE idUsuario = %s", (user['idUsuario'],))
        admin = cursor.fetchone()
        session['rol'] = 'admin' if admin else 'conductor'
        
        cursor.close()
        conn.close()
        return redirect(url_for('dashboard'))
    else:
        cursor.close()
        conn.close()
        return render_template('login.html', error="Usuario o contraseña incorrectos")

@app.route('/logout')
def logout():
    session.clear()
    return redirect(url_for('index'))

# ==========================================
# PANEL PRINCIPAL (DASHBOARD)
# ==========================================
# ==========================================
# PANEL PRINCIPAL (DASHBOARD) - OPTIMIZADO
# ==========================================
@app.route('/dashboard')
@login_required
def dashboard():
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    fecha_limite_viaje = datetime.now() - timedelta(seconds=DURACION_DEMO_SEGUNDOS)
    cursor.execute("""
        UPDATE Viaje
        SET estado = 'Llegado'
        WHERE estado = 'En Ruta' AND fechaSalida <= %s
    """, (fecha_limite_viaje,))
    conn.commit()
    
    cursor.execute("""
        SELECT u.idUsuario, u.username, 
               a.idAdministrador, a.primerNombreAdmin, a.segundoNombreAdmin, a.apellidoPaternoAdmin, a.apellidoMaternoAdmin, a.ci as ciAdmin, a.telf as telfAdmin,
               c.idConductor, c.primerNombreConductor, c.segundoNombreConductor, c.apellidoPaterno, c.apellidoMaterno, c.ci as ciConductor, c.telf as telfConductor
        FROM Usuario u
        LEFT JOIN Administrador a ON u.idUsuario = a.idUsuario
        LEFT JOIN Conductor c ON u.idUsuario = c.idUsuario
        WHERE u.idUsuario = %s
    """, (session['id_usuario'],))
    perfil = cursor.fetchone()

    rol = 'admin' if perfil and perfil.get('idAdministrador') else 'conductor'
    session['rol'] = rol

    if perfil:
        perfil['primerNombre'] = perfil['primerNombreAdmin'] if rol == 'admin' else perfil['primerNombreConductor']
        perfil['segundoNombre'] = perfil['segundoNombreAdmin'] if rol == 'admin' else perfil['segundoNombreConductor']
        perfil['apellidoPaterno'] = perfil['apellidoPaternoAdmin'] if rol == 'admin' else perfil['apellidoPaterno']
        perfil['apellidoMaterno'] = perfil['apellidoMaternoAdmin'] if rol == 'admin' else perfil['apellidoMaterno']
        perfil['ci'] = perfil['ciAdmin'] if rol == 'admin' else perfil['ciConductor']
        perfil['telf'] = perfil['telfAdmin'] if rol == 'admin' else perfil['telfConductor']

    cursor.execute("""
        SELECT c.idConductor, c.idUsuario, c.primerNombreConductor, c.segundoNombreConductor, 
               c.apellidoPaterno, c.apellidoMaterno, c.ci, c.telf, c.categoriaLicenciaConducir, u.username
        FROM Conductor c
        JOIN Usuario u ON c.idUsuario = u.idUsuario
    """)
    conductores = cursor.fetchall()
    
    cursor.execute("SELECT * FROM Bus")
    buses = cursor.fetchall()

    cursor.execute("""
        SELECT a.idAntecedente, CONCAT(c.primerNombreConductor, ' ', c.apellidoPaterno) as conductor,
               a.razonAntecedente, a.fechaAntecedente
        FROM Antecedente a
        JOIN Conductor c ON a.idConductor = c.idConductor
        ORDER BY a.fechaAntecedente DESC
    """)
    antecedentes = cursor.fetchall()

    if rol == 'admin':
        cursor.execute("""
            SELECT v.idViaje, CONCAT(c.primerNombreConductor, ' ', c.apellidoPaterno) as conductor,
                   b.placa, v.origen, v.destino, v.fechaSalida, v.estado
            FROM Viaje v
            JOIN Conductor c ON v.idConductor = c.idConductor
            JOIN Bus b ON v.idBus = b.idBus
            ORDER BY v.idViaje DESC
        """)
    else:
        cursor.execute("""
            SELECT v.idViaje, CONCAT(c.primerNombreConductor, ' ', c.apellidoPaterno) as conductor,
                   b.placa, v.origen, v.destino, v.fechaSalida, v.estado
            FROM Viaje v
            JOIN Conductor c ON v.idConductor = c.idConductor
            JOIN Bus b ON v.idBus = b.idBus
            WHERE c.idUsuario = %s
            ORDER BY v.idViaje DESC
        """, (session['id_usuario'],))
    viajes = cursor.fetchall()
    
    historial_fatiga = obtener_historial_fatiga(session.get('id_usuario'), rol)

    # CONSULTA DE CÁMARAS PARA EL TEMPLATE
    cursor.execute("""
        SELECT c.*, b.placa, b.marca 
        FROM Camara c
        LEFT JOIN Bus b ON c.idBus = b.idBus
    """)
    camaras = cursor.fetchall()
    cursor.execute("""
        SELECT * FROM Bus 
        WHERE estado = 'Activo' 
        AND idBus NOT IN (SELECT idBus FROM Viaje WHERE estado = 'En Ruta')
    """)
    buses_disponibles = cursor.fetchall()
    # En la función @app.route('/dashboard'):
    viaje_activo_chofer = None
    if session.get('rol') == 'conductor':
        viaje_activo_chofer = obtener_viaje_por_usuario(session['id_usuario'])
        if viaje_activo_chofer and viaje_activo_chofer.get('estado') not in ('En Ruta', 'Detenido'):
            viaje_activo_chofer = None
    cursor.close()
    conn.close()
    
    return render_template('dashboard.html', 
                           usuario=session['usuario'], 
                           rol=session.get('rol'),
                           perfil=perfil,
                           conductores=conductores, 
                           buses=buses,
                           camaras=camaras,
                           antecedentes=antecedentes,
                           viajes=viajes,
                           buses_disponibles=buses_disponibles,
                           viaje_activo=viaje_activo_chofer,  # <-- Se pasa como 'viaje_activo' para que coincida con Jinja
                           historial=historial_fatiga)
# ==========================================
# CRUD CONDUCTORES (SOLO ADMIN)
# ==========================================
@app.route('/conductor/crear', methods=['POST'])
@admin_required
def crear_conductor():
    username = request.form.get('username', '').strip()
    raw_password = request.form.get('password', '').strip()
    ci = request.form.get('ci', '').strip()
    telf = request.form.get('telf', '').strip()

    if not validar_ci(ci) or not validar_telefono(telf) or not username or not raw_password:
        return redirect(url_for('dashboard'))

    # ENCRIPTACIÓN DE CONTRASEÑA EN BD
    password_hash = generate_password_hash(raw_password)

    conn = get_db_connection()
    if conn:
        cursor = conn.cursor(dictionary=True)
        try:
            cursor.execute("INSERT INTO Usuario (username, passwordHash) VALUES (%s, %s)", 
                           (username, password_hash))
            user_id = cursor.lastrowid
            cursor.execute("""
                INSERT INTO Conductor (idUsuario, primerNombreConductor, segundoNombreConductor, apellidoPaterno, apellidoMaterno, ci, telf, categoriaLicenciaConducir)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                user_id, 
                request.form.get('primerNombreConductor', '').strip(), 
                request.form.get('segundoNombreConductor', '').strip(),
                request.form.get('apellidoPaterno', '').strip(), 
                request.form.get('apellidoMaterno', '').strip(),
                ci,
                telf,
                request.form.get('licencia', '').strip()
            ))
            conn.commit()
        except Error as e:
            print(f"Error al crear conductor: {e}")
        finally:
            cursor.close()
            conn.close()
    return redirect(url_for('dashboard'))

@app.route('/conductor/editar/<int:id_conductor>', methods=['POST'])
@admin_required
def editar_conductor(id_conductor):
    ci = request.form.get('ci', '').strip()
    telf = request.form.get('telf', '').strip()

    if not validar_ci(ci) or not validar_telefono(telf):
        return redirect(url_for('dashboard'))

    conn = get_db_connection()
    if conn:
        cursor = conn.cursor()
        primer_nombre = request.form.get('primerNombreConductor', '').strip()
        segundo_nombre = request.form.get('segundoNombreConductor', '').strip()
        apellido_paterno = request.form.get('apellidoPaterno', '').strip()
        apellido_materno = request.form.get('apellidoMaterno', '').strip()
        licencia = request.form.get('licencia', '').strip()

        try:
            cursor.execute("""
            UPDATE Conductor 
            SET primerNombreConductor = %s,
                segundoNombreConductor = %s,
                apellidoPaterno = %s,
                apellidoMaterno = %s,
                ci = %s,
                telf = %s,
                categoriaLicenciaConducir = %s
            WHERE idConductor = %s
            """, (primer_nombre, segundo_nombre, apellido_paterno, apellido_materno, ci, telf, licencia, id_conductor))
            conn.commit()
        except Error as e:
            print(f"Error al editar conductor: {e}")
        finally:
            cursor.close()
            conn.close()
    return redirect(url_for('dashboard'))

@app.route('/conductor/eliminar/<int:id_conductor>', methods=['POST'])
@admin_required
def eliminar_conductor(id_conductor):
    conn = get_db_connection()
    if conn:
        cursor = conn.cursor(dictionary=True)
        try:
            cursor.execute("SELECT idUsuario FROM Conductor WHERE idConductor = %s", (id_conductor,))
            res = cursor.fetchone()
            if res:
                user_id = res['idUsuario']
                cursor.execute("DELETE FROM Conductor WHERE idConductor = %s", (id_conductor,))
                if user_id:
                    cursor.execute("DELETE FROM Usuario WHERE idUsuario = %s", (user_id,))
                conn.commit()
        except Error as e:
            print(f"Error al eliminar conductor: {e}")
        finally:
            cursor.close()
            conn.close()
    return redirect(url_for('dashboard'))

# ==========================================
# CRUD BUSES (SOLO ADMIN)
# ==========================================
@app.route('/bus/crear', methods=['POST'])
@admin_required
def crear_bus():
    placa = request.form.get('placa', '').strip().upper()
    marca = request.form.get('marca', '').strip()
    modelo = request.form.get('modelo', '').strip()

    if not validar_placa(placa):
        return redirect(url_for('dashboard'))

    conn = get_db_connection()
    if conn:
        cursor = conn.cursor()
        cursor.execute("INSERT INTO Bus (placa, marca, modelo, estado) VALUES (%s, %s, %s, 'Activo')",
                       (placa, marca, modelo))
        conn.commit()
        cursor.close()
        conn.close()
    return redirect(url_for('dashboard'))

@app.route('/bus/editar/<int:id_bus>', methods=['POST'])
@admin_required
def editar_bus(id_bus):
    placa = request.form.get('placa', '').strip().upper()
    marca = request.form.get('marca', '').strip()
    modelo = request.form.get('modelo', '').strip()
    estado = request.form.get('estado', 'Activo').strip()

    if not validar_placa(placa):
        return redirect(url_for('dashboard'))

    conn = get_db_connection()
    if conn:
        cursor = conn.cursor()
        cursor.execute("""
            UPDATE Bus SET placa=%s, marca=%s, modelo=%s, estado=%s WHERE idBus=%s
        """, (placa, marca, modelo, estado, id_bus))
        conn.commit()
        cursor.close()
        conn.close()
    return redirect(url_for('dashboard'))

@app.route('/bus/eliminar/<int:id_bus>', methods=['POST'])
@admin_required
def eliminar_bus(id_bus):
    conn = get_db_connection()
    if conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM Bus WHERE idBus=%s", (id_bus,))
        conn.commit()
        cursor.close()
        conn.close()
    return redirect(url_for('dashboard'))

# ==========================================
# ANTECEDENTES (SOLO ADMIN)
# ==========================================
@app.route('/antecedente/crear', methods=['POST'])
@admin_required
def crear_antecedente():
    razon = request.form.get('razon', '').strip()
    id_conductor = request.form.get('idConductor')

    if not razon:
        return redirect(url_for('dashboard'))

    conn = get_db_connection()
    if conn:
        cursor = conn.cursor()
        cursor.execute("INSERT INTO Antecedente (idConductor, razonAntecedente, fechaAntecedente) VALUES (%s, %s, NOW())",
                       (id_conductor, razon))
        conn.commit()
        cursor.close()
        conn.close()
    return redirect(url_for('dashboard'))

# ==========================================
# SEGUIMIENTO, VIAJES Y PERFIL
# ==========================================
@app.route('/viaje/finalizar/<int:id_viaje>', methods=['POST'])
@login_required
def finalizar_viaje(id_viaje):
    actualizado = cambiar_estado_viaje(
        id_viaje,
        'Finalizado',
        id_usuario=session.get('id_usuario'),
        admin=session.get('rol') == 'admin'
    )
    if not actualizado:
        return redirect(url_for('dashboard'))
    return redirect(url_for('dashboard'))


@app.route('/viaje/detener/<int:id_viaje>', methods=['POST'])
@login_required
def detener_viaje(id_viaje):
    actualizado = cambiar_estado_viaje(
        id_viaje,
        'Detenido',
        id_usuario=session.get('id_usuario'),
        admin=session.get('rol') == 'admin'
    )
    if not actualizado:
        return redirect(url_for('dashboard'))
    return redirect(url_for('dashboard'))


@app.route('/api/viaje/estado', methods=['POST'])
@login_required
def actualizar_estado_viaje_api():
    payload = request.get_json(silent=True) or {}
    id_viaje = payload.get('idViaje') or payload.get('id_viaje')
    estado = (payload.get('estado') or '').strip()

    try:
        id_viaje = int(id_viaje)
    except (TypeError, ValueError):
        return jsonify({"status": "error", "message": "El identificador del viaje no es válido"}), 400

    if id_viaje <= 0 or estado not in {'Finalizado', 'Detenido'}:
        return jsonify({"status": "error", "message": "Parámetros inválidos"}), 400

    actualizado = cambiar_estado_viaje(
        id_viaje,
        estado,
        id_usuario=session.get('id_usuario'),
        admin=session.get('rol') == 'admin'
    )
    if actualizado is None:
        return jsonify({"status": "error", "message": "No se pudo actualizar el estado del viaje"}), 500
    if not actualizado:
        return jsonify({
            "status": "error",
            "message": "El viaje ya no está activo o no tienes permiso para modificarlo."
        }), 409

    return jsonify({"status": "ok", "idViaje": id_viaje, "estado": estado})


@app.route('/viaje/crear', methods=['POST'])
@login_required
def crear_viaje():
    conn = get_db_connection()
    if conn:
        cursor = conn.cursor(dictionary=True)
        
        id_conductor = request.form.get('idConductor')
        if not id_conductor:
            cursor.execute("SELECT idConductor FROM Conductor WHERE idUsuario = %s", (session['id_usuario'],))
            res = cursor.fetchone()
            if res:
                id_conductor = res['idConductor']

        id_bus = request.form.get('idBus')
        origen = request.form.get('origen', '').strip()
        destino = request.form.get('destino', '').strip()

        # VALIDACIÓN DE ESTADO DEL BUS EN EL SERVIDOR
        if id_bus:
            cursor.execute("SELECT estado FROM Bus WHERE idBus = %s", (id_bus,))
            bus = cursor.fetchone()
            if not bus or bus.get('estado') in ['Inactivo', 'Mantenimiento']:
                cursor.close()
                conn.close()
                return redirect(url_for('dashboard'))

        if id_conductor and id_bus:
            cursor.execute("""
                INSERT INTO Viaje (idConductor, idBus, origen, destino, fechaSalida)
                VALUES (%s, %s, %s, %s, NOW())
            """, (id_conductor, id_bus, origen, destino))
            conn.commit()
            
        cursor.close()
        conn.close()
        
    return redirect(url_for('dashboard'))

@app.route('/perfil/editar', methods=['POST'])
@login_required
def editar_perfil():
    ci = request.form.get('ci', '').strip()
    telf = request.form.get('telf', '').strip()

    # VALIDACIÓN DE FORMATO CI Y TELÉFONO EN SERVIDOR
    if not validar_ci(ci) or not validar_telefono(telf):
        return redirect(url_for('dashboard'))

    conn = get_db_connection()
    if conn:
        cursor = conn.cursor(dictionary=True)
        try:
            cursor.execute("SELECT idAdministrador FROM Administrador WHERE idUsuario = %s", (session['id_usuario'],))
            is_admin = cursor.fetchone()
            
            if is_admin:
                cursor.execute("""
                    UPDATE Administrador 
                    SET primerNombreAdmin=%s, segundoNombreAdmin=%s, apellidoPaternoAdmin=%s, apellidoMaternoAdmin=%s, ci=%s, telf=%s
                    WHERE idUsuario=%s
                """, (
                    request.form.get('primerNombre', '').strip(),
                    request.form.get('segundoNombre', '').strip(),
                    request.form.get('apellidoPaterno', '').strip(),
                    request.form.get('apellidoMaterno', '').strip(),
                    ci,
                    telf,
                    session['id_usuario']
                ))
            else:
                cursor.execute("""
                    UPDATE Conductor 
                    SET primerNombreConductor=%s, segundoNombreConductor=%s, apellidoPaterno=%s, apellidoMaterno=%s, ci=%s, telf=%s
                    WHERE idUsuario=%s
                """, (
                    request.form.get('primerNombre', '').strip(),
                    request.form.get('segundoNombre', '').strip(),
                    request.form.get('apellidoPaterno', '').strip(),
                    request.form.get('apellidoMaterno', '').strip(),
                    ci,
                    telf,
                    session['id_usuario']
                ))
            conn.commit()
        except Error as e:
            print(f"Error al editar perfil: {e}")
        finally:
            cursor.close()
            conn.close()
    return redirect(url_for('dashboard'))

# ==========================================
# HARDWARE Y TELEMETRÍA (IOT)
# ==========================================
# 1. PERMITIR API EXTERNA E IOT SIN BLOQUEO CSRF
@app.route('/api/historial_fatiga')
@login_required
def api_historial_fatiga():
    rows = obtener_historial_fatiga(session.get('id_usuario'), session.get('rol'))
    return jsonify(rows)


@app.route('/api/alerta_hardware', methods=['POST'])
@app.route('/api/simular_fatiga', methods=['POST'])
@csrf.exempt
def recibir_alerta_hardware():
    conn = get_db_connection()
    if not conn:
        return jsonify({"status": "error", "message": "Sin conexión a BD"}), 500
        
    cursor = conn.cursor(dictionary=True)
    data = request.get_json(silent=True) or {}
    id_conductor = data.get('idConductor')
    id_bus = data.get('idBus')

    if not id_conductor and 'id_usuario' in session:
        cursor.execute("SELECT idConductor FROM Conductor WHERE idUsuario = %s", (session['id_usuario'],))
        res_user = cursor.fetchone()
        if res_user:
            id_conductor = res_user['idConductor']

    if not id_conductor:
        cursor.execute("SELECT idConductor FROM Conductor LIMIT 1")
        res_c = cursor.fetchone()
        id_conductor = res_c['idConductor'] if res_c else None

    if not id_bus and id_conductor:
        cursor.execute("SELECT idBus FROM Viaje WHERE idConductor = %s ORDER BY idViaje DESC LIMIT 1", (id_conductor,))
        res_b = cursor.fetchone()
        id_bus = res_b['idBus'] if res_b else None

    if not id_bus:
        cursor.execute("SELECT idBus FROM Bus LIMIT 1")
        res_b_fallback = cursor.fetchone()
        id_bus = res_b_fallback['idBus'] if res_b_fallback else None

    if not id_conductor or not id_bus:
        cursor.close()
        conn.close()
        return jsonify({"status": "error", "message": "Se requiere al menos un Conductor y Bus en MySQL"}), 400
        
    cursor.execute("""
        INSERT INTO RegistroFatiga (idConductor, idBus, fechaDormida, telemetriaEstado)
        VALUES (%s, %s, NOW(), TRUE)
    """, (id_conductor, id_bus))
    
    conn.commit()
    cursor.close()
    conn.close()
    return jsonify({"status": "ok", "message": "Alerta recibida y almacenada en MySQL"})
MODO_DEMO = os.getenv('MODO_DEMO', 'True') == 'True'

DEPARTAMENTOS = {
    'cochabamba': [-17.3895, -66.1568],
    'la paz': [-16.5001, -68.1193],
    'santa cruz': [-17.7833, -63.1821],
    'oruro': [-17.9647, -67.1060],
    'potosi': [-19.5836, -65.7531],
    'potosí': [-19.5836, -65.7531],
    'chuquisaca': [-19.0333, -65.2627],
    'sucre': [-19.0333, -65.2627],
    'tarija': [-21.5355, -64.7295],
    'beni': [-14.8333, -64.9000],
    'trinidad': [-14.8333, -64.9000],
    'pando': [-11.0267, -68.7692],
    'cobija': [-11.0267, -68.7692]
}

def obtener_coordenadas(nombre_ciudad, default):
    if not nombre_ciudad:
        return default
    nombre_clean = nombre_ciudad.strip().lower()
    for ciudad, coords in DEPARTAMENTOS.items():
        if ciudad in nombre_clean:
            return coords
    return default

# 2. INCLUIR ORIGEN Y DESTINO EN LA RESPUESTA JSON DE BUSES
# @app.route('/api/posiciones_buses')
# def obtener_posiciones_buses():
#     conn = get_db_connection()
#     if not conn:
#         return jsonify([])
        
#     cursor = conn.cursor(dictionary=True)
#     cursor.execute("""
#         SELECT v.idViaje, v.origen, v.destino, b.idBus, b.placa, 
#                CONCAT(c.primerNombreConductor, ' ', c.apellidoPaterno) as conductor,
#                cam.modeloCamara
#         FROM Viaje v
#         JOIN Bus b ON v.idBus = b.idBus
#         JOIN Conductor c ON v.idConductor = c.idConductor
#         LEFT JOIN Camara cam ON b.idBus = cam.idBus
#     """)
#     viajes = cursor.fetchall()
#     posiciones = []

#     for idx, viaje in enumerate(viajes):
#         origen_coords = obtener_coordenadas(viaje['origen'], [-17.3895, -66.1568])
#         destino_coords = obtener_coordenadas(viaje['destino'], [-17.9647, -67.1060])

#         # Verificar si el bus tiene alguna alerta de fatiga registrada
#         cursor.execute("""
#             SELECT idRegistroDormida 
#             FROM RegistroFatiga 
#             WHERE idBus = %s 
#             ORDER BY fechaDormida DESC LIMIT 1
#         """, (viaje['idBus'],))
#         fatiga = cursor.fetchone()
#         estado_fatiga = True if fatiga else False

#         # CÁLCULO DE MOVIMIENTO CONTINUO (Aplica siempre, haya fatiga o no)
#         if MODO_DEMO:
#             # Multiplicar idx * 15 le da un desfase a cada bus para que no salgan del mismo punto
#             t = ((time.time() + idx * 15) % 60) / 60.0  
#             lat_actual = origen_coords[0] + (destino_coords[0] - origen_coords[0]) * t
#             lon_actual = origen_coords[1] + (destino_coords[1] - origen_coords[1]) * t
#         else:
#             lat_actual, lon_actual = origen_coords[0], origen_coords[1]

#         posiciones.append({
#             "idViaje": viaje['idViaje'],
#             "idBus": viaje['idBus'],
#             "placa": viaje['placa'],
#             "conductor": viaje['conductor'],
#             "origen": viaje['origen'],
#             "destino": viaje['destino'],
#             "camara": viaje['modeloCamara'] or "WebCam Cabina",
#             "lat": lat_actual,
#             "lon": lon_actual,
#             "fatiga": estado_fatiga
#         })

#     cursor.close()
#     conn.close()
#     return jsonify(posiciones)
@app.route('/api/posiciones_buses')
def obtener_posiciones_buses():
    conn = get_db_connection()
    if not conn:
        return jsonify([])
        
    cursor = conn.cursor(dictionary=True)
    cursor.execute("""
        SELECT v.idViaje, v.origen, v.destino, v.fechaSalida, v.estado as estadoViaje,
               b.idBus, b.placa, 
               CONCAT(c.primerNombreConductor, ' ', c.apellidoPaterno) as conductor,
               cam.modeloCamara
        FROM Viaje v
        JOIN Bus b ON v.idBus = b.idBus
        JOIN Conductor c ON v.idConductor = c.idConductor
        LEFT JOIN Camara cam ON b.idBus = cam.idBus
        WHERE v.estado = 'En Ruta' OR v.estado = 'Llegado'
    """)
    viajes = cursor.fetchall()
    posiciones = []

    for viaje in viajes:
        origen_coords = obtener_coordenadas(viaje['origen'], [-17.3895, -66.1568])
        destino_coords = obtener_coordenadas(viaje['destino'], [-17.9647, -67.1060])

        cursor.execute("""
            SELECT idRegistroDormida FROM RegistroFatiga 
            WHERE idBus = %s ORDER BY fechaDormida DESC LIMIT 1
        """, (viaje['idBus'],))
        fatiga = cursor.fetchone()

        # Calcular tiempo transcurrido desde la salida
        if viaje['fechaSalida']:
            tiempo_transcurrido = (datetime.now() - viaje['fechaSalida']).total_seconds()
        else:
            tiempo_transcurrido = 0

        # Progreso de 0.0 (Origen) a 1.0 (Destino)
        t = min(tiempo_transcurrido / DURACION_DEMO_SEGUNDOS, 1.0)
        llegado = t >= 1.0

        if llegado and viaje['estadoViaje'] != 'Llegado':
            # Actualizar estado en BD a 'Llegado'
            cursor_up = conn.cursor()
            cursor_up.execute("UPDATE Viaje SET estado = 'Llegado' WHERE idViaje = %s", (viaje['idViaje'],))
            conn.commit()
            cursor_up.close()

        lat_actual = origen_coords[0] + (destino_coords[0] - origen_coords[0]) * t
        lon_actual = origen_coords[1] + (destino_coords[1] - origen_coords[1]) * t

        posiciones.append({
            "idViaje": viaje['idViaje'],
            "idBus": viaje['idBus'],
            "placa": viaje['placa'],
            "conductor": viaje['conductor'],
            "origen": viaje['origen'],
            "destino": viaje['destino'],
            "camara": viaje['modeloCamara'] or "WebCam Cabina",
            "lat": lat_actual,
            "lon": lon_actual,
            "progreso": t,
            "fatiga": bool(fatiga),
            "llegado": llegado
        })

    cursor.close()
    conn.close()
    return jsonify(posiciones)
# ==========================================
# GESTIÓN DE CÁMARAS (SOLO ADMIN)
# ==========================================
@app.route('/camaras', methods=['GET', 'POST'])
@admin_required
def crear_camara():
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)

    if request.method == 'POST':
        id_bus = request.form.get('idBus') or None
        modelo = request.form.get('modeloCamara', '').strip()
        estado = request.form.get('estadoCamara', 'Activa').strip()
        mantenimiento = request.form.get('ultimoMantenimiento') or None

        cursor.execute("""
            INSERT INTO Camara (idBus, modeloCamara, estadoCamara, ultimoMantenimiento)
            VALUES (%s, %s, %s, %s)
        """, (id_bus, modelo, estado, mantenimiento))
        conn.commit()

    cursor.close()
    conn.close()
    
    return redirect(url_for('dashboard'))
@app.route('/camaras/editar/<int:id_camara>', methods=['POST'])
@admin_required
def editar_camara(id_camara):
    id_bus = request.form.get('idBus') 
    modelo = request.form.get('modeloCamara', '').strip()
    estado = request.form.get('estadoCamara', 'Activa').strip()
    mantenimiento = request.form.get('ultimoMantenimiento')

    conn = get_db_connection()
    cursor = conn.cursor()  
    cursor.execute("""
        UPDATE Camara 
        SET idBus = %s, modeloCamara = %s, estadoCamara = %s, ultimoMantenimiento = %s
        WHERE idCamara = %s
    """, (id_bus, modelo, estado, mantenimiento, id_camara))
    conn.commit()
    cursor.close()
    conn.close()
    return redirect(url_for('dashboard'))

@app.route('/camaras/eliminar/<int:id_camara>', methods=['POST'])
@admin_required
def eliminar_camara(id_camara):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM Camara WHERE idCamara = %s", (id_camara,))
    conn.commit()
    cursor.close()
    conn.close()
    return redirect(url_for('dashboard'))

if __name__ == '__main__':
    init_db()
    app.run(debug=True, port=5000)