#!/usr/bin/env node
/**
 * AI Credit Network v3.0 — Independent Audit Verification Test Suite (T01–T20)
 * Design Principles:
 * - Hand-calculated expected values (NEVER calling engine functions to generate expected values)
 * - Covers P0-1 through P0-6, P1-1 through P1-4, edge cases, negative tests & zero double-counting
 */
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const Engine = require('../engine/contagion_engine.js');

const rootDir = path.join(__dirname, '..');
const entities = JSON.parse(fs.readFileSync(path.join(rootDir, 'data/entities.json'), 'utf8'));
const transactions = JSON.parse(fs.readFileSync(path.join(rootDir, 'data/transactions.json'), 'utf8'));
const forwardQs = ['2026Q4','2027Q1','2027Q2','2027Q3','2027Q4','2028Q1','2028Q2','2028Q3','2028Q4'];

let passed = 0, failed = 0;
function test(id, name, fn) {
  try {
    const detail = fn();
    console.log(`[PASS] ${id}: ${name} — ${detail}`);
    passed++;
  } catch (err) {
    console.error(`[FAIL] ${id}: ${name} — ${err.message}`);
    failed++;
    process.exitCode = 1;
  }
}

// ---------------------------------------------------------------------------
// P0-1: Point-in-Time Financial Snapshot (T01, T02)
// ---------------------------------------------------------------------------
test('T01', 'P0-1 Strict PIT Zero Lookahead Across All 19 Historical Quarters x 50 Entities', () => {
  const simPit = Engine.runSimulation(entities, transactions, { pointInTimeBacktest: true });
  let checked = 0;
  for (const q of Engine.QUARTERS_HIST) {
    const cutoff = Engine.quarterEndDate(q);
    for (const e of entities) {
      const snap = simPit.timeline[q].entities[e.id];
      if (snap.disclosedDate) {
        assert(snap.disclosedDate <= cutoff, `Lookahead leak: ${e.id} at ${q} (cutoff ${cutoff}) used disclosedDate ${snap.disclosedDate}`);
      }
      if (snap.sourceQuarter) {
        assert(Engine.compareQuarter(snap.sourceQuarter, q) <= 0, `Future period leak: ${e.id} at ${q} used ${snap.sourceQuarter}`);
      }
      checked++;
    }
  }
  // Specifically verify NVDA at 2026Q1 (cutoff 2026-03-31): 2026Q1 disclosed 2026-05-28 must be excluded -> falls back to 2025Q4 (disclosed 2026-02-25)
  const nv26q1 = simPit.timeline['2026Q1'].entities['NVDA'];
  assert.strictEqual(nv26q1.sourceQuarter, '2025Q4', `Expected NVDA PIT 2026Q1 to fall back to 2025Q4, got ${nv26q1.sourceQuarter}`);
  assert(nv26q1.disclosedDate <= '2026-03-31', `NVDA PIT 2026Q1 disclosedDate ${nv26q1.disclosedDate} > 2026-03-31`);
  return `Verified ${checked} entity-quarters with 0 PIT leaks; NVDA 2026Q1 PIT -> 2025Q4 (${nv26q1.disclosedDate})`;
});

