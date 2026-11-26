const engine = require("../engine/contagion_engine.js");
const entities = require("../data/entities.json");
const transactions = require("../data/transactions.json");

const quarters = ["2030Q4", "2032Q4"];
const scenarios = [3, 4, 5, 6, 7].map(life => ({ life, stress: false }));
scenarios.push({ life: 4, stress: true });

console.log("| Entity | Life | Profile | First refresh | 2030Q4 cash | 2030Q4 gap | 2032Q4 cash | 2032Q4 gap | First default |");
console.log("| --- | ---: | --- | --- | ---: | ---: | ---: | ---: | --- |");
for (const id of ["CRWV", "OPENAI", "ANTHROPIC", "ORCL"]) {
  const entity = entities.find(row => row.id === id);
  for (const { life, stress } of scenarios) {
    const config = {
      gpuRefresh: {
        cohorts: [{ acquired: "2026Q4", cost: 10 }], economicLife: life,
        replacementRatio: 0.25, residualValue: stress ? 0.05 : 0.2, priceDecline: stress ? 0.3 : 0.1
      },
      ...(stress ? {
        revGrowth: entity.defaults.revGrowth / 2,
        interestRate: entity.defaults.interestRate + 0.02,
        financing: { mode: "manual", capacity: 0, quarterlyLimit: 0 }
      } : {})
    };
    const result = engine.runSimulation(entities, transactions, {
      audit4Contracts: true, forecastThrough: 2033, overrides: { [id]: config }
    });
    const first = result.allQuarters.find(q => result.timeline[q].entities[id].replacementCapex > 0);
    const metrics = quarters.flatMap(q => {
      const row = result.timeline[q].entities[id];
      return [row.cash, row.fundingGap];
    });
    console.log("| " + [id, life, stress ? "Combined stress" : "Reference", first ?? "—", ...metrics,
      result.scenarioSummary[id].defaultQuarter ?? "—"].join(" | ") + " |");
  }
}
