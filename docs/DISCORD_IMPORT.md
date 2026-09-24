# Importing Discord history

Copies Discord channel messages into an AppChat workspace. Re-running picks up only new messages.

## 1. Create a Discord bot (one time)

1. Go to https://discord.com/developers/applications, then **New Application**.
2. **Bot** tab: click **Reset Token** and copy it. This is `DISCORD_BOT_TOKEN`.
3. On the same tab, turn on **Message Content Intent**. Without it, messages import with empty text.
4. **OAuth2 → URL Generator**: pick scope `bot` and the permissions **View Channels** and **Read Message History**.
   Open the generated URL and add the bot to your server.
5. In Discord, go to **Settings → Advanced** and turn on **Developer Mode**.
   Then right-click your server and choose **Copy Server ID**.

## 2. Run the migration (one time)

```bash
node --env-file=.env.local migrations/run.js 006_external_import.sql
```

## 3. Import

```bash
# Preview first
DISCORD_BOT_TOKEN=xxx node --env-file=.env.local scripts/import-discord.js --guild <server id> --tenant <workspace slug> --dry-run

# Then import for real
DISCORD_BOT_TOKEN=xxx node --env-file=.env.local scripts/import-discord.js --guild <server id> --tenant <workspace slug>
```

- `--channels id1,id2` imports only those channels.
- `--map users.json` shows Discord authors as AppChat members: `{"discord_username": "person@company.com"}`.
  Without a map, messages keep the Discord name and avatar and are tagged "Discord".
- A Discord channel whose name matches an existing AppChat channel is merged into it. Otherwise a new channel is created,
  and every workspace member is added.

## Known limits

- **File attachments** are linked to Discord's CDN. Discord now signs those links and they expire after about a day,
  so old images and files stop opening. Keeping them for good needs file storage (for example S3), which isn't set up yet.
- **Threads and forum posts** are not imported yet. Only messages in the channel itself are.