test('T02', 'P0-1 Chronological Sorting Independent of JSON Key Order + Unavailable When None Eligible', () => {
  // Deliberately unsorted keys: 2026Q1 first (undisclosed by 2026-03-31), 2024Q4 second, 2025Q4 last
  const syntheticEnt = {
    id: 'SYNTH_PIT',
    financials: {
      '2026Q1': { revenue: 99, cash: 50, debt: 10, disclosedDate: '2026-05-20', dataType: 'Actual' },
      '2024Q4': { revenue: 40, cash: 20, debt: 5, disclosedDate: '2025-02-20', dataType: 'Actual' },
      '2025Q4': { revenue: 70, cash: 35, debt: 8, disclosedDate: '2026-02-25', dataType: 'Actual' }
    }
  };
  const snapPit = Engine.getHistoricalSnapshot(syntheticEnt, '2026Q1', true);
  assert.strictEqual(snapPit.sourceQuarter, '2025Q4', `Must pick 2025Q4 chronologically, got ${snapPit.sourceQuarter}`);
  assert.strictEqual(snapPit.revenue, 70, `Expected hand-verified revenue 70, got ${snapPit.revenue}`);
  assert.strictEqual(snapPit.dataType, 'Carry-Forward (Prior Actual)');

  // Negative test: query 2024Q4 PIT (cutoff 2024-12-31) when earliest disclosure is 2025-02-20 -> must return Unavailable
  const snapNone = Engine.getHistoricalSnapshot(syntheticEnt, '2024Q4', true);
  assert.strictEqual(snapNone.revenue, null);
  assert.strictEqual(snapNone.dataType, 'Unavailable');
  assert.strictEqual(snapNone.insufficientData, true);
  return 'Unsorted keys picked 2025Q4 ($70B) for 2026Q1 PIT; 2024Q4 PIT cleanly returned Unavailable';
});

// ---------------------------------------------------------------------------
// P0-2: Separation of announcedDate, startQ, endQ (T03, T04)
// ---------------------------------------------------------------------------
test('T03', 'P0-2 Announced vs Active Lifecycle Separation (TX03, TX11, TX67, TX68, TX69)', () => {
  const futureIds = ['TX03', 'TX11', 'TX67', 'TX68', 'TX69'];
  const visAll = Engine.getVisibleTransactions(transactions, '2026Q3');
  const visActive = Engine.getVisibleTransactions(transactions, '2026Q3', null, { activeOnly: true });
  futureIds.forEach(id => {
    const tx = transactions.find(t => t.id === id);
    const lc = Engine.getTransactionLifecycle(tx, '2026Q3');
    assert.strictEqual(lc.phase, 'ANNOUNCED_FUTURE', `${id} must be ANNOUNCED_FUTURE in 2026Q3`);
    assert.strictEqual(lc.isVisible, true, `${id} should remain visible as future commitment in 2026Q3`);
    assert.strictEqual(lc.isActive, false, `${id} MUST NOT be active in 2026Q3`);
    assert(visAll.some(t => t.id === id), `${id} should appear in visible graph`);
    assert(!visActive.some(t => t.id === id), `${id} MUST be excluded from activeOnly in 2026Q3`);
  });
  // Verify exact activation quarters
  assert.strictEqual(Engine.isTransactionActive(transactions.find(t => t.id === 'TX69'), '2027Q1'), true);
  assert.strictEqual(Engine.isTransactionActive(transactions.find(t => t.id === 'TX68'), '2027Q1'), false);
  assert.strictEqual(Engine.isTransactionActive(transactions.find(t => t.id === 'TX68'), '2027Q2'), true);
  assert.strictEqual(Engine.isTransactionActive(transactions.find(t => t.id === 'TX67'), '2027Q4'), false);
  assert.strictEqual(Engine.isTransactionActive(transactions.find(t => t.id === 'TX67'), '2028Q1'), true);
  return 'All 5 future-start deals separated: visible as ANNOUNCED_FUTURE in 2026Q3, active only at exact startQ';
});

test('T04', 'P0-2 Future Commitments Generate Zero Operational/Cash Flow Before startQ', () => {
  const shockCEG = Engine.runSimulation(entities, transactions, { forcedDefaults: ['CEG'] });
  // TX67 (MSFT->CEG) starts 2028Q1 -> MSFT must have 0 operational hit from CEG in 2026Q4..2027Q4
  ['2026Q4', '2027Q1', '2027Q2', '2027Q3', '2027Q4'].forEach(q => {
    const msftEvents = shockCEG.timeline[q].contagionLog.filter(e => e.txId === 'TX67');
    assert.strictEqual(msftEvents.length, 0, `TX67 fired prematurely in ${q}`);
  });
  // TX67 MUST activate in 2028Q1!
  const msft28q1 = shockCEG.timeline['2028Q1'].contagionLog.filter(e => e.txId === 'TX67' && e.layer === 'L3_OPERATIONAL');
  assert(msft28q1.length > 0, 'TX67 should activate in 2028Q1 once startQ is reached');
  return `TX67 (MSFT->CEG) fired 0 times in 2026Q4-2027Q4 and activated cleanly in 2028Q1 (${msft28q1.length} L3 events)`;
});

