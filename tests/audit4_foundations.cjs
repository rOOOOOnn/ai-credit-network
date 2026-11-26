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


const usd = value => Number(value.toFixed(4));
const unrestricted = engine.runSimulation(entities, transactions, {
  overrides: { OPENAI: { computePay: 30, financing: { mode: "manual", capacity: 0, quarterlyLimit: 0 } } }
});
const drawQuarter = unrestricted.timeline["2027Q1"];
const [lead, syndicate] = ["TX06A", "TX06B"].map(id => drawQuarter.financingLedger[id]);
assert.equal(lead.newDrawdown, 0.6);
assert.equal(syndicate.newDrawdown, 4.1);
assert.equal(lead.defaultExposure, 0.6);
assert.equal(syndicate.defaultExposure, 4.1);
assert.equal(drawQuarter.entities.OPENAI.rcfDraw, 4.7);
assert.equal(drawQuarter.entities.OPENAI.debt, 4.7);
assert.equal(drawQuarter.entities.OPENAI.cash, usd(drawQuarter.entities.OPENAI.begCash + drawQuarter.entities.OPENAI.fcf + 4.7));
for (const row of [lead, syndicate]) {
  assert.equal(row.endingOutstanding, usd(row.beginningOutstanding + row.newDrawdown - row.principalRepayment));
  const event = unrestricted.creditEvents.find(event => event.txId === row.txId);
  assert.equal(event.fundedEAD, row.endingOutstanding);
  assert.equal(event.undrawnEAD, 0);
}
assert.equal(unrestricted.timeline["2027Q4"].financingLedger.TX06A.principalRepayment, 0);

const interrupted = engine.runSimulation(entities, transactions, { forcedDefaults: ["CORZ"] });
const crwv = quarter => interrupted.timeline[quarter].entities.CRWV;
assert.equal(crwv("2027Q2").operationalRecoveryRevenue,
  usd(crwv("2026Q4").operationalRevDelay + crwv("2027Q1").operationalRevDelay));
assert.equal(crwv("2026Q4").operationalCapacityRevenueImpact,
  usd(crwv("2026Q4").operationalRevDelay + crwv("2026Q4").operationalPermanentRevenueLoss));
assert.equal(crwv("2027Q3").operationalRecoveryRevenue, undefined);

const projects = [{ readyQuarter: "2028Q2", leaseStartQuarter: "2028Q3", termQuarters: 8, cap: 12,
  paymentsByQuarter: { "2028Q2": 2, "2028Q4": 3 }, terminationQuarter: "2029Q1" }];
assert.equal(engine.phasedGuarantee(projects, "2028Q2", 105).effectiveExposure, 0);
assert.equal(engine.phasedGuarantee(projects, "2028Q3", 105).effectiveExposure, 12);
assert.equal(engine.phasedGuarantee(projects, "2028Q4", 105, 2).remainingGuaranteeLiability, 7);
assert.equal(engine.phasedGuarantee(projects, "2029Q1", 105).effectiveExposure, 0);

const contracts = engine.runSimulation(entities, transactions, { audit4Contracts: true, forcedDefaults: ["OPENAI"] });
assert.equal(contracts.timeline["2026Q4"].entities.ORCL.leaseSchedule.uncommencedCommitment, 288);
assert.equal(contracts.timeline["2027Q1"].entities.ORCL.incrementalLeasePayment, usd(96 / 68));
assert.equal(contracts.timeline["2028Q1"].entities.ORCL.incrementalLeasePayment, usd(192 / 68));
assert.equal(contracts.timeline["2027Q4"].guaranteeLedger.TX11.calledGuarantee, 0);
assert.equal(contracts.timeline["2028Q1"].guaranteeLedger.TX11.calledGuarantee, usd(105 / 9 * 0.25));

