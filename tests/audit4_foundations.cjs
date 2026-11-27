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
assert.equal(replaced.gpuNetBookValueDisposed, 0.5);
assert.equal(replaced.gpuDisposalGainLoss, -0.25);
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
const termExposure = { ...instrument, amountDrawn: 3 };
for (const [quarter, expectedUndrawn] of [["2027Q2", 2], ["2027Q3", 0], ["2027Q4", 0]]) {
  const exposure = engine.computeTransactionEAD(termExposure, quarter);
  assert.equal(exposure.fundedEAD, 3);
  assert.equal(exposure.undrawnCommitment, expectedUndrawn);
  assert.equal(exposure.undrawnEAD, expectedUndrawn * 0.4);
  assert.equal(exposure.totalEAD, 3 + expectedUndrawn * 0.4);
}
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
const vstEntity = entities.find(entity => entity.id === "VST");
const vstHistory = engine.getHistoricalSnapshot(vstEntity, "2026Q3");
assert.equal(vstHistory.dataType, "Actual");
assert.equal(vstHistory.debt, 21.146);
assert.equal(vstHistory.rpo, 7.847);
assert.equal(vstHistory.ap, 1.503);
assert.equal(usd(vstHistory.ocf - vstHistory.capex), vstHistory.fcf);
assert.equal(engine.getHistoricalSnapshot(vstEntity, "2026Q3", true).dataType, "Unavailable");
const vstEvents = vstEntity.audit4SubsequentEvents;
assert.equal(usd(vstEvents.preferredRedemption + vstEvents.cashAcquisitionConsideration + vstEvents.assumedDebtRepaid), 4.9);
assert.equal(usd(vstEvents.debtAssumed - vstEvents.assumedDebtRepaid), 0);
assert.equal(vstEvents.newReceivablesAndRepurchaseBorrowings, null);
console.log("Audit 4 Vistra historical cutoff and subsequent event checks passed");
assert.equal(vstEvents.openingReportedLiquidity, usd(vstHistory.cash + vstHistory.undrawnCredit + vstEntity.audit4Liquidity.commodityFacilityAvailability));
const vstFullLimitDraw = usd(vstEvents.receivablesPurchaseLimit + vstEvents.uncommittedRepurchaseLimit);
assert.equal(vstFullLimitDraw, vstEvents.estimatedCombinedDrawAtFullLimits);
assert.equal(vstEvents.estimatedCombinedDrawDataType, "Estimated");
const vstProForma = usd(vstEvents.openingReportedLiquidity - 4.9 + vstFullLimitDraw);
assert.equal(vstProForma, 5.398);
assert.equal(Number(vstProForma.toFixed(1)), vstEvents.proFormaLiquidity);
const explicitFacilities = structuredClone(entities);
const vistraRevolver = explicitFacilities.find(entity => entity.id === "VST").audit4Facilities[0];
assert.equal(vistraRevolver.facilityKind, "Revolver");
vistraRevolver.endQ = "2027Q1";
vistraRevolver.collateral = "Liens released in April 2026";
const explicitVst = engine.runSimulation(explicitFacilities, transactions, {
  audit4Contracts: true,
  facilityExtensions: { VST_RCF_DISCLOSED: "2030Q4" }
}).timeline["2027Q2"];
assert.equal(explicitVst.financingLedger.VST_RCF_DISCLOSED.isRevolver, true);
assert.equal(explicitVst.entities.VST.undrawnCredit, 4.714);
const nebiusHistory = engine.getHistoricalSnapshot(entities.find(entity => entity.id === "NBIS"), "2026Q3");
assert.equal(nebiusHistory.debt, 14.1908);
assert.equal(usd(nebiusHistory.shortTermDebt + nebiusHistory.longTermDebt), nebiusHistory.debt);
assert.equal(nebiusHistory.ocf, -0.273);
assert.equal(usd(nebiusHistory.ocf - nebiusHistory.capex), -7.5734);
assert.equal(nebiusHistory.undrawnCredit, null);
const nebiusOpening = liquid.timeline["2026Q4"].entities.NBIS;
assert.equal(nebiusOpening.begCash, 7.4256);
assert.equal(nebiusOpening.openingQuarterCashFlow.grossCashFcf, -7.5734);
const orclMaturities = oracleFiling.commencedLeaseMaturities;
assert.equal(orclMaturities.operatingPayments.length, orclMaturities.fiscalYears.length);
assert.equal(orclMaturities.financePayments.length, orclMaturities.fiscalYears.length);
const orclOperatingLeaseCash = usd(orclMaturities.operatingPayments.reduce((sum, payment) => sum + payment, 0));
const orclFinanceLeaseCash = usd(orclMaturities.financePayments.reduce((sum, payment) => sum + payment, 0));
assert.equal(orclOperatingLeaseCash, 48.050);
assert.equal(orclFinanceLeaseCash, 15.195);
assert.equal(usd(orclOperatingLeaseCash - orclMaturities.operatingImputedInterest), oracleFiling.operatingLeaseLiability);
assert.equal(usd(orclFinanceLeaseCash - orclMaturities.financeImputedInterest), oracleFiling.financeLeaseLiability);
assert.equal(oracleFiling.uncommencedLeaseCommitment, 288);
assert.equal(usd(oracleFiling.reportedLeaseCashPaid.operating + oracleFiling.reportedLeaseCashPaid.finance), 1.136);
const lateGpuConfig = {
  capex: 4,
  gpuRefresh: { gpuPurchasesByQuarter: { "2027Q1": 2 }, economicLife: 7, replacementRatio: 0.5, residualValue: 0.25 }
};
const lateGpu = engine.runSimulation(entities, transactions, {
  forecastThrough: 2033, includeFirstGpuRefresh: true, overrides: { CRWV: lateGpuConfig }
});
assert.equal(lateGpu.timeline["2033Q4"].entities.CRWV.replacementCapex, 0);
assert.equal(lateGpu.timeline["2034Q1"]?.entities.CRWV.replacementCapex, 1);
assert.equal(lateGpu.timeline["2034Q1"].entities.CRWV.disposalProceeds, 0.25);
assert.equal(purchased.gpuFleetAgeYears, 0);
assert.equal(replaced.gpuFleetAgeYears, 1.5);
assert.equal(replaced.netGpuReplacementCashOutflow, 0.75);
assert.equal(liquid.timeline["2026Q4"].entities.CRWV.gpuFleetAgeYears, null);
const refreshFixture = {
  ...entities.find(entity => entity.id === "CRWV"), id: "REFRESH_FIXTURE",
  defaults: { mode: "B", revGrowth: 0, grossMargin: 0.5, opex: 0, capex: 0,
    interestRate: 0, computePay: 0, debtRepay: 0, newDebt: 0, equityInflow: 0, minCash: 0, cashConv: 1 },
  financials: { "2026Q3": { revenue: 4, cash: 100, debt: 0, ocf: 2, capex: 0 } }
};
const runRefreshFixture = gpuRefresh => engine.runSimulation([refreshFixture], [], {
  forecastThrough: 2033, overrides: { REFRESH_FIXTURE: { gpuRefresh } }
});
const withoutRefresh = runRefreshFixture(null);
for (const life of [3, 4, 5, 6, 7]) {
  const fixture = runRefreshFixture({ cohorts: [{ acquired: "2026Q4", cost: 100 }],
    economicLife: life, accountingLife: 10, physicalLife: 12,
    replacementRatio: 0.25, residualValue: 0.2, priceDecline: 0.1 });
  const firstQuarter = `${2026 + life}Q4`;
  const before = fixture.timeline[`${2026 + life}Q3`].entities.REFRESH_FIXTURE;
  const at = fixture.timeline[firstQuarter].entities.REFRESH_FIXTURE;
  const reference = withoutRefresh.timeline[firstQuarter].entities.REFRESH_FIXTURE;
  assert.equal(before.replacementCapex, 0, String(life));
  assert.equal(at.replacementCapex, 22.5, String(life));
  assert.equal(at.disposalProceeds, 5, String(life));
  assert.equal(usd(reference.fcf - at.fcf), 22.5, String(life));
  assert.equal(usd(reference.cash - at.cash), 17.5, String(life));
}
const retiredAtPhysicalLimit = engine.fleetRefresh([{ acquired: "2026Q4", cost: 20 }], "2030Q4", {
  economicLife: 6, physicalLife: 4, accountingLife: 8, replacementRatio: 0.25,
  residualValue: 0.2, physicalResidualValue: 0.05, priceDecline: 0.1
});
assert.equal(retiredAtPhysicalLimit.replacementCapex, 18);
assert.equal(retiredAtPhysicalLimit.disposalProceeds, 1);
assert.deepEqual(retiredAtPhysicalLimit.cohorts, [{ acquired: "2030Q4", cost: 18 }]);
const physicalFixture = runRefreshFixture({
  cohorts: [{ acquired: "2026Q4", cost: 20 }], economicLife: 6, physicalLife: 4, accountingLife: 8,
  replacementRatio: 0.25, residualValue: 0.2, physicalResidualValue: 0.05, priceDecline: 0.1
});
assert.equal(physicalFixture.timeline["2030Q3"].entities.REFRESH_FIXTURE.replacementCapex, 0);
const physicalQuarter = physicalFixture.timeline["2030Q4"].entities.REFRESH_FIXTURE;
const physicalReference = withoutRefresh.timeline["2030Q4"].entities.REFRESH_FIXTURE;
assert.equal(physicalQuarter.gpuCollateralValue, 1);
assert.equal(physicalQuarter.gpuFleetAgeYears, 0);
assert.equal(usd(physicalReference.cash - physicalQuarter.cash), 17);
assert.equal(usd(physicalReference.fcf - physicalQuarter.fcf), 18);
const pledgedGpu = engine.runSimulation(entities, transactions, {
  audit4Contracts: true, forcedDefaults: ["CRWV"],
  overrides: { CRWV: { gpuRefresh: {
    cohorts: [{ acquired: "2024Q4", cost: 4, pledgedTo: "TX27" }, { acquired: "2026Q4", cost: 50 }],
    economicLife: 4, residualValue: 0.2
  } } }
});
const pledgedEvents = pledgedGpu.creditEvents.filter(event => event.txId === "TX27");
assert.equal(pledgedEvents.length, 1);
assert.equal(pledgedEvents[0].quarter, "2026Q4");
assert.equal(pledgedEvents[0].fundedEAD, 10);
assert.equal(pledgedEvents[0].collateralRecovery, 2.4);
assert.equal(pledgedEvents[0].recognizedLoss, 3.42);
assert.equal(pledgedEvents[0].expectedRecovery, 6.58);
assert.deepEqual(engine.financingForecast({
  mode: "manual", annual: { 2033: { equity: 4 } }
}, 2033).amounts, { equity: 4 });
const manualLate = engine.runSimulation([refreshFixture], [], { forecastThrough: 2033,
  overrides: { REFRESH_FIXTURE: { financing: { mode: "manual", capacity: 4, quarterlyLimit: 1, annual: { 2033: { equity: 4 } } } } }
});
assert.equal(manualLate.timeline["2032Q4"].entities.REFRESH_FIXTURE.equityInflow, 0);
assert.equal(manualLate.timeline["2033Q1"].entities.REFRESH_FIXTURE.equityInflow, 1);
assert.equal(manualLate.timeline["2033Q4"].entities.REFRESH_FIXTURE.financingForecast.remainingCapacity, 0);
assert.equal(usd(manualLate.timeline["2033Q4"].entities.REFRESH_FIXTURE.cash -
  withoutRefresh.timeline["2033Q4"].entities.REFRESH_FIXTURE.cash), 4);
const independentHistory = engine.financingForecast({ mode: "curve", curve: "historical", history: {
  2023: { dataType: "Actual", fullYear: true, amounts: { debt: 1 } },
  2024: { dataType: "Actual", fullYear: true, amounts: { debt: 2 } },
  2025: { dataType: "Actual", fullYear: true, amounts: { equity: 20 } },
  2026: { dataType: "Actual", fullYear: true, amounts: { equity: 30, strategic: 4 } }
} }, 2027);
assert.deepEqual(independentHistory.amounts, { equity: 45, debt: 16 });
assert.deepEqual(independentHistory.historyBySource.debt, { years: ["2023", "2024"], amounts: [1, 2] });
assert.deepEqual(independentHistory.historyBySource.equity, { years: ["2025", "2026"], amounts: [20, 30] });
assert.ok(independentHistory.missingHistorySources.includes("strategic"));
const crwvHistorical = engine.runSimulation(entities, transactions, { audit4Contracts: true,
  overrides: { CRWV: { financing: { mode: "curve", curve: "historical", capacity: 100, quarterlyLimit: 25 } } }
}).timeline["2027Q1"].entities.CRWV.financingForecast;
assert.deepEqual(crwvHistorical.historyBySource.debt, { years: ["2023", "2024", "2025"], amounts: [1.404, 7.018, 11.829] });
assert.deepEqual(crwvHistorical.historyBySource.equity, { years: ["2023", "2024", "2025"], amounts: [0.436, 1.172, 1.491] });
assert.equal(usd(crwvHistorical.amounts.equity), usd(1.491 * (1.491 / 0.436) / 4));
assert.ok(crwvHistorical.missingHistorySources.includes("prepayment"));
const anthropicHistory = entities.find(entity => entity.id === "ANTHROPIC").verifiedFinancingHistory;
assert.equal(usd(anthropicHistory[2023].amounts.equity + anthropicHistory[2023].amounts.debt +
  anthropicHistory[2023].amounts.other), 2.32);
assert.equal(usd(anthropicHistory[2024].amounts.equity + anthropicHistory[2024].amounts.debt), 7.248);
assert.equal(usd(anthropicHistory[2025].amounts.equity + anthropicHistory[2025].amounts.debt - 0.149), 19.960);
assert.equal(anthropicHistory[2026], undefined);
const anthropicHistorical = engine.runSimulation(entities, transactions, { audit4Contracts: true,
  overrides: { ANTHROPIC: { financing: { mode: "curve", curve: "historical", capacity: 2, quarterlyLimit: 1 } } }
});
const anthropic2027 = anthropicHistorical.timeline["2027Q1"].entities.ANTHROPIC.financingForecast;
assert.deepEqual(anthropic2027.historyBySource.equity, { years: ["2023", "2024", "2025"], amounts: [0.448, 1.198, 16.659] });
assert.deepEqual(anthropic2027.historyBySource.debt, { years: ["2023", "2024", "2025"], amounts: [1.75, 6.05, 3.45] });
assert.equal(usd(Object.values(anthropic2027.amounts).reduce((sum, amount) => sum + amount, 0)), 1);
assert.equal(anthropicHistorical.timeline["2027Q2"].entities.ANTHROPIC.financingForecast.remainingCapacity, 0);
const openAiData = entities.find(entity => entity.id === "OPENAI");
assert.deepEqual(openAiData.financingAnnouncements.map(event => [event.kind, event.amount]),
  [["round", 6.6], ["undrawnRevolver", 4], ["round", 40], ["committedCapital", 122], ["undrawnRevolver", 4.7]]);
