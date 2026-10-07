const API_URL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? 'http://localhost/auraterra-backend-api/index.php'
    : '/api/index.php';

let ciudadActualM = "Crespo, Entre Ríos, AR";
let datosUsuarioM = null;
let codigoOtpM = null;
let intentosOtpM = 0;
let recordarSesionM = true;

// 1. GESTIÓN DE SESIÓN
window.addEventListener('DOMContentLoaded', () => {
    const sesion = localStorage.getItem('usuario_mobile') || sessionStorage.getItem('usuario_mobile');
    if (sesion) {
        try {
            datosUsuarioM = JSON.parse(sesion);
            mostrarDashboardMobile();
        } catch(e) {
            mostrarAuthMobile();
        }
    } else {
        mostrarAuthMobile();
    }
    renderizarPillsFavoritos();
});

function cambiarTabMobile(tab) {
    document.getElementById('tabLoginM').classList.toggle('activa', tab === 'login');
    document.getElementById('tabRegisterM').classList.toggle('activa', tab === 'registro');
    document.getElementById('formLoginMobile').style.display = tab === 'login' ? 'block' : 'none';
    document.getElementById('formRegMobile').style.display = tab === 'registro' ? 'block' : 'none';
    document.getElementById('msgAuthMobile').textContent = '';
}

function toggleOjoPass(idInput, btn) {
    const inp = document.getElementById(idInput);
    if (inp.type === 'password') {
        inp.type = 'text';
        btn.textContent = '👀';
    } else {
        inp.type = 'password';
        btn.textContent = '🙈';
    }
}

// 2. LOGIN Y 2FA MOBILE
async function iniciarLoginMobile(e) {
    e.preventDefault();
    const email = document.getElementById('emailLoginM').value.trim();
    const password = document.getElementById('passLoginM').value;
    recordarSesionM = document.getElementById('checkRecordarM').checked;
    const msg = document.getElementById('msgAuthMobile');
    msg.style.color = '#3182ce';
    msg.textContent = 'Conectando con AuraTerra...';

    try {
        const res = await fetch(`${API_URL}?ruta=/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const data = await res.json();
        if (data.status === 'success') {
            msg.textContent = '';
            datosUsuarioM = data.user;
            intentosOtpM = 0;
            
            // Genera y abre el modal 2FA
            codigoOtpM = Math.floor(100000 + Math.random() * 900000).toString();
            document.getElementById('otpMuestraM').textContent = `Código: ${codigoOtpM}`;
            document.getElementById('modal2FAMobile').classList.add('activa');
            const inpOtp = document.getElementById('inputOtpM');
            inpOtp.value = '';
            setTimeout(() => inpOtp.focus(), 200);
            inpOtp.onkeydown = (evt) => {
                if (evt.key === 'Enter') {
                    evt.preventDefault();
                    verificarOtpMobile();
                }
            };
        } else {
            msg.style.color = '#e53e3e';
            msg.textContent = '❌ ' + (data.message || 'Credenciales inválidas');
        }
    } catch(err) {
        msg.style.color = '#e53e3e';
        msg.textContent = '❌ Error de conexión al backend';
    }
}

function verificarOtpMobile() {
    const ingresado = document.getElementById('inputOtpM').value.trim();
    const err = document.getElementById('errorOtpM');

    if (ingresado === codigoOtpM) {
        document.getElementById('modal2FAMobile').classList.remove('activa');
        const str = JSON.stringify(datosUsuarioM);
        if (recordarSesionM) {
            localStorage.setItem('usuario_mobile', str);
            sessionStorage.removeItem('usuario_mobile');
        } else {
            sessionStorage.setItem('usuario_mobile', str);
            localStorage.removeItem('usuario_mobile');
        }
        mostrarDashboardMobile();
    } else {
        intentosOtpM++;
        if (intentosOtpM >= 3) {
            alert("🚫 Bloqueo: Superaste los 3 intentos permitidos.");
            window.location.reload();
        } else {
            err.style.display = 'block';
            err.textContent = `Código erróneo. Te quedan ${3 - intentosOtpM} intento(s).`;
        }
    }
}

async function iniciarRegistroMobile(e) {
    e.preventDefault();
    const nombre = document.getElementById('nombreRegM').value.trim();
    const email = document.getElementById('emailRegM').value.trim();
    const password = document.getElementById('passRegM').value;
    const rol = document.getElementById('rolRegM').value;
    const msg = document.getElementById('msgAuthMobile');
    msg.style.color = '#3182ce';
    msg.textContent = 'Creando tu cuenta...';

    try {
        const res = await fetch(`${API_URL}?ruta=/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nombre, email, password, rol })
        });
        const data = await res.json();
        if (data.status === 'success') {
            datosUsuarioM = { nombre, email, rol, estado: 'prueba' };
            localStorage.setItem('usuario_mobile', JSON.stringify(datosUsuarioM));
            mostrarDashboardMobile();
        } else {
            msg.style.color = '#e53e3e';
            msg.textContent = '❌ ' + (data.message || 'Error al registrar');
        }
    } catch(err) {
        msg.style.color = '#e53e3e';
        msg.textContent = '❌ Error de comunicación con la API';
    }
}

