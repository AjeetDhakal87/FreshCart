// My Orders logic - Enhanced with tracking, delivery dates, filters, search & history

let allUserOrders = [];
let currentFilter = 'all';

function formatDuration(ms) {
    if (isNaN(ms) || ms < 0) ms = 0;
    const totalSeconds = Math.floor(ms / 1000);
    const totalMinutes = Math.floor(totalSeconds / 60);
    const totalHours = Math.floor(totalMinutes / 60);
    const days = Math.floor(totalHours / 24);
    const remainingHours = totalHours % 24;
    const remainingMinutes = totalMinutes % 60;

    if (days >= 1) {
        if (remainingHours > 0) return `${days} day${days > 1 ? 's' : ''} ${remainingHours} hr${remainingHours > 1 ? 's' : ''}`;
        return `${days} day${days > 1 ? 's' : ''}`;
    }
    if (totalHours >= 1) {
        if (remainingMinutes > 0) return `${totalHours} hr${totalHours > 1 ? 's' : ''} ${remainingMinutes} min`;
        return `${totalHours} hour${totalHours > 1 ? 's' : ''}`;
    }
    if (totalMinutes >= 1) return `${totalMinutes} min${totalMinutes > 1 ? 's' : ''}`;
    return '< 1 min';
}

function getOrderAge(order, now = new Date()) {
    if (!order || !order.created_at) return { text: 'N/A' };
    const diff = Math.max(0, now - new Date(order.created_at));
    return { text: formatDuration(diff) };
}

function getStatusDurationInfo(order, now = new Date()) {
    if (!order) return { label: 'Status', durationText: 'N/A' };
    const status = order.status || 'Pending';
    const created = new Date(order.created_at);

    if (status === 'Delivered') {
        const delivered = order.delivered_at ? new Date(order.delivered_at) : (order.current_status_started_at ? new Date(order.current_status_started_at) : now);
        const fulfillmentMs = Math.max(0, delivered - created);
        return {
            label: 'Delivered in',
            durationText: formatDuration(fulfillmentMs)
        };
    }

    if (status === 'Cancelled') {
        const cancelled = order.cancelled_at ? new Date(order.cancelled_at) : (order.current_status_started_at ? new Date(order.current_status_started_at) : now);
        const cancelledAfterMs = Math.max(0, cancelled - created);
        return {
            label: 'Cancelled after',
            durationText: formatDuration(cancelledAfterMs)
        };
    }

    const statusStart = order.current_status_started_at ? new Date(order.current_status_started_at) : created;
    const diff = Math.max(0, now - statusStart);
    const displayStatus = (status === 'Shipped' || status === 'Shipping') ? 'Shipping' : status;

    return {
        label: `In ${displayStatus}`,
        durationText: formatDuration(diff)
    };
}

document.addEventListener('DOMContentLoaded', () => {
    initOrdersPage();
});

async function initOrdersPage() {
    // Wait for Supabase to be initialized
    let dbLoaded = false;
    for (let i = 0; i < 30; i++) {
        if (window.supabase && window.authHelpers) {
            dbLoaded = true;
            break;
        }
        await new Promise(resolve => setTimeout(resolve, 100));
    }

    if (!dbLoaded) {
        document.getElementById('loadingOrders').innerHTML = "Failed to connect to database. Please refresh.";
        return;
    }

    try {
        const session = await window.authHelpers.getCurrentSession();
        if (!session) {
            window.location.href = 'login.html?redirect=orders.html';
            return;
        }

        const userId = session.user.id;
        await fetchUserOrders(userId);

    } catch (err) {
        console.error("Auth error:", err);
        document.getElementById('loadingOrders').innerHTML = "Authentication error. Please log in again.";
    }
}

async function fetchUserOrders(userId) {
    try {
        const { data: orders, error } = await window.supabase
            .from('orders')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (error) throw error;

        document.getElementById('loadingOrders').style.display = 'none';

        if (!orders || orders.length === 0) {
            document.getElementById('noOrders').style.display = 'block';
            return;
        }

        allUserOrders = orders;
        
        // Show filters, stats, search and history
        document.getElementById('orderFilters').style.display = 'flex';
        document.getElementById('ordersStats').style.display = 'grid';
        document.getElementById('orderSearchWrap').style.display = 'block';
        document.getElementById('historySection').style.display = 'block';
        
        renderOrderStats(orders);
        renderOrders(orders);
        renderHistorySection();
        initSearchBox();

    } catch (err) {
        console.error("Failed to fetch orders:", err);
        document.getElementById('loadingOrders').innerHTML = "Failed to load orders. Please try again.";
    }
}