const purchaseCase = engine.runSimulation(entities, transactions, {
  forecastThrough: 2030, overrides: { CRWV: { capex: 4, gpuRefresh: {
    cohorts: [], gpuPurchasesByQuarter: { "2027Q1": 2 }, economicLife: 3,
    accountingLife: 6, physicalLife: 8, replacementRatio: 0.5, residualValue: 0.25
  } } }
});
const purchased = purchaseCase.timeline["2027Q1"].entities.CRWV;
const replaced = purchaseCase.timeline["2030Q1"].entities.CRWV;
assert.equal(purchased.gpuPurchases, 2);
assert.equal(purchased.capex, 4);
assert.equal(replaced.replacementCapex, 1);
assert.equal(replaced.disposalProceeds, 0.25);
assert.equal(replaced.gpuCollateralValue, 0.5);
assert.equal(replaced.fcf, usd(replaced.ocf - replaced.capex));
console.log("Audit 4 RCF, operational recovery, contract phase and GPU cohort tests passed");


const noFunding = { mode: "manual", capacity: 0, quarterlyLimit: 0 };
const smallerFunding = { mode: "manual", capacity: 10, quarterlyLimit: 2.5, annual: { 2027: { equity: 10 } } };
const legacyFleet = { cohorts: [{ acquired: "2023Q1", cost: 20 }], economicLife: 4,
  replacementRatio: 0.25, residualValue: 0.2 };
const cases = [
  ["A", "OPENAI", { OPENAI: { revGrowth: 0.02, financing: smallerFunding } }],
  ["B", "ANTHROPIC", { ANTHROPIC: { revGrowth: 0.01, interestRate: 0.12, includeScheduledEquity: false } }],
  ["C", "CRWV", { CRWV: { gpuRefresh: legacyFleet, financing: smallerFunding } }],
  ["D", "ORCL", { OPENAI: { revGrowth: -0.05 }, ORCL: { incrementalLeaseTranches: [
    { startQuarter: "2027Q1", termQuarters: 4, commitment: 8 }
  ] } }, { forcedDefaults: ["OPENAI"] }],
  ["E", "CRWV", { CRWV: { gpuRefresh: { ...legacyFleet, residualValue: 0 } } }, { ocean: { refiSuccessRate: 25 } }],
  ["F", "CRWV", { CRWV: { gpuRefresh: legacyFleet } }, { ocean: { fundingAvailability: 25 } }],
  ["G", "CRWV", { CRWV: { revGrowth: -0.05, gpuRefresh: legacyFleet, financing: noFunding } },
    { ocean: { fundingAvailability: 0, refiSuccessRate: 0 } }]
];
const stressResults = [];
for (const [name, entity, overrides, options] of cases) {
  const result = engine.runSimulation(entities, transactions, { overrides, ...options });
  const quarter = result.timeline["2027Q1"];
  const observed = quarter.entities[entity];
  const minimum = entities.find(row => row.id === entity).defaults.minCash;
  assert.equal(observed.fcf, usd(observed.ocf - observed.capex), name);
  assert.ok(Math.abs(observed.cash - (observed.begCash + observed.fcf + observed.newDebt +
    observed.equityInflow + observed.rcfDraw - observed.principalRepay -
    observed.gpuMarginCall + observed.disposalProceeds)) < 0.002, name);
  assert.equal(observed.fundingGap, usd(Math.max(0, minimum - observed.cash)), name);
  if (["C", "E", "F", "G"].includes(name)) {
    assert.equal(observed.replacementCapex, 5, name);
    assert.equal(observed.disposalProceeds, name === "E" ? 0 : 1, name);
  }
  if (name === "D") assert.equal(observed.incrementalLeasePayment, 2);
  if (name === "G") assert.equal(observed.newDebt, 0);
  stressResults.push([name, entity, observed.cash, observed.fcf, observed.fundingGap, result.scenarioSummary[entity].defaultQuarter]);
}
console.table(stressResults);
console.log("Audit 4 A–G stress accounting checks passed");


const instrument = { id: "Audit4-term", type: "Direct Loan", payer: "JPM", receiver: "OPENAI",
  announcedDate: "2026-12-01", startQ: "2026Q4", endQ: "2027Q3", amountDrawn: 0,
  amountRepaid: 0, totalCommitment: 5, remainingCommitment: 5 };
