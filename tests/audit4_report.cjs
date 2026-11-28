const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const { readFileSync } = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const report = readFileSync(path.join(root, "docs/audit4_remediation_report.md"), "utf8");
const replays = [
  ["scripts/replay_audit4_financing.cjs", [], "## Reproducible comparison on the current data"],
  ["scripts/replay_audit4_financing.cjs", ["2031Q4"], "### Companion Audit 4 archive review"],
  ["scripts/replay_audit4_financing.cjs", ["--openai-october-receipt"], "### OpenAI October receipt under scenario financing freeze"],
  ["scripts/replay_audit4_gpu.cjs", [], "### Full-engine 3–7 year GPU sensitivity"],
  ["scripts/replay_audit4_sustainability.cjs", [], "### Financing sustainability across five comparable stresses"],
  ["scripts/replay_audit4_sustainability.cjs", ["--operating-paths"], "### Scale effects and cost pressure at equal revenue growth"],
  ["tests/audit4_foundations.cjs", ["--audited-stress-markdown"], "### A–G stress tests on the audited profile"],
  ["tests/audit4_foundations.cjs", ["--extended-stress-markdown"], "### Extended A–G stress replay"]
];

for (const [script, args, heading] of replays) {
  const actual = execFileSync(process.execPath, [path.join(root, script), ...args], {
    cwd: root,
    encoding: "utf8"
  }).split(/\r?\n/).filter(line => line.startsWith("|"));
  const start = report.indexOf(heading);
  assert.notEqual(start, -1, heading + " missing");
  const table = report.slice(start).match(/^(?:\|[^\r\n]*\r?\n)+/m);
  assert.ok(table, heading + " table missing");
  assert.deepEqual(actual, table[0].trim().split(/\r?\n/), heading + " numbers differ");
  console.log(heading + " matches " + (actual.length - 2) + " report rows");
}
const entities = require("../data/entities.json");
const register = readFileSync(path.join(root, "docs/audit4_entity_source_register.md"), "utf8");
const [inventory] = register.split(/\r?\n\r?\n###? /);
const entityRows = [...inventory.matchAll(/^\| ([A-Z][A-Z0-9_]*) \| (.+) \|$/gm)];
assert.deepEqual(entityRows.map(row => row[1]).sort(), entities.map(entity => entity.id).sort(),
  "The source inventory must contain every repository entity exactly once");
const entitiesById = new Map(entities.map(entity => [entity.id, entity]));
for (const [, id, cells] of entityRows) {
  const [quarter, classification, disclosureDate, source, gaps] = cells.split(" | ");
  assert.match(quarter, /^(?:\d{4}Q[1-4]|—)$/, id + " needs a quarter or an unavailable marker");
  assert.match(classification, /^(?:Actual|Estimated|Assumption|Forecast|Unavailable)/, id + " needs a classification");
  assert.match(disclosureDate, /^(?:\d{4}-\d{2}-\d{2}|—)$/, id + " needs a disclosure date or an unavailable marker");
  assert.match(source, /(?:https:\/\/|^—$)/, id + " needs a source or a missing source marker");
  assert.ok(gaps?.trim(), id + " needs a missing-fields disclosure");
  const financials = entitiesById.get(id).financials ?? {};
  const latestQuarter = Object.keys(financials).sort().at(-1);
  if (latestQuarter) {
    assert.equal(quarter, latestQuarter, id + " source register quarter differs from the dataset");
    const latest = financials[latestQuarter];
    if (latest.disclosedDate) {
      assert.equal(disclosureDate, latest.disclosedDate, id + " source register disclosure date differs from the dataset");
    }
  }
}
console.log("Source inventory covers " + entities.length + " entities");

const { renderFieldCoverage } = require("../scripts/render_audit4_field_coverage.cjs");
const fieldCoverage = readFileSync(path.join(root, "docs/audit4_field_coverage.md"), "utf8");
assert.equal(fieldCoverage.replace(/\r\n/g, "\n"), renderFieldCoverage(entities),
  "Regenerate the historical field coverage matrix after updating entity data");
const coverageRow = id => fieldCoverage.split(/\r?\n/).find(row => row.startsWith("| " + id + " |"));
const vertiv = entitiesById.get("VERTIV").financials["2026Q3"];
assert.equal(Object.values(vertiv.noncurrentDeferredRevenueRecognition).reduce((sum, value) => sum + value, 0).toFixed(4), "0.1252");
assert.equal(vertiv.rpo, undefined);
assert.match(coverageRow("VERTIV"), /0\.3397 · Actual \[Source\]/);
const constellation = entitiesById.get("CEG").financials["2026Q3"];
assert.equal(Object.values(constellation.longTermBorrowingsPrincipalByType)
  .reduce((sum, value) => sum + value, 0).toFixed(3), "19.524");
assert.equal((constellation.longTermBorrowingsPrincipal - constellation.longTermBorrowingsCurrentPortion -
  Object.values(constellation.longTermBorrowingsUnamortizedAdjustments)
    .reduce((sum, value) => sum + value, 0)).toFixed(3), "19.039");
assert.match(coverageRow("CEG"), /\| — \| 4\.9 · Actual \[Source\]/);
const vistra = entitiesById.get("VST").financials["2026Q3"];
assert.equal((vistra.shortTermDebt + vistra.longTermDebt).toFixed(3), "21.146");
assert.equal(Object.values(vistra.rpoRecognitionBuckets).reduce((sum, amount) => sum + amount, 0).toFixed(3), "7.847");
assert.equal(vistra.accountsPayable, 1.503);
assert.match(coverageRow("DLR"), /\| — \| 3\.609832 · Actual \|/);
const digitalRealty = entitiesById.get("DLR").financials["2026Q3"];
assert.equal(Object.values(digitalRealty.debtMaturity).reduce((sum, amount) => sum + amount, 0).toFixed(6), "19.618975");
assert.equal((digitalRealty.reportedBorrowingPrincipal - digitalRealty.unamortizedNetDebtDiscounts -
  digitalRealty.unamortizedDeferredFinancingCosts).toFixed(6), "19.494615");
assert.match(coverageRow("EQIX"), /\| — \| 1\.425 · Actual \|/);
assert.match(coverageRow("EQIX"), /0\.27 · Assumption \(Legacy quarterly model input\) \| 0\.128 · Actual/);
assert.match(coverageRow("EQIX"), /0\.1 · Actual \(Individual customer revenue and receivables\)/);
const equinix = entitiesById.get("EQIX").financials["2026Q3"];
assert.equal(Object.values(equinix.debtMaturity).reduce((sum, value) => sum + value, 0).toFixed(3), "22.839");
const leaseMaturities = equinix.commencedLeaseMaturities;
assert.equal((leaseMaturities.operatingPayments.reduce((sum, value) => sum + value, 0) -
  leaseMaturities.operatingImputedInterest).toFixed(3), "1.386");
assert.equal((leaseMaturities.financePayments.reduce((sum, value) => sum + value, 0) -
  leaseMaturities.financeImputedInterest).toFixed(3), "2.378");
assert.equal((equinix.operatingLeaseLiability + equinix.financeLeaseLiability).toFixed(3), "3.764");
assert.match(coverageRow("EQIX"), /3\.764 · Actual \| 1\.386 · Actual \| 2\.378 · Actual/);
const appliedDigital = entitiesById.get("APLD").financials["2026Q3"];
assert.equal(Object.values(appliedDigital.debtMaturity).reduce((sum, amount) => sum + amount, 0).toFixed(6), "6.721605");
assert.equal((appliedDigital.reportedBorrowingPrincipal - appliedDigital.unamortizedDeferredFinancingCosts).toFixed(6), "6.376592");
assert.match(coverageRow("APLD"), /Structured · Actual \(Fiscal-year principal, USD billions\)/);
assert.match(coverageRow("AMD"), /4\.75 · Assumption \(Reserves the full letter-of-credit sublimit; actual usage unavailable\) \[Source\]\(https:\/\/[^)]+amd-20260926\.htm\)/);
assert.match(coverageRow("CORZ"), /0\.068 · Assumption \(Legacy quarterly model input\) \| 0\.054066 · Actual/);
console.log("Historical field coverage matrix matches repository snapshots");

