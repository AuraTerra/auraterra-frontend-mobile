// Detección automática del host real
const hostActual = window.location.hostname;
const API_URL = (hostActual === 'localhost' || hostActual === '127.0.0.1' || hostActual.startsWith('192.168.'))
    ? `http://${hostActual}/auraterra-backend-api/index.php`
    : '/api/index.php';

let ciudadActualM = "Crespo, Entre Ríos, AR";
let datosUsuarioM = null;
let codigoOtpM = null;
let intentosOtpM = 0;
let recordarSesionM = true;
let pronosticoCompletoMemoria = [];
let ultimaAlertaEnviada = null;

// ⏱️ GESTIÓN DE TIMEOUT POR INACTIVIDAD (30 MINUTOS)
const TIEMPO_LIMITE_INACTIVIDAD = 30 * 60 * 1000;
let timerInactividad = null;

function reiniciarTemporizadorInactividad() {
    if (timerInactividad) clearTimeout(timerInactividad);
    timerInactividad = setTimeout(() => {
        if (datosUsuarioM) {
            alert("🔒 Sesión finalizada automáticamente por 30 minutos de inactividad.");
            cerrarSesionMobile();
        }
    }, TIEMPO_LIMITE_INACTIVIDAD);
}

['click', 'touchstart', 'mousemove', 'keydown', 'scroll'].forEach(evt => {
    window.addEventListener(evt, reiniciarTemporizadorInactividad, { passive: true });
});

// 🌓 MODO DÍA / NOCHE AUTOMÁTICO
function aplicarTemaSegunHora() {
    const hora = new Date().getHours();
    const body = document.body;
    const indicador = document.getElementById('indicadorModoDiaNoche');
    const esDeNoche = (hora >= 20 || hora < 6.5);

    if (esDeNoche) {
        body.classList.add('modo-noche');
        if (indicador) indicador.textContent = '🌙';
    } else {
        body.classList.remove('modo-noche');
        if (indicador) indicador.textContent = '☀️';
    }
}

// NORMALIZADOR DE GEOLOCALIZACIÓN
function normalizarUbicacionArgentinaMobile(rawUbicacion, lat, lon) {
    if (!rawUbicacion) return "Crespo, Entre Ríos, AR";
    const loc = rawUbicacion.toLowerCase().trim();

    if (loc.includes("crespo") || (lat && lat <= -32.0 && lat >= -32.1 && lon >= -60.4 && lon <= -60.2)) return "Crespo, Entre Ríos, AR";
    if (loc.includes("paraná") || loc.includes("parana")) return "Paraná, Entre Ríos, AR";
    if (loc.includes("concordia")) return "Concordia, Entre Ríos, AR";
    if (loc.includes("gualeguaychú") || loc.includes("gualeguaychu")) return "Gualeguaychú, Entre Ríos, AR";
    if (loc.includes("diamante")) return "Diamante, Entre Ríos, AR";
    if (loc.includes("victoria")) return "Victoria, Entre Ríos, AR";
    if (loc.includes("villaguay")) return "Villaguay, Entre Ríos, AR";
    if (loc.includes("chajarí") || loc.includes("chajari")) return "Chajarí, Entre Ríos, AR";
    if (loc.includes("nogoyá") || loc.includes("nogoya")) return "Nogoyá, Entre Ríos, AR";
    if (loc.includes("la paz")) return "La Paz, Entre Ríos, AR";
    if (loc.includes("colón") || loc.includes("colon")) return "Colón, Entre Ríos, AR";
    if (loc.includes("federal")) return "Federal, Entre Ríos, AR";
    if (loc.includes("viale")) return "Viale, Entre Ríos, AR";
    if (loc.includes("seguí") || loc.includes("segui")) return "Seguí, Entre Ríos, AR";

    const partes = rawUbicacion.split(',').map(p => p.trim());
    if (partes.length === 3) return rawUbicacion;

    if (loc.includes("rosario")) return "Rosario, Santa Fe, AR";
    if (loc.includes("santa fe")) return "Santa Fe, Santa Fe, AR";
    if (loc.includes("córdoba") || loc.includes("cordoba")) return "Córdoba, Córdoba, AR";
    if (loc.includes("buenos aires")) return "Buenos Aires, CABA, AR";
    if (loc.includes("mendoza")) return "Mendoza, Mendoza, AR";

    return `${rawUbicacion}, Argentina, AR`;
}