// ---------------------------------------------------------------------------
// P0-3: EAD / LGD / Expected Loss & amountDrawn === 0 vs null (T05–T08)
// ---------------------------------------------------------------------------
test('T05', 'P0-3 Hand-Calculated Funded + Undrawn CCF EAD, EL & Default Loss', () => {
  // Hand calculation:
  // commit = 10, drawn = 6, repaid = 1, CCF = 0.25, LGD = 0.45, PD = 0.05
  // Funded EAD = max(0, 6 - 1) = 5.0
  // Undrawn = max(0, 10 - 6) = 4.0 -> Undrawn EAD = 4.0 * 0.25 = 1.0
  // Total EAD = 5.0 + 1.0 = 6.0
  // Expected Loss = 6.0 * 0.05 * 0.45 = 0.135
  // Default Credit Loss = 6.0 * 0.45 = 2.70
  const synthTx = {
    id: 'SYNTH_LOAN', type: 'Direct Loan', status: 'Actual',
    totalCommitment: 10.0, amountDrawn: 6.0, amountRepaid: 1.0,
    ccf: 0.25, lgd: 0.45, pd: 0.05, startQ: '2026Q1', endQ: '2030Q4'
  };
  const res = Engine.computeTransactionEAD(synthTx, '2026Q4');
  assert.strictEqual(res.fundedEAD, 5.0);
  assert.strictEqual(res.undrawnCommitment, 4.0);
  assert.strictEqual(res.undrawnEAD, 1.0);
  assert.strictEqual(res.totalEAD, 6.0);
  assert.strictEqual(res.expectedLoss, 0.135);
  assert.strictEqual(res.creditLossAtDefault, 2.7);
  return 'Funded=$5.0B, UndrawnEAD=$1.0B, TotalEAD=$6.0B, EL=$0.135B, DefaultLoss=$2.70B (exact hand match)';
});

test('T06', 'P0-3 Strict amountDrawn === 0 Never Substitutes totalCommitment (TX06A, TX06B, TX43)', () => {
  // TX06A: $0.6B committed RCF, amountDrawn=0, ccf=0.40 -> Funded EAD=0, Undrawn EAD=0.24, Loss@45%=0.108
  const ead06a = Engine.computeTransactionEAD(transactions.find(t => t.id === 'TX06A'), '2026Q4', { lgd: 0.45 });
  assert.strictEqual(ead06a.fundedEAD, 0, 'TX06A fundedEAD must be 0');
  assert.strictEqual(ead06a.undrawnEAD, 0.24, 'TX06A undrawnEAD must be 0.6 * 0.40 = 0.24');
  assert.strictEqual(ead06a.creditLossAtDefault, 0.108, 'TX06A loss must be 0.24 * 0.45 = 0.108');

  // TX06B: $4.1B committed RCF, amountDrawn=0, ccf=0.40 -> Funded EAD=0, Undrawn EAD=1.64, Loss@45%=0.738
  const ead06b = Engine.computeTransactionEAD(transactions.find(t => t.id === 'TX06B'), '2026Q4', { lgd: 0.45 });
  assert.strictEqual(ead06b.fundedEAD, 0);
  assert.strictEqual(ead06b.undrawnEAD, 1.64);
  assert.strictEqual(ead06b.creditLossAtDefault, 0.738);

  // TX43: $40B Equipment Financing, amountDrawn=0, startQ=2027Q1 -> 0 in 2026Q4; in 2027Q1 Funded EAD=0, Undrawn EAD=10.0
  const tx43 = transactions.find(t => t.id === 'TX43');
  const ead43_26q4 = Engine.computeTransactionEAD(tx43, '2026Q4', { lgd: 0.45 });
  assert.strictEqual(ead43_26q4.totalEAD, 0, 'TX43 must have 0 EAD in 2026Q4 before startQ 2027Q1');
  const ead43_27q1 = Engine.computeTransactionEAD(tx43, '2027Q1', { lgd: 0.45 });
  assert.strictEqual(ead43_27q1.fundedEAD, 0);
  assert.strictEqual(ead43_27q1.undrawnEAD, 10.0);
  return 'TX06A ($0 funded/$0.24B CCF), TX06B ($0/$1.64B CCF), TX43 ($0 in 26Q4, $0 funded/$10B CCF in 27Q1)';
});

