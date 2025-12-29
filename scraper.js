import { chromium } from "playwright";
import axios from "axios";
import { parse, isFuture, subDays, subHours } from "date-fns";
import { Country, State, City } from "country-state-city";
import os from "os";

// Always use headless: false (xvfb will provide display on Linux/EC2)
// User reported that headless: true causes blocking, but headless: false works
const IS_HEADLESS = false;


const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 13_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Safari/605.1.15",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
];


// -----------------------------
// NORMALIZE POSTED DATE
// -----------------------------
function normalizePosted(raw) {
  if (!raw) return null;
  raw = raw.toLowerCase().trim();
  const now = new Date();

  if (raw.includes("today")) return now.toISOString();
  if (raw.includes("yesterday")) return subDays(now, 1).toISOString();

  const hr = raw.match(/(\d+)\s*hour/);
  if (hr) return subHours(now, parseInt(hr[1])).toISOString();

  const d = raw.match(/(\d+)\s*day/);
  if (d) return subDays(now, parseInt(d[1])).toISOString();

  const parsedShort = parse(raw, "d MMM", now);
  if (!isNaN(parsedShort)) {
    parsedShort.setFullYear(now.getFullYear());
    if (isFuture(parsedShort)) parsedShort.setFullYear(now.getFullYear() - 1);
    return parsedShort.toISOString();
  }

  const dt = new Date(raw);
  if (!isNaN(dt)) return dt.toISOString();

  return null;
}

// -----------------------------
// NORMALIZE DEADLINE DATE
// -----------------------------
function normalizeDeadline(raw) {
  if (!raw) return null;
  raw = raw.trim();

  // Try parsing directly
  let dt = new Date(raw);
  if (!isNaN(dt)) return dt.toISOString();

  // Try parse using date-fns with time
  const parsedWithTime = parse(raw, "MMMM d, yyyy HH:mm", new Date());
  if (!isNaN(parsedWithTime)) return parsedWithTime.toISOString();

  // Try parse using date-fns without time
  const parsedWithoutTime = parse(raw, "MMMM d, yyyy", new Date());
  if (!isNaN(parsedWithoutTime)) return parsedWithoutTime.toISOString();

  return null;
}



// Map US state codes to full names
const US_STATES = {
  "AL": "Alabama", "AK": "Alaska", "AZ": "Arizona", "AR": "Arkansas", "CA": "California",
  "CO": "Colorado", "CT": "Connecticut", "DE": "Delaware", "FL": "Florida", "GA": "Georgia",
  "HI": "Hawaii", "ID": "Idaho", "IL": "Illinois", "IN": "Indiana", "IA": "Iowa",
  "KS": "Kansas", "KY": "Kentucky", "LA": "Louisiana", "ME": "Maine", "MD": "Maryland",
  "MA": "Massachusetts", "MI": "Michigan", "MN": "Minnesota", "MS": "Mississippi",
  "MO": "Missouri", "MT": "Montana", "NE": "Nebraska", "NV": "Nevada", "NH": "New Hampshire",
  "NJ": "New Jersey", "NM": "New Mexico", "NY": "New York", "NC": "North Carolina",
  "ND": "North Dakota", "OH": "Ohio", "OK": "Oklahoma", "OR": "Oregon", "PA": "Pennsylvania",
  "RI": "Rhode Island", "SC": "South Carolina", "SD": "South Dakota", "TN": "Tennessee",
  "TX": "Texas", "UT": "Utah", "VT": "Vermont", "VA": "Virginia", "WA": "Washington",
  "WV": "West Virginia", "WI": "Wisconsin", "WY": "Wyoming", "DC": "District of Columbia"
};

function splitLocation(raw) {
  if (!raw) return { city: "N/A", state: "N/A", country: "N/A" };

  // Split by comma
  const parts = raw.split(",").map(p => p.trim());

  let city = "N/A";
  let state = "N/A";
  let country = "N/A";

  if (parts.length === 1) {
    // Maybe country only
    const countryObj = Country.getAllCountries().find(c =>
      c.name.toLowerCase() === parts[0].toLowerCase() || c.isoCode.toLowerCase() === parts[0].toLowerCase()
    );
    if (countryObj) country = countryObj.name;
  } else if (parts.length === 2) {
    // City, State (assume USA if state matches)
    city = parts[0];
    const stateObj = State.getStatesOfCountry("US").find(s =>
      s.isoCode.toLowerCase() === parts[1].toLowerCase() || s.name.toLowerCase() === parts[1].toLowerCase()
    );
    if (stateObj) {
      state = stateObj.name;
      country = "United States";
    } else {
      state = parts[1];
      country = "N/A";
    }
  } else if (parts.length >= 3) {
    // City, State, Country
    city = parts[0];
    state = parts[1];
    const countryObj = Country.getAllCountries().find(c =>
      c.name.toLowerCase() === parts[2].toLowerCase() || c.isoCode.toLowerCase() === parts[2].toLowerCase()
    );
    country = countryObj ? countryObj.name : parts[2];
  }

  // Extra: try to validate city using the package
  if (country !== "N/A") {
    const countryObj = Country.getAllCountries().find(c => c.name === country);
    if (countryObj && state !== "N/A") {
      const stateObj = State.getStatesOfCountry(countryObj.isoCode).find(s => s.name === state);
      if (stateObj) {
        const cityObj = City.getCitiesOfState(countryObj.isoCode, stateObj.isoCode)
          .find(c => c.name.toLowerCase() === city.toLowerCase());
        if (cityObj) city = cityObj.name;
      }
    }
  }

  return { city, state, country };
}


