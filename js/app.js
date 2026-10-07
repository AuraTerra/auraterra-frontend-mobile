// Detección automática del host real (funciona en localhost y en la IP 192.168.x.x desde el celular)
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

// 1. GESTIÓN DE SESIÓN
window.addEventListener('DOMContentLoaded', () => {
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

        if (res.status === 403 || data.status === 'suspended') {
            msg.style.color = '#e53e3e';
            msg.textContent = '🚫 Cuenta suspendida: El período de prueba de 7 días ha finalizado. Por favor escribe a soporte@auraterra.com';
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

// 3. CONSULTA CLIMÁTICA Y GEOLOCALIZACIÓN
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
            ciudadActualM = clima.ubicacion || `${lat}, ${lon}`;
            document.getElementById('inputCiudadM').value = ciudadActualM;
            aplicarDatosClimaActualMobile(clima);
        }

        const resPron = await fetch(`${API_URL}?ruta=/clima/pronostico&lat=${lat}&lon=${lon}`);
        const dataPron = await resPron.json();
        if (dataPron.ok !== false && Array.isArray(dataPron.data)) {
            pronosticoCompletoMemoria = dataPron.data;
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
    document.getElementById('consensoPillM').textContent = `⚡ Consenso: ${fuentes} APIs`;

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
                : "<b style='color:#e53e3e;'>🚫 PULVERIZACIÓN SUSPENDIDA.</b> Fuera del rango seguro por deriva o inversión.";
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
            cont.innerHTML = vKmh <= 15 ? "<b style='color:#27ae60;'>✅ CONDICIÓN FAVORABLE (<15 km/h).</b>" : "<b style='color:#e53e3e;'>🚫 VIENTO EXCESIVO.</b>";
        }
    }

    const titMod = document.getElementById('tituloModuloM');
    const contMod = document.getElementById('contenidoModuloM');
    if (rol === 'planificador') {
        titMod.innerText = "🎪 Logística AuraEvents";
        contMod.innerHTML = "• Punto de Rocío: Proteger consolas y cableados por humedad.<br>• Hora Dorada: Ventana lumínica ideal a las 17:15 hs.";
    } else {
        titMod.innerText = "🌱 Calendario de Siembra";
        const mes = new Date().getMonth();
        if (mes >= 8 && mes <= 11) {
            contMod.innerHTML = "<b>Campaña Gruesa:</b> Óptimo para <b>Maíz Temprano</b> y preparación para <b>Soja de 1ª</b>.";
        } else if (mes >= 4 && mes <= 7) {
            contMod.innerHTML = "<b>Campaña Fina:</b> Ventana para <b>Trigo Pan</b> y legumbres de cobertura.";
        } else {
            contMod.innerHTML = "<b>Cierre Estival:</b> Monitoreo de llenado en sojas de segunda.";
        }
    }
}

