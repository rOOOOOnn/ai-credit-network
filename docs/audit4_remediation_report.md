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

### Additional financing diagnostics

Each forecast quarter reports monthly burn, available liquidity, financing needed after credit availability, a debt-service coverage proxy, and the ratio of new financing to modeled cash uses. The minimum revenue growth for FCF break-even inverts the standalone quarterly OCF equation, holding margins, cash conversion, interest, CapEx and incremental rent fixed. It is not a multi-quarter growth promise and excludes additional shocks during that quarter. The UI shows annual financing growth alongside annual revenue growth. Independent fixture: with $2B of operating cash costs, $3B of CapEx, a 50% cash contribution margin and 18% marginal tax, break-even revenue is approximately $11.3171B, or 13.17% above the $10B starting quarter.

The research model tracks actual closing milestones separately from scenario payments. The financial, browser and report commitments are on the audit branch; use the run attached to the final commit for validation.

### Cash classification across five issuers

The research profile now uses directly reported 2026Q3 cash and equivalents for Microsoft ($20.281B), Meta ($11.222B), Amazon ($55.783B), Alphabet ($56.334B) and Anthropic ($95.6B). This normalizes previously mixed liquidity definitions. Separate current investment disclosures reconcile to the issuer's broader liquid asset measure. The default stress path does not sell them. An optional one-time opening sale is classified as investing cash, outside OCF and FCF. Alphabet's $75.2B of sale-restricted SpaceX shares are excluded from this scenario even at 100% sale. Zero known restriction in other records means no specific restriction was deducted in this scenario, not that the entire portfolio was independently cleared for sale.

Re-running the same nine financing comparisons after this change gives the same displayed values in the preceding audit-profile table except for OpenAI scenario freeze. The 2028Q4 ending cash changes from -$47.7801B to -$48.4185B and the gap from $57.7801B to $58.4185B after changes to counterparties propagate. The first default quarter, runway and break-even remain unchanged. The modeled cash decline is not a revision of OpenAI's standalone cash disclosure.

