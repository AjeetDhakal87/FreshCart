// Admin Dashboard Core Logic

let allProducts = [];
let allOrders = [];
let allUsers = [];
let allStatusHistory = [];
let activeView = 'dashboard';
let orderStatusFilter = 'all'; // 'all', 'Pending', 'Processing', 'Shipping', 'Delivered', 'Cancelled', 'History'
let liveAgingInterval = null;
let adminProfile = null; // stores the current logged-in admin's profile

// Configurable warning thresholds in days for active statuses
const AGING_THRESHOLDS_DAYS = {
    Pending: 2,
    Processing: 2,
    Shipping: 3,
    Shipped: 3
};

// ── Time & Duration Calculation Helpers ─────────────────────────────────────

// Format millisecond duration into clean human-readable text
function formatDuration(ms) {
    if (isNaN(ms) || ms < 0) ms = 0;
    const totalSeconds = Math.floor(ms / 1000);
    const totalMinutes = Math.floor(totalSeconds / 60);
    const totalHours = Math.floor(totalMinutes / 60);
    const days = Math.floor(totalHours / 24);
    const remainingHours = totalHours % 24;
    const remainingMinutes = totalMinutes % 60;

    if (days >= 1) {
        if (remainingHours > 0) {
            return `${days} day${days > 1 ? 's' : ''} ${remainingHours} hr${remainingHours > 1 ? 's' : ''}`;
        }
        return `${days} day${days > 1 ? 's' : ''}`;
    }
    if (totalHours >= 1) {
        if (remainingMinutes > 0) {
            return `${totalHours} hr${totalHours > 1 ? 's' : ''} ${remainingMinutes} min`;
        }
        return `${totalHours} hour${totalHours > 1 ? 's' : ''}`;
    }
    if (totalMinutes >= 1) {
        return `${totalMinutes} min${totalMinutes > 1 ? 's' : ''}`;
    }
    return '< 1 min';
}

// Total Order Age: dynamic elapsed time since order creation
function getOrderAge(order, now = new Date()) {
    if (!order || !order.created_at) return 'N/A';
    const created = new Date(order.created_at);
    const diff = Math.max(0, now - created);
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    return {
        text: formatDuration(diff),
        days: days,
        ms: diff
    };
}

// Normalize status string (Shipped vs Shipping)
function normalizeStatus(status) {
    if (!status) return 'Pending';
    if (status.toLowerCase() === 'shipped' || status.toLowerCase() === 'shipping') return 'Shipping';
    return status;
}

