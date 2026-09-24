USE appchat;

-- Emoji reactions: one row per person per emoji per message.
CREATE TABLE IF NOT EXISTS message_reactions (
  message_id BIGINT NOT NULL,
  user_id INT NOT NULL,
  emoji VARCHAR(32) NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (message_id, user_id, emoji),
  INDEX idx_message (message_id),
  FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

-- Quote-replies (reply_to_id) and a change clock (updated_at) so open chats pick up
-- edits, deletes, reactions and thread reply counts without reloading.
ALTER TABLE messages
  ADD COLUMN reply_to_id BIGINT DEFAULT NULL,
  ADD COLUMN updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  ADD INDEX idx_channel_updated (channel_id, updated_at);

-- "Ana is typing…"
ALTER TABLE user_presence
  ADD COLUMN typing_channel_id INT DEFAULT NULL,
  ADD COLUMN typing_at DATETIME(3) DEFAULT NULL;

-- Web push subscriptions (one per browser/device).
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  endpoint VARCHAR(700) NOT NULL,
  p256dh VARCHAR(255) NOT NULL,
  auth VARCHAR(255) NOT NULL,
  user_agent VARCHAR(255) DEFAULT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY idx_endpoint (endpoint(255)),
  INDEX idx_user (user_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
