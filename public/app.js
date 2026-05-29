// Homemart App State
let state = {
  member: 'Jainy',
  cart: [],
  catalog: [],
  selectedCategory: null, // null means Home (Categories Grid)
  searchQuery: '',
  isLocalMode: true,
  boughtCollapsed: false,
  editingProductId: null // Track product being edited in the modal
};

// Category Definitions
const categories = {
  'atta-dal': { name: "Flours and Pulses", emoji: "🌾", bgGradient: "linear-gradient(135deg, #f6d365 0%, #fda085 100%)" },
  'fruits-veg': { name: "Fruits and Vegetables", emoji: "🥦", bgGradient: "linear-gradient(135deg, #d4fc79 0%, #96e6a1 100%)" },
  'dairy-bread': { name: "Dairy and Bread", emoji: "🥛", bgGradient: "linear-gradient(135deg, #e0c3fc 0%, #8ec5fc 100%)" },
  'munchies': { name: "Munchies and Snacks", emoji: "🍪", bgGradient: "linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)" },
  'beverages': { name: "Juices and Drinks", emoji: "🥤", bgGradient: "linear-gradient(135deg, #fddb92 0%, #d1fdff 100%)" },
  'instant': { name: "Instant Foods", emoji: "🍜", bgGradient: "linear-gradient(135deg, #f6d365 0%, #fda085 100%)" },
  'household': { name: "Household", emoji: "🪔", bgGradient: "linear-gradient(135deg, #fff1eb 0%, #ace0f9 100%)" },
  'spices': { name: "Spices & Masalas", emoji: "🌶️", bgGradient: "linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)" }
};

// Previous cart state for change-detection (to show real-time notifications)
let previousCart = [];

// API Endpoints Config
const API_BASE = window.location.origin;

// DOM Elements
const el = {
  memberSelect: document.getElementById('member-select'),
  connectionBadge: document.getElementById('connection-badge'),
  statusText: document.getElementById('status-text'),
  catalogPanel: document.getElementById('catalog-panel'),
  searchInput: document.getElementById('search-input'),
  cartEmptyState: document.getElementById('cart-empty-state'),
  cartContent: document.getElementById('cart-content'),
  activeList: document.getElementById('active-list'),
  boughtList: document.getElementById('bought-list'),
  boughtGroup: document.getElementById('bought-group'),
  boughtCount: document.getElementById('bought-count'),
  btnToggleBought: document.getElementById('btn-toggle-bought'),
  cartBadge: document.getElementById('cart-badge'),
  cartTotal: document.getElementById('cart-total'),
  btnClearCart: document.getElementById('btn-clear-cart'),
  btnCompleteShopping: document.getElementById('btn-complete-shopping'),

  // Custom item modal elements
  customModal: document.getElementById('custom-item-modal'),
  btnCloseModal: document.getElementById('btn-close-modal'),
  customForm: document.getElementById('custom-item-form'),
  customCategorySelect: document.getElementById('custom-category'),
  modalTitleText: document.getElementById('modal-title-text'),
  customSubmitBtn: document.getElementById('custom-submit-btn'),

  // Confetti canvas
  confettiCanvas: document.getElementById('confetti-canvas'),
  toastContainer: document.getElementById('toast-container')
};

// Initialize Application
async function init() {
  setupEventListeners();
  loadLocalSettings();

  // Check backend availability
  const backendAvailable = await checkBackend();

  if (backendAvailable) {
    state.isLocalMode = false;
    updateConnectionUI(true);
    await fetchCatalog();
    await fetchCart();

    // Start real-time sync polling every 1.5 seconds
    setInterval(fetchCart, 1500);
  } else {
    state.isLocalMode = true;
    updateConnectionUI(false);
    loadLocalFallbackData();
    renderCatalog();
    renderCart();
  }
}

// Check if Python Server API is reachable
async function checkBackend() {
  try {
    const response = await fetch(`${API_BASE}/api/cart`, { method: 'GET', cache: 'no-cache' });
    return response.ok;
  } catch (e) {
    return false;
  }
}

// Update Connectivity UI indicator
function updateConnectionUI(isOnline) {
  if (isOnline) {
    el.connectionBadge.className = 'connection-badge status-online';
    el.statusText.textContent = 'Synced Live';
  } else {
    el.connectionBadge.className = 'connection-badge status-local';
    el.statusText.textContent = 'Local Mode';
    showToast('💡 Running in Local Mode. Start server.py for real-time sync across devices!', 5000);
  }
}

// Fetch Catalog from API
async function fetchCatalog() {
  try {
    const res = await fetch(`${API_BASE}/api/catalog`);
    state.catalog = await res.json();
    renderCatalog();
  } catch (e) {
    console.error("Failed to fetch catalog:", e);
  }
}