// -----------------------------
// NORMALIZE AGE RANGE
// -----------------------------
function normalizeAge(raw) {
  if (!raw) return "N/A";
  raw = raw.trim();

  // 18+, 4+, 20+, etc.
  const plusMatch = raw.match(/^(\d{1,2})\+$/);
  if (plusMatch) return `${plusMatch[1]}+`;

  // 18-25, 51 - 70
  const rangeMatch = raw.match(/(\d{1,2})\s*-\s*(\d{1,3})/);
  if (rangeMatch) return `${rangeMatch[1]} - ${rangeMatch[2]}`;

  // Single number (like "18 Years")
  const numMatch = raw.match(/(\d{1,2})/);
  if (numMatch) return numMatch[1] + "+";

  // Fallback
  return raw;
}

// -----------------------------
// SPLIT AGE INTO MIN/MAX
// -----------------------------
function splitAgeRange(raw) {
  if (!raw || raw.toLowerCase() === "n/a") return { min_age: null, max_age: null };

  const rangeMatch = raw.match(/(\d{1,2})\s*-\s*(\d{1,3})/);
  if (rangeMatch) {
    return { min_age: parseInt(rangeMatch[1]), max_age: parseInt(rangeMatch[2]) };
  }

  const plusMatch = raw.match(/^(\d{1,2})\+$/);
  if (plusMatch) {
    return { min_age: parseInt(plusMatch[1]), max_age: 100 };
  }

  const numMatch = raw.match(/(\d{1,2})/);
  if (numMatch) return { min_age: parseInt(numMatch[1]), max_age: 100 };

  return { min_age: null, max_age: null };
}

function randomUA() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

const BASE_URL = "https://www.backstage.com/casting/?compensation_field=T&compensation_type=any&gender=B&max_age=100&min_age=0&radius=50&sort_by=relevance&view=production&page=";

const WEBHOOK_URL = "https://manikinagency.app.n8n.cloud/webhook/a0586890-2134-4a91-99f9-1be0884d5c68";

