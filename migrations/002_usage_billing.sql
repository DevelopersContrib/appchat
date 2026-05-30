USE appchat;

-- Usage tracking per tenant per month
CREATE TABLE usage_records (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  tenant_id INT NOT NULL,
  period VARCHAR(7) NOT NULL,
  room_minutes INT DEFAULT 0,
  ai_agent_minutes INT DEFAULT 0,
  messages_sent INT DEFAULT 0,
  storage_bytes BIGINT DEFAULT 0,
  recordings_count INT DEFAULT 0,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY idx_tenant_period (tenant_id, period),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Billing plans
CREATE TABLE plans (
  id INT AUTO_INCREMENT PRIMARY KEY,
  slug VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  price_cents INT DEFAULT 0,
  billing_cycle ENUM('monthly','yearly') DEFAULT 'monthly',
  included_room_minutes INT DEFAULT 0,
  included_ai_minutes INT DEFAULT 0,
  included_messages INT DEFAULT 0,
  included_storage_gb INT DEFAULT 1,
  overage_room_minute_cents INT DEFAULT 0,
  overage_ai_minute_cents INT DEFAULT 0,
  max_members INT DEFAULT 0,
  max_channels INT DEFAULT 0,
  custom_domain TINYINT(1) DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Tenant subscription
ALTER TABLE tenants
  ADD COLUMN plan_id INT DEFAULT 1 AFTER settings,
  ADD COLUMN trial_ends_at DATETIME DEFAULT NULL AFTER plan_id,
  ADD COLUMN billing_email VARCHAR(255) DEFAULT NULL AFTER trial_ends_at;

-- Seed plans
INSERT INTO plans (slug, name, price_cents, included_room_minutes, included_ai_minutes, included_messages, included_storage_gb, overage_room_minute_cents, overage_ai_minute_cents, max_members, max_channels, custom_domain) VALUES
  ('starter', 'Starter', 0, 300, 0, 1000, 1, 0, 0, 5, 3, 0),
  ('professional', 'Professional', 2900, 5000, 1000, -1, 25, 2, 5, -1, -1, 0),
  ('enterprise', 'Enterprise', 0, -1, -1, -1, 100, 0, 0, -1, -1, 1);