// Fetch Cart from API (Polled)
async function fetchCart() {
  try {
    const res = await fetch(`${API_BASE}/api/cart`, { cache: 'no-cache' });
    const cartData = await res.json();
    detectCartChanges(cartData);
    state.cart = cartData;
    renderCart();
  } catch (e) {
    console.error("Sync error:", e);
    if (!state.isLocalMode) {
      state.isLocalMode = true;
      updateConnectionUI(false);
    }
  }
}

// Load Fallback Mock Data for Local Mode
function loadLocalFallbackData() {
  // Load local catalog changes
  const savedCatalog = localStorage.getItem('homemart_catalog');
  if (savedCatalog) {
    state.catalog = JSON.parse(savedCatalog);
  } else {
    state.catalog = [
      { id: "prod-1", name: "Nirmal Rice", category: "atta-dal", price: 0, unit: "5 kg", emoji: "🌾", bgGradient: "linear-gradient(135deg, #f6d365 0%, #fda085 100%)" },
      { id: "prod-2", name: "Milk", category: "dairy-bread", price: 0, unit: "100g", emoji: "🥛", bgGradient: "linear-gradient(135deg, #fff1eb 0%, #ace0f9 100%)" },
      { id: "prod-3", name: "Curd", category: "dairy-bread", price: 0, unit: "500ml", emoji: "🥛", bgGradient: "linear-gradient(135deg, #e0c3fc 0%, #8ec5fc 100%)" },
      { id: "prod-4", name: "Pachari Podippikkan", category: "instant", price: 0, unit: "1kg", emoji: "🌾", bgGradient: "linear-gradient(135deg, #f6d365 0%, #fda085 100%)" },
      { id: "prod-5", name: "Rusk", category: "munchies", price: 0, unit: "1", emoji: "🍞", bgGradient: "linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)" },
      { id: "prod-6", name: "Rava", category: "atta-dal", price: 0, unit: "1 kg", emoji: "🌾", bgGradient: "linear-gradient(135deg, #a1c4fd 0%, #c2e9fb 100%)" },
      { id: "prod-7", name: "Guava Juice", category: "beverages", price: 0, unit: "1", emoji: "🥤", bgGradient: "linear-gradient(135deg, #fddb92 0%, #d1fdff 100%)" },
      { id: "prod-8", name: "Apple", category: "fruits-veg", price: 0, unit: "1 Kg", emoji: "🍎", bgGradient: "linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)" },
      { id: "prod-9", name: "Carrot", category: "fruits-veg", price: 0, unit: "500g", emoji: "🥕", bgGradient: "linear-gradient(135deg, #84fab0 0%, #8fd3f4 100%)" },
      { id: "prod-10", name: "Himalaya Soap", category: "household", price: 0, unit: "1", emoji: "🧼", bgGradient: "linear-gradient(135deg, #84fab0 0%, #8fd3f4 100%)" },
      { id: "prod-11", name: "Choolu", category: "household", price: 80, unit: "1", emoji: "🧹", bgGradient: "linear-gradient(135deg, #fff1eb 0%, #ace0f9 100%)" },
      { id: "prod-18", name: "Eastern Turmeric Powder", category: "spices", price: 0, unit: "250g", emoji: "🟡", bgGradient: "linear-gradient(135deg, #f6d365 0%, #fda085 100%)" }
    ];
  }

  // Try to load cart from localStorage
  const savedCart = localStorage.getItem('homemart_cart');
  state.cart = savedCart ? JSON.parse(savedCart) : [];

  setupLocalSimulation();
}

// Compare current and previous cart to trigger toast alerts for family activity
function detectCartChanges(newCart) {
  if (previousCart.length === 0) {
    previousCart = JSON.parse(JSON.stringify(newCart));
    return;
  }

  newCart.forEach(newItem => {
    const oldItem = previousCart.find(o => o.id === newItem.id);

    // Case 1: Brand new item added by someone else
    if (!oldItem) {
      if (newItem.addedBy !== state.member) {
        showToast(`➕ ${newItem.addedBy} added ${newItem.name} to the list!`);
      }
    } else {
      // Case 2: Quantity increased by someone else
      if (newItem.quantity > oldItem.quantity && newItem.lastUpdatedBy !== state.member) {
        showToast(`📈 ${newItem.lastUpdatedBy} added more ${newItem.name} (Qty: ${newItem.quantity})`);
      }

      // Case 3: Checked off as bought by someone else
      if (newItem.bought && !oldItem.bought && newItem.boughtBy !== state.member) {
        showToast(`✅ ${newItem.boughtBy} bought ${newItem.name}!`);
      }

      // Case 4: Unchecked by someone else
      if (!newItem.bought && oldItem.bought && newItem.lastUpdatedBy !== state.member) {
        showToast(`🔄 ${newItem.lastUpdatedBy} put ${newItem.name} back on the list.`);
      }
    }
  });

  // Track item deletions
  previousCart.forEach(oldItem => {
    const exists = newCart.some(n => n.id === oldItem.id);
    if (!exists && oldItem.lastUpdatedBy !== state.member) {
      showToast(`🗑️ An item was removed from the list`);
    }
  });

  previousCart = JSON.parse(JSON.stringify(newCart));
}

