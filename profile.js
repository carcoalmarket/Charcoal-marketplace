/* =========================================================
   CHARCOAL MARKETPLACE - PROFILE
========================================================= */


/* =========================
   CONFIG
========================= */

const API_URL =
  "/api";


/* =========================
   PAGE INITIALIZATION
========================= */

document.addEventListener("DOMContentLoaded", () => {

  loadProfile();

});


/* =========================
   LOAD PROFILE
========================= */

function loadProfile() {

  const token =
    localStorage.getItem("token");


  /*
    No login token
    ----------------
    Show only the public profile/login screen.
  */

  if (!token) {

    showLoggedOut();

    return;
  }


  /*
    Token exists
    ----------------
    Display the authenticated profile.
  */

  showLoggedIn();


  /*
    Get saved user information.

    This information should have been saved
    after successful Pi authentication.
  */

  const savedUser =
    localStorage.getItem("user");


  if (!savedUser) {

    /*
      Token exists but user information
      is missing.

      Do NOT display sensitive account
      information.
    */

    showLoggedOut();

    return;
  }


  try {

    const user =
      JSON.parse(savedUser);


    /* =========================
       USER NAME
    ========================= */

    const userName =
      document.getElementById("userName");

    if (userName) {

      userName.textContent =
        user.name ||
        user.username ||
        "Pi User";

    }


    /* =========================
       USERNAME
    ========================= */

    const userUsername =
      document.getElementById("userUsername");

    if (userUsername) {

      if (user.username) {

        userUsername.textContent =
          "@" + user.username;

      } else {

        userUsername.textContent =
          "@pi-user";

      }

    }


    /* =========================
       VENDOR STATUS
    ========================= */

    updateVendorStatus(user);


    /* =========================
       STATISTICS
    ========================= */

    loadStatistics();

  } catch (error) {

    console.error(
      "Failed to read user:",
      error
    );

    /*
      If saved user data is corrupted,
      don't show sensitive information.
    */

    showLoggedOut();

  }

}


/* =========================
   LOGGED OUT
========================= */

function showLoggedOut() {

  const loggedOutView =
    document.getElementById("loggedOutView");

  const loggedInView =
    document.getElementById("loggedInView");


  if (loggedOutView) {

    loggedOutView.classList.remove(
      "hidden"
    );

  }


  if (loggedInView) {

    loggedInView.classList.add(
      "hidden"
    );

  }

}


/* =========================
   LOGGED IN
========================= */

function showLoggedIn() {

  const loggedOutView =
    document.getElementById("loggedOutView");

  const loggedInView =
    document.getElementById("loggedInView");


  if (loggedOutView) {

    loggedOutView.classList.add(
      "hidden"
    );

  }


  if (loggedInView) {

    loggedInView.classList.remove(
      "hidden"
    );

  }

}


/* =========================================================
   PI LOGIN
========================================================= */

