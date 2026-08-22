require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const compression = require("compression");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const path = require("path");

const db = require("./config/db");

const app = express();
const PORT = Number(process.env.PORT || 8080);

app.set("trust proxy", 1);


/* =========================================================
   APPLICATION INFORMATION
========================================================= */

const APP_NAME = "Charcoal Marketplace API";

const configuredOrigins = (process.env.FRONTEND_ORIGINS || "")
  .split(",")
  .map(s => s.trim())
  .filter(Boolean);


/* =========================================================
   DIAGNOSTIC STATE
========================================================= */

const routeStatus = {};

const requiredTables = [
  "users",
  "products",
  "orders",
  "payments",
  "payment_logs",
  "cart",
  "earnings",
  "notifications",
  "admin_requests",
  "admin_invitations"
];

let databaseStatus = "checking";


/* =========================================================
   STARTUP LOGGER
========================================================= */

function startupLine() {
  console.log(
    "=================================================="
  );
}


/* =========================================================
   ROUTE LOADER
   This makes route problems visible in Railway logs.
========================================================= */

function loadRoute(routeName, mountPath, routeFile) {

  try {

    const router = require(routeFile);

    if (!router) {
      throw new Error("Router returned empty value");
    }

    app.use(mountPath, router);

    routeStatus[routeName] = {
      status: "loaded",
      mount: mountPath,
      file: routeFile
    };

    console.log(
      `✅ ${mountPath} → ${routeFile} LOADED`
    );

    return true;

  } catch (error) {

    routeStatus[routeName] = {
      status: "failed",
      mount: mountPath,
      file: routeFile,
      error: error.message
    };

    console.error(
      `❌ ${mountPath} → ${routeFile} FAILED`
    );

    console.error(
      `   ERROR: ${error.message}`
    );

    return false;
  }
}


/* =========================================================
   CORS
========================================================= */

app.use(
  cors({

    origin: (origin, callback) => {

      if (!origin) {
        return callback(null, true);
      }

      if (!configuredOrigins.length) {
        return callback(null, true);
      }

      if (configuredOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(
        new Error("CORS origin not allowed")
      );

    },

    methods: [
      "GET",
      "POST",
      "PUT",
      "PATCH",
      "DELETE",
      "OPTIONS"
    ],

    allowedHeaders: [
      "Content-Type",
      "Authorization"
    ],

    credentials: false

  })
);


/* =========================================================
   SECURITY / PERFORMANCE
========================================================= */

app.use(
  helmet({
    crossOriginResourcePolicy: {
      policy: "cross-origin"
    },

    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],

        scriptSrc: [
          "'self'",
          "https://sdk.minepi.com"
        ],

        scriptSrcAttr: [
          "'unsafe-inline'"
        ],

        styleSrc: [
          "'self'",
          "'unsafe-inline'"
        ],

        imgSrc: [
          "'self'",
          "data:",
          "blob:",
          "https:"
        ],

        connectSrc: [
          "'self'",
          "https:"
        ],

        fontSrc: [
          "'self'",
          "https:",
          "data:"
        ],

        objectSrc: ["'none'"],

        frameAncestors: ["'none'"]
      }
    }
  })
);

app.use(compression());

app.use(
  morgan(
    process.env.NODE_ENV === "production"
      ? "combined"
      : "dev"
  )
);

app.use(
  express.json({
    limit: "2mb"
  })
);

app.use(
  express.urlencoded({
    extended: true,
    limit: "2mb"
  })
);


/* =========================================================
   AUTH RATE LIMIT
========================================================= */

const authLimiter = rateLimit({

  windowMs: 15 * 60 * 1000,

  max: 100,

  standardHeaders: true,

  legacyHeaders: false

});

app.use(
  "/api/auth",
  authLimiter
);

/* =========================================================
   BASIC ROOT ENDPOINT
========================================================= */

app.use(express.static(__dirname));

app.get("/", (req, res) => {
  res.sendFile(
    path.join(__dirname, "index.html")
  );
});


/* =========================================================
   BASIC HEALTH ENDPOINT
========================================================= */

app.get("/health", (req, res) => {

  res.json({

    success: true,

    status: "healthy",

    service: APP_NAME,

    timestamp:
      new Date().toISOString()

  });

});


/* =========================================================
   API HEALTH CHECK
   GET /api/health
========================================================= */