// Local simulation loop for local mode testing
function setupLocalSimulation() {
  const simulationUsers = ['Skaria', 'Jainy', 'Chinnu', 'Alwin'];

  setInterval(() => {
    if (!state.isLocalMode) return;

    const randomUser = simulationUsers[Math.floor(Math.random() * simulationUsers.length)];
    const action = Math.random() > 0.4 ? 'add' : 'buy';

    if (action === 'add') {
      const item = state.catalog[Math.floor(Math.random() * state.catalog.length)];

      const existing = state.cart.find(i => i.id === item.id && !i.bought);
      if (existing) {
        existing.quantity += 1;
        existing.lastUpdatedBy = randomUser;
        existing.lastUpdatedAt = Date.now() / 1000;
        showToast(`📈 ${randomUser} added more ${item.name} (Qty: ${existing.quantity})`);
      } else {
        const newItem = {
          ...item,
          quantity: 1,
          addedBy: randomUser,
          bought: false,
          boughtBy: null,
          addedAt: Date.now() / 1000,
          lastUpdatedBy: randomUser,
          lastUpdatedAt: Date.now() / 1000
        };
        state.cart.push(newItem);
        showToast(`➕ ${randomUser} added ${item.name} to the list!`);
      }
    } else if (state.cart.length > 0) {
      const unboughtItems = state.cart.filter(i => !i.bought);
      if (unboughtItems.length > 0) {
        const randomItem = unboughtItems[Math.floor(Math.random() * unboughtItems.length)];
        randomItem.bought = true;
        randomItem.boughtBy = randomUser;
        randomItem.lastUpdatedBy = randomUser;
        randomItem.lastUpdatedAt = Date.now() / 1000;
        showToast(`✅ ${randomUser} bought ${randomItem.name}!`);
      }
    }

    saveLocalCart();
    renderCart();
  }, 25000);
}

// Save local cart to localStorage
function saveLocalCart() {
  localStorage.setItem('homemart_cart', JSON.stringify(state.cart));
}

// Save local catalog to localStorage
function saveLocalCatalog() {
  localStorage.setItem('homemart_catalog', JSON.stringify(state.catalog));
}

// Local storage member saving
function loadLocalSettings() {
  const savedMember = localStorage.getItem('homemart_member');
  if (savedMember) {
    state.member = savedMember;
    el.memberSelect.value = savedMember;
  }
}

// Add Item to Cart (API or Local)
async function addToCart(product) {
  if (state.isLocalMode) {
    const existing = state.cart.find(item => item.id === product.id && !item.bought);

    if (existing) {
      existing.quantity += 1;
      existing.lastUpdatedBy = state.member;
      existing.lastUpdatedAt = Date.now() / 1000;
    } else {
      state.cart.push({
        ...product,
        quantity: 1,
        addedBy: state.member,
        bought: false,
        boughtBy: null,
        addedAt: Date.now() / 1000,
        lastUpdatedBy: state.member,
        lastUpdatedAt: Date.now() / 1000
      });
    }

    saveLocalCart();
    renderCart();
    showToast(`🛒 Added ${product.name}`);
  } else {
    try {
      const response = await fetch(`${API_BASE}/api/cart/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...product,
          addedBy: state.member
        })
      });
      const data = await response.json();
      if (data.success) {
        state.cart = data.cart;
        renderCart();
      }
    } catch (e) {
      console.error("Error adding to cart API:", e);
    }
  }
}

// Persist New Item to Catalog, then Add to Cart
async function addNewProductToCatalogAndCart(newProdData) {
  let finalProduct = null;

  if (state.isLocalMode) {
    // Check if name already exists in category
    const exists = state.catalog.find(p => p.name.toLowerCase() === newProdData.name.toLowerCase() && p.category === newProdData.category);
    if (exists) {
      finalProduct = exists;
    } else {
      finalProduct = {
        id: `prod-${Date.now()}`,
        ...newProdData
      };
      state.catalog.push(finalProduct);
      saveLocalCatalog();
      showToast(`✨ ${finalProduct.name} saved permanently to the catalog!`);
    }
    addToCart(finalProduct);
  } else {
    try {
      // Register product in catalog first
      const catalogRes = await fetch(`${API_BASE}/api/catalog/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newProdData)
      });
      const catalogData = await catalogRes.json();
      if (catalogData.success) {
        finalProduct = catalogData.product;
        state.catalog = catalogData.catalog;

        // Add to active cart list
        addToCart(finalProduct);
        showToast(`✨ ${finalProduct.name} saved permanently to catalog!`);
      }
    } catch (e) {
      console.error("Error writing new product to catalog:", e);
      // Fallback: directly add to cart locally if backend failed
      addToCart({ id: `prod-${Date.now()}`, ...newProdData });
    }
  }
}

