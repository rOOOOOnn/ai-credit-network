const { writeFileSync } = require("node:fs");
const path = require("node:path");
const entities = require("../data/entities.json");

const fields = [
  ["Revenue", "revenue"], ["OCF", "ocf"], ["FCF", "fcf"], ["CapEx", "capex"],
  ["Cash", "cash"], ["Debt", "debt"], ["Current debt", "shortTermDebt"],
  ["Noncurrent debt", "longTermDebt"], ["Payables", "accountsPayable"],
  ["Lease liabilities", "leaseLiab"], ["Uncommenced leases", "offBalanceLeases"],
  ["Debt maturities", "debtMaturity"], ["RPO", "rpo"],
  ["Customer concentration", "customerConcentration"], ["GPU purchases", "gpuPurchases"],
  ["GPU fleet age", "gpuFleetAge"], ["Replacement CapEx", "replacementCapex"],
  ["Financing commitments", "financingCommitments"], ["Undrawn credit", "undrawnCredit"]
];

function renderFieldCoverage(rows) {
  const headers = ["Entity", "Period", "Disclosure", "Default record source", ...fields.map(([label]) => label)];
  const row = cells => "| " + cells.join(" | ") + " |";
  const titles = ["# Audit 4 historical field coverage", "",
    "Cells show the latest historical snapshot in USD billions, except customer concentration (a fraction) and GPU fleet age (years).",
    "Each populated cell shows its repository classification. An em dash means the snapshot field is absent or null.",
    "The source column identifies the row's source pointer or a general entity pointer. Presence of a value or source pointer does not certify the underlying disclosure.",
    "Forecast-side disclosures, source verification and scope limitations are tracked in the [entity source register](audit4_entity_source_register.md) and [audit report](audit4_remediation_report.md).",
    "To regenerate, run `node scripts/render_audit4_field_coverage.cjs`.", ""];
  const body = rows.map(entity => {
    const quarter = Object.keys(entity.financials ?? {}).sort().at(-1);
    const record = entity.financials?.[quarter];
    const sourceUrl = record?.sourceUrl ?? entity.sourceUrl;
    const source = sourceUrl?.startsWith("https://")
      ? "[" + (record?.sourceUrl ? "Record pointer" : "Entity pointer") + "](" + sourceUrl + ")" : "—";
    const cells = fields.map(([, key]) => {
      const value = record?.[key];
      if (value == null) return "—";
      const classification = record[key + "DataType"] ?? record.dataType ?? "Unclassified";
      const display = typeof value === "object" ? "Structured" : String(value).replaceAll("|", "\\|");
      const basis = record[key + "Basis"];
      return display + " · " + classification + (basis ? " (" + basis + ")" : "");
    });
    return row([entity.id, quarter ?? "—", record?.disclosedDate ?? "—", source, ...cells]);
  });
  return [...titles, row(headers), row(headers.map(() => "---")), ...body, ""].join("\n");
}

if (require.main === module) {
  writeFileSync(path.resolve(__dirname, "../docs/audit4_field_coverage.md"), renderFieldCoverage(entities), "utf8");
}
module.exports = { renderFieldCoverage };
