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
    settings.financing = { mode: "manual", capacity: 36, quarterlyLimit: 9, annual: { 2027: { equity: 4 } } };
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
    await panel.locator("select").first().selectOption("curve");
    assert.equal(await row.locator("input").count(), 0);
    await panel.locator("select").nth(1).selectOption("historical");
    assert.match(await panel.locator("[data-financing-trend]").innerText(), /Insufficient Historical Data|历史融资数据不足/);
    await panel.locator("select").first().selectOption("manual");
    assert.equal(await row.locator("input").first().inputValue(), "8");
    await page.locator("#stepFwdBtn").click();
    assert.notEqual(await panel.locator("output").innerText(), "");
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
    browser = await chromium.launch();
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
