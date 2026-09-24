USE appchat;

-- Track where imported channels/messages came from (e.g. Discord) so imports can be re-run safely.
ALTER TABLE channels
  ADD COLUMN source VARCHAR(20) DEFAULT NULL,
  ADD COLUMN external_id VARCHAR(64) DEFAULT NULL,
  ADD UNIQUE KEY idx_channel_external (tenant_id, source, external_id);

ALTER TABLE messages
  ADD COLUMN source VARCHAR(20) DEFAULT NULL,
  ADD COLUMN external_id VARCHAR(64) DEFAULT NULL,
  ADD UNIQUE KEY idx_message_external (channel_id, source, external_id);
