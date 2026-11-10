document.addEventListener('DOMContentLoaded', renderCart);

function getCart() {
    return JSON.parse(localStorage.getItem('freshcart') || '[]');
}

function saveCart(cart) {
    localStorage.setItem('freshcart', JSON.stringify(cart));
    if (typeof updateGlobalCartCount === 'function') {
        updateGlobalCartCount();
    }
}

function renderCart() {
    const container = document.getElementById('cartItemsContainer');
    const subtotalEl = document.getElementById('subtotalAmount');
    const totalEl = document.getElementById('totalAmount');
    
    if (!container) return;

    const cart = getCart();

    if (cart.length === 0) {
        container.innerHTML = `
            <div class="empty-cart">
                <i class="fa-solid fa-cart-shopping" style="font-size: 3rem; margin-bottom: 20px; color: var(--border-color);"></i>
                <h2>Your cart is empty</h2>
                <p style="margin-top: 10px; margin-bottom: 20px;">Looks like you haven't added any groceries yet.</p>
                <a href="products.html" class="btn btn-primary">Start Shopping</a>
            </div>
        `;
        subtotalEl.textContent = 'Rs. 0.00';
        totalEl.textContent = 'Rs. 0.00';
        const deliveryEl = document.getElementById('deliveryAmount');
        if (deliveryEl) deliveryEl.textContent = 'Rs. 0.00';
        return;
    }

    container.innerHTML = '';
    let subtotal = 0;

    cart.forEach(item => {
        subtotal += item.price * item.quantity;

        const unitType = item.unit || 'kg';
        const unitSuffix = (typeof unitSuffixes !== 'undefined') ? (unitSuffixes[unitType] || 'KG') : 'KG';
        const step = ['kg', 'litre', 'darjan'].includes(unitType) ? 0.5 : 1;

        const div = document.createElement('div');
        div.className = 'cart-item';
        div.innerHTML = `
            <img src="${item.image}" alt="${item.name}" class="cart-item-img">
            <div class="cart-item-info">
                <h3 class="cart-item-title">${item.name}</h3>
                <div class="cart-item-price">Rs. ${(item.price * item.quantity).toFixed(2)}</div>
            </div>
            <div class="cart-item-actions">
                <button class="qty-btn" onclick="updateQuantity(${item.id}, -1)">-</button>
                <div class="qty-input-wrapper cart-page-qty-wrapper">
                    <input type="number" value="${item.quantity}" min="0.1" step="${step}" class="qty-number-input cart-page-qty-input" onchange="updateCartInput(${item.id}, this.value)">
                    <span class="qty-unit-label">${unitSuffix}</span>
                </div>
                <button class="qty-btn" onclick="updateQuantity(${item.id}, 1)">+</button>
                <button class="remove-btn" onclick="removeItem(${item.id})">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </div>
        `;
        container.appendChild(div);
    });

    const deliveryFee = subtotal > 0 ? 50 : 0;
    const deliveryEl = document.getElementById('deliveryAmount');
    if (deliveryEl) deliveryEl.textContent = `Rs. ${deliveryFee.toFixed(2)}`;
    subtotalEl.textContent = `Rs. ${subtotal.toFixed(2)}`;
    totalEl.textContent = `Rs. ${(subtotal + deliveryFee).toFixed(2)}`;
}

window.updateCartInput = function(id, newValue) {
    let cart = getCart();
    const index = cart.findIndex(item => item.id === id);
    if (index >= 0) {
        let parsed = parseFloat(newValue);
        if (isNaN(parsed) || parsed <= 0) {
            cart.splice(index, 1);
        } else {
            cart[index].quantity = Math.round(parsed * 100) / 100;
        }
        saveCart(cart);
        renderCart();
    }
}

window.updateQuantity = function(id, direction) {
    let cart = getCart();
    const index = cart.findIndex(item => item.id === id);
    if (index >= 0) {
        const item = cart[index];
        const step = ['kg', 'litre', 'darjan'].includes(item.unit) ? 0.5 : 1;
        item.quantity += direction * step;
        item.quantity = Math.round(item.quantity * 100) / 100;
        if (item.quantity <= 0) {
            cart.splice(index, 1);
        }
        saveCart(cart);
        renderCart();
    }
}

window.removeItem = function(id) {
    let cart = getCart();
    cart = cart.filter(item => item.id !== id);
    saveCart(cart);
    renderCart();
}