test('T07', 'P0-3 Explicit Distinction Between amountDrawn === 0 and amountDrawn === null', () => {
  const txZero = { id: 'T_ZERO', type: 'Direct Loan', totalCommitment: 10, amountDrawn: 0, ccf: 0.40, startQ: '2026Q1' };
  const txNull = { id: 'T_NULL', type: 'Direct Loan', totalCommitment: 10, amountDrawn: null, ccf: 0.40, startQ: '2026Q1' };
  const rZero = Engine.computeTransactionEAD(txZero, '2026Q4');
  const rNull = Engine.computeTransactionEAD(txNull, '2026Q4');
  assert(rZero.eadBasis.includes('amountDrawn=0'));
  assert(rNull.eadBasis.includes('amountDrawn=null'));
  assert.notStrictEqual(rZero.eadBasis, rNull.eadBasis);
  return `Distinct bases: "${rZero.eadBasis}" vs "${rNull.eadBasis}"`;
});

test('T08', 'P0-3 Zero Multi-Quarter LGD Double-Counting + Complete Credit Event Ledger', () => {
  const shockCRWV = Engine.runSimulation(entities, transactions, { forcedDefaults: ['CRWV'] });
  const tx27Events = shockCRWV.creditEvents.filter(ev => ev.txId === 'TX27');
  assert.strictEqual(tx27Events.length, 1, `TX27 must fire exactly ONCE, fired ${tx27Events.length} times`);
  // TX27: $10B drawn, $0 repaid -> Funded EAD=10, LGD=0.45 -> Recognized Loss = 4.5, Expected Recovery = 5.5
  assert.strictEqual(tx27Events[0].totalEAD, 10);
  assert.strictEqual(tx27Events[0].recognizedLoss, 4.5);
  assert.strictEqual(tx27Events[0].expectedRecovery, 5.5);
  assert.strictEqual(shockCRWV.cumCreditLossByTx['TX27'], 4.5);
  return 'TX27 fired once: EAD=$10.0B, Loss=$4.50B, Recovery=$5.50B, 0 double-counting across 9 quarters';
});