const openAiUnverifiedHistory = engine.runSimulation(entities, transactions, { audit4Contracts: true,
  overrides: { OPENAI: { financing: { mode: "curve", curve: "historical", capacity: 200, quarterlyLimit: 100 } } }
}).timeline["2027Q1"].entities.OPENAI.financingForecast;
assert.equal(openAiUnverifiedHistory.status, "Insufficient Historical Data");
assert.equal(Object.values(openAiUnverifiedHistory.amounts).reduce((sum, amount) => sum + amount, 0), 0);
const cutoff = { ...instrument, endQ: "2027Q4", commitmentTerminationDate: "2027-03-31" };
const cutoffModel = engine.runSimulation(entities, [...transactions, cutoff], {
  ...termOptions, facilityDrawdowns: { [cutoff.id]: { "2027Q1": 2, "2027Q2": 3 } }
});
const beforeCutoff = cutoffModel.timeline["2027Q1"].financingLedger[cutoff.id];
const afterCutoff = cutoffModel.timeline["2027Q2"].financingLedger[cutoff.id];
assert.equal(beforeCutoff.newDrawdown, 2);
assert.equal(beforeCutoff.undrawnCommitment, 3);
assert.equal(afterCutoff.newDrawdown, 0);
assert.equal(afterCutoff.undrawnCommitment, 0);
assert.equal(afterCutoff.remainingCommitment, 3);
assert.equal(afterCutoff.endingOutstanding, 2);
assert.equal(cutoffModel.timeline["2027Q4"].financingLedger[cutoff.id].principalRepayment, 2);
const crwvRepaid = engine.runSimulation(entities, transactions, { audit4Contracts: true,
  facilityRepayments: { CRWV_RCF_DISCLOSED: { "2026Q4": 0.4 } }
}).timeline["2026Q4"];
const restoredRevolver = crwvRepaid.financingLedger.CRWV_RCF_DISCLOSED;
assert.equal(restoredRevolver.principalRepayment, 0.4);
assert.equal(restoredRevolver.endingOutstanding, 0.8);
assert.equal(restoredRevolver.undrawnCommitment, 1.154);
assert.equal(crwvRepaid.entities.CRWV.undrawnCredit, 1.154);
assert.equal(usd(liquid.timeline["2026Q4"].entities.CRWV.cash - crwvRepaid.entities.CRWV.cash), 0.4);
assert.equal(usd(liquid.timeline["2026Q4"].entities.CRWV.debt - crwvRepaid.entities.CRWV.debt), 0.4);
const rolloverModel = engine.runSimulation(entities, [...transactions, instrument], {
  ...termOptions, ocean: { refiSuccessRate: 100, fundingAvailability: 100 },
  overrides: { OPENAI: { ...termOptions.overrides.OPENAI, refiSuccess: 1 } },
  facilityDrawdowns: { [instrument.id]: { "2027Q1": 3 } }
});
const rolloverQuarter = rolloverModel.timeline["2027Q3"];
assert.equal(rolloverQuarter.financingLedger[instrument.id].endingOutstanding, 0);
assert.equal(rolloverQuarter.refinancingOriginations?.find(row => row.replacesTxId === instrument.id)?.newDrawdown, 3);
const rolloverRow = rolloverQuarter.refinancingOriginations.find(row => row.replacesTxId === instrument.id);
assert.equal(rolloverRow.lender, null);
assert.equal(rolloverRow.dataType, "Assumption");
assert.equal(rolloverQuarter.financingLedger[instrument.id].principalRepayment, 3);
assert.equal(rolloverQuarter.entities.OPENAI.financingForecast.fundedRollover, 3);
assert.equal(rolloverQuarter.entities.OPENAI.financingForecast.fundedDebt, 0);
assert.equal(rolloverQuarter.entities.OPENAI.newDebt, 3);
const extendedTerm = engine.runSimulation(entities, [...transactions, instrument], {
  ...termOptions,
  facilityDrawdowns: { [instrument.id]: { "2027Q1": 3, "2028Q2": 1, "2028Q3": 1 } },
  facilityExtensions: { [instrument.id]: "2028Q2" }
});
const originalMaturity = extendedTerm.timeline["2027Q3"];
const amendedMaturity = extendedTerm.timeline["2028Q2"];
assert.equal(originalMaturity.financingLedger[instrument.id].principalRepayment, 0);
assert.equal(originalMaturity.financingLedger[instrument.id].endingOutstanding, 3);
assert.equal(originalMaturity.financingLedger[instrument.id].originalMaturityQuarter, "2027Q3");
assert.equal(originalMaturity.financingLedger[instrument.id].maturityQuarter, "2028Q2");
assert.equal(originalMaturity.financingLedger[instrument.id].maturityExtensionDataType, "Assumption");
assert.equal(originalMaturity.debtReconciliation.OPENAI.namedTermPrincipal, 3);
assert.equal(amendedMaturity.financingLedger[instrument.id].principalRepayment, 3);
assert.equal(amendedMaturity.financingLedger[instrument.id].endingOutstanding, 0);
assert.equal(amendedMaturity.debtReconciliation.OPENAI.namedTermPrincipal, 0);
assert.equal(amendedMaturity.financingLedger[instrument.id].newDrawdown, 0);
const afterAmendedMaturity = extendedTerm.timeline["2028Q3"];
const expiredTerm = afterAmendedMaturity.financingLedger[instrument.id];
assert.equal(expiredTerm.remainingCommitment, 2);
assert.equal(expiredTerm.undrawnCommitment, 0);
assert.equal(expiredTerm.newDrawdown, 0);
assert.equal(expiredTerm.endingOutstanding, 0);
assert.equal(afterAmendedMaturity.entities.OPENAI.contractualTermDraw, 0);
assert.equal(afterAmendedMaturity.debtReconciliation.OPENAI.namedTermPrincipal, 0);
assert.equal(instrument.endQ, "2027Q3");
const trackedReplacement = engine.runSimulation(entities, [...transactions, instrument], {
  ...termOptions, ocean: { refiSuccessRate: 100, fundingAvailability: 100 },
  overrides: { OPENAI: { ...termOptions.overrides.OPENAI, refiSuccess: 1 } },
  facilityDrawdowns: { [instrument.id]: { "2027Q1": 3 } },
  refinancingTerms: { [instrument.id]: { maturityQuarter: "2028Q2", lender: "JPM" } },
  facilityRepayments: { ["REFI-" + instrument.id + "-2027Q3"]: { "2028Q1": 1 } }
});
const replacementId = "REFI-" + instrument.id + "-2027Q3";
const replacementQ = q => trackedReplacement.timeline[q].financingLedger[replacementId];
assert.equal(replacementQ("2027Q4")?.beginningOutstanding, 3);
assert.equal(replacementQ("2027Q4").lender, "JPM");
assert.equal(replacementQ("2028Q1").principalRepayment, 1);
assert.equal(replacementQ("2028Q1").endingOutstanding, 2);
assert.equal(replacementQ("2028Q2").principalRepayment, 2);
assert.equal(replacementQ("2028Q2").endingOutstanding, 0);
assert.equal(replacementQ("2027Q3").newDrawdown, 3);
assert.equal(replacementQ("2027Q3").endingOutstanding, 3);
assert.equal(trackedReplacement.timeline["2027Q3"].entities.OPENAI.newDebt, 3);
assert.equal(trackedReplacement.timeline["2027Q3"].debtReconciliation.OPENAI.namedTermPrincipal, 3);
assert.equal(trackedReplacement.timeline["2028Q1"].debtReconciliation.OPENAI.namedTermPrincipal, 2);
assert.equal(liquid.timeline["2026Q4"].financingLedger.TX26.lender, null);
const tx26Stress = engine.runSimulation(entities, transactions, { audit4Contracts: true,
  forcedDefaults: ["SPV_CRWV8"], overrides: { SPV_CRWV8: { debtRepay: 0 } } });
const zeroLossTx26 = engine.runSimulation(entities, transactions, { audit4Contracts: true, lgd: 0,
  forcedDefaults: ["SPV_CRWV8"], overrides: { SPV_CRWV8: { debtRepay: 0 } } });
