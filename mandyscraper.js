import { chromium } from "playwright";
import axios from "axios";
import os from "os";

// Detect if running on Linux/EC2 (headless mode needed)
// xvfb provides virtual display, so we should use headless mode even with DISPLAY set
const isLinux = os.platform() === 'linux';
const isWindows = os.platform() === 'win32';
const isMac = os.platform() === 'darwin';
// Use headless on Linux unless explicitly running on Windows/Mac with real display
const IS_HEADLESS = isLinux;

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

// --- Normalize posted date ---
function normalizePostedDate(raw) {
  if (!raw || raw === "N/A") return "N/A";
  const cleaned = raw.replace(/Posted:/i, "").trim().toLowerCase();
  const now = new Date();
  let m;

  m = cleaned.match(/(\d+)\s*hour[s]?\s*ago/);
  if (m) { now.setHours(now.getHours() - Number(m[1])); return now.toISOString().split("T")[0]; }

  m = cleaned.match(/(\d+)\s*day[s]?\s*ago/);
  if (m) { now.setDate(now.getDate() - Number(m[1])); return now.toISOString().split("T")[0]; }

  if (cleaned.includes("yesterday")) { now.setDate(now.getDate() - 1); return now.toISOString().split("T")[0]; }
  if (cleaned.includes("today")) return now.toISOString().split("T")[0];

  const weekdayMap = { sun: 0, mon: 1, tue: 2, tues: 2, wed: 3, wedn: 3, thu: 4, thur: 4, thurs: 4, fri: 5, sat: 6 };
  const mWeek = cleaned.match(/\b(sun(day)?|mon(day)?|tue(s)?|wed(nesday)?|thu(r(s)?)?|fri(day)?|sat(urday)?)\b/);
  if (mWeek) {
    const key = mWeek[1].slice(0, 3);
    const targetDay = weekdayMap[key];
    let diff = (new Date()).getDay() - targetDay;
    if (diff <= 0) diff += 7;
    now.setDate(now.getDate() - diff);
    return now.toISOString().split("T")[0];
  }

  const d = new Date(cleaned);
  if (!isNaN(d.getTime())) { if (d > new Date()) d.setFullYear(d.getFullYear() - 1); return d.toISOString().split("T")[0]; }
  return raw.trim();
}

// --- Normalize deadline date ---
function normalizeDeadlineDate(raw) {
  if (!raw || raw === "N/A") return "N/A";
  const cleaned = raw.replace(/Deadline:/i, "").trim().toLowerCase();
  const now = new Date();

  const weekdayMap = { sun: 0, mon: 1, tue: 2, tues: 2, wed: 3, wedn: 3, thu: 4, thur: 4, thurs: 4, fri: 5, sat: 6 };
  const mWeek = cleaned.match(/\b(sun(day)?|mon(day)?|tue(s)?|wed(nesday)?|thu(r(s)?)?|fri(day)?|sat(urday)?)\b/);
  if (mWeek) {
    const key = mWeek[1].slice(0, 3);
    const targetDay = weekdayMap[key];
    let diff = targetDay - now.getDay();
    if (diff <= 0) diff += 7;
    now.setDate(now.getDate() + diff);
    return now.toISOString().split("T")[0];
  }

  const d = new Date(cleaned);
  if (!isNaN(d.getTime())) return d.toISOString().split("T")[0];
  return raw.trim();
}

// --- Split location into city/state/country ---
function splitLocation(raw) {
  if (!raw || raw === "N/A") return { city: "N/A", state: "N/A", country: "N/A" };
  const parts = raw.split(",").map(p => p.trim());
  let city = "N/A", state = "N/A", country = "N/A";
  if (parts.length === 1) country = parts[0];
  else if (parts.length === 2) { city = parts[0]; state = parts[1]; }
  else if (parts.length >= 3) { city = parts[0]; state = parts[1]; country = parts[2]; }
  return { city, state, country };
}

// --- Split age into min/max ---
function splitAge(ageRange) {
  if (!ageRange || ageRange === "N/A") return { min_age: "N/A", max_age: "N/A" };
  const range = ageRange.match(/(\d{1,2})\s*-\s*(\d{1,2})/);
  if (range) return { min_age: Number(range[1]), max_age: Number(range[2]) };
  const plus = ageRange.match(/(\d{1,2})\+/);
  if (plus) return { min_age: Number(plus[1]), max_age: "N/A" };
  return { min_age: "N/A", max_age: "N/A" };
}


