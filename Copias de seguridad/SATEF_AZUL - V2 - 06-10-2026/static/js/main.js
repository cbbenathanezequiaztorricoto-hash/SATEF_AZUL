/**
 * SATEF-AZUL - Lógica JavaScript principal
 */

// Abrir Modal de Perfil al hacer clic en la tarjeta de usuario
function abrirModalPerfil() {
    const modalElement = document.getElementById('modalPerfil');
    if (modalElement) {
        const myModal = new bootstrap.Modal(modalElement);
        myModal.show();
    }
}

// Simular emisión de alerta LoRa desde la cabina (Hardware)
// Función para reproducir el tono de alarma
function reproducirAlarmaSonora() {
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        
        osc.type = 'sawtooth';
        osc.frequency.value = 880; // Frecuencia de alarma en Hz
        gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
        
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        
        osc.start();
        osc.stop(audioCtx.currentTime + 1.5); // Suena durante 1.5 segundos
    } catch (e) {
        console.warn("El navegador no permitió reproducción automática de audio:", e);
    }
}

function simularAlertaLoRa() {
    reproducirAlarmaSonora();
    
    // Enviar petición al backend Flask
    fetch('/api/simular_fatiga', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ evento: 'Fatiga simulada por botón web' })
    })
    .then(response => response.json())
    .then(data => {
        // Alerta estilizada con SweetAlert2
        Swal.fire({
            title: '¡Alerta Registrada!',
            text: '⚠️ Alerta LoRa emitida y registrada correctamente.',
            icon: 'warning',
            confirmButtonText: 'Aceptar',
            confirmButtonColor: '#dc3545'
        }).then((result) => {
            if (result.isConfirmed) {
                window.location.reload();
            }
        });
    })
    .catch(err => {
        console.error("Error al emitir alerta:", err);
        Swal.fire({
            title: 'Error',
            text: 'No se pudo registrar la alerta.',
            icon: 'error',
            confirmButtonColor: '#dc3545'
        });
    });
}

function cerrarAlertaPeligro() {
    const overlay = document.getElementById('overlayPeligro');
    if (overlay) {
        overlay.classList.add('d-none');
        overlay.classList.remove('d-flex');
    }
    location.reload();
}

// Notificar evento crítico a Patrulla Caminera
function notificarPatrulla(conductor, placa) {
    Swal.fire({
        title: '¿Reportar a Patrulla Caminera?',
        text: `Se enviará un reporte crítico con la posición del bus ${placa} manejado por ${conductor}.`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'Sí, enviar reporte',
        cancelButtonText: 'Cancelar'
    }).then((result) => {
        if (result.isConfirmed) {
            Swal.fire(
                'Reporte Enviado',
                'La Patrulla Caminera ha recibido la alerta de intercepción.',
                'success'
            );
        }
    });
}

// Interceptar formularios de eliminación para pedir confirmación previa
function confirmarEliminacion(event) {
    event.preventDefault();
    const form = event.target;
    
    Swal.fire({
        title: '¿Está seguro?',
        text: "Esta acción eliminará el registro de la base de datos de manera permanente.",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'Sí, eliminar',
        cancelButtonText: 'Cancelar'
    }).then((result) => {
        if (result.isConfirmed) {
            form.submit();
        }
    });
}
function mostrarAlertaPeligro() {
    const overlay = document.getElementById('overlayPeligro');
    if (overlay) {
        overlay.classList.remove('d-none');
        overlay.classList.add('d-flex');
    }
}

function cerrarAlertaPeligro() {
    const overlay = document.getElementById('overlayPeligro');
    if (overlay) {
        overlay.classList.add('d-none');
        overlay.classList.remove('d-flex');
    }
}