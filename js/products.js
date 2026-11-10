// ========================================================================
// UNIT SYSTEM: Each product has a 'unit' type
// - 'kg'     → KG
// - 'litre'  → L
// - 'darjan' → Darjan (1 Darjan = 12 pieces)
// - 'pcs'    → pcs (counted items)
// - 'pack'   → Pack (packaged items)
// ========================================================================

const unitSuffixes = {
    kg: 'KG',
    litre: 'L',
    darjan: 'Darjan',
    pcs: 'pcs',
    pack: 'Pack'
};

// Helper: Format fractions cleanly (0.5 -> ½, 1.5 -> 1½)
function formatFraction(num) {
    if (num === 0.5) return '½';
    if (num === 0.25) return '¼';
    if (num === 0.75) return '¾';
    
    const integerPart = Math.floor(num);
    const decimalPart = Math.round((num - integerPart) * 100) / 100;
    if (decimalPart === 0.5) {
        return `${integerPart === 0 ? '' : integerPart}½`;
    }
    if (decimalPart === 0.25) {
        return `${integerPart === 0 ? '' : integerPart}¼`;
    }
    if (decimalPart === 0.75) {
        return `${integerPart === 0 ? '' : integerPart}¾`;
    }
    return num.toString();
}

// Helper: get unit label for a product (used in cart/checkout display)
function getUnitLabel(unitType, quantity) {
    if (!unitType) return `x${quantity}`;
    const formattedQty = formatFraction(quantity);
    switch (unitType) {
        case 'kg':     return `${formattedQty} KG`;
        case 'litre':  return `${formattedQty} L`;
        case 'darjan': {
            const totalPcs = Math.round(quantity * 12);
            return `${totalPcs} pcs (${formattedQty} Darjan)`;
        }
        case 'pcs':    return `${formattedQty} pcs`;
        case 'pack':   return `${formattedQty} Pack${quantity > 1 ? 's' : ''}`;
        default:       return `x${quantity}`;
    }
}

// Make helpers globally available
window.unitSuffixes = unitSuffixes;
window.getUnitLabel = getUnitLabel;
window.formatFraction = formatFraction;