async function loginWithPi() {

  const msg =
    document.getElementById("msg");

  const btn =
    document.getElementById("piLoginBtn");


  /* =========================
     CHECK PI BROWSER
  ========================= */

  if (!window.Pi) {

    if (msg) {

      msg.textContent =
        "Please open Charcoal Marketplace in Pi Browser.";

      msg.style.color =
        "#dc3545";

    } else {

      alert(
        "Please open Charcoal Marketplace in Pi Browser."
      );

    }

    return;
  }


  /* =========================
     DISABLE LOGIN BUTTON
  ========================= */

  if (btn) {

    btn.disabled = true;

    btn.style.opacity = "0.7";

  }


  if (msg) {

    msg.textContent =
      "Connecting to Pi...";

    msg.style.color =
      "#666";

  }


  try {

    /* =========================
       INITIALIZE PI
    ========================= */

    Pi.init({
      version: "2.0"
    });


    /* =========================
       PI AUTHENTICATION
    ========================= */

    const auth =
      await Pi.authenticate([
        "username",
        "payments"
      ]);


    if (
      !auth ||
      !auth.accessToken ||
      !auth.user
    ) {

      throw new Error(
        "Pi authentication failed."
      );

    }


    if (msg) {

      msg.textContent =
        "Verifying your Pi account...";

    }


    /* =========================
       SEND LOGIN TO BACKEND
    ========================= */

    const response =
      await fetch(
        `${API_URL}/api/auth/pi-login`,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json"
          },

          body: JSON.stringify({

            accessToken:
              auth.accessToken,

            uid:
              auth.user.uid,

            username:
              auth.user.username

          })

        }
      );


    const data =
      await response.json();


    /* =========================
       BACKEND LOGIN FAILED
    ========================= */

    if (
      !response.ok ||
      !data.token
    ) {

      throw new Error(
        data.message ||
        "Backend login failed."
      );

    }


    /* =========================
       SAVE AUTH TOKEN
    ========================= */

    localStorage.setItem(
      "token",
      data.token
    );


    /* =========================
       SAVE USER
    ========================= */

    if (data.user) {

      localStorage.setItem(
        "user",
        JSON.stringify(data.user)
      );

    } else {

      /*
        Fallback user information
        from Pi authentication.
      */

      const piUser = {

        uid:
          auth.user.uid,

        username:
          auth.user.username,

        name:
          auth.user.username,

        role:
          "buyer"

      };


      localStorage.setItem(
        "user",
        JSON.stringify(piUser)
      );

    }


    /* =========================
       SUCCESS
    ========================= */

    if (msg) {

      msg.textContent =
        "Pi login successful ✔";

      msg.style.color =
        "#28a745";

    }


    /*
      Reload profile so the
      logged-in interface appears.
    */

    setTimeout(() => {

      window.location.reload();

    }, 500);


  } catch (error) {

    console.error(
      "Pi login error:",
      error
    );


    if (msg) {

      msg.textContent =
        error.message ||
        "Pi login failed. Please try again.";

      msg.style.color =
        "#dc3545";

    } else {

      alert(
        "Pi login failed. Please try again."
      );

    }

  } finally {

    if (btn) {

      btn.disabled = false;

      btn.style.opacity = "1";

    }

  }

}


/* =========================================================
   USER STATISTICS
========================================================= */

function loadStatistics() {

  /* =========================
     ORDERS
  ========================= */

  const orderCount =
    localStorage.getItem(
      "orderCount"
    ) || 0;


  /* =========================
     CART
  ========================= */

  let cartCount = 0;

  try {

    const cart =
      JSON.parse(
        localStorage.getItem("cart")
      ) || [];

    cartCount =
      cart.reduce(
        (total, item) =>
          total + Number(item.qty || 0),
        0
      );

  } catch (error) {

    console.error(
      "Cart data error:",
      error
    );

    cartCount = 0;

  }


  /* =========================
     SAVED PRODUCTS
  ========================= */

  const savedCount =
    localStorage.getItem(
      "savedCount"
    ) || 0;


  /* =========================
     UPDATE UI
  ========================= */

  const orderElement =
    document.getElementById(
      "orderCount"
    );

  const cartElement =
    document.getElementById(
      "cartCount"
    );

  const savedElement =
    document.getElementById(
      "savedCount"
    );


  if (orderElement) {

    orderElement.textContent =
      orderCount;

  }


  if (cartElement) {

    cartElement.textContent =
      cartCount;

  }


  if (savedElement) {

    savedElement.textContent =
      savedCount;

  }

}


/* =========================================================
   VENDOR STATUS
========================================================= */