function renderOrderStats(orders) {
    const statsEl = document.getElementById('ordersStats');
    if (!statsEl) return;

    const totalOrders = orders.length;
    const totalSpent = orders.reduce((sum, o) => sum + parseFloat(o.total || 0), 0);
    const activeOrders = orders.filter(o => ['Pending', 'Processing', 'Shipped'].includes(o.status)).length;
    const deliveredOrders = orders.filter(o => o.status === 'Delivered').length;

    statsEl.innerHTML = `
        <div class="stat-card">
            <div class="stat-value">${totalOrders}</div>
            <div class="stat-label">Total Orders</div>
        </div>
        <div class="stat-card">
            <div class="stat-value" style="color: var(--primary-color);">Rs. ${totalSpent.toFixed(0)}</div>
            <div class="stat-label">Total Spent</div>
        </div>
        <div class="stat-card">
            <div class="stat-value" style="color: #1e40af;">${activeOrders}</div>
            <div class="stat-label">Active Orders</div>
        </div>
        <div class="stat-card">
            <div class="stat-value" style="color: #166534;">${deliveredOrders}</div>
            <div class="stat-label">Delivered</div>
        </div>
    `;
}

// ── Search Box ────────────────────────────────────────────────────────────────
function initSearchBox() {
    const input = document.getElementById('orderSearchInput');
    const clearBtn = document.getElementById('searchClearBtn');
    if (!input || !clearBtn) return;

    input.addEventListener('input', () => {
        const q = input.value.trim();
        clearBtn.style.display = q ? 'block' : 'none';
        handleSearch(q);
    });

    clearBtn.addEventListener('click', () => {
        input.value = '';
        clearBtn.style.display = 'none';
        // Reset to current filter
        const filtered = currentFilter === 'all'
            ? allUserOrders
            : allUserOrders.filter(o => o.status === currentFilter);
        renderOrders(filtered);
        input.focus();
    });
}

function handleSearch(query) {
    if (!query) {
        // Show current filter
        const filtered = currentFilter === 'all'
            ? allUserOrders
            : allUserOrders.filter(o => o.status === currentFilter);
        renderOrders(filtered);
        return;
    }

    // Normalize query: strip "FC-" prefix if present, also allow partial numeric match
    const normalized = query.replace(/^fc-?/i, '').trim();
    const results = allUserOrders.filter(o => {
        const orderId = String(o.id);
        return orderId.includes(normalized) ||
               String(o.id).toLowerCase().includes(query.toLowerCase().replace(/^fc-?/i,''));
    });

    renderOrders(results, query);
}

// ── History Section ───────────────────────────────────────────────────────────
window.renderHistorySection = function() {
    if (!allUserOrders.length) return;

    const rangeEl = document.getElementById('historyRangeSelect');
    const range = rangeEl ? rangeEl.value : '30';
    const now = new Date();

    // Filter orders by date range
    let rangeOrders = allUserOrders;
    if (range !== 'all') {
        const days = parseInt(range);
        const cutoff = new Date(now);
        cutoff.setDate(cutoff.getDate() - days);
        rangeOrders = allUserOrders.filter(o => new Date(o.created_at) >= cutoff);
    }

    // Group by date (YYYY-MM-DD)
    const dayMap = {};
    rangeOrders.forEach(o => {
        const dateKey = new Date(o.created_at).toLocaleDateString('en-CA'); // YYYY-MM-DD
        if (!dayMap[dateKey]) dayMap[dateKey] = { orders: [], revenue: 0, statuses: {} };
        dayMap[dateKey].orders.push(o);
        dayMap[dateKey].revenue += parseFloat(o.total || 0);
        const s = o.status || 'Pending';
        dayMap[dateKey].statuses[s] = (dayMap[dateKey].statuses[s] || 0) + 1;
    });

    // Sort dates ascending
    const sortedDates = Object.keys(dayMap).sort();

    // For "all time" with many days, group by week/month when > 60 days
    let chartData = sortedDates.map(d => ({
        label: d,
        displayLabel: formatChartDate(d, range),
        orderCount: dayMap[d].orders.length,
        revenue: dayMap[d].revenue,
        statuses: dayMap[d].statuses,
        avgValue: dayMap[d].orders.length > 0 ? dayMap[d].revenue / dayMap[d].orders.length : 0
    }));

    // Summary stats
    const totalRevenue = rangeOrders.reduce((s, o) => s + parseFloat(o.total || 0), 0);
    const totalOrds = rangeOrders.length;
    const avgOrderValue = totalOrds > 0 ? totalRevenue / totalOrds : 0;
    const bestDay = chartData.reduce((best, d) => d.revenue > (best ? best.revenue : -1) ? d : best, null);
    const deliveredCount = rangeOrders.filter(o => o.status === 'Delivered').length;

    // Render summary cards
    const summaryGrid = document.getElementById('historySummaryGrid');
    if (summaryGrid) {
        summaryGrid.innerHTML = `
            <div class="history-summary-card">
                <div class="hsc-value" style="color: var(--primary-color);">Rs. ${totalRevenue.toFixed(0)}</div>
                <div class="hsc-label">Total Revenue</div>
            </div>
            <div class="history-summary-card">
                <div class="hsc-value">${totalOrds}</div>
                <div class="hsc-label">Orders Placed</div>
            </div>
            <div class="history-summary-card">
                <div class="hsc-value">Rs. ${avgOrderValue.toFixed(0)}</div>
                <div class="hsc-label">Avg. Order Value</div>
            </div>
            <div class="history-summary-card">
                <div class="hsc-value" style="color: #166534;">${deliveredCount}</div>
                <div class="hsc-label">Delivered</div>
            </div>
            ${bestDay ? `
            <div class="history-summary-card">
                <div class="hsc-value" style="font-size: 1rem; color: var(--primary-color);">${bestDay.displayLabel}</div>
                <div class="hsc-label">Best Day (Rs. ${bestDay.revenue.toFixed(0)})</div>
            </div>` : ''}
        `;
    }

    // Render bar chart
    renderHistoryChart(chartData);

    // Render table (descending by date)
    renderHistoryTable([...chartData].reverse());
};

