// Global script for shared components and interactions

// Auto-load supabase.js if not already present and not already in document
if (!window.supabase && !document.querySelector('script[src="js/supabase.js"]')) {
    const script = document.createElement('script');
    script.src = 'js/supabase.js';
    script.async = false;
    document.head.appendChild(script);
}

const NAVBAR_HTML = `
    <a href="index.html" class="logo">
        <i class="fa-solid fa-leaf"></i> FreshCart
    </a>
    <div class="nav-links" id="navLinks">
        <a href="index.html">Home</a>
        <a href="products.html">Products</a>
        <a href="cart.html">Cart</a>
    </div>
    <div class="nav-icons">
        <button class="icon-btn" id="themeToggle" title="Toggle Dark Mode">
            <i class="fa-solid fa-moon"></i>
        </button>
        <div class="user-menu-container" id="userMenuContainer" style="position: relative; display: inline-block;">
            <a href="login.html" class="icon-btn" id="loginNavBtn" title="Login">
                <i class="fa-regular fa-user"></i>
            </a>
            <div class="user-dropdown" id="userDropdown">
                <p id="userDropdownName" style="font-weight: 600; margin-bottom: 5px; color: var(--text-dark);"></p>
                <p id="userDropdownRole" style="font-size: 0.8rem; color: var(--primary-color); text-transform: uppercase; font-weight: bold; margin-bottom: 10px;"></p>
                <hr style="border: 0; border-top: 1px solid var(--border-color); margin: 10px 0;">
                <a href="orders.html" style="display: flex; color: var(--text-dark); padding: 8px 0; font-weight: 500; font-size: 0.95rem; align-items: center; gap: 8px; margin-bottom: 5px;"><i class="fa-solid fa-box"></i> My Orders</a>
                <a href="admin.html" id="adminDropdownLink" style="display: none; color: var(--text-dark); padding: 8px 0; font-weight: 500; font-size: 0.95rem; align-items: center; gap: 8px; margin-bottom: 5px;"><i class="fa-solid fa-gauge"></i> Admin Dashboard</a>
                <hr id="adminDropdownHr" style="display: none; border: 0; border-top: 1px solid var(--border-color); margin: 10px 0;">
                <button id="signOutBtn" class="btn btn-outline" style="width: 100%; padding: 6px 12px; font-size: 0.9rem; border-radius: 5px; border-width: 1px;">Sign Out</button>
            </div>
        </div>
        <a href="#" class="icon-btn cart-icon-container" id="openCartBtn" title="Cart">
            <i class="fa-solid fa-cart-shopping"></i>
            <span class="cart-count" id="globalCartCount">0</span>
        </a>
        <button class="hamburger" id="hamburgerBtn">
            <i class="fa-solid fa-bars"></i>
        </button>
    </div>
`;

const FOOTER_HTML = `
    <p>&copy; 2026 FreshCart E-commerce. All rights reserved.</p>
`;

document.addEventListener('DOMContentLoaded', () => {
    // Inject components
    const navbars = document.querySelectorAll('.document-navbar');
    navbars.forEach(nav => nav.innerHTML = NAVBAR_HTML);
    
    const footers = document.querySelectorAll('.document-footer');
    footers.forEach(footer => footer.innerHTML = FOOTER_HTML);

    // Initialize Theme
    initTheme();
    
    // Initialize Mobile Menu
    initMobileMenu();

    // Initialize Cart Sidebar
    initCartSidebar();

    // Update global cart counter
    updateGlobalCartCount();

    // Initialize User Menu Dropdown Toggle
    initUserDropdown();

    // Initial Auth Check
    setTimeout(checkAuthOnLoad, 500);
});

// Listen to auth changes
window.addEventListener('auth-changed', (e) => {
    const { session, profile } = e.detail;
    if (session) {
        localStorage.setItem('freshcart_session', JSON.stringify(session));
        if (profile) {
            localStorage.setItem('freshcart_profile', JSON.stringify(profile));
        }
    } else {
        localStorage.removeItem('freshcart_session');
        localStorage.removeItem('freshcart_profile');
    }
    updateNavbarAuthUI(session, profile);
});