const spacex = entitiesById.get("SPCX_XAI");
const siSnapshot = spacex.financials["2026Q3"];
const consolidated = spacex.audit4ConsolidatedEvidence;
assert.equal(siSnapshot.dataType, "Assumption");
assert.equal(siSnapshot.revenueDataType, "Actual");
assert.equal(siSnapshot.revenue, 7.56);
assert.equal(consolidated.quarterRevenue, 14.575);
assert.equal((consolidated.currentDebtAndFinanceLeases + consolidated.noncurrentDebtAndFinanceLeases).toFixed(3), "38.844");
assert.match(coverageRow("SPCX_XAI"), /7\.56 · Actual \(SpaceX Super Intelligence segment only\)/);

assert.equal(spacex.dataType, "Assumption");
const spacexCsv = readFileSync(path.join(root, "data/entities.csv"), "utf8")
  .split(/\r?\n/).find(line => line.startsWith("SPCX_XAI,"));
assert.equal(spacexCsv.split(",").at(-1), "Assumption");
const historicalSi = require("../engine/contagion_engine.js").getHistoricalSnapshot(spacex, "2026Q3");
assert.equal(historicalSi.dataType, "Assumption");
assert.equal(historicalSi.revenueDataType, "Actual");
assert.equal(historicalSi.hasActual, false);

