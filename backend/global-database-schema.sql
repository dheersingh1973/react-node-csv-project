-- =============================================================================
-- Global Database Schema (MySQL)
-- Default database: pos_poc_master
-- Used by Docker init and for manual setup.
-- =============================================================================

CREATE DATABASE IF NOT EXISTS pos_poc_master CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE pos_poc_master;

-- -----------------------------------------------------------------------------
-- 1. UserAccounts (central users; synced from local stores)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS UserAccounts (
  user_id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  mobile_number VARCHAR(20) NOT NULL,
  email VARCHAR(255) DEFAULT NULL,
  name VARCHAR(255) DEFAULT NULL,
  address TEXT DEFAULT NULL,
  created_at DATETIME DEFAULT NULL,
  TotalPoints INT DEFAULT 0,
  local_user_id INT DEFAULT NULL COMMENT 'Reference to local store user_id',
  last_sync_date DATETIME DEFAULT NULL,
  is_sync TINYINT(1) DEFAULT 1,
  store_id INT DEFAULT NULL,
  UNIQUE KEY uk_user_mobile_store (mobile_number, store_id),
  KEY idx_mobile (mobile_number),
  KEY idx_store (store_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 2. Grocery_Products (products; synced from local, keyed by sku_id + store_id)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS Grocery_Products (
  product_id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  sku_id VARCHAR(100) NOT NULL,
  store_id INT DEFAULT NULL,
  product VARCHAR(255) DEFAULT NULL,
  category VARCHAR(100) DEFAULT NULL,
  sub_category VARCHAR(100) DEFAULT NULL,
  brand VARCHAR(100) DEFAULT NULL,
  sale_price DECIMAL(12,2) DEFAULT NULL,
  market_price DECIMAL(12,2) DEFAULT NULL,
  quantity INT DEFAULT 0,
  master_category_id INT DEFAULT NULL COMMENT 'Maps to local category_id',
  type VARCHAR(50) DEFAULT NULL,
  rating DECIMAL(3,2) DEFAULT NULL,
  description TEXT DEFAULT NULL,
  is_sync TINYINT(1) DEFAULT 1,
  UNIQUE KEY uk_sku_store (sku_id, store_id),
  KEY idx_sku_store (sku_id, store_id),
  KEY idx_store (store_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 3. Orders (global orders; synced from local)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS Orders (
  order_id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  global_user_id INT NOT NULL,
  order_date DATETIME DEFAULT NULL,
  order_status VARCHAR(50) DEFAULT NULL,
  item_total_amount DECIMAL(12,2) DEFAULT NULL,
  shipping_address TEXT DEFAULT NULL,
  payment_method VARCHAR(50) DEFAULT NULL,
  payment_id VARCHAR(100) DEFAULT NULL,
  discount_amount DECIMAL(12,2) DEFAULT NULL,
  discount_code VARCHAR(50) DEFAULT NULL,
  discount_type VARCHAR(50) DEFAULT NULL,
  points_redeemed INT DEFAULT 0,
  points_discount DECIMAL(12,2) DEFAULT NULL,
  total_amount DECIMAL(12,2) DEFAULT NULL,
  cart_id INT DEFAULT NULL,
  local_order_id INT DEFAULT NULL,
  last_sync_date DATETIME DEFAULT NULL,
  is_sync TINYINT(1) DEFAULT 1,
  pos_id INT DEFAULT NULL,
  store_id INT DEFAULT NULL,
  KEY idx_global_user (global_user_id),
  KEY idx_store (store_id),
  KEY idx_local_order (local_order_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 4. OrderItems (global order line items)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS OrderItems (
  order_item_id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  global_order_id INT NOT NULL,
  master_product_id INT NOT NULL,
  sku_id VARCHAR(100) DEFAULT NULL,
  quantity INT DEFAULT 0,
  sale_price DECIMAL(12,2) DEFAULT NULL,
  adjusted_price DECIMAL(12,2) DEFAULT NULL,
  local_order_item_id INT DEFAULT NULL,
  local_order_id INT DEFAULT NULL,
  last_sync_date DATETIME DEFAULT NULL,
  is_sync TINYINT(1) DEFAULT 1,
  KEY idx_global_order (global_order_id),
  KEY idx_master_product (master_product_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 5. Points_Event (loyalty points; synced from local)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS Points_Event (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  master_user_id INT NOT NULL,
  activity_type_id INT DEFAULT NULL,
  master_order_id INT DEFAULT NULL,
  points INT DEFAULT 0,
  activity_desc VARCHAR(255) DEFAULT NULL,
  created_at DATETIME DEFAULT NULL,
  pos_id INT DEFAULT NULL,
  store_id INT DEFAULT NULL,
  is_sync TINYINT(1) DEFAULT 1,
  last_sync_date DATETIME DEFAULT NULL,
  master_balance_after INT DEFAULT NULL COMMENT 'Running balance after this event',
  KEY idx_master_user (master_user_id),
  KEY idx_master_order (master_order_id),
  KEY idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- Optional: audit_trail on GLOBAL (only if you choose to audit global changes there)
-- Currently audit_utils.js writes to LOCAL only.
-- -----------------------------------------------------------------------------
-- CREATE TABLE IF NOT EXISTS audit_trail (
--   id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
--   transaction_id VARCHAR(64) NOT NULL,
--   table_name VARCHAR(64) NOT NULL,
--   entity_id VARCHAR(64) DEFAULT NULL,
--   field_name VARCHAR(64) DEFAULT NULL,
--   old_value TEXT DEFAULT NULL,
--   new_value TEXT DEFAULT NULL,
--   action VARCHAR(16) NOT NULL,
--   changed_by VARCHAR(64) DEFAULT NULL,
--   created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
--   KEY idx_transaction (transaction_id),
--   KEY idx_table_entity (table_name, entity_id)
-- ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