const BASE_URL =
  "https://www.mandy.com/aa/jobs/?compensation_type=any&compensation_field=T&gender=B&min_age=0&max_age=100&radius=50&sort_by=relevance&view=production&page=";

const WEBHOOK_URL =
  "https://manikinagency.app.n8n.cloud/webhook/a0586890-2134-4a91-99f9-1be0884d5c68";

(async () => {
  console.log(`🌐 Platform: ${os.platform()}, Headless: ${IS_HEADLESS}`);
  
  const browser = await chromium.launch({ 
    headless: IS_HEADLESS,
    args: [
      '--disable-blink-features=AutomationControlled',
      '--disable-dev-shm-usage',
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-web-security',
      '--disable-features=IsolateOrigins,site-per-process',
      ...(IS_HEADLESS ? ['--disable-gpu', '--disable-software-rasterizer'] : [])
    ]
  });
  const ctx = await browser.newContext({
    userAgent: randomUA(),
    viewport: { width: 1920, height: 1080 },
    locale: 'en-US',
    timezoneId: 'America/New_York',
    deviceScaleFactor: 1,
  });

  await ctx.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => false });
    Object.defineProperty(navigator, "plugins", { get: () => [1, 2, 3, 4, 5] });
    Object.defineProperty(navigator, "languages", { get: () => ["en-US", "en"] });
    window.chrome = { runtime: {} };
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

            // --- DETAIL PAGE LOCATION & SHOOT INFO (robust parser) ---
            let location = "";
            let shoot_date = "";
            let shoot_location = "";

            // gather relevant blocks and normalized text
            const detailEls = Array.from(document.querySelectorAll(".prod-listing__details, .prod-listing__details *"));
            let rawText = "";
            if (detailEls.length) {
              rawText = detailEls.map(el => (el.innerText || "")).join(" ").replace(/\s+/g, " ").trim();
            } else {
              rawText = Array.from(document.querySelectorAll("div,p,span")).map(el => el.innerText || "").join(" ").replace(/\s+/g, " ").trim();
            }
            const t = rawText;

            // 1) Seek "Seeking talent" explicit location
            const seekEl = Array.from(document.querySelectorAll("div,p,span")).find(el =>
              /Seeking talent/i.test(el.innerText || "")
            );
            if (seekEl) {
              const m = seekEl.innerText.match(/Seeking talent (from|in)\s*(.+)/i);
              if (m) location = m[2].trim();
            }

            // UNIVERSAL PATTERNS: prioritize explicit Linkify / Dates & Locations block if present
            // Try Linkify spans first
            const linkifySpans = Array.from(document.querySelectorAll(".prod-listing__details span.Linkify")).map(s => s.innerText.trim()).filter(Boolean);
            const linkifyText = linkifySpans.join(" ");

            const combined = (linkifyText ? (linkifyText + " " + t) : t).replace(/\s+/g, " ").trim();

            // Helper to try multiple regexes in order
            const tryRegex = (regexes) => {
              for (const rx of regexes) {
                const m = combined.match(rx);
                if (m) return m;
              }
              return null;
            };

            // Patterns to capture remote
            if (/shoots?\s+remotely|records?\s+remotely|remote project|fully remote|work from home/i.test(combined)) {
              shoot_location = "Remote";
              // try to capture any dates that appear near the word remote
              const mRemoteDate = combined.match(/(?:shoots?|records?).{0,60}?(on|between|from)?\s*([A-Za-z0-9().,\s:-]{1,60})/i);
              if (mRemoteDate && mRemoteDate[2]) {
                const candidate = mRemoteDate[2].trim().replace(/[.,;]$/, "");
                if (candidate.length < 120) shoot_date = candidate;
              }
            }

            // pattern: Shoots <date> (time) in <location>
            if (!shoot_date || !shoot_location) {
              const m = combined.match(/shoots?\s+([^.;\n]+?)\s+(?:in|at|around)\s+([A-Za-z0-9 ,()&-]+)/i);
              if (m) {
                if (!shoot_date) shoot_date = m[1].trim().replace(/[.,;]$/, "");
                if (!shoot_location) shoot_location = m[2].trim().replace(/[.,;]$/, "");
              }
            }

            // pattern: Records between now and X / Records between now and Dec.
            if (!shoot_date) {
              const m = combined.match(/records?\s+(between\s+now\s+and\s+[^.;\n]+)/i) || combined.match(/records?\s+between\s+([^.;\n]+)/i);
              if (m) shoot_date = m[1].trim().replace(/[.,;]$/, "");
            }

            // pattern: Shoots between X and Y OR Shoots from X to Y OR from X - Y
            if (!shoot_date) {
              const m = tryRegex([
                /shoots?\s+from\s+([^.;\n]+?)\s+(?:to|-)\s+([^.;\n]+)/i,
                /shoots?\s+between\s+([^.;\n]+?)\s+(?:and|-)\s+([^.;\n]+)/i,
                /([0-9]{1,2}\s*(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\s*(?:\d{2,4})?)\s*(?:-|to)\s*([0-9]{1,2}\s*(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\s*(?:\d{2,4})?)/i
              ]);
              if (m) {
                shoot_date = (m[1] && m[2]) ? `${m[1].trim()} - ${m[2].trim()}` : m[0].trim();
                shoot_date = shoot_date.replace(/[.,;]$/, "");
              }
            }

            // pattern: Shoots <single date> e.g., Shoots Dec. 8 (9 a.m.-1 p.m.)
            if (!shoot_date) {
              const m = combined.match(/shoots?\s+([0-9]{1,2}\s*(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\.?(?:[a-z]*)?(?:\s*[0-9]{4})?(?:\s*\([^\)]+\))?)/i)
                || combined.match(/shoots?\s+([A-Za-z]+\s+[0-9]{1,2}(?:st|nd|rd|th)?(?:,\s*\d{4})?(?:\s*\([^\)]+\))?)/i)
                || combined.match(/shoots?\s+(asap|tbd|flexible|early|late|now|ongoing|rolling)/i);
              if (m) shoot_date = m[1].trim().replace(/[.,;]$/, "");
            }

            // pattern: "in <location>" fallback if we didn't already get location
            if (!shoot_location) {
              const m = combined.match(/(?:in|at|around)\s+([A-Za-z0-9 ,()&-]{2,120})/i);
              if (m) shoot_location = m[1].trim().replace(/[.,;]$/, "");
            }

            // If location not found earlier, set location = shoot_location (fallback)
            if (!location && shoot_location) location = shoot_location;

            // final cleanups: trim and normalize empty strings
            shoot_date = (shoot_date || "").replace(/\s+/g, " ").trim();
            shoot_location = (shoot_location || "").replace(/\s+/g, " ").trim();
            location = (location || "").replace(/\s+/g, " ").trim();

            // -----------------------------------------
            // ROLE PARSER (kept same logic)
            // -----------------------------------------
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

            return { projectName, posted, deadline, location, shoot_date, shoot_location, roles };
          });

          if (!detail.location && item.location) detail.location = item.location;

          console.log(`\n[${i + 1}/${listings.length}] ${detail.projectName}`);
          console.log(
            `Location: ${detail.location || "N/A"} | Posted: ${detail.posted || item.posted || "N/A"} | Deadline: ${detail.deadline || "N/A"} | Shoot: ${detail.shoot_date} at ${detail.shoot_location}`
          );

          detail.roles.forEach((r, idx) =>
            console.log(
              `  → Role ${idx + 1}: ${r.roleName} | Age: ${r.age_range} | Gender: ${r.gender} | Pay: ${r.pay} | Apply: ${r.apply_link}`
            )
          );

          const postedNorm = normalizePostedDate(detail.posted || item.posted);
          const deadlineNorm = normalizeDeadlineDate(detail.deadline);
          const locSplit = splitLocation(detail.location || item.location);
          const shootSplit = splitLocation(detail.shoot_location);

          pageResults.push({
            project: detail.projectName || item.title,
            source_url: item.link,

            posted: postedNorm,
            deadline: deadlineNorm,

            location: detail.location || item.location || "N/A",
            location_city: locSplit.city,
            location_state: locSplit.state,
            location_country: locSplit.country,

            shoot_date: detail.shoot_date || "N/A",
            shoot_location: detail.shoot_location || "N/A",
            shoot_city: shootSplit.city,
            shoot_state: shootSplit.state,
            shoot_country: shootSplit.country,

            roles: detail.roles.map(r => {
              const { min_age, max_age } = splitAge(r.age_range);
              return { ...r, min_age, max_age };
            }),
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
