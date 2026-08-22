const API = "/api";

const PI_SANDBOX =
  location.hostname.includes("sandbox.minepi.com") ||
  localStorage.getItem("PI_SANDBOX") === "true";

let piInitialized = false;


/* =========================================================
   INITIALIZE PI SDK
========================================================= */

function initializePi() {

  if (!window.Pi) {
    throw new Error(
      "Pi Network SDK is not available. Please open this app in Pi Browser."
    );
  }

  if (piInitialized) {
    return;
  }

  try {

    if (PI_SANDBOX) {

      Pi.init({
        version: "2.0",
        sandbox: true
      });

    } else {

      Pi.init({
        version: "2.0"
      });

    }

    piInitialized = true;

    console.log("✅ Pi SDK initialized");

  } catch (error) {

    console.error(
      "❌ Pi SDK initialization failed:",
      error
    );

    throw new Error(
      "Unable to initialize Pi Network."
    );

  }
}


/* =========================================================
   CART
========================================================= */

function getCart() {

  try {

    return JSON.parse(
      localStorage.getItem("cart")
    ) || [];

  } catch {

    return [];

  }

}


function saveCart(cart) {

  localStorage.setItem(
    "cart",
    JSON.stringify(cart)
  );

}


/* =========================================================
   RENDER CHECKOUT
========================================================= */

function renderCheckout() {

  const box =
    document.getElementById("checkoutItems");

  const total =
    document.getElementById("totalAmount");

  const cart =
    getCart();


  if (!box) return;


  if (!cart.length) {

    box.innerHTML = `
      <div class="empty">
        <i class="fa fa-cart-shopping"></i>
        <h3>Your cart is empty</h3>
        <p>Add products to your cart before checkout.</p>
      </div>
    `;

    if (total) {
      total.textContent = "0.00 Pi";
    }

    return;

  }


  let sum = 0;


  box.innerHTML = cart.map(
    (item, index) => {

      const price =
        Number(
          item.price ??
          item.price_pi ??
          0
        );


      const qty =
        Number(
          item.qty ??
          item.quantity ??
          1
        );


      sum += price * qty;


      return `

        <div class="item">

          <div class="item-info">

            <h3>
              ${escapeHTML(item.name)}
            </h3>

            <p>
              ${price.toFixed(2)} Pi × ${qty}
            </p>

          </div>


          <button
            type="button"
            class="remove-btn"
            onclick="removeItem(${index})"
          >

            <i class="fa fa-trash"></i>
            Remove

          </button>

        </div>

      `;

    }
  ).join("");


  if (total) {

    total.textContent =
      sum.toFixed(2) + " Pi";

  }

}


/* =========================================================
   REMOVE ITEM
========================================================= */

function removeItem(index) {

  const cart =
    getCart();


  cart.splice(
    index,
    1
  );


  saveCart(cart);

  renderCheckout();

}


/* =========================================================
   PI AUTHENTICATION
========================================================= */

async function authenticateWithPi() {

  /* IMPORTANT:
     Pi.init MUST happen before Pi.authenticate()
  */

  initializePi();


  const auth =
    await Pi.authenticate(
      [
        "username",
        "payments"
      ],
      handleIncompletePayment
    );


  if (
    !auth ||
    !auth.accessToken
  ) {

    throw new Error(
      "Pi authentication failed."
    );

  }


  console.log(
    "✅ Pi authentication successful"
  );


  return auth;

}


/* =========================================================
   LOGIN / GET JWT
========================================================= */

async function loginToBackend(
  accessToken
) {

  const response =
    await fetch(
      `${API}/auth/pi-login`,
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json"
        },

        body: JSON.stringify({
          accessToken
        })
      }
    );


  const data =
    await response.json()
      .catch(() => ({}));


  if (
    !response.ok ||
    !data.token
  ) {

    throw new Error(
      data.message ||
      "Pi authentication failed on server."
    );

  }


  localStorage.setItem(
    "token",
    data.token
  );


  localStorage.setItem(
    "user",
    JSON.stringify(data.user)
  );


  console.log(
    "✅ Backend authentication successful"
  );


  return data;

}


