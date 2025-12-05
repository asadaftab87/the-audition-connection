#!/bin/bash

# EC2 Deployment Script for Scrapers
# This script sets up the environment and installs dependencies

set -e

echo "=========================================="
echo "EC2 Scraper Deployment Script"
echo "=========================================="

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "Node.js not found. Installing Node.js 20.x..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi

echo "Node.js version: $(node --version)"
echo "npm version: $(npm --version)"

# Install dependencies
echo ""
echo "Installing npm dependencies..."
npm install

# Install Playwright browsers
echo ""
echo "Installing Playwright browsers..."
npx playwright install chromium
npx playwright install-deps chromium

# Create logs directory
echo ""
echo "Creating logs directory..."
mkdir -p logs

# Set permissions
echo ""
echo "Setting permissions..."
chmod +x scheduler.js
chmod +x deploy.sh

echo ""
echo "=========================================="
echo "Deployment completed successfully!"
echo "=========================================="
echo ""
echo "Next steps:"
echo "1. Test run: node scheduler.js"
echo "2. Set up cron job: crontab -e"
echo "   Add: 0 2 * * * cd /path/to/project && /usr/bin/node scheduler.js >> logs/cron.log 2>&1"
echo ""

