/* =========================================================
   CHARCOAL MARKETPLACE
   ADMIN DASHBOARD
========================================================= */

const API =
  "/api";
/* =========================================================
   AUTH STATE
========================================================= */

let adminToken =
  localStorage.getItem("adminToken");


/* =========================================================
   REDIRECT TO LOGIN
========================================================= */

function redirectToLogin() {

  localStorage.removeItem(
    "adminToken"
  );

  window.location.replace(
    "admin-login.html"
  );

}


/* =========================================================
   AUTH HEADERS
========================================================= */

function getHeaders() {

  adminToken =
    localStorage.getItem("adminToken");


  const headers = {
    "Content-Type":
      "application/json"
  };


  if (adminToken) {

    headers.Authorization =
      `Bearer ${adminToken}`;

  }


  return headers;

}


/* =========================================================
   VERIFY ADMIN
========================================================= */

async function verifyAdminAccess() {

  adminToken =
    localStorage.getItem("adminToken");


  if (!adminToken) {

    console.warn(
      "No adminToken found."
    );

    redirectToLogin();

    return false;

  }


  try {

    const response =
      await fetch(
        `${API}/admin/me`,
        {
          method: "GET",
          headers: getHeaders()
        }
      );


    /*
      Read the response safely.
    */

    const data =
      await response.json()
        .catch(() => ({}));


    console.log(
      "Admin verification response:",
      response.status,
      data
    );


    /*
      TOKEN INVALID / EXPIRED
    */

    if (
      response.status === 401
    ) {

      console.error(
        "Admin token rejected:",
        data.message
      );

      alert(
        data.message ||
        "Your administrator session has expired. Please login again."
      );

      redirectToLogin();

      return false;

    }


    /*
      ADMIN ACCESS DENIED
    */

    if (
      response.status === 403
    ) {

      console.error(
        "Admin access denied:",
        data.message
      );

      alert(
        data.message ||
        "Administrator access denied."
      );

      redirectToLogin();

      return false;

    }


    /*
      OTHER SERVER ERROR
    */

    if (!response.ok) {

      console.error(
        "Admin verification HTTP error:",
        response.status,
        data
      );

      alert(
        data.message ||
        `Administrator verification failed. Server returned ${response.status}.`
      );

      return false;

    }


    /*
      VERIFY RESPONSE STRUCTURE
    */

    if (
      !data.success ||
      !data.admin
    ) {

      console.error(
        "Invalid admin verification response:",
        data
      );

      alert(
        data.message ||
        "Invalid administrator verification response."
      );

      redirectToLogin();

      return false;

    }


    /*
      VERIFY ROLE
    */

    if (
      data.admin.role !== "admin"
    ) {

      console.error(
        "Wrong administrator role:",
        data.admin.role
      );

      alert(
        "This account does not have administrator privileges."
      );

      redirectToLogin();

      return false;

    }


    /*
      VERIFY ACCOUNT STATUS
    */

    if (
      data.admin.status !== "approved"
    ) {

      console.error(
        "Administrator account is not approved:",
        data.admin.status
      );

      alert(
        `Administrator account status is "${data.admin.status}". Account must be approved.`
      );

      redirectToLogin();

      return false;

    }


    /*
      SUCCESS
    */

    console.log(
      "✅ Administrator verified:",
      data.admin
    );


    /*
      Store useful admin information
      for the dashboard.
    */

    window.currentAdmin =
      data.admin;


    return true;

  } catch (error) {

    console.error(
      "Admin verification network error:",
      error
    );


    alert(
      "Unable to connect to the administrator server."
    );


    return false;

  }

}


/* =========================================================
   INITIALIZATION
========================================================= */

document.addEventListener(
  "DOMContentLoaded",
  async () => {

    const authorized =
      await verifyAdminAccess();


    if (!authorized) {

      return;

    }


    console.log(
      "✅ Administrator dashboard authorized"
    );


    showSection(
      "dashboard"
    );


    loadDashboard();

    loadPendingProducts();

    loadPendingVendors();

  }
);


/* =========================================================
   SECTION NAVIGATION
========================================================= */

function showSection(sectionId) {

  const sections =
    document.querySelectorAll(
      ".section"
    );


  sections.forEach(
    section => {

      section.classList.remove(
        "active"
      );

    }
  );


  const target =
    document.getElementById(
      sectionId
    );


  if (target) {

    target.classList.add(
      "active"
    );

  }

}


/* =========================================================
   DASHBOARD
========================================================= */

