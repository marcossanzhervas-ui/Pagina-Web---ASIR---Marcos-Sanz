/* Luma: funcionalidades existentes + registro de visitas en Supabase */

const modal = document.getElementById('purchaseModal');
        const triggerButtons = document.querySelectorAll('[data-open-purchase]');
        const closeButton = document.querySelector('.close-modal');
        const purchaseButton = document.querySelector('.purchase-submit');
        const cartButton = document.querySelector('.cart-button');
        const cartItemsList = document.getElementById('cartItems');
        const cartCount = document.getElementById('cartCount');
        const cartTotal = document.getElementById('cartTotal');
        const clearCartButton = document.getElementById('clearCart');
        const continueShoppingButton = document.getElementById('continueShopping');
        const purchaseSummary = document.querySelector('.purchase-summary strong');

        const cart = [
            { id: 'product-1', type: 'Producto', name: 'Lámpara de pared', price: 48 },
            { id: 'service-1', type: 'Servicio', name: 'Instalación a medida', price: 49 }
        ];

        function formatPrice(value) {
            return `$${value}`;
        }

        function renderCart() {
            const total = cart.reduce((sum, item) => sum + item.price, 0);
            cartCount.textContent = cart.length;
            cartTotal.textContent = formatPrice(total);
            purchaseSummary.textContent = formatPrice(total);

            if (cart.length === 0) {
                cartItemsList.innerHTML = '<li class="empty-cart">Aún no has añadido nada.</li>';
                return;
            }

            cartItemsList.innerHTML = cart.map((item) => `
                <li class="cart-item" data-item-id="${item.id}">
                    <div class="cart-item-meta">
                        <span class="cart-item-name">${item.name}</span>
                        <span class="cart-item-type">${item.type}</span>
                    </div>
                    <div class="cart-item-actions">
                        <span class="cart-item-price">${formatPrice(item.price)}</span>
                        <button type="button" class="cart-remove-item" data-remove-item="${item.id}" aria-label="Eliminar ${item.name}">×</button>
                    </div>
                </li>
            `).join('');
        }

        function addToCart(type, name, price) {
            cart.push({ id: `${type.toLowerCase()}-${Date.now()}-${Math.random().toString(16).slice(2)}`, type, name, price });
            renderCart();
            cartButton.classList.add('is-open');
        }

        function removeFromCart(itemId) {
            const itemIndex = cart.findIndex((item) => item.id === itemId);
            if (itemIndex === -1) return;

            cart.splice(itemIndex, 1);
            renderCart();
        }

        document.querySelectorAll('.nav-menu a').forEach((menuItem) => {
            menuItem.addEventListener('click', (event) => {
                event.preventDefault();
                const type = menuItem.dataset.productType;
                const name = menuItem.dataset.productName;
                const price = Number(menuItem.dataset.productPrice);
                addToCart(type, name, price);
            });
        });

        document.querySelector('[data-add-product]').addEventListener('click', () => {
            addToCart('Producto', 'Lámpara de pared', 48);
        });

        document.querySelector('[data-add-service]').addEventListener('click', () => {
            addToCart('Servicio', 'Instalación a medida', 49);
        });

        cartButton.addEventListener('click', () => {
            cartButton.classList.toggle('is-open');
        });

        cartItemsList.addEventListener('click', (event) => {
            const removeButton = event.target.closest('[data-remove-item]');
            if (!removeButton) return;

            removeFromCart(removeButton.dataset.removeItem);
        });

        clearCartButton.addEventListener('click', () => {
            cart.length = 0;
            renderCart();
        });

        continueShoppingButton.addEventListener('click', () => {
            cartButton.classList.remove('is-open');
        });

        triggerButtons.forEach((button) => {
            button.addEventListener('click', (event) => {
                event.preventDefault();
                modal.classList.add('is-open');
                modal.setAttribute('aria-hidden', 'false');
                cartButton.classList.remove('is-open');
            });
        });

        closeButton.addEventListener('click', () => {
            modal.classList.remove('is-open');
            modal.setAttribute('aria-hidden', 'true');
        });

        modal.addEventListener('click', (event) => {
            if (event.target === modal) {
                modal.classList.remove('is-open');
                modal.setAttribute('aria-hidden', 'true');
            }
        });

        purchaseButton.addEventListener('click', (event) => {
            event.preventDefault();
            if (cart.length === 0) {
                alert('Añade al menos un producto o servicio antes de pagar.');
                return;
            }
            alert('Compra realizada con éxito.');
            cart.length = 0;
            renderCart();
            modal.classList.remove('is-open');
            modal.setAttribute('aria-hidden', 'true');
        });

        renderCart();

(function () {
    const hasSupabaseConfig =
        window.LUMA_SUPABASE_URL &&
        window.LUMA_SUPABASE_PUBLISHABLE_KEY &&
        !window.LUMA_SUPABASE_URL.includes("TU-PROYECTO") &&
        !window.LUMA_SUPABASE_PUBLISHABLE_KEY.includes("TU_CLAVE_PUBLICA");

    if (!hasSupabaseConfig || !window.supabase) return;

    const client = window.supabase.createClient(
        window.LUMA_SUPABASE_URL,
        window.LUMA_SUPABASE_PUBLISHABLE_KEY,
        { auth: { persistSession: false } }
    );

    const sessionKey = "luma_visit_session";
    let sessionId = sessionStorage.getItem(sessionKey);
    if (!sessionId) {
        sessionId = (crypto.randomUUID ? crypto.randomUUID() : Date.now() + "-" + Math.random());
        sessionStorage.setItem(sessionKey, sessionId);
    }

    const page = window.location.pathname.split('/').pop() || 'index.html';
    let exitSent = false;

    function recordVisit(event) {
        return client.from('visitas').insert({
            pagina: page,
            evento: event,
            session_id: sessionId,
            user_agent: navigator.userAgent
        });
    }

    recordVisit('entrada');

    window.addEventListener('pagehide', () => {
        if (exitSent) return;
        exitSent = true;

        const url = window.LUMA_SUPABASE_URL + '/rest/v1/visitas';
        const body = JSON.stringify({
            pagina: page,
            evento: 'salida',
            session_id: sessionId,
            user_agent: navigator.userAgent
        });

        // keepalive permite que la petición continúe durante la navegación/cierre.
        fetch(url, {
            method: 'POST',
            keepalive: true,
            headers: {
                'Content-Type': 'application/json',
                'apikey': window.LUMA_SUPABASE_PUBLISHABLE_KEY,
                'Authorization': 'Bearer ' + window.LUMA_SUPABASE_PUBLISHABLE_KEY,
                'Prefer': 'return=minimal'
            },
            body
        }).catch(() => {});
    });
})();