function formatChartDate(dateStr, range) {
    const d = new Date(dateStr + 'T00:00:00');
    if (range === '7') {
        return d.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' });
    }
    if (range === '14' || range === '30') {
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function renderHistoryChart(chartData) {
    const chartEl = document.getElementById('historyChart');
    if (!chartEl || !chartData.length) {
        if (chartEl) chartEl.innerHTML = '<div style="padding:30px;color:var(--text-light);text-align:center;">No data for this period.</div>';
        return;
    }

    const maxRevenue = Math.max(...chartData.map(d => d.revenue), 1);
    const maxOrders = Math.max(...chartData.map(d => d.orderCount), 1);
    const CHART_HEIGHT = 140; // px

    chartEl.innerHTML = chartData.map(d => {
        const revHeight = Math.max(4, Math.round((d.revenue / maxRevenue) * CHART_HEIGHT));
        const ordHeight = Math.max(4, Math.round((d.orderCount / maxOrders) * CHART_HEIGHT));

        return `
            <div class="hc-bar-group">
                <div class="hc-bar-track">
                    <div style="display:flex;align-items:flex-end;gap:2px;height:${CHART_HEIGHT}px;width:100%;justify-content:center;">
                        <div class="hc-bar hc-bar-revenue" style="height:${revHeight}px;width:38%;">
                            <div class="hc-tooltip">Rs. ${d.revenue.toFixed(0)}</div>
                        </div>
                        <div class="hc-bar hc-bar-orders" style="height:${ordHeight}px;width:38%;">
                            <div class="hc-tooltip">${d.orderCount} order${d.orderCount !== 1 ? 's' : ''}</div>
                        </div>
                    </div>
                </div>
                <div class="hc-date-label">${d.displayLabel}</div>
            </div>
        `;
    }).join('');
}

function renderHistoryTable(chartData) {
    const tbody = document.getElementById('historyTableBody');
    if (!tbody) return;

    if (!chartData.length) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:30px;color:var(--text-light);">No orders in this period.</td></tr>`;
        return;
    }

    tbody.innerHTML = chartData.map(d => {
        const dateDisplay = new Date(d.label + 'T00:00:00').toLocaleDateString('en-US', {
            weekday: 'short', year: 'numeric', month: 'short', day: 'numeric'
        });

        // Find dominant status of the day
        const topStatus = Object.entries(d.statuses).sort((a, b) => b[1] - a[1])[0];
        const statusColors = {
            'Pending': '#854d0e', 'Processing': '#1e40af', 'Shipped': '#9d174d',
            'Delivered': '#166534', 'Cancelled': '#991b1b'
        };
        const dotColor = topStatus ? (statusColors[topStatus[0]] || '#888') : '#888';
        const statusLabel = topStatus ? `<span class="hrow-badge" style="background:${dotColor};"></span>${topStatus[0]}` : '—';

        return `
            <tr>
                <td class="hrow-date">${dateDisplay}</td>
                <td class="hrow-orders">${d.orderCount}</td>
                <td class="hrow-rev">Rs. ${d.revenue.toFixed(2)}</td>
                <td class="hrow-avg">Rs. ${d.avgValue.toFixed(2)}</td>
                <td>${statusLabel}</td>
            </tr>
        `;
    }).join('');
}

// Filter orders by status
window.filterOrders = function(filter, chipEl) {
    currentFilter = filter;
    
    // Clear search when changing filter
    const searchInput = document.getElementById('orderSearchInput');
    const clearBtn = document.getElementById('searchClearBtn');
    if (searchInput) searchInput.value = '';
    if (clearBtn) clearBtn.style.display = 'none';

    // Update chip UI
    document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
    if (chipEl) chipEl.classList.add('active');

    const filtered = filter === 'all' 
        ? allUserOrders 
        : allUserOrders.filter(o => o.status === filter);

    renderOrders(filtered);
};

function getStatusIcon(status) {
    const icons = {
        'Pending': 'fa-clock',
        'Processing': 'fa-gears',
        'Shipped': 'fa-truck-fast',
        'Delivered': 'fa-circle-check',
        'Cancelled': 'fa-circle-xmark'
    };
    return icons[status] || 'fa-circle-question';
}

function buildTrackerHTML(status) {
    const steps = ['Pending', 'Processing', 'Shipped', 'Delivered'];
    const stepIcons = {
        'Pending': 'fa-clock',
        'Processing': 'fa-gears',
        'Shipped': 'fa-truck-fast',
        'Delivered': 'fa-circle-check'
    };

    if (status === 'Cancelled') {
        return `
            <div class="order-tracker" style="background: linear-gradient(135deg, rgba(231,76,60,0.03), rgba(231,76,60,0.06));">
                <div class="tracker-title"><i class="fa-solid fa-route"></i> Order Status</div>
                <div class="tracker-steps">
                    ${steps.map((step, i) => {
                        if (i === 0) {
                            return `<div class="tracker-step completed">
                                <div class="step-icon"><i class="fa-solid ${stepIcons[step]}"></i></div>
                                <span class="step-label">${step}</span>
                            </div>`;
                        }
                        if (step === 'Delivered') {
                            return `<div class="tracker-step cancelled">
                                <div class="step-icon"><i class="fa-solid fa-xmark"></i></div>
                                <span class="step-label">Cancelled</span>
                            </div>`;
                        }
                        return `<div class="tracker-step">
                            <div class="step-icon"><i class="fa-solid ${stepIcons[step]}"></i></div>
                            <span class="step-label">${step}</span>
                        </div>`;
                    }).join('')}
                </div>
            </div>
        `;
    }

    const currentIndex = steps.indexOf(status);

    return `
        <div class="order-tracker">
            <div class="tracker-title"><i class="fa-solid fa-route"></i> Order Tracking</div>
            <div class="tracker-steps">
                ${steps.map((step, i) => {
                    let cls = '';
                    if (i < currentIndex) cls = 'completed';
                    else if (i === currentIndex) cls = status === 'Delivered' ? 'completed' : 'active';
                    
                    return `<div class="tracker-step ${cls}">
                        <div class="step-icon"><i class="fa-solid ${stepIcons[step]}"></i></div>
                        <span class="step-label">${step}</span>
                    </div>`;
                }).join('')}
            </div>
        </div>
    `;
}

function renderOrders(orders, searchQuery = '') {
    const listEl = document.getElementById('ordersList');
    listEl.innerHTML = '';

    if (orders.length === 0) {
        if (searchQuery) {
            listEl.innerHTML = `
                <div class="search-no-result">
                    <i class="fa-solid fa-magnifying-glass"></i>
                    <p style="font-weight: 600;">No order found for "<strong>#FC-${searchQuery.replace(/^fc-?/i,'')}</strong>"</p>
                    <p style="font-size: 0.88rem; margin-top: 6px;">Try entering the numeric part of the Order ID, e.g. <code>12345</code></p>
                </div>
            `;
        } else {
            listEl.innerHTML = `
                <div style="text-align: center; padding: 40px; color: var(--text-light);">
                    <i class="fa-solid fa-filter-circle-xmark" style="font-size: 2.5rem; margin-bottom: 15px; display: block; color: var(--border-color);"></i>
                    <p style="font-weight: 600;">No orders found for this filter.</p>
                    <p style="font-size: 0.9rem;">Try a different status filter above.</p>
                </div>
            `;
        }
        return;
    }

    orders.forEach((order, idx) => {
        const dateStr = new Date(order.created_at).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        const timeStr = new Date(order.created_at).toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit'
        });

        const deliveryDateStr = order.delivery_date ? new Date(order.delivery_date).toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        }) : null;

        // Calculate days until delivery
        let deliveryInfo = '';
        if (order.delivery_date && order.status !== 'Delivered' && order.status !== 'Cancelled') {
            const now = new Date();
            const delDate = new Date(order.delivery_date);
            const diffDays = Math.ceil((delDate - now) / (1000 * 60 * 60 * 24));
            if (diffDays > 0) {
                deliveryInfo = `(in ${diffDays} day${diffDays > 1 ? 's' : ''})`;
            } else if (diffDays === 0) {
                deliveryInfo = '(Today!)';
            } else {
                deliveryInfo = `(${Math.abs(diffDays)} day${Math.abs(diffDays) > 1 ? 's' : ''} ago)`;
            }
        }

        const itemsHtml = order.items.map(item => {
            const unitLabel = (typeof getUnitLabel === 'function') ? getUnitLabel(item.unit || 'kg', item.quantity) : `Qty: ${item.quantity}`;
            return `
            <div class="order-item">
                <img src="${item.image}" alt="${item.name}" class="item-img" onerror="this.src='images/products/product_1.jpg'">
                <div class="item-details">
                    <div class="item-name">${item.name}</div>
                    <div class="item-meta">${unitLabel} × Rs. ${parseFloat(item.price).toFixed(2)}</div>
                </div>
                <div class="item-price">Rs. ${(item.price * item.quantity).toFixed(2)}</div>
            </div>
        `}).join('');

        const statusClass = `status-${(order.status || 'pending').toLowerCase()}`;
        const statusIcon = getStatusIcon(order.status);

        // Build delivery date highlight bar
        let deliveryBar = '';
        if (order.status === 'Delivered') {
            deliveryBar = `
                <div class="delivery-highlight" style="background: linear-gradient(135deg, rgba(22,101,52,0.06), rgba(22,101,52,0.1)); border-color: #166534; margin: 0 20px 0;">
                    <i class="fa-solid fa-circle-check" style="color: #166534;"></i>
                    <div class="delivery-text">
                        Delivered${deliveryDateStr ? ' on <span class="delivery-date-val" style="color: #166534;">' + deliveryDateStr + '</span>' : ''}
                    </div>
                </div>
            `;
        } else if (deliveryDateStr && order.status !== 'Cancelled') {
            deliveryBar = `
                <div class="delivery-highlight">
                    <i class="fa-solid fa-calendar-check"></i>
                    <div class="delivery-text">
                        Expected Delivery: <span class="delivery-date-val">${deliveryDateStr}</span> 
                        <span style="font-size: 0.8rem; color: var(--text-light); font-weight: 500;">${deliveryInfo}</span>
                    </div>
                </div>
            `;
        } else if (!deliveryDateStr && order.status !== 'Cancelled' && order.status !== 'Delivered') {
            deliveryBar = `
                <div class="delivery-highlight" style="border-color: var(--border-color); background: var(--secondary-color);">
                    <i class="fa-solid fa-clock" style="color: var(--text-light);"></i>
                    <div class="delivery-text" style="color: var(--text-light);">
                        Delivery date will be assigned soon
                    </div>
                </div>
            `;
        }

        const orderAge = getOrderAge(order);
        const durationInfo = getStatusDurationInfo(order);

        const card = document.createElement('div');
        card.className = 'order-card';
        card.innerHTML = `
            <div class="order-header">
                <div class="order-header-info">
                    <div class="info-group">
                        <span class="info-label">Order ID</span>
                        <span class="info-value" style="font-family: monospace; letter-spacing: 0.5px;">#FC-${order.id}</span>
                    </div>
                    <div class="info-group">
                        <span class="info-label">Order Placed</span>
                        <span class="info-value">${dateStr}</span>
                    </div>
                    <div class="info-group">
                        <span class="info-label">Order Age</span>
                        <span class="info-value" style="color: var(--text-dark);"><i class="fa-regular fa-clock" style="font-size:0.8rem; margin-right:3px;"></i> ${orderAge.text}</span>
                    </div>
                    <div class="info-group">
                        <span class="info-label">${durationInfo.label}</span>
                        <span class="info-value" style="color: var(--primary-color);">${durationInfo.durationText}</span>
                    </div>
                    <div class="info-group">
                        <span class="info-label">Total Amount</span>
                        <span class="info-value" style="color: var(--primary-color); font-weight: 800;">Rs. ${parseFloat(order.total).toFixed(2)}</span>
                    </div>
                    <div class="info-group">
                        <span class="info-label">Items</span>
                        <span class="info-value">${order.items.length} product${order.items.length > 1 ? 's' : ''}</span>
                    </div>
                </div>
            </div>

            ${buildTrackerHTML(order.status)}

            ${deliveryBar}

            <button class="order-body-toggle" onclick="toggleOrderBody(this)">
                <i class="fa-solid fa-chevron-down"></i> View Order Items (${order.items.length})
            </button>
            <div class="order-body collapsed">
                ${itemsHtml}
            </div>

            <div class="order-footer">
                <div>
                    <span class="info-label" style="display:inline-block; margin-right: 10px;">Payment:</span>
                    <span style="font-weight: 600; color: ${order.payment_status === 'Paid' ? '#166534' : 'var(--text-light)'}">
                        <i class="fa-solid ${order.payment_status === 'Paid' ? 'fa-circle-check' : 'fa-clock'}" style="margin-right: 4px;"></i>
                        ${order.payment_status || 'Pending'} (${order.payment_method})
                    </span>
                </div>
                <div class="order-status-badge ${statusClass}">
                    <i class="fa-solid ${statusIcon}"></i>
                    ${order.status}
                </div>
            </div>
        `;
        
        listEl.appendChild(card);
    });
}

