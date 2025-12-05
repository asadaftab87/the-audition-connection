import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import path from "path";

const execAsync = promisify(exec);

const SCRAPERS = [
  { name: "Mandy", file: "mandyscraper.js" },
  { name: "Backstage", file: "scraper.js" },
  { name: "Starnow", file: "starnow.js" },
];

const LOG_DIR = "./logs";

async function ensureLogDir() {
  try {
    await fs.mkdir(LOG_DIR, { recursive: true });
  } catch (err) {
    // Directory already exists
  }
}

async function runScraper(scraper) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const logFile = path.join(LOG_DIR, `${scraper.name.toLowerCase()}-${timestamp}.log`);
  const errorLogFile = path.join(LOG_DIR, `${scraper.name.toLowerCase()}-${timestamp}-error.log`);

  console.log(`\n${"=".repeat(60)}`);
  console.log(`Starting ${scraper.name} scraper at ${new Date().toLocaleString()}`);
  console.log(`${"=".repeat(60)}\n`);

  try {
    const { stdout, stderr } = await execAsync(`node ${scraper.file}`, {
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer
      timeout: 3600000, // 1 hour timeout
    });

    // Write logs
    await fs.appendFile(logFile, stdout);
    if (stderr) {
      await fs.appendFile(errorLogFile, stderr);
    }

    console.log(`\n✓ ${scraper.name} scraper completed successfully`);
    console.log(`  Logs saved to: ${logFile}`);
    if (stderr) {
      console.log(`  Errors saved to: ${errorLogFile}`);
    }

    return { success: true, scraper: scraper.name, logFile };
  } catch (error) {
    const errorMsg = `Error running ${scraper.name} scraper: ${error.message}`;
    console.error(`\n✗ ${errorMsg}`);
    
    await fs.appendFile(errorLogFile, `${errorMsg}\n${error.stack || ""}\n`);
    console.error(`  Error log saved to: ${errorLogFile}`);

    return { success: false, scraper: scraper.name, error: error.message, errorLogFile };
  }
}

async function main() {
  await ensureLogDir();

  console.log("\n" + "=".repeat(60));
  console.log("SCRAPER SCHEDULER STARTED");
  console.log(`Date: ${new Date().toLocaleString()}`);
  console.log("=".repeat(60));

  const results = [];

  for (const scraper of SCRAPERS) {
    const result = await runScraper(scraper);
    results.push(result);

    // Wait 30 seconds between scrapers to avoid overwhelming the system
    if (scraper !== SCRAPERS[SCRAPERS.length - 1]) {
      console.log("\nWaiting 30 seconds before next scraper...");
      await new Promise((resolve) => setTimeout(resolve, 30000));
    }
  }

  // Summary
  console.log("\n" + "=".repeat(60));
  console.log("SCHEDULER SUMMARY");
  console.log("=".repeat(60));
  results.forEach((r) => {
    const status = r.success ? "✓ SUCCESS" : "✗ FAILED";
    console.log(`${status} - ${r.scraper}`);
  });
  console.log("=".repeat(60) + "\n");

  const allSuccess = results.every((r) => r.success);
  process.exit(allSuccess ? 0 : 1);
}

// Handle graceful shutdown
process.on("SIGINT", () => {
  console.log("\n\nScheduler interrupted. Exiting...");
  process.exit(1);
});

process.on("SIGTERM", () => {
  console.log("\n\nScheduler terminated. Exiting...");
  process.exit(1);
});

main().catch((error) => {
  console.error("Fatal error in scheduler:", error);
  process.exit(1);
});

