#!/bin/bash

# Auto Emergency Mode Switcher
# Checks main site every 5 minutes and switches to emergency mode if down

MAIN_SITE="https://www.awesomesaucetoken.world"
EMERGENCY_FILE="/workspaces/AwesomeSauceToken/public/index.html"
BACKUP_FILE="/workspaces/AwesomeSauceToken/public/emergency.html"

echo "🔄 Auto Emergency Mode Monitor Started"
echo "====================================="

while true; do
    echo "$(date): Checking main site..."

    if curl -s --max-time 10 "$MAIN_SITE" > /dev/null; then
        echo "✅ Main site is up"
        # Ensure main site is active
        if [ -f "$EMERGENCY_FILE" ] && [ -f "$BACKUP_FILE" ]; then
            cp "$EMERGENCY_FILE" "$BACKUP_FILE" 2>/dev/null || true
        fi
    else
        echo "❌ Main site is down - ACTIVATING EMERGENCY MODE"
        # Switch to emergency page
        if [ -f "$BACKUP_FILE" ]; then
            cp "$BACKUP_FILE" "$EMERGENCY_FILE"
            echo "🚨 Emergency page activated"
        fi

        # Send alert (you can add email/discord notifications here)
        echo "ALERT: Site down - Emergency mode activated at $(date)" >> emergency.log
    fi

    echo "Next check in 5 minutes..."
    sleep 300
done
