const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const { readFileSync } = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const report = readFileSync(path.join(root, "docs/audit4_remediation_report.md"), "utf8");
const replays = [
  ["replay_audit4_financing.cjs", [], "## Reproducible comparison on the current data"],
  ["replay_audit4_financing.cjs", ["2031Q4"], "### Companion Audit 4 archive review"],
  ["replay_audit4_gpu.cjs", [], "### Full-engine 3–7 year GPU sensitivity"],
  ["replay_audit4_sustainability.cjs", [], "### Financing sustainability across five comparable stresses"]
];

for (const [script, args, heading] of replays) {
  const actual = execFileSync(process.execPath, [path.join(root, "scripts", script), ...args], {
    cwd: root,
    encoding: "utf8"
  }).trim().split(/\r?\n/);
  const start = report.indexOf(heading);
  assert.notEqual(start, -1, heading + " missing");
  const table = report.slice(start).match(/^(?:\|[^\r\n]*\r?\n)+/m);
  assert.ok(table, heading + " table missing");
  assert.deepEqual(actual, table[0].trim().split(/\r?\n/), heading + " numbers differ");
  console.log(heading + " matches " + (actual.length - 2) + " report rows");
}
