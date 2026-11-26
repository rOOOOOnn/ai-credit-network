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


const equalSources = { equity: 4, strategic: 4, prepayment: 4, other: 4 };
const tight = { mode: "manual", annual: { 2027: equalSources }, capacity: 1.0003, quarterlyLimit: 1.0003 };
const simulate = (overrides, other = {}) => engine.runSimulation([entities.find(e => e.id === "OPENAI"), ...entities.filter(e => e.id !== "OPENAI")], transactions, {
  overrides: { OPENAI: overrides }, ...other
});
const capped = simulate({ financing: tight });
const first = state(capped, "2027Q1");
assert.deepEqual(Object.values(first.financingForecast.amounts).sort((a, b) => a - b), [0, 0, 0.25, 0.2501, 0.2501, 0.2501]);
assert.equal(first.equityInflow, 1.0003);
assert.equal(first.financingForecast.remainingCapacity, 0);
assert.equal(state(capped, "2027Q2").equityInflow, 0);
const zero = simulate({ financing: { ...tight, quarterlyLimit: 0 } });
assert.equal(state(zero, "2027Q1").equityInflow, 0);
assert.equal(state(zero, "2027Q1").financingForecast.remainingCapacity, 1.0003);
assert.equal(Number((first.cash - state(zero, "2027Q1").cash).toFixed(4)), 1.0003);
const mixedFunding = { ...tight, capacity: 20, quarterlyLimit: 10, annual: { 2027: { equity: 8, debt: 40, assetBacked: 40 } } };
const constrained = state(simulate({ financing: mixedFunding }, { ocean: { maxCapacity: 0.125 } }), "2027Q1");
const { amounts, fundedDebt, fundedRollover, remainingCapacity } = constrained.financingForecast;
assert.equal(fundedDebt, 0.125);
assert.equal(fundedRollover, 0);
assert.equal(amounts.debt, 0.0625);
assert.equal(amounts.assetBacked, 0.0625);
assert.equal(constrained.equityInflow, amounts.equity);
assert.equal(remainingCapacity, Number((20 - amounts.equity - 0.125).toFixed(4)));
const priorDebt = state(simulate({ financing: mixedFunding }, { ocean: { maxCapacity: 0.125 } }), "2026Q4").debt;
assert.equal(constrained.debt, Number(Math.max(0, priorDebt + constrained.newDebt + constrained.rcfDraw - constrained.principalRepay).toFixed(4)));
assert.equal(constrained.cash, Number((constrained.begCash + constrained.fcf + constrained.equityInflow + constrained.newDebt +
  constrained.rcfDraw - constrained.principalRepay - constrained.gpuMarginCall).toFixed(4)));
const leaseOptions = { minCash: 300, financing: { ...funding, annual: { 2027: { equity: 200 } }, capacity: 200, quarterlyLimit: 50 } };
const withoutLease = simulate(leaseOptions);
const withLease = simulate({ ...leaseOptions, incrementalLease: lease });
for (const [quarter, payment, cumulative] of [["2026Q4", 0, 0], ["2027Q1", 1.25, 1.25], ["2027Q2", 1.25, 2.5], ["2027Q3", 0, 2.5]]) {
  const before = state(withoutLease, quarter);
  const after = state(withLease, quarter);
  assert.equal(after.incrementalLeasePayment, payment);
  assert.equal(Number((before.ocf - after.ocf).toFixed(4)), payment);
  assert.equal(Number((before.fcf - after.fcf).toFixed(4)), payment);
  assert.equal(Number((before.cash - after.cash).toFixed(4)), cumulative);
  const expectedDifference = cumulative / Math.max(0.1, after.grossMargin * after.cashConv);
  assert.ok(Math.abs(after.requiredRevenue - before.requiredRevenue - expectedDifference) < 0.011);
}
const anth = includeScheduledEquity => engine.runSimulation(entities, transactions, { overrides: {
  ANTHROPIC: { financing: { ...tight, capacity: 0 }, includeScheduledEquity }
} }).timeline["2026Q4"].entities.ANTHROPIC;
assert.equal(anth(true).financingForecast.scheduledEquityStatus, "Unverified legacy input");
assert.equal(anth(false).equityInflow, 0);
assert.equal(Number((anth(true).cash - anth(false).cash).toFixed(4)), 107.3);
console.log("Audit 4 funding, lease and freeze regressions passed");
