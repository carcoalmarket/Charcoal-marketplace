/* =========================================================
   CHARCOAL MARKETPLACE - HOME JS
========================================================= */


/* =========================================================
   API
========================================================= */

const API =
  "https://charcoal-marketplace-2.onrender.com/api";


/* =========================================================
   HOME DATA
========================================================= */

let allProducts = [];

let cart =
  JSON.parse(localStorage.getItem("cart")) || [];


/* =========================================================
   INITIALIZATION
========================================================= */

document.addEventListener("DOMContentLoaded", () => {

  loadProducts();

  setupSearch();

  updateCartUI();

  initializePi();

  setupActiveNavigation();

  setupAdminMenu();

});


/* =========================================================
   PI SDK INITIALIZATION
========================================================= */

function initializePi() {

  if (!window.Pi) {

    console.warn(
      "⚠️ Pi SDK not available"
    );

    return;
  }

  try {

    Pi.init({
      version: "2.0"
    });

    console.log(
      "✅ Pi SDK initialized"
    );

  } catch (error) {

    console.error(
      "❌ Pi initialization failed:",
      error
    );

  }

}


/* =========================================================
   LOAD PRODUCTS
========================================================= */

async function loadProducts() {

  const container =
    document.getElementById("products");

  if (!container) return;

  try {

    container.innerHTML =
      "<p>Loading products...</p>";

    const res =
      await fetch(`${API}/products`);

    if (!res.ok) {

      throw new Error(
        `HTTP error: ${res.status}`
      );

    }

    const data =
      await res.json();

    if (!Array.isArray(data)) {

      container.innerHTML =
        "<p>No products found</p>";

      return;
    }

    allProducts = data;

    renderProducts(data);

  } catch (err) {

    console.error(
      "❌ Failed to load products:",
      err
    );

    container.innerHTML =
      "<p>Failed to load products</p>";
  }
}


/* =========================================================
   RENDER PRODUCTS
========================================================= */

function renderProducts(products) {

  const container =
    document.getElementById("products");

  if (!container) return;

  if (!products.length) {

    container.innerHTML =
      "<p>No products found</p>";

    return;
  }

  container.innerHTML =
    products.map(product => {

      const safeName =
        escapeHTML(product.name);

      const safeLocation =
        escapeHTML(
          product.location || ""
        );

      const imageURL =
        getImageURL(product.image);

      return `
        <div class="card">

          <img
  src="${imageURL}"
  alt="${safeName}"
  loading="lazy"
  onerror="this.onerror=null; this.src='placeholder.png';"
/>
          
          <h3>${safeName}</h3>

          <p>${safeLocation}</p>

          <h4>
            ${Number(product.price_pi) || 0} Pi
          </h4>

          <button
            onclick="addToCart(
              ${product.id},
              '${escapeJS(product.name)}',
              ${Number(product.price_pi) || 0}
            )"
          >
            Add to Cart
          </button>

        </div>
      `;

    }).join("");
}


/* =========================================================
   CART SYSTEM
========================================================= */

function addToCart(id, name, price) {

  const existing =
    cart.find(
      item => item.id === id
    );

  if (existing) {

    existing.qty += 1;

  } else {

    cart.push({
      id,
      name,
      price,
      qty: 1
    });

  }

  saveCart();

  updateCartUI();
}


/* =========================================================
   REMOVE FROM CART
========================================================= */

function removeFromCart(id) {

  cart =
    cart.filter(
      item => item.id !== id
    );

  saveCart();

  updateCartUI();
}


/* =========================================================
   SAVE CART
========================================================= */

function saveCart() {

  localStorage.setItem(
    "cart",
    JSON.stringify(cart)
  );

}


/* =========================================================
   CART UI
========================================================= */

function updateCartUI() {

  const count =
    cart.reduce(
      (sum, item) =>
        sum + Number(item.qty || 0),
      0
    );

  const total =
    cart.reduce(
      (sum, item) =>
        sum +
        Number(item.qty || 0) *
        Number(item.price || 0),
      0
    );


  /* =========================
     CART COUNT
  ========================= */

  const cartCount =
    document.getElementById(
      "cartCount"
    );

  if (cartCount) {

    cartCount.innerText =
      count;

  }


  /* =========================
     CART TOTAL
  ========================= */

  const cartTotal =
    document.getElementById(
      "cartTotal"
    );

  if (cartTotal) {

    cartTotal.innerText =
      total.toFixed(2) + " Pi";

  }


  /* =========================
     CART ITEMS
  ========================= */

  const container =
    document.getElementById(
      "cartItems"
    );

  if (!container) return;


  if (cart.length === 0) {

    container.innerHTML =
      "<p>Cart is empty</p>";

    return;
  }


  container.innerHTML =
    cart.map(item => {

      return `
        <div class="cart-item">

          <div>

            <b>
              ${escapeHTML(item.name)}
            </b>

            <p>
              ${Number(item.price).toFixed(2)}
              Pi × ${item.qty}
            </p>

          </div>

          <button
            onclick="removeFromCart(${item.id})"
          >
            X
          </button>

        </div>
      `;

    }).join("");
}


/* =========================================================
   OPEN CART
========================================================= */

function openCart() {

  const modal =
    document.getElementById(
      "cartModal"
    );

  if (!modal) return;

  modal.style.display =
    "flex";

  updateCartUI();
}


/* =========================================================
   CLOSE CART
========================================================= */

function closeCart() {

  const modal =
    document.getElementById(
      "cartModal"
    );

  if (!modal) return;

  modal.style.display =
    "none";
}