async function loadDashboard() {

  try {

    const response =
      await fetch(
        `${API}/admin/dashboard`,
        {
          method: "GET",
          headers: getHeaders()
        }
      );


    const data =
      await response.json()
        .catch(() => ({}));


    if (
      response.status === 401 ||
      response.status === 403
    ) {

      alert(
        data.message ||
        "Administrator authorization failed."
      );

      redirectToLogin();

      return;

    }


    if (!response.ok) {

      throw new Error(
        data.message ||
        "Dashboard request failed"
      );

    }


    if (
      !data.success ||
      !data.stats
    ) {

      console.warn(
        "Invalid dashboard response:",
        data
      );

      return;

    }


    const stats =
      data.stats;


    const sales =
      document.getElementById(
        "sales"
      );

    const orders =
      document.getElementById(
        "ordersCount"
      );

    const vendors =
      document.getElementById(
        "vendorsCount"
      );

    const products =
      document.getElementById(
        "productsCount"
      );


    if (sales) {

      sales.textContent =
        `${Number(
          stats.sales || 0
        ).toFixed(2)} Pi`;

    }


    if (orders) {

      orders.textContent =
        stats.orders || 0;

    }


    if (vendors) {

      vendors.textContent =
        stats.vendors || 0;

    }


    if (products) {

      products.textContent =
        stats.products || 0;

    }


  } catch (error) {

    console.error(
      "Dashboard error:",
      error
    );

  }

}


/* =========================================================
   LOGOUT
========================================================= */

function logout() {

  const confirmed =
    confirm(
      "Are you sure you want to logout?"
    );


  if (!confirmed) {

    return;

  }


  localStorage.removeItem(
    "adminToken"
  );


  window.location.replace(
    "admin-login.html"
  );

}


/* =========================================================
   PENDING PRODUCTS
========================================================= */

async function loadPendingProducts() {

  const container =
    document.getElementById(
      "pendingProducts"
    );


  if (!container) {

    return;

  }


  try {

    container.innerHTML =
      "<p>Loading products...</p>";


    const response =
      await fetch(
        `${API}/admin/products/pending`,
        {
          headers: getHeaders()
        }
      );


    const data =
      await response.json()
        .catch(() => ([]));


    if (
      response.status === 401 ||
      response.status === 403
    ) {

      alert(
        data.message ||
        "Administrator access denied."
      );

      redirectToLogin();

      return;

    }


    if (!response.ok) {

      throw new Error(
        data.message ||
        "Products request failed"
      );

    }


    if (
      !Array.isArray(data) ||
      data.length === 0
    ) {

      container.innerHTML =
        "<p>No pending products</p>";

      return;

    }


    container.innerHTML =
      data.map(
        product => `

        <div class="card">

          <img
            src="${getImageURL(
              product.image
            )}"
            alt="${escapeHTML(
              product.name
            )}"
          >

          <h3>
            ${escapeHTML(
              product.name
            )}
          </h3>

          <p>
            ${escapeHTML(
              product.location || ""
            )}
          </p>

          <p>
            Vendor:
            ${escapeHTML(
              product.vendor_name ||
              "Unknown"
            )}
          </p>

          <h4>
            ${Number(
              product.price_pi || 0
            ).toFixed(2)}
            Pi
          </h4>

          <button
            onclick="approveProduct(${product.id})"
          >
            Approve
          </button>

          <button
            onclick="rejectProduct(${product.id})"
          >
            Reject
          </button>

        </div>

      `
      ).join("");


  } catch (error) {

    console.error(
      "Pending products error:",
      error
    );

    container.innerHTML =
      "<p>Unable to load pending products.</p>";

  }

}


/* =========================================================
   PENDING VENDORS
========================================================= */

async function loadPendingVendors() {

  const container =
    document.getElementById(
      "pendingVendors"
    );


  if (!container) {

    return;

  }


  try {

    container.innerHTML =
      "<p>Loading vendors...</p>";


    const response =
      await fetch(
        `${API}/admin/vendors/pending`,
        {
          headers: getHeaders()
        }
      );


    const data =
      await response.json()
        .catch(() => ([]));


    if (
      response.status === 401 ||
      response.status === 403
    ) {

      alert(
        data.message ||
        "Administrator access denied."
      );

      redirectToLogin();

      return;

    }


    if (!response.ok) {

      throw new Error(
        data.message ||
        "Vendor request failed"
      );

    }


    if (
      !Array.isArray(data) ||
      data.length === 0
    ) {

      container.innerHTML =
        "<p>No pending vendors</p>";

      return;

    }


    container.innerHTML =
      data.map(
        vendor => `

        <div class="card">

          <h3>
            ${escapeHTML(
              vendor.name
            )}
          </h3>

          <p>
            ${escapeHTML(
              vendor.email
            )}
          </p>

          <p>
            Pi Username:
            ${escapeHTML(
              vendor.pi_username || "N/A"
            )}
          </p>

          <p>
            Business:
            ${escapeHTML(
              vendor.business_name || "N/A"
            )}
          </p>

          <p>
            Applied:
            ${
              vendor.vendor_applied_at
                ? new Date(
                    vendor.vendor_applied_at
                  ).toLocaleDateString()
                : "Unknown"
            }
          </p>

          <button
            onclick="approveVendor(${vendor.id})"
          >
            Approve
          </button>

          <button
            onclick="rejectVendor(${vendor.id})"
          >
            Reject
          </button>

        </div>

      `
      ).join("");


  } catch (error) {

    console.error(
      "Pending vendors error:",
      error
    );

    container.innerHTML =
      "<p>Unable to load pending vendors.</p>";

  }

}


