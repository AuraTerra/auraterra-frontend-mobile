const API_BASE_M = `${window.location.origin}/auraterra-backend-api/index.php`;

let ciudadActualM = "Crespo, Entre Ríos, AR";
let usuarioActualM = null;
let modoPanelM = 'agricultor';
let ultimoClimaM = null;
let pronosticoM = [];
let diaClaveM = null;
let indiceEdicionAliasM = null;
let deferredPromptPWAM = null;
let timerToastM = null;
let timerInactividadM = null;

// Variables para 2FA
let usuarioPendiente2FAM = null;
let codigoGenerado2FAM = null;
let intentos2FAM = 0;
let recordarCredsM = false;

// 1. REGISTRO DEL SERVICE WORKER Y MANIFEST PNG DINÁMICO PARA PWA
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').catch(() => {});
        generarManifestPNGMobile();
    });
}

function generarManifestPNGMobile() {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = './img/logoAuraTerra.jpeg';
    img.onload = () => {
        try {
            const crearIcono = (size) => {
                const c = document.createElement('canvas');
                c.width = size; c.height = size;
                const ctx = c.getContext('2d');
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, size, size);
                ctx.drawImage(img, 0, 0, size, size);
                return c.toDataURL('image/png');
            };
            const manifest = {
                name: "AuraTerra Mobile — Agro & AuraEvents PWA",
                short_name: "AuraTerra",
                start_url: window.location.href.split('?')[0],
                scope: window.location.href.substring(0, window.location.href.lastIndexOf('/') + 1),
                display: "standalone",
                background_color: "#1a365d",
                theme_color: "#2b6cb0",
                icons: [
                    { src: crearIcono(192), sizes: "192x192", type: "image/png", purpose: "any" },
                    { src: crearIcono(512), sizes: "512x512", type: "image/png", purpose: "any" }
                ]
            };
            const url = URL.createObjectURL(new Blob([JSON.stringify(manifest)], { type: 'application/json' }));
            const link = document.querySelector('link[rel="manifest"]');
            if (link) link.setAttribute('href', url);
        } catch (e) {}
    };
}

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPromptPWAM = e;
});

async function instalarPWAM() {
    registrarClickM("Botón Instalar PWA Mobile");
    if (deferredPromptPWAM) {
        deferredPromptPWAM.prompt();
        const choice = await deferredPromptPWAM.userChoice;
        if (choice.outcome === 'accepted') {
            mostrarToastM("🎉 ¡AuraTerra Mobile instalada con éxito!");
        }
        deferredPromptPWAM = null;
        return;
    }
    document.getElementById('modalInstalarPWAM').classList.add('activa');
}

function cerrarModalInstalarPWAM() {
    document.getElementById('modalInstalarPWAM').classList.remove('activa');
}

function mostrarToastM(msg) {
    const t = document.getElementById('toastMobile');
    if (!t) return;
    if (timerToastM) clearTimeout(timerToastM);
    t.textContent = msg;
    t.style.display = 'block';
    timerToastM = setTimeout(() => { t.style.display = 'none'; }, 8500);
}

function registrarClickM(comp) {
    const usr = usuarioActualM?.nombre || usuarioActualM?.email || 'Usuario Mobile';
    const fd = new URLSearchParams();
    fd.append('usuario', usr);
    fd.append('componente', comp);
    fetch(`${API_BASE_M}?ruta=/registrar_click`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: fd.toString()
    }).catch(() => {});
}

// 2. AUTENTICACIÓN, 2FA, REGISTRO CON CLAVE COMPLEJA Y RECUPERACIÓN
function alternarTabM(tab) {
    document.getElementById('tabLoginM').classList.toggle('active', tab === 'login');
    document.getElementById('tabRegM').classList.toggle('active', tab === 'register');
    document.getElementById('formLoginM').style.display = tab === 'login' ? 'block' : 'none';
    document.getElementById('formRegM').style.display = tab === 'register' ? 'block' : 'none';
    document.getElementById('msgAuthM').textContent = '';
}

function togglePassM(id, btn) {
    const inp = document.getElementById(id);
    if (inp.type === 'password') { inp.type = 'text'; btn.textContent = '👀'; }
    else { inp.type = 'password'; btn.textContent = '🙈'; }
}

function evaluarRequisitosPassM(val) {
    const cLen = val.length >= 6;
    const cMay = /[A-Z]/.test(val);
    const cSim = /[^a-zA-Z0-9]/.test(val);
    document.getElementById('reqLenM').classList.toggle('cumplido', cLen);
    document.getElementById('reqMayusM').classList.toggle('cumplido', cMay);
    document.getElementById('reqSimbM').classList.toggle('cumplido', cSim);
    return cLen && cMay && cSim;
}

