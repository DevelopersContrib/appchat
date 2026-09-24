USE appchat;

-- Full-text search over message text and attachment names (Search dialog, /api/search).
ALTER TABLE messages ADD FULLTEXT INDEX ft_body (body);
ALTER TABLE message_attachments ADD FULLTEXT INDEX ft_title (title);
