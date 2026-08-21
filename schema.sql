/* =========================================================
   CHARCOAL MARKETPLACE
========================================================= */


/* =========================================================
   0. SELECT RAILWAY DATABASE
========================================================= */

USE railway;


/* =========================================================
   1. REMOVE EXISTING TABLES
========================================================= */

SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS payment_logs;
DROP TABLE IF EXISTS earnings;
DROP TABLE IF EXISTS payments;
DROP TABLE IF EXISTS order_items;
DROP TABLE IF EXISTS orders;
DROP TABLE IF EXISTS cart;
DROP TABLE IF EXISTS products;
DROP TABLE IF EXISTS notifications;
DROP TABLE IF EXISTS admin_requests;
DROP TABLE IF EXISTS admin_invitations;
DROP TABLE IF EXISTS users;

SET FOREIGN_KEY_CHECKS = 1;


/* =========================================================
   2. USERS
========================================================= */

CREATE TABLE users (

    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,

    /* =====================================================
       BASIC IDENTITY
    ===================================================== */

    name VARCHAR(150) NOT NULL,

    email VARCHAR(255) NULL,


    /* =====================================================
       AUTHENTICATION
    ===================================================== */

    password_hash VARCHAR(255) NULL,


    /* =====================================================
       PI NETWORK IDENTITY
    ===================================================== */

    pi_uid VARCHAR(255) NULL,

    pi_username VARCHAR(100) NULL,


    /* =====================================================
       MAIN ACCOUNT ROLE
    ===================================================== */

    role ENUM(
        'buyer',
        'vendor',
        'admin'
    ) NOT NULL DEFAULT 'buyer',


    /* =====================================================
       ACCOUNT STATUS
    ===================================================== */

    status ENUM(
        'pending',
        'approved',
        'rejected',
        'suspended',
        'blocked'
    ) NOT NULL DEFAULT 'approved',


    /* =====================================================
       ADMIN HIERARCHY
    ===================================================== */

    admin_level ENUM(
        'none',
        'moderator',
        'admin',
        'super_admin'
    ) NOT NULL DEFAULT 'none',


    /* =====================================================
       VENDOR APPLICATION
    ===================================================== */

    vendor_status ENUM(
        'none',
        'pending',
        'approved',
        'rejected'
    ) NOT NULL DEFAULT 'none',

    business_name VARCHAR(255) NULL,

    business_phone VARCHAR(50) NULL,

    business_location VARCHAR(255) NULL,

    business_description TEXT NULL,

    vendor_applied_at DATETIME NULL,

    vendor_reviewed_at DATETIME NULL,

    vendor_reviewed_by BIGINT UNSIGNED NULL,

    vendor_rejection_reason VARCHAR(500) NULL,


    /* =====================================================
       PROFILE
    ===================================================== */

    phone VARCHAR(50) NULL,

    address TEXT NULL,

    city VARCHAR(100) NULL,

    state VARCHAR(100) NULL,

    country VARCHAR(100) NOT NULL DEFAULT 'Nigeria',

    profile_image VARCHAR(500) NULL,


    /* =====================================================
       ACCOUNT SECURITY
    ===================================================== */

    last_login_at DATETIME NULL,

    last_login_ip VARCHAR(100) NULL,


    /* =====================================================
       TIMESTAMPS
    ===================================================== */

    created_at TIMESTAMP NOT NULL
        DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMP NOT NULL
        DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,


    /* =====================================================
       PRIMARY KEY
    ===================================================== */

    PRIMARY KEY (id),


    /* =====================================================
       UNIQUE KEYS
    ===================================================== */

    UNIQUE KEY uq_users_email (email),

    UNIQUE KEY uq_users_pi_uid (pi_uid),

    UNIQUE KEY uq_users_pi_username (pi_username),


    /* =====================================================
       INDEXES
    ===================================================== */

    INDEX idx_users_role (role),

    INDEX idx_users_status (status),

    INDEX idx_users_admin_level (admin_level),

    INDEX idx_users_vendor_status (vendor_status),

    INDEX idx_users_vendor_reviewed_by (
        vendor_reviewed_by
    ),


    /* =====================================================
       VENDOR REVIEWER
    ===================================================== */

    CONSTRAINT fk_users_vendor_reviewer

        FOREIGN KEY (vendor_reviewed_by)

        REFERENCES users(id)

        ON DELETE SET NULL

        ON UPDATE CASCADE

) ENGINE=InnoDB
DEFAULT CHARSET=utf8mb4
COLLATE=utf8mb4_unicode_ci;



