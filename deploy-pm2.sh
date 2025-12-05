#!/bin/bash

# EC2 Deployment Script with PM2
# This script sets up the environment, installs dependencies, and configures PM2

set -e

echo "=========================================="
echo "EC2 Scraper Deployment Script (PM2)"
echo "=========================================="

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "Node.js not found. Installing Node.js 20.x..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi

echo "Node.js version: $(node --version)"
echo "npm version: $(npm --version)"

# Install PM2 globally if not installed
if ! command -v pm2 &> /dev/null; then
    echo ""
    echo "Installing PM2..."
    sudo npm install -g pm2
    # Setup PM2 startup script
    pm2 startup systemd -u $USER --hp $HOME
    echo "PM2 startup script configured. Run the command shown above as sudo if needed."
else
    echo "PM2 is already installed: $(pm2 --version)"
fi

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
chmod +x deploy-pm2.sh

echo ""
echo "=========================================="
echo "Deployment completed successfully!"
echo "=========================================="
echo ""
echo "Next steps:"
echo "1. Test run: pm2 start ecosystem.config.js --only scraper-scheduler"
echo "2. Save PM2 configuration: pm2 save"
echo "3. Setup PM2 to start on boot: pm2 startup (if not done already)"
echo "4. For cron-based scheduling, use: pm2 start ecosystem.config.js --cron"
echo ""

