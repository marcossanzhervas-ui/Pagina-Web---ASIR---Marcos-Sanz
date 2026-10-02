/* Luma: carrito + pedidos + catálogo + registro de visitas (Supabase) */

(function () {
    'use strict';

    /* ---------- Cliente Supabase (único para toda la web) ---------- */
    const hasSupabaseConfig =
        window.LUMA_SUPABASE_URL &&
        window.LUMA_SUPABASE_PUBLISHABLE_KEY &&
        !window.LUMA_SUPABASE_URL.includes('TU-PROYECTO') &&
        !window.LUMA_SUPABASE_PUBLISHABLE_KEY.includes('TU_CLAVE_PUBLICA');

    const client = (hasSupabaseConfig && window.supabase)
        ? window.supabase.createClient(
            window.LUMA_SUPABASE_URL,
            window.LUMA_SUPABASE_PUBLISHABLE_KEY,
            { auth: { persistSession: false } }
        )
        : null;

    function uuid() {
        return (window.crypto && crypto.randomUUID)
            ? crypto.randomUUID()
            : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
                const r = Math.random() * 16 | 0;
                return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
            });
    }

    function escapeHtml(value) {
        return String(value).replace(/[&<>"']/g, (ch) => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[ch]));
    }

    /* ---------- Tienda (solo si la página tiene carrito) ---------- */
    function initShop() {
        const modal = document.getElementById('purchaseModal');
        const cartButton = document.querySelector('.cart-button');
        const cartItemsList = document.getElementById('cartItems');
        const cartCount = document.getElementById('cartCount');
        const cartTotal = document.getElementById('cartTotal');
        const clearCartButton = document.getElementById('clearCart');
        const continueShoppingButton = document.getElementById('continueShopping');
        const purchaseSummary = document.querySelector('.purchase-summary strong');
        const closeButton = document.querySelector('.close-modal');
        const purchaseForm = document.querySelector('.purchase-modal form');
        const submitButton = document.querySelector('.purchase-submit');

        // Páginas sin carrito (quiénes somos, contacto, admin): no hacer nada.
        if (!modal || !cartButton || !cartItemsList || !purchaseForm) return;

        const cart = [];
        const catalogPrices = {}; // nombre -> precio (se rellena desde Supabase)

        function formatPrice(value) {
            return '$' + Number(value);
        }

        function priceOf(name, fallback) {
            return catalogPrices[name] != null ? catalogPrices[name] : fallback;
        }

        function renderCart() {
            const total = cart.reduce((sum, item) => sum + item.price, 0);
            cartCount.textContent = cart.length;
            cartTotal.textContent = formatPrice(total);
            if (purchaseSummary) purchaseSummary.textContent = formatPrice(total);

            if (cart.length === 0) {
                cartItemsList.innerHTML = '<li class="empty-cart">Aún no has añadido nada.</li>';
                return;
            }

            cartItemsList.innerHTML = cart.map((item) => `
                <li class="cart-item" data-item-id="${escapeHtml(item.id)}">
                    <div class="cart-item-meta">
                        <span class="cart-item-name">${escapeHtml(item.name)}</span>
                        <span class="cart-item-type">${escapeHtml(item.type)}</span>
                    </div>
                    <div class="cart-item-actions">
                        <span class="cart-item-price">${formatPrice(item.price)}</span>
                        <button type="button" class="cart-remove-item" data-remove-item="${escapeHtml(item.id)}" aria-label="Eliminar ${escapeHtml(item.name)}">×</button>
                    </div>
                </li>
            `).join('');
        }

        function addToCart(type, name, price) {
            cart.push({ id: uuid(), type, name, price: Number(price) });
            renderCart();
            cartButton.classList.add('is-open');
        }

        function removeFromCart(itemId) {
            const index = cart.findIndex((item) => item.id === itemId);
            if (index === -1) return;
            cart.splice(index, 1);
            renderCart();
        }

        function openModal() {
            modal.classList.add('is-open');
            modal.setAttribute('aria-hidden', 'false');
            cartButton.classList.remove('is-open');
        }

        function closeModal() {
            modal.classList.remove('is-open');
            modal.setAttribute('aria-hidden', 'true');
        }

        /* Menús: solo los que tienen datos de producto (index.html) */
        document.querySelectorAll('.nav-menu a[data-product-name]').forEach((menuItem) => {
            menuItem.addEventListener('click', (event) => {
                event.preventDefault();
                addToCart(
                    menuItem.dataset.productType,
                    menuItem.dataset.productName,
                    Number(menuItem.dataset.productPrice)
                );
            });
        });

        const addProductBtn = document.querySelector('[data-add-product]');
        const addServiceBtn = document.querySelector('[data-add-service]');

        if (addProductBtn) {
            addProductBtn.addEventListener('click', () => {
                addToCart('Producto', 'Lámpara de pared', priceOf('Lámpara de pared', 48));
            });
        }
        if (addServiceBtn) {
            addServiceBtn.addEventListener('click', () => {
                addToCart('Servicio', 'Instalación a medida', priceOf('Instalación a medida', 39));
            });
        }

        cartButton.addEventListener('click', () => cartButton.classList.toggle('is-open'));

        cartItemsList.addEventListener('click', (event) => {
            const removeButton = event.target.closest('[data-remove-item]');
            if (removeButton) removeFromCart(removeButton.dataset.removeItem);
        });

        if (clearCartButton) {
            clearCartButton.addEventListener('click', () => { cart.length = 0; renderCart(); });
        }
        if (continueShoppingButton) {
            continueShoppingButton.addEventListener('click', () => cartButton.classList.remove('is-open'));
        }

        document.querySelectorAll('[data-open-purchase]').forEach((button) => {
            button.addEventListener('click', (event) => {
                event.preventDefault();
                openModal();
            });
        });

        if (closeButton) closeButton.addEventListener('click', closeModal);
        modal.addEventListener('click', (event) => { if (event.target === modal) closeModal(); });
        document.addEventListener('keydown', (event) => { if (event.key === 'Escape') closeModal(); });

        /* Pago: guarda el pedido en Supabase (SIN datos de tarjeta) */
        purchaseForm.addEventListener('submit', async (event) => {
            event.preventDefault();

            if (cart.length === 0) {
                alert('Añade al menos un producto o servicio antes de pagar.');
                return;
            }

            const nombre = document.getElementById('buyerName').value.trim();
            const ral = document.getElementById('ralColor').value;
            const total = cart.reduce((sum, item) => sum + item.price, 0);

            if (client) {
                if (submitButton) { submitButton.disabled = true; submitButton.textContent = 'Procesando...'; }

                const pedidoId = uuid();
                const { error: orderError } = await client
                    .from('pedidos')
                    .insert({ id: pedidoId, nombre, ral, total });

                let itemsError = null;
                if (!orderError) {
                    const { error } = await client.from('pedido_items').insert(
                        cart.map((item) => ({
                            pedido_id: pedidoId,
                            tipo: item.type,
                            nombre: item.name,
                            precio: item.price
                        }))
                    );
                    itemsError = error;
                }

                if (submitButton) { submitButton.disabled = false; submitButton.textContent = 'Pagar ahora'; }

                if (orderError || itemsError) {
                    console.error(orderError || itemsError);
                    alert('No se pudo guardar el pedido. Inténtalo de nuevo.');
                    return;
                }
            }

            alert('Pedido registrado con éxito.');
            cart.length = 0;
            renderCart();
            purchaseForm.reset();
            closeModal();
        });

        /* Catálogo: actualiza precios desde Supabase */
        async function loadCatalog() {
            if (!client) return;
            const { data, error } = await client
                .from('catalogo')
                .select('tipo, nombre, precio')
                .eq('activo', true);

            if (error || !data) return;

            data.forEach((row) => { catalogPrices[row.nombre] = Number(row.precio); });

            document.querySelectorAll('.nav-menu a[data-product-name]').forEach((link) => {
                const price = catalogPrices[link.dataset.productName];
                if (price == null) return;
                link.dataset.productPrice = price;
                const label = link.querySelector('.nav-menu-price');
                if (label) label.textContent = formatPrice(price);
            });
        }

        renderCart();
        loadCatalog();
    }

    /* ---------- Registro de visitas ---------- */
    function initVisits() {
        if (!client) return;

        const sessionKey = 'luma_visit_session';
        let sessionId = null;
        try { sessionId = sessionStorage.getItem(sessionKey); } catch (e) { /* ignorar */ }
        if (!sessionId) {
            sessionId = uuid();
            try { sessionStorage.setItem(sessionKey, sessionId); } catch (e) { /* ignorar */ }
        }

        const page = window.location.pathname.split('/').pop() || 'index.html';
        let exitSent = false;

        client.from('visitas').insert({
            pagina: page,
            evento: 'entrada',
            session_id: sessionId,
            user_agent: navigator.userAgent
        }).then(({ error }) => { if (error) console.warn('Visitas:', error.message); });

        window.addEventListener('pagehide', () => {
            if (exitSent) return;
            exitSent = true;

            // keepalive permite que la petición termine aunque la página se cierre.
            fetch(window.LUMA_SUPABASE_URL + '/rest/v1/visitas', {
                method: 'POST',
                keepalive: true,
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': window.LUMA_SUPABASE_PUBLISHABLE_KEY,
                    'Authorization': 'Bearer ' + window.LUMA_SUPABASE_PUBLISHABLE_KEY,
                    'Prefer': 'return=minimal'
                },
                body: JSON.stringify({
                    pagina: page,
                    evento: 'salida',
                    session_id: sessionId,
                    user_agent: navigator.userAgent
                })
            }).catch(() => {});
        });
    }

    // Cada bloque va aislado: si uno falla, el otro sigue funcionando.
    try { initShop(); } catch (e) { console.error('Tienda:', e); }
    try { initVisits(); } catch (e) { console.error('Visitas:', e); }
})();
