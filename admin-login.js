/* =========================================================
   CHARCOAL MARKETPLACE
   ADMIN LOGIN
========================================================= */

const API = "api";


/* =========================================================
   ELEMENT HELPER
========================================================= */

function getEl(id) {
  return document.getElementById(id);
}


/* =========================================================
   PAGE START
========================================================= */

document.addEventListener(
  "DOMContentLoaded",
  () => {

    console.log(
      "🔐 Admin Login initialized"
    );

    console.log(
      "🌐 API:",
      API
    );

    /*
      If an admin token already exists,
      verify it before allowing access.
    */

    checkExistingAdmin();

  }
);


/* =========================================================
   EXISTING ADMIN CHECK
========================================================= */

async function checkExistingAdmin() {

  const token =
    localStorage.getItem("adminToken");


  /*
    No existing token.
    User remains on login page.
  */

  if (!token) {

    console.log(
      "ℹ️ No existing admin token found"
    );

    return;

  }


  console.log(
    "🔑 Existing admin token found. Verifying..."
  );


  try {

    const response =
      await fetch(
        `${API}/admin/me`,
        {
          method: "GET",

          headers: {

            Authorization:
              `Bearer ${token}`,

            Accept:
              "application/json"

          }
        }
      );


    const data =
      await response
        .json()
        .catch(() => ({}));


    console.log(
      "🔎 Admin verification:",
      {
        status:
          response.status,

        success:
          data.success,

        code:
          data.code,

        message:
          data.message
      }
    );


    /*
      Token is valid.
    */

    if (
      response.ok &&
      data.success
    ) {

      console.log(
        "✅ Existing administrator verified"
      );


      window.location.replace(
        "admin.html"
      );


      return;

    }


    /*
      Token is invalid or account
      no longer has administrator access.
    */

    console.warn(
      "⚠️ Existing admin token rejected:",
      data
    );


    localStorage.removeItem(
      "adminToken"
    );


  } catch (error) {

    console.error(
      "❌ Existing admin verification failed:",
      error
    );

  }

}


/* =========================================================
   EMAIL ADMIN LOGIN
========================================================= */

async function login() {

  const emailEl =
    getEl("email");

  const passwordEl =
    getEl("password");

  const msg =
    getEl("msg");

  const btn =
    getEl("loginBtn");


  if (
    !emailEl ||
    !passwordEl ||
    !msg ||
    !btn
  ) {

    console.error(
      "❌ Admin login elements not found"
    );

    return;

  }


  const email =
    emailEl.value.trim();

  const password =
    passwordEl.value;


  /* -------------------------------------------------------
     VALIDATION
  ------------------------------------------------------- */

  if (!email || !password) {

    msg.innerText =
      "Please enter your email and password.";

    return;

  }


  btn.disabled = true;

  msg.innerText =
    "Verifying administrator account...";


  console.log(
    "🔐 Attempting email administrator login..."
  );


  try {

    const response =
      await fetch(
        `${API}/auth/admin-login`,
        {
          method: "POST",

          headers: {

            "Content-Type":
              "application/json",

            Accept:
              "application/json"

          },

          body:
            JSON.stringify({

              email,
              password

            })

        }
      );


    const data =
      await response
        .json()
        .catch(() => ({}));


    console.log(
      "🔎 Admin login response:",
      {
        status:
          response.status,

        success:
          data.success,

        code:
          data.code,

        message:
          data.message
      }
    );


    /* -----------------------------------------------------
       LOGIN FAILED
    ----------------------------------------------------- */

    if (
      !response.ok ||
      !data.success ||
      !data.token
    ) {

      console.error(
        "❌ Admin login rejected:",
        data
      );


      msg.innerText =
        data.message ||
        "Admin login failed.";


      return;

    }


    /* -----------------------------------------------------
       VERIFY USER ROLE
    ----------------------------------------------------- */

    if (
      !data.user ||
      data.user.role !== "admin"
    ) {

      console.error(
        "❌ Login succeeded but account is not an admin:",
        data.user
      );


      msg.innerText =
        "Access denied. This account is not an administrator.";


      return;

    }


    /* -----------------------------------------------------
       VERIFY ADMIN STATUS
    ----------------------------------------------------- */

    if (
      data.user.status &&
      data.user.status !== "approved"
    ) {

      console.error(
        "❌ Administrator account is not approved:",
        data.user
      );


      msg.innerText =
        "Administrator account is not approved.";


      return;

    }


    /* -----------------------------------------------------
       SAVE JWT
    ----------------------------------------------------- */

    localStorage.setItem(
      "adminToken",
      data.token
    );


    console.log(
      "✅ Administrator JWT saved successfully"
    );


    console.log(
      "👤 Admin:",
      {
        id:
          data.user.id,

        role:
          data.user.role,

        status:
          data.user.status,

        admin_level:
          data.user.admin_level
      }
    );


    msg.innerText =
      "Administrator verified ✔";


    /* -----------------------------------------------------
       REDIRECT
    ----------------------------------------------------- */

    setTimeout(
      () => {

        window.location.replace(
          "admin.html"
        );

      },
      500
    );


  } catch (error) {

    console.error(
      "❌ Admin login connection error:",
      error
    );


    msg.innerText =
      "Unable to connect to the server.";

  } finally {

    btn.disabled = false;

  }

}


