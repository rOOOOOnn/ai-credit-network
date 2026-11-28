const engine = require("../engine/contagion_engine.js");
const entities = require("../data/entities.json");
const transactions = require("../data/transactions.json");

const schedules = {
  base: [20, 18],
  taper: [12, 6],
  freeze: [0, 0]
};
const profiles = [
  ["Base", "base", 1, 0],
  ["Revenue slowdown", "base", 0.5, 50],
  ["Funding taper (downside)", "taper", 1, 100],
  ["Funding freeze", "freeze", 1, 200],
  ["Combined severe stress", "freeze", 0.5, 250]
];

if (process.argv.includes("--operating-paths")) {
  console.log("| Entity | Operating path | Revenue | OCF | FCF | End cash | Funding gap | Runway months | Funding dependency | First default | First FCF break-even | Nonnegative FCF through cutoff since |");
  console.log("| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- | --- |");
  for (const id of ["OPENAI", "ANTHROPIC"]) {
    const paths = [["Scale effects", 0.55, 0.01, true], ["Cost pressure", 0.05, 0.15, true]];
    if (id === "ANTHROPIC") {
      paths.push(["Scale effects without IPO receipt", 0.55, 0.01, false],
        ["Cost pressure without IPO receipt", 0.05, 0.15, false]);
    }
    for (const [name, margin, capexGrowth, includeScheduledEquity] of paths) {
      const result = engine.runSimulation(entities, transactions, {
        audit4Contracts: true,
        overrides: { [id]: { revGrowth: 0.07, ocfMarginBeforeFinancing: margin, capexGrowth, includeScheduledEquity,
          financing: { mode: "manual", capacity: 0 } } }
      });
      const { revenue, ocf, fcf, cash, fundingGap, cashRunwayMonths, financingDependency } =
        result.timeline["2028Q4"].entities[id];
      const { defaultQuarter, breakEvenQuarter } = result.scenarioSummary[id];
      const forecast = Object.values(result.timeline).filter(row => row.financingLedger && row.quarter <= "2028Q4");
      const lastNegative = forecast.findLastIndex(row => !(row.entities[id].fcf >= 0));
      const sustainedSince = forecast[lastNegative + 1]?.quarter;
      console.log("| " + [id, name, revenue, ocf, fcf, cash, fundingGap, cashRunwayMonths, financingDependency,
        defaultQuarter, breakEvenQuarter, sustainedSince]
        .map(value => value ?? "—").join(" | ") + " |");
    }
  }
  process.exit(0);
}

console.log("| Entity | Scenario | End cash | OCF | FCF | Quarterly burn | Funding dependency | Available liquidity | Runway (months) | Funding gap | Required financing | Minimum FCF revenue growth | First default | First FCF break-even |");
console.log("| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- |");
for (const id of ["OPENAI", "ANTHROPIC"]) {
  const entity = entities.find(row => row.id === id);
  for (const [name, path, growthFactor, spreadBps] of profiles) {
    const annual = Object.fromEntries(schedules[path].map((equity, i) => [2027 + i, { equity }]));
    const result = engine.runSimulation(entities, transactions, {
      audit4Contracts: true,
      ocean: { creditTighteningBps: spreadBps },
      overrides: { [id]: {
        revGrowth: entity.defaults.revGrowth * growthFactor,
        interestRate: entity.defaults.interestRate + spreadBps / 10000,
        financing: { mode: "manual", annual, capacity: 38, quarterlyLimit: 5 }
      } }
    });
    const state = result.timeline["2028Q4"].entities[id];
    const event = result.scenarioSummary[id];
    console.log("| " + [id, name, state.cash, state.ocf, state.fcf, state.quarterlyCashBurn,
      state.financingDependency, state.availableLiquidity, state.cashRunwayMonths, state.fundingGap,
      state.requiredFinancing, state.minimumRequiredRevenueGrowth, event.defaultQuarter, event.breakEvenQuarter]
      .map(value => value ?? "—").join(" | ") + " |");
  }
}
