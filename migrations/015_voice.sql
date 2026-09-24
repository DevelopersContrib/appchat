USE appchat;

-- Which channel's voice room someone is in (Discord-style voice), shown in the sidebar.
ALTER TABLE user_presence ADD COLUMN voice_channel_id INT DEFAULT NULL;