function cerrarSesionMobile() {
    localStorage.removeItem('usuario_mobile');
    sessionStorage.removeItem('usuario_mobile');
    datosUsuarioM = null;
    mostrarAuthMobile();
}

function mostrarAuthMobile() {
    document.getElementById('vistaAuthMobile').classList.add('activa');
    document.getElementById('vistaDashboardMobile').classList.remove('activa');
}

function mostrarDashboardMobile() {
    document.getElementById('vistaAuthMobile').classList.remove('activa');
    document.getElementById('vistaDashboardMobile').classList.add('activa');
    document.getElementById('badgeRolUsuarioM').textContent = datosUsuarioM?.rol || 'Agro';
    
    // 🛰️ Detección automática de ubicación por GPS al iniciar el dashboard
    iniciarUbicacionAutomaticaMobile();
}

function iniciarUbicacionAutomaticaMobile() {
    if (navigator.geolocation) {
        lanzarToastMobile("🛰️ Detectando ubicación en tiempo real...");
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const lat = pos.coords.latitude.toFixed(4);
                const lon = pos.coords.longitude.toFixed(4);
                consultarClimaPorCoordenadasMobile(lat, lon);
            },
            () => {
                // Si el permiso es rechazado o no hay GPS, carga la ciudad predeterminada
                consultarClimaCompletoMobile(ciudadActualM);
            },
            { enableHighAccuracy: true, timeout: 7000 }
        );
    } else {
        consultarClimaCompletoMobile(ciudadActualM);
    }
}

// 3. CONSULTA CLIMÁTICA Y REGLAMENTACIÓN MOBILE
async function consultarClimaPorCoordenadasMobile(lat, lon) {
    lanzarToastMobile("⏳ Sincronizando telemetría GPS...");
    try {
        const resAct = await fetch(`${API_URL}?ruta=/clima/actual&lat=${lat}&lon=${lon}`);
        const dataAct = await resAct.json();
        if (dataAct.status === 'success' || dataAct.data) {
            const clima = dataAct.data;
            ciudadActualM = clima.ubicacion || `${lat}, ${lon}`;
            document.getElementById('inputCiudadM').value = ciudadActualM;
            aplicarDatosClimaActualMobile(clima);
        }

        const resPron = await fetch(`${API_URL}?ruta=/clima/pronostico&lat=${lat}&lon=${lon}`);
        const dataPron = await resPron.json();
        if (dataPron.ok !== false && Array.isArray(dataPron.data)) {
            renderizarPronosticoMobile(dataPron.data);
        }
    } catch(e) {
        consultarClimaCompletoMobile(ciudadActualM);
    }
}

async function consultarClimaCompletoMobile(ciudad) {
    ciudadActualM = ciudad;
    document.getElementById('inputCiudadM').value = ciudad;
    lanzarToastMobile("⏳ Sincronizando telemetría...");

    try {
        // Clima Actual
        const resAct = await fetch(`${API_URL}?ruta=/clima/actual&ciudad=${encodeURIComponent(ciudad)}`);
        const dataAct = await resAct.json();
        if (dataAct.status === 'success' || dataAct.data) {
            aplicarDatosClimaActualMobile(dataAct.data);
        }

        // Pronóstico
        const resPron = await fetch(`${API_URL}?ruta=/clima/pronostico&ciudad=${encodeURIComponent(ciudad)}`);
        const dataPron = await resPron.json();
        if (dataPron.ok !== false && Array.isArray(dataPron.data)) {
            renderizarPronosticoMobile(dataPron.data);
        }
    } catch(err) {
        lanzarToastMobile("⚠️ Conexión en espera...");
    }
}