/* =========================================================
   CREATE CHECKOUT
========================================================= */

async function createCheckout(
  token
) {

  const cart =
    getCart();


  const items =
    cart.map(
      item => ({
        product_id:
          Number(item.id),

        quantity:
          Number(
            item.qty ||
            item.quantity ||
            1
          )
      })
    );


  const response =
    await fetch(
      `${API}/orders/checkout`,
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json",

          Authorization:
            `Bearer ${token}`
        },

        body: JSON.stringify({
          items
        })
      }
    );


  const data =
    await response.json()
      .catch(() => ({}));


  if (!response.ok) {

    throw new Error(
      data.message ||
      "Unable to create order."
    );

  }


  if (
    data.total_pi === undefined
  ) {

    throw new Error(
      "Server did not return the order total."
    );

  }


  console.log(
    "✅ Checkout created:",
    data
  );


  return data;

}


/* =========================================================
   PAY WITH PI
========================================================= */

async function payWithPi() {

  const btn =
    document.getElementById(
      "payBtn"
    );

  const msg =
    document.getElementById(
      "msg"
    );


  const cart =
    getCart();


  if (!cart.length) {

    msg.textContent =
      "Your cart is empty.";

    return;

  }


  btn.disabled = true;

  btn.textContent =
    "Preparing payment...";


  try {

    /* -----------------------------------------------------
       STEP 1
       INITIALIZE + AUTHENTICATE PI
    ----------------------------------------------------- */

    const auth =
      await authenticateWithPi();


    /* -----------------------------------------------------
       STEP 2
       LOGIN TO OUR BACKEND
    ----------------------------------------------------- */

    const login =
      await loginToBackend(
        auth.accessToken
      );


    /* -----------------------------------------------------
       STEP 3
       CREATE ORDER
    ----------------------------------------------------- */

    btn.textContent =
      "Creating order...";


    const checkout =
      await createCheckout(
        login.token
      );


    const amount =
      Number(
        checkout.total_pi
      );


    if (
      !Number.isFinite(amount) ||
      amount <= 0
    ) {

      throw new Error(
        "Invalid payment amount."
      );

    }


    console.log(
      "💰 Payment amount:",
      amount,
      "Pi"
    );


    /* -----------------------------------------------------
       STEP 4
       CREATE PI PAYMENT
    ----------------------------------------------------- */

    btn.textContent =
      "Waiting for Pi payment...";


    /* Pi has already been initialized
       by authenticateWithPi().
    */


    Pi.createPayment(

      {

        amount: amount,

        memo:
          `Charcoal Marketplace Order ${checkout.checkout_ref}`,

        metadata: {
          checkout_ref:
            checkout.checkout_ref
        }

      },

      {

        /* ===============================================
           SERVER APPROVAL
        =============================================== */

        onReadyForServerApproval:
          async paymentId => {

            console.log(
              "🔐 Approving payment:",
              paymentId
            );


            const response =
              await fetch(
                `${API}/payments/approve`,
                {
                  method: "POST",

                  headers: {
                    "Content-Type":
                      "application/json",

                    Authorization:
                      `Bearer ${login.token}`
                  },

                  body:
                    JSON.stringify({

                      paymentId,

                      checkout_ref:
                        checkout.checkout_ref,

                      accessToken:
                        auth.accessToken

                    })
                }
              );


            const data =
              await response.json()
                .catch(() => ({}));


            if (
              !response.ok ||
              !data.success
            ) {

              throw new Error(
                data.message ||
                "Payment approval failed."
              );

            }


            console.log(
              "✅ Payment approved"
            );

          },


        /* ===============================================
           SERVER COMPLETION
        =============================================== */

        onReadyForServerCompletion:
          async (
            paymentId,
            txid
          ) => {

            console.log(
              "💳 Completing payment:",
              paymentId,
              txid
            );


            const response =
              await fetch(
                `${API}/payments/complete`,
                {
                  method: "POST",

                  headers: {
                    "Content-Type":
                      "application/json",

                    Authorization:
                      `Bearer ${login.token}`
                  },

                  body:
                    JSON.stringify({

                      paymentId,

                      txid,

                      accessToken:
                        auth.accessToken

                    })
                }
              );


            const data =
              await response.json()
                .catch(() => ({}));


            if (
              !response.ok ||
              !data.success
            ) {

              throw new Error(
                data.message ||
                "Payment completion failed."
              );

            }


            console.log(
              "✅ Payment completed successfully"
            );


            /* Clear cart */

            saveCart([]);

            renderCheckout();


            msg.innerHTML = `
              <span class="success-message">
                <i class="fa fa-circle-check"></i>
                Payment completed successfully!
              </span>
            `;


            btn.textContent =
              "Paid ✔";


            btn.disabled =
              true;

          },


        /* ===============================================
           CANCEL
        =============================================== */

        onCancel:
          async paymentId => {

            console.log(
              "⚠️ Payment cancelled:",
              paymentId
            );


            await cancelPayment(
              login.token,
              paymentId,
              checkout.checkout_ref
            );


            msg.textContent =
              "Payment cancelled.";


            btn.disabled =
              false;


            btn.textContent =
              "Pay with Pi";

          },


        /* ===============================================
           ERROR
        =============================================== */

        onError:
          async (
            error,
            payment
          ) => {

            console.error(
              "❌ Pi payment error:",
              error,
              payment
            );


            if (
              payment?.identifier
            ) {

              await cancelPayment(
                login.token,
                payment.identifier,
                checkout.checkout_ref
              );

            }


            msg.textContent =
              error?.message ||
              "Payment failed.";


            btn.disabled =
              false;


            btn.textContent =
              "Try Again";

          }

      }

    );

  } catch (error) {

    console.error(
      "❌ Checkout error:",
      error
    );


    msg.textContent =
      error.message ||
      "Payment failed.";


    btn.disabled =
      false;


    btn.textContent =
      "Try Again";

  }

}


