/**
 * AI Credit Network — Audit 2.0 Remediated Cash Flow, Supply Chain & 4-Layer Contagion Engine (v3.0)
 * Remediations implemented on branch audit-remediation-v3:
 * - P0-1: True One-Time LGD & Guarantee Deduplication via defaultedTxIds (45% LGD stays 45%, never 100%)
 * - P0-2: Layer 3 Operational Dependency Contagion (Supplier Default -> Downstream Customer Switching Cost & Disruption)
 * - P0-3: Decaying nextQGrowthPenalty (50%/qtr), A1/A3 CapEx Cut Deduplication, AR Balance Decrement, 100% Maturity Wall w/ Refi Rollover
 * - P0-4: Insufficient-Data Non-Simulation Guard (eliminates 11 false Base Case L3 defaults) + Consolidated SPV Double-Count Prevention
 * - P1: Dynamic Multi-Hop Convergence (up to 5 hops) + Explicit 4-Layer Tagging (L1 Financial, L2 Commercial, L3 Operational, L4 Secondary)
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

  function getVisibleTransactions(transactions, quarter, layerFilter = null) {
    const endDate = quarterEndDate(quarter);
    const isForecast = quarterStatus(quarter) === "FORECAST";
    return transactions.filter(tx => {
      if (layerFilter && layerFilter !== "ALL" && tx.networkLayer && tx.networkLayer !== layerFilter) {
        return false;
      }
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

  function computeFragilityScore(entity, st, ocean, entityTxs = []) {
    if (!entity || entity.isOcean || entity.lossAbsorbingInvestor || st.insufficientData) return { score: 0, drivers: [] };
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

  function runSimulation(entities, transactions, options = {}) {
    const ocean = Object.assign({
      fundingAvailability: 100,
      interestRate: 7.5,
      refiSuccessRate: 85,
      maxCapacity: 250,
      creditTighteningBps: 0
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
    const gpuCollateralHaircut = options.gpuCollateralHaircut ?? 0.0;
    const pointInTimeBacktest = Boolean(options.pointInTimeBacktest);

    const entityById = Object.fromEntries(entities.map(e => [e.id, e]));
    const timeline = {};

    // Global cross-quarter deduplication trackers (TRUE one-time default firing!)
    const defaultedTxIds = new Set();        // P0-1: guarantees each defaulted debt/guarantee fires ONCE
    const cumCreditLossByTx = {};
    const arWrittenOffPairs = new Set();
    const systemicArHitEntities = new Set(); // P0-3: one-time systemic AR shock per hardware supplier
    const equityImpairedTxIds = new Set();
    const operationalMigPairs = new Set();   // P0-2: one-time migration cost per supplier->customer pair
    const operationalStartQ = {};            // tracks quarter when supplier operational outage began
    const nextQGrowthPenalty = {};           // P0-3: decays 50% each quarter!

    // Pre-compute historical baseline OCF calibration & insufficient-data flags
    const ocfCalibById = {};
    const hasCoreFinancials = {};
    entities.forEach(e => {
      const q3 = e.financials && e.financials["2026Q3"];
      const p = e.defaults || {};
      const hasCashAndRev = Boolean(q3 && q3.cash !== null && q3.cash !== undefined && q3.revenue !== null && q3.revenue !== undefined);
      hasCoreFinancials[e.id] = hasCashAndRev;
      if (q3 && q3.ocf !== null && q3.ocf !== undefined && q3.revenue !== null && q3.revenue !== undefined) {
        const gm = Math.max(0.05, Math.min(0.98, p.grossMargin ?? 0.55));
        const cc = Math.max(0.3, Math.min(1.0, p.cashConv ?? 0.88));
        const q3Int = q3.interestExp ?? 0;
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
          hasActual: false, isSimulatedEvent: false, distressLevel: 0,
          insufficientData: !entity.isOcean && !entity.lossAbsorbingInvestor
        };
      }
      return Object.assign({ quarter: q, hasActual: false, isSimulatedEvent: false, distressLevel: 0 }, best, { dataType: best.dataType || "Estimated" });
    }

    // 1. Historical Quarters
    QUARTERS_HIST.forEach(q => {
      const visTxs = getVisibleTransactions(transactions, q);
      const states = {};
      entities.forEach(e => {
        const snap = getHistoricalSnapshot(e, q);
        snap.distressLevel = 0;
        snap.distressLabel = e.isOcean ? "External Pool (Non-Defaulting)" : (snap.insufficientData ? "Insufficient Data" : "Normal");
        snap.creditLoss = 0;
        snap.equityImpairment = 0;
        snap.lostReceipts = 0;
        snap.arCashHit = 0;
        snap.operationalCostHit = 0;
        snap.operationalRevDelay = 0;
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

    // 2. Forward Simulation
    const forwardQs = [QUARTER_PARTIAL, ...QUARTERS_FORECAST];
    let prevStates = timeline["2026Q3"].entities;

    forwardQs.forEach((q, stepIdx) => {
      const status = quarterStatus(q);
      const visibleTxs = getVisibleTransactions(transactions, q);
      const states = {};
      let oceanUsedThisQ = 0;

      // Decay prior growth penalties by 50% each quarter so shocks don't permanently zero out revenue
      Object.keys(nextQGrowthPenalty).forEach(id => {
        nextQGrowthPenalty[id] = Number((nextQGrowthPenalty[id] * 0.5).toFixed(4));
        if (Math.abs(nextQGrowthPenalty[id]) < 0.002) nextQGrowthPenalty[id] = 0;
      });

      // Step 2A: Standalone Quarterly Cash Flow Projection
      entities.forEach(e => {
        const prev = prevStates[e.id] || {};
        if (e.isOcean) {
          states[e.id] = {
            quarter: q, revenue: null, cash: ocean.maxCapacity, debt: 0, ocf: null, capex: 0, fcf: null,
            rpo: 0, interestExp: 0, undrawnCredit: ocean.maxCapacity,
            dataType: "System Pool", distressLevel: 0, distressLabel: "External Pool (Non-Defaulting)",
            isSimulatedEvent: false, creditLoss: 0, equityImpairment: 0, lostReceipts: 0, arCashHit: 0,
            operationalCostHit: 0, operationalRevDelay: 0, inducedCapexCut: 0, rcfDraw: 0,
            requiredRevenue: null, fragilityScore: 0, fragilityDrivers: []
          };
          return;
        }

        // P0-4: Entities without disclosed cash/revenue (e.g. private CRUSOE/LAMBDA/VANTAGE/QTS/AIRTRUNK)
        // are NOT fabricated into synthetic L3 bankruptcies in Base Case unless explicitly forced to default!
        const isInsufficient = !e.lossAbsorbingInvestor && !hasCoreFinancials[e.id] && !overrides[e.id];
        if (isInsufficient) {
          const forced = forcedDefaults.has(e.id);
          states[e.id] = {
            quarter: q, mode: "N/A", revenue: null, requiredRevenue: null,
            begCash: null, cash: null, debt: prev.debt ?? null, ocf: null, capex: null, fcf: null,
            interestExp: prev.interestExp ?? null, principalRepay: 0, gpuMarginCall: 0, computePay: 0,
            newDebt: 0, rcfDraw: 0, equityInflow: 0, undrawnCredit: prev.undrawnCredit ?? 0,
            rpo: prev.rpo ?? null, ar: null, minCash: 0, grossMargin: 0.5, cashConv: 0.85,
            dataType: "Unavailable", insufficientData: true,
            distressLevel: forced ? 3 : 0,
            distressLabel: forced ? "Level 3: Forced Simulated Default" : "Insufficient Data (Non-Simulated)",
            isSimulatedEvent: forced,
            creditLoss: 0, equityImpairment: 0, lostReceipts: 0, arCashHit: 0,
            operationalCostHit: 0, operationalRevDelay: 0, inducedCapexCut: 0,
            fragilityScore: 0, fragilityDrivers: []
          };
          return;
        }

        const p = Object.assign({}, e.defaults || {}, overrides[e.id] || {});
        const begCash = prev.cash !== null && prev.cash !== undefined ? prev.cash : (p.minCash ? p.minCash * 2 : 1.0);
        const begDebt = prev.debt !== null && prev.debt !== undefined ? prev.debt : 0;
        const prevRev = prev.revenue !== null && prev.revenue !== undefined ? prev.revenue : Math.max(0.2, (p.opex || 0.2) * 1.6);
        const undrawn = prev.undrawnCredit !== null && prev.undrawnCredit !== undefined ? prev.undrawnCredit : 0.0;

        // Floating-rate debt share + Ocean base rate wiring
        const myDebtTxs = visibleTxs.filter(tx => tx.receiver === e.id && ["Direct Loan","Corporate Bond","Project Finance","GPU-backed Financing","Equipment Financing"].includes(tx.type));
        const floatingPrincipal = myDebtTxs.filter(tx => tx.isFloatingRate).reduce((s, tx) => s + (tx.amountDrawn ?? tx.totalCommitment ?? 0), 0);
        const totalTxPrincipal = myDebtTxs.reduce((s, tx) => s + (tx.amountDrawn ?? tx.totalCommitment ?? 0), 0);
        const floatShare = totalTxPrincipal > 0 ? Math.min(1, floatingPrincipal / totalTxPrincipal) : 0.35;

        const baseFixedRate = p.interestRate ?? 0.06;
        const oceanBaseRate = (ocean.interestRate ?? 7.5) / 100;
        const tightening = (ocean.creditTighteningBps ?? 0) / 10000;
        const effectiveRate = (1 - floatShare) * baseFixedRate + floatShare * Math.max(0.01, oceanBaseRate + tightening);
        const interestPaid = Number(((begDebt * effectiveRate) / 4).toFixed(4));

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

        const availFactor = Math.max(0, Math.min(1, ocean.fundingAvailability / 100));
        const refiFactor = Math.max(0, Math.min(1, (p.refiSuccess ?? 0.85) * (ocean.refiSuccessRate / 100) * gpuRefiPenalty));

        // P1-4 True 100% Maturity Wall with Refinancing Rollover
        const maturingPrincipal = myDebtTxs
          .filter(tx => tx.endQ === q)
          .reduce((s, tx) => s + Math.max(0, (tx.amountDrawn ?? tx.totalCommitment ?? 0) - (tx.amountRepaid ?? 0)), 0);
        const refiRollover = Number((maturingPrincipal * availFactor * refiFactor).toFixed(4));
        const principalRepay = Number(((p.debtRepay ?? 0) + maturingPrincipal).toFixed(4));

        const requestedDebt = (p.newDebt ?? 0) * availFactor * refiFactor + refiRollover;
        const allowedDebt = Number(Math.max(0, Math.min(requestedDebt, Math.max(0, ocean.maxCapacity - oceanUsedThisQ))).toFixed(4));
        oceanUsedThisQ += allowedDebt;

        const scheduledEq = (e.scheduledEquityInflows && e.scheduledEquityInflows[q]) ? e.scheduledEquityInflows[q] : 0;
        const equityInflow = Number((scheduledEq + (p.equityInflow ?? 0) * availFactor).toFixed(4));

        const capex = Number((p.capex ?? 0).toFixed(4));
        const grossMargin = Math.max(0.05, Math.min(0.98, p.grossMargin ?? 0.55));
        const cashConv = Math.max(0.3, Math.min(1.0, p.cashConv ?? 0.88));
        const minCash = p.minCash ?? 1.0;

        // Revenue Forecast: Mode A (Contract-Driven) vs Mode B (Unclamped Downside Growth)
        const growthPen = nextQGrowthPenalty[e.id] || 0;
        const rawG = (p.revGrowth ?? 0.05) - (p.revDecel ?? 0.005) * stepIdx + growthPen;
        const boundedG = Math.max(-0.85, rawG); // allows -50% Case D faithfully without negative rev

        let projRev;
        if (p.mode === "A") {
          const incomingContractQ = visibleTxs
            .filter(tx => tx.receiver === e.id && ["Cloud Computing Purchase","Take-or-Pay Contract","Data Center Lease","GPU / Server Purchase"].includes(tx.type))
            .reduce((s, tx) => s + (tx.quarterlyPayment || 0), 0);
          const rpoConversion = (prev.rpo || 0) * 0.02;
          const contractAnchor = incomingContractQ > 0 ? Math.max(incomingContractQ, rpoConversion) : prevRev * (1 + boundedG);
          projRev = Number(Math.max(0, 0.55 * contractAnchor + 0.45 * prevRev * (1 + boundedG)).toFixed(4));
        } else {
          projRev = Number(Math.max(0, prevRev * (1 + boundedG)).toFixed(4));
        }

        // Calibrated OCF (zero double-deduction, smooth Q3->Q4 continuity)
        const calib = ocfCalibById[e.id];
        const grossProfitCash = projRev * grossMargin * cashConv;
        let ocf;
        const incrementalCompute = overrides[e.id]?.computePay !== undefined ? Number(overrides[e.id].computePay) : 0;
        if (calib && calib.hasCalib && overrides[e.id]?.opex === undefined) {
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
        const totalCashOblig = (p.opex ?? 0) + capex + interestPaid + principalRepay + gpuMarginCall;
        const requiredRev = Math.max(0, (totalCashOblig + minCash - begCash - allowedDebt - equityInflow - undrawn * 0.5) / Math.max(0.1, grossMargin * cashConv));

        // Exact Accounting Conservation + Auto-RCF Drawdown
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
          ar: prev.ar !== undefined ? prev.ar : (e.financials?.["2026Q3"]?.ar ?? null),
          minCash,
          grossMargin,
          cashConv,
          dataType: status === "PARTIAL" ? "Partial / Est." : "Forecast",
          insufficientData: false,
          distressLevel: 0,
          distressLabel: "Normal",
          isSimulatedEvent: false,
          creditLoss: 0,
          equityImpairment: 0,
          lostReceipts: 0,
          arCashHit: 0,
          operationalCostHit: 0,
          operationalRevDelay: 0,
          inducedCapexCut: 0
        };
      });

      function applyCashDelta(id, ocfDelta, capexDelta = 0) {
        const st = states[id];
        if (!st || isPoolId(id) || st.insufficientData) return;
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
        if (!e || !st || e.isOcean || st.insufficientData) return;
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

      // Step 2B: Dynamic Multi-Hop 4-Layer Contagion (up to 5 hops until convergence)
      const contagionLog = [];
      const propagatedDefaults = new Set();
      const propagatedCrisisCuts = new Set();
      const cloudRevLossThisQ = {};
      const directHwCutByCloudThisQ = {}; // P0-3: prevents A1 + A3 double-counting

      for (let hop = 1; hop <= 5; hop++) {
        const newDefaulters = entities
          .map(e => e.id)
          .filter(id => !isPoolId(id) && !entityById[id].lossAbsorbingInvestor && states[id].distressLevel === 3 && !propagatedDefaults.has(id));

        const newCrisisBuyers = entities
          .map(e => e.id)
          .filter(id => !isPoolId(id) && !entityById[id].lossAbsorbingInvestor && states[id].distressLevel === 2 && !propagatedCrisisCuts.has(id));

        if (newDefaulters.length === 0 && newCrisisBuyers.length === 0) break;

        // Layer 2 (Commercial): L2 Crisis Defensive Hardware Cut
        newCrisisBuyers.forEach(buyerId => {
          propagatedCrisisCuts.add(buyerId);
          visibleTxs.forEach(tx => {
            if (tx.payer === buyerId && tx.type === "GPU / Server Purchase") {
              const supId = tx.receiver;
              if (isPoolId(supId) || !states[supId] || states[supId].insufficientData) return;
              const qPay = tx.quarterlyPayment || (tx.totalCommitment ? tx.totalCommitment / 16 : 0);
              const cut = Number((qPay * crisisCapExCut).toFixed(4));
              if (cut > 0) {
                const sup = states[supId];
                sup.lostReceipts = Number((sup.lostReceipts + cut).toFixed(4));
                sup.revenue = Number(Math.max(0, sup.revenue - cut).toFixed(4));
                applyCashDelta(supId, -(cut * sup.grossMargin * sup.cashConv), 0);
                directHwCutByCloudThisQ[buyerId] = (directHwCutByCloudThisQ[buyerId] || 0) + cut;
                evaluateDistress(supId);
                contagionLog.push({ hop, layer: "L2_COMMERCIAL", from: buyerId, to: supId, txId: tx.id, channel: `L2 Commercial: Crisis Hardware Cut (-${Math.round(crisisCapExCut * 100)}%)`, impactB: cut });
              }
            }
          });
        });

        // Level 3 Defaults across Layers 1, 2, and 3
        newDefaulters.forEach(defId => {
          propagatedDefaults.add(defId);
          if (operationalStartQ[defId] === undefined) operationalStartQ[defId] = stepIdx;

          visibleTxs.forEach(tx => {
            // Layer 2 (Commercial) + Layer 1 (AR Bad-Debt): Defaulter is PAYER (Customer Defaults -> Supplier Loses Revenue & AR)
            if (tx.payer === defId && ["Cloud Computing Purchase","Take-or-Pay Contract","Data Center Lease","GPU / Server Purchase","Power Purchase Agreement"].includes(tx.type)) {
              const supId = tx.receiver;
              if (isPoolId(supId) || !states[supId] || states[supId].insufficientData) return;
              const qPay = tx.quarterlyPayment || (tx.totalCommitment ? tx.totalCommitment / 20 : 0);
              const sup = states[supId];
              const supBaseRev = (entityById[supId]?.financials?.["2026Q3"]?.revenue) || (sup.revenue + 1);
              const macroScale = Math.min(1.0, Math.max(0.25, sup.revenue / Math.max(1, supBaseRev)));
              const loss = Number(Math.min(sup.revenue * 0.45, qPay * defaultHaircut * macroScale).toFixed(4));
              if (loss > 0) {
                sup.lostReceipts = Number((sup.lostReceipts + loss).toFixed(4));
                sup.revenue = Number(Math.max(0, sup.revenue - loss).toFixed(4));
                applyCashDelta(supId, -(loss * sup.grossMargin * sup.cashConv), 0);
                if (entityById[supId]?.isCloudOrNeocloud) {
                  cloudRevLossThisQ[supId] = (cloudRevLossThisQ[supId] || 0) + loss;
                }
                if (tx.type === "GPU / Server Purchase") {
                  directHwCutByCloudThisQ[defId] = (directHwCutByCloudThisQ[defId] || 0) + loss;
                }
                // Layer 1 (Direct Financial): One-Time AR Bad-Debt Write-Off with AR balance decrement
                const arKey = `${defId}->${supId}`;
                if (entityById[supId]?.isHardwareSupplier && !arWrittenOffPairs.has(arKey)) {
                  arWrittenOffPairs.add(arKey);
                  const baseAr = sup.ar || (sup.revenue * 0.45);
                  const share = Math.min(0.25, Math.max(0.03, qPay / Math.max(1, sup.revenue + loss)));
                  const arHit = Number((baseAr * share * lgd).toFixed(4));
                  if (arHit > 0) {
                    sup.arCashHit = Number((sup.arCashHit + arHit).toFixed(4));
                    if (sup.ar !== null) sup.ar = Number(Math.max(0, sup.ar - arHit).toFixed(4));
                    applyCashDelta(supId, -arHit, 0);
                    contagionLog.push({ hop, layer: "L1_FINANCIAL", from: defId, to: supId, txId: tx.id, channel: `L1 Direct Financial: AR Bad-Debt Write-Off`, impactB: arHit });
                  }
                }
                evaluateDistress(supId);
                contagionLog.push({ hop, layer: "L2_COMMERCIAL", from: defId, to: supId, txId: tx.id, channel: `L2 Commercial: ${tx.type} Cut (-${Math.round(defaultHaircut * 100)}%)`, impactB: loss });
              }
            }

            // P0-2 Layer 3 (Operational Impact): Defaulter is RECEIVER (Supplier/DC/Power Defaults -> Downstream Customer Disruption & Switching Cost!)
            if (tx.receiver === defId && ["Cloud Computing Purchase","Take-or-Pay Contract","Data Center Lease","Power Purchase Agreement"].includes(tx.type)) {
              const custId = tx.payer;
              if (isPoolId(custId) || !states[custId] || states[custId].insufficientData) return;
              const cust = states[custId];
              const qPay = tx.quarterlyPayment || (tx.totalCommitment ? tx.totalCommitment / 20 : 0);
              const subAvail = tx.substitutionAvailability ?? 0.65; // 0 = no substitute, 1 = seamless
              const switchWks = tx.switchingTimeWeeks ?? 8;
              const costPrem = tx.replacementCostPremium ?? 0.28;
              const friction = Math.max(0.05, 1 - subAvail);

              // One-time migration / switching cost cash outflow
              const migKey = `${defId}->${custId}:${tx.id}`;
              if (qPay > 0 && !operationalMigPairs.has(migKey)) {
                operationalMigPairs.add(migKey);
                const migCost = Number((qPay * costPrem * friction).toFixed(4));
                if (migCost > 0) {
                  cust.operationalCostHit = Number((cust.operationalCostHit + migCost).toFixed(4));
                  applyCashDelta(custId, -migCost, 0);
                  contagionLog.push({ hop, layer: "L3_OPERATIONAL", from: defId, to: custId, txId: tx.id, channel: `L3 Operational: Compute/Infra Migration Cost (Sub ${Math.round(subAvail * 100)}%)`, impactB: migCost });
                }
              }

              // Temporary revenue/service delay during switching window (decays over 2 quarters)
              const quartersElapsed = stepIdx - operationalStartQ[defId];
              const switchQuarters = Math.max(1, Math.ceil(switchWks / 13));
              if (qPay > 0 && quartersElapsed < switchQuarters) {
                const decay = Math.pow(0.5, quartersElapsed);
                const revDelay = Number((qPay * Math.min(1, switchWks / 13) * friction * 0.45 * decay).toFixed(4));
                if (revDelay > 0) {
                  cust.operationalRevDelay = Number((cust.operationalRevDelay + revDelay).toFixed(4));
                  cust.revenue = Number(Math.max(0, cust.revenue - revDelay).toFixed(4));
                  applyCashDelta(custId, -(revDelay * cust.grossMargin * cust.cashConv), 0);
                  contagionLog.push({ hop, layer: "L3_OPERATIONAL", from: defId, to: custId, txId: tx.id, channel: `L3 Operational: Service Disruption (${switchWks}w switch)`, impactB: revDelay });
                }
              }
              evaluateDistress(custId);
            }

            // P0-1 Layer 1 (Direct Financial): TRUE ONE-TIME Debt Credit Loss (fires ONCE per tx.id!)
            if (tx.receiver === defId && ["Direct Loan","Corporate Bond","Project Finance","GPU-backed Financing","Equipment Financing","Convertible Debt"].includes(tx.type)) {
              if (defaultedTxIds.has(tx.id)) return;
              const lenderId = tx.payer;
              if (!states[lenderId]) return;
              const principal = (tx.amountDrawn && tx.amountDrawn > 0) ? tx.amountDrawn : (tx.totalCommitment || 0);
              const cLoss = Number((principal * lgd).toFixed(4));
              if (cLoss > 0) {
                defaultedTxIds.add(tx.id);
                cumCreditLossByTx[tx.id] = cLoss;
                states[lenderId].creditLoss = Number((states[lenderId].creditLoss + cLoss).toFixed(4));
                evaluateDistress(lenderId);
                contagionLog.push({ hop, layer: "L1_FINANCIAL", from: defId, to: lenderId, txId: tx.id, channel: `L1 Direct Financial: ${tx.type} Credit Loss (One-Time ${Math.round(lgd * 100)}% LGD)`, impactB: cLoss });
              }
            }

            // P0-1 Layer 1 (Direct Financial): TRUE ONE-TIME Guarantee Call (fires ONCE per tx.id!)
            if (tx.receiver === defId && tx.type === "Loan Guarantee") {
              if (defaultedTxIds.has(tx.id)) return;
              const guarId = tx.payer;
              if (isPoolId(guarId) || !states[guarId] || states[guarId].insufficientData) return;
              const cap = tx.totalCommitment || 0;
              const callAmt = Number((cap * guaranteeCallRate).toFixed(4));
              if (callAmt > 0) {
                defaultedTxIds.add(tx.id);
                cumCreditLossByTx[tx.id] = callAmt;
                states[guarId].creditLoss = Number((states[guarId].creditLoss + callAmt).toFixed(4));
                applyCashDelta(guarId, -callAmt, 0);
                evaluateDistress(guarId);
                contagionLog.push({ hop, layer: "L1_FINANCIAL", from: defId, to: guarId, txId: tx.id, channel: `L1 Direct Financial: Guarantee / RVG Cash Call (One-Time ${Math.round(guaranteeCallRate * 100)}%)`, impactB: callAmt });
              }
            }

            // Layer 1 (Direct Financial): Non-Cash Equity Impairment (One-Time)
            if (tx.receiver === defId && tx.type === "Equity Investment" && !equityImpairedTxIds.has(tx.id)) {
              const invId = tx.payer;
              if (!isPoolId(invId) && states[invId]) {
                const eqAmt = (tx.amountDrawn && tx.amountDrawn > 0) ? tx.amountDrawn : (tx.totalCommitment || 0);
                if (eqAmt > 0) {
                  equityImpairedTxIds.add(tx.id);
                  const imp = Number((eqAmt * 0.80).toFixed(4));
                  states[invId].equityImpairment = Number((states[invId].equityImpairment + imp).toFixed(4));
                  contagionLog.push({ hop, layer: "L1_FINANCIAL", from: defId, to: invId, txId: tx.id, channel: `L1 Direct Financial: Non-Cash Equity Impairment`, impactB: imp });
                }
              }
            }
          });
        });

        // Layer 2 (Commercial): Deduplicated Induced Cloud CapEx Contraction -> Upstream Hardware Demand Shock
        const netIncrementalHwShock = Object.entries(cloudRevLossThisQ).reduce((acc, [cloudId, lostRev]) => {
          const cst = states[cloudId];
          if (!cst || cst.insufficientData || lostRev <= 0 || cst.inducedCapexCut > 0) return acc;
          const cut = Number(Math.min(cst.capex * maxCapexCutShare, lostRev * capexElasticity).toFixed(4));
          if (cut > 0) {
            cst.inducedCapexCut = cut;
            applyCashDelta(cloudId, 0, -cut);
            evaluateDistress(cloudId);
            // P0-3: Subtract hardware cuts already directly transmitted via A1 to prevent double-counting!
            const rawHwPortion = cut * gpuShareOfAiCapex;
            const alreadyDirect = directHwCutByCloudThisQ[cloudId] || 0;
            const netHw = Math.max(0, rawHwPortion - alreadyDirect);
            return acc + netHw;
          }
          return acc;
        }, 0);

        if (netIncrementalHwShock > 0) {
          entities.filter(e => e.isHardwareSupplier && e.hardwareSupplyShare > 0).forEach(hw => {
            const hst = states[hw.id];
            if (!hst || hst.insufficientData) return;
            const revHit = Number((netIncrementalHwShock * hw.hardwareSupplyShare).toFixed(4));
            if (revHit > 0) {
              const prevHwRev = Math.max(1, hst.revenue);
              hst.lostReceipts = Number((hst.lostReceipts + revHit).toFixed(4));
              hst.revenue = Number(Math.max(0, hst.revenue - revHit).toFixed(4));
              applyCashDelta(hw.id, -(revHit * hst.grossMargin * hst.cashConv), 0);

              // One-time systemic AR deterioration with AR balance decrement
              if (hst.ar && !systemicArHitEntities.has(hw.id) && revHit / prevHwRev >= 0.025) {
                systemicArHitEntities.add(hw.id);
                const arHit = Number((hst.ar * Math.min(0.18, (revHit / prevHwRev) * 0.75) * lgd).toFixed(4));
                if (arHit > 0) {
                  hst.arCashHit = Number((hst.arCashHit + arHit).toFixed(4));
                  hst.ar = Number(Math.max(0, hst.ar - arHit).toFixed(4));
                  applyCashDelta(hw.id, -arHit, 0);
                  contagionLog.push({ hop: Math.min(5, hop + 1), layer: "L1_FINANCIAL", from: "CLOUD_CAPEX_CUT", to: hw.id, txId: "A2_SYS", channel: `L1 Direct Financial: Systemic AR Deterioration (One-Time)`, impactB: arHit });
                }
              }

              // Bounded, decaying growth suppression (capped at -25% penalty, decays 50%/qtr!)
              const pctHit = revHit / prevHwRev;
              nextQGrowthPenalty[hw.id] = Math.max(-0.25, (nextQGrowthPenalty[hw.id] || 0) - pctHit * 0.85);

              evaluateDistress(hw.id);
              contagionLog.push({ hop: Math.min(5, hop + 1), layer: "L2_COMMERCIAL", from: "CLOUD_CAPEX_CUT", to: hw.id, txId: "A3_CAPEX", channel: `L2 Commercial: Induced Cloud CapEx Cut (Net of A1)`, impactB: revHit });
            }
          });
        }
      }

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
