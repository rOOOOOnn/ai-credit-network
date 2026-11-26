# Audit 4.0 remediation report

## Executive summary

This branch is a partial Audit 4 delivery. It adds opt-in company financing forecasts, cohort-based GPU refresh cash costs, incremental lease payment scenarios, and liquidity diagnostics. The historical v3 path remains available for comparison. The dynamic transaction ledger, guarantee refactor and operational recovery are open items.

## Reproduction

GitHub main was at `b727da282df7551e13bc3c1b79a6632b4bff1fed`. Schema validation and the 16, 12 and 20 case suites all passed before editing. Direct simulation reproduced OpenAI receiving $10B of assumed equity each quarter. Between 2026Q4 and 2028Q4 the fragility score moved from 17 to 15 while quarterly FCF stayed negative ($-11.9116B and $-8.7256B respectively). Assumed financing and less-negative FCF both contribute. Anthropic begins with a legacy $107.3B scheduled equity input and a calibrated positive OCF path. The capital event and baseline financial inputs need source reconciliation before interpreting that company's runway. Static transaction inputs retain zero initial draw for TX06A/B while the borrower-level RCF code changes total cash and debt independently.

## Financing comparison

The illustrative manual path requests $20B in 2027 and $10B in 2028. The curve starts with a $12B base, 50% initial growth and a 25-percentage-point annual decline. Both have $30B aggregate and $5B quarterly limits. Freeze sets the aggregate limit to zero. Only the selected company's assumed funding is replaced. Contract inputs and other companies remain on the legacy path. Amounts are USD billions, observations are from 2028Q4 and break-even is the first forecast quarter with nonnegative FCF.

| Entity | Path | Cash | Funding gap | Runway months | First default through 2028 | FCF break-even |
| --- | --- | ---: | ---: | ---: | --- | --- |
| OpenAI | Manual | -15.5228 | 25.5228 | 0 | 2028Q2 | — |
| OpenAI | Curve | -15.5178 | 25.5178 | 0 | 2028Q3 | — |
| OpenAI | Freeze | -46.1816 | 56.1816 | 0 | 2027Q4 | — |
| Anthropic | Manual | 201.8728 | 0 | — | — | 2026Q4 |
| Anthropic | Curve | 201.8728 | 0 | — | — | 2026Q4 |
| Anthropic | Freeze | 171.8728 | 0 | — | — | 2026Q4 |
| CoreWeave | Manual | -1.2404 | 3.2404 | 0 | 2028Q4 | — |
| CoreWeave | Curve | -1.1763 | 3.1763 | 0 | 2028Q4 | — |
| CoreWeave | Freeze | -31.6668 | 33.6668 | 0 | 2027Q1 | — |

Runway is excess cash above the operating minimum divided by quarterly burn, multiplied by three. A dash means either the event does not occur in the horizon or there is no positive burn denominator. The funding gap is the cash needed to restore the operating minimum, expressed at a point in time. These are model scenario outputs.

## GPU economic life

Accounting life governs noncash expense. Physical life is serviceability. Economic life is when continued use must compete with alternative equipment on cost, performance, utilization and resale value. The 4–5 year range is an assumption. The cohort schedule tests 3–7 years with a configurable share refreshed each quarter. A $100B 2026Q4 cohort at a 25% refresh share, 10% lower replacement price and 20% residual produces $22.5B in CapEx and $5B in disposal proceeds in its first eligible quarter. A four-year assumption moves this outlay to 2030Q4 from 2032Q4 under six years. Unreplaced stock remains in the fleet. Book depreciation is excluded from cash charges. Fleet inventory, age-dependent market values and collateral integrations are missing.

## Financial reconciliation

| Item | Public evidence | Open model work |
| --- | --- | --- |
| CoreWeave DDTL 4.0 | Note 10 reports $8.5B capacity and $4.583B principal outstanding. $3.917B is a capacity-minus-outstanding proxy. Availability depends on conditions and prior funding. Consolidated non-recourse debt is $5.273B net across multiple instruments. $41.600B recourse plus $5.273B non-recourse equals $46.873B net consolidated debt. | TX26 still needs correction alongside its dependent fixtures. Facility-specific carrying value and cumulative funded amount remain separate fields to verify. |
| NVIDIA SB Energy | The $105B aggregate cap covers defined obligations across nine centers. Effectiveness depends on readiness and lease commencement. Exposure declines as the tenant pays. The FY2027 Q2 filing also discloses other land, power and shell guarantees with $3.5B maximum gross exposure. | Replace legacy phase amounts with explicitly labeled scenario schedules. Actual site-level commencement, amounts, payment and call history remain missing. |
| Oracle leases | Oracle reports $288B not on the August 2026 balance sheet, generally beginning fiscal 2027 Q2 through fiscal 2029 for 15–19 years. | Opt-in incremental cash payments are supported. An Oracle default tranche schedule, commenced liabilities and principal/interest split remain open. |
| RCF and other loans | Legacy exposure is read from static transaction inputs during credit-event calculation. | Reconcile borrower movement with lender-level draws, repayments, maturities and default exposure before replacing the legacy ledger. |