// 4. PRONÓSTICO CON MÁXIMA/MÍNIMA Y DESGLOSE HORARIO
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

        contenedor.innerHTML += `
            <div class="dia-chip-m" onclick="abrirDetalleHorasMobile('${fechaClave}', '${diaNom}')">
                <b style="font-size:1.05rem;">${diaNom}</b>
                <div style="font-size:1.8rem; font-weight:800; margin:6px 0;">${Math.round(rep.main.temp)}°</div>
                <div class="temp-extremos">
                    <span class="max">↑ ${Math.round(max)}°</span> / <span class="min">↓ ${Math.round(min)}°</span>
                </div>
                <div style="font-size:0.9rem; text-transform:capitalize; margin:4px 0;">${rep.weather[0].description}</div>
                <small style="color:#718096;">💨 ${Math.round(rep.wind.speed * 3.6)} km/h</small>
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
        contenedor.innerHTML = '<p style="color:#718096; text-align:center;">Sin datos detallados.</p>';
    } else {
        itemsDelDia.forEach(h => {
            const dateObj = new Date(h.dt * 1000);
            const hora = dateObj.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
            contenedor.innerHTML += `
                <div class="item-horario-row">
                    <span style="font-weight:bold; color:#2b6cb0;">${hora} hs</span>
                    <span style="font-weight:700;">${Math.round(h.main.temp)}°C</span>
                    <span style="text-transform:capitalize;">${h.weather[0].description}</span>
                    <span style="color:#718096; font-size:0.9rem;">💨 ${Math.round(h.wind.speed * 3.6)} km/h</span>
                </div>
            `;
        });
    }

    modal.classList.add('activa');
}

function cerrarModalHorasMobile() {
    document.getElementById('modalHorasMobile').classList.remove('activa');
}

// 5. MODAL CORPORATIVO / QUIÉNES SOMOS
function abrirModalInfoCorporativoMobile() {
    document.getElementById('modalInfoCorporativoM').classList.add('activa');
}

function cerrarModalInfoCorporativoMobile() {
    document.getElementById('modalInfoCorporativoM').classList.remove('activa');
}

// 6. CONSOLA DE ADMINISTRADOR MOBILE (Auditoría, Cambio de Estado y Últimos 50 Eventos)
async function abrirModalAdminMobile(e) {
    if (e) e.preventDefault();
    const dm = document.getElementById('dropdownMenuMobile');
    if (dm) dm.style.display = 'none';

    const modal = document.getElementById('modalAdminMobile');
    modal.classList.add('activa');

    const listaUsr = document.getElementById('listaUsuariosAdminM');
    const boxRank = document.getElementById('rankingConsultasBoxM');
    const boxEventos = document.getElementById('ultimosEventosBoxM');

    listaUsr.innerHTML = 'Cargando usuarios y estados...';
    boxRank.innerHTML = 'Cargando telemetría...';
    if (boxEventos) boxEventos.innerHTML = 'Cargando últimos movimientos...';

    try {
        const res = await fetch(`${API_URL}?ruta=/admin/telemetria`);
        const data = await res.json();

        if (data.status === 'ok') {
            // Renderizar Usuarios con selector de cambio de estado
            if (data.usuarios && data.usuarios.length > 0) {
                listaUsr.innerHTML = '';
                data.usuarios.forEach(u => {
                    let color = u.estado === 'activo' ? '#27ae60' : (u.estado === 'prueba' ? '#dd6b20' : '#e53e3e');
                    let diasInfo = (u.estado === 'prueba') ? `(⏳ ${u.dias_restantes}d restantes)` : '';

                    listaUsr.innerHTML += `
                        <div style="padding:10px 6px; border-bottom:1px solid #edf2f7; display:flex; flex-direction:column; gap:6px;">
                            <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                                <div>
                                    <b style="font-size:1rem; color:#2d3748;">${u.nombre}</b><br>
                                    <small style="color:#718096;">${u.email} | Rol: <b>${u.rol}</b></small>
                                </div>
                                <span style="background:${color}20; color:${color}; border:1px solid ${color}; padding:2px 8px; border-radius:10px; font-weight:800; font-size:0.8rem;">
                                    ${u.estado.toUpperCase()}
                                </span>
                            </div>
                            <div style="display:flex; justify-content:space-between; align-items:center; margin-top:2px;">
                                <small style="color:#718096;">${diasInfo}</small>
                                <select onchange="cambiarEstadoUsuarioDesdeMobile(${u.id}, this.value)" style="padding:6px 10px; border-radius:8px; border:1.5px solid #cbd5e0; font-weight:700; font-size:0.9rem; background:#f8fafc; color:#2d3748;">
                                    <option value="" disabled selected>Cambiar estado...</option>
                                    <option value="activo" ${u.estado === 'activo' ? 'disabled' : ''}>🟢 Activar (Pagado)</option>
                                    <option value="prueba" ${u.estado === 'prueba' ? 'disabled' : ''}>🟠 Modo Prueba</option>
                                    <option value="suspendido" ${u.estado === 'suspendido' ? 'disabled' : ''}>🔴 Suspender</option>
                                </select>
                            </div>
                        </div>
                    `;
                });
            } else {
                listaUsr.innerHTML = '<p style="color:#718096; margin:0;">Sin usuarios registrados.</p>';
            }

            // Renderizar Ranking
            if (data.ranking && data.ranking.length > 0) {
                let html = '<ol style="margin:0; padding-left:20px; line-height:1.6;">';
                data.ranking.forEach(r => {
                    html += `<li><b>${r.componente_clickeado}</b>: ${r.total} clics</li>`;
                });
                html += '</ol>';
                boxRank.innerHTML = html;
            } else {
                boxRank.innerHTML = '<p style="color:#718096; margin:0;">Sin consultas registradas.</p>';
            }

            // Renderizar Últimos 50 Movimientos
            if (boxEventos) {
                if (data.ultimos && data.ultimos.length > 0) {
                    let htmlEventos = '<ul style="margin:0; padding-left:16px; line-height:1.6;">';
                    data.ultimos.forEach(e => {
                        let fechaTxt = e.fecha_hora ? e.fecha_hora.split(' ')[1] || e.fecha_hora : '';
                        htmlEventos += `<li style="margin-bottom:4px;">
                            <span style="color:#718096; font-size:0.8rem;">[${fechaTxt}]</span> 
                            <b>${e.usuario}</b>: ${e.componente_clickeado}
                        </li>`;
                    });
                    htmlEventos += '</ul>';
                    boxEventos.innerHTML = htmlEventos;
                } else {
                    boxEventos.innerHTML = '<p style="color:#718096; margin:0;">Sin actividad registrada.</p>';
                }
            }

        } else {
            listaUsr.innerHTML = `<p style="color:#e53e3e;">${data.message || 'Error al cargar telemetría'}</p>`;
        }
    } catch(err) {
        listaUsr.innerHTML = '<p style="color:#e53e3e;">❌ Error al conectar con la telemetría.</p>';
    }
}

async function cambiarEstadoUsuarioDesdeMobile(userId, nuevoEstado) {
    if (!nuevoEstado) return;
    lanzarToastMobile("⏳ Actualizando estado...");
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
            lanzarToastMobile(`✅ Usuario #${userId} ahora está ${nuevoEstado.toUpperCase()}`);
            abrirModalAdminMobile();
        } else {
            alert("⚠️ " + (d.message || "No se pudo actualizar"));
            abrirModalAdminMobile();
        }
    } catch(e) {
        alert("❌ Error de red al intentar actualizar estado");
    }
}

function cerrarModalAdminMobile() {
    document.getElementById('modalAdminMobile').classList.remove('activa');
}

// 7. BÚSQUEDA Y FAVORITOS
function buscarClimaMobile() {
    const txt = document.getElementById('inputCiudadM').value.trim();
    if (txt) consultarClimaCompletoMobile(txt);
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
    const favs = JSON.parse(localStorage.getItem('favs_m') || '[]');
    cont.innerHTML = '';
    favs.forEach(c => {
        const nombreCorto = c.split(',')[0];
        cont.innerHTML += `<button style="background:#fff; border:1px solid #cbd5e0; padding:6px 12px; border-radius:14px; font-weight:700; white-space:nowrap;" onclick="consultarClimaCompletoMobile('${c}')">📍 ${nombreCorto}</button>`;
    });
}

function lanzarToastMobile(msg) {
    const t = document.getElementById('toastApp');
    if (!t) return;
    t.innerText = msg;
    t.style.display = 'block';
    setTimeout(() => { t.style.display = 'none'; }, 3000);
}