const zeroLossEvents = zeroLossTx26.creditEvents.filter(event => event.txId === "TX26");
assert.equal(zeroLossEvents.length, 1);
assert.equal(zeroLossEvents[0].totalEAD, 4.583);
assert.equal(zeroLossEvents[0].recognizedLoss, 0);
assert.equal(zeroLossEvents[0].expectedRecovery, 4.583);
assert.equal(zeroLossTx26.timeline["2026Q4"].financingLedger.TX26.defaultExposure, 4.583);
assert.equal(zeroLossTx26.timeline["2026Q4"].contagionLog.some(row => row.txId === "TX26" && row.layer === "L1_FINANCIAL"), false);
const tx26Credit = tx26Stress.creditEvents.find(event => event.txId === "TX26");
assert.equal(tx26Credit.fundedEAD, 4.583);
assert.equal(tx26Credit.lender, null);
assert.equal(tx26Credit.undrawnCommitment, null);
assert.equal(tx26Credit.exposureCoverage, "FundedOnly");
const mixedRateQuarter = liquid.timeline["2026Q4"];
const mixedRateFacility = mixedRateQuarter.financingLedger.TX26;
const mixedFloatingShare = 2.2 / (2.2 + 2.4);
const mixedRateInterest = usd(4.583 * (mixedFloatingShare * 0.075 + (1 - mixedFloatingShare) * 0.059) / 4);
assert.equal(mixedRateFacility.modeledFloatingPrincipal, usd(4.583 * mixedFloatingShare));
assert.equal(mixedRateFacility.accruedInterest, mixedRateInterest);
assert.equal(mixedRateQuarter.entities.SPV_CRWV8.interestExp, mixedRateInterest);
const fullLedgerAudit = engine.runSimulation(entities, transactions, { audit4Contracts: true, forecastThrough: 2033 });
for (const quarter of Object.values(fullLedgerAudit.timeline)) {
  for (const row of Object.values(quarter.financingLedger ?? {})) {
    if (row.endingOutstanding == null) continue;
    assert.equal(row.endingOutstanding, usd(row.beginningOutstanding + row.newDrawdown -
      row.principalRepayment - row.nonCashConversion), `${quarter.quarter} ${row.txId}`);
  }
  for (const [id, row] of Object.entries(quarter.debtReconciliation ?? {})) {
    assert.ok(row.unattributedDebt >= 0, `${quarter.quarter} ${id}: ${row.unattributedDebt}`);
  }
}
const appliedTx26 = fullLedgerAudit.timeline["2026Q4"].financingLedger.TX26;
assert.equal(appliedTx26.inferredPrincipalRepayment, 0.35);
assert.equal(appliedTx26.endingOutstanding, 4.233);
assert.equal(fullLedgerAudit.timeline["2026Q4"].debtReconciliation.SPV_CRWV8.unattributedDebt, 0.3485);
const laterGuarantee = contracts.timeline["2028Q2"].guaranteeLedger.TX11;
assert.equal(laterGuarantee.projects?.[1].calledThisQuarter, usd(105 / 9 * 0.25));
assert.equal(laterGuarantee.projects[0].calledThisQuarter, 0);
assert.equal(laterGuarantee.calledGuarantee, usd(2 * usd(105 / 9 * 0.25)));
const cappedProjects = engine.runSimulation(entities, transactions, {
  audit4Contracts: true, forcedDefaults: ["OPENAI"], guaranteeCallRate: 1,
  sbEnergyProjects: [
    { readyQuarter: "2028Q1", leaseStartQuarter: "2028Q1", terminationQuarter: "2028Q2", termQuarters: 4, cap: 80 },
    { readyQuarter: "2028Q2", leaseStartQuarter: "2028Q2", termQuarters: 4, cap: 80 }
  ]
});
const cappedProjectQ2 = cappedProjects.timeline["2028Q2"].guaranteeLedger.TX11;
assert.equal(cappedProjectQ2.projects[0].phase, "Expired");
assert.equal(cappedProjectQ2.projects[1].calledThisQuarter, 25);
assert.equal(cappedProjectQ2.calledGuarantee, 105);
const expiredProject = engine.phasedGuarantee(projects, "2029Q1", 105).projects[0];
assert.equal(expiredProject.phase, "Expired");
assert.equal(expiredProject.rentPaid, 3);
assert.equal(expiredProject.effectiveExposure, 0);
assert.equal(expiredProject.leaseStartQuarter, "2028Q3");
const secondProjectEvent = contracts.creditEvents.find(event => event.txId === "TX11" && event.quarter === "2028Q2");
assert.deepEqual(secondProjectEvent.projectCalls, [{ projectIndex: 1, amount: 2.9167 }]);
assert.equal(secondProjectEvent.recognizedLoss, 2.9167);
const auditedStressResults = [];
for (const [name, entity, overrides, options] of cases) {
  const result = engine.runSimulation(entities, transactions, { audit4Contracts: true, overrides, ...options });
  for (const quarter of Object.values(result.timeline)) {
    if (!quarter.financingLedger) continue;
    for (const row of Object.values(quarter.financingLedger)) {
      if (row.endingOutstanding == null) continue;
      assert.equal(row.endingOutstanding, usd(row.beginningOutstanding + row.newDrawdown -
        row.principalRepayment - row.nonCashConversion), `${name} ${quarter.quarter} ${row.txId}`);
    }
    for (const [id, state] of Object.entries(quarter.entities)) {
      if (!quarter.debtReconciliation[id] || !Number.isFinite(state.begCash)) continue;
      const label = `${name} ${quarter.quarter} ${id}`;
      assert.ok(quarter.debtReconciliation[id].unattributedDebt >= 0, label + " unattributed debt");
      assert.equal(state.fcf, usd(state.ocf - state.capex), label);
      assert.equal(usd(Object.values(state.financingCashSources).reduce((sum, amount) => sum + amount, 0)),
        state.totalFinancingCashInflow, label + " financing sources");
      const cash = state.begCash + state.fcf + state.newDebt + state.equityInflow + state.rcfDraw -
        state.principalRepay - state.leasePrincipal - state.gpuMarginCall + state.disposalProceeds +
        state.openingInvestmentSale - (state.unallocatedGuaranteeCashPaid ?? 0) - (state.projectGuaranteeCashPaid ?? 0);
      assert.ok(Math.abs(state.cash - cash) <= 0.002, `${label} cash: ${state.cash} vs ${cash}`);
      const minimum = overrides[id]?.minCash ?? entities.find(row => row.id === id).defaults?.minCash ?? 1;
      assert.equal(state.fundingGap, usd(Math.max(0, minimum - state.cash)), label);
    }
  }
  const end = result.timeline["2028Q4"].entities[entity];
  auditedStressResults.push([name, entity, end.cash, end.fcf, end.fundingGap, result.scenarioSummary[entity].defaultQuarter]);
}
if (process.argv.includes("--audited-stress-markdown")) {
  console.log("| Case | Entity | 2028Q4 cash | 2028Q4 FCF | Funding gap | First model default |");
  console.log("| --- | --- | ---: | ---: | ---: | --- |");
  for (const [name, id, cash, fcf, gap, defaultQuarter] of auditedStressResults) {
    const company = { OPENAI: "OpenAI", ANTHROPIC: "Anthropic", CRWV: "CoreWeave", ORCL: "Oracle" }[id];
    console.log("| " + [name, company, cash, fcf, gap, defaultQuarter ?? "—"].join(" | ") + " |");
  }
} else {
  console.table(auditedStressResults);
}
const deferralRows = q => interrupted.timeline[q].operationalRevenueLedger.filter(row => row.customer === "CRWV");
const openingDelay = deferralRows("2026Q4").reduce((sum, row) => sum + row.added, 0);
assert.equal(usd(openingDelay), crwv("2026Q4").operationalRevDelay);
const recoveryRows = deferralRows("2027Q2");
assert.equal(usd(recoveryRows.reduce((sum, row) => sum + row.recovered, 0)), crwv("2027Q2").operationalRecoveryRevenue);
assert.equal(recoveryRows.reduce((sum, row) => sum + row.ending, 0), 0);
assert.equal(deferralRows("2027Q3").length, 0);
for (const [quarter, result] of Object.entries(interrupted.timeline)) {
  for (const row of result.operationalRevenueLedger ?? []) {
    assert.equal(row.ending, usd(row.beginning + row.added - row.recovered), quarter);
  }
}
assert.ok(recoveryRows.every(row => row.dueQuarter === "2027Q2"));
assert.equal(usd(recoveryRows.reduce((sum, row) => sum + row.cashRecovered, 0)), crwv("2027Q2").operationalRecoveryCash);
const peerScope = engine.runSimulation(entities, transactions, { audit4Contracts: true, forcedDefaults: ["CRWV"] });
const secondaryQuarter = peerScope.timeline["2026Q4"];
const peerSecondary = secondaryQuarter.entities.ORCL;
const peerShock = secondaryQuarter.contagionLog.find(row => row.layer === "L4_SECONDARY" && row.to === "ORCL");
assert.equal(peerSecondary.secondaryOpeningSpreadBps, 0);
assert.equal(peerSecondary.secondaryClosingSpreadBps, 100);
assert.equal(peerShock.impactB, usd(peerSecondary.secondaryFloatingPrincipal * 0.01 / 4));
const nextPeerSecondary = peerScope.timeline["2027Q1"].entities.ORCL;
assert.equal(nextPeerSecondary.secondaryOpeningSpreadBps, 50);
assert.equal(nextPeerSecondary.secondaryRefinancingMultiplier, 0.95);
const firstPeerEvents = peerScope.timeline["2026Q4"].contagionLog.filter(row => row.layer === "L4_SECONDARY" && row.from === "CRWV");
assert.ok(firstPeerEvents.some(row => row.to === "ORCL"));
assert.ok(firstPeerEvents.every(row => row.to !== "DELL"));
const operatingControls = engine.runSimulation([refreshFixture], [], {
  overrides: { REFRESH_FIXTURE: { capex: 1, capexGrowth: 0.1, ocfMarginBeforeFinancing: 0.5, revDecel: 0 } }
});
const controlled = operatingControls.timeline["2027Q1"].entities.REFRESH_FIXTURE;
assert.equal(controlled.capex, 1.1);
assert.equal(controlled.ocf, 2);
assert.equal(controlled.fcf, 0.9);
assert.equal(controlled.minimumRequiredRevenueGrowth, -0.45);
const detailedOperating = engine.runSimulation([refreshFixture], [], {
  overrides: { REFRESH_FIXTURE: { revDecel: 0, capex: 1, ocfMarginBeforeFinancing: 0.5,
    computePay: 0.2, incrementalResearchCashCost: 0.3, workingCapitalCashUse: 0.4 } }
}).timeline["2027Q1"].entities.REFRESH_FIXTURE;
assert.equal(detailedOperating.ocf, 1.1);
assert.equal(detailedOperating.fcf, 0.1);
assert.equal(detailedOperating.operatingCashBridge.researchCashCost, 0.3);
assert.equal(detailedOperating.operatingCashBridge.workingCapitalCashUse, 0.4);
assert.equal(detailedOperating.minimumRequiredRevenueGrowth, -0.05);
const weightedFunding = engine.runSimulation([refreshFixture], [], {
  overrides: { REFRESH_FIXTURE: { financing: { mode: "manual", capacity: 8, quarterlyLimit: 4,
    annual: { 2027: { equity: 8 } }, quarterWeights: [1, 0, 1, 2] } } }
});
assert.deepEqual(["2027Q1", "2027Q2", "2027Q3", "2027Q4"].map(q =>
  weightedFunding.timeline[q].entities.REFRESH_FIXTURE.equityInflow), [2, 0, 2, 4]);
assert.equal(usd(weightedFunding.timeline["2027Q4"].entities.REFRESH_FIXTURE.cash -
  withoutRefresh.timeline["2027Q4"].entities.REFRESH_FIXTURE.cash), 8);
const dilutionInputs = {
  mode: "manual", capacity: 8, quarterlyLimit: 4,
  annual: { 2027: { equity: 8, strategic: 8 } }, quarterWeights: [1, 1, 0, 0]
};
const dilutionRun = equityPreMoneyValuation => engine.runSimulation([refreshFixture], [], {
  overrides: { REFRESH_FIXTURE: { equityPreMoneyValuation, financing: dilutionInputs } }
});
const pricedDilution = dilutionRun(18);
const dilutionFirst = pricedDilution.timeline["2027Q1"].entities.REFRESH_FIXTURE;
const dilutionSecond = pricedDilution.timeline["2027Q2"].entities.REFRESH_FIXTURE;
assert.equal(dilutionFirst.equityInflow, 4);
assert.equal(dilutionFirst.scenarioEquityIssued, 2);
assert.equal(dilutionFirst.scenarioEquityDilution, 0.1);
assert.equal(dilutionSecond.cumulativeScenarioEquityDilution, 0.19);
assert.equal(dilutionRun(8).timeline["2027Q2"].entities.REFRESH_FIXTURE.cumulativeScenarioEquityDilution, 0.36);
assert.equal(dilutionRun(null).timeline["2027Q2"].entities.REFRESH_FIXTURE.cumulativeScenarioEquityDilution, null);
const utilizedGpu = runRefreshFixture({ cohorts: [{ acquired: "2026Q4", cost: 20 }],
  economicLife: 4, residualValue: 0.2, utilizationRate: 0.5, annualUsageMaintenanceRate: 0.08
}).timeline["2028Q4"].entities.REFRESH_FIXTURE;
assert.equal(utilizedGpu.gpuCollateralValue, 6);
assert.equal(utilizedGpu.gpuUtilizationRate, 0.5);
assert.equal(utilizedGpu.operatingCashBridge.gpuUsageMaintenanceCash, 0.2);
assert.equal(usd(withoutRefresh.timeline["2028Q4"].entities.REFRESH_FIXTURE.fcf - utilizedGpu.fcf), 0.2);
const lowerMarketGpu = runRefreshFixture({ cohorts: [{ acquired: "2026Q4", cost: 20, marketValueFactor: 0.75 }],
  economicLife: 4, residualValue: 0.2, utilizationRate: 0.5
}).timeline["2028Q4"].entities.REFRESH_FIXTURE;
assert.equal(lowerMarketGpu.gpuCollateralValue, 4.5);
assert.equal(lowerMarketGpu.operatingCashBridge.gpuUsageMaintenanceCash, 0);
const gpuRevenueModel = runRefreshFixture({
  cohorts: [{ acquired: "2026Q4", cost: 20 }], economicLife: 4,
  utilizationRate: 0.5, referenceUtilizationRate: 1, utilizationRevenueShare: 0.5
});
for (const q of ["2026Q4", "2027Q1", "2027Q2"]) {
  const row = gpuRevenueModel.timeline[q].entities.REFRESH_FIXTURE;
  const reference = withoutRefresh.timeline[q].entities.REFRESH_FIXTURE;
  const lostRevenue = usd(reference.revenue * 0.25);
  assert.equal(row.revenue, usd(reference.revenue - lostRevenue), q);
  assert.equal(row.gpuUtilizationRevenueAdjustment, -lostRevenue, q);
  assert.ok(Math.abs(reference.fcf - row.fcf - lostRevenue * 0.5) <= 0.0001, q);
}
const bilateralFixtures = [
  ["CRWV", "OPENAI", "TX05A", "2026Q4", 0.081, 0.0654],
  ["CRWV", "OPENAI", "TX05B", "2026Q4", 0.027, 0.0218],
  ["CRWV", "OPENAI", "TX05C", "2026Q4", 0.0432, 0.0349],
  ["CRWV", "MSFT", "TX25", "2026Q4", 0.1485, 0.1199],
  ["VERTIV", "CRWV", "TX65", "2026Q4", 0.0343, 0.0541],
  ["DELL", "CRWV", "TX64", "2026Q4", 0.025, 0.0484],
  ["CEG", "MSFT", "TX67", "2028Q1", 0.2112, 0.1663],
  ["VST", "META", "TX69", "2027Q1", 0.2677, 0.241],
  ["CORZ", "CRWV", "TX66", "2026Q4", 0.0577, 0.0743],
  ["NVDA", "CRWV", "TX24", "2026Q4", 0.462, 0.4851],
  ["ORCL", "OPENAI", "TX03", "2027Q1", 1.26, 1.2212]
];
const bilateralRuns = new Map([...new Set(bilateralFixtures.map(([supplier]) => supplier))].map(supplier =>
  [supplier, engine.runSimulation(entities, transactions, { audit4Contracts: true, forcedDefaults: [supplier] })]));
for (const [supplier, customer, txId, firstQ, migrationCost, disruptedRevenue] of bilateralFixtures) {
  const events = Object.values(bilateralRuns.get(supplier).timeline).flatMap(quarter =>
    (quarter.contagionLog ?? []).filter(event => event.txId === txId && event.from === supplier &&
      event.to === customer && event.layer === "L3_OPERATIONAL").map(event => ({ ...event, quarter: quarter.quarter })));
  assert.equal(events[0]?.quarter, firstQ, txId);
  const migration = events.filter(event => event.migrationCashCost != null);
  assert.equal(migration.length, 1, txId);
  assert.equal(migration[0].migrationCashCost, migrationCost, txId);
  const disruption = events.find(event => event.deferredRevenue != null);
  assert.equal(disruption.impactB, disruptedRevenue, txId);
  assert.equal(usd(disruption.deferredRevenue + disruption.permanentRevenueLoss), disruption.impactB, txId);
}
const dell = liquid.timeline["2026Q4"].entities.DELL;
assert.equal(dell.begCash, 11.569);
assert.equal(dell.priorQuarterRevenue, 46.971);
assert.equal(dell.openingQuarterCashFlow.grossCashFcf, 0.986);
assert.equal(usd(dell.openingFiscalCashFlowDisclosure.currentBorrowings + dell.openingFiscalCashFlowDisclosure.nonCurrentBorrowings), 34.466);
assert.equal(dell.laterFiscalDisclosure.periodEnd, "2026-10-30");
assert.equal(usd(dell.laterFiscalDisclosure.ocf - dell.laterFiscalDisclosure.capex), 3.474);
const apldOpening = liquid.timeline["2026Q4"].entities.APLD;
assert.equal(apldOpening.begCash, 2.9499);
assert.equal(apldOpening.openingQuarterCashFlow.grossCashFcf, -2.0108);
assert.equal(usd(apldOpening.openingFiscalCashFlowDisclosure.currentBorrowings +
  apldOpening.openingFiscalCashFlowDisclosure.nonCurrentBorrowings), 6.3766);
const irenOpening = liquid.timeline["2026Q4"].entities.IREN;
assert.equal(irenOpening.begCash, 3.522);
assert.equal(irenOpening.openingQuarterCashFlow.grossCashFcf, -4.295);
assert.equal(irenOpening.openingFiscalCashFlowDisclosure.computerHardwareCashPurchases, 2.693);
assert.equal(irenOpening.gpuPurchases, 0);

for (const [id, cash, ocf, capex, fcf] of [
  ["DLR", 0.8029, 0.3823, 1.382, -0.9997],
  ["EQIX", 2.362, 1.243, 1.558, -0.315]
]) {
  const opening = liquid.timeline["2026Q4"].entities[id];
  const actual = opening.openingQuarterCashFlow;
  assert.equal(opening.begCash, cash, id);
  assert.deepEqual([actual.ocf, actual.capex, actual.grossCashFcf], [ocf, capex, fcf], id);
}
const eqixOpening = liquid.timeline["2026Q4"].entities.EQIX;
const eqixDisclosure = eqixOpening.openingFiscalCashFlowDisclosure;
assert.equal(eqixDisclosure.currentBorrowings + eqixDisclosure.nonCurrentBorrowings, 22.647);
assert.equal(usd(eqixDisclosure.operatingLeaseLiability + eqixDisclosure.financeLeaseLiability), 3.764);
assert.equal(eqixDisclosure.uncommencedLeaseCommitment, 0.694);
assert.equal(eqixDisclosure.borrowingsPrincipal, 22.839);
assert.equal(liquid.timeline["2026Q4"].financingLedger.TX57.beginningOutstanding, 22.82);

