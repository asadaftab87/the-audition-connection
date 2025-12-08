# EC2 Pe Run Karne Ke Liye Commands

## Step-by-Step Commands (Copy-Paste Karke Run Karo)

### Step 1: Project Directory Mein Jao
```bash
cd the-audition-connection
```

### Step 2: Node.js Install Karo (Agar Nahi Hai)
```bash
# Amazon Linux ke liye:
curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
sudo yum install -y nodejs

# Ya Ubuntu ke liye:
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

### Step 3: PM2 Install Karo (Agar Nahi Hai)
```bash
sudo npm install -g pm2
```

### Step 4: Dependencies Install Karo
```bash
npm install
```

### Step 5: Playwright Browsers Install Karo
```bash
npx playwright install chromium
npx playwright install-deps chromium
```

### Step 6: Logs Directory Banao
```bash
mkdir -p logs
```

### Step 7: Midnight Cron Job Setup Karo (Har Din 12 Baje)
```bash
(crontab -l 2>/dev/null; echo "0 0 * * * cd $(pwd) && NODE_ENV=production $(which node) scheduler.js >> $(pwd)/logs/cron.log 2>&1") | crontab -
```

### Step 8: Cron Job Verify Karo
```bash
crontab -l
```

### Step 9: Test Karo (Optional)
```bash
NODE_ENV=production node scheduler.js
```

---

## Complete One-Liner (Sab Ek Sath)

Agar sab kuch already setup hai, to sirf cron job ke liye:
```bash
cd the-audition-connection && (crontab -l 2>/dev/null; echo "0 0 * * * cd $(pwd) && NODE_ENV=production $(which node) scheduler.js >> $(pwd)/logs/cron.log 2>&1") | crontab - && crontab -l
```

---

## Important Notes

- **Cron Time**: `0 0 * * *` = Har din midnight 12 baje
- **Logs**: `logs/cron.log` mein save honge
- **Production Mode**: Automatically set hoga
- **Headless Mode**: EC2 pe automatically headless run hoga

---

## Useful Commands

### Cron Job Check
```bash
crontab -l
```

### Cron Logs Dekhne Ke Liye
```bash
tail -f logs/cron.log
```

### Cron Job Edit Karne Ke Liye
```bash
crontab -e
```

### Cron Job Delete Karne Ke Liye
```bash
crontab -e
# Phir jo line delete karni hai wo remove karo
```

### Manual Test
```bash
NODE_ENV=production node scheduler.js
```