/* =========================================================
   3. PRODUCTS
========================================================= */

CREATE TABLE products (

    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,


    /* =====================================================
       VENDOR
    ===================================================== */

    vendor_id BIGINT UNSIGNED NOT NULL,


    /* =====================================================
       PRODUCT INFORMATION
    ===================================================== */

    name VARCHAR(255) NOT NULL,

    description TEXT NULL,

    category VARCHAR(100) NULL,

    product_type VARCHAR(100) NULL,


    /* =====================================================
       PRICING
    ===================================================== */

    price_pi DECIMAL(20,8) NOT NULL
        DEFAULT 0.00000000,

    price_ngn DECIMAL(20,2) NULL,


    /* =====================================================
       INVENTORY
    ===================================================== */

    stock INT NOT NULL DEFAULT 0,

    unit VARCHAR(50) NULL,


    /* =====================================================
       IMAGE
    ===================================================== */

    image VARCHAR(500) NULL,


    /* =====================================================
       ADMIN APPROVAL
    ===================================================== */

    status ENUM(
        'pending',
        'approved',
        'rejected',
        'suspended'
    ) NOT NULL DEFAULT 'pending',

    rejection_reason VARCHAR(500) NULL,

    approved_at DATETIME NULL,

    approved_by BIGINT UNSIGNED NULL,


    /* =====================================================
       VISIBILITY
    ===================================================== */

    is_active BOOLEAN NOT NULL DEFAULT TRUE,


    /* =====================================================
       SALES
    ===================================================== */

    total_sold INT NOT NULL DEFAULT 0,


    /* =====================================================
       TIMESTAMPS
    ===================================================== */

    created_at TIMESTAMP NOT NULL
        DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMP NOT NULL
        DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,


    PRIMARY KEY (id),


    /* =====================================================
       INDEXES
    ===================================================== */

    INDEX idx_products_vendor (vendor_id),

    INDEX idx_products_status (status),

    INDEX idx_products_category (category),

    INDEX idx_products_active (is_active),

    INDEX idx_products_created (created_at),

    INDEX idx_products_approved_by (approved_by),


    /* =====================================================
       VENDOR RELATIONSHIP
    ===================================================== */

    CONSTRAINT fk_products_vendor

        FOREIGN KEY (vendor_id)

        REFERENCES users(id)

        ON DELETE CASCADE

        ON UPDATE CASCADE,


    /* =====================================================
       PRODUCT APPROVER
    ===================================================== */

    CONSTRAINT fk_products_approved_by

        FOREIGN KEY (approved_by)

        REFERENCES users(id)

        ON DELETE SET NULL

        ON UPDATE CASCADE

) ENGINE=InnoDB
DEFAULT CHARSET=utf8mb4
COLLATE=utf8mb4_unicode_ci;



/* =========================================================
   4. CART
========================================================= */

CREATE TABLE cart (

    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,

    user_id BIGINT UNSIGNED NOT NULL,

    product_id BIGINT UNSIGNED NOT NULL,

    quantity INT NOT NULL DEFAULT 1,

    created_at TIMESTAMP NOT NULL
        DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMP NOT NULL
        DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,


    PRIMARY KEY (id),

    UNIQUE KEY uq_cart_user_product (
        user_id,
        product_id
    ),


    INDEX idx_cart_user (user_id),

    INDEX idx_cart_product (product_id),


    CONSTRAINT fk_cart_user

        FOREIGN KEY (user_id)

        REFERENCES users(id)

        ON DELETE CASCADE

        ON UPDATE CASCADE,


    CONSTRAINT fk_cart_product

        FOREIGN KEY (product_id)

        REFERENCES products(id)

        ON DELETE CASCADE

        ON UPDATE CASCADE

) ENGINE=InnoDB
DEFAULT CHARSET=utf8mb4
COLLATE=utf8mb4_unicode_ci;