function aplicarDatosClimaActualMobile(clima) {
    document.getElementById('ciudadLabelM').textContent = `📍 ${clima.ubicacion || ciudadActualM}`;
    document.getElementById('tempPrincipalM').textContent = `${Math.round(clima.temperatura)}°C`;
    document.getElementById('descClimaM').textContent = clima.descripcion;
    document.getElementById('humedadM').textContent = `${clima.humedad}%`;
    
    const vKmh = clima.viento_kmh || Math.round(clima.viento * 3.6);
    document.getElementById('vientoM').textContent = `${vKmh} km/h`;
    
    const fuentes = clima.consenso ? clima.consenso.fuentes_consultadas : 3;
    document.getElementById('consensoPillM').textContent = `⚡ Consenso: ${fuentes} APIs en vivo`;

    evaluarMarcoLegalMobile(vKmh, clima.ubicacion || ciudadActualM);
}

function evaluarMarcoLegalMobile(vKmh, ciudad) {
    const locMin = ciudad.toLowerCase();
    const esER = locMin.includes("entre ríos") || locMin.includes("entre rios");
    const esArg = locMin.includes("ar") || locMin.includes("argentina");
    const rol = datosUsuarioM?.rol || 'agricultor';

    const tit = document.getElementById('tituloLegalM');
    const cont = document.getElementById('contenidoLegalM');

    if (rol === 'planificador') {
        tit.innerText = "⛺ Seguridad de Montajes y Carpas";
        cont.innerHTML = vKmh > 18 
            ? "<b style='color:#e53e3e;'>🚫 RÁFAGAS ALARMANTES (>18 km/h).</b> Suspender montajes verticales y asegurar gazebos." 
            : "<b style='color:#27ae60;'>✅ VIENTO CONTROLADO.</b> Estructuras y sonido al aire libre seguros.";
    } else {
        if (esER) {
            tit.innerText = "⚖️ Ley Provincial Nº 6.599 (Entre Ríos)";
            cont.innerHTML = (vKmh >= 7 && vKmh <= 15)
                ? "<b style='color:#27ae60;'>✅ PULVERIZACIÓN HABILITADA.</b> Dentro del umbral provincial de 7 a 15 km/h."
                : "<b style='color:#e53e3e;'>🚫 PULVERIZACIÓN SUSPENDIDA.</b> Fuera de la banda legal entrerriana por riesgo de deriva o inversión.";
        } else if (esArg) {
            tit.innerText = "🌾 Estándar Nacional INTA / Red BPA";
            if (vKmh >= 5 && vKmh <= 12) {
                cont.innerHTML = "<b style='color:#27ae60;'>✅ CONDICIONES ÓPTIMAS (5 a 12 km/h).</b> Aplicación recomendada.";
            } else if (vKmh < 5) {
                cont.innerHTML = "<b style='color:#dd6b20;'>⚠️ RIESGO DE INVERSIÓN TÉRMICA (<5 km/h).</b> Gotas en suspensión.";
            } else {
                cont.innerHTML = "<b style='color:#e53e3e;'>🚫 RIESGO DE DERIVA (>12 km/h).</b> Suspender labor fitosanitaria.";
            }
        } else {
            tit.innerText = "🌐 Lineamientos Internacionales FAO";
            cont.innerHTML = vKmh <= 15
                ? "<b style='color:#27ae60;'>✅ CONDICIÓN FAVORABLE (<15 km/h).</b>"
                : "<b style='color:#e53e3e;'>🚫 VIENTO EXCESIVO.</b>";
        }
    }

    // Actualizar Recomendación de Labor
    const titMod = document.getElementById('tituloModuloM');
    const contMod = document.getElementById('contenidoModuloM');
    if (rol === 'planificador') {
        titMod.innerText = "🎪 Logística AuraEvents";
        contMod.innerHTML = "• Punto de Rocío: Proteger consolas y cableados por humedad nocturna.<br>• Hora Dorada: Ventana lumínica ideal a las 17:15 hs.";
    } else {
        titMod.innerText = "🌱 Calendario de Siembra";
        const mes = new Date().getMonth();
        if (mes >= 8 && mes <= 11) {
            contMod.innerHTML = "<b>Campaña Gruesa:</b> Óptimo para <b>Maíz Temprano</b> y preparación para <b>Soja de 1ª</b>. Buena humedad en cama de siembra.";
        } else if (mes >= 4 && mes <= 7) {
            contMod.innerHTML = "<b>Campaña Fina:</b> Ventana para <b>Trigo Pan</b> y legumbres de cobertura (<b>Arveja / Vicia</b>).";
        } else {
            contMod.innerHTML = "<b>Cierre Estival:</b> Monitoreo de llenado en sojas de segunda y planificación de verdeos invernales.";
        }
    }
}