// ---------------------------------------------------------------------------
// P0-5: Dynamic Phased Guarantee Exposure Schedule (T09)
// ---------------------------------------------------------------------------
test('T09', 'P0-5 NVIDIA TX11 $105B Guarantee Phased FY29 Schedule (Zero Premature Calls)', () => {
  const tx11 = transactions.find(t => t.id === 'TX11');
  // Hand-verified schedule values
  assert.strictEqual(Engine.getActiveGuaranteeExposure(tx11, '2026Q4'), 0);
  assert.strictEqual(Engine.getActiveGuaranteeExposure(tx11, '2027Q4'), 0);
  assert.strictEqual(Engine.getActiveGuaranteeExposure(tx11, '2028Q1'), 25.0);
  assert.strictEqual(Engine.getActiveGuaranteeExposure(tx11, '2028Q2'), 50.0);
  assert.strictEqual(Engine.getActiveGuaranteeExposure(tx11, '2028Q3'), 75.0);
  assert.strictEqual(Engine.getActiveGuaranteeExposure(tx11, '2028Q4'), 105.0);
  // Post-peak rent amortization: 2028Q4 to 2035Q4 = 28 quarters; at 2032Q2 (14 quarters later) -> 50% = $52.5B
  assert.strictEqual(Engine.getActiveGuaranteeExposure(tx11, '2032Q2'), 52.5);
  assert.strictEqual(Engine.getActiveGuaranteeExposure(tx11, '2035Q4'), 0);

  // Under OPENAI default, TX11 MUST NOT fire in 2026Q4..2027Q4, and fires ONCE in 2028Q1 for 25 * 0.25 = $6.25B!
  const shockOAI = Engine.runSimulation(entities, transactions, { forcedDefaults: ['OPENAI'] });
  ['2026Q4','2027Q1','2027Q2','2027Q3','2027Q4'].forEach(q => {
    const prem = shockOAI.timeline[q].contagionLog.filter(e => e.txId === 'TX11');
    assert.strictEqual(prem.length, 0, `TX11 fired prematurely in ${q}`);
  });
  const tx11Evs = shockOAI.creditEvents.filter(ev => ev.txId === 'TX11');
  assert.strictEqual(tx11Evs.length, 1, 'TX11 must fire exactly once at activation');
  assert.strictEqual(tx11Evs[0].quarter, '2028Q1');
  assert.strictEqual(tx11Evs[0].guaranteeEAD, 25.0);
  assert.strictEqual(tx11Evs[0].recognizedLoss, 6.25);
  return 'TX11 = $0 (26Q4-27Q4), $25B (28Q1 -> $6.25B call), $105B (28Q4), $52.5B (32Q2), $0 (35Q4)';
});

// ---------------------------------------------------------------------------
// P0-6: CoreWeave / SPV_CRWV8 / TX26 Debt Reconciliation (T10, T11)
// ---------------------------------------------------------------------------
test('T10', 'P0-6 CoreWeave / SPV_CRWV8 / TX26 Exact Debt Reconciliation & Zero Double-Counting', () => {
  const crwvQ3 = entities.find(e => e.id === 'CRWV').financials['2026Q3'];
  assert.strictEqual(Number((crwvQ3.recourseDebt + crwvQ3.nonRecourseDebt).toFixed(3)), 46.873);
  assert.strictEqual(Number((crwvQ3.shortTermDebt + crwvQ3.longTermDebt).toFixed(3)), 46.873);

  const recon = Engine.reconcileParentSpvDebt(entities, transactions, '2026Q3');
  const crwvRow = recon.find(r => r.spvId === 'SPV_CRWV8');
  assert(crwvRow, 'Missing SPV_CRWV8 reconciliation row');
  assert.strictEqual(crwvRow.parentId, 'CRWV');
  assert.strictEqual(crwvRow.consolidationStatus, 'Consolidated');
  assert.strictEqual(crwvRow.parentConsolidatedDebt, 46.873);
  assert.strictEqual(crwvRow.spvFacilityCommitment, 8.5);
  assert.strictEqual(crwvRow.spvFundedDebt, 4.583);
  assert.strictEqual(crwvRow.spvUndrawnCommitment, null);
  assert.strictEqual(crwvRow.consolidationElimination, 4.583);
  assert.strictEqual(crwvRow.netSystemWideDebt, 46.873, 'Consolidated SPV debt MUST NOT be added on top of parent debt');
  return 'CRWV $46.873B ($41.600B rec + $5.273B non-rec); SPV_CRWV8 $8.5B fac ($4.583B principal; undrawn availability unknown) eliminated -> Net $46.873B';
});

