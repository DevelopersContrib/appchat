USE appchat;

-- OAuth 2.1 for MCP connectors (claude.ai, ChatGPT): dynamically registered clients,
-- short-lived authorization codes (PKCE), and refresh tokens. Access tokens reuse api_tokens.
CREATE TABLE IF NOT EXISTS oauth_clients (
  client_id VARCHAR(64) PRIMARY KEY,
  client_name VARCHAR(200) NOT NULL,
  redirect_uris JSON NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS oauth_codes (
  code_hash CHAR(64) PRIMARY KEY,
  client_id VARCHAR(64) NOT NULL,
  user_id INT NOT NULL,
  redirect_uri VARCHAR(1000) NOT NULL,
  code_challenge VARCHAR(128) NOT NULL,
  expires_at DATETIME NOT NULL,
  FOREIGN KEY (client_id) REFERENCES oauth_clients(client_id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS oauth_refresh_tokens (
  token_hash CHAR(64) PRIMARY KEY,
  client_id VARCHAR(64) NOT NULL,
  user_id INT NOT NULL,
  expires_at DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES oauth_clients(client_id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Access tokens from OAuth expire; personal keys (created in the app) don't.
ALTER TABLE api_tokens
  ADD COLUMN expires_at DATETIME DEFAULT NULL,
  ADD COLUMN oauth_client_id VARCHAR(64) DEFAULT NULL;
