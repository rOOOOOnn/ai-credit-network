const { execFileSync } = require("node:child_process");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const baseline = "a515599901f062c138f3a86fadf360817f96c4b7";
const gitShow = file => execFileSync("git", ["show", baseline + ":" + file], {
  cwd: root, encoding: "utf8", maxBuffer: 4 * 1024 * 1024
});
const baselineModule = { exports: {} };
vm.runInNewContext(gitShow("engine/contagion_engine.js"), { module: baselineModule });

const versions = {
  Continuation: {
    engine: baselineModule.exports,
    entities: JSON.parse(gitShow("data/entities.json")),
    transactions: JSON.parse(gitShow("data/transactions.json")),
    audit4Contracts: false
  },
  Remediated: {
    engine: require("../engine/contagion_engine.js"),
    entities: require("../data/entities.json"),
    transactions: require("../data/transactions.json"),
    audit4Contracts: true
  }
};
const scenarios = {
  Manual: { mode: "manual", capacity: 30, quarterlyLimit: 5, annual: { 2027: { equity: 20 }, 2028: { equity: 10 } } },
  Curve: { mode: "curve", capacity: 30, quarterlyLimit: 5, base: { equity: 12 }, initialGrowth: 0.5, annualDecline: 0.25 },
  Freeze: { mode: "manual", capacity: 0, quarterlyLimit: 5, annual: { 2027: { equity: 20 }, 2028: { equity: 10 } } }
};
console.log("| Version | Entity | Path | Cash | Funding gap | Runway months | First default | FCF break-even |");
console.log("| --- | --- | --- | ---: | ---: | ---: | --- | --- |");
const display = value => value ?? "—";
for (const entity of ["OPENAI", "ANTHROPIC", "CRWV"]) {
  for (const [scenario, financing] of Object.entries(scenarios)) {
    for (const [label, version] of Object.entries(versions)) {
      const result = version.engine.runSimulation(version.entities, version.transactions, {
        audit4Contracts: version.audit4Contracts, overrides: { [entity]: { financing } }
      });
      const final = result.timeline["2028Q4"].entities[entity];
      const summary = result.scenarioSummary[entity];
      console.log("| " + [label, entity, scenario, final.cash, final.fundingGap, final.cashRunwayMonths,
        summary.defaultQuarter, summary.breakEvenQuarter].map(display).join(" | ") + " |");
    }
  }
}
