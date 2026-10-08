/**
 * SATEF-AZUL - Lógica JavaScript Principal
 */

// =========================================================================
// 1. FUNCIONES MODALES, ALERTAS Y EVENTOS
// =========================================================================

function abrirModalPerfil() {
    const modalElement = document.getElementById('modalPerfil');
    if (modalElement) {
        const myModal = new bootstrap.Modal(modalElement);
        myModal.show();
    }
}

function reproducirAlarmaSonora() {
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        
        osc.type = 'sawtooth';
        osc.frequency.value = 880; 
        gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
        
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        
        osc.start();
        osc.stop(audioCtx.currentTime + 1.5);
    } catch (e) {
        console.warn("El navegador bloqueó la reproducción de audio:", e);
    }
}

function simularAlertaLoRa() {
    reproducirAlarmaSonora();

    function enviarAlertaServidor(lat, lon) {
        fetch('/api/simular_fatiga', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                evento: 'Fatiga simulada por botón web',
                latitud: lat,
                longitud: lon
            })
        })
        .then(response => response.json())
        .then(data => {
            Swal.fire({
                title: '¡Alerta Registrada!',
                text: `⚠️ Alerta emitida en (${lat.toFixed(4)}, ${lon.toFixed(4)}) y registrada correctamente.`,
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
                text: 'No se pudo registrar la alerta en el servidor.',
                icon: 'error',
                confirmButtonColor: '#dc3545'
            });
        });
    }

    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            position => enviarAlertaServidor(position.coords.latitude, position.coords.longitude),
            () => {
                const latRand = -17.3895 + (Math.random() - 0.5) * 0.04;
                const lonRand = -66.1568 + (Math.random() - 0.5) * 0.04;
                enviarAlertaServidor(latRand, lonRand);
            }
        );
    } else {
        enviarAlertaServidor(-17.3895, -66.1568);
    }
}

function notificarPatrulla(conductor, placa) {
    const conductorNombre = conductor || 'Conductor Desconocido';
    const placaBus = placa || 'N/A';

    Swal.fire({
        title: '¿Reportar a Patrulla Caminera?',
        text: `Se enviará un reporte crítico con la posición del bus ${placaBus} manejado por ${conductorNombre}.`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'Sí, enviar reporte',
        cancelButtonText: 'Cancelar'
    }).then((result) => {
        if (result.isConfirmed) {
            Swal.fire('Reporte Enviado', 'La Patrulla Caminera ha recibido la alerta.', 'success');
        }
    });
}

function cambiarEstadoViajeDesdeTabla(idViaje, estado) {
    if (!idViaje) return;

    const textoEstado = estado === 'Detenido' ? 'detener' : 'finalizar';
    const titulo = estado === 'Detenido' ? '¿Detener este viaje?' : '¿Finalizar este viaje?';
    const texto = estado === 'Detenido'
        ? 'Esto cambiará el estado del viaje a "Detenido" y dejará la pantalla del conductor sincronizada con el mapa.'
        : 'Esto cambiará el estado del viaje a "Finalizado" en la base de datos y sincronizará la vista del chofer y del administrador.';

    Swal.fire({
        title: titulo,
        text: texto,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: estado === 'Detenido' ? '#f4b400' : '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: `Sí, ${textoEstado}`,
        cancelButtonText: 'Cancelar'
    }).then((result) => {
        if (!result.isConfirmed) return;

        fetch('/api/viaje/estado', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': document.querySelector('meta[name="csrf-token"]')?.content || ''
            },
            body: JSON.stringify({ idViaje: idViaje, estado: estado })
        })
        .then(async response => {
            let data;
            try {
                data = await response.json();
            } catch {
                throw new Error(`El servidor respondió con el error HTTP ${response.status}.`);
            }
            if (!response.ok) {
                throw new Error(data.message || `El servidor respondió con el error HTTP ${response.status}.`);
            }
            return data;
        })
        .then(data => {
            if (data.status === 'ok') {
                const detalle = estado === 'Detenido' ? 'Viaje detenido' : 'Viaje finalizado';
                Swal.fire(detalle, 'El estado del viaje fue actualizado correctamente.', 'success');
                window.location.reload();
            } else {
                Swal.fire('Error', data.message || 'No se pudo actualizar el estado del viaje.', 'error');
            }
        })
        .catch(error => {
            Swal.fire('Error', error.message || 'No se pudo comunicar con el servidor.', 'error');
        });
    });
}

