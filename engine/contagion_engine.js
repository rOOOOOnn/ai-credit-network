/**
 * AI Credit Network — Audit-Remediated Cash Flow Forecasting, Stress Testing & Multi-Hop Contagion Engine (v2)
 * Implements:
 * - P0-1: 4-Channel Upstream Hardware Supply Chain Contagion (A1 Direct/L2 Cut, A2 AR Bad-Debt Write-Off, A3 Induced CapEx Contraction + Next-Qtr Growth Suppression, A4 Circular Guarantee/Backstop/Equity Impairment)
 * - P0-2: Cross-Quarter LGD Deduplication (<=100% principal), Non-Cash Credit Impairment Separation, lossAbsorbingInvestor Non-Bankruptcy
 * - P0-3: Calibrated OCF Continuity (Zero Double-Deduction), Auto-RCF Drawdown Accounting, Wired ocean.interestRate, Objective Market Stress (No Hardcodes), Unclamped Downside Growth
 * - P1-3/P1-4: Fixed periodEnd Historical Matching, Contract-Driven Mode A, Debt Maturity Wall, Case H GPU Collateral Haircut / LTV Trigger
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.AICreditEngine = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  const QUARTERS_HIST = [
    "2022Q1","2022Q2","2022Q3","2022Q4",
    "2023Q1","2023Q2","2023Q3","2023Q4",
    "2024Q1","2024Q2","2024Q3","2024Q4",
    "2025Q1","2025Q2","2025Q3","2025Q4",
    "2026Q1","2026Q2","2026Q3"
  ];
  const QUARTER_PARTIAL = "2026Q4";
  const QUARTERS_FORECAST = ["2027Q1","2027Q2","2027Q3","2027Q4","2028Q1","2028Q2","2028Q3","2028Q4"];
  const ALL_QUARTERS = [...QUARTERS_HIST, QUARTER_PARTIAL, ...QUARTERS_FORECAST];

  function quarterEndDate(q) {
    const y = parseInt(q.slice(0, 4), 10);
    const n = parseInt(q.slice(5), 10);
    const ends = { 1: `${y}-03-31`, 2: `${y}-06-30`, 3: `${y}-09-30`, 4: `${y}-12-31` };
    return ends[n] || `${y}-12-31`;
  }

  function quarterStatus(q) {
    if (q === QUARTER_PARTIAL) return "PARTIAL";
    return QUARTERS_FORECAST.includes(q) ? "FORECAST" : "HISTORICAL";
  }

  function qIndex(q) {
    return ALL_QUARTERS.indexOf(q);
  }

  function compareQuarter(a, b) {
    if (!a || !b) return 0;
    return a.localeCompare(b);
  }

  function isPoolId(id) {
    return id === "PRIVATE_CREDIT_OCEAN" || id === "EXTERNAL_EQUITY_POOL";
  }

  /**
   * Time-aware active relationship filter (zero lookahead in historical quarters).
   */
  function getVisibleTransactions(transactions, quarter) {
    const endDate = quarterEndDate(quarter);
    const isForecast = quarterStatus(quarter) === "FORECAST";
    return transactions.filter(tx => {
      if (!isForecast && tx.announcedDate && tx.announcedDate > endDate) {
        return false;
      }
      if (tx.type === "Equity Investment" || tx.type === "Asset Acquisition") {
        return true;
      }
      if (tx.endQ && compareQuarter(quarter, tx.endQ) > 0) {
        const rem = tx.remainingCommitment ?? 0;
        const unpaid = (tx.amountDrawn ?? 0) - (tx.amountRepaid ?? 0);
        if (rem <= 0 && unpaid <= 0) return false;
      }
      return true;
    });
  }

  /**
   * Connected Components & Strict Zero-Isolated-Nodes Connectivity Analysis.
   */
  function analyzeConnectivity(entities, activeTxs) {
    const nonOcean = entities.filter(e => !e.isOcean);
    const degree = {};
    const adj = {};
    nonOcean.forEach(e => { degree[e.id] = 0; adj[e.id] = new Set(); });

    activeTxs.forEach(tx => {
      if (degree[tx.payer] !== undefined) degree[tx.payer]++;
      if (degree[tx.receiver] !== undefined) degree[tx.receiver]++;
      if (adj[tx.payer] && adj[tx.receiver] && !isPoolId(tx.payer) && !isPoolId(tx.receiver)) {
        adj[tx.payer].add(tx.receiver);
        adj[tx.receiver].add(tx.payer);
      }
    });

    const connectedIds = new Set(nonOcean.filter(e => adj[e.id] && adj[e.id].size > 0).map(e => e.id));
    const unconnectedIds = nonOcean.filter(e => !connectedIds.has(e.id)).map(e => e.id);

    const visited = new Set();
    const components = [];
    Array.from(connectedIds).forEach(nid => {
      if (visited.has(nid)) return;
      const queue = [nid];
      const comp = [];
      visited.add(nid);
      while (queue.length > 0) {
        const u = queue.shift();
        comp.push(u);
        (adj[u] || []).forEach(v => {
          if (connectedIds.has(v) && !visited.has(v)) {
            visited.add(v);
            queue.push(v);
          }
        });
      }
      components.push(comp);
    });
    components.sort((a, b) => b.length - a.length);

    return { connectedIds, unconnectedIds, components, degree };
  }

  function getEdgeVisual(tx, selectedNodeId, quarter) {
    const isForecastQ = quarterStatus(quarter) === "FORECAST";
    let color = "url(#grad-out-in)";
    let role = "neutral";
    if (selectedNodeId) {
      if (tx.payer === selectedNodeId) {
        color = "#EF4444";
        role = "outflow";
      } else if (tx.receiver === selectedNodeId) {
        color = "#10B981";
        role = "inflow";
      } else {
        color = "#334155";
        role = "dimmed";
      }
    }

    const amt = tx.totalCommitment;
    let dashArray = "";
    let opacity = role === "dimmed" ? 0.14 : 0.85;
    let lineKind = "Actual";

    if (amt === null || amt === undefined || Number.isNaN(Number(amt))) {
      dashArray = "2,4";
      opacity = role === "dimmed" ? 0.08 : 0.55;
      lineKind = "Unknown";
    } else if (tx.status === "Estimated") {
      dashArray = "4,3";
      opacity = role === "dimmed" ? 0.10 : 0.65;
      lineKind = "Estimated";
    } else if (isForecastQ && tx.status !== "Actual") {
      dashArray = "3,3";
      opacity = role === "dimmed" ? 0.10 : 0.65;
      lineKind = "Forecast";
    } else if (tx.status === "Committed" || tx.amountDrawn === 0) {
      dashArray = "8,4";
      lineKind = "Committed";
    } else {
      dashArray = "";
      lineKind = "Actual";
    }

    const strokeWidth = amt ? Math.max(1.4, Math.min(8.5, 1.2 + Math.log10(1 + amt) * 2.8)) : 1.2;
    return { color, role, dashArray, opacity, strokeWidth, lineKind };
  }

  /**
   * Objective Multi-Factor Fragility Score (0-100) — zero hardcoded entity IDs.
   * Uses real balance-sheet leverage, cash burn, refinancing dependency, obligation coverage,
   * and objective market stress fields (secondaryPriceCents < 95, forceMajeureActive).
   */
  function computeFragilityScore(entity, st, ocean, entityTxs = []) {
    if (!entity || entity.isOcean || entity.lossAbsorbingInvestor) return { score: 0, drivers: [] };
    const p = entity.defaults || {};
    const cash = st.cash !== null && st.cash !== undefined ? st.cash : (p.minCash ? p.minCash * 2 : 1.0);
    const undrawn = st.undrawnCredit !== null && st.undrawnCredit !== undefined ? st.undrawnCredit : 0;
    const liq = Math.max(0.2, cash + undrawn);
    const debt = Math.max(0, st.debt ?? 0);
    const fcf = st.fcf !== null && st.fcf !== undefined ? st.fcf : -((p.capex || 0) * 0.4);
    const rev = Math.max(0.05, st.revenue !== null && st.revenue !== undefined ? st.revenue : 0.5);
    const gm = Math.max(0.1, p.grossMargin ?? 0.5);
    const refi = Math.max(0.1, (p.refiSuccess ?? 0.85) * ((ocean?.refiSuccessRate ?? 85) / 100));
    const avail = (ocean?.fundingAvailability ?? 100) / 100;

    const levScore = Math.min(30, (debt / liq) * 3.8);
    const burnScore = Math.min(25, (fcf < 0 ? Math.abs(fcf) / liq : 0) * 26);
    const refiScore = Math.min(25, Math.max(0, ((1 - refi) * 30) + ((p.newDebt || 0) / liq) * 10 * (1.2 - avail * 0.5)));
    const fixedOblig = (st.interestExp || (debt * (p.interestRate || 0.06) / 4)) + (p.debtRepay || 0) + (p.computePay || 0);
    const covScore = Math.min(20, (fixedOblig / Math.max(0.15, rev * gm)) * 8);

    // Objective market stress derived from transaction metadata (secondary loan discount / force majeure)
    let marketStress = 0;
    let hasDiscount = false;
    let hasForceMajeure = false;
    entityTxs.forEach(tx => {
      if (tx.receiver === entity.id) {
        if (tx.secondaryPriceCents && tx.secondaryPriceCents < 95) {
          marketStress += (100 - tx.secondaryPriceCents) * 1.1;
          hasDiscount = true;
        }
        if (tx.forceMajeureActive) {
          marketStress += 8;
          hasForceMajeure = true;
        }
      }
    });

    let distressBoost = 0;
    if (st.distressLevel === 3) distressBoost = 30;
    else if (st.distressLevel === 2) distressBoost = 18;
    else if (st.distressLevel === 1) distressBoost = 8;

    const score = Math.round(Math.min(100, Math.max(4, levScore + burnScore + refiScore + covScore + marketStress + distressBoost)));
    const drivers = [];
    if (levScore >= 14) drivers.push("High Leverage");
    if (burnScore >= 10) drivers.push("Cash Burn / CapEx");
    if (refiScore >= 10) drivers.push("Refinancing Dependency");
    if (covScore >= 10) drivers.push("Fixed Obligation Load");
    if (hasDiscount || hasForceMajeure) drivers.push("Force Majeure / Secondary Discount");
    return { score, drivers };
  }

  function computeEntityMetrics(entities, visibleTxs, stateByEntity) {
    const flowMap = {}, degreeMap = {}, commitMap = {};
    entities.forEach(e => { flowMap[e.id] = 0; degreeMap[e.id] = new Set(); commitMap[e.id] = 0; });

    visibleTxs.forEach(tx => {
      const amt = Number(tx.totalCommitment) || 0;
      if (flowMap[tx.payer] !== undefined) {
        flowMap[tx.payer] += amt;
        degreeMap[tx.payer].add(tx.receiver);
        if (tx.status === "Committed") commitMap[tx.payer] += amt;
      }
      if (flowMap[tx.receiver] !== undefined) {
        flowMap[tx.receiver] += amt;
        degreeMap[tx.receiver].add(tx.payer);
        if (tx.status === "Committed") commitMap[tx.receiver] += amt;
      }
    });

    const metrics = {};
    entities.forEach(e => {
      const st = stateByEntity[e.id] || {};
      const rev = st.revenue ?? 0;
      const debt = st.debt ?? 0;
      const cash = st.cash ?? 0;
      const rpo = Math.max(st.rpo ?? 0, commitMap[e.id] || 0);
      const flows = flowMap[e.id] || 0;
      const deg = degreeMap[e.id] ? degreeMap[e.id].size : 0;
      const infra = e.infraRole || 50;

      const systemic = e.isOcean ? 100 : Math.round(
        Math.min(35, Math.log10(1 + flows) * 12) +
        Math.min(20, Math.log10(1 + debt) * 8) +
        Math.min(20, Math.log10(1 + rpo) * 7) +
        Math.min(15, deg * 2.2) +
        (infra * 0.25)
      );

      metrics[e.id] = { systemic, revenue: rev, debt, liquidity: cash + (st.undrawnCredit ?? 0), commitments: rpo, networkExposure: flows, degree: deg };
    });
    return metrics;
  }

  /**
   * Core Phase 3 & Audit-Remediated v2 Simulation Engine.
   */
  function runSimulation(entities, transactions, options = {}) {
    const ocean = Object.assign({
      fundingAvailability: 100,    // % (0-100)
      interestRate: 7.5,           // % (wired into floating/new/refi debt!)
      refiSuccessRate: 85,         // % (0-100)
      maxCapacity: 250,            // $B per quarter
      creditTighteningBps: 0       // bps added to spreads
    }, options.ocean || {});

    const overrides = options.overrides || {};
    const forcedDefaults = new Set(options.forcedDefaults || []);
    const defaultHaircut = options.defaultHaircut ?? 0.75;
    const crisisCapExCut = options.crisisCapExCut ?? 0.40;
    const lgd = options.lgd ?? 0.45;
    const guaranteeCallRate = options.guaranteeCallRate ?? 0.25;
    const gpuShareOfAiCapex = options.gpuShareOfAiCapex ?? 0.45;
    const capexElasticity = options.capexElasticity ?? 0.35;
    const maxCapexCutShare = options.maxCapexCutShare ?? 0.65;
    const gpuCollateralHaircut = options.gpuCollateralHaircut ?? 0.0; // Case H: 0.0 to 0.70
    const pointInTimeBacktest = Boolean(options.pointInTimeBacktest);

    const entityById = Object.fromEntries(entities.map(e => [e.id, e]));
    const timeline = {};

    // Global cross-quarter deduplication trackers (P0-2 & P0-1 A2/A4)
    const cumCreditLossByTx = {};
    const arWrittenOffPairs = new Set();
    const equityImpairedTxIds = new Set();
    const nextQGrowthPenalty = {}; // { entityId: negative delta } from Channel A3

    // Pre-compute historical baseline OCF calibration per entity (P0-3.1: eliminates 2026Q4 artificial cliff)
    const ocfCalibById = {};
    entities.forEach(e => {
      const q3 = e.financials && e.financials["2026Q3"];
      const p = e.defaults || {};
      if (q3 && q3.ocf !== null && q3.ocf !== undefined && q3.revenue !== null && q3.revenue !== undefined) {
        const gm = Math.max(0.05, Math.min(0.98, p.grossMargin ?? 0.55));
        const cc = Math.max(0.3, Math.min(1.0, p.cashConv ?? 0.88));
        const q3Int = q3.interestExp ?? 0;
        // Exact pre-interest operating cash flow at Q3 baseline
        const q3GrossCash = q3.revenue * gm * cc;
        const impliedFixedOpCash = q3GrossCash - (q3.ocf + q3Int);
        ocfCalibById[e.id] = {
          hasCalib: true,
          impliedFixedOpCash,
          baseRev: q3.revenue,
          baseOcfMargin: q3.revenue > 0 ? q3.ocf / q3.revenue : 0
        };
      } else {
        ocfCalibById[e.id] = { hasCalib: false };
      }
    });

    // Historical Snapshot Helper (P1-3 fixed: matches by periodEnd by default, disclosedDate only in pointInTimeBacktest)
    function getHistoricalSnapshot(entity, q) {
      const targetIdx = qIndex(q);
      const qEnd = quarterEndDate(q);
      const exact = entity.financials && entity.financials[q];
      if (exact) {
        const pitOk = !pointInTimeBacktest || !exact.disclosedDate || exact.disclosedDate <= qEnd;
        if (pitOk) {
          return Object.assign({ quarter: q, hasActual: true, isSimulatedEvent: false, distressLevel: 0 }, exact);
        }
      }
      let best = null;
      if (entity.financials) {
        for (const [fq, vals] of Object.entries(entity.financials)) {
          if (qIndex(fq) <= targetIdx) best = vals;
        }
      }
      if (!best) {
        return {
          quarter: q, revenue: null, cash: null, debt: null, ocf: null, capex: null, fcf: null,
          rpo: null, interestExp: null, undrawnCredit: null,
          dataType: entity.isOcean ? "System Pool" : "Unavailable",
          hasActual: false, isSimulatedEvent: false, distressLevel: 0
        };
      }
      return Object.assign({ quarter: q, hasActual: false, isSimulatedEvent: false, distressLevel: 0 }, best, { dataType: best.dataType || "Estimated" });
    }

    // 1. Populate Historical Quarters (2022Q1 - 2026Q3)
    QUARTERS_HIST.forEach(q => {
      const visTxs = getVisibleTransactions(transactions, q);
      const states = {};
      entities.forEach(e => {
        const snap = getHistoricalSnapshot(e, q);
        snap.distressLevel = 0;
        snap.distressLabel = e.isOcean ? "External Pool (Non-Defaulting)" : "Normal";
        snap.creditLoss = 0;
        snap.equityImpairment = 0;
        snap.lostReceipts = 0;
        snap.arCashHit = 0;
        snap.inducedCapexCut = 0;
        snap.rcfDraw = 0;
        snap.requiredRevenue = null;
        const frag = computeFragilityScore(e, snap, ocean, visTxs);
        snap.fragilityScore = frag.score;
        snap.fragilityDrivers = frag.drivers;
        states[e.id] = snap;
      });
      timeline[q] = { quarter: q, status: "HISTORICAL", entities: states, contagionLog: [] };
    });

    // 2. Forward Simulation (2026Q4 Partial & 2027Q1 - 2028Q4 Forecast)
    const forwardQs = [QUARTER_PARTIAL, ...QUARTERS_FORECAST];
    let prevStates = timeline["2026Q3"].entities;

    forwardQs.forEach((q, stepIdx) => {
      const status = quarterStatus(q);
      const visibleTxs = getVisibleTransactions(transactions, q);
      const states = {};
      let oceanUsedThisQ = 0;

      // Step 2A: Standalone Quarterly Cash Flow Projection
      entities.forEach(e => {
        const prev = prevStates[e.id] || {};
        if (e.isOcean) {
          states[e.id] = {
            quarter: q, revenue: null, cash: ocean.maxCapacity, debt: 0, ocf: null, capex: 0, fcf: null,
            rpo: 0, interestExp: 0, undrawnCredit: ocean.maxCapacity,
            dataType: "System Pool", distressLevel: 0, distressLabel: "External Pool (Non-Defaulting)",
            isSimulatedEvent: false, creditLoss: 0, equityImpairment: 0, lostReceipts: 0, arCashHit: 0,
            inducedCapexCut: 0, rcfDraw: 0, requiredRevenue: null, fragilityScore: 0, fragilityDrivers: []
          };
          return;
        }

        const p = Object.assign({}, e.defaults || {}, overrides[e.id] || {});
        const begCash = prev.cash !== null && prev.cash !== undefined ? prev.cash : (p.minCash ? p.minCash * 2 : 1.0);
        const begDebt = prev.debt !== null && prev.debt !== undefined ? prev.debt : 0;
        const prevRev = prev.revenue !== null && prev.revenue !== undefined ? prev.revenue : Math.max(0.2, (p.opex || 0.2) * 1.6);
        const undrawn = prev.undrawnCredit !== null && prev.undrawnCredit !== undefined ? prev.undrawnCredit : 0.0;

        // Floating-rate debt share + Ocean base rate wiring (P0-3.3)
        const myDebtTxs = visibleTxs.filter(tx => tx.receiver === e.id && ["Direct Loan","Corporate Bond","Project Finance","GPU-backed Financing","Equipment Financing"].includes(tx.type));
        const floatingPrincipal = myDebtTxs.filter(tx => tx.isFloatingRate).reduce((s, tx) => s + (tx.amountDrawn ?? tx.totalCommitment ?? 0), 0);
        const totalTxPrincipal = myDebtTxs.reduce((s, tx) => s + (tx.amountDrawn ?? tx.totalCommitment ?? 0), 0);
        const floatShare = totalTxPrincipal > 0 ? Math.min(1, floatingPrincipal / totalTxPrincipal) : 0.35;

        const baseFixedRate = p.interestRate ?? 0.06;
        const oceanBaseRate = (ocean.interestRate ?? 7.5) / 100;
        const tightening = (ocean.creditTighteningBps ?? 0) / 10000;
        // Blend fixed debt at baseFixedRate with floating/new debt anchored to ocean.interestRate!
        const effectiveRate = (1 - floatShare) * baseFixedRate + floatShare * Math.max(0.01, oceanBaseRate + tightening);
        const interestPaid = Number(((begDebt * effectiveRate) / 4).toFixed(4));

        // P1-4 Maturity Wall: add maturing principal when debt endQ === q
        const maturingWall = myDebtTxs
          .filter(tx => tx.endQ === q)
          .reduce((s, tx) => s + ((tx.amountDrawn ?? tx.totalCommitment ?? 0) * 0.25), 0);
        const principalRepay = Number(((p.debtRepay ?? 0) + maturingWall).toFixed(4));

        // Case H: GPU Collateral Haircut & LTV Trigger
        const gpuDebtTxs = myDebtTxs.filter(tx => tx.type === "GPU-backed Financing" || tx.type === "Equipment Financing");
        let gpuMarginCall = 0;
        let gpuRefiPenalty = 1.0;
        if (gpuCollateralHaircut > 0 && gpuDebtTxs.length > 0) {
          const baseLtv = 0.65;
          const stressedLtv = baseLtv / Math.max(0.2, 1 - gpuCollateralHaircut);
          if (stressedLtv > 0.85) {
            const gpuDrawn = gpuDebtTxs.reduce((s, tx) => s + (tx.amountDrawn ?? 0), 0);
            gpuMarginCall = Number((gpuDrawn * 0.12 * gpuCollateralHaircut).toFixed(4));
            gpuRefiPenalty = Math.max(0.2, 1 - gpuCollateralHaircut * 1.2);
          }
        }

        const capex = Number((p.capex ?? 0).toFixed(4));
        const grossMargin = Math.max(0.05, Math.min(0.98, p.grossMargin ?? 0.55));
        const cashConv = Math.max(0.3, Math.min(1.0, p.cashConv ?? 0.88));
        const minCash = p.minCash ?? 1.0;

        // Ocean-constrained new financing & scheduled IPO/equity inflows (e.g. Anthropic Nov 2026 $107.3B IPO)
        const availFactor = Math.max(0, Math.min(1, ocean.fundingAvailability / 100));
        const refiFactor = Math.max(0, Math.min(1, (p.refiSuccess ?? 0.85) * (ocean.refiSuccessRate / 100) * gpuRefiPenalty));
        const requestedDebt = (p.newDebt ?? 0) * availFactor * refiFactor;
        const allowedDebt = Number(Math.max(0, Math.min(requestedDebt, Math.max(0, ocean.maxCapacity - oceanUsedThisQ))).toFixed(4));
        oceanUsedThisQ += allowedDebt;

        const scheduledEq = (e.scheduledEquityInflows && e.scheduledEquityInflows[q]) ? e.scheduledEquityInflows[q] : 0;
        const equityInflow = Number((scheduledEq + (p.equityInflow ?? 0) * availFactor).toFixed(4));

        // Revenue Forecast: True Mode A (Contract-Driven) vs Mode B (Previous-Quarter Growth, UNCLAMPED downside!)
        const growthPen = nextQGrowthPenalty[e.id] || 0;
        const rawG = (p.revGrowth ?? 0.05) - (p.revDecel ?? 0.005) * stepIdx + growthPen;
        const clampedG = Math.max(-0.95, rawG); // Unclamped so -50% Case D executes faithfully!

        let projRev;
        if (p.mode === "A") {
          const incomingContractQ = visibleTxs
            .filter(tx => tx.receiver === e.id && ["Cloud Computing Purchase","Take-or-Pay Contract","Data Center Lease","GPU / Server Purchase"].includes(tx.type))
            .reduce((s, tx) => s + (tx.quarterlyPayment || 0), 0);
          const rpoConversion = (prev.rpo || 0) * 0.02;
          const contractAnchor = incomingContractQ > 0 ? Math.max(incomingContractQ, rpoConversion) : prevRev * (1 + clampedG);
          // Mode A blends contracted backlog conversion with organic growth
          projRev = Number((0.55 * contractAnchor + 0.45 * prevRev * (1 + clampedG)).toFixed(4));
        } else {
          projRev = Number((prevRev * (1 + clampedG)).toFixed(4));
        }

        // Calibrated OCF (P0-3.1): zero double-counting of computePay; smooth continuity from Q3 actuals!
        const calib = ocfCalibById[e.id];
        const grossProfitCash = projRev * grossMargin * cashConv;
        let ocf;
        const incrementalCompute = overrides[e.id]?.computePay !== undefined ? Number(overrides[e.id].computePay) : 0;
        if (calib && calib.hasCalib && overrides[e.id]?.opex === undefined) {
          // Calibrated to actual Q3 OCF structure (preserves D&A, SBC, real cash tax rate)
          const fixedOp = calib.impliedFixedOpCash;
          const preTaxDelta = (grossProfitCash - fixedOp - incrementalCompute - interestPaid);
          const incrementalTax = preTaxDelta > (calib.baseRev * grossMargin * cashConv - fixedOp)
            ? (preTaxDelta - (calib.baseRev * grossMargin * cashConv - fixedOp)) * 0.15
            : 0;
          ocf = Number((preTaxDelta - incrementalTax).toFixed(4));
        } else {
          const opex = Number((p.opex ?? 0).toFixed(4));
          const preTax = grossProfitCash - opex - incrementalCompute - interestPaid;
          const taxes = Math.max(0, preTax * 0.18);
          ocf = Number((preTax - taxes).toFixed(4));
        }

        const fcf = Number((ocf - capex).toFixed(4));

        // Required minimum revenue under Mode A
        const totalCashOblig = (p.opex ?? 0) + capex + interestPaid + principalRepay + gpuMarginCall;
        const requiredRev = Math.max(0, (totalCashOblig + minCash - begCash - allowedDebt - equityInflow - undrawn * 0.5) / Math.max(0.1, grossMargin * cashConv));

        // P0-3.2: Exact Accounting Conservation + Automatic RCF Drawdown!
        const preDrawCash = Number((begCash + ocf - capex + allowedDebt + equityInflow - principalRepay - gpuMarginCall).toFixed(4));
        let rcfDraw = 0;
        let endCash = preDrawCash;
        let undrawnAfter = undrawn;
        if (preDrawCash < 0 && undrawn > 0) {
          rcfDraw = Number(Math.min(-preDrawCash, undrawn).toFixed(4));
          endCash = Number((preDrawCash + rcfDraw).toFixed(4));
          undrawnAfter = Number(Math.max(0, undrawn - rcfDraw).toFixed(4));
        }
        const endDebt = Number(Math.max(0, begDebt + allowedDebt + rcfDraw - principalRepay).toFixed(4));

        states[e.id] = {
          quarter: q,
          mode: p.mode || "B",
          revenue: projRev,
          requiredRevenue: Number(requiredRev.toFixed(2)),
          begCash: Number(begCash.toFixed(4)),
          cash: endCash,
          debt: endDebt,
          ocf,
          capex,
          fcf,
          interestExp: interestPaid,
          principalRepay,
          gpuMarginCall,
          computePay: incrementalCompute,
          newDebt: allowedDebt,
          rcfDraw,
          equityInflow,
          undrawnCredit: undrawnAfter,
          rpo: prev.rpo ?? 0,
          ar: prev.ar ?? (e.financials?.["2026Q3"]?.ar ?? null),
          minCash,
          grossMargin,
          cashConv,
          dataType: status === "PARTIAL" ? "Partial / Est." : "Forecast",
          distressLevel: 0,
          distressLabel: "Normal",
          isSimulatedEvent: false,
          creditLoss: 0,
          equityImpairment: 0,
          lostReceipts: 0,
          arCashHit: 0,
          inducedCapexCut: 0
        };
      });

      // Helper: settle cash change cleanly with auto-RCF draw so accounting identity NEVER breaks
      function applyCashDelta(id, ocfDelta, capexDelta = 0) {
        const st = states[id];
        if (!st || isPoolId(id)) return;
        st.ocf = Number((st.ocf + ocfDelta).toFixed(4));
        st.capex = Number(Math.max(0, st.capex + capexDelta).toFixed(4));
        st.fcf = Number((st.ocf - st.capex).toFixed(4));
        const netDelta = ocfDelta - capexDelta;
        let newCash = Number((st.cash + netDelta).toFixed(4));
        if (newCash < 0 && st.undrawnCredit > 0) {
          const extraDraw = Number(Math.min(-newCash, st.undrawnCredit).toFixed(4));
          st.rcfDraw = Number((st.rcfDraw + extraDraw).toFixed(4));
          st.debt = Number((st.debt + extraDraw).toFixed(4));
          st.undrawnCredit = Number(Math.max(0, st.undrawnCredit - extraDraw).toFixed(4));
          newCash = Number((newCash + extraDraw).toFixed(4));
        }
        st.cash = newCash;
      }

      function evaluateDistress(entityId) {
        const e = entityById[entityId];
        const st = states[entityId];
        if (!e || !st || e.isOcean) return;
        // P0-2.3: Managed private funds absorb losses via LP NAV drawdowns — NEVER suffer corporate L3 bankruptcy!
        if (e.lossAbsorbingInvestor) {
          st.distressLevel = st.creditLoss > 5 ? 1 : 0;
          st.distressLabel = st.creditLoss > 5 ? "Level 1: Fund NAV Drawdown" : "Normal";
          st.isSimulatedEvent = false;
          return;
        }
        const mandatoryNextQ = (st.interestExp || 0) + (st.principalRepay || 0);
        const totalLiq = (st.cash || 0) + (st.undrawnCredit || 0);

        if (forcedDefaults.has(entityId) || totalLiq < 0) {
          st.distressLevel = 3;
          st.distressLabel = "Level 3: Simulated Default";
          st.isSimulatedEvent = true;
        } else if (totalLiq < mandatoryNextQ && mandatoryNextQ > 0) {
          st.distressLevel = 2;
          st.distressLabel = "Level 2: Liquidity Crisis";
          st.isSimulatedEvent = true;
        } else if (st.cash < st.minCash) {
          st.distressLevel = 1;
          st.distressLabel = "Level 1: Liquidity Warning";
          st.isSimulatedEvent = false;
        } else {
          st.distressLevel = 0;
          st.distressLabel = "Normal";
          st.isSimulatedEvent = false;
        }
      }

      entities.forEach(e => evaluateDistress(e.id));

      // Step 2B: Multi-Hop Contagion Propagation (P0-1 Channels A1-A4 + P0-2 Deduplicated LGD)
      const contagionLog = [];
      const propagatedDefaults = new Set();
      const propagatedCrisisCuts = new Set();
      const cloudRevLossThisQ = {}; // tracks cloud revenue loss for Channel A3 Induced CapEx Contraction

      for (let hop = 1; hop <= 3; hop++) {
        const newDefaulters = entities
          .map(e => e.id)
          .filter(id => !isPoolId(id) && !entityById[id].lossAbsorbingInvestor && states[id].distressLevel === 3 && !propagatedDefaults.has(id));

        const newCrisisBuyers = entities
          .map(e => e.id)
          .filter(id => !isPoolId(id) && !entityById[id].lossAbsorbingInvestor && states[id].distressLevel === 2 && !propagatedCrisisCuts.has(id));

        if (newDefaulters.length === 0 && newCrisisBuyers.length === 0) break;

        // Channel A1 (L2 Liquidity Crisis -> Defensive CapEx / Hardware Order Cut)
        newCrisisBuyers.forEach(buyerId => {
          propagatedCrisisCuts.add(buyerId);
          visibleTxs.forEach(tx => {
            if (tx.payer === buyerId && tx.type === "GPU / Server Purchase") {
              const supId = tx.receiver;
              if (isPoolId(supId) || !states[supId]) return;
              const qPay = tx.quarterlyPayment || (tx.totalCommitment ? tx.totalCommitment / 16 : 0);
              const cut = Number((qPay * crisisCapExCut).toFixed(4));
              if (cut > 0) {
                const sup = states[supId];
                sup.lostReceipts = Number((sup.lostReceipts + cut).toFixed(4));
                sup.revenue = Number(Math.max(0, sup.revenue - cut).toFixed(4));
                applyCashDelta(supId, -(cut * sup.grossMargin * sup.cashConv), 0);
                evaluateDistress(supId);
                contagionLog.push({ hop, from: buyerId, to: supId, txId: tx.id, channel: `A1: L2 Crisis Hardware Cut (-${Math.round(crisisCapExCut * 100)}%)`, impactB: cut });
              }
            }
          });
        });

        // Level 3 Defaults Propagation
        newDefaulters.forEach(defId => {
          propagatedDefaults.add(defId);

          visibleTxs.forEach(tx => {
            // Channel A1 (Direct Contract / Cloud / Lease / Hardware Payment Cut)
            if (tx.payer === defId && ["Cloud Computing Purchase","Take-or-Pay Contract","Data Center Lease","GPU / Server Purchase"].includes(tx.type)) {
              const supId = tx.receiver;
              if (isPoolId(supId) || !states[supId]) return;
              const qPay = tx.quarterlyPayment || (tx.totalCommitment ? tx.totalCommitment / 20 : 0);
              const loss = Number((qPay * defaultHaircut).toFixed(4));
              if (loss > 0) {
                const sup = states[supId];
                sup.lostReceipts = Number((sup.lostReceipts + loss).toFixed(4));
                sup.revenue = Number(Math.max(0, sup.revenue - loss).toFixed(4));
                applyCashDelta(supId, -(loss * sup.grossMargin * sup.cashConv), 0);
                if (entityById[supId]?.isCloudOrNeocloud) {
                  cloudRevLossThisQ[supId] = (cloudRevLossThisQ[supId] || 0) + loss;
                }
                // Channel A2: One-time AR Bad-Debt Write-Off on Hardware Suppliers
                const arKey = `${defId}->${supId}`;
                if (entityById[supId]?.isHardwareSupplier && !arWrittenOffPairs.has(arKey)) {
                  arWrittenOffPairs.add(arKey);
                  const baseAr = sup.ar || (sup.revenue * 0.45);
                  const share = Math.min(0.25, Math.max(0.03, qPay / Math.max(1, sup.revenue + loss)));
                  const arHit = Number((baseAr * share * lgd).toFixed(4));
                  if (arHit > 0) {
                    sup.arCashHit = Number((sup.arCashHit + arHit).toFixed(4));
                    applyCashDelta(supId, -arHit, 0);
                    contagionLog.push({ hop, from: defId, to: supId, txId: tx.id, channel: `A2: AR Bad-Debt Write-Off`, impactB: arHit });
                  }
                }
                evaluateDistress(supId);
                contagionLog.push({ hop, from: defId, to: supId, txId: tx.id, channel: `A1: ${tx.type} Cut (-${Math.round(defaultHaircut * 100)}%)`, impactB: loss });
              }
            }

            // Channel B: Debt Credit Loss (P0-2 Strictly Deduplicated <= 100% Principal; Non-Cash Impairment!)
            if (tx.receiver === defId && ["Direct Loan","Corporate Bond","Project Finance","GPU-backed Financing","Equipment Financing","Convertible Debt"].includes(tx.type)) {
              const lenderId = tx.payer;
              if (!states[lenderId]) return;
              const principal = (tx.amountDrawn && tx.amountDrawn > 0) ? tx.amountDrawn : (tx.totalCommitment || 0);
              const alreadyLost = cumCreditLossByTx[tx.id] || 0;
              const remainingCap = Math.max(0, principal - alreadyLost);
              const cLoss = Number(Math.min(remainingCap, principal * lgd).toFixed(4));
              if (cLoss > 0) {
                cumCreditLossByTx[tx.id] = Number((alreadyLost + cLoss).toFixed(4));
                states[lenderId].creditLoss = Number((states[lenderId].creditLoss + cLoss).toFixed(4));
                // Non-cash credit impairment recorded on balance sheet; does NOT violently strip 25% cash every quarter
                evaluateDistress(lenderId);
                contagionLog.push({ hop, from: defId, to: lenderId, txId: tx.id, channel: `B: ${tx.type} Credit Loss (One-Time LGD)`, impactB: cLoss });
              }
            }

            // Channel A4 / C: Guarantee Call (One-Time Capped <= 100% Guarantee Amount)
            if (tx.receiver === defId && tx.type === "Loan Guarantee") {
              const guarId = tx.payer;
              if (isPoolId(guarId) || !states[guarId]) return;
              const cap = tx.totalCommitment || 0;
              const alreadyCalled = cumCreditLossByTx[tx.id] || 0;
              const remCap = Math.max(0, cap - alreadyCalled);
              const callAmt = Number(Math.min(remCap, cap * guaranteeCallRate).toFixed(4));
              if (callAmt > 0) {
                cumCreditLossByTx[tx.id] = Number((alreadyCalled + callAmt).toFixed(4));
                states[guarId].creditLoss = Number((states[guarId].creditLoss + callAmt).toFixed(4));
                applyCashDelta(guarId, -callAmt, 0);
                evaluateDistress(guarId);
                contagionLog.push({ hop, from: defId, to: guarId, txId: tx.id, channel: `A4: Guarantee / RVG Cash Call`, impactB: callAmt });
              }
            }

            // Channel A4: Non-Cash Equity Investment Impairment (Strictly Separated from OCF!)
            if (tx.receiver === defId && tx.type === "Equity Investment" && !equityImpairedTxIds.has(tx.id)) {
              const invId = tx.payer;
              if (!isPoolId(invId) && states[invId]) {
                const eqAmt = (tx.amountDrawn && tx.amountDrawn > 0) ? tx.amountDrawn : (tx.totalCommitment || 0);
                if (eqAmt > 0) {
                  equityImpairedTxIds.add(tx.id);
                  const imp = Number((eqAmt * 0.80).toFixed(4));
                  states[invId].equityImpairment = Number((states[invId].equityImpairment + imp).toFixed(4));
                  contagionLog.push({ hop, from: defId, to: invId, txId: tx.id, channel: `A4: Non-Cash Equity Impairment`, impactB: imp });
                }
              }
            }
          });
        });

        // Channel A3: Induced CapEx Contraction (Cloud/Neocloud Lost Cloud Rev -> Dynamic CapEx Cut -> Upstream Chip/Hardware Demand Shock + AR Deterioration + Next-Qtr Growth Suppression!)
        const totalInducedCapexCut = Object.entries(cloudRevLossThisQ).reduce((acc, [cloudId, lostRev]) => {
          const cst = states[cloudId];
          if (!cst || lostRev <= 0 || cst.inducedCapexCut > 0) return acc;
          const cut = Number(Math.min(cst.capex * maxCapexCutShare, lostRev * capexElasticity).toFixed(4));
          if (cut > 0) {
            cst.inducedCapexCut = cut;
            // Cloud provider saves CapEx cash!
            applyCashDelta(cloudId, 0, -cut);
            evaluateDistress(cloudId);
            return acc + cut;
          }
          return acc;
        }, 0);

        if (totalInducedCapexCut > 0) {
          const totalHardwareDemandShock = Number((totalInducedCapexCut * gpuShareOfAiCapex).toFixed(4));
          entities.filter(e => e.isHardwareSupplier && e.hardwareSupplyShare > 0).forEach(hw => {
            const hst = states[hw.id];
            if (!hst) return;
            const revHit = Number((totalHardwareDemandShock * hw.hardwareSupplyShare).toFixed(4));
            if (revHit > 0) {
              const prevHwRev = Math.max(1, hst.revenue);
              hst.lostReceipts = Number((hst.lostReceipts + revHit).toFixed(4));
              hst.revenue = Number(Math.max(0, hst.revenue - revHit).toFixed(4));
              applyCashDelta(hw.id, -(revHit * hst.grossMargin * hst.cashConv), 0);

              // Channel A2 indirect AR deterioration on NVDA/hardware when systemic cloud demand contracts
              const sysArKey = `SYSTEMIC_A3_${q}->${hw.id}`;
              if (hst.ar && !arWrittenOffPairs.has(sysArKey) && revHit / prevHwRev >= 0.03) {
                arWrittenOffPairs.add(sysArKey);
                const arHit = Number((hst.ar * Math.min(0.20, (revHit / prevHwRev) * 0.8) * lgd).toFixed(4));
                if (arHit > 0) {
                  hst.arCashHit = Number((hst.arCashHit + arHit).toFixed(4));
                  applyCashDelta(hw.id, -arHit, 0);
                  contagionLog.push({ hop: Math.min(3, hop + 1), from: "CLOUD_CAPEX_CUT", to: hw.id, txId: "A2_SYS", channel: `A2: Systemic AR Deterioration`, impactB: arHit });
                }
              }

              // Suppress next-quarter revGrowth so NVDA doesn't blindly compound +8%/qtr during an AI CapEx bust
              const pctHit = revHit / prevHwRev;
              nextQGrowthPenalty[hw.id] = Math.max(-0.45, (nextQGrowthPenalty[hw.id] || 0) - pctHit * 1.1);

              evaluateDistress(hw.id);
              contagionLog.push({ hop: Math.min(3, hop + 1), from: "CLOUD_CAPEX_CUT", to: hw.id, txId: "A3_CAPEX", channel: `A3: Induced Cloud CapEx Cut`, impactB: revHit });
            }
          });
        }
      }

      // Compute final objective fragility scores for quarter q
      entities.forEach(e => {
        const frag = computeFragilityScore(e, states[e.id], ocean, visibleTxs);
        states[e.id].fragilityScore = frag.score;
        states[e.id].fragilityDrivers = frag.drivers;
      });

      timeline[q] = { quarter: q, status, entities: states, contagionLog };
      prevStates = states;
    });

    return { timeline, allQuarters: ALL_QUARTERS, cumCreditLossByTx };
  }

  return {
    QUARTERS_HIST,
    QUARTER_PARTIAL,
    QUARTERS_FORECAST,
    ALL_QUARTERS,
    quarterEndDate,
    quarterStatus,
    getVisibleTransactions,
    analyzeConnectivity,
    getEdgeVisual,
    computeFragilityScore,
    computeEntityMetrics,
    runSimulation
  };
});