async function ejecutarLoginM(e) {
    e.preventDefault();
    const email = document.getElementById('emailLoginM').value.trim();
    const password = document.getElementById('passLoginM').value;
    recordarCredsM = document.getElementById('checkRecordarM').checked;
    const msg = document.getElementById('msgAuthM');
    msg.style.color = '#3182ce';
    msg.textContent = 'Validando credenciales...';

    try {
        const res = await fetch(`${API_BASE_M}?ruta=/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const data = await res.json();

        if (res.status === 403 || data.status === 'suspended') {
            msg.textContent = '';
            document.getElementById('modalSuspendidoM').classList.add('activa');
            return;
        }

        if (data.status === 'success' && data.user) {
            msg.textContent = '';
            usuarioPendiente2FAM = data.user;
            usuarioPendiente2FAM._tempPass = password;
            abrirYGenerar2FAM();
        } else {
            msg.style.color = '#e53e3e';
            msg.textContent = '❌ ' + (data.message || 'Credenciales inválidas.');
        }
    } catch (err) {
        msg.style.color = '#e53e3e';
        msg.textContent = '❌ Error de conexión con el servidor.';
    }
}

function abrirYGenerar2FAM() {
    intentos2FAM = 0;
    codigoGenerado2FAM = Math.floor(100000 + Math.random() * 900000).toString();
    document.getElementById('codigoMuestra2FAM').textContent = codigoGenerado2FAM;
    document.getElementById('error2FAM').style.display = 'none';
    document.getElementById('btnVerif2FAM').style.display = 'block';
    document.getElementById('btnRegen2FAM').style.display = 'none';
    const inp = document.getElementById('inputCodigo2FAM');
    inp.disabled = false;
    inp.value = '';
    document.getElementById('modal2FAM').classList.add('activa');
    setTimeout(() => inp.focus(), 150);
}

function cerrarModal2FAM() {
    document.getElementById('modal2FAM').classList.remove('activa');
}

function verificar2FAM() {
    const inp = document.getElementById('inputCodigo2FAM');
    const err = document.getElementById('error2FAM');
    const caja = document.getElementById('caja2FAM');

    if (inp.value.trim() === codigoGenerado2FAM) {
        const email = usuarioPendiente2FAM.email;
        const pass = usuarioPendiente2FAM._tempPass;
        delete usuarioPendiente2FAM._tempPass;

        if (recordarCredsM) {
            localStorage.setItem('auraterra_remember_email', email);
            localStorage.setItem('auraterra_remember_pass', pass);
            localStorage.setItem('auraterra_keep_logged_in', 'true');
        } else {
            localStorage.removeItem('auraterra_remember_email');
            localStorage.removeItem('auraterra_remember_pass');
            localStorage.removeItem('auraterra_keep_logged_in');
        }

        localStorage.setItem('usuario_web', JSON.stringify(usuarioPendiente2FAM));
        localStorage.setItem('usuario', JSON.stringify(usuarioPendiente2FAM));
        cerrarModal2FAM();
        iniciarDashboardMobile(usuarioPendiente2FAM, true);
    } else {
        intentos2FAM++;
        caja.classList.remove('shake-m');
        void caja.offsetWidth;
        caja.classList.add('shake-m');
        err.style.display = 'block';

        if (intentos2FAM >= 3) {
            err.innerHTML = '🚫 <b>Bloqueo temporal:</b> Superaste los 3 intentos. Generá un nuevo código.';
            inp.disabled = true;
            document.getElementById('btnVerif2FAM').style.display = 'none';
            document.getElementById('btnRegen2FAM').style.display = 'block';
        } else {
            const rest = 3 - intentos2FAM;
            err.innerHTML = `⚠️ <b>Código incorrecto.</b> Te ${rest === 1 ? 'queda <b>1 intento</b>' : `quedan <b>${rest} intentos</b>`}.`;
        }
    }
}

async function ejecutarRegistroM(e) {
    e.preventDefault();
    const nombre = document.getElementById('nombreRegM').value.trim();
    const email = document.getElementById('emailRegM').value.trim();
    const password = document.getElementById('passRegM').value;
    const rol = document.getElementById('rolRegM').value;
    const msg = document.getElementById('msgAuthM');

    if (!evaluarRequisitosPassM(password)) {
        msg.style.color = '#e53e3e';
        msg.textContent = '⚠️ La clave requiere 6+ caracteres, 1 mayúscula y 1 símbolo.';
        return;
    }

    try {
        const res = await fetch(`${API_BASE_M}?ruta=/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nombre, email, password, rol })
        });
        const data = await res.json();
        if (data.status === 'success' && data.user) {
            localStorage.setItem(`auraterra_favs_${email.toLowerCase()}`, JSON.stringify([]));
            localStorage.setItem('usuario_web', JSON.stringify(data.user));
            localStorage.setItem('usuario', JSON.stringify(data.user));
            iniciarDashboardMobile(data.user, true);
        } else {
            msg.style.color = '#e53e3e';
            msg.textContent = '❌ ' + (data.message || 'No se pudo registrar.');
        }
    } catch (err) {
        msg.style.color = '#e53e3e';
        msg.textContent = '❌ Error de red.';
    }
}

// Recuperar Contraseña Mobile
function abrirModalRecuperarM(e) {
    if (e) e.preventDefault();
    document.getElementById('paso1RecM').style.display = 'block';
    document.getElementById('paso2RecM').style.display = 'none';
    document.getElementById('msgRecM').textContent = '';
    document.getElementById('emailRecM').value = document.getElementById('emailLoginM').value.trim();
    document.getElementById('modalRecuperarM').classList.add('activa');
}

function cerrarModalRecuperarM() {
    document.getElementById('modalRecuperarM').classList.remove('activa');
}

async function solicitarCodigoRecM() {
    const email = document.getElementById('emailRecM').value.trim();
    const msg = document.getElementById('msgRecM');
    if (!email) return;
    try {
        const res = await fetch(`${API_BASE_M}?ruta=/recuperar/solicitar`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });
        const data = await res.json();
        if (data.status === 'ok') {
            document.getElementById('paso1RecM').style.display = 'none';
            document.getElementById('paso2RecM').style.display = 'block';
            document.getElementById('avisoCodSimuladoM').innerHTML = `📧 Hola <b>${data.nombre}</b>, tu código es:<br><b style="font-size:1.35rem; letter-spacing:4px;">${data.codigo_simulado}</b>`;
        } else {
            msg.style.color = '#e53e3e';
            msg.textContent = '❌ ' + (data.message || 'Correo no registrado.');
        }
    } catch (e) {}
}

async function confirmarPassRecM() {
    const email = document.getElementById('emailRecM').value.trim();
    const codigo = document.getElementById('codRecInputM').value.trim();
    const password = document.getElementById('nuevaPassRecM').value;
    const msg = document.getElementById('msgRecM');
    try {
        const res = await fetch(`${API_BASE_M}?ruta=/recuperar/confirmar`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, codigo, password })
        });
        const data = await res.json();
        if (data.status === 'ok') {
            msg.style.color = '#27ae60';
            msg.textContent = '✅ ' + data.message;
            document.getElementById('emailLoginM').value = email;
            document.getElementById('passLoginM').value = password;
            setTimeout(() => cerrarModalRecuperarM(), 1400);
        } else {
            msg.style.color = '#e53e3e';
            msg.textContent = '❌ ' + (data.message || 'Error al actualizar.');
        }
    } catch (e) {}
}

// 3. INICIO DEL DASHBOARD MOBILE Y TIMEOUT DE 30 MINUTOS
function iniciarDashboardMobile(user, mostrarCohete = false) {
    usuarioActualM = user;
    document.getElementById('vistaAuthMobile').style.display = 'none';
    document.getElementById('vistaDashboardMobile').style.display = 'block';

    if (mostrarCohete) {
        const loader = document.getElementById('rocketLoaderMobile');
        loader.classList.add('activo');
        setTimeout(() => loader.classList.remove('activo'), 1800);
    }

    document.getElementById('lblNombreHeaderM').textContent = user.nombre || 'Usuario';
    document.getElementById('inputNombrePerfilM').value = user.nombre || '';

    const pillEst = document.getElementById('pillEstadoM');
    if (user.estado === 'activo') {
        pillEst.style.background = '#f0fff4';
        pillEst.style.color = '#22543d';
        pillEst.textContent = '🟢 Suscripción Activa';
    } else {
        pillEst.style.background = '#fffaf0';
        pillEst.style.color = '#c05621';
        pillEst.textContent = '🟠 Prueba (7d)';
    }

    const rol = user.rol || 'agricultor';
    const btnDual = document.getElementById('btnSwitchDualM');
    if (rol === 'planificador') {
        modoPanelM = 'planificador';
    } else if (rol === 'ambos' || rol === 'admin') {
        modoPanelM = 'agricultor';
        btnDual.style.display = 'inline-block';
    } else {
        modoPanelM = 'agricultor';
    }

    if (rol === 'admin') {
        document.getElementById('btnAbrirAdminM').style.display = 'block';
    }

    actualizarBadgesPanelM();
    reiniciarTimeoutInactividadM();
    consultarClimaCompletoM(ciudadActualM);
}

