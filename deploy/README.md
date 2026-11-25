# Fixzy on the client's server

| What | Address | On the server |
|---|---|---|
| Customer website | https://techiova.serieux.in/ | `/var/www/techiova.serieux.in/site` |
| Admin panel | https://techiova.serieux.in/admin/ | `site/admin` |
| API (websites and mobile apps) | https://techiova.serieux.in/api | `app/backend`, service `fixzy`, port 4001 (local only) |

Settings are in `/etc/fixzy.env`. The database is `fixzy`. To create an admin: `/usr/local/sbin/fixzy-create-admin`.

## Local development

`npm run dev` (websites) uses the backend on this PC (`backend`, port 4000).
`npm run dev:live` uses the live API instead. **Changes made there change real data.**

## Updating the live site

Commit your changes, then run this from the project folder:

    powershell -ExecutionPolicy Bypass -File .\deploy\update.ps1

It builds beside the live version, copies the database, applies database migrations, switches over and restarts.
If the new version fails its health check, the previous code is restored. Database changes are not undone.
Builds don't test features. If the connection drops, check the site before running it again.
This does not rebuild the mobile apps.
