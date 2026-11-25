#!/usr/bin/env node
/**
 * Upgraded Independent Audit 2.0 Regression Test Suite (12 Strict Invariants)
 */
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const Engine = require('../engine/contagion_engine.js');

const rootDir = path.join(__dirname, '..');
const entities = JSON.parse(fs.readFileSync(path.join(rootDir, 'data/entities.json'), 'utf8'));
const transactions = JSON.parse(fs.readFileSync(path.join(rootDir, 'data/transactions.json'), 'utf8'));

let passed = 0, failed = 0;
function check(name, fn) {
  try {
    const msg = fn();
    console.log(`[PASS] ${name} — ${msg}`);
    passed++;
  } catch (err) {
    console.error(`[FAIL] ${name} — ${err.message}`);
    failed++;
    process.exitCode = 1;
  }
}

const base = Engine.runSimulation(entities, transactions);
const shockOAI = Engine.runSimulation(entities, transactions, { forcedDefaults: ['OPENAI'] });
const shockCRWV = Engine.runSimulation(entities, transactions, { forcedDefaults: ['CRWV'] });
const forwardQs = ['2026Q4','2027Q1','2027Q2','2027Q3','2027Q4','2028Q1','2028Q2','2028Q3','2028Q4'];

// 1. Accounting Conservation & Auto-RCF Drawdown
check('Audit-1: Accounting Conservation & RCF Auto-Draw', () => {
  let checks = 0;
  [base, shockOAI, shockCRWV].forEach(sim => {
    forwardQs.forEach(q => {
      entities.filter(e => !e.isOcean).forEach(e => {
        const s = sim.timeline[q].entities[e.id];
        if (s.insufficientData) return;
        const lhs = s.cash;
        const rhs = s.begCash + s.ocf - s.capex + s.newDebt + s.equityInflow - s.principalRepay - (s.gpuMarginCall || 0) + s.rcfDraw;
        assert(Math.abs(lhs - rhs) < 0.01, `${e.id} ${q}: EndCash ${lhs} != RHS ${rhs.toFixed(4)}`);
        assert(!(s.cash < -0.001 && s.undrawnCredit > 0.001), `${e.id} ${q}: cash=${s.cash} < 0 while undrawnCredit=${s.undrawnCredit} > 0`);
        checks++;
      });
    });
  });
  return `Verified ${checks} simulated entity-quarters with <0.01 error & 0 RCF violations`;
});

// 2. TRUE One-Time LGD & Guarantee Ceiling (45% LGD stays 45%, 25% Guarantee stays 25% — NEVER 100%!)
check('Audit-2: True One-Time LGD (<=45.1%) & Guarantee (<=25.1%)', () => {
  let maxDebtPct = 0, maxGuarPct = 0;
  Object.entries(shockOAI.cumCreditLossByTx).forEach(([txId, loss]) => {
    const tx = transactions.find(t => t.id === txId);
    const cap = (tx.amountDrawn && tx.amountDrawn > 0) ? tx.amountDrawn : (tx.totalCommitment || 1);
    const pct = (loss / cap) * 100;
    if (tx.type === 'Loan Guarantee') {
      if (pct > maxGuarPct) maxGuarPct = pct;
      assert(pct <= 25.1, `${txId} guarantee cumLoss=${pct.toFixed(1)}% exceeded one-time 25% call!`);
    } else {
      if (pct > maxDebtPct) maxDebtPct = pct;
      assert(pct <= 45.1, `${txId} debt cumLoss=${pct.toFixed(1)}% exceeded one-time 45% LGD!`);
    }
  });
  assert(maxDebtPct > 44.0 && maxGuarPct > 24.0, 'Expected active one-time LGD & guarantee hits');
  return `Max 9-Qtr Debt LGD=${maxDebtPct.toFixed(1)}% (exact 45%), Max Guarantee Call=${maxGuarPct.toFixed(1)}% (exact 25%)`;
});

// 3. Managed Private Funds Non-Bankruptcy
check('Audit-3: Private Funds Non-Bankruptcy (lossAbsorbingInvestor)', () => {
  const funds = ['BX_FUNDS','APOLLO_FUNDS','PIMCO_FUNDS','BLUEOWL_FUNDS','BLK_AIP'];
  forwardQs.forEach(q => {
    funds.forEach(fid => {
      assert(shockOAI.timeline[q].entities[fid].distressLevel < 3, `${fid} hit L3 in ${q}`);
      assert(shockCRWV.timeline[q].entities[fid].distressLevel < 3, `${fid} hit L3 in ${q}`);
    });
  });
  return 'All 5 managed fund complexes absorbed losses without corporate L3 bankruptcy';
});

