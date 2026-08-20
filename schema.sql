/* =========================================================
   CHARCOAL MARKETPLACE
   RAILWAY MYSQL - SAFE NON-DESTRUCTIVE UPGRADE
   =========================================================
   IMPORTANT:
   1. BACK UP THE RAILWAY DATABASE FIRST.
   2. This script does NOT DROP data.
   3. It creates missing tables and conditionally adds
      the new columns required by the repaired backend.
========================================================= */

SET FOREIGN_KEY_CHECKS=0;

/* ---------------------------------------------------------
   BASE TABLES
   --------------------------------------------------------- */

CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    role ENUM('buyer','vendor','admin') NOT NULL DEFAULT 'buyer',
    status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'approved',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS products (
    id INT AUTO_INCREMENT PRIMARY KEY,
    vendor_id INT NOT NULL,
    name VARCHAR(150) NOT NULL,
    description TEXT,
    price_pi DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    location VARCHAR(120),
    stock INT NOT NULL DEFAULT 0,
    image VARCHAR(255),
    status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
    added_by ENUM('vendor','admin') NOT NULL DEFAULT 'vendor',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS orders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    buyer_id INT NOT NULL,
    product_id INT NOT NULL,
    quantity INT NOT NULL DEFAULT 1,
    total_pi DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    payment_id VARCHAR(100) NULL,
    status ENUM('pending','paid','shipped','completed','cancelled') NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS payments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_id INT NOT NULL,
    payment_id VARCHAR(100) UNIQUE,
    txid VARCHAR(100),
    amount_pi DECIMAL(10,2),
    status ENUM('pending','approved','completed','failed') NOT NULL DEFAULT 'pending',
    raw_data JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS payment_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    payment_id VARCHAR(100),
    user_id INT NULL,
    amount_pi DECIMAL(10,2),
    status ENUM('created','approved','completed','failed'),
    txid VARCHAR(100),
    raw_data JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS cart (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    product_id INT NOT NULL,
    quantity INT NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS earnings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    vendor_id INT NOT NULL,
    order_id INT NOT NULL,
    amount_pi DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    platform_fee DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    net_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    status ENUM('pending','paid') NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS notifications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    message TEXT,
    type VARCHAR(50),
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS admin_requests (
    id INT AUTO_INCREMENT PRIMARY KEY,
    requested_by INT NOT NULL,
    pi_username VARCHAR(100) NULL,
    pi_uid VARCHAR(100) NULL,
    admin_level ENUM('admin','moderator') NOT NULL DEFAULT 'admin',
    status ENUM('pending','approved','rejected','cancelled') NOT NULL DEFAULT 'pending',
    approved_by INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    approved_at DATETIME NULL,
    invitation_id INT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS admin_invitations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    invited_pi_uid VARCHAR(255) NOT NULL,
    invited_pi_username VARCHAR(255) NULL,
    invited_by INT NOT NULL,
    admin_level ENUM('admin','moderator') NOT NULL DEFAULT 'admin',
    status ENUM('pending','accepted','expired','revoked') NOT NULL DEFAULT 'pending',
    expires_at DATETIME NOT NULL,
    accepted_at DATETIME NULL,
    revoked_at DATETIME NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

/* ---------------------------------------------------------
   CONDITIONAL COLUMN HELPER
   MySQL-compatible way to add a column only when missing.
--------------------------------------------------------- */

DROP PROCEDURE IF EXISTS add_column_if_missing;

DELIMITER $$

CREATE PROCEDURE add_column_if_missing(
    IN p_table VARCHAR(64),
    IN p_column VARCHAR(64),
    IN p_definition TEXT
)
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = p_table
          AND COLUMN_NAME = p_column
    ) THEN
        SET @sql_text = CONCAT(
            'ALTER TABLE `', p_table,
            '` ADD COLUMN `', p_column, '` ',
            p_definition
        );
        PREPARE stmt FROM @sql_text;
        EXECUTE stmt;
        DEALLOCATE PREPARE stmt;
    END IF;
END$$

DELIMITER ;

/* ---------------- USERS ---------------- */

CALL add_column_if_missing('users','pi_uid',
    'VARCHAR(100) NULL');

CALL add_column_if_missing('users','pi_username',
    'VARCHAR(100) NULL');

CALL add_column_if_missing('users','admin_level',
    "ENUM('none','super_admin','admin','moderator') NULL DEFAULT 'none'");

CALL add_column_if_missing('users','vendor_status',
    "ENUM('none','pending','approved','rejected') NOT NULL DEFAULT 'none'");

CALL add_column_if_missing('users','business_name',
    'VARCHAR(150) NULL');

CALL add_column_if_missing('users','business_phone',
    'VARCHAR(50) NULL');

CALL add_column_if_missing('users','business_location',
    'VARCHAR(150) NULL');

CALL add_column_if_missing('users','business_description',
    'TEXT NULL');

CALL add_column_if_missing('users','vendor_applied_at',
    'DATETIME NULL');

CALL add_column_if_missing('users','vendor_reviewed_at',
    'DATETIME NULL');

CALL add_column_if_missing('users','vendor_reviewed_by',
    'INT NULL');

CALL add_column_if_missing('users','vendor_rejection_reason',
    'VARCHAR(500) NULL');

/* ---------------- ORDERS ---------------- */

CALL add_column_if_missing('orders','checkout_ref',
    'VARCHAR(80) NULL');

CALL add_column_if_missing('orders','stock_reserved',
    'TINYINT(1) NOT NULL DEFAULT 0');

/* Remove helper */
DROP PROCEDURE IF EXISTS add_column_if_missing;

/* ---------------------------------------------------------
   EXISTING DATA NORMALIZATION
--------------------------------------------------------- */

UPDATE users
SET admin_level='admin'
WHERE role='admin'
  AND (admin_level IS NULL OR admin_level='none');

UPDATE users
SET vendor_status=CASE
    WHEN status='approved' THEN 'approved'
    WHEN status='pending' THEN 'pending'
    WHEN status='rejected' THEN 'rejected'
    ELSE vendor_status
END
WHERE role='vendor'
  AND (vendor_status IS NULL OR vendor_status='none');

/* Expire old invitations */
UPDATE admin_invitations
SET status='expired'
WHERE status='pending'
  AND expires_at<=NOW();

/* ---------------------------------------------------------
   OPTIONAL PERFORMANCE INDEXES
   These are new names used by the repaired application.
   If your Railway database already has them under another
   name, do not duplicate them.
--------------------------------------------------------- */

SET FOREIGN_KEY_CHECKS=1;

/* ---------------------------------------------------------
   VERIFICATION
--------------------------------------------------------- */

DESCRIBE users;
DESCRIBE orders;
DESCRIBE payments;
DESCRIBE admin_requests;
DESCRIBE admin_invitations;

SELECT
    id,
    name,
    role,
    status,
    pi_uid,
    pi_username,
    admin_level,
    vendor_status,
    business_name
FROM users
ORDER BY id;

SELECT
    id,
    order_id,
    payment_id,
    txid,
    amount_pi,
    status,
    created_at
FROM payments
ORDER BY id DESC;

SELECT
    id,
    checkout_ref,
    buyer_id,
    product_id,
    quantity,
    total_pi,
    payment_id,
    status,
    stock_reserved
FROM orders
ORDER BY id DESC;