app.get("/api/health", async (req, res) => {

  let database = "disconnected";

  try {

    await new Promise((resolve, reject) => {

      db.query(
        "SELECT 1 AS connected",
        (err, rows) => {

          if (err) {
            return reject(err);
          }

          resolve(rows);

        }
      );

    });

    database = "connected";

  } catch (error) {

    database = "disconnected";

  }


  const failedRoutes =
    Object.entries(routeStatus)
      .filter(
        ([, value]) =>
          value.status !== "loaded"
      );


  const failedRouteCount =
    failedRoutes.length;


  const overallHealthy =
    database === "connected" &&
    failedRouteCount === 0;


  res.status(
    overallHealthy ? 200 : 503
  ).json({

    success: overallHealthy,

    status:
      overallHealthy
        ? "healthy"
        : "degraded",

    service: APP_NAME,

    environment:
      process.env.NODE_ENV || "development",

    database,

    routes: {

      total:
        Object.keys(routeStatus).length,

      loaded:
        Object.values(routeStatus)
          .filter(
            route =>
              route.status === "loaded"
          ).length,

      failed:
        failedRouteCount

    },

    pi: {

      api_key:
        process.env.PI_API_KEY
          ? "configured"
          : "missing",

      super_admin:
        process.env.PI_SUPER_ADMIN_USERNAME
          ? "configured"
          : "missing"

    },

    cors: {

      configured:
        configuredOrigins.length > 0,

      origins:
        configuredOrigins.length

    },

    timestamp:
      new Date().toISOString()

  });

});


/* =========================================================
   ROUTE STATUS
   GET /api/health/routes
========================================================= */

app.get(
  "/api/health/routes",
  (req, res) => {

    const routes =
      Object.entries(routeStatus)
        .map(([name, info]) => ({

          name,

          status:
            info.status,

          mount:
            info.mount,

          file:
            info.file,

          ...(info.error
            ? {
                error:
                  info.error
              }
            : {})

        }));


    const failed =
      routes.filter(
        route =>
          route.status !== "loaded"
      );


    res.status(
      failed.length ? 503 : 200
    ).json({

      success:
        failed.length === 0,

      total:
        routes.length,

      loaded:
        routes.filter(
          route =>
            route.status === "loaded"
        ).length,

      failed:
        failed.length,

      routes

    });

  }
);


/* =========================================================
   DATABASE TABLE CHECK
   GET /api/health/database
========================================================= */

app.get(
  "/api/health/database",
  async (req, res) => {

    const tables = {};

    let failedCount = 0;


    for (const table of requiredTables) {

      try {

        await new Promise(
          (resolve, reject) => {

            db.query(
              `SELECT 1 FROM \`${table}\` LIMIT 1`,
              (err) => {

                if (err) {
                  return reject(err);
                }

                resolve();

              }
            );

          }
        );


        tables[table] = {
          status: "OK"
        };


      } catch (error) {

        failedCount++;

        tables[table] = {

          status:
            "MISSING_OR_ERROR",

          error:
            error.message

        };

      }

    }


    const success =
      failedCount === 0;


    res.status(
      success ? 200 : 503
    ).json({

      success,

      database:
        success
          ? "READY"
          : "NOT READY",

      total:
        requiredTables.length,

      working:
        requiredTables.length -
        failedCount,

      failed:
        failedCount,

      tables

    });

  }
);


/* =========================================================
   LOAD API ROUTES
========================================================= */

console.log("");
startupLine();

console.log(
  "🔌 LOADING API ROUTES"
);

startupLine();


/*
=========================================================
AUTH
=========================================================
*/

loadRoute(
  "auth",
  "/api/auth",
  "./routes/auth.routes"
);


/*
=========================================================
PRODUCTS
=========================================================
*/

loadRoute(
  "products",
  "/api/products",
  "./routes/product.routes"
);


/*
=========================================================
ORDERS
=========================================================
*/

loadRoute(
  "orders",
  "/api/orders",
  "./routes/orders.routes"
);


/*
=========================================================
PAYMENTS
=========================================================
*/

loadRoute(
  "payments",
  "/api/payments",
  "./routes/payment.routes"
);


/*
=========================================================
ADMIN
=========================================================
*/

loadRoute(
  "admin",
  "/api/admin",
  "./routes/admin.routes"
);


/*
=========================================================
ADMIN REQUEST
=========================================================
*/

loadRoute(
  "admin-request",
  "/api/admin-request",
  "./routes/adminRequest.routes"
);


/*
=========================================================
NOTIFICATIONS
=========================================================
*/

loadRoute(
  "notifications",
  "/api/notifications",
  "./routes/notifications.routes"
);


