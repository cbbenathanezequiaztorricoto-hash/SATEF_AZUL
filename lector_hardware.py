import serial
import time
import requests

# Modifica 'COM3' según el puerto asignado a tu conversor USB-TTL en el Administrador de Dispositivos
PUERTO_COM = 'COM3'
BAUD_RATE = 9600
URL_API = 'http://127.0.0.1:5000/api/alerta_hardware'

print(f"--- SERVIDOR DE HARDWARE INICIADO EN {PUERTO_COM} ---")

try:
    puerto = serial.Serial(PUERTO_COM, BAUD_RATE, timeout=1)
    time.sleep(2)

    while True:
        if puerto.in_waiting > 0:
            linea = puerto.readline().decode('utf-8', errors='ignore').strip()
            print(f"[SEÑAL HARDWARE RECIBIDA]: {linea}")
            
            if "FATIGA" in linea or "1" in linea:
                print("--> Registrando evento de fatiga en Flask/MySQL...")
                try:
                    res = requests.post(URL_API, json={"idConductor": 1, "idBus": 1})
                    print(f"Respuesta Servidor: {res.json()}")
                except Exception as e:
                    print(f"Error al conectar con la API de Flask: {e}")
        time.sleep(0.1)

except serial.SerialException as e:
    print(f"No se pudo acceder al puerto {PUERTO_COM}. Revisa la conexión del USB-TTL: {e}")