// ... your imports, constants, normalizePosted, normalizeDeadline, splitLocation, normalizeAge, splitAgeRange, randomUA, sleep remain unchanged

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
  const totalPages = 458;
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

      const listings = await page.$$eval(
        ".casting__listing, [data-testid='casting-card'], .casting-call-tile",
        (cards) => {
          const out = [];
          const badWords = [/post a job/i, /find jobs/i, /join now/i, /save job/i, /become a backstage member/i];

          for (const card of cards) {
            const heading =
              card.querySelector("h3 a, h2 a, a[href*='/casting/'].card-title, a.card__title") ||
              card.querySelector("a[href*='/casting/']");
            if (!heading) continue;

            const rawTitle = heading.innerText?.trim();
            if (!rawTitle || badWords.some((rx) => rx.test(rawTitle))) continue;
            const link = (heading.href || "").split("?")[0];
            if (!link.includes("/casting/")) continue;

            let location = null;
            const locationEl = card.querySelector(
              ".meta-location, .casting__location, [data-testid='location'], .listing__location"
            );
            if (locationEl) {
              const locText = locationEl.innerText.trim();
              const match = locText.match(/Nationwide|Worldwide|Remote/i);
              location = match ? match[0] : locText;
            } else {
              const txt = Array.from(card.querySelectorAll("*"))
                .map((el) => el.innerText || "")
                .join(" | ");
              if (/Nationwide|Worldwide/i.test(txt)) location = "Nationwide";
              else {
                const m = txt.match(/Roles paying.*?(Worldwide|[A-Za-z ,]+)\s*Posted:/i);
                if (m && m[1]) location = m[1].trim();
                else {
                  const m2 = txt.match(/(?:in|from)\s+([A-Za-z ,]+)/i);
                  if (m2) location = m2[1].trim();
                }
              }
            }

            let posted = "";
            const postedEl = card.querySelector(
              ".meta-updated, .listing__meta .date, .posted, [data-testid='posted']"
            );
            if (postedEl) posted = postedEl.innerText.trim();
            else {
              const txt = Array.from(card.querySelectorAll("*"))
                .map((n) => n.innerText || "")
                .join(" | ");
              const m = txt.match(/Posted[:\s]*([A-Za-z0-9 ,\-]+)/i);
              if (m) posted = m[1].trim();
            }

            out.push({
              title: rawTitle,
              link,
              location,
              posted: posted || null
            });
          }

          const seen = new Set();
          return out.filter((x) => x.link && !seen.has(x.link) && seen.add(x.link));
        }
      );

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

            let location = "";
            let shoot_date = "";
            let shoot_location = "";

            const seekEl = Array.from(document.querySelectorAll("div,p,span")).find((el) =>
              /Seeking talent/i.test(el.innerText || "")
            );
            if (seekEl) {
              const m = seekEl.innerText.match(/Seeking talent (from|in)\s*(.+)/i);
              if (m) location = m[2].trim();
            }

            const datesBlock = Array.from(document.querySelectorAll("div,p")).find((el) =>
              /Dates & Locations|Dates and Locations|Dates:/i.test(el.innerText || "")
            );
            if (datesBlock) {
              const text = datesBlock.innerText.replace(/<[^>]+>/g, "").trim();
              const match = text.match(/Shoots\s+(.*?)\s+in\s+(.+)/i);
              if (match) {
                shoot_date = match[1].trim();
                shoot_location = match[2].trim();
              } else {
                const fallbackMatch = text.match(/between\s+now\s+and\s+([0-9A-Za-z\s.,]+)/i);
                if (fallbackMatch) shoot_date = fallbackMatch[1].trim();
              }
            }

            if (!location) location = shoot_location || "";

            const roles = [];
            const roleBlocks = Array.from(
              document.querySelectorAll("#production-roles .role-group, [data-testid='role-group'], .role-details, .casting-call-role")
            );
            for (const r of roleBlocks) {
              const name = r.querySelector(".name, h5, h4, .role-header__title, [data-testid='role-title']")?.innerText?.trim() || "Unnamed Role";
              const applyLink = r.querySelector("a.role-group__open, a[href*='/casting/']")?.href || window.location.href;
              const textContent = r.innerText || "";
              const ageMatch = textContent.match(/([0-9]{1,2}\s*-\s*[0-9]{1,2}|[0-9]{1,2}\+|[0-9]{1,2}s|[0-9]{1,2}\s*Years)/i);
              const genderMatch = textContent.match(/\b(Male|Female|All Genders|Non-binary|Any Gender)\b/i);
              const payMatch = textContent.match(/(?:Rate|Total Pay)[:\s]*([A-Za-z$0-9.,]+)/i);

              let age = ageMatch ? ageMatch[0] : "N/A";
              if (age.toLowerCase() === "n/a") age = "N/A";

              roles.push({
                roleName: name,
                apply_link: applyLink,
                age_range: age,
                gender: genderMatch ? genderMatch[0] : "N/A",
                pay: payMatch ? payMatch[1] : "N/A",
              });
            }

            return { projectName, posted, deadline, location, shoot_date, shoot_location, roles };
          });

          if (item.location) detail.location = item.location;

          // Split main location
          const { city, state, country } = splitLocation(detail.location);
          // Split shoot location
          const { city: shoot_city, state: shoot_state, country: shoot_country } = splitLocation(detail.shoot_location);

          // Normalize age and split into min_age/max_age for all roles
          detail.roles = detail.roles.map(r => {
            const normalized = normalizeAge(r.age_range);
            const { min_age, max_age } = splitAgeRange(normalized);
            return {
              ...r,
              age_range: normalized,
              min_age,
              max_age
            };
          });

          console.log(`\n[${i + 1}/${listings.length}] ${detail.projectName}`);
          console.log(`Location: ${city || "N/A"}, ${state || "N/A"}, ${country || "N/A"} | Posted: ${detail.posted || item.posted || "N/A"} | Deadline: ${detail.deadline || "N/A"} | Shoot: ${detail.shoot_date} at ${detail.shoot_location}`);
          detail.roles.forEach((r, idx) =>
            console.log(`  → Role ${idx + 1}: ${r.roleName} | Age: ${r.age_range} | Min: ${r.min_age} | Max: ${r.max_age} | Gender: ${r.gender} | Pay: ${r.pay} | Apply: ${r.apply_link}`)
          );

          pageResults.push({
            project: detail.projectName || item.title,
            source_url: item.link,
            posted: normalizePosted(detail.posted || item.posted || null),
            deadline: normalizeDeadline(detail.deadline) || null,
            location: detail.location || item.location || null,
            city,
            state,
            country,
            shoot_date: detail.shoot_date,
            shoot_location: detail.shoot_location,
            shoot_city,
            shoot_state,
            shoot_country,
            roles: detail.roles || [],
          });

        } catch (err) {
          console.error("Error visiting detail page:", err.message);
        } finally {
          await context.close();
        }
      }

      await sendWebhook(
        pageResults.map(p => ({
          ...p,
          posted: p.posted ? normalizePosted(p.posted) : null
        })),
        `page ${currentPage}`
      );

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