function updateVendorStatus(user) {

  const vendorTitle =
    document.getElementById(
      "vendorTitle"
    );

  const vendorDescription =
    document.getElementById(
      "vendorDescription"
    );

  const earningsMenu =
    document.getElementById(
      "earningsMenuItem"
    );


  if (
    !vendorTitle ||
    !vendorDescription ||
    !earningsMenu
  ) {

    return;

  }


  /* =========================
     BUYER
  ========================= */

  if (
    !user.role ||
    user.role === "buyer"
  ) {

    vendorTitle.textContent =
      "Become a Vendor";

    vendorDescription.textContent =
      "Start selling charcoal on the marketplace";

    earningsMenu.classList.add(
      "hidden"
    );

    return;

  }


  /* =========================
     PENDING VENDOR
  ========================= */

  if (
    user.role === "vendor" &&
    user.status === "pending"
  ) {

    vendorTitle.textContent =
      "Vendor Application";

    vendorDescription.textContent =
      "Your application is awaiting approval";

    earningsMenu.classList.add(
      "hidden"
    );

    return;

  }


  /* =========================
     APPROVED VENDOR
  ========================= */

  if (
    user.role === "vendor" &&
    user.status === "approved"
  ) {

    vendorTitle.textContent =
      "Vendor Dashboard";

    vendorDescription.textContent =
      "Manage your products and orders";

    earningsMenu.classList.remove(
      "hidden"
    );

    return;

  }

}


/* =========================================================
   PROFILE NAVIGATION
========================================================= */

/*
   IMPORTANT:

   Navigation is controlled by HOME.JS.

   Therefore we do NOT put:
   - active navigation logic
   - navigation CSS
   - navigation state

   inside this file.

   profile.js only provides the functions
   required by the Profile page.
*/


function goProfile() {

  window.location.href =
    "profile.html";

}


/* =========================================================
   ACCOUNT ACTIONS
========================================================= */

function openOrders() {

  requireLogin(
    "orders.html"
  );

}


function openCart() {

  requireLogin(
    "cart.html"
  );

}


function openSaved() {

  requireLogin(
    "saved.html"
  );

}


function openNotifications() {

  requireLogin(
    "notifications.html"
  );

}


function openPersonalInfo() {

  requireLogin(
    "personal-info.html"
  );

}


function openSettings() {

  requireLogin(
    "settings.html"
  );

}


function openSecurity() {

  requireLogin(
    "security.html"
  );

}


function openSupport() {

  window.location.href =
    "support.html";

}


/* =========================================================
   VENDOR
========================================================= */

function openVendorAccount() {

  const token =
    localStorage.getItem(
      "token"
    );


  /*
    Not logged in
    ----------------
    Send user to vendor page.

    The vendor page can then show:
    Become a Vendor / Login
  */

  if (!token) {

    window.location.href =
      "vendor.html";

    return;

  }


  const savedUser =
    localStorage.getItem(
      "user"
    );


  if (!savedUser) {

    window.location.href =
      "vendor.html";

    return;

  }


  try {

    const user =
      JSON.parse(savedUser);


    if (
      user.role === "vendor" &&
      user.status === "approved"
    ) {

      window.location.href =
        "vendor-dashboard.html";

    } else {

      window.location.href =
        "vendor.html";

    }

  } catch (error) {

    console.error(
      "Vendor status error:",
      error
    );

    window.location.href =
      "vendor.html";

  }

}


/* =========================================================
   EARNINGS
========================================================= */

function openEarnings() {

  requireLogin(
    "vendor-earnings.html"
  );

}


/* =========================================================
   EDIT PROFILE
========================================================= */

function editProfile() {

  requireLogin(
    "personal-info.html"
  );

}


/* =========================================================
   LOGIN CHECK
========================================================= */

function requireLogin(page) {

  const token =
    localStorage.getItem(
      "token"
    );


  if (!token) {

    alert(
      "Please continue with Pi to access this feature."
    );

    return;

  }


  window.location.href =
    page;

}


/* =========================================================
   LOGOUT
========================================================= */

function logout() {

  const confirmLogout =
    confirm(
      "Are you sure you want to logout?"
    );


  if (!confirmLogout) {

    return;

  }


  /*
    Remove authentication information.
  */

  localStorage.removeItem(
    "token"
  );

  localStorage.removeItem(
    "user"
  );


  /*
    Reload profile.

    It will now show the
    logged-out screen.
  */

  window.location.reload();

}