// Toggle order items visibility
window.toggleOrderBody = function(btn) {
    const body = btn.nextElementSibling;
    btn.classList.toggle('expanded');
    body.classList.toggle('collapsed');
};


function formatDuration(ms) {
    if (isNaN(ms) || ms < 0) ms = 0;
    const totalSeconds = Math.floor(ms / 1000);
    const totalMinutes = Math.floor(totalSeconds / 60);
    const totalHours = Math.floor(totalMinutes / 60);
    const days = Math.floor(totalHours / 24);
    const remainingHours = totalHours % 24;
    const remainingMinutes = totalMinutes % 60;

    if (days >= 1) {
        if (remainingHours > 0) return `${days} day${days > 1 ? 's' : ''} ${remainingHours} hr${remainingHours > 1 ? 's' : ''}`;
        return `${days} day${days > 1 ? 's' : ''}`;
    }
    if (totalHours >= 1) {
        if (remainingMinutes > 0) return `${totalHours} hr${totalHours > 1 ? 's' : ''} ${remainingMinutes} min`;
        return `${totalHours} hour${totalHours > 1 ? 's' : ''}`;
    }
    if (totalMinutes >= 1) return `${totalMinutes} min${totalMinutes > 1 ? 's' : ''}`;
    return '< 1 min';
}