const products = [
    // Vegetables (sold by KG) — prices in NPR
    { id: 1,  name: 'Potato',             category: 'vegetables', price: 35,   unit: 'kg',     image: 'images/products/potato.avif' },
    { id: 2,  name: 'Onion',              category: 'vegetables', price: 60,   unit: 'kg',     image: 'images/products/onions.jpg' },
    { id: 3,  name: 'Tomato',             category: 'vegetables', price: 55,   unit: 'kg',     image: 'images/products/tomato.webp' },
    { id: 4,  name: 'Cabbage',            category: 'vegetables', price: 40,   unit: 'kg',     image: 'images/products/cabbage.jpg' },
    { id: 5,  name: 'Cauliflower',        category: 'vegetables', price: 60,   unit: 'kg',     image: 'images/products/Cauliflower.jpg' },
    { id: 6,  name: 'Spinach',            category: 'vegetables', price: 50,   unit: 'kg',     image: 'images/products/Spinach.avif' },
    { id: 7,  name: 'Carrot',             category: 'vegetables', price: 50,   unit: 'kg',     image: 'images/products/Carrot.jpg' },
    { id: 8,  name: 'Brinjal (Eggplant)', category: 'vegetables', price: 45,   unit: 'kg',     image: 'images/products/Brinjal.webp' },
    { id: 9,  name: 'Green beans',        category: 'vegetables', price: 70,   unit: 'kg',     image: 'images/products/Green beans.jpg' },
    { id: 10, name: 'Cucumber',           category: 'vegetables', price: 40,   unit: 'kg',     image: 'images/products/Cucumber.jpg' },
    { id: 11, name: 'Pumpkin',            category: 'vegetables', price: 30,   unit: 'kg',     image: 'images/products/Pumpkin.jpg' },
    { id: 12, name: 'Garlic',             category: 'vegetables', price: 200,  unit: 'kg',     image: 'images/products/Garlic.jpg' },
    { id: 13, name: 'Ginger',             category: 'vegetables', price: 180,  unit: 'kg',     image: 'images/products/ginger.webp' },
    { id: 14, name: 'Green chili',        category: 'vegetables', price: 80,   unit: 'kg',     image: 'images/products/Green chili.jpg' },

    // Fruits — prices in NPR
    { id: 15, name: 'Apple',        category: 'fruits', price: 200,  unit: 'kg',     image: 'images/products/Apple.webp' },
    { id: 16, name: 'Banana',       category: 'fruits', price: 60,   unit: 'darjan', image: 'images/products/Banana.jpeg' },
    { id: 17, name: 'Orange',       category: 'fruits', price: 120,  unit: 'kg',     image: 'images/products/orange-fruit.avif' },
    { id: 18, name: 'Mango',        category: 'fruits', price: 120,  unit: 'kg',     image: 'images/products/Mango.jpg' },
    { id: 19, name: 'Papaya',       category: 'fruits', price: 60,   unit: 'kg',     image: 'images/products/Papaya.jpg' },
    { id: 20, name: 'Grapes',       category: 'fruits', price: 180,  unit: 'kg',     image: 'images/products/Grapes.jpg' },
    { id: 21, name: 'Pineapple',    category: 'fruits', price: 100,  unit: 'pcs',    image: 'images/products/Pineapple.avif' },
    { id: 22, name: 'Pomegranate',  category: 'fruits', price: 250,  unit: 'kg',     image: 'images/products/Pomegranate.webp' },
    { id: 23, name: 'Watermelon',   category: 'fruits', price: 80,   unit: 'pcs',    image: 'images/products/Watermelon.jpg' },
    { id: 24, name: 'Lemon',        category: 'fruits', price: 10,   unit: 'pcs',    image: 'images/products/Lemon.jpg' },

    // Grains & Staples — prices in NPR
    { id: 25, name: 'Rice',                   category: 'grains', price: 75,  unit: 'kg',   image: 'images/products/Rice.webp' },
    { id: 26, name: 'Wheat flour (Atta)',      category: 'grains', price: 55,  unit: 'kg',   image: 'images/products/Wheat flour.webp' },
    { id: 27, name: 'Maida (refined flour)',   category: 'grains', price: 50,  unit: 'kg',   image: 'images/products/Maida.jpg' },
    { id: 28, name: 'Corn flour',              category: 'grains', price: 80,  unit: 'kg',   image: 'images/products/Corn flour.jpg' },
    { id: 29, name: 'Oats',                    category: 'grains', price: 250, unit: 'pack', image: 'images/products/Oats.webp' },
    { id: 30, name: 'Pasta',                   category: 'grains', price: 120, unit: 'pack', image: 'images/products/Pasta.jpg' },
    { id: 31, name: 'Noodles',                 category: 'grains', price: 150, unit: 'pack', image: 'images/products/Noodles.png' },

    // Pulses & Legumes — prices in NPR
    { id: 32, name: 'Lentils (Dal)',          category: 'pulses', price: 180, unit: 'kg', image: 'images/products/Lentils.jpg' },
    { id: 33, name: 'Chickpeas (Chana)',      category: 'pulses', price: 130, unit: 'kg', image: 'images/products/Chickpeas (Chana).png' },
    { id: 34, name: 'Kidney beans (Rajma)',   category: 'pulses', price: 150, unit: 'kg', image: 'images/products/Kidney beans (Rajma).png' },
    { id: 35, name: 'Black gram (Urad dal)',  category: 'pulses', price: 160, unit: 'kg', image: 'images/products/Black gram (Urad dal).jpg' },
    { id: 36, name: 'Green gram (Moong dal)', category: 'pulses', price: 140, unit: 'kg', image: 'images/products/Green gram (Moong dal).jpg' },
    { id: 37, name: 'Peas',                   category: 'pulses', price: 80,  unit: 'kg', image: 'images/products/Peas.avif' },

    // Spices & Seasonings — prices in NPR
    { id: 38, name: 'Salt',              category: 'spices', price: 25,   unit: 'kg', image: 'images/products/Salt.webp' },
    { id: 39, name: 'Sugar',             category: 'spices', price: 90,   unit: 'kg', image: 'images/products/Sugar.jpg' },
    { id: 40, name: 'Turmeric powder',   category: 'spices', price: 300,  unit: 'kg', image: 'images/products/Turmeric powder.jpg' },
    { id: 41, name: 'Red chili powder',  category: 'spices', price: 350,  unit: 'kg', image: 'images/products/Red chili powder.jpeg' },
    { id: 42, name: 'Coriander powder',  category: 'spices', price: 250,  unit: 'kg', image: 'images/products/Coriander powder.jpg' },
    { id: 43, name: 'Cumin seeds',       category: 'spices', price: 400,  unit: 'kg', image: 'images/products/Cumin seeds.jpg' },
    { id: 44, name: 'Garam masala',      category: 'spices', price: 500,  unit: 'kg', image: 'images/products/Garam masala.webp' },
    { id: 45, name: 'Mustard seeds',     category: 'spices', price: 200,  unit: 'kg', image: 'images/products/Mustard seeds.jpeg' },
    { id: 46, name: 'Black pepper',      category: 'spices', price: 800,  unit: 'kg', image: 'images/products/Black pepper.jpg' },

    // Dairy Products — prices in NPR
    { id: 47, name: 'Milk',         category: 'dairy', price: 75,   unit: 'litre', image: 'images/products/Milk.avif' },
    { id: 48, name: 'Curd (Yogurt)',category: 'dairy', price: 90,   unit: 'litre', image: 'images/products/Curd (Yogurt).jpg' },
    { id: 49, name: 'Butter',       category: 'dairy', price: 700,  unit: 'kg',    image: 'images/products/Butter.jpg' },
    { id: 50, name: 'Cheese',       category: 'dairy', price: 800,  unit: 'kg',    image: 'images/products/Cheese.avif' },
    { id: 51, name: 'Ghee',         category: 'dairy', price: 1200, unit: 'litre', image: 'images/products/Ghee.jpg' },
    { id: 52, name: 'Paneer',       category: 'dairy', price: 400,  unit: 'kg',    image: 'images/products/Paneer.jpg' },

    // Meat & Protein — prices in NPR
    { id: 53, name: 'Chicken', category: 'meat', price: 450,  unit: 'kg',  image: 'images/products/Chicken.webp' },
    { id: 54, name: 'Mutton',  category: 'meat', price: 900,  unit: 'kg',  image: 'images/products/Mutton.jpg' },
    { id: 55, name: 'Fish',    category: 'meat', price: 350,  unit: 'kg',  image: 'images/products/Fish.jpg' },
    { id: 56, name: 'Eggs',    category: 'meat', price: 18,   unit: 'pcs', image: 'images/products/Eggs.avif' },

    // Beverages — prices in NPR
    { id: 57, name: 'Tea',           category: 'beverages', price: 500, unit: 'kg',    image: 'images/products/Tea.avif' },
    { id: 58, name: 'Coffee',        category: 'beverages', price: 800, unit: 'kg',    image: 'images/products/Coffee.avif' },
    { id: 59, name: 'Juice',         category: 'beverages', price: 120, unit: 'litre', image: 'images/products/Juice.avif' },
    { id: 60, name: 'Soft drinks',   category: 'beverages', price: 80,  unit: 'litre', image: 'images/products/Soft drinks.webp' },
    { id: 61, name: 'Mineral water', category: 'beverages', price: 30,  unit: 'litre', image: 'images/products/Mineral water.jpg' },

    // Snacks & Packaged Foods — prices in NPR
    { id: 62, name: 'Biscuits',       category: 'snacks', price: 50,  unit: 'pack', image: 'images/products/biscuite.webp' },
    { id: 63, name: 'Chips',          category: 'snacks', price: 50,  unit: 'pack', image: 'images/products/Chips.jpg' },
    { id: 64, name: 'Instant noodles',category: 'snacks', price: 35,  unit: 'pack', image: 'images/products/Instant noodles.jpg' },
    { id: 65, name: 'Chocolates',     category: 'snacks', price: 200, unit: 'pack', image: 'images/products/Chocolates.avif' },
    { id: 66, name: 'Bread',          category: 'snacks', price: 55,  unit: 'pack', image: 'images/products/bread.webp' },
    { id: 67, name: 'Jam',            category: 'snacks', price: 200, unit: 'pack', image: 'images/products/Jam.jpg' },
    { id: 68, name: 'Peanut butter',  category: 'snacks', price: 350, unit: 'pack', image: 'images/products/Peanut butter.jpg' },

    // Household Items — prices in NPR
    { id: 69, name: 'Soap',              category: 'household', price: 60,  unit: 'pack',  image: 'images/products/Soap.jpg' },
    { id: 70, name: 'Shampoo',           category: 'household', price: 350, unit: 'litre', image: 'images/products/Shampoo.jpg' },
    { id: 71, name: 'Toothpaste',        category: 'household', price: 130, unit: 'pack',  image: 'images/products/Toothpaste.jpg' },
    { id: 72, name: 'Detergent',         category: 'household', price: 200, unit: 'kg',    image: 'images/products/Detergent.webp' },
    { id: 73, name: 'Dishwashing liquid',category: 'household', price: 150, unit: 'litre', image: 'images/products/Dishwashing liquid.jpg' },
    { id: 74, name: 'Toilet cleaner',    category: 'household', price: 150, unit: 'litre', image: 'images/products/Toilet cleaner.jpg' }
];