const coreWeaveLeases = entities.find(row => row.id === "CRWV").audit4LeaseDisclosure;
assert.equal(usd(coreWeaveLeases.operatingPayments.reduce((sum, payment) => sum + payment, 0) -
  coreWeaveLeases.operatingImputedInterest), 18.697);
assert.equal(usd(coreWeaveLeases.financePayments.reduce((sum, payment) => sum + payment, 0) -
  coreWeaveLeases.financeImputedInterest), 0.649);
assert.equal(coreWeaveLeases.uncommencedUndiscountedPayments, 47.4);

for (const [termQuarters, payment, ocf, fcf, cash, requiredRevenue] of [
  [28, 1.6929, 0.4656, -4.7344, 4.1982, 2.56],
  [68, 0.6971, 1.4614, -3.7386, 5.194, 0.54]
]) {
  const stress = engine.runSimulation(entities, transactions, { audit4Contracts: true, overrides: {
    CRWV: { incrementalLeaseTranches: [{ type: "operating", startQuarter: "2026Q4",
      termQuarters, commitment: coreWeaveLeases.uncommencedUndiscountedPayments }] }
  } }).timeline["2026Q4"].entities.CRWV;
  assert.deepEqual([stress.incrementalLeasePayment, stress.ocf, stress.fcf, stress.cash,
    stress.requiredRevenue], [payment, ocf, fcf, cash, requiredRevenue]);
  assert.equal(usd(stress.cash + payment), 5.8911);
  assert.equal(usd(stress.fcf + payment), -3.0415);
}

const preAmazonRevolverEntities = entities.map(entity => entity.id === "AMZN"
  ? { ...entity, audit4Facilities: [] } : entity);
const delayedCoreWeaveLease = engine.runSimulation(preAmazonRevolverEntities, transactions, { audit4Contracts: true, overrides: {
  CRWV: { leaseDelayQuarters: 4, incrementalLeaseTranches: [{ type: "operating", startQuarter: "2026Q4",
    termQuarters: 28, commitment: coreWeaveLeases.uncommencedUndiscountedPayments }] }
} }).timeline;
const preCommencement = delayedCoreWeaveLease["2027Q3"].entities.CRWV;
const atCommencement = delayedCoreWeaveLease["2027Q4"].entities.CRWV;
assert.deepEqual([preCommencement.incrementalLeasePayment, preCommencement.leaseSchedule.uncommencedCommitment,
  preCommencement.fcf, preCommencement.cash], [0, 47.4, -2.7039, 11.9317]);
assert.deepEqual([atCommencement.incrementalLeasePayment, atCommencement.leaseSchedule.uncommencedCommitment,
  atCommencement.fcf, atCommencement.cash], [1.6929, 0, -4.4515, 12.2908]);
assert.equal(usd(atCommencement.cash - 5.5192), 4 * usd(47.4 / 28));

const releaseFixture = [{ readyQuarter: "2028Q1", leaseStartQuarter: "2028Q2", termQuarters: 80,
  cap: 12, qualifyingCreditRatingQuarter: "2028Q4", qualifyingReplacementQuarter: "2028Q3",
  paymentsByQuarter: { "2028Q2": 2, "2028Q3": 1 } }];
const beforeRelease = engine.phasedGuarantee(releaseFixture, "2028Q2", 105, { 0: 1 });
assert.deepEqual([beforeRelease.effectiveExposure, beforeRelease.remainingGuaranteeLiability], [10, 9]);
const afterRelease = engine.phasedGuarantee(releaseFixture, "2028Q3", 105, { 0: 1 });
assert.deepEqual([afterRelease.effectiveExposure, afterRelease.remainingGuaranteeLiability,
  afterRelease.calledGuarantee, afterRelease.projects[0].rentPaid], [0, 0, 1, 2]);
assert.equal(afterRelease.projects[0].releaseReason, "Qualifying replacement support");

const sbEnergySettlementOptions = { audit4Contracts: true, forcedDefaults: ["OPENAI"], guaranteeCallRate: 0.25,
  sbEnergyProjects: [{ readyQuarter: "2028Q1", leaseStartQuarter: "2028Q1", termQuarters: 80, cap: 12 }] };
const immediateCall = engine.runSimulation(entities, transactions, sbEnergySettlementOptions);
const delayedCall = engine.runSimulation(entities, transactions,
  { ...sbEnergySettlementOptions, sbEnergySettlementLagQuarters: 2 });
assert.equal(delayedCall.creditEvents.find(event => event.txId === "TX11").scenarioCashSettlementQuarter, "2028Q3");
const delayedCallFirst = delayedCall.timeline["2028Q1"];
assert.equal(delayedCallFirst.guaranteeLedger.TX11.calledGuarantee, 3);
assert.equal(delayedCallFirst.guaranteeLedger.TX11.cashSettledThisQuarter, 0);
assert.equal(usd(delayedCallFirst.entities.NVDA.cash - immediateCall.timeline["2028Q1"].entities.NVDA.cash), 3);
assert.equal(delayedCall.timeline["2028Q3"].guaranteeLedger.TX11.cashSettledThisQuarter, 3);
assert.equal(delayedCall.timeline["2028Q4"].guaranteeLedger.TX11.cashSettledThisQuarter, 0);

const noSbEnergyCall = engine.runSimulation(entities, transactions,
  { ...sbEnergySettlementOptions, guaranteeCallRate: 0 });
for (const [run, quarter] of [[immediateCall, "2028Q1"], [delayedCall, "2028Q3"]]) {
  const actual = run.timeline[quarter].entities.NVDA;
  const baseline = noSbEnergyCall.timeline[quarter].entities.NVDA;
  assert.equal(actual.projectGuaranteeCashPaid, 3);
  assert.equal(actual.ocf, baseline.ocf);
  assert.equal(actual.fcf, baseline.fcf);
  assert.equal(usd(baseline.cash - actual.cash), 3);
}

const anthropicRcfProfile = engine.runSimulation(entities, transactions, { audit4Contracts: true }).timeline["2026Q4"];
const anthropicRcf = anthropicRcfProfile.financingLedger.ANTHROPIC_RCF_RESTATED;
assert.equal(anthropicRcf?.undrawnCommitment, 14.795);
assert.equal(anthropicRcf.endingOutstanding, 0);
assert.equal(anthropicRcf.lender, null);
assert.equal(anthropicRcfProfile.entities.ANTHROPIC.undrawnCredit, 14.795);
assert.equal(anthropicRcfProfile.financingLedger.TX17A, undefined);
assert.equal(anthropicRcfProfile.financingLedger.TX17B, undefined);
const restatedRcf = entities.find(entity => entity.id === "ANTHROPIC").audit4Facilities[0];
assert.equal(restatedRcf.maturityDate, "2031-09-04");
assert.equal(engine.computeTransactionEAD(restatedRcf, "2031Q2").undrawnCommitment, 14.795);
assert.equal(engine.computeTransactionEAD(restatedRcf, "2031Q3").undrawnCommitment, 0);
const anthropicLease = entities.find(row => row.id === "ANTHROPIC").audit4LeaseDisclosure;
assert.deepEqual([anthropicLease.uncommencedUndiscountedPayments, anthropicLease.uncommencedStartYears,
  anthropicLease.uncommencedWeightedAverageTermYears], [451.2, [2026, 2028], 10]);
const anthropicLeaseScenarios = [0, 4].map(leaseDelayQuarters =>
  engine.runSimulation(entities, transactions, { audit4Contracts: true, forecastThrough: 2031, overrides: {
    ANTHROPIC: { leaseDelayQuarters, incrementalLeaseTranches: [{ type: "operating", startQuarter: "2026Q4",
      termQuarters: 40, commitment: anthropicLease.uncommencedUndiscountedPayments }] }
  } }).timeline);
const [earlyAnthropicLease, delayedAnthropicLease] = anthropicLeaseScenarios;
const earlyAnthropic = earlyAnthropicLease["2026Q4"].entities.ANTHROPIC;
const delayedAnthropic = delayedAnthropicLease["2026Q4"].entities.ANTHROPIC;
assert.equal(earlyAnthropic.incrementalLeasePayment, 11.28);
assert.equal(delayedAnthropic.incrementalLeasePayment, 0);
assert.equal(usd(delayedAnthropic.cash - earlyAnthropic.cash), 11.28);
assert.equal(usd(delayedAnthropic.fcf - earlyAnthropic.fcf), 11.28);
assert.equal(delayedAnthropicLease["2027Q4"].entities.ANTHROPIC.incrementalLeasePayment, 11.28);
const earlyLeaseClosing = earlyAnthropicLease["2031Q4"].entities.ANTHROPIC;
assert.equal(earlyLeaseClosing.minCash, 8);
assert.equal(earlyLeaseClosing.cash, -12.5409);
assert.equal(earlyLeaseClosing.rcfDraw, 0);
assert.equal(earlyLeaseClosing.fundingGap, 20.5409);
assert.equal(delayedAnthropicLease["2031Q4"].entities.ANTHROPIC.fundingGap, 0);

assert.equal(usd(anthropicLease.operatingPayments.reduce((sum, payment) => sum + payment, 0) -
  anthropicLease.operatingImputedInterest), 2.81);
assert.equal(usd(anthropicLease.financePayments.reduce((sum, payment) => sum + payment, 0) -
  anthropicLease.financeImputedInterest), 1.674);
assert.equal(usd(anthropicLease.separatePurchaseCommitments.reduce((sum, payment) => sum + payment, 0)), 313.819);

const coreWeaveHardware = entities.find(row => row.id === "CRWV").audit4HardwareDisclosure;
assert.equal(coreWeaveHardware.accountingUsefulLifeYears, 6);
assert.equal(usd(coreWeaveHardware.grossTechnologyEquipment - coreWeaveHardware.grossTechnologyEquipmentPriorYearEnd), 26.12);
assert.deepEqual([coreWeaveHardware.gpuOnlyPurchaseCost, coreWeaveHardware.physicalUsefulLifeYears,
  coreWeaveHardware.economicUsefulLifeYears], [null, null, null]);

assert.deepEqual(entities.find(row => row.id === "MSFT").audit4HardwareDisclosure.accountingUsefulLifeRangeYears, [2, 6]);
const amazonHardware = entities.find(row => row.id === "AMZN").audit4HardwareDisclosure;
assert.deepEqual([amazonHardware.priorAccountingUsefulLifeYears, amazonHardware.accountingUsefulLifeYears,
  amazonHardware.accountingLifeAppliesToSubset, amazonHardware.incrementalDepreciationExpense], [6, 5, true, 1.4]);

assert.equal(entities.find(row => row.id === "GOOGL").audit4HardwareDisclosure.accountingUsefulLifeYears, 6);
assert.equal(entities.find(row => row.id === "ORCL").audit4HardwareDisclosure.accountingUsefulLifeYears, 6);
const metaHardware = entities.find(row => row.id === "META").audit4HardwareDisclosure;
assert.deepEqual(metaHardware.accountingUsefulLifeRangeYears, [5, 5.5]);
assert.equal(metaHardware.reportedServerNetworkDepreciationExpense, 13.36);

assert.deepEqual(entities.find(row => row.id === "NVDA").audit4HardwareDisclosure.accountingUsefulLifeRangeYears, [2, 7]);
const nebiusHardware = entities.find(row => row.id === "NBIS").audit4HardwareDisclosure;
assert.deepEqual([nebiusHardware.priorAccountingUsefulLifeYears, nebiusHardware.accountingUsefulLifeYears], [4, 5]);
const irenHardware = entities.find(row => row.id === "IREN").audit4HardwareDisclosure;
assert.deepEqual([irenHardware.accountingUsefulLifeYears, irenHardware.pledgedNetCarryingValue,
  irenHardware.gpuHardwareGrossCarryingValue], [5, 1.4871, 5.819]);

const irenGpuFacilities = liquid.timeline["2026Q4"].financingLedger;
for (const [id, opening, funded, remaining] of [
  ["IREN_GPU1_DDTL", 0.409, 0.413, 1.132],
  ["IREN_GPU1_USPP", 1.571, 1.575, 0.525]
]) {
  const facility = irenGpuFacilities[id];
  assert.deepEqual([facility.beginningOutstanding, facility.cumulativeDrawdown, facility.remainingCommitment,
    facility.lender], [opening, funded, remaining, null]);
}
assert.equal(irenOpening.openingFiscalCashFlowDisclosure.borrowingsPrincipal, 10.041);
assert.equal(liquid.timeline["2026Q4"].debtReconciliation.IREN.namedTermPrincipal, usd(9.991 - 0.0267));
const irenNamedOpening = Object.values(irenGpuFacilities).filter(facility => facility.borrower === "IREN")
  .reduce((sum, facility) => sum + facility.beginningOutstanding, 0);
assert.equal(usd(irenNamedOpening), 10.027);
assert.equal(usd(10.041 - irenNamedOpening), 0.014);

const nvidiaGuaranteeDisclosure = entities.find(row => row.id === "NVDA").audit4GuaranteeDisclosure;
const [wardCountyDisclosure] = nvidiaGuaranteeDisclosure.counterpartyDisclosures;
assert.deepEqual([wardCountyDisclosure.maximumFaceAmount, wardCountyDisclosure.coveredRentYears,
  wardCountyDisclosure.portfolioCategory], [0.8603, 5, null]);
assert.equal(nvidiaGuaranteeDisclosure.categories.reduce((sum, row) => sum + row.maximum, 0), 118);

const openAiTranches = entities.find(row => row.id === "OPENAI").reportedFinancingTranches;
assert.equal(openAiTranches.filter(tranche => tranche.investor === "SoftBank Vision Fund 2"
  && tranche.roundCommitmentReference === "OpenAI March 2026 round")
  .reduce((total, tranche) => total + tranche.amount, 0), 30);
assert.equal(openAiTranches.filter(tranche => tranche.investor === "Amazon")
  .reduce((total, tranche) => total + tranche.amount, 0), 50);
const openAi2025 = openAiTranches.filter(tranche => tranche.roundCommitmentReference === "OpenAI March 2025 round");
assert.deepEqual(openAi2025.map(row => [row.date ?? row.quarter, row.amount]), [["2025Q2", 7.5], ["2025-12-26", 22.5]]);
assert.equal(openAi2025.reduce((sum, row) => sum + row.amount, 0), 30);
const q4Tranche = openAiTranches.find(tranche => tranche.date === "2026-10-01");
const openAiFreezeOptions = { audit4Contracts: true, overrides: {
  OPENAI: { financing: { mode: "manual", capacity: 0, annual: {} } }
} };
const trancheExcluded = engine.runSimulation(preAmazonRevolverEntities, transactions, openAiFreezeOptions);
const trancheIncluded = engine.runSimulation(preAmazonRevolverEntities.map(row => row.id === "OPENAI" ? {
  ...row, scheduledEquityInflows: { ...row.scheduledEquityInflows, "2026Q4": q4Tranche.amount }
} : row), transactions, openAiFreezeOptions);
assert.deepEqual([trancheExcluded.timeline["2026Q4"].entities.OPENAI.cash,
  trancheIncluded.timeline["2026Q4"].entities.OPENAI.cash], [30.0884, 40.0884]);
