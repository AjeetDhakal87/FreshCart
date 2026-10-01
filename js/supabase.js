// Supabase Configuration and Initialization
const SUPABASE_URL = "https://jlouazcpnfoumrvcyiqj.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impsb3VhemNwbmZvdW1ydmN5aXFqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkxNTc0NjUsImV4cCI6MjA5NDczMzQ2NX0.cHuhURxBoy2IMzatMLn1AfE5WpttvpoXj-i_kJ6RkkY";

window.supabase = null;

// Dynamically load Supabase CDN if not already loaded
function loadSupabaseScript() {
    return new Promise((resolve, reject) => {
        // If client is already fully initialized, resolve immediately
        if (window.supabase && typeof window.supabase.auth !== 'undefined') {
            resolve(window.supabase);
            return;
        }
        
        // If script is already in the document, wait for client initialization
        const existingScript = document.querySelector('script[src*="cdn.jsdelivr.net/npm/@supabase"], script[src*="unpkg.com/@supabase"]');
        if (existingScript) {
            const checkInterval = setInterval(() => {
                if (window.supabase && typeof window.supabase.auth !== 'undefined') {
                    clearInterval(checkInterval);
                    resolve(window.supabase);
                }
            }, 50);
            
            // Timeout after 10 seconds
            setTimeout(() => {
                clearInterval(checkInterval);
                reject(new Error("Timeout waiting for Supabase client initialization"));
            }, 10000);
            
            return;
        }

        const script = document.createElement('script');
        script.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";
        script.async = true;
        script.onload = () => {
            initializeSupabaseClient();
            resolve(window.supabase);
        };
        script.onerror = (err) => {
            console.warn("jsdelivr CDN failed to load Supabase SDK, trying unpkg fallback...", err);
            // Fallback to unpkg CDN
            const fallbackScript = document.createElement('script');
            fallbackScript.src = "https://unpkg.com/@supabase/supabase-js@2";
            fallbackScript.async = true;
            fallbackScript.onload = () => {
                initializeSupabaseClient();
                resolve(window.supabase);
            };
            fallbackScript.onerror = (fallbackErr) => reject(fallbackErr);
            document.head.appendChild(fallbackScript);
        };
        document.head.appendChild(script);
    });
}

function initializeSupabaseClient() {
    if (window.supabase && typeof window.supabase.auth !== 'undefined') {
        // Already initialized client
        return;
    }

    const supabaseLib = window.supabasejs || window.supabaseJS || window.supabase;
    if (supabaseLib && typeof supabaseLib.createClient === 'function') {
        window.supabase = supabaseLib.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        console.log("Supabase client initialized successfully.");
        
        // Set up auth state change listener (synchronous to avoid deadlocks in Supabase client)
        window.supabase.auth.onAuthStateChange((event, session) => {
            console.log(`Auth event: ${event}`, session);
            
            const dispatchEvent = (profileData) => {
                const authEvent = new CustomEvent('auth-changed', {
                    detail: { event, session, profile: profileData }
                });
                window.dispatchEvent(authEvent);
            };

            if (session && session.user) {
                // Fetch the profile asynchronously in a non-blocking way
                fetchUserProfile(session.user.id).then(profile => {
                    dispatchEvent(profile);
                }).catch(err => {
                    console.error("Error fetching profile in auth change:", err);
                    dispatchEvent(null);
                });
            } else {
                dispatchEvent(null);
            }
        });
    } else {
        console.error("Supabase library not found or createClient is not a function on window.supabase");
    }
}

async function fetchUserProfile(userId) {
    try {
        const { data, error } = await window.supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single();
            
        if (error) throw error;
        return data;
    } catch (err) {
        console.error("Error fetching profile:", err);
        return null;
    }
}

// Authentication Helpers
window.authHelpers = {
    async signUp(email, password, fullName) {
        await loadSupabaseScript();
        const { data, error } = await window.supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    full_name: fullName
                }
            }
        });
        if (error) throw error;
        return data;
    },

    async signIn(email, password) {
        await loadSupabaseScript();
        const { data, error } = await window.supabase.auth.signInWithPassword({
            email,
            password
        });
        if (error) throw error;
        return data;
    },

    async signOut() {
        await loadSupabaseScript();
        const { error } = await window.supabase.auth.signOut();
        if (error) throw error;
        localStorage.removeItem('freshcart_session');
        localStorage.removeItem('freshcart_profile');
        window.location.reload();
    },

    async getCurrentSession() {
        await loadSupabaseScript();
        const { data: { session }, error } = await window.supabase.auth.getSession();
        if (error) return null;
        return session;
    },

    async getCurrentProfile() {
        const session = await this.getCurrentSession();
        if (!session || !session.user) return null;
        return await fetchUserProfile(session.user.id);
    }
};

// Admin Notification Helper
window.sendAdminNotification = async function(orderData) {
    try {
        // Wait for supabase
        for (let i = 0; i < 20; i++) {
            if (window.supabase) break;
            await new Promise(r => setTimeout(r, 100));
        }
        if (!window.supabase) return;

        const itemCount = orderData.items ? orderData.items.length : 0;
        const itemNames = orderData.items 
            ? orderData.items.map(i => `${i.name} (×${i.quantity})`).join(', ')
            : 'Unknown items';

        const notification = {
            type: 'new_order',
            title: `New Order from ${orderData.full_name || 'Customer'}`,
            message: `Rs. ${parseFloat(orderData.total).toFixed(2)} — ${itemCount} item${itemCount !== 1 ? 's' : ''}: ${itemNames}. Payment: ${orderData.payment_method} (${orderData.payment_status}).`,
            order_id: orderData.order_id || null,
            is_read: false
        };

        const { error } = await window.supabase
            .from('admin_notifications')
            .insert(notification);

        if (error) {
            console.error("Failed to send admin notification:", error);
        } else {
            console.log("Admin notification sent successfully!");
        }
    } catch (err) {
        console.error("Error sending admin notification:", err);
    }
};

// Auto-initialize when file is included
loadSupabaseScript().catch(err => {
    console.error("Failed to load Supabase SDK script:", err);
});