/* =========================================================
   APPROVE PRODUCT
========================================================= */

async function approveProduct(id) {

  if (
    !confirm(
      "Approve this product?"
    )
  ) {

    return;

  }


  try {

    const response =
      await fetch(
        `${API}/admin/products/approve/${id}`,
        {
          method: "POST",
          headers: getHeaders()
        }
      );


    const data =
      await response.json()
        .catch(() => ({}));


    if (
      response.status === 401 ||
      response.status === 403
    ) {

      alert(
        data.message ||
        "Administrator access denied."
      );

      redirectToLogin();

      return;

    }


    if (!response.ok) {

      alert(
        data.message ||
        "Product approval failed."
      );

      return;

    }


    alert(
      "Product approved successfully ✔"
    );


    loadPendingProducts();

    loadDashboard();


  } catch (error) {

    console.error(
      "Approve product error:",
      error
    );

    alert(
      "Unable to approve product."
    );

  }

}


/* =========================================================
   REJECT PRODUCT
========================================================= */

async function rejectProduct(id) {

  if (
    !confirm(
      "Reject this product?"
    )
  ) {

    return;

  }


  try {

    const response =
      await fetch(
        `${API}/admin/products/reject/${id}`,
        {
          method: "POST",
          headers: getHeaders()
        }
      );


    const data =
      await response.json()
        .catch(() => ({}));


    if (
      response.status === 401 ||
      response.status === 403
    ) {

      alert(
        data.message ||
        "Administrator access denied."
      );

      redirectToLogin();

      return;

    }


    if (!response.ok) {

      alert(
        data.message ||
        "Product rejection failed."
      );

      return;

    }


    alert(
      "Product rejected."
    );


    loadPendingProducts();

    loadDashboard();


  } catch (error) {

    console.error(
      "Reject product error:",
      error
    );

    alert(
      "Unable to reject product."
    );

  }

}


/* =========================================================
   APPROVE VENDOR
========================================================= */

async function approveVendor(id) {

  if (
    !confirm(
      "Approve this vendor?"
    )
  ) {

    return;

  }


  try {

    const response =
      await fetch(
        `${API}/admin/vendors/approve/${id}`,
        {
          method: "POST",
          headers: getHeaders()
        }
      );


    const data =
      await response.json()
        .catch(() => ({}));


    if (
      response.status === 401 ||
      response.status === 403
    ) {

      alert(
        data.message ||
        "Administrator access denied."
      );

      redirectToLogin();

      return;

    }


    if (!response.ok) {

      alert(
        data.message ||
        "Vendor approval failed."
      );

      return;

    }


    alert(
      "Vendor approved successfully ✔"
    );


    loadPendingVendors();

    loadDashboard();


  } catch (error) {

    console.error(
      "Approve vendor error:",
      error
    );

    alert(
      "Unable to approve vendor."
    );

  }

}


/* =========================================================
   REJECT VENDOR
========================================================= */

async function rejectVendor(id) {

  const reason =
    prompt(
      "Enter rejection reason:",
      "Vendor application rejected by Admin"
    );


  if (
    reason === null
  ) {

    return;

  }


  try {

    const response =
      await fetch(
        `${API}/admin/vendors/reject/${id}`,
        {
          method: "POST",

          headers: getHeaders(),

          body: JSON.stringify({
            reason
          })
        }
      );


    const data =
      await response.json()
        .catch(() => ({}));


    if (
      response.status === 401 ||
      response.status === 403
    ) {

      alert(
        data.message ||
        "Administrator access denied."
      );

      redirectToLogin();

      return;

    }


    if (!response.ok) {

      alert(
        data.message ||
        "Vendor rejection failed."
      );

      return;

    }


    alert(
      "Vendor rejected."
    );


    loadPendingVendors();

    loadDashboard();


  } catch (error) {

    console.error(
      "Reject vendor error:",
      error
    );

    alert(
      "Unable to reject vendor."
    );

  }

}


/* =========================================================
   IMAGE URL
========================================================= */

function getImageURL(path) {

  if (!path) {

    return "placeholder.png";

  }


  if (
    String(path).startsWith(
      "http"
    )
  ) {

    return path;

  }


  if (
    String(path).startsWith("/")
  ) {

    return (
      "https://charcoal-marketplace-2.onrender.com" +
      path
    );

  }


  return (
    "https://charcoal-marketplace-2.onrender.com/" +
    path
  );

}


/* =========================================================
   HTML ESCAPE
========================================================= */

function escapeHTML(value) {

  return String(
    value ?? ""
  )

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