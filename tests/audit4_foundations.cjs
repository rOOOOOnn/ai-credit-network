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
    cohorts: [{ acquired: "2024Q4", cost: 4, pledgedTo: "TX27" }, { acquired: "2024Q4", cost: 50 }],
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
assert.deepEqual(crwvHistorical.historyBySource.debt, { years: ["2024", "2025"], amounts: [7.018, 11.829] });
assert.deepEqual(crwvHistorical.historyBySource.equity, { years: ["2024", "2025"], amounts: [1.172, 1.491] });
assert.equal(usd(crwvHistorical.amounts.equity), usd(1.491 * (1.491 / 1.172) ** 2 / 4));
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
assert.deepEqual(anthropic2027.historyBySource.equity, { years: ["2024", "2025"], amounts: [1.198, 16.659] });
assert.deepEqual(anthropic2027.historyBySource.debt, { years: ["2024", "2025"], amounts: [6.05, 3.45] });
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
const tx26Credit = tx26Stress.creditEvents.find(event => event.txId === "TX26");
assert.equal(tx26Credit.fundedEAD, 4.583);
assert.equal(tx26Credit.lender, null);
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
      const cash = state.begCash + state.fcf + state.newDebt + state.equityInflow + state.rcfDraw -
        state.principalRepay - state.leasePrincipal - state.gpuMarginCall + state.disposalProceeds +
        state.openingInvestmentSale - (state.unallocatedGuaranteeCashPaid ?? 0);
      assert.ok(Math.abs(state.cash - cash) <= 0.002, `${label} cash: ${state.cash} vs ${cash}`);
      const minimum = overrides[id]?.minCash ?? entities.find(row => row.id === id).defaults?.minCash ?? 1;
      assert.equal(state.fundingGap, usd(Math.max(0, minimum - state.cash)), label);
    }
  }
  const end = result.timeline["2028Q4"].entities[entity];
  auditedStressResults.push([name, entity, end.cash, end.fcf, end.fundingGap, result.scenarioSummary[entity].defaultQuarter]);
}
console.table(auditedStressResults);
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
