const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const { readFileSync } = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const report = readFileSync(path.join(root, "docs/audit4_remediation_report.md"), "utf8");
const replays = [
  ["scripts/replay_audit4_financing.cjs", [], "## Reproducible comparison on the current data"],
  ["scripts/replay_audit4_financing.cjs", ["2031Q4"], "### Companion Audit 4 archive review"],
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