/* =========================================================
   5. ORDERS
========================================================= */

CREATE TABLE orders (

    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,


    /* =====================================================
       BUYER
    ===================================================== */

    user_id BIGINT UNSIGNED NOT NULL,


    /* =====================================================
       VENDOR
    ===================================================== */

    vendor_id BIGINT UNSIGNED NULL,


    /* =====================================================
       CHECKOUT REFERENCE
    ===================================================== */

    checkout_ref VARCHAR(100) NOT NULL,


    /* =====================================================
       ORDER TOTAL
    ===================================================== */

    total_pi DECIMAL(20,8) NOT NULL
        DEFAULT 0.00000000,

    total_ngn DECIMAL(20,2) NULL,


    /* =====================================================
       PLATFORM FEE
    ===================================================== */

    platform_fee_pi DECIMAL(20,8) NOT NULL
        DEFAULT 0.00000000,

    vendor_amount_pi DECIMAL(20,8) NOT NULL
        DEFAULT 0.00000000,


    /* =====================================================
       ORDER STATUS
    ===================================================== */

    status ENUM(
        'pending',
        'paid',
        'processing',
        'shipped',
        'completed',
        'cancelled',
        'rejected',
        'refunded'
    ) NOT NULL DEFAULT 'pending',


    /* =====================================================
       PAYMENT STATUS
    ===================================================== */

    payment_status ENUM(
        'pending',
        'processing',
        'paid',
        'failed',
        'cancelled',
        'refunded'
    ) NOT NULL DEFAULT 'pending',


    /* =====================================================
       DELIVERY STATUS
    ===================================================== */

    delivery_status ENUM(
        'pending',
        'processing',
        'shipped',
        'delivered',
        'cancelled'
    ) NOT NULL DEFAULT 'pending',


    delivery_address TEXT NULL,

    delivery_phone VARCHAR(50) NULL,

    delivery_note TEXT NULL,


    /* =====================================================
       PI PAYMENT
    ===================================================== */

    pi_payment_id VARCHAR(255) NULL,

    pi_txid VARCHAR(255) NULL,


    /* =====================================================
       CANCELLATION / REFUND
    ===================================================== */

    cancellation_reason VARCHAR(500) NULL,

    refund_reason VARCHAR(500) NULL,


    /* =====================================================
       TIMESTAMPS
    ===================================================== */

    paid_at DATETIME NULL,

    shipped_at DATETIME NULL,

    completed_at DATETIME NULL,

    cancelled_at DATETIME NULL,

    refunded_at DATETIME NULL,

    created_at TIMESTAMP NOT NULL
        DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMP NOT NULL
        DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,


    PRIMARY KEY (id),


    UNIQUE KEY uq_orders_checkout_ref (
        checkout_ref
    ),


    INDEX idx_orders_user (user_id),

    INDEX idx_orders_vendor (vendor_id),

    INDEX idx_orders_status (status),

    INDEX idx_orders_payment_status (
        payment_status
    ),

    INDEX idx_orders_pi_payment (
        pi_payment_id
    ),

    INDEX idx_orders_pi_txid (
        pi_txid
    ),

    INDEX idx_orders_created (
        created_at
    ),


    CONSTRAINT fk_orders_user

        FOREIGN KEY (user_id)

        REFERENCES users(id)

        ON DELETE RESTRICT

        ON UPDATE CASCADE,


    CONSTRAINT fk_orders_vendor

        FOREIGN KEY (vendor_id)

        REFERENCES users(id)

        ON DELETE SET NULL

        ON UPDATE CASCADE

) ENGINE=InnoDB
DEFAULT CHARSET=utf8mb4
COLLATE=utf8mb4_unicode_ci;