function getOrderAge(order, now = new Date()) {
    if (!order || !order.created_at) return { text: 'N/A' };
    const diff = Math.max(0, now - new Date(order.created_at));
    return { text: formatDuration(diff) };
}

function getStatusDurationInfo(order, now = new Date()) {
    if (!order) return { label: 'Status', durationText: 'N/A' };
    const status = order.status || 'Pending';
    const created = new Date(order.created_at);

    if (status === 'Delivered') {
        const delivered = order.delivered_at ? new Date(order.delivered_at) : (order.current_status_started_at ? new Date(order.current_status_started_at) : now);
        const fulfillmentMs = Math.max(0, delivered - created);
        return {
            label: 'Delivered in',
            durationText: formatDuration(fulfillmentMs)
        };
    }

    if (status === 'Cancelled') {
        const cancelled = order.cancelled_at ? new Date(order.cancelled_at) : (order.current_status_started_at ? new Date(order.current_status_started_at) : now);
        const cancelledAfterMs = Math.max(0, cancelled - created);
        return {
            label: 'Cancelled after',
            durationText: formatDuration(cancelledAfterMs)
        };
    }

    const statusStart = order.current_status_started_at ? new Date(order.current_status_started_at) : created;
    const diff = Math.max(0, now - statusStart);
    const displayStatus = (status === 'Shipped' || status === 'Shipping') ? 'Shipping' : status;

    return {
        label: `In ${displayStatus}`,
        durationText: formatDuration(diff)
    };
}

