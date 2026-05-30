USE appchat;

-- Store Google OAuth tokens per user
CREATE TABLE user_google_tokens (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL UNIQUE,
  access_token TEXT NOT NULL,
  refresh_token TEXT DEFAULT NULL,
  token_type VARCHAR(50) DEFAULT 'Bearer',
  expires_at DATETIME DEFAULT NULL,
  scope TEXT DEFAULT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Per-tenant Drive folder + website config
ALTER TABLE tenants
  ADD COLUMN gdrive_folder_id VARCHAR(255) DEFAULT NULL AFTER settings,
  ADD COLUMN gdrive_folder_name VARCHAR(255) DEFAULT NULL AFTER gdrive_folder_id,
  ADD COLUMN website_urls JSON DEFAULT NULL AFTER gdrive_folder_name;

-- File attachments on messages (links, drive files, website previews)
CREATE TABLE message_attachments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  message_id BIGINT NOT NULL,
  type ENUM('file','gdrive','link','website') NOT NULL,
  title VARCHAR(500) DEFAULT '',
  url TEXT NOT NULL,
  thumbnail_url TEXT DEFAULT NULL,
  mime_type VARCHAR(100) DEFAULT NULL,
  size_bytes BIGINT DEFAULT NULL,
  metadata JSON DEFAULT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
