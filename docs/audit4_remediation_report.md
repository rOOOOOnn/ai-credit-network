# Audit 4.0 remediation report

## Executive summary

This branch implements company financing forecasts, cohort-based GPU refresh cash costs, lease cash scenarios, a quarterly financing ledger, phased guarantees, operational revenue recovery and liquidity diagnostics. The original v3 path remains available for regression. Audit acceptance remains open where key inputs and model behavior still require verification, including the field-level source review and contract-specific exposures identified below.

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

### Oracle commenced lease maturity reconciliation

The August 31 filing reports $48.050B operating and $15.195B finance lease payments for leases already commenced. Deducting imputed interest of $13.429B and $6.010B reconciles to the two recognized liabilities, $34.621B and $9.185B. The data now preserve the seven disclosed fiscal maturity buckets, including $3.219B operating and $0.620B finance payments for the remainder of fiscal 2027. It also retains historical cash paid of $0.950B operating and $0.186B finance, and $1.539B of noncash finance lease additions. These fiscal buckets are disclosed aggregates. A quarter-specific interest and principal allocation is still unavailable. The model keeps these disclosures separate from the $288B uncommenced scenario and does not post the disclosed operating amounts on top of baseline operating costs. [Oracle 10-Q, Note 6](https://www.sec.gov/Archives/edgar/data/1341439/000119312526389274/orcl-20260831.htm).

### Standalone page data parity

Data validation originally compared CSV row counts without checking the data embedded in the three standalone pages. A direct comparison reproduced stale records for CoreWeave, Nebius, and Vistra and four revolving-credit transactions. All three pages now carry the repository datasets. The validator compares every embedded entity, transaction, and schema value and checks that the repository engine is embedded in each page. The CSV export also now includes the reconciled Nebius and Vistra opening snapshots.

## Reproducible comparison on the current data

Run `node scripts/replay_audit4_financing.cjs` from a checkout containing the continuation commit. The script loads the engine and both datasets directly from `a515599901f062c138f3a86fadf360817f96c4b7` and applies the same requested annual paths on the current audited profile. The original `b727da2` baseline predates these input modes. Cash and gap are 2028Q4 USD billions. A dash in runway means there is no positive burn denominator. A dash in either event field means the event did not occur during the forecast.

| Version | Entity | Path | Cash | Funding gap | Runway months | First default | FCF break-even |
| --- | --- | --- | ---: | ---: | ---: | --- | --- |
| Continuation | OPENAI | Manual | -15.5228 | 25.5228 | 0 | 2028Q2 | — |
| Remediated | OPENAI | Manual | -18.1923 | 28.1923 | 0 | 2028Q2 | — |
| Continuation | OPENAI | Curve | -15.5178 | 25.5178 | 0 | 2028Q3 | — |
| Remediated | OPENAI | Curve | -18.1923 | 28.1923 | 0 | 2028Q2 | — |
| Continuation | OPENAI | Freeze | -46.1816 | 56.1816 | 0 | 2027Q4 | — |
| Remediated | OPENAI | Freeze | -48.0878 | 58.0878 | 0 | 2027Q4 | — |
| Continuation | ANTHROPIC | Manual | 201.8728 | 0 | — | — | 2026Q4 |
| Remediated | ANTHROPIC | Manual | 270.9793 | 0 | — | — | 2026Q4 |
| Continuation | ANTHROPIC | Curve | 201.8728 | 0 | — | — | 2026Q4 |
| Remediated | ANTHROPIC | Curve | 270.9793 | 0 | — | — | 2026Q4 |
| Continuation | ANTHROPIC | Freeze | 171.8728 | 0 | — | — | 2026Q4 |
| Remediated | ANTHROPIC | Freeze | 240.9793 | 0 | — | — | 2026Q4 |
| Continuation | CRWV | Manual | -1.2404 | 3.2404 | 0 | 2028Q4 | — |
| Remediated | CRWV | Manual | 3.3409 | 0 | 1.5318 | — | — |
| Continuation | CRWV | Curve | -1.1763 | 3.1763 | 0 | 2028Q4 | — |
| Remediated | CRWV | Curve | 3.3409 | 0 | 1.5318 | — | — |
| Continuation | CRWV | Freeze | -31.6668 | 33.6668 | 0 | 2027Q1 | — |
| Remediated | CRWV | Freeze | -26.211 | 28.211 | 0 | 2027Q1 | — |

OpenAI's manual and curve cash improve while their first default quarters stay in 2028Q2 and 2028Q3. In scenario freeze, cash worsens by $1.9062B and first default stays in 2027Q4. These are whole-profile differences that include changes to counterparties and contagion. Anthropic's higher opening cash and the revised estimated financing proceeds increase its liquidity in all three paths. Scenario freeze still lets the separately modeled closing proceeds enter. CoreWeave's manual and curve no longer trigger default through 2028, while freeze still triggers in 2027Q1. Its opening cash-flow and facility corrections change financial capacity and network outcomes. None of the CoreWeave or OpenAI paths reaches modeled FCF break-even. These comparisons do not isolate individual changes or establish underlying private-company forecast inputs.

### GPU scenario horizon

A 2027Q1 purchase with a seven-year economic life previously disappeared from the refresh sensitivity because the browser forecast ended at 2033Q4. The browser now extends the timeline and annual table through the first eligible refresh for each positive scenario GPU cohort or purchase, subject to the existing 2040 simulation ceiling. A $2B GPU purchase with 50% replacement and 25% residual produces no refresh capital spending at 2033Q4, then $1B of purchases and $0.25B of disposal proceeds in 2034Q1. The operating profile and fiscal disclosures remain unchanged. The regression checks these amounts and the browser test verifies the 2034 annual row on all three pages.

GPU scenario output now displays the end-of-quarter cohort age weighted by purchase cost, sale proceeds, net refresh cash outflow, and FCF. The age is a scenario measure and is unavailable without a modeled fleet. When a three-year-old $2B cohort replaces half its cost with new equipment priced at par, the cost-weighted closing age is 1.5 years. The $1B replacement purchase less $0.25B proceeds gives $0.75B net refresh outflow. FCF retains its OCF-minus-CapEx definition and the proceeds are separately added as investing cash. Gross replacement CapEx remains visible.

### Full-engine 3–7 year GPU sensitivity

Run `node scripts/replay_audit4_gpu.cjs`. Each case assigns the selected company a hypothetical $10B GPU cohort acquired in 2026Q4. Reference cases change only economic life and use 25% quarterly replacement, a 20% resale residual and 10% lower replacement prices. Combined stress uses a four-year life, 5% residual and 30% lower prices, halves the selected company's reference revenue-growth input, adds 200 basis points to its interest rate and freezes its scenario financing. Contracted financing and other companies keep their audit profile. This is a normalized stress input, not a reconstruction of any company's GPU inventory. Cash and funding gap are in USD billions.

| Entity | Life | Profile | First refresh | 2030Q4 cash | 2030Q4 gap | 2032Q4 cash | 2032Q4 gap | First default |
| --- | ---: | --- | --- | ---: | ---: | ---: | ---: | --- |
| CRWV | 3 | Reference | 2029Q4 | -9.2759 | 11.2759 | -21.738 | 23.738 | 2029Q2 |
| CRWV | 4 | Reference | 2030Q4 | -0.7891 | 2.7891 | -16.8258 | 18.8258 | 2030Q4 |
| CRWV | 5 | Reference | 2031Q4 | 4.7389 | 0 | -12.5015 | 14.5015 | 2031Q4 |
| CRWV | 6 | Reference | 2032Q4 | 8.5395 | 0 | -5.6939 | 7.6939 | 2032Q2 |
| CRWV | 7 | Reference | 2033Q4 | 10.5957 | 0 | -2.1977 | 4.1977 | 2032Q3 |
| CRWV | 4 | Combined stress | 2030Q4 | -83.9581 | 85.9581 | -139.2453 | 141.2453 | 2027Q1 |
| OPENAI | 3 | Reference | 2029Q4 | 47.3241 | 0 | 27.1594 | 0 | — |
| OPENAI | 4 | Reference | 2030Q4 | 50.9129 | 0 | 27.9124 | 0 | — |
| OPENAI | 5 | Reference | 2031Q4 | 52.6629 | 0 | 29.0479 | 0 | — |
| OPENAI | 6 | Reference | 2032Q4 | 52.6629 | 0 | 32.6367 | 0 | — |
| OPENAI | 7 | Reference | 2033Q4 | 52.6629 | 0 | 34.3867 | 0 | — |
| OPENAI | 4 | Combined stress | 2030Q4 | -169.7052 | 179.7052 | -297.3603 | 307.3603 | 2027Q3 |
| ANTHROPIC | 3 | Reference | 2029Q4 | 234.3174 | 0 | 196.9005 | 0 | — |
| ANTHROPIC | 4 | Reference | 2030Q4 | 237.9062 | 0 | 197.6535 | 0 | — |
| ANTHROPIC | 5 | Reference | 2031Q4 | 239.6562 | 0 | 198.789 | 0 | — |
| ANTHROPIC | 6 | Reference | 2032Q4 | 239.6562 | 0 | 202.3778 | 0 | — |
| ANTHROPIC | 7 | Reference | 2033Q4 | 239.6562 | 0 | 204.1278 | 0 | — |
| ANTHROPIC | 4 | Combined stress | 2030Q4 | 209.8234 | 0 | 164.3694 | 0 | — |
| ORCL | 3 | Reference | 2029Q4 | 15.1918 | 0 | 21.1506 | 0 | — |
| ORCL | 4 | Reference | 2030Q4 | 18.7806 | 0 | 21.9036 | 0 | — |
| ORCL | 5 | Reference | 2031Q4 | 20.5306 | 0 | 23.0391 | 0 | — |
| ORCL | 6 | Reference | 2032Q4 | 20.5306 | 0 | 26.6279 | 0 | — |
| ORCL | 7 | Reference | 2033Q4 | 20.5306 | 0 | 28.3779 | 0 | — |
| ORCL | 4 | Combined stress | 2030Q4 | -164.5757 | 174.5757 | -306.3832 | 316.3832 | 2027Q4 |

At the first eligible quarter, the reference scenario allocates $2.25B to replacement CapEx and $0.50B to resale proceeds, for a $1.75B investing cash outflow. Shortening life from six to four years advances this first outflow from 2032Q4 to 2030Q4. At 2030Q4 it reduces CoreWeave modeled cash by $9.3286B and produces a $2.8289B gap versus zero. By 2032Q4 the four-year gap is $18.8652B versus $7.7333B in the six-year reference. That full-model difference includes collateral and refinancing effects that can precede replacement. In the other three profiles the same 2030Q4 cash difference is $1.75B and no reference funding gap opens. The combined stress has multiple simultaneous changes. It does not isolate the effects of lower replacement prices, residual values or financing.

The end-to-end regression independently fixes a solvent zero-debt fixture and tests every economic life from three to seven years. Its $100B fleet produces $22.5B gross CapEx and $5B resale proceeds in each first eligible quarter, reducing FCF by $22.5B and cash by $17.5B against the no-refresh path. The accounting life remains fixed across all cases.

### Physical retirement scenario

An explicit physical limit now retires the remaining cohort in that quarter. The scenario assumes full replacement of the retired capacity at the configured replacement price. Economic refresh can still replace a portion earlier. Accounting life has no cash trigger. At physical retirement collateral uses the configurable retirement residual, zero by default. In the independent test, a $20B cohort with four-year physical and six-year economic life retires in 2030Q4. With a 10% price decline and 5% retirement residual, replacement spending is $18B, proceeds and opening collateral are $1B each, and FCF and cash fall $18B and $17B respectively against the no-refresh path.

### GPU collateral and lender recovery

A scenario cohort can explicitly pledge its modeled value to a single GPU-backed or equipment financing transaction through `pledgedTo`. At default, only remaining pledged equipment contributes to recovery, capped at funded principal, with the existing loss rate applied to residual EAD. Sold units are absent from the closing fleet and replacement units start without a lien. Unallocated company fleet value does not establish a lender's security. The independent TX27 scenario has $10B funded EAD, $2.4B modeled pledged recovery and 45% residual LGD. This gives one credit event with a $3.42B loss and $6.58B expected total recovery. The additional $50B unpledged fleet in the test contributes nothing to that lender's recovery. No real fleet-to-lien allocation is inferred.

### Financing horizon and browser checks

Manual amounts entered in 2033 previously appeared editable while the engine discarded them at the default six-year curve cutoff. Manual amounts now follow their explicit years and the same remaining and quarterly caps. The full-engine regression independently verifies four $1B payments in 2033 and a $4B cash increase with no remaining capacity. The browser test enters the late-year amount on each page, then switches to a curve and verifies that editing its equity base changes modeled funding. Curve horizons can extend the browser timeline within the engine's 2040 ceiling.

### Source-specific historical financing trends

Historical mode uses each source's most recent uninterrupted run of complete annual Actual observations. It calculates compound annual growth from the first and last amounts and projects from the last observation. A three-year $4B, $2B and $4B funding cycle now projects $4B for the following year, compared with $8B when only the most recent rebound was extrapolated. A source needs at least two consecutive years with a positive starting amount. This method can still project rapid growth when the full run grew rapidly, so projected financing remains constrained by the scenario limits. Latest equity observations no longer displace an older, independently complete debt pair. The page shows the years and actual amounts used for each source and explicitly lists sources that lack usable records. A gap or an intermediate zero ends the usable run. Partial years and estimates remain unavailable. Any gap after the last observation is part of the extrapolation, and projected amounts remain assumptions subject to funding caps. The browser fixture supplies synthetic historical records and checks disclosure and modeled cash funding. Company-level source coverage remains governed by the source register.

### CoreWeave verified annual financing history

The audited CoreWeave 2025 10-K supplies comparable calendar-year debt issuance proceeds of $1.404B, $7.018B and $11.829B for 2023–2025. Equity security issuance proceeds were $0.436B, $1.172B and $1.491B, assembled from reported common shares, preferred shares and IPO proceeds. Employee option exercises are excluded. The series uses the cash-flow statement's net issuance basis and excludes principal repayments, dividends, and noncash equipment financing. The historical curve now loads these records automatically for CoreWeave. User-provided history takes precedence. The 2026 interim disclosures remain outside this complete-year series, and extrapolated 2027 amounts remain assumptions. Other source categories remain unavailable pending a comparable annual split, including separating asset-backed proceeds from consolidated debt without counting them twice. [CoreWeave 2025 Form 10-K](https://www.sec.gov/Archives/edgar/data/1769628/000176962826000104/crwv-20251231.htm).

### Anthropic verified annual financing history

The final prospectus cash-flow statement provides complete 2023–2025 calendar-year records. Preferred plus common issuance proceeds were $0.448B, $1.198B and $16.659B. Cash convertible-note proceeds were $1.750B, $6.050B and $3.450B. SAFE cash proceeds were $0.122B in 2023 and zero in 2024 and 2025. In 2025 the $0.149B common-stock repurchase reconciles $20.109B in the two issuance categories to $19.960B net financing cash. Noncash conversions are excluded. The audited historical curve reads these inputs automatically when selected for Anthropic and excludes the incomplete 2026 calendar year. The IPO closing estimate stays in its separately modeled event.

The 2024–2025 equity growth rate reflects episodic fundraising. Extrapolating that rate for two years is a mechanical assumption and can produce very large requested amounts. The regression confirms that a $2B cumulative cap and $1B quarterly cap bind regardless of the projected amounts. A zero-to-zero SAFE history does not establish a financing growth rate. [Anthropic final prospectus, page F-13](https://www.sec.gov/Archives/edgar/data/2130357/000162828026074944/anthropicpbc-424b4.htm).

### OpenAI financing announcements and annual coverage

The historical curve now links the issuer's disclosed events while keeping its full-year historical series unavailable. OpenAI announced $6.6B of new funding in October 2024 and $40B in March 2025. In March 2026 it disclosed $122B in committed capital at the round closing. Its separate revolver was $4B and undrawn at the October 2024 closing, and approximately $4.7B and undrawn at the March 2026 round closing. The original and expanded credit limits are snapshots of one facility. The announcements do not give complete cash receipt or repayment calendars or a complete annual funding series by source. The independent regression confirms that the announcement amounts create no scenario cash inflow in historical mode without eligible records. The TX06A/B lender split remains a model allocation. [October 2024 funding](https://openai.com/index/scale-the-benefits-of-ai/), [2024 credit facility](https://openai.com/index/new-credit-facility-enhances-financial-flexibility/), [March 2025 funding](https://openai.com/index/march-funding-updates/), [March 2026 funding and facility](https://openai.com/index/accelerating-the-next-phase-ai/).

### Commitment expiry versus loan maturity

A delayed-draw facility previously stopped funding after its commitment termination date but still reported the unused amount as drawable and available for undrawn EAD. The ledger now zeros drawable capacity after the cutoff independently of loan maturity. Historical cumulative draws and the arithmetic unused commitment remain visible. In the independent fixture the borrower draws $2B of a $5B commitment before the March cutoff. The remaining $3B ceases to be drawable in Q2 and $2B of principal remains until its Q4 repayment. The separate revolving fixture repays $0.4B on CoreWeave's facility. Borrower cash and debt fall by $0.4B, principal falls from $1.2B to $0.8B, and availability restores from $0.754B to $1.154B after the letter-of-credit reserve.

### Refinancing origination reconciliation

The quarterly output now exposes modeled rollover originations linked to the repaid instruments where those repayments are represented in the ledger. If multiple obligations mature together, funded rollover is allocated across documented principal repayments without exceeding them. Any unassignable amount remains unmatched. Each new lender remains blank unless separately evidenced, and immediate refinancing draw is classified as an assumption. The regression verifies $3B repaid, $3B of new rollover principal, no assumed debt draw, and zero residual on the old instrument. Later amortization of the replacement facility remains within unattributed debt until instrument terms are available.

When an explicit scenario maturity is provided through `refinancingTerms[oldTransactionId]`, the replacement draw now enters the financing ledger on origination. The optional lender is a scenario assignment. Subsequent quarter opening principal, explicit repayments, maturity and default routing use the same path as other term facilities. The old instrument closes and borrower cash already includes the rollover once. A $3B regression verifies the new closing and opening balance, a $1B partial repayment, a $2B maturity payment and named-principal reconciliation. In the absence of a valid maturity, the existing origination record remains the available evidence and later terms remain unknown.

### Downloadable quarterly credit ledger

Each of the three pages now exports the current scenario's quarterly credit ledger as JSON from the Data dialog. It includes the input entities, transactions and scenario settings, facility and guarantee ledgers, refinancing originations, debt reconciliation and default credit events. JSON retains a distinction between unknown amounts and zero. The browser test opens each page, changes the forecast horizon through a GPU scenario, downloads the ledger, and checks the resulting final quarter and the initial TX26 principal and unknown undrawn amount.

### TX26 syndicate attribution and collateral scope

The March launch identifies Blackstone Credit & Insurance as the anchor and confirms other syndicate participants. No funded allocation is disclosed. Audit 4 now preserves the facility-level $4.583B default exposure without charging the entire exposure to the anchor. The inherited network edge identifies the anchor relationship. The audit loan row and credit event show the lender allocation as unavailable. The September filing separately reports approximately $2.2B floating and $2.4B fixed-rate outstanding, both rounded, and $0.233B current plus approximately $5.2B noncurrent assets securing the facility. These asset balances are accounting disclosures. Realizable liquidation value and GPU-specific lien allocations remain unknown. The $151M originally capitalized financing cost does not establish quarter-end facility carrying value. Cumulative draws, actual principal repaid, facility-specific carrying value and pre-cutoff drawable capacity remain blank. [March announcement](https://www.sec.gov/Archives/edgar/data/1769628/000176962826000129/ex991.htm), [September 10-Q, Note 10](https://www.sec.gov/Archives/edgar/data/1769628/000176962826000465/crwv-20260930.htm).

### TX26 floating-rate sensitivity

The audit profile uses the reported rounded fixed/floating mix as weights on the exact $4.583B principal. The disclosed $2.2B floating and $2.4B fixed split implies $2.1919B of modeled floating principal after normalization. Quarterly modeled accrued interest now follows the corresponding instrument mix. At the test's assumed 7.5% floating and 5.9% fixed rates, the audited SPV interest agrees with the TX26 accrual. The assumed rates and continuing tranche mix do not establish actual cash interest or subsequent tranche allocations. The nine-path company financing replay is unchanged to displayed precision. [CoreWeave September 10-Q, Note 10](https://www.sec.gov/Archives/edgar/data/1769628/000176962826000465/crwv-20260930.htm).

### Whole-ledger principal reconciliation

The baseline through 2033Q4 reproduced 81 borrower-quarter cases where aggregate debt fell below named loan balances. Cash and borrower debt already reflected the modeled generic principal payment, while named loan balances only reflected explicitly scheduled payments. The audit profile now applies generic payments to unidentified opening debt first and allocates any excess proportionally across active, non-defaulted instruments. The ledger flags the allocated payment as inferred. This books the same cash outflow once, adjusts outstanding lender principal, and restores revolving capacity for available facilities. It does not establish the actual contractual installment.

The full-quarter regression covers 840 facility rows, reconciles opening plus draws less repayments and conversions to ending principal, and checks every borrower-period for negative unattributed debt in this baseline. The 2026Q4 TX26 example begins at $4.583B and ends at $4.233B after a $0.35B modeled repayment. The remaining $0.3485B of borrower debt is newly funded and unattributed. The previously reported nine financing paths retain their displayed values.

### SB Energy project-level call reconciliation

The guarantee ledger now shows project phases, credited rent, effective exposure, current calls and remaining liability. Both readiness and lease commencement are required. Early termination ends the relevant exposure. During persistent borrower default, a later eligible project may trigger its own one-time call; an earlier project's call does not transfer to it. The assumed cash calls are still bounded by the disclosed $105B maximum across all quarters. A two-project fixture with $80B per project and a 100% scenario call rate pays $80B on the first and only $25B on the second after the first terminates. The default nine-project scenario also verifies a second call without repeating the first. The modeled installments, payment profiles and call rate remain assumptions.

Project rows now retain credited rent after termination and retain the scenario cap and milestone dates in the downloadable ledger. Payments before activation or on or after termination do not enter cumulative credited rent. A credit event also gives the project indexes and call amounts that reconcile to its recognized loss. In the termination fixture, $3B of eligible prior rent remains visible with zero effective exposure. A second-quarter call event under persistent default separately identifies the second project and its $2.9167B assumed payment.

### A–G stress tests on the audited profile

The original A–G tests retained the legacy profile as a regression. The same inputs now also run against the audit profile and independently reconcile modeled cash, FCF, funding gap and loan principal for all eligible borrower-quarters through 2028Q4. This found a mismatch in Case F at SPV_XPV. When only defaulted facilities remained, assumed generic principal payments could decrease aggregate debt with no corresponding instrument repayment. The model now limits generic payments to unidentified opening debt and performing principal available after identified amortization. Defaulted principal remains in the workout ledger while no workout payment is specified.

| Case | Entity | 2028Q4 cash | 2028Q4 FCF | Funding gap | First model default |
| --- | --- | ---: | ---: | ---: | --- |
| A | OpenAI | -64.6984 | -13.3109 | 74.6984 | 2027Q4 |
| B | Anthropic | 104.3167 | -0.8852 | 0 | — |
| C | CoreWeave | -35.8641 | -3.3004 | 37.8641 | 2027Q1 |
| D | Oracle | -80.323 | -21.4009 | 90.323 | 2027Q4 |
| E | CoreWeave | -34.1454 | -3.3912 | 36.1454 | 2027Q1 |
| F | CoreWeave | -43.8987 | -4.8786 | 45.8987 | 2027Q1 |
| G | CoreWeave | -60.1128 | -5.7082 | 62.1128 | 2026Q4 |

Values are scenario results in USD billions, reproducible with `node tests/audit4_foundations.cjs` in the final A–G table. The cash identity includes loan and lease principal, collateral-related margin, equipment sale proceeds, investment sales and both project and unallocated guarantee cash payments. The financing source sum is also verified for every eligible company-quarter. The updated CoreWeave values reflect the full audited profile. First default quarters are unchanged from the earlier audited replay.

### Operational deferred-revenue roll-forward

The quarterly audit export now includes an operational revenue subledger by contract, customer and disruption quarter. It records scheduled recovery quarter, beginning amount, new deferral, recovered revenue, associated cash and ending pending amount. Each amount is removed after recovery. If customer forecast data are unavailable at the scheduled date, an item stays pending. The Core Scientific-to-CoreWeave fixture independently reconciles both initial deferrals to 2027Q2 recovery and associated cash, then confirms that recovered items do not reappear in 2027Q3. Permanent losses and migration costs remain outside the deferred balance.

### L4 cash interest and refinancing bridge

The audit profile now charges the new intra-quarter spread against the modeled opening floating principal and only for the incremental spread within the cap. The charge flows once through OCF and is included in interest expense. The next quarter uses the decayed opening spread for its cash interest and refinancing multiplier. The exportable engine state exposes opening and closing spread, exposed principal, and the multiplier. In the CoreWeave regression, a 100bp closing shock becomes 50bp at the next opening, giving a 0.95 refinancing multiplier. The nine-path financing table has been refreshed. Default dates are unchanged in those paths.

### L4 peer classification

The audited peer rule now requires a shared populated entity type or sector, or membership in the cloud/neocloud category for both sides. The legacy profile remains available for the inherited regression. The audit regression reproduces the original issue of a CoreWeave default widening Dell's spread solely because both type fields were missing. The corrected path still widens Oracle's spread as a cloud peer and preserves contractual contagion paths. The refreshed A–G and nine-path comparisons above show the effect of using the narrower, data-backed peer condition. Actual market cross-sector correlations remain unavailable in this calibration.

### Financing sustainability across five comparable stresses

Run `node scripts/replay_audit4_sustainability.cjs`. Each row is a scenario output at 2028Q4. Balances and cash flows use USD billions. Financing dependency and minimum FCF revenue growth are ratios in decimal form. A dash means the event is absent in the horizon or the ratio has no positive denominator. Required financing nets available undrawn credit against the funding gap.

The Base path requests $20B and $18B of annual scenario equity in 2027 and 2028. Revenue slowdown halves the initial modeled growth input and adds 50 basis points to fixed and floating rate assumptions. The Downside taper requests $12B and $6B and adds 100 basis points. Freeze sets scenario issuance to zero and adds 200 basis points. Combined severe stress halves initial growth, freezes scenario issuance and adds 250 basis points. The floating shock acts at market level while the fixed adjustment is applied to the selected company. The paths share a $38B cumulative cap and $5B quarterly cap. Scheduled equity, contractual draws and rollovers follow separate rules. These are normalized tests and do not represent commitments.

| Entity | Scenario | End cash | OCF | FCF | Quarterly burn | Funding dependency | Available liquidity | Runway (months) | Funding gap | Required financing | Minimum FCF revenue growth | First default | First FCF break-even |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- |
| OPENAI | Base | -10.1923 | -6.8415 | -8.3415 | 8.3415 | 0.5395 | 0 | 0 | 20.1923 | 20.1923 | 1.26 | 2028Q2 | — |
| OPENAI | Revenue slowdown | -28.1012 | -12.0843 | -13.5843 | 13.5843 | 0.3313 | 0 | 0 | 38.1012 | 38.1012 | 3.1325 | 2028Q1 | — |
| OPENAI | Funding taper (downside) | -31.7268 | -6.6019 | -8.1019 | 8.1019 | 0.1851 | 0 | 0 | 41.7268 | 41.7268 | 1.2944 | 2027Q4 | — |
| OPENAI | Funding freeze | -47.7955 | -6.641 | -8.141 | 8.141 | 0 | 0 | 0 | 57.7955 | 57.7955 | 1.3002 | 2027Q4 | — |
| OPENAI | Combined severe stress | -61.742 | -10.5544 | -12.0544 | 12.0544 | 0 | 0 | 0 | 71.742 | 71.742 | 3.2684 | 2027Q3 | — |
| ANTHROPIC | Base | 278.9793 | 3.1119 | 2.7119 | 0 | — | 293.7743 | — | 0 | 0 | -0.3639 | — | 2026Q4 |
| ANTHROPIC | Revenue slowdown | 267.5329 | 0.8803 | 0.4803 | 0 | — | 282.3279 | — | 0 | 0 | -0.1564 | — | 2026Q4 |
| ANTHROPIC | Funding taper (downside) | 258.8337 | 3.0995 | 2.6995 | 0 | — | 273.6287 | — | 0 | 0 | -0.3623 | — | 2026Q4 |
| ANTHROPIC | Funding freeze | 240.7253 | 3.0876 | 2.6876 | 0 | — | 255.5203 | — | 0 | 0 | -0.3607 | — | 2026Q4 |
| ANTHROPIC | Combined severe stress | 229.2987 | 0.8522 | 0.4522 | 0 | — | 244.0937 | — | 0 | 0 | -0.1523 | — | 2026Q4 |

In the OpenAI paths, the modeled funding gap grows from $15.6028B in Base to $41.6697B under the Downside taper and $71.7018B under Combined severe stress. First model default advances from 2028Q3 to 2027Q3 between Base and Combined severe stress. Anthropic's strong opening liquidity and separate IPO proceeds estimate support positive ending cash in all five paths. Under Combined severe stress its quarterly FCF is $0.4514B, versus $2.7119B in Base. That result depends on the opening cash and operating assumptions. The separate no-proceeds sensitivity remains in the report. Minimum revenue growth is a local break-even calculation at existing costs and margins, not an annual growth forecast.

### Operating and refinancing assumptions in the financing panel

The three pages expose optional cash operating margin before modeled interest and incremental compute and rent, quarterly base CapEx growth, and firm-level refinancing success. Clearing the margin input restores the existing calibrated operating model. A growth rate applies to base CapEx from the starting quarter, while the GPU purchase allocation remains bounded by that growing base and refresh CapEx stays separate. The sample $4B quarterly sales fixture at 50% margin and $1B opening CapEx growing 10% per quarter produces $2B OCF, $1.1B CapEx and $0.9B FCF in the following quarter. The corresponding break-even revenue is $2.2B. The browser check edits the CapEx growth field and verifies the exported scenario records the change.

### Incremental research and working capital cash flows

The company detail panel now supports incremental R&D cash cost and working-capital cash use (negative for a release). Those inputs affect operating cash, FCF and the break-even revenue calculation. They are cash-only scenario overlays on the existing cost base and do not imply a tax benefit or separately disclosed historical R&D. The audit export lists modeled incremental compute, interest, research, working capital and rent separately alongside final OCF and FCF. In an independent $4B revenue fixture, a 50% margin gives $2B before incremental costs. After $0.2B compute, $0.3B research and $0.4B working capital, OCF is $1.1B and FCF is $0.1B at $1B CapEx. Break-even revenue is $3.8B, 5% below the previous quarter.

## Acceptance evidence by requirement

Status below applies to the audited research profile. Model acceptance requires both executable coverage and a clearly stated boundary on the input data. The original Git baseline is `b727da282df7551e13bc3c1b79a6632b4bff1fed`. The continuation comparison uses `a515599901f062c138f3a86fadf360817f96c4b7`. The [independent branch](https://github.com/rOOOOOnn/ai-credit-network/tree/audit4-financing-gpu-remediation) and its [Actions runs](https://github.com/rOOOOOnn/ai-credit-network/actions?query=branch%3Aaudit4-financing-gpu-remediation) retain the commit and test history.

| Requirement | Evidence checked | Outstanding work or data |
| --- | --- | --- |
| P0-1. Financing limits and loan reconciliation | The $1.0003B regression covers cap rounding, mixed sources, zero limits and capacity exhaustion. Loan tests cover TX06A/B draw and exposure, commitment expiry, maturity, extension, repayment, rollover and default. The baseline's 840 ledger rows and all A–G borrower-quarters reconcile. | Unattributed balances still exist. Borrower-level disclosures do not identify every instrument, lender share or actual installment. Where terms are missing, the replacement loan's later amortization remains unallocated. |
| P0-2. CoreWeave and SPV | The TX26 tests and 10-Q reconciliation establish $8.5B capacity, $4.583B principal, consolidated non-recourse classification and aggregate facility exposure. The modeled portfolio applies the reported tranche mix to exact principal. | Cumulative funding, repayments, standalone carrying amount and TX26-specific availability remain unavailable. The anchor-lender network edge is not a funded allocation. |
| P0-3. NVIDIA guarantees | Reconciles $105B SB Energy and $13B of other disclosed maximum gross guarantees. Project fixture checks activation, rent reduction, calls and termination. Export preserves scenario phases and the corresponding calls. | Individual project dates, contract caps, actual rent and actual calls remain unavailable. |
| P0-4. Oracle leases | $288B uncommenced commitments feed quarterly cash under adjustable tranche schedules. Commenced maturity buckets reconcile to reported liabilities. Independent tests cover commencement, final payment, expiry, FCF, cash and required revenue. | Oracle's existing lease principal and interest lack a verified quarterly allocation. The $288B project-level lease type, commencement dates and actual cash timing remain assumption inputs. |
| P0-5. L3 delay and recovery | The contract subledger tracks deferral, recovery and pending balances. The Core Scientific fixture verifies recovery occurs once and distinguishes permanent loss from migration and cash recovery. | Contract-level replacement capacity, churn and actual cash conversion remain unknown. |
| P0-6. Financing sustainability | Five stress profiles, before/after nine-path replay, finite source caps and cash/FCF/required financing diagnostics are executable. The funding regression now verifies unequal quarter weights with $2B, $0, $2B and $4B actual modeled draws and an $8B closing cash increase. | Investor-specific risk-appetite calibration and actual issuer capitalization tables remain open. OpenAI annual source-by-source cash history is incomplete. |
| P0-7. GPU refresh | 3–7-year cash tests, accounting/physical/economic life separation, attributable purchase cohorts, partial replacement, disposal and collateral recovery are covered. Four-company sensitivity is reproducible. | Generation-specific performance and independently sourced company GPU inventories and maintenance costs remain incomplete. |
| P1. Four-layer network | The A–G stress regression verifies audited cash, principal, FCF and funding gap for every eligible borrower-quarter. L4 applies only known peer relationships and charges modeled floating-rate exposure. | The bilateral results table and source cross-check below cover the requested pathways. L4 correlation and spread magnitudes remain scenario calibration. |
| P1. Data quality | The [50-entity source register](audit4_entity_source_register.md) identifies field gaps and issuer sources. Independent reconciliation exists for the published issuer updates documented above. | A field-level restatement and primary-source verification pass for all 50 entities is incomplete. Private cash-flow histories and several company-specific asset and obligation schedules remain unavailable. |
| UI and acceptance | All three pages use identical audited data. Browser tests cover manual and curve inputs, history disclosure, lease controls, GPU horizon and downloadable ledgers. Legacy 48 tests, dataset checks and independent audit cases run on the three platforms. | Browser runs have not manually exercised every optional company-level setting. Use the run linked to the exact candidate commit for acceptance. |

### Scenario equity dilution

The company panel accepts a scenario pre-money valuation and reports quarterly and cumulative dilution derived only from funded scenario equity. Each modeled raise dilutes existing ownership by equity issued divided by pre-money value plus equity issued. Cumulative ownership multiplies retained ownership across raises. Missing valuation for a positive raise leaves cumulative dilution unavailable. Strategic funding, customer prepayment, debt, and separately modeled closing events do not enter this calculation because their equity terms are not established.

The independent test supplies $4B of funded cash in each of two quarters, half issued as scenario equity and half strategic. At $18B pre-money the $2B quarterly equity raises dilute existing owners by 10% per quarter and 19% cumulatively. An $8B valuation gives 36% cumulative dilution on the same funded cash. The JSON export includes equity issued and both dilution measures. No actual ownership or valuation is inferred.

### GPU utilization, usage maintenance and cohort valuation

The three scenario panels now accept utilization and an annual usage-related maintenance ratio. The valuation applies utilization and an optional cohort-level market factor to the age-marked going-concern collateral. Physical scrap recovery follows its separate residual input. Usage maintenance is opening cohort cost times utilization times the annual ratio, divided by four. It reduces OCF and FCF as a cash cost. There is no assumed incremental maintenance at the default zero rate. In an independent $20B cohort at mid-economic life, $12B age-marked collateral falls to $6B at 50% utilization, or $4.5B with a further 0.75 cohort factor. Under an 8% annual usage maintenance assumption the quarterly cash charge is $0.2B. These are modeled sensitivities. Actual GPU revenue sensitivity and generation-specific workload capacity remain open pending issuer-level calibration.

### GPU utilization and modeled revenue

The panel now accepts a reference utilization and explicitly declares what share of sales can move with utilization. Revenue adjustment equals unadjusted projected revenue times that share times (scenario utilization divided by reference utilization, minus one). The remaining revenue is not sensitive to utilization. The default share is zero, and a company without a modeled opening GPU fleet does not receive this adjustment. The engine removes the previous quarter's utilization adjustment from the underlying growth base before applying the current quarter shock. This prevents a persistent utilization level from repeatedly shrinking revenue while preserving separate operating disruptions. In the test, 50% utilization versus a 100% reference and a 50% sensitive share cuts modeled revenue by 25% against the reference in each of three quarters. FCF reconciles to the associated cash margin. The export includes the revenue adjustment.

### Bilateral operational pathway verification

Each supplier below was forced into model default separately under the Audit 4 profile. The fixture requires exact first-period amounts, a single migration cash charge per contract, separate permanent and deferred amounts, and no earlier L3 posting. The log now reports actual modeled revenue removed after the cap and exposes its deferred and permanent components. The amounts in USD billions are scenario outputs. They are not disclosures of realized losses.

| Supplier → customer | Instrument | First L3 quarter | Migration cash | Disrupted revenue |
| --- | --- | --- | ---: | ---: |
| CoreWeave → OpenAI | TX05A/B/C | 2026Q4 | 0.1512 | 0.1221 |
| CoreWeave → Microsoft | TX25 | 2026Q4 | 0.1485 | 0.1199 |
| Vertiv → CoreWeave | TX65 | 2026Q4 | 0.0343 | 0.0541 |
| Dell → CoreWeave | TX64 | 2026Q4 | 0.0250 | 0.0484 |
| Constellation → Microsoft | TX67 | 2028Q1 | 0.2112 | 0.1663 |
| Vistra → Meta | TX69 | 2027Q1 | 0.2677 | 0.2410 |
| Core Scientific → CoreWeave | TX66 | 2026Q4 | 0.0577 | 0.0743 |
| NVIDIA → CoreWeave | TX24 | 2026Q4 | 0.4620 | 0.4851 |
| Oracle → OpenAI | TX03 | 2027Q1 | 1.2600 | 1.2212 |

TX05A now links to the primary issuer announcement confirming the up-to-$11.9B agreement. This supports the contract ceiling, while the modeled quarterly run rate remains an assumption. Core Scientific's hosting announcement corroborates the commercial relationship with CoreWeave, while the model's aggregated TX66 timing remains indicative. Transaction links identify the other starting sources. Bilateral payment calendars, supplier substitution and churn still require contract-level verification. [CoreWeave initial OpenAI announcement](https://investors.coreweave.com/news/news-details/2025/CoreWeave-Announces-Agreement-with-OpenAI-to-Deliver-AI-Infrastructure/default.aspx), [Core Scientific hosting announcement](https://investors.corescientific.com/sec-filings/all-sec-filings/content/0001628280-24-026483/corzcoreweavehpc.htm).

### Dell operating cash and fiscal cutoff

The quarter ended July 31, 2026 reported $46.971B revenue, $11.569B cash, $8.481B current debt and $25.985B noncurrent debt. Consolidated debt therefore totals $34.466B. Trade payables were $49.723B and receivables $22.918B. The reported $6B revolving commitment had approximately $5.9B drawable after offsets and no cash borrowing. The corrected opening snapshot uses drawable availability. July-quarter OCF of $2.225B less $1.239B of capital spending and capitalized software yields $0.986B. This cash spending line is broader than GPU purchases and Dell's reconciliation describes the amount on a net basis. The fiscal quarter now starts in May in the dataset and still maps to the original research opening bucket.

Dell separately published the October 30 quarter on November 24. The later disclosure records $54.937B revenue, $13.553B cash, $37.697B debt, $57.799B payables and $4.459B OCF. Subtracting $0.985B of cash capital and software purchases yields $3.474B. The forecast still opens from July; treating the October update as an additional opening balance would double count the intervening period. The dollar amount and delivery schedule of Dell's CoreWeave hardware orders remain unverified. [July 10-Q](https://www.sec.gov/Archives/edgar/data/1571996/000157199626000046/dell-20260731.htm), [July earnings exhibit](https://investors.delltechnologies.com/sec-filings/all-sec-filings/content/0001571996-26-000039/exhibit991earnings8kq2fy27.htm), [October earnings exhibit](https://investors.delltechnologies.com/sec-filings/all-sec-filings/content/0001571996-26-000050/exhibit991earnings8kq3fy27.htm).

### Applied Digital and IREN opening data

| Entity and source period | Revenue | Cash and equivalents | Borrowings carrying amount | OCF | Cash capital purchases | OCF less purchases |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Applied Digital, June–August fiscal quarter | 0.341875 | 2.949909 | 6.376592 | 0.063921 | 2.074698 | -2.010777 |
| IREN, July–September fiscal quarter | 0.228 | 3.522 | 9.897 | 0.529 | 4.824 | -4.295 |

All amounts are in USD billions. APLD current debt is $0.112645B, long-term debt $6.263947B, trade payables $0.336865B and restricted cash $0.728034B. The property, equipment and other assets purchase line is broader than hardware. IREN's borrowings exclude $0.311B of finance leases and $0.007B of operating leases, shown separately. The $3.522B of cash excludes $2.256B of restricted cash. IREN's $2.693B of computer hardware payments and $2.131B of other PP&E purchases reconcile to $4.824B. The hardware line establishes neither GPU-only spending nor fleet age, so it does not automatically seed a cohort. Its $2.583B combined trade payables and accrued expenses does not establish standalone trade payables. The disclosed backlog is kept outside the RPO input until a comparable accounting measure is sourced. Model defaults for future spending and financing remain assumptions. [APLD August 10-Q](https://www.sec.gov/Archives/edgar/data/1144879/000114487926000059/apld-20260831.htm), [IREN quarterly exhibit](https://www.sec.gov/Archives/edgar/data/1878848/000187884826000065/irenreportsq1-fy27result.htm).


### Digital Realty and Equinix operating cash and debt basis

| 2026Q3, USD billions | Revenue | Unrestricted cash | Borrowings carrying amount | Q3 operating cash | Q3 capital purchases | Q3 FCF |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Digital Realty | 1.902418 | 0.802903 | 19.494615 | 0.382259 | 1.381983 | -0.999724 |
| Equinix | 2.571 | 2.362 | 22.647 | 1.243 | 1.558 | -0.315 |

The quarterly cash figures are September year-to-date less June year-to-date. Digital Realty operating cash is 1.977486 less 1.595227, and cash improvements are 3.166212 less 1.784229. Equinix operating cash is 3.027 less 1.784, and cash purchases of other PP&E are 4.392 less 2.834. FCF uses each displayed capital purchase definition. Real estate acquisitions, sale proceeds and investments in joint ventures remain outside these cash purchase measures. Equinix's $22.839B opening borrowing principal includes $22.820B of senior notes tracked in TX57 and $0.019B of other borrowing. The $0.192B difference between consolidated principal and borrowing carrying amount reflects issuance costs and discounts on the notes. Equinix reports $1.386B of operating and $2.378B of finance lease liabilities separately, approximately $5.5B of drawable revolving credit, and $15.9B of RPO. Its $0.694B of additional signed leases had yet to commence, with commencements expected from 2026 through 2029 and terms from 2 through 99 years. The disclosure establishes aggregate exposure. Quarterly cash stress remains unquantified until a payment schedule is sourced or a separately labeled scenario is specified. Standalone payables and GPU-only capital spending remain unverified. Digital Realty's comparable RPO, drawable revolver and borrower-side uncommenced lease schedules still need verification. [Digital Realty September 10-Q](https://www.sec.gov/Archives/edgar/data/1297996/000110465926120710/dlr-20260930x10q.htm), [Digital Realty June 10-Q](https://www.sec.gov/Archives/edgar/data/1297996/000110465926089296/dlr-20260630x10q.htm), [Equinix September 10-Q](https://www.sec.gov/Archives/edgar/data/1101239/000110123926000180/eqix-20260930.htm), [Equinix June 10-Q](https://www.sec.gov/Archives/edgar/data/1101239/000110123926000147/eqix-20260630.htm).


### TX26 disclosure bounds

CoreWeave identifies exactly three facilities in its September aggregate undrawn liquidity: the revolver, DDTL 4.0 and DDTL 5.5. The September balances therefore permit a conditional arithmetic range for TX26 even though its drawable amount is undisclosed. All figures below are USD billions.

| Item | Arithmetic | Result |
| --- | --- | ---: |
| Combined DDTL 4.0 and 5.5 availability | 5.653 reported credit availability less 0.754 RCF availability | 4.899 |
| DDTL 5.5 nominal headroom ceiling | 2.600 capacity less 1.555 outstanding | 1.045 |
| TX26 implied minimum | 4.899 less at most 1.045 available from DDTL 5.5 | 3.854 |
| TX26 nominal headroom ceiling | 8.500 capacity less 4.583 outstanding | 3.917 |
| TX26 conditional cumulative funding range | At least outstanding principal, at most 8.500 less 3.854 | 4.583 to 4.646 |
| TX26 conditional cumulative principal repaid range | Cumulative funding less 4.583 outstanding | 0 to 0.063 |
| TX26 standalone carrying amount arithmetic range | 4.583 principal less zero to 0.080 in combined non-recourse unamortized costs | 4.503 to 4.583 |

Section 2.06 of the executed agreement confirms that each draw reduces commitments dollar for dollar and permits permanent cancellations. Consequently, with unchanged gross facility capacity and no principal uplift, cumulative draws plus separately cancelled commitments plus remaining availability cannot exceed $8.500B. The lower availability bound implies cumulative draws of at most $4.646B. At least $4.583B was funded to support reported outstanding principal. The difference bounds cumulative repayment at $0.063B. Any cancellation or additional availability constraint can tighten the upper bound. These are conditional arithmetic limits at the reported precision. Section 2.07 identifies the agent register as the record required to resolve exact loans and payments. [Executed credit agreement, sections 2.06–2.07](https://www.sec.gov/Archives/edgar/data/1769628/000176962826000129/ex1011.htm).

The availability range assumes amounts use the same September 30 cutoff and that repayments do not create capacity in either delayed-draw term loan. It is a derived boundary on reported availability, with actual future draws still subject to conditions. The $0.080B of unamortized costs is shared across TX26 and other non-recourse financing in the filing. Exact cost allocation, cumulative funding and principal previously repaid remain unavailable. The ledger continues to leave standalone carrying value and available commitment blank. [CoreWeave September 10-Q, Note 10 and Risks Related to Our Indebtedness](https://www.sec.gov/Archives/edgar/data/1769628/000176962826000465/crwv-20260930.htm).


### CoreWeave tenant lease exposure

Note 8 reports $32.954B of commenced operating payments and $0.822B of commenced finance payments. Subtracting imputed interest of $14.257B and $0.173B respectively reconciles to $18.697B and $0.649B of recognized liabilities. The scenario input export now retains the disclosed annual buckets and the separate $47.4B estimate of undiscounted future payments for leases expected to start in 2026 through 2029. Terms range from seven to seventeen years. The filing excludes a separate variable rent arrangement capped at $16.9B and other variable arrangements covering 354 MW of undelivered power. The $0.188B to $0.817B estimated spend on lessee-owned equipment is a distinct capital commitment. The note also reports a $0.432B recognized finance liability and $1.2B of committed future payments for the equipment lessor. Those figures require careful reconciliation against the aggregates before any incremental cash flow is assigned. Project payment calendars, phase-level lease mix and overlap remain unresolved. These memorandum amounts are retained separately from the baseline cash flows. [CoreWeave September 10-Q, Note 8](https://www.sec.gov/Archives/edgar/data/1769628/000176962826000465/crwv-20260930.htm).


#### CoreWeave lease timing sensitivity

The following 2026Q4 overlay treats the $47.4B undiscounted aggregate as incremental operating rent, assumes immediate commencement after the reporting cutoff, and spreads the total evenly over the stated term endpoint. Classification, timing and overlap with calibrated cash costs are scenario assumptions. The full overlay describes gross sensitivity and may overstate incremental cash pressure if the calibrated baseline already includes some of these payments.

| Scenario, USD billions | Quarterly incremental payment | OCF | FCF | Ending cash | Required revenue |
| --- | ---: | ---: | ---: | ---: | ---: |
| Existing audited profile | 0 | 2.1585 | -3.0415 | 5.8911 | 0 |
| Immediate start, seven years | 1.6929 | 0.4656 | -4.7344 | 4.1982 | 2.56 |
| Immediate start, seventeen years | 0.6971 | 1.4614 | -3.7386 | 5.1940 | 0.54 |

Payments are $47.4B divided by 28 or 68. Both scenarios reduce first-quarter FCF and ending cash by the payment amount and leave the first-quarter funding gap at zero. The tests execute both paths via model overrides and verify those amounts. The $16.9B separate contractual maximum and unquantified variable arrangements are outside these scenarios. [CoreWeave September 10-Q, Note 8](https://www.sec.gov/Archives/edgar/data/1769628/000176962826000465/crwv-20260930.htm).


Delaying the seven-year scenario four quarters leaves the full $47.4B uncommenced and pays zero through 2027Q3. In 2027Q4 both immediate and delayed scenarios pay $1.6929B and have FCF of negative $4.4515B. Closing cash of $12.2908B in the delayed path exceeds the $5.5192B immediate-start balance by $6.7716B, equal to four installments rounded individually to four decimal places. This fixture tests the timing effect independently from the contractual cost, which remains unchanged.


### SB Energy residual value guarantee contract conditions

The November S-1 amendment confirms a residual value guarantee on nine buildings and 4.25 GW-IT. The call conditions are tenant insolvency or an uncured monetary default. The remedies include assuming the tenancy, reletting or, after unsuccessful reletting, a sale. The option to defer that election for up to one year and the first six months of security deposit/project-reserve funding can change the timing of cash paid. A qualifying tenant credit rating or replacement guarantee or lease can trigger release. The optional 3.78 GW-IT expansion is outside the committed $105B cap. TX11 now retains these disclosed terms and both primary filing links. The standardized scenario still approximates calls with modeled credit loss and lacks the actual appraisal, cure, reserve and reletting schedules. [SB Energy S-1 amendment](https://www.sec.gov/Archives/edgar/data/2133037/000162828026075026/sbenergy-sx1a3.htm), [NVIDIA CFO disclosure](https://www.sec.gov/Archives/edgar/data/1045810/000104581026000088/q3fy27cfocommentary.htm).


The project scenario also accepts an assumed quarter for a qualifying tenant rating or qualifying replacement support. The first qualifying event or scheduled termination ends the open exposure and preserves previously called cash. The independent fixture starts with a $12B cap, $2B of rent and a $1B prior call. Remaining liability is $9B before replacement and zero on replacement, while the $1B prior call remains recorded. Project-specific eligibility and dates still require additional disclosure. [SB Energy S-1 amendment](https://www.sec.gov/Archives/edgar/data/2133037/000162828026075026/sbenergy-sx1a3.htm).


The TX11 stress model now accepts a scenario cash settlement lag in quarters. A modeled call consumes guarantee capacity when recognized, while cash posts once in the settlement quarter. The default zero-quarter lag reproduces the previous same-quarter scenario. With a $12B effective exposure, 25% call rate and two-quarter lag, the independent fixture books $3B of call exposure in 2028Q1 and $3B of cash settlement in 2028Q3. The model retains the settlement date even if it falls outside the forecast horizon. Two quarters is an illustrative timing stress. Actual reserves, remedies and settlement dates remain unquantified. [SB Energy S-1 amendment](https://www.sec.gov/Archives/edgar/data/2133037/000162828026075026/sbenergy-sx1a3.htm).


Audit 4 classifies TX11 settlement as a separate cash use in the scenario bridge. Immediate and deferred cash settlement both reduce closing cash and enter financing dependency without changing modeled operating cash or investment CapEx. The $3B fixture compares each settlement quarter with a no-call path and verifies identical OCF and FCF with closing cash exactly $3B lower. Cash-shortfall draws still route through the facility ledger. The classification is a research-model convention for incremental guarantee cash. Issuer cash-flow presentation of a future settlement remains unknown.


### Bilateral source cross-check

| Path | Primary evidence and remaining uncertainty |
| --- | --- |
| CoreWeave to OpenAI | The issuer reports three increments and a combined ceiling of approximately $22.4B. Quarterly cash collections are scenario inputs. [CoreWeave](https://investors.coreweave.com/news/news-details/2025/CoreWeave-Expands-Agreement-with-OpenAI-by-up-to-6-5B/default.aspx) |
| CoreWeave to Microsoft | CoreWeave lists its Microsoft master services agreement in the 10-K exhibit index. Individual forward payment schedules remain unverified. [CoreWeave 10-K](https://www.sec.gov/Archives/edgar/data/1769628/000176962826000104/crwv-20251231.htm) |
| Vertiv to CoreWeave | Vertiv documents infrastructure collaboration. Quarterly supply and migration costs remain assumptions. [Vertiv](https://www.vertiv.com/en-in/insights/articles/blog-posts/how-vertiv-and-coreweave-are-orchestrating-ai-innovation/) |
| Dell to CoreWeave | Dell identifies Blackwell PowerEdge racks and integrated deployment. Quarterly orders and substitution lead times remain unverified. [Dell](https://www.dell.com/en-us/dt/corporate/newsroom/announcements/detailpage.press-releases~usa~2024~12~dell-cw-customer-announce.htm) |
| Constellation to Microsoft | Constellation identifies the power purchase agreement and restart plan. Replacement power costs remain assumptions. [Constellation](https://www.constellationenergy.com/news/2024/Constellation-to-Launch-Crane-Clean-Energy-Center-Restoring-Jobs-and-Carbon-Free-Power-to-The-Grid.html) |
| Vistra to Meta | Meta identifies the nuclear power agreements. The aggregated stress loss schedule remains an assumption. [Meta](https://about.fb.com/news/2026/01/meta-nuclear-energy-projects-power-american-ai-leadership/) |
| Core Scientific to CoreWeave | The hosting exhibit directly supports TX66. Actual phase utilization and quarterly collections remain unverified. [Core Scientific](https://investors.corescientific.com/sec-filings/all-sec-filings/content/0001628280-24-026483/corzcoreweavehpc.htm) |
| NVIDIA to CoreWeave | CoreWeave confirms GPU dependency. Direct NVIDIA procurement and spending already embedded in Dell systems cannot be separated from this disclosure. TX24 disruption magnitude remains a scenario assumption. [CoreWeave 10-Q](https://www.sec.gov/Archives/edgar/data/1769628/000176962826000366/crwv-20260630.htm) |
| Oracle to OpenAI | OpenAI confirms the Stargate capacity partnership. Quarterly payments and migration costs remain unverified. [OpenAI](https://openai.com/index/stargate-advances-with-partnership-with-oracle/) |


### Companion Audit 4 archive review

An independently supplied archive was compared against the current branch and tested in isolation. Its own model and data passed 39 of 39 specialized cases. The test APIs and data schemas differ. The archive has 50 entities and 83 transactions. Its added TX83 aggregates the same $3.5B and $9.5B NVIDIA caps already represented separately on this branch and assigns an unsupported calendar. Importing it would duplicate exposure. Its company GPU installed-base values mix estimates and assumptions, including owned and leased equipment, and were left out of the baseline. Its Anthropic lessee estimate linked to a generic EDGAR search page. The cross-check below establishes the actual disclosure and separates it from modeled cash timing.

The archive's longer financing comparison was adapted to this branch. Run `node scripts/replay_audit4_financing.cjs 2031Q4` to reproduce the table. The continuation engine ends in 2028Q4, so the common-cutoff before/after replay remains the default. The three financing paths use the same finite capacity and scheduled inflow rules as that replay. Values are scenario results in USD billions except runway months. Reported default and break-even quarters are limited to the selected cutoff. A break-even quarter records the first nonnegative FCF and can coexist with later cash burn.

| Version | Entity | Path | Cash | Funding gap | Runway months | First default | FCF break-even |
| --- | --- | --- | ---: | ---: | ---: | --- | --- |
| Remediated | OPENAI | Manual | -134.4555 | 144.4555 | 0 | 2028Q2 | — |
| Remediated | OPENAI | Curve | -134.4555 | 144.4555 | 0 | 2028Q2 | — |
| Remediated | OPENAI | Freeze | -163.4441 | 173.4441 | 0 | 2027Q4 | — |
| Remediated | ANTHROPIC | Manual | 254.3391 | 0 | 166.2506 | — | 2026Q4 |
| Remediated | ANTHROPIC | Curve | 254.3391 | 0 | 166.2506 | — | 2026Q4 |
| Remediated | ANTHROPIC | Freeze | 224.3391 | 0 | 146.0041 | — | 2026Q4 |
| Remediated | CRWV | Manual | -53.5352 | 55.5352 | 0 | 2029Q2 | — |
| Remediated | CRWV | Curve | -53.5352 | 55.5352 | 0 | 2029Q2 | — |
| Remediated | CRWV | Freeze | -82.4877 | 84.4877 | 0 | 2027Q1 | — |


### Anthropic lease commitment independently verified

The final prospectus confirms approximately $451.2B of undiscounted payments for executed leases not yet commenced at September 30, 2026. Expected commencements are generally in 2026–2028, and the disclosed weighted average term is approximately ten years. The archive's longer phase schedule was an assumption. The prospectus excludes this amount from its September contractual-obligations table. It separately identifies $105.7B of commitments entered into after the cutoff. Combining these amounts with the filing's broader compute aggregate would risk duplication. The three company pages now expose the September figure and its filing link. [Final prospectus, Contractual Obligations](https://www.sec.gov/Archives/edgar/data/2130357/000162828026074944/anthropicpbc-424b4.htm).

A gross operating-rent overlay assumes $451.2B divided by 40 quarterly installments, or $11.28B per quarter. Immediate commencement in 2026Q4 takes closing cash from $215.2262B to $203.9462B and FCF from $2.6262B to negative $8.6538B. Moving commencement four quarters later defers the first installment to 2027Q4. The modeled 2031Q4 funding gap is $20.5409B in the immediate case after the revolving expiry correction, and zero in the delayed case. This overlay uses the existing disclosed-estimate IPO inflow. Actual commencement cohorts, operating/finance classification and overlap with calibrated baseline compute costs are unresolved, so the overlay is a sensitivity outside the baseline.


The final prospectus also supplies maturity buckets for commenced leases and separate purchase commitments. The model's input record now preserves the issuer's annual buckets. Deducting $1.414B of imputed interest from $4.224B in operating payments yields $2.810B of recognized operating lease liabilities. Deducting $0.276B from $1.950B of finance payments yields $1.674B of recognized finance lease liabilities. The separate $313.819B purchase schedule is kept outside both lease totals. The regression independently reconciles these three rows. The $451.2B uncommenced lease sensitivity adds only the explicitly selected scenario overlay. Allocation of existing obligations against calibrated compute expense still requires a contract-level bridge. [Final prospectus, Contractual Obligations and Note 9](https://www.sec.gov/Archives/edgar/data/2130357/000162828026074944/anthropicpbc-424b4.htm).

The forecast panel now displays recognized operating and finance lease liabilities alongside the separate uncommenced payment disclosure. The browser fixture verifies both companies, the balances and the source links on all three entry points.


### CoreWeave GPU useful life evidence

CoreWeave changed the accounting useful life for data center computing equipment from five to six years effective January 2023. Its September 2026 gross technology equipment balance was $47.023B compared with $20.903B at December 2025. These are accounting asset-class balances. The $26.120B change includes an unknown mix of equipment, and cannot establish GPU-only cash purchases or the purchase date of each cohort. CoreWeave separately reports that its Volta generation remains in commercial service alongside deployments of Vera Rubin. That establishes continued operation for at least part of a legacy generation. The report does not identify each unit's age, workload margin or resale price. Four and five years remain economic refresh scenarios and partial retention can represent older hardware serving selected workloads. The asset and accounting disclosures are included in the input export, with physical life, economic life and GPU-only acquisition cost left unavailable. [CoreWeave 10-K](https://www.sec.gov/Archives/edgar/data/1769628/000176962826000104/crwv-20251231.htm), [CoreWeave 10-Q](https://www.sec.gov/Archives/edgar/data/1769628/000176962826000465/crwv-20260930.htm), [CoreWeave deployment announcement](https://investors.coreweave.com/news/news-details/2026/CoreWeave-Delivers-NVIDIA-Vera-Rubin-NVL72-Performance-at-Production-Scale-Starting-With-Cognition/default.aspx).

The CoreWeave forecast panel displays the disclosed accounting life and filing link alongside the separate economic life control. The browser regression checks the six-year disclosure, the five-year scenario control and the source on all three pages.


Microsoft's fiscal 2026 10-K gives an accounting range of two to six years for servers and network equipment. Amazon reports that a subset of its servers and networking equipment moved from six to five years for accounting purposes in 2025, producing $1.4B of additional depreciation that year. The forecast panels now display the range or subset scope and the source. Neither disclosure identifies GPU-only fleet life or cash replacement spending, and neither value is injected as an economic refresh assumption. [Microsoft 10-K](https://www.sec.gov/Archives/edgar/data/789019/000119312526323660/msft-20260630.htm), [Amazon 10-K](https://www.sec.gov/Archives/edgar/data/1018724/000101872426000004/amzn-20251231.htm).


Alphabet generally depreciates servers and network equipment over six years. Meta's accounting range is five to 5.5 years, with most servers and network assets extended to 5.5 years from January 2025. Meta disclosed $13.36B of server and network depreciation for 2025. Oracle's August 10-Q gives six years for the equipment category comprising primarily servers and networking gear. The source-backed values are visible on the company panels and preserve the existing GPU economic life control. These disclosures identify asset classes and noncash depreciation. GPU-only purchase amounts and equipment-level retirement decisions still lack source coverage. [Alphabet 10-K](https://www.sec.gov/Archives/edgar/data/1652044/000165204426000018/goog-20251231.htm), [Meta 10-K](https://www.sec.gov/Archives/edgar/data/1326801/000162828026003942/meta-20251231.htm), [Oracle 10-Q](https://www.sec.gov/Archives/edgar/data/1341439/000119312526389274/orcl-20260831.htm).


Nebius extended accounting life from four to five years for server and network equipment in 2026, with an estimated $0.1676B reduction in 2026 depreciation for the installed year-end population. NVIDIA discloses a general two-to-seven-year depreciation range for property and equipment and provides a separate building life. IREN reports five years specifically for pledged GPUs and related infrastructure held by its financing subsidiary. The pledged June net carrying value was $1.4871B, while September consolidated gross GPU hardware was $5.819B. These values differ in scope, measurement basis and date. The gross balance is neither a cash purchase flow nor a liquidation estimate, and the pledged net balance cannot establish collateral market value. Both remain disclosed values in the audit export, independent of assumed replacement and recovery values. [Nebius 20-F](https://www.sec.gov/Archives/edgar/data/1513845/000110465926052948/nbis-20251231x20f.htm), [NVIDIA 10-K](https://www.sec.gov/Archives/edgar/data/1045810/000104581026000021/nvda-20260125.htm), [IREN 10-K](https://www.sec.gov/Archives/edgar/data/1878848/000187884826000052/iren-20260630.htm), [IREN 10-Q](https://www.sec.gov/Archives/edgar/data/1878848/000187884826000066/iren-20260930.htm).


### IREN GPU Financing 1.0

The September debt note identifies $0.409B of outstanding delayed-draw principal and $1.571B of senior private-placement notes on the GPU financing subsidiary. Cumulative funding was $0.413B and $1.575B respectively. The $0.004B difference on each instrument is consistent with disclosed September amortization at the filing's precision. Available commitments subject to conditions were $1.132B and $0.525B. The disclosed $1.05B escrow balance is restricted and belongs to issued notes, so it does not count as either undrawn commitment or unrestricted cash. The two instruments open within IREN's $10.041B of consolidated borrowing principal. They do not increase that opening balance or assign an unstated lender share. The reconciliation remains partial for other instruments. October draws and escrow releases fall after the September observation. The quarterly interest model uses scenario rates and does not replace the reported note terms. [IREN debt note](https://www.sec.gov/Archives/edgar/data/1878848/000187884826000066/R25.htm), [IREN 10-Q](https://www.sec.gov/ixviewer/ix.html?doc=%2FArchives%2Fedgar%2Fdata%2F1878848%2F000187884826000066%2Firen-20260930.htm).


The matching September debt note identifies six convertible notes with $6.745B combined principal plus GPU Financing 2.0 and 3.0 with $0.947B and $0.355B principal. These eight rows now join the original two GPU financing instruments in the audit ledger. Named opening principal totals $10.027B versus $10.041B consolidated principal. The $0.014B residual matches the issuer's other-debt grouping and remains unattributed. Reported effective rates stay with the disclosures as a separate field from cash coupon modeling. Undrawn commitments, lender allocations and actual amortization remain unknown where the debt table establishes only closing balances. [IREN debt note](https://www.sec.gov/Archives/edgar/data/1878848/000187884826000066/R25.htm).


### NVIDIA Ward County counterparty corroboration

ION Digital reports that NVIDIA guarantees rent on Nscale's Ward County facility for the first five years, capped at $0.8603B under the 126-month lease. Nscale's parent guarantees the period starting in year six. The audit export now records the counterparty-side disclosure. NVIDIA's own $118B aggregate remains the portfolio control total. Public filings do not establish which NVIDIA category includes the Ward County guarantee, so the model leaves the category unallocated and does not add $0.8603B to portfolio exposure. No quarterly payment, call or release profile is inferred. [ION Digital prospectus supplement](https://www.sec.gov/Archives/edgar/data/2007691/000200769126000026/iondq32026propsupp333-2971.htm), [NVIDIA CFO disclosure](https://www.sec.gov/Archives/edgar/data/1045810/000104581026000088/q3fy27cfocommentary.htm).


### OpenAI investor-side executed financing

SoftBank confirmed three completed $10B investments via Vision Fund 2, on April 1, July 1 and October 1, 2026. They are part of OpenAI's disclosed $122B committed round. The investor dates belong to a partial cash history and do not complete the full-year source series required by historical curve mode. The quarter boundary matters because the third tranche followed the model's September opening cutoff. The modeled opening cash anchor is an estimate, and its composition cannot be reconciled to these tranches from the issuer's disclosures.

An isolated freeze scenario adds the $10B October event once as separately scheduled equity. It raises modeled 2026Q4 cash from $30.0884B to $40.0884B and 2028Q4 cash from negative $47.4052B to negative $38.9871B. The first model default is 2027Q4 in both paths. The later cash difference includes secondary changes in modeled financing and operations. The baseline leaves the event as a sourced memorandum item pending an opening cash bridge. [SoftBank financial report](https://group.softbank/media/Project/sbg/sbg/pdf/ir/financials/financial_reports/financial-report_q2fy2026_01_en.pdf), [OpenAI round disclosure](https://openai.com/index/accelerating-the-next-phase-ai/).

The three company panels now list the investor-reported tranches as partial history alongside the issuer announcements. The browser fixture verifies all three events and the October source link. Historical fitting still requires a complete Actual annual series per funding source.


Amazon's September 10-Q confirms $15B in 2026Q1, $13.7B in Q2, and $21.3B in Q3 invested in OpenAI preferred stock. The latter two tranches fulfill its earlier $35B commitment and bring Amazon's executed total to $50B. The six captured Amazon and SoftBank observations establish $80B of executed funding for these two investors, including $70B through September 30. These events are part of the same $122B announced round and are not additive to the announced total. The dashboard uses quarters for Amazon where exact transaction dates are not disclosed. The source series remains incomplete for historical curve fitting and the September cash bridge. [Amazon September 10-Q, Note 2](https://www.sec.gov/Archives/edgar/data/1018724/000101872426000040/amzn-20260930.htm).


Microsoft's funding under its separate $13B OpenAI investment commitment increased from $11.9B at June 30 to $12B at September 30. This $0.1B funding change belongs to Microsoft's existing investment and stays separate from the Amazon and SoftBank round totals. Microsoft's receivable from OpenAI increased from $6B to $7.2B while it recognized $10B of quarterly commercial revenue, including revenue-sharing payments. The receivables are reported by Microsoft. They cannot establish OpenAI's consolidated accounts payable or Microsoft cash collections given the lack of a contractual settlement and adjustments bridge. TX01 and TX02 now cite the September filing. The observations do not generate a new loan, cash receipt or incremental cloud expense in the model. [Microsoft June 10-K](https://www.sec.gov/Archives/edgar/data/789019/000119312526323660/msft-20260630.htm), [Microsoft September 10-Q](https://www.sec.gov/Archives/edgar/data/789019/000119312526436133/msft-20260930.htm).


### Contracted term draws and required revenue

The standard margin calculation previously omitted contracted term-loan proceeds from the cash target even after they increased borrower cash and lender principal. Both operating methods now subtract the realized draw once. In the independent fixture, a $150B closing cash target, $100B opening cash and a 50% cash margin imply $100B required revenue without a term draw. Funding $3B reduces required revenue to $94B and increases closing cash from $102B to $105B. OCF and FCF remain $2B, and the financing ledger increases principal by exactly $3B. The test reproduces the same bridge with the explicit 50% cash operating margin.


The same cash target check uncovered a second omission in the standard margin path: incremental compute cash was already charged to OCF and FCF but omitted from required revenue. Both paths now include it once. Adding $5B of external compute cost to the $3B term-draw case lowers closing cash from $105B to $100B and lowers OCF and FCF from $2B to negative $3B. At a 50% margin it adds $10B to required revenue, from $94B to $104B. The regression reproduced the former $94B error before applying the fix.


The cash-target metric now recognizes modeled GPU disposal and opening investment liquidation receipts once, on the same basis as closing cash. A test with a $20B GPU refresh and $5B of disposal proceeds reproduces the previous $140B required revenue, then verifies $130B after the correction at a 50% cash margin. Closing cash is $87B, OCF is $2B, and FCF is negative $18B under the existing gross CapEx convention. Thus the cash target reflects the disposal without treating it as operating cash or subtracting it from reported replacement CapEx.


The downloadable quarterly audit ledger now itemizes financing cash by source, including scenario equity, strategic investment, customer prepayment, debt, asset-backed financing, rollover, contractual draws and the final RCF draw. Legacy assumptions remain explicitly named. These categories reconcile to total funded cash, including any RCF draw made during contagion. A mixed-source fixture independently checks six funded amounts of $1B through $6B and $21B total, with only $1B eligible for equity dilution. Each A–G borrower-quarter also verifies the source sum.

All three company forecast panels now expose four quarterly financing weights for both forecast modes. A zero weight suppresses scenario funding in that quarter. The browser test changes Q2 to zero and verifies that the saved settings and exported 2027Q2 cash sources reflect it. The engine independently verifies the 1/0/1/2 allocation on an $8B annual financing plan.

The financing charts now display signed annual financing and revenue growth on a separate percent scale. A zero planned financing year following a positive year appears as negative 100 percent. Growth stays unavailable when the comparison denominator is missing or zero.

The financing chart now plots the actual yearly amounts used by the historical curve, per source and on the same amount scale as the projected values. The browser fixture verifies the two equity observations and the absence of a debt series when eligible debt history is missing.

The annual forecast tables now show scenario financing received, total modeled financing received and closing cash separately. Total financing sums the quarterly cash source ledger and includes actual modeled facility draws, rollover and separately scheduled equity. The browser check independently reconciles the annual displayed total against the downloaded quarterly ledger.


### NVIDIA tenant lease commitment

The October 25 CFO disclosure identifies $74B of data center leases not yet commenced and $28B of separate cloud service agreements. The $102B combined commitment excludes any interpretation as a single rent schedule. The lease buckets are $0B, $1B, $2B, $4B, $4B and $63B across the remainder of FY2027, FY2028–2031 and FY2032 onward. The forecast panel shows the dated lease total and links the original source. Recognized lease liabilities, assignments to third parties and the quarterly timing of the $63B tail cannot be inferred from the rows. The figures remain an audit disclosure outside the September opening balance and quarterly baseline cash schedule. [NVIDIA CFO disclosure](https://www.sec.gov/Archives/edgar/data/1045810/000104581026000088/q3fy27cfocommentary.htm).

An opt-in NVIDIA stress preset allocates the disclosed FY2028–31 lease buckets evenly across four model quarters per fiscal year, beginning in calendar Q2. This quarter mapping and operating lease treatment are assumptions. The preset posts the dated  once, leaves the  aggregate tail outside the schedule, and excludes the separate  cloud services. The independent check verifies zero cash impact before the first installment, a .25B first installment, a  final installment, and zero incremental payments after the four-year schedule. The modeled cash balance at the end of the schedule is  lower than the no-preset path.

The Anthropic ten-year and CoreWeave seven- and seventeen-year gross rent sensitivities are available as opt-in forecast presets. Users can delay commencement by quarter. Selecting an active preset replaces an existing custom schedule; users can still provide their own tranches through the scenario input. Browser coverage verifies that selecting a preset updates the scenario, and the engine test checks the first payment under immediate and delayed commencement.

The quarterly audit download now preserves incremental lease schedules, recognized finance lease schedules where available, and the modeled principal and operating cash postings. The browser check independently verifies Oracle’s $288B uncommenced opening commitment and the first $96B / 68 quarterly payment, retaining the distinction between that payment and finance principal.

The quarterly export also preserves configured GPU cohorts, base CapEx attributable to GPU purchases, replacement spending, sale receipts, net refresh cash and collateral values with facility attribution where available. Browser coverage follows a modeled acquisition into the cohort ledger and reconciles net replacement cash in its first eligible refresh quarter.


### Anthropic reported operating cash bridge

The unaudited January–September 2026 statements reconcile a $104.039B net loss to $6.569B of operating cash after noncash and working capital adjustments. Among the noncash items are $94.324B of fair-value changes on convertible notes, derivatives and SAFEs and $10.277B for other financial instruments. Deducting $0.925B of cash PP&E purchases gives $5.644B. Deducting the separate $1.955B of leased asset and equipment prepayments and $0.088B of lease principal gives $3.601B on an extended cash-use measure. The data and tests retain all components and use the actual nine-month reporting window. Standalone September-quarter OCF remains unavailable, and the audited scenario continues to use modeled quarterly OCF. [Final prospectus cash flow statement](https://www.sec.gov/Archives/edgar/data/2130357/000162828026074944/anthropicpbc-424b4.htm).


## Verification and open evidence

The verification checkpoint is commit `9176448839ee6bb5bf56678039c45e7a6b7f3aed` on `audit4-financing-gpu-remediation`. Git ancestry includes both the original `b727da2` baseline and the `a515599` continuation. [Checkpoint Actions](https://github.com/rOOOOOnn/ai-credit-network/actions/runs/45926073070).

| Verification | Executed at the checkpoint | Failed |
| --- | ---: | ---: |
| Standard functional cases | 16 | 0 |
| Audit 2 regression cases | 12 | 0 |
| Audit 3 independent cases | 20 | 0 |
| Audit 4 assertion invocations, including repeated company-quarter reconciliations | 16,985 | 0 |
| Browser entry points | 3 | 0 |
| CI operating systems | 3 | 0 |

The Audit 4 count is from one local execution of the suite with successful strict assertion calls counted by method. It comprises 11,172 equality, 58 deep equality and 5,755 truth assertions. These are assertion invocations, including loop repetitions. Data checks separately confirm 50 entities, 82 transactions, referential integrity, CSV alignment and that all three standalone pages embed the same engine and datasets.

| Open evidence | Why it matters and where it can be verified |
| --- | --- |
| OpenAI quarter-end unrestricted cash, actual OCF and complete funding receipts by source | Investor reports establish individual investments and a supplier receivable. An issuer cash flow statement and financing roll-forward would establish the opening cash anchor and permit actual historical financing fits. |
| Anthropic quarterly OCF and final net IPO cash | The prospectus reports nine-month OCF and an estimate of net proceeds. A subsequent issuer cash flow statement with the September and December cumulative windows and a financing bridge can establish fourth-quarter operating cash and net issuance cash. |
| TX26 cumulative draws, principal repayments, carrying-cost allocation and drawable amount | The 10-Q gives principal and aggregate capacity. Facility schedules or a subsequent specific disclosure are required for exact project availability and the cash amortization calendar. |
| NVIDIA project-phase guarantee values and settlements | The NVIDIA and SB Energy disclosures establish aggregate caps and contract conditions. The phase schedules, settlements and allocation of the Ward County support to the portfolio buckets are needed for actual quarter-level exposure. |
| Oracle, Anthropic, CoreWeave and NVIDIA lease cash timing | Direct filings support aggregates and some fiscal buckets. Lease-by-lease commencements, classifications and amounts already embedded in operating costs are needed to use actual quarterly amounts without double counting. |
| Company GPU cohorts and lender collateral | Filings identify broad accounting asset balances and some specific pledged pools. GPU-only spending, batch age, retention and resale outcomes, and lender-level liens are needed to validate company-specific replacement cash and recovery values. |

The field-by-field review of all 50 entities remains open. The entity source register inventories the existing coverage and the reporting gaps.

The forecast panel now has a separate scenario freeze control and an independent switch for scheduled equity. Freeze preserves the requested annual schedule and underlying limits. The browser test disables and restores a planned $8B financing path. A separate model fixture leaves a $3B scheduled equity receipt in place while scenario financing is frozen. Rollover and facility draws retain their independent rules.

L3 substitution capacity, the recoverable share of disrupted revenue and extra collection delay now have separate company controls. The Core Scientific to CoreWeave fixture verifies complete substitution eliminates the TX66 L3 interruption and migration charge. With 50% recovery and an additional quarter of delay, $0.0558B of revenue stays deferred through 2027Q2 and is recovered once in 2027Q3, with $0.0275B of associated cash. The additional delay changes collection timing without changing the duration of the capacity outage. All controls are scenario assumptions.

The quarterly download now includes all modeled contagion events and the L4 credit calculation by borrower. It exports the opening and closing spread, modeled floating principal, incremental interest and refinancing multiplier. The existing forced CoreWeave default fixture independently reconstructs the initial Oracle interest charge and next-quarter spread decay. The three-page browser fixture checks that the exported inputs are present even before a spread shock.

### Audit profile fragility inputs

The audited fragility score now uses the effective refinancing factor, the quarter's maturing principal and modeled fixed cash obligations including lease cash, rather than relying on the entity defaults. A controlled case changes refinancing success from 100 to 50 percent with identical financial inputs and moves the score from 6 to 21. The model retains a 0–100 bounded score. In the audited default profile OpenAI's score falls from 17 in 2026Q4 to 14 in 2028Q4 as modeled cash rises from 40.0884 to 42.4904 billion dollars and negative FCF improves from negative 11.9116 to negative 8.2951 billion dollars, with the same 0.68 refinancing factor. Anthropic stays at 8 in those two quarters, with positive modeled FCF and estimated IPO-supported liquidity. These are scenario results and depend on the financing inputs described above.

The audited score now adds a capped operating cash buffer component as closing cash approaches minimum operating cash from above. The buffer contributes up to eight points within twice the minimum. Below the minimum, the existing liquidity warning boost applies without stacking the buffer component. A controlled company with a 20 billion dollar minimum and flat FCF scores 4 at 40 billion dollars cash, 6 at 25 billion dollars and 8 at 19 billion dollars after the liquidity warning. This diagnostic does not change the model default threshold.

The downloadable audit ledger also includes company-level liquidity diagnostics by quarter and the first model default and FCF break-even by company. The browser test reconstructs the Oracle cash gap and financing requirement from closing cash, the operating cash floor and drawable RCF, then checks the exported first default against the quarterly distress path.


The CoreWeave parent/SPV reconciliation now carries consolidated principal and reported carrying debt as separate amounts. September principal totals $47.505B, including $42.152B recourse and $5.353B non-recourse. The carrying values total $46.873B after $0.632B of discounts and issuance costs. TX26's $4.583B principal is inside the $5.353B non-recourse amount, so consolidated principal remains $47.505B after elimination. The borrower forecast still uses its existing carrying-value anchor. The additional principal columns reconcile disclosure and lender exposure without assuming a new draw. [CoreWeave 10-Q, Note 10](https://www.sec.gov/Archives/edgar/data/1769628/000176962826000465/crwv-20260930.htm).

The June 10-Q reports $2.837B of TX26 outstanding principal. The historical reconciliation and EAD now use that observation in 2026Q2, with $4.583B first applied in 2026Q3. The $1.746B difference is the net change in principal. It does not establish gross drawdowns, repayments or drawable availability. Earlier quarters without an observation display unknown funded principal in the reconciliation. [CoreWeave June 10-Q](https://www.sec.gov/Archives/edgar/data/1769628/000176962826000366/crwv-20260630.htm).

The March 10-Q debt table independently establishes $1.260B of March 31 TX26 principal. TX26 is active from Q1 under the March closing, and the first three observed balances are $1.260B, $2.837B and $4.583B. The Q2 and Q3 net movements are $1.577B and $1.746B. The history precludes interpreting a period-end difference as cumulative gross draws or assuming remaining commitment from the principal balances. [CoreWeave March 10-Q](https://www.sec.gov/Archives/edgar/data/1769628/000176962826000222/crwv-20260331.htm).

### Independent ZIP comparison

The supplied Audit 4 ZIP was inspected in isolation. Its 39 specialist cases passed against its bundled engine. Its TX26 test assumes approximately $4.6B funded and $3.9B available. The branch retains the $4.583B September outstanding principal with unknown availability, since the outstanding balance alone does not establish cumulative draws or remaining borrowing capacity. The ZIP's separate scenario outputs use different inputs and engine rules, so the branch keeps the existing common-input replays as its comparison.

The ZIP's GPU disposal diagnostic was adapted to the branch's dated cohort ledger. On a $2B cohort three years into a six-year scenario accounting life, retiring half disposes of $1B original cost and $0.5B modeled net book value. Sale proceeds of $0.25B produce a $0.25B noncash disposal loss. The quarterly export identifies proceeds and signed gain or loss separately. When accounting life is missing, book value and gain or loss are unavailable. Cash and gross-capex FCF continue to reconcile using the cash proceeds and replacement purchases.

The SPV reconciliation now distinguishes a term facility's prior use of its commitment from its outstanding balance. A $10B term facility with $8B cumulative draws and $3B principal repayment has $5B outstanding and $2B undrawn. A revolving facility with the same principal and $1B in letters of credit has $4B of headroom. Availability remains unknown where neither disclosed availability nor the required inputs are known.

### Lower-tier GPU retention

All three pages expose an optional scenario share of replaced equipment retained for lower-tier workloads. Retention preserves acquisition date and pledge attribution. It defers disposal, carries maintenance and collateral valuation forward, and removes the equipment at the configured physical retirement date. Without a physical retirement date, the retained equipment stays in the modeled fleet through the horizon. Replacement purchases are booked on the economic refresh date and are not repeated when the retained equipment leaves service. In the independent fixture, an $8B cohort undergoes a 50% refresh with 50% retention. The quarter books $4B replacement CapEx and $0.4B sale proceeds, retaining $2B original cost for lower-tier workloads. Physical retirement generates $0.2B of proceeds and no additional replacement purchase. No incremental low-tier revenue is assumed.

The browser regression edits the retention share on each standalone page and downloads the recomputed ledger. For the $0.1B acquisition, it checks $0.05B replacement CapEx, $0.005B disposal proceeds, $0.05B remaining in primary service, $0.025B retained for lower-tier workloads and the $0.05B new cohort. All three browser cases passed locally.

### TX26 contractual draw cutoff

CoreWeave's September 10-Q identifies June 30, 2027 as the DDTL 4.0 commitment termination date, distinct from its March 2032 loan maturity. TX26 now applies that cutoff in the financing ledger, transaction exposure and parent/SPV reconciliation. Q2 2027 availability remains unknown. From Q3 2027, undrawn exposure is zero under the disclosed terms and funded lender exposure continues to follow principal. The transaction regression checks the date boundary and $4.583B in opening reported principal on the static exposure path. Exact cumulative funding and repayments remain unverified. [CoreWeave 10-Q, Note 10](https://www.sec.gov/Archives/edgar/data/1769628/000176962826000465/R16.htm).

### Coverage of lender default exposure

The exported default event records undrawn commitment and exposure coverage. For TX26 in the draw window, the default fixture reports $4.583B of funded exposure and a null commitment. The reported exposure covers funded principal only. After the disclosed cutoff, the undrawn commitment is a known zero. If principal itself is unavailable, the coverage field identifies that gap. This metadata leaves the existing modeled credit loss calculation intact.

The pledged GPU schedule now preserves a modeled facility's zero balance after its last attributed cohort is sold. The TX27 fixture sells its $4B opening-cost cohort for $0.8B, recognizes zero collateral recovery and $4.5B scenario loss on $10B funded exposure, and keeps the zero in the following quarter. The replacement purchase has no attributed lien. A facility with no configured pledge still has unknown modeled collateral coverage.

### Facility-level margin stress

When the scenario identifies a facility's pledged GPU cohorts, its margin stress is calculated on that collateral pool and its own outstanding principal. The TX27 regression places $50B of new unpledged equipment next to a $4B older pledged cohort valued at $2.4B. The unpledged equipment previously suppressed the call. The pledged pool's 40% haircut now gives a $0.48B scenario call on $10B of principal. Facilities with unknown allocations use the market haircut when other facilities have attributed pools. Where the entire fleet lacks facility attribution, the existing fleet-wide proxy remains a scenario assumption. The borrower-level refinancing penalty uses the highest triggered facility stress. The modeled triggers and rates are scenario parameters, with actual covenants and collateral packages still requiring loan documentation.

The quarterly ledger now exports each modeled GPU margin call with opening loan principal, collateral basis, effective haircut, stressed LTV and refinancing multiplier. The company cash outflow is the sum of the separately rounded facility amounts. The independent TX27 case checks 108.33% stressed LTV, $0.48B of margin and a 0.52 refinancing multiplier. The browser regression downloads and reconciles the facility amounts on each of the three standalone pages.

The replay tables were checked after the facility-level margin change. The five CoreWeave reference GPU rows changed. The financing before/after table, extended financing comparison and five-profile sustainability table reproduced exactly. In the revised refinancing calculation only facilities with positive outstanding principal can impose the modeled margin-based rollover multiplier.

CI reproduces and compares 68 scenario rows across the common-cutoff financing, extended financing, GPU life, sustainability and audited A–G tables. For A–G it checks closing cash, FCF, the funding gap and first model default using the same cases as the independent quarterly accounting assertions. The check reuses the published replay scripts and reads the pinned continuation commit from Git history. Run it locally with `node tests/audit4_report.cjs`.

### TX26 amortization terms and missing payment schedule

The September debt note and the executed agreement verify monthly amortization linked to the earliest applicable commitment cutoff, delayed site milestone or incremental top-up funding. The 10-Q also establishes a 0.50% annual fee on undrawn commitments through the availability period. The prior $0.13B quarterly field had no matching disclosed payment schedule and is now blank in the dataset and all pages. The publicly filed terms explain when payments can start, but exact site trigger dates, gross draw and repayment histories, and a facility-specific remaining commitment are still required to compute actual cash principal and fee amounts. The fee rate is stored as a disclosed term. No exact fee or amortization flow is inferred from the unknown balance. [September 10-Q debt note](https://www.sec.gov/Archives/edgar/data/1769628/000176962826000465/R16.htm), [Executed credit agreement](https://www.sec.gov/Archives/edgar/data/1769628/000176962826000129/ex1011.htm).

The downloadable ledger carries these September bounds in TX26's transaction metadata along with the cutoff, assumptions and two primary sources. The forecast ledger still preserves unknown actual funding and availability. The validation recomputes the upper draw and repayment limits, and the browser suite checks the metadata and unknown values in downloads from all three pages.

The financing charts now show year-end cash on a signed scale and remaining scenario financing capacity alongside planned and received financing and the funding gap. Unavailable gap and cash values are omitted. Each page's browser regression checks that chart cash equals the annual table after manual funding edits, a freeze and the switch to curve mode.

The annual chart shows available full-year financing history in both Manual and Curve modes. The chart marks user-entered histories separately from financing in issuer filings. The Historical Trend readout still identifies only the years and sources the curve used. Browser tests on all three pages switch from a historical curve to Manual and back, verify each forecast is restored, and check that Anthropic's disclosed 2023 and 2025 equity cash inflows appear in the chart.

For linear, exponential and logistic curves, the first forecast year's financing growth now uses the configured positive financing base as its denominator. Subsequent growth uses the previous year's planned financing. The three-page regression sets a $10B equity base and 50% initial growth and verifies 50.0% in the table and chart. Growth is unavailable when there is no comparable positive base or the year is outside the curve horizon.

CI now also checks that the source register covers all 50 entities exactly once and supplies a quarter, classification, disclosure date, source and missing-fields entry with explicit unavailable markers where applicable. This checks register completeness. Primary-source verification remains field-specific and the outstanding work is listed in the acceptance table.

SB Energy's November registration amendment gives expected full operation in 2031 for buildings 1–9 (4,248 MW-IT) and 2032 for buildings 10–17 (3,776 MW-IT). NVIDIA separately expects the first covered building to become eligible in its fiscal 2029. These are disclosed forward milestones at different levels of aggregation. TX11 now preserves both and the contractual August 17 announcement date. The second group is outside the initial $105B commitment. Individual completion, rent and settlement quarters remain unavailable, so the scenario quarter schedule is explicitly distinguished from the reported milestones. [SB Energy S-1/A](https://www.sec.gov/Archives/edgar/data/2133037/000162828026075026/sbenergy-sx1a3.htm), [NVIDIA Q3 commentary](https://www.sec.gov/Archives/edgar/data/1045810/000104581026000088/q3fy27cfocommentary.htm), [NVIDIA agreement announcement](https://www.sec.gov/Archives/edgar/data/1045810/000104581026000069/nvda-20260817.htm).

NVIDIA's July 26 opening evidence now retains $15.059B accounts payable and $4.985B noncurrent operating lease liabilities. Its distinct October 25 disclosure has $21.074B accounts payable, no current borrowings, $32.371B noncurrent borrowings and $5.777B noncurrent operating lease liabilities. October cash and equivalents of $29.089B plus $24.423B of marketable debt securities and $44.219B of marketable equity securities reconcile to $97.731B on the broader measure. The historical dated evidence keeps those components separate and does not bring October balances into the September opening information set. [July 10-Q](https://www.sec.gov/Archives/edgar/data/1045810/000104581026000075/nvda-20260726.htm), [October earnings exhibit](https://www.sec.gov/Archives/edgar/data/1045810/000104581026000088/q3fy27pr.htm).

Microsoft's September 10-Q reconciles $4.391B of current and $31.090B of noncurrent borrowing carrying amounts to $35.481B. The dataset now preserves $42.625B in accounts payable and the separately disclosed $26.5B of property and equipment purchases still payable. The latter is an unpaid balance, not an addition to the $39.367B of quarter cash PP&E purchases already deducted from $58.000B of OCF. Cash PP&E purchases still produce $18.633B of gross cash FCF under this definition. GPU-only procurement remains undisclosed. [Microsoft September 10-Q, balance sheet, cash flow statement and Note 6](https://www.sec.gov/Archives/edgar/data/789019/000119312526436133/msft-20260930.htm).

The September balance-sheet evidence now records $21.975B, $158.715B and $19.097B of accounts payable for Alphabet, Amazon and Meta, respectively. Alphabet's current portion of notes plus long-term carrying amount totals $126.118B, with zero commercial paper. Amazon's current portion plus long-term carrying amount totals $179.952B for the long-term debt schedule. Meta's operating lease liabilities sum to $31.173B. These dated evidence fields preserve the filing classifications and do not add any unpaid equipment amount to quarter cash CapEx. The engine's existing opening calibration is unchanged pending a complete debt scope bridge, and issuer totals do not identify GPU-only purchases. [Alphabet 10-Q](https://www.sec.gov/Archives/edgar/data/1652044/000165204426000084/goog-20260930.htm), [Amazon 10-Q](https://www.sec.gov/Archives/edgar/data/1018724/000101872426000040/amzn-20260930.htm), [Meta 10-Q](https://www.sec.gov/Archives/edgar/data/1326801/000162828026066773/meta-20260930.htm).

Meta's September Notes 8 and 9 reconcile $2.747B current and $80.922B noncurrent carrying debt with $0.331B in unamortized discounts and issuance costs to $84B face principal. The audited opening debt now uses that principal in place of the inherited $37.5B. The regression reconstructs $84B from ending debt and quarterly financing movements. The reported annual maturity buckets also sum to $84B and remain documented as annual source evidence, without invented quarterly installments for the unallocated instruments. Operating leases remain separately classified. All five published replay tables reproduced after the correction. [Meta September 10-Q](https://www.sec.gov/Archives/edgar/data/1326801/000162828026066773/meta-20260930.htm).

Alphabet's $127.485B face debt reconciles to $126.118B carrying debt after $1.110B of issuance discounts and costs and $0.257B of hedge adjustments. Amazon's $180.887B long-term debt face amount plus $0.380B short-term working-capital borrowing gives $181.267B of modeled opening principal. The $0.935B discount and cost deduction applies to the long-term schedule. The audited model now opens at the disclosed principal for both companies. Amazon's $20B unsecured revolver commitment and conditional equipment facility of up to $80B are stored separately. The equipment facility has a 2027Q1 to 2028Q3 draw window and still needs a dedicated draw schedule before its availability can be modeled on its contractual basis. The five report replays found one change. In the 2031Q4 OpenAI curve path cash declines $0.0314B and the gap rises by the same amount under the updated network inputs. The default and break-even results are unchanged. [Alphabet 10-Q, Note 6](https://www.sec.gov/Archives/edgar/data/1652044/000165204426000084/goog-20260930.htm), [Amazon 10-Q, Note 5](https://www.sec.gov/Archives/edgar/data/1018724/000101872426000040/amzn-20260930.htm).

The audited Amazon revolver ledger now opens with the reported $15B and $5B unsecured facilities in place of the inherited $80B generic credit input. The October replacement of the $5B facility is modeled with zero opening draws as a forecast assumption. Both lines stop new draws in their maturity quarter. No participant shares are assigned. The $80B supplier equipment facility remains conditional evidence and is excluded from general-purpose auto-draws. The regression reproduces the former $80B and verifies the $20B opening cap and maturity boundaries. The scenario tables have been rerun. Three earlier network snapshots retain their original expected values against the earlier Amazon credit input, while the current A–G accounting checks run with the new facilities. [Amazon September 10-Q, Note 5 and October subsequent events](https://www.sec.gov/Archives/edgar/data/1018724/000101872426000040/amzn-20260930.htm).

### Amazon conditional equipment draw and maturity

The audited engine now creates an unfunded equipment facility with an $80B maximum, opening in 2027Q1 and closing to new draws after 2028Q3. With no scenario input, it posts no cash. To run a qualified-purchase scenario, set the Amazon company scenario JSON field `"facilityDrawdowns": {"AMZN_EQUIPMENT_DDTL": {"2027Q1": 20}}`. A requested draw represents the amount assumed eligible under purchase-order and pricing conditions. Each modeled draw creates its own outstanding principal tranche due five years later. The synthetic test rejects out-of-window orders, clips the second request to the remaining $60B, adds the first $20B to cash and debt, and pays $20B and $60B in the respective maturity quarters. Actual qualifying purchases, cash draws, precise interest terms and lender allocations are unavailable. [Amazon September 10-Q, Note 5](https://www.sec.gov/Archives/edgar/data/1018724/000101872426000040/amzn-20260930.htm).

All three pages expose Amazon scenario draw amounts for the seven quarters in the disclosed equipment facility window. The controls and scenario JSON share the same inputs. Each browser regression enters a $2B request for 2027Q1, downloads the ledger, checks the cash financing source and confirms $2B of principal matures in 2032Q1.

The reported $80B equipment limit is a scenario draw ceiling. Prior to commitment expiry, eligibility for the unused amount cannot be established from the nominal balance. The default exposure export therefore marks the remaining eligible amount unavailable and reports funded-only coverage, while the financing ledger preserves the maximum remaining scenario capacity. The regression checks $20B funded and $60B nominal headroom. The old generic 25% conversion reported $35B of total exposure, while the corrected result reports $20B of funded-only coverage. After the draw window ends, eligible undrawn exposure is a known zero.

A borrower model default now blocks later conditional equipment draws even if the facility was inactive when the default occurred. The fixture forces Amazon into model default in 2026Q4 and requests $20B in 2027Q1. It reproduces the previous cash inflow and verifies zero after the correction. The ledger records the reason. This is a scenario eligibility rule, with no assumed waiver or cure.

IREN's September debt note, MD&A and property note distinguish three GPU measures. Gross GPU hardware rose from $2.035B to $5.819B. The $3.784B balance increase cannot be substituted for the $2.693B of quarterly cash AI hardware payments. The source does not provide a fully attributable age, price and disposal roll-forward. Two instrument rows now carry separately verified financing facts. Mackenzie GPU Financing 2.0 had funded $0.947B, with $1.500B conditionally available through December 31, 2026, fixed interest of 9.0% and a 30-month tranche amortization window. Prince George GPU Financing 3.0 was fully funded at approximately $0.363B, with $0.355B principal outstanding, an implied fixed annual rate of 9.51% and 36 monthly payments. No new headroom is available for 3.0. Exact historical cash principal repayment and the lender-level schedule remain separate unknowns. The regression checks both opening ledgers and the 2.0 availability cutoff. [IREN September 10-Q](https://www.sec.gov/ixviewer/ix.html?doc=%2FArchives%2Fedgar%2Fdata%2F1878848%2F000187884826000066%2Firen-20260930.htm).

The audit forecast now uses IREN's disclosed 9.0% and 9.51% fixed rates for the two secured GPU facilities. The first forecast quarter accrues $0.0213B and $0.0084B on $0.947B and $0.355B of opening principal. The borrower operating cash bridge replaces the generic rate on those balances once. The paired test independently computes a $0.0021B increase in company interest against the generic-rate run. Quarterly accrual uses opening balances and does not claim to reconstruct monthly settlement or intraquarter draw timing.

IREN GPU Financing 3.0 now has a modeled equal-monthly-payment schedule. The October opening uses $0.355B of disclosed outstanding principal, an implied fixed annual rate of 9.51%, and an assumed remaining 35 installments because the disclosed 36 payments begin in September 2026. Three monthly steps yield about $0.0267B principal and $0.0082B interest in 2026Q4, leaving $0.3283B outstanding. The borrower cash bridge applies scheduled principal and modeled interest separately. The solvent maturity fixture verifies the two final monthly payments in 2029Q3 bring principal to zero. This allocation is a forecast at disclosed precision. Actual bank settlement dates and monthly cash amounts remain unavailable. [IREN September 10-Q](https://www.sec.gov/ixviewer/ix.html?doc=%2FArchives%2Fedgar%2Fdata%2F1878848%2F000187884826000066%2Firen-20260930.htm).

IREN reported approximately 150,000 GPUs installed or on order at March 31, 2026. The June 10-K names the AMD and NVIDIA models present in that combined installed-and-ordered scope. The audit data preserve both dated observations and carry no installed-only count or per-model quantity. The three pages now show the March combined figure with its filing link. Neither observation is used as an opening fleet cohort, since commissioned quantities and batch acquisition costs remain unknown. [March 10-Q](https://www.sec.gov/Archives/edgar/data/1878848/000187884826000026/iren-20260331.htm), [June 10-K](https://www.sec.gov/Archives/edgar/data/1878848/000187884826000052/iren-20260630.htm).

CoreWeave's S-1 establishes more than 250,000 deployed GPUs at December 31, 2024, predominantly NVIDIA Hopper. This historical deployed lower bound now appears with its date and source on all three pages. It does not establish a September 2026 in-service count, original purchase cost, individual model quantities, retirement timing, or pledged assets. No model cohort is inferred from this disclosure. [CoreWeave S-1](https://www.sec.gov/Archives/edgar/data/1769628/000119312525044231/d899798ds1.htm).

### GPU units, acquisition price and generation

GPU scenarios can now use a cohort's integer quantity, per-device USD purchase price and generation to compute cost. In the company scenario JSON, supply those fields as `quantity`, `unitCostUsd` and `generation` in opening cohorts or in a quarterly `gpuPurchasesByQuarter` entry. Optional `replacementUnitCostUsd` and `replacementGeneration` apply to counted replacements. Quarterly purchases admitted to the fleet are capped by base cash CapEx in whole units. Fractional planned replacements and repurposing are rounded down to whole devices and the remaining quantity carries forward.

In the independent case, a 10,000-unit cohort at $40,000 per device replaces 5,000 units at $50,000. Of the old devices, 1,000 transfer to lower-tier workloads and 4,000 are sold at 25% residual. Gross replacement CapEx is $0.25B, sale proceeds are $0.04B, and the declines in FCF and cash are $0.25B and $0.21B. Browser tests in all three pages verify a counted purchase, the generated refresh quarter and the original, retained and replacement quantities in the downloadable ledger. These fixtures use hypothetical quantities and prices. Actual generation-specific purchase and disposition records remain unavailable.

The counted GPU model now accepts a scenario performance ratio for replacement hardware relative to the outgoing devices. It rounds up the new purchase count to preserve modeled compute capacity, with one-to-one replacement as the default. If a target generation is explicitly set and already matches the old cohort, the model uses one-to-one replacement for that cohort. Cost-only batches continue to use the existing spend model. In the independent example, retiring 5,000 old units and using a 2x ratio requires 2,500 new units at $50,000 each, reducing replacement CapEx from $0.250B to $0.125B while resale remains $0.050B. Each browser page exercises the ratio control and verifies the counted replacements in the export. The performance ratio is a workload scenario assumption without an implied company-specific benchmark.

The counted GPU ledger now carries the modeled per-device performance baseline with each replacement cohort. The export reports counted devices, primary workload capacity in scenario units, and whether counted records cover every modeled batch. Lower-tier hardware is counted as retained equipment but excluded from primary capacity. The independent case verifies that 5,000 original units plus 2,500 units rated at twice the original performance preserve 10,000 primary capacity units. Replacing the newer cohort with its explicitly same generation retains its existing rating. The browser case verifies the fleet totals with all three pages. These capacity units are scenario measures and are not added to revenue.

### Quarterly GPU book-value reconciliation

When an accounting life is configured, the export reconciles opening book value, cash acquisition additions, noncash straight-line depreciation, book value disposed and closing book value. Additions begin depreciating in the following modeled quarter, and a disposal posts after the current quarter's depreciation. This convention uses zero accounting salvage value independently of the modeled sale proceeds. The $2B acquisition fixture checks $1.0833B opening book value, $1B additions, $0.0833B quarterly depreciation, $0.5B book value disposed and $1.5B closing book value. Cash and FCF still use the purchase and sale flows. The browser regression verifies the downloaded depreciation bridge on all three pages. The bridge is unavailable without a configured accounting life and reports scenario values rather than actual company depreciation.

All three panels distinguish incremental quarterly GPU maintenance CapEx from usage-related cash operating maintenance and replacement purchases. The $0.2B paired fixture reduces cash and FCF by $0.2B and leaves operating cash and GPU counts unchanged. The control represents capitalized maintenance or upgrades excluded from base CapEx and purchases of new devices. No upgrade asset life, tax shield or device count is inferred, so this spend is listed separately from the device book-value bridge. Three browser cases verify the entered value in the quarterly export.

The SB Energy scenario now reconciles contingent exposure across projects to the unused portion of the disclosed maximum. With a $10B shared limit, $8B effective and two future phases each requesting $4B of exposure, the ledger assigns $1B to each future phase and reports $2B total contingent. The quarterly download also reconciles recognized calls to pending and cumulative cash settlements. The delayed $3B fixture checks that pending remains $3B at recognition, falls to zero on settlement and remains separate from the $3B cumulative cash payment. The model retains the existing scenario call and settlement assumptions.

Calls from expired SB Energy projects continue to consume the cumulative portfolio limit. In the independent case, phase one calls $80B and expires, then phase two enters with $80B of gross exposure. Only $25B of the $105B cumulative maximum remains callable. The second $25B call now leaves zero project and portfolio guarantee liability. The prior implementation incorrectly left $55B on the ledger even after the cumulative cap was exhausted.

### Oracle commenced finance leases

The Oracle detail pages now offer an optional recognized-finance-lease cash scenario. It starts with the August $9.185B carrying liability and uses even monthly payments within the dated fiscal buckets. The 5.7% rate comes from the prior May 10-K and is a proxy for the August portfolio. A modeled September payment rolls the August liability forward before the October cash quarter. In 2026Q4 the scenario records $0.2067B of gross payments, $0.1269B interest, $0.0798B principal and $9.0788B closing liability. With calibrated operating cash, the existing interest stays embedded and only the $0.0798B modeled principal changes closing cash. An explicit pre-interest OCF margin uses the scenario interest. The $288B of uncommenced commitments remains separate. The 'thereafter' bucket, actual settlement dates and actual portfolio-level interest and principal split are still unavailable. [August 10-Q, Note 6](https://www.sec.gov/Archives/edgar/data/1341439/000119312526389274/orcl-20260831.htm), [May 10-K](https://www.sec.gov/Archives/edgar/data/1341439/000119312526277521/orcl-20260531.htm).

### Additional hyperscaler uncommenced lease sensitivity

The company panels now offer 10-year and 20-year operating cash stress cases for Microsoft, Alphabet and Meta using their disclosed uncommenced aggregates of $364.6B, $130.5B and $355.73B. Calendar commencement is an equal annual phase assumption from 2027 through 2034, 2031 and 2036 respectively, adjustable with the existing start-delay control. These ranges are scenario dates and the disclosure retains each issuer's reported basis. The 10-year first-quarter payments are $1.1394B, $0.6525B and $0.8893B. The 2026Q4 opening amounts remain uncommenced, and the preset uses operating cash without adding finance principal. All three browsers verify the controls and payments in the export. The assumed operating treatment represents a cash stress on mixed portfolios. Actual classification, conditional commencement and individual cash schedules remain missing. [Microsoft 10-Q](https://www.sec.gov/Archives/edgar/data/789019/000119312526436133/msft-20260930.htm), [Alphabet lease note](https://www.sec.gov/Archives/edgar/data/1652044/000165204426000084/R13.htm), [Meta 10-Q](https://www.sec.gov/Archives/edgar/data/1326801/000162828026066773/meta-20260930.htm).

The disclosed aggregate lease stress presets now accept an assumed finance share and annual discount rate, defaulting to all operating as before. Each phase splits the same commitment between operating and finance cash flows. The Alphabet fixture delays commencement one quarter, allocates half of payments to finance leases and sets a zero discount rate for a hand check. Before commencement the $130.5B remains off the balance sheet. The first active quarter pays $0.6525B, including $0.3263B financing principal, and recognizes $12.7238B of closing finance lease liability. An all-operating replay with the same dates produces the same ending cash and lower OCF by the principal amount. The browser suite checks the mixed cash split. Neither the selected share nor the rate represents an issuer-disclosed portfolio mix.

The quarterly export now reconciles incremental finance lease liabilities as opening liability plus newly recognized present value less principal paid, with a rounding line and closing liability. Alphabet's mixed scenario shows $13.05B first recognized and $0.3263B principal paid, leaving $12.7238B on the balance sheet after a $0.0001B display-rounding adjustment. A separate positive-rate fixture independently verifies final quarter opening principal of $0.9091B is fully repaid and closing liability is zero. All three browser cases check the exported roll-forward.

The L3 quarterly export now includes pending revenue recovery and its modeled cash conversion by customer and scheduled quarter. The beyond-horizon fixture preserves CoreWeave's $0.0558B of deferred revenue and $0.0275B of scenario cash for 2030Q2 at the 2028Q4 cutoff. These amounts remain outside realized revenue and cash while pending. The existing recovery fixture still verifies that each amount posts once when due.

L3 recovery now supports one to twelve quarterly installments after the capacity switch and collection delay. The default is a single installment. In the CoreWeave two-installment fixture, the existing $0.0558B in deferred revenue becomes $0.0279B in each of 2027Q3 and 2027Q4. The respective cash recoveries are $0.0138B and $0.0137B. Allocation preserves the rounded aggregate revenue and cash, and the first collection leaves the second installment visible in the pending schedule. The three browser cases verify the company scenario control. Actual recovery cadence remains a scenario input.

The L4 event stream now records a modeled spread widening even when the borrower has zero modeled floating-rate principal and incurs no same-quarter interest charge. The fixed-rate Oracle fixture reports a 100 bp widening at zero cash impact, then a 0.95 refinancing multiplier in the following quarter after spread decay. The event carries both the spread change and the modeled floating principal. The existing floating-principal fixture still reconciles its positive interest charge. Portfolio rate mix remains a scenario estimate wherever instrument coverage is partial.

### Companion archive follow-up and term maturity amendments

Companion archive SHA-256: `48E37F8F837A1A593EE737ED160FDFDDEFC77536AAA94AC6E3CD5A5FA264901F`. Its own version passed all 39 specialist cases in isolation. Its extension fixture prompted a separate reproduction against this branch: an explicitly extended $3B term draw still repaid at its original 2027Q3 maturity. With the scoped amendment, that quarter retains $3B in the lender and borrower ledgers, with zero principal repayment. At the amended 2028Q2 maturity the model repays $3B and reconciles both balances to zero. The ledger exposes both maturities and labels the amendment Assumption. The source transaction and its original maturity stay intact. Tranches with individual draw tenors continue to use their own contractual maturity schedules.

The archive's TX83 overlaps the separate NVIDIA caps, and its TX26 availability and lender attribution are unsupported by the period-end principal disclosure. The branch retains the source-checked balances and unknown fields. The archive's 39 results apply to the archive alone. The branch uses its own fixtures and common-input replays.

### Anthropic issuer proceeds from the closing 8-K

Items 3.02 and 8.01 confirm the November 20 closing and distinguish newly issued shares from selling-stockholder shares. At $83 per share, 1,103,351,354 issuer IPO shares imply $91,578,162,382 gross issuer IPO proceeds. The 23,648,646 secondary shares imply $1,962,837,618 of selling-stockholder proceeds, excluded from issuer cash. The 313,253,007 private placement shares at the same price imply $25,999,999,581, with no placement underwriting commission. Gross proceeds attributable to the issuer therefore reconcile to $117,578,161,963 before offering expenses. The filing's approximately $119.5B combined headline also includes the secondary proceeds. Closing is confirmed, while the $117.0B modeled net receipt remains a prospectus estimate and Q4 OCF remains a forecast pending issuer cash-flow disclosures. The existing with-and-without-financing sensitivity remains applicable. [Anthropic closing 8-K](https://www.sec.gov/Archives/edgar/data/2130357/000162828026075973/ant-20261119.htm).

### Alphabet and Amazon recognized lease reconciliation

September 30, 2026 carrying values, USD billions. The current and noncurrent subtotals reconcile independently to the filed operating and finance lease totals.

| Entity | Operating current | Operating noncurrent | Operating total | Finance current | Finance noncurrent | Finance total | Combined |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Alphabet | 3.693 | 16.815 | 20.508 | 1.053 | 2.652 | 3.705 | 24.213 |
| Amazon | 14.093 | 86.195 | 100.288 | 1.866 | 12.629 | 14.495 | 114.783 |

Alphabet's Q3 lease payments already classified in operating cash flow were $0.998B for operating leases and $0.025B for finance leases. Its $1.110B finance lease principal was a financing outflow. The $0.159B of prepayments for leases expected to be classified as finance leases is disclosed separately. The approximately $6B short-term commitment is also separate from recognized lease liabilities. These classifications keep the incremental lease scenario from subtracting the opening operating cash payments a second time. [Alphabet September 10-Q](https://www.sec.gov/Archives/edgar/data/1652044/000165204426000084/goog-20260930.htm).

Amazon's $139.447B of gross recognized-lease payments less $24.664B imputed interest yields $114.783B carrying value. The $6.827B current portion of long-term borrowings is a separate debt measure. Quarter-level commencement and cash schedules for new projects remain assumptions. [Amazon September 10-Q, Notes 3 and 5](https://www.sec.gov/Archives/edgar/data/1018724/000101872426000040/amzn-20260930.htm).

### OpenAI 2025 investor-side financing history

SoftBank reports that Vision Fund 2 funded $7.5B at the April closing and $22.5B at the December 26 closing of its March 2025 commitment. These $30B of investor-attributed primary financing are stored as two historical observations, separate from the 2026 round. The April record uses the quarter because the announcement gives the month. The series covers one investor and leaves complete annual financing by source unavailable for historical curve fitting. It creates no forecast receipt. [SoftBank 2025 closing announcement](https://group.softbank/en/news/press/20251231).

### Amazon borrowing bridge and contractual debt payments

The September 10-Q gives $180.887B face value of long-term borrowings. Subtracting $0.935B of unamortized discount and issuance costs gives $179.952B carrying value. Of that amount, $6.827B is current and $173.125B is noncurrent. The separate $0.380B short-term working-capital borrowing is classified within accrued expenses. Including it gives $180.332B of carrying borrowings, of which $7.207B is current. This bridge excludes lease liabilities and unfunded capacity.

The contractual long-term debt principal-plus-interest buckets are $1.413B for the remainder of 2026, $16.566B in 2027, $19.567B in 2028, $39.185B in 2029, $12.489B in 2030 and $205.034B thereafter, totaling $294.254B. These buckets include interest and cannot be added to the model's principal maturity wall. The $17.5B term loan already drawn in September matures in September 2029 and is included in reported borrowings. It is separate from the conditional equipment borrowing modeled under the $80B supplier facility. A quarter-level principal-only schedule is still needed to allocate all other borrowings across the forecast. [Amazon September 10-Q, Notes 4 and 5](https://www.sec.gov/Archives/edgar/data/1018724/000101872426000040/amzn-20260930.htm).

### Amazon term principal and replacement revolving maturity

The audit profile now tracks the $17.5B September 2026 term loan as opening funded principal within the existing $181.267B borrower principal anchor. No new cash or debt is created at forecast opening. The lender syndicate exposure is tracked in aggregate and lender shares remain unknown. The term loan is floating rate and uses the model's scenario interest assumptions. A solvent fixture shows $17.5B outstanding through 2029Q2 and repayment of $17.5B in 2029Q3. The $15B revolving facility retains its internal identifier for existing scenarios and uses October 2031, the maturity of the October 2026 replacement. The solvent fixture confirms availability before that maturity and zero drawable capacity at the modeled maturity quarter. The forecast tables were regenerated with unchanged scenario inputs. For example, stress C now shows CoreWeave 2028Q4 cash of negative $35.8945B versus negative $35.6765B before the update, with the same first default quarter. [Amazon September 10-Q, Note 5](https://www.sec.gov/Archives/edgar/data/1018724/000101872426000040/amzn-20260930.htm).

### Alphabet committed revolvers

Alphabet Note 6 reports $4B and $6B revolving facilities expiring in April 2027 and April 2030, respectively, with no September 2026 borrowings. Both facilities now populate the audited ledger without increasing opening principal or cash. Individual lender allocations remain unknown. The April month-end dates are upper bounds used for quarterly draw eligibility because the filing gives the months only. A solvent regression tests $10B opening availability, $6B after the first expiry and zero after the second, including several quarters beyond the first expiry. The $25B commercial paper program and unfunded equity issuance capacity are excluded from committed revolving liquidity. The 68 existing replay rows match. [Alphabet September 10-Q, Note 6](https://www.sec.gov/Archives/edgar/data/1652044/000165204426000084/goog-20260930.htm).

### Revolver availability after scheduled maturity

The legacy lifecycle keeps facilities visible while a static commitment or unpaid balance exists. A separate ledger condition previously rejected draws only in the maturity quarter, allowing availability to reappear afterward. In the independent solvent Amazon fixture, the $15B replacement revolver still shows zero availability in 2032Q1 after its 2031Q4 maturity. The corrected draw gate preserves visibility for exposure reporting and rejects further revolving draws unless an explicit extension moves the maturity. In the Anthropic immediate lease scenario, TX17A/B remain closed after 2030Q2, and the company reaches negative $12.5409B of cash in 2031Q4 with no revolving draw. Against its unchanged $8B minimum cash, the funding gap is $20.5409B. The delayed overlay still has zero gap. Six financing replay rows changed; the 24 GPU rows and seven audited integrated stress rows are unchanged.

### Term commitment after final maturity

The post-maturity draw gate also applies to term facilities. In a solvent fixture with a $5B commitment, $3B is drawn before expiry and repaid at maturity. The remaining $2B is preserved as unused nominal commitment, with zero drawable availability. A $2B request in the next quarter produces zero cash receipts, zero loan principal and no lender exposure. Before the fix the same request drew the remaining $2B. The extension fixture checks the amended quarter, and the separate equipment financing fixture continues to check its draw-window cutoff and per-tranche maturities. All 68 report rows reproduce without changes after this correction.

### Static credit exposure at and after maturity

The static transaction exposure calculation previously continued converting an unused commitment into EAD after its scheduled maturity. In the independent fixture, $3B funded principal and $2B undrawn commitment with a 40% conversion factor give $3.8B EAD before maturity. At and after maturity static EAD retains the $3B funded balance only. A dated repayment must establish any reduction in that balance. The dynamic ledger continues to record scenario repayments and new balances separately. Explicit commitment cutoffs keep their existing treatment. Data validation, the 48 legacy cases, and 68 report rows reproduce.

### Default exposure with zero modeled loss

The audited credit-event export now retains a positive exposure even when the scenario loss rate is zero. A forced TX26 default with zero LGD produces one event with $4.583B funded exposure, $4.583B expected recovery and zero recognized loss. The facility ledger carries the same default exposure. The event produces no lender loss or L1 loss propagation. Previously the credit-event export silently omitted this default because its recognized loss was zero. The report replays continue to match all 68 existing rows.

### Private neocloud source evidence

Crusoe's September 2026 B300 validation documents a 512-GPU test in Iceland. It supports an observed configuration of one deployment, with no company-wide installed count, unit acquisition cost, purchase quarter or link to a pledged pool. Its Upper90 announcement confirms a $225M credit facility for NVIDIA GPUs and related infrastructure and identifies the syndicate. Individual allocations, actual funded principal and the collateral schedule remain unavailable. These sources therefore support hardware and financing coverage without creating a cash receipt, cohort or numerical lender attribution. [Crusoe validation](https://www.crusoe.ai/resources/blog/crusoe-earns-nvidia-exemplar-cloud-validation-on-blackwell-ultra), [Crusoe credit facility](https://www.crusoe.ai/resources/newsroom/upper90-closes-usd225m-credit-facility-to-crusoe-to-expand-ai-cloud).

Lambda's catalogue documents availability of both A100 and B200 instance offerings, supporting testing of mixed-generation workloads. The catalogue establishes no installed fleet totals, asset ages, acquisition costs or net resale proceeds. Lambda separately reported $15M Series A equity and a $9.5M debt facility in 2021. Its release provides one historical financing observation and does not establish a complete year by source or outstanding debt at the forecast cutoff. Both entities continue to require cohort, cash-flow and collateral disclosures before the research profile can use verified company-specific balances. [Lambda instances](https://lambda.ai/instances), [Lambda financing announcement](https://lambda.ai/blog/lambda-raises-24-5-to-build-a-gpu-cloud-and-deep-learning-infrastructure).

### Lambda institutional financing cross-check

Issuer and transaction-counsel announcements establish the following discrete observations in USD billions.

| Event | Disclosed amount | Basis |
| --- | ---: | --- |
| February 2024 Series C | 0.320 | Completed equity round announced by the issuer. |
| April 2024 Macquarie-led vehicle | Up to 0.500 | GPU financing vehicle capacity. Funded principal unavailable. |
| May 2026 syndicated senior secured facility | 1.000 | Upsized from the 0.275 August 2025 facility. The incremental commitment is 0.725, and the prior commitment is included in the new facility. |
| August 2026 senior secured term loan B | 0.926 | Separate GPU-backed project loan closed for one committed customer deployment. Quarter-end funded principal and lender allocations unavailable. |
| October 2026 fixed-rate delayed-draw term loan | 1.000 | Separate facility closed for three customer deployments. The draw schedule and actual funding are unavailable. |

Partial issuer disclosures establish these events without establishing the annual cash received by source or the September consolidated cash and debt opening balances. The October facility falls after the September cutoff and its full commitment is not modeled as October cash. The series remains insufficient for a source-complete historical curve. [Series C announcement](https://lambda.com/blog/lambda-raises-320m-to-build-a-gpu-cloud-for-ai), [Macquarie transaction counsel](https://www.lw.com/en/news/2024/04/Latham%20Watkins%20Represents%20Macquarie%20in%20US500%20Million%20Financing%20for%20Lambda), [May upsizing](https://lambda.com/blog/lambda-closes-1-billion-senior-secured-credit-facility), [August term loan B](https://lambda.com/blog/lambda-closes-926-million-senior-secured-term-loan-b-facility), [October delayed-draw facility](https://lambda.com/blog/lambda-closes-1-billion-senior-secured-fixed-rate-financing).

### Anthropic compute purchase terms and conditional Lambda revenue

The final Anthropic prospectus reports approximately $41.3B of May, June and August 2026 Lambda compute agreements with terms extending into 2034. Fees accrue as Anthropic accepts delivered capacity. Approximately $34.9B belongs to the August agreement, which the filing says became terminable by either party after a facility-lease deadline was missed. Neither party had given notice as of the prospectus. Subtracting the August tranche leaves approximately $6.4B in the other Lambda agreements, also subject to delivery and acceptance. Neither figure supplies quarterly payments or cash receipts. The exposure should be stressed as a possible delivery failure or cancellation, rather than treated as a fixed loss or current debt. The model makes no incremental cash deduction because the source does not identify accepted capacity, payment dates, or overlap with its baseline compute spending.

The same filing separately describes an Amazon minimum spend of at least $110B over May 2026 to April 2036, with a shortfall true-up and contract exceptions, and approximately $44.6B of Nscale services through 2033 conditional on delivery and acceptance. These rights and obligations have different triggers. Neither establishes a verified quarterly schedule. [Anthropic final prospectus, contractual obligations](https://www.sec.gov/Archives/edgar/data/2130357/000162828026074944/anthropicpbc-424b4.htm).

### Anthropic contractual obligations and equipment lease overlap

The prospectus headline reconciles to $900.893B using the disclosed rounded components: $319.993B in the September contractual table, $17.4B in separately reported short-term September obligations, $451.2B in uncommenced September leases, $105.7B in subsequent longer-term commitments, and $6.6B in subsequent short-term commitments. The September table further reconciles to $4.224B operating leases plus $1.950B finance leases plus $313.819B purchases. Approximately $186.2B of the headline is subject to termination rights or conditions before commencement. That figure describes a subset. Separately estimated payments of $150B to $175B under arrangements without fixed dollar commitments are outside the headline.

The $161.2B Broadcom master equipment lease figure represents contractual lifetime rent excluding interest. The filing describes finance leases, quarterly rent typically tied to equipment readiness, and assignment of portions to third parties without increasing total contractual rent. The lease-specific disclosure lacks a reconciliation to the commenced, uncommenced and subsequent aggregate buckets. The model therefore preserves the existing aggregate stress and does not add $161.2B as an independent cash overlay. It also does not assume a note draw to finance rent. The note terms permit financing in certain circumstances and require a draw schedule to model its cash and debt effects. [Anthropic final prospectus, Contractual Obligations and Infrastructure Equipment Leases](https://www.sec.gov/Archives/edgar/data/2130357/000162828026074944/anthropicpbc-424b4.htm).

### Anthropic restated revolver and letters of credit

The audited profile replaces the legacy TX17A/B lender-share assumptions with the disclosed single A&R facility. September balances reconcile: $15B commitment less $0.205B standby letters of credit and zero funded borrowings gives $14.795B of drawable capacity, which the issuer rounds to $14.8B. Individual lender shares remain unavailable. Scheduled maturity is September 4, 2031. An earlier springing maturity can apply around certain scheduled principal payments above $500M and an insufficient liquidity or covenant test. The baseline uses scheduled maturity because the inputs for that earlier test are unavailable. The restated facility reduces 2028Q4 available liquidity by $0.205B across the five Anthropic scenarios without an immediate cash or debt entry. The old transaction edges remain in the legacy dataset for historical comparison. They are excluded from the audited ledger to prevent double counting. [Anthropic final prospectus, Revolving Credit Facility](https://www.sec.gov/Archives/edgar/data/2130357/000162828026074944/anthropicpbc-424b4.htm).

### Browser verification of the restated Anthropic facility

All three financing panels now expose the reported $14.795B revolving availability, observation quarter, scheduled maturity and source. The browser test opens Anthropic and checks the displayed amount, date and prospectus link. It also downloads the audited ledger and checks zero funded debt, $0.205B of standby letters of credit, unknown lender shares and absence of both superseded balances. The legacy graph continues to show historical edges and the audited export gives the restated facility.

### Broadcom fiscal-Q3 opening data and obligations

The Broadcom record mapped to 2026Q3 is the fiscal quarter ending August 2, 2026. Its disclosed revenue was $29.591B and quarter-end cash was $23.975B. Quarterly operating cash of $14.197B less $0.532B in purchases of property and equipment gives $13.665B FCF. The cash-flow amounts come from the issuer's single-quarter release. No calendar September cash bridge is available. The filed balance sheet also gives $13.707B trade receivables and $4.000B accounts payable.

Note 6 reconciles $61.079B principal less $1.660B of unamortized discount and issuance costs to $59.419B carrying debt, split into $2.252B current and $57.167B noncurrent. The disclosed fiscal-year scheduled principal buckets are $2.252B for the rest of FY2026, zero in FY2027, $5.127B in FY2028, $2.405B in FY2029, $6.406B in FY2030 and $44.889B thereafter. These total $61.079B. The revolver has $7.5B gross capacity through January 13, 2030 and no funded borrowing at the filing cutoff. Its $0.5B letter-of-credit sublimit is part of that capacity. The source does not equate that sublimit to outstanding letters of credit.

The filing gives $179.2B of remaining performance obligations for specified multi-year contracts, replacing the prior $35B entry. That amount is not a quarterly revenue or cash estimate. All 68 report rows reproduce. [Broadcom 10-Q](https://www.sec.gov/Archives/edgar/data/1730168/000173016826000080/avgo-20260802.htm), [Broadcom quarterly release](https://investors.broadcom.com/news-releases/news-release-details/broadcom-inc-announces-third-quarter-fiscal-year-2026-financial).

### AMD fiscal-Q3 liquidity and operating cash flow

For the fiscal quarter ending September 26, 2026, AMD reports $7.404B cash and equivalents plus $8.372B of short-term investments. The model cash anchor uses cash and equivalents. Q3 continuing-operations OCF of $1.202B less $0.648B capital expenditures gives $0.554B FCF. The balance-sheet record includes $7.756B accounts payable, $7.079B noncurrent carrying debt and zero current debt. Operating lease carrying value is $2.132B, reconciling $2.667B gross payments less $0.535B imputed interest. The $0.246B RPO field covers contracts of more than one year under the issuer's reporting policy.

The $5B May 2026 revolving facility replaced the prior $3B facility and had no funded balance at September 26. Letters of credit can occupy up to $0.250B of the commitment. The model replaces the stale $3B input with a conservative $4.750B scenario amount, explicitly tagged Assumption because actual letter-of-credit usage is undisclosed. The separate $5.5B commercial paper program is not added to committed revolver capacity. All 68 report rows reproduce. [AMD fiscal Q3 release](https://www.sec.gov/Archives/edgar/data/2488/000000248826000188/q32026991.htm), [AMD September 10-Q](https://www.sec.gov/Archives/edgar/data/2488/000000248826000191/amd-20260926.htm).

### AMD and Broadcom revolving maturity in the instrument ledger

The audited model now tracks the committed unsecured revolvers as individual facilities. AMD has $5B gross capacity and scheduled maturity on May 14, 2031, the fifth anniversary of the closing. Broadcom has $7.5B and scheduled maturity on January 13, 2030. Both reported zero funded principal at their respective Q3 cutoffs. Actual letter-of-credit usage at those cutoffs is unavailable, so the model reserves the full $0.25B AMD and $0.5B Broadcom sublimits, explicitly labeled Assumption in the exported ledger. Modeled drawable amounts are $4.75B and $7B. No individual lender is assigned. The regression checks opening availability, zero funded principal, the last full forecast quarter before maturity, the maturity quarter and a later quarter. Both facilities remain closed after maturity. All 68 replay rows reproduce. [AMD May 8-K](https://www.sec.gov/Archives/edgar/data/2488/000119312526226746/d118163d8k.htm), [AMD September 10-Q](https://www.sec.gov/Archives/edgar/data/2488/000000248826000191/amd-20260926.htm), [Broadcom August 10-Q](https://www.sec.gov/Archives/edgar/data/1730168/000173016826000080/avgo-20260802.htm).

### Micron gross cash CapEx and customer deposits

For the fiscal quarter ended September 3, 2026, Micron reported $54.229B revenue and $43.973B operating cash flow. Subtracting $11.110B gross cash spending on property and equipment gives $32.863B FCF on the model convention. Adding $0.009B asset sale proceeds and $0.327B government incentives reconciles to the issuer's $33.199B adjusted FCF. The former dataset combined gross CapEx with the issuer's adjusted FCF. The sourced balance-sheet record now uses $38.364B cash, $31.793B trade receivables, $3.518B accounts payable and $5.179B carrying debt, split into $0.491B current and $4.688B long-term.

The 10-K discloses approximately $134B RPO, including $13B of recognized contract liabilities. Nearly all strategic deposit repayments are scheduled between 2029 and 2031. The $12.747B of fiscal-year customer contract liability deposits was classified in financing cash flows. It remains separate from OCF and debt; adding it to forecast opening cash would duplicate the cash receipt. Quarterly repayment timing is unavailable. The 68 report scenario rows reproduce. [Micron fiscal Q4 release](https://www.sec.gov/Archives/edgar/data/723125/000072312526000018/a2026q4ex991-pressrelease.htm), [Micron fiscal 2026 10-K](https://www.sec.gov/Archives/edgar/data/723125/000072312526000023/mu-20260903.htm).

### Micron revolving credit and finance lease debt

The annual report confirms that Micron reduced its revolving facility from $3.5B to $2B in May 2026. The entire $2B was reported drawable at September 3 with zero funded borrowings. The audit model replaces the previous $2.5B aggregate input with the $2B facility ledger and closes it at the March 12, 2030 maturity. The regression checks opening cash availability without funded debt, the last full open quarter, the maturity quarter and the following quarter. The facility has a 3.25x net leverage covenant, with a temporary 3.75x limit in specified acquisition circumstances. Future covenant eligibility and lender allocations are unverified.

The $5.179B of reported carrying debt already includes $2.387B of finance leases, with $0.491B current and $1.896B noncurrent. Unsecured notes account for the other $2.792B. The $2.775B undiscounted finance lease payments less $0.388B imputed interest independently reconcile to the finance lease carrying balance. Adding that balance again would double count it. The annual table does not give quarter-level principal or commencement cash flows for embedded leases. The $10.8B purchase commitment also includes some signed uncommenced gas supply leases, so the model does not add a second overlay for those leases. [Micron fiscal 2026 10-K, Notes 9 and 10](https://www.sec.gov/Archives/edgar/data/723125/000072312526000023/mu-20260903.htm).

### HPE quarterly cash and borrowings

The fiscal period mapped to 2026Q3 ends July 31, 2026. HPE reports $12.213B revenue, $6.216B cash and equivalents, and $0.062B restricted cash. For the quarter, $1.641B operating cash flow less $0.745B gross property, equipment and software additions yields $0.896B FCF on the model convention. The issuer's $0.958B FCF adds $0.092B asset-sale proceeds and subtracts $0.030B of FX effects. The report retains that separate reconciliation.

Total borrowings are $20.244B, split between $2.901B short term and $17.343B long term. The former dataset used a rounded noncurrent figure as total debt. Payables were $13.734B, including $0.791B of supplier-finance balances classified in payables. The source reports $10.920B deferred revenue and $0.405B customer deposits separately. Those amounts do not substantiate the old $30B aggregate RPO input, which is now blank. The revolver maximum was $5.25B, with no outstanding drawings. The revolver and commercial paper share a $5.75B combined ceiling and the model does not add their limits. Calendar September balances and a complete quarterly maturity schedule remain unavailable. [HPE July 10-Q](https://www.sec.gov/Archives/edgar/data/1645590/000164559026000080/hpe-20260731.htm), [HPE quarterly cash-flow reconciliation](https://investors.hpe.com/?ReleaseID=421961).

### HPE revolving facility maturity and commercial paper limit

The audited instrument ledger now holds HPE's $5.25B revolving commitment with zero opening funded principal, sourced to the July 2026 filing. The annual report describes a five-year term starting September 2024. The quarterly model closes the facility in 2029Q3 based on that term. The $5.75B combined ceiling applies across commercial paper and revolver borrowings, so the model uses the revolving commitment alone and adds no separate commercial paper capacity. The facility's individual lender allocations are unknown. The independent case checks $5.25B in 2029Q2 and zero in the maturity quarter and afterward. The July filing also confirms the remaining acquisition term loan principal of $0.750B was repaid in May 2026. It is excluded from opening funded instruments. All 68 report rows reproduce. [HPE fiscal 2025 10-K](https://www.sec.gov/Archives/edgar/data/1645590/000164559025000130/hpe-20251031.htm), [HPE July 2026 10-Q](https://www.sec.gov/Archives/edgar/data/1645590/000164559026000080/hpe-20260731.htm).

### Supermicro quarterly cash and debt classification

The September 30 10-Q reports $19.945832B quarterly sales, $6.897497B cash and equivalents and $0.118123B restricted cash. OCF was negative $0.434021B and gross PP&E spending was $0.041588B, giving negative $0.475609B model FCF. An additional $0.005B equity investment is separate from gross PP&E spending. Carrying debt reconciles to $8.646017B: $1.962690B current lines and loans, $2.014381B noncurrent lines and loans, and $4.668946B convertible notes. Reported operating lease liability was $0.532533B and accounts payable was $2.727379B. The model replaces the prior $39B RPO field with the disclosed $5.6657B, subject to the filing's exclusion of contracts with an original expected duration of one year or less. The exact usable commitment behind the legacy undrawn credit input still requires facility-level reconciliation. All 68 report scenario rows reproduce. [Supermicro September 10-Q](https://www.sec.gov/Archives/edgar/data/1375365/000137536526000027/smci-20260930.htm).

### Supermicro syndicated facility availability

The FY2026 10-K identifies a $2B JPMorgan-administered revolving facility maturing December 29, 2030, including a $0.2B letter-of-credit sublimit. The September 10-Q shows zero funded principal for this facility. The audited ledger now includes it with $1.8B of scenario availability after conservatively reserving the entire sublimit. Actual letters of credit and future covenant eligibility remain unknown. The scheduled September 2026 opening balance is zero, and the test confirms that availability ends in 2030Q4. The syndicate administrator is not attributed all lender exposure. The separate $1.765B CTBC commitments are conditional on eligible purchase documentation and have an uncertain first-use-based maturity, so they are excluded from the modeled drawable amount. The legacy aggregate credit input is bypassed by the audited ledger. All 68 replay rows reproduce. [Supermicro FY2026 10-K](https://www.sec.gov/Archives/edgar/data/1375365/000137536526000022/smci-20260630.htm), [Supermicro September 10-Q](https://www.sec.gov/Archives/edgar/data/1375365/000137536526000027/smci-20260930.htm).

### Dell replacement revolver and debt maturities

Dell's June 2026 replacement revolver provides $6B of commitments through June 10, 2031. July funded principal was zero and the filing reports $5.884B remaining available, implying $0.116B of outstanding letters of credit. The audited facility ledger tracks that availability, leaves lender shares unallocated and blocks draws at and after the maturity quarter. The revolver supports the separate $5B commercial paper program as a backstop. July commercial paper was zero and no independent $5B is added to drawable liquidity. The opening, final open quarter and expired quarters are independently tested.

The filed annual debt principal buckets total $34.747B: $5.351B over the remaining six months of fiscal 2027, then $4.489B, $3.651B, $3.942B, $1.773B, and $15.541B thereafter. The disclosed annual buckets lack a complete quarterly repayment and instrument allocation, so they are reported separately from modeled repayments. All 68 report rows reproduce. [Dell July 2026 10-Q, Note 6 and liquidity discussion](https://www.sec.gov/Archives/edgar/data/1571996/000157199626000046/dell-20260731.htm).

### Digital Realty and Equinix revolving liquidity

Digital Realty's combined global and yen revolving facilities have approximately $4.470B of USD-equivalent commitments at the reported exchange rate, $1.655570B of principal and $0.1008B of letters of credit. The difference is approximately $2.7136B of modeled drawable capacity. The aggregate ledger preserves the existing funded debt and applies the January 24, 2029 scheduled maturity. The two six-month extension options and the conditional accordion are excluded from baseline capacity. Currency changes and separate facility or lender allocations remain unverified.

Equinix's $5.5B replacement revolver has no funded September principal, $0.006B of letters of credit and July 25, 2031 maturity. Modeled drawable capacity is $5.494B, matching the filing's rounded $5.5B. Both facilities have source-backed opening ledger tests and maturity coverage. All 68 report rows reproduce. [Digital Realty September 10-Q, Note 9](https://www.sec.gov/Archives/edgar/data/1297996/000110465926120710/dlr-20260930x10q.htm), [Equinix September 10-Q](https://www.sec.gov/Archives/edgar/data/1101239/000110123926000180/eqix-20260930.htm).

### Vertiv replacement unsecured revolving facility

Vertiv's $2.5B senior unsecured revolver replaced its $0.8B asset-based facility on March 3, 2026. The September filing confirms zero funded borrowings, $0.016B of letters of credit, and $2.484B available subject to customary conditions. The model uses the new facility only. The five-year term closes it in 2031Q1. The two possible one-year extensions and the conditional $1B accordion are excluded from baseline capacity. The syndicate agent is not assigned individual lender exposure. Tests check opening funded principal and net availability, the last open quarter, and zero drawable capacity in and after the maturity quarter. All 68 report rows reproduce. [Vertiv September 10-Q, Debt](https://www.sec.gov/Archives/edgar/data/1674101/000162828026067893/vrt-20260930.htm).

### Vertiv September-quarter cash and debt bridge

The issuer reports $4.3128B quarterly sales and $0.7940B operating cash. Gross cash capital spending is $0.1391B PP&E plus $0.0027B capitalized software. Subtraction gives $0.6522B FCF, matching the issuer's reconciliation. Cash and equivalents of $3.5129B exclude $0.1988B of short-term investments. Trade receivables are $4.3797B and accounts payable $3.2447B. Current carrying debt of $0.0034B plus noncurrent debt of $2.9251B gives $2.9285B. Gross debt of $2.9552B less $0.0267B in issuance costs and discount independently reconciles. The corrected dataset and three pages use these figures and $2.484B available under the replacement revolver. The $0.3397B noncurrent lease balance is a partial measure and leaves total lease liabilities unavailable in the entity row. All 68 report rows reproduce. [Vertiv September 10-Q](https://www.sec.gov/Archives/edgar/data/1674101/000162828026067893/vrt-20260930.htm), [quarterly cash-flow reconciliation](https://www.sec.gov/Archives/edgar/data/1674101/000162828026067707/q32026exhibit991vrt10282026.htm).

### Constellation corporate revolver and commercial paper backstop

Constellation reported $7B of gross corporate revolving commitments at September 30, 2026, with zero revolving principal, $0.121B in letters of credit, and $2.092B of commercial paper backed by the same facility. The independent reconciliation gives $4.787B of drawable revolving capacity. The model exports both reserves separately and keeps the reported commercial paper backstop constant until the facility expiry in September 2030, since future commercial paper balances are unavailable. The backstop is a reservation of capacity rather than a funded revolving draw. The regression confirms $4.787B through 2030Q2 and zero availability at and after maturity. The filing's $7.194B aggregate available capacity includes restricted purposes and separate collateral or project financing; none is added to the corporate revolver baseline. Lender shares and future eligible receivables remain unknown. All 68 report rows reproduce. [Constellation September 10-Q, Note 13](https://www.sec.gov/Archives/edgar/data/1868275/000186827526000119/ceg-20260930.htm).

### Source register snapshot consistency

The source register test now checks the latest populated quarter and the recorded disclosure date against the entity dataset. It reproduced a stale Vistra row that still listed its September snapshot as unavailable and an Anthropic row that used the November 18 final prospectus date for the dataset's November 17 preliminary snapshot. The register now lists both Anthropic sources with the distinct publication dates, cites Vistra's September and June 10-Qs and records its remaining post-acquisition funding gaps. Source rows for Constellation, Digital Realty and Equinix reflect the audited facility evidence and still identify unverified lender and future cash inputs. This check verifies alignment of the 50-entry register with stored snapshots. It does not establish primary-source accuracy for fields that still lack independent reconciliation.

### Constellation historical cash and carrying debt alignment

The September historical record now uses the same cash flow bridge as the audited forecast: $4.979B nine-month OCF less $1.553B six-month OCF yields $3.426B for Q3; $3.461B less $2.521B gives $0.940B capital spending and $2.486B FCF. Total carrying debt of $23.387B includes $3.989B short-term borrowings, $0.359B of current maturities of long-term debt, and $19.039B noncurrent debt. The $2.092B commercial paper balance is already within short-term debt and only reserves revolver headroom in the separate credit ledger. The $4.900B balance-sheet line combines payables and accrued expenses; standalone trade payables remain unavailable. The historical availability field now matches the $4.787B corporate facility bridge. All 68 scenario rows reproduce. [Constellation September 10-Q](https://www.sec.gov/Archives/edgar/data/1868275/000186827526000119/ceg-20260930.htm), [June 10-Q](https://www.sec.gov/Archives/edgar/data/1868275/000186827526000104/ceg-20260630.htm).

### Core Scientific restricted cash and CoreWeave concentration

The historical snapshot now matches the audited September cash-flow bridge: $0.065294B OCF less $0.540735B cash CapEx yields negative $0.475441B FCF. Unrestricted cash of $0.803941B is separate from $0.837603B restricted cash. The latter includes a debt service reserve. The balance sheet reports $4.302175B noncurrent carrying debt, no current debt line, and $0.120876B accounts payable. Reported operating lease liabilities of $0.103734B and noncurrent finance lease liabilities of $0.000892B total $0.104626B in the presented lease table.

CoreWeave accounted for approximately 93% of third-quarter consolidated revenue and 84% over nine months. The $0.282659B customer funding receivable is reimbursement due for spending incurred on CoreWeave's behalf. The corresponding costs are presented in payables and accruals and the reimbursement is not an incremental committed financing inflow. The quarterly recognition and future reimbursement schedules remain unavailable. All 68 audit report rows reproduce. [Core Scientific September 10-Q](https://www.sec.gov/Archives/edgar/data/1839341/000183934126000030/core-20260930.htm), [June 10-Q](https://www.sec.gov/Archives/edgar/data/1839341/000183934126000014/core-20260630.htm).

### Core Scientific bond principal and carrying debt

The audited opening balance now tracks $4.385B face principal, consisting of $3.300B subsidiary-issued secured notes, $0.460B of 2029 convertible notes, and $0.625B of 2031 convertible notes. Less $0.082825B aggregate unamortized discounts and issuance costs, this reconciles to $4.302175B carrying debt in the historical financials. All three notes enter as existing funded principal, with zero new cash proceeds. The ledger tests the amounts and leaves beneficial holders unknown. Stated maturities and coupons are attributed to their instruments. The secured issue's legal issuer remains Core Scientific Finance I LLC, with this ledger aggregated at the consolidated borrower. The secured notes' first installment depends on contractual rent and credit milestones. Their actual first installment date, future early redemptions and conversion elections are unavailable. The generic scheduled repayment remains a scenario, including the $0.050B opening-quarter repayment. The audit tables have been rerun with the same scenario inputs on the corrected principal and coupon basis. [September 10-Q, Note 7](https://www.sec.gov/Archives/edgar/data/1839341/000183934126000030/core-20260930.htm), [May secured note indenture](https://www.sec.gov/Archives/edgar/data/1839341/000119312526208905/d47435dex41.htm).

### Core Scientific contractual principal timing

The three notes now carry a schedule-required flag. A generic corporate repayment assumption no longer reduces these instruments before an explicit scheduled principal payment or maturity. The correction keeps all $4.385B outstanding in the initial quarter, removing the earlier $0.050B inferred repayment. Core Scientific Finance I's secured indenture requires the first semiannual installment to follow both rent commencement and credit abatement. The first payment date remains unknown. If the user supplies an explicit installment, the initial rate yields $3.3B × 11.50% ÷ 2 = $0.18975B. The audit test places that amount in 2027Q2 as a scenario, rounds repayment to $0.1898B, and reconciles closing secured principal to $3.1102B without reducing the two convertibles. The revised report tables reflect the corrected opening treatment. The CoreWeave lease fixture still reconciles the same four-quarter cash deferral, while its immediate and delayed closing cash levels reflect the revised network behavior. [Core Scientific secured note indenture](https://www.sec.gov/Archives/edgar/data/1839341/000119312526208905/d47435dex41.htm).

### Extended A–G stress replay

The supplied archive runs its integrated stresses through 2031Q4. The audited branch adopts that horizon with its own reconciled inputs and retains the existing 2028Q4 comparison. Cash, financing sources, FCF, principal and funding gaps are independently reconciled across eligible company-quarters through the extended cutoff. Values below are scenario outputs in USD billions. Anthropic's positive closing cash alongside negative quarterly FCF reflects opening liquidity and modeled financing inputs, including the unverified IPO proceeds sensitivity discussed above.

| Case | Entity | 2031Q4 cash | 2031Q4 FCF | Funding gap | First model default |
| --- | --- | ---: | ---: | ---: | --- |
| A | OpenAI | -245.8359 | -15.8321 | 255.8359 | 2027Q4 |
| B | Anthropic | 57.0278 | -5.4577 | 0 | — |
| C | CoreWeave | -107.0212 | -6.6273 | 109.0212 | 2027Q1 |
| D | Oracle | -314.7076 | -22.4739 | 324.7076 | 2027Q4 |
| E | CoreWeave | -89.5535 | -7.0773 | 91.5535 | 2027Q1 |
| F | CoreWeave | -120.2558 | -7.2469 | 122.2558 | 2027Q1 |
| G | CoreWeave | -145.4832 | -7.0643 | 147.4832 | 2026Q4 |

### Downloadable Core Scientific debt terms

The browser download now carries the legal issuer, maturity and secured-note amortization terms. All three pages check the consolidated borrower, funded principal and the $0.18975B contractual installment calculation before rounding. The first installment date is left unknown pending confirmation of rent commencement and abatement of revenue credits. The export adds terms without introducing cash payments.

### Core Scientific interest and construction commitments

The 2026Q3 historical record now uses the November 5 10-Q. Note 7 reports $71.840M interest incurred less $17.774M capitalized, or $54.066M interest expense. Coupon interest was $67.388M, and the income statement presents $35.047M net interest expense. The historical row stores each reported measure separately. The inherited $68M interest input is explicitly classified as an assumption. Substituting gross accounting interest changed the CoreWeave cash path through contagion. The cash-interest calibration is retained pending a quarterly cash-paid bridge. The forward debt ledger continues to use each instrument's contractual coupon.

The filing also discloses $4.4B of gross purchase and construction commitments, including $202.2M expected to pass through to CoreWeave. Most spending is expected within 24 months, with timing dependent on construction and phased AMD lease commencement. Quarterly cash payments and reimbursements are unavailable. The totals remain source evidence pending a reconciliation against forecast baseline CapEx. The $100M cash revolver and $500M letter-of-credit facility are separately disclosed and need their own availability treatment. [Core Scientific September 10-Q](https://www.sec.gov/Archives/edgar/data/1839341/000183934126000030/core-20260930.htm).

### Core Scientific revolver and letter-of-credit availability

The August 2026 agreement provides a $0.100B general-purpose revolver and a separate $0.500B letter-of-credit facility. Both were unused at September 30. The cash ledger now opens with the $0.100B line and closes it in 2029Q3. The contractual 2030 extension is elective and the baseline keeps the original maturity. Issuing bank and lender allocations remain unknown. JPMorgan's administrative-agent role does not establish its lender exposure. The separate letter-of-credit commitment is stored with its reported zero use and a conditional $0.300B restricted-cash release estimate. The baseline assumes no release and no letter-of-credit cash draw. Contractual spread and fees are recorded as terms; facility-specific fee cash flows remain outside the baseline.

Tests reconcile draws to borrower balances and check the maturity boundary. All 75 rows were replayed. In the 2028Q4 CoreWeave manual and curve paths, closing cash moves from $3.3688B to $3.3409B under the updated network simulation. First default and FCF break-even quarters are unchanged for those paths. [Core Scientific September 10-Q, Note 7 and Liquidity](https://www.sec.gov/Archives/edgar/data/1839341/000183934126000030/core-20260930.htm).

### Oracle historical borrowing and lease balances

The August historical snapshot now records $7.625B current borrowings and $117.712B noncurrent borrowings, totaling $125.337B. Accounts payable are $11.063B and restricted cash is $2.6B. Total commenced lease liabilities are $43.806B, comprising $34.621B operating and $9.185B finance leases. A separate $288B field captures uncommenced commitments. The historical fiscal period begins June 1. The fiscal cash-flow bridge continues to supply the audited forecast, and this balance-sheet correction left the 75 published audit scenario rows unchanged. Site-level commencement and quarterly principal and interest allocation remain unavailable. [Oracle August 10-Q, balance sheet and Note 6](https://www.sec.gov/Archives/edgar/data/1341439/000119312526389274/orcl-20260831.htm).


### Oracle historical cash flow and forecast calibration

The June to August historical display now reports $19.345B revenue, $23.103B operating cash flow and $28.499B cash CapEx, which yields negative $5.396B FCF. The $11.363B increase in financing-component customer prepayments is already included in reported OCF. Removing it for forecast calibration yields $11.740B. The historical interest expense is $1.428B. Calibrating the audited path with that expense changes some network cash outcomes, including Oracle and OpenAI. The three historical cash-flow fields and the opening calibration are checked separately. The old projection inputs are explicitly marked as assumptions and used only for the legacy forecast profile so the inherited stress cases retain their original thresholds and coverage. [Oracle August 10-Q](https://www.sec.gov/Archives/edgar/data/1341439/000119312526389274/orcl-20260831.htm).


### Oracle replacement revolving credit facility

Oracle terminated its $6B facility in March 2026 and replaced it with a $10B five-year unsecured revolver. The debt ledger opens with zero funded principal using the last separately verified May 31 balance as a forecast assumption. Draw eligibility ends in 2031Q1 under the model's quarter-end convention. The later prospectus identifies approximately $19.7B of combined August 31 revolver and commercial-paper borrowing capacity. The August historical revolver-only field is unknown and the $10B commercial-paper issuance program does not enter committed auto-draw capacity. The model keeps the old $6B input only as a legacy forecast assumption. Facility-level August utilization, actual future covenant headroom and lender allocations remain unverified. The model applies its existing draw rules and the report replays the resulting network paths. [Oracle May 10-K, Note 6](https://www.sec.gov/Archives/edgar/data/1341439/000119312526277521/orcl-20260531.htm), [November prospectus](https://www.sec.gov/Archives/edgar/data/1341439/000119312526445846/d181336d424b2.htm).

### Oracle dated principal maturity reconciliation

The May 31 10-K reports principal of $130.105B across fiscal maturity buckets. Less $0.564B of discounts and issuance costs, it reconciles to $129.541B of carrying debt. The $5.630B term facility had $5.137B outstanding on May 31. Its contractual installments are 2.50% of the amount borrowed reduced by prepayments from September 2026 through June 2027. Remaining principal is due August 16, 2027, subject to extension. The August 10-Q reports $4.202B of aggregate senior-note, term-loan and other repayments. It does not allocate those repayments to individual instruments. The dataset retains both dates, leaves the August term-loan principal unknown and preserves the May fiscal maturities as a dated reconciliation. Those maturities do not create additional modeled debt payments on top of the August opening balance and cash scenario. [May 10-K, Note 6](https://www.sec.gov/Archives/edgar/data/1341439/000119312526277521/orcl-20260531.htm), [August 10-Q](https://www.sec.gov/Archives/edgar/data/1341439/000119312526389274/orcl-20260831.htm).

### Nebius restricted cash and financing disclosure

The September cash statement reconciles $7.4256B of cash and cash equivalents plus $1.2155B of restricted cash to $8.6411B. The historical record now preserves the restricted amount separately. The $0.779B combined payables and accruals line and $1.7688B reported noncurrent operating lease liabilities are retained with their original scope. Standalone trade payables and aggregate recognized lease liabilities remain unknown.

August convertible issues comprise $3.45B at 0.50% due 2030 and $2.30B at 4.50% due 2034. Their $5.750B gross proceeds less $0.0719B issuance costs yield $5.6781B. The concurrent $0.800B original-principal exchange for shares is a separate noncash disclosure. The October Citi-arranged $3.5B secured facility has 364-day tenor and initial Term SOFR plus 275 basis points. Its post-quarter drawn principal, accessible balance and funded lender shares are unverified. It does not contribute assumed opening cash or lender exposure. [September results](https://www.sec.gov/Archives/edgar/data/1513845/000110465926126008/tm2629571d1_ex99-1.htm), [August closing announcement](https://nebius.com/newsroom/nebius-group-announces-closing-of-private-offering-of-convertible-senior-notes-with-aggregate-gross-proceeds-of-approximately-5-75-billion), [October financing announcement](https://assets.nebius.com/assets/3ca794eb-4d10-4456-9bbb-9883f0ec319a/22102026%20Nebius%20secures%20%243.5%20billion%20financing%20facility%20with%20Citi.pdf).

### Nebius instrument principal and lease reconciliation

The full September financial statements replace gaps left by the earnings summary. Note 12 supports eight convertible notes and the secured term loan, totaling $16.478B of contractual principal. Discounts and accretion adjustments of $2.1437B and issuance costs of $0.1715B reconcile this to $14.1628B of Note 12 carrying debt. The balance-sheet total is $14.1908B, leaving a separately tracked $0.028B scope difference. The audited forecast opens on the Note 12 principal basis and records each instrument without new cash proceeds. Generic repayment does not reduce these instruments in advance of specific repayment or maturity.

The August notes have September contractual principal of $3.795B and $2.875B, including redemption accretion to 110% and 125% of original principal. The ledger accrues quarterly coupons on the $3.45B and $2.30B original bases. Contractual coupon dates are semiannual. Future conversion and early redemption elections, lender allocations, and the exact remaining monthly term-loan principal schedule are still unverified.

Note 4 reports $0.5299B of trade payables including property and equipment. Note 8 reports $1.8815B of recognized operating lease liabilities and $13.2426B of remaining uncommenced payments after $0.6197B of prepayments. The historical dataset records the two lease amounts separately. Site-level commencement and cash timing are still needed to allocate the uncommenced payments into the forecast. All 75 existing report rows reproduce. [Nebius September financial statements, Notes 4, 8 and 12](https://www.sec.gov/Archives/edgar/data/1513845/000110465926126238/nbis-ex99d2.htm).

### Nebius uncommenced lease cash sensitivity

The company reports $13.8623B in undiscounted payments for uncommenced leases, with $0.6197B already prepaid and $13.2426B remaining. Its $1.8815B of recognized operating lease liabilities stays separate. The three pages offer optional eight- and twelve-year rent scenarios. The first four scenario quarters allocate exactly $0.5727B of disclosed next-twelve-month payments, using approximately even quarterly operating cash assumptions. The residual $12.6699B is divided into four equal phases. The first phase continues from 2027Q4 for the remainder of its selected term. The other phases begin in Q4 of 2027 through 2029. Quarterly weights, project dates, term and classification remain assumptions. The finance-share control applies only after year one.

In the twelve-year scenario, the first installment posts $0.1432B in 2026Q4 and reduces OCF and FCF by the same amount. A one-quarter scenario delay shifts the entire cash schedule, including the initial installments. The eight-year end date is verified in the full simulation, and the twelve-year last payment is checked in the payment engine beyond the 2040 simulation horizon. This scenario is opt-in. [Nebius September financial statements, Note 8](https://www.sec.gov/Archives/edgar/data/1513845/000110465926126238/nbis-ex99d2.htm).

### Nebius secured term loan principal timing

The July facility was drawn for $0.7733B and had $0.7518B of reported September principal after $0.0215B of repayments. Its legal borrowers are Nebius Compute II, LLC and Nebius Compute II Oy. MUFG acts as administrative agent. The loan has monthly installments through October 15, 2030 and matures October 31. Contractual interest is one-month Term SOFR plus 250 basis points. The forecast's existing floating rate is a scenario proxy.

The instrument-level monthly installment amounts are unavailable. The audited path assumes equal principal over the 49 remaining installment months, with explicit repayment inputs taking priority. The 2026Q4 fixture reconciles $0.0460B of repayment to $0.7058B closing loan principal and an equal reduction in borrower cash and debt. The lender allocation remains unknown. The forecast supports repayment timing without treating the assumed path as disclosed installments. [Nebius SEC financial statements, Note 12](https://www.sec.gov/Archives/edgar/data/1513845/000110465926126238/nbis-ex99d2.htm).

### Nebius Citi bridge facility

The October 22 Form 6-K identifies the agreement date as October 17, 2026, and maturity as October 16, 2027. Nebius Group N.V., Nebius Inc. and Nebius B.V. are borrowers. Citibank, N.A. is a named lender and arranger. Its funded share is unavailable. The $3.5B senior secured term commitment carries a minimum liquidity covenant and an initial Term SOFR margin of 275 basis points, increasing by 25 basis points each 90 days up to 350, subject to contractual adjustments.

The instrument now accepts explicit scenario draws via the facility ledger. The baseline posts no proceeds. Actual draws and remaining availability stay unknown in the evidence record. The draw fixture assumes covenant eligibility and caps a $4B request at $3.5B. It independently reconciles the draw to the borrower's cash and debt and verifies full principal repayment and no new draw in the maturity quarter. The model's floating-rate proxy does not apply contractual step-ups or reconstruct actual lender allocation. [October 22 Form 6-K](https://www.sec.gov/Archives/edgar/data/1513845/000110465926117978/tm2628078d1_6k.htm).

### Nebius annual financing receipts and historical curve

Net issuer equity offering receipts were $0.6675B in 2024 and $1.1262B in 2025 using cash flow statement proceeds less related cash issuance costs. Net convertible debt receipts were zero and $4.0732B, respectively. The positive equity pair supports a historical equity curve. Its unbounded 2027 request under the historical formula is $3.2059B before the configured financing limits. The zero debt base precludes calibrating a debt growth rate from these years. SAFE proceeds and employee option cash are outside the issuer equity offering series.

The first nine months of 2026 are stored separately as an incomplete actual period: $5.8597B net treasury-share and prefunded-warrant cash, $9.9718B net convertible receipts and $0.7528B net secured term proceeds. The annual curve excludes this partial period and gives no estimate for sources missing comparable complete observations. The browser suite checks the historical equity bars on all three pages. [Nebius 2025 Form 20-F](https://www.sec.gov/Archives/edgar/data/1513845/000110465926052948/nbis-20251231x20f.htm), [September 2026 financial statements](https://www.sec.gov/Archives/edgar/data/1513845/000110465926126238/nbis-ex99d2.htm).

### Nebius RPO, deferred revenue and customer concentration

Note 4 reports $38.7B of unsatisfied RPO and expected revenue recognition of 40% in the first 24 months, 40% in months 25–48 and 20% thereafter. The first bucket corresponds to $15.48B in anticipated revenue recognition. Deferred revenue consists of $1.4455B current and $7.9637B noncurrent. Neither balance establishes the timing of future cash receipts.

The Q3 operating cash-flow statement includes $3.434B from the deferred-revenue line and negative $3.7618B from receivables, a combined negative $0.3278B. Removing the deferred-revenue contribution alone from reported negative $0.273B OCF results in negative $3.707B as a sensitivity. This calculation holds other working-capital movements fixed and does not purport to isolate gross customer prepayments. The reported cash flow remains the historical observation. No additional committed financing is attributed to the RPO.

The three largest individually disclosed unnamed customer shares were 15%, 22% and 33% of Q3 revenue. Two unnamed customers represented 75% and 10% of September receivables. The dataset preserves the reported proportions without assigning identities to network counterparties. The applicable contract schedules and cash receipts by customer remain unavailable. [Nebius September financial statements, Note 4](https://www.sec.gov/Archives/edgar/data/1513845/000110465926126238/nbis-ex99d2.htm).

### IREN contract balances, counterparty concentration and fiscal debt maturities

The September 10-Q reports $2.117B of accounts payable and $0.466B of accrued expenses, reconciling to $2.583B combined. Fiscal debt maturities sum to $10.041B of face principal. Subtracting $0.144B of unamortized issuance costs reconciles to $9.897B carrying debt. These reported fiscal buckets provide a control total and do not add to the existing named instrument repayments.

ASC 606 RPO totals $6.347B, including $1.529B expected within 12 months and $1.652B in months 13–24. The $1.841B of minimum lessor payments under ASC 842 is stored separately. Neither is treated as incremental committed financing. Note 4 identifies three anonymous customers at 28%, 24% and 18% of quarterly revenue. The model does not map them to named counterparties without source evidence. The $18.947B capital commitment includes AI hardware and infrastructure; project timing and the GPU-only share are unavailable. No separate cash overlay is applied to the aggregate. [IREN September 10-Q, Notes 4, 15, 19 and 24](https://irisenergy.gcs-web.com/node/12706/xbrl-viewer).

### IREN purchase order scope and funded capacity

The March procurement announcement records purchase agreements for more than 50,000 NVIDIA B300 GPUs with phased second-half 2026 delivery. The estimated $3.5B bundled CapEx includes servers, storage, networking, labor and ancillary items. All three company detail pages show the ordered-unit bound and the estimate with the issuer source. Actual delivered units by quarter and GPU-only acquisition cost remain unknown. The order therefore does not populate opening GPU cohorts, create incremental purchasing cash flows or establish collateral value.

The November update confirms Horizon 1 went into service for Microsoft but does not identify GPU quantities or cost for each accepted tranche. Management's $15B remaining FY27 CapEx plan pairs $9B of cash, restricted cash, conditional committed financing and unpaid contractual prepayments with $6B of targeted future funding. Because the $9B includes opening balances and other existing sources, the total cannot enter as new cash. The $6B remains a financing target. The separate post-quarter contract disclosed as covering 90% of estimated GPU CapEx with prepayments lacks an attributable dollar amount and collection schedule. [IREN March procurement announcement](https://iren.com/resources/news/iren-expands-ai-cloud-capacity-to-150000-gpus), [November issuer results](https://www.sec.gov/Archives/edgar/data/1878848/000187884826000065/irenreportsq1-fy27result.htm).