/* =========================================================
   PI ADMIN LOGIN
========================================================= */

async function loginWithPi() {

  const msg =
    getEl("msg");

  const btn =
    getEl("piLoginBtn");


  if (!msg || !btn) {

    console.error(
      "❌ Pi login elements not found"
    );

    return;

  }


  /* -------------------------------------------------------
     CHECK PI SDK
  ------------------------------------------------------- */

  if (!window.Pi) {

    console.error(
      "❌ Pi SDK is not available"
    );


    msg.innerText =
      "Please open the marketplace inside Pi Browser.";

    return;

  }


  btn.disabled = true;

  msg.innerText =
    "Connecting to Pi Network...";


  console.log(
    "🟣 Starting Pi administrator authentication..."
  );


  try {

    /* -----------------------------------------------------
       INITIALIZE PI SDK
    ----------------------------------------------------- */

    Pi.init({
      version: "2.0"
    });


    console.log(
      "✅ Pi SDK initialized"
    );


    /* -----------------------------------------------------
       PI AUTHENTICATION
    ----------------------------------------------------- */

    const auth =
      await Pi.authenticate(
        [
          "username"
        ]
      );


    if (
      !auth ||
      !auth.accessToken ||
      !auth.user
    ) {

      console.error(
        "❌ Invalid Pi authentication response:",
        auth
      );


      msg.innerText =
        "Pi authentication failed.";

      return;

    }


    console.log(
      "✅ Pi authentication successful",
      {
        username:
          auth.user.username
      }
    );


    msg.innerText =
      "Verifying administrator account...";


    /* -----------------------------------------------------
       SEND PI TOKEN TO BACKEND
    ----------------------------------------------------- */

    const response =
      await fetch(
        `${API}/auth/pi-admin-login`,
        {
          method: "POST",

          headers: {

            "Content-Type":
              "application/json",

            Accept:
              "application/json"

          },

          body:
            JSON.stringify({

              accessToken:
                auth.accessToken

            })

        }
      );


    const data =
      await response
        .json()
        .catch(() => ({}));


    console.log(
      "🔎 Pi admin verification response:",
      {
        status:
          response.status,

        success:
          data.success,

        code:
          data.code,

        message:
          data.message
      }
    );


    /* -----------------------------------------------------
       BACKEND LOGIN FAILED
    ----------------------------------------------------- */

    if (
      !response.ok ||
      !data.success ||
      !data.token
    ) {

      console.error(
        "❌ Pi administrator verification rejected:",
        data
      );


      msg.innerText =
        data.message ||
        "Pi admin login failed.";


      return;

    }


    /* -----------------------------------------------------
       VERIFY ADMIN ROLE
    ----------------------------------------------------- */

    if (
      !data.user ||
      data.user.role !== "admin"
    ) {

      console.error(
        "❌ Pi account authenticated but is not an admin:",
        data.user
      );


      msg.innerText =
        "This Pi account is not an administrator.";


      return;

    }


    /* -----------------------------------------------------
       VERIFY ADMIN STATUS
    ----------------------------------------------------- */

    if (
      data.user.status &&
      data.user.status !== "approved"
    ) {

      console.error(
        "❌ Pi administrator account is not approved:",
        data.user
      );


      msg.innerText =
        "This administrator account is not approved.";


      return;

    }


    /* -----------------------------------------------------
       SAVE ADMIN JWT
    ----------------------------------------------------- */

    localStorage.setItem(
      "adminToken",
      data.token
    );


    console.log(
      "✅ Pi administrator JWT saved successfully"
    );


    console.log(
      "👑 Administrator:",
      {
        id:
          data.user.id,

        username:
          data.user.pi_username,

        role:
          data.user.role,

        status:
          data.user.status,

        admin_level:
          data.user.admin_level
      }
    );


    msg.innerText =
      "Admin verification successful ✔";


    /* -----------------------------------------------------
       REDIRECT TO ADMIN DASHBOARD
    ----------------------------------------------------- */

    setTimeout(
      () => {

        window.location.replace(
          "admin.html"
        );

      },
      500
    );


  } catch (error) {

    console.error(
      "❌ Pi administrator authentication error:",
      error
    );


    msg.innerText =
      "Pi administrator authentication failed.";

  } finally {

    btn.disabled = false;

  }

}


/* =========================================================
   LOGOUT HELPER
========================================================= */

function logoutAdmin() {

  console.log(
    "🚪 Logging out administrator..."
  );


  localStorage.removeItem(
    "adminToken"
  );


  window.location.replace(
    "admin-login.html"
  );

}