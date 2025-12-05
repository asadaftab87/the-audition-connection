import { chromium } from "playwright";

async function scrapeFacebookPage(url) {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto(url, { waitUntil: "domcontentloaded" });

  // Scroll limited times to avoid endless loop
  for (let i = 0; i < 6; i++) {
    await page.evaluate(() => window.scrollBy(0, window.innerHeight));
    await page.waitForTimeout(1500);
  }

  // Expand all "See more"
  await page.$$eval('div[role="button"]', (buttons) => {
    buttons.forEach((btn) => {
      if (btn.innerText.includes("See more")) btn.click();
    });
  });

  await page.waitForTimeout(1500);

  // Extract posts (limit to 25 so Facebook doesn't block)
  const posts = await page.$$eval(
    'div[data-ad-preview="message"]',
    (nodes) => nodes.slice(0, 25).map((n) => n.innerText.trim())
  );

  // Parse casting information
  const results = posts.map((raw) => {
    const parsed = {
      project: raw.match(/PROJECT:\s*(.*)/i)?.[1] || null,
      role: raw.match(/ROLE:\s*(.*)/i)?.[1] || null,
      shootDate: raw.match(/SHOOT DATE:\s*(.*)/i)?.[1] || null,
      callTime: raw.match(/CALL TIME:\s*(.*)/i)?.[1] || null,
      location: raw.match(/LOCATION:\s*(.*)/i)?.[1] || null,
      rate: raw.match(/RATE:\s*(.*)/i)?.[1] || null,
      usage: raw.match(/USAGE:\s*([\s\S]*?)\n/i)?.[1]?.trim() || null,
      age: raw.match(/AGES?:\s*(.*)/i)?.[1] || null,
      gender: raw.match(/LOOKING FOR A ([A-Za-z]+)/i)?.[1] || null,
      email: raw.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] || null,
    };

    return {
      raw,
      parsed,
      isCastingPost: !!parsed.project || raw.includes("CASTING"),
    };
  });

  console.log(results);

  await browser.close();
}

// Example usage:
scrapeFacebookPage("https://www.facebook.com/4StarCasting");
