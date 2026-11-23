/**
 * AI Credit Network — Cash Flow Forecasting, Stress Testing & Multi-Hop Contagion Engine
 * Works identically in browser (window.AICreditEngine) and Node.js (module.exports).
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

  /**
   * Anti-lookahead filter: only transactions announced on or before quarterEndDate(q)
   * are visible in historical/partial quarters.
   */
  function compareQuarter(a, b) {
    if (!a || !b) return 0;
    return a.localeCompare(b);
  }

  /**
   * Time-aware active relationship filter:
   * 1. Historical quarters: must be announced on/before quarterEndDate(quarter) (no lookahead).
   * 2. Must still be active/outstanding in `quarter`:
   *    - Equity investments persist as ongoing capital stakes from announced/startQ onward.
   *    - Debt, bonds, loans, leases, guarantees & long-term contracts remain active while
   *      unmatured (quarter <= endQ) or while remaining commitment / unpaid principal > 0.
   *    - Matured transactions with zero remaining obligation drop off after endQ.
   */
  function getVisibleTransactions(transactions, quarter) {
    const endDate = quarterEndDate(quarter);
    const isForecast = quarterStatus(quarter) === "FORECAST";
    return transactions.filter(tx => {
      if (!isForecast && tx.announcedDate && tx.announcedDate > endDate) {
        return false;
      }
      if (tx.type === "Equity Investment") {
        return true;
      }
      // For debt/contracts/leases/guarantees: exclude if already matured with zero remaining obligation
      if (tx.endQ && compareQuarter(quarter, tx.endQ) > 0) {
        const rem = tx.remainingCommitment ?? 0;
        const unpaid = (tx.amountDrawn ?? 0) - (tx.amountRepaid ?? 0);
        if (rem <= 0 && unpaid <= 0) return false;
      }
      return true;
    });
  }

  /**
   * Computes Connected Components over non-Ocean entities using active edges,
   * and strictly separates connected entities from unconnected (degree-0) entities.
   */
  function analyzeConnectivity(entities, activeTxs) {
    const nonOcean = entities.filter(e => !e.isOcean);
    const degree = {};
    const adj = {};
    nonOcean.forEach(e => { degree[e.id] = 0; adj[e.id] = new Set(); });

    activeTxs.forEach(tx => {
      if (degree[tx.payer] !== undefined) degree[tx.payer]++;
      if (degree[tx.receiver] !== undefined) degree[tx.receiver]++;
      if (adj[tx.payer] && adj[tx.receiver] && tx.payer !== "PRIVATE_CREDIT_OCEAN" && tx.receiver !== "PRIVATE_CREDIT_OCEAN") {
        adj[tx.payer].add(tx.receiver);
        adj[tx.receiver].add(tx.payer);
      }
    });

    // Only entities with >= 1 active verified link to another company/SPV/known fund enter the main network
    // (Entities linked ONLY to Private Credit Ocean move to Unconnected Entities)
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

  /**
   * Strict visual semantics: Red = Cash Outflow, Green = Cash Inflow.
   * Flips perspective when receiver vs payer is selected.
   */
  function getEdgeVisual(tx, selectedNodeId, quarter) {
    const isForecastQ = quarterStatus(quarter) === "FORECAST";
    let color = "url(#grad-out-in)";
    let role = "neutral";
    if (selectedNodeId) {
      if (tx.payer === selectedNodeId) {
        color = "#EF4444"; // Red outflow
        role = "outflow";
      } else if (tx.receiver === selectedNodeId) {
        color = "#10B981"; // Green inflow
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
   * Computes Systemic Importance Score and all 6 switchable sizing metrics for every entity.
   */

  /**
   * Computes an objective, multi-factor Financial Fragility Score (0-100) for each entity
   * based on leverage, cash burn / CapEx pressure, refinancing dependency, contract/debt service
   * coverage, and active distress signals — ensuring no single company (e.g. OpenAI) is
   * hardcoded as highest risk.
   */
  function computeFragilityScore(entity, st, ocean) {
    if (!entity || entity.isOcean) return { score: 0, drivers: [] };
    const p = entity.defaults || {};
    const cash = st.cash !== null && st.cash !== undefined ? st.cash : (p.minCash ? p.minCash * 2 : 1.0);
    const undrawn = st.undrawnCredit !== null && st.undrawnCredit !== undefined ? st.undrawnCredit : 0;
    const liq = Math.max(0.2, cash + undrawn);
    const debt = Math.max(0, st.debt ?? 0);
    const fcf = st.fcf !== null && st.fcf !== undefined ? st.fcf : -((p.capex || 0) * 0.4);
    const rev = Math.max(0.1, st.revenue !== null && st.revenue !== undefined ? st.revenue : 0.5);
    const gm = Math.max(0.1, p.grossMargin ?? 0.5);
    const refi = Math.max(0.1, (p.refiSuccess ?? 0.85) * ((ocean?.refiSuccessRate ?? 85) / 100));
    const avail = (ocean?.fundingAvailability ?? 100) / 100;

    // 1. Leverage / Debt-to-Liquidity pressure (0-30)
    const debtToLiq = debt / liq;
    const levScore = Math.min(30, debtToLiq * 3.8);

    // 2. Cash burn & CapEx runway pressure (0-25)
    const burnRatio = fcf < 0 ? Math.abs(fcf) / liq : 0;
    const burnScore = Math.min(25, burnRatio * 28);

    // 3. Refinancing & external capital dependency (0-25)
    const refiDep = ((1 - refi) * 30) + ((p.newDebt || 0) / liq) * 10 * (1.2 - avail * 0.5);
    const refiScore = Math.min(25, Math.max(0, refiDep));

    // 4. Debt service & fixed compute/lease rigidity vs gross profit (0-20)
    const fixedOblig = (st.interestExp || (debt * (p.interestRate || 0.06) / 4)) + (p.debtRepay || 0) + (p.computePay || 0);
    const covRatio = fixedOblig / Math.max(0.15, rev * gm);
    const covScore = Math.min(20, covRatio * 8);

    // 5. Known market stress / distress boost
    let stressBoost = 0;
    if (st.distressLevel === 3) stressBoost = 30;
    else if (st.distressLevel === 2) stressBoost = 18;
    else if (st.distressLevel === 1) stressBoost = 8;
    if (entity.id === "SPV_JUPITER") stressBoost += 14; // Verified Sep 2026 force majeure & 89-91c secondary loan quote

    const score = Math.round(Math.min(100, Math.max(4, levScore + burnScore + refiScore + covScore + stressBoost)));
    const drivers = [];
    if (levScore >= 14) drivers.push("High Leverage");
    if (burnScore >= 10) drivers.push("Cash Burn / CapEx");
    if (refiScore >= 10) drivers.push("Refinancing Dependency");
    if (covScore >= 10) drivers.push("Fixed Obligation Load");
    if (entity.id === "SPV_JUPITER") drivers.push("Force Majeure / 89-91¢ Loan");
    return { score, drivers };
  }

  function computeEntityMetrics(entities, visibleTxs, stateByEntity) {
    const flowMap = {};
    const degreeMap = {};
    const commitMap = {};
    entities.forEach(e => {
      flowMap[e.id] = 0;
      degreeMap[e.id] = new Set();
      commitMap[e.id] = 0;
    });

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

      // Composite Systemic Importance Score (0 - 100+)
      const systemic = e.isOcean
        ? 100
        : Math.round(
            Math.min(35, Math.log10(1 + flows) * 12) +
            Math.min(20, Math.log10(1 + debt) * 8) +
            Math.min(20, Math.log10(1 + rpo) * 7) +
            Math.min(15, deg * 2.2) +
            (infra * 0.25)
          );

      metrics[e.id] = {
        systemic,
        revenue: rev,
        debt,
        liquidity: cash + (st.undrawnCredit ?? 0),
        commitments: rpo,
        networkExposure: flows,
        degree: deg
      };
    });
    return metrics;
  }

  /**
   * Core Phase 3 Simulation Engine:
   * - Historical quarters (<= 2026Q3): returns strictly disclosed/reported values (no lookahead).
   * - 2026Q4 (Partial) & Forecast quarters (2027Q1–2028Q4): runs Mode A / Mode B quarterly cash flow
   *   projection with Ocean macro parameters, per-company overrides, 3-level distress detection,
   *   and multi-hop contagion propagation along verified edges.
   */
  function runSimulation(entities, transactions, options = {}) {
    const ocean = Object.assign({
      fundingAvailability: 100,    // % (0-100)
      interestRate: 7.5,           // %
      refiSuccessRate: 85,         // % (0-100)
      maxCapacity: 250,            // $B per quarter
      creditTighteningBps: 0       // bps added to spreads
    }, options.ocean || {});

    const overrides = options.overrides || {}; // { entityId: { param: val } }
    const forcedDefaults = new Set(options.forcedDefaults || []);
    const defaultHaircut = options.defaultHaircut ?? 0.75;
    const lgd = options.lgd ?? 0.45;

    const timeline = {}; // { quarter: { entities: { id: state }, contagionLog: [], summary: {} } }

    // Helper: get latest known financial snapshot on or before quarter q
    function getHistoricalSnapshot(entity, q) {
      const targetIdx = qIndex(q);
      const qEnd = quarterEndDate(q);
      const exact = entity.financials && entity.financials[q];
      if (exact && (!exact.disclosedDate || exact.disclosedDate <= qEnd || q === "2026Q3")) {
        return Object.assign({ quarter: q, hasActual: true, isSimulatedEvent: false, distressLevel: 0 }, exact);
      }
      // Check if an earlier quarter exists for carry-forward display (strictly labeled prior/unavailable)
      let best = null;
      if (entity.financials) {
        for (const [fq, vals] of Object.entries(entity.financials)) {
          if (qIndex(fq) <= targetIdx) {
            best = vals;
          }
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

    // Populate Historical Quarters (2022Q1 - 2026Q3)
    QUARTERS_HIST.forEach(q => {
      const states = {};
      entities.forEach(e => {
        const snap = getHistoricalSnapshot(e, q);
        snap.distressLevel = 0;
        snap.distressLabel = "Normal";
        snap.creditLoss = 0;
        snap.lostReceipts = 0;
        snap.requiredRevenue = null;
        const frag = computeFragilityScore(e, snap, ocean);
        snap.fragilityScore = frag.score;
        snap.fragilityDrivers = frag.drivers;
        states[e.id] = snap;
      });
      timeline[q] = { quarter: q, status: "HISTORICAL", entities: states, contagionLog: [] };
    });

    // Forward Simulation for 2026Q4 (Partial) and 2027Q1 - 2028Q4
    const forwardQs = [QUARTER_PARTIAL, ...QUARTERS_FORECAST];
    let prevStates = timeline["2026Q3"].entities;

    forwardQs.forEach((q, stepIdx) => {
      const status = quarterStatus(q);
      const visibleTxs = getVisibleTransactions(transactions, q);
      const states = {};
      let oceanUsedThisQ = 0;

      // Step 1: Standalone quarterly cash flow projection
      entities.forEach(e => {
        const prev = prevStates[e.id] || {};
        if (e.isOcean) {
          states[e.id] = {
            quarter: q, revenue: null, cash: ocean.maxCapacity, debt: 0, ocf: null, capex: 0, fcf: null,
            rpo: 0, interestExp: 0, undrawnCredit: ocean.maxCapacity,
            dataType: "System Pool", distressLevel: 0, distressLabel: "External Pool (Non-Defaulting)",
            isSimulatedEvent: false, creditLoss: 0, lostReceipts: 0, requiredRevenue: null
          };
          return;
        }

        const p = Object.assign({}, e.defaults || {}, overrides[e.id] || {});
        const begCash = prev.cash !== null && prev.cash !== undefined ? prev.cash : (p.minCash ? p.minCash * 2 : 1.0);
        const begDebt = prev.debt !== null && prev.debt !== undefined ? prev.debt : 0;
        const prevRev = prev.revenue !== null && prev.revenue !== undefined ? prev.revenue : Math.max(0.2, (p.opex || 0.2) * 1.6);
        const undrawn = prev.undrawnCredit !== null && prev.undrawnCredit !== undefined ? prev.undrawnCredit : 0.5;

        // Effective interest rate with Ocean credit tightening
        const effRate = (p.interestRate ?? 0.06) + (ocean.creditTighteningBps / 10000);
        const interestPaid = Number(((begDebt * effRate) / 4).toFixed(3));
        const principalRepay = Number((p.debtRepay ?? 0).toFixed(3));
        const capex = Number((p.capex ?? 0).toFixed(3));
        const opex = Number((p.opex ?? 0).toFixed(3));
        const computePay = Number((p.computePay ?? 0).toFixed(3));
        const grossMargin = Math.max(0.05, Math.min(0.98, p.grossMargin ?? 0.55));
        const cashConv = Math.max(0.3, Math.min(1.0, p.cashConv ?? 0.88));
        const minCash = p.minCash ?? 1.0;

        // Ocean-constrained new financing & refinancing
        const availFactor = Math.max(0, Math.min(1, ocean.fundingAvailability / 100));
        const refiFactor = Math.max(0, Math.min(1, (p.refiSuccess ?? 0.85) * (ocean.refiSuccessRate / 100)));
        const requestedDebt = (p.newDebt ?? 0) * availFactor * refiFactor;
        const allowedDebt = Math.max(0, Math.min(requestedDebt, Math.max(0, ocean.maxCapacity - oceanUsedThisQ)));
        oceanUsedThisQ += allowedDebt;
        const equityInflow = (p.equityInflow ?? 0) * availFactor;

        // Mode A (Contract Coverage) vs Mode B (Previous Quarter Growth)
        const totalCashObligations = opex + computePay + capex + interestPaid + principalRepay;
        const requiredRev = Math.max(0, (totalCashObligations + minCash - begCash - allowedDebt - equityInflow - undrawn * 0.5) / Math.max(0.1, grossMargin * cashConv));

        let projRev;
        if (p.mode === "A") {
          // Mode A outputs contract-coverage required revenue benchmark while projecting baseline growth
          const g = Math.max(-0.35, (p.revGrowth ?? 0.08) - (p.revDecel ?? 0.01) * stepIdx);
          projRev = Number((prevRev * (1 + g)).toFixed(3));
        } else {
          const g = Math.max(-0.35, (p.revGrowth ?? 0.05) - (p.revDecel ?? 0.005) * stepIdx);
          projRev = Number((prevRev * (1 + g)).toFixed(3));
        }

        // Operating cash receipts (net of COGS ex-compute to avoid double-counting computePay)
        const grossProfitCash = projRev * grossMargin * cashConv;
        const taxes = Math.max(0, (grossProfitCash - opex - interestPaid) * 0.18);
        const ocf = Number((grossProfitCash - opex - computePay - interestPaid - taxes).toFixed(3));
        const fcf = Number((ocf - capex).toFixed(3));
        const endCash = Number((begCash + fcf + allowedDebt + equityInflow - principalRepay).toFixed(3));
        const endDebt = Number(Math.max(0, begDebt + allowedDebt - principalRepay).toFixed(3));

        states[e.id] = {
          quarter: q,
          mode: p.mode || "B",
          revenue: projRev,
          requiredRevenue: Number(requiredRev.toFixed(2)),
          begCash: Number(begCash.toFixed(2)),
          cash: endCash,
          debt: endDebt,
          ocf,
          capex,
          fcf,
          interestExp: interestPaid,
          principalRepay,
          computePay,
          newDebt: Number(allowedDebt.toFixed(2)),
          equityInflow: Number(equityInflow.toFixed(2)),
          undrawnCredit: Number((undrawn * availFactor).toFixed(2)),
          rpo: prev.rpo ?? 0,
          minCash,
          dataType: status === "PARTIAL" ? "Partial / Est." : "Forecast",
          distressLevel: 0,
          distressLabel: "Normal",
          isSimulatedEvent: false,
          creditLoss: 0,
          lostReceipts: 0
        };
      });

      // Helper to classify 3-level distress
      function evaluateDistress(entityId) {
        const st = states[entityId];
        if (!st || entityId === "PRIVATE_CREDIT_OCEAN") return;
        const mandatoryNextQ = (st.interestExp || 0) + (st.principalRepay || 0) + (st.computePay || 0);
        const totalLiq = (st.cash || 0) + (st.undrawnCredit || 0);

        if (forcedDefaults.has(entityId) || totalLiq < 0) {
          st.distressLevel = 3;
          st.distressLabel = "Level 3: Simulated Default";
          st.isSimulatedEvent = true;
        } else if (totalLiq < mandatoryNextQ && mandatoryNextQ > 0) {
          st.distressLevel = 2;
          st.distressLabel = "Level 2: Liquidity Crisis";
          st.isSimulatedEvent = true;
        } else if (st.cash < st.minCash || (st.fcf < 0 && Math.abs(st.fcf) > Math.max(0.5, st.begCash * 0.35))) {
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

      // Step 2: Multi-hop Contagion Propagation (up to 3 hops along verified edges only)
      const contagionLog = [];
      const propagatedDefaults = new Set();

      for (let hop = 1; hop <= 3; hop++) {
        const newDefaulters = entities
          .map(e => e.id)
          .filter(id => id !== "PRIVATE_CREDIT_OCEAN" && states[id].distressLevel === 3 && !propagatedDefaults.has(id));

        if (newDefaulters.length === 0) break;

        newDefaulters.forEach(defId => {
          propagatedDefaults.add(defId);

          visibleTxs.forEach(tx => {
            // Channel A: Defaulter is PAYER on Cloud/Lease/GPU/Take-or-Pay -> Supplier loses quarterly cash receipts
            if (tx.payer === defId && ["Cloud Computing Purchase", "Take-or-Pay Contract", "Data Center Lease", "GPU / Server Purchase"].includes(tx.type)) {
              const supId = tx.receiver;
              if (supId === "PRIVATE_CREDIT_OCEAN" || !states[supId]) return;
              const qPay = tx.quarterlyPayment || (tx.totalCommitment ? tx.totalCommitment / 20 : 0);
              const loss = Number((qPay * defaultHaircut).toFixed(3));
              if (loss > 0) {
                states[supId].lostReceipts = Number((states[supId].lostReceipts + loss).toFixed(3));
                states[supId].revenue = Number(Math.max(0, states[supId].revenue - loss).toFixed(3));
                states[supId].ocf = Number((states[supId].ocf - loss * 0.7).toFixed(3));
                states[supId].fcf = Number((states[supId].fcf - loss * 0.7).toFixed(3));
                states[supId].cash = Number((states[supId].cash - loss * 0.7).toFixed(3));
                evaluateDistress(supId);
                contagionLog.push({
                  hop, from: defId, to: supId, txId: tx.id,
                  channel: `${tx.type} Payment Cut (-${Math.round(defaultHaircut * 100)}%)`,
                  impactB: loss
                });
              }
            }

            // Channel B: Defaulter is RECEIVER (Borrower) of Loan/Bond/SPV/GPU Debt -> Lender suffers credit loss
            if (tx.receiver === defId && ["Direct Loan", "Corporate Bond", "Project Finance", "GPU-backed Financing", "Equipment Financing", "Convertible Debt"].includes(tx.type)) {
              const lenderId = tx.payer;
              if (!states[lenderId]) return;
              const exp = (tx.amountDrawn && tx.amountDrawn > 0) ? tx.amountDrawn : (tx.totalCommitment || 0) * 0.5;
              const cLoss = Number((exp * lgd).toFixed(3));
              if (cLoss > 0) {
                states[lenderId].creditLoss = Number((states[lenderId].creditLoss + cLoss).toFixed(3));
                if (lenderId !== "PRIVATE_CREDIT_OCEAN") {
                  states[lenderId].cash = Number((states[lenderId].cash - cLoss * 0.25).toFixed(3));
                  evaluateDistress(lenderId);
                }
                contagionLog.push({
                  hop, from: defId, to: lenderId, txId: tx.id,
                  channel: `${tx.type} Credit Loss (LGD ${Math.round(lgd * 100)}%)`,
                  impactB: cLoss
                });
              }
            }

            // Channel C: Guarantee triggered if receiver defaults
            if (tx.receiver === defId && tx.type === "Loan Guarantee") {
              const guarId = tx.payer;
              if (guarId !== "PRIVATE_CREDIT_OCEAN" && states[guarId]) {
                const callAmt = Number(((tx.totalCommitment || 0) * 0.25).toFixed(3));
                if (callAmt > 0) {
                  states[guarId].creditLoss = Number((states[guarId].creditLoss + callAmt).toFixed(3));
                  states[guarId].cash = Number((states[guarId].cash - callAmt * 0.2).toFixed(3));
                  evaluateDistress(guarId);
                  contagionLog.push({
                    hop, from: defId, to: guarId, txId: tx.id,
                    channel: `Guarantee / RVG Call`,
                    impactB: callAmt
                  });
                }
              }
            }
          });
        });
      }

      entities.forEach(e => {
        const frag = computeFragilityScore(e, states[e.id], ocean);
        states[e.id].fragilityScore = frag.score;
        states[e.id].fragilityDrivers = frag.drivers;
      });
      timeline[q] = { quarter: q, status, entities: states, contagionLog };
      prevStates = states;
    });

    return { timeline, allQuarters: ALL_QUARTERS };
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