function initTheme() {
    const themeBtn = document.getElementById('themeToggle');
    const root = document.documentElement;
    const isDark = localStorage.getItem('theme') === 'dark';

    if (isDark) {
        root.setAttribute('data-theme', 'dark');
        if (themeBtn) themeBtn.innerHTML = '<i class="fa-solid fa-sun"></i>';
    }

    if (themeBtn) {
        themeBtn.addEventListener('click', () => {
            const currentTheme = root.getAttribute('data-theme');
            if (currentTheme === 'dark') {
                root.removeAttribute('data-theme');
                localStorage.setItem('theme', 'light');
                themeBtn.innerHTML = '<i class="fa-solid fa-moon"></i>';
            } else {
                root.setAttribute('data-theme', 'dark');
                localStorage.setItem('theme', 'dark');
                themeBtn.innerHTML = '<i class="fa-solid fa-sun"></i>';
            }
        });
    }
}

function initMobileMenu() {
    const hamburgerBtn = document.getElementById('hamburgerBtn');
    const navLinks = document.getElementById('navLinks');

    if (hamburgerBtn && navLinks) {
        hamburgerBtn.addEventListener('click', () => {
            navLinks.classList.toggle('active');
        });
    }
}

function initUserDropdown() {
    const loginBtn = document.getElementById('loginNavBtn');
    const dropdown = document.getElementById('userDropdown');
    const signOutBtn = document.getElementById('signOutBtn');

    if (loginBtn && dropdown) {
        loginBtn.addEventListener('click', (e) => {
            const session = localStorage.getItem('freshcart_session');
            if (session) {
                // If logged in, prevent redirect to login.html and toggle dropdown
                e.preventDefault();
                dropdown.classList.toggle('active');
            }
        });

        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('#userMenuContainer')) {
                dropdown.classList.remove('active');
            }
        });
    }

    if (signOutBtn) {
        signOutBtn.addEventListener('click', async () => {
            if (window.authHelpers) {
                try {
                    await window.authHelpers.signOut();
                } catch (err) {
                    console.error("Sign out failed:", err);
                }
            }
        });
    }
}

async function checkAuthOnLoad() {
    if (window.authHelpers) {
        try {
            const session = await window.authHelpers.getCurrentSession();
            if (session) {
                localStorage.setItem('freshcart_session', JSON.stringify(session));
                const profile = await window.authHelpers.getCurrentProfile();
                if (profile) {
                    localStorage.setItem('freshcart_profile', JSON.stringify(profile));
                }
                updateNavbarAuthUI(session, profile);
            } else {
                localStorage.removeItem('freshcart_session');
                localStorage.removeItem('freshcart_profile');
                updateNavbarAuthUI(null, null);
            }
        } catch (err) {
            console.error("Error in checkAuthOnLoad:", err);
        }
    }
}

function updateNavbarAuthUI(session, profile) {
    const loginBtn = document.getElementById('loginNavBtn');
    const dropdown = document.getElementById('userDropdown');
    const dropdownName = document.getElementById('userDropdownName');
    const dropdownRole = document.getElementById('userDropdownRole');
    const adminLink = document.getElementById('adminDropdownLink');
    const adminHr = document.getElementById('adminDropdownHr');
    const navLinks = document.getElementById('navLinks');

    if (!loginBtn) return;

    if (session && session.user) {
        // Logged in
        loginBtn.innerHTML = `<i class="fa-solid fa-circle-user" style="color: var(--primary-color); font-size: 1.3rem;"></i>`;
        loginBtn.title = "Account Menu";
        loginBtn.setAttribute('href', '#');

        if (dropdownName) {
            const name = profile ? profile.full_name : (session.user.user_metadata?.full_name || session.user.email.split('@')[0]);
            dropdownName.textContent = name;
        }

        if (dropdownRole) {
            const role = profile ? profile.role : 'user';
            dropdownRole.textContent = role;
        }

        // Handle Admin Access
        const isAdmin = profile && profile.role === 'admin';
        if (isAdmin) {
            if (adminLink) adminLink.style.display = 'flex';
            if (adminHr) adminHr.style.display = 'block';

            // Add Admin link to navLinks if not already there
            if (navLinks && !document.getElementById('navAdminLink')) {
                const adminNavLink = document.createElement('a');
                adminNavLink.href = 'admin.html';
                adminNavLink.id = 'navAdminLink';
                adminNavLink.style.color = '#e74c3c'; // Distinct admin color
                adminNavLink.style.fontWeight = 'bold';
                adminNavLink.innerHTML = `<i class="fa-solid fa-gauge-high"></i> Admin`;
                navLinks.appendChild(adminNavLink);
            }
        } else {
            if (adminLink) adminLink.style.display = 'none';
            if (adminHr) adminHr.style.display = 'none';
            const existingAdminLink = document.getElementById('navAdminLink');
            if (existingAdminLink) existingAdminLink.remove();
        }
    } else {
        // Logged out
        loginBtn.innerHTML = `<i class="fa-regular fa-user"></i>`;
        loginBtn.title = "Login";
        loginBtn.setAttribute('href', 'login.html');
        if (dropdown) dropdown.classList.remove('active');

        const existingAdminLink = document.getElementById('navAdminLink');
        if (existingAdminLink) existingAdminLink.remove();
    }
}