function actualizarBadgesPanelM() {
    const p = document.getElementById('pillPanelM');
    const b = document.getElementById('btnSwitchDualM');
    if (modoPanelM === 'planificador') {
        p.style.background = '#ebf8ff'; p.style.color = '#2b6cb0';
        p.textContent = '🎪 Panel AuraEvents';
        if (b) b.textContent = '🔄 Cambiar a Agro';
    } else {
        p.style.background = '#f0fff4'; p.style.color = '#22543d';
        p.textContent = '🌾 Panel AuraTerra Agro';
        if (b) b.textContent = '🔄 Cambiar a AuraEvents';
    }
}

function alternarPanelDualM() {
    modoPanelM = (modoPanelM === 'agricultor') ? 'planificador' : 'agricultor';
    actualizarBadgesPanelM();
    if (ultimoClimaM) actualizarUIClimaM(ultimoClimaM);
    mostrarToastM(`🔄 Cambiaste a ${modoPanelM === 'planificador' ? 'AuraEvents' : 'AuraTerra Agro'}`);
}

function reiniciarTimeoutInactividadM() {
    if (timerInactividadM) clearTimeout(timerInactividadM);
    timerInactividadM = setTimeout(() => {
        mostrarToastM("🔒 Sesión cerrada por 30 minutos de inactividad.");
        setTimeout(() => cerrarSesionM(), 1200);
    }, 30 * 60 * 1000);
}

['click', 'touchstart', 'scroll', 'keydown'].forEach(ev => {
    window.addEventListener(ev, reiniciarTimeoutInactividadM, { passive: true });
});

function cerrarSesionM() {
    localStorage.removeItem('usuario_web');
    localStorage.removeItem('usuario');
    localStorage.removeItem('auraterra_keep_logged_in');
    usuarioActualM = null;
    document.getElementById('vistaDashboardMobile').style.display = 'none';
    document.getElementById('vistaAuthMobile').style.display = 'block';
}

// 4. FAVORITOS POR USUARIO (SIN FORZAR CRESPO Y MANTENIENDO ELIMINADOS)
function claveFavsM() {
    const id = (usuarioActualM?.email || usuarioActualM?.id || 'default').toString().toLowerCase().trim();
    return `auraterra_favs_${id}`;
}

function obtenerFavsM() {
    const raw = localStorage.getItem(claveFavsM());
    if (!raw) return [];
    try { return JSON.parse(raw); } catch (e) { return []; }
}

function guardarFavsM(lista) {
    localStorage.setItem(claveFavsM(), JSON.stringify(lista));
}

function abrirModalPerfilFavoritosM() {
    renderizarListaFavsM();
    document.getElementById('modalPerfilFavsM').classList.add('activa');
}

function cerrarModalPerfilFavoritosM() {
    document.getElementById('modalPerfilFavsM').classList.remove('activa');
}

async function guardarNombreUsuarioM() {
    const nuevo = document.getElementById('inputNombrePerfilM').value.trim();
    if (!nuevo) return;
    try {
        await fetch(`${API_BASE_M}?ruta=/perfil/actualizar_nombre`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: usuarioActualM?.id || 0, email: usuarioActualM?.email || '', nombre: nuevo })
        });
    } catch (e) {}
    usuarioActualM.nombre = nuevo;
    localStorage.setItem('usuario_web', JSON.stringify(usuarioActualM));
    localStorage.setItem('usuario', JSON.stringify(usuarioActualM));
    document.getElementById('lblNombreHeaderM').textContent = nuevo;
    mostrarToastM(`✅ Nombre actualizado a "${nuevo}".`);
}

function renderizarListaFavsM() {
    const cont = document.getElementById('listaFavsM');
    const favs = obtenerFavsM();
    cont.innerHTML = '';
    if (favs.length === 0) {
        cont.innerHTML = '<p style="color:#718096; font-size:0.84rem;">Tu lista de favoritos está vacía.</p>';
        return;
    }
    favs.forEach((f, idx) => {
        cont.innerHTML += `
            <div style="display:flex; justify-content:space-between; align-items:center; padding:8px 4px; border-bottom:1px solid #edf2f7;">
                <div style="cursor:pointer; flex:1;" onclick="cerrarModalPerfilFavoritosM(); consultarClimaCompletoM('${f.ciudad}')">
                    <b style="color:#2b6cb0; font-size:0.9rem;">⭐ ${f.alias}</b><br>
                    <small style="color:#718096;">📍 ${f.ciudad}</small>
                </div>
                <div style="display:flex; gap:6px;">
                    <button onclick="abrirModalEditarAliasM(${idx})" style="border:none; background:#ebf8ff; border-radius:8px; padding:5px 8px; cursor:pointer;">✏️</button>
                    <button onclick="eliminarFavM(${idx})" style="border:none; background:#fff5f5; border-radius:8px; padding:5px 8px; cursor:pointer;">❌</button>
                </div>
            </div>
        `;
    });
}

function agregarFavManualM() {
    const alias = document.getElementById('inputAliasFavM').value.trim();
    const ciudad = document.getElementById('inputCiudadFavM').value.trim();
    if (!validarFormatoM(ciudad)) {
        document.getElementById('modalFormatoM').classList.add('activa');
        return;
    }
    const favs = obtenerFavsM();
    const aliasFinal = alias || ciudad.split(',')[0];
    favs.push({ alias: aliasFinal, ciudad });
    guardarFavsM(favs);
    document.getElementById('inputAliasFavM').value = '';
    document.getElementById('inputCiudadFavM').value = '';
    renderizarListaFavsM();
    mostrarToastM(`⭐ "${aliasFinal}" agregado a favoritos.`);
}

function abrirModalGuardarFavActualM() {
    const favs = obtenerFavsM();
    const idx = favs.findIndex(f => f.ciudad.toLowerCase() === ciudadActualM.toLowerCase());
    if (idx !== -1) {
        abrirModalEditarAliasM(idx);
        return;
    }
    indiceEdicionAliasM = null;
    document.getElementById('titModalAliasM').textContent = '⭐ Guardar en Mis Favoritos';
    document.getElementById('subModalAliasM').textContent = `📍 ${ciudadActualM}`;
    document.getElementById('inputModalAliasM').value = ciudadActualM.split(',')[0];
    document.getElementById('modalAliasM').classList.add('activa');
}

function abrirModalEditarAliasM(idx) {
    const favs = obtenerFavsM();
    const item = favs[idx];
    if (!item) return;
    indiceEdicionAliasM = idx;
    document.getElementById('titModalAliasM').textContent = '✏️ Editar Alias de Favorito';
    document.getElementById('subModalAliasM').textContent = `📍 ${item.ciudad}`;
    document.getElementById('inputModalAliasM').value = item.alias;
    document.getElementById('modalAliasM').classList.add('activa');
}

function setChipAliasM(txt) {
    document.getElementById('inputModalAliasM').value = txt;
}