/* =========================================================
   CANCEL PAYMENT
========================================================= */

async function cancelPayment(
  token,
  paymentId,
  checkout_ref
) {

  try {

    await fetch(
      `${API}/payments/cancel`,
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json",

          Authorization:
            `Bearer ${token}`
        },

        body:
          JSON.stringify({

            paymentId,

            checkout_ref

          })
      }
    );

  } catch (error) {

    console.error(
      "Cancel payment error:",
      error
    );

  }

}


/* =========================================================
   INCOMPLETE PAYMENT RECOVERY
========================================================= */

async function handleIncompletePayment(
  payment
) {

  if (
    !payment?.identifier ||
    !payment?.transaction?.txid ||
    !window.Pi
  ) {

    return;

  }


  try {

    console.log(
      "🔄 Recovering incomplete payment..."
    );


    /* Pi should already be initialized */

    const auth =
      await Pi.authenticate(
        [
          "username",
          "payments"
        ]
      );


    const login =
      await loginToBackend(
        auth.accessToken
      );


    await fetch(
      `${API}/payments/complete`,
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json",

          Authorization:
            `Bearer ${login.token}`
        },

        body:
          JSON.stringify({

            paymentId:
              payment.identifier,

            txid:
              payment.transaction.txid,

            accessToken:
              auth.accessToken

          })
      }
    );


    console.log(
      "✅ Incomplete payment recovery completed"
    );


  } catch (error) {

    console.error(
      "❌ Incomplete payment recovery failed:",
      error
    );

  }

}


/* =========================================================
   ESCAPE HTML
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


/* =========================================================
   START
========================================================= */

document.addEventListener(
  "DOMContentLoaded",
  () => {

    renderCheckout();


    const btn =
      document.getElementById(
        "payBtn"
      );


    if (btn) {

      btn.addEventListener(
        "click",
        payWithPi
      );

    }

  }
);