const categoryColors = {
    vegetables: { bg: 'E8F5E9', fg: '2E7D32' },
    fruits: { bg: 'FFF3E0', fg: 'E65100' },
    grains: { bg: 'FFF8E1', fg: 'F57F17' },
    pulses: { bg: 'EFEBE9', fg: '4E342E' },
    spices: { bg: 'FBE9E7', fg: 'BF360C' },
    dairy: { bg: 'E3F2FD', fg: '1565C0' },
    meat: { bg: 'FFEBEE', fg: 'C62828' },
    beverages: { bg: 'F3E5F5', fg: '6A1B9A' },
    snacks: { bg: 'FFFDE7', fg: 'F57F17' },
    household: { bg: 'ECEFF1', fg: '37474F' }
};

// Product images are correctly loaded from the predefined Unsplash URLs in the products array.

async function fetchProductsFromDatabase() {
    try {
        // Wait until supabase is loaded
        for (let i = 0; i < 20; i++) {
            if (window.supabase) break;
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        if (window.supabase) {
            const { data, error } = await window.supabase
                .from('products')
                .select('*')
                .order('id', { ascending: true });
                
            if (error) throw error;
            
            if (data && data.length > 0) {
                console.log(`Successfully fetched ${data.length} products dynamically from Supabase.`);
                // Mutate the const array in-place
                products.length = 0;
                data.forEach(item => {
                    products.push({
                        id: parseInt(item.id),
                        name: item.name,
                        category: item.category,
                        price: parseFloat(item.price),
                        unit: item.unit || 'kg',
                        image: item.image
                    });
                });
            }
        }
    } catch (err) {
        console.warn("Could not load products from Supabase database. Falling back to local static catalog.", err);
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    const grid = document.getElementById('productGrid');
    const filter = document.getElementById('category-filter');
    const searchInput = document.getElementById('productSearchInput');

    if (grid) {
        let currentCategory = 'all';
        let currentSearch = '';

        // Attempt dynamic load
        await fetchProductsFromDatabase();

        // Check if there's a search param in URL
        const params = new URLSearchParams(window.location.search);
        if (params.has('search')) {
            currentSearch = params.get('search').toLowerCase();
            if (searchInput) {
                searchInput.value = currentSearch;
            }
        }

        if (params.has('category')) {
            currentCategory = params.get('category').toLowerCase();
            if (filter) {
                filter.value = currentCategory;
            }
        }

        const filterProducts = () => {
            let filtered = products;
            if (currentCategory !== 'all') {
                filtered = filtered.filter(p => p.category === currentCategory);
            }
            if (currentSearch) {
                filtered = filtered.filter(p => p.name.toLowerCase().includes(currentSearch));
            }
            renderProducts(filtered);
        };

        // Initial render
        filterProducts();

        if (filter) {
            filter.addEventListener('change', (e) => {
                currentCategory = e.target.value;
                filterProducts();
            });
        }

        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                currentSearch = e.target.value.toLowerCase().trim();
                filterProducts();
            });
        }
    }
});

