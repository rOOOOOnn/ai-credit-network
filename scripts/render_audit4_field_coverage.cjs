const { writeFileSync } = require("node:fs");
const path = require("node:path");
const entities = require("../data/entities.json");

const fields = [
  ["Revenue", "revenue"], ["OCF", "ocf"], ["FCF", "fcf"], ["CapEx", "capex"],
  ["Cash", "cash"], ["Debt", "debt"], ["Current debt", "shortTermDebt"],
  ["Noncurrent debt", "longTermDebt"], ["Payables", "accountsPayable"],
  ["Payables and accrued liabilities", "accountsPayableAndAccruedLiabilities"],
  ["Lease liabilities", "leaseLiab"], ["Operating lease liability", "operatingLeaseLiability"],
  ["Finance lease liability", "financeLeaseLiability"], ["Noncurrent lease liability", "noncurrentLeaseLiability"],
  ["Noncurrent operating lease liability", "noncurrentOperatingLeaseLiability"],
  ["Uncommenced leases", "offBalanceLeases"], ["Interest input", "interestExp"],
  ["Reported gross interest expense", "reportedGrossInterestExpense"],
  ["Debt maturities", "debtMaturity"], ["RPO", "rpo"],
  ["Customer concentration", "customerConcentration"],
  ["Individual customer concentration upper bound (exclusive)", "customerConcentrationExclusiveUpperBound"],
  ["GPU purchases", "gpuPurchases"], ["GPU fleet age", "gpuFleetAge"], ["Replacement CapEx", "replacementCapex"],
  ["Financing commitments", "financingCommitments"], ["Undrawn credit", "undrawnCredit"],
  ["Net receivables", "ar"], ["Restricted cash", "restrictedCash"],
  ["Reported guarantee maximum", "offBalanceGuarantees"],
  ["Separate cloud service commitments", "separateCloudServiceCommitments"],
  ["Borrowing principal", "borrowingPrincipal"], ["Reported borrowing principal", "reportedBorrowingPrincipal"],
  ["Recourse principal", "recoursePrincipal"], ["Non-recourse principal", "nonRecoursePrincipal"],
  ["Instrument commitment", "facilityCommitment"], ["Instrument principal outstanding", "principalOutstanding"],
  ["Commenced lease maturities", "commencedLeaseMaturities"]
];

function renderFieldCoverage(rows) {
  const headers = ["Entity", "Period", "Disclosure", "Default record source", ...fields.map(([label]) => label)];
  const row = cells => "| " + cells.join(" | ") + " |";
  const titles = ["# Audit 4 historical field coverage", "",
    "Cells show the latest historical snapshot in USD billions, except customer concentration (a fraction) and GPU fleet age (years).",
    "Each populated cell shows its repository classification. A source link within a cell applies to that field. An em dash means the snapshot field is absent or null.",
    "The source column identifies the row's source pointer or a general entity pointer. Presence of a value or source pointer does not certify the underlying disclosure.",
    "Forecast-side disclosures, source verification and scope limitations are tracked in the [entity source register](audit4_entity_source_register.md) and [audit report](audit4_remediation_report.md).",
    "To regenerate, run `node scripts/render_audit4_field_coverage.cjs`.", ""];
  let populated = 0;
  let fieldPointers = 0;
  let recordPointers = 0;
  let entityPointers = 0;
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
      const fieldSource = record[key + "SourceUrl"];
      populated++;
      if (fieldSource?.startsWith("https://")) fieldPointers++;
      else if (record?.sourceUrl?.startsWith("https://")) recordPointers++;
      else if (entity.sourceUrl?.startsWith("https://")) entityPointers++;
      return display + " · " + classification + (basis ? " (" + basis.replaceAll("|", "\\|") + ")" : "") +
        (fieldSource?.startsWith("https://") ? " [Source](" + fieldSource + ")" : "");
    });
    return row([entity.id, quarter ?? "—", record?.disclosedDate ?? "—", source, ...cells]);
  });
  const coverage = [
    "| Evidence pointer scope | Latest-snapshot fields |",
    "| --- | ---: |",
    row(["Field-specific pointer", fieldPointers]),
    row(["Record pointer only", recordPointers]),
    row(["Entity pointer only", entityPointers]),
    row(["Populated without HTTPS pointer", populated - fieldPointers - recordPointers - entityPointers]),
    row(["Absent or null", rows.length * fields.length - populated]),
    "",
    "Pointer counts measure traceability. Field confirmation additionally requires checking the period, reporting entity, definition and amount against the cited disclosure.",
    ""
  ];
  const bridgeHeaders = ["Entity", "Calendar bucket", "Nine-month OCF / CapEx",
    "Six-month OCF / CapEx", "Quarter OCF / CapEx / FCF", "Filing evidence"];
  const bridgeRows = rows.filter(entity => entity.audit4CashFlowBridge?.nineMonths)
    .map(entity => {
      const { quarter, nineMonths, sixMonths, direct } = entity.audit4CashFlowBridge;
      const ocf = nineMonths.ocf - sixMonths.ocf;
      const capex = nineMonths.capex - sixMonths.capex;
      const amounts = values => values.map(value => Number(value.toFixed(6))).join(" / ");
      const sources = [
        "[Nine months](" + nineMonths.sourceUrl + ")",
        "[Six months](" + sixMonths.sourceUrl + ")"
      ];
      if (direct) sources.push("[Direct quarterly disclosure used in model](" + direct.sourceUrl + ")");
      return row([entity.id, quarter, amounts([nineMonths.ocf, nineMonths.capex]),
        amounts([sixMonths.ocf, sixMonths.capex]), amounts([ocf, capex, ocf - capex]), sources.join(", ")]);
    });
  return [...titles, ...coverage, row(headers), row(headers.map(() => "---")), ...body, "",
    "## Quarterly cash flow computed from cumulative filings", "",
    "Quarterly OCF and cash CapEx are nine-month amounts less six-month amounts. FCF is the resulting OCF less CapEx. The model uses the direct quarterly disclosure where indicated.", "",
    row(bridgeHeaders), row(bridgeHeaders.map(() => "---")), ...bridgeRows, ""].join("\n");
}

if (require.main === module) {
  writeFileSync(path.resolve(__dirname, "../docs/audit4_field_coverage.md"), renderFieldCoverage(entities), "utf8");
}
module.exports = { renderFieldCoverage };
