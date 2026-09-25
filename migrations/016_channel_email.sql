USE appchat;

-- Each channel can have an email address: c-<token>@appchat.com. Forwarded emails post into the channel.
ALTER TABLE channels
  ADD COLUMN email_token VARCHAR(32) DEFAULT NULL,
  ADD UNIQUE KEY idx_email_token (email_token);