// VALIDACIÓN DE FORMATO ESTRICTO (Ciudad, Provincia, País)
function validarFormatoUbicacionMobile(texto) {
    if (!texto) return false;
    const partes = texto.split(',').map(p => p.trim()).filter(p => p.length > 0);
    return partes.length === 3;
}

function abrirModalFormatoInvalidoM() {
    const m = document.getElementById('modalFormatoInvalidoM');
    if (m) m.classList.add('activa');
}

function cerrarModalFormatoInvalidoM() {
    const m = document.getElementById('modalFormatoInvalidoM');
    if (m) m.classList.remove('activa');
}

// 🧭 CÁLCULO DE DIRECCIÓN DE VIENTO CARDINAL Y PREDOMINANTE
function convertirGradosACardinal(grados) {
    if (grados === undefined || grados === null || grados === "" || isNaN(Number(grados))) return null;
    const g = Number(grados);
    const sectores = [
        "N ⬆️", "NNE ↗️", "NE ↗️", "ENE ↗️",
        "E ➡️", "ESE ↘️", "SE ↘️", "SSE ↘️",
        "S ⬇️", "SSO ↙️", "SO ↙️", "OSO ↙️",
        "O ⬅️", "ONO ↖️", "NO ↖️", "NNO ↖️"
    ];
    const val = Math.round((((g % 360) + 360) % 360) / 22.5) % 16;
    return sectores[val];
}

function extraerGradosDeObjeto(obj) {
    if (!obj) return null;
    if (obj.viento_grados !== undefined && obj.viento_grados !== null) return obj.viento_grados;
    if (obj.viento_deg !== undefined && obj.viento_deg !== null) return obj.viento_deg;
    if (obj.viento_direccion !== undefined && !isNaN(Number(obj.viento_direccion))) return obj.viento_direccion;
    if (obj.wind && obj.wind.deg !== undefined && obj.wind.deg !== null) return obj.wind.deg;
    if (obj.consenso?.detalles_api?.openweathermap?.viento_grados !== undefined) return obj.consenso.detalles_api.openweathermap.viento_grados;
    if (obj.consenso?.detalles_api?.tomorrow?.wind_direction !== undefined) return obj.consenso.detalles_api.tomorrow.wind_direction;
    return null;
}

function calcularDireccionPredominante(listaPronostico) {
    if (!listaPronostico || !Array.isArray(listaPronostico) || listaPronostico.length === 0) {
        return "SSE ↘️";
    }

    const muestras24h = listaPronostico.slice(0, 8);
    let conteo = {};

    muestras24h.forEach(m => {
        const deg = extraerGradosDeObjeto(m);
        const card = convertirGradosACardinal(deg);
        if (card) conteo[card] = (conteo[card] || 0) + 1;
    });

    let predominante = null;
    let maxOcurrencias = 0;
    for (const [dir, cant] of Object.entries(conteo)) {
        if (cant > maxOcurrencias) {
            maxOcurrencias = cant;
            predominante = dir;
        }
    }

    return predominante ? predominante : "SSE ↘️";
}

// 🔔 SERVICE WORKER
async function registrarServiceWorker() {
    if ('serviceWorker' in navigator) {
        try {
            await navigator.serviceWorker.register('./sw.js');
        } catch (e) {}
    }
}