// 4. Clean Baseline Stability (ZERO false L3 defaults in Base Case through 2027Q4!)
check('Audit-4: Clean Baseline Stability (0 False L3 Defaults @ 2027Q4)', () => {
  const baseL3 = entities.filter(e => !e.isOcean && base.timeline['2027Q4'].entities[e.id].distressLevel === 3).map(e => e.id);
  assert.strictEqual(baseL3.length, 0, `Baseline still has false L3 defaults: ${baseL3.join(', ')}`);
  return '0 false L3 defaults in unstressed Base Case through 2027Q4';
});

// 5. Layer 3 Operational Dependency Contagion (CoreWeave Default -> Downstream Customers OPENAI & MSFT!)
check('Audit-5: Layer 3 Operational Contagion (CRWV Default -> OPENAI & MSFT)', () => {
  const oaiOpCost = forwardQs.reduce((s, q) => s + (shockCRWV.timeline[q].entities['OPENAI'].operationalCostHit || 0), 0);
  const oaiOpRev = forwardQs.reduce((s, q) => s + (shockCRWV.timeline[q].entities['OPENAI'].operationalRevDelay || 0), 0);
  const msftOpCost = forwardQs.reduce((s, q) => s + (shockCRWV.timeline[q].entities['MSFT'].operationalCostHit || 0), 0);
  assert(oaiOpCost > 0 && oaiOpRev > 0, `OpenAI must incur Layer 3 switching cost & disruption: cost=${oaiOpCost}, rev=${oaiOpRev}`);
  assert(msftOpCost > 0, `MSFT must incur Layer 3 switching cost: ${msftOpCost}`);
  assert(shockCRWV.timeline['2027Q4'].entities['MSFT'].distressLevel < 3, 'MSFT must absorb CRWV outage without false bankruptcy');
  return `CRWV default -> OPENAI migration $${oaiOpCost.toFixed(2)}B + disruption $${oaiOpRev.toFixed(2)}B; MSFT migration $${msftOpCost.toFixed(2)}B (MSFT stays solvent)`;
});

// 6. Upstream Hardware Contagion + Decaying Growth Penalty (NVDA impacted realistically, never collapses to $0!)
check('Audit-6: Upstream Hardware Contagion & No $0 Collapse Under -20%/q Shock', () => {
  const nvBase = base.timeline['2027Q2'].entities['NVDA'];
  const nvOai = shockOAI.timeline['2027Q2'].entities['NVDA'];
  assert(nvOai.revenue < nvBase.revenue - 3.0, `NVDA rev must drop under OpenAI default`);
  const allShockOv = {};
  entities.forEach(e => { if (!e.isOcean) allShockOv[e.id] = { revGrowth: -0.20, revDecel: 0 }; });
  const shock20 = Engine.runSimulation(entities, transactions, { overrides: allShockOv });
  const nv20 = shock20.timeline['2027Q4'].entities['NVDA'];
  assert(nv20.revenue > 10.0, `NVDA collapsed unrealistically under -20%/q shock: rev=$${nv20.revenue}B`);
  return `OAI default NVDA 27Q2 rev $${nvBase.revenue.toFixed(1)}B->$${nvOai.revenue.toFixed(1)}B; -20%/q stress NVDA 27Q4 rev=$${nv20.revenue.toFixed(1)}B (no $0 collapse)`;
});

// 7. Ocean Interest Rate Sensitivity
check('Audit-7: Ocean Interest Rate Sensitivity (5% -> 12%)', () => {
  const low = Engine.runSimulation(entities, transactions, { ocean: { interestRate: 5.0 } });
  const high = Engine.runSimulation(entities, transactions, { ocean: { interestRate: 12.0 } });
  const lowInt = low.timeline['2027Q1'].entities['CRWV'].interestExp;
  const highInt = high.timeline['2027Q1'].entities['CRWV'].interestExp;
  assert(highInt > lowInt, `CRWV interest did not rise: ${lowInt} -> ${highInt}`);
  return `CRWV 2027Q1 interestExp rose $${lowInt.toFixed(3)}B (5%) -> $${highInt.toFixed(3)}B (12%)`;
});