function confirmarAliasModalM() {
    const val = document.getElementById('inputModalAliasM').value.trim();
    const favs = obtenerFavsM();
    if (indiceEdicionAliasM === null) {
        const aliasFinal = val || ciudadActualM.split(',')[0];
        favs.push({ alias: aliasFinal, ciudad: ciudadActualM });
        guardarFavsM(favs);
        mostrarToastM(`⭐ Guardado como "${aliasFinal}"`);
    } else if (favs[indiceEdicionAliasM]) {
        favs[indiceEdicionAliasM].alias = val || favs[indiceEdicionAliasM].ciudad.split(',')[0];
        guardarFavsM(favs);
        mostrarToastM(`✏️ Alias cambiado a "${favs[indiceEdicionAliasM].alias}"`);
    }
    cerrarModalAliasM();
    renderizarListaFavsM();
}

function cerrarModalAliasM() {
    document.getElementById('modalAliasM').classList.remove('activa');
}

function eliminarFavM(idx) {
    const favs = obtenerFavsM();
    favs.splice(idx, 1);
    guardarFavsM(favs);
    renderizarListaFavsM();
    mostrarToastM("🗑️ Favorito eliminado.");
}

// 5. CLIMA, GPS CON NORMALIZACIÓN Y RECOMENDACIONES EXHAUSTIVAS (IDÉNTICAS A LA WEB)
function validarFormatoM(txt) {
    if (!txt) return false;
    return txt.split(',').map(p => p.trim()).filter(Boolean).length === 3;
}

function buscarClimaM() {
    const val = document.getElementById('inputCiudadM').value.trim();
    if (!validarFormatoM(val)) {
        document.getElementById('modalFormatoM').classList.add('activa');
        return;
    }
    registrarClickM(`Búsqueda Mobile: ${val}`);
    consultarClimaCompletoM(val);
}

function normalizarUbicacionM(rawUbicacion, lat, lon) {
    if (!rawUbicacion || rawUbicacion === 'Ubicación Detectada') {
        if (lat && lat <= -31.9 && lat >= -32.2 && lon >= -60.5 && lon <= -60.1) return "Crespo, Entre Ríos, AR";
        return "Paraná, Entre Ríos, AR";
    }
    const loc = rawUbicacion.toLowerCase().trim();
    if (loc.includes("crespo")) return "Crespo, Entre Ríos, AR";
    if (loc.includes("paranacito")) return "Villa Paranacito, Entre Ríos, AR";
    if (loc.includes("paracao")) return "Paracao, Entre Ríos, AR";
    if (loc.includes("paraná") || loc.includes("parana")) return "Paraná, Entre Ríos, AR";
    const partes = rawUbicacion.split(',').map(p => p.trim());
    if (partes.length === 3) return rawUbicacion;
    if (lat && lat <= -30.1 && lat >= -34.0 && lon >= -60.8 && lon <= -57.7) return `${partes[0]}, Entre Ríos, AR`;
    return `${partes[0]}, Argentina, AR`;
}

async function consultarClimaCompletoM(ciudad, lat = null, lon = null) {
    ciudadActualM = ciudad;
    document.getElementById('inputCiudadM').value = ciudad;
    document.getElementById('bannerCargaM').style.display = 'block';

    try {
        let uAct = `${API_BASE_M}?ruta=/clima/actual`;
        let uPro = `${API_BASE_M}?ruta=/clima/pronostico`;
        if (lat !== null && lon !== null) {
            uAct += `&lat=${lat}&lon=${lon}`;
            uPro += `&lat=${lat}&lon=${lon}`;
        } else {
            uAct += `&ciudad=${encodeURIComponent(ciudad)}`;
            uPro += `&ciudad=${encodeURIComponent(ciudad)}`;
        }

        const rA = await fetch(uAct);
        const dA = await rA.json();
        if (dA.data) {
            ultimoClimaM = dA.data;
            actualizarUIClimaM(dA.data);
        }

        const rP = await fetch(uPro);
        const dP = await rP.json();
        if (Array.isArray(dP.data) && dP.data.length > 0) {
            pronosticoM = dP.data;
            renderizar5DiasM(dP.data);
            evaluarAlertaTemprana12a24hM(dP.data);
        }
    } catch (e) {} finally {
        document.getElementById('bannerCargaM').style.display = 'none';
    }
}

function obtenerGpsM(forzar = false) {
    registrarClickM("GPS Satelital Mobile");
    document.getElementById('bannerCargaM').style.display = 'block';
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            async (pos) => {
                const lat = pos.coords.latitude.toFixed(4);
                const lon = pos.coords.longitude.toFixed(4);
                try {
                    const rA = await fetch(`${API_BASE_M}?ruta=/clima/actual&lat=${lat}&lon=${lon}`);
                    const dA = await rA.json();
                    if (dA.data) {
                        ciudadActualM = normalizarUbicacionM(dA.data.ubicacion, Number(lat), Number(lon));
                        dA.data.ubicacion = ciudadActualM;
                        document.getElementById('inputCiudadM').value = ciudadActualM;
                        ultimoClimaM = dA.data;
                        actualizarUIClimaM(dA.data);
                        mostrarToastM(`📍 Detectado por GPS: ${ciudadActualM}`);
                    }
                    const rP = await fetch(`${API_BASE_M}?ruta=/clima/pronostico&lat=${lat}&lon=${lon}`);
                    const dP = await rP.json();
                    if (Array.isArray(dP.data)) {
                        pronosticoM = dP.data;
                        renderizar5DiasM(dP.data);
                        evaluarAlertaTemprana12a24hM(dP.data);
                    }
                } catch (e) {} finally {
                    document.getElementById('bannerCargaM').style.display = 'none';
                }
            },
            () => {
                document.getElementById('bannerCargaM').style.display = 'none';
                consultarClimaCompletoM(ciudadActualM);
            },
            { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
        );
    }
}

function gradosACardinalM(g) {
    if (g === undefined || g === null || isNaN(Number(g))) return "SE ↘️";
    const s = ["N ⬆️", "NNE ↗️", "NE ↗️", "ENE ↗️", "E ➡️", "ESE ↘️", "SE ↘️", "SSE ↘️", "S ⬇️", "SSO ↙️", "SO ↙️", "OSO ↙️", "O ⬅️", "ONO ↖️", "NO ↖️", "NNO ↖️"];
    return s[Math.round((((Number(g) % 360) + 360) % 360) / 22.5) % 16];
}

