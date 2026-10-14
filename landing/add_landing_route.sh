#!/bin/bash
# Add landing route to smartmoon.online nginx config

# Check if landing route already exists
if grep -q '/landing/' /etc/nginx/sites-enabled/nexus.conf; then
    echo "Landing route already exists in nexus.conf"
else
    # Insert landing route before "Brand logo uploads" section
    sed -i '/# ── Brand logo uploads ──/i \    # ── Landing Page ──\n    location = /landing { return 301 /landing/; }\n    location /landing/ {\n        alias /var/www/nexus/landing/;\n        try_files $uri $uri/ /landing/index.html;\n        add_header Cache-Control "no-cache, no-store, must-revalidate";\n    }\n' /etc/nginx/sites-enabled/nexus.conf
    echo "Landing route added"
fi

# Test and reload
nginx -t && systemctl reload nginx && echo "NGINX RELOADED OK"