/* =========================================================
   6. ORDER ITEMS
========================================================= */

CREATE TABLE order_items (

    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,

    order_id BIGINT UNSIGNED NOT NULL,

    product_id BIGINT UNSIGNED NULL,

    vendor_id BIGINT UNSIGNED NULL,


    /* =====================================================
       PRODUCT SNAPSHOT
    ===================================================== */

    product_name VARCHAR(255) NOT NULL,

    unit_price_pi DECIMAL(20,8) NOT NULL
        DEFAULT 0.00000000,

    quantity INT NOT NULL DEFAULT 1,

    subtotal_pi DECIMAL(20,8) NOT NULL
        DEFAULT 0.00000000,


    created_at TIMESTAMP NOT NULL
        DEFAULT CURRENT_TIMESTAMP,


    PRIMARY KEY (id),


    INDEX idx_order_items_order (
        order_id
    ),

    INDEX idx_order_items_product (
        product_id
    ),

    INDEX idx_order_items_vendor (
        vendor_id
    ),


    CONSTRAINT fk_order_items_order

        FOREIGN KEY (order_id)

        REFERENCES orders(id)

        ON DELETE CASCADE

        ON UPDATE CASCADE,


    CONSTRAINT fk_order_items_product

        FOREIGN KEY (product_id)

        REFERENCES products(id)

        ON DELETE SET NULL

        ON UPDATE CASCADE,


    CONSTRAINT fk_order_items_vendor

        FOREIGN KEY (vendor_id)

        REFERENCES users(id)

        ON DELETE SET NULL

        ON UPDATE CASCADE

) ENGINE=InnoDB
DEFAULT CHARSET=utf8mb4
COLLATE=utf8mb4_unicode_ci;



/* =========================================================
   7. PAYMENTS
========================================================= */

CREATE TABLE payments (

    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,


    /* =====================================================
       RELATIONSHIPS
    ===================================================== */

    order_id BIGINT UNSIGNED NOT NULL,

    user_id BIGINT UNSIGNED NOT NULL,


    /* =====================================================
       PI PAYMENT IDENTIFIERS
    ===================================================== */

    payment_id VARCHAR(255) NOT NULL,

    transaction_id VARCHAR(255) NULL,

    pi_uid VARCHAR(255) NULL,

    pi_username VARCHAR(100) NULL,


    /* =====================================================
       AMOUNT
    ===================================================== */

    amount_pi DECIMAL(20,8) NOT NULL
        DEFAULT 0.00000000,


    /* =====================================================
       PAYMENT STATUS
    ===================================================== */

    status ENUM(
        'created',
        'approved',
        'completed',
        'failed',
        'cancelled',
        'refunded'
    ) NOT NULL DEFAULT 'created',


    /* =====================================================
       BLOCKCHAIN INFORMATION
    ===================================================== */

    txid VARCHAR(255) NULL,

    to_address VARCHAR(255) NULL,

    from_address VARCHAR(255) NULL,

    memo VARCHAR(500) NULL,


    /* =====================================================
       RAW PI DATA
    ===================================================== */

    payment_data JSON NULL,

    approval_data JSON NULL,

    completion_data JSON NULL,


    /* =====================================================
       PAYMENT TIMESTAMPS
    ===================================================== */

    approved_at DATETIME NULL,

    completed_at DATETIME NULL,

    failed_at DATETIME NULL,

    created_at TIMESTAMP NOT NULL
        DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMP NOT NULL
        DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,


    PRIMARY KEY (id),


    UNIQUE KEY uq_payments_payment_id (
        payment_id
    ),


    INDEX idx_payments_order (
        order_id
    ),

    INDEX idx_payments_user (
        user_id
    ),

    INDEX idx_payments_status (
        status
    ),

    INDEX idx_payments_transaction (
        transaction_id
    ),

    INDEX idx_payments_txid (
        txid
    ),


    CONSTRAINT fk_payments_order

        FOREIGN KEY (order_id)

        REFERENCES orders(id)

        ON DELETE RESTRICT

        ON UPDATE CASCADE,


    CONSTRAINT fk_payments_user

        FOREIGN KEY (user_id)

        REFERENCES users(id)

        ON DELETE RESTRICT

        ON UPDATE CASCADE

) ENGINE=InnoDB
DEFAULT CHARSET=utf8mb4
COLLATE=utf8mb4_unicode_ci;



