# Quick Start Guide - EC2 Deployment

## Tez Setup (5 Minutes)

### 1. EC2 Instance Pe Connect Karo
```bash
ssh -i your-key.pem ec2-user@your-ec2-ip
```

### 2. Code Upload Karo
```bash
# Git se (agar repo hai)
git clone https://github.com/your-username/the-audition-connection.git
cd the-audition-connection

# Ya SCP se upload karo (local machine se)
# scp -i your-key.pem -r . ec2-user@your-ec2-ip:/home/ec2-user/the-audition-connection
```

### 3. Deployment Script Run Karo
```bash
chmod +x deploy.sh
./deploy.sh
```

### 4. Daily Cron Job Setup Karo
```bash
chmod +x setup-cron.sh
./setup-cron.sh
# Time enter karo (jaise: 02:00 for 2 AM)
```

### 5. Test Karo
```bash
# Manual test
node scheduler.js

# Cron check
crontab -l
```

## Important Notes

- **Time Zone**: EC2 instance ka timezone check karo (`date` command se)
- **Headless Mode**: Scrapers EC2 pe automatically headless mode mein run honge
- **Logs**: Sab logs `logs/` directory mein save honge
- **Webhook**: Webhook URL already configured hai scrapers mein

## Daily Schedule

Teeno scrapers (Mandy, Backstage, Starnow) aapke set kiye gaye time pe automatically run honge aur webhook pe data send karenge.

## Troubleshooting

```bash
# Logs check karo
tail -f logs/cron.log

# Cron status
crontab -l

# PM2 status (agar listener use kar rahe ho)
pm2 status
```

---

**Detailed Guide**: `DEPLOYMENT.md` file mein complete instructions hain.

