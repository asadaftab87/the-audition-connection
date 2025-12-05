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
  "https://www.starnow.com/casting/?compensation_type=any&compensation_field=T&gender=B&min_age=0&max_age=100&radius=50&sort_by=relevance&view=production&page=";
const WEBHOOK_URL =
  "https://manikinagency.app.n8n.cloud/webhook/a0586890-2134-4a91-99f9-1be0884d5c68";

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    userAgent: randomUA(),
    viewport: { width: 1200, height: 900 },
  });

  await context.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => false });
  });

  const page = await context.newPage();
  const totalPages = 103;

  const sendWebhook = async (data, label = "") => {
    if (!data.length)
      return console.log(`No data to send ${label ? `for ${label}` : ""}.`);
    console.log(
      `Sending ${data.length} records ${label ? `(${label})` : ""} to webhook...`
    );
    try {
      await axios.post(WEBHOOK_URL, { data }, { headers: { "Content-Type": "application/json" } });
      console.log("Data sent successfully!");
    } catch (err) {
      console.error("Webhook error:", err.message);
    }
  };

  for (let currentPage = 1; currentPage <= totalPages; currentPage++) {
    console.log(`\n--- Scraping page ${currentPage}/${totalPages} ---`);
    const url = `${BASE_URL}${currentPage}`;
    const pageResults = [];

    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 90000 });
      await sleep(1000 + Math.random() * 2000);

      const listings = await page.$$eval(
        "#casting-results > div, #casting-results > article",
        (cards) => {
          const out = [];
          for (const card of cards) {
            const a = card.querySelector("a[href*='/casting/']");
            if (!a) continue;
            const link = a.href.split("?")[0];
            const rawTitle = a.innerText.trim();

            let location = "N/A";
            const locEl = card.querySelector(".prod-listing__details.submission-details div");
            if (locEl) location = locEl.innerText.trim();

            let posted = "N/A";
            const postedSpan = Array.from(card.querySelectorAll("span.tw-text-gray-dark")).find(
              (span) => span.textContent.includes("Posted:")
            );
            if (postedSpan) {
              const text = Array.from(postedSpan.childNodes)
                .filter((n) => n.nodeType === Node.TEXT_NODE)
                .map((n) => n.textContent.trim())
                .join(" ");
              const match = text.match(/Posted:\s*(.+)/i);
              if (match) posted = match[1].trim();
            }

            out.push({ title: rawTitle, link, location, posted: posted || "N/A" });
          }
          const seen = new Set();
          return out.filter((x) => x.link && !seen.has(x.link) && seen.add(x.link));
        }
      );

      console.log(`Found ${listings.length} listings on page ${currentPage}`);

      for (let i = 0; i < listings.length; i++) {
        const item = listings[i];
        const detailPage = await context.newPage();

        try {
          await detailPage.goto(item.link, { waitUntil: "domcontentloaded", timeout: 45000 });
          await sleep(1500);

          // CLICK ALL DROPDOWNS BEFORE SCRAPING
          try {
            const dropdowns = await detailPage.$$("#production-roles .role-group__summary");
            for (const dd of dropdowns) {
              await dd.scrollIntoViewIfNeeded();
              await dd.click();
              await sleep(300);
            }
          } catch (e) {
            console.log("Dropdown click error:", e.message);
          }

          const detail = await detailPage.evaluate(() => {
            const projectName =
              document.querySelector(".prod-listing__header h1")?.innerText.trim() || "";

            let location = "N/A";
            const locEl = document.querySelector(".prod-listing__details.submission-details div");
            if (locEl) location = locEl.innerText.trim();

            let deadline = "ASAP";
            const deadlineEl = document.querySelector(".expires-text--date");
            if (deadlineEl) deadline = deadlineEl.innerText.trim();

            const datesAndLocationsEl =
              document.querySelector(".prod-listing__details p span.Linkify") ||
              document.querySelector(".prod-listing__details span.Linkify") ||
              document.querySelector(".prod-listing__details .Linkify");

            let datesAndLocations = "N/A";
            let shoot_date = "N/A";
            let shoot_location = "N/A";

            if (datesAndLocationsEl) {
              datesAndLocations = datesAndLocationsEl.innerText.trim();

              // Extract date (example: "Records between now and 10 Dec.")
              const dateMatch = datesAndLocations.match(/between now and\s*(.+?)(\.|$)/i);
              if (dateMatch) shoot_date = dateMatch[1].trim();

              // Default to page location
              shoot_location =
                document.querySelector(".prod-listing__details.submission-details div")
                  ?.innerText.trim() || "N/A";
            }

            const roles = [];
            const roleBlocks = document.querySelectorAll(
              "#production-roles .role-group, #production-roles .role-details, #production-roles .casting-call-role"
            );

            for (const r of roleBlocks) {
              const roleName = r.querySelector("h4,h5,.name")?.innerText?.trim() || "Unnamed Role";

              const mailto = r.querySelector("a[href^='mailto:']");
              const castingLink = r.querySelector("a[href*='/casting/']");
              const applyLink = mailto?.href || castingLink?.href || null;
              if (!applyLink) continue;

              const text = r.innerText || "";

              const ageMatch =
                text.match(/[0-9]{1,2}\s*-\s*[0-9]{1,2}/) ||
                text.match(/[0-9]{1,2}\s*\+/) ||
                text.match(/[0-9]{1,2}s/) ||
                text.match(/Teens|Teen|Young Adult|Adult|Child/i);

              const genderMatch = text.match(/Male|Female|All Genders|Any Gender|Non-binary|Trans/i);

              let pay = "N/A";
              const payEl = r.querySelector(".compensation.role_compensation .payment__estimated");
              if (payEl) {
                const lines = Array.from(payEl.querySelectorAll("div"))
                  .map((div) => div.innerText.trim())
                  .filter(Boolean);
                if (lines.length) pay = lines.join(" | ");
              }

              roles.push({
                roleName,
                apply_link: applyLink,
                age_range: ageMatch ? ageMatch[0] : "N/A",
                gender: genderMatch ? genderMatch[0] : "N/A",
                pay,
              });
            }

            return { projectName, deadline, location, datesAndLocations, roles, shoot_date, shoot_location, };
          });

          // VISIT EACH ROLE URL TO EXTRACT PAY IF NEEDED
          for (let j = 0; j < detail.roles.length; j++) {
            const role = detail.roles[j];
            if (role.pay && role.pay !== "N/A") continue;

            const rolePage = await context.newPage();
            try {
              await rolePage.goto(role.apply_link, { waitUntil: "domcontentloaded", timeout: 45000 });
              await sleep(1000);

              const payFromRole = await rolePage.evaluate(() => {
                let payText = "N/A";
                const payEl = document.querySelector(".payment__estimated");
                if (payEl) {
                  const lines = Array.from(payEl.querySelectorAll("div"))
                    .map((d) => d.innerText.trim())
                    .filter(Boolean);
                  if (lines.length) payText = lines.join(" | ");
                }
                return payText;
              });

              if (payFromRole && payFromRole !== "N/A") role.pay = payFromRole;
            } catch (err) {
              console.log(`Error fetching pay from role URL: ${err.message}`);
            } finally {
              await rolePage.close();
            }
          }

          if (!detail.roles.length) {
            console.log(`Skipping ${detail.projectName} - no contact/apply link`);
            await detailPage.close();
            continue;
          }

          pageResults.push({
            project: detail.projectName || item.title,
            source_url: item.link,
            posted: item.posted || "N/A",
            deadline: detail.deadline || "ASAP",
            location: detail.location || item.location || "N/A",
            datesAndLocations: detail.datesAndLocations || "N/A",
            shoot_date: detail.datesAndLocations || "N/A", // ADD THIS
            shoot_location: detail.location || item.location || "N/A", // ADD THIS
            roles: detail.roles,
          });

          console.log(`\n[${i + 1}/${listings.length}] '${detail.projectName}'`);
          detail.roles.forEach((r, idx) => {
            console.log(
              `  → Role ${idx + 1}: ${r.roleName} | Age: ${r.age_range} | Gender: ${r.gender} | Pay: ${r.pay} | Apply: ${r.apply_link}`
            );
          });
        } catch (err) {
          console.error("Detail page error:", err.message);
        } finally {
          await detailPage.close();
        }
      }

      await sendWebhook(pageResults, `page ${currentPage}`);
    } catch (err) {
      console.error(`Error scraping page ${currentPage}:`, err.message);
    }
  }

  await page.close();
  await context.close();
  await browser.close();
  console.log("Done.");
})();
