/**
 * Reproductor de Alarma Sonora de Fatiga
 */
function reproducirAlarmaSonora() {
    // 1. Intenta reproducir archivo de audio desde la carpeta static/audio/
    const audio = new Audio('/static/audio/alarma.mp3');
    audio.play().catch(() => {
        // 2. Fallback: Sintetizador de sonido continuo tipo sirena (Web Audio API)
        try {
            const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(880, audioCtx.currentTime); // Tono A5
            osc.frequency.exponentialRampToValueAtTime(440, audioCtx.currentTime + 0.5);
            
            gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
            
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            
            osc.start();
            osc.stop(audioCtx.currentTime + 1.2);
        } catch (e) {
            console.log("Audio Context no soportado o bloqueado por el navegador");
        }
    });
}

// Abrir Modal de Perfil
function abrirModalPerfil() {
    const modalElement = document.getElementById('modalPerfil');
    if (modalElement) {
        new bootstrap.Modal(modalElement).show();
    }
}

// Simulación de Emisión de Alerta LoRa (Vista Conductor/Hardware)
function simularAlertaLoRa() {
    reproducirAlarmaSonora();
    
    Swal.fire({
        title: '¡ALERTA DE FATIGA DETECTADA!',
        text: 'Transmitiendo evento vía LoRa hacia la central de monitoreo...',
        icon: 'warning',
        confirmButtonColor: '#d33',
        confirmButtonText: 'Aceptar',
        timer: 3000
    });

    fetch('/api/simular_fatiga', { method: 'POST' })
        .then(response => response.json())
        .then(data => {
            setTimeout(() => { location.reload(); }, 1500);
        })
        .catch(err => console.error('Error enviando telemetría:', err));
}

// Notificación recibida en el Administrador
function recibirNotificacionAdministrador(conductor, placa) {
    reproducirAlarmaSonora();
    Swal.fire({
        title: '🚨 CRÍTICO: Fatiga Detectada',
        html: `El conductor <b>${conductor}</b> del bus <b>${placa}</b> presenta un evento crítico de adormecimiento.`,
        icon: 'error',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: '<i class="fas fa-shield-alt"></i> Notificar Patrulla',
        cancelButtonText: 'Entendido'
    }).then((result) => {
        if (result.isConfirmed) {
            notificarPatrulla(conductor, placa);
        }
    });
}

// Notificar a la Patrulla Caminera
function notificarPatrulla(conductor, placa) {
    Swal.fire({
        title: 'Reporte Enviado',
        text: `Se ha despachado la posición GPS del bus ${placa} manejado por ${conductor} a la Patrulla Caminera.`,
        icon: 'success'
    });
}

// Confirmar Eliminación
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