const termOptions = { audit4DebtLedger: true, ocean: { refiSuccessRate: 0 }, overrides: {
  OPENAI: { financing: { mode: "manual", capacity: 30, quarterlyLimit: 7.5, annual: { 2027: { equity: 30 } } } }
} };
const termResult = engine.runSimulation(entities, [...transactions, instrument], {
  ...termOptions, facilityDrawdowns: { [instrument.id]: { "2027Q1": 3, "2027Q2": 4 } },
  facilityRepayments: { [instrument.id]: { "2027Q2": 1 } }
});
const termRow = q => termResult.timeline[q].financingLedger[instrument.id];
assert.equal(termRow("2027Q1").newDrawdown, 3);
assert.equal(termRow("2027Q1").endingOutstanding, 3);
assert.equal(termResult.timeline["2027Q1"].entities.OPENAI.contractualTermDraw, 3);
assert.equal(termRow("2027Q2").principalRepayment, 1);
assert.equal(termRow("2027Q2").newDrawdown, 2);
assert.equal(termRow("2027Q2").endingOutstanding, 4);
assert.equal(termRow("2027Q2").remainingCommitment, 0);
assert.equal(termRow("2027Q3").principalRepayment, 4);
assert.equal(termRow("2027Q3").endingOutstanding, 0);
assert.equal(termResult.timeline["2027Q2"].debtReconciliation.OPENAI.namedTermPrincipal, 4);
assert.equal(termResult.timeline["2027Q1"].financingLedger.TX26.cumulativeDrawdown, null);
assert.equal(termResult.timeline["2027Q1"].financingLedger.TX26.undrawnCommitment, null);
console.log("Audit 4 term loan draw, repayment and reconciliation checks passed");


const reportedAnthropic = includeScheduledEquity => engine.runSimulation(entities, transactions, {
  audit4Contracts: true, overrides: { ANTHROPIC: { financing: noFunding, includeScheduledEquity } }
}).timeline["2026Q4"];
const withProceeds = reportedAnthropic(true);
const withoutProceeds = reportedAnthropic(false);
assert.equal(withProceeds.entities.ANTHROPIC.begCash, 95.6);
assert.equal(withProceeds.entities.ANTHROPIC.financingForecast.scheduledEquity, 117);
assert.equal(usd(withProceeds.entities.ANTHROPIC.cash - withoutProceeds.entities.ANTHROPIC.cash), 117);
assert.equal(withProceeds.entities.ANTHROPIC.ocf, withoutProceeds.entities.ANTHROPIC.ocf);
assert.equal(withProceeds.financingLedger.TX12A.beginningOutstanding, 6.2);
assert.equal(withProceeds.financingLedger.TX12A.nonCashConversion, 0.5793);
assert.equal(withProceeds.financingLedger.TX12A.endingOutstanding, 5.6207);
assert.equal(withProceeds.financingLedger.TX12B.endingOutstanding, 0);
assert.equal(withProceeds.financingLedger.TX14A.endingOutstanding, 0);
assert.equal(withProceeds.debtReconciliation.ANTHROPIC.unattributedDebt, 0);
console.log("Audit 4 Anthropic reported opening cash, estimate sensitivity and note conversion checks passed");


const diagnosticEntity = { id: "DIAG", financials: { "2026Q3": { cash: 10, debt: 0, revenue: 10, dataType: "Actual" } },
  defaults: { grossMargin: 0.5, cashConv: 1, capex: 3, minCash: 2, revGrowth: -0.5 } };
const diagnostic = engine.runSimulation([diagnosticEntity], [], { overrides: { DIAG: { opex: 2 } } })
  .timeline["2026Q4"].entities.DIAG;
assert.equal(diagnostic.ocf, 0.41);
assert.equal(diagnostic.fcf, -2.59);
assert.equal(diagnostic.monthlyCashBurn, 0.8633);
assert.equal(diagnostic.availableLiquidity, 7.41);
assert.equal(diagnostic.requiredFinancing, 0);
assert.equal(diagnostic.fcfBreakEvenRevenue, usd((3 / 0.82 + 2) / 0.5));
assert.equal(diagnostic.minimumRequiredRevenueGrowth, 0.1317);
console.log("Audit 4 liquidity and minimum FCF break-even growth checks passed");