startupLine();

console.log(
  "🔌 ROUTE LOADING FINISHED"
);

startupLine();

console.log("");


/* =========================================================
   STATIC UPLOADS
========================================================= */

app.use(
  "/uploads",
  express.static(
    path.join(__dirname, "uploads"),
    {
      maxAge: "7d",
      index: false
    }
  )
);


/* =========================================================
   404 HANDLER
========================================================= */

app.use(
  (req, res) => {

    res.status(404).json({

      success: false,

      message:
        "Route not found",

      path:
        req.originalUrl,

      method:
        req.method

    });

  }
);


/* =========================================================
   GLOBAL ERROR HANDLER
========================================================= */

app.use(
  (err, req, res, next) => {

    console.error(
      "=================================================="
    );

    console.error(
      "❌ SERVER ERROR"
    );

    console.error(
      "=================================================="
    );

    console.error(
      "Message:",
      err.message
    );

    console.error(
      "Path:",
      req.originalUrl
    );

    console.error(
      "Method:",
      req.method
    );

    console.error(
      "=================================================="
    );


    if (
      err.message ===
      "CORS origin not allowed"
    ) {

      return res.status(403).json({

        success: false,

        message:
          "Origin not allowed"

      });

    }


    return res.status(500).json({

      success: false,

      message:
        "Internal server error"

    });

  }
);


/* =========================================================
   DATABASE CONNECTION CHECK
========================================================= */

db.query(
  "SELECT 1 AS connected",
  (err) => {

    if (err) {

      databaseStatus =
        "disconnected";

      console.error("");
      startupLine();

      console.error(
        "❌ MYSQL CONNECTION FAILED"
      );

      console.error(
        err.message
      );

      startupLine();

    } else {

      databaseStatus =
        "connected";

      console.log("");
      startupLine();

      console.log(
        "✅ MYSQL CONNECTED SUCCESSFULLY"
      );

      startupLine();

    }

  }
);


/* =========================================================
   SERVER START
========================================================= */

app.listen(
  PORT,
  () => {

    console.log("");

    startupLine();

    console.log(
      "🚀 CHARCOAL MARKETPLACE API"
    );

    startupLine();

    console.log(
      `✅ Server running on port ${PORT}`
    );

    console.log(
      `🌐 Environment: ${
        process.env.NODE_ENV ||
        "development"
      }`
    );

    console.log("");

    console.log(
      "🗄️ DATABASE"
    );

    console.log(
      "--------------------------------------"
    );

    console.log(
      `Database status: ${databaseStatus}`
    );

    console.log("");

    console.log(
      "🔐 AUTHENTICATION"
    );

    console.log(
      "--------------------------------------"
    );

    console.log(
      routeStatus.auth?.status === "loaded"
        ? "✅ Auth routes ready"
        : "❌ Auth routes FAILED"
    );

    console.log(
      "✅ JWT authentication available"
    );

    console.log("");

    console.log(
      "💰 PI PAYMENT"
    );

    console.log(
      "--------------------------------------"
    );

    console.log(
      process.env.PI_API_KEY
        ? "✅ PI_API_KEY configured"
        : "⚠️ PI_API_KEY missing"
    );

    console.log("");

    console.log(
      "👑 SUPER ADMIN"
    );

    console.log(
      "--------------------------------------"
    );

    console.log(
      process.env.PI_SUPER_ADMIN_USERNAME
        ? "✅ PI_SUPER_ADMIN_USERNAME configured"
        : "⚠️ PI_SUPER_ADMIN_USERNAME missing"
    );

    console.log("");

    console.log(
      "🌐 CORS"
    );

    console.log(
      "--------------------------------------"
    );

    if (configuredOrigins.length) {

      console.log(
        "✅ FRONTEND_ORIGINS configured"
      );

      console.log(
        `   Allowed origins: ${
          configuredOrigins.join(", ")
        }`
      );

    } else {

      console.warn(
        "⚠️ FRONTEND_ORIGINS is not configured; CORS is OPEN."
      );

    }

    console.log("");

    console.log(
      "🔍 DIAGNOSTIC ENDPOINTS"
    );

    console.log(
      "--------------------------------------"
    );

    console.log(
      "GET /api/health"
    );

    console.log(
      "GET /api/health/routes"
    );

    console.log(
      "GET /api/health/database"
    );

    console.log("");

    startupLine();

    console.log(
      "🟢 SERVER STARTUP COMPLETE"
    );

    startupLine();

    console.log("");

  }
);