// Update Product in Catalog (API or Local)
async function updateProductInCatalog(id, updatedData) {
  if (state.isLocalMode) {
    // Update locally in state
    state.catalog = state.catalog.map(prod => prod.id === id ? { ...prod, ...updatedData } : prod);
    saveLocalCatalog();

    // Also update any active/bought item in cart referencing the same product
    state.cart = state.cart.map(item => {
      if (item.id === id) {
        return {
          ...item,
          name: updatedData.name,
          category: updatedData.category,
          price: updatedData.price,
          unit: updatedData.unit,
          emoji: updatedData.emoji,
          bgGradient: updatedData.bgGradient,
          description: updatedData.description
        };
      }
      return item;
    });
    saveLocalCart();

    renderCatalog();
    renderCart();
    showToast(`✏️ Updated product: ${updatedData.name}`);
  } else {
    try {
      const response = await fetch(`${API_BASE}/api/catalog/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedData)
      });
      const data = await response.json();
      if (data.success) {
        state.catalog = data.catalog;
        await fetchCart(); // Sync updated cart items from API
        renderCatalog();
        showToast(`✏️ Updated product: ${updatedData.name}`);
      }
    } catch (e) {
      console.error("Error updating catalog product API:", e);
    }
  }
}

// Delete Product from Catalog (API or Local)
async function deleteProductFromCatalog(id) {
  const prod = state.catalog.find(p => p.id === id);
  const name = prod ? prod.name : "Product";

  if (!confirm(`Are you sure you want to delete "${name}" from the shelves?`)) {
    return;
  }

  if (state.isLocalMode) {
    state.catalog = state.catalog.filter(p => p.id !== id);
    saveLocalCatalog();
    renderCatalog();
    showToast(`🗑️ Removed ${name} from shelves`);
  } else {
    try {
      const response = await fetch(`${API_BASE}/api/catalog/delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });
      const data = await response.json();
      if (data.success) {
        state.catalog = data.catalog;
        renderCatalog();
        showToast(`🗑️ Removed ${name} from shelves`);
      }
    } catch (e) {
      console.error("Error deleting catalog product API:", e);
    }
  }
}

