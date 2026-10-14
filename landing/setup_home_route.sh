#!/bin/bash
# Add /home route pointing to landing page and redirect / to /home

CONFIG="/etc/nginx/sites-enabled/nexus.conf"

# Check if /home route already exists
if grep -q 'location = /home' "$CONFIG"; then
    echo "/home route already exists"
else
    # Add /home route before the landing page section
    sed -i '/# ── Landing Page ──/i \    # ── Home = Landing Page ──\n    location = /home {\n        alias /var/www/nexus/landing/;\n        try_files /index.html =404;\n        add_header Cache-Control "no-cache, no-store, must-revalidate";\n    }\n' "$CONFIG"
    echo "/home route added"
fi

# Update the root location to redirect to /home
# Replace the existing "location = /" block
if grep -q 'Root = Landing Page' "$CONFIG"; then
    # Replace existing root landing block with redirect to /home
    sed -i '/# ── Root = Landing Page ──/,/^    }/c\    # ── Root → /home redirect ──\n    location = / {\n        return 302 /home;\n    }' "$CONFIG"
    echo "Root redirect updated to /home"
fi

echo "--- Final check ---"
nginx -t && systemctl reload nginx && echo "NGINX RELOADED OK" || echo "NGINX TEST FAILED"