function confirmarEliminacion(event) {
    event.preventDefault();
    const form = event.target;
    Swal.fire({
        title: '¿Está seguro?',
        text: "Esta acción eliminará el registro de manera permanente.",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'Sí, eliminar',
        cancelButtonText: 'Cancelar'
    }).then((result) => {
        if (result.isConfirmed) form.submit();
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
    location.reload();
}

// =========================================================================
// 2. COORDENADAS DE CIUDADES DE BOLIVIA
// =========================================================================

const COORDENADAS_CIUDADES = {
    'cochabamba': [-17.3895, -66.1568],
    'la paz': [-16.5001, -68.1193],
    'santa cruz': [-17.7833, -63.1821],
    'oruro': [-17.9647, -67.1060],
    'potosi': [-19.5836, -65.7531],
    'potosí': [-19.5836, -65.7531],
    'sucre': [-19.0333, -65.2627],
    'chuquisaca': [-19.0333, -65.2627],
    'tarija': [-21.5355, -64.7295],
    'trinidad': [-14.8333, -64.9000],
    'beni': [-14.8333, -64.9000],
    'cobija': [-11.0267, -68.7692],
    'pando': [-11.0267, -68.7692]
};

function obtenerCoordenadaCiudad(nombre) {
    if (!nombre) return null;
    const clean = nombre.trim().toLowerCase();
    for (let ciudad in COORDENADAS_CIUDADES) {
        if (clean.includes(ciudad)) return COORDENADAS_CIUDADES[ciudad];
    }
    return null;
}

// =========================================================================
// 3. MAPA Y SEGUIMIENTO EN TIEMPO REAL
// =========================================================================

let mapa = null;
const marcadoresBuses = {};
const rutasCapas = {};
const rutasGeometria = {};

const coloresRuta = [
    '#2563eb', // Azul
    '#7c3aed', // Violeta
    '#db2777', // Rosado
    '#059669', // Verde
    '#ea580c', // Naranja
    '#0891b2'  // Cian
];

const iconoNormal = L.icon({
    iconUrl: 'https://cdn-icons-png.flaticon.com/512/3448/3448339.png',
    iconSize: [32, 32],
    iconAnchor: [16, 16]
});

const iconoFatiga = L.icon({
    iconUrl: 'https://cdn-icons-png.flaticon.com/512/564/564619.png',
    iconSize: [38, 38],
    iconAnchor: [19, 19]
});

function renderHistorialFatiga(rows) {
    const tbody = document.getElementById('tablaHistorialFatigaBody');
    if (!tbody) return;
    const puedeNotificarPatrulla = tbody.closest('table')?.dataset.rol === 'admin';
    const columnas = puedeNotificarPatrulla ? 6 : 4;

    if (!rows || !rows.length) {
        const tr = document.createElement('tr');
        const td = document.createElement('td');
        td.colSpan = columnas;
        td.className = 'text-center text-muted';
        td.textContent = 'No se han registrado eventos de fatiga.';
        tr.appendChild(td);
        tbody.replaceChildren(tr);
        return;
    }

    const filas = rows.map((h) => {
        const conductor = h.conductor || 'Conductor Desconocido';
        const placa = h.placa || 'N/A';
        const tr = document.createElement('tr');
        const agregarCelda = (valor) => {
            const td = document.createElement('td');
            td.textContent = valor ?? '';
            tr.appendChild(td);
            return td;
        };

        agregarCelda(h.idRegistroDormida);
        agregarCelda(conductor);

        const placaTd = agregarCelda('');
        const placaBadge = document.createElement('span');
        placaBadge.className = 'badge bg-dark';
        placaBadge.textContent = placa;
        placaTd.appendChild(placaBadge);

        agregarCelda(h.fechaDormida);

        if (puedeNotificarPatrulla) {
            const estadoTd = agregarCelda('');
            const estadoBadge = document.createElement('span');
            estadoBadge.className = h.telemetriaEstado ? 'badge bg-danger' : 'badge bg-success';
            estadoBadge.textContent = h.telemetriaEstado ? 'Alerta de Fatiga' : 'Normal';
            estadoTd.appendChild(estadoBadge);

            const accionTd = agregarCelda('');
            const boton = document.createElement('button');
            boton.type = 'button';
            boton.className = 'btn btn-sm btn-outline-warning';
            boton.dataset.notificarPatrulla = '';
            boton.dataset.conductor = conductor;
            boton.dataset.placa = placa;

            const icono = document.createElement('i');
            icono.className = 'fas fa-shield-alt';
            boton.append(icono, document.createTextNode(' Notificar Patrulla'));
            accionTd.appendChild(boton);
        }

        return tr;
    });
    tbody.replaceChildren(...filas);
}

function cargarHistorialFatiga() {
    const tbody = document.getElementById('tablaHistorialFatigaBody');
    if (!tbody) return;

    fetch('/api/historial_fatiga')
        .then(response => response.json())
        .then(data => renderHistorialFatiga(Array.isArray(data) ? data : []))
        .catch(() => {
            const td = document.createElement('td');
            td.colSpan = tbody.closest('table')?.dataset.rol === 'admin' ? 6 : 4;
            td.className = 'text-center text-muted';
            td.textContent = 'No se pudo cargar el historial de fatiga.';
            const tr = document.createElement('tr');
            tr.appendChild(td);
            tbody.replaceChildren(tr);
        });
}

document.addEventListener("DOMContentLoaded", function() {
    const mapElement = document.getElementById('map');

    document.addEventListener('click', function(event) {
        if (!(event.target instanceof Element)) return;

        const button = event.target.closest('button[data-estado-viaje], button[data-notificar-patrulla]');
        if (!(button instanceof HTMLButtonElement)) return;

        if (button.hasAttribute('data-estado-viaje')) {
            const idViaje = Number(button.dataset.idViaje);
            const estado = button.dataset.estadoViaje;
            if (!Number.isSafeInteger(idViaje) || idViaje <= 0 ||
                (estado !== 'Detenido' && estado !== 'Finalizado')) {
                console.error('Datos inválidos en la acción de estado del viaje.');
                return;
            }
            cambiarEstadoViajeDesdeTabla(idViaje, estado);
            return;
        }

        notificarPatrulla(button.dataset.conductor, button.dataset.placa);
    });

    if (mapElement) {
        // Inicializar mapa centrado en Cochabamba
        mapa = L.map('map').setView([-17.3895, -66.1568], 7);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap'
        }).addTo(mapa);

        // Cargar mapa inicialmente y luego actualizar cada 2 segundos
        actualizarMapa();
        setInterval(actualizarMapa, 2000);
    }

    // Mantener actualizada la tabla de historial de fatiga sin recargar la página
    cargarHistorialFatiga();
    setInterval(cargarHistorialFatiga, 10000);
});