function actualizarUIClimaM(c) {
    document.getElementById('lblCiudadM').textContent = `📍 ${c.ubicacion || ciudadActualM}`;
    document.getElementById('lblFechaM').textContent = new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
    document.getElementById('lblTempM').textContent = `${Math.round(c.temperatura)}°C`;
    document.getElementById('lblDescM').textContent = c.descripcion;
    document.getElementById('lblHumM').textContent = `${c.humedad}%`;

    const vKmh = c.viento_kmh || Math.round(c.viento * 3.6);
    document.getElementById('lblVientoM').textContent = `${vKmh} km/h`;
    document.getElementById('lblDirM').textContent = gradosACardinalM(c.viento_grados);
    document.getElementById('lblSensM').textContent = `${Math.round(c.sensacion_termica || c.temperatura)}°C`;
    document.getElementById('lblPresM').textContent = `${c.presion || 1013} hPa`;
    document.getElementById('lblVisM').textContent = `${c.visibilidad || 10} km`;
    document.getElementById('lblConsensoM').textContent = `Consenso: ${c.consenso?.fuentes_consultadas || 3} APIs`;

    const locMin = (c.ubicacion || ciudadActualM).toLowerCase();
    const esER = locMin.includes("entre ríos") || locMin.includes("entre rios");
    const cardL = document.getElementById('cardLegalM');
    const titL = document.getElementById('lblTitLegalM');
    const badL = document.getElementById('lblBadgeLegalM');
    const cueL = document.getElementById('lblCuerpoLegalM');

    if (modoPanelM === 'planificador') {
        titL.textContent = "⛺ Seguridad de Montajes y Gazebos";
        badL.textContent = "AuraEvents Logística";
        if (vKmh > 18) {
            cardL.style.borderLeft = "6px solid #e53e3e";
            cueL.innerHTML = `
                <div style="color:#c53030; font-weight:800; margin-bottom:4px;">🚫 RÁFAGAS ALARMANTES (${vKmh} km/h &gt; 18 km/h)</div>
                Suspender tareas de montaje en altura. Reforzar anclajes de carpas estructurales y replegar gazebos de estructura liviana.
            `;
        } else {
            cardL.style.borderLeft = "6px solid #38a169";
            cueL.innerHTML = `
                <div style="color:#22543d; font-weight:800; margin-bottom:4px;">✅ VIENTO CONTROLADO (${vKmh} km/h)</div>
                Condición meteorológica segura para montajes temporales, carpas estructurales y sonido al aire libre.
            `;
        }
    } else {
        titL.textContent = esER ? "⚖️ Evaluación Normativa de Deriva" : "🌾 Estándar Nacional de Aplicación";
        badL.textContent = esER ? "Entre Ríos — Ley Nº 6.599" : "INTA / Red BPA";
        if (vKmh >= 7 && vKmh <= 15) {
            cardL.style.borderLeft = "6px solid #38a169";
            cueL.innerHTML = `
                <div style="color:#22543d; font-weight:800; margin-bottom:4px;">✅ PULVERIZACIÓN HABILITADA (${vKmh} km/h)</div>
                La velocidad del viento se encuentra dentro de la banda reglamentaria legal de <b>7 a 15 km/h</b> fijada por la Ley Provincial Nº 6.599 de Entre Ríos.
            `;
        } else {
            cardL.style.borderLeft = "6px solid #e53e3e";
            cueL.innerHTML = `
                <div style="color:#c53030; font-weight:800; margin-bottom:4px;">🚫 PULVERIZACIÓN SUSPENDIDA (${vKmh} km/h)</div>
                Viento fuera del umbral legal obligatorio. Riesgo severo de ${vKmh < 7 ? '<b>inversión térmica</b> (gotas en suspensión)' : '<b>deriva química</b> hacia lotes vecinos'}.
            `;
        }
    }

    renderizarRecomendacionesMobile(vKmh, c);
}

