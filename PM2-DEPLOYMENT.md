# PM2 Ke Sath EC2 Deployment Guide (Roman Urdu)

Yeh guide aapko PM2 process manager ke sath scrapers deploy karne mein madad karega.

## PM2 Kya Hai?

PM2 ek powerful process manager hai jo:
- Automatic restarts karta hai
- Logs manage karta hai
- Memory monitoring karta hai
- System reboot ke baad automatically start hota hai

## Step 1: EC2 Par Code Upload Karein

```bash
# EC2 par SSH karein
ssh -i your-key.pem ubuntu@your-ec2-ip

# Code clone karein
cd ~
git clone <your-repo-url> the-audition-connection
cd the-audition-connection
```

## Step 2: PM2 Ke Sath Deploy Karein

```bash
# Deployment script run karein
chmod +x deploy-pm2.sh
./deploy-pm2.sh
```

Yeh script automatically:
- Node.js install karega
- PM2 install karega (globally)
- npm dependencies install karega
- Playwright browsers install karega
- PM2 startup script configure karega

## Step 3: PM2 Startup Configure Karein

```bash
# PM2 startup command run karein (script output mein dikhega)
# Ya manually:
pm2 startup systemd -u ubuntu --hp /home/ubuntu

# Output mein dikhne wali sudo command run karein
# Example:
# sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u ubuntu --hp /home/ubuntu
```

## Step 4: PM2 Ke Sath Scrapers Start Karein

### Option A: Scheduler Ke Sath (Recommended - Sab scrapers ek sath)

```bash
# Easy way - use the start script
chmod +x start-scheduler.sh
./start-scheduler.sh "0 2 * * *"  # Daily at 2 AM

# Ya manually PM2 ke sath:
# Scheduler start karein (cron mode mein - daily 2 AM)
pm2 start ecosystem.config.js --only scraper-scheduler --cron "0 2 * * *" --no-autorestart

# Ya manual start (abhi run karne ke liye)
pm2 start ecosystem.config.js --only scraper-scheduler

# PM2 configuration save karein
pm2 save
```

### Option B: Individual Scrapers (Agar separately run karna ho)

```bash
# Sab scrapers start karein
pm2 start ecosystem.config.js

# Ya individually:
pm2 start ecosystem.config.js --only mandy-scraper
pm2 start ecosystem.config.js --only backstage-scraper
pm2 start ecosystem.config.js --only starnow-scraper

# Save karein
pm2 save
```

## Step 5: PM2 Commands (Important)

### Status Check Karein

```bash
# Sab processes ki status
pm2 status

# Detailed information
pm2 show scraper-scheduler

# Real-time monitoring
pm2 monit
```

### Logs Dekhein

```bash
# Sab logs
pm2 logs

# Specific app ke logs
pm2 logs scraper-scheduler

# Last 100 lines
pm2 logs scraper-scheduler --lines 100

# Real-time logs
pm2 logs scraper-scheduler --lines 0
```

### Restart/Stop Karein

```bash
# Restart
pm2 restart scraper-scheduler

# Stop
pm2 stop scraper-scheduler

# Delete (permanently remove)
pm2 delete scraper-scheduler

# Sab restart
pm2 restart all
```

### Cron Schedule Change Karein

```bash
# Method 1: Start script use karein (new time ke sath)
./start-scheduler.sh "0 6 * * *"  # 6 AM daily

# Method 2: Manually stop aur restart karein
pm2 stop scraper-scheduler
pm2 delete scraper-scheduler
pm2 start ecosystem.config.js --only scraper-scheduler --cron "0 6 * * *" --no-autorestart
pm2 save
```

## Step 6: Daily Scheduler Setup

### Method 1: PM2 Cron Mode (Recommended)

PM2 ke cron mode ka use karein:

```bash
# Start script use karein (easiest)
./start-scheduler.sh "0 2 * * *"

# Ya manually:
pm2 start ecosystem.config.js --only scraper-scheduler --cron "0 2 * * *" --no-autorestart
pm2 save
```

