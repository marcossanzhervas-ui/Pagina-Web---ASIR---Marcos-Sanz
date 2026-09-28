(function () {
    const configured =
        window.LUMA_SUPABASE_URL &&
        window.LUMA_SUPABASE_PUBLISHABLE_KEY &&
        !window.LUMA_SUPABASE_URL.includes("TU-PROYECTO") &&
        !window.LUMA_SUPABASE_PUBLISHABLE_KEY.includes("TU_CLAVE_PUBLICA");

    const loginBox = document.getElementById('loginBox');
    const dashboard = document.getElementById('dashboard');
    const loginForm = document.getElementById('loginForm');
    const loginMessage = document.getElementById('loginMessage');
    const dashboardMessage = document.getElementById('dashboardMessage');
    const table = document.getElementById('visitsTable');

    if (!configured || !window.supabase) {
        loginMessage.textContent = 'Configura primero supabase-config.js.';
        return;
    }

    const client = window.supabase.createClient(
        window.LUMA_SUPABASE_URL,
        window.LUMA_SUPABASE_PUBLISHABLE_KEY
    );

    async function loadVisits() {
        dashboardMessage.textContent = 'Cargando...';
        const { data, error } = await client
            .from('visitas')
            .select('id, created_at, pagina, evento, session_id')
            .order('created_at', { ascending: false })
            .limit(200);

        if (error) {
            dashboardMessage.textContent = error.message;
            return;
        }

        document.getElementById('totalVisits').textContent = data.length;
        document.getElementById('entryVisits').textContent = data.filter(v => v.evento === 'entrada').length;
        document.getElementById('exitVisits').textContent = data.filter(v => v.evento === 'salida').length;

        table.innerHTML = data.map(v => `
            <tr>
                <td>${new Date(v.created_at).toLocaleString('es-ES')}</td>
                <td>${v.pagina}</td>
                <td>${v.evento}</td>
                <td title="${v.session_id}">${v.session_id.slice(0, 8)}…</td>
            </tr>
        `).join('');
        dashboardMessage.textContent = '';
    }

    async function updateUI() {
        const { data: { session } } = await client.auth.getSession();
        const loggedIn = !!session;
        loginBox.hidden = loggedIn;
        dashboard.hidden = !loggedIn;
        if (loggedIn) loadVisits();
    }

    loginForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        loginMessage.textContent = 'Entrando...';
        const { error } = await client.auth.signInWithPassword({
            email: document.getElementById('adminEmail').value,
            password: document.getElementById('adminPassword').value
        });
        loginMessage.textContent = error ? error.message : '';
        await updateUI();
    });

    document.getElementById('refreshVisits').addEventListener('click', loadVisits);
    document.getElementById('logout').addEventListener('click', async () => {
        await client.auth.signOut();
        await updateUI();
    });

    updateUI();
})();