// 6. RECOMENDACIONES COMPLETAS Y DETALLADAS EN MOBILE (IDÉNTICAS A LA VERSIÓN DE LA COMPU)
function renderizarRecomendacionesMobile(vKmh, clima) {
    const tit = document.getElementById('lblTitRolM');
    const cont = document.getElementById('lblCuerpoRolM');
    const temp = Math.round(clima.temperatura);
    const hum = clima.humedad;
    const mes = new Date().getMonth();
    const ubicacionTexto = clima.ubicacion || ciudadActualM;
    const locNombre = ubicacionTexto.split(',')[0];

    if (modoPanelM === 'planificador') {
        tit.textContent = `🎪 Centro de Inteligencia y Contingencias Logísticas — AuraEvents (${locNombre})`;

        let alertaViento = (vKmh > 18)
            ? `<div style="background:#fff5f5; border-left:4px solid #e53e3e; padding:14px; border-radius:10px; margin-bottom:12px;">
                 <b style="color:#c53030; font-size:0.96rem;">🚨 RIESGO ESTRUCTURAL CRÍTICO: Ráfagas de ${vKmh} km/h</b><br>
                 <span style="font-size:0.88rem; color:#4a5568; line-height:1.5;"><b>Obligatorio en predio:</b> Añadir lastres de hormigón de 120 kg/pata en carpas estructurales de 10x10m. Desmontar paredes laterales de gazebos tubulares para evitar el "efecto vela/embolsamiento". Bajar altura de torres de iluminación (trusses) y asegurar pantallas LED colgadas.</span>
               </div>`
            : `<div style="background:#f0fff4; border-left:4px solid #38a169; padding:14px; border-radius:10px; margin-bottom:12px;">
                 <b style="color:#22543d; font-size:0.96rem;">✅ CONDICIÓN EÓLICA ESTABLE (${vKmh} km/h) — Montaje Seguro</b><br>
                 <span style="font-size:0.88rem; color:#4a5568; line-height:1.5;">Habilitado el armado de arcos de recepción, pérgolas florales, techos livianos, pantallas gigantes, domos geodésicos y centros de mesa altos sin riesgo de voladura.</span>
               </div>`;

        let alertaCondensacion = (hum >= 75)
            ? `<div style="background:#fffaf0; border-left:4px solid #dd6b20; padding:14px; border-radius:10px; margin-bottom:12px;">
                 <b style="color:#c05621; font-size:0.96rem;">💧 ALERTA DE PUNTO DE ROCÍO, CONDENSACIÓN Y CÉSPED (${hum}% Humedad)</b><br>
                 <span style="font-size:0.88rem; color:#4a5568; line-height:1.5;"><b>Lo que desvela al sonidista:</b> A partir de las 21:30 / 22:00 hs, el descenso térmico condensará rocío superficial. Cubrir consolas digitales de sonido y DMX con cobertores térmicos, elevar zapatillas eléctricas y cajas directas sobre tarimas plásticas (nunca sobre el pasto húmedo) y colocar alfombra antideslizante en el ingreso a pista de baile.</span>
               </div>`
            : `<div style="background:#f7fafc; border-left:4px solid #3182ce; padding:14px; border-radius:10px; margin-bottom:12px;">
                 <b style="color:#2b6cb0; font-size:0.96rem;">💧 HUMEDAD AMBIENTE Y SUELO CONTROLADOS (${hum}%)</b><br>
                 <span style="font-size:0.88rem; color:#4a5568; line-height:1.5;">Bajo riesgo de condensación temprana sobre equipos de sonido, lentes de cámaras y pistas de baile acrílicas o de madera. Suelo firme para tránsito de proveedores.</span>
               </div>`;

        let nivelPolen = (vKmh >= 14 && hum < 65)
            ? `<b style="color:#c05621;">Moderado a Alto (Viento dispersando polen y polvo en suspensión).</b> Proteger mesas de catering y barra de bebidas con cúpulas acrílicas hasta el momento de servir.`
            : `<b style="color:#22543d;">Bajo.</b> Aire limpio y baja suspensión de partículas sobre vajilla y sectores gastronómicos al aire libre.`;

        cont.innerHTML = `
            ${alertaViento}
            ${alertaCondensacion}
            <div style="display: flex; flex-direction: column; gap: 12px;">
                <div style="background:#f8fafc; padding:14px; border-radius:10px; border:1px solid #e2e8f0;">
                    <b style="color:#2d3748; font-size:0.95rem;">🌅 Cronograma de Hora Dorada y Luz Natural</b>
                    <p style="margin:6px 0 0 0; font-size:0.88rem; color:#4a5568; line-height:1.5;">
                        • <b>Hora Dorada (Golden Hour):</b> 17:40 a 18:25 hs (Luz cálida rasante ideal para ceremonia al aire libre y sesión fotográfica sin sombras duras).<br>
                        • <b>Hora Azul (Blue Hour):</b> 18:25 a 18:45 hs (Momento exacto para encender guirnaldas de luces cálidas, velas y fogoneros perimetrales).
                    </p>
                </div>
                <div style="background:#f8fafc; padding:14px; border-radius:10px; border:1px solid #e2e8f0;">
                    <b style="color:#2d3748; font-size:0.95rem;">🌡️ Confort Térmico del Invitado (${temp}°C actuales)</b>
                    <p style="margin:6px 0 0 0; font-size:0.88rem; color:#4a5568; line-height:1.5;">
                        • <b>Si baja de 16°C por la noche:</b> Activar calefactores exteriores tipo hongo (1 cada 25 m²) y disponer canastos con mantas de cortesía en livings.<br>
                        • <b>Si supera los 27°C:</b> Reforzar estación de aguas saborizadas de bienvenida, hielo extra en barra y ventilación en carpa principal.
                    </p>
                </div>
                <div style="background:#f8fafc; padding:14px; border-radius:10px; border:1px solid #e2e8f0;">
                    <b style="color:#2d3748; font-size:0.95rem;">🌿 Estado del Suelo, Drenaje y Transitabilidad</b>
                    <p style="margin:6px 0 0 0; font-size:0.88rem; color:#4a5568; line-height:1.5;">
                        Con ${hum}% de humedad actual, verificar firmeza en sectores de estacionamiento y acceso de camiones de técnica. Prever senderos rígidos o placas drenantes en zonas de césped natural para evitar que el calzado de gala se hunda.
                    </p>
                </div>
                <div style="background:#f8fafc; padding:14px; border-radius:10px; border:1px solid #e2e8f0;">
                    <b style="color:#2d3748; font-size:0.95rem;">🌼 Índice de Polen, Polvo e Insectos</b>
                    <p style="margin:6px 0 0 0; font-size:0.88rem; color:#4a5568; line-height:1.5;">
                        • <b>Polen y Polvo:</b> ${nivelPolen}<br>
                        • <b>Control ambiental:</b> Con temperaturas de ${temp}°C, aplicar barrera repelente perimetral en espacios verdes 1 hora antes de la recepción.
                    </p>
                </div>
            </div>
        `;
    } else {
        tit.textContent = `🌱 Calendario Integral de Siembra, Suelos y Decisiones Críticas — AuraTerra Agro (${locNombre})`;

        let queSembrar = "";
        let queNoSembrar = "";
        let temperaturaSuelo = "";
        let alertasDesvelo = "";
        let precaucionesCuidados = "";

        if (mes >= 8 && mes <= 11) {
            temperaturaSuelo = `${Math.max(12, temp - 3)}°C a ${Math.max(15, temp - 1)}°C a 5 cm de profundidad (condición apta para emergencia rápida y uniforme)`;
            queSembrar = `
                • <b>Maíz de Primera / Temprano:</b> Ventana óptima de implantación en ${locNombre}. Exige suelo a &gt;12°C continuos durante 3 días para asegurar emergencia en 6-8 días sin pudrición seminal.<br>
                • <b>Soja de Primera:</b> Iniciar siembra en lotes altos cuando el suelo supere los 15°C estables a las 8:00 AM. Inoculación cuidada evitando sol directo.<br>
                • <b>Girasol:</b> Excelente comportamiento en perfiles con buena infiltración.<br>
                • <b>Sorgo Granífero y Forrajero:</b> Ideal para lotes con menor potencial hídrico; sembrar al estabilizarse el suelo sobre los 16°C.
            `;
            queNoSembrar = `
                • <b>TRIGO PAN Y CEBADA CERVECERA:</b> Terminantemente prohibido sembrar ahora. Fuera de época absoluta: no cumplirían requerimiento de vernalización (horas de frío) y sufrirían golpe de calor severo y esterilidad en espigazón.<br>
                • <b>LEGUMINOSAS DE INVIERNO (Vicia / Arveja):</b> Ventana de implantación cerrada.
            `;
            alertasDesvelo = `
                • <b>Heladas tardías en bajos:</b> Si la mínima cae por debajo de 4°C en superficie, frenar tolvas para evitar daño letal en cotiledones emergidos.<br>
                • <b>Plagas de emergencia:</b> Monitorear noctuidos (Oruga Cortadora) y chinches de los cuernos con umbral de 1 individuo cada 2 metros lineales.<br>
                • <b>Inversión térmica:</b> Con viento menor a 5-7 km/h, NO pulverizar: las microgotas quedan flotando y derivan kilómetros al calentarse la mañana.
            `;
            precaucionesCuidados = `
                • <b>Cama de siembra y Humedad (${hum}%):</b> Mantener cobertura de rastrojo en siembra directa para conservar el agua útil del perfil.<br>
                • <b>Control de malezas difíciles:</b> Asegurar barbecho limpio de Rama Negra (Conyza) y Yuyo Colorado (Amaranthus) antes del cierre de entresurco.
            `;
        } else if (mes >= 4 && mes <= 7) {
            temperaturaSuelo = `${Math.max(7, temp - 2)}°C a ${Math.max(11, temp)}°C a 5 cm de profundidad`;
            queSembrar = `
                • <b>Trigo Pan (Ciclos Largos e Intermedios):</b> Época ideal en ${locNombre}. Objetivo de 250 a 300 plantas/m².<br>
                • <b>Cebada Cervecera y Forrajera:</b> Excelente respuesta en lotes bien drenados con fertilización fosforada de arranque.<br>
                • <b>Cultivos de Cobertura / Servicio:</b> Vicia villosa, Centeno y Avena negra para fijar nitrógeno biológico y suprimir malezas otoñales.<br>
                • <b>Colza / Carinata:</b> Alternativa invernal de alta rentabilidad y excelente antecesor para soja de segunda.
            `;
            queNoSembrar = `
                • <b>MAÍZ, SOJA Y SORGO:</b> Prohibido sembrar en invierno. El suelo frío (&lt;10°C) produce daño por enfriamiento en la imbibición de la semilla y muerte del embrión antes de emerger.
            `;
            alertasDesvelo = `
                • <b>Enfermedades foliares en trigo:</b> Con humedad actual del ${hum}%, monitorear Roya Anaranjada y Mancha Amarilla si el mojado foliar supera las 8 horas.<br>
                • <b>Pulgón verde de los cereales:</b> Vigilar lotes recién emergidos en días templados.
            `;
            precaucionesCuidados = `
                • <b>Fertilización nitrogenada:</b> Aplicar urea tratada o incorporar previo a lluvias de 10-20 mm para evitar pérdidas por volatilización.<br>
                • <b>Compactación:</b> Evitar tránsito de maquinaria pesada si el lote presenta exceso hídrico superficial.
            `;
        } else {
            temperaturaSuelo = `${Math.max(20, temp + 1)}°C a ${Math.max(24, temp + 3)}°C (alta evaporación superficial)`;
            queSembrar = `
                • <b>Soja de Segunda:</b> Siembra inmediata detrás de la cosechadora de trigo para aprovechar la humedad residual del rastrojo.<br>
                • <b>Maíz Tardío / de Segunda:</b> Excelente estrategia defensiva para ubicar la floración femenina (R1) en febrero, escapando al estrés de enero.
            `;
            queNoSembrar = `
                • <b>TRIGO, CEBADA Y AVENA DE GRANO:</b> Prohibido sembrar en verano por fotoperíodo y golpe térmico.
            `;
            alertasDesvelo = `
                • <b>Golpe de calor y estrés hídrico:</b> Con temperaturas &gt;34°C y baja humedad, riesgo de aborto de flores y vainas en soja.<br>
                • <b>Oruga Cogollera (Spodoptera frugiperda) y Chinches:</b> Monitoreo cada 3 días en maíces tardíos y sojas en R3-R5.
            `;
            precaucionesCuidados = `
                • <b>Horario de pulverización estival:</b> Con alta temperatura y humedad del ${hum}%, evitar aplicaciones al mediodía por evaporación de gota antes de llegar al blanco; priorizar primera hora de la mañana o atardecer con viento entre 7 y 15 km/h.
            `;
        }

        cont.innerHTML = `
            <div style="background:#f0fff4; border-left:4px solid #38a169; padding:15px; border-radius:10px; margin-bottom:12px;">
                <b style="color:#22543d; font-size:0.96rem;">🌾 Qué granos y cultivos sembrar hoy con éxito en ${locNombre}:</b>
                <div style="margin-top:6px; font-size:0.88rem; color:#2d3748; line-height:1.5;">${queSembrar}</div>
            </div>

            <div style="background:#fff5f5; border-left:4px solid #e53e3e; padding:15px; border-radius:10px; margin-bottom:12px;">
                <b style="color:#c53030; font-size:0.96rem;">🚫 Qué NO sembrar bajo ningún concepto en esta ventana:</b>
                <div style="margin-top:6px; font-size:0.88rem; color:#2d3748; line-height:1.5;">${queNoSembrar}</div>
            </div>

            <div style="display:flex; flex-direction:column; gap:12px;">
                <div style="background:#f8fafc; padding:14px; border-radius:10px; border:1px solid #e2e8f0;">
                    <b style="color:#2b6cb0; font-size:0.95rem;">🌡️ Condición del Suelo y Cuidados de Implantación:</b>
                    <p style="margin:6px 0 8px 0; font-size:0.88rem; color:#4a5568; line-height:1.5;">
                        • <b>Temperatura estimada del suelo:</b> <b>${temperaturaSuelo}</b>.
                    </p>
                    <div style="font-size:0.86rem; color:#4a5568; line-height:1.5;">${precaucionesCuidados}</div>
                </div>
                <div style="background:#fffaf0; padding:14px; border-radius:10px; border:1px solid #feebc8;">
                    <b style="color:#c05621; font-size:0.95rem;">🚜 Lo que desvela al agricultor hoy (Riesgos y Precauciones):</b>
                    <div style="margin-top:6px; font-size:0.86rem; color:#7b341e; line-height:1.5;">
                        ${alertasDesvelo}
                    </div>
                </div>
            </div>
        `;
    }
}

