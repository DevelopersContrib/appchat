# File uploads and VNOC sprints

## File uploads (VNOC S3)

Files upload straight from the browser to VNOC's per-domain bucket (`AWS_S3_BUCKET_DOMAIN`, `vnoc-domain-files`).
Each file is stored under the workspace's domain:

    <domain>/appchat/<tenant id>/<channel id>/<random id>/<filename>

Objects are private (no public-read ACL). `/api/files/...` checks that the viewer is in the channel,
then redirects to a 5-minute signed link. Limit: `MAX_UPLOAD_MB` (default 25).

Env (same names as vnoc/manage-app): `AWS_S3_BUCKET_DOMAIN`, `AWS_S3_REGION`, `AWS_S3_ACCESS_KEY_ID`, `AWS_S3_SECRET_ACCESS_KEY`.

**One-time bucket setup:** browsers can only upload directly if the bucket allows it (CORS). Add this to the bucket's CORS config:

```json
[
  {
    "AllowedOrigins": ["https://appchat.com", "https://*.appchat.com", "https://team.vnoc.com", "http://localhost:3000"],
    "AllowedMethods": ["PUT", "GET", "HEAD"],
    "AllowedHeaders": ["Content-Type"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3000
  }
]
```

Run the migration once: `node --env-file=.env.local migrations/run.js 007_file_uploads.sql`

## Sprints and tasks

The **Sprints** button in a channel (or `/sprints <search>`) opens a panel to:

- search sprints across every domain you can access
- open a sprint to see its tasks
- add tasks, with priority and assignee
- create new sprints

`/task <title>` adds a task to the workspace's domain. `/task other-domain.com <title>` adds it to another domain.
New tasks and sprints are posted to the channel as a card that links to app.vnoc.com.

**Who can do what:**
- **Admins** can work on every VNOC domain. That means AppChat platform admins and VNOC members with `is_admin`, matched by email.
- **Everyone else** can only work on domains they own or are on the team of.

**How it connects:**
- Reads go directly to the VNOC database (`VNOC_DATABASE_URL`).
- Writes go through manage-app's API (`VNOC_API_BASE`, default `https://app.vnoc.com/api/v1/mcp`), authenticated with `VNOC_EXTERNAL_API_KEY`.
- Every change is recorded under the signed-in person's email (`actor_email`).
