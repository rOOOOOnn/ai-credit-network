/**
 * AI Credit Network — v3.0 Full Audit Remediated Cash Flow, Supply Chain & 4-Layer Contagion Engine
 * Remediations implemented on branch fix/audit-v3-remediation:
 * - P0-1: Strict Point-in-Time Financial Snapshot (disclosedDate <= cutoff on BOTH exact & fallback; chronological sort)
 * - P0-2: Separation of announcedDate, startQ, endQ (announced-not-yet-active commitments never generate active cash/op flows)
 * - P0-3: Full Basel-style EAD / LGD / Expected Loss accounting (Funded EAD, Undrawn CCF EAD, Guarantee EAD; strict 0 vs null)
 * - P0-4: Complete Layer 3 Operational Contagion across 7 service categories (incl. DELL, VERTIV, CEG, VST, CORZ)
 * - P0-5: Dynamic Phased Guarantee Exposure Schedule (TX11 NVIDIA $105B activates FY29 / 2028Q1+, amortizes with rent)
 * - P0-6: Parent / SPV Debt Reconciliation (Consolidated vs Standalone vs Recourse/Non-Recourse, zero double-counting)
 * - P1-1: Strict Insufficient Data Guard (partial overrides never bypass missing core financials)
 * - P1-2: Minimal Verifiable Layer 4 Secondary Contagion (secondary market spread widening & collateral tightening, zero double-count)
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

  const DEBT_TX_TYPES = [
    "Direct Loan",
    "Corporate Bond",
    "Project Finance",
    "GPU-backed Financing",
    "Equipment Financing",
    "Convertible Debt"
  ];

  const OPERATIONAL_TX_TYPES = [
    "Cloud Computing Purchase",
    "Take-or-Pay Contract",
    "Data Center Lease",
    "Power Purchase Agreement",
    "GPU / Server Purchase",
    "Cooling / Electrical Infrastructure",
    "Critical Infrastructure"
  ];

  function parseQuarterNumber(q) {
    if (!q || typeof q !== "string" || q.length < 6) return -1;
    const y = parseInt(q.slice(0, 4), 10);
    const n = parseInt(q.slice(5), 10);
    if (Number.isNaN(y) || Number.isNaN(n)) return -1;
    return y * 4 + (n - 1);
  }

  function quarterEndDate(q) {
    const y = parseInt(q.slice(0, 4), 10);
    const n = parseInt(q.slice(5), 10);
    const ends = { 1: `${y}-03-31`, 2: `${y}-06-30`, 3: `${y}-09-30`, 4: `${y}-12-31` };
    return ends[n] || `${y}-12-31`;
  }

  function quarterStatus(q) {
    if (q === QUARTER_PARTIAL) return "PARTIAL";
    return parseQuarterNumber(q) > parseQuarterNumber(QUARTER_PARTIAL) ? "FORECAST" : "HISTORICAL";
  }

  function qIndex(q) {
    return ALL_QUARTERS.indexOf(q);
  }

  function compareQuarter(a, b) {
    if (!a || !b) return 0;
    const na = parseQuarterNumber(a);
    const nb = parseQuarterNumber(b);
    if (na >= 0 && nb >= 0) return na - nb;
    return a.localeCompare(b);
  }

  function isPoolId(id) {
    return id === "PRIVATE_CREDIT_OCEAN" || id === "EXTERNAL_EQUITY_POOL";
  }

  /**
   * P0-2: Transaction lifecycle classifier separating announcedDate, startQ, and endQ.
   * Returns { phase, isVisible, isActive }.
   */
  function getTransactionLifecycle(tx, quarter) {
    const endDate = quarterEndDate(quarter);
    const isForecast = quarterStatus(quarter) === "FORECAST";

    if (!isForecast && tx.announcedDate && tx.announcedDate > endDate) {
      return { phase: "NOT_ANNOUNCED", isVisible: false, isActive: false };
    }

    if (tx.type === "Equity Investment" || tx.type === "Asset Acquisition") {
      const hasStarted = !tx.startQ || compareQuarter(quarter, tx.startQ) >= 0;
      return {
        phase: hasStarted ? "ACTIVE" : "ANNOUNCED_FUTURE",
        isVisible: true,
        isActive: hasStarted
      };
    }

    if (tx.endQ && compareQuarter(quarter, tx.endQ) > 0) {
      const rem = tx.remainingCommitment ?? 0;
      const unpaid = (tx.amountDrawn ?? 0) - (tx.amountRepaid ?? 0);
      if (rem <= 0 && unpaid <= 0) {
        return { phase: "EXPIRED", isVisible: false, isActive: false };
      }
    }

    if (tx.startQ && compareQuarter(quarter, tx.startQ) < 0) {
      return { phase: "ANNOUNCED_FUTURE", isVisible: true, isActive: false };
    }

    return { phase: "ACTIVE", isVisible: true, isActive: true };
  }

  function isTransactionActive(tx, quarter) {
    return getTransactionLifecycle(tx, quarter).isActive;
  }

  function getVisibleTransactions(transactions, quarter, layerFilter = null, opts = {}) {
    const activeOnly = Boolean(opts && opts.activeOnly);
    return transactions.filter(tx => {
      if (layerFilter && layerFilter !== "ALL" && tx.networkLayer && tx.networkLayer !== layerFilter) {
        return false;
      }
      const lc = getTransactionLifecycle(tx, quarter);
      if (!lc.isVisible) return false;
      if (activeOnly && !lc.isActive) return false;
      return true;
    });
  }

  /**
   * P0-5: Dynamic Phased Guarantee Exposure Schedule
   * Returns active guarantee exposure ($B) in a given quarter (0 before activation/startQ).
   */
  function getActiveGuaranteeExposure(tx, quarter) {
    if (!tx || tx.type !== "Loan Guarantee") return 0;
    if (!isTransactionActive(tx, quarter)) return 0;

    const maxCap = Number(tx.totalCommitment || 0);
    const sched = tx.guaranteeSchedule;
    if (!sched) return maxCap;

    const actQ = sched.activationQuarter || tx.startQ;
    if (actQ && compareQuarter(quarter, actQ) < 0) return 0;

    const endQ = sched.endQuarter || tx.endQ;
    if (endQ && compareQuarter(quarter, endQ) > 0) return 0;

    if (sched.phases && sched.phases[quarter] !== undefined) {
      return Number(Math.min(maxCap, Math.max(0, sched.phases[quarter])).toFixed(4));
    }

    const peakQ = sched.peakQuarter || actQ;
    const qNum = parseQuarterNumber(quarter);
    const peakNum = parseQuarterNumber(peakQ);
    const endNum = parseQuarterNumber(endQ);

    if (peakNum >= 0 && qNum < peakNum && sched.phases) {
      const sortedPhaseQs = Object.keys(sched.phases).sort(compareQuarter);
      let prevVal = 0;
      for (const pq of sortedPhaseQs) {
        if (compareQuarter(pq, quarter) <= 0) prevVal = sched.phases[pq];
      }
      return Number(Math.min(maxCap, Math.max(0, prevVal)).toFixed(4));
    }

    if (peakNum >= 0 && endNum > peakNum && qNum > peakNum) {
      const peakVal = (sched.phases && sched.phases[peakQ] !== undefined) ? sched.phases[peakQ] : maxCap;
      const totalAmortQs = endNum - peakNum;
      const elapsed = qNum - peakNum;
      const remainingFrac = Math.max(0, 1 - elapsed / totalAmortQs);
      return Number(Math.min(maxCap, peakVal * remainingFrac).toFixed(4));
    }

    return maxCap;
  }

  /**
   * P0-3: Strict Basel-style EAD / LGD / Expected Loss calculator.
   * Explicitly distinguishes amountDrawn === 0 (never substitutes totalCommitment!) vs amountDrawn === null.
   */
  function computeTransactionEAD(tx, quarter, options = {}) {
    const defaultLgd = options.lgd ?? 0.45;
    const defaultPd = options.pd ?? 0.05;
    const defaultGuarCallRate = options.guaranteeCallRate ?? 0.25;
    const txLgd = tx.lgd !== undefined && tx.lgd !== null ? Number(tx.lgd) : defaultLgd;
    const txPd = tx.pd !== undefined && tx.pd !== null ? Number(tx.pd) : defaultPd;

    if (!isTransactionActive(tx, quarter)) {
      return {
        txId: tx.id, quarter, isActive: false,
        fundedEAD: 0, undrawnCommitment: 0, ccf: 0, undrawnEAD: 0, guaranteeEAD: 0,
        totalEAD: 0, lgd: txLgd, pd: txPd, expectedLoss: 0, creditLossAtDefault: 0,
        eadBasis: "Not Yet Active"
      };
    }

    if (tx.type === "Loan Guarantee") {
      const guaranteeEAD = getActiveGuaranteeExposure(tx, quarter);
      const callRate = tx.guaranteeCallRate !== undefined && tx.guaranteeCallRate !== null
        ? Number(tx.guaranteeCallRate)
        : defaultGuarCallRate;
      const creditLossAtDefault = Number((guaranteeEAD * callRate).toFixed(4));
      const expectedLoss = Number((creditLossAtDefault * txPd).toFixed(4));
      return {
        txId: tx.id, quarter, isActive: true,
        fundedEAD: 0, undrawnCommitment: 0, ccf: 0, undrawnEAD: 0,
        guaranteeEAD, totalEAD: guaranteeEAD,
        lgd: callRate, pd: txPd, expectedLoss, creditLossAtDefault,
        eadBasis: tx.guaranteeSchedule ? "Dynamic Phased Guarantee Schedule" : "Active Guarantee Cap"
      };
    }

    if (DEBT_TX_TYPES.includes(tx.type)) {
      const commit = Number(tx.totalCommitment || 0);
      const repaid = Number(tx.amountRepaid || 0);
      const defaultCcf = tx.type === "Direct Loan" ? 0.40 : 0.25;
      const ccf = tx.ccf !== undefined && tx.ccf !== null ? Number(tx.ccf) : defaultCcf;

      let fundedEAD = 0;
      let undrawnCommitment = 0;
      let undrawnEAD = 0;
      let eadBasis = "";

      if (tx.principalOutstanding != null) {
        const knownPrincipal = compareQuarter(quarter, tx.principalAsOfQuarter) >= 0;
        fundedEAD = knownPrincipal ? nonnegative(tx.principalOutstanding) : 0;
        undrawnCommitment = knownPrincipal ? tx.remainingCommitment ?? null : null;
        undrawnEAD = nonnegative(undrawnCommitment) * ccf;
        eadBasis = knownPrincipal ? "Reported principal; availability may be unknown" : "Principal unavailable as of quarter";
      } else if (tx.amountDrawn === 0) {
        // Strict P0-3: amountDrawn === 0 MUST NEVER substitute totalCommitment into fundedEAD
        fundedEAD = 0;
        undrawnCommitment = Number(Math.max(0, commit).toFixed(4));
        undrawnEAD = Number((undrawnCommitment * ccf).toFixed(4));
        eadBasis = "Undrawn Facility (amountDrawn=0, CCF Applied)";
      } else if (tx.amountDrawn !== null && tx.amountDrawn !== undefined && tx.amountDrawn > 0) {
        const drawn = Number(tx.amountDrawn);
        fundedEAD = Number(Math.max(0, drawn - repaid).toFixed(4));
        undrawnCommitment = Number(Math.max(0, commit - drawn).toFixed(4));
        undrawnEAD = Number((undrawnCommitment * (undrawnCommitment > 0 ? ccf : 0)).toFixed(4));
        eadBasis = undrawnCommitment > 0 ? "Funded + Undrawn CCF" : "Funded Principal";
      } else {
        // amountDrawn === null or undefined: unverified drawn amount -> conservative CCF only, never assume 100% funded
        fundedEAD = 0;
        undrawnCommitment = Number(Math.max(0, commit).toFixed(4));
        undrawnEAD = Number((undrawnCommitment * ccf).toFixed(4));
        eadBasis = "Unverified Drawn (amountDrawn=null, Conservative CCF)";
      }

      const totalEAD = Number((fundedEAD + undrawnEAD).toFixed(4));
      const creditLossAtDefault = Number((totalEAD * txLgd).toFixed(4));
      const expectedLoss = Number((totalEAD * txPd * txLgd).toFixed(4));
      return {
        txId: tx.id, quarter, isActive: true,
        fundedEAD, undrawnCommitment, ccf, undrawnEAD, guaranteeEAD: 0,
        totalEAD, lgd: txLgd, pd: txPd, expectedLoss, creditLossAtDefault, eadBasis
      };
    }

    return {
      txId: tx.id, quarter, isActive: true,
      fundedEAD: 0, undrawnCommitment: 0, ccf: 0, undrawnEAD: 0, guaranteeEAD: 0,
      totalEAD: 0, lgd: 0, pd: 0, expectedLoss: 0, creditLossAtDefault: 0,
      eadBasis: "Non-Debt / Commercial"
    };
  }

  /**
   * P0-1: Point-in-Time Financial Snapshot
   * Strictly enforces (period <= target) AND (if pointInTimeBacktest: disclosedDate <= quarterEndDate(q))
   * on BOTH exact match and fallback, sorting chronologically rather than by JSON key insertion order.
   */
  function getHistoricalSnapshot(entity, q, pointInTimeBacktest = false) {
    const targetNum = parseQuarterNumber(q);
    const qEnd = quarterEndDate(q);
    const financials = entity && entity.financials ? entity.financials : null;

    if (financials) {
      const eligible = [];
      for (const [fq, vals] of Object.entries(financials)) {
        if (!vals || typeof vals !== "object") continue;
        const fqNum = parseQuarterNumber(fq);
        if (fqNum < 0 || fqNum > targetNum) continue;
        if (pointInTimeBacktest && vals.disclosedDate && vals.disclosedDate > qEnd) {
          continue; // Strict PIT guard on BOTH exact match and fallback!
        }
        eligible.push({ fq, fqNum, vals });
      }

      // Sort strictly chronologically descending (latest eligible period first)
      eligible.sort((a, b) => b.fqNum - a.fqNum);

      if (eligible.length > 0) {
        const best = eligible[0];
        const isExact = best.fq === q;
        const origType = best.vals.dataType || (isExact ? "Actual" : "Estimated");
        const resolvedDataType = isExact
          ? origType
          : (origType === "Actual" ? "Carry-Forward (Prior Actual)" : origType);
        return Object.assign(
          {
            quarter: q,
            sourceQuarter: best.fq,
            hasActual: isExact && origType === "Actual",
            isCarryForward: !isExact,
            isSimulatedEvent: false,
            distressLevel: 0
          },
          best.vals,
          { dataType: resolvedDataType }
        );
      }
    }

    return {
      quarter: q,
      sourceQuarter: null,
      revenue: null, cash: null, debt: null, ocf: null, capex: null, fcf: null,
      rpo: null, interestExp: null, undrawnCredit: null,
      dataType: entity && entity.isOcean ? "System Pool" : "Unavailable",
      hasActual: false,
      isCarryForward: false,
      isSimulatedEvent: false,
      distressLevel: 0,
      insufficientData: Boolean(entity && !entity.isOcean && !entity.lossAbsorbingInvestor)
    };
  }

  /**
   * P0-6: Parent / SPV Debt Reconciliation (Consolidated vs Standalone vs Recourse/Non-Recourse)
   */
  function reconcileParentSpvDebt(entities, transactions, quarter = "2026Q3") {
    const byId = Object.fromEntries(entities.map(e => [e.id, e]));
    const spvs = entities.filter(e => e.parentEntity || e.consolidatedInParent || e.id.startsWith("SPV_"));
    const rows = [];

    spvs.forEach(spv => {
      const parentId = spv.consolidatedInParent || spv.parentEntity || null;
      const parent = parentId ? byId[parentId] : null;
      const pFin = (parent && parent.financials && parent.financials[quarter]) || {};
      const sFin = (spv.financials && spv.financials[quarter]) || {};
      const spvDebtTxs = transactions.filter(t => t.receiver === spv.id && DEBT_TX_TYPES.includes(t.type));

      const facilityCommitment = spvDebtTxs.length > 0
        ? Number(spvDebtTxs.reduce((s, t) => s + Number(t.totalCommitment || 0), 0).toFixed(3))
        : Number(sFin.facilityCommitment ?? sFin.debt ?? 0);
      const fundedDebt = spvDebtTxs.length > 0
        ? Number(spvDebtTxs.reduce((s, t) => s + (t.principalOutstanding ?? Math.max(0, Number(t.amountDrawn ?? 0) - Number(t.amountRepaid ?? 0))), 0).toFixed(3))
        : Number(sFin.fundedDebt ?? sFin.debt ?? 0);
      const undrawnCommitment = spvDebtTxs.some(t => t.principalOutstanding != null && t.remainingCommitment == null)
        ? null : Number(Math.max(0, facilityCommitment - fundedDebt).toFixed(3));
      const isConsolidated = Boolean(spv.consolidatedInParent || spv.isConsolidatedSubsidiary);
      const parentConsolidatedDebt = pFin.debt !== undefined && pFin.debt !== null ? Number(pFin.debt) : null;
      const parentRecourseDebt = pFin.recourseDebt !== undefined && pFin.recourseDebt !== null ? Number(pFin.recourseDebt) : null;
      const parentNonRecourseDebt = pFin.nonRecourseDebt !== undefined && pFin.nonRecourseDebt !== null ? Number(pFin.nonRecourseDebt) : null;

      // Zero double-counting rule:
      // Consolidated SPV debt is ALREADY inside parentConsolidatedDebt -> elimination = fundedDebt
      // Unconsolidated SPV debt is off-parent balance sheet -> elimination = 0
      const consolidationElimination = isConsolidated ? fundedDebt : 0;
      const netSystemWideDebt = parentConsolidatedDebt !== null
        ? Number((parentConsolidatedDebt + fundedDebt - consolidationElimination).toFixed(3))
        : fundedDebt;

      rows.push({
        parentId,
        spvId: spv.id,
        spvName: spv.name,
        consolidationStatus: isConsolidated ? "Consolidated" : "Unconsolidated",
        parentConsolidatedDebt,
        parentRecourseDebt,
        parentNonRecourseDebt,
        spvFacilityCommitment: facilityCommitment,
        spvFundedDebt: fundedDebt,
        spvUndrawnCommitment: undrawnCommitment,
        consolidationElimination,
        netSystemWideDebt,
        txIds: spvDebtTxs.map(t => t.id)
      });
    });

    return rows;
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
    const lc = getTransactionLifecycle(tx, quarter);
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

    if (lc.phase === "ANNOUNCED_FUTURE") {
      dashArray = "8,4";
      opacity = role === "dimmed" ? 0.10 : 0.62;
      lineKind = "Committed";
    } else if (amt === null || amt === undefined || Number.isNaN(Number(amt))) {
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
    return { color, role, dashArray, opacity, strokeWidth, lineKind, lifecyclePhase: lc.phase, isActive: lc.isActive };
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

  // Scenario amounts are in USD billions. No missing historical amount is imputed.
  const FINANCING_SOURCES = ["equity", "debt", "strategic", "prepayment", "assetBacked", "other"];
  const nonnegative = value => Number.isFinite(value) ? Math.max(0, value) : 0;
  const money = value => Number(value.toFixed(4));

  function financingForecast(config, year) {
    const elapsed = year - (config.startYear ?? 2027);
    if (elapsed < 0 || elapsed >= (config.horizon ?? 6)) return { amounts: {}, status: "Outside Horizon" };
    if (config.mode === "manual") return { amounts: config.annual?.[year] ?? {}, status: "Assumption" };
    const curve = config.curve ?? "linear";
    const historical = config.history ?? {};
    const entries = Object.entries(historical).filter(([y, record]) =>
      Number(y) < (config.startYear ?? 2027) && record.dataType === "Actual" && record.fullYear === true)
      .sort(([a], [b]) => Number(a) - Number(b));
    const [prior, latest] = entries.slice(-2);
    if (curve === "historical" && (!prior || Number(latest[0]) - Number(prior[0]) !== 1 ||
        !FINANCING_SOURCES.some(source => prior[1].amounts?.[source] > 0 && Number.isFinite(latest[1].amounts?.[source])))) {
      return { amounts: {}, status: "Insufficient Historical Data" };
    }
    const amounts = {};
    for (const source of FINANCING_SOURCES) {
      const floor = Math.max(-1, config.minimumGrowth ?? 0);
      const initial = config.initialGrowth ?? 0;
      const decline = nonnegative(config.annualDecline ?? 0.2);
      let amount = nonnegative(config.base?.[source]);
      if (curve === "historical") {
        const first = prior[1].amounts?.[source];
        const last = latest[1].amounts?.[source];
        if (!(first > 0) || !Number.isFinite(last) || last < 0) continue;
        amounts[source] = last * (last / first) ** (year - Number(latest[0]));
        continue;
      }
      for (let offset = 0; offset <= elapsed; offset++) {
        let growth = initial - decline * offset;
        if (curve === "exponential") growth = floor + (initial - floor) * Math.exp(-decline * offset);
        if (curve === "logistic") {
          const midpoint = Math.max(1, (config.horizon ?? 6) / 2);
          growth = floor + (initial - floor) * (1 + Math.exp(-decline * midpoint)) /
            (1 + Math.exp(decline * (offset - midpoint)));
        }
        amount *= 1 + Math.max(floor, growth);
      }
      amounts[source] = amount;
    }
    return { amounts, status: "Assumption", historyYears: curve === "historical" ? [prior[0], latest[0]] : null };
  }

  function scenarioFunding(config, quarter, remaining, availability, debtFactor) {
    const forecast = financingForecast(config, Number(quarter.slice(0, 4)));
    const quarterIndex = Number(quarter.slice(-1)) - 1;
    const weights = config.quarterWeights ?? [1, 1, 1, 1];
    const totalWeight = weights.reduce((sum, value) => sum + nonnegative(value), 0);
    const share = totalWeight > 0 ? nonnegative(weights[quarterIndex]) / totalWeight : 0;
    const amounts = Object.fromEntries(FINANCING_SOURCES.map(source => [
      source, nonnegative(forecast.amounts[source]) * share * availability *
        (["debt", "assetBacked"].includes(source) ? debtFactor : 1)
    ]));
    const requested = Object.values(amounts).reduce((sum, value) => sum + value, 0);
    const budget = Math.min(requested, remaining, nonnegative(config.quarterlyLimit));
    return { amounts: allocateFunding(amounts, budget), status: forecast.status };
  }

  function allocateFunding(amounts, budget) {
    const total = Object.values(amounts).reduce((sum, value) => sum + value, 0);
    const units = Math.floor(Math.min(total, nonnegative(budget)) * 10000 + 1e-8);
    const entries = Object.entries(amounts).map(([source, value]) => {
      const share = total > 0 ? units * value / total : 0;
      const whole = Math.floor(share);
      return { source, whole, fraction: share - whole };
    });
    let remaining = units - entries.reduce((sum, entry) => sum + entry.whole, 0);
    entries.sort((a, b) => b.fraction - a.fraction);
    for (const entry of entries) {
      if (remaining > 0 && entry.fraction > 0) {
        entry.whole++;
        remaining--;
      }
    }
    return Object.fromEntries(entries.map(({ source, whole }) => [source, whole / 10000]));
  }

  function fleetRefresh(cohorts, quarter, config) {
    let replacementCapex = 0;
    let disposalProceeds = 0;
    const next = [];
    for (const cohort of cohorts) {
      const age = parseQuarterNumber(quarter) - parseQuarterNumber(cohort.acquired);
      const cost = nonnegative(cohort.cost);
      const eligible = age >= 4 * (config.economicLife ?? 5);
      const share = eligible ? Math.min(1, nonnegative(config.replacementRatio ?? 0.25)) : 0;
      const replaced = cost * share;
      const newCost = replaced * Math.max(0, 1 - (config.priceDecline ?? 0));
      replacementCapex += newCost;
      disposalProceeds += replaced * Math.min(1, nonnegative(config.residualValue));
      if (cost > replaced) next.push({ ...cohort, cost: cost - replaced });
      if (newCost > 0) next.push({ acquired: quarter, cost: newCost });
    }
    return { cohorts: next, replacementCapex: money(replacementCapex), disposalProceeds: money(disposalProceeds) };
  }

  const ORACLE_LEASE_SCENARIO = [2027, 2028, 2029].map(year => ({
    startQuarter: year + "Q1", termQuarters: 68, commitment: 96
  }));
  const SB_ENERGY_SCENARIO = Array.from({ length: 9 }, (_, index) => {
    const quarter = (2028 + Math.floor(index / 4)) + "Q" + (index % 4 + 1);
    return { readyQuarter: quarter, leaseStartQuarter: quarter, termQuarters: 80, cap: 105 / 9 };
  });

  function incrementalLeaseSchedule(tranches, quarter, delay = 0) {
    let payment = 0;
    let uncommencedCommitment = 0;
    let commencedRemainingPayments = 0;
    for (const tranche of tranches) {
      const age = parseQuarterNumber(quarter) - parseQuarterNumber(tranche.startQuarter) - Math.max(0, Math.trunc(delay));
      const term = Math.trunc(nonnegative(tranche.termQuarters));
      if (!term) continue;
      const installment = tranche.quarterlyPayment ?? nonnegative(tranche.commitment) / term;
      if (age < 0) uncommencedCommitment += installment * term;
      if (age >= 0 && age < term) {
        payment += installment;
        commencedRemainingPayments += installment * (term - age - 1);
      }
    }
    return { payment: money(payment), uncommencedCommitment: money(uncommencedCommitment),
      commencedRemainingPayments: money(commencedRemainingPayments), dataType: "Assumption" };
  }

  function phasedGuarantee(projects, quarter, maximum, called = 0) {
    let active = 0;
    let contingent = 0;
    for (const project of projects) {
      const activation = Math.max(parseQuarterNumber(project.readyQuarter), parseQuarterNumber(project.leaseStartQuarter));
      const age = parseQuarterNumber(quarter) - activation;
      const cap = nonnegative(project.cap);
      const term = nonnegative(project.termQuarters);
      if (activation < 0 || age < 0) contingent += cap;
      if (activation >= 0 && age >= 0 && age < term &&
          (!project.terminationQuarter || compareQuarter(quarter, project.terminationQuarter) < 0)) {
        const rentPaid = project.paymentsByQuarter
          ? Object.entries(project.paymentsByQuarter).reduce((sum, [q, amount]) =>
            parseQuarterNumber(q) >= activation && compareQuarter(q, quarter) <= 0 ? sum + nonnegative(amount) : sum, 0)
          : cap * age / term;
        active += Math.max(0, cap - rentPaid);
      }
    }
    const effective = Math.min(maximum, active);
    return { disclosedMaximum: maximum, effectiveExposure: money(effective),
      contingentExposure: money(Math.min(Math.max(0, maximum - effective), contingent)),
      calledGuarantee: money(called), remainingGuaranteeLiability: money(Math.max(0, effective - called)),
      dataType: "Assumption" };
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
    const financingRemaining = {};
    const fleets = {};
    const scenarioSummary = {};
    const facilityBalances = {};
    const deferredRevenue = [];
    transactions = transactions.map(tx => {
      const extension = options.facilityExtensions?.[tx.id];
      return extension && /\bRCF\b/i.test(tx.collateral ?? "") && compareQuarter(extension, tx.endQ) > 0
        ? { ...tx, endQ: extension } : tx;
    });
    const useAudit4Contracts = options.audit4Contracts === true;
    const reportedAnthropic = useAudit4Contracts && entities.find(e => e.id === "ANTHROPIC")?.audit4Observations;
    if (reportedAnthropic) {
      transactions = transactions.map(tx => {
        if (!reportedAnthropic.noteExposureIds.includes(tx.id)) return tx;
        const aggregate = tx.id === reportedAnthropic.noteExposureIds[0];
        return {
          ...tx, principalOutstanding: aggregate ? reportedAnthropic.principalAtQ3 : 0,
          principalAsOfQuarter: "2026Q3", remainingCommitment: null, amountDrawn: null, amountRepaid: null,
          endQ: aggregate ? "" : tx.endQ, nonCashConversionByQuarter: aggregate ? reportedAnthropic.nonCashConversionByQuarter : {},
          exposureBasis: aggregate ? "Aggregate AWS note principal; maturity allocation unavailable" : "Superseded by aggregate AWS note principal"
        };
      });
    }
    const trackTermDebt = options.audit4DebtLedger ?? useAudit4Contracts;
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
    const enableSecondaryContagion = options.enableSecondaryContagion !== false;

    const entityById = Object.fromEntries(entities.map(e => [e.id, e]));
    const timeline = {};

    // Global cross-quarter deduplication trackers
    const defaultedTxIds = new Set();        // Guarantees each defaulted debt/guarantee fires ONCE
    const cumCreditLossByTx = {};
    const creditEvents = [];                 // Structured credit event ledger (EAD, LGD, Recovery, Remaining)
    const arWrittenOffPairs = new Set();
    const systemicArHitEntities = new Set();
    const equityImpairedTxIds = new Set();
    const operationalMigPairs = new Set();
    const operationalStartQByTx = {};        // Tracks when operational outage began for each active supplier tx
    const nextQGrowthPenalty = {};
    const secondarySpreadBpsById = {};       // P1-2: Layer 4 secondary spread widening (bps)

    // Pre-compute historical baseline OCF calibration & insufficient-data flags
    const ocfCalibById = {};
    const hasCoreFinancials = {};
    entities.forEach(e => {
      const existingQ3 = e.financials?.["2026Q3"];
      const bridge = useAudit4Contracts ? e.audit4CashFlowBridge : null;
      const q3 = existingQ3 && bridge?.quarter === "2026Q3"
        ? { ...existingQ3, ocf: money(bridge.nineMonths.ocf - bridge.sixMonths.ocf) }
        : existingQ3;
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

    // 1. Historical Quarters (strict P0-1 PIT)
    QUARTERS_HIST.forEach(q => {
      const visTxs = getVisibleTransactions(transactions, q);
      const states = {};
      entities.forEach(e => {
        const snap = getHistoricalSnapshot(e, q, pointInTimeBacktest);
        snap.distressLevel = 0;
        snap.distressLabel = e.isOcean ? "External Pool (Non-Defaulting)" : (snap.insufficientData ? "Insufficient Data" : "Normal");
        snap.creditLoss = 0;
        snap.equityImpairment = 0;
        snap.lostReceipts = 0;
        snap.arCashHit = 0;
        snap.operationalCostHit = 0;
        snap.operationalRevDelay = 0;
        snap.secondaryFinancingHit = 0;
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
    const lastYear = Math.max(2028, Math.min(2040, Math.trunc(options.forecastThrough ?? 2028)));
    const forwardQs = [QUARTER_PARTIAL, ...QUARTERS_FORECAST];
    for (let year = 2029; year <= lastYear; year++) {
      for (let quarter = 1; quarter <= 4; quarter++) forwardQs.push(`${year}Q${quarter}`);
    }
    let prevStates = timeline["2026Q3"].entities;

    forwardQs.forEach((q, stepIdx) => {
      const status = q === QUARTER_PARTIAL ? "PARTIAL" : "FORECAST";
      const visibleTxs = getVisibleTransactions(transactions, q);
      const activeTxs = visibleTxs.filter(tx => isTransactionActive(tx, q));
      const states = {};
      let oceanUsedThisQ = 0;
      const financingLedger = {};
      const guaranteeLedger = {};
      if (useAudit4Contracts) {
        const tx = transactions.find(item => item.id === "TX11");
        if (tx && getTransactionLifecycle(tx, q).isVisible) {
          guaranteeLedger[tx.id] = phasedGuarantee(options.sbEnergyProjects ?? SB_ENERGY_SCENARIO, q,
            tx.totalCommitment, cumCreditLossByTx[tx.id] ?? 0);
        }
      }
      const revolving = transactions.filter(tx => /\bRCF\b/i.test(tx.collateral ?? "") && DEBT_TX_TYPES.includes(tx.type));
      const facilityByBorrower = {};
      const instruments = trackTermDebt ? transactions.filter(tx => DEBT_TX_TYPES.includes(tx.type)) : revolving;
      for (const tx of instruments) {
        const isRevolver = revolving.includes(tx);
        const knowsPrincipal = tx.amountDrawn != null || (tx.principalOutstanding != null &&
          compareQuarter(q, tx.principalAsOfQuarter) >= 0);
        if (!isRevolver && !knowsPrincipal) {
          if (isTransactionActive(tx, q)) financingLedger[tx.id] = {
            txId: tx.id, borrower: tx.receiver, lender: tx.payer, instrumentType: tx.type,
            beginningOutstanding: null, newDrawdown: 0, principalRepayment: 0,
            endingOutstanding: null, cumulativeDrawdown: null, remainingCommitment: null,
            undrawnCommitment: null, accruedInterest: null, defaultExposure: null,
            dataType: "Unavailable"
          };
          continue;
        }
        const active = isTransactionActive(tx, q);
        if (!active && !facilityBalances[tx.id] && !tx.exposureBasis) continue;
        const previous = facilityBalances[tx.id];
        const observed = computeTransactionEAD(tx, q, options);
        const beginning = previous?.endingOutstanding ?? observed.fundedEAD;
        const nonCashConversion = money(Math.min(beginning, nonnegative(tx.nonCashConversionByQuarter?.[q])));
        const cumulativeDrawdown = previous ? previous.cumulativeDrawdown : tx.amountDrawn ?? null;
        const remainingCommitment = cumulativeDrawdown === null ? tx.remainingCommitment ?? null
          : money(Math.max(0, nonnegative(tx.totalCommitment) - cumulativeDrawdown));
        const row = {
          txId: tx.id, borrower: tx.receiver, lender: tx.payer, instrumentType: tx.type, isRevolver,
          beginningOutstanding: beginning, dataType: "Forecast", exposureBasis: tx.exposureBasis ?? observed.eadBasis,
          newDrawdown: 0, principalRepayment: 0, nonCashConversion, endingOutstanding: money(beginning - nonCashConversion),
          remainingCommitment, cumulativeDrawdown,
          undrawnCommitment: active && tx.endQ !== q && !previous?.defaulted
            ? isRevolver ? money(Math.max(0, nonnegative(tx.totalCommitment) - beginning)) : remainingCommitment
            : 0,
          defaultExposure: previous?.defaultExposure ?? 0,
          defaulted: previous?.defaulted ?? false,
          accruedInterest: 0
        };
        financingLedger[tx.id] = row;
        (facilityByBorrower[tx.receiver] ??= []).push(row);
      }

      function drawFacilities(borrower, requested) {
        const rows = facilityByBorrower[borrower]?.filter(row => row.isRevolver);
        if (!rows?.length) return money(requested);
        const available = Object.fromEntries(rows.map(row => [row.txId, row.undrawnCommitment]));
        const allocation = allocateFunding(available, requested);
        for (const row of rows) {
          const draw = allocation[row.txId];
          row.newDrawdown = money(row.newDrawdown + draw);
          row.endingOutstanding = money(row.endingOutstanding + draw);
          row.cumulativeDrawdown = money(row.cumulativeDrawdown + draw);
          row.remainingCommitment = money(Math.max(0, row.remainingCommitment - draw));
          row.undrawnCommitment = money(row.undrawnCommitment - draw);
        }
        return money(Object.values(allocation).reduce((sum, draw) => sum + draw, 0));
      }

      // Decay prior growth penalties & secondary spreads by 50% each quarter
      Object.keys(nextQGrowthPenalty).forEach(id => {
        nextQGrowthPenalty[id] = Number((nextQGrowthPenalty[id] * 0.5).toFixed(4));
        if (Math.abs(nextQGrowthPenalty[id]) < 0.002) nextQGrowthPenalty[id] = 0;
      });
      Object.keys(secondarySpreadBpsById).forEach(id => {
        secondarySpreadBpsById[id] = Math.round(secondarySpreadBpsById[id] * 0.5);
        if (secondarySpreadBpsById[id] < 5) secondarySpreadBpsById[id] = 0;
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
            operationalCostHit: 0, operationalRevDelay: 0, secondaryFinancingHit: 0,
            inducedCapexCut: 0, rcfDraw: 0,
            requiredRevenue: null, fragilityScore: 0, fragilityDrivers: []
          };
          return;
        }

        // P1-1: Strict Insufficient Data protection!
        // Partial overrides (e.g. only revGrowth) MUST NOT bypass missing core financials.
        const ov = overrides[e.id];
        const overrideSuppliesCore = Boolean(ov && ov.cash !== undefined && ov.cash !== null && ov.revenue !== undefined && ov.revenue !== null);
        const isInsufficient = !e.lossAbsorbingInvestor && !hasCoreFinancials[e.id] && !overrideSuppliesCore;

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
            operationalCostHit: 0, operationalRevDelay: 0, secondaryFinancingHit: 0,
            inducedCapexCut: 0,
            fragilityScore: 0, fragilityDrivers: []
          };
          return;
        }

        const p = Object.assign({}, e.defaults || {}, ov || {});
        const disclosedOpening = e.id === "ANTHROPIC" && q === QUARTER_PARTIAL ? reportedAnthropic : null;
        const liquidityOpening = useAudit4Contracts && q === QUARTER_PARTIAL ? e.audit4Liquidity : null;
        const eligibleInvestments = liquidityOpening ? Math.max(0,
          liquidityOpening.currentInvestments - liquidityOpening.knownRestrictedWithinCurrentInvestments) : 0;
        const investmentSale = money(eligibleInvestments * Math.min(1, nonnegative(ov?.openingInvestmentSaleFraction)));
        const begCash = liquidityOpening ? liquidityOpening.cashAndEquivalents : disclosedOpening ? disclosedOpening.cashAtQ3 : prev.cash !== null && prev.cash !== undefined ? prev.cash : (ov && ov.cash !== undefined ? Number(ov.cash) : (p.minCash ? p.minCash * 2 : 1.0));
        const begDebt = disclosedOpening ? disclosedOpening.principalAtQ3 : prev.debt !== null && prev.debt !== undefined ? prev.debt : (ov && ov.debt !== undefined ? Number(ov.debt) : 0);
        const prevRev = prev.operationalBaselineRevenue ?? (prev.revenue !== null && prev.revenue !== undefined ? prev.revenue : (ov && ov.revenue !== undefined ? Number(ov.revenue) : Math.max(0.2, (p.opex || 0.2) * 1.6)));
        const facilities = facilityByBorrower[e.id];
        const revolvers = facilities?.filter(row => row.isRevolver);
        const hasNamedFacility = revolving.some(tx => tx.receiver === e.id && compareQuarter(q, tx.startQ) >= 0);
        let undrawn = hasNamedFacility
          ? money((revolvers ?? []).reduce((sum, row) => sum + row.undrawnCommitment, 0))
          : prev.undrawnCredit ?? 0;
        const loanPrincipal = tx => financingLedger[tx.id]?.beginningOutstanding ?? computeTransactionEAD(tx, q, options).fundedEAD;

        // Floating-rate debt share + Ocean base rate + L4 secondary spread wiring (strictly on ACTIVE debt txs!)
        const myDebtTxs = activeTxs.filter(tx => tx.receiver === e.id && DEBT_TX_TYPES.includes(tx.type));
        const floatingPrincipal = myDebtTxs.filter(tx => tx.isFloatingRate).reduce((s, tx) => s + loanPrincipal(tx), 0);
        const totalTxPrincipal = myDebtTxs.reduce((s, tx) => s + loanPrincipal(tx), 0);
        const floatShare = totalTxPrincipal > 0 ? Math.min(1, floatingPrincipal / totalTxPrincipal) : 0.35;

        const baseFixedRate = p.interestRate ?? 0.06;
        const oceanBaseRate = (ocean.interestRate ?? 7.5) / 100;
        const tightening = ((ocean.creditTighteningBps ?? 0) + (secondarySpreadBpsById[e.id] || 0)) / 10000;
        const effectiveRate = (1 - floatShare) * baseFixedRate + floatShare * Math.max(0.01, oceanBaseRate + tightening);
        const interestPaid = Number(((begDebt * effectiveRate) / 4).toFixed(4));
        const secondaryIntAdd = secondarySpreadBpsById[e.id]
          ? Number(((begDebt * floatShare * (secondarySpreadBpsById[e.id] / 10000)) / 4).toFixed(4))
          : 0;

        // Case H: GPU Collateral Haircut & LTV Trigger
        const gpuDebtTxs = myDebtTxs.filter(tx => tx.type === "GPU-backed Financing" || tx.type === "Equipment Financing");
        let gpuMarginCall = 0;
        let gpuRefiPenalty = 1.0;
        const openingFleet = fleets[e.id] ?? ov?.gpuRefresh?.cohorts ?? [];
        const fleetCollateral = openingFleet.reduce((sum, cohort) => {
          const age = Math.max(0, parseQuarterNumber(q) - parseQuarterNumber(cohort.acquired));
          const life = Math.max(1, 4 * (ov?.gpuRefresh?.economicLife ?? 5));
          const residual = Math.min(1, nonnegative(ov?.gpuRefresh?.residualValue));
          return sum + nonnegative(cohort.cost) * (1 - (1 - residual) * Math.min(1, age / life));
        }, 0);
        const fleetOriginalCost = openingFleet.reduce((sum, cohort) => sum + nonnegative(cohort.cost), 0);
        const effectiveHaircut = fleetOriginalCost > 0
          ? 1 - (1 - gpuCollateralHaircut) * fleetCollateral / fleetOriginalCost : gpuCollateralHaircut;
        if (effectiveHaircut > 0 && gpuDebtTxs.length > 0) {
          const baseLtv = 0.65;
          const stressedLtv = baseLtv / Math.max(0.2, 1 - effectiveHaircut);
          if (stressedLtv > 0.85) {
            const gpuDrawn = gpuDebtTxs.reduce((s, tx) => s + loanPrincipal(tx), 0);
            gpuMarginCall = Number((gpuDrawn * 0.12 * effectiveHaircut).toFixed(4));
            gpuRefiPenalty = Math.max(0.2, 1 - effectiveHaircut * 1.2);
          }
        }

        const availFactor = Math.max(0, Math.min(1, ocean.fundingAvailability / 100));
        const secRefiPenalty = secondarySpreadBpsById[e.id] ? Math.max(0.70, 1 - (secondarySpreadBpsById[e.id] / 1000)) : 1.0;
        const refiFactor = Math.max(0, Math.min(1, (p.refiSuccess ?? 0.85) * (ocean.refiSuccessRate / 100) * gpuRefiPenalty * secRefiPenalty));

        // 100% Maturity Wall with Refinancing Rollover (strictly on fundedEAD of maturing ACTIVE debt)
        const maturingPrincipal = myDebtTxs
          .filter(tx => tx.endQ === q && !financingLedger[tx.id]?.defaulted)
          .reduce((s, tx) => s + loanPrincipal(tx), 0);
        const refiRollover = Number((maturingPrincipal * availFactor * refiFactor).toFixed(4));
        const scheduledFacilityRepayments = Object.fromEntries((facilities ?? []).map(row => {
          const tx = transactions.find(item => item.id === row.txId);
          const requested = tx.endQ === q ? row.beginningOutstanding
            : nonnegative(options.facilityRepayments?.[tx.id]?.[q]);
          return [row.txId, row.defaulted ? 0 : Math.min(row.beginningOutstanding - row.nonCashConversion, requested)];
        }));
        const explicitRepayments = (facilities ?? []).reduce((sum, row) => {
          const tx = transactions.find(item => item.id === row.txId);
          return sum + (tx.endQ === q ? 0 : scheduledFacilityRepayments[row.txId]);
        }, 0);
        const nonCashDebtConversion = money((facilities ?? []).reduce((sum, row) => sum + row.nonCashConversion, 0));
        const principalRepay = money(Math.min(Math.max(0, begDebt - nonCashDebtConversion), (p.debtRepay ?? 0) + maturingPrincipal + explicitRepayments));
        let repaymentRoom = principalRepay;
        for (const row of facilities ?? []) {
          const tx = transactions.find(item => item.id === row.txId);
          row.accruedInterest = money(row.beginningOutstanding * effectiveRate / 4);
          row.principalRepayment = money(Math.min(scheduledFacilityRepayments[row.txId], repaymentRoom));
          repaymentRoom = money(repaymentRoom - row.principalRepayment);
          row.endingOutstanding = money(row.beginningOutstanding - row.nonCashConversion - row.principalRepayment);
          if (row.isRevolver && !row.defaulted && tx.endQ !== q && isTransactionActive(tx, q)) {
            row.undrawnCommitment = money(row.undrawnCommitment + row.principalRepayment);
          }
        }

        if (hasNamedFacility) undrawn = money((revolvers ?? []).reduce((sum, row) => sum + row.undrawnCommitment, 0));
        let contractualTermDraw = 0;
        for (const row of facilities ?? []) {
          if (row.isRevolver || row.undrawnCommitment == null || row.undrawnCommitment <= 0) continue;
          const tx = transactions.find(item => item.id === row.txId);
          if (tx.commitmentTerminationDate && quarterEndDate(q) > tx.commitmentTerminationDate) continue;
          const draw = money(Math.min(row.undrawnCommitment, nonnegative(options.facilityDrawdowns?.[row.txId]?.[q])));
          row.newDrawdown = draw;
          row.endingOutstanding = money(row.endingOutstanding + draw);
          if (row.cumulativeDrawdown !== null) row.cumulativeDrawdown = money(row.cumulativeDrawdown + draw);
          row.remainingCommitment = money(row.remainingCommitment - draw);
          row.undrawnCommitment = money(row.undrawnCommitment - draw);
          contractualTermDraw = money(contractualTermDraw + draw);
        }
        const forecastConfig = ov?.financing;
        const remaining = forecastConfig ? financingRemaining[e.id] ?? nonnegative(forecastConfig.capacity) : 0;
        const funding = forecastConfig ? scenarioFunding(forecastConfig, q, remaining, availFactor, refiFactor) : null;
        const assumedDebt = funding ? funding.amounts.debt + funding.amounts.assetBacked : (p.newDebt ?? 0) * availFactor * refiFactor;
        const requestedDebt = assumedDebt + refiRollover;
        const sharedDebtRoom = Math.max(0, ocean.maxCapacity - oceanUsedThisQ);
        const fundedRollover = funding ? Math.floor(Math.min(refiRollover, sharedDebtRoom) * 10000 + 1e-8) / 10000 : null;
        if (funding) {
          const debt = allocateFunding({ debt: funding.amounts.debt, assetBacked: funding.amounts.assetBacked },
            Math.max(0, sharedDebtRoom - fundedRollover));
          Object.assign(funding.amounts, debt);
        }
        const allowedDebt = funding ? money(fundedRollover + funding.amounts.debt + funding.amounts.assetBacked)
          : money(Math.max(0, Math.min(requestedDebt, sharedDebtRoom)));
        oceanUsedThisQ += allowedDebt;

        const scheduledEq = ov?.includeScheduledEquity === false ? 0 : (disclosedOpening?.estimatedNetProceeds ?? e.scheduledEquityInflows?.[q] ?? 0);
        const scheduledEquityStatus = disclosedOpening ? "Issuer estimate; full option exercise confirmed" : e.id === "ANTHROPIC" && q === "2026Q4" ? "Unverified legacy input" : "Scheduled model input";
        const assumedNonDebt = funding
          ? funding.amounts.equity + funding.amounts.strategic + funding.amounts.prepayment + funding.amounts.other
          : (p.equityInflow ?? 0) * availFactor;
        const equityInflow = money(scheduledEq + assumedNonDebt);
        const fundedScenarioDebt = funding ? money(funding.amounts.debt + funding.amounts.assetBacked) : 0;
        if (funding) financingRemaining[e.id] = money(Math.max(0, remaining - fundedScenarioDebt - assumedNonDebt));

        const fleetConfig = ov?.gpuRefresh;
        const refresh = fleetConfig
          ? fleetRefresh(fleets[e.id] ?? fleetConfig.cohorts ?? [], q, fleetConfig)
          : { replacementCapex: 0, disposalProceeds: 0 };
        const gpuPurchases = Math.min(nonnegative(p.capex), nonnegative(fleetConfig?.gpuPurchasesByQuarter?.[q]));
        if (fleetConfig) {
          fleets[e.id] = [...refresh.cohorts];
          if (gpuPurchases > 0) fleets[e.id].push({ acquired: q, cost: gpuPurchases });
        }
        const capex = money((p.capex ?? 0) + refresh.replacementCapex);
        const legacyLease = ov?.incrementalLease;
        const tranches = ov?.incrementalLeaseTranches ?? (legacyLease ? [legacyLease]
          : useAudit4Contracts && e.id === "ORCL" ? ORACLE_LEASE_SCENARIO : []);
        const leaseSchedule = incrementalLeaseSchedule(tranches, q, ov?.leaseDelayQuarters ?? 0);
        const leasePayment = leaseSchedule.payment;
        const grossMargin = Math.max(0.05, Math.min(0.98, p.grossMargin ?? 0.55));
        const cashConv = Math.max(0.3, Math.min(1.0, p.cashConv ?? 0.88));
        const minCash = p.minCash ?? 1.0;

        // Revenue Forecast: Mode A (strictly ACTIVE contracts!) vs Mode B
        const growthPen = nextQGrowthPenalty[e.id] || 0;
        const rawG = (p.revGrowth ?? 0.05) - (p.revDecel ?? 0.005) * stepIdx + growthPen;
        const boundedG = Math.max(-0.85, rawG);

        let projRev;
        if (p.mode === "A") {
          const incomingContractQ = activeTxs
            .filter(tx => tx.receiver === e.id && ["Cloud Computing Purchase","Take-or-Pay Contract","Data Center Lease","GPU / Server Purchase"].includes(tx.type))
            .reduce((s, tx) => s + (tx.quarterlyPayment || 0), 0);
          const rpoConversion = (prev.rpo || 0) * 0.02;
          const contractAnchor = incomingContractQ > 0 ? Math.max(incomingContractQ, rpoConversion) : prevRev * (1 + boundedG);
          projRev = Number(Math.max(0, 0.55 * contractAnchor + 0.45 * prevRev * (1 + boundedG)).toFixed(4));
        } else {
          projRev = Number(Math.max(0, prevRev * (1 + boundedG)).toFixed(4));
        }

        // Calibrated OCF
        const calib = ocfCalibById[e.id];
        const grossProfitCash = projRev * grossMargin * cashConv;
        let ocf;
        const incrementalCompute = ov?.computePay !== undefined ? Number(ov.computePay) : 0;
        const calibrated = Boolean(calib?.hasCalib && ov?.opex === undefined);
        const operatingCashCosts = (calibrated ? calib.impliedFixedOpCash : money(p.opex ?? 0)) + incrementalCompute + interestPaid;
        const taxThreshold = calibrated ? calib.baseRev * grossMargin * cashConv - calib.impliedFixedOpCash : 0;
        const marginalTaxRate = calibrated ? 0.15 : 0.18;
        if (calibrated) {
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

        ocf = money(ocf - leasePayment);
        const fcf = Number((ocf - capex).toFixed(4));
        const ocfBeforeLeaseTarget = capex + leasePayment;
        const preTaxTarget = ocfBeforeLeaseTarget <= taxThreshold ? ocfBeforeLeaseTarget
          : (ocfBeforeLeaseTarget - marginalTaxRate * taxThreshold) / (1 - marginalTaxRate);
        const fcfBreakEvenRevenue = money(Math.max(0, (preTaxTarget + operatingCashCosts) / (grossMargin * cashConv)));
        const minimumRequiredRevenueGrowth = prevRev > 0 ? money(fcfBreakEvenRevenue / prevRev - 1) : null;
        const totalCashOblig = (p.opex ?? 0) + capex + interestPaid + principalRepay + gpuMarginCall + leasePayment;
        const requiredRev = Math.max(0, (totalCashOblig + minCash - begCash - allowedDebt - equityInflow - undrawn * 0.5) / Math.max(0.1, grossMargin * cashConv));

        // Exact Accounting Conservation + Auto-RCF Drawdown
        const preDrawCash = Number((begCash + ocf - capex + allowedDebt + contractualTermDraw + equityInflow - principalRepay - gpuMarginCall + refresh.disposalProceeds + investmentSale).toFixed(4));
        let rcfDraw = 0;
        let endCash = preDrawCash;
        let undrawnAfter = undrawn;
        if (preDrawCash < 0 && undrawn > 0) {
          rcfDraw = drawFacilities(e.id, Math.min(-preDrawCash, undrawn));
          endCash = Number((preDrawCash + rcfDraw).toFixed(4));
          undrawnAfter = Number(Math.max(0, undrawn - rcfDraw).toFixed(4));
        }
        const endDebt = Number(Math.max(0, begDebt + allowedDebt + contractualTermDraw + rcfDraw - principalRepay - nonCashDebtConversion).toFixed(4));

        states[e.id] = {
          quarter: q,
          mode: p.mode || "B",
          revenue: projRev,
          requiredRevenue: Number(requiredRev.toFixed(2)),
          fcfBreakEvenRevenue,
          minimumRequiredRevenueGrowth,
          priorQuarterRevenue: prevRev,
          begCash: Number(begCash.toFixed(4)),
          cash: endCash,
          debt: endDebt,
          ocf,
          capex,
          fcf,
          interestExp: interestPaid,
          principalRepay,
          nonCashDebtConversion,
          gpuMarginCall,
          computePay: incrementalCompute,
          newDebt: money(allowedDebt + contractualTermDraw),
          contractualTermDraw,
          assumedNewDebt: funding ? fundedScenarioDebt : null,
          financingForecast: funding ? { ...funding, fundedDebt: fundedScenarioDebt, remainingCapacity: financingRemaining[e.id], scheduledEquity: scheduledEq, scheduledEquityStatus, fundedRollover, rcfDraw } : null,
          replacementCapex: refresh.replacementCapex,
          disposalProceeds: refresh.disposalProceeds,
          openingInvestmentSale: investmentSale,
          openingLiquidityDisclosure: liquidityOpening || null,
          incrementalLeasePayment: leasePayment,
          leaseSchedule,
          gpuPurchases,
          gpuCollateralValue: fleetOriginalCost > 0 ? money(fleetCollateral) : null,
          gpuAccountingLife: fleetConfig?.accountingLife ?? null,
          gpuPhysicalLife: fleetConfig?.physicalLife ?? null,
          gpuEconomicLife: fleetConfig?.economicLife ?? null,
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
          defaultCause: null,
          isSimulatedEvent: false,
          creditLoss: 0,
          equityImpairment: 0,
          lostReceipts: 0,
          arCashHit: 0,
          operationalCostHit: 0,
          operationalRevDelay: 0,
          secondaryFinancingHit: secondaryIntAdd,
          inducedCapexCut: 0
        };
      });

      function applyCashDelta(id, ocfDelta, capexDelta = 0) {
        const st = states[id];
        if (!st || isPoolId(id) || st.insufficientData) return;
        st.ocf = Number((st.ocf + ocfDelta).toFixed(4));
        const previousCapex = st.capex;
        st.capex = Number(Math.max(st.replacementCapex ?? 0, st.capex + capexDelta).toFixed(4));
        st.fcf = Number((st.ocf - st.capex).toFixed(4));
        const netDelta = ocfDelta - (st.capex - previousCapex);
        let newCash = Number((st.cash + netDelta).toFixed(4));
        if (newCash < 0 && st.undrawnCredit > 0) {
          const extraDraw = drawFacilities(id, Math.min(-newCash, st.undrawnCredit));
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
          st.defaultCause = null;
          st.isSimulatedEvent = false;
          return;
        }
        const mandatoryNextQ = (st.interestExp || 0) + (st.principalRepay || 0);
        const totalLiq = (st.cash || 0) + (st.undrawnCredit || 0);

        if (forcedDefaults.has(entityId)) {
          st.distressLevel = 3;
          st.distressLabel = "Level 3: Simulated Default";
          st.defaultCause = "Forced Scenario Default";
          st.isSimulatedEvent = true;
        } else if (totalLiq < 0) {
          st.distressLevel = 3;
          st.distressLabel = "Level 3: Simulated Default";
          st.defaultCause = `Liquidity Exhausted (Cash+RCF=${totalLiq.toFixed(2)}B < 0)`;
          st.isSimulatedEvent = true;
        } else if (totalLiq < mandatoryNextQ && mandatoryNextQ > 0) {
          st.distressLevel = 2;
          st.distressLabel = "Level 2: Liquidity Crisis";
          st.defaultCause = `Debt Service Shortfall (Liq=${totalLiq.toFixed(2)}B < Oblig=${mandatoryNextQ.toFixed(2)}B)`;
          st.isSimulatedEvent = true;
        } else if (st.cash < st.minCash) {
          st.distressLevel = 1;
          st.distressLabel = "Level 1: Liquidity Warning";
          st.defaultCause = null;
          st.isSimulatedEvent = false;
        } else {
          st.distressLevel = 0;
          st.distressLabel = "Normal";
          st.defaultCause = null;
          st.isSimulatedEvent = false;
        }
      }

      entities.forEach(e => evaluateDistress(e.id));

      // Step 2B: Dynamic Multi-Hop 4-Layer Contagion (strictly on activeTxs!)
      const contagionLog = [];
      const propagatedDefaults = new Set();
      const propagatedCrisisCuts = new Set();
      const secondaryHitPeersThisQ = new Set();
      const cloudRevLossThisQ = {};
      const directHwCutByCloudThisQ = {};

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
          activeTxs.forEach(tx => {
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

        // Level 3 Defaults across Layers 1, 2, 3, and 4
        newDefaulters.forEach(defId => {
          propagatedDefaults.add(defId);

          activeTxs.forEach(tx => {
            // Layer 2 (Commercial) + Layer 1 (AR Bad-Debt): Defaulter is PAYER (Customer Defaults -> Supplier Loses Revenue & AR)
            if (tx.payer === defId && OPERATIONAL_TX_TYPES.includes(tx.type)) {
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

            // P0-4 Layer 3 (Operational Contagion): Defaulter is RECEIVER (Supplier/OEM/Cooling/DC/Power Defaults -> Downstream Customer!)
            // Covers ALL 7 service categories, including undisclosed-value contracts via operationalExposureShare
            if (tx.receiver === defId && OPERATIONAL_TX_TYPES.includes(tx.type)) {
              const custId = tx.payer;
              if (isPoolId(custId) || !states[custId] || states[custId].insufficientData) return;
              const cust = states[custId];
              const opCat = tx.operationalCategory || tx.type;
              const subAvail = tx.substitutionAvailability ?? 0.60;
              const switchWks = tx.switchingTimeWeeks ?? 12;
              const costPrem = tx.replacementCostPremium ?? 0.25;
              const disruptionMult = tx.disruptionMode === "FULL" ? 1.0 : 0.70;
              const friction = Math.max(0.05, 1 - subAvail);

              // Anchor operational exposure: disclosed quarterlyPayment if > 0; else operationalExposureShare * customer CapEx/Rev
              const qPay = tx.quarterlyPayment || (tx.totalCommitment ? tx.totalCommitment / 20 : 0);
              const opBase = qPay > 0
                ? qPay
                : Number(Math.max(0.05, ((cust.capex > 0 ? cust.capex : cust.revenue * 0.25) || 0.5) * (tx.operationalExposureShare || 0.04)).toFixed(4));

              if (operationalStartQByTx[tx.id] === undefined) {
                operationalStartQByTx[tx.id] = stepIdx;
              }

              // One-time migration / switching cost cash outflow (strictly L3_OPERATIONAL, never double-counted with L1)
              const migKey = `${defId}->${custId}:${tx.id}`;
              if (opBase > 0 && !operationalMigPairs.has(migKey)) {
                operationalMigPairs.add(migKey);
                const migCost = Number((opBase * costPrem * friction).toFixed(4));
                if (migCost > 0) {
                  cust.operationalCostHit = Number((cust.operationalCostHit + migCost).toFixed(4));
                  applyCashDelta(custId, -migCost, 0);
                  contagionLog.push({
                    hop, layer: "L3_OPERATIONAL", operationalCategory: opCat,
                    from: defId, to: custId, txId: tx.id,
                    channel: `L3 Operational (${opCat}): Switching/Migration Cost (Sub ${Math.round(subAvail * 100)}%)`,
                    impactB: migCost
                  });
                }
              }

              // Temporary revenue/capacity disruption during switching window (decays 50%/qtr, recovers after switchQuarters)
              const quartersElapsed = stepIdx - operationalStartQByTx[tx.id];
              const switchQuarters = Math.min(4, Math.max(1, Math.ceil(switchWks / 13)));
              if (opBase > 0 && quartersElapsed < switchQuarters) {
                const decay = Math.pow(0.5, quartersElapsed);
                const revDelay = Number((opBase * Math.min(1, switchWks / 13) * friction * 0.45 * disruptionMult * decay).toFixed(4));
                if (revDelay > 0) {
                  const lostCapacityRevenue = money(Math.min(cust.revenue, revDelay));
                  const recoveryRate = Math.min(1, nonnegative(overrides[custId]?.operationalRecoveryRate ?? 0.75));
                  const deferred = money(lostCapacityRevenue * recoveryRate);
                  const cashFactor = cust.grossMargin * cust.cashConv;
                  cust.operationalRevDelay = money(cust.operationalRevDelay + deferred);
                  cust.operationalPermanentRevenueLoss = money((cust.operationalPermanentRevenueLoss ?? 0) + lostCapacityRevenue - deferred);
                  cust.operationalCapacityRevenueImpact = money((cust.operationalCapacityRevenueImpact ?? 0) + lostCapacityRevenue);
                  cust.operationalBaselineRevenue = money((cust.operationalBaselineRevenue ?? cust.revenue) - (lostCapacityRevenue - deferred));
                  cust.revenue = money(cust.revenue - lostCapacityRevenue);
                  applyCashDelta(custId, -lostCapacityRevenue * cashFactor);
                  if (deferred > 0) deferredRevenue.push({
                    txId: tx.id, customer: custId, due: operationalStartQByTx[tx.id] + switchQuarters,
                    amount: deferred, cashFactor
                  });
                  contagionLog.push({
                    hop, layer: "L3_OPERATIONAL", operationalCategory: opCat,
                    from: defId, to: custId, txId: tx.id,
                    channel: `L3 Operational (${opCat}): Capacity/Service Disruption (${switchWks}w switch)`,
                    impactB: revDelay
                  });
                }
              }
              evaluateDistress(custId);
            }

            // P0-3 Layer 1 (Direct Financial): TRUE ONE-TIME Debt Credit Loss using computeTransactionEAD
            if (tx.receiver === defId && DEBT_TX_TYPES.includes(tx.type)) {
              if (defaultedTxIds.has(tx.id)) return;
              const lenderId = tx.payer;
              if (!states[lenderId]) return;
              const row = financingLedger[tx.id];
              const eadInfo = row && row.endingOutstanding !== null
                ? computeTransactionEAD({ ...tx, principalOutstanding: row.endingOutstanding,
                    principalAsOfQuarter: q, remainingCommitment: row.isRevolver ? 0 : row.undrawnCommitment },
                    q, { lgd, guaranteeCallRate })
                : computeTransactionEAD(tx, q, { lgd, guaranteeCallRate });
              if (row && row.endingOutstanding !== null) {
                row.defaultExposure = eadInfo.totalEAD;
                row.defaulted = true;
                row.undrawnCommitment = 0;
              }
              const cLoss = eadInfo.creditLossAtDefault;
              if (cLoss > 0) {
                defaultedTxIds.add(tx.id);
                cumCreditLossByTx[tx.id] = cLoss;
                creditEvents.push({
                  defaultEventId: `DEF-${q}-${tx.id}`,
                  quarter: q,
                  txId: tx.id,
                  borrower: defId,
                  lender: lenderId,
                  type: tx.type,
                  fundedEAD: eadInfo.fundedEAD,
                  undrawnEAD: eadInfo.undrawnEAD,
                  guaranteeEAD: 0,
                  totalEAD: eadInfo.totalEAD,
                  lgd: eadInfo.lgd,
                  recognizedLoss: cLoss,
                  expectedRecovery: Number((eadInfo.totalEAD - cLoss).toFixed(4)),
                  remainingExposure: 0,
                  eadBasis: eadInfo.eadBasis
                });
                states[lenderId].creditLoss = Number((states[lenderId].creditLoss + cLoss).toFixed(4));
                evaluateDistress(lenderId);
                contagionLog.push({
                  hop, layer: "L1_FINANCIAL", from: defId, to: lenderId, txId: tx.id,
                  channel: `L1 Direct Financial: ${tx.type} Credit Loss (EAD $${eadInfo.totalEAD.toFixed(2)}B x ${Math.round(eadInfo.lgd * 100)}% LGD)`,
                  impactB: cLoss
                });
              }
            }

            // P0-5 Layer 1 (Direct Financial): Dynamic Phased Guarantee Call (fires ONCE when active!)
            if (tx.receiver === defId && tx.type === "Loan Guarantee") {
              if (defaultedTxIds.has(tx.id)) return;
              const guarId = tx.payer;
              if (isPoolId(guarId) || !states[guarId] || states[guarId].insufficientData) return;
              const scenario = guaranteeLedger[tx.id];
              const exposure = scenario?.remainingGuaranteeLiability;
              const eadInfo = exposure === undefined
                ? computeTransactionEAD(tx, q, { lgd, guaranteeCallRate })
                : { guaranteeEAD: exposure, totalEAD: exposure, lgd: guaranteeCallRate,
                    creditLossAtDefault: money(exposure * guaranteeCallRate), eadBasis: "Project phase scenario" };
              const callAmt = eadInfo.creditLossAtDefault;
              if (callAmt > 0) {
                defaultedTxIds.add(tx.id);
                cumCreditLossByTx[tx.id] = callAmt;
                creditEvents.push({
                  defaultEventId: `GUAR-${q}-${tx.id}`,
                  quarter: q,
                  txId: tx.id,
                  borrower: defId,
                  lender: guarId,
                  type: tx.type,
                  fundedEAD: 0,
                  undrawnEAD: 0,
                  guaranteeEAD: eadInfo.guaranteeEAD,
                  totalEAD: eadInfo.totalEAD,
                  lgd: eadInfo.lgd,
                  recognizedLoss: callAmt,
                  expectedRecovery: Number((eadInfo.guaranteeEAD - callAmt).toFixed(4)),
                  remainingExposure: 0,
                  eadBasis: eadInfo.eadBasis
                });
                states[guarId].creditLoss = Number((states[guarId].creditLoss + callAmt).toFixed(4));
                applyCashDelta(guarId, -callAmt, 0);
                evaluateDistress(guarId);
                contagionLog.push({
                  hop, layer: "L1_FINANCIAL", from: defId, to: guarId, txId: tx.id,
                  channel: `L1 Direct Financial: Guarantee Call (Active Exposure $${eadInfo.guaranteeEAD.toFixed(2)}B x ${Math.round(eadInfo.lgd * 100)}%)`,
                  impactB: callAmt
                });
              }
            }

            // Layer 1 (Direct Financial): Non-Cash Equity Impairment (One-Time)
            if (tx.receiver === defId && tx.type === "Equity Investment" && !equityImpairedTxIds.has(tx.id)) {
              const invId = tx.payer;
              if (!isPoolId(invId) && states[invId]) {
                const eqAmt = (tx.amountDrawn !== null && tx.amountDrawn !== undefined && tx.amountDrawn > 0) ? tx.amountDrawn : (tx.totalCommitment || 0);
                if (eqAmt > 0) {
                  equityImpairedTxIds.add(tx.id);
                  const imp = Number((eqAmt * 0.80).toFixed(4));
                  states[invId].equityImpairment = Number((states[invId].equityImpairment + imp).toFixed(4));
                  contagionLog.push({ hop, layer: "L1_FINANCIAL", from: defId, to: invId, txId: tx.id, channel: `L1 Direct Financial: Non-Cash Equity Impairment`, impactB: imp });
                }
              }
            }
          });

          // P1-2 Layer 4 (Secondary Market Contagion):
          // Default of a leveraged AI infra/lab/cloud issuer widens secondary spreads for leveraged peers
          // (bounded +100 bps next-quarter refinancing spread, zero double-counting of L1/L2/L3 losses)
          if (enableSecondaryContagion) {
            const defEnt = entityById[defId];
            entities.forEach(peer => {
              if (peer.id === defId || peer.isOcean || peer.lossAbsorbingInvestor) return;
              if (secondaryHitPeersThisQ.has(peer.id)) return;
              const pst = states[peer.id];
              if (!pst || pst.insufficientData || pst.debt <= 1.0) return;
              const sameTier = peer.type === defEnt.type || (peer.isCloudOrNeocloud && defEnt.isCloudOrNeocloud);
              const peerLiq = Math.max(0.5, (pst.cash || 0) + (pst.undrawnCredit || 0));
              const highLeverage = (pst.debt / peerLiq) >= 1.5;
              if (sameTier && highLeverage) {
                secondaryHitPeersThisQ.add(peer.id);
                const spreadWideningBps = 100; // +100 bps secondary market spread shock
                secondarySpreadBpsById[peer.id] = Math.min(250, (secondarySpreadBpsById[peer.id] || 0) + spreadWideningBps);
                const quarterlySpreadCost = Number(((pst.debt * 0.35 * (spreadWideningBps / 10000)) / 4).toFixed(4));
                if (quarterlySpreadCost > 0) {
                  pst.secondaryFinancingHit = Number((pst.secondaryFinancingHit + quarterlySpreadCost).toFixed(4));
                  applyCashDelta(peer.id, -quarterlySpreadCost, 0);
                  evaluateDistress(peer.id);
                  contagionLog.push({
                    hop: Math.min(5, hop + 1),
                    layer: "L4_SECONDARY",
                    from: defId,
                    to: peer.id,
                    txId: "L4_SPREAD",
                    channel: `L4 Secondary Contagion: Peer Credit Spread Widening (+${spreadWideningBps} bps)`,
                    impactB: quarterlySpreadCost
                  });
                }
              }
            });
          }
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

              const pctHit = revHit / prevHwRev;
              nextQGrowthPenalty[hw.id] = Math.max(-0.25, (nextQGrowthPenalty[hw.id] || 0) - pctHit * 0.85);

              evaluateDistress(hw.id);
              contagionLog.push({ hop: Math.min(5, hop + 1), layer: "L2_COMMERCIAL", from: "CLOUD_CAPEX_CUT", to: hw.id, txId: "A3_CAPEX", channel: `L2 Commercial: Induced Cloud CapEx Cut (Net of A1)`, impactB: revHit });
            }
          });
        }
      }

      for (const entry of deferredRevenue) {
        if (entry.due !== stepIdx) continue;
        const customer = states[entry.customer];
        if (!customer || customer.insufficientData) continue;
        customer.operationalRecoveryRevenue = money((customer.operationalRecoveryRevenue ?? 0) + entry.amount);
        customer.operationalBaselineRevenue ??= customer.revenue;
        customer.revenue = money(customer.revenue + entry.amount);
        applyCashDelta(entry.customer, entry.amount * entry.cashFactor);
        evaluateDistress(entry.customer);
      }
      for (const row of Object.values(financingLedger)) {
        if (row.endingOutstanding !== null) facilityBalances[row.txId] = row;
      }
      for (const [id, guarantee] of Object.entries(guaranteeLedger)) {
        guarantee.calledGuarantee = cumCreditLossByTx[id] ?? 0;
        guarantee.remainingGuaranteeLiability = money(Math.max(0, guarantee.effectiveExposure - guarantee.calledGuarantee));
      }

      entities.forEach(e => {
        const state = states[e.id];
        if (!state.insufficientData && Number.isFinite(state.cash) && Number.isFinite(state.fcf)) {
          const minimumCash = overrides[e.id]?.minCash ?? e.defaults?.minCash ?? 1;
          const burn = Math.max(0, -state.fcf);
          state.quarterlyCashBurn = burn;
          state.monthlyCashBurn = money(burn / 3);
          state.availableLiquidity = money(Math.max(0, state.cash + (state.undrawnCredit ?? 0)));
          state.requiredFinancing = money(Math.max(0, minimumCash - state.cash - (state.undrawnCredit ?? 0)));
          const newFinancing = (state.newDebt ?? 0) + (state.rcfDraw ?? 0) + (state.equityInflow ?? 0);
          const obligations = (state.principalRepay ?? 0) + (state.interestExp ?? 0);
          const cashBeforeDebtService = state.ocf + (state.interestExp ?? 0);
          state.debtServiceCoverage = obligations > 0 ? money(cashBeforeDebtService / obligations) : null;
          const cashUses = burn + (state.principalRepay ?? 0) + (state.gpuMarginCall ?? 0);
          state.financingDependency = cashUses > 0 ? money(newFinancing / cashUses) : null;
          state.revenueGrowth = state.priorQuarterRevenue > 0 ? money(state.revenue / state.priorQuarterRevenue - 1) : null;
          state.cashRunwayMonths = burn > 0 ? money(3 * Math.max(0, state.cash - minimumCash) / burn) : null;
          state.fundingGap = money(Math.max(0, minimumCash - state.cash));
          const summary = scenarioSummary[e.id] ??= { defaultQuarter: null, breakEvenQuarter: null };
          if (state.distressLevel === 3) summary.defaultQuarter ??= q;
          if (state.fcf >= 0) summary.breakEvenQuarter ??= q;
        }
        const frag = computeFragilityScore(e, states[e.id], ocean, visibleTxs);
        states[e.id].fragilityScore = frag.score;
        states[e.id].fragilityDrivers = frag.drivers;
      });

      const debtReconciliation = {};
      for (const entity of entities) {
        const state = states[entity.id];
        if (!Number.isFinite(state.debt) || entity.isOcean || state.insufficientData) continue;
        const rows = facilityByBorrower[entity.id] ?? [];
        const namedRevolverPrincipal = money(rows.filter(row => row.isRevolver)
          .reduce((sum, row) => sum + row.endingOutstanding, 0));
        const namedTermPrincipal = money(rows.filter(row => !row.isRevolver)
          .reduce((sum, row) => sum + row.endingOutstanding, 0));
        const unattributedDebt = money(state.debt - namedRevolverPrincipal - namedTermPrincipal);
        debtReconciliation[entity.id] = {
          modeledDebt: state.debt, namedRevolverPrincipal, namedTermPrincipal, unattributedDebt,
          coverage: unattributedDebt < 0 ? "Overallocated: review debt classification"
            : unattributedDebt > 0 ? "Partial instrument coverage" : "Reconciled"
        };
      }
      timeline[q] = { quarter: q, status, entities: states, contagionLog, financingLedger, guaranteeLedger, debtReconciliation };
      prevStates = states;
    });

    const parentSpvReconciliation = reconcileParentSpvDebt(entities, transactions);
    return { timeline, allQuarters: [...QUARTERS_HIST, ...forwardQs], scenarioSummary, cumCreditLossByTx, creditEvents, parentSpvReconciliation };
  }

  return {
    QUARTERS_HIST,
    QUARTER_PARTIAL,
    QUARTERS_FORECAST,
    ALL_QUARTERS,
    DEBT_TX_TYPES,
    OPERATIONAL_TX_TYPES,
    quarterEndDate,
    quarterStatus,
    compareQuarter,
    getTransactionLifecycle,
    isTransactionActive,
    getVisibleTransactions,
    getActiveGuaranteeExposure,
    computeTransactionEAD,
    getHistoricalSnapshot,
    reconcileParentSpvDebt,
    analyzeConnectivity,
    getEdgeVisual,
    computeFragilityScore,
    computeEntityMetrics,
    financingForecast,
    fleetRefresh,
    incrementalLeaseSchedule,
    phasedGuarantee,
    runSimulation
  };
});