document.addEventListener('DOMContentLoaded', () => {
    initOrdersPage();
});

async function initOrdersPage() {
    // Wait for Supabase to be initialized
    let dbLoaded = false;
    for (let i = 0; i < 30; i++) {
        if (window.supabase && window.authHelpers) {
            dbLoaded = true;
            break;
        }
        await new Promise(resolve => setTimeout(resolve, 100));
    }

    if (!dbLoaded) {
        document.getElementById('loadingOrders').innerHTML = "Failed to connect to database. Please refresh.";
        return;
    }

    try {
        const session = await window.authHelpers.getCurrentSession();
        if (!session) {
            window.location.href = 'login.html?redirect=orders.html';
            return;
        }

        const userId = session.user.id;
        await fetchUserOrders(userId);

    } catch (err) {
        console.error("Auth error:", err);
        document.getElementById('loadingOrders').innerHTML = "Authentication error. Please log in again.";
    }
}

async function fetchUserOrders(userId) {
    try {
        const { data: orders, error } = await window.supabase
            .from('orders')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (error) throw error;

        document.getElementById('loadingOrders').style.display = 'none';

        if (!orders || orders.length === 0) {
            document.getElementById('noOrders').style.display = 'block';
            return;
        }

        allUserOrders = orders;
        
        // Show filters and stats
        document.getElementById('orderFilters').style.display = 'flex';
        document.getElementById('ordersStats').style.display = 'grid';
        
        renderOrderStats(orders);
        renderOrders(orders);

    } catch (err) {
        console.error("Failed to fetch orders:", err);
        document.getElementById('loadingOrders').innerHTML = "Failed to load orders. Please try again.";
    }
}

function renderOrderStats(orders) {
    const statsEl = document.getElementById('ordersStats');
    if (!statsEl) return;

    const totalOrders = orders.length;
    const totalSpent = orders.reduce((sum, o) => sum + parseFloat(o.total || 0), 0);
    const activeOrders = orders.filter(o => ['Pending', 'Processing', 'Shipped'].includes(o.status)).length;
    const deliveredOrders = orders.filter(o => o.status === 'Delivered').length;

    statsEl.innerHTML = `
        <div class="stat-card">
            <div class="stat-value">${totalOrders}</div>
            <div class="stat-label">Total Orders</div>
        </div>
        <div class="stat-card">
            <div class="stat-value" style="color: var(--primary-color);">Rs. ${totalSpent.toFixed(0)}</div>
            <div class="stat-label">Total Spent</div>
        </div>
        <div class="stat-card">
            <div class="stat-value" style="color: #1e40af;">${activeOrders}</div>
            <div class="stat-label">Active Orders</div>
        </div>
        <div class="stat-card">
            <div class="stat-value" style="color: #166534;">${deliveredOrders}</div>
            <div class="stat-label">Delivered</div>
        </div>
    `;
}