/* =========================================================
   8. PAYMENT LOGS
========================================================= */

CREATE TABLE payment_logs (

    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,

    payment_id BIGINT UNSIGNED NULL,

    order_id BIGINT UNSIGNED NULL,

    user_id BIGINT UNSIGNED NULL,


    event_type VARCHAR(100) NOT NULL,

    payment_status VARCHAR(100) NULL,

    pi_payment_id VARCHAR(255) NULL,

    txid VARCHAR(255) NULL,

    amount_pi DECIMAL(20,8) NULL,


    request_data JSON NULL,

    response_data JSON NULL,

    error_message TEXT NULL,


    created_at TIMESTAMP NOT NULL
        DEFAULT CURRENT_TIMESTAMP,


    PRIMARY KEY (id),


    INDEX idx_payment_logs_payment (
        payment_id
    ),

    INDEX idx_payment_logs_order (
        order_id
    ),

    INDEX idx_payment_logs_user (
        user_id
    ),

    INDEX idx_payment_logs_event (
        event_type
    ),

    INDEX idx_payment_logs_created (
        created_at
    ),


    CONSTRAINT fk_payment_logs_payment

        FOREIGN KEY (payment_id)

        REFERENCES payments(id)

        ON DELETE SET NULL

        ON UPDATE CASCADE,


    CONSTRAINT fk_payment_logs_order

        FOREIGN KEY (order_id)

        REFERENCES orders(id)

        ON DELETE SET NULL

        ON UPDATE CASCADE,


    CONSTRAINT fk_payment_logs_user

        FOREIGN KEY (user_id)

        REFERENCES users(id)

        ON DELETE SET NULL

        ON UPDATE CASCADE

) ENGINE=InnoDB
DEFAULT CHARSET=utf8mb4
COLLATE=utf8mb4_unicode_ci;



/* =========================================================
   9. EARNINGS
========================================================= */

CREATE TABLE earnings (

    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,


    user_id BIGINT UNSIGNED NOT NULL,

    order_id BIGINT UNSIGNED NULL,

    payment_id BIGINT UNSIGNED NULL,

    vendor_id BIGINT UNSIGNED NULL,


    /* =====================================================
       EARNING TYPE
    ===================================================== */

    type ENUM(
        'sale',
        'commission',
        'platform_fee',
        'refund',
        'withdrawal',
        'adjustment'
    ) NOT NULL,


    amount_pi DECIMAL(20,8) NOT NULL
        DEFAULT 0.00000000,


    /* =====================================================
       EARNING STATUS
    ===================================================== */

    status ENUM(
        'pending',
        'available',
        'paid',
        'cancelled'
    ) NOT NULL DEFAULT 'pending',


    description VARCHAR(500) NULL,


    created_at TIMESTAMP NOT NULL
        DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMP NOT NULL
        DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,


    PRIMARY KEY (id),


    INDEX idx_earnings_user (
        user_id
    ),

    INDEX idx_earnings_order (
        order_id
    ),

    INDEX idx_earnings_payment (
        payment_id
    ),

    INDEX idx_earnings_vendor (
        vendor_id
    ),

    INDEX idx_earnings_status (
        status
    ),

    INDEX idx_earnings_type (
        type
    ),


    CONSTRAINT fk_earnings_user

        FOREIGN KEY (user_id)

        REFERENCES users(id)

        ON DELETE RESTRICT

        ON UPDATE CASCADE,


    CONSTRAINT fk_earnings_order

        FOREIGN KEY (order_id)

        REFERENCES orders(id)

        ON DELETE SET NULL

        ON UPDATE CASCADE,


    CONSTRAINT fk_earnings_payment

        FOREIGN KEY (payment_id)

        REFERENCES payments(id)

        ON DELETE SET NULL

        ON UPDATE CASCADE,


    CONSTRAINT fk_earnings_vendor

        FOREIGN KEY (vendor_id)

        REFERENCES users(id)

        ON DELETE SET NULL

        ON UPDATE CASCADE

) ENGINE=InnoDB
DEFAULT CHARSET=utf8mb4
COLLATE=utf8mb4_unicode_ci;