function actualizarMapa() {
    if (!mapa) return;

    fetch('/api/posiciones_buses')
        .then(response => response.json())
        .then(buses => {
            if (!Array.isArray(buses)) return;

            const busesActivosIds = new Set();

            buses.forEach(bus => {
                const busId = bus.idViaje ?? bus.id_viaje ?? bus.idBus;
                if (!busId) return;

                // Si el viaje ya llegó a destino o fue finalizado, remover mapa/ruta
                if (bus.llegado || bus.estado === 'LLEGÓ A DESTINO' || bus.estado === 'FINALIZADO') {
                    eliminarViajeDelMapa(busId);
                    return;
                }

                busesActivosIds.add(busId);

                const origenCoord = obtenerCoordenadaCiudad(bus.origen) || [bus.lat, bus.lon];
                const destinoCoord = obtenerCoordenadaCiudad(bus.destino) || [bus.lat, bus.lon];

                // 1. Trazar ruta OSRM con un color característico por viaje.
                //    Solo se dibuja una vez por viaje; no se borra mientras el bus avanza.
                if (!rutasCapas[busId] && !rutasGeometria[busId] && origenCoord && destinoCoord) {
                    trazarRutaOSRM(busId, origenCoord, destinoCoord, bus.fatiga);
                } else if (rutasCapas[busId]) {
                    rutasCapas[busId].setStyle({
                        color: bus.fatiga ? '#e74c3c' : coloresRuta[busId % coloresRuta.length]
                    });
                }

                // 2. Determinar posición del bus (geometría de carretera o coordenadas actuales)
                let posActual = [bus.lat, bus.lon];
                if (bus.progreso !== undefined && rutasGeometria[busId] && rutasGeometria[busId].length > 0) {
                    const puntos = rutasGeometria[busId];
                    const idx = Math.min(
                        Math.max(Math.floor(bus.progreso * (puntos.length - 1)), 0),
                        puntos.length - 1
                    );
                    posActual = puntos[idx];
                }

                // 3. Crear o actualizar marcador
                let estadoTexto = '<span style="color:green; font-weight:bold;">EN TRÁNSITO</span>';
                if (bus.fatiga) {
                    estadoTexto = '<span style="color:red; font-weight:bold;">⚠️ FATIGA DETECTADA</span>';
                }

                const contenidoPopup = `
                    <b>Bus:</b> ${bus.placa}<br>
                    <b>Conductor:</b> ${bus.conductor || bus.chofer}<br>
                    <b>Ruta:</b> ${bus.origen} ➔ ${bus.destino}<br>
                    <b>Estado:</b> ${estadoTexto}
                `;

                const iconoActual = bus.fatiga ? iconoFatiga : iconoNormal;

                if (marcadoresBuses[busId]) {
                    marcadoresBuses[busId].setLatLng(posActual);
                    marcadoresBuses[busId].setIcon(iconoActual);
                    marcadoresBuses[busId].getPopup().setContent(contenidoPopup);
                } else {
                    marcadoresBuses[busId] = L.marker(posActual, { icon: iconoActual })
                        .addTo(mapa)
                        .bindPopup(contenidoPopup);
                }
            });

            // Limpiar del mapa cualquier bus/ruta que haya sido eliminado en BD o haya terminado
            Object.keys(marcadoresBuses).forEach(idStr => {
                const id = parseInt(idStr, 10);
                if (!busesActivosIds.has(id)) {
                    eliminarViajeDelMapa(id);
                }
            });
        })
        .catch(err => console.error("Error cargando posiciones:", err));
}

