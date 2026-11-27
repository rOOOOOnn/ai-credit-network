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
    const chartClosingCash = panel.locator('[data-financing-closing-cash="2027"]');
    const checkChartCash = async () => {
      const displayed = await row.locator("td").last().innerText();
      assert.ok((await chartClosingCash.innerText()).trimEnd().endsWith(displayed));
      const meter = chartClosingCash.locator("meter");
      assert.equal(Number(await meter.getAttribute("value")).toFixed(2), displayed);
      assert.ok(Number(await meter.getAttribute("min")) < 0);
    };
    await checkChartCash();
    const financingFreeze = panel.locator("[data-scenario-financing-freeze]");
    await financingFreeze.selectOption("freeze");
    assert.equal(await annualEquity.inputValue(), "8");
    assert.equal(await row.locator("td").nth(7).innerText(), "0.00");
    await checkChartCash();
    await financingFreeze.selectOption("enabled");
    assert.equal(await row.locator("td").nth(7).innerText(), "8.00");
    const financeChart = panel.locator("[data-financing-chart]");
    assert.match(await financeChart.innerText(), /2028 (?:Financing growth|\u878d\u8d44\u589e\u901f) -100\.0%/);
    const finalYear = panel.locator("tbody tr").last();
    assert.equal(await finalYear.locator("td").first().innerText(), "2033");
    const finalYearEquity = finalYear.locator("input").first();
    await finalYearEquity.fill("4");
    await finalYearEquity.press("Tab");
    assert.equal(await finalYear.locator("td").nth(7).innerText(), "4.00");
    await panel.locator("select").first().selectOption("curve");
    assert.equal(await row.locator("input").count(), 0);
    await checkChartCash();
    const curveEquity = panel.getByLabel("equity ($B)", { exact: true });
    await curveEquity.fill("10");
    await curveEquity.press("Tab");
    assert.equal(await row.locator("td").nth(7).innerText(), "10.00");
    const initialGrowth = panel.getByLabel(/Initial financing growth|初始融资增速/);
    await initialGrowth.fill("0.5");
    await initialGrowth.press("Tab");
    assert.equal(await row.locator("td").nth(10).innerText(), "50.0%");
    assert.match(await financeChart.innerText(), /2027 (?:Financing growth|融资增速) 50\.0%/);

    await panel.locator("[data-financing-curve]").selectOption("historical");
    assert.match(await panel.locator("[data-financing-trend]").innerText(), /Insufficient Historical Data|历史融资数据不足/);
    const historicalSettings = JSON.parse(await scenario.inputValue());
    historicalSettings.financing.history = {
      2025: { dataType: "Actual", fullYear: true, amounts: { equity: 4 } },
      2026: { dataType: "Actual", fullYear: true, amounts: { equity: 6 } }
    };
    await scenario.fill(JSON.stringify(historicalSettings));
    await panel.locator("button").click();
    const trend = await panel.locator("[data-financing-trend]").innerText();
    assert.equal(await panel.locator('[data-historical-financing="equity-2025"] meter').getAttribute("value"), "4");
    assert.equal(await panel.locator('[data-historical-financing="equity-2026"] meter').getAttribute("value"), "6");
    assert.equal(await panel.locator('[data-historical-financing^="debt-"]').count(), 0);
    assert.match(trend, /equity: 2025 = \$4B \/ 2026 = \$6B/);
    assert.match(trend, /(?:Insufficient Historical Data|历史融资数据不足): debt/);
    assert.equal(await row.locator("td").nth(7).innerText(), "9.00");
    await panel.locator("select").first().selectOption("manual");
    assert.equal(await row.locator("input").first().inputValue(), "8");
    assert.equal(await panel.locator('[data-historical-financing="equity-2025"] meter').getAttribute("value"), "4");
    await panel.locator("select").first().selectOption("curve");
    assert.equal(await panel.locator("[data-financing-curve]").inputValue(), "historical");
    assert.equal(await row.locator("td").nth(7).innerText(), "9.00");
    await panel.locator("select").first().selectOption("manual");
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
    gpuSettings.gpuRefresh = { economicLife: 7, replacementRatio: 0.5, residualValue: 0.2, gpuPurchasesByQuarter: { "2027Q1": { quantity: 1000, unitCostUsd: 100000, generation: "Fixture" } } };
    await scenario.fill(JSON.stringify(gpuSettings));
    await panel.locator("button").click();
    assert.equal(await panel.locator("tbody tr").last().locator("td").first().innerText(), "2034");
    const capexGrowth = panel.getByLabel(/Base CapEx growth per quarter|基础资本开支季度增速/);
    await capexGrowth.fill("0.1");
    await capexGrowth.press("Tab");
    const utilization = panel.locator('[data-gpu-setting="utilizationRate"]');
    await utilization.fill("0.5");
    await utilization.press("Tab");
    const performanceRatio = panel.locator('[data-gpu-setting="replacementPerformanceRatio"]');
    await performanceRatio.fill("2");
    await performanceRatio.press("Tab");
    assert.equal(JSON.parse(await scenario.inputValue()).gpuRefresh.replacementPerformanceRatio, 2);
    const repurposeShare = panel.locator('[data-gpu-setting="repurposeShare"]');
    await repurposeShare.fill("0.5");
    await repurposeShare.press("Tab");
    assert.equal(JSON.parse(await scenario.inputValue()).gpuRefresh.repurposeShare, 0.5);
    const gpuRevenueShare = panel.locator('[data-gpu-setting="utilizationRevenueShare"]');
    await gpuRevenueShare.fill("0.5");
    await gpuRevenueShare.press("Tab");
    const equityValuation = panel.getByLabel(/Scenario equity pre-money valuation|情景股权投前估值/);
    await equityValuation.fill("18");
    await equityValuation.press("Tab");
    const secondQuarterWeight = panel.locator('[data-financing-quarter-weight="2"]');
    await secondQuarterWeight.fill("0");
    await secondQuarterWeight.press("Tab");
    assert.deepEqual(JSON.parse(await scenario.inputValue()).financing.quarterWeights, [1, 0, 1, 1]);
    const substitutionRatio = panel.getByLabel(/Operational substitution ratio|\u8fd0\u8425\u66ff\u4ee3\u5bb9\u91cf\u6bd4\u7387/);
    await substitutionRatio.fill("0.6");
    await substitutionRatio.press("Tab");
    assert.equal(JSON.parse(await scenario.inputValue()).operationalSubstitutionAvailability, 0.6);
    const shownAllFinancing = await panel.locator('[data-all-financing="2027"]').innerText();
    await page.locator("#openDataModalBtn").click();
    const downloadPromise = page.waitForEvent("download");
    await page.locator("#dlAuditLedgerJson").click();
    const download = await downloadPromise;
    assert.equal(download.suggestedFilename(), "audit4_quarterly_credit_ledger.json");
    const ledger = JSON.parse(await fs.readFile(await download.path(), "utf8"));
    assert.equal(ledger.currency, "USD billions");
    const weightedEntity = Object.keys(ledger.simulationOptions.overrides)
      .find(id => ledger.simulationOptions.overrides[id].financing?.quarterWeights?.[1] === 0);
    assert.ok(weightedEntity);
    const gpuAcquisition = ledger.quarters.find(row => row.quarter === "2027Q1").gpuCashSchedules[weightedEntity];
    assert.equal(gpuAcquisition.purchasesIncludedInBaseCapex, 0.1);
    assert.deepEqual(gpuAcquisition.closingCohorts, [{ acquired: "2027Q1", cost: 0.1, quantity: 1000, unitCostUsd: 100000, generation: "Fixture" }]);
    const gpuRefresh = ledger.quarters.find(row => row.quarter === "2034Q1").gpuCashSchedules[weightedEntity];
    assert.equal(gpuRefresh.replacementCapex, 0.025);
    assert.equal(gpuRefresh.disposalProceeds, 0.005);
    assert.deepEqual(gpuRefresh.fleetQuantities, {
      countedDevices: 1000, primaryCapacityUnits: 1000, includesEveryModeledCohort: true
    });
    assert.deepEqual(gpuRefresh.closingCohorts, [
      { acquired: "2027Q1", cost: 0.05, quantity: 500, unitCostUsd: 100000, generation: "Fixture" },
      { acquired: "2027Q1", cost: 0.025, quantity: 250, unitCostUsd: 100000, generation: "Fixture", lowTier: true },
      { acquired: "2034Q1", cost: 0.025, quantity: 250, unitCostUsd: 100000, generation: "Fixture", performanceUnitsPerGpu: 2 }
    ]);
    assert.equal(Number((gpuRefresh.replacementCapex - gpuRefresh.disposalProceeds).toFixed(4)), gpuRefresh.netReplacementCash);
    const totalCashFinancing = ledger.quarters.filter(row => row.quarter.startsWith("2027"))
      .reduce((sum, row) => sum + row.financingCashSources[weightedEntity].total, 0);
    assert.equal(shownAllFinancing, totalCashFinancing.toFixed(2));
    const zeroWeightQuarter = ledger.quarters.find(row => row.quarter === "2027Q2");
    assert.equal(zeroWeightQuarter.financingCashSources[weightedEntity].scenarioEquity, 0);
    assert.ok(Object.values(ledger.simulationOptions.overrides).some(row => row.capexGrowth === 0.1));
    assert.ok(Object.values(ledger.simulationOptions.overrides).some(row => row.gpuRefresh?.utilizationRate === 0.5));
    assert.ok(Object.values(ledger.simulationOptions.overrides).some(row => row.gpuRefresh?.utilizationRevenueShare === 0.5));
    assert.ok(Object.values(ledger.simulationOptions.overrides).some(row => row.equityPreMoneyValuation === 18));
    const firstQuarter = ledger.quarters[0];
    assert.equal(firstQuarter.quarter, "2026Q4");
    const crwvMargin = firstQuarter.gpuCashSchedules.CRWV;
    assert.equal(crwvMargin.marginStressByFacility.TX27.principal, 10);
    assert.equal(crwvMargin.marginCall, Number(Object.values(crwvMargin.marginStressByFacility)
      .reduce((sum, facility) => sum + facility.marginCall, 0).toFixed(4)));
    assert.ok(Array.isArray(firstQuarter.operationalRevenueLedger));
    assert.equal(typeof firstQuarter.operatingCashBridges.CRWV.endingOCF, "number");
    assert.ok(Array.isArray(firstQuarter.contagionEvents));
    const oracleLiquidity = firstQuarter.liquiditySchedules.ORCL;
    const borrowable = oracleLiquidity.undrawnCredit;
    assert.equal(oracleLiquidity.fundingGap, Number(Math.max(0,
      oracleLiquidity.minimumOperatingCash - oracleLiquidity.endingCash).toFixed(4)));
    assert.equal(oracleLiquidity.requiredFinancing, Number(Math.max(0,
      oracleLiquidity.minimumOperatingCash - oracleLiquidity.endingCash - borrowable).toFixed(4)));
    assert.equal(ledger.scenarioSummary.ORCL.defaultQuarter,
      ledger.quarters.find(row => row.liquiditySchedules.ORCL.distressLevel === 3)?.quarter ?? null);
    const oracleCredit = firstQuarter.secondaryCreditSchedules.ORCL;
    assert.equal(oracleCredit.openingSpreadBps, 0);
    assert.equal(oracleCredit.refinancingMultiplier, 1);
    assert.ok(Number.isFinite(oracleCredit.floatingPrincipal));
    const coreWeaveFinancing = firstQuarter.financingCashSources.CRWV;
    assert.equal(Number(Object.entries(coreWeaveFinancing).filter(([key]) => key !== "total")
      .reduce((sum, [, amount]) => sum + amount, 0).toFixed(4)), coreWeaveFinancing.total);
    assert.equal(firstQuarter.financingLedger.TX26.beginningOutstanding, 4.583);
    const coreWeaveDebt = ledger.parentSpvReconciliation.find(row => row.spvId === "SPV_CRWV8");
    assert.equal(coreWeaveDebt.parentConsolidatedDebt, 46.873);
    assert.equal(coreWeaveDebt.netSystemWidePrincipal, 47.505);
    assert.equal(firstQuarter.financingLedger.TX26.lender, null);
    assert.equal(firstQuarter.financingLedger.TX26.undrawnCommitment, null);
    const tx26 = ledger.transactions.find(tx => tx.id === "TX26");
    assert.equal(tx26.amountDrawn, null);
    assert.equal(tx26.conditionalReconciliationBounds.asOf, "2026-09-30");
    assert.deepEqual(tx26.conditionalReconciliationBounds.cumulativeDrawdown, [4.583, 4.646]);
    const oracleInitialLease = firstQuarter.leaseCashSchedules.ORCL;
    assert.equal(oracleInitialLease.incremental.uncommencedCommitment, 288);
    assert.equal(oracleInitialLease.incremental.payment, 0);
    const oracleStartedLease = ledger.quarters.find(row => row.quarter === "2027Q1").leaseCashSchedules.ORCL;
    assert.equal(oracleStartedLease.incremental.payment, 1.4118);
    assert.equal(oracleStartedLease.principalCashPaid, 0);
    assert.equal(oracleStartedLease.incrementalOperatingCashPaid, 1.4118);
    assert.equal(ledger.quarters.at(-1).quarter, "2034Q4");
    await page.locator("#closeDataModalBtn").click();
    await page.locator('[data-network-entity="CRWV"]').dispatchEvent("click");
    await page.locator("#tabBtnForecast").click();
    if (await panel.getAttribute("open") === null) await panel.locator("summary").click();
    const coreWeaveLease = panel.locator("[data-lease-disclosure]");
    assert.match(await coreWeaveLease.innerText(), /47\.40 \(2026-09-30\)/);
    assert.match(await coreWeaveLease.locator("a").getAttribute("href"), /crwv-20260930\.htm$/);
    assert.match(await coreWeaveLease.innerText(), /18\.697 \/ 0\.649/);
    const hardwareDisclosure = panel.locator("[data-gpu-disclosure]");
    assert.match(await hardwareDisclosure.innerText(), /6/);
    assert.match(await hardwareDisclosure.locator("a").first().getAttribute("href"), /crwv-20251231\.htm$/);
    assert.match(await hardwareDisclosure.innerText(), /250,000 \(2024-12-31\)/);
    assert.match(await hardwareDisclosure.locator("a").last().getAttribute("href"), /d899798ds1\.htm$/);
    assert.equal(await panel.locator('[data-gpu-setting="economicLife"]').inputValue(), "5");
    await page.locator('[data-network-entity="ANTHROPIC"]').dispatchEvent("click");
    await page.locator("#tabBtnForecast").click();
    if (await panel.getAttribute("open") === null) await panel.locator("summary").click();
    assert.equal(await panel.locator('[data-historical-financing="equity-2023"] meter').getAttribute("value"), "0.448");
    assert.equal(await panel.locator('[data-historical-financing="equity-2025"] meter').getAttribute("value"), "16.659");
    const anthropicLease = panel.locator("[data-lease-disclosure]");
    assert.match(await anthropicLease.innerText(), /451\.20 \(2026-09-30\)/);
    assert.match(await anthropicLease.innerText(), /2\.810 \/ 1\.674/);
    assert.match(await anthropicLease.locator("a").getAttribute("href"), /anthropicpbc-424b4\.htm$/);
    await panel.locator("[data-disclosed-lease-stress]").selectOption("10");
    assert.equal(JSON.parse(await scenario.inputValue()).disclosedLeaseStressYears, 10);
    for (const [id, life, filing] of [
      ["MSFT", /2–6/, /msft-20260630\.htm$/],
      ["AMZN", /5.*(?:subset|\u90e8\u5206)/, /amzn-20251231\.htm$/],
      ["GOOGL", /6/, /goog-20251231\.htm$/],
      ["META", /5–5\.5/, /meta-20251231\.htm$/],
      ["ORCL", /6/, /orcl-20260831\.htm$/]
    ]) {
      await page.locator('[data-network-entity="' + id + '"]').dispatchEvent("click");
      await page.locator("#tabBtnForecast").click();
      if (await panel.getAttribute("open") === null) await panel.locator("summary").click();
      const disclosure = panel.locator("[data-gpu-disclosure]");
      assert.match(await disclosure.innerText(), life);
      assert.match(await disclosure.locator("a").getAttribute("href"), filing);
    }
    await page.locator('[data-network-entity="OPENAI"]').dispatchEvent("click");
    await page.locator("#tabBtnForecast").click();
    if (await panel.getAttribute("open") === null) await panel.locator("summary").click();
    const tranches = panel.locator("[data-financing-tranche]");
    assert.equal(await tranches.count(), 6);
    const octoberTranche = panel.locator('[data-financing-tranche="2026-10-01"]');
    assert.match(await octoberTranche.innerText(), /2026-10-01 \$10B \(SoftBank Vision Fund 2\)/);
    assert.match(await octoberTranche.getAttribute("href"), /financial-report_q2fy2026_01_en\.pdf$/);
    const amazonTranche = panel.locator('[data-financing-tranche="2026Q3"]');
    assert.match(await amazonTranche.innerText(), /2026Q3 \$21\.3B \(Amazon\)/);
    assert.match(await amazonTranche.getAttribute("href"), /amzn-20260930\.htm$/);
    await page.locator('[data-network-entity="NVDA"]').dispatchEvent("click");
    await page.locator("#tabBtnForecast").click();
    if (await panel.getAttribute("open") === null) await panel.locator("summary").click();
    await panel.locator("[data-nvidia-lease-preset]").selectOption("annual");
    assert.equal(JSON.parse(await scenario.inputValue()).includeNvidiaLeaseBuckets, true);
    await page.locator('[data-network-entity="AMZN"]').dispatchEvent("click");
    await page.locator("#tabBtnForecast").click();
    if (await panel.getAttribute("open") === null) await panel.locator("summary").click();
    await page.locator('[data-network-entity="IREN"]').dispatchEvent("click");
    await page.locator("#tabBtnForecast").click();
    if (await panel.getAttribute("open") === null) await panel.locator("summary").click();
    assert.match(await panel.locator("[data-gpu-disclosure]").innerText(), /150,000 \(2026-03-31\)/);
    await page.locator('[data-network-entity="AMZN"]').dispatchEvent("click");
    await page.locator("#tabBtnForecast").click();
    if (await panel.getAttribute("open") === null) await panel.locator("summary").click();
    const equipmentDraw = panel.locator('[data-equipment-draw="2027Q1"]');
    await equipmentDraw.fill("2");
    await equipmentDraw.press("Tab");
    assert.equal(JSON.parse(await scenario.inputValue()).facilityDrawdowns.AMZN_EQUIPMENT_DDTL["2027Q1"], 2);
    await page.locator("#openDataModalBtn").click();
    const equipmentDownload = page.waitForEvent("download");
    await page.locator("#dlAuditLedgerJson").click();
    const equipmentExport = JSON.parse(await fs.readFile(await (await equipmentDownload).path(), "utf8"));
    const equipmentQuarter = equipmentExport.quarters.find(entry => entry.quarter === "2027Q1");
    const equipmentFacility = equipmentQuarter.financingLedger.AMZN_EQUIPMENT_DDTL;
    assert.equal(equipmentFacility.newDrawdown, 2);
    assert.equal(equipmentQuarter.financingCashSources.AMZN.contractualTermDraw, 2);
    assert.deepEqual(equipmentFacility.trancheBalances, [
      { drawQuarter: "2027Q1", maturityQuarter: "2032Q1", principal: 2 }
    ]);
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
