(function () {
    'use strict';

    const $ = (id) => document.getElementById(id);

    const authBox = $('authBox');
    const accountBox = $('accountBox');
    const dashboard = $('dashboard');
    const loginForm = $('loginForm');
    const registerForm = $('registerForm');
    const authMessage = $('authMessage');
    const dashboardMessage = $('dashboardMessage');

    const configured =
        window.LUMA_SUPABASE_URL &&
        window.LUMA_SUPABASE_PUBLISHABLE_KEY &&
        !window.LUMA_SUPABASE_URL.includes('TU-PROYECTO') &&
        !window.LUMA_SUPABASE_PUBLISHABLE_KEY.includes('TU_CLAVE_PUBLICA');

    if (!configured || !window.supabase) {
        authMessage.textContent = 'Configura primero supabase-config.js.';
        return;
    }

    const client = window.supabase.createClient(
        window.LUMA_SUPABASE_URL,
        window.LUMA_SUPABASE_PUBLISHABLE_KEY
    );

    function escapeHtml(value) {
        return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[ch]));
    }

    function friendlyError(error) {
        const msg = (error && error.message) || '';
        if (/invalid login/i.test(msg)) return 'Email o contraseña incorrectos.';
        if (/already registered/i.test(msg)) return 'Ese email ya tiene una cuenta.';
        if (/email not confirmed/i.test(msg)) return 'Confirma tu email antes de entrar (revisa tu correo).';
        if (/password/i.test(msg)) return 'La contraseña debe tener al menos 6 caracteres.';
        if (/rate limit/i.test(msg)) return 'Demasiados intentos. Espera un momento.';
        return msg || 'Ha ocurrido un error.';
    }

    /* ---------- Pestañas login / registro ---------- */
    function showTab(tab) {
        const isLogin = tab === 'login';
        loginForm.hidden = !isLogin;
        registerForm.hidden = isLogin;
        $('tabLogin').className = 'btn ' + (isLogin ? 'btn-primary' : 'btn-secondary');
        $('tabRegister').className = 'btn ' + (isLogin ? 'btn-secondary' : 'btn-primary');
        authMessage.textContent = '';
    }
    $('tabLogin').addEventListener('click', () => showTab('login'));
    $('tabRegister').addEventListener('click', () => showTab('register'));

    /* ---------- Datos del panel admin ---------- */
    async function loadVisits() {
        dashboardMessage.textContent = 'Cargando...';
        const { data, error } = await client
            .from('visitas')
            .select('id, created_at, pagina, evento, session_id')
            .order('created_at', { ascending: false })
            .limit(200);

        if (error) { dashboardMessage.textContent = error.message; return; }

        $('totalVisits').textContent = data.length;
        $('entryVisits').textContent = data.filter(v => v.evento === 'entrada').length;
        $('exitVisits').textContent = data.filter(v => v.evento === 'salida').length;

        $('visitsTable').innerHTML = data.map(v => `
            <tr>
                <td>${escapeHtml(new Date(v.created_at).toLocaleString('es-ES'))}</td>
                <td>${escapeHtml(v.pagina)}</td>
                <td>${escapeHtml(v.evento)}</td>
                <td title="${escapeHtml(v.session_id)}">${escapeHtml(v.session_id.slice(0, 8))}…</td>
            </tr>
        `).join('');
        dashboardMessage.textContent = '';
    }

    async function loadUsers() {
        const { data, error } = await client
            .from('profiles')
            .select('id, created_at, nombre, email, role')
            .order('created_at', { ascending: false })
            .limit(200);

        if (error) { dashboardMessage.textContent = error.message; return; }

        $('totalUsers').textContent = data.length;
        $('usersTable').innerHTML = data.map(u => `
            <tr>
                <td>${escapeHtml(new Date(u.created_at).toLocaleString('es-ES'))}</td>
                <td>${escapeHtml(u.nombre || '—')}</td>
                <td>${escapeHtml(u.email)}</td>
                <td>${escapeHtml(u.role)}</td>
            </tr>
        `).join('');
    }

    // ?volver=index.html -> tras iniciar sesión se regresa a esa página (solo archivos .html locales)
    const volverParam = new URLSearchParams(window.location.search).get('volver');
    const volver = /^[a-z0-9\-]+\.html$/i.test(volverParam || '') ? volverParam : null;

    /* ---------- Qué se muestra según sesión y rol ---------- */
    async function updateUI() {
        const { data: { session } } = await client.auth.getSession();

        authBox.hidden = !!session;
        accountBox.hidden = true;
        dashboard.hidden = true;

        if (!session) {
            $('pageTitle').textContent = 'Acceso';
            $('pageLead').textContent = volver
                ? 'Inicia sesión o crea una cuenta para completar tu compra.'
                : 'Inicia sesión o crea una cuenta de usuario.';
            return;
        }

        if (volver) {
            window.location.href = volver;
            return;
        }

        const { data: profile } = await client
            .from('profiles')
            .select('nombre, email, role')
            .eq('id', session.user.id)
            .maybeSingle();

        const role = profile ? profile.role : 'usuario';

        if (role === 'admin') {
            $('pageTitle').textContent = 'Panel de administración';
            $('pageLead').textContent = 'Visitas y usuarios registrados en Supabase.';
            dashboard.hidden = false;
            loadVisits();
            loadUsers();
        } else {
            $('pageTitle').textContent = 'Mi cuenta';
            $('pageLead').textContent = 'Has iniciado sesión correctamente.';
            $('accountName').textContent = 'Hola, ' + ((profile && profile.nombre) || 'usuario');
            $('accountEmail').textContent = (profile && profile.email) || session.user.email;
            accountBox.hidden = false;
        }
    }

    /* ---------- Acciones ---------- */
    loginForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        authMessage.textContent = 'Entrando...';
        const { error } = await client.auth.signInWithPassword({
            email: $('loginEmail').value.trim(),
            password: $('loginPassword').value
        });
        authMessage.textContent = error ? friendlyError(error) : '';
        if (!error) { loginForm.reset(); await updateUI(); }
    });

    registerForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        authMessage.textContent = 'Creando cuenta...';
        const { data, error } = await client.auth.signUp({
            email: $('registerEmail').value.trim(),
            password: $('registerPassword').value,
            options: { data: { nombre: $('registerName').value.trim() } }
        });

        if (error) { authMessage.textContent = friendlyError(error); return; }

        registerForm.reset();
        if (data.session) {
            authMessage.textContent = '';
            await updateUI();
        } else {
            // Supabase exige confirmar el email antes de poder entrar.
            showTab('login');
            authMessage.textContent = 'Cuenta creada. Revisa tu correo para confirmarla y luego inicia sesión.';
        }
    });

    async function doLogout() {
        await client.auth.signOut();
        await updateUI();
    }

    $('refreshVisits').addEventListener('click', () => { loadVisits(); loadUsers(); });
    $('logout').addEventListener('click', doLogout);
    $('logoutUser').addEventListener('click', doLogout);

    updateUI();
})();