/* =========================================================
   10. NOTIFICATIONS
========================================================= */

CREATE TABLE notifications (

    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,

    user_id BIGINT UNSIGNED NOT NULL,

    message TEXT NOT NULL,

    type VARCHAR(100) NOT NULL
        DEFAULT 'general',

    is_read BOOLEAN NOT NULL
        DEFAULT FALSE,

    created_at TIMESTAMP NOT NULL
        DEFAULT CURRENT_TIMESTAMP,


    PRIMARY KEY (id),


    INDEX idx_notifications_user (
        user_id
    ),

    INDEX idx_notifications_read (
        user_id,
        is_read
    ),

    INDEX idx_notifications_created (
        created_at
    ),


    CONSTRAINT fk_notifications_user

        FOREIGN KEY (user_id)

        REFERENCES users(id)

        ON DELETE CASCADE

        ON UPDATE CASCADE

) ENGINE=InnoDB
DEFAULT CHARSET=utf8mb4
COLLATE=utf8mb4_unicode_ci;



/* =========================================================
   11. ADMIN INVITATIONS
   IMPORTANT:
========================================================= */

CREATE TABLE admin_invitations (

    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,


    /* =====================================================
       PERSON BEING INVITED
    ===================================================== */

    invited_pi_uid VARCHAR(255) NOT NULL,

    invited_pi_username VARCHAR(100) NULL,


    /* =====================================================
       SUPER ADMIN WHO CREATED INVITATION
    ===================================================== */

    invited_by BIGINT UNSIGNED NOT NULL,


    /* =====================================================
       REQUESTED ADMIN ACCESS
    ===================================================== */

    admin_level ENUM(
        'admin',
        'moderator'
    ) NOT NULL,


    /* =====================================================
       INVITATION STATUS
    ===================================================== */

    status ENUM(
        'pending',
        'accepted',
        'expired',
        'revoked'
    ) NOT NULL DEFAULT 'pending',


    /* =====================================================
       INVITATION DATES
    ===================================================== */

    expires_at DATETIME NOT NULL,

    accepted_at DATETIME NULL,

    revoked_at DATETIME NULL,


    created_at TIMESTAMP NOT NULL
        DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMP NOT NULL
        DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,


    PRIMARY KEY (id),


    INDEX idx_admin_invites_pi_uid (
        invited_pi_uid
    ),

    INDEX idx_admin_invites_status (
        status
    ),

    INDEX idx_admin_invites_expires (
        expires_at
    ),

    INDEX idx_admin_invites_invited_by (
        invited_by
    ),

    INDEX idx_admin_invites_created (
        created_at
    ),


    CONSTRAINT fk_admin_invites_invited_by

        FOREIGN KEY (invited_by)

        REFERENCES users(id)

        ON DELETE RESTRICT

        ON UPDATE CASCADE

) ENGINE=InnoDB
DEFAULT CHARSET=utf8mb4
COLLATE=utf8mb4_unicode_ci;



/* =========================================================
   12. ADMIN REQUESTS
   Admin / Moderator Access Requests
========================================================= */