// Update Cart Item Quantity/Status (API or Local)
async function updateCartItem(id, updates) {
  if (state.isLocalMode) {
    const item = state.cart.find(i => i.id === id);
    if (item) {
      if ('quantity' in updates) {
        item.quantity = updates.quantity;
        if (item.quantity <= 0) {
          state.cart = state.cart.filter(i => i.id !== id);
        }
      }
      if ('bought' in updates) {
        item.bought = updates.bought;
        item.boughtBy = updates.bought ? state.member : null;
      }
      item.lastUpdatedBy = state.member;
      item.lastUpdatedAt = Date.now() / 1000;

      saveLocalCart();
      renderCart();
    }
  } else {
    try {
      const response = await fetch(`${API_BASE}/api/cart/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          ...updates,
          updatedBy: state.member,
          boughtBy: state.member
        })
      });
      const data = await response.json();
      if (data.success) {
        state.cart = data.cart;
        renderCart();
      }
    } catch (e) {
      console.error("Error updating cart API:", e);
    }
  }
}

// Remove item from cart
async function removeCartItem(id) {
  if (state.isLocalMode) {
    state.cart = state.cart.filter(item => item.id !== id);
    saveLocalCart();
    renderCart();
  } else {
    try {
      const response = await fetch(`${API_BASE}/api/cart/remove`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });
      const data = await response.json();
      if (data.success) {
        state.cart = data.cart;
        renderCart();
      }
    } catch (e) {
      console.error("Error removing item API:", e);
    }
  }
}

// Clear Cart (All or Bought)
async function clearCart(type) {
  if (state.isLocalMode) {
    if (type === 'bought') {
      state.cart = state.cart.filter(item => !item.bought);
    } else {
      state.cart = [];
    }
    saveLocalCart();
    renderCart();
  } else {
    try {
      const response = await fetch(`${API_BASE}/api/cart/clear`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type })
      });
      const data = await response.json();
      if (data.success) {
        state.cart = data.cart;
        renderCart();
      }
    } catch (e) {
      console.error("Error clearing cart API:", e);
    }
  }
}

// Render Products Catalog OR Categories Grid in Center Panel
function renderCatalog() {
  // If search query is active, auto-route to search results (override category selection)
  if (state.searchQuery.trim() !== '') {
    renderSearchResults();
    return;
  }

  // State 1: Home View (Show Category Cards Grid in Center)
  if (state.selectedCategory === null) {
    renderCategoryGrid();
  }
  // State 2: Category Details View (Show products of category in Center)
  else {
    renderCategoryProducts();
  }
}

// Render the 3x3 category grid in the center
function renderCategoryGrid() {
  el.catalogPanel.innerHTML = `
    <div class="catalog-header">
      <h2>Categories</h2>
      <span class="items-count-badge">${Object.keys(categories).length} Aisles</span>
    </div>
    <div class="categories-card-grid" id="categories-grid">
      <!-- Populated below -->
    </div>
  `;

  const gridContainer = document.getElementById('categories-grid');

  Object.keys(categories).forEach(catId => {
    const cat = categories[catId];

    // Count catalog items in this category
    const itemsCount = state.catalog.filter(p => p.category === catId).length;

    const card = document.createElement('div');
    card.className = 'category-card';
    card.innerHTML = `
      <div class="category-card-icon-circle" style="background: ${cat.bgGradient}">
        ${cat.emoji}
      </div>
      <h3 class="category-card-title">${cat.name}</h3>
      <span class="category-card-count">${itemsCount} Item${itemsCount !== 1 ? 's' : ''}</span>
    `;

    card.addEventListener('click', () => {
      state.selectedCategory = catId;
      renderCatalog();
    });

    gridContainer.appendChild(card);
  });
}

// Render products under a single selected category in the center
function renderCategoryProducts() {
  const cat = categories[state.selectedCategory];
  const products = state.catalog.filter(p => p.category === state.selectedCategory);

  el.catalogPanel.innerHTML = `
    <div class="catalog-header">
      <div style="display: flex; align-items: center; gap: 14px;">
        <button class="btn-back" id="btn-back-aisles">⬅️ Back to Home</button>
        <h2>${cat.emoji} ${cat.name}</h2>
      </div>
      <span class="items-count-badge">${products.length} Product${products.length !== 1 ? 's' : ''}</span>
    </div>
    
    <div class="product-grid" id="category-products-grid">
      <!-- Populated below -->
    </div>
  `;

  // Back button event
  document.getElementById('btn-back-aisles').addEventListener('click', () => {
    state.selectedCategory = null;
    renderCatalog();
  });

  const grid = document.getElementById('category-products-grid');

  // Render normal product cards
  products.forEach(prod => {
    const activeInCart = state.cart.find(item => item.id === prod.id && !item.bought);
    const cartQty = activeInCart ? activeInCart.quantity : 0;

    const card = document.createElement('div');
    card.className = 'product-card';
    card.innerHTML = `
      <div class="prod-image-wrapper" style="background: ${prod.bgGradient}">
        <span>${prod.emoji}</span>
        ${cartQty > 0 ? `<div class="prod-badge">${cartQty} in list</div>` : ''}
        <div class="prod-card-actions">
          <button class="btn-card-action btn-edit-prod" title="Edit Item" data-id="${prod.id}">✏️</button>
          <button class="btn-card-action btn-delete-prod" title="Delete Item" data-id="${prod.id}">🗑️</button>
        </div>
      </div>
      <div class="prod-info">
        <h4 class="prod-name">${prod.name}</h4>
        <p class="prod-desc">${prod.description || ''}</p>
        <div class="prod-meta">
          <div class="prod-price-box">
            <span class="prod-price">₹${prod.price}</span>
            <span class="prod-unit">per ${prod.unit}</span>
          </div>
        </div>
        <button class="btn-add-cart" data-id="${prod.id}">
          <span>🛒 Add to List</span>
        </button>
      </div>
    `;

    card.querySelector('.btn-add-cart').addEventListener('click', (e) => {
      e.stopPropagation();
      addToCart(prod);
    });

    card.querySelector('.btn-edit-prod').addEventListener('click', (e) => {
      e.stopPropagation();
      openCustomItemModal(null, prod.id);
    });

    card.querySelector('.btn-delete-prod').addEventListener('click', (e) => {
      e.stopPropagation();
      deleteProductFromCatalog(prod.id);
    });

    grid.appendChild(card);
  });

  // Render "Dashed Creator Card" at the end of the grid
  const creatorCard = document.createElement('div');
  creatorCard.className = 'product-card product-card-creator';
  creatorCard.innerHTML = `
    <div class="creator-icon">➕</div>
    <div class="creator-text">
      <h4>Add Item to ${cat.name}</h4>
      <p>Add a new custom product directly to this aisle's shelf.</p>
    </div>
  `;

  creatorCard.addEventListener('click', () => {
    openCustomItemModal(state.selectedCategory);
  });

  grid.appendChild(creatorCard);
}

// Render search results view (triggered automatically when text is in search bar)
function renderSearchResults() {
  const filtered = state.catalog.filter(prod => {
    const matchesSearch = prod.name.toLowerCase().includes(state.searchQuery.toLowerCase()) ||
      prod.description.toLowerCase().includes(state.searchQuery.toLowerCase());
    return matchesSearch;
  });

  el.catalogPanel.innerHTML = `
    <div class="catalog-header">
      <div style="display: flex; align-items: center; gap: 14px;">
        <button class="btn-back" id="btn-clear-search">⬅️ Clear Search</button>
        <h2>Search Results for "${state.searchQuery}"</h2>
      </div>
      <span class="items-count-badge">${filtered.length} Product${filtered.length !== 1 ? 's' : ''}</span>
    </div>
    
    <div class="product-grid" id="search-products-grid">
      <!-- Populated below -->
    </div>
  `;

  document.getElementById('btn-clear-search').addEventListener('click', () => {
    el.searchInput.value = '';
    state.searchQuery = '';
    renderCatalog();
  });

  const grid = document.getElementById('search-products-grid');

  if (filtered.length === 0) {
    grid.innerHTML = `
      <div class="no-products">
        <span class="no-products-icon">🔍</span>
        <h3>No matching staples found</h3>
        <p>Double check spellings, or register it as a custom item in any category!</p>
        <button id="btn-search-quickadd" class="btn-primary" style="margin-top: 15px;">➕ Quick Add Custom Item</button>
      </div>
    `;

    document.getElementById('btn-search-quickadd').addEventListener('click', () => {
      openCustomItemModal('atta-dal');
    });
    return;
  }

  filtered.forEach(prod => {
    const activeInCart = state.cart.find(item => item.id === prod.id && !item.bought);
    const cartQty = activeInCart ? activeInCart.quantity : 0;

    const card = document.createElement('div');
    card.className = 'product-card';
    card.innerHTML = `
      <div class="prod-image-wrapper" style="background: ${prod.bgGradient}">
        <span>${prod.emoji}</span>
        ${cartQty > 0 ? `<div class="prod-badge">${cartQty} in list</div>` : ''}
        <div class="prod-card-actions">
          <button class="btn-card-action btn-edit-prod" title="Edit Item" data-id="${prod.id}">✏️</button>
          <button class="btn-card-action btn-delete-prod" title="Delete Item" data-id="${prod.id}">🗑️</button>
        </div>
      </div>
      <div class="prod-info">
        <h4 class="prod-name">${prod.name}</h4>
        <p class="prod-desc">${prod.description || ''}</p>
        <div class="prod-meta">
          <div class="prod-price-box">
            <span class="prod-price">₹${prod.price}</span>
            <span class="prod-unit">per ${prod.unit}</span>
          </div>
        </div>
        <button class="btn-add-cart" data-id="${prod.id}">
          <span>🛒 Add to List</span>
        </button>
      </div>
    `;

    card.querySelector('.btn-add-cart').addEventListener('click', (e) => {
      e.stopPropagation();
      addToCart(prod);
    });

    card.querySelector('.btn-edit-prod').addEventListener('click', (e) => {
      e.stopPropagation();
      openCustomItemModal(null, prod.id);
    });

    card.querySelector('.btn-delete-prod').addEventListener('click', (e) => {
      e.stopPropagation();
      deleteProductFromCatalog(prod.id);
    });

    grid.appendChild(card);
  });
}

// Render Shopping List Cart
function renderCart() {
  const activeItems = state.cart.filter(item => !item.bought);
  const boughtItems = state.cart.filter(item => item.bought);

  // Render badge count
  const totalCount = activeItems.reduce((acc, item) => acc + item.quantity, 0);
  el.cartBadge.textContent = totalCount;

  if (state.cart.length === 0) {
    el.cartEmptyState.classList.remove('hidden');
    el.cartContent.classList.add('hidden');
    el.cartTotal.textContent = '₹0';
    return;
  }

  el.cartEmptyState.classList.add('hidden');
  el.cartContent.classList.remove('hidden');

  // Render Active List
  el.activeList.innerHTML = '';
  if (activeItems.length === 0) {
    el.activeList.innerHTML = `
      <div class="no-items-placeholder">
        🎉 All active items bought.
      </div>
    `;
  } else {
    activeItems.forEach(item => {
      const itemRow = document.createElement('div');
      itemRow.className = 'cart-item';
      itemRow.innerHTML = `
        <label class="checkbox-container">
          <input type="checkbox" class="chk-item" data-id="${item.id}">
          <span class="checkmark"></span>
        </label>
        <div class="cart-item-emoji" style="background: ${item.bgGradient}">${item.emoji}</div>
        <div class="cart-item-details">
          <span class="cart-item-name">${item.name}</span>
          <div class="cart-item-meta">
            <span>₹${item.price * item.quantity}</span>
            <span>•</span>
            <span class="item-badge-by">By ${item.addedBy}</span>
          </div>
        </div>
        <div class="quantity-adjuster">
          <button class="qty-btn qty-minus" data-id="${item.id}">-</button>
          <span class="qty-val">${item.quantity}</span>
          <button class="qty-btn qty-plus" data-id="${item.id}">+</button>
        </div>
      `;

      // Hook event listeners
      itemRow.querySelector('.chk-item').addEventListener('change', (e) => {
        const isBought = e.target.checked;
        setTimeout(() => {
          updateCartItem(item.id, { bought: isBought });
        }, 300);
      });

      itemRow.querySelector('.qty-minus').addEventListener('click', () => {
        updateCartItem(item.id, { quantity: item.quantity - 1 });
      });

      itemRow.querySelector('.qty-plus').addEventListener('click', () => {
        updateCartItem(item.id, { quantity: item.quantity + 1 });
      });

      el.activeList.appendChild(itemRow);
    });
  }

  // Render Bought List
  el.boughtList.innerHTML = '';
  el.boughtCount.textContent = boughtItems.length;

  if (boughtItems.length === 0) {
    el.boughtGroup.classList.add('hidden');
  } else {
    el.boughtGroup.classList.remove('hidden');

    boughtItems.forEach(item => {
      const itemRow = document.createElement('div');
      itemRow.className = 'cart-item bought';
      itemRow.innerHTML = `
        <label class="checkbox-container">
          <input type="checkbox" class="chk-item" data-id="${item.id}" checked>
          <span class="checkmark"></span>
        </label>
        <div class="cart-item-emoji" style="background: ${item.bgGradient}">${item.emoji}</div>
        <div class="cart-item-details">
          <span class="cart-item-name">${item.name}</span>
          <div class="cart-item-meta">
            <span class="item-badge-bought">Bought by ${item.boughtBy || 'someone'}</span>
          </div>
        </div>
        <button class="btn-text btn-remove" data-id="${item.id}">✕</button>
      `;

      // Hook event listeners
      itemRow.querySelector('.chk-item').addEventListener('change', (e) => {
        const isBought = e.target.checked;
        setTimeout(() => {
          updateCartItem(item.id, { bought: isBought });
        }, 300);
      });

      itemRow.querySelector('.btn-remove').addEventListener('click', () => {
        removeCartItem(item.id);
      });

      el.boughtList.appendChild(itemRow);
    });
  }

  // Calculate and Render Estimated Price Total
  const total = state.cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);
  el.cartTotal.textContent = `₹${total}`;

  // Re-render catalog view elements to sync counts and badges
  renderCatalog();
}

// Open modal and prepopulate category or edit details
function openCustomItemModal(preselectedCatId = null, editProdId = null) {
  el.customModal.classList.remove('hidden');
  document.getElementById('custom-name').focus();

  if (editProdId) {
    state.editingProductId = editProdId;
    const prod = state.catalog.find(p => p.id === editProdId);
    if (prod) {
      document.getElementById('custom-name').value = prod.name;
      el.customCategorySelect.value = prod.category;
      document.getElementById('custom-unit').value = prod.unit;
      document.getElementById('custom-price').value = prod.price;
      document.getElementById('custom-emoji').value = prod.emoji;

      // Select corresponding gradient radio
      const radios = document.querySelectorAll('input[name="custom-color"]');
      radios.forEach(radio => {
        if (radio.value === prod.bgGradient) {
          radio.checked = true;
        }
      });

      el.modalTitleText.textContent = `Edit Product: ${prod.name}`;
      el.customSubmitBtn.textContent = `Save Changes`;
    }
  } else {
    state.editingProductId = null;
    el.customForm.reset();

    // Set default color checked
    const defaultRadio = document.querySelector('input[name="custom-color"]');
    if (defaultRadio) defaultRadio.checked = true;

    if (preselectedCatId) {
      el.customCategorySelect.value = preselectedCatId;
      el.modalTitleText.textContent = `Add to ${categories[preselectedCatId].name}`;
    } else {
      el.modalTitleText.textContent = `Add Custom Item`;
    }
    el.customSubmitBtn.textContent = `Add to Shared List`;
  }
}

// Setup Event Listeners
function setupEventListeners() {
  // Member selection
  el.memberSelect.addEventListener('change', (e) => {
    state.member = e.target.value;
    localStorage.setItem('homemart_member', state.member);
    showToast(`👤 Switched profile to: ${state.member}`);
    renderCart();
  });

  // Search bar
  el.searchInput.addEventListener('input', (e) => {
    state.searchQuery = e.target.value;
    renderCatalog();
  });

  // Clear cart button
  el.btnClearCart.addEventListener('click', () => {
    if (state.cart.length === 0) return;
    if (confirm("Are you sure you want to clear the shopping list?")) {
      clearCart('all');
      showToast("🗑️ Shopping list cleared.");
    }
  });

  // Complete Shopping list button
  el.btnCompleteShopping.addEventListener('click', () => {
    const activeCount = state.cart.filter(item => !item.bought).length;
    if (state.cart.length === 0) return;

    if (activeCount > 0) {
      if (!confirm(`You still have ${activeCount} items left to buy. Mark everything as bought and complete shopping?`)) {
        return;
      }
    }

    // Start celebration confetti
    triggerConfetti();
    showToast("🎉 Groceries bought!", 4000);

    setTimeout(() => {
      clearCart('all');
    }, 3000);
  });

  // Collapsible bought items group toggle
  el.btnToggleBought.addEventListener('click', () => {
    state.boughtCollapsed = !state.boughtCollapsed;
    if (state.boughtCollapsed) {
      el.boughtGroup.classList.add('collapsed');
    } else {
      el.boughtGroup.classList.remove('collapsed');
    }
  });

  // Close modal toggles
  el.btnCloseModal.addEventListener('click', () => {
    el.customModal.classList.add('hidden');
  });

  // Close modal when clicking outside
  window.addEventListener('click', (e) => {
    if (e.target === el.customModal) {
      el.customModal.classList.add('hidden');
    }
  });

  // Handle Custom Item Submit (Add or Edit)
  el.customForm.addEventListener('submit', (e) => {
    e.preventDefault();

    const name = document.getElementById('custom-name').value.trim();
    const category = document.getElementById('custom-category').value;
    const unit = document.getElementById('custom-unit').value.trim() || '1 unit';
    const price = parseInt(document.getElementById('custom-price').value, 10) || 0;
    const emoji = document.getElementById('custom-emoji').value.trim() || '🛒';

    // Get custom background color checked
    const colorRadio = document.querySelector('input[name="custom-color"]:checked');
    const bgGradient = colorRadio ? colorRadio.value : 'linear-gradient(135deg, #a1c4fd 0%, #c2e9fb 100%)';

    if (state.editingProductId) {
      const updatedProductData = {
        id: state.editingProductId,
        name: name,
        category: category,
        unit: unit,
        price: price,
        emoji: emoji,
        bgGradient: bgGradient,
        description: `Updated by ${state.member}`
      };
      updateProductInCatalog(state.editingProductId, updatedProductData);
    } else {
      const newProductData = {
        name: name,
        category: category,
        unit: unit,
        price: price,
        emoji: emoji,
        bgGradient: bgGradient,
        description: `Custom item added by ${state.member}`
      };
      addNewProductToCatalogAndCart(newProductData);
    }

    // Reset and hide form
    el.customForm.reset();
    el.customModal.classList.add('hidden');
  });
}

// Display Toast notification
function showToast(message, duration = 3500) {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `<span>📢</span> <span>${message}</span>`;
  el.toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, duration);
}

// --- Confetti Animation Canvas System ---
let animationFrameId;
function triggerConfetti() {
  const canvas = el.confettiCanvas;
  const ctx = canvas.getContext('2d');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const colors = ['#16a34a', '#ff5722', '#3b82f6', '#f43f5e', '#eab308'];
  const confettiCount = 150;
  const confetti = [];

  class Confetto {
    constructor() {
      this.x = Math.random() * canvas.width;
      this.y = Math.random() * -canvas.height - 20;
      this.r = Math.random() * 6 + 4;
      this.d = Math.random() * canvas.height;
      this.color = colors[Math.floor(Math.random() * colors.length)];
      this.tilt = Math.random() * 10 - 5;
      this.tiltAngleIncremental = Math.random() * 0.07 + 0.02;
      this.tiltAngle = 0;
    }

    draw() {
      ctx.beginPath();
      ctx.lineWidth = this.r / 2;
      ctx.strokeStyle = this.color;
      ctx.moveTo(this.x + this.tilt + this.r / 2, this.y);
      ctx.lineTo(this.x + this.tilt, this.y + this.tilt + this.r / 2);
      ctx.stroke();
    }

    update() {
      this.tiltAngle += this.tiltAngleIncremental;
      this.y += (Math.cos(this.tiltAngle) + 3 + this.r / 2) / 2;
      this.x += Math.sin(this.tiltAngle);
      this.tilt = Math.sin(this.tiltAngle - this.r / 2) * 5;
      return this.y < canvas.height;
    }
  }

  for (let i = 0; i < confettiCount; i++) {
    confetti.push(new Confetto());
  }

  let startTime = Date.now();

  function anim() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    let active = false;
    for (let i = 0; i < confetti.length; i++) {
      confetti[i].draw();
      const onScreen = confetti[i].update();
      if (onScreen) active = true;
    }

    if (active && Date.now() - startTime < 3500) {
      animationFrameId = requestAnimationFrame(anim);
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      cancelAnimationFrame(animationFrameId);
    }
  }

  anim();
}

window.addEventListener('resize', () => {
  if (el.confettiCanvas) {
    el.confettiCanvas.width = window.innerWidth;
    el.confettiCanvas.height = window.innerHeight;
  }
});

// Run Init
window.addEventListener('DOMContentLoaded', init);
