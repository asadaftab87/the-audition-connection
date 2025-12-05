#!/bin/bash

# Quick Cron Job Setup Script

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CRON_TIME="${1:-0 2}"

echo "Setting up cron job for scraper scheduler..."
echo "Time: Daily at ${CRON_TIME}:00"
echo ""

# Get current crontab
crontab -l > /tmp/current_cron 2>/dev/null || true

# Check if job already exists
if grep -q "scheduler.js" /tmp/current_cron; then
    echo "⚠️  Cron job already exists!"
    echo "Current crontab:"
    crontab -l | grep scheduler.js
    echo ""
    read -p "Do you want to replace it? (y/n) " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Cancelled."
        rm /tmp/current_cron
        exit 0
    fi
    # Remove old entry
    grep -v "scheduler.js" /tmp/current_cron > /tmp/new_cron || true
    mv /tmp/new_cron /tmp/current_cron
fi

# Add new cron job
echo "${CRON_TIME} * * * cd ${SCRIPT_DIR} && /usr/bin/node scheduler.js >> logs/cron.log 2>&1" >> /tmp/current_cron

# Install new crontab
crontab /tmp/current_cron
rm /tmp/current_cron

echo "✅ Cron job installed successfully!"
echo ""
echo "To verify:"
echo "  crontab -l"
echo ""
echo "To view logs:"
echo "  tail -f ${SCRIPT_DIR}/logs/cron.log"
echo ""

