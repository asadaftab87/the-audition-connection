# EC2 Deployment Guide - Scraper Scheduler

यह guide आपको EC2 पर scrapers deploy करने और daily scheduler setup करने में मदद करेगा।

## Prerequisites

- EC2 instance (Ubuntu 20.04 या उससे नया)
- SSH access to EC2
- Basic Linux knowledge

## Step 1: EC2 पर Code Upload करें

### Option A: Git के साथ (Recommended)

```bash
# EC2 पर SSH करें
ssh -i your-key.pem ubuntu@your-ec2-ip

# Git install करें (अगर नहीं है)
sudo apt-get update
sudo apt-get install -y git

# Code clone करें
cd ~
git clone <your-repo-url> the-audition-connection
cd the-audition-connection
```

### Option B: SCP के साथ

```bash
# अपने local machine से
scp -i your-key.pem -r . ubuntu@your-ec2-ip:~/the-audition-connection
```

## Step 2: Dependencies Install करें

```bash
# Deployment script run करें
chmod +x deploy.sh
./deploy.sh
```

यह script automatically:
- Node.js install करेगा (अगर नहीं है)
- npm dependencies install करेगा
- Playwright browsers install करेगा
- Logs directory बनाएगा

## Step 3: Test Run करें

```bash
# Manual test run
node scheduler.js
```

अगर सब कुछ ठीक है, तो आपको तीनों scrapers run होते दिखेंगे।

## Step 4: Scheduler Setup करें

आप दो तरीकों से scheduler setup कर सकते हैं:

### Option A: Cron Job (Simple)

```bash
# Crontab edit करें
crontab -e

# नीचे की line add करें (रोजाना 2 AM पर run होगा)
0 2 * * * cd /home/ubuntu/the-audition-connection && /usr/bin/node scheduler.js >> logs/cron.log 2>&1

# Save और exit करें
```

**Time change करने के लिए:**
- `0 2 * * *` = रोजाना 2:00 AM
- `0 6 * * *` = रोजाना 6:00 AM
- `0 */12 * * *` = हर 12 घंटे में
- Format: `minute hour day month weekday`

### Option B: Systemd Timer (Advanced - Better for production)

```bash
# Service file copy करें
sudo cp scraper-scheduler.service /etc/systemd/system/
sudo cp scraper-scheduler.timer /etc/systemd/system/

# Path update करें (अगर जरूरत हो)
sudo nano /etc/systemd/system/scraper-scheduler.service
# WorkingDirectory और ExecStart paths को अपने path से replace करें

# Timer enable करें
sudo systemctl daemon-reload
sudo systemctl enable scraper-scheduler.timer
sudo systemctl start scraper-scheduler.timer

# Status check करें
sudo systemctl status scraper-scheduler.timer
```

**Timer time change करने के लिए:**
```bash
sudo nano /etc/systemd/system/scraper-scheduler.timer
# OnCalendar=02:00 को अपनी preferred time से replace करें
sudo systemctl daemon-reload
sudo systemctl restart scraper-scheduler.timer
```

## Step 5: Monitoring

### Logs देखें

```bash
# Scheduler logs
tail -f logs/cron.log

# Individual scraper logs
ls -lh logs/
tail -f logs/mandy-*.log
tail -f logs/backstage-*.log
tail -f logs/starnow-*.log

# Error logs
tail -f logs/*-error.log
```

### Cron Job Status Check करें

```bash
# Cron logs देखें
grep CRON /var/log/syslog | tail -20

# Systemd timer status
sudo systemctl status scraper-scheduler.timer
sudo systemctl list-timers
```

## Troubleshooting

### Playwright Issues

```bash
# Playwright browsers reinstall करें
npx playwright install chromium
npx playwright install-deps chromium
```

### Permission Issues

```bash
# Logs directory permissions
chmod -R 755 logs/
```

### Node.js Not Found

```bash
# Node.js path check करें
which node
# अगर /usr/bin/node नहीं है, तो cron job में full path use करें
```

### Memory Issues

अगर EC2 instance में memory कम है, तो:
- Instance type upgrade करें (minimum t3.small recommended)
- या scrapers को एक-एक करके run करें

## Manual Run

अगर आप manually किसी भी scraper को run करना चाहते हैं:

```bash
node mandyscraper.js
node scraper.js
node starnow.js
```

## Important Notes

1. **Webhook URL**: सभी scrapers में webhook URL hardcoded है। अगर बदलना हो तो files edit करें।

2. **Headless Mode**: सभी scrapers अब headless mode में run हो रहे हैं (EC2 के लिए optimized)

3. **Logs**: सभी logs `logs/` directory में save होते हैं

4. **Time Zone**: EC2 instance का timezone check करें:
   ```bash
   timedatectl
   # अगर change करना हो
   sudo timedatectl set-timezone Asia/Kolkata
   ```

## Security Tips

1. EC2 Security Group में only necessary ports open रखें
2. SSH key को secure रखें
3. Webhook URL को environment variable में move करें (optional)

## Support

अगर कोई issue हो, तो logs check करें:
```bash
# Recent errors
find logs/ -name "*-error.log" -type f -exec tail -20 {} \;
```