/* =========================================================
   SEARCH
========================================================= */

function setupSearch() {

  const input =
    document.getElementById(
      "searchInput"
    );

  if (!input) return;

  input.addEventListener(
    "input",
    function (event) {

      const value =
        event.target.value
          .toLowerCase()
          .trim();


      const filtered =
        allProducts.filter(
          product => {

            const name =
              String(
                product.name || ""
              ).toLowerCase();

            const location =
              String(
                product.location || ""
              ).toLowerCase();

            return (
              name.includes(value) ||
              location.includes(value)
            );

          }
        );


      renderProducts(
        filtered
      );

    }
  );

}


/* =========================================================
   PI CHECKOUT
========================================================= */

function goToCheckout() {
  if (!cart.length) {
    alert("Cart is empty");
    return;
  }
  window.location.href = "checkout.html";
}

/* =========================================================
   ADMIN MENU
========================================================= */

function setupAdminMenu() {

  const menu =
    document.getElementById(
      "adminDropdown"
    );

  const button =
    document.querySelector(
      ".admin-btn"
    );

  if (!menu || !button) {
    return;
  }


  /*
   * Make sure the menu starts hidden.
   */

  menu.style.display =
    "none";


  /*
   * Close menu when clicking
   * outside the admin menu.
   */

  document.addEventListener(
    "click",
    function (event) {

      const adminMenu =
        document.querySelector(
          ".admin-menu"
        );

      if (!adminMenu) return;


      if (
        !adminMenu.contains(
          event.target
        )
      ) {

        menu.style.display =
          "none";

      }

    }
  );


  /*
   * Close menu with Escape.
   */

  document.addEventListener(
    "keydown",
    function (event) {

      if (
        event.key === "Escape"
      ) {

        menu.style.display =
          "none";

      }

    }
  );

}


/* =========================================================
   TOGGLE ADMIN MENU
========================================================= */

function toggleAdminMenu() {

  const menu =
    document.getElementById(
      "adminDropdown"
    );

  if (!menu) return;


  if (
    menu.style.display ===
    "block"
  ) {

    menu.style.display =
      "none";

  } else {

    menu.style.display =
      "block";

  }

}


/* =========================================================
   NAVIGATION
========================================================= */

function goHome() {

  window.location.href =
    "home.html";

}


function goVendor() {

  window.location.href =
    "vendor.html";

}


function goProfile() {

  window.location.href =
    "profile.html";

}


/* =========================================================
   ACTIVE NAVIGATION
========================================================= */

function setupActiveNavigation() {

  const buttons =
    document.querySelectorAll(
      ".bottom-navigation button"
    );

  if (!buttons.length) {
    return;
  }


  let currentPage =
    window.location.pathname
      .split("/")
      .pop()
      .toLowerCase();


  /*
   * Empty pathname means
   * root/home page.
   */

  if (!currentPage) {

    currentPage =
      "home.html";

  }


  /*
   * Some browsers/pages may use
   * index.html as the home page.
   */

  const isHome =
    currentPage === "home.html" ||
    currentPage === "index.html" ||
    currentPage === "";


  buttons.forEach(button => {

    button.classList.remove(
      "active"
    );


    const action =
      button.getAttribute(
        "onclick"
      ) || "";


    /*
     * HOME
     */

    if (
      isHome &&
      action.includes(
        "goHome"
      )
    ) {

      button.classList.add(
        "active"
      );

      return;
    }


    /*
     * VENDOR
     */

    if (
      currentPage ===
        "vendor.html" &&
      action.includes(
        "goVendor"
      )
    ) {

      button.classList.add(
        "active"
      );

      return;
    }


    /*
     * PROFILE
     */

    if (
      currentPage ===
        "profile.html" &&
      action.includes(
        "goProfile"
      )
    ) {

      button.classList.add(
        "active"
      );

      return;
    }

  });

}


 /* =========================================================
   IMAGE URL
========================================================= */

function getImageURL(imagePath) {

  if (!imagePath) {
    return "placeholder.png";
  }

  const value =
    String(imagePath).trim();

  /* Already a complete URL */
  if (
    value.startsWith("http://") ||
    value.startsWith("https://")
  ) {
    return value;
  }

  const BASE_URL =
    "https://charcoal-marketplace-2.onrender.com";

  /* Remove accidental leading/trailing slashes */
  const cleanPath =
    value.replace(/^\/+/, "");

  /* Make sure uploads path is correct */
  if (
    cleanPath.startsWith("uploads/")
  ) {
    return `${BASE_URL}/${cleanPath}`;
  }

  return `${BASE_URL}/uploads/${cleanPath}`;
}

/* =========================================================
   HTML ESCAPE
========================================================= */

function escapeHTML(str) {

  return String(str || "")

    .replaceAll(
      "&",
      "&amp;"
    )

    .replaceAll(
      "<",
      "&lt;"
    )

    .replaceAll(
      ">",
      "&gt;"
    )

    .replaceAll(
      '"',
      "&quot;"
    )

    .replaceAll(
      "'",
      "&#039;"
    );

}


/* =========================================================
   JAVASCRIPT STRING ESCAPE
========================================================= */

function escapeJS(str) {

  return String(str || "")

    .replaceAll(
      "\\",
      "\\\\"
    )

    .replaceAll(
      "'",
      "\\'"
    )

    .replaceAll(
      "\n",
      "\\n"
    )

    .replaceAll(
      "\r",
      "\\r"
    );

}