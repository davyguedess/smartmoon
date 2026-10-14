#!/bin/bash
# Make landing page the root page at smartmoon.online/

# Update the "Default: try static files" section to serve landing page at exact root
# We need to add: location = / { ... } that serves the landing page

# First check current state
grep -n "location = /" /etc/nginx/sites-enabled/nexus.conf

# Add a location = / block that serves the landing page index.html
# This needs to go BEFORE the general location / block
sed -i '/# ── Default: try static files, then SPA ──/i \    # ── Root = Landing Page ──\n    location = / {\n        alias /var/www/nexus/landing/;\n        try_files /index.html =404;\n        add_header Cache-Control "no-cache, no-store, must-revalidate";\n    }\n' /etc/nginx/sites-enabled/nexus.conf

echo "--- Config added ---"

# Test and reload
nginx -t && systemctl reload nginx && echo "NGINX RELOADED OK" || echo "NGINX TEST FAILED"
