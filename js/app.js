// 🌐 CONEXIÓN AL BACKEND API
// Apunta a la carpeta donde vive tu repositorio 'auraterra-backend-api' en XAMPP:
const API_URL = "http://localhost/auraTerraMayo/PUBLIC"

window.addEventListener('DOMContentLoaded', () => {
    const inputCiudad = document.getElementById('inputCiudadMobile');
    const btnBuscar = document.getElementById('btnBuscarMobile');
    const btnGps = document.getElementById('btnGpsMobile');
    const btnInfo = document.getElementById('btnInfoMobile');

    // Carga inicial
    obtenerClimaMobile(inputCiudad.value);

    // Escuchadores de eventos táctiles
    btnBuscar.addEventListener('click', () => {
        if (inputCiudad.value.trim() !== '') {
            obtenerClimaMobile(inputCiudad.value.trim());
        }
    });

    btnGps.addEventListener('click', obtenerGpsMobile);

    btnInfo.addEventListener('click', () => {
        alert("📲 AuraTerra Mobile v1.0\n\nDesarrollado por Folmer, Gareis & Godoy.\nConectado mediante arquitectura API REST.");
    });
});

// ☀️ Petición Asincrónica al Backend PHP
async function obtenerClimaMobile(ciudad) {
    const bloqueActual = document.getElementById('bloqueClimaActualMobile');
    const bloquePronostico = document.getElementById('bloquePronosticoMobile');

    bloqueActual.innerHTML = '<p class="loading-text">⏳ Actualizando clima...</p>';
    bloquePronostico.innerHTML = '<p class="loading-text">Cargando...</p>';

    try {
        // 📡 Consumo del Endpoint del Backend
        const respActual = await fetch(`${API_URL}/clima/actual?ciudad=${encodeURIComponent(ciudad)}`);
        const dataActual = await respActual.json();

        if (dataActual.error) {
            bloqueActual.innerHTML = `<p style="color:#e53e3e; text-align:center;">⚠️ ${dataActual.mensaje || 'Error al consultar'}</p>`;
            return;
        }

        const clima = dataActual.data;

        // Renderizado Táctil Actual
        bloqueActual.innerHTML = `
            <p style="font-weight:bold; color:#4a5568;">📍 ${clima.ubicacion}</p>
            <div class="temp-big">${Math.round(clima.temperatura)}°C</div>
            <p style="text-transform:capitalize; font-weight:600; color:#2b6cb0;">${clima.descripcion}</p>
            <div style="margin-top:10px; font-size:0.85rem; color:#718096; display:flex; justify-content:space-between;">
                <span>💧 Humedad: ${clima.humedad}%</span>
                <span>💨 Viento: ${clima.viento} m/s</span>
            </div>
        `;

        // 📡 Consumo del Endpoint del Pronóstico
        const respPronostico = await fetch(`${API_URL}/clima/pronostico?ciudad=${encodeURIComponent(ciudad)}`);
        const dataPronostico = await respPronostico.json();
        const lista = dataPronostico.data || [];

        let htmlPronostico = '';
        lista.slice(0, 6).forEach(item => {
            const hora = item.dt_txt ? item.dt_txt.split(' ')[1].substring(0, 5) : '--:--';
            htmlPronostico += `
                <div class="forecast-item">
                    <span style="font-size:0.75rem; color:#718096; display:block;">${hora} hs</span>
                    <strong style="font-size:1.1rem; color:#2d3748; display:block; margin:4px 0;">${Math.round(item.main.temp)}°C</strong>
                    <span style="font-size:0.7rem; text-transform:capitalize; color:#4a5568;">${item.weather[0].description}</span>
                </div>
            `;
        });

        bloquePronostico.innerHTML = htmlPronostico;

    } catch (e) {
        bloqueActual.innerHTML = '<p style="color:#e53e3e; text-align:center;">⚠️ Error de conexión con el Backend API.</p>';
    }
}

// 📍 Geolocalización GPS Novedosa
function obtenerGpsMobile() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(async (pos) => {
            const lat = pos.coords.latitude.toFixed(4);
            const lon = pos.coords.longitude.toFixed(4);
            
            const bloqueActual = document.getElementById('bloqueClimaActualMobile');
            bloqueActual.innerHTML = `<p class="loading-text">🛰️ GPS: Lat ${lat}, Lon ${lon}...</p>`;

            try {
                const response = await fetch(`${API_URL}/clima/actual?lat=${lat}&lon=${lon}`);
                const res = await response.json();
                if (res.data) {
                    document.getElementById('inputCiudadMobile').value = res.data.ubicacion;
                    obtenerClimaMobile(res.data.ubicacion);
                }
            } catch(e) {
                alert("Error al procesar coordenadas GPS.");
            }
        });
    }
}