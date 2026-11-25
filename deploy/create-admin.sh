#!/bin/bash
# Run on the server as root. Creates the first Fixzy admin account.
set -euo pipefail
read -rp "Admin email: " email
email=$(printf '%s' "$email" | tr 'A-Z' 'a-z' | tr -d ' ')
[[ $email =~ ^[a-z0-9._+-]+@[a-z0-9.-]+\.[a-z]{2,}$ ]] || { echo "That is not a valid email. Nothing changed."; exit 1; }
found=$(cd /tmp && echo 'SELECT count(*) FROM "User" WHERE email = :'"'"'e'"'"';' | runuser -u postgres -- psql -d fixzy -At -v e="$email")
[ "$found" = 0 ] || { echo "An account with this email already exists. Nothing changed."; exit 1; }
read -rsp "Admin password (12+ characters): " a; echo
read -rsp "Type it again: " b; echo
[ "$a" = "$b" ] || { echo "The two entries differ. Nothing changed."; exit 1; }
[ ${#a} -ge 12 ] || { echo "Too short. Nothing changed."; exit 1; }
cd /var/www/techiova.serieux.in/app/backend
set -a; . /etc/fixzy.env; set +a
ADMIN_EMAIL="$email" ADMIN_PASSWORD="$a" PATH=/opt/worksuite-node/bin:$PATH npm run --silent admin:create
