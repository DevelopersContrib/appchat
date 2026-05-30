CREATE DATABASE IF NOT EXISTS appchat;
USE appchat;

-- Multi-tenant organizations
CREATE TABLE tenants (
  id INT AUTO_INCREMENT PRIMARY KEY,
  slug VARCHAR(100) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  domain VARCHAR(255) DEFAULT NULL,
  logo_url VARCHAR(500) DEFAULT NULL,
  brand_color VARCHAR(7) DEFAULT '#2563eb',
  crm_webhook_url VARCHAR(500) DEFAULT NULL,
  settings JSON DEFAULT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- User accounts
CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) DEFAULT '',
  avatar_url VARCHAR(500) DEFAULT NULL,
  magic_issuer VARCHAR(255) UNIQUE DEFAULT NULL,
  last_seen_at DATETIME DEFAULT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Tenant membership
CREATE TABLE tenant_members (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tenant_id INT NOT NULL,
  user_id INT NOT NULL,
  role ENUM('owner','admin','member','guest') DEFAULT 'member',
  joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY idx_tenant_user (tenant_id, user_id),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Chat channels
CREATE TABLE channels (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tenant_id INT NOT NULL,
  name VARCHAR(100) NOT NULL,
  description VARCHAR(500) DEFAULT '',
  is_private TINYINT(1) DEFAULT 0,
  is_dm TINYINT(1) DEFAULT 0,
  created_by INT DEFAULT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Channel membership
CREATE TABLE channel_members (
  id INT AUTO_INCREMENT PRIMARY KEY,
  channel_id INT NOT NULL,
  user_id INT NOT NULL,
  last_read_at DATETIME DEFAULT NULL,
  notifications ENUM('all','mentions','none') DEFAULT 'all',
  UNIQUE KEY idx_channel_user (channel_id, user_id),
  FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Messages
CREATE TABLE messages (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  channel_id INT NOT NULL,
  user_id INT DEFAULT NULL,
  body TEXT NOT NULL,
  type ENUM('text','system','ai','file') DEFAULT 'text',
  thread_id BIGINT DEFAULT NULL,
  metadata JSON DEFAULT NULL,
  edited_at DATETIME DEFAULT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_channel_time (channel_id, created_at),
  INDEX idx_thread (thread_id),
  FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (thread_id) REFERENCES messages(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Video/voice rooms
CREATE TABLE rooms (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tenant_id INT NOT NULL,
  channel_id INT DEFAULT NULL,
  livekit_room VARCHAR(255) NOT NULL,
  name VARCHAR(255) DEFAULT '',
  status ENUM('waiting','active','ended') DEFAULT 'waiting',
  recording_url VARCHAR(500) DEFAULT NULL,
  created_by INT DEFAULT NULL,
  started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  ended_at DATETIME DEFAULT NULL,
  ai_summary TEXT DEFAULT NULL,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Room participants
CREATE TABLE room_participants (
  id INT AUTO_INCREMENT PRIMARY KEY,
  room_id INT NOT NULL,
  user_id INT DEFAULT NULL,
  display_name VARCHAR(255) DEFAULT '',
  is_agent TINYINT(1) DEFAULT 0,
  joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  left_at DATETIME DEFAULT NULL,
  FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Shareable invite links
CREATE TABLE invite_links (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tenant_id INT NOT NULL,
  token VARCHAR(64) UNIQUE NOT NULL,
  channel_id INT DEFAULT NULL,
  room_id INT DEFAULT NULL,
  created_by INT NOT NULL,
  expires_at DATETIME DEFAULT NULL,
  max_uses INT DEFAULT NULL,
  uses INT DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE SET NULL,
  FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Seed VNOC as first tenant
INSERT INTO tenants (slug, name, logo_url, brand_color, crm_webhook_url) VALUES
  ('vnoc', 'VNOC', 'https://brandidentity.com/logo/vnoc.com', '#2563eb', 'https://vnoc.growagent.com/api/webhook');