const metaSnapshot = entitiesById.get("META").financials["2026Q3"];
assert.deepEqual(
  [metaSnapshot.revenue, metaSnapshot.cash, metaSnapshot.ar, metaSnapshot.accountsPayable, metaSnapshot.longTermDebt],
  [64.601, 11.222, 22.716, 19.097, 80.922]
);
assert.equal(metaSnapshot.operatingLeaseLiability, (2522 + 28651) / 1000);

const microsoftSnapshot = entitiesById.get("MSFT").financials["2026Q3"];
assert.deepEqual(
  [microsoftSnapshot.cash, microsoftSnapshot.accountsPayable, microsoftSnapshot.shortTermDebt, microsoftSnapshot.longTermDebt],
  [20.281, 42.625, 4.391, 31.090]
);
assert.equal(microsoftSnapshot.debt, (4391 + 31090) / 1000);
const amazonSnapshot = entitiesById.get("AMZN").financials["2026Q3"];
assert.deepEqual([amazonSnapshot.cash, amazonSnapshot.accountsPayable], [55.783, 158.715]);
assert.equal(amazonSnapshot.shortTermDebt, (6827 + 380) / 1000);
assert.equal(amazonSnapshot.longTermDebt, (180887 - 935 - 6827) / 1000);
assert.equal(amazonSnapshot.debt, (180887 - 935 + 380) / 1000);

const alphabetSnapshot = entitiesById.get("GOOGL").financials["2026Q3"];
assert.deepEqual([alphabetSnapshot.cash, alphabetSnapshot.ar, alphabetSnapshot.accountsPayable],
  [56.334, 72.784, 21.975]);
assert.deepEqual([alphabetSnapshot.shortTermDebt, alphabetSnapshot.longTermDebt, alphabetSnapshot.debt],
  [1.016, 125.102, (1016 + 125102) / 1000]);
assert.equal(alphabetSnapshot.leaseLiab, (20508 + 3705) / 1000);
assert.equal(alphabetSnapshot.offBalanceLeases, 130.5);

const coreWeaveSnapshot = entitiesById.get("CRWV").financials["2026Q3"];
const tx26Disclosure = require("../data/transactions.json").find(tx => tx.id === "TX26");
const consolidatedMaturities = [2433, 10974, 5479, 4727, 4247, 19645];
assert.equal(consolidatedMaturities.reduce((sum, value) => sum + value), 47505);
assert.equal(coreWeaveSnapshot.debt, (47505 - 552 - 80) / 1000);
assert.equal(tx26Disclosure.principalOutstanding, 4.583);
assert.equal((4583 + 770 - 80) / 1000, 5.273);
assert.equal(tx26Disclosure.carryingValue, null);

const nvidiaSnapshot = entitiesById.get("NVDA").financials["2026Q3"];
assert.equal(nvidiaSnapshot.periodEnd, "2026-10-25");
assert.deepEqual([nvidiaSnapshot.cash, nvidiaSnapshot.longTermDebt, nvidiaSnapshot.noncurrentOperatingLeaseLiability],
  [29.089, 32.371, 5.777]);
assert.equal(nvidiaSnapshot.leaseLiab, null);
assert.match(coverageRow("NVDA"), /5\.777 · Actual/);