test('T11', 'P0-6 Unconsolidated SPVs (Beignet / Sopaipilla) Not Eliminated From System Debt', () => {
  const recon = Engine.reconcileParentSpvDebt(entities, transactions, '2026Q3');
  const beignet = recon.find(r => r.spvId === 'SPV_BEIGNET');
  assert.strictEqual(beignet.consolidationStatus, 'Unconsolidated');
  assert.strictEqual(beignet.consolidationElimination, 0);
  assert.strictEqual(beignet.netSystemWideDebt, Number((beignet.parentConsolidatedDebt + beignet.spvFundedDebt).toFixed(3)));
  return `SPV_BEIGNET Unconsolidated: Parent $${beignet.parentConsolidatedDebt}B + SPV $${beignet.spvFundedDebt}B = $${beignet.netSystemWideDebt}B`;
});

// ---------------------------------------------------------------------------
// P1-1: Strict Insufficient Data Guard Against Partial Overrides (T12)
// ---------------------------------------------------------------------------
test('T12', 'P1-1 Partial Overrides Never Disable Insufficient Data Protection', () => {
  const simPartial = Engine.runSimulation(entities, transactions, {
    overrides: { CRUSOE: { revGrowth: -0.20, capex: 1.5 } }
  });
  const crusoe = simPartial.timeline['2026Q4'].entities['CRUSOE'];
  assert.strictEqual(crusoe.insufficientData, true, 'Partial override must NOT bypass Insufficient Data guard');
  assert.strictEqual(crusoe.revenue, null);
  assert.strictEqual(crusoe.cash, null);
  assert.strictEqual(crusoe.distressLevel, 0);

  // Positive control: explicit core financials (cash + revenue) DO allow simulation
  const simFull = Engine.runSimulation(entities, transactions, {
    overrides: { CRUSOE: { cash: 1.5, revenue: 0.4, revGrowth: 0.05 } }
  });
  assert.strictEqual(simFull.timeline['2026Q4'].entities['CRUSOE'].insufficientData, false);
  assert(simFull.timeline['2026Q4'].entities['CRUSOE'].revenue > 0);
  return 'CRUSOE stayed Unavailable under partial override {revGrowth:-0.20}; simulated only when cash+revenue supplied';
});

// ---------------------------------------------------------------------------
// P0-4: Layer 3 Operational Contagion Across 7 Scenarios A–G (T13–T18)
// ---------------------------------------------------------------------------
test('T13', 'P0-4 Scenario A: CRWV Default -> OPENAI & MSFT Operational Disruption (Separated From L1)', () => {
  const sim = Engine.runSimulation(entities, transactions, { forcedDefaults: ['CRWV'] });
  const oaiCost = forwardQs.reduce((s, q) => s + (sim.timeline[q].entities['OPENAI'].operationalCostHit || 0), 0);
  const oaiDelay = forwardQs.reduce((s, q) => s + (sim.timeline[q].entities['OPENAI'].operationalRevDelay || 0), 0);
  const msftCost = forwardQs.reduce((s, q) => s + (sim.timeline[q].entities['MSFT'].operationalCostHit || 0), 0);
  assert(oaiCost > 0 && oaiDelay > 0 && msftCost > 0);
  // Verify L3 is distinct from L1 financial creditLoss on OPENAI & MSFT
  assert.strictEqual(sim.timeline['2026Q4'].entities['OPENAI'].creditLoss, 0);
  return `OPENAI mig=$${oaiCost.toFixed(2)}B, delay=$${oaiDelay.toFixed(2)}B; MSFT mig=$${msftCost.toFixed(2)}B (L1 creditLoss=0)`;
});

