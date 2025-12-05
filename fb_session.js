import { chromium } from "playwright";
import dotenv from "dotenv";
dotenv.config();

async function loginAndSave() {
  const browser = await chromium.launch({ headless: false, slowMo: 60 });
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log("Opening Facebook login page...");
  await page.goto("https://www.facebook.com/login", { waitUntil: "networkidle" });

  await page.fill('input[name="email"]', process.env.USER_EMAIL);
  await page.fill('input[name="pass"]', process.env.PASSWORD);

  await page.click('button[name="login"]');

  // Wait for login or feed
  await page.waitForTimeout(8000);

  console.log("Saving session...");
  await context.storageState({ path: "fb_session.json" });

  console.log("✔ Session saved → fb_session.json");
  await browser.close();
}

loginAndSave();