function renderProducts(items) {
    const grid = document.getElementById('productGrid');
    grid.innerHTML = '';
    
    if (items.length === 0) {
        grid.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: var(--text-light);">No products found matching your search.</div>';
        return;
    }

    items.forEach(item => {
        const div = document.createElement('div');
        div.className = 'product-card';

        const unitType = item.unit || 'kg';
        const unitSuffix = unitSuffixes[unitType] || 'KG';

        // Step is 0.5 for kg/litre/darjan, 1 for pcs/pack
        const isDecimalUnit = ['kg', 'litre', 'darjan'].includes(unitType);
        const step = isDecimalUnit ? 0.5 : 1;
        const defaultValue = isDecimalUnit ? 0.5 : 1;

        // Get price label suffix based on unit
        let priceUnit = '';
        switch (unitType) {
            case 'kg':     priceUnit = '/KG'; break;
            case 'litre':  priceUnit = '/L'; break;
            case 'darjan': priceUnit = '/pc'; break;
            case 'pcs':    priceUnit = '/pc'; break;
            case 'pack':   priceUnit = '/Pack'; break;
        }

        div.innerHTML = `
            <img src="${item.image}" alt="${item.name}" class="product-img" onerror="this.onerror=null;this.src='';this.style.cssText='display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#a8edea,#fed6e3);color:#555;font-size:2.5rem;font-weight:700;width:100%;height:200px;';this.alt='${item.name[0].toUpperCase()}';">
            <div class="product-category" style="text-transform: capitalize;">${item.category}</div>
            <h3 class="product-name">${item.name}</h3>
            <div class="product-price">Rs. ${item.price.toFixed(2)} <span class="price-unit">${priceUnit}</span></div>
            <div class="product-qty">
                <button class="qty-btn" onclick="adjustProductQty(${item.id}, -1)">-</button>
                <div class="qty-input-wrapper">
                    <input type="number" id="qty-${item.id}" value="${defaultValue}" min="0.1" step="${step}" class="qty-number-input">
                    <span class="qty-unit-label">${unitSuffix}</span>
                </div>
                <button class="qty-btn" onclick="adjustProductQty(${item.id}, 1)">+</button>
            </div>
            <button class="btn btn-outline" style="width: 100%;" onclick="addToCart(${item.id}, event)">Add to Cart</button>
        `;
        grid.appendChild(div);
    });
}