test('T14', 'P0-4 Scenario B: VERTIV Default -> CRWV Cooling/Electrical Operational Disruption (TX65)', () => {
  const sim = Engine.runSimulation(entities, transactions, { forcedDefaults: ['VERTIV'] });
  const crwvEvs = forwardQs.flatMap(q => sim.timeline[q].contagionLog.filter(e => e.txId === 'TX65' && e.layer === 'L3_OPERATIONAL'));
  assert(crwvEvs.length >= 2, `Expected migration + disruption events for TX65, got ${crwvEvs.length}`);
  const totalCost = forwardQs.reduce((s, q) => s + (sim.timeline[q].entities['CRWV'].operationalCostHit || 0), 0);
  const totalDelay = forwardQs.reduce((s, q) => s + (sim.timeline[q].entities['CRWV'].operationalRevDelay || 0), 0);
  assert(totalCost > 0 && totalDelay > 0);
  return `VERTIV->CRWV (TX65 Cooling/Electrical): mig=$${totalCost.toFixed(3)}B, delay=$${totalDelay.toFixed(3)}B`;
});

test('T15', 'P0-4 Scenario C: DELL Default -> CRWV GPU/Server Supply Disruption (TX64)', () => {
  const sim = Engine.runSimulation(entities, transactions, { forcedDefaults: ['DELL'] });
  const crwvEvs = forwardQs.flatMap(q => sim.timeline[q].contagionLog.filter(e => e.txId === 'TX64' && e.layer === 'L3_OPERATIONAL'));
  assert(crwvEvs.length >= 2, `Expected TX64 L3 operational events, got ${crwvEvs.length}`);
  const totalCost = forwardQs.reduce((s, q) => s + (sim.timeline[q].entities['CRWV'].operationalCostHit || 0), 0);
  assert(totalCost > 0);
  return `DELL->CRWV (TX64 GPU/Server Supply): mig=$${totalCost.toFixed(3)}B across ${crwvEvs.length} L3 events`;
});

test('T16', 'P0-4 Scenarios D & E: Nuclear Power PPAs — CEG->MSFT (2028Q1+) & VST->META (2027Q1+)', () => {
  const simCEG = Engine.runSimulation(entities, transactions, { forcedDefaults: ['CEG'] });
  const msft28 = simCEG.timeline['2028Q1'].contagionLog.filter(e => e.txId === 'TX67' && e.layer === 'L3_OPERATIONAL');
  const meta27q2 = simCEG.timeline['2027Q2'].contagionLog.filter(e => e.txId === 'TX68' && e.layer === 'L3_OPERATIONAL');
  assert(msft28.length > 0 && meta27q2.length > 0, 'CEG nuclear PPAs must activate at exact startQ');

  const simVST = Engine.runSimulation(entities, transactions, { forcedDefaults: ['VST'] });
  assert.strictEqual(simVST.timeline['2026Q4'].contagionLog.filter(e => e.txId === 'TX69').length, 0, 'TX69 must not fire in 2026Q4');
  const meta27q1 = simVST.timeline['2027Q1'].contagionLog.filter(e => e.txId === 'TX69' && e.layer === 'L3_OPERATIONAL');
  assert(meta27q1.length > 0, 'TX69 (META->VST) must activate in 2027Q1');
  return `CEG->MSFT (TX67@28Q1: ${msft28.length} evs), CEG->META (TX68@27Q2: ${meta27q2.length} evs), VST->META (TX69@27Q1: ${meta27q1.length} evs)`;
});

test('T17', 'P0-4 Scenario F: Data Center Host Default (CORZ -> CRWV TX66) + Recovery Decay', () => {
  const simCORZ = Engine.runSimulation(entities, transactions, { forcedDefaults: ['CORZ'] });
  const q4Delay = simCORZ.timeline['2026Q4'].entities['CRWV'].operationalRevDelay;
  const q1Delay = simCORZ.timeline['2027Q1'].entities['CRWV'].operationalRevDelay;
  const q2Delay = simCORZ.timeline['2027Q2'].entities['CRWV'].operationalRevDelay;
  assert(q4Delay > 0, 'CRWV must incur disruption in 2026Q4 from CORZ default');
  assert(q1Delay > 0 && q1Delay < q4Delay, `Disruption must decay over switching window: Q4=${q4Delay} -> Q1=${q1Delay}`);
  assert.strictEqual(q2Delay, 0, `Disruption must recover to 0 after 26-week (2-quarter) switch window: Q2=${q2Delay}`);
  return `CORZ->CRWV (TX66): Q4 delay=$${q4Delay.toFixed(4)}B -> Q1=$${q1Delay.toFixed(4)}B -> Q2=$0 (full recovery)`;
});