// 7. MOTOR HÍBRIDO DE NOTIFICACIONES PUSH, SONIDO Y VIBRACIÓN (NUNCA FALLA NI EN IP NI EN LOCALHOST)
function emitirSonidoAlertaM() {
    try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;
        const ctx = new AudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(587.33, ctx.currentTime); // Re5
        osc.frequency.setValueAtTime(880, ctx.currentTime + 0.14); // La5
        gain.gain.setValueAtTime(0.18, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.45);
    } catch (e) {}
}

function dispararBannerPushInAppM(titulo, cuerpo) {
    const banner = document.getElementById('pushSimuladaBannerM');
    const tit = document.getElementById('pushSimuladaTituloM');
    const cue = document.getElementById('pushSimuladaCuerpoM');
    if (!banner) return;
    if (tit) tit.textContent = titulo;
    if (cue) cue.textContent = cuerpo;
    banner.style.display = 'flex';
    emitirSonidoAlertaM();
    if (navigator.vibrate) navigator.vibrate([180, 90, 180]);
    setTimeout(() => { banner.style.display = 'none'; }, 7500);
}

async function activarNotificacionesPushM() {
    registrarClickM("Botón Activar Alertas Push");
    const btn = document.getElementById('btnActivarPushM');

    // Siempre activamos el sonido, la vibración háptica y el Banner Push Superior de AuraTerra
    dispararBannerPushInAppM(
        `🛰️ Alertas Activas en ${ciudadActualM.split(',')[0]}`,
        `Monitoreando umbral de viento (Ley 6.599 / AuraEvents). Vibración y aviso acústico habilitados.`
    );

    if (btn) {
        btn.style.background = '#f0fff4';
        btn.style.color = '#22543d';
        btn.style.borderColor = '#9ae6b4';
        btn.textContent = '🟢 Alertas Activas';
    }

    // Si además estamos en contexto seguro (localhost/HTTPS) y el navegador lo soporta, lanzamos también la del sistema operativo
    if ('Notification' in window && window.isSecureContext) {
        try {
            let perm = Notification.permission;
            if (perm === 'default') {
                perm = await Notification.requestPermission();
            }
            if (perm === 'granted' && 'serviceWorker' in navigator) {
                const reg = await navigator.serviceWorker.ready;
                reg.showNotification("AuraTerra Mobile Activo 🛰️", {
                    body: `Monitoreando ráfagas y alertas legales en ${ciudadActualM}.`,
                    icon: "./img/logoAuraTerra.jpeg"
                });
            }
        } catch (e) {}
    }
}

function evaluarAlertaTemprana12a24hM(lista) {
    const banner = document.getElementById('bannerAlertaTempranaM');
    if (!banner || !Array.isArray(lista)) return;
    const ventana = lista.slice(3, 9);
    const peligro = ventana.find(i => (i.wind.speed * 3.6) >= 24);
    if (peligro) {
        const vMax = Math.round(peligro.wind.speed * 3.6);
        const hora = new Date(peligro.dt * 1000).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
        banner.style.display = 'block';
        banner.innerHTML = `
            <b style="color:#c53030;">⚠️ ALERTA TEMPRANA (12-24 HS):</b> Se prevén ráfagas de <b>${vMax} km/h</b> cerca de las <b>${hora} hs</b>. Asegurar estructuras y suspender aplicaciones.
        `;
        if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
    } else {
        banner.style.display = 'none';
    }
}

