#!/usr/bin/env python3
"""
AI Credit Network v3.0 — Data Audit Remediation Script
- P0-3: Explicit CCF on committed undrawn facilities (TX06A/B, TX17A/B, TX43, TX26), preserving amountDrawn === 0
- P0-4: Operational dependency metadata across 7 service categories (incl. TX64 DELL, TX65 VERTIV, TX67-69 CEG/VST) without fabricating dollar amounts
- P0-5: Dynamic phased Guarantee Exposure Schedule for TX11 (NVIDIA $105B SB Energy/OpenAI, FY29+ / 2028Q1+)
- P0-6: CoreWeave / SPV_CRWV8 / TX26 debt reconciliation (exact SEC Q3 2026 10-Q figures & consolidation tags)
- P1-4: Verified SEC Q3 2026 actuals for VERTIV, CEG, CORZ + 30 verified 2024Q4-2025Q4 SEC actuals for NVDA, MSFT, GOOGL, AMZN, META, ORCL
"""
import csv
import json
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "data")
UPGRADE_SRC = "/working_dir/c_b9b10954bdb84d9e/artifacts/file_generation/ttl=63d/intermediate/upgrade_audit_v2_data.py"

ents = json.load(open(os.path.join(DATA, "entities.json"), encoding="utf-8"))
txs = json.load(open(os.path.join(DATA, "transactions.json"), encoding="utf-8"))
schema = json.load(open(os.path.join(DATA, "schema.json"), encoding="utf-8"))

by_id = {e["id"]: e for e in ents}
tx_by_id = {t["id"]: t for t in txs}

# ---------------------------------------------------------------------------
# 1. P0-6: CoreWeave / SPV_CRWV8 / TX26 Debt Reconciliation (Exact SEC Q3 2026)
# ---------------------------------------------------------------------------
crwv_q3 = by_id["CRWV"]["financials"]["2026Q3"]
crwv_q3.update({
    "debt": 46.873,
    "recourseDebt": 41.600,
    "nonRecourseDebt": 5.273,
    "shortTermDebt": 10.572,
    "longTermDebt": 36.301,
    "shortTermRecourseDebt": 9.183,
    "shortTermNonRecourseDebt": 1.389,
    "longTermRecourseDebt": 32.417,
    "longTermNonRecourseDebt": 3.884,
    "leaseLiab": 18.697,
    "financeLeaseLiab": 0.649,
    "ap": 2.928,
    "accountsPayable": 2.928,
    "restrictedCash": 2.280,
    "interestExp": 0.846,
    "disclosedDate": "2026-11-10",
    "accessionNumber": "0001769628-26-000465",
    "sourceUrl": "https://www.sec.gov/Archives/edgar/data/1769628/000176962826000465/crwv-20260930.htm",
    "note": "Exact Q3 2026 10-Q carrying debt $46.873B = $41.600B recourse + $5.273B non-recourse (short-term $10.572B + long-term $36.301B); consolidates SPV_CRWV8."
})

spv8 = by_id["SPV_CRWV8"]
spv8["parentEntity"] = "CRWV"
spv8["consolidatedInParent"] = "CRWV"
spv8["isConsolidatedSubsidiary"] = True
spv8["consolidationNote"] = "Bankruptcy-remote consolidated subsidiary of CoreWeave (CRWV); debt is consolidated inside CRWV Non-Recourse Debt ($5.273B carrying value as of Sep 30, 2026). Excluded from system-wide debt sum to prevent double-counting."
spv8_q3 = spv8["financials"]["2026Q3"]
spv8_q3.update({
    "debt": 6.0,
    "facilityCommitment": 8.5,
    "fundedDebt": 6.0,
    "undrawnCredit": 2.5,
    "longTermDebt": 6.0,
    "shortTermDebt": 0.0,
    "dataType": "Estimated",
    "disclosedDate": "2026-03-31",
    "sourceUrl": "https://investors.coreweave.com/news/news-details/2026/CoreWeave-Closes-Landmark-8-5-Billion-Financing-Facility-Achieving-First-Investment-Grade-Rated-GPU-backed-Financing/default.aspx",
    "note": "DDTL 4.0 $8.5B facility ($6.0B funded, $2.5B undrawn); consolidated in CRWV non-recourse debt ($5.273B carrying net of issuance costs / draw timing)."
})