assert.deepEqual([trancheExcluded.timeline["2028Q4"].entities.OPENAI.cash,
  trancheIncluded.timeline["2028Q4"].entities.OPENAI.cash], [-47.4052, -38.9871]);
assert.equal(trancheIncluded.scenarioSummary.OPENAI.defaultQuarter, "2027Q4");

const microsoftOpenAi = transactions.find(row => row.id === "TX01");
const [juneMicrosoft, septemberMicrosoft] = microsoftOpenAi.counterpartyFinancialObservations;
assert.equal(usd(septemberMicrosoft.funded - juneMicrosoft.funded), 0.1);
assert.equal(usd(septemberMicrosoft.counterpartyReceivable - juneMicrosoft.counterpartyReceivable), 1.2);
assert.equal(microsoftOpenAi.amountDrawn, septemberMicrosoft.funded);
assert.equal(microsoftOpenAi.remainingCommitment, septemberMicrosoft.commitment - septemberMicrosoft.funded);

const contractedCashFixture = { id: "DRAW_TEST", financials: refreshFixture.financials,
  defaults: { ...refreshFixture.defaults, minCash: 150 } };
const contractedCashLoan = { ...instrument, id: "DRAW-TX", receiver: "DRAW_TEST", payer: null,
  announcedDate: "2026-11-01", endQ: "2028Q4" };
for (const margin of [undefined, 0.5]) {
  for (const [draw, cash, requiredRevenue] of [[0, 102, 100], [3, 105, 94]]) {
    const quarter = engine.runSimulation([contractedCashFixture], [contractedCashLoan], {
      audit4Contracts: true, overrides: { DRAW_TEST: { ocfMarginBeforeFinancing: margin } },
      facilityDrawdowns: { "DRAW-TX": { "2026Q4": draw } }
    }).timeline["2026Q4"];
    const state = quarter.entities.DRAW_TEST;
    assert.deepEqual([state.contractualTermDraw, state.cash, state.ocf, state.fcf, state.requiredRevenue],
      [draw, cash, 2, 2, requiredRevenue]);
    assert.equal(quarter.financingLedger["DRAW-TX"].endingOutstanding, draw);
  }
}

for (const margin of [undefined, 0.5]) {
  const state = engine.runSimulation([contractedCashFixture], [contractedCashLoan], {
    audit4Contracts: true, overrides: { DRAW_TEST: { ocfMarginBeforeFinancing: margin, computePay: 5 } },
    facilityDrawdowns: { "DRAW-TX": { "2026Q4": 3 } }
  }).timeline["2026Q4"].entities.DRAW_TEST;
  assert.deepEqual([state.operatingCashBridge.incrementalComputeCashCost, state.cash, state.ocf,
    state.fcf, state.requiredRevenue], [5, 100, -3, -3, 104]);
}

for (const margin of [undefined, 0.5]) {
  const state = engine.runSimulation([contractedCashFixture], [], { audit4Contracts: true, overrides: {
    DRAW_TEST: { ocfMarginBeforeFinancing: margin, gpuRefresh: {
      cohorts: [{ acquired: "2023Q4", cost: 20 }], economicLife: 3, replacementRatio: 1, residualValue: 0.25
    } }
  } }).timeline["2026Q4"].entities.DRAW_TEST;
  assert.deepEqual([state.replacementCapex, state.disposalProceeds, state.cash, state.ocf,
    state.fcf, state.requiredRevenue], [20, 5, 87, 2, -18, 130]);
}

const investmentSaleFixture = { ...contractedCashFixture, audit4Liquidity: {
  cashAndEquivalents: 100, currentInvestments: 12, knownRestrictedWithinCurrentInvestments: 2
} };
const investmentSaleRun = engine.runSimulation([investmentSaleFixture], [], {
  audit4Contracts: true, overrides: { DRAW_TEST: { openingInvestmentSaleFraction: 0.5 } }
}).timeline;
const investmentSaleOpening = investmentSaleRun["2026Q4"].entities.DRAW_TEST;
assert.deepEqual([investmentSaleOpening.openingInvestmentSale, investmentSaleOpening.cash,
  investmentSaleOpening.fcf, investmentSaleOpening.requiredRevenue], [5, 107, 2, 90]);
assert.equal(investmentSaleRun["2027Q1"].entities.DRAW_TEST.openingInvestmentSale, 0);

const mixedFinancingCash = engine.runSimulation([contractedCashFixture], [], { audit4Contracts: true, ocean: { refiSuccessRate: 100 }, overrides: {
  DRAW_TEST: { refiSuccess: 1, financing: { mode: "manual", annual: { 2027: {
    equity: 4, strategic: 8, prepayment: 12, other: 16, debt: 20, assetBacked: 24
  } }, capacity: 84, quarterlyLimit: 21 } }
} }).timeline["2027Q1"].entities.DRAW_TEST;
assert.deepEqual(mixedFinancingCash.financingCashSources, {
  scheduledEquity: 0, scenarioEquity: 1, strategicInvestment: 2, customerPrepayment: 3, otherFinancing: 4,
  legacyNonDebtFinancing: 0, scenarioDebt: 5, assetBackedFinancing: 6, debtRollover: 0,
  legacyNewDebt: 0, contractualTermDraw: 0, rcfDraw: 0
});
assert.equal(mixedFinancingCash.totalFinancingCashInflow, 21);
assert.equal(mixedFinancingCash.scenarioEquityIssued, 1);

const nvidiaLeases = entities.find(row => row.id === "NVDA").audit4LeaseDisclosure;
assert.equal(nvidiaLeases.uncommencedLeasePayments.reduce((sum, payment) => sum + payment, 0), 74);
assert.equal(nvidiaLeases.separateCloudServicePayments.reduce((sum, payment) => sum + payment, 0), 28);
assert.equal(nvidiaLeases.uncommencedLeasePayments.at(-1), 63);

const nvidiaLeaseStress = engine.runSimulation(preAmazonRevolverEntities, transactions, {
  audit4Contracts: true, forecastThrough: 2031, overrides: { NVDA: { includeNvidiaLeaseBuckets: true } }
}).timeline;
for (const [quarter, payment, ocf, fcf, cash] of [
  ["2027Q1", 0, 32.0665, 27.2665, 72.0817],
  ["2027Q2", 0.25, 35.3886, 30.5886, 102.1703],
  ["2031Q1", 1, 16.537, 11.737, 575.2559],
  ["2031Q2", 0, 12.1469, 7.3469, 582.1028]
]) {
  const state = nvidiaLeaseStress[quarter].entities.NVDA;
  assert.deepEqual([state.incrementalLeasePayment, state.ocf, state.fcf, state.cash], [payment, ocf, fcf, cash]);
}
assert.equal(usd(Object.values(nvidiaLeaseStress).reduce((sum, quarter) =>
  sum + (quarter.entities.NVDA.incrementalLeasePayment ?? 0), 0)), 11);

const leasePresetRun = engine.runSimulation(entities, transactions, { audit4Contracts: true, overrides: {
  ANTHROPIC: { disclosedLeaseStressYears: 10, leaseDelayQuarters: 4 },
  CRWV: { disclosedLeaseStressYears: 7 }
} }).timeline;
assert.equal(leasePresetRun["2026Q4"].entities.ANTHROPIC.incrementalLeasePayment, 0);
assert.equal(leasePresetRun["2027Q4"].entities.ANTHROPIC.incrementalLeasePayment, 11.28);
assert.equal(leasePresetRun["2026Q4"].entities.CRWV.incrementalLeasePayment, 1.6929);

const anthropicReportedCash = entities.find(row => row.id === "ANTHROPIC").audit4Observations;
assert.equal(usd(Object.values(anthropicReportedCash.nineMonthOperatingCashReconciliation)
  .reduce((total, amount) => total + amount, 0)), 6.569);
assert.equal(usd(anthropicReportedCash.nineMonthOperatingCashFlow - anthropicReportedCash.nineMonthCashPpePurchases), 5.644);
assert.equal(usd(anthropicReportedCash.nineMonthOperatingCashFlow - anthropicReportedCash.nineMonthCashPpePurchases -
  anthropicReportedCash.nineMonthLeasedAssetAndEquipmentPrepayments - anthropicReportedCash.nineMonthFinanceLeasePrincipalPaid), 3.601);
assert.equal(anthropicReportedCash.standaloneQ3OperatingCashFlow, null);

const frozenPlan = { mode: "manual", capacity: 8, quarterlyLimit: 2, annual: { 2027: { equity: 8 } }, frozen: true };
const scheduledEquityFixture = { ...contractedCashFixture, scheduledEquityInflows: { "2027Q1": 3 } };
const frozenCash = engine.runSimulation([scheduledEquityFixture], [], { audit4Contracts: true,
  overrides: { DRAW_TEST: { financing: frozenPlan } }
}).timeline["2027Q1"].entities.DRAW_TEST;
assert.equal(frozenCash.financingCashSources.scenarioEquity, 0);
assert.equal(frozenCash.financingCashSources.scheduledEquity, 3);
assert.equal(frozenCash.totalFinancingCashInflow, 3);
assert.equal(engine.financingForecast(frozenPlan, 2027).amounts.equity, 8);

const withOperationalScenario = CRWV => engine.runSimulation(entities, transactions, {
  audit4Contracts: true, forcedDefaults: ["CORZ"], overrides: { CRWV }
}).timeline;
const fullSubstitution = withOperationalScenario({ operationalSubstitutionAvailability: 1 });
assert.equal(fullSubstitution["2026Q4"].contagionLog.filter(row => row.txId === "TX66" &&
  row.layer === "L3_OPERATIONAL").length, 0);
const slowerRecovery = withOperationalScenario({ operationalRecoveryRate: 0.5, operationalRecoveryDelayQuarters: 1 });
const tx66Deferred = quarter => slowerRecovery[quarter].operationalRevenueLedger.filter(row => row.txId === "TX66");
assert.equal(tx66Deferred("2026Q4")[0].added, 0.0372);
assert.deepEqual(tx66Deferred("2027Q2").map(row => [row.recovered, row.ending]), [[0, 0.0372], [0, 0.0186]]);
assert.deepEqual(tx66Deferred("2027Q3").map(row => [row.recovered, row.cashRecovered, row.ending]),
  [[0.0372, 0.0183, 0], [0.0186, 0.0092, 0]]);
assert.equal(tx66Deferred("2027Q4").length, 0);

const riskFixture = { cash: 100, debt: 0, fcf: 0, revenue: 10, grossMargin: 0.5,
  auditedRefinancingPrincipalDue: 0, auditedFixedCashObligations: 4, auditedRefinancingFactor: 1 };
assert.equal(engine.computeFragilityScore(contractedCashFixture, riskFixture, {}).score, 6);
assert.equal(engine.computeFragilityScore(contractedCashFixture, {
  ...riskFixture, auditedRefinancingFactor: 0.5
}, {}).score, 21);
assert.equal(engine.computeFragilityScore(contractedCashFixture, {
  ...riskFixture, auditedFixedCashObligations: 0
}, {}).score, 4);
assert.equal(nextPeerSecondary.auditedRefinancingFactor < 1, true);

const bufferFixture = { ...riskFixture, auditedFixedCashObligations: 0, minCash: 20 };
const farFromFloor = engine.computeFragilityScore(contractedCashFixture, { ...bufferFixture, cash: 40 }, {});
const nearFloor = engine.computeFragilityScore(contractedCashFixture, { ...bufferFixture, cash: 25 }, {});
const belowFloor = engine.computeFragilityScore(contractedCashFixture, {
  ...bufferFixture, cash: 19, distressLevel: 1
}, {});
assert.equal(farFromFloor.score, 4);
assert.deepEqual(nearFloor, { score: 6, drivers: ["Low Operating Cash Buffer"] });
assert.deepEqual(belowFloor, { score: 8, drivers: ["Low Operating Cash Buffer"] });

const coreWeaveConsolidation = liquid.parentSpvReconciliation.find(row => row.spvId === "SPV_CRWV8");
assert.equal(coreWeaveConsolidation.parentConsolidatedDebt, 46.873);
assert.equal(coreWeaveConsolidation.parentConsolidatedPrincipal, 47.505);
assert.equal(usd(coreWeaveConsolidation.parentRecoursePrincipal + coreWeaveConsolidation.parentNonRecoursePrincipal), 47.505);
assert.equal(usd(coreWeaveConsolidation.parentConsolidatedPrincipal - coreWeaveConsolidation.parentConsolidatedDebt), 0.632);
assert.equal(coreWeaveConsolidation.netSystemWidePrincipal, 47.505);
assert.equal(coreWeaveConsolidation.spvFundedDebt, 4.583);

const juneTx26 = engine.reconcileParentSpvDebt(entities, transactions, "2026Q2").find(row => row.spvId === "SPV_CRWV8");
const marchTx26 = engine.reconcileParentSpvDebt(entities, transactions, "2026Q1").find(row => row.spvId === "SPV_CRWV8");
assert.equal(juneTx26.spvFundedDebt, 2.837);
assert.equal(juneTx26.spvUndrawnCommitment, null);
assert.equal(marchTx26.spvFundedDebt, 1.26);
assert.equal(usd(juneTx26.spvFundedDebt - marchTx26.spvFundedDebt), 1.577);
assert.equal(engine.computeTransactionEAD(transactions.find(tx => tx.id === "TX26"), "2026Q1").fundedEAD, 1.26);
assert.equal(engine.reconcileParentSpvDebt(entities, transactions, "2025Q4")
  .find(row => row.spvId === "SPV_CRWV8").spvFundedDebt, null);
assert.equal(usd(coreWeaveConsolidation.spvFundedDebt - juneTx26.spvFundedDebt), 1.746);
assert.equal(engine.computeTransactionEAD(transactions.find(tx => tx.id === "TX26"), "2026Q2").fundedEAD, 2.837);

