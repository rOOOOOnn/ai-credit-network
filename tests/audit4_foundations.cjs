const assert = require("node:assert/strict");
const engine = require("../engine/contagion_engine.js");
const entities = require("../data/entities.json");
const transactions = require("../data/transactions.json");

const curve = { mode: "curve", base: { equity: 10 }, initialGrowth: 0.8, annualDecline: 0.2 };
assert.equal(engine.financingForecast(curve, 2027).amounts.equity, 18);
assert.equal(engine.financingForecast(curve, 2028).amounts.equity, 28.8);
assert.equal(engine.financingForecast({ ...curve, curve: "historical" }, 2027).status, "Insufficient Historical Data");
assert.deepEqual(engine.financingForecast({ mode: "curve", curve: "historical", history: {
  2025: { dataType: "Actual", fullYear: true, amounts: { equity: 20 } },
  2026: { dataType: "Actual", fullYear: true, amounts: { equity: 30 } }
} }, 2027).amounts, { equity: 45 });

for (const life of [3, 4, 5, 6, 7]) {
  const fleet = [{ acquired: "2026Q4", cost: 100 }];
  const assumptions = { economicLife: life, replacementRatio: 0.25, residualValue: 0.2, priceDecline: 0.1 };
  assert.equal(engine.fleetRefresh(fleet, `${2026 + life}Q3`, assumptions).replacementCapex, 0);
  const atThreshold = engine.fleetRefresh(fleet, `${2026 + life}Q4`, assumptions);
  assert.equal(atThreshold.replacementCapex, 22.5);
  assert.equal(atThreshold.disposalProceeds, 5);
  assert.deepEqual(atThreshold.cohorts.map(cohort => cohort.cost), [75, 22.5]);
}

const funding = { mode: "manual", annual: { 2027: { equity: 20 } }, capacity: 7, quarterlyLimit: 4 };
const baseline = engine.runSimulation(entities, transactions, { overrides: { OPENAI: { financing: { ...funding, capacity: 0 } } } });
const funded = engine.runSimulation(entities, transactions, { overrides: { OPENAI: { financing: funding } } });
const state = (result, quarter) => result.timeline[quarter].entities.OPENAI;
assert.equal(state(funded, "2027Q1").equityInflow, 4);
assert.equal(state(funded, "2027Q2").equityInflow, 3);
assert.equal(state(funded, "2027Q3").equityInflow, 0);
assert.equal(Number((state(funded, "2027Q1").cash - state(baseline, "2027Q1").cash).toFixed(4)), 4);

const lease = { startQuarter: "2027Q1", termQuarters: 2, quarterlyPayment: 1.25 };
const leased = engine.runSimulation(entities, transactions, { overrides: { OPENAI: { financing: funding, incrementalLease: lease } } });
assert.equal(state(leased, "2026Q4").incrementalLeasePayment, 0);
assert.equal(state(leased, "2027Q1").incrementalLeasePayment, 1.25);
assert.equal(state(leased, "2027Q3").incrementalLeasePayment, 0);
assert.equal(Number((state(funded, "2027Q1").ocf - state(leased, "2027Q1").ocf).toFixed(4)), 1.25);

const extended = engine.runSimulation(entities, transactions, { forecastThrough: 2033 });
assert.equal(extended.timeline["2033Q4"].status, "FORECAST");
assert.equal(extended.allQuarters.at(-1), "2033Q4");
console.log("Audit 4 foundational tests passed");