const liquid = engine.runSimulation(entities, transactions, { audit4Contracts: true });
for (const [id, cash] of Object.entries({ MSFT:20.281, META:11.222, AMZN:55.783, GOOGL:56.334, ANTHROPIC:95.6 })) {
  const opening = liquid.timeline["2026Q4"].entities[id];
  assert.equal(opening.begCash, cash, id);
  assert.equal(opening.openingInvestmentSale, 0, id);
}
const withInvestments = engine.runSimulation(entities, transactions, { audit4Contracts:true,
  overrides: { GOOGL: { openingInvestmentSaleFraction: 1 } } });
const alph = withInvestments.timeline["2026Q4"].entities.GOOGL;
assert.equal(alph.openingInvestmentSale, 133.564);
assert.equal(usd(alph.cash - liquid.timeline["2026Q4"].entities.GOOGL.cash), 133.564);
assert.equal(withInvestments.timeline["2027Q1"].entities.GOOGL.openingInvestmentSale, 0);
console.log("Audit 4 cash classification and investment sale checks passed");
const coreweaveBridge = entities.find(entity => entity.id === "CRWV").audit4CashFlowBridge;
assert.equal(usd(coreweaveBridge.nineMonths.ocf - coreweaveBridge.sixMonths.ocf), 1.975);
assert.equal(usd(coreweaveBridge.nineMonths.capex - coreweaveBridge.sixMonths.capex), 9.441);
assert.equal(liquid.timeline["2026Q4"].entities.CRWV.begCash, 4.122);
assert.equal(liquid.timeline["2026Q4"].entities.CRWV.openingLiquidityDisclosure.restrictedCashSeparate, 2.282);
console.log("Audit 4 CoreWeave quarterly cash-flow bridge checks passed");

const oracleOpening = liquid.timeline["2026Q4"].entities.ORCL;
const oracleFiling = oracleOpening.openingFiscalCashFlowDisclosure;
assert.equal(oracleOpening.begCash, 36.369);
assert.equal(oracleFiling.periodStart, "2026-06-01");
assert.equal(oracleFiling.periodEnd, "2026-08-31");
assert.equal(usd(oracleFiling.ocf - oracleFiling.financingComponentPrepayments), 11.74);
assert.equal(usd(oracleFiling.ocf - oracleFiling.capex), -5.396);
assert.equal(usd(oracleFiling.ocf - oracleFiling.financingComponentPrepayments - oracleFiling.capex), -16.759);
assert.equal(usd(oracleFiling.currentBorrowings + oracleFiling.nonCurrentBorrowings), 125.337);
assert.equal(oracleOpening.priorQuarterRevenue, 19.345);
assert.equal(oracleOpening.incrementalLeasePayment, 0);
assert.equal(liquid.timeline["2027Q1"].entities.ORCL.incrementalLeasePayment, 1.4118);
console.log("Audit 4 Oracle customer prepayment and fiscal-period checks passed");

const msftOpening = liquid.timeline["2026Q4"].entities.MSFT;
const msftFiling = msftOpening.openingFiscalCashFlowDisclosure;
assert.equal(msftOpening.priorQuarterRevenue, 92.279);
assert.equal(msftOpening.begCash, 20.281);
assert.equal(usd(msftFiling.ocf - msftFiling.capex), 18.633);
assert.equal(usd(msftFiling.currentBorrowings + msftFiling.nonCurrentBorrowings), 35.481);
assert.equal(usd(msftFiling.operatingLeaseLiability + msftFiling.financeLeaseLiability), 98.45);
assert.equal(msftFiling.financeLeasePrincipalPaid, 1);
assert.equal(msftFiling.noncashFinanceLeaseAcquisitions, 5.192);
assert.equal(msftOpening.incrementalLeasePayment, 0);
assert.ok(Number.isFinite(msftOpening.fcf));
console.log("Audit 4 Microsoft cash flow and lease classification checks passed");

