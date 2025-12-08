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

                    // Expand role dropdowns
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
                        // Helper: normalize whitespace & NBSP
                        const norm = (s) =>
                            (s || "")
                                .replace(/\u00A0/g, " ")
                                .replace(/\s+/g, " ")
                                .trim();

                        const projectName =
                            norm(document.querySelector(".prod-listing__header h1")?.innerText || "");

                        let location = "N/A";
                        const locEl = document.querySelector(".prod-listing__details.submission-details div");
                        if (locEl) location = norm(locEl.innerText);

                        let deadline = "ASAP";
                        const deadlineEl = document.querySelector(".expires-text--date");
                        if (deadlineEl) deadline = norm(deadlineEl.innerText);

                        // -------------------------------
                        // VERY ROBUST DATES & LOCATIONS LOGIC
                        // -------------------------------
                        let datesAndLocations = "N/A";
                        let shoot_date = "N/A";
                        let shoot_location = location || "N/A";

                        // Strategy:
                        // 1) gather all candidate elements (Linkify spans, paragraphs under the block)
                        // 2) also try to find the section by the heading "Dates & Locations"
                        const candidates = [];

                        // direct Linkify spans (possibly multiple)
                        const linkifySpans = Array.from(document.querySelectorAll(".prod-listing__details span.Linkify"));
                        for (const s of linkifySpans) {
                            if (s && s.textContent) candidates.push(norm(s.textContent));
                        }

                        // paragraphs inside the details block
                        const detailsBlock = document.querySelector(".prod-listing__details");
                        if (detailsBlock) {
                            const ps = Array.from(detailsBlock.querySelectorAll("p"));
                            for (const p of ps) {
                                if (p && p.textContent) candidates.push(norm(p.textContent));
                            }
                        }

                        // Try to find heading "Dates & Locations" and take following sibling <p>
                        const headings = Array.from(document.querySelectorAll(".prod-listing__details h3, .prod-listing__details h2, .prod-listing__details h4"));
                        for (const h of headings) {
                            const txt = (h.textContent || "").toLowerCase();
                            if (txt.includes("dates") && txt.includes("locations")) {
                                // prefer the next <p> sibling
                                let p = h.nextElementSibling;
                                while (p && p.tagName && p.tagName.toLowerCase() !== "p") {
                                    p = p.nextElementSibling;
                                }
                                if (p && p.textContent) candidates.push(norm(p.textContent));
                            }
                        }

                        // fallback: any span.Linkify anywhere
                        if (candidates.length === 0) {
                            const anyLinkify = document.querySelector("span.Linkify");
                            if (anyLinkify && anyLinkify.textContent) candidates.push(norm(anyLinkify.textContent));
                        }

                        // fallback: innerHTML trimmed (last resort)
                        if (candidates.length === 0 && detailsBlock) {
                            const text = norm(detailsBlock.innerText || detailsBlock.textContent || "");
                            if (text) candidates.push(text);
                        }

                        // combine unique candidates preserving order
                        const uniq = [];
                        for (const c of candidates) {
                            if (!uniq.includes(c)) uniq.push(c);
                        }

                        // choose best candidate that looks date-like; prefer earlier ones
                        const dateLikeTest = (s) =>
                            /between|from|to|until|by|\b\d{1,2}\b|\bJan\b|\bFeb\b|\bMar\b|\bApr\b|\bMay\b|\bJun\b|\bJul\b|\bAug\b|\bSep\b|\bSept\b|\bOct\b|\bNov\b|\bDec\b/i.test(s);

                        // Try to prefer short practical date/location lines, not long descriptions
                        const filtered = uniq.filter(u => u.length < 200);

                        // Even if long ones exist, prefer the short + date-like ones
                        const dateKeywords = /(shoot|record|film|between|from|to|until|by|dates?|availability|nov|dec|jan|feb|mar|apr|may|jun|jul|aug|sep|oct)/i;

                        // Step 1: short + keyword + date-like
                        let chosen =
                            filtered.find(u => dateKeywords.test(u) && dateLikeTest(u)) ||

                            // Step 2: short + keyword
                            filtered.find(u => dateKeywords.test(u)) ||

                            // Step 3: short + date-like
                            filtered.find(u => dateLikeTest(u)) ||

                            // Step 4: any date-like in full list
                            uniq.find(u => dateLikeTest(u)) ||

                            // Step 5: fallback to first short item
                            filtered[0] ||

                            // Step 6: fallback to first anything
                            uniq[0] || "N/A";
                            
                        datesAndLocations = chosen;

                        // Parsing attempts:
                        // 1) between now and X
                        // 2) from X to Y
                        // 3) X - Y
                        // 4) until/by X
                        // 5) trailing date after words like Records or Shoot
                        const cleaned = chosen;

                        // Normalize common unicode dashes to hyphen
                        const normalized = cleaned.replace(/[\u2012\u2013\u2014\u2015]/g, "-");

                        // Patterns
                        const patterns = [
                            { rx: /between\s+now\s+and\s*(.+?)(?:[.,]|$)/i, pick: (m) => m[1] },
                            { rx: /from\s*(.+?)\s*(?:to|-|–)\s*(.+?)(?:[.,]|$)/i, pick: (m) => (m[1] + " - " + m[2]) },
                            { rx: /([0-9]{1,2}\s*(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*)\s*(?:-|–|—|to)\s*([0-9]{1,2}\s*(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*)/i, pick: (m) => (m[1] + " - " + m[2]) },
                            { rx: /([0-9]{1,2}\s*(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*)/i, pick: (m) => m[1] },
                            { rx: /until\s*(.+?)(?:[.,]|$)/i, pick: (m) => m[1] },
                            { rx: /by\s*(.+?)(?:[.,]|$)/i, pick: (m) => m[1] },
                            { rx: /(?:Records|Shoot|Filming|Casting).{0,30}?(?:on|between|from|to|until|by)?\s*([0-9]{1,2}\s*(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z0-9,\s\-]*)/i, pick: (m) => m[1] },
                        ];

                        for (const p of patterns) {
                            const m = normalized.match(p.rx);
                            if (m) {
                                try {
                                    const extracted = p.pick(m).replace(/\.$/, "").trim();
                                    if (extracted) {
                                        shoot_date = extracted;
                                        break;
                                    }
                                } catch (e) {
                                    // ignore and continue
                                }
                            }
                        }

                        // Try to extract a location phrase inside the chosen text, if main location missing
                        if ((!shoot_location || shoot_location === "N/A") && chosen) {
                            const locMatch = chosen.match(/\b(?:in|at|near|around)\s+([A-Z][a-zA-Z0-9 ,\-()]+)/i);
                            if (locMatch) shoot_location = norm(locMatch[1]);
                        }

                        // end robust logic
                        // -------------------------------

                        const roles = [];
                        const roleBlocks = document.querySelectorAll(
                            "#production-roles .role-group, #production-roles .role-details, #production-roles .casting-call-role"
                        );

                        for (const r of roleBlocks) {
                            const roleName = norm(r.querySelector("h4,h5,.name")?.innerText || "Unnamed Role");

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
                                    .map((div) => norm(div.innerText))
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

                        return {
                            projectName,
                            deadline,
                            location,
                            datesAndLocations,
                            roles,
                            shoot_date,
                            shoot_location,
                            _debug_candidates: uniq.slice(0, 5), // small sample of candidates used
                        };
                    });

                    // log quick debug to console (one line)
                    console.log("DEBUG:", {
                        url: item.link,
                        title: detail.projectName,
                        raw_candidates: detail._debug_candidates,
                        parsed_date: detail.shoot_date,
                        parsed_location: detail.shoot_location,
                    });

                    // Fetch pay from role URLs if missing
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
                        shoot_date: detail.shoot_date || "N/A",
                        shoot_location: detail.shoot_location || "N/A",
                        roles: detail.roles,
                        _debug: {
                            candidates: detail._debug_candidates,
                            parsed_date: detail.shoot_date,
                            parsed_location: detail.shoot_location,
                        },
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
