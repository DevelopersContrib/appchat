USE appchat;

-- Live presence: one row per user, refreshed by a heartbeat every ~30s while the app is open.
-- Online = updated within the last 90s; "where" = the channel or meeting they have open.
CREATE TABLE IF NOT EXISTS user_presence (
  user_id INT PRIMARY KEY,
  tenant_id INT DEFAULT NULL,
  channel_id INT DEFAULT NULL,
  room_id INT DEFAULT NULL,
  status ENUM('active','away') NOT NULL DEFAULT 'active',
  timezone VARCHAR(64) DEFAULT NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_tenant_updated (tenant_id, updated_at),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE SET NULL,
  FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE SET NULL,
  FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