for (const [id, ocf, capex, fcf] of [
  ["GOOGL", 42.29, 51.355, -9.065],
  ["META", 32.785, 33.942, -1.157],
  ["AMZN", 42.422, 77.259, -34.837]
]) {
  const opening = liquid.timeline["2026Q4"].entities[id];
  assert.equal(opening.openingQuarterCashFlow.ocf, ocf, id);
  assert.equal(opening.openingQuarterCashFlow.capex, capex, id);
  assert.equal(opening.openingQuarterCashFlow.grossCashFcf, fcf, id);
}
const amznReported = liquid.timeline["2026Q4"].entities.AMZN.openingQuarterCashFlow;
assert.equal(amznReported.propertySaleAndIncentiveProceeds, 1.381);
assert.equal(usd(amznReported.grossCashFcf + amznReported.propertySaleAndIncentiveProceeds), -33.456);
console.log("Audit 4 Alphabet, Amazon and Meta quarterly cash-flow checks passed");

const msftLeaseQuarters = ["2026Q4", "2027Q1", "2027Q2"].map(
  q => liquid.timeline[q].entities.MSFT.recognizedFinanceLease);
assert.equal(msftLeaseQuarters[0].opening, 70.973);
assert.equal(msftLeaseQuarters[0].interest, usd(70.973 * (1.045 ** 0.25 - 1)));
assert.equal(usd(msftLeaseQuarters.reduce((sum, row) => sum + row.payment, 0)), 6.006);
for (const row of msftLeaseQuarters) {
  assert.equal(row.principal, usd(row.payment - row.interest));
  assert.equal(row.ending, usd(row.opening - row.principal));
}
assert.equal(msftLeaseQuarters[1].opening, msftLeaseQuarters[0].ending);
const withoutMsftLease = engine.runSimulation(entities, transactions, {
  audit4Contracts: true, overrides: { MSFT: { includeExistingFinanceLease: false } }
}).timeline["2026Q4"].entities.MSFT;
assert.equal(withoutMsftLease.recognizedFinanceLease, null);
assert.equal(usd(withoutMsftLease.fcf - msftOpening.fcf), usd(msftOpening.leaseInterestAdjustment));
assert.equal(usd(withoutMsftLease.cash - msftOpening.cash), usd(msftOpening.leasePrincipal + msftOpening.leaseInterestAdjustment));
assert.equal(withoutMsftLease.debt, msftOpening.debt);
console.log("Audit 4 Microsoft lease cash, amortization and FY bucket checks passed");
assert.equal(usd(["2027Q3", "2027Q4", "2028Q1", "2028Q2"].reduce(
  (sum, q) => sum + liquid.timeline[q].entities.MSFT.recognizedFinanceLease.payment, 0)), 8.163);

const nvdaOpening = liquid.timeline["2026Q4"].entities.NVDA;
assert.equal(nvdaOpening.begCash, 22.443);
assert.equal(nvdaOpening.priorQuarterRevenue, 96.221);
assert.equal(nvdaOpening.openingFiscalCashFlowDisclosure.periodEnd, "2026-07-26");
assert.equal(nvdaOpening.laterFiscalDisclosure.periodEnd, "2026-10-25");
assert.equal(usd(nvdaOpening.laterFiscalDisclosure.ocf - nvdaOpening.laterFiscalDisclosure.cashPurchases -
  nvdaOpening.laterFiscalDisclosure.assetPrincipal), 43.777);
const neocloud = "NVDA_NEOCLOUD_UNALLOCATED";
const systems = "NVDA_POWER_SYSTEMS_UNALLOCATED";
const firstGuarantees = liquid.timeline["2026Q4"].guaranteeLedger;
assert.equal(usd(firstGuarantees.TX11.disclosedMaximum + firstGuarantees[neocloud].disclosedMaximum +
  firstGuarantees[systems].disclosedMaximum), 118);