Sources: [Microsoft 10-Q](https://www.sec.gov/Archives/edgar/data/789019/000119312526436133/msft-20260930.htm), [Meta 10-Q](https://www.sec.gov/Archives/edgar/data/1326801/000162828026066773/meta-20260930.htm), [Amazon 10-Q](https://www.sec.gov/Archives/edgar/data/1018724/000101872426000040/amzn-20260930.htm), [Alphabet 10-Q](https://www.sec.gov/Archives/edgar/data/1652044/000165204426000084/goog-20260930.htm), and [Anthropic final prospectus](https://www.sec.gov/Archives/edgar/data/2130357/000162828026074944/anthropicpbc-424b4.htm).

### CoreWeave quarterly cash-flow bridge

The September and June 2026 CoreWeave filings give like-for-like fiscal-year-to-date cash-flow totals. Subtraction yields Q3 OCF of $1.975B ($5.638B minus $3.663B), cash purchases of property and equipment including internal-use software of $9.441B ($23.558B minus $14.117B), and OCF less cash CapEx of -$7.466B. The audit profile uses the $1.975B OCF observation in forecast calibration. Historical source metadata retain both calculation legs. Forward CapEx remains an assumption. The aggregate cash purchase is not a GPU fleet acquisition estimate.

Opening cash and equivalents are $4.122B. Marketable securities are $0.062B and restricted cash is $2.282B. The company reports $5.653B available under existing facilities in total, including revolver and delayed draw arrangements. This total is not assigned to TX26 or counted as unrestricted cash.

At 2028Q4, using the same financing comparison inputs, CoreWeave manual and curve paths both end at $3.4627B cash, zero funding gap and 1.7117 months of modeled runway. Neither crosses model default or FCF break-even in the comparison window. The freeze path ends at -$23.5326B cash with a $25.5326B gap and zero runway; first model default shifts from 2027Q1 to 2027Q2 and FCF break-even remains absent. OpenAI and Anthropic outputs match the preceding post-classification comparison. These are conditional forecasts. The brighter CoreWeave paths follow from the higher reported Q3 OCF used for cash calibration, while the stress case still exhausts liquidity.

Primary sources: [September 2026 10-Q](https://www.sec.gov/Archives/edgar/data/1769628/000176962826000465/crwv-20260930.htm) and [June 2026 10-Q](https://www.sec.gov/Archives/edgar/data/1769628/000176962826000366/crwv-20260630.htm).

### Oracle fiscal-quarter prepayment bridge

Oracle's quarter ended August 31, 2026 (FY2027 Q1) covers June through August and is mapped to the research engine's 2026Q3 calendar bucket. The filing reports $19.345B revenue, $23.103B operating cash flow, and $28.499B cash CapEx. Reported free cash flow is -$5.396B. Reported OCF includes $11.363B from customer prepayments with a significant financing component. The audit scenario excludes that specific receipt from the forward recurring cash calibration, leaving an $11.740B OCF anchor and an illustrative -$16.759B historical FCF bridge excluding the receipt. This is a model adjustment to the reported measure. The payment is already reflected in the observed closing cash of $36.369B and is not posted again as forward financing.

The bridge separately preserves reported current and non-current borrowings of $7.625B and $117.712B, operating and finance lease liabilities of $34.621B and $9.185B, and $288B in additional uncommenced commitments. The existing lease liabilities are not added to incremental uncommenced payments. Forward CapEx and incremental rent remain separate assumptions.

| Oracle audit profile | 2028Q4 cash | Funding gap | Quarterly FCF | First model default |
| --- | ---: | ---: | ---: | --- |
| Previous calibration | -28.4196 | 38.4196 | -8.8906 | 2028Q1 |
| Filing bridge and default lease schedule | 15.0985 | 0 | -2.9310 | — |
| Filing bridge and four-quarter lease delay | 26.3925 | 0 | -1.5193 | — |

The revised cash profile is conditional on the unchanged financing and forward CapEx assumptions. The CapEx and commencement schedule are not validated by this bridge. In the standard nine-path replay Anthropic and CoreWeave are unchanged. OpenAI's manual, curve and freeze 2028Q4 cash is -$14.7058B, -$12.9399B and -$48.0550B, respectively, with gaps of $24.7058B, $22.9399B and $58.0550B. Runway and first model default quarters remain unchanged from the preceding comparison.

Primary source: [Oracle August 2026 10-Q, cash-flow statement, Note 1, Note 6 and MD&A](https://www.sec.gov/Archives/edgar/data/1341439/000119312526389274/orcl-20260831.htm).

### Microsoft quarterly cash flow and lease reconciliation

The September 2026 10-Q reports $92.279B revenue, $58.000B OCF, $39.367B cash additions to property and equipment, and $18.633B by subtraction. The audited forecast now anchors revenue and OCF to those figures. The historical fixture remains available for replay, and future CapEx remains a scenario parameter. Starting cash and equivalents are $20.281B. Current and non-current borrowings of $4.391B and $31.090B total $35.481B and exclude recognized lease liabilities.

Note 12 separately reports $27.477B operating and $70.973B finance lease liabilities, $1.547B in cash paid within operating leases, $0.769B finance lease interest classified in OCF, $1.000B finance lease principal classified in financing cash flow, and $5.192B in noncash ROU additions under finance leases. The noncash additions do not enter historical cash CapEx. The historical OCF calibration already includes the operating lease and finance interest cash charges. The $364.6B additional commitment remains an uncommenced aggregate with some conditional arrangements and no project-by-quarter schedule. The audit profile does not automatically convert it into a quarterly charge. The model still needs a separate forward finance-lease principal schedule.

With unchanged forward financing and CapEx assumptions, audited 2028Q4 cash changes from $155.4063B to $236.5666B and quarterly FCF from $24.3724B to $33.3884B. Neither scenario triggers Microsoft model default through 2028Q4. The difference primarily reflects the $9.020B higher reported OCF anchor. These outputs do not estimate the cash effects of the uncommenced aggregate.

Source: [Microsoft September 2026 Form 10-Q, income and cash flow statements and Notes 9 and 12](https://www.sec.gov/Archives/edgar/data/789019/000119312526436133/msft-20260930.htm).

### Alphabet, Meta and Amazon single-quarter cash flow

The audit profile now calibrates Q3 OCF against reported cash-flow statements for three additional entities. Alphabet and Meta use fiscal YTD subtraction of the June figures from the September figures. Amazon supplies a direct three-month column. The historical fixture and assumed future CapEx remain separate from the verified opening observation.

| Entity | Q3 OCF | Gross cash PP&E purchases | OCF less gross cash PP&E |
| --- | ---: | ---: | ---: |
| Alphabet | 42.290 | 51.355 | -9.065 |
| Meta | 32.785 | 33.942 | -1.157 |
| Amazon | 42.422 | 77.259 | -34.837 |

Figures are USD billions. Meta's separately reported $34.91B capital expenditure measure includes finance lease principal. Amazon reports $1.381B of property sale proceeds and incentives, implying -$33.456B after these receipts. The model keeps gross PP&E, asset sale proceeds, and financing lease payments on distinct bases. None of the consolidated cash PP&E figures establish GPU-only cash purchases.

Under unchanged forward assumptions, 2028Q4 cash and FCF are $116.6262B and $19.3636B for Alphabet, $83.4815B and $15.4546B for Meta, and $0 and -$10.5609B for Amazon. Amazon's $35B minimum-cash gap persists. No first default occurs for the three under this run. The revised quarterly amounts do not validate entity-specific GPU cohorts, debt availability, or lease commencement schedules.

Primary sources: [Alphabet September](https://www.sec.gov/Archives/edgar/data/1652044/000165204426000084/goog-20260930.htm), [Alphabet June](https://www.sec.gov/Archives/edgar/data/1652044/000165204426000071/goog-20260630.htm), [Meta September](https://www.sec.gov/Archives/edgar/data/1326801/000162828026066773/meta-20260930.htm), [Meta June](https://www.sec.gov/Archives/edgar/data/1326801/000162828026050705/meta-20260630.htm), and [Amazon September](https://www.sec.gov/Archives/edgar/data/1018724/000101872426000040/amzn-20260930.htm).

### Microsoft recognized finance-lease principal and cash timing

Note 12 discloses $70.973B in recognized finance-lease liabilities, a weighted-average discount rate of 4.5%, and scheduled undiscounted cash payments of $6.006B for the last three quarters of FY2027, $8.163B in FY2028, $7.433B in FY2029, $7.323B in FY2030, $7.300B in FY2031 and $59.021B thereafter. The audit forecast distributes the dated buckets evenly by quarter, with a rounding allocation that preserves each fiscal-year total. Interest uses the opening liability and an effective quarterly rate. Payments reduce cash, principal reduces the separate lease liability, and the modeled interest replaces the historical lease interest already embedded in calibrated OCF. Cash PP&E, operating lease cash costs, and standalone borrowing principal stay distinct. The undated thereafter balance and uncommenced $364.6B aggregate do not get invented quarterly payments.

| Microsoft 2028Q4 | Cash | FCF | Funding gap | First model default |
| --- | ---: | ---: | ---: | --- |
| Existing lease schedule disabled | 236.5666 | 33.3884 | 0 | — |
| Existing lease schedule enabled | 225.6020 | 33.4842 | 0 | — |

Amounts in USD billions. The modeled 2028Q4 lease cash payment is $1.8583B including $1.1851B principal, with $59.6533B remaining on the recognized finance-lease ledger. Lower modeled interest than the historical anchor explains why FCF can rise slightly even as cash falls. The test verifies two fiscal-year buckets, interest, principal roll-forward, and the treatment of principal outside FCF. Quarterly installments and the split are model assumptions, and future additional leases are outside the recognized schedule.

Source: [Microsoft September 2026 10-Q, Note 12](https://www.sec.gov/Archives/edgar/data/789019/000119312526436133/msft-20260930.htm).

### NVIDIA forecast cut-off and additional guarantees

The September 30 opening information set uses the last available fiscal quarter ending July 26, not the October 25 result that NVIDIA published on November 17. The July 10-Q and single-quarter release provide $96.221B revenue, $24.077B OCF, $2.677B cash purchases of property, equipment and intangibles, $22.443B cash and equivalents and $33.366B carrying debt. The opening balance dates remain July 26. No July-to-September cash bridge is presented as actual. The October results remain separately available in the quarter when disclosed. Those results report $115.844B revenue, $48.253B OCF, $4.422B cash purchases and $0.054B of asset principal, yielding issuer FCF of $43.777B. This removes a fiscal-calendar look-ahead from the audit forecast's opening calibration while retaining the legacy profile for regression.

The November CFO disclosure reconciles $105B SB Energy, $3.5B neocloud land/power/shell and $9.5B power/systems guarantees to $118B of maximum gross disclosed exposure. The two latter caps now appear as separate unallocated ledger entries. Actual counterparties, project timing and effective exposure are unavailable. A documented explicit cash-call stress can use either cap without affecting the SB Energy ledger or inventing a new counterparty. With stress requests of $3B for neoclouds and $20B for power/systems, 2027Q1 pays $3B and $9.5B respectively and lowers ending cash by $12.5B versus identical inputs without those calls. A further neocloud request in 2027Q2 is capped at the remaining $0.5B. These synthetic calls do not change OCF and are not a claim of realized losses.

Sources: [July Form 10-Q](https://www.sec.gov/Archives/edgar/data/1045810/000104581026000075/nvda-20260726.htm), [July earnings release](https://www.sec.gov/Archives/edgar/data/1045810/000104581026000073/q2fy27pr.htm), [October earnings release](https://www.sec.gov/Archives/edgar/data/1045810/000104581026000088/q3fy27pr.htm), and [October CFO guarantee disclosures](https://www.sec.gov/Archives/edgar/data/1045810/000104581026000088/q3fy27cfocommentary.htm).

### Incremental operating and financing lease cash-flow acceptance

An incremental scenario tranche now accepts a lease type and, for financing leases, an annual discount rate. Before commencement its undiscounted payments are commitments only. At commencement the tranche starts at the modeled present value of contractual payments. It then reports interest, principal, an indicative straight-line depreciation memorandum, and the closing finance lease liability. Operating rent and financing lease interest reduce OCF. Financing lease principal separately reduces cash and the lease liability. No depreciation, principal, or ROU recognition is added to cash CapEx. Unclassified contracts retain the existing cash-only assumption and are separately flagged rather than assigned a fabricated discount rate or principal.

The browser scenarios accept an array of tranches and show total payment, finance principal and interest. The regression fixture uses four $1B finance payments and four $0.5B operating payments, with a 10% effective quarterly finance discount rate. Independent checks cover time-zero present value, pre-commencement exclusion, principal and interest, full expiry, delay, zero rate and unavailable rate. The combined $1.5B first-quarter payment reduces cash by exactly $1.5B, with only modeled interest plus operating rent reducing FCF. This profile is a test assumption. Oracle's default $288B scenario retains undiscounted payment timing, and its contract-level lease mix, implied rates and dates remain unavailable in the [Oracle 10-Q](https://www.sec.gov/Archives/edgar/data/1341439/000119312526389274/orcl-20260831.htm).

### CoreWeave reported revolving cash capacity

The September 2026 filing separates the $2.500B senior secured revolver, $1.200B outstanding borrowings, and $0.546B of letters of credit from $0.754B of remaining cash availability. The audit simulation seeds a facility-level row from that disclosure. Letters of credit reserve capacity and do not add to borrower cash or funded lender principal. The row maintains funded balance, scheduled repayments and modeled new draws. Cumulative historic draw and lender shares remain blank, including after scenario draws. The separate lender loss event preserves facility-level exposure even without counterparty attribution. The audited revolver replaces the $3.5B generic opening line in the prior CoreWeave research forecast. The existing 82 transaction input and legacy profile remain available for regression.

Of $5.653B combined facility availability, $4.899B remains after removing the $0.754B revolver. This is the combined remaining facility disclosure by subtraction and is not attributed entirely to TX26. The RCF and DDTL cash capacities are therefore not double counted.

In a financing freeze with a $25B quarterly compute override, the 2026Q4 revolver cash draw is capped at $0.754B. Funded balance and default exposure then both become $1.954B. The test also verifies cash, borrower debt, exhaustion and one-time default exposure with unknown lender shares. In the standard 2028Q4 comparison, CoreWeave manual and curve remain at $3.4627B ending cash, no funding gap and 1.7117 months of runway. Its freeze path ends at -$25.8861B cash and a $27.8861B gap, first default 2027Q1. In the same nine-path replay OpenAI scenario freeze reaches -$47.4166B cash and a $57.4166B gap. Other rows match the preceding Oracle comparison to displayed precision.

Source: [CoreWeave September 2026 10-Q, Note 10 and Liquidity and Capital Resources](https://www.sec.gov/Archives/edgar/data/1769628/000176962826000465/crwv-20260930.htm).

### Power and infrastructure opening cash-flow reconciliation

All values are USD billions. VST, CEG and CORZ standalone quarterly cash flows are September year-to-date amounts less June year-to-date amounts. Vertiv provides direct quarterly values. Gross cash FCF is the cash-flow statement's operating cash flow less the cash purchases shown here. It is a derived observation. Future OCF margins and CapEx trajectories remain scenario inputs.

| Entity | Q3 2026 OCF | Cash CapEx | Gross cash FCF | Source and scope |
| --- | ---: | ---: | ---: | --- |
| Vistra | 2.108 | 0.747 | 1.361 | Includes nuclear fuel and long-term service agreement prepayments. [September 10-Q](https://www.sec.gov/Archives/edgar/data/1692819/000169281926000025/vistra-20260930.htm), [June 10-Q](https://www.sec.gov/Archives/edgar/data/1692819/000169281926000019/vistra-20260630.htm) |
| Constellation Energy | 3.426 | 0.940 | 2.486 | Consolidated CEG cash flows. [September 10-Q](https://www.sec.gov/Archives/edgar/data/1868275/000186827526000119/ceg-20260930.htm), [June 10-Q](https://www.sec.gov/Archives/edgar/data/1868275/000186827526000104/ceg-20260630.htm) |
| Vertiv | 0.794 | 0.1391 | 0.6549 | The additional 0.0027 of capitalized software is separately identified. [Q3 cash-flow statement](https://www.sec.gov/Archives/edgar/data/1674101/000162828026067707/q32026exhibit991vrt10282026.htm) |
| Core Scientific | 0.065294 | 0.540735 | -0.475441 | Cash purchases of property and equipment. [September 10-Q](https://www.sec.gov/Archives/edgar/data/1839341/000183934126000030/core-20260930.htm), [June 10-Q](https://www.sec.gov/Archives/edgar/data/1839341/000183934126000014/core-20260630.htm) |

Vistra now enters the audited forecast with $6.347B of prior quarter revenue, $2.743B of opening unrestricted cash, and September current and noncurrent borrowings of $2.877B and $18.269B. Its $5.500B revolver has no funded opening principal and reserves $0.786B for letters of credit, leaving $4.714B of cash availability. Restricted cash ($0.033B) and availability under the separate commodity-linked facility ($1.466B) are separately classified. Lender allocations and cumulative historical draws remain unavailable. The audited opening forecast is anchored at September 30. The historical view and October/November acquisition, preferred redemption, debt repayment and associated borrowings still require a separate chronology and cash bridge. [Vistra November earnings release](https://investor.vistracorp.com/2026-11-06-Vistra-Reports-Third-Quarter-2026-Results)

Vistra's September snapshot is now available in the historical view, including $1.503B trade payables and $7.847B RPO. The November publication date preserves the September point-in-time backtest cutoff. Notes 2 and 12 distinguish $4.9B of identified October/November gross cash uses from the $1.7B of acquisition debt assumed and then repaid. The subsequent-event record leaves new receivables and repurchase borrowing amounts blank because the disclosure identifies use of full capacity without specifying the actual amounts drawn on those dates. The reported $5.4B pro forma liquidity is a combined liquidity measure. End-of-quarter cash and incremental funded debt remain unresolved, so the model retains the September anchor. The 10-Q also confirms that the revolving facility's liens were released in April 2026. [Vistra September 10-Q](https://www.sec.gov/Archives/edgar/data/1692819/000169281926000025/vistra-20260930.htm), [November earnings release](https://investor.vistracorp.com/2026-11-06-Vistra-Reports-Third-Quarter-2026-Results).

The facility terms make the approximate liquidity bridge independently reproducible. September liquidity was $8.923B ($2.743B cash, $4.714B revolver and $1.466B commodity-linked availability). The receivables purchase limit was $1.250B and the uncommitted repo limit was $0.125B. Using the issuer's reported full-capacity draw and those limits gives an **Estimated** $1.375B combined inflow. Subtracting $4.900B of gross uses yields $5.398B, consistent with the issuer's rounded $5.4B pro forma liquidity. Funding against the receivables limit is conditional, and the liquidity disclosure does not settle quarter-end cash or the facility-level funded balances. The dataset therefore keeps actual proceeds blank and records the full-limit estimate separately. The estimate is excluded from the default forecast. The December $0.631B Nuveen payment is a separate contractual obligation outside this October/November bridge. [Vistra September 10-Q, Note 12 and Liquidity](https://www.sec.gov/Archives/edgar/data/1692819/000169281926000025/vistra-20260930.htm), [November release](https://investor.vistracorp.com/2026-11-06-Vistra-Reports-Third-Quarter-2026-Results).

Revolver classification now uses an explicit facility kind for the four original RCF transactions and the separately disclosed CoreWeave and Vistra facilities. The regression reproduced a loss of $4.714B in Vistra cash draw capacity when the collateral description omitted the letters “RCF.” Classification and modeled extensions now use the same rule, with legacy collateral wording retained as a fallback for older inputs. The regression checks that authorized capacity survives an extension beyond the original maturity with ordinary collateral wording.

### Nebius third-quarter source reconciliation

The November SEC exhibit reports $0.9808B revenue and $7.4256B cash. Current debt of $0.1875B plus $14.0033B noncurrent debt gives $14.1908B in reported carrying amounts, replacing $2.5B. Quarterly OCF was negative $0.273B, reversing the previously entered positive $0.3B. Cash purchases of PP&E and intangibles were $7.3004B, implying negative $7.5734B gross FCF. This CapEx is consolidated and does not identify the GPU purchase share. The previous $1B of undrawn credit was removed from the historical record because the reviewed exhibit does not support that amount. Trade accounts payable remains separate from the issuer's aggregate payables and accruals line. Future financing and operating margins remain scenario inputs. [SEC earnings exhibit](https://www.sec.gov/Archives/edgar/data/1513845/000110465926126008/tm2629571d1_ex99-1.htm), [issuer shareholder letter](https://assets.nebius.com/assets/5bc733ff-bed7-415c-af10-74ce7881a764/Nebius-SHL-2026-Q3.pdf).