// Current Status Duration & lifecycle metrics
function getStatusDurationInfo(order, now = new Date()) {
    if (!order) return { label: 'Status', durationText: 'N/A', days: 0, isWarning: false, isCompleted: false };
    const status = order.status || 'Pending';
    const created = new Date(order.created_at);

    if (status === 'Delivered') {
        const delivered = order.delivered_at ? new Date(order.delivered_at) : (order.current_status_started_at ? new Date(order.current_status_started_at) : now);
        const fulfillmentMs = Math.max(0, delivered - created);
        const deliveredDateStr = delivered.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        return {
            label: 'Delivered in',
            durationText: formatDuration(fulfillmentMs),
            subtitle: `Delivered on ${deliveredDateStr}`,
            days: Math.floor(fulfillmentMs / (1000 * 60 * 60 * 24)),
            isCompleted: true,
            isWarning: false,
            ms: fulfillmentMs
        };
    }

    if (status === 'Cancelled') {
        const cancelled = order.cancelled_at ? new Date(order.cancelled_at) : (order.current_status_started_at ? new Date(order.current_status_started_at) : now);
        const cancelledAfterMs = Math.max(0, cancelled - created);
        const cancelledDateStr = cancelled.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        return {
            label: 'Cancelled after',
            durationText: formatDuration(cancelledAfterMs),
            subtitle: `Cancelled on ${cancelledDateStr}`,
            days: Math.floor(cancelledAfterMs / (1000 * 60 * 60 * 24)),
            isCompleted: true,
            isWarning: false,
            ms: cancelledAfterMs
        };
    }

    // Active status: Pending, Processing, Shipping/Shipped
    const statusStart = order.current_status_started_at ? new Date(order.current_status_started_at) : created;
    const diff = Math.max(0, now - statusStart);
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    const normStatus = normalizeStatus(status);
    const threshold = AGING_THRESHOLDS_DAYS[normStatus] || AGING_THRESHOLDS_DAYS[status] || 3;
    const isWarning = days >= threshold;

    return {
        label: `In ${normStatus}`,
        durationText: formatDuration(diff),
        subtitle: `Started ${statusStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
        days: days,
        isCompleted: false,
        isWarning: isWarning,
        threshold: threshold,
        ms: diff
    };
}

document.addEventListener('DOMContentLoaded', () => {
    initAdmin();
});

// Wait for Supabase to be initialized
async function initAdmin() {
    let dbLoaded = false;
    for (let i = 0; i < 80; i++) {
        if (window.supabase && typeof window.supabase.auth !== 'undefined' && window.authHelpers) {
            dbLoaded = true;
            break;
        }
        await new Promise(resolve => setTimeout(resolve, 100));
    }

    if (!dbLoaded) {
        const statusEl = document.getElementById('overlayStatus');
        if (statusEl) statusEl.textContent = "Supabase connection error. Redirecting to home...";
        setTimeout(() => window.location.href = 'index.html', 2000);
        return;
    }

    await verifyAdminAccess();
}

async function verifyAdminAccess() {
    const statusEl = document.getElementById('overlayStatus');
    try {
        const session = await window.authHelpers.getCurrentSession();
        if (!session) {
            if (statusEl) statusEl.textContent = "Access Denied. Please log in first. Redirecting...";
            setTimeout(() => window.location.href = 'login.html?redirect=admin.html', 1500);
            return;
        }

        const profile = await window.authHelpers.getCurrentProfile();
        if (!profile || profile.role !== 'admin') {
            if (statusEl) statusEl.textContent = "Access Denied. Administrator role required. Redirecting...";
            setTimeout(() => window.location.href = 'index.html', 2000);
            return;
        }

        // Store globally so views can check admin role
        adminProfile = profile;
        const name = profile.full_name || session.user.email.split('@')[0];
        document.getElementById('adminUserName').textContent = name;
        document.getElementById('adminAvatarLetter').textContent = name[0].toUpperCase();

        // Access authorized - hide overlay
        const overlay = document.getElementById('accessOverlay');
        if (overlay) overlay.style.display = 'none';

        // Load data and show dashboard
        await loadAllDashboardData();
        renderActiveView();

        // Start notification polling
        startNotifPolling();

        // Start Real-Time dynamic aging timer (updates every 30s without reloading page)
        startRealtimeAgingTimer();
        
    } catch (err) {
        console.error("Auth verification failed:", err);
        if (statusEl) statusEl.textContent = "Authorization error. Redirecting...";
        setTimeout(() => window.location.href = 'index.html', 2000);
    }
}

// Fetch all necessary tables from Supabase
async function loadAllDashboardData() {
    try {
        // 1. Fetch Products
        const { data: prods, error: prodErr } = await window.supabase
            .from('products')
            .select('*')
            .order('id', { ascending: true });
        if (prodErr) throw prodErr;
        allProducts = prods || [];

        // 2. Fetch Orders
        const { data: ords, error: ordErr } = await window.supabase
            .from('orders')
            .select('*')
            .order('created_at', { ascending: false });
        if (ordErr) throw ordErr;
        allOrders = ords || [];

        // 2.1 Fetch Order Status History
        try {
            const { data: history, error: histErr } = await window.supabase
                .from('order_status_history')
                .select('*')
                .order('changed_at', { ascending: true });
            if (!histErr) {
                allStatusHistory = history || [];
            }
        } catch (e) {
            console.warn("Could not fetch order_status_history:", e);
        }

        // 3. Fetch Users/Profiles
        const { data: profiles, error: profErr } = await window.supabase
            .from('profiles')
            .select('*')
            .order('role', { ascending: true });
        if (profErr) throw profErr;
        allUsers = profiles || [];

    } catch (err) {
        console.error("Error loading dashboard data:", err);
        showToast("Error loading data from database", "error");
    }
}

// Dynamic Real-time timer updater: updates age & status duration live every 30 seconds
function startRealtimeAgingTimer() {
    if (liveAgingInterval) clearInterval(liveAgingInterval);
    liveAgingInterval = setInterval(() => {
        if (activeView === 'orders' || activeView === 'dashboard') {
            updateDynamicTimersInDOM();
        }
    }, 30000);
}

function updateDynamicTimersInDOM() {
    const now = new Date();
    document.querySelectorAll('[data-order-id]').forEach(el => {
        const orderId = parseInt(el.getAttribute('data-order-id'), 10);
        const order = allOrders.find(o => o.id === orderId);
        if (!order) return;

        const ageEl = el.querySelector('.live-order-age');
        if (ageEl) {
            const age = getOrderAge(order, now);
            ageEl.textContent = age.text;
        }

        const durationValEl = el.querySelector('.live-status-duration');
        if (durationValEl) {
            const durationInfo = getStatusDurationInfo(order, now);
            durationValEl.textContent = `${durationInfo.label}: ${durationInfo.durationText}`;
        }
    });
}

// Switch Sidebar tabs
window.switchView = function(view, element) {
    activeView = view;
    
    // Manage active menu highlights
    const menuItems = document.querySelectorAll('.menu-item');
    menuItems.forEach(item => item.classList.remove('active'));
    if (element) {
        element.classList.add('active');
    }

    // Set page header title
    const viewTitle = document.getElementById('viewTitle');
    if (viewTitle) {
        const titles = {
            dashboard: 'Dashboard Overview',
            products: 'Manage Store Catalog',
            orders: 'Manage Customer Orders',
            users: 'Manage Customers & Roles'
        };
        viewTitle.textContent = titles[view] || 'Admin Dashboard';
    }

    renderActiveView();
};


async function renderActiveView() {
    const container = document.getElementById('dynamicViewContent') || document.getElementById('mainContent');
    if (!container) return;

    if (activeView === 'dashboard') {
        await renderDashboardView(container);
    } else if (activeView === 'products') {
        renderProductsView(container);
    } else if (activeView === 'orders') {
        renderOrdersView(container);
    } else if (activeView === 'users') {
        renderUsersView(container);
    }
}


// ----------------- VIEW RENDERERS -----------------

async function renderDashboardView(container) {
    const totalProducts = allProducts.length;
    const totalUsers = allUsers.length;

    // Show loading placeholders while RPC fetches
    container.innerHTML = `
        <!-- Metrics Grid -->
        <div class="metrics-grid">
            <div class="metric-card">
                <div class="metric-info">
                    <h3>Today's Revenue</h3>
                    <div class="metric-value" id="kpi-today-revenue"><i class="fa-solid fa-spinner fa-spin"></i></div>
                </div>
                <div class="metric-icon bg-green-light">
                    <i class="fa-solid fa-wallet"></i>
                </div>
            </div>
            <div class="metric-card">
                <div class="metric-info">
                    <h3>Today's Orders</h3>
                    <div class="metric-value" id="kpi-today-orders"><i class="fa-solid fa-spinner fa-spin"></i></div>
                </div>
                <div class="metric-icon bg-blue-light">
                    <i class="fa-solid fa-cart-shopping"></i>
                </div>
            </div>
            <div class="metric-card">
                <div class="metric-info">
                    <h3>Active Catalog</h3>
                    <div class="metric-value">${totalProducts}</div>
                </div>
                <div class="metric-icon bg-orange-light">
                    <i class="fa-solid fa-boxes-stacked"></i>
                </div>
            </div>
            <div class="metric-card">
                <div class="metric-info">
                    <h3>Total Customers</h3>
                    <div class="metric-value">${totalUsers}</div>
                </div>
                <div class="metric-icon bg-purple-light">
                    <i class="fa-solid fa-users"></i>
                </div>
            </div>
        </div>

        <!-- Active Order Queue Panel -->
        <div class="panel" style="margin-top: 20px;">
            <div class="panel-header">
                <h2 class="panel-title"><i class="fa-solid fa-clock-rotate-left"></i> Active Order Queue</h2>
                <div style="display: flex; gap: 8px;">
                    <button class="btn btn-outline btn-sm" onclick="switchView('orders', document.querySelectorAll('.menu-item')[2])">View All Orders</button>
                    <button class="btn btn-primary btn-sm" onclick="switchView('orders', document.querySelectorAll('.menu-item')[2]); setTimeout(() => filterOrdersByStatus('History'), 200)"><i class="fa-solid fa-clock-rotate-left"></i> History</button>
                </div>
            </div>
            
            <div class="table-responsive">
                <table class="admin-table">
                    <thead>
                        <tr>
                            <th>Order ID</th>
                            <th>Customer</th>
                            <th>Order Age</th>
                            <th>Current Status</th>
                            <th>Status Duration</th>
                            <th>Total</th>
                            <th>Payment</th>
                            <th>Placed At</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${allOrders.filter(o => o.status !== 'Delivered' && o.status !== 'Cancelled').slice(0, 5).map(order => {
                            const user = allUsers.find(u => u.id === order.user_id);
                            const customerName = order.full_name || (user ? user.full_name : 'Guest User');
                            const formattedDate = new Date(order.created_at).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                            });
                            
                            const age = getOrderAge(order);
                            const duration = getStatusDurationInfo(order);
                            const normStatus = normalizeStatus(order.status);
                            
                            return `
                                <tr data-order-id="${order.id}">
                                    <td style="font-weight: 600;">FC-${order.id}</td>
                                    <td>${customerName}</td>
                                    <td>
                                        <span class="age-badge"><i class="fa-regular fa-clock"></i> <span class="live-order-age">${age.text}</span></span>
                                    </td>
                                    <td><span class="badge badge-${order.status.toLowerCase()}">${normStatus}</span></td>
                                    <td>
                                        <div class="status-duration-box">
                                            <span class="status-duration-val ${duration.isWarning ? 'duration-warning' : ''}">
                                                <span class="live-status-duration">${duration.label}: ${duration.durationText}</span>
                                            </span>
                                            ${duration.isWarning ? '<span class="age-warning-pill"><i class="fa-solid fa-triangle-exclamation"></i> Long Wait</span>' : ''}
                                        </div>
                                    </td>
                                    <td style="font-weight: bold; color: var(--primary-color);">Rs. ${parseFloat(order.total).toFixed(2)}</td>
                                    <td><span class="badge ${order.payment_status === 'Paid' ? 'badge-delivered' : 'badge-cancelled'}">${order.payment_status || 'Unpaid'}</span></td>
                                    <td style="color: var(--text-light); font-size: 0.85rem;">${formattedDate}</td>
                                </tr>
                            `;
                        }).join('')}
                        ${allOrders.filter(o => o.status !== 'Delivered' && o.status !== 'Cancelled').length === 0 ? '<tr><td colspan="8" style="text-align: center; color: var(--text-light); padding: 30px;">No active orders in queue.</td></tr>' : ''}
                    </tbody>
                </table>
            </div>
        </div>
    `;

    // Fetch today's metrics from RPC
    try {
        const { data, error } = await window.supabase.rpc('get_today_metrics');
        if (error) throw error;
        const metrics = data && data[0] ? data[0] : { today_revenue: 0, today_orders_count: 0 };
        const revEl = document.getElementById('kpi-today-revenue');
        const ordEl = document.getElementById('kpi-today-orders');
        if (revEl) revEl.textContent = `Rs. ${parseFloat(metrics.today_revenue || 0).toFixed(2)}`;
        if (ordEl) ordEl.textContent = metrics.today_orders_count || 0;
    } catch (err) {
        console.warn('get_today_metrics RPC error:', err);
        // Fallback: calculate locally from allOrders
        const todayStr = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD
        const todayOrders = allOrders.filter(o => {
            const d = new Date(o.created_at).toLocaleDateString('en-CA');
            return d === todayStr;
        });
        const todayRevenue = todayOrders
            .filter(o => o.payment_status === 'Paid' || o.status === 'Delivered')
            .reduce((sum, o) => sum + parseFloat(o.total || 0), 0);
        const revEl = document.getElementById('kpi-today-revenue');
        const ordEl = document.getElementById('kpi-today-orders');
        if (revEl) revEl.textContent = `Rs. ${todayRevenue.toFixed(2)}`;
        if (ordEl) ordEl.textContent = todayOrders.length;
    }
}

function renderProductsView(container) {
    container.innerHTML = `
        <div class="panel">
            <div class="panel-header">
                <h2 class="panel-title"><i class="fa-solid fa-boxes-stacked"></i> Products Catalog (${allProducts.length})</h2>
                <div style="display: flex; gap: 15px; flex-wrap: wrap; align-items: center;">
                    <div class="search-bar" style="display: flex; background: var(--bg-color); border-radius: 8px; border: 1px solid var(--border-color); padding: 5px; min-width: 250px;">
                        <i class="fa-solid fa-magnifying-glass" style="padding: 10px; color: var(--text-light);"></i>
                        <input type="text" id="adminSearchInput" oninput="filterAdminProducts()" placeholder="Search catalog..." style="flex: 1; border: none; background: transparent; padding: 5px 10px 5px 0; outline: none; color: var(--text-dark);">
                    </div>
                    <button class="btn btn-primary" onclick="openProductModal()"><i class="fa-solid fa-plus"></i> Add Product</button>
                </div>
            </div>
            
            <div class="table-responsive">
                <table class="admin-table">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Image</th>
                            <th>Name</th>
                            <th>Category</th>
                            <th>Unit</th>
                            <th>Price</th>
                            <th style="text-align: right;">Actions</th>
                        </tr>
                    </thead>
                    <tbody id="adminProductsTableBody">
                        <!-- Loaded dynamically -->
                    </tbody>
                </table>
            </div>
        </div>
    `;
    
    // Load rows immediately
    filterAdminProducts();
}

window.filterAdminProducts = function() {
    const searchVal = document.getElementById('adminSearchInput')?.value.toLowerCase().trim() || '';
    const tbody = document.getElementById('adminProductsTableBody');
    if (!tbody) return;

    const filtered = allProducts.filter(p => 
        p.name.toLowerCase().includes(searchVal) || 
        p.category.toLowerCase().includes(searchVal) ||
        String(p.id).includes(searchVal)
    );

    tbody.innerHTML = filtered.map(prod => `
        <tr>
            <td>${prod.id}</td>
            <td><img src="${prod.image}" alt="${prod.name}" class="thumbnail-img" onerror="this.onerror=null;this.src='';this.style.cssText='display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#a8edea,#fed6e3);color:#333;width:45px;height:45px;border-radius:6px;font-size:1.1rem;font-weight:700;';this.alt='${prod.name[0]}';"></td>
            <td style="font-weight: 600;">${prod.name}</td>
            <td style="text-transform: capitalize;"><span class="badge badge-user">${prod.category}</span></td>
            <td style="font-weight: 500; text-transform: uppercase;">${prod.unit || 'kg'}</td>
            <td style="font-weight: bold; color: var(--primary-color);">Rs. ${parseFloat(prod.price).toFixed(2)}</td>
            <td style="text-align: right;">
                <div class="action-group" style="justify-content: flex-end;">
                    <button class="btn btn-edit btn-sm" onclick="openProductModal(${prod.id})"><i class="fa-regular fa-pen-to-square"></i> Edit</button>
                    <button class="btn btn-delete btn-sm" onclick="deleteProduct(${prod.id})"><i class="fa-regular fa-trash-can"></i> Delete</button>
                </div>
            </td>
        </tr>
    `).join('');

    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--text-light); padding: 30px;">No matching products found.</td></tr>';
    }
};

// Filter helper for status sections
window.filterOrdersByStatus = function(status) {
    orderStatusFilter = status;
    renderActiveView();
};

function renderOrdersView(container) {
    const now = new Date();

    // Categorize orders
    const pendingList = allOrders.filter(o => o.status === 'Pending');
    const processingList = allOrders.filter(o => o.status === 'Processing');
    const shippingList = allOrders.filter(o => o.status === 'Shipped' || o.status === 'Shipping');
    const deliveredList = allOrders.filter(o => o.status === 'Delivered');
    const cancelledList = allOrders.filter(o => o.status === 'Cancelled');

    // Compute oldest in each active queue
    function getQueueAgingInfo(list, thresholdDays) {
        if (!list || list.length === 0) {
            return { text: 'None', days: 0, isWarning: false, count: 0 };
        }
        let oldestTimestamp = Infinity;
        let oldestOrder = null;
        list.forEach(o => {
            const t = new Date(o.current_status_started_at || o.created_at).getTime();
            if (t < oldestTimestamp) {
                oldestTimestamp = t;
                oldestOrder = o;
            }
        });
        const diff = Math.max(0, now.getTime() - oldestTimestamp);
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const isWarning = days >= thresholdDays;
        return {
            text: formatDuration(diff),
            days: days,
            isWarning: isWarning,
            count: list.length,
            oldestOrder: oldestOrder
        };
    }

    const pendingStats = getQueueAgingInfo(pendingList, AGING_THRESHOLDS_DAYS.Pending);
    const processingStats = getQueueAgingInfo(processingList, AGING_THRESHOLDS_DAYS.Processing);
    const shippingStats = getQueueAgingInfo(shippingList, AGING_THRESHOLDS_DAYS.Shipping);

    const hasAnyAgingWarning = pendingStats.isWarning || processingStats.isWarning || shippingStats.isWarning;

    // Filter & Sort for current tab (Requirement 7: Longest wait first for active queues)
    let displayOrders = [...allOrders];

    if (orderStatusFilter === 'Pending') {
        displayOrders = [...pendingList];
        // Sort by current_status_started_at ASC (earliest first = longest waiting at top!)
        displayOrders.sort((a, b) => new Date(a.current_status_started_at || a.created_at) - new Date(b.current_status_started_at || b.created_at));
    } else if (orderStatusFilter === 'Processing') {
        displayOrders = [...processingList];
        // Sort by current_status_started_at ASC
        displayOrders.sort((a, b) => new Date(a.current_status_started_at || a.created_at) - new Date(b.current_status_started_at || b.created_at));
    } else if (orderStatusFilter === 'Shipping') {
        displayOrders = [...shippingList];
        // Sort by current_status_started_at ASC
        displayOrders.sort((a, b) => new Date(a.current_status_started_at || a.created_at) - new Date(b.current_status_started_at || b.created_at));
    } else if (orderStatusFilter === 'Delivered') {
        displayOrders = [...deliveredList];
        // Sort by delivered_at DESC
        displayOrders.sort((a, b) => new Date(b.delivered_at || b.current_status_started_at || b.created_at) - new Date(a.delivered_at || a.current_status_started_at || a.created_at));
    } else if (orderStatusFilter === 'Cancelled') {
        displayOrders = [...cancelledList];
        // Sort by cancelled_at DESC
        displayOrders.sort((a, b) => new Date(b.cancelled_at || b.current_status_started_at || b.created_at) - new Date(a.cancelled_at || a.current_status_started_at || a.created_at));
    } else if (orderStatusFilter === 'History') {
        // History: Delivered + Cancelled, newest first
        displayOrders = [...deliveredList, ...cancelledList];
        displayOrders.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    } else {
        // 'all' — exclude Delivered & Cancelled from the main queue (they go to History)
        displayOrders = allOrders.filter(o => o.status !== 'Delivered' && o.status !== 'Cancelled');
        displayOrders.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    }

    container.innerHTML = `
        <div class="panel">
            <div class="panel-header">
                <div>
                    <h2 class="panel-title"><i class="fa-solid fa-truck-ramp-box"></i> Manage Customer Orders</h2>
                    <p style="font-size: 0.85rem; color: var(--text-light); margin-top: 4px;">
                        Dynamic Order Aging & Status Duration Tracking • ${allOrders.length} Total Orders
                    </p>
                </div>
            </div>

            <!-- Aging & Workflow Dashboard Summary (Requirement 12) -->
            <div class="aging-summary-grid">
                <div class="aging-card ${pendingStats.isWarning ? 'has-warning' : ''}">
                    <div class="aging-card-title" style="color: #b45309;">
                        <span><i class="fa-solid fa-clock"></i> Pending</span>
                        ${pendingStats.isWarning ? '<i class="fa-solid fa-triangle-exclamation tab-alert-icon"></i>' : ''}
                    </div>
                    <div class="aging-card-count">${pendingStats.count}</div>
                    <div class="aging-card-sub">
                        ${pendingStats.count > 0 ? `Oldest: ${pendingStats.text}` : 'Queue clear'}
                    </div>
                </div>

                <div class="aging-card ${processingStats.isWarning ? 'has-warning' : ''}">
                    <div class="aging-card-title" style="color: #1d4ed8;">
                        <span><i class="fa-solid fa-gears"></i> Processing</span>
                        ${processingStats.isWarning ? '<i class="fa-solid fa-triangle-exclamation tab-alert-icon"></i>' : ''}
                    </div>
                    <div class="aging-card-count">${processingStats.count}</div>
                    <div class="aging-card-sub">
                        ${processingStats.count > 0 ? `Oldest: ${processingStats.text}` : 'Queue clear'}
                    </div>
                </div>

                <div class="aging-card ${shippingStats.isWarning ? 'has-warning' : ''}">
                    <div class="aging-card-title" style="color: #7e22ce;">
                        <span><i class="fa-solid fa-truck-fast"></i> Shipping</span>
                        ${shippingStats.isWarning ? '<i class="fa-solid fa-triangle-exclamation tab-alert-icon"></i>' : ''}
                    </div>
                    <div class="aging-card-count">${shippingStats.count}</div>
                    <div class="aging-card-sub">
                        ${shippingStats.count > 0 ? `Oldest: ${shippingStats.text}` : 'Queue clear'}
                    </div>
                </div>

                <div class="aging-card">
                    <div class="aging-card-title" style="color: #15803d;">
                        <span><i class="fa-solid fa-circle-check"></i> Delivered</span>
                    </div>
                    <div class="aging-card-count">${deliveredList.length}</div>
                    <div class="aging-card-sub">Completed orders</div>
                </div>

                <div class="aging-card">
                    <div class="aging-card-title" style="color: #b91c1c;">
                        <span><i class="fa-solid fa-ban"></i> Cancelled</span>
                    </div>
                    <div class="aging-card-count">${cancelledList.length}</div>
                    <div class="aging-card-sub">Archived orders</div>
                </div>
            </div>

            ${hasAnyAgingWarning ? `
                <div style="background: #fff1f2; border: 1px solid #fecdd3; border-radius: 10px; padding: 12px 18px; margin-bottom: 20px; display: flex; align-items: center; gap: 12px; color: #9f1239; font-size: 0.88rem;">
                    <i class="fa-solid fa-triangle-exclamation" style="font-size: 1.2rem; color: #e11d48;"></i>
                    <div>
                        <strong>Order Aging Notice:</strong> Unusually long wait times detected in your active queues (thresholds: Pending > 2d, Processing > 2d, Shipping > 3d). 
                        Orders waiting the longest are automatically prioritized at the top of each status view.
                    </div>
                </div>
            ` : ''}

            <!-- Status Section Tabs (Requirement 6) -->
            <div class="status-tabs">
                <button class="status-tab-btn ${orderStatusFilter === 'all' ? 'active' : ''}" onclick="filterOrdersByStatus('all')">
                    <i class="fa-solid fa-list"></i> Active Queue <span class="status-tab-count">${allOrders.filter(o => o.status !== 'Delivered' && o.status !== 'Cancelled').length}</span>
                </button>
                <button class="status-tab-btn ${orderStatusFilter === 'Pending' ? 'active' : ''}" onclick="filterOrdersByStatus('Pending')">
                    <i class="fa-solid fa-clock"></i> Pending <span class="status-tab-count">${pendingList.length}</span>
                    ${pendingStats.isWarning ? '<i class="fa-solid fa-triangle-exclamation tab-alert-icon" title="Long wait orders in Pending"></i>' : ''}
                </button>
                <button class="status-tab-btn ${orderStatusFilter === 'Processing' ? 'active' : ''}" onclick="filterOrdersByStatus('Processing')">
                    <i class="fa-solid fa-gears"></i> Processing <span class="status-tab-count">${processingList.length}</span>
                    ${processingStats.isWarning ? '<i class="fa-solid fa-triangle-exclamation tab-alert-icon" title="Long wait orders in Processing"></i>' : ''}
                </button>
                <button class="status-tab-btn ${orderStatusFilter === 'Shipping' ? 'active' : ''}" onclick="filterOrdersByStatus('Shipping')">
                    <i class="fa-solid fa-truck-fast"></i> Shipping <span class="status-tab-count">${shippingList.length}</span>
                    ${shippingStats.isWarning ? '<i class="fa-solid fa-triangle-exclamation tab-alert-icon" title="Long wait orders in Shipping"></i>' : ''}
                </button>
                <button class="status-tab-btn ${orderStatusFilter === 'History' ? 'active' : ''}" onclick="filterOrdersByStatus('History')" style="border-left: 3px solid #7e22ce;">
                    <i class="fa-solid fa-clock-rotate-left"></i> History <span class="status-tab-count">${deliveredList.length + cancelledList.length}</span>
                </button>
            </div>

            <!-- Admin Order Table (Requirement 5) -->
            <div class="table-responsive">
                <table class="admin-table">
                    <thead>
                        <tr>
                            <th>Order ID</th>
                            <th>Customer</th>
                            <th>Order Date</th>
                            <th>Order Age</th>
                            <th>Current Status</th>
                            <th>Status Duration</th>
                            <th>Total Amount</th>
                            <th>Payment Status</th>
                            <th style="text-align: right;">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${displayOrders.map(order => {
                            const user = allUsers.find(u => u.id === order.user_id);
                            const customerName = order.full_name || (user ? user.full_name : 'Guest User');
                            
                            const formattedDate = new Date(order.created_at).toLocaleString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                            });
                            
                            const orderAge = getOrderAge(order, now);
                            const durationInfo = getStatusDurationInfo(order, now);
                            const normStatus = normalizeStatus(order.status);

                            const statusIcons = {
                                'Pending': 'fa-clock',
                                'Processing': 'fa-gears',
                                'Shipping': 'fa-truck-fast',
                                'Shipped': 'fa-truck-fast',
                                'Delivered': 'fa-circle-check',
                                'Cancelled': 'fa-ban'
                            };
                            const statusIcon = statusIcons[normStatus] || statusIcons[order.status] || 'fa-circle';
                            const badgeClass = normStatus.toLowerCase();
                            
                            return `
                                <tr data-order-id="${order.id}">
                                    <td style="font-weight: 700; font-family: monospace; font-size: 0.95rem;">
                                        FC-${order.id}
                                    </td>
                                    <td>
                                        <div style="font-weight: 600;">${customerName}</div>
                                        <div style="font-size:0.75rem; color:var(--text-light); max-width: 160px; overflow:hidden; text-overflow:ellipsis;" title="${order.phone || ''} ${order.shipping_address || ''}">
                                            <i class="fa-solid fa-phone" style="font-size: 0.7rem;"></i> ${order.phone || 'No phone'}
                                        </div>
                                    </td>
                                    <td style="font-size: 0.85rem; color: var(--text-dark); white-space: nowrap;">
                                        ${formattedDate}
                                    </td>
                                    <td>
                                        <span class="age-badge" title="Total time since order placed on ${formattedDate}">
                                            <i class="fa-regular fa-clock"></i> 
                                            <span class="live-order-age">${orderAge.text}</span>
                                        </span>
                                    </td>
                                    <td>
                                        <span id="badge-status-${order.id}" class="badge badge-${badgeClass}">
                                            <i class="fa-solid ${statusIcon}"></i> ${normStatus}
                                        </span>
                                    </td>
                                    <td>
                                        <div class="status-duration-box">
                                            ${durationInfo.isCompleted ? `
                                                <span class="status-duration-val" style="color: ${order.status === 'Delivered' ? '#166534' : '#991b1b'};">
                                                    <i class="fa-solid ${order.status === 'Delivered' ? 'fa-circle-check' : 'fa-ban'}"></i>
                                                    <span class="live-status-duration">${durationInfo.label} ${durationInfo.durationText}</span>
                                                </span>
                                                <span class="status-duration-sub">${durationInfo.subtitle}</span>
                                            ` : `
                                                <span class="status-duration-val ${durationInfo.isWarning ? 'duration-warning' : ''}">
                                                    <span class="live-status-duration">${durationInfo.label}: ${durationInfo.durationText}</span>
                                                </span>
                                                ${durationInfo.isWarning ? `<span class="age-warning-pill"><i class="fa-solid fa-triangle-exclamation"></i> Over ${durationInfo.threshold}d</span>` : ''}
                                                <span class="status-duration-sub">${durationInfo.subtitle}</span>
                                            `}
                                        </div>
                                    </td>
                                    <td style="font-weight: 800; color: var(--primary-color); white-space: nowrap;">
                                        Rs. ${parseFloat(order.total).toFixed(2)}
                                    </td>
                                    <td>
                                        <select class="form-control" style="padding: 4px 8px; font-size: 0.82rem; width: auto; cursor: pointer; margin-bottom: 2px;" onchange="updatePaymentStatus(${order.id}, this.value)">
                                            <option value="Pending" ${order.payment_status === 'Pending' ? 'selected' : ''}>Pending</option>
                                            <option value="Paid" ${order.payment_status === 'Paid' ? 'selected' : ''}>Paid</option>
                                            <option value="Failed" ${order.payment_status === 'Failed' ? 'selected' : ''}>Failed</option>
                                        </select>
                                        <div style="font-size: 0.7rem; color: var(--text-light);">${order.payment_method || 'eSewa'}</div>
                                    </td>
                                    <td style="text-align: right;">
                                        <div style="display: inline-flex; flex-direction: column; gap: 6px; align-items: flex-end;">
                                            <div style="display: flex; gap: 6px; align-items: center;">
                                                <select class="form-control" style="padding: 5px 10px; font-size: 0.82rem; width: auto; cursor: pointer; font-weight: 600;" onchange="updateOrderStatus(${order.id}, this.value)">
                                                    <option value="Pending" ${order.status === 'Pending' ? 'selected' : ''}>Pending</option>
                                                    <option value="Processing" ${order.status === 'Processing' ? 'selected' : ''}>Processing</option>
                                                    <option value="Shipped" ${order.status === 'Shipped' || order.status === 'Shipping' ? 'selected' : ''}>Shipping</option>
                                                    <option value="Delivered" ${order.status === 'Delivered' ? 'selected' : ''}>Delivered</option>
                                                    <option value="Cancelled" ${order.status === 'Cancelled' ? 'selected' : ''}>Cancelled</option>
                                                </select>
                                                <button class="btn btn-outline btn-sm" onclick="viewOrderHistory(${order.id})" title="View Complete Status Audit Trail" style="padding: 5px 10px; white-space: nowrap;">
                                                    <i class="fa-solid fa-clock-rotate-left"></i> Timeline
                                                </button>
                                            </div>
                                            ${(order.status === 'Delivered' && adminProfile && adminProfile.role === 'admin') ? `
                                                <button class="btn btn-sm" onclick="revertOrderToProcessing(${order.id})" title="Revert this delivered order back to Processing" style="background: #fef3c7; color: #92400e; border: 1px solid #fcd34d; padding: 5px 12px; border-radius: 6px; font-size: 0.8rem; cursor: pointer; white-space: nowrap;">
                                                    <i class="fa-solid fa-rotate-left"></i> Revert to Processing
                                                </button>
                                            ` : ''}
                                            <div style="display: flex; align-items: center; gap: 4px;">
                                                <span style="font-size: 0.72rem; color: var(--text-light);">Est. Delivery:</span>
                                                <input type="date" class="form-control" style="padding: 3px 6px; font-size: 0.75rem; width: auto;" value="${order.delivery_date || ''}" onchange="updateDeliveryDate(${order.id}, this.value)">
                                            </div>
                                        </div>
                                    </td>
                                </tr>
                            `;
                        }).join('')}
                        ${displayOrders.length === 0 ? `
                            <tr>
                                <td colspan="9" style="text-align: center; color: var(--text-light); padding: 40px;">
                                    <i class="fa-solid fa-inbox" style="font-size: 2rem; margin-bottom: 10px; display: block; opacity: 0.5;"></i>
                                    ${orderStatusFilter === 'History' ? 'No completed or cancelled orders in history yet.' : `No orders found in the "${orderStatusFilter}" status section.`}
                                </td>
                            </tr>
                        ` : ''}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