Primary sources: [CoreWeave Form 10-Q, Note 10](https://www.sec.gov/Archives/edgar/data/1769628/000176962826000465/crwv-20260930.htm), [NVIDIA Form 10-Q](https://www.sec.gov/Archives/edgar/data/1045810/000104581026000075/nvda-20260726.htm), [Oracle Form 10-Q](https://www.sec.gov/Archives/edgar/data/1341439/000119312526389274/orcl-20260831.htm).

## Contagion and data gaps

The inherited engine retains L1 direct credit and guarantee events, L2 commercial order shocks, L3 operational capacity/migration shocks, and L4 peer spread and refinancing feedback. L3 still removes delayed revenue with no recovery ledger. Missing data include private company fundraising history and operating cash flows, GPU serial/cohort and purchase economics, lender-level contractual terms, and commencement and amortization calendars. The latest SEC filings verify aggregate commitments, with company private operating assumptions and model forecasts requiring separate classification. Coverage revalidation for the full entity set remains open.

## Tests and Git

The branch is `audit4-financing-gpu-remediation`, based on the main commit listed above. Changes include all three HTML entry points, the engine, CI, a new financial scenario test file, and this report. Baseline suites and independent arithmetic assertions cover cash integration, caps, timing, historical-data gating, lease scenarios and GPU replacement. The three-platform Actions results are tracked on the branch. Browser interaction and the requested A–G integration matrix remain unverified.
## Continuation from `a515599`

### Reproduced and corrected

- Four equal funding sources posted $1.0004B against quarterly and cumulative caps of $1.0003B. Funding now allocates whole $0.0001B units within the cap. When shared debt liquidity binds, funded rollover takes priority and the debt and asset-backed amounts reflect what actually posts. The capacity roll-forward uses the posted amounts.
- A $1.25B incremental lease payment reduced operating cash flow but did not enter the revenue requirement. The payment now enters both calculations once. The new test covers before commencement, commencement, last payment and after expiration using a fixed financing path to isolate rent.
- The scenario freeze applies to scenario financing only. Scheduled equity, rollover and RCF draws have independent rules. The panel describes this distinction. Anthropic's 2026Q4 legacy $107.3B is flagged as unverified, with a sensitivity switch to omit scheduled equity.
- TX26 now records $4.583B of principal outstanding as of 2026Q3 on a facility with $8.5B capacity. Before that observation the engine does not apply the reported principal. Cumulative drawings, principal repayments, standalone carrying value and facility-specific availability are unavailable. The reconciliation leaves availability blank and eliminates the SPV exposure from the consolidated debt sum. T10's source-backed fixture changed; test thresholds were preserved. The 2027Q2 draw window end is recorded separately from 2032Q1 loan maturity. [CoreWeave 10-Q Note 10](https://www.sec.gov/Archives/edgar/data/1769628/000176962826000465/crwv-20260930.htm)

### Anthropic reconciliation

The issuer reported roughly $91.6B of gross IPO proceeds attributable to Anthropic and $26.0B from the concurrent private placement, or $117.6B combined before issuance costs. That does not validate the model's $107.3B net inflow. The prospectus reports positive OCF of $6.6B over nine months through September 2026. This supports positive OCF for that reporting window and leaves the forecast quarterly OCF unverified. The prospectus reports $95.6B of quarter-end cash versus the inherited model anchor, which needs separate historical reconciliation. Sources: [closing announcement](https://www.anthropic.com/news/ipo-close), [prospectus](https://ipo.anthropic.com/documents/us/prospectus.pdf).

With scenario funding frozen, excluding only the $107.3B legacy scheduled input takes 2026Q4 ending cash from $145.0053B to $37.7053B and 2028Q4 ending cash from $171.8728B to $64.5728B. OCF stays $3.1053B and $3.2147B respectively, and the modeled funding gap stays zero. Removing the equity entry does not validate the opening balance or OCF.

### Before and after comparison

The nine equivalent manual, curve and scenario-freeze paths in the financing table were re-run after the changes. Ending cash, funding gap, runway, first default and FCF break-even match the `a515599` values in that table to displayed precision. Those paths use only equity scenario funding and whole-unit caps, and contain no incremental lease. The separate Anthropic sensitivity changes scheduled equity only.

### UI, validation and remaining scope

All three entry points include a mode selector, an inline annual by-source editing table in manual mode, actual scenario funding and remaining-capacity columns, and a financing and funding-gap bar chart. Curve parameters are still edited through JSON. Historical mode lists the years and supported sources when complete actual records are supplied. The repository still lacks verified annual financing histories for many sources.

The original 48 cases, data validation and Audit 4 regressions passed locally. See the branch Actions history for platform-specific results. GPU ownership, explicit acquisitions, useful lives and collateral links, the dynamic RCF lender ledger, NVIDIA guarantee milestones, Oracle default lease tranches, deferred-revenue recovery, the full entity-level source review and the A–G integration suite remain open.