// Checkout Security Check
window.checkoutCheck = function(e) {
    const session = localStorage.getItem('freshcart_session');
    if (!session) {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }
        alert("Please Log In or Sign Up to complete your purchase!");
        const currentLoc = window.location.pathname.split('/').pop() || 'index.html';
        window.location.href = "login.html?redirect=" + encodeURIComponent(currentLoc);
        return false;
    }
    return true;
};

function updateGlobalCartCount() {
    const cartCountEl = document.getElementById('globalCartCount');
    const floatingCountEl = document.getElementById('floatingCartCount');
    if (cartCountEl || floatingCountEl) {
        const cart = JSON.parse(localStorage.getItem('freshcart') || '[]');
        const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
        if (cartCountEl) cartCountEl.textContent = totalItems;
        if (floatingCountEl) floatingCountEl.textContent = totalItems;
        
        const floatingBtn = document.getElementById('floatingCartBtn');
        if (floatingBtn) {
            floatingBtn.style.display = totalItems > 0 ? 'flex' : 'none';
        }
    }
}

function initCartSidebar() {
    // Inject cart HTML
    const cartHTML = `
        <div class="cart-overlay" id="cartOverlay"></div>
        <div class="cart-sidebar" id="cartSidebar">
            <div class="cart-header">
                <h2>Your Cart</h2>
                <button class="close-cart" id="closeCartBtn"><i class="fa-solid fa-xmark"></i></button>
            </div>
            <div class="cart-items" id="sidebarCartItems">
                <!-- Items will be injected here -->
            </div>
            <div class="cart-footer" id="sidebarCartFooter">
                <!-- Bill Summary will be injected here -->
            </div>
        </div>
        <button class="floating-cart-btn" id="floatingCartBtn">
            <i class="fa-solid fa-cart-shopping"></i> View Bill (<span id="floatingCartCount">0</span>)
        </button>
    `;
    
    // Prevent duplicate insertion
    if (!document.getElementById('cartSidebar')) {
        document.body.insertAdjacentHTML('beforeend', cartHTML);
    }

    const openBtns = document.querySelectorAll('#openCartBtn');
    const floatingBtn = document.getElementById('floatingCartBtn');
    const closeBtn = document.getElementById('closeCartBtn');
    const overlay = document.getElementById('cartOverlay');
    const sidebar = document.getElementById('cartSidebar');

    const openSidebar = (e) => {
        if (e) e.preventDefault();
        renderSidebarCart();
        overlay.classList.add('active');
        sidebar.classList.add('active');
    };

    openBtns.forEach(btn => btn.addEventListener('click', openSidebar));
    if (floatingBtn) floatingBtn.addEventListener('click', openSidebar);

    const closeCart = () => {
        overlay.classList.remove('active');
        sidebar.classList.remove('active');
    };

    if (closeBtn) closeBtn.addEventListener('click', closeCart);
    if (overlay) overlay.addEventListener('click', closeCart);
}

