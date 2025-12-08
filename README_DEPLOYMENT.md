# EC2 Deployment - Complete Setup Guide

## Overview

Yeh application 3 scrapers ko manage karti hai:
1. **Mandy Scraper** (`mandyscraper.js`)
2. **Backstage Scraper** (`scraper.js`)
3. **Starnow Scraper** (`starnow.js`)

Har scraper webhook pe data send karta hai: `https://manikinagency.app.n8n.cloud/webhook/a0586890-2134-4a91-99f9-1be0884d5c68`

## Quick Deployment Steps

### 1. EC2 Instance Setup
- **Instance Type**: t2.medium ya usse zyada (minimum 2GB RAM)
- **OS**: Amazon Linux 2 ya Ubuntu 20.04+
- **Storage**: 20GB minimum
- **Security Group**: Port 4000 open (agar listener use kar rahe ho)

### 2. Code Upload
```bash
# EC2 pe connect karo
ssh -i your-key.pem ec2-user@your-ec2-ip

# Git se clone karo (recommended)
git clone <your-repo-url>
cd the-audition-connection

# Ya SCP se upload karo
# scp -i your-key.pem -r . ec2-user@your-ec2-ip:/home/ec2-user/the-audition-connection
```

### 3. Run Deployment Script
```bash
chmod +x deploy.sh
./deploy.sh
```

Yeh script automatically:
- ✅ Node.js 18.x install karega
- ✅ PM2 install karega
- ✅ Dependencies install karega
- ✅ Playwright browsers install karega
- ✅ Logs directory create karega
- ✅ Production environment setup karega

### 4. Setup Daily Cron Job
```bash
chmod +x setup-cron.sh
./setup-cron.sh
```

Script aapse time puchhega (jaise `02:00` for 2 AM). Enter karo aur cron job automatically setup ho jayega.

### 5. Verify Setup
```bash
# Cron job check karo
crontab -l

# Manual test
node scheduler.js

# Logs check karo
ls -la logs/
```

## File Structure

```
the-audition-connection/
├── deploy.sh              # EC2 deployment script
├── setup-cron.sh          # Daily cron job setup
├── start.sh               # PM2 startup script
├── scheduler.js           # Main scheduler (runs all 3 scrapers)
├── scraper.js             # Backstage scraper
├── mandyscraper.js        # Mandy scraper
├── starnow.js             # Starnow scraper
├── listener.js            # Webhook listener (optional)
├── ecosystem.config.js    # PM2 configuration
├── DEPLOYMENT.md          # Detailed deployment guide
├── QUICK_START.md         # Quick start guide
└── logs/                  # Logs directory (auto-created)
```

## How It Works

1. **Scheduler** (`scheduler.js`): Teenon scrapers ko sequentially run karta hai
2. **Cron Job**: Har din set kiye gaye time pe `scheduler.js` ko trigger karta hai
3. **Scrapers**: Har scraper:
   - Playwright use karke websites scrape karta hai
   - Data collect karta hai
   - Webhook pe data send karta hai
   - Logs save karta hai

## Daily Schedule

Teeno scrapers aapke set kiye gaye time pe automatically run honge:
- **Mandy Scraper** → **Backstage Scraper** → **Starnow Scraper**
- Har scraper ke beech 30 seconds ka gap hota hai
- Sab logs `logs/` directory mein save hote hain

## Important Features

### Automatic Headless Mode
- EC2 pe scrapers automatically headless mode mein run honge
- `NODE_ENV=production` set hota hai automatically

### Logging
- Har scraper ka individual log file
- Cron job ka separate log file
- PM2 logs (agar listener use kar rahe ho)

### Error Handling
- Agar koi scraper fail ho, baki scrapers phir bhi run honge
- Errors properly log hote hain

## Useful Commands

### Cron Management
```bash
crontab -l              # List cron jobs
crontab -e              # Edit cron jobs
tail -f logs/cron.log   # View cron logs
```

### PM2 Management (Optional)
```bash
pm2 status              # View status
pm2 logs                # View logs
pm2 restart all         # Restart all
pm2 stop all            # Stop all
pm2 save                # Save current processes
```

### Manual Testing
```bash
# Test individual scraper
node scraper.js
node mandyscraper.js
node starnow.js

# Test scheduler (runs all 3)
node scheduler.js
```

### Logs
```bash
# Cron logs
tail -f logs/cron.log

# Individual scraper logs
tail -f logs/mandy-*.log
tail -f logs/backstage-*.log
tail -f logs/starnow-*.log

# PM2 logs
pm2 logs
```

## Troubleshooting

### Issue: Node.js install nahi ho raha
```bash
# Manual install
curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
sudo yum install -y nodejs
```

### Issue: Playwright browsers install nahi ho rahe
```bash
npx playwright install chromium
npx playwright install-deps chromium
```

### Issue: Cron job run nahi ho raha
```bash
# Check cron service
sudo systemctl status crond

# Check cron logs
grep CRON /var/log/cron

# Verify script permissions
chmod +x scheduler.js
```

### Issue: Memory issues
```bash
# Add swap memory
sudo dd if=/dev/zero of=/swapfile bs=1G count=2
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
```

## Environment Variables

Agar zaroorat ho to `.env` file create karo:
```bash
nano .env
```

Example:
```
NODE_ENV=production
HEADLESS=true
WEBHOOK_URL=https://your-webhook-url.com
```

## Cost Optimization

- **Instance Type**: Start with t2.medium, scale as needed
- **Spot Instances**: Development ke liye use kar sakte ho
- **Auto Stop**: Agar zaroorat nahi ho to instance stop kar do

## Security

1. ✅ Security group mein sirf zaroori ports open rakho
2. ✅ SSH keys use karo (password authentication disable karo)
3. ✅ Regular system updates karo
4. ✅ Logs regularly monitor karo

## Support

Agar koi issue ho:
1. Logs check karo (`logs/` directory)
2. Cron logs check karo (`logs/cron.log`)
3. PM2 logs check karo (agar listener use kar rahe ho)

---

**Note**: Yeh setup production-ready hai aur EC2 pe smoothly run karega. Har din automatically teeno scrapers run honge aur webhook pe data send karenge.