window.adjustProductQty = function(id, direction) {
    const input = document.getElementById('qty-' + id);
    if (!input) return;
    const step = parseFloat(input.step) || 1;
    let val = parseFloat(input.value) || 0;
    val += direction * step;
    if (val < 0.1) val = 0.1;
    input.value = Math.round(val * 100) / 100;
};

window.addToCart = function(productId, event) {
    const product = products.find(p => p.id === productId);
    if (!product) return;

    let cart = JSON.parse(localStorage.getItem('freshcart') || '[]');
    const existingIndex = cart.findIndex(item => item.id === productId);

    const qtyInput = document.getElementById('qty-' + productId);
    const addedQuantity = qtyInput ? parseFloat(qtyInput.value) : 1;

    if (existingIndex >= 0) {
        // Accumulate quantity
        cart[existingIndex].quantity += addedQuantity;
        cart[existingIndex].quantity = Math.round(cart[existingIndex].quantity * 100) / 100;
        cart[existingIndex].unit = product.unit || 'kg';
    } else {
        cart.push({ ...product, quantity: addedQuantity, unit: product.unit || 'kg' });
    }

    localStorage.setItem('freshcart', JSON.stringify(cart));
    
    // Call global function from main.js if available
    if (typeof updateGlobalCartCount === 'function') {
        updateGlobalCartCount();
    }
    
    // Optional: Show toast or feedback
    if (event && event.target) {
        const btn = event.target;
        const oldText = btn.textContent;
        btn.textContent = 'Added!';
        btn.style.backgroundColor = 'var(--primary-color)';
        btn.style.color = 'white';
        setTimeout(() => {
            btn.textContent = oldText;
            btn.style.backgroundColor = 'transparent';
            btn.style.color = 'var(--primary-color)';
        }, 1000);
    }
}


