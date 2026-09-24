USE appchat;

-- Profiles (contrib.com) and personal email preferences.
ALTER TABLE users
  ADD COLUMN contrib_username VARCHAR(200) DEFAULT NULL,
  ADD COLUMN email_offline_dms TINYINT(1) NOT NULL DEFAULT 1,
  ADD COLUMN email_digest TINYINT(1) NOT NULL DEFAULT 1,
  ADD COLUMN digest_sent_at DATETIME DEFAULT NULL;

-- Moderation (mute) and workspace rules acceptance.
ALTER TABLE tenant_members
  ADD COLUMN muted_until DATETIME DEFAULT NULL,
  ADD COLUMN rules_accepted_at DATETIME DEFAULT NULL;

-- Throttle "you have a new message" emails to one per conversation per window;
-- hidden_at = the member closed this DM (it reappears when a newer message arrives).
ALTER TABLE channel_members
  ADD COLUMN last_emailed_at DATETIME DEFAULT NULL,
  ADD COLUMN hidden_at DATETIME DEFAULT NULL;

-- Archived channels disappear from sidebars but keep their history.
ALTER TABLE channels
  ADD COLUMN archived_at DATETIME DEFAULT NULL;

-- Soft delete, so moderators can remove messages and the audit log still makes sense.
ALTER TABLE messages
  ADD COLUMN deleted_at DATETIME DEFAULT NULL,
  ADD COLUMN deleted_by INT DEFAULT NULL;

-- Who did what, for the Moderation tab.
CREATE TABLE IF NOT EXISTS audit_log (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  tenant_id INT NOT NULL,
  actor_id INT DEFAULT NULL,
  action VARCHAR(50) NOT NULL,
  target VARCHAR(255) DEFAULT NULL,
  details JSON DEFAULT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_tenant_time (tenant_id, created_at),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
