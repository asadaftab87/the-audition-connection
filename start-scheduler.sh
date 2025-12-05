#!/bin/bash

# PM2 Scheduler Start Script
# This script starts the scheduler with PM2 in cron mode

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CRON_TIME="${1:-0 2 * * *}"

echo "Starting scraper scheduler with PM2..."
echo "Schedule: $CRON_TIME"
echo ""

cd "$SCRIPT_DIR"

# Check if PM2 is installed
if ! command -v pm2 &> /dev/null; then
    echo "❌ PM2 is not installed. Please run ./deploy-pm2.sh first"
    exit 1
fi

# Stop existing scheduler if running
pm2 stop scraper-scheduler 2>/dev/null || true
pm2 delete scraper-scheduler 2>/dev/null || true

# Start scheduler with cron
pm2 start ecosystem.config.js --only scraper-scheduler --cron "$CRON_TIME" --no-autorestart

# Save PM2 configuration
pm2 save

echo ""
echo "✅ Scheduler started successfully!"
echo ""
echo "To check status:"
echo "  pm2 status"
echo ""
echo "To view logs:"
echo "  pm2 logs scraper-scheduler"
echo ""
echo "To stop:"
echo "  pm2 stop scraper-scheduler"
echo ""