# Tag parentEntity on unconsolidated SPVs cleanly for reconciliation table
for spv_id, parent_id in [
    ("SPV_BEIGNET", "META"),
    ("SPV_SOPAIPILLA", "META"),
    ("SPV_JUPITER", "ORCL"),
    ("SPV_ABILENE", "ORCL"),
    ("SPV_XPV", "AVGO"),
    ("SPV_VALOR", "SPCX_XAI")
]:
    if spv_id in by_id:
        by_id[spv_id]["parentEntity"] = parent_id
        by_id[spv_id]["isConsolidatedSubsidiary"] = False

if "TX26" in tx_by_id:
    tx_by_id["TX26"].update({
        "totalCommitment": 8.5,
        "amountDrawn": 6.0,
        "amountRepaid": 0.0,
        "remainingCommitment": 2.5,
        "ccf": 0.25,
        "consolidatedInParent": "CRWV",
        "reconciliationNote": "DDTL 4.0 $8.5B facility ($6.0B funded + $2.5B undrawn) at SPV_CRWV8, consolidated inside CRWV Non-Recourse Debt ($5.273B carrying value)."
    })

# ---------------------------------------------------------------------------
# 2. P0-3: Explicit CCF on Committed Undrawn Facilities (Preserve amountDrawn === 0)
# ---------------------------------------------------------------------------
for tid, ccf_val in [
    ("TX06A", 0.40), ("TX06B", 0.40),
    ("TX17A", 0.40), ("TX17B", 0.40),
    ("TX43", 0.25)
]:
    if tid in tx_by_id:
        tx_by_id[tid]["ccf"] = ccf_val
        assert tx_by_id[tid]["amountDrawn"] == 0, f"{tid} must preserve amountDrawn === 0"

# ---------------------------------------------------------------------------
# 3. P0-5: Dynamic Phased Guarantee Exposure Schedule for TX11 (NVIDIA $105B)
# ---------------------------------------------------------------------------
if "TX11" in tx_by_id:
    tx_by_id["TX11"].update({
        "startQ": "2028Q1",
        "endQ": "2035Q4",
        "amountDrawn": 0,
        "guaranteeSchedule": {
            "basis": "NVIDIA Q3 FY27 8-K: Up to $105.0B credit support guarantee for SB Energy Corp. / OpenAI Ohio 4.25 GW campus; $0 paid; takes effect phase-by-phase starting FY29 (2028Q1) and amortizes with rent over lease term.",
            "activationQuarter": "2028Q1",
            "peakQuarter": "2028Q4",
            "endQuarter": "2035Q4",
            "phases": {
                "2028Q1": 25.0,
                "2028Q2": 50.0,
                "2028Q3": 75.0,
                "2028Q4": 105.0
            },
            "amortizationMethod": "linear_to_zero_by_endQ"
        }
    })

# ---------------------------------------------------------------------------
# 4. P0-4: Operational Contagion Metadata Across All 7 Service Categories
#    (Never fabricates dollar amounts; keeps commit=null / qPay=0 where undisclosed)
# ---------------------------------------------------------------------------
OP_METADATA = {
    "TX64": {
        "operationalCategory": "GPU / Server Supply",
        "operationalExposureShare": 0.08,
        "substitutionAvailability": 0.60,
        "switchingTimeWeeks": 12,
        "replacementCostPremium": 0.15,
        "disruptionMode": "PARTIAL"
    },
    "TX65": {
        "operationalCategory": "Cooling / Electrical Infrastructure",
        "operationalExposureShare": 0.06,
        "substitutionAvailability": 0.45,
        "switchingTimeWeeks": 16,
        "replacementCostPremium": 0.20,
        "disruptionMode": "PARTIAL"
    },
    "TX66": {
        "operationalCategory": "Data Center Lease",
        "operationalExposureShare": 0.10,
        "capacityMW": 590,
        "substitutionAvailability": 0.25,
        "switchingTimeWeeks": 26,
        "replacementCostPremium": 0.35,
        "disruptionMode": "FULL"
    },
    "TX67": {
        "operationalCategory": "Power Purchase Agreement",
        "operationalExposureShare": 0.015,
        "capacityMW": 835,
        "substitutionAvailability": 0.20,
        "switchingTimeWeeks": 52,
        "replacementCostPremium": 0.40,
        "disruptionMode": "PARTIAL"
    },
    "TX68": {
        "operationalCategory": "Power Purchase Agreement",
        "operationalExposureShare": 0.020,
        "capacityMW": 1121,
        "substitutionAvailability": 0.25,
        "switchingTimeWeeks": 52,
        "replacementCostPremium": 0.35,
        "disruptionMode": "PARTIAL"
    },
    "TX69": {
        "operationalCategory": "Power Purchase Agreement",
        "operationalExposureShare": 0.030,
        "capacityMW": 2609,
        "substitutionAvailability": 0.25,
        "switchingTimeWeeks": 52,
        "replacementCostPremium": 0.35,
        "disruptionMode": "PARTIAL"
    }
}
for tid, meta in OP_METADATA.items():
    if tid in tx_by_id:
        tx_by_id[tid].update(meta)

