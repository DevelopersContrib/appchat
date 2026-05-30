USE appchat;

-- Cached brand knowledge per tenant (docs, website content, brand info)
CREATE TABLE brand_knowledge (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tenant_id INT NOT NULL,
  source_type ENUM('gdrive','website','brandidentity','manual') NOT NULL,
  source_url TEXT DEFAULT NULL,
  title VARCHAR(500) DEFAULT '',
  content MEDIUMTEXT NOT NULL,
  content_hash VARCHAR(64) DEFAULT NULL,
  last_synced_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_tenant_source (tenant_id, source_type),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Per-tenant websites to index
CREATE TABLE tenant_websites (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tenant_id INT NOT NULL,
  url VARCHAR(500) NOT NULL,
  label VARCHAR(200) DEFAULT '',
  last_crawled_at DATETIME DEFAULT NULL,
  status ENUM('pending','crawled','error') DEFAULT 'pending',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY idx_tenant_url (tenant_id, url(255)),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