const oracleSnapshot = entitiesById.get("ORCL").financials["2026Q3"];
assert.equal(oracleSnapshot.periodEnd, "2026-08-31");
assert.equal(oracleSnapshot.leaseLiab, (4027 + 30594 + 749 + 8436) / 1000);
assert.equal(oracleSnapshot.offBalanceLeases, 288);

assert.equal(vertiv.noncurrentLeaseLiability, 0.3397);
assert.equal(constellation.longTermBorrowingsPrincipal, 19.524);
assert.equal(vistra.debt, 21.146);
assert.equal(vistra.cash, 2.743);
assert.equal(vistra.undrawnCredit, (5500 - 786) / 1000);

for (const entity of entities) {
  const snapshot = entity.financials?.["2026Q3"];
  if (snapshot?.offBalanceGuarantees === 0) assert.ok(snapshot.offBalanceGuaranteesSourceUrl, entity.id);
}
const corzNotes = entitiesById.get("CORZ").audit4Facilities;
const corzConvertible = corzNotes.find(row => row.id === "CORZ_CONVERTIBLE_2031");
const corzSecured = corzNotes.find(row => row.id === "CORZ_SECURED_2031");
assert.deepEqual([corzConvertible.amountDrawn, corzConvertible.reportedCashCoupon], [0.625, 0]);
assert.deepEqual([corzSecured.amountDrawn, corzSecured.reportedCashCoupon], [3.3, 0.0775]);
assert.equal((3300 * corzSecured.principalSchedule.annualRate / 2).toFixed(2), "189.75");

assert.equal(equinix.offBalanceLeases, 0.694);
assert.match(equinix.offBalanceLeasesSourceUrl, /eqix-20260930[.]htm$/);
const dlrRevolver = entitiesById.get("DLR").audit4Facilities.find(row => row.id === "DLR_GLOBAL_RCF");
assert.equal(dlrRevolver.principalOutstanding, 1.655570);
assert.equal(dlrRevolver.lettersOfCredit, 0.1008);
assert.equal(dlrRevolver.remainingCommitment, Number((4.470 - 1.655570 - 0.1008).toFixed(4)));
assert.equal(dlrRevolver.lenderAllocationVerified, false);

const anthropicSource = entitiesById.get("ANTHROPIC");
assert.equal(anthropicSource.dataType, "Assumption");
assert.equal(anthropicSource.financials["2026Q3"].dataType, "Assumption");
assert.equal(anthropicSource.audit4Liquidity.cashAndEquivalents, 95.6);
assert.equal(anthropicSource.audit4Observations.nineMonthOperatingCashFlow, 6.569);
assert.equal(anthropicSource.audit4Observations.standaloneQ3OperatingCashFlow, null);

for (const entity of entities) {
  const latestQuarter = Object.keys(entity.financials ?? {}).sort().at(-1);
  if (latestQuarter) assert.equal(entity.dataType, entity.financials[latestQuarter].dataType, entity.id);
}
const irenGpuOne = entitiesById.get("IREN").audit4Facilities
  .filter(row => ["IREN_GPU1_DDTL", "IREN_GPU1_USPP"].includes(row.id));
assert.equal(irenGpuOne.length, 2);
const gpuOneSum = key => Math.round(irenGpuOne.reduce((sum, row) => sum + row[key], 0) * 1000);
assert.equal(gpuOneSum("amountDrawn"), 1988);
assert.equal(gpuOneSum("principalOutstanding"), 1980);
assert.equal(gpuOneSum("remainingCommitment"), 1657);
assert.equal(gpuOneSum("amountDrawn") + gpuOneSum("remainingCommitment"), gpuOneSum("totalCommitment"));

const irenOctoberDraw = irenGpuOne.find(row => row.id === "IREN_GPU1_DDTL").subsequentDraw;
const irenNotes = irenGpuOne.find(row => row.id === "IREN_GPU1_USPP");
assert.deepEqual([irenOctoberDraw.date, irenOctoberDraw.amount], ["2026-10-01", 0.388]);
assert.deepEqual([irenNotes.subsequentEscrowRelease.date, irenNotes.subsequentEscrowRelease.amount,
  irenNotes.restrictedProceedsEscrow], ["2026-10-01", 0.525, 1.05]);