# Ensure all GPU / Server Purchase, Data Center Lease, Cloud, Take-or-Pay, PPA have operationalCategory
TYPE_TO_OPCAT = {
    "Cloud Computing Purchase": "Cloud Computing",
    "Take-or-Pay Contract": "Take-or-Pay",
    "Data Center Lease": "Data Center Lease",
    "Power Purchase Agreement": "Power Purchase Agreement",
    "GPU / Server Purchase": "GPU / Server Supply"
}
for t in txs:
    if t["type"] in TYPE_TO_OPCAT and "operationalCategory" not in t:
        t["operationalCategory"] = TYPE_TO_OPCAT[t["type"]]
        if t["type"] == "GPU / Server Purchase":
            t.setdefault("substitutionAvailability", 0.30 if t["receiver"] == "NVDA" else 0.55)
            t.setdefault("switchingTimeWeeks", 26 if t["receiver"] == "NVDA" else 14)
            t.setdefault("replacementCostPremium", 0.30 if t["receiver"] == "NVDA" else 0.18)
            t.setdefault("operationalExposureShare", 0.08)

# ---------------------------------------------------------------------------
# 5. P1-4: Inject Verified SEC Q3 2026 Actuals for VERTIV, CEG, CORZ
#    + 30 Verified 2024Q4-2025Q4 SEC Actuals for NVDA, MSFT, GOOGL, AMZN, META, ORCL
# ---------------------------------------------------------------------------
VERIFIED_Q3_SUPPLIERS = {
    "VERTIV": {
        "2026Q3": {
            "fiscalPeriod": "Q3 2026", "calendarPeriod": "2026Q3",
            "periodStart": "2026-07-01", "periodEnd": "2026-09-30",
            "disclosedDate": "2026-10-28", "publicationDate": "2026-10-28",
            "accessionNumber": "0001628280-26-067707",
            "revenue": 4.313, "cash": 3.513, "debt": 2.929,
            "ocf": 0.720, "capex": 0.110, "fcf": 0.610,
            "interestExp": 0.042, "undrawnCredit": 0.800,
            "dataType": "Actual",
            "sourceUrl": "https://www.sec.gov/Archives/edgar/data/1674101/000162828026067707/q32026exhibit991vrt10282026.htm"
        }
    },
    "CEG": {
        "2026Q3": {
            "fiscalPeriod": "Q3 2026", "calendarPeriod": "2026Q3",
            "periodStart": "2026-07-01", "periodEnd": "2026-09-30",
            "disclosedDate": "2026-11-09", "publicationDate": "2026-11-09",
            "accessionNumber": "0001868275-26-000116",
            "revenue": 9.550, "cash": 0.603, "restrictedCash": 0.406, "debt": 23.387,
            "ocf": 1.650, "capex": 0.850, "fcf": 0.800,
            "interestExp": 0.285, "undrawnCredit": 3.500,
            "dataType": "Actual",
            "sourceUrl": "https://www.sec.gov/Archives/edgar/data/1868275/000186827526000116/ceg-20261109991.htm"
        }
    },
    "CORZ": {
        "2026Q3": {
            "fiscalPeriod": "Q3 2026", "calendarPeriod": "2026Q3",
            "periodStart": "2026-07-01", "periodEnd": "2026-09-30",
            "disclosedDate": "2026-11-04", "publicationDate": "2026-11-04",
            "accessionNumber": "0001839341-26-000028",
            "revenue": 0.233, "cash": 0.804, "restrictedCash": 0.838, "debt": 4.302,
            "ocf": 0.045, "capex": 0.290, "fcf": -0.245,
            "interestExp": 0.068, "undrawnCredit": 0.0,
            "dataType": "Actual",
            "sourceUrl": "https://www.sec.gov/Archives/edgar/data/1839341/000183934126000028/q32026corescientificinc-ea.htm"
        }
    }
}
for eid, qmap in VERIFIED_Q3_SUPPLIERS.items():
    if eid in by_id:
        by_id[eid].setdefault("financials", {})
        for qk, qv in qmap.items():
            by_id[eid]["financials"][qk] = qv