// 8. Case D (-50% unclamped) & Case H (GPU Collateral Haircut)
check('Audit-8: Case D (-50% Unclamped) & Case H (GPU Collateral Haircut)', () => {
  const caseD = Engine.runSimulation(entities, transactions, { overrides: { NVDA: { revGrowth: -0.50, revDecel: 0 } } });
  const ratio = caseD.timeline['2026Q4'].entities['NVDA'].revenue / base.timeline['2026Q3'].entities['NVDA'].revenue;
  assert(Math.abs(ratio - 0.50) < 0.02, `Case D clamped: ratio=${ratio}`);
  const caseH = Engine.runSimulation(entities, transactions, { gpuCollateralHaircut: 0.45 });
  const mc = caseH.timeline['2026Q4'].entities['CRWV'].gpuMarginCall;
  assert(mc > 0, `Case H margin call missing: ${mc}`);
  return `Case D NVDA Q4/Q3=${(ratio*100).toFixed(1)}%; Case H CRWV margin call=$${mc.toFixed(2)}B`;
});

// 9. Audit 2.0 Data Corrections (CRWV nonRecourseDebt/AP, ORCL $288B leases & periodEnd, NVDA periodEnd/AP)
check('Audit-9: Audit 2.0 Financial Data & PeriodEnd Corrections', () => {
  const crwv = entities.find(e => e.id === 'CRWV').financials['2026Q3'];
  const orcl = entities.find(e => e.id === 'ORCL').financials['2026Q3'];
  const nvda = entities.find(e => e.id === 'NVDA').financials['2026Q3'];
  assert.strictEqual(crwv.shortTermDebt, null, 'CRWV shortTermDebt must not be 5.27 non-recourse');
  assert.strictEqual(crwv.nonRecourseDebt, 5.27);
  assert.strictEqual(crwv.ap, 2.928);
  assert.strictEqual(orcl.periodEnd, '2026-08-31');
  assert.strictEqual(orcl.offBalanceLeases, 288.0);
  assert.strictEqual(nvda.periodEnd, '2026-10-25');
  assert.strictEqual(nvda.ap, 21.074);
  return 'CRWV nonRecourse=$5.27B/AP=$2.93B, ORCL 08-31/$288B leases, NVDA 10-25/AP=$21.07B';
});

// 10. Verified Supply-Chain & Power Intermediaries Connected
check('Audit-10: Supply-Chain & Power Intermediaries Connected (DELL, VERTIV, CEG, VST, CORZ)', () => {
  const conn = Engine.analyzeConnectivity(entities, Engine.getVisibleTransactions(transactions, '2026Q3'));
  ['DELL', 'VERTIV', 'CEG', 'VST', 'CORZ'].forEach(id => {
    assert(conn.connectedIds.has(id), `${id} should be connected in 2026Q3`);
  });
  return `DELL, VERTIV, CEG, VST, CORZ connected (Total connected=${conn.connectedIds.size})`;
});

// 11. Network Layer Filtering (Financial / Commercial / Operational)
check('Audit-11: Network Layer Filtering Supported', () => {
  const fin = Engine.getVisibleTransactions(transactions, '2026Q3', 'Financial');
  const com = Engine.getVisibleTransactions(transactions, '2026Q3', 'Commercial');
  const ops = Engine.getVisibleTransactions(transactions, '2026Q3', 'Operational');
  assert(fin.length > 20 && com.length > 10 && ops.length >= 8);
  return `2026Q3 layers: Financial=${fin.length}, Commercial=${com.length}, Operational=${ops.length}`;
});

// 12. Strict Single-Language Purity (index_en.html === 0 Chinese chars)
check('Audit-12: Strict Language Purity (index_en.html === 0 Chinese chars)', () => {
  const enHtml = fs.readFileSync(path.join(rootDir, 'index_en.html'), 'utf8');
  const cn = enHtml.match(/[\u4e00-\u9fff]/g) || [];
  assert.strictEqual(cn.length, 0, `Found ${cn.length} Chinese characters in index_en.html`);
  return '0 Chinese characters in index_en.html';
});

console.log(`\nAUDIT 2.0 REGRESSION SUMMARY: ${passed} PASSED, ${failed} FAILED.`);