const spvLimitFixture = [{ id: "SPV_TEST", isSPV: true, financials: {} }];
const repaidTermFixture = { id: "TEST_TERM", receiver: "SPV_TEST", type: "Direct Loan",
  totalCommitment: 10, amountDrawn: 8, amountRepaid: 3 };
const termReconciliation = engine.reconcileParentSpvDebt(spvLimitFixture, [repaidTermFixture])[0];
assert.equal(termReconciliation.spvFundedDebt, 5);
assert.equal(termReconciliation.spvUndrawnCommitment, 2);

assert.equal(engine.reconcileParentSpvDebt(spvLimitFixture, [{
  ...repaidTermFixture, amountDrawn: null, principalOutstanding: 5, principalAsOfQuarter: "2026Q3"
}])[0].spvUndrawnCommitment, null);
assert.equal(engine.reconcileParentSpvDebt(spvLimitFixture, [{
  ...repaidTermFixture, facilityKind: "Revolver", lettersOfCredit: 1
}])[0].spvUndrawnCommitment, 4);

const gpuSaleWithoutAccountingLife = engine.fleetRefresh(
  [{ acquired: "2023Q1", cost: 4 }], "2027Q1",
  { economicLife: 4, replacementRatio: 0.5, residualValue: 0.5 }
);
assert.equal(gpuSaleWithoutAccountingLife.disposalProceeds, 1);
assert.equal(gpuSaleWithoutAccountingLife.netBookValueDisposed, null);
assert.equal(gpuSaleWithoutAccountingLife.disposalGainLoss, null);
const lowTierConfig = { economicLife: 4, physicalLife: 6, accountingLife: 6,
  replacementRatio: 0.5, repurposeShare: 0.5, residualValue: 0.2, physicalResidualValue: 0.1 };
const lowTierRefresh = engine.fleetRefresh([{ acquired: "2023Q1", cost: 8, pledgedTo: "TEST" }], "2027Q1", lowTierConfig);
assert.equal(lowTierRefresh.replacementCapex, 4);
assert.equal(lowTierRefresh.disposalProceeds, 0.4);
const repurposed = lowTierRefresh.cohorts.find(cohort => cohort.lowTier);
assert.deepEqual(repurposed, { acquired: "2023Q1", cost: 2, pledgedTo: "TEST", lowTier: true });
const lowTierContinues = engine.fleetRefresh([repurposed], "2028Q1", lowTierConfig);
assert.deepEqual(lowTierContinues.cohorts, [repurposed]);
assert.equal(lowTierContinues.replacementCapex, 0);
const lowTierRetires = engine.fleetRefresh([repurposed], "2029Q1", lowTierConfig);
assert.deepEqual(lowTierRetires.cohorts, []);
assert.equal(lowTierRetires.replacementCapex, 0);
assert.equal(lowTierRetires.disposalProceeds, 0.2);
const tx26Cutoff = transactions.find(tx => tx.id === "TX26");
assert.equal(engine.computeTransactionEAD(tx26Cutoff, "2027Q2").undrawnCommitment, null);
const expiredTx26 = engine.computeTransactionEAD(tx26Cutoff, "2027Q3");
assert.equal(expiredTx26.undrawnCommitment, 0);
assert.equal(expiredTx26.fundedEAD, 4.583);
assert.equal(expiredTx26.exposureCoverage, "FundedAndUndrawn");
assert.equal(termResult.timeline["2027Q3"].financingLedger.TX26.canDraw, false);
const soldPledge = engine.runSimulation(entities, transactions, {
  audit4Contracts: true, forcedDefaults: ["CRWV"],
  overrides: { CRWV: { gpuRefresh: {
    cohorts: [{ acquired: "2022Q4", cost: 4, pledgedTo: "TX27" }],
    economicLife: 4, replacementRatio: 1, residualValue: 0.2
  } } }
});
const soldPledgeQuarter = soldPledge.timeline["2026Q4"].entities.CRWV;
assert.equal(soldPledgeQuarter.disposalProceeds, 0.8);
assert.equal(soldPledgeQuarter.pledgedGpuValues.TX27, 0);
assert.equal(soldPledge.timeline["2027Q1"].entities.CRWV.pledgedGpuValues.TX27, 0);
const soldPledgeDefault = soldPledge.creditEvents.find(event => event.txId === "TX27");
assert.equal(soldPledgeDefault.collateralRecovery, 0);
assert.equal(soldPledgeDefault.recognizedLoss, 4.5);
assert.equal(pledgedGpu.timeline["2026Q4"].entities.CRWV.gpuMarginCall, 0.48);
const tx27Margin = pledgedGpu.timeline["2026Q4"].entities.CRWV.gpuMarginByFacility.TX27;
assert.deepEqual(tx27Margin, {
  basis: "AttributedPledge", principal: 10, effectiveHaircut: 0.4,
  stressedLtv: 1.0833, marginCall: 0.48, refinancingFactor: 0.52
});
assert.equal(tx26Cutoff.quarterlyPayment, null);
assert.equal(tx26Cutoff.reportedAmortizationTerms.frequency, "Monthly");
assert.equal(tx26Cutoff.reportedAmortizationTerms.paymentScheduleAvailable, false);
assert.equal(tx26Cutoff.reportedAmortizationTerms.undrawnFeeAnnualRate, 0.005);

const tx26Bounds = tx26Cutoff.conditionalReconciliationBounds;
const tx26MinimumAvailability = usd(5.653 - 0.754 - (2.6 - 1.555));
const tx26MaximumDraw = usd(8.5 - tx26MinimumAvailability);
assert.deepEqual(tx26Bounds.undrawnAvailability, [3.854, 3.917]);
assert.deepEqual(tx26Bounds.cumulativeDrawdown, [4.583, tx26MaximumDraw]);
assert.deepEqual(tx26Bounds.cumulativePrincipalRepaid, [0, usd(tx26MaximumDraw - 4.583)]);
assert.equal(tx26Cutoff.amountDrawn, null);
assert.equal(tx26Cutoff.amountRepaid, null);
const cycleHistory = engine.financingForecast({ mode: "curve", curve: "historical", history: {
  2024: { dataType: "Actual", fullYear: true, amounts: { equity: 4 } },
  2025: { dataType: "Actual", fullYear: true, amounts: { equity: 2 } },
  2026: { dataType: "Actual", fullYear: true, amounts: { equity: 4 } }
} }, 2027);
assert.equal(cycleHistory.amounts.equity, 4);
const tx11Delivery = transactions.find(tx => tx.id === "TX11").audit4GuaranteeTerms.disclosedDeliveryOutlook;
assert.equal(tx11Delivery.firstCoveredBuildingNvidiaFiscalYear, 2029);
assert.deepEqual(tx11Delivery.buildingGroups.map(group => [group.capacityMwIt, group.expectedFullOperationYear, group.withinInitialGuarantee]),
  [[4248, 2031, true], [3776, 2032, false]]);
assert.equal(tx11Delivery.siteLevelQuarterDatesAvailable, false);
const nvidiaSources = entities.find(entity => entity.id === "NVDA");
const nvidiaJuly = nvidiaSources.audit4FiscalCashFlow;
const nvidiaOctober = nvidiaSources.audit4LaterFiscalDisclosure;
assert.equal(nvidiaJuly.accountsPayable, 15.059);
assert.equal(usd(nvidiaJuly.currentBorrowings + nvidiaJuly.nonCurrentBorrowings), 33.366);
assert.equal(nvidiaOctober.accountsPayable, 21.074);
assert.equal(nvidiaOctober.currentBorrowings + nvidiaOctober.nonCurrentBorrowings, 32.371);
assert.equal(usd(nvidiaOctober.cashAndEquivalents + nvidiaOctober.marketableDebtSecurities + nvidiaOctober.marketableEquitySecurities), 97.731);
const microsoftSep = entities.find(entity => entity.id === "MSFT").audit4FiscalCashFlow;
assert.equal(usd(microsoftSep.currentBorrowings + microsoftSep.nonCurrentBorrowings), 35.481);
assert.equal(microsoftSep.accountsPayable, 42.625);
assert.equal(microsoftSep.propertyAndEquipmentInAccountsPayable, 26.5);
assert.equal(usd(microsoftSep.ocf - microsoftSep.capex), 18.633);
const issuerBalance = id => entities.find(entity => entity.id === id).audit4BalanceSheetEvidence;
assert.equal(issuerBalance("GOOGL").accountsPayable, 21.975);
assert.equal(usd(issuerBalance("GOOGL").currentPortionOfLongTermDebt + issuerBalance("GOOGL").nonCurrentBorrowings), 126.118);
assert.equal(issuerBalance("AMZN").accountsPayable, 158.715);
assert.equal(usd(issuerBalance("AMZN").currentPortionOfLongTermDebt + issuerBalance("AMZN").nonCurrentBorrowings), 179.952);
assert.equal(issuerBalance("META").accountsPayable, 19.097);
assert.equal(usd(issuerBalance("META").currentOperatingLeaseLiability + issuerBalance("META").nonCurrentOperatingLeaseLiability), 31.173);
const metaScope = engine.runSimulation(entities, transactions, { audit4Contracts: true })
  .timeline["2026Q4"].entities.META;
assert.equal(usd(metaScope.debt + metaScope.principalRepay + metaScope.nonCashDebtConversion - metaScope.newDebt - metaScope.rcfDraw), 84);
const metaEvidence = issuerBalance("META");
assert.equal(usd(metaEvidence.nonCurrentBorrowings + metaEvidence.currentPortionOfLongTermDebt + metaEvidence.unamortizedDiscountAndIssuanceCosts), 84);
assert.equal(usd(Object.values(metaEvidence.annualNotePrincipalMaturities).reduce((sum, principal) => sum + principal, 0)), 84);
const amd = entities.find(entity => entity.id === "AMD").financials["2026Q3"];
assert.deepEqual([amd.periodEnd, amd.cash, amd.accountsPayable, amd.rpo], ["2026-09-26", 7.404, 7.756, 0.246]);
assert.equal(usd(amd.ocf - amd.capex), amd.fcf);
assert.equal(amd.fcf, 0.554);
assert.equal(usd(amd.shortTermDebt + amd.longTermDebt), amd.debt);
assert.equal(amd.leaseLiab, 2.132);
assert.equal(amd.undrawnCredit, 4.75);
assert.equal(amd.undrawnCreditDataType, "Assumption");
const micron = entities.find(entity => entity.id === "MU").financials["2026Q3"];
assert.deepEqual([micron.cash, micron.accountsPayable, micron.ar, micron.rpo], [38.364, 3.518, 31.793, 134]);
assert.equal(usd(micron.ocf - micron.capex), 32.863);
assert.equal(micron.fcf, 32.863);
assert.equal(usd(micron.fcf + 0.009 + 0.327), 33.199);
assert.equal(usd(micron.shortTermDebt + micron.longTermDebt), micron.debt);
assert.equal(micron.debt, 5.179);
const supermicro = entities.find(entity => entity.id === "SMCI").financials["2026Q3"];
assert.deepEqual([supermicro.revenue, supermicro.accountsPayable, supermicro.rpo], [19.945832, 2.727379, 5.6657]);
assert.equal(Number((supermicro.cash + supermicro.restrictedCash).toFixed(6)), 7.01562);
assert.equal(Number((supermicro.ocf - supermicro.capex).toFixed(6)), -0.475609);
assert.equal(supermicro.fcf, -0.475609);
assert.equal(Number((supermicro.shortTermDebt + supermicro.longTermDebt).toFixed(6)), 8.646017);
assert.equal(supermicro.debt, 8.646017);
const hpe = entities.find(entity => entity.id === "HPE").financials["2026Q3"];
assert.equal(hpe.periodEnd, "2026-07-31");
assert.equal(usd(hpe.cash + hpe.restrictedCash), 6.278);
assert.equal(usd(hpe.ocf - hpe.capex), hpe.fcf);
assert.equal(usd(hpe.fcf + 0.092 - 0.03), 0.958);
assert.equal(usd(hpe.shortTermDebt + hpe.longTermDebt), hpe.debt);
assert.deepEqual([hpe.debt, hpe.accountsPayable, hpe.rpo], [20.244, 13.734, null]);
const broadcom = entities.find(entity => entity.id === "AVGO").financials["2026Q3"];
assert.equal(broadcom.periodEnd, "2026-08-02");
assert.deepEqual([broadcom.revenue, broadcom.cash, broadcom.accountsPayable, broadcom.rpo], [29.591, 23.975, 4, 179.2]);
assert.equal(usd(broadcom.ocf - broadcom.capex), 13.665);
assert.equal(broadcom.fcf, 13.665);
assert.equal(usd(broadcom.shortTermDebt + broadcom.longTermDebt), broadcom.debt);
assert.equal(broadcom.debt, 59.419);
for (const [borrowerId, facilityId, available, lastOpenQuarter, maturityQuarter] of [
  ["AMD", "AMD_RCF_2026", 4.75, "2031Q1", "2031Q2"],
  ["AVGO", "AVGO_RCF_2025", 7, "2029Q4", "2030Q1"]
]) {
  const borrower = entities.find(entity => entity.id === borrowerId);
  const facility = borrower.audit4Facilities?.find(row => row.id === facilityId);
  assert.ok(facility, facilityId);
  const credit = engine.runSimulation([borrower], [], { audit4Contracts: true, forecastThrough: 2032,
    overrides: { [borrowerId]: { ocfMarginBeforeFinancing: 0.9, capex: 0 } } }).timeline;
  const opening = credit["2026Q4"].financingLedger[facilityId];
  assert.equal(opening.undrawnCommitment, available);
  assert.equal(opening.lettersOfCreditDataType, "Assumption");
  assert.equal(opening.endingOutstanding, 0);
  assert.equal(opening.lender, null);
  assert.equal(credit[lastOpenQuarter].financingLedger[facilityId].undrawnCommitment, available);
  assert.equal(credit[maturityQuarter].financingLedger[facilityId].undrawnCommitment, 0);
  assert.equal(credit["2032Q1"].financingLedger[facilityId].undrawnCommitment, 0);
}
const micronIssuer = entities.find(entity => entity.id === "MU");
const micronCredit = engine.runSimulation([micronIssuer], [], { audit4Contracts: true, forecastThrough: 2031,
  overrides: { MU: { ocfMarginBeforeFinancing: 0.9, capex: 0 } } }).timeline;