function trazarRutaOSRM(busId, origenCoord, destinoCoord, tieneFatiga) {
    if (rutasCapas[busId] || rutasGeometria[busId]) return;

    const colorViaje = tieneFatiga ? '#e74c3c' : coloresRuta[busId % coloresRuta.length];
    const urlOSRM = `https://router.project-osrm.org/route/v1/driving/${origenCoord[1]},${origenCoord[0]};${destinoCoord[1]},${destinoCoord[0]}?overview=full&geometries=geojson`;

    fetch(urlOSRM)
        .then(res => res.json())
        .then(data => {
            if (data.routes && data.routes.length > 0) {
                const coords = data.routes[0].geometry.coordinates.map(c => [c[1], c[0]]);
                rutasGeometria[busId] = coords;

                if (rutasCapas[busId]) {
                    mapa.removeLayer(rutasCapas[busId]);
                }

                rutasCapas[busId] = L.polyline(coords, {
                    color: colorViaje,
                    weight: 5,
                    opacity: 0.85
                }).addTo(mapa);
            }
        })
        .catch(() => {
            // Línea de respaldo si no responde OSRM
            const coords = [origenCoord, destinoCoord];
            rutasGeometria[busId] = coords;
            rutasCapas[busId] = L.polyline(coords, {
                color: colorViaje,
                weight: 4,
                dashArray: '8, 8'
            }).addTo(mapa);
        });
}

function eliminarViajeDelMapa(busId) {
    if (marcadoresBuses[busId]) {
        mapa.removeLayer(marcadoresBuses[busId]);
        delete marcadoresBuses[busId];
    }
    if (rutasCapas[busId]) {
        mapa.removeLayer(rutasCapas[busId]);
        delete rutasCapas[busId];
    }
    delete rutasGeometria[busId];
}