# AWS EC2 Deployment Guide

Yeh guide aapko AWS EC2 pe scraper application deploy karne mein help karega.

## Prerequisites

1. AWS EC2 instance (Ubuntu/Amazon Linux)
2. SSH access to EC2 instance
3. Security group mein port 4000 open (agar listener use kar rahe ho)

## Step 1: EC2 Instance Setup

### EC2 Instance Requirements:
- **Instance Type**: t2.medium ya usse zyada (Playwright ke liye memory chahiye)
- **OS**: Amazon Linux 2 ya Ubuntu 20.04+
- **Storage**: Minimum 20GB
- **Security Group**: Port 4000 open (agar listener use kar rahe ho)

## Step 2: Code Upload

### Option A: Git se (Recommended)
```bash
# EC2 instance pe connect karo
ssh -i your-key.pem ec2-user@your-ec2-ip

# Git install karo (agar nahi hai)
sudo yum install git -y  # Amazon Linux
# ya
sudo apt-get install git -y  # Ubuntu

# Repository clone karo
git clone https://github.com/your-username/the-audition-connection.git
cd the-audition-connection
```

### Option B: SCP se upload
```bash
# Local machine se
scp -i your-key.pem -r . ec2-user@your-ec2-ip:/home/ec2-user/the-audition-connection
```

## Step 3: Deployment Script Run Karo

```bash
# Script ko executable banao
chmod +x deploy.sh

# Deployment script run karo
./deploy.sh
```

Yeh script automatically:
- Node.js install karega
- PM2 install karega
- Dependencies install karega
- Playwright browsers install karega
- Logs directory create karega

## Step 4: Environment Variables (Agar zaroorat ho)

Agar aapke scrapers mein environment variables use ho rahe hain:

```bash
# .env file create karo
nano .env

# Webhook URL ya other configs add karo
WEBHOOK_URL=https://your-webhook-url.com
```

## Step 5: Daily Cron Job Setup

```bash
# Cron setup script ko executable banao
chmod +x setup-cron.sh

# Cron job setup karo
./setup-cron.sh
```

Yeh script aapse time puchhega (jaise 02:00 ya 14:30) aur automatically daily cron job setup kar dega.

### Manual Cron Setup (Alternative)

Agar script use nahi karna chahte:

```bash
# Crontab edit karo
crontab -e

# Neeche wali line add karo (example: har din 2 AM pe)
0 2 * * * cd /home/ec2-user/the-audition-connection && /usr/bin/node scheduler.js >> /home/ec2-user/the-audition-connection/logs/cron.log 2>&1
```

**Cron Time Format:**
- `0 2 * * *` = Har din 2:00 AM
- `0 14 * * *` = Har din 2:00 PM
- `30 3 * * *` = Har din 3:30 AM

## Step 6: PM2 Setup (Optional - Agar Listener Run Karna Ho)

Agar aap listener (webhook endpoint) bhi run karna chahte ho:

```bash
# PM2 se listener start karo
pm2 start ecosystem.config.js

# PM2 processes save karo (restart ke baad auto-start ke liye)
pm2 save

# PM2 status check karo
pm2 status

# Logs dekhne ke liye
pm2 logs
```

## Step 7: Verification

### Cron Job Check:
```bash
# Crontab list karo
crontab -l

# Cron logs dekhne ke liye
tail -f logs/cron.log
```

### Manual Test:
```bash
# Scheduler manually run karke test karo
node scheduler.js
```

### PM2 Status:
```bash
pm2 status
pm2 logs
```

## Useful Commands

### Cron Job Management:
```bash
# Cron jobs list karo
crontab -l

# Cron job edit karo
crontab -e

# Cron service status
sudo systemctl status crond  # Amazon Linux
sudo systemctl status cron    # Ubuntu
```

### PM2 Commands:
```bash
pm2 status              # Status dekhne ke liye
pm2 logs                # Logs dekhne ke liye
pm2 restart all         # Sab restart karo
pm2 stop all            # Sab stop karo
pm2 delete all          # Sab delete karo
pm2 save                # Current processes save karo
```

### Logs:
```bash
# Scheduler logs
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
# Manual install
npx playwright install chromium
npx playwright install-deps chromium
```

### Issue: Cron job run nahi ho raha
```bash
# Cron service check karo
sudo systemctl status crond

# Cron logs check karo
grep CRON /var/log/cron

# Permissions check karo
ls -la scheduler.js
chmod +x scheduler.js
```

### Issue: Memory issues
```bash
# Swap memory add karo (agar zaroorat ho)
sudo dd if=/dev/zero of=/swapfile bs=1G count=2
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
```

## Security Best Practices

1. **Firewall**: Security group mein sirf zaroori ports open rakho
2. **SSH Keys**: Password authentication disable karo
3. **Updates**: Regular system updates karo
4. **Logs**: Logs regularly check karo
5. **Backup**: Important data ka backup rakho

## Cost Optimization

1. **Instance Type**: Start with t2.medium, scale as needed
2. **Spot Instances**: Development ke liye spot instances use kar sakte ho
3. **Auto Stop**: Agar zaroorat nahi ho to instance stop kar do

## Support

Agar koi issue ho to:
1. Logs check karo (`logs/` directory)
2. Cron logs check karo (`logs/cron.log`)
3. PM2 logs check karo (`pm2 logs`)

---

**Note**: Yeh setup har din automatically teeno scrapers (Mandy, Backstage, Starnow) run karega aur webhook pe data send karega.