// Filter orders by status
window.filterOrders = function(filter, chipEl) {
    currentFilter = filter;
    
    // Update chip UI
    document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
    if (chipEl) chipEl.classList.add('active');

    const filtered = filter === 'all' 
        ? allUserOrders 
        : allUserOrders.filter(o => o.status === filter);

    renderOrders(filtered);
};

function getStatusIcon(status) {
    const icons = {
        'Pending': 'fa-clock',
        'Processing': 'fa-gears',
        'Shipped': 'fa-truck-fast',
        'Delivered': 'fa-circle-check',
        'Cancelled': 'fa-circle-xmark'
    };
    return icons[status] || 'fa-circle-question';
}

function buildTrackerHTML(status) {
    const steps = ['Pending', 'Processing', 'Shipped', 'Delivered'];
    const stepIcons = {
        'Pending': 'fa-clock',
        'Processing': 'fa-gears',
        'Shipped': 'fa-truck-fast',
        'Delivered': 'fa-circle-check'
    };

    if (status === 'Cancelled') {
        return `
            <div class="order-tracker" style="background: linear-gradient(135deg, rgba(231,76,60,0.03), rgba(231,76,60,0.06));">
                <div class="tracker-title"><i class="fa-solid fa-route"></i> Order Status</div>
                <div class="tracker-steps">
                    ${steps.map((step, i) => {
                        if (i === 0) {
                            return `<div class="tracker-step completed">
                                <div class="step-icon"><i class="fa-solid ${stepIcons[step]}"></i></div>
                                <span class="step-label">${step}</span>
                            </div>`;
                        }
                        if (step === 'Delivered') {
                            return `<div class="tracker-step cancelled">
                                <div class="step-icon"><i class="fa-solid fa-xmark"></i></div>
                                <span class="step-label">Cancelled</span>
                            </div>`;
                        }
                        return `<div class="tracker-step">
                            <div class="step-icon"><i class="fa-solid ${stepIcons[step]}"></i></div>
                            <span class="step-label">${step}</span>
                        </div>`;
                    }).join('')}
                </div>
            </div>
        `;
    }

    const currentIndex = steps.indexOf(status);

    return `
        <div class="order-tracker">
            <div class="tracker-title"><i class="fa-solid fa-route"></i> Order Tracking</div>
            <div class="tracker-steps">
                ${steps.map((step, i) => {
                    let cls = '';
                    if (i < currentIndex) cls = 'completed';
                    else if (i === currentIndex) cls = status === 'Delivered' ? 'completed' : 'active';
                    
                    return `<div class="tracker-step ${cls}">
                        <div class="step-icon"><i class="fa-solid ${stepIcons[step]}"></i></div>
                        <span class="step-label">${step}</span>
                    </div>`;
                }).join('')}
            </div>
        </div>
    `;
}