window.renderSidebarCart = function() {
    const container = document.getElementById('sidebarCartItems');
    const footerEl = document.getElementById('sidebarCartFooter');
    if (!container || !footerEl) return;

    let cart = JSON.parse(localStorage.getItem('freshcart') || '[]');
    container.innerHTML = '';
    
    if (cart.length === 0) {
        container.innerHTML = '<p style="text-align:center; color:var(--text-light); margin-top:20px;">Your cart is empty.</p>';
        footerEl.innerHTML = '';
        return;
    }

    let total = 0;
    cart.forEach(item => {
        total += item.price * item.quantity;
        const div = document.createElement('div');
        div.className = 'cart-item';

        const unitType = item.unit || 'kg';
        const unitSuffix = (typeof unitSuffixes !== 'undefined') ? (unitSuffixes[unitType] || 'KG') : 'KG';
        const step = ['kg', 'litre', 'darjan'].includes(unitType) ? 0.5 : 1;

        div.innerHTML = `
            <img src="${item.image}" alt="${item.name}">
            <div class="cart-item-details">
                <div class="cart-item-title">${item.name}</div>
                <div class="cart-item-price">Rs. ${(item.price * item.quantity).toFixed(2)}</div>
                <div class="cart-qty-controls">
                    <button class="qty-btn" onclick="updateSidebarCartQty(${item.id}, -1)">-</button>
                    <div class="qty-input-wrapper sidebar-qty-wrapper">
                        <input type="number" value="${item.quantity}" min="0.1" step="${step}" class="qty-number-input sidebar-qty-input" onchange="updateSidebarCartInput(${item.id}, this.value)">
                        <span class="qty-unit-label">${unitSuffix}</span>
                    </div>
                    <button class="qty-btn" onclick="updateSidebarCartQty(${item.id}, 1)">+</button>
                    <button class="remove-item" onclick="removeSidebarCartItem(${item.id})"><i class="fa-solid fa-trash"></i></button>
                </div>
            </div>
        `;
        container.appendChild(div);
    });

    let deliveryFee = total > 0 ? 50 : 0;
    let finalTotal = total + deliveryFee;

    footerEl.innerHTML = `
        <div class="bill-summary">
            <div class="bill-row">
                <span>Subtotal:</span>
                <span>Rs. ${total.toFixed(2)}</span>
            </div>
            <div class="bill-row">
                <span>Delivery Fee:</span>
                <span>Rs. ${deliveryFee.toFixed(2)}</span>
            </div>
            <div class="bill-total-row">
                <span>Total Amount:</span>
                <span>Rs. ${finalTotal.toFixed(2)}</span>
            </div>
        </div>
        <button class="btn btn-primary" style="width: 100%; background-color: #60BB46;" onclick="if(checkoutCheck(event)) window.location.href='checkout.html'">Proceed to Checkout</button>
    `;
};

window.updateSidebarCartQty = function(id, direction) {
    let cart = JSON.parse(localStorage.getItem('freshcart') || '[]');
    const index = cart.findIndex(item => item.id === id);
    if (index >= 0) {
        const item = cart[index];
        const step = ['kg', 'litre', 'darjan'].includes(item.unit) ? 0.5 : 1;
        item.quantity += direction * step;
        item.quantity = Math.round(item.quantity * 100) / 100;
        if (item.quantity <= 0) {
            cart.splice(index, 1);
        }
        localStorage.setItem('freshcart', JSON.stringify(cart));
        renderSidebarCart();
        updateGlobalCartCount();
    }
};

window.updateSidebarCartInput = function(id, newValue) {
    let cart = JSON.parse(localStorage.getItem('freshcart') || '[]');
    const index = cart.findIndex(item => item.id === id);
    if (index >= 0) {
        let parsed = parseFloat(newValue);
        if (isNaN(parsed) || parsed <= 0) {
            cart.splice(index, 1);
        } else {
            cart[index].quantity = Math.round(parsed * 100) / 100;
        }
        localStorage.setItem('freshcart', JSON.stringify(cart));
        renderSidebarCart();
        updateGlobalCartCount();
    }
};

window.removeSidebarCartItem = function(id) {
    let cart = JSON.parse(localStorage.getItem('freshcart') || '[]');
    cart = cart.filter(item => item.id !== id);
    localStorage.setItem('freshcart', JSON.stringify(cart));
    renderSidebarCart();
    updateGlobalCartCount();
};

