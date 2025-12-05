# PM2 Quick Start Guide (Roman Urdu)

## 🚀 EC2 Par Deploy Karein

### Step 1: Code Upload
```bash
ssh -i your-key.pem ubuntu@your-ec2-ip
cd ~
git clone <your-repo> the-audition-connection
cd the-audition-connection
```

### Step 2: Deploy Script Run Karein
```bash
chmod +x deploy-pm2.sh
./deploy-pm2.sh
```

### Step 3: PM2 Startup Configure Karein
```bash
pm2 startup systemd -u ubuntu --hp /home/ubuntu
# Output mein dikhne wali sudo command copy karke run karein
```

### Step 4: Scheduler Start Karein (Daily 2 AM)
```bash
chmod +x start-scheduler.sh
./start-scheduler.sh "0 2 * * *"
```

Ya manually:
```bash
pm2 start ecosystem.config.js --only scraper-scheduler --cron "0 2 * * *" --no-autorestart
pm2 save
```

## 📋 Important Commands

### Status Check
```bash
pm2 status                    # Sab processes
pm2 show scraper-scheduler    # Detailed info
pm2 monit                     # Real-time monitoring
```

### Logs Dekhein
```bash
pm2 logs                      # Sab logs
pm2 logs scraper-scheduler    # Scheduler logs
pm2 logs scraper-scheduler --lines 100  # Last 100 lines
```

### Control Karein
```bash
pm2 restart scraper-scheduler  # Restart
pm2 stop scraper-scheduler     # Stop
pm2 delete scraper-scheduler   # Delete
pm2 save                       # Configuration save
```

## ⏰ Time Change Karein

```bash
# Stop karein
pm2 stop scraper-scheduler
pm2 delete scraper-scheduler

# Naye time ke sath start karein
./start-scheduler.sh "0 6 * * *"  # 6 AM daily

# Ya manually:
pm2 start ecosystem.config.js --only scraper-scheduler --cron "0 6 * * *" --no-autorestart
pm2 save
```

**Time Examples:**
- `"0 2 * * *"` = Rozana 2:00 AM
- `"0 6 * * *"` = Rozana 6:00 AM
- `"30 3 * * *"` = Rozana 3:30 AM
- `"0 */12 * * *"` = Har 12 ghante mein

## 🔍 Troubleshooting

### PM2 Nahi Chal Raha?
```bash
pm2 logs scraper-scheduler --err
pm2 restart scraper-scheduler
```

### Manual Test Run
```bash
# PM2 ke bina test karein
node scheduler.js
```

### Logs Check Karein
```bash
# PM2 logs
pm2 logs scraper-scheduler

# File logs
tail -f logs/pm2-out.log
tail -f logs/pm2-error.log
```

## ✅ Checklist

- [ ] Code EC2 par upload ho gaya
- [ ] `./deploy-pm2.sh` run ho gaya
- [ ] PM2 startup configure ho gaya
- [ ] Scheduler start ho gaya (`pm2 status` se check karein)
- [ ] PM2 save ho gaya (`pm2 save`)
- [ ] Logs check kar liye

## 📞 Help

Detailed guide: `PM2-DEPLOYMENT.md` dekhein