function renderOrders(orders) {
    const listEl = document.getElementById('ordersList');
    listEl.innerHTML = '';

    if (orders.length === 0) {
        listEl.innerHTML = `
            <div style="text-align: center; padding: 40px; color: var(--text-light);">
                <i class="fa-solid fa-filter-circle-xmark" style="font-size: 2.5rem; margin-bottom: 15px; display: block; color: var(--border-color);"></i>
                <p style="font-weight: 600;">No orders found for this filter.</p>
                <p style="font-size: 0.9rem;">Try a different status filter above.</p>
            </div>
        `;
        return;
    }

    orders.forEach((order, idx) => {
        const dateStr = new Date(order.created_at).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        const timeStr = new Date(order.created_at).toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit'
        });

        const deliveryDateStr = order.delivery_date ? new Date(order.delivery_date).toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        }) : null;

        // Calculate days until delivery
        let deliveryInfo = '';
        if (order.delivery_date && order.status !== 'Delivered' && order.status !== 'Cancelled') {
            const now = new Date();
            const delDate = new Date(order.delivery_date);
            const diffDays = Math.ceil((delDate - now) / (1000 * 60 * 60 * 24));
            if (diffDays > 0) {
                deliveryInfo = `(in ${diffDays} day${diffDays > 1 ? 's' : ''})`;
            } else if (diffDays === 0) {
                deliveryInfo = '(Today!)';
            } else {
                deliveryInfo = `(${Math.abs(diffDays)} day${Math.abs(diffDays) > 1 ? 's' : ''} ago)`;
            }
        }

        const itemsHtml = order.items.map(item => {
            const unitLabel = (typeof getUnitLabel === 'function') ? getUnitLabel(item.unit || 'kg', item.quantity) : `Qty: ${item.quantity}`;
            return `
            <div class="order-item">
                <img src="${item.image}" alt="${item.name}" class="item-img" onerror="this.src='images/products/product_1.jpg'">
                <div class="item-details">
                    <div class="item-name">${item.name}</div>
                    <div class="item-meta">${unitLabel} × Rs. ${parseFloat(item.price).toFixed(2)}</div>
                </div>
                <div class="item-price">Rs. ${(item.price * item.quantity).toFixed(2)}</div>
            </div>
        `}).join('');

        const statusClass = `status-${(order.status || 'pending').toLowerCase()}`;
        const statusIcon = getStatusIcon(order.status);

        // Build delivery date highlight bar
        let deliveryBar = '';
        if (order.status === 'Delivered') {
            deliveryBar = `
                <div class="delivery-highlight" style="background: linear-gradient(135deg, rgba(22,101,52,0.06), rgba(22,101,52,0.1)); border-color: #166534; margin: 0 20px 0;">
                    <i class="fa-solid fa-circle-check" style="color: #166534;"></i>
                    <div class="delivery-text">
                        Delivered${deliveryDateStr ? ' on <span class="delivery-date-val" style="color: #166534;">' + deliveryDateStr + '</span>' : ''}
                    </div>
                </div>
            `;
        } else if (deliveryDateStr && order.status !== 'Cancelled') {
            deliveryBar = `
                <div class="delivery-highlight">
                    <i class="fa-solid fa-calendar-check"></i>
                    <div class="delivery-text">
                        Expected Delivery: <span class="delivery-date-val">${deliveryDateStr}</span> 
                        <span style="font-size: 0.8rem; color: var(--text-light); font-weight: 500;">${deliveryInfo}</span>
                    </div>
                </div>
            `;
        } else if (!deliveryDateStr && order.status !== 'Cancelled' && order.status !== 'Delivered') {
            deliveryBar = `
                <div class="delivery-highlight" style="border-color: var(--border-color); background: var(--secondary-color);">
                    <i class="fa-solid fa-clock" style="color: var(--text-light);"></i>
                    <div class="delivery-text" style="color: var(--text-light);">
                        Delivery date will be assigned soon
                    </div>
                </div>
            `;
        }

        const orderAge = getOrderAge(order);
        const durationInfo = getStatusDurationInfo(order);

        const card = document.createElement('div');
        card.className = 'order-card';
        card.innerHTML = `
            <div class="order-header">
                <div class="order-header-info">
                    <div class="info-group">
                        <span class="info-label">Order ID</span>
                        <span class="info-value" style="font-family: monospace; letter-spacing: 0.5px;">#FC-${order.id}</span>
                    </div>
                    <div class="info-group">
                        <span class="info-label">Order Placed</span>
                        <span class="info-value">${dateStr}</span>
                    </div>
                    <div class="info-group">
                        <span class="info-label">Order Age</span>
                        <span class="info-value" style="color: var(--text-dark);"><i class="fa-regular fa-clock" style="font-size:0.8rem; margin-right:3px;"></i> ${orderAge.text}</span>
                    </div>
                    <div class="info-group">
                        <span class="info-label">${durationInfo.label}</span>
                        <span class="info-value" style="color: var(--primary-color);">${durationInfo.durationText}</span>
                    </div>
                    <div class="info-group">
                        <span class="info-label">Total Amount</span>
                        <span class="info-value" style="color: var(--primary-color); font-weight: 800;">Rs. ${parseFloat(order.total).toFixed(2)}</span>
                    </div>
                    <div class="info-group">
                        <span class="info-label">Items</span>
                        <span class="info-value">${order.items.length} product${order.items.length > 1 ? 's' : ''}</span>
                    </div>
                </div>
            </div>

            ${buildTrackerHTML(order.status)}

            ${deliveryBar}

            <button class="order-body-toggle" onclick="toggleOrderBody(this)">
                <i class="fa-solid fa-chevron-down"></i> View Order Items (${order.items.length})
            </button>
            <div class="order-body collapsed">
                ${itemsHtml}
            </div>

            <div class="order-footer">
                <div>
                    <span class="info-label" style="display:inline-block; margin-right: 10px;">Payment:</span>
                    <span style="font-weight: 600; color: ${order.payment_status === 'Paid' ? '#166534' : 'var(--text-light)'}">
                        <i class="fa-solid ${order.payment_status === 'Paid' ? 'fa-circle-check' : 'fa-clock'}" style="margin-right: 4px;"></i>
                        ${order.payment_status || 'Pending'} (${order.payment_method})
                    </span>
                </div>
                <div class="order-status-badge ${statusClass}">
                    <i class="fa-solid ${statusIcon}"></i>
                    ${order.status}
                </div>
            </div>
        `;
        
        listEl.appendChild(card);
    });
}

// Toggle order items visibility
window.toggleOrderBody = function(btn) {
    const body = btn.nextElementSibling;
    btn.classList.toggle('expanded');
    body.classList.toggle('collapsed');
};