function renderUsersView(container) {
    container.innerHTML = `
        <div class="panel">
            <div class="panel-header">
                <h2 class="panel-title"><i class="fa-solid fa-users"></i> Registered Customers (${allUsers.length})</h2>
            </div>
            
            <div class="table-responsive">
                <table class="admin-table">
                    <thead>
                        <tr>
                            <th>Avatar</th>
                            <th>Customer Name</th>
                            <th>Account ID</th>
                            <th>System Role</th>
                            <th>Assigned Status</th>
                            <th>Toggle Admin Access</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${allUsers.map(profile => {
                            const name = profile.full_name || 'User';
                            const letter = name[0].toUpperCase();
                            
                            return `
                                <tr>
                                    <td>
                                        <div class="admin-avatar" style="background-color: ${profile.role === 'admin' ? '#e74c3c' : 'var(--primary-color)'}; font-size: 1rem; width: 35px; height: 35px;">${letter}</div>
                                    </td>
                                    <td style="font-weight: 600;">${name}</td>
                                    <td style="font-family: monospace; font-size: 0.85rem; color: var(--text-light);">${profile.id}</td>
                                    <td><span id="role-badge-${profile.id}" class="badge ${profile.role === 'admin' ? 'badge-admin' : 'badge-user'}">${profile.role}</span></td>
                                    <td><span class="badge badge-delivered">Active</span></td>
                                    <td>
                                        <select class="form-control" style="padding: 6px 12px; font-size: 0.85rem; width: auto; cursor: pointer;" onchange="updateUserRole('${profile.id}', this.value)">
                                            <option value="user" ${profile.role === 'user' ? 'selected' : ''}>Standard User</option>
                                            <option value="admin" ${profile.role === 'admin' ? 'selected' : ''}>Administrator</option>
                                        </select>
                                    </td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

// ----------------- CORE DATA OPERATIONS -----------------

// Add/Edit Product Modal triggers
window.openProductModal = function(productId = null) {
    const modal = document.getElementById('productModal');
    const title = document.getElementById('modalTitle');
    const form = document.getElementById('productForm');
    
    // Reset Form
    form.reset();
    document.getElementById('modalProductId').value = '';
    
    if (productId) {
        title.textContent = 'Edit Product';
        const prod = allProducts.find(p => p.id === productId);
        if (prod) {
            document.getElementById('modalProductId').value = prod.id;
            document.getElementById('modalProdName').value = prod.name;
            document.getElementById('modalProdCategory').value = prod.category;
            document.getElementById('modalProdPrice').value = prod.price;
            document.getElementById('modalProdUnit').value = prod.unit || 'kg';
            document.getElementById('modalProdImage').value = prod.image;
        }
    } else {
        title.textContent = 'Add New Product';
        // Set generic placeholder image
        document.getElementById('modalProdImage').value = 'images/products/product_1.jpg';
    }
    
    modal.classList.add('active');
};

window.closeProductModal = function() {
    const modal = document.getElementById('productModal');
    if (modal) modal.classList.remove('active');
};

window.handleProductFormSubmit = async function(e) {
    e.preventDefault();
    
    const id = document.getElementById('modalProductId').value;
    const name = document.getElementById('modalProdName').value.trim();
    const category = document.getElementById('modalProdCategory').value;
    const price = parseFloat(document.getElementById('modalProdPrice').value);
    const unit = document.getElementById('modalProdUnit').value;
    const image = document.getElementById('modalProdImage').value.trim();
    
    try {
        const prodData = { name, category, price, unit, image };
        
        if (id) {
            // Edit existing product
            const { error } = await window.supabase
                .from('products')
                .update(prodData)
                .eq('id', id);
                
            if (error) throw error;
            showToast("Product updated successfully in the database!", "success");
        } else {
            // Add new product
            const { error } = await window.supabase
                .from('products')
                .insert(prodData);
                
            if (error) throw error;
            showToast("New product inserted into the database!", "success");
        }
        
        closeProductModal();
        await loadAllDashboardData();
        renderActiveView();
        
    } catch (err) {
        console.error("Product save failed:", err);
        showToast(err.message || "Failed to save product", "error");
    }
};

window.deleteProduct = async function(productId) {
    if (!confirm("Are you sure you want to permanently delete this product from the store catalog?")) {
        return;
    }
    
    try {
        const { error } = await window.supabase
            .from('products')
            .delete()
            .eq('id', productId);
            
        if (error) throw error;
        
        showToast("Product deleted from database successfully.", "success");
        await loadAllDashboardData();
        renderActiveView();
        
    } catch (err) {
        console.error("Product deletion failed:", err);
        showToast(err.message || "Failed to delete product", "error");
    }
};

window.updateOrderStatus = async function(orderId, newStatus) {
    try {
        const order = allOrders.find(o => o.id === orderId);
        if (!order) return;

        if (order.status === newStatus) return; // No change

        // Allowed transitions validation (Requirement 15)
        if (order.status === 'Delivered' && newStatus !== 'Delivered') {
            if (!confirm("This order is already marked Delivered. Are you sure you want to change its status?")) {
                renderActiveView();
                return;
            }
        }
        if (order.status === 'Cancelled' && newStatus !== 'Cancelled') {
            if (!confirm("This order was Cancelled. Are you sure you want to reopen it?")) {
                renderActiveView();
                return;
            }
        }

        const nowIso = new Date().toISOString();
        const updatePayload = {
            status: newStatus,
            current_status_started_at: nowIso
        };

        if (newStatus === 'Delivered') {
            updatePayload.delivered_at = nowIso;
        } else if (newStatus === 'Cancelled') {
            updatePayload.cancelled_at = nowIso;
        }

        const { error } = await window.supabase
            .from('orders')
            .update(updatePayload)
            .eq('id', orderId);

        if (error) throw error;

        showToast(`Order #FC-${orderId} status moved to ${normalizeStatus(newStatus)}! Timer reset.`, "success");

        // Reload data to fetch trigger-generated history entries & new timestamps
        await loadAllDashboardData();
        renderActiveView();

    } catch (err) {
        console.error("Failed to update order status:", err);
        showToast(err.message || "Status update failed", "error");
        renderActiveView();
    }
};

// Admin-only: revert a Delivered order back to Processing
window.revertOrderToProcessing = async function(orderId) {
    // Double-check admin role on the client side (server RLS is the real guard)
    if (!adminProfile || adminProfile.role !== 'admin') {
        showToast('Access denied. Only admins can revert delivered orders.', 'error');
        return;
    }

    const order = allOrders.find(o => o.id === orderId);
    if (!order) return;

    if (order.status !== 'Delivered') {
        showToast('Only Delivered orders can be reverted to Processing.', 'error');
        return;
    }

    if (!confirm(`Revert Order FC-${orderId} from Delivered back to Processing?\n\nThis action is logged and should only be done if the delivery failed or was recorded by mistake.`)) {
        return;
    }

    try {
        const nowIso = new Date().toISOString();
        const { error } = await window.supabase
            .from('orders')
            .update({
                status: 'Processing',
                current_status_started_at: nowIso,
                delivered_at: null
            })
            .eq('id', orderId);

        if (error) throw error;

        showToast(`Order FC-${orderId} has been reverted to Processing.`, 'success');
        await loadAllDashboardData();
        renderActiveView();
    } catch (err) {
        console.error('Revert order failed:', err);
        showToast(err.message || 'Failed to revert order.', 'error');
    }
};

// View Order History & Lifecycle Timeline Modal
window.viewOrderHistory = function(orderId) {
    const order = allOrders.find(o => o.id === orderId);
    if (!order) return;

    const user = allUsers.find(u => u.id === order.user_id);
    const customerName = order.full_name || (user ? user.full_name : 'Guest User');
    const now = new Date();

    const orderAge = getOrderAge(order, now);
    const durationInfo = getStatusDurationInfo(order, now);
    const normStatus = normalizeStatus(order.status);

    const historyRecords = allStatusHistory.filter(h => h.order_id === orderId);

    // Build timeline events
    let timelineEvents = [];

    // Base event: Order Created
    const createdDate = new Date(order.created_at);
    timelineEvents.push({
        status: 'Order Placed (Pending)',
        previousStatus: null,
        timestamp: createdDate,
        changedBy: 'Customer / Checkout',
        isInitial: true
    });

    // Subsequent history events
    historyRecords.forEach(h => {
        const changeDate = new Date(h.changed_at);
        // Avoid duplicate initial event if it matches creation time closely
        if (Math.abs(changeDate.getTime() - createdDate.getTime()) < 2000 && !h.previous_status) {
            return;
        }
        timelineEvents.push({
            status: normalizeStatus(h.new_status),
            previousStatus: h.previous_status ? normalizeStatus(h.previous_status) : null,
            timestamp: changeDate,
            changedBy: h.changed_by || 'Admin',
            isInitial: false
        });
    });

    // Sort timeline chronologically
    timelineEvents.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    // Calculate duration between each step
    for (let i = 0; i < timelineEvents.length; i++) {
        const current = timelineEvents[i];
        const next = (i < timelineEvents.length - 1) ? timelineEvents[i + 1] : null;
        if (next) {
            const stepDurationMs = next.timestamp.getTime() - current.timestamp.getTime();
            current.durationInStep = formatDuration(stepDurationMs);
        } else {
            // Last step:
            if (order.status === 'Delivered') {
                current.durationInStep = 'Completed';
            } else if (order.status === 'Cancelled') {
                current.durationInStep = 'Cancelled';
            } else {
                const currentDurationMs = now.getTime() - current.timestamp.getTime();
                current.durationInStep = `${formatDuration(currentDurationMs)} (Current)`;
            }
        }
    }

    const modalTitle = document.getElementById('historyModalTitle');
    if (modalTitle) {
        modalTitle.innerHTML = `<i class="fa-solid fa-clock-rotate-left"></i> Order #FC-${order.id} Lifecycle & Timeline`;
    }

    const modalBody = document.getElementById('historyModalBody');
    if (modalBody) {
        modalBody.innerHTML = `
            <!-- Order Quick Summary Header -->
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 12px; background: var(--secondary-color); padding: 15px; border-radius: 12px; margin-bottom: 20px; border: 1px solid var(--border-color);">
                <div>
                    <div style="font-size: 0.75rem; color: var(--text-light); text-transform: uppercase; font-weight: 700;">Customer</div>
                    <div style="font-weight: 700; font-size: 0.95rem; color: var(--text-dark);">${customerName}</div>
                </div>
                <div>
                    <div style="font-size: 0.75rem; color: var(--text-light); text-transform: uppercase; font-weight: 700;">Total Amount</div>
                    <div style="font-weight: 800; font-size: 0.95rem; color: var(--primary-color);">Rs. ${parseFloat(order.total).toFixed(2)}</div>
                </div>
                <div>
                    <div style="font-size: 0.75rem; color: var(--text-light); text-transform: uppercase; font-weight: 700;">Total Order Age</div>
                    <div style="font-weight: 700; font-size: 0.95rem; color: var(--text-dark);">${orderAge.text}</div>
                </div>
                <div>
                    <div style="font-size: 0.75rem; color: var(--text-light); text-transform: uppercase; font-weight: 700;">Status Duration</div>
                    <div style="font-weight: 700; font-size: 0.95rem; color: ${durationInfo.isWarning ? '#e11d48' : 'var(--text-dark)'};">
                        ${durationInfo.label}: ${durationInfo.durationText}
                    </div>
                </div>
            </div>

            <!-- Status Details Alert Box -->
            ${order.status === 'Delivered' ? `
                <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 10px; padding: 12px 16px; margin-bottom: 20px; color: #166534; font-size: 0.9rem; display: flex; align-items: center; gap: 10px;">
                    <i class="fa-solid fa-circle-check" style="font-size: 1.3rem;"></i>
                    <div>
                        <strong>Order Fulfilled:</strong> Total fulfillment time was <strong>${durationInfo.durationText}</strong>. ${durationInfo.subtitle}.
                    </div>
                </div>
            ` : order.status === 'Cancelled' ? `
                <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 10px; padding: 12px 16px; margin-bottom: 20px; color: #991b1b; font-size: 0.9rem; display: flex; align-items: center; gap: 10px;">
                    <i class="fa-solid fa-ban" style="font-size: 1.3rem;"></i>
                    <div>
                        <strong>Order Cancelled:</strong> Cancelled after <strong>${durationInfo.durationText}</strong> from initial placement.
                    </div>
                </div>
            ` : `
                <div style="background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 10px; padding: 12px 16px; margin-bottom: 20px; font-size: 0.88rem; display: flex; align-items: center; justify-content: space-between;">
                    <div>
                        <span style="color: var(--text-light);">Current Active Status:</span> 
                        <strong style="color: var(--primary-color);">${normStatus}</strong>
                    </div>
                    <div style="font-weight: 700; color: ${durationInfo.isWarning ? '#e11d48' : 'var(--text-dark)'};">
                        ${durationInfo.durationText} in this status
                    </div>
                </div>
            `}

            <!-- Step-by-Step History Timeline Audit Trail -->
            <div style="font-weight: 700; font-size: 0.95rem; margin-bottom: 12px; color: var(--text-dark);">
                <i class="fa-solid fa-timeline"></i> Status Transition History (${timelineEvents.length} record${timelineEvents.length !== 1 ? 's' : ''})
            </div>

            <div class="timeline-container">
                ${timelineEvents.map((evt, idx) => {
                    const isLast = (idx === timelineEvents.length - 1);
                    let dotClass = 'active';
                    if (evt.status === 'Delivered') dotClass = 'delivered';
                    else if (evt.status === 'Cancelled') dotClass = 'cancelled';
                    else if (!isLast) dotClass = '';

                    const formattedEvtDate = evt.timestamp.toLocaleString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit'
                    });

                    return `
                        <div class="timeline-item">
                            <div class="timeline-dot ${dotClass}">
                                ${evt.status === 'Delivered' ? '<i class="fa-solid fa-check"></i>' : evt.status === 'Cancelled' ? '<i class="fa-solid fa-xmark"></i>' : (idx + 1)}
                            </div>
                            <div class="timeline-content">
                                <div class="timeline-title">
                                    ${evt.previousStatus ? `${evt.previousStatus} &rarr; ` : ''}${evt.status}
                                </div>
                                <div class="timeline-meta">
                                    <i class="fa-regular fa-clock" style="margin-right: 4px;"></i> ${formattedEvtDate}
                                    <span style="margin: 0 6px;">&bull;</span>
                                    <i class="fa-solid fa-user-gear" style="margin-right: 4px;"></i> Actor: <strong>${evt.changedBy}</strong>
                                </div>
                                ${evt.durationInStep ? `
                                    <div class="timeline-duration-tag">
                                        <i class="fa-solid fa-stopwatch" style="margin-right: 4px; color: var(--primary-color);"></i>
                                        Duration: <strong>${evt.durationInStep}</strong>
                                    </div>
                                ` : ''}
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    }

    const modal = document.getElementById('orderHistoryModal');
    if (modal) modal.classList.add('active');
};

window.closeHistoryModal = function() {
    const modal = document.getElementById('orderHistoryModal');
    if (modal) modal.classList.remove('active');
};

window.updatePaymentStatus = async function(orderId, paymentStatus) {
    try {
        const { error } = await window.supabase
            .from('orders')
            .update({ payment_status: paymentStatus })
            .eq('id', orderId);
            
        if (error) throw error;
        
        showToast(`Payment status updated to ${paymentStatus}!`, "success");
        
        const order = allOrders.find(o => o.id === orderId);
        if (order) order.payment_status = paymentStatus;
        
    } catch (err) {
        console.error("Failed to update payment status:", err);
        showToast(err.message || "Payment status update failed", "error");
    }
};

window.updateDeliveryDate = async function(orderId, dateStr) {
    try {
        const { error } = await window.supabase
            .from('orders')
            .update({ delivery_date: dateStr })
            .eq('id', orderId);
            
        if (error) throw error;
        
        showToast(`Delivery date updated!`, "success");
        
        const order = allOrders.find(o => o.id === orderId);
        if (order) order.delivery_date = dateStr;
        
    } catch (err) {
        console.error("Failed to update delivery date:", err);
        showToast(err.message || "Delivery date update failed", "error");
    }
};

window.updateUserRole = async function(userId, role) {
    try {
        const { error } = await window.supabase
            .from('profiles')
            .update({ role })
            .eq('id', userId);
            
        if (error) throw error;
        
        showToast(`User system role changed to ${role}!`, "success");
        
        // Update local memory
        const userProfile = allUsers.find(u => u.id === userId);
        if (userProfile) userProfile.role = role;
        
        const badge = document.getElementById(`role-badge-${userId}`);
        if (badge) {
            badge.textContent = role;
            badge.className = `badge ${role === 'admin' ? 'badge-admin' : 'badge-user'}`;
        }
        
    } catch (err) {
        console.error("Failed to update user role:", err);
        showToast(err.message || "Role change failed", "error");
    }
};

// ----------------- ADMINISTRATIVE UTILITIES -----------------

function showToast(message, type = "success") {
    const toast = document.getElementById('adminToast');
    const msgSpan = document.getElementById('toastMessage');
    const icon = document.getElementById('toastIcon');
    
    if (!toast || !msgSpan || !icon) return;
    
    msgSpan.textContent = message;
    toast.className = `toast toast-${type}`;
    
    if (type === "success") {
        icon.className = "fa-solid fa-circle-check";
    } else {
        icon.className = "fa-solid fa-circle-exclamation";
    }
    
    toast.style.display = "flex";
    
    setTimeout(() => {
        toast.style.display = "none";
    }, 3000);
}

// Local dark mode for admin
window.toggleAdminTheme = function() {
    const themeBtn = document.getElementById('adminThemeToggle');
    const root = document.documentElement;
    const currentTheme = root.getAttribute('data-theme');
    
    if (currentTheme === 'dark') {
        root.removeAttribute('data-theme');
        localStorage.setItem('theme', 'light');
        if (themeBtn) themeBtn.innerHTML = '<i class="fa-solid fa-moon"></i>';
    } else {
        root.setAttribute('data-theme', 'dark');
        localStorage.setItem('theme', 'dark');
        if (themeBtn) themeBtn.innerHTML = '<i class="fa-solid fa-sun"></i>';
    }
};

// =====================================================
// ADMIN NOTIFICATION SYSTEM
// =====================================================

let adminNotifications = [];
let notifPollingInterval = null;
let lastNotifCount = 0;

// Fetch notifications from Supabase
async function fetchAdminNotifications() {
    try {
        if (!window.supabase) return;

        const { data, error } = await window.supabase
            .from('admin_notifications')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(50);

        if (error) {
            console.error("Error fetching notifications:", error);
            return;
        }

        adminNotifications = data || [];
        
        // Check if new notifications arrived
        const unreadCount = adminNotifications.filter(n => !n.is_read).length;
        if (unreadCount > lastNotifCount && lastNotifCount > 0) {
            // New notification arrived - play subtle sound effect
            playNotifSound();
        }
        lastNotifCount = unreadCount;

        updateNotifBadge();
        renderNotifPanel();

    } catch (err) {
        console.error("Notification fetch error:", err);
    }
}

// Update the badge count on the bell
function updateNotifBadge() {
    const badge = document.getElementById('notifBadge');
    if (!badge) return;

    const unreadCount = adminNotifications.filter(n => !n.is_read).length;

    if (unreadCount > 0) {
        badge.textContent = unreadCount > 99 ? '99+' : unreadCount;
        badge.classList.remove('hidden');
    } else {
        badge.classList.add('hidden');
    }
}

// Render notifications inside the panel
function renderNotifPanel() {
    const body = document.getElementById('notifPanelBody');
    if (!body) return;

    if (adminNotifications.length === 0) {
        body.innerHTML = `
            <div class="notif-empty">
                <i class="fa-regular fa-bell-slash"></i>
                <p>No notifications yet</p>
                <p style="font-size: 0.8rem; margin-top: 5px;">New order notifications will appear here</p>
            </div>
        `;
        return;
    }

    body.innerHTML = adminNotifications.map(notif => {
        const timeAgo = getTimeAgo(notif.created_at);
        const isUnread = !notif.is_read;
        
        return `
            <div class="notif-item ${isUnread ? 'unread' : ''}" onclick="handleNotifClick(${notif.id}, ${notif.order_id || 'null'})">
                <div class="notif-icon-wrap notif-icon-order">
                    <i class="fa-solid fa-shopping-bag"></i>
                </div>
                <div class="notif-content">
                    <div class="notif-title">${escapeHTML(notif.title)}</div>
                    <div class="notif-message">${escapeHTML(notif.message)}</div>
                    <div class="notif-time"><i class="fa-regular fa-clock"></i> ${timeAgo}</div>
                </div>
                <div class="notif-dot ${isUnread ? '' : 'read'}"></div>
            </div>
        `;
    }).join('');
}

// Escape HTML to prevent XSS
function escapeHTML(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// Time ago formatter
function getTimeAgo(dateStr) {
    const now = new Date();
    const date = new Date(dateStr);
    const diffMs = now - date;
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSecs < 60) return 'Just now';
    if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// Toggle notification panel
window.toggleNotifPanel = function() {
    const panel = document.getElementById('notifPanel');
    if (panel) {
        panel.classList.toggle('active');
    }
};

// Close panel when clicking outside
document.addEventListener('click', (e) => {
    const container = document.getElementById('notifBellContainer');
    const panel = document.getElementById('notifPanel');
    if (container && panel && !container.contains(e.target)) {
        panel.classList.remove('active');
    }
});

// Handle notification click - mark as read and navigate to orders
window.handleNotifClick = async function(notifId, orderId) {
    try {
        // Mark this notification as read
        if (window.supabase) {
            await window.supabase
                .from('admin_notifications')
                .update({ is_read: true })
                .eq('id', notifId);
        }

        // Update local state
        const notif = adminNotifications.find(n => n.id === notifId);
        if (notif) notif.is_read = true;
        updateNotifBadge();
        renderNotifPanel();

        // Navigate to orders view
        const ordersMenuItem = document.querySelectorAll('.menu-item')[2];
        switchView('orders', ordersMenuItem);

        // Close panel
        const panel = document.getElementById('notifPanel');
        if (panel) panel.classList.remove('active');

    } catch (err) {
        console.error("Error handling notification click:", err);
    }
};

// Mark all notifications as read
window.markAllNotificationsRead = async function() {
    try {
        if (!window.supabase) return;

        const unreadIds = adminNotifications.filter(n => !n.is_read).map(n => n.id);
        if (unreadIds.length === 0) return;

        const { error } = await window.supabase
            .from('admin_notifications')
            .update({ is_read: true })
            .in('id', unreadIds);

        if (error) throw error;

        // Update local state
        adminNotifications.forEach(n => n.is_read = true);
        updateNotifBadge();
        renderNotifPanel();

        showToast("All notifications marked as read!", "success");

    } catch (err) {
        console.error("Error marking all as read:", err);
        showToast("Failed to mark notifications as read", "error");
    }
};

// Play a subtle notification sound
function playNotifSound() {
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        
        oscillator.frequency.setValueAtTime(800, audioCtx.currentTime);
        oscillator.frequency.setValueAtTime(1000, audioCtx.currentTime + 0.1);
        oscillator.frequency.setValueAtTime(800, audioCtx.currentTime + 0.2);
        
        gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
        
        oscillator.start(audioCtx.currentTime);
        oscillator.stop(audioCtx.currentTime + 0.3);
    } catch (e) {
        // Audio not available, ignore
    }
}

// Start polling for new notifications
function startNotifPolling() {
    // Initial fetch
    fetchAdminNotifications();

    // Poll every 15 seconds
    notifPollingInterval = setInterval(() => {
        fetchAdminNotifications();
    }, 15000);
}

// Stop polling when leaving page
window.addEventListener('beforeunload', () => {
    if (notifPollingInterval) {
        clearInterval(notifPollingInterval);
    }
});