// 1. INICIALIZACIÓN Y CONTROL ESTRICTO DE ACCESO
window.addEventListener('DOMContentLoaded', () => {
    aplicarTemaSegunHora();
    reiniciarTemporizadorInactividad();
    registrarServiceWorker();

    const sesion = localStorage.getItem('usuario_mobile') || sessionStorage.getItem('usuario_mobile');
    if (sesion) {
        try {
            datosUsuarioM = JSON.parse(sesion);
            if (datosUsuarioM.estado === 'suspendido') {
                cerrarSesionMobile();
                return;
            }
            mostrarDashboardMobile();
        } catch(e) {
            mostrarAuthMobile();
        }
    } else {
        // Bloqueo estricto: sin sesión va directo al Login
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

// 2. LOGIN Y 2FA
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

        if (res.status === 403 || data.status === 'suspended') {
            msg.style.color = '#e53e3e';
            msg.innerHTML = '🚫 Cuenta suspendida: Período de prueba finalizado.<br><a href="mailto:auraterraclima@hotmail.com?subject=Reactivacion%20AuraTerra" style="color:#c53030; font-weight:bold;">Contactar auraterraclima@hotmail.com</a>';
            return;
        }

        if (data.status === 'success' && data.user) {
            msg.textContent = '';
            datosUsuarioM = data.user;
            intentosOtpM = 0;
            
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
        msg.textContent = '❌ Error de comunicación con la API';
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
        reiniciarTemporizadorInactividad();
        mostrarDashboardMobile();
    } else {
        intentosOtpM++;
        if (intentosOtpM >= 3) {
            alert("🚫 Superaste los 3 intentos permitidos.");
            window.location.reload();
        } else {
            err.style.display = 'block';
            err.textContent = `Código incorrecto. Quedan ${3 - intentosOtpM} intento(s).`;
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
    msg.textContent = 'Creando cuenta...';

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
            reiniciarTemporizadorInactividad();
            mostrarDashboardMobile();
        } else {
            msg.style.color = '#e53e3e';
            msg.textContent = '❌ ' + (data.message || 'Error al registrar');
        }
    } catch(err) {
        msg.style.color = '#e53e3e';
        msg.textContent = '❌ Error de conexión al registrar';
    }
}

function cerrarSesionMobile(e) {
    if (e) e.preventDefault();
    localStorage.removeItem('usuario_mobile');
    localStorage.removeItem('usuario');
    sessionStorage.removeItem('usuario_mobile');
    sessionStorage.removeItem('usuario');
    datosUsuarioM = null;
    mostrarAuthMobile();
}

function mostrarAuthMobile() {
    document.getElementById('vistaAuthMobile').classList.add('activa');
    document.getElementById('vistaDashboardMobile').classList.remove('activa');
}

function mostrarDashboardMobile() {
    // Si no hay datos de usuario, rebota a Auth inmediatamente
    if (!datosUsuarioM) {
        mostrarAuthMobile();
        return;
    }

    document.getElementById('vistaAuthMobile').classList.remove('activa');
    document.getElementById('vistaDashboardMobile').classList.add('activa');
    
    const rol = datosUsuarioM?.rol || 'agricultor';
    document.getElementById('badgeRolUsuarioM').textContent = rol === 'admin' ? 'Admin ⚙️' : (rol === 'planificador' ? 'Events 🎪' : 'Agro 🌾');
    
    const lblNom = document.getElementById('lblNombreUsuarioMenuM');
    if (lblNom) lblNom.textContent = datosUsuarioM?.nombre || 'Usuario';

    const linkAdmin = document.getElementById('linkAdminConsoleM');
    if (linkAdmin) linkAdmin.style.display = (rol === 'admin') ? 'block' : 'none';

    iniciarUbicacionAutomaticaMobile();
}

function toggleMenuUsuarioMobile() {
    const dm = document.getElementById('dropdownMenuMobile');
    if (dm) dm.style.display = (dm.style.display === 'block') ? 'none' : 'block';
}

// 3. CONSULTAS CLIMÁTICAS
function iniciarUbicacionAutomaticaMobile() {
    if (navigator.geolocation) {
        lanzarToastMobile("🛰️ Obteniendo ubicación GPS...");
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const lat = pos.coords.latitude.toFixed(4);
                const lon = pos.coords.longitude.toFixed(4);
                consultarClimaPorCoordenadasMobile(lat, lon);
            },
            () => {
                consultarClimaCompletoMobile(ciudadActualM);
            },
            { enableHighAccuracy: true, timeout: 8000 }
        );
    } else {
        consultarClimaCompletoMobile(ciudadActualM);
    }
}

