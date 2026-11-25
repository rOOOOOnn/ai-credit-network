#!/usr/bin/env python3
"""
Syncs updated v3.0 engine/contagion_engine.js and data/*.json into index.html, index_zh.html, index_en.html,
generates docs/entity_data_coverage_matrix.md, and copies index.html to Canvas output.
"""
import json
import os
import re
import shutil

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "data")
DOCS = os.path.join(ROOT, "docs")
os.makedirs(DOCS, exist_ok=True)

engine_js = open(os.path.join(ROOT, "engine/contagion_engine.js"), encoding="utf-8").read().strip()
entities_raw = open(os.path.join(DATA, "entities.json"), encoding="utf-8").read().strip()
txs_raw = open(os.path.join(DATA, "transactions.json"), encoding="utf-8").read().strip()
schema_raw = open(os.path.join(DATA, "schema.json"), encoding="utf-8").read().strip()

ents = json.loads(entities_raw)
txs = json.loads(txs_raw)

# 1. Sync HTML files cleanly
for fn in ["index.html", "index_zh.html", "index_en.html"]:
    p = os.path.join(ROOT, fn)
    html = open(p, encoding="utf-8").read()

    # Replace engine IIFE block
    eng_pat = re.compile(r"/\*\*\s*\n \* AI Credit Network.*?return \{\s*QUARTERS_HIST,.*?runSimulation\s*\};\s*\}\);", re.S)
    assert eng_pat.search(html), f"Engine block not found in {fn}"
    html = eng_pat.sub(lambda _: engine_js, html, count=1)

    # Replace INITIAL_ENTITIES, INITIAL_TRANSACTIONS, INITIAL_SCHEMA
    e_pat = re.compile(r"const INITIAL_ENTITIES = \[.*?\];(?=\s*\nconst INITIAL_TRANSACTIONS)", re.S)
    t_pat = re.compile(r"const INITIAL_TRANSACTIONS = \[.*?\];(?=\s*\nconst INITIAL_SCHEMA)", re.S)
    s_pat = re.compile(r"const INITIAL_SCHEMA = \{.*?\};", re.S)

    assert e_pat.search(html), f"INITIAL_ENTITIES not found in {fn}"
    assert t_pat.search(html), f"INITIAL_TRANSACTIONS not found in {fn}"
    assert s_pat.search(html), f"INITIAL_SCHEMA not found in {fn}"

    html = e_pat.sub(lambda _: f"const INITIAL_ENTITIES = {entities_raw};", html, count=1)
    html = t_pat.sub(lambda _: f"const INITIAL_TRANSACTIONS = {txs_raw};", html, count=1)
    html = s_pat.sub(lambda _: f"const INITIAL_SCHEMA = {schema_raw};", html, count=1)

    with open(p, "w", encoding="utf-8") as f:
        f.write(html)

    if fn == "index_en.html":
        cn = re.findall(r"[\u4e00-\u9fff]", html)
        assert len(cn) == 0, f"index_en.html has {len(cn)} Chinese characters!"
    print(f"Synced {fn} (len={len(html)})")

# Copy index.html to Canvas output
canvas_out = "/working_dir/c_b9b10954bdb84d9e/artifacts/file_generation/ttl=63d/output/ai_credit_network.html"
os.makedirs(os.path.dirname(canvas_out), exist_ok=True)
shutil.copy2(os.path.join(ROOT, "index.html"), canvas_out)
print(f"Copied index.html -> {canvas_out}")

# 2. Generate docs/entity_data_coverage_matrix.md (P1-4)
QUARTERS = [
    "2022Q1","2022Q2","2022Q3","2022Q4",
    "2023Q1","2023Q2","2023Q3","2023Q4",
    "2024Q1","2024Q2","2024Q3","2024Q4",
    "2025Q1","2025Q2","2025Q3","2025Q4",
    "2026Q1","2026Q2","2026Q3"
]

actual_cells = 0
est_cells = 0
unavail_cells = 0
entities_with_actual = 0
entities_with_any = 0

lines = [
    "# Entity Historical Financial Data Coverage Matrix (2022Q1–2026Q3)",
    "",
    "Legend: `A` = Actual (SEC / Official Filing), `E` = Estimated / Disclosed Proxy, `P` = System Pool, `-` = Unavailable (never fabricated).",
    "",
    "| Entity ID | Name | Type | Covered Qtrs | 24Q4 | 25Q1 | 25Q2 | 25Q3 | 25Q4 | 26Q1 | 26Q2 | 26Q3 | Latest Disclosed Date |",
    "|---|---|---|---|---|---|---|---|---|---|---|---|---|"
]

focus_qs = ["2024Q4","2025Q1","2025Q2","2025Q3","2025Q4","2026Q1","2026Q2","2026Q3"]

for e in ents:
    fin = e.get("financials") or {}
    if len(fin) > 0:
        entities_with_any += 1
    has_act = any(v.get("dataType") == "Actual" for v in fin.values())
    if has_act:
        entities_with_actual += 1

    latest_disc = "-"
    for q in QUARTERS:
        v = fin.get(q)
        if e.get("isOcean"):
            continue
        if v and v.get("revenue") is not None:
            if v.get("dataType") == "Actual":
                actual_cells += 1
            else:
                est_cells += 1
            if v.get("disclosedDate"):
                latest_disc = v["disclosedDate"]
        else:
            unavail_cells += 1

    row_cells = []
    for q in focus_qs:
        if e.get("isOcean"):
            row_cells.append("P")
        elif q in fin and fin[q].get("revenue") is not None:
            dt = fin[q].get("dataType", "Estimated")
            row_cells.append("A" if dt == "Actual" else "E")
        else:
            row_cells.append("-")
    lines.append(
        f"| `{e['id']}` | {e['name']} | {e.get('type','')} | {len(fin)}/19 | " +
        " | ".join(row_cells) + f" | {latest_disc} |"
    )

summary_block = [
    "",
    "## Coverage Summary (48 Non-Pool Entities x 19 Quarters = 912 Entity-Quarters)",
    f"- **Entities with >=1 disclosed quarter**: {entities_with_any} / {len(ents)}",
    f"- **Entities with >=1 SEC Actual quarter**: {entities_with_actual} / {len(ents)}",
    f"- **Actual entity-quarters (`A`)**: {actual_cells}",
    f"- **Estimated / Proxy entity-quarters (`E`)**: {est_cells}",
    f"- **Unavailable entity-quarters (`-`)**: {unavail_cells} (explicitly marked `Unavailable`, never fabricated)",
    "- **Note on 2022Q1–2024Q3**: Currently unpopulated (`Unavailable`) in the offline repository; requires verified SEC EDGAR XBRL / 10-Q ingestion to backfill without fabrication."
]
lines.extend(summary_block)

with open(os.path.join(DOCS, "entity_data_coverage_matrix.md"), "w", encoding="utf-8") as f:
    f.write("\n".join(lines) + "\n")
print(f"Generated docs/entity_data_coverage_matrix.md (Actual={actual_cells}, Est={est_cells}, Unavail={unavail_cells})")