assert.equal(micronCredit["2026Q4"].financingLedger.MU_RCF_DISCLOSED?.undrawnCommitment, 2);
assert.equal(micronCredit["2026Q4"].financingLedger.MU_RCF_DISCLOSED.endingOutstanding, 0);
assert.equal(micronCredit["2026Q4"].financingLedger.MU_RCF_DISCLOSED.lender, null);
assert.equal(micronCredit["2029Q4"].financingLedger.MU_RCF_DISCLOSED.undrawnCommitment, 2);
assert.equal(micronCredit["2030Q1"].financingLedger.MU_RCF_DISCLOSED.undrawnCommitment, 0);
assert.equal(micronCredit["2030Q2"].financingLedger.MU_RCF_DISCLOSED.undrawnCommitment, 0);
assert.equal(micronCredit["2030Q2"].entities.MU.undrawnCredit, 0);
const hpeIssuer = entities.find(entity => entity.id === "HPE");
const hpeCredit = engine.runSimulation([hpeIssuer], [], { audit4Contracts: true, forecastThrough: 2030,
  overrides: { HPE: { ocfMarginBeforeFinancing: 0.9, capex: 0 } } }).timeline;
const hpeFacility = q => hpeCredit[q].financingLedger.HPE_RCF_DISCLOSED;
assert.equal(hpeFacility("2026Q4")?.undrawnCommitment, 5.25);
assert.equal(hpeFacility("2026Q4").endingOutstanding, 0);
assert.equal(hpeFacility("2026Q4").lender, null);
assert.equal(hpeFacility("2029Q2").undrawnCommitment, 5.25);
assert.equal(hpeFacility("2029Q3").undrawnCommitment, 0);
assert.equal(hpeFacility("2029Q4").undrawnCommitment, 0);
assert.equal(hpeCredit["2029Q4"].entities.HPE.undrawnCredit, 0);
const smciBorrower = entities.find(entity => entity.id === "SMCI");
const smciCredit = engine.runSimulation([smciBorrower], [], { audit4Contracts: true, forecastThrough: 2031,
  overrides: { SMCI: { ocfMarginBeforeFinancing: 0.9, capex: 0 } } }).timeline;
const smciRevolver = q => smciCredit[q].financingLedger.SMCI_JPM_RCF;
assert.equal(smciRevolver("2026Q4")?.undrawnCommitment, 1.8);
assert.equal(smciRevolver("2026Q4").lettersOfCreditDataType, "Assumption");
assert.equal(smciRevolver("2026Q4").endingOutstanding, 0);
assert.equal(smciRevolver("2026Q4").lender, null);
assert.equal(smciRevolver("2030Q3").undrawnCommitment, 1.8);
assert.equal(smciRevolver("2030Q4").undrawnCommitment, 0);
assert.equal(smciCredit["2031Q1"].entities.SMCI.undrawnCredit, 0);
const dellIssuer = entities.find(entity => entity.id === "DELL");
const dellCredit = engine.runSimulation([dellIssuer], [], { audit4Contracts: true, forecastThrough: 2032,
  overrides: { DELL: { ocfMarginBeforeFinancing: 0.9, capex: 0 } } }).timeline;
const dellRcf = q => dellCredit[q].financingLedger.DELL_RCF_2026;
assert.equal(dellRcf("2026Q4")?.undrawnCommitment, 5.884);
assert.equal(dellRcf("2026Q4").lettersOfCredit, 0.116);
assert.equal(dellRcf("2026Q4").endingOutstanding, 0);
assert.equal(dellRcf("2026Q4").lender, null);
assert.equal(dellRcf("2031Q1").undrawnCommitment, 5.884);
assert.equal(dellRcf("2031Q2").undrawnCommitment, 0);
assert.equal(dellCredit["2031Q3"].entities.DELL.undrawnCredit, 0);
const datacenterCredit = engine.runSimulation(entities, transactions, { audit4Contracts: true }).timeline["2026Q4"];
const dlrRcf = datacenterCredit.financingLedger.DLR_GLOBAL_RCF;
assert.equal(dlrRcf?.beginningOutstanding, 1.65557);
assert.equal(dlrRcf.lender, null);
assert.equal(dlrRcf.lettersOfCredit, 0.1008);
const eqixRcf = datacenterCredit.financingLedger.EQIX_RCF_2026;
assert.equal(eqixRcf?.beginningOutstanding, 0);
assert.equal(eqixRcf.undrawnCommitment, 5.494);
assert.equal(eqixRcf.lender, null);
for (const [id, live, expired, available] of [
  ["DLR", "2028Q4", "2029Q1", 2.7136], ["EQIX", "2031Q2", "2031Q3", 5.494]
]) {
  const [facility] = entities.find(entity => entity.id === id).audit4Facilities;
  assert.equal(engine.computeTransactionEAD(facility, live).undrawnCommitment, available);
  assert.equal(engine.computeTransactionEAD(facility, expired).undrawnCommitment, 0);
}
assert.equal(dlrRcf.newDrawdown, 0);
assert.equal(eqixRcf.newDrawdown, 0);
const alphabetEvidence = issuerBalance("GOOGL");
assert.equal(usd(alphabetEvidence.borrowingsPrincipal - alphabetEvidence.unamortizedDiscountAndIssuanceCosts -
  alphabetEvidence.hedgeFairValueReduction), 126.118);
const amazonEvidence = issuerBalance("AMZN");
assert.equal(usd(amazonEvidence.longTermBorrowingsFaceValue - amazonEvidence.unamortizedDiscountAndIssuanceCosts), 179.952);
assert.equal(usd(amazonEvidence.longTermBorrowingsFaceValue + amazonEvidence.workingCapitalBorrowings), 181.267);
const openingScope = engine.runSimulation(entities, transactions, { audit4Contracts: true }).timeline["2026Q4"].entities;
for (const [id, principal] of [["GOOGL", 127.485], ["AMZN", 181.267]]) {
  const row = openingScope[id];
  assert.equal(usd(row.debt + row.principalRepay + row.nonCashDebtConversion - row.newDebt - row.rcfDraw), principal);
}
assert.equal(openingScope.AMZN.undrawnCredit + openingScope.AMZN.rcfDraw, 20);
const amazonCredit = engine.runSimulation(entities, transactions, { audit4Contracts: true }).timeline;
assert.equal(amazonCredit["2027Q4"].financingLedger.AMZN_RCF_2026.canDraw, false);
assert.equal(amazonCredit["2026Q4"].financingLedger.AMZN_TERM_2026.beginningOutstanding, 17.5);
assert.equal(amazonCredit["2026Q4"].financingLedger.AMZN_TERM_2026.newDrawdown, 0);
assert.equal(amazonCredit["2026Q4"].financingLedger.AMZN_TERM_2026.lender, null);
const alphabetBorrower = entities.find(entity => entity.id === "GOOGL");
const alphabetCredit = engine.runSimulation([alphabetBorrower], [], {
  audit4Contracts: true, forecastThrough: 2030,
  overrides: { GOOGL: { ocfMarginBeforeFinancing: 0.9, capex: 0 } }
}).timeline;
for (const [quarter, shortCapacity, longCapacity] of [
  ["2026Q4", 4, 6], ["2027Q2", 0, 6], ["2030Q1", 0, 6], ["2030Q2", 0, 0]
]) {
  const group = alphabetCredit[quarter].financingLedger;
  assert.equal(group.GOOGL_RCF_2027.undrawnCommitment, shortCapacity);
  assert.equal(group.GOOGL_RCF_2030.undrawnCommitment, longCapacity);
  assert.equal(group.GOOGL_RCF_2027.lender, null);
}
const amazonEquipment = entities.find(entity => entity.id === "AMZN");
const equipmentId = "AMZN_EQUIPMENT_DDTL";
const equipmentBorrower = {
  ...amazonEquipment,
  defaults: { ...amazonEquipment.defaults, mode: "B", capex: 0, debtRepay: 0, newDebt: 0 },
  financials: { "2026Q3": { ...amazonEquipment.financials["2026Q3"], cash: 1000 } }
};
const equipmentOptions = { audit4Contracts: true, forecastThrough: 2034,
  overrides: { AMZN: { ocfMarginBeforeFinancing: 0.5, refiSuccess: 0 } } };
const withoutEquipment = engine.runSimulation([equipmentBorrower], [], equipmentOptions).timeline;
assert.equal(withoutEquipment["2028Q4"].financingLedger.AMZN_RCF_2023.canDraw, true);
assert.equal(withoutEquipment["2031Q3"].financingLedger.AMZN_RCF_2023.canDraw, true);
assert.equal(withoutEquipment["2031Q4"].financingLedger.AMZN_RCF_2023.canDraw, false);
assert.equal(withoutEquipment["2032Q1"].financingLedger.AMZN_RCF_2023.canDraw, false);
assert.equal(withoutEquipment["2032Q1"].financingLedger.AMZN_RCF_2023.undrawnCommitment, 0);
assert.equal(withoutEquipment["2029Q2"].financingLedger.AMZN_TERM_2026.endingOutstanding, 17.5);
assert.equal(withoutEquipment["2029Q3"].financingLedger.AMZN_TERM_2026.principalRepayment, 17.5);
assert.equal(withoutEquipment["2029Q3"].financingLedger.AMZN_TERM_2026.endingOutstanding, 0);
const expiringTerm = { ...instrument, receiver: "AMZN" };
const termExpiry = engine.runSimulation([equipmentBorrower], [expiringTerm], {
  ...equipmentOptions, facilityDrawdowns: { [expiringTerm.id]: { "2027Q2": 3, "2027Q4": 2 } }
}).timeline;
assert.equal(termExpiry["2027Q2"].financingLedger[expiringTerm.id].newDrawdown, 3);
assert.equal(termExpiry["2027Q3"].financingLedger[expiringTerm.id].principalRepayment, 3);
const termAfterExpiry = termExpiry["2027Q4"].financingLedger[expiringTerm.id];
assert.equal(termAfterExpiry.defaulted, false);
assert.equal(termAfterExpiry.remainingCommitment, 2);
assert.equal(termAfterExpiry.canDraw, false);
assert.equal(termAfterExpiry.newDrawdown, 0);
assert.equal(termAfterExpiry.endingOutstanding, 0);
assert.equal(termExpiry["2027Q4"].entities.AMZN.contractualTermDraw, 0);
const withEquipment = engine.runSimulation([equipmentBorrower], [], { ...equipmentOptions,
  overrides: { AMZN: { ...equipmentOptions.overrides.AMZN,
    facilityDrawdowns: { [equipmentId]: { "2026Q4": 10, "2027Q1": 20, "2028Q3": 70, "2028Q4": 10 } }
  } }
}).timeline;
assert.equal(withEquipment["2026Q4"].entities.AMZN.contractualTermDraw, 0);
for (const [quarter, draw, total, undrawn] of [["2027Q1", 20, 20, 60], ["2028Q3", 60, 80, 0], ["2028Q4", 0, 80, 0]]) {
  const facility = withEquipment[quarter].financingLedger[equipmentId];
  assert.deepEqual([facility.newDrawdown, facility.endingOutstanding, facility.undrawnCommitment], [draw, total, undrawn]);
}
assert.equal(usd(withEquipment["2027Q1"].entities.AMZN.cash - withoutEquipment["2027Q1"].entities.AMZN.cash), 20);
assert.equal(usd(withEquipment["2027Q1"].entities.AMZN.debt - withoutEquipment["2027Q1"].entities.AMZN.debt), 20);
assert.equal(withEquipment["2032Q1"].financingLedger[equipmentId].principalRepayment, 20);
assert.equal(withEquipment["2032Q1"].financingLedger[equipmentId].endingOutstanding, 60);
assert.equal(withEquipment["2033Q3"].financingLedger[equipmentId].principalRepayment, 60);
assert.equal(withEquipment["2033Q3"].financingLedger[equipmentId].endingOutstanding, 0);
const equipmentTerms = amazonEquipment.audit4Facilities.find(tx => tx.id === equipmentId);
const equipmentEad = engine.computeTransactionEAD({ ...equipmentTerms, principalOutstanding: 20,
  principalAsOfQuarter: "2027Q1", remainingCommitment: 60 }, "2027Q1");
assert.deepEqual([equipmentEad.fundedEAD, equipmentEad.undrawnCommitment, equipmentEad.totalEAD, equipmentEad.exposureCoverage],
  [20, null, 20, "FundedOnly"]);
const expiredEquipmentEad = engine.computeTransactionEAD(equipmentTerms, "2028Q4");
assert.equal(expiredEquipmentEad.undrawnCommitment, 0);
const defaultBeforeEquipmentDraw = engine.runSimulation([equipmentBorrower], [], {
  ...equipmentOptions, forcedDefaults: ["AMZN"],
  facilityDrawdowns: { [equipmentId]: { "2027Q1": 20 } }
});
assert.equal(defaultBeforeEquipmentDraw.scenarioSummary.AMZN.defaultQuarter, "2026Q4");
assert.equal(defaultBeforeEquipmentDraw.timeline["2027Q1"].financingLedger[equipmentId].newDrawdown, 0);
assert.equal(defaultBeforeEquipmentDraw.timeline["2027Q1"].financingLedger[equipmentId].borrowerDefaultBlocksDraw, true);
assert.equal(defaultBeforeEquipmentDraw.timeline["2027Q1"].entities.AMZN.contractualTermDraw, 0);
const irenEquipmentRows = engine.runSimulation(entities, transactions, { audit4Contracts: true }).timeline;
const irenGpu2 = irenEquipmentRows["2026Q4"].financingLedger.IREN_GPU2;
const irenGpu3 = irenEquipmentRows["2026Q4"].financingLedger.IREN_GPU3;
assert.deepEqual([irenGpu2.beginningOutstanding, irenGpu2.cumulativeDrawdown, irenGpu2.undrawnCommitment], [0.947, 0.947, 1.5]);
assert.equal(irenEquipmentRows["2027Q1"].financingLedger.IREN_GPU2.undrawnCommitment, 0);
assert.deepEqual([irenGpu3.beginningOutstanding, irenGpu3.cumulativeDrawdown, irenGpu3.undrawnCommitment], [0.355, 0.363, 0]);
assert.equal(irenGpu2.accruedInterest, usd(0.947 * 0.09 / 4));
assert.equal(irenGpu3.accruedInterest, 0.0082);
const irenWithGenericRates = entities.map(entity => entity.id === "IREN" ? {
  ...entity, audit4Facilities: entity.audit4Facilities.map(facility => ({ ...facility, reportedCashCoupon: undefined }))
} : entity);
const irenGenericInterest = engine.runSimulation(irenWithGenericRates, transactions, { audit4Contracts: true })
  .timeline["2026Q4"].entities.IREN.interestExp;
