import { chromium } from "playwright";
import axios from "axios";

const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 13_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Safari/605.1.15",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
];

function randomUA() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

const BASE_URL =
  "https://www.mandy.com/aa/jobs/?compensation_type=any&compensation_field=T&gender=B&min_age=0&max_age=100&radius=50&sort_by=relevance&view=production&page=";

const WEBHOOK_URL =
  "https://manikinagency.app.n8n.cloud/webhook/a0586890-2134-4a91-99f9-1be0884d5c68";

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    userAgent: randomUA(),
    viewport: { width: 1200, height: 900 },
  });

  await ctx.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => false });
  });

  const page = await ctx.newPage();

  let currentPage = 1;
  const totalPages = 103;
  let stopped = false;
  let isAborted = false;

  const sendWebhook = async (data, label = "") => {
    if (!data.length) return console.log(`No data to send ${label ? `for ${label}` : ""}.`);
    console.log(`\nSending ${data.length} records ${label ? `(${label})` : ""} to webhook...`);
    try {
      await axios.post(WEBHOOK_URL, { data }, { headers: { "Content-Type": "application/json" } });
      console.log(" Data sent successfully!");
    } catch (err) {
      console.error(" Webhook error:", err.message);
    }
  };

  process.on("SIGINT", async () => {
    if (isAborted) return;
    isAborted = true;
    stopped = true;
    console.log("\nScraper aborted. Cleaning up...");
    try {
      await page.close();
      await ctx.close();
      await browser.close();
    } catch (err) {
      console.error("Error closing browser:", err.message);
    }
    console.log("Cleanup done. Exiting.");
    process.exit(0);
  });

  while (currentPage <= totalPages && !stopped) {
    console.log(`\n--- Scraping page ${currentPage}/${totalPages} ---`);
    const url = `${BASE_URL}${currentPage}`;
    const pageResults = [];

    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 90000 });
      await sleep(1000 + Math.random() * 2000);

      const listings = await page.$$eval("#casting-results > div, #casting-results > article", (cards) => {
        const out = [];
        const badWords = [/post a job/i, /find jobs/i, /join now/i, /save job/i];

        for (const card of cards) {
          const heading = card.querySelector("a[href*='/aa/project/']");
          if (!heading) continue;

          const rawTitle = heading.innerText?.trim();
          if (!rawTitle || badWords.some((rx) => rx.test(rawTitle))) continue;

          const link = (heading.href || "").split("?")[0];

          // --- FIXED LOCATION LOGIC ---
          let location = "";
          const lines = card.innerText.split("\n").map(l => l.trim()).filter(l => l);
          for (const l of lines) {
            if (/^[A-Za-z ,]+, [A-Za-z ,]+$/i.test(l)) {
              location = l;
              break;
            }
          }
          if (!location) {
            const match = card.innerText.match(/Locations?:\s*([A-Za-z ,]+)/i);
            if (match && match[1]) location = match[1].trim();
          }

          // Posted date
          let posted = "";
          const postedMatch = card.innerText.match(/Posted:\s*([A-Za-z0-9 ,]+)/i);
          if (postedMatch && postedMatch[1]) posted = postedMatch[1].trim();

          out.push({ title: rawTitle, link, location, posted: posted || null });
        }

        const seen = new Set();
        return out.filter((x) => x.link && !seen.has(x.link) && seen.add(x.link));
      });

      console.log(`Found ${listings.length} listings on page ${currentPage}`);

      for (let i = 0; i < listings.length; i++) {
        const item = listings[i];
        const context = await browser.newContext({
          userAgent: randomUA(),
          viewport: { width: 1200, height: 900 },
        });
        await context.addInitScript(() =>
          Object.defineProperty(navigator, "webdriver", { get: () => false })
        );
        const p = await context.newPage();

        try {
          await p.goto(item.link, { waitUntil: "domcontentloaded", timeout: 45000 });
          await sleep(1000 + Math.random() * 1000);

          const expandAllSelectors = [
            "a.collapse-roles.pull-right",
            "text=Expand All Roles",
            "button:has-text('View Role')",
            "button:has-text('Show More')",
            "button:has-text('Expand')",
            "div[role='button']:has-text('View')",
            ".role-group__open",
          ];

          for (const sel of expandAllSelectors) {
            const buttons = await p.$$(sel);
            for (const btn of buttons) {
              try { await btn.click(); await sleep(400); } catch { }
            }
          }

          await sleep(800);

          const detail = await p.evaluate(() => {
            const getText = (sel) => document.querySelector(sel)?.innerText?.trim() || "";
            const projectName = getText(".prod-listing__header h1") || getText("h1") || "";
            const posted = getText(".meta-updated, .listing__meta .date, .posted, [data-testid='posted']") || "";
            const deadline = getText(".expires-text--date") || "";

            // --- DETAIL PAGE LOCATION ---
            let location = "";
            const seekEl = Array.from(document.querySelectorAll("div,p,span")).find(el =>
              /Seeking talent/i.test(el.innerText || "")
            );
            if (seekEl) {
              const m = seekEl.innerText.match(/Seeking talent (from|in)\s*(.+)/i);
              if (m) location = m[2].trim();
            }
            if (!location) {
              const datesBlock = Array.from(document.querySelectorAll("div,p")).find(el =>
                /Dates & Locations|Dates and Locations|Dates:/i.test(el.innerText || "")
              );
              if (datesBlock) {
                const m = datesBlock.innerText.match(/(?:in|from)\s+([A-Za-z0-9 ,]+)/i);
                if (m) location = m[1].trim();
              }
            }

            const roles = [];
            const roleBlocks = Array.from(
              document.querySelectorAll(
                "#production-roles .role-group, [data-testid='role-group'], .role-details, .casting-call-role"
              )
            );

            for (const r of roleBlocks) {
              const name =
                r.querySelector(".name, h5, h4, .role-header__title, [data-testid='role-title']")?.innerText?.trim() ||
                "Unnamed Role";
              const applyLink = r.querySelector("a.role-group__open, a[href*='/casting/']")?.href || window.location.href;
              const textContent = r.innerText || "";
              const ageMatch = textContent.match(
                /([0-9]{1,2}\s*-\s*[0-9]{1,2}|[0-9]{1,2}\s*Years|[0-9]{1,2}\+|[0-9]{1,2}s)/i
              );
              const genderMatch = textContent.match(/\b(Male|Female|All Genders|Non-binary|Any Gender)\b/i);
              const payMatch = textContent.match(/(?:Rate|Total Pay|Roles paying up to)[:\s]*([^\n]+)/i);

              roles.push({
                roleName: name,
                apply_link: applyLink,
                age_range: ageMatch ? ageMatch[0] : "N/A",
                gender: genderMatch ? genderMatch[0] : "N/A",
                pay: payMatch ? payMatch[1] : "N/A",
              });
            }

            return { projectName, posted, deadline, location, roles };
          });

          // fallback to main page location if detail page doesn't have it
          if (!detail.location && item.location) detail.location = item.location;

          console.log(`\n[${i + 1}/${listings.length}] ${detail.projectName}`);
          console.log(
            `Location: ${detail.location || "N/A"} | Posted: ${detail.posted || item.posted || "N/A"} | Deadline: ${detail.deadline || "N/A"}`
          );

          detail.roles.forEach((r, idx) =>
            console.log(
              `  → Role ${idx + 1}: ${r.roleName} | Age: ${r.age_range} | Gender: ${r.gender} | Pay: ${r.pay} | Apply: ${r.apply_link}`
            )
          );

          pageResults.push({
            project: detail.projectName || item.title,
            source_url: item.link,
            posted: detail.posted || item.posted || null,
            deadline: detail.deadline || null,
            location: detail.location || item.location || null,
            roles: detail.roles || [],
          });
        } catch (err) {
          console.error("Error visiting detail page:", err.message);
        } finally {
          await context.close();
        }
      }

      await sendWebhook(pageResults, `page ${currentPage}`);
      currentPage++;
    } catch (err) {
      console.error(`Error scraping page ${currentPage}:`, err.message);
      currentPage++;
    }
  }

  await page.close();
  await ctx.close();
  await browser.close();
  console.log("Done.");
})();