async function consultarClimaPorCoordenadasMobile(lat, lon) {
    lanzarToastMobile("⏳ Sincronizando telemetría...");
    try {
        const resAct = await fetch(`${API_URL}?ruta=/clima/actual&lat=${lat}&lon=${lon}`);
        const dataAct = await resAct.json();
        if (dataAct.status === 'success' || dataAct.data) {
            const clima = dataAct.data;
            ciudadActualM = normalizarUbicacionArgentinaMobile(clima.ubicacion, Number(lat), Number(lon));
            clima.ubicacion = ciudadActualM;
            document.getElementById('inputCiudadM').value = ciudadActualM;
            aplicarDatosClimaActualMobile(clima);
        }

        const resPron = await fetch(`${API_URL}?ruta=/clima/pronostico&lat=${lat}&lon=${lon}`);
        const dataPron = await resPron.json();
        if (dataPron.ok !== false && Array.isArray(dataPron.data)) {
            pronosticoCompletoMemoria = dataPron.data;
            renderizarPronosticoMobile(dataPron.data);
            
            const elemDir = document.getElementById('direccionVientoM');
            if (elemDir && (elemDir.textContent.includes('--') || elemDir.textContent.includes('Calma'))) {
                elemDir.textContent = calcularDireccionPredominante(dataPron.data);
            }
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
        const resAct = await fetch(`${API_URL}?ruta=/clima/actual&ciudad=${encodeURIComponent(ciudad)}`);
        const dataAct = await resAct.json();
        if (dataAct.status === 'success' || dataAct.data) {
            aplicarDatosClimaActualMobile(dataAct.data);
        }

        const resPron = await fetch(`${API_URL}?ruta=/clima/pronostico&ciudad=${encodeURIComponent(ciudad)}`);
        const dataPron = await resPron.json();
        if (dataPron.ok !== false && Array.isArray(dataPron.data)) {
            pronosticoCompletoMemoria = dataPron.data;
            renderizarPronosticoMobile(dataPron.data);

            const elemDir = document.getElementById('direccionVientoM');
            if (elemDir && (elemDir.textContent.includes('--') || elemDir.textContent.includes('Calma'))) {
                elemDir.textContent = calcularDireccionPredominante(dataPron.data);
            }
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
    
    const degDirecto = extraerGradosDeObjeto(clima);
    const cardDirecto = convertirGradosACardinal(degDirecto);
    
    const elemDir = document.getElementById('direccionVientoM');
    if (cardDirecto) {
        elemDir.textContent = cardDirecto;
    } else if (pronosticoCompletoMemoria.length > 0) {
        elemDir.textContent = calcularDireccionPredominante(pronosticoCompletoMemoria);
    } else {
        elemDir.textContent = (vKmh <= 3) ? "Calma / Leve" : "SSE ↘️";
    }

    const fuentes = clima.consenso ? clima.consenso.fuentes_consultadas : 3;
    document.getElementById('consensoPillM').textContent = `⚡ Consenso: ${fuentes} APIs`;

    evaluarMarcoLegalMobile(vKmh, clima.ubicacion || ciudadActualM);
    actualizarModuloTecnicoMobile(vKmh, clima);
}

function evaluarMarcoLegalMobile(vKmh, ciudad) {
    const locMin = ciudad.toLowerCase();
    const esER = locMin.includes("entre ríos") || locMin.includes("entre rios");
    const esArg = locMin.includes("ar") || locMin.includes("argentina");
    const rol = datosUsuarioM?.rol || 'agricultor';

    const card = document.getElementById('cardLegalMobile');
    const tit = document.getElementById('tituloLegalM');
    const cont = document.getElementById('contenidoLegalM');

    if (rol === 'planificador') {
        tit.innerText = "⛺ Seguridad de Montajes y Gazebos";
        if (vKmh > 18) {
            card.style.borderLeftColor = "#e53e3e";
            cont.innerHTML = "<b style='color:#e53e3e;'>🚫 RÁFAGAS ALARMANTES (>18 km/h).</b> Suspender montajes verticales, añadir lastres en carpas y replegar gazebos livianos.";
        } else {
            card.style.borderLeftColor = "#38a169";
            cont.innerHTML = "<b style='color:#27ae60;'>✅ VIENTO CONTROLADO.</b> Estructuras y sonido al aire libre seguros.";
        }
    } else {
        if (esER) {
            tit.innerText = "⚖️ Ley Provincial Nº 6.599 (Entre Ríos)";
            if (vKmh >= 7 && vKmh <= 15) {
                card.style.borderLeftColor = "#38a169";
                cont.innerHTML = "<b style='color:#27ae60;'>✅ PULVERIZACIÓN HABILITADA.</b> Dentro del umbral provincial legal de 7 a 15 km/h.";
            } else {
                card.style.borderLeftColor = "#e53e3e";
                cont.innerHTML = `<b style='color:#e53e3e;'>🚫 PULVERIZACIÓN SUSPENDIDA.</b> Fuera del rango de 7 a 15 km/h por riesgo de ${vKmh < 7 ? "inversión térmica" : "deriva química"}.`;
            }
        } else if (esArg) {
            tit.innerText = "🌾 Estándar Nacional INTA / BPA";
            if (vKmh >= 5 && vKmh <= 12) {
                card.style.borderLeftColor = "#38a169";
                cont.innerHTML = "<b style='color:#27ae60;'>✅ CONDICIONES ÓPTIMAS (5 a 12 km/h).</b> Aplicación recomendada.";
            } else {
                card.style.borderLeftColor = "#dd6b20";
                cont.innerHTML = "<b style='color:#dd6b20;'>⚠️ APLICACIÓN NO RECOMENDADA.</b> Fuera de la ventana óptima.";
            }
        } else {
            tit.innerText = "🌐 Lineamientos Internacionales FAO";
            cont.innerHTML = vKmh <= 15 ? "<b style='color:#27ae60;'>✅ CONDICIÓN FAVORABLE (<15 km/h).</b>" : "<b style='color:#e53e3e;'>🚫 VIENTO EXCESIVO.</b>";
        }
    }
}

// 8. INFORMACIÓN TÉCNICA DETALLADA (AGRO Y EVENTOS)
function actualizarModuloTecnicoMobile(vKmh, clima) {
    const rol = datosUsuarioM?.rol || 'agricultor';
    const tit = document.getElementById('tituloModuloM');
    const cont = document.getElementById('contenidoModuloM');
    const mes = new Date().getMonth();
    const temp = Math.round(clima.temperatura);
    const hum = clima.humedad;

    if (rol === 'planificador') {
        tit.innerText = "🎪 Inteligencia Logística — AuraEvents";
        
        let alertaRocio = (hum >= 80)
            ? `<div style="background:#fffaf0; border-left:3px solid #dd6b20; padding:10px; border-radius:8px; margin-bottom:8px;">
                 <b style="color:#c05621;">💧 Alerta de Rocío y Condensación (${hum}% Humedad):</b><br>
                 <span style="font-size:0.9rem;">Hacia la noche la temperatura caerá al punto de rocío. Cubrir consolas digitales de sonido con lonas térmicas y elevar cableados del césped para prevenir fugas de corriente.</span>
               </div>`
            : `<div style="background:#f7fafc; border-left:3px solid #3182ce; padding:10px; border-radius:8px; margin-bottom:8px;">
                 <b style="color:#2b6cb0;">💧 Humedad Estable (${hum}%):</b> Bajo riesgo de condensación en equipos.
               </div>`;

        cont.innerHTML = `
            ${alertaRocio}
            <div style="background:#f8fafc; padding:10px; border-radius:8px; margin-bottom:8px;">
                <b>🌅 Ventanas de Luz Natural:</b><br>
                • <b>Hora Dorada:</b> 17:40 a 18:25 hs (Luz suave para fotos principales).<br>
                • <b>Hora Azul:</b> 18:25 a 18:45 hs (Encendido de luces perimetrales y velas).
            </div>
            <div style="background:#f8fafc; padding:10px; border-radius:8px;">
                <b>🌡️ Confort del Invitado:</b> Actual de <b>${temp}°C</b>. Prever calefactores si desciende de 16°C o reforzar hidratación si supera los 28°C.
            </div>
        `;
    } else {
        tit.innerText = "🌱 Siembra y Decisiones Críticas — Agro";

        let queSembrar = "";
        let queNoSembrar = "";
        let suelo = "";
        let desvelo = "";

        if (mes >= 8 && mes <= 11) { // Primavera
            suelo = "14°C a 18°C a 5 cm de profundidad.";
            queSembrar = "• <b>Maíz Temprano:</b> Ventana óptima (>12°C continuos en suelo).<br>• <b>Soja de 1ª:</b> Iniciar lotes al superar 15°C estables a las 8 AM.<br>• <b>Girasol:</b> Óptimo en lotes con buen drenaje.";
            queNoSembrar = "• <b>TRIGO / CEBADA:</b> Prohibido sembrar. Fuera de época absoluta por golpe de calor en llenado.<br>• <b>Vicia / Arveja:</b> Ventana de implantación cerrada.";
            desvelo = "<b>Riesgo de heladas tardías:</b> En bajos durante octubre. Si la mínima proyectada es <4°C en superficie, frenar tolvas de soja para evitar pérdida de cotiledones.";
        } else if (mes >= 4 && mes <= 7) { // Otoño-Invierno
            suelo = "8°C a 12°C a 5 cm de profundidad.";
            queSembrar = "• <b>Trigo Pan (Ciclos Medios/Largos):</b> Época pico.<br>• <b>Cebada:</b> En lotes con buena fertilidad inicial de fósforo.<br>• <b>Cultivos de Servicio:</b> Vicia villosa, Centeno y Avena.";
            queNoSembrar = "• <b>MAÍZ Y SOJA:</b> Prohibido sembrar. El suelo frío (<10°C) pudre la semilla sin germinar.";
            desvelo = "<b>Enfermedades foliares:</b> Monitorear Mancha Amarilla y Roya en trigo si la humedad foliar supera 8 horas diarias.";
        } else { // Verano
            suelo = ">22°C (riesgo de desecación superficial).";
            queSembrar = "• <b>Soja de 2ª:</b> Inmediatamente tras cosecha de trigo.<br>• <b>Maíz Tardío:</b> Ubicar floración fuera de la canícula de enero.";
            queNoSembrar = "• <b>CEREALES DE INVIERNO:</b> Prohibido terminantemente.";
            desvelo = "<b>Estrés hídrico:</b> Con >35°C y vientos del norte, el aborto floral es crítico. Monitorear Spodoptera y chinches.";
        }

        cont.innerHTML = `
            <div style="background:#f0fff4; border-left:3px solid #38a169; padding:10px; border-radius:8px; margin-bottom:8px;">
                <b style="color:#22543d;">🌾 Qué sembrar hoy con éxito:</b><br>
                <div style="margin-top:4px; font-size:0.92rem; color:#2d3748;">${queSembrar}</div>
            </div>
            <div style="background:#fff5f5; border-left:3px solid #e53e3e; padding:10px; border-radius:8px; margin-bottom:8px;">
                <b style="color:#c53030;">🚫 Lo que NO sembrar ahora:</b><br>
                <div style="margin-top:4px; font-size:0.92rem; color:#2d3748;">${queNoSembrar}</div>
            </div>
            <div style="background:#f8fafc; padding:10px; border-radius:8px; font-size:0.9rem; color:#4a5568;">
                <b>🌡️ Suelo:</b> ${suelo}<br>
                <b>🚜 El desvelo del productor:</b> ${desvelo}
            </div>
        `;
    }
}

// 9. PRONÓSTICO 5 DÍAS CON HORARIOS
function renderizarPronosticoMobile(lista) {
    const contenedor = document.getElementById('carruselPronosticoM');
    contenedor.innerHTML = '';
    
    let diasMap = {};
    lista.forEach(item => {
        const dLocal = new Date(item.dt * 1000);
        const claveDia = `${dLocal.getFullYear()}-${String(dLocal.getMonth() + 1).padStart(2, '0')}-${String(dLocal.getDate()).padStart(2, '0')}`;
        if (!diasMap[claveDia]) diasMap[claveDia] = [];
        diasMap[claveDia].push(item);
    });

    Object.keys(diasMap).slice(0, 5).forEach(fechaClave => {
        const itemsDelDia = diasMap[fechaClave];
        let max = -999;
        let min = 999;
        itemsDelDia.forEach(i => {
            if (i.main.temp_max > max) max = i.main.temp_max;
            if (i.main.temp_min < min) min = i.main.temp_min;
        });

        const rep = itemsDelDia.find(i => i.dt_txt && i.dt_txt.includes("12:00:00")) || itemsDelDia[0];
        const dateObj = new Date(rep.dt * 1000);
        const diaNom = dateObj.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric' });
        const dir = convertirGradosACardinal(extraerGradosDeObjeto(rep)) || "SE ↘️";

        contenedor.innerHTML += `
            <div class="dia-chip-m" onclick="abrirDetalleHorasMobile('${fechaClave}', '${diaNom}')">
                <b style="font-size:1.05rem;">${diaNom}</b>
                <div style="font-size:1.8rem; font-weight:800; margin:6px 0;">${Math.round(rep.main.temp)}°</div>
                <div class="temp-extremos">
                    <span class="max">↑ ${Math.round(max)}°</span> / <span class="min">↓ ${Math.round(min)}°</span>
                </div>
                <div style="font-size:0.85rem; text-transform:capitalize; margin:4px 0;">${rep.weather[0].description}</div>
                <small style="color:var(--text-muted);">💨 ${Math.round(rep.wind.speed * 3.6)} km/h (${dir})</small>
                <div style="font-size:0.8rem; color:#3182ce; font-weight:bold; margin-top:6px;">Ver horas ➔</div>
            </div>
        `;
    });
}

function abrirDetalleHorasMobile(fechaClave, diaNom) {
    const modal = document.getElementById('modalHorasMobile');
    const titulo = document.getElementById('tituloModalHorasM');
    const contenedor = document.getElementById('listaHorariosDiaContenedor');
    
    titulo.innerHTML = `🕒 Horas: <b>${diaNom}</b>`;
    contenedor.innerHTML = '';

    const itemsDelDia = pronosticoCompletoMemoria.filter(item => {
        const dLocal = new Date(item.dt * 1000);
        const f = `${dLocal.getFullYear()}-${String(dLocal.getMonth() + 1).padStart(2, '0')}-${String(dLocal.getDate()).padStart(2, '0')}`;
        return f === fechaClave;
    });

    if (itemsDelDia.length === 0) {
        contenedor.innerHTML = '<p style="color:var(--text-muted); text-align:center;">Sin datos detallados.</p>';
    } else {
        itemsDelDia.forEach(h => {
            const dateObj = new Date(h.dt * 1000);
            const hora = dateObj.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
            const dir = convertirGradosACardinal(extraerGradosDeObjeto(h)) || "SE ↘️";

            contenedor.innerHTML += `
                <div class="item-horario-row">
                    <span style="font-weight:bold; color:#3182ce;">${hora} hs</span>
                    <span style="font-weight:700;">${Math.round(h.main.temp)}°C</span>
                    <span style="text-transform:capitalize; font-size:0.9rem;">${h.weather[0].description}</span>
                    <span style="font-size:0.85rem; color:var(--text-muted);">💨 ${Math.round(h.wind.speed * 3.6)} km/h (${dir})</span>
                </div>
            `;
        });
    }

    modal.classList.add('activa');
}

function cerrarModalHorasMobile() {
    document.getElementById('modalHorasMobile').classList.remove('activa');
}

// 10. MODALES INSTITUCIONALES Y ADMIN CON CAMBIO DE ESTADOS
function abrirModalInfoCorporativoMobile() {
    document.getElementById('modalInfoCorporativoM').classList.add('activa');
}

function cerrarModalInfoCorporativoMobile() {
    document.getElementById('modalInfoCorporativoM').classList.remove('activa');
}

async function abrirModalAdminMobile(e) {
    if (e) e.preventDefault();
    const dm = document.getElementById('dropdownMenuMobile');
    if (dm) dm.style.display = 'none';

    const modal = document.getElementById('modalAdminMobile');
    modal.classList.add('activa');

    const listaUsr = document.getElementById('listaUsuariosAdminM');
    const boxRank = document.getElementById('rankingConsultasBoxM');
    const boxEventos = document.getElementById('ultimosEventosBoxM');

    listaUsr.innerHTML = 'Cargando usuarios...';
    boxRank.innerHTML = 'Cargando ranking...';
    if (boxEventos) boxEventos.innerHTML = 'Cargando últimos eventos...';

    try {
        const res = await fetch(`${API_URL}?ruta=/admin/telemetria`);
        const data = await res.json();

        if (data.status === 'ok') {
            if (data.usuarios && data.usuarios.length > 0) {
                listaUsr.innerHTML = '';
                data.usuarios.forEach(u => {
                    let color = u.estado === 'activo' ? '#27ae60' : (u.estado === 'prueba' ? '#dd6b20' : '#e53e3e');
                    let diasInfo = (u.estado === 'prueba') ? `(⏳ ${u.dias_restantes}d)` : '';

                    listaUsr.innerHTML += `
                        <div style="padding:10px 4px; border-bottom:1px solid var(--border-card); display:flex; justify-content:space-between; align-items:center; gap:8px;">
                            <div>
                                <b style="font-size:0.95rem; color:var(--text-main);">${u.nombre}</b><br>
                                <span style="color:${color}; font-weight:800; font-size:0.8rem;">${u.estado.toUpperCase()}</span> ${diasInfo} | <small style="color:var(--text-muted);">${u.rol}</small>
                            </div>
                            <div>
                                <select onchange="cambiarEstadoUsuarioDesdeMobile(${u.id}, this.value)" style="padding:6px 8px; border-radius:8px; border:1.5px solid var(--border-card); font-weight:700; font-size:0.85rem; background:var(--input-bg); color:var(--text-main); cursor:pointer;">
                                    <option value="" disabled selected>Cambiar...</option>
                                    <option value="activo" ${u.estado === 'activo' ? 'disabled' : ''}>🟢 Activar (Pagado)</option>
                                    <option value="prueba" ${u.estado === 'prueba' ? 'disabled' : ''}>🟠 Modo Prueba</option>
                                    <option value="suspendido" ${u.estado === 'suspendido' ? 'disabled' : ''}>🔴 Suspender</option>
                                </select>
                            </div>
                        </div>
                    `;
                });
            } else {
                listaUsr.innerHTML = '<p style="color:var(--text-muted);">Sin usuarios registrados.</p>';
            }

            if (data.ranking && data.ranking.length > 0) {
                let html = '<ol style="margin:0; padding-left:20px; line-height:1.6;">';
                data.ranking.forEach(r => {
                    html += `<li><b>${r.componente_clickeado}</b>: ${r.total} clics</li>`;
                });
                html += '</ol>';
                boxRank.innerHTML = html;
            } else {
                boxRank.innerHTML = '<p style="color:var(--text-muted);">Sin consultas registradas.</p>';
            }

            if (boxEventos) {
                if (data.ultimos && data.ultimos.length > 0) {
                    let htmlEventos = '<ul style="margin:0; padding-left:16px; line-height:1.6;">';
                    data.ultimos.forEach(e => {
                        let fechaTxt = e.fecha_hora ? e.fecha_hora.split(' ')[1] || e.fecha_hora : '';
                        htmlEventos += `<li style="margin-bottom:4px;">
                            <span style="color:var(--text-muted); font-size:0.8rem;">[${fechaTxt}]</span> 
                            <b>${e.usuario}</b>: ${e.componente_clickeado}
                        </li>`;
                    });
                    htmlEventos += '</ul>';
                    boxEventos.innerHTML = htmlEventos;
                } else {
                    boxEventos.innerHTML = '<p style="color:var(--text-muted);">Sin actividad registrada.</p>';
                }
            }
        }
    } catch(err) {
        listaUsr.innerHTML = '<p style="color:#e53e3e;">❌ Error al conectar con la telemetría.</p>';
    }
}

async function cambiarEstadoUsuarioDesdeMobile(userId, nuevoEstado) {
    if (!nuevoEstado) return;
    try {
        const formData = new URLSearchParams();
        formData.append('user_id', userId);
        formData.append('estado', nuevoEstado);

        const res = await fetch(`${API_URL}?ruta=/admin/cambiar_estado`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: formData.toString()
        });
        const d = await res.json();
        if (d.status === 'ok') {
            abrirModalAdminMobile();
            lanzarToastMobile(`✅ Estado actualizado a ${nuevoEstado.toUpperCase()}`);
        } else {
            alert("⚠️ " + (d.message || "No se pudo actualizar"));
        }
    } catch(e) {
        alert("❌ Error de red al intentar actualizar estado");
    }
}

function cerrarModalAdminMobile() {
    document.getElementById('modalAdminMobile').classList.remove('activa');
}

// 11. BÚSQUEDA Y FAVORITOS
function buscarClimaMobile() {
    const txt = document.getElementById('inputCiudadM').value.trim();
    if (!txt) return;

    if (!validarFormatoUbicacionMobile(txt)) {
        abrirModalFormatoInvalidoM();
        return;
    }

    consultarClimaCompletoMobile(txt);
}

function activarGpsMobile() {
    iniciarUbicacionAutomaticaMobile();
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
    const favs = JSON.parse(localStorage.getItem('favs_m') || '["Crespo, Entre Ríos, AR"]');
    cont.innerHTML = '';
    favs.forEach(c => {
        const nombreCorto = c.split(',')[0];
        cont.innerHTML += `<button style="background:var(--bg-card); color:var(--text-main); border:1px solid var(--border-card); padding:6px 12px; border-radius:14px; font-weight:700; white-space:nowrap;" onclick="consultarClimaCompletoMobile('${c}')">📍 ${nombreCorto}</button>`;
    });
}

function lanzarToastMobile(msg) {
    const t = document.getElementById('toastApp');
    if (!t) return;
    t.innerText = msg;
    t.style.display = 'block';
    setTimeout(() => { t.style.display = 'none'; }, 3500);
}