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
## Continuation after `6f6541a`

### RCF, operating recovery and contracts

- **RCF ledger.** Identified revolving facilities carry quarter-opening principal, draws, payments, quarter-end principal, cumulative draw, remaining commitment, available revolver room, accrued interest and default exposure. In the OpenAI freeze and extra compute case, 2027Q1 draws $0.6B on TX06A and $4.1B on TX06B. The same $4.7B increases borrower cash and debt and becomes lender-funded EAD on default. Once a line defaults its unused room closes, and the outstanding default claim is not treated as a successfully paid maturity. Facility extensions and explicit payments are supported as assumptions. Full allocation of generic balance-sheet debt, repayments and new borrowing to non-RCF tranches remains open where instrument detail is missing.
- **L3 recovery.** Disrupted revenue is split by the scenario recovery rate, default 75%. The recoverable portion is queued until the switching window ends. The remainder is permanent loss. For the CORZ → CoreWeave example, the model recovers $0.0835B of revenue in 2027Q2, the sum of $0.0557B and $0.0278B deferred during the two preceding quarters. Migration cost stays in OCF and the recovery does not inflate the following quarter's revenue growth base.
- **Oracle.** The research UI enables an explicit illustrative $288B profile with three assumed $96B cohorts, each paid over 68 quarters. Payments start in 2027Q1, 2028Q1 and 2029Q1, with a configurable delay. The scenario exposes uncommenced commitments and remaining commenced payments separately. Those payments are undiscounted and the financing/operating lease split and recognized liability still require an accounting schedule. [Oracle August 2026 10-Q](https://www.sec.gov/Archives/edgar/data/1341439/000119312526389274/orcl-20260831.htm)
- **NVIDIA SB Energy.** The research UI enables nine illustrative project cohorts with separate ready-for-service, lease commencement and termination conditions. Scheduled rent or a supplied payment record reduces available exposure, and guarantee calls are recorded against it. The nine centers and $105B aggregate cap are disclosed. Equal project caps and their assigned calendar quarters are assumptions. The old schedule can still be reproduced using the legacy simulation setting. The $3.5B of other NVIDIA guarantees remains separately disclosed in the source and outside this project schedule. [NVIDIA 10-Q](https://www.sec.gov/Archives/edgar/data/1045810/000104581026000075/nvda-20260726.htm)
- **GPU.** Explicit hardware purchases are capped by and included in baseline CapEx, then added to the applicable cohort once. Residual proceeds are a financing-neutral investing cash receipt outside the model's OCF-minus-CapEx FCF convention. Unrefreshed equipment remains in its original cohort. Opening fleet age and residual assumptions reduce the collateral proxy used for margin calls and refinancing. Actual secured principal remains a separate exposure measure. Actual inventory, liens, liquidation costs and depreciation lives remain incomplete across companies.

### Integrated A–G smoke and accounting checks

The test suite independently recomputes operating-to-free-cash conversion, cash conservation and the funding gap. Selected unit checks also derive lease payments, GPU CapEx, residual recovery and scheduled debt flows directly from inputs. The following amounts are USD billions in 2027Q1, with defaults observed through 2028Q4.

| Case | Entity | Cash | FCF | Funding gap | First model default |
| --- | --- | ---: | ---: | ---: | --- |
| A | OpenAI | 19.8376 | -12.3234 | 0 | 2027Q4 |
| B | Anthropic | 39.5794 | 2.2729 | 0 | — |
| C | CoreWeave | -4.9025 | -8.7260 | 6.9025 | 2027Q1 |
| D | Oracle | 14.8450 | -15.5952 | 0 | 2027Q3 |
| E | CoreWeave | -5.5155 | -8.8050 | 7.5155 | 2027Q1 |
| F | CoreWeave | -6.3886 | -8.8217 | 8.3886 | 2027Q1 |
| G | CoreWeave | -8.4885 | -9.4636 | 10.4885 | 2027Q1 |

### Financing comparison after RCF and recovery changes

Same inputs and reporting conventions as the first financing table. OpenAI's updated credit room closes at the facility maturity or default; the remaining risk also depends on funded interest and repayment. Cross-network recovery can change the counterparties' paths even with unchanged financing inputs.

| Entity | Path | 2028Q4 cash | Gap | Runway months | First default | FCF break-even |
| --- | --- | ---: | ---: | ---: | --- | --- |
| OpenAI | Manual | -14.5707 | 24.5707 | 0 | 2028Q2 | — |
| OpenAI | Curve | -14.5648 | 24.5648 | 0 | 2028Q3 | — |
| OpenAI | Freeze | -47.6455 | 57.6455 | 0 | 2027Q4 | — |
| Anthropic | Manual | 201.8728 | 0 | — | — | 2026Q4 |
| Anthropic | Curve | 201.8728 | 0 | — | — | 2026Q4 |
| Anthropic | Freeze | 171.8728 | 0 | — | — | 2026Q4 |
| CoreWeave | Manual | -0.9800 | 2.9800 | 0 | 2028Q4 | — |
| CoreWeave | Curve | -0.9237 | 2.9237 | 0 | 2028Q4 | — |
| CoreWeave | Freeze | -31.3494 | 33.3494 | 0 | 2027Q1 | — |

The Anthropic rows retain the unverified $107.3B for apples-to-apples comparison. The earlier removal sensitivity remains separate.

The three HTML variants now expose editable curve and GPU controls. JavaScript syntax and local model tests were executed. The browser preview could not reach the local HTTP page and local-file navigation was denied by the browser. Browser input and repaint remain unverified. The entity source register inventories all 50 repository records and does not assert independent verification of every input.

## Acceptance update: term debt, source correction and Chrome

The original base remains `b727da2`. The continuation builds on `6de004c`, with term-loan coverage introduced in `d510950` and the Chrome runner verified in `097cec6`. The audit branch has no merge into main.

### Term instrument reconciliation

The research app now tracks known non-revolving principal alongside the RCF ledger. An instrument with no verified opening principal returns a blank balance. Configured staged draws are limited to known remaining commitment and the draw deadline. A modeled $5B term facility draws $3B and $2B across two quarters, repays $1B in the second quarter, and pays its remaining $4B at maturity. The same entries move borrower cash and debt and lender outstanding principal. Assumed generic funding remains unattributed to particular lenders. Any difference between instrument principal and borrower-reported carrying debt remains visible. Different bases and overlapping legacy instruments can produce a signed residual; the model does not erase it.

### Anthropic: replacement for the legacy estimate

The [final prospectus](https://www.sec.gov/Archives/edgar/data/2130357/000162828026074944/anthropicpbc-424b4.htm) gives a $117.0B estimate of net cash proceeds if the underwriters exercise the option in full. The [issuer confirmed full exercise and closing](https://www.anthropic.com/news/ipo-close). The research profile replaces the legacy $107.3B input with this source-backed estimate, and uses $95.6B in disclosed Q3 cash and $6.2B in disclosed aggregate note principal. The $579.3M immediately pre-close equity conversion reduces modeled debt without a cash payment. The closing quarter begins with the aggregate Amazon principal for EAD and suppresses the overlapping legacy Amazon and Google note exposures; allocation to distinct maturities still requires agreement-level amounts. The issuer's nine-month OCF is $6.6B. The modeled Q4 OCF remains a forecast, $3.0262B under the comparison scenario.

With and without the estimated $117.0B, respectively, ending cash is $215.2262B and $98.2262B in 2026Q4, and $241.5204B and $124.5204B in 2028Q4. The funding gap stays zero in both runs. The legacy comparison remains reproducible when using the earlier profile.

### Audit-profile comparison

The same assumptions used above for the three financing modes were run with the audited research profile, which the three browser entry points enable. Values are in USD billions at 2028Q4. Funding gap is measured against minimum cash, and a dash in runway indicates nonnegative FCF.

| Company | Financing | Cash | Gap | Runway months | First default | First FCF break-even |
| --- | --- | ---: | ---: | ---: | --- | --- |
| OpenAI | Manual | -14.7054 | 24.7054 | 0 | 2028Q2 | — |
| OpenAI | Curve | -14.6935 | 24.6935 | 0 | 2028Q3 | — |
| OpenAI | Scenario freeze | -47.7801 | 57.7801 | 0 | 2027Q4 | — |
| Anthropic | Manual | 271.5204 | 0 | — | — | 2026Q4 |
| Anthropic | Curve | 271.5204 | 0 | — | — | 2026Q4 |
| Anthropic | Scenario freeze | 241.5204 | 0 | — | — | 2026Q4 |
| CoreWeave | Manual | -0.9800 | 2.9800 | 0 | 2028Q4 | — |
| CoreWeave | Curve | -0.9237 | 2.9237 | 0 | 2028Q4 | — |
| CoreWeave | Scenario freeze | -31.3494 | 33.3494 | 0 | 2027Q1 | — |

Anthropic's increase comes primarily from the corrected starting cash and the source-backed proceeds estimate. OpenAI changes modestly under the audited contract path, with the same model default dates. CoreWeave results are unchanged at the displayed precision for these three funding paths, which do not include a refresh scenario.

### Acceptance evidence and remaining limits

- The 48 inherited tests and dataset validation passed with unchanged thresholds. Additional fixtures independently check stated amounts, cash and principal identities, sources of funding, GPU cohorts, L3 recovery, and A–G scenario accounting.
- Chrome actually loaded and exercised all three entry points in [the first successful browser job](https://github.com/rOOOOOnn/ai-credit-network/actions/runs/45814769744/job/139891530085). The executable checks cover annual input, chart and funding updates, switching manual to curve and back, the insufficient-history path, and advancing the timeline. The workflow repeats these checks on later commits. The same workflow runs financial checks on Ubuntu, macOS and Windows.
- The [source register](audit4_entity_source_register.md) covers 50 entities at the inventory level and includes verified issuer findings. A full field-by-field restatement remains open. The material gaps include private operating data, quarter-level OCF bridges, project-level guarantee activation and payments, instrument carrying amounts and undrawn availability, collateral liens and GPU asset registers. For the remaining instruments and commitments, model cash paths are conditional on these gaps and the stated scenarios. Documented aggregates do not establish the missing distributions.