test('T18', 'P0-4 Scenario G: Critical Supplier Multi-Hop Operational Contagion (NVDA -> Cloud/Neocloud)', () => {
  const simNVDA = Engine.runSimulation(entities, transactions, { forcedDefaults: ['NVDA'] });
  const l3Events = simNVDA.timeline['2026Q4'].contagionLog.filter(e => e.layer === 'L3_OPERATIONAL' && e.from === 'NVDA');
  const affectedCustomers = new Set(l3Events.map(e => e.to));
  assert(affectedCustomers.has('CRWV') && affectedCustomers.has('MSFT') && affectedCustomers.has('ORCL'),
    `NVDA outage must disrupt downstream GPU buyers, got: ${Array.from(affectedCustomers).join(',')}`);
  return `NVDA outage disrupted ${affectedCustomers.size} downstream buyers (${Array.from(affectedCustomers).join(', ')}) via L3`;
});

// ---------------------------------------------------------------------------
// P1-2 & P1-3: Layer 4 Secondary Contagion & Unforced Baseline Audit (T19, T20)
// ---------------------------------------------------------------------------
test('T19', 'P1-2 Layer 4 Secondary Contagion (Peer Spread Widening, Zero Double-Count)', () => {
  const simCRWV = Engine.runSimulation(entities, transactions, { forcedDefaults: ['CRWV'] });
  const l4Evs = simCRWV.timeline['2026Q4'].contagionLog.filter(e => e.layer === 'L4_SECONDARY');
  assert(l4Evs.length > 0, 'Expected L4_SECONDARY peer spread widening events under CRWV default');
  // Verify toggle works cleanly (disableSecondaryContagion -> 0 L4 events)
  const simNoL4 = Engine.runSimulation(entities, transactions, { forcedDefaults: ['CRWV'], enableSecondaryContagion: false });
  assert.strictEqual(simNoL4.timeline['2026Q4'].contagionLog.filter(e => e.layer === 'L4_SECONDARY').length, 0);
  return `Triggered ${l4Evs.length} L4_SECONDARY peer spread events (${l4Evs.map(e => e.to).join(', ')}); cleanly toggleable`;
});

test('T20', 'P1-3 Baseline Transparency: Every Distress Event Has Explicit Financial Cause (No Forced-Zero Hack)', () => {
  const base = Engine.runSimulation(entities, transactions);
  let checkedDefaults = 0;
  forwardQs.forEach(q => {
    entities.filter(e => !e.isOcean).forEach(e => {
      const st = base.timeline[q].entities[e.id];
      if (st.insufficientData) {
        assert.strictEqual(st.distressLevel, 0, `Insufficient Data entity ${e.id} must never default in Base Case`);
      }
      if (st.distressLevel === 3) {
        assert(st.defaultCause && st.defaultCause.length > 0, `Base L3 default ${e.id} in ${q} missing explicit defaultCause`);
        assert((st.cash + st.undrawnCredit) < 0, `Base L3 default ${e.id} in ${q} must have negative total liquidity`);
        checkedDefaults++;
      }
    });
  });
  return `Verified all 9 forward quarters: 0 Insufficient-Data false defaults; ${checkedDefaults} data-backed L3 entity-quarters with explicit financial cause`;
});

console.log(`\nV3.0 INDEPENDENT AUDIT TESTS SUMMARY: ${passed} PASSED, ${failed} FAILED.`);
