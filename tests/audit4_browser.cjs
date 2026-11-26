const assert = require("node:assert/strict");
const http = require("node:http");
const fs = require("node:fs/promises");
const path = require("node:path");
const { once } = require("node:events");
const { chromium } = require("playwright");

const pages = ["index.html", "index_en.html", "index_zh.html"];
const server = http.createServer(async (request, response) => {
  const page = request.url.slice(1);
  if (!pages.includes(page)) {
    response.writeHead(404).end();
    return;
  }
  try {
    response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" })
      .end(await fs.readFile(path.join(__dirname, "..", page)));
  } catch (error) {
    response.destroy(error);
  }
});

async function checkPage(browser, url) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 950 } });
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.locator("#stepFwdBtn").click();
    await page.locator("#stepFwdBtn").click();
    await page.locator(".wl-row").first().click();
    await page.locator("#tabBtnForecast").click();
    const panel = page.locator("#financingScenario");
    await panel.locator("summary").click();
    const scenario = panel.locator("textarea");
    const settings = JSON.parse(await scenario.inputValue());
    settings.financing = { mode: "manual", history: {}, capacity: 36, quarterlyLimit: 9, annual: { 2027: { equity: 4 } } };
    await scenario.fill(JSON.stringify(settings));
    await panel.locator("button").click();
    const row = panel.locator("tbody tr").first();
    const annualEquity = row.locator("input").first();
    assert.equal(await annualEquity.inputValue(), "4");
    assert.equal(await row.locator("td").nth(7).innerText(), "4.00");
    await annualEquity.fill("8");
    await annualEquity.press("Tab");
    assert.equal(await row.locator("td").nth(7).innerText(), "8.00");
    assert.ok((await panel.locator("[data-financing-chart]").innerText()).includes("8.00"));
    const finalYear = panel.locator("tbody tr").last();
    assert.equal(await finalYear.locator("td").first().innerText(), "2033");
    const finalYearEquity = finalYear.locator("input").first();
    await finalYearEquity.fill("4");
    await finalYearEquity.press("Tab");
    assert.equal(await finalYear.locator("td").nth(7).innerText(), "4.00");
    await panel.locator("select").first().selectOption("curve");
    assert.equal(await row.locator("input").count(), 0);
    const curveEquity = panel.getByLabel("equity ($B)", { exact: true });
    await curveEquity.fill("10");
    await curveEquity.press("Tab");
    assert.equal(await row.locator("td").nth(7).innerText(), "10.00");

    await panel.locator("select").nth(1).selectOption("historical");
    assert.match(await panel.locator("[data-financing-trend]").innerText(), /Insufficient Historical Data|历史融资数据不足/);
    const historicalSettings = JSON.parse(await scenario.inputValue());
    historicalSettings.financing.history = {
      2025: { dataType: "Actual", fullYear: true, amounts: { equity: 4 } },
      2026: { dataType: "Actual", fullYear: true, amounts: { equity: 6 } }
    };
    await scenario.fill(JSON.stringify(historicalSettings));
    await panel.locator("button").click();
    const trend = await panel.locator("[data-financing-trend]").innerText();
    assert.match(trend, /equity: 2025 = \$4B \/ 2026 = \$6B/);
    assert.match(trend, /(?:Insufficient Historical Data|历史融资数据不足): debt/);
    assert.equal(await row.locator("td").nth(7).innerText(), "9.00");
    await panel.locator("select").first().selectOption("manual");
    assert.equal(await row.locator("input").first().inputValue(), "8");
    await page.locator("#stepFwdBtn").click();
    assert.notEqual(await panel.locator("output").innerText(), "");
    const leaseSettings = JSON.parse(await scenario.inputValue());
    leaseSettings.incrementalLeaseTranches = [
      { type: "finance", startQuarter: "2026Q4", termQuarters: 8, quarterlyPayment: 2, annualDiscountRate: 0 },
      { type: "operating", startQuarter: "2026Q4", termQuarters: 8, quarterlyPayment: 0.5 }
    ];
    await scenario.fill(JSON.stringify(leaseSettings));
    await panel.locator("button").click();
    assert.match(await panel.locator("[data-lease-result]").innerText(), /2\.50 \/ 2\.00 \/ 0\.00/);
    const gpuSettings = JSON.parse(await scenario.inputValue());
    gpuSettings.gpuRefresh = { economicLife: 7, gpuPurchasesByQuarter: { "2027Q1": 0.1 } };
    await scenario.fill(JSON.stringify(gpuSettings));
    await panel.locator("button").click();
    assert.equal(await panel.locator("tbody tr").last().locator("td").first().innerText(), "2034");
    await page.locator("#openDataModalBtn").click();
    const downloadPromise = page.waitForEvent("download");
    await page.locator("#dlAuditLedgerJson").click();
    const download = await downloadPromise;
    assert.equal(download.suggestedFilename(), "audit4_quarterly_credit_ledger.json");
    const ledger = JSON.parse(await fs.readFile(await download.path(), "utf8"));
    assert.equal(ledger.currency, "USD billions");
    const firstQuarter = ledger.quarters[0];
    assert.equal(firstQuarter.quarter, "2026Q4");
    assert.equal(firstQuarter.financingLedger.TX26.beginningOutstanding, 4.583);
    assert.equal(firstQuarter.financingLedger.TX26.lender, null);
    assert.equal(firstQuarter.financingLedger.TX26.undrawnCommitment, null);
    assert.equal(ledger.quarters.at(-1).quarter, "2034Q4");
    assert.deepEqual(errors, []);
    console.log("Browser interaction passed:", url.split("/").at(-1));
  } finally {
    await page.close();
  }
}

async function main() {
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  let browser;
  try {
    browser = await chromium.launch({ channel: "chrome" });
    for (const page of pages) await checkPage(browser, "http://127.0.0.1:" + server.address().port + "/" + page);
  } finally {
    await browser?.close();
    server.close();
  }
}
main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
