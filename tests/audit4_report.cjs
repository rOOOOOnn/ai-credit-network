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
  ["tests/audit4_foundations.cjs", ["--audited-stress-markdown"], "### A–G stress tests on the audited profile"]
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
for (const [, id, cells] of entityRows) {
  const [quarter, classification, disclosureDate, source, gaps] = cells.split(" | ");
  assert.match(quarter, /^(?:\d{4}Q[1-4]|—)$/, id + " needs a quarter or an unavailable marker");
  assert.match(classification, /^(?:Actual|Estimated|Assumption|Forecast|Unavailable)/, id + " needs a classification");
  assert.match(disclosureDate, /^(?:\d{4}-\d{2}-\d{2}|—)$/, id + " needs a disclosure date or an unavailable marker");
  assert.match(source, /(?:https:\/\/|^—$)/, id + " needs a source or a missing source marker");
  assert.ok(gaps?.trim(), id + " needs a missing-fields disclosure");
}
console.log("Source inventory covers " + entities.length + " entities");