**Time format**: `"minute hour day month weekday"`
- `"0 2 * * *"` = Daily at 2:00 AM
- `"0 6 * * *"` = Daily at 6:00 AM
- `"30 3 * * *"` = Daily at 3:30 AM

### Method 2: System Cron Ke Sath PM2

Agar PM2 cron mode use nahi karna chahte:

```bash
# Crontab edit karein
crontab -e

# Add this line (daily 2 AM)
0 2 * * * cd /home/ubuntu/the-audition-connection && /usr/bin/pm2 start ecosystem.config.js --only scraper-scheduler --no-autorestart
```

## Step 7: Monitoring Aur Maintenance

### Memory Usage Check Karein

```bash
pm2 monit
# Ya
pm2 list
```

### Logs Rotate Karein (Agar bade ho jayein)

```bash
# PM2 log rotate module install karein
pm2 install pm2-logrotate

# Configure karein
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
pm2 set pm2-logrotate:compress true
```

### Auto-restart Disable Karein (Scheduler Ke Liye)

Scheduler ek baar run hokar complete ho jata hai, isliye `autorestart: false` hai. 
Agar aap chahte hain ke daily automatically restart ho, to cron mode use karein.

## Troubleshooting

### PM2 Process Not Starting

```bash
# Check PM2 logs
pm2 logs scraper-scheduler --err

# Check system logs
journalctl -u pm2-ubuntu -n 50
```

### PM2 Startup Issue

```bash
# Startup script regenerate karein
pm2 unstartup
pm2 startup systemd -u ubuntu --hp /home/ubuntu
# Output mein dikhne wali sudo command run karein
```

### Memory Issues

```bash
# Memory limit check karein
pm2 show scraper-scheduler | grep memory

# Agar zyada memory use ho rahi ho, to ecosystem.config.js mein max_memory_restart increase karein
```

### Playwright Issues

```bash
# Playwright browsers reinstall karein
npx playwright install chromium
npx playwright install-deps chromium
```

## Useful PM2 Commands Summary

```bash
# Status
pm2 status

# Start
pm2 start ecosystem.config.js --only scraper-scheduler

# Stop
pm2 stop scraper-scheduler

# Restart
pm2 restart scraper-scheduler

# Logs
pm2 logs scraper-scheduler

# Monitoring
pm2 monit

# Save configuration
pm2 save

# Delete
pm2 delete scraper-scheduler

# List all
pm2 list

# Info
pm2 info scraper-scheduler
```

## Configuration File (ecosystem.config.js)

Main settings:
- `autorestart: false` - Don't auto-restart after completion (scheduler runs once and completes)
- `max_memory_restart: "2G"` - Restart if memory exceeds 2GB
- `error_file`, `out_file` - Log file paths

**Cron Schedule**: PM2 cron mode mein time `--cron` flag ke sath specify karein:
```bash
# Examples:
pm2 start ecosystem.config.js --only scraper-scheduler --cron "0 6 * * *"  # 6 AM daily
pm2 start ecosystem.config.js --only scraper-scheduler --cron "0 */12 * * *"  # Every 12 hours
pm2 start ecosystem.config.js --only scraper-scheduler --cron "0 2 * * 1"  # Every Monday at 2 AM
```

## Advantages of PM2

1. **Process Management**: Automatic restart, monitoring
2. **Log Management**: Centralized logs with rotation
3. **Memory Monitoring**: Auto-restart if memory limit exceeded
4. **Startup Script**: System reboot ke baad automatically start
5. **Easy Monitoring**: `pm2 monit` se real-time monitoring
6. **Zero Downtime**: Reload without stopping

## Next Steps

1. ✅ Deploy script run karein
2. ✅ PM2 startup configure karein
3. ✅ Scheduler start karein
4. ✅ PM2 save karein
5. ✅ Logs monitor karein

## Support

Agar koi issue ho:
```bash
# PM2 logs check karein
pm2 logs scraper-scheduler --lines 50

# System logs
journalctl -u pm2-ubuntu -n 100
```
