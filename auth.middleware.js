const jwt = require("jsonwebtoken");
const db = require("../config/db");

const SECRET = process.env.JWT_SECRET;

if (!SECRET) {
  throw new Error("JWT_SECRET is required");
}


/* =========================================================
   VERIFY JWT + LOAD USER
========================================================= */

function verifyToken(allowedRoles = null) {

  return (req, res, next) => {

    const requestId =
      req.headers["x-request-id"] ||
      `auth-${Date.now()}`;

    const header =
      req.headers.authorization || "";


    console.log(
      `[AUTH] ${requestId} ${req.method} ${req.originalUrl}`
    );


    /* -----------------------------------------------------
       CHECK AUTH HEADER
    ----------------------------------------------------- */

    if (!header.startsWith("Bearer ")) {

      console.warn(
        `[AUTH] ${requestId} Missing Bearer token`
      );

      return res.status(401).json({

        success: false,

        code: "AUTH_TOKEN_MISSING",

        message:
          "Authentication required"

      });

    }


    const token =
      header.slice(7).trim();


    if (!token) {

      console.warn(
        `[AUTH] ${requestId} Empty token`
      );

      return res.status(401).json({

        success: false,

        code: "AUTH_TOKEN_EMPTY",

        message:
          "Authentication token is empty"

      });

    }


    /* -----------------------------------------------------
       VERIFY JWT
    ----------------------------------------------------- */

    let decoded;

    try {

      decoded =
        jwt.verify(
          token,
          SECRET
        );

    } catch (error) {

      console.error(
        `[AUTH] ${requestId} JWT verification failed:`,
        error.message
      );

      return res.status(401).json({

        success: false,

        code: "AUTH_TOKEN_INVALID",

        message:
          error.name === "TokenExpiredError"
            ? "Authentication token expired"
            : "Invalid authentication token"

      });

    }


    if (
      !decoded ||
      !decoded.id
    ) {

      console.warn(
        `[AUTH] ${requestId} JWT has no user ID`
      );

      return res.status(401).json({

        success: false,

        code: "AUTH_TOKEN_INVALID",

        message:
          "Invalid authentication token"

      });

    }


    console.log(
      `[AUTH] ${requestId} JWT verified for user ID ${decoded.id}`
    );


    /* -----------------------------------------------------
       LOAD CURRENT USER FROM DATABASE
    ----------------------------------------------------- */

    db.query(
      `
      SELECT
        id,
        name,
        email,
        role,
        status,
        pi_uid,
        pi_username,
        admin_level,
        vendor_status,
        business_name,
        business_phone,
        business_location,
        business_description,
        created_at
      FROM users
      WHERE id = ?
      LIMIT 1
      `,

      [decoded.id],

      (err, rows) => {

        if (err) {

          console.error(
            `[AUTH] ${requestId} Database error:`,
            err
          );

          return res.status(500).json({

            success: false,

            code:
              "AUTH_DATABASE_ERROR",

            message:
              "Authentication service error"

          });

        }


        if (!rows.length) {

          console.warn(
            `[AUTH] ${requestId} User ${decoded.id} does not exist`
          );

          return res.status(401).json({

            success: false,

            code:
              "AUTH_USER_NOT_FOUND",

            message:
              "Account no longer exists"

          });

        }


        const user =
          rows[0];


        console.log(
          `[AUTH] ${requestId} User found:`,
          {
            id: user.id,
            role: user.role,
            status: user.status,
            admin_level: user.admin_level,
            vendor_status: user.vendor_status
          }
        );


        /* -------------------------------------------------
           ACCOUNT STATUS
        ------------------------------------------------- */

        if (
          user.status !== "approved"
        ) {

          console.warn(
            `[AUTH] ${requestId} Account not approved`
          );

          return res.status(403).json({

            success: false,

            code:
              "ACCOUNT_NOT_APPROVED",

            message:
              "Account is not approved"

          });

        }


        /* -------------------------------------------------
           ROLE CHECK
        ------------------------------------------------- */

        if (
          allowedRoles &&
          !allowedRoles.includes(
            user.role
          )
        ) {

          console.warn(
            `[AUTH] ${requestId} Role denied. Required:`,
            allowedRoles,
            "Actual:",
            user.role
          );

          return res.status(403).json({

            success: false,

            code:
              "ROLE_ACCESS_DENIED",

            message:
              "Access denied"

          });

        }


        /* -------------------------------------------------
           NORMALIZE ADMIN LEVEL
        ------------------------------------------------- */

        user.admin_level =
          user.role === "admin"
            ? (
                user.admin_level ||
                "admin"
              )
            : "none";


        /* -------------------------------------------------
           NORMALIZE VENDOR STATUS
        ------------------------------------------------- */

        user.vendor_status =
          user.role === "vendor"
            ? (
                user.vendor_status ||
                "pending"
              )
            : null;


        req.user =
          user;


        console.log(
          `[AUTH] ${requestId} Authentication successful`
        );


        next();

      }
    );

  };

}


/* =========================================================
   ADMIN
========================================================= */

function verifyAdmin(
  req,
  res,
  next
) {

  return verifyToken(
    ["admin"]
  )(
    req,
    res,
    next
  );

}


/* =========================================================
   SUPER ADMIN
========================================================= */

function verifySuperAdmin(
  req,
  res,
  next
) {

  return verifyToken(
    ["admin"]
  )(
    req,
    res,
    () => {

      if (
        req.user.admin_level !==
        "super_admin"
      ) {

        console.warn(
          `[AUTH] Super Admin access denied for user ${req.user.id}`
        );

        return res.status(403).json({

          success: false,

          code:
            "SUPER_ADMIN_REQUIRED",

          message:
            "Super Admin access required"

        });

      }


      next();

    }
  );

}


/* =========================================================
   VENDOR
========================================================= */

function verifyVendor(
  req,
  res,
  next
) {

  return verifyToken(
    ["vendor"]
  )(
    req,
    res,
    () => {

      if (
        req.user.vendor_status !==
        "approved"
      ) {

        console.warn(
          `[AUTH] Vendor access denied for user ${req.user.id}`
        );

        return res.status(403).json({

          success: false,

          code:
            "VENDOR_NOT_APPROVED",

          message:
            "Vendor account is not approved"

        });

      }


      next();

    }
  );

}


module.exports = {

  verifyToken,

  verifyAdmin,

  verifySuperAdmin,

  verifyVendor

};