function renderizarPronosticoMobile(lista) {
    const contenedor = document.getElementById('carruselPronosticoM');
    contenedor.innerHTML = '';
    
    let dias = {};
    lista.forEach(i => {
        // Agrupación por día local único
        const dLocal = new Date(i.dt * 1000);
        const claveDia = `${dLocal.getFullYear()}-${dLocal.getMonth() + 1}-${dLocal.getDate()}`;
        if (!dias[claveDia]) dias[claveDia] = i;
    });

    Object.keys(dias).slice(0, 5).forEach(f => {
        const item = dias[f];
        const dateObj = new Date(item.dt * 1000);
        const diaNom = dateObj.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric' });
        
        contenedor.innerHTML += `
            <div class="dia-chip-m">
                <b>${diaNom}</b>
                <div class="temp-chip">${Math.round(item.main.temp)}°</div>
                <div class="desc-chip">${item.weather[0].description}</div>
                <small style="color:#4a5568;">💨 ${Math.round(item.wind.speed * 3.6)} km/h</small>
            </div>
        `;
    });
}

// 4. BÚSQUEDA Y FAVORITOS MOBILE
function buscarClimaMobile() {
    const txt = document.getElementById('inputCiudadM').value.trim();
    if (txt) {
        consultarClimaCompletoMobile(txt);
    }
}

function activarGpsMobile() {
    if (navigator.geolocation) {
        lanzarToastMobile("🛰️ Obteniendo satélites GPS...");
        navigator.geolocation.getCurrentPosition(pos => {
            const lat = pos.coords.latitude.toFixed(4);
            const lon = pos.coords.longitude.toFixed(4);
            consultarClimaPorCoordenadasMobile(lat, lon);
        }, () => {
            lanzarToastMobile("⚠️ GPS no disponible");
        }, { enableHighAccuracy: true });
    }
}

function guardarFavoritoMobile() {
    let favs = JSON.parse(localStorage.getItem('favs_m') || '[]');
    if (!favs.includes(ciudadActualM)) {
        favs.push(ciudadActualM);
        localStorage.setItem('favs_m', JSON.stringify(favs));
        lanzarToastMobile("⭐ Guardado en Favoritos");
        renderizarPillsFavoritos();
    } else {
        favs = favs.filter(c => c !== ciudadActualM);
        localStorage.setItem('favs_m', JSON.stringify(favs));
        lanzarToastMobile("Marcador removido");
        renderizarPillsFavoritos();
    }
}

function renderizarPillsFavoritos() {
    const cont = document.getElementById('contenedorPillsFavsM');
    if (!cont) return;
    const favs = JSON.parse(localStorage.getItem('favs_m') || '[]');
    cont.innerHTML = '';
    favs.forEach(c => {
        const nombreCorto = c.split(',')[0];
        cont.innerHTML += `<button class="pill-fav-m" onclick="consultarClimaCompletoMobile('${c}')">📍 ${nombreCorto}</button>`;
    });
}

function lanzarToastMobile(msg) {
    const t = document.getElementById('toastApp');
    if (!t) return;
    t.innerText = msg;
    t.style.display = 'block';
    setTimeout(() => { t.style.display = 'none'; }, 3000);
}