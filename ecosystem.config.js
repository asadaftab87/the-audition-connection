module.exports = {
  apps: [
    {
      name: "scraper-scheduler",
      script: "scheduler.js",
      instances: 1,
      exec_mode: "fork",
      autorestart: false, // Don't auto-restart after completion (for scheduled jobs)
      watch: false,
      max_memory_restart: "2G",
      env: {
        NODE_ENV: "production",
      },
      error_file: "./logs/pm2-error.log",
      out_file: "./logs/pm2-out.log",
      log_file: "./logs/pm2-combined.log",
      time: true, // Add timestamp to logs
      merge_logs: true,
      // Note: Use system cron or PM2 cron mode to schedule
      // PM2 cron: pm2 start ecosystem.config.js --only scraper-scheduler --cron "0 2 * * *"
    },
    // Individual scrapers (optional - if you want to run them separately)
    {
      name: "mandy-scraper",
      script: "mandyscraper.js",
      instances: 1,
      exec_mode: "fork",
      autorestart: false,
      watch: false,
      max_memory_restart: "2G",
      env: {
        NODE_ENV: "production",
      },
      error_file: "./logs/mandy-pm2-error.log",
      out_file: "./logs/mandy-pm2-out.log",
      time: true,
    },
    {
      name: "backstage-scraper",
      script: "scraper.js",
      instances: 1,
      exec_mode: "fork",
      autorestart: false,
      watch: false,
      max_memory_restart: "2G",
      env: {
        NODE_ENV: "production",
      },
      error_file: "./logs/backstage-pm2-error.log",
      out_file: "./logs/backstage-pm2-out.log",
      time: true,
    },
    {
      name: "starnow-scraper",
      script: "starnow.js",
      instances: 1,
      exec_mode: "fork",
      autorestart: false,
      watch: false,
      max_memory_restart: "2G",
      env: {
        NODE_ENV: "production",
      },
      error_file: "./logs/starnow-pm2-error.log",
      out_file: "./logs/starnow-pm2-out.log",
      time: true,
    },
  ],
};