const irenDisclosedInterest = irenEquipmentRows["2026Q4"].entities.IREN.interestExp;
assert.equal(usd(irenDisclosedInterest - irenGenericInterest),
  usd(0.947 * (0.09 - 0.085) / 4 + 0.00822937497845 - 0.355 * 0.085 / 4));
assert.equal(irenEquipmentRows["2026Q4"].entities.IREN.operatingCashBridge.interestPaid, irenDisclosedInterest);
assert.equal(irenGpu3.principalRepayment, 0.0267);
assert.equal(irenGpu3.endingOutstanding, 0.3283);
const irenAmortizationFixture = entities.find(entity => entity.id === "IREN");
const irenSolvent = engine.runSimulation([{
  ...irenAmortizationFixture, audit4Liquidity: { asOf: "2026-09-30", cashAndEquivalents: 1000 },
  defaults: { ...irenAmortizationFixture.defaults, debtRepay: 0, capex: 0, refiSuccess: 0 }
}], [], { audit4Contracts: true, forecastThrough: 2029, overrides: { IREN: { ocfMarginBeforeFinancing: 0.5 } } }).timeline;
const irenFinal = irenSolvent["2029Q3"].financingLedger.IREN_GPU3;
assert.equal(irenFinal.amortization.openingRemainingMonths, 2);
assert.equal(irenFinal.principalRepayment, irenFinal.beginningOutstanding);
assert.equal(irenFinal.endingOutstanding, 0);
const irenFleetEvidence = irenAmortizationFixture.audit4HardwareDisclosure.fleetDisclosures;
assert.equal(irenFleetEvidence.installedOrOrderedUnits, 150000);
assert.equal(irenFleetEvidence.installedOnlyUnits, null);
assert.equal(irenFleetEvidence.unitsByModel, null);
const coreWeaveFleetEvidence = entities.find(entity => entity.id === "CRWV").audit4HardwareDisclosure.fleetDisclosures;
assert.equal(coreWeaveFleetEvidence.deployedUnitsLowerBoundExclusive, 250000);
assert.equal(coreWeaveFleetEvidence.asOf, "2024-12-31");
assert.equal(coreWeaveFleetEvidence.majorityGeneration, "NVIDIA Hopper");
assert.equal(coreWeaveFleetEvidence.unitsByModel, null);
const countedGpuRefresh = engine.fleetRefresh([
  { acquired: "2023Q1", quantity: 10000, unitCostUsd: 40000, generation: "Hopper" }
], "2027Q1", { economicLife: 4, replacementRatio: 0.5, repurposeShare: 0.2, residualValue: 0.25,
  replacementUnitCostUsd: 50000, replacementGeneration: "Blackwell" });
assert.equal(countedGpuRefresh.replacementCapex, 0.25);
assert.equal(countedGpuRefresh.disposalProceeds, 0.04);
assert.deepEqual(countedGpuRefresh.cohorts.map(c => [c.quantity, c.cost, c.generation, c.lowTier === true]),
  [[5000, 0.2, "Hopper", false], [1000, 0.04, "Hopper", true], [5000, 0.25, "Blackwell", false]]);
const quantityForecast = engine.runSimulation([refreshFixture], [], { audit4Contracts: true,
  overrides: { [refreshFixture.id]: { gpuRefresh: {
    cohorts: [{ acquired: "2022Q4", quantity: 10000, unitCostUsd: 40000, generation: "Hopper" }],
    economicLife: 4, replacementRatio: 0.5, repurposeShare: 0.2, residualValue: 0.25,
    replacementUnitCostUsd: 50000, replacementGeneration: "Blackwell"
  } } }
}).timeline["2026Q4"].entities[refreshFixture.id];
const quantityReference = engine.runSimulation([refreshFixture], [], { audit4Contracts: true })
  .timeline["2026Q4"].entities[refreshFixture.id];
assert.equal(usd(quantityReference.fcf - quantityForecast.fcf), 0.25);
assert.equal(usd(quantityReference.cash - quantityForecast.cash), 0.21);
const quantityAcquisition = engine.runSimulation([refreshFixture], [], { audit4Contracts: true,
  overrides: { [refreshFixture.id]: { capex: 0.3, gpuRefresh: { gpuPurchasesByQuarter: {
    "2026Q4": { quantity: 10000, unitCostUsd: 40000, generation: "Hopper" }
  } } } }
}).timeline["2026Q4"].entities[refreshFixture.id];
assert.equal(quantityAcquisition.gpuPurchases, 0.3);
assert.deepEqual(quantityAcquisition.gpuClosingCohorts, [
  { acquired: "2026Q4", cost: 0.3, quantity: 7500, unitCostUsd: 40000, generation: "Hopper" }
]);
const fasterGpu = engine.fleetRefresh([
  { acquired: "2023Q1", quantity: 10000, unitCostUsd: 40000, generation: "Hopper" }
], "2027Q1", { economicLife: 4, replacementRatio: 0.5, residualValue: 0.25,
  replacementUnitCostUsd: 50000, replacementGeneration: "Blackwell", replacementPerformanceRatio: 2 });
assert.equal(fasterGpu.replacementCapex, 0.125);
assert.equal(fasterGpu.disposalProceeds, 0.05);
assert.equal(fasterGpu.cohorts.at(-1).quantity, 2500);
const sameGen = engine.fleetRefresh([
  { acquired: "2023Q1", quantity: 10000, unitCostUsd: 40000, generation: "Hopper" }
], "2027Q1", { economicLife: 4, replacementRatio: 0.5, replacementGeneration: "Hopper", replacementPerformanceRatio: 2 });
assert.equal(sameGen.cohorts.at(-1).quantity, 5000);
assert.equal(fasterGpu.cohorts.at(-1).performanceUnitsPerGpu, 2);
assert.equal(fasterGpu.cohorts.reduce((sum, cohort) => sum + cohort.quantity * (cohort.performanceUnitsPerGpu ?? 1), 0), 10000);
const laterSameGeneration = engine.fleetRefresh([fasterGpu.cohorts.at(-1)], "2031Q1", {
  economicLife: 4, replacementRatio: 1, replacementPerformanceRatio: 2, replacementGeneration: "Blackwell"
});
assert.equal(laterSameGeneration.cohorts[0].quantity, 2500);
assert.equal(laterSameGeneration.cohorts[0].performanceUnitsPerGpu, 2);
assert.deepEqual(replaced.gpuBookValueBridge, {
  opening: 1.0833, additions: 1, depreciation: 0.0833, disposedNetBookValue: 0.5, closing: 1.5
});
const upgradeCash = engine.runSimulation([refreshFixture], [], { audit4Contracts: true,
  overrides: { [refreshFixture.id]: { gpuRefresh: { quarterlyMaintenanceCapex: 0.2 } } }
}).timeline["2026Q4"].entities[refreshFixture.id];
assert.equal(upgradeCash.gpuMaintenanceCapex, 0.2);
assert.equal(upgradeCash.ocf, quantityReference.ocf);
assert.equal(usd(quantityReference.fcf - upgradeCash.fcf), 0.2);
assert.equal(usd(quantityReference.cash - upgradeCash.cash), 0.2);
assert.deepEqual(upgradeCash.gpuClosingCohorts, []);
const sharedGuaranteeCap = engine.phasedGuarantee([
  { readyQuarter: "2027Q1", leaseStartQuarter: "2027Q1", termQuarters: 8, cap: 8 },
  { readyQuarter: "2028Q1", leaseStartQuarter: "2028Q1", termQuarters: 8, cap: 4 },
  { readyQuarter: "2028Q2", leaseStartQuarter: "2028Q2", termQuarters: 8, cap: 4 }
], "2027Q1", 10);
assert.equal(sharedGuaranteeCap.contingentExposure, 2);
assert.deepEqual(sharedGuaranteeCap.projects.map(project => project.contingentExposure), [0, 1, 1]);
assert.equal(delayedCallFirst.guaranteeLedger.TX11.cashSettlementPending, 3);
assert.equal(delayedCall.timeline["2028Q3"].guaranteeLedger.TX11.cashSettlementPending, 0);
assert.equal(delayedCall.timeline["2028Q3"].guaranteeLedger.TX11.cashSettledCumulative, 3);
assert.equal(cappedProjectQ2.remainingGuaranteeLiability, 0);
assert.equal(cappedProjectQ2.projects[1].remainingGuaranteeLiability, 0);
const oracleCommenced = engine.runSimulation(entities, transactions, { audit4Contracts: true,
  overrides: { ORCL: { includeOracleCommencedFinanceLease: true } } }).timeline["2026Q4"].entities.ORCL;
assert.deepEqual([oracleCommenced.recognizedFinanceLease?.opening, oracleCommenced.recognizedFinanceLease?.payment,
  oracleCommenced.recognizedFinanceLease?.interest, oracleCommenced.leasePrincipal,
  oracleCommenced.recognizedFinanceLease?.ending], [9.1586, 0.2067, 0.1269, 0.0798, 9.0788]);
assert.equal(oracleCommenced.leaseSchedule.uncommencedCommitment, 288);
const oracleLeaseBaseline = engine.runSimulation(entities, transactions, { audit4Contracts: true }).timeline["2026Q4"].entities.ORCL;
assert.equal(oracleCommenced.ocf, oracleLeaseBaseline.ocf);
assert.equal(oracleCommenced.fcf, oracleLeaseBaseline.fcf);
assert.equal(usd(oracleLeaseBaseline.cash - oracleCommenced.cash), 0.0798);
const cloudLeaseStress = engine.runSimulation(entities, transactions, { audit4Contracts: true,
  overrides: Object.fromEntries(["MSFT", "GOOGL", "META"].map(id => [id, { disclosedLeaseStressYears: 10 }]))
});
for (const [id, commitment, firstPayment] of [["MSFT", 364.6, 364.6 / 8 / 40],
  ["GOOGL", 130.5, 130.5 / 5 / 40], ["META", 355.73, 355.73 / 10 / 40]]) {
  const before = cloudLeaseStress.timeline["2026Q4"].entities[id];
  const first = cloudLeaseStress.timeline["2027Q1"].entities[id];
  assert.equal(before.leaseSchedule.uncommencedCommitment, commitment);
  assert.equal(before.incrementalLeasePayment, 0);
  assert.equal(first.incrementalLeasePayment, usd(firstPayment));
  assert.equal(first.leaseSchedule.financePrincipal, 0);
}
const mixedCloudStress = engine.runSimulation(entities, transactions, { audit4Contracts: true,
  overrides: { GOOGL: { disclosedLeaseStressYears: 10, disclosedLeaseFinanceShare: 0.5, disclosedLeaseFinanceRate: 0, leaseDelayQuarters: 1 } }
});
const mixedCloudBefore = mixedCloudStress.timeline["2027Q1"].entities.GOOGL.leaseSchedule;
const mixedCloudFirst = mixedCloudStress.timeline["2027Q2"].entities.GOOGL.leaseSchedule;
assert.equal(mixedCloudBefore.uncommencedCommitment, 130.5);
assert.equal(mixedCloudBefore.classifiedFinanceLiability, 0);
assert.deepEqual([mixedCloudFirst.payment, mixedCloudFirst.ocfCashPayment, mixedCloudFirst.financePrincipal,
  mixedCloudFirst.financeInterest, mixedCloudFirst.classifiedFinanceLiability], [0.6525, 0.3262, 0.3263, 0, 12.7238]);
const operatingCloud = engine.runSimulation(entities, transactions, { audit4Contracts: true,
  overrides: { GOOGL: { disclosedLeaseStressYears: 10, leaseDelayQuarters: 1 } }
}).timeline["2027Q2"].entities.GOOGL;
const mixedCloud = mixedCloudStress.timeline["2027Q2"].entities.GOOGL;
assert.equal(usd(mixedCloud.ocf - operatingCloud.ocf), 0.3263);
assert.equal(mixedCloud.cash, operatingCloud.cash);
assert.deepEqual(mixedCloudFirst.financeLiabilityBridge, {
  opening: 0, newlyRecognized: 13.05, principalPaid: 0.3263, rounding: 0.0001, closing: 12.7238
});
const finalLeaseLiability = engine.incrementalLeaseSchedule(mixedLeases, "2027Q4").financeLiabilityBridge;
assert.deepEqual(finalLeaseLiability, {
  opening: 0.9091, newlyRecognized: 0, principalPaid: 0.9091, rounding: 0, closing: 0
});
const deferredBeyondHorizon = withOperationalScenario({ operationalRecoveryRate: 0.5, operationalRecoveryDelayQuarters: 12 });
const closingDeferral = deferredBeyondHorizon["2028Q4"].operationalRecoverySchedule.CRWV["2030Q2"];
assert.deepEqual(closingDeferral, { revenue: 0.0558, cash: 0.0275 });
const phasedRecovery = withOperationalScenario({ operationalRecoveryRate: 0.5, operationalRecoveryDelayQuarters: 1,
  operationalRecoveryInstallments: 2 });
const phaseThree = phasedRecovery["2027Q3"].entities.CRWV;
const phaseFour = phasedRecovery["2027Q4"].entities.CRWV;
assert.deepEqual([phaseThree.operationalRecoveryRevenue, phaseThree.operationalRecoveryCash], [0.0279, 0.0138]);
assert.deepEqual([phaseFour.operationalRecoveryRevenue, phaseFour.operationalRecoveryCash], [0.0279, 0.0137]);
assert.deepEqual(phasedRecovery["2027Q3"].operationalRecoverySchedule.CRWV["2027Q4"], { revenue: 0.0279, cash: 0.0137 });
const fixedPeer = engine.runSimulation(entities, [...transactions, {
  ...instrument, id: "ORCL-fixed-scenario", receiver: "ORCL", amountDrawn: 5, remainingCommitment: 0, isFloatingRate: false
}], { audit4Contracts: true, forcedDefaults: ["CRWV"] }).timeline;
const fixedSpreadEvent = fixedPeer["2026Q4"].contagionLog.find(row => row.layer === "L4_SECONDARY" && row.to === "ORCL");
assert.equal(fixedSpreadEvent?.impactB, 0);
assert.equal(fixedSpreadEvent.spreadWideningBps, 100);
assert.equal(fixedSpreadEvent.floatingPrincipal, 0);
assert.equal(fixedPeer["2027Q1"].entities.ORCL.secondaryRefinancingMultiplier, 0.95);