assert.equal(firstGuarantees[neocloud].effectiveExposure, null);
assert.equal(firstGuarantees[systems].counterparty, null);
const guaranteeStress = engine.runSimulation(entities, transactions, { audit4Contracts: true,
  overrides: { NVDA: { unallocatedGuaranteeCalls: {
    [neocloud]: { "2027Q1": 3, "2027Q2": 3 },
    [systems]: { "2027Q1": 20 }
  } } } });
const calls = guaranteeStress.timeline["2027Q1"];
assert.equal(calls.guaranteeLedger[neocloud].calledThisQuarter, 3);
assert.equal(calls.guaranteeLedger[systems].calledThisQuarter, 9.5);
assert.equal(calls.entities.NVDA.unallocatedGuaranteeCashPaid, 12.5);
assert.equal(usd(liquid.timeline["2027Q1"].entities.NVDA.cash - calls.entities.NVDA.cash), 12.5);
assert.equal(calls.entities.NVDA.ocf, liquid.timeline["2027Q1"].entities.NVDA.ocf);
assert.equal(guaranteeStress.timeline["2027Q2"].guaranteeLedger[neocloud].calledThisQuarter, 0.5);
assert.equal(guaranteeStress.timeline["2027Q2"].guaranteeLedger[systems].remainingDisclosedCap, 0);
assert.equal(calls.guaranteeLedger.TX11.calledGuarantee, 0);
console.log("Audit 4 NVIDIA reporting cutoff and unallocated guarantee cap checks passed");

const mixedLeases = [
  { type: "finance", startQuarter: "2027Q1", termQuarters: 4, quarterlyPayment: 1, annualDiscountRate: 1.1 ** 4 - 1 },
  { type: "operating", startQuarter: "2027Q1", termQuarters: 4, quarterlyPayment: 0.5 }
];
const beforeLease = engine.incrementalLeaseSchedule(mixedLeases, "2026Q4");
assert.equal(beforeLease.uncommencedCommitment, 6);
assert.equal(beforeLease.classifiedFinanceLiability, 0);
const firstLease = engine.incrementalLeaseSchedule(mixedLeases, "2027Q1");
const firstLeasePV = [1, 2, 3, 4].reduce((sum, n) => sum + 1 / 1.1 ** n, 0);
assert.equal(firstLease.financeInterest, usd(firstLeasePV * 0.1));
assert.equal(firstLease.financePrincipal, usd(1 - firstLeasePV * 0.1));
assert.equal(firstLease.classifiedFinanceLiability, usd(firstLeasePV * 1.1 - 1));
assert.equal(firstLease.ocfCashPayment, usd(0.5 + firstLeasePV * 0.1));
assert.equal(firstLease.financeDepreciation, usd(firstLeasePV / 4));
assert.equal(engine.incrementalLeaseSchedule(mixedLeases, "2027Q4").classifiedFinanceLiability, 0);
assert.equal(engine.incrementalLeaseSchedule(mixedLeases, "2028Q1").payment, 0);
assert.equal(engine.incrementalLeaseSchedule(mixedLeases, "2027Q1", 1).payment, 0);
const zeroRate = engine.incrementalLeaseSchedule([{ ...mixedLeases[0], annualDiscountRate: 0 }], "2027Q1");
assert.equal(zeroRate.financePrincipal, 1);
assert.equal(zeroRate.financeInterest, 0);
const unclassified = engine.incrementalLeaseSchedule([{ ...mixedLeases[0], annualDiscountRate: null }], "2027Q1");
assert.equal(unclassified.unclassifiedPayment, 1);
assert.equal(unclassified.financePrincipal, 0);

const separateLease = engine.runSimulation(entities, transactions, { audit4Contracts: true,
  overrides: { ORCL: { incrementalLeaseTranches: mixedLeases } } }).timeline["2027Q1"].entities.ORCL;
const noIncrementalLease = engine.runSimulation(entities, transactions, { audit4Contracts: true,
  overrides: { ORCL: { incrementalLeaseTranches: [] } } }).timeline["2027Q1"].entities.ORCL;