CREATE TABLE admin_requests (

    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,


    /* =====================================================
       USER REQUESTING ADMIN ACCESS
    ===================================================== */

    requested_by BIGINT UNSIGNED NOT NULL,


    /* =====================================================
       PI IDENTITY
    ===================================================== */

    pi_username VARCHAR(100) NULL,

    pi_uid VARCHAR(255) NOT NULL,


    /* =====================================================
       REQUESTED ADMIN LEVEL
    ===================================================== */

    admin_level ENUM(
        'admin',
        'moderator'
    ) NOT NULL,


    /* =====================================================
       REQUEST STATUS
    ===================================================== */

    status ENUM(
        'pending',
        'approved',
        'rejected',
        'cancelled'
    ) NOT NULL DEFAULT 'pending',


    /* =====================================================
       INVITATION RELATIONSHIP
    ===================================================== */

    invitation_id BIGINT UNSIGNED NULL,


    /* =====================================================
       SUPER ADMIN WHO PROCESSED REQUEST
    ===================================================== */

    approved_by BIGINT UNSIGNED NULL,

    approved_at DATETIME NULL,


    /* =====================================================
       TIMESTAMPS
    ===================================================== */

    created_at TIMESTAMP NOT NULL
        DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMP NOT NULL
        DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,


    PRIMARY KEY (id),


    INDEX idx_admin_requests_user (
        requested_by
    ),

    INDEX idx_admin_requests_pi_uid (
        pi_uid
    ),

    INDEX idx_admin_requests_status (
        status
    ),

    INDEX idx_admin_requests_invitation (
        invitation_id
    ),

    INDEX idx_admin_requests_approved_by (
        approved_by
    ),

    INDEX idx_admin_requests_created (
        created_at
    ),


    /* =====================================================
       REQUESTING USER
    ===================================================== */

    CONSTRAINT fk_admin_requests_user

        FOREIGN KEY (requested_by)

        REFERENCES users(id)

        ON DELETE CASCADE

        ON UPDATE CASCADE,


    /* =====================================================
       SUPER ADMIN APPROVER
    ===================================================== */

    CONSTRAINT fk_admin_requests_approved_by

        FOREIGN KEY (approved_by)

        REFERENCES users(id)

        ON DELETE SET NULL

        ON UPDATE CASCADE,


    /* =====================================================
       INVITATION
       Created directly here.
       NO ALTER TABLE required.
    ===================================================== */

    CONSTRAINT fk_admin_requests_invitation

        FOREIGN KEY (invitation_id)

        REFERENCES admin_invitations(id)

        ON DELETE SET NULL

        ON UPDATE CASCADE

) ENGINE=InnoDB
DEFAULT CHARSET=utf8mb4
COLLATE=utf8mb4_unicode_ci;



/* =========================================================
   13. OPTIONAL INITIAL SUPER ADMIN
========================================================= */

/*=========================================================
   14. VERIFY DATABASE
========================================================= */

SELECT DATABASE();


/* =========================================================
   15. VERIFY ALL TABLES
========================================================= */

SHOW TABLES;


/* =========================================================
   16. VERIFY USERS
========================================================= */

DESCRIBE users;


/* =========================================================
   17. VERIFY PRODUCTS
========================================================= */

DESCRIBE products;


/* =========================================================
   18. VERIFY CART
========================================================= */

DESCRIBE cart;


/* =========================================================
   19. VERIFY ORDERS
========================================================= */

DESCRIBE orders;


/* =========================================================
   20. VERIFY ORDER ITEMS
========================================================= */

DESCRIBE order_items;


/* =========================================================
   21. VERIFY PAYMENTS
========================================================= */

DESCRIBE payments;


/* =========================================================
   22. VERIFY PAYMENT LOGS
========================================================= */

DESCRIBE payment_logs;


/* =========================================================
   23. VERIFY EARNINGS
========================================================= */

DESCRIBE earnings;


/* =========================================================
   24. VERIFY NOTIFICATIONS
========================================================= */

DESCRIBE notifications;


/* =========================================================
   25. VERIFY ADMIN INVITATIONS
========================================================= */

DESCRIBE admin_invitations;


/* =========================================================
   26. VERIFY ADMIN REQUESTS
========================================================= */

DESCRIBE admin_requests;


/* =========================================================
   END OF SCHEMA
========================================================= */