function renderizar5DiasM(lista) {
    const cont = document.getElementById('cont5DiasM');
    cont.innerHTML = '';
    let mapa = {};
    lista.forEach(i => {
        const d = new Date(i.dt * 1000);
        const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        if (!mapa[k]) mapa[k] = [];
        mapa[k].push(i);
    });
    const fechas = Object.keys(mapa).slice(0, 5);
    if (!diaClaveM || !fechas.includes(diaClaveM)) diaClaveM = fechas[0];

    fechas.forEach(f => {
        const arr = mapa[f];
        let max = -999, min = 999;
        arr.forEach(x => { if (x.main.temp_max > max) max = x.main.temp_max; if (x.main.temp_min < min) min = x.main.temp_min; });
        const rep = arr.find(x => x.dt_txt?.includes("12:00:00")) || arr[0];
        const nom = new Date(rep.dt * 1000).toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric' });
        const act = (f === diaClaveM);

        const div = document.createElement('div');
        div.className = 'day-card-m';
        div.style.border = act ? '2px solid #3182ce' : '1.5px solid #e2e8f0';
        div.style.background = act ? '#ebf8ff' : '#f8fafc';
        div.innerHTML = `
            <b style="text-transform:capitalize; font-size:0.9rem; color:${act ? '#2b6cb0' : '#2d3748'};">${nom}</b>
            <div style="font-size:1.35rem; font-weight:900; margin:4px 0;">${Math.round(rep.main.temp)}°C</div>
            <div style="font-size:0.78rem; font-weight:700;"><span style="color:#e53e3e;">↑${Math.round(max)}°</span> / <span style="color:#3182ce;">↓${Math.round(min)}°</span></div>
            <small style="color:#718096; font-size:0.74rem; display:block; margin-top:4px;">💨 ${Math.round(rep.wind.speed * 3.6)} km/h</small>
        `;
        div.onclick = () => {
            diaClaveM = f;
            renderizar5DiasM(lista);
            renderizarHorasM(arr, nom);
        };
        cont.appendChild(div);
    });

    if (mapa[diaClaveM]) {
        const nomAct = new Date(mapa[diaClaveM][0].dt * 1000).toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric' });
        renderizarHorasM(mapa[diaClaveM], nomAct);
    }
}

function renderizarHorasM(items, nomDia) {
    document.getElementById('lblTitHorasM').textContent = `🕒 Intervalos (Cada 3 Hs) — ${nomDia}`;
    const cont = document.getElementById('contHorasM');
    cont.innerHTML = '';
    items.forEach(h => {
        const hora = new Date(h.dt * 1000).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
        const t = Math.round(h.main.temp);
        const v = Math.round(h.wind.speed * 3.6);
        const dir = gradosACardinalM(h.wind?.deg);
        let bg = '#f0fff4', bd = '#c6f6d5';
        if (t <= 10) { bg = '#ebf8ff'; bd = '#bee3f8'; }
        else if (t >= 28) { bg = '#fff5f5'; bd = '#fed7d7'; }

        cont.innerHTML += `
            <div class="hour-card-m" style="background:${bg}; border:1.5px solid ${bd};">
                <b style="font-size:0.88rem;">${hora} hs</b>
                <span style="font-size:1.25rem; font-weight:900;">${t}°C</span>
                <small style="font-size:0.74rem; color:#4a5568; text-transform:capitalize;">${h.weather[0].description}</small>
                <small style="font-size:0.74rem; font-weight:700; color:#2b6cb0;">💨 ${v} km/h (${dir})</small>
            </div>
        `;
    });
}

// 8. MODALES INSTITUCIONAL Y ADMIN MOBILE
function abrirModalInstitucionalM() {
    document.getElementById('modalInstitucionalM').classList.add('activa');
}
function cerrarModalInstitucionalM() {
    document.getElementById('modalInstitucionalM').classList.remove('activa');
}

async function abrirModalAdminM() {
    cerrarModalPerfilFavoritosM();
    document.getElementById('modalAdminM').classList.add('activa');
    const boxU = document.getElementById('listaUsuariosAdminM');
    const boxR = document.getElementById('rankingAdminM');
    try {
        const res = await fetch(`${API_BASE_M}?ruta=/admin/telemetria`);
        const d = await res.json();
        if (d.status === 'ok') {
            boxU.innerHTML = '';
            (d.usuarios || []).forEach(u => {
                boxU.innerHTML += `
                    <div style="padding:8px 0; border-bottom:1px solid #edf2f7;">
                        <b>${u.nombre}</b> (${u.email}) — <b>${u.estado.toUpperCase()}</b> | Rol: <b>${u.rol}</b>
                        <div style="display:flex; gap:6px; margin-top:6px;">
                            <select onchange="cambiarUsuarioAdminM(${u.id}, this.value, null)" style="flex:1; padding:4px; border-radius:6px;">
                                <option value="" disabled selected>Estado...</option>
                                <option value="activo">🟢 Activo</option>
                                <option value="prueba">🟠 Prueba</option>
                                <option value="suspendido">🔴 Suspendido</option>
                            </select>
                            <select onchange="cambiarUsuarioAdminM(${u.id}, null, this.value)" style="flex:1; padding:4px; border-radius:6px;">
                                <option value="" disabled selected>Rol...</option>
                                <option value="agricultor">🌾 Agro</option>
                                <option value="planificador">🎪 Eventos</option>
                                <option value="ambos">🌟 Dual</option>
                                <option value="admin">⚙️ Admin</option>
                            </select>
                        </div>
                    </div>
                `;
            });
            boxR.innerHTML = (d.ranking || []).map(r => `<div>• <b>${r.componente_clickeado}</b>: ${r.total} clics</div>`).join('') || 'Sin datos.';
        }
    } catch (e) {}
}

async function cambiarUsuarioAdminM(id, est, rol) {
    const fd = new URLSearchParams();
    fd.append('user_id', id);
    if (est) fd.append('estado', est);
    if (rol) fd.append('rol', rol);
    await fetch(`${API_BASE_M}?ruta=/admin/cambiar_estado`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: fd.toString()
    });
    mostrarToastM("✅ Usuario actualizado.");
    abrirModalAdminM();
}

function cerrarModalAdminM() {
    document.getElementById('modalAdminM').classList.remove('activa');
}

// Inicialización automática al abrir la app móvil
window.addEventListener('DOMContentLoaded', () => {
    const savedEmail = localStorage.getItem('auraterra_remember_email');
    const savedPass = localStorage.getItem('auraterra_remember_pass');
    if (savedEmail && savedPass) {
        document.getElementById('emailLoginM').value = savedEmail;
        document.getElementById('passLoginM').value = savedPass;
        document.getElementById('checkRecordarM').checked = true;
    }

    const keep = localStorage.getItem('auraterra_keep_logged_in');
    const sesion = localStorage.getItem('usuario_web') || localStorage.getItem('usuario');
    if (keep === 'true' && sesion) {
        try {
            const u = JSON.parse(sesion);
            if (u && u.estado !== 'suspendido') {
                iniciarDashboardMobile(u, false);
            }
        } catch (e) {}
    }
});