assert.equal(usd(noIncrementalLease.cash - separateLease.cash), 1.5);
assert.equal(usd(noIncrementalLease.fcf - separateLease.fcf), firstLease.ocfCashPayment);
assert.equal(separateLease.leasePrincipal, firstLease.financePrincipal);
assert.equal(separateLease.debt, noIncrementalLease.debt);
assert.equal(separateLease.capex, noIncrementalLease.capex);
console.log("Audit 4 incremental finance and operating lease classification checks passed");

const crwvFacilityId = "CRWV_RCF_DISCLOSED";
const reportedCrwvFacility = liquid.timeline["2026Q4"].financingLedger[crwvFacilityId];
assert.equal(reportedCrwvFacility.beginningOutstanding, 1.2);
assert.equal(reportedCrwvFacility.lettersOfCredit, 0.546);
assert.equal(reportedCrwvFacility.undrawnCommitment, 0.754);
assert.equal(reportedCrwvFacility.cumulativeDrawdown, null);
assert.equal(liquid.timeline["2026Q4"].financingLedger.TX26.undrawnCommitment, null);
const crwvRcfStress = engine.runSimulation(entities, transactions, { audit4Contracts: true,
  overrides: { CRWV: { computePay: 25, financing: noFunding } } });
const crwvRcfQuarter = crwvRcfStress.timeline["2026Q4"];
const crwvRcfBorrower = crwvRcfQuarter.entities.CRWV;
const crwvRcf = crwvRcfQuarter.financingLedger[crwvFacilityId];
assert.equal(crwvRcf.newDrawdown, 0.754);
assert.equal(crwvRcfBorrower.rcfDraw, 0.754);
assert.equal(crwvRcf.endingOutstanding, 1.954);
assert.equal(crwvRcf.defaultExposure, 1.954);
assert.equal(crwvRcf.cumulativeDrawdown, null);
assert.equal(crwvRcf.lender, null);
assert.equal(crwvRcfBorrower.cash, usd(crwvRcfBorrower.begCash + crwvRcfBorrower.fcf + 0.754 -
  crwvRcfBorrower.principalRepay - crwvRcfBorrower.gpuMarginCall));
assert.equal(crwvRcfBorrower.debt, usd(46.873 + 0.754 - crwvRcfBorrower.principalRepay));
assert.equal(crwvRcfStress.timeline["2027Q1"].entities.CRWV.rcfDraw, 0);
const crwvEvents = crwvRcfStress.creditEvents.filter(event => event.txId === crwvFacilityId);
assert.equal(crwvEvents.length, 1);
assert.equal(crwvEvents[0].fundedEAD, 1.954);
assert.equal(crwvEvents[0].lender, null);
console.log("Audit 4 CoreWeave letter-of-credit reserve and RCF reconciliation checks passed");
for (const [id, ocf, capex, fcf] of [
  ["VST", 2.108, 0.747, 1.361],
  ["CEG", 3.426, 0.940, 2.486],
  ["VERTIV", 0.794, 0.1391, 0.6549],
  ["CORZ", 0.0653, 0.5407, -0.4754]
]) {
  const actual = liquid.timeline["2026Q4"].entities[id].openingQuarterCashFlow;
  assert.deepEqual([actual.ocf, actual.capex, actual.grossCashFcf], [ocf, capex, fcf], id);
}
const vst = liquid.timeline["2026Q4"].entities.VST;
assert.equal(vst.insufficientData, false);
assert.equal(vst.begCash, 2.743);
assert.equal(vst.priorQuarterRevenue, 6.347);
assert.equal(vst.undrawnCredit, 4.714);
const vstFacility = liquid.timeline["2026Q4"].financingLedger.VST_RCF_DISCLOSED;
assert.equal(vstFacility.beginningOutstanding, 0);
assert.equal(vstFacility.lettersOfCredit, 0.786);
assert.equal(vstFacility.undrawnCommitment, 4.714);
assert.equal(vstFacility.lender, null);
assert.equal(liquid.timeline["2026Q4"].entities.VERTIV.openingQuarterCashFlow.capitalizedSoftware, 0.0027);
console.log("Audit 4 infrastructure cash-flow and Vistra revolver checks passed");
