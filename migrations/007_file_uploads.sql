USE appchat;

-- Uploaded files live in object storage; storage_key ties an attachment to its object and channel.
ALTER TABLE message_attachments
  ADD COLUMN storage_key VARCHAR(500) DEFAULT NULL,
  ADD INDEX idx_storage_key (storage_key(191));