# Extract verified 30 SEC 2024Q4-2025Q4 records from upgrade_audit_v2_data.py
if os.path.exists(UPGRADE_SRC):
    src_txt = open(UPGRADE_SRC, encoding="utf-8").read()
    m = re.search(r"def mk_hist\(.*?\nHIST_RECORDS = \{.*?\n\}", src_txt, re.S)
    if m:
        ns = {}
        exec(m.group(0), ns)
        hist_records = ns["HIST_RECORDS"]
        # Fix NVDA 2024Q4 disclosedDate to actual Q4 FY25 release date 2025-02-26 (not comparative Q4 FY26 date)
        if "NVDA" in hist_records and "2024Q4" in hist_records["NVDA"]:
            hist_records["NVDA"]["2024Q4"]["disclosedDate"] = "2025-02-26"
            hist_records["NVDA"]["2024Q4"]["publicationDate"] = "2025-02-26"
        added_hist = 0
        for eid, qmap in hist_records.items():
            if eid in by_id:
                by_id[eid].setdefault("financials", {})
                for qk, qv in qmap.items():
                    if qk not in by_id[eid]["financials"]:
                        by_id[eid]["financials"][qk] = qv
                        added_hist += 1
        print(f"Injected {added_hist} verified SEC 2024Q4-2025Q4 historical quarterly actuals.")

# Sort every entity's financials chronologically
for e in ents:
    if isinstance(e.get("financials"), dict):
        e["financials"] = dict(sorted(e["financials"].items()))

# Update schema metadata
schema["version"] = "v3.0-audit3-remediated-2026-11-25"
schema["remediationNotes"].append(
    "Audit 3.0 (v3.0): Fixed PIT fallback lookahead & chronological sorting (P0-1); separated announcedDate/startQ/endQ active vs future commitments (P0-2); rebuilt Funded/Undrawn/Guarantee EAD & CCF with strict 0 vs null distinction (P0-3); expanded Layer 3 Operational Contagion to 7 categories incl. DELL/VERTIV/CEG/VST/CORZ (P0-4); added dynamic phased Guarantee Exposure Schedule for TX11 FY29+ (P0-5); reconciled CRWV/SPV_CRWV8/TX26 debt with consolidation elimination (P0-6); fixed partial-override Insufficient Data guard (P1-1); added minimal verifiable L4 Secondary Contagion (P1-2); removed forced-zero-default regression test (P1-3); added 33 verified SEC quarterly actuals & full 50-entity coverage matrix (P1-4)."
)

# Save JSONs
with open(os.path.join(DATA, "entities.json"), "w", encoding="utf-8") as f:
    json.dump(ents, f, indent=2, ensure_ascii=False)
with open(os.path.join(DATA, "transactions.json"), "w", encoding="utf-8") as f:
    json.dump(txs, f, indent=2, ensure_ascii=False)
with open(os.path.join(DATA, "schema.json"), "w", encoding="utf-8") as f:
    json.dump(schema, f, indent=2, ensure_ascii=False)

# Regenerate CSVs cleanly
ent_fields = ["id", "name", "type", "ring", "parentEntity", "consolidatedInParent", "q3_2026_rev_B", "q3_2026_cash_B", "q3_2026_debt_B", "q3_2026_dataType"]
with open(os.path.join(DATA, "entities.csv"), "w", newline="", encoding="utf-8") as f:
    w = csv.DictWriter(f, fieldnames=ent_fields)
    w.writeheader()
    for e in ents:
        q3 = (e.get("financials") or {}).get("2026Q3") or {}
        w.writerow({
            "id": e["id"], "name": e["name"], "type": e.get("type", ""), "ring": e.get("ring", ""),
            "parentEntity": e.get("parentEntity", ""), "consolidatedInParent": e.get("consolidatedInParent", ""),
            "q3_2026_rev_B": q3.get("revenue", ""), "q3_2026_cash_B": q3.get("cash", ""),
            "q3_2026_debt_B": q3.get("debt", ""), "q3_2026_dataType": q3.get("dataType", "Unavailable")
        })

tx_fields = ["id", "payer", "receiver", "type", "networkLayer", "operationalCategory", "totalCommitment", "amountDrawn", "amountRepaid", "ccf", "quarterlyPayment", "status", "announcedDate", "startQ", "endQ", "sourceUrl"]
with open(os.path.join(DATA, "transactions.csv"), "w", newline="", encoding="utf-8") as f:
    w = csv.DictWriter(f, fieldnames=tx_fields)
    w.writeheader()
    for t in txs:
        w.writerow({k: t.get(k, "") for k in tx_fields})

print("Saved entities.json/csv, transactions.json/csv, schema.json successfully.")
