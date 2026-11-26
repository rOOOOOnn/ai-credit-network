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
| Remediated | OPENAI | Manual | -12.9594 | 22.9594 | 0 | 2028Q2 | — |
| Continuation | OPENAI | Curve | -15.5178 | 25.5178 | 0 | 2028Q3 | — |
| Remediated | OPENAI | Curve | -12.9267 | 22.9267 | 0 | 2028Q3 | — |
| Continuation | OPENAI | Freeze | -46.1816 | 56.1816 | 0 | 2027Q4 | — |
| Remediated | OPENAI | Freeze | -47.4052 | 57.4052 | 0 | 2027Q4 | — |
| Continuation | ANTHROPIC | Manual | 201.8728 | 0 | — | — | 2026Q4 |
| Remediated | ANTHROPIC | Manual | 271.5204 | 0 | — | — | 2026Q4 |
| Continuation | ANTHROPIC | Curve | 201.8728 | 0 | — | — | 2026Q4 |
| Remediated | ANTHROPIC | Curve | 271.5204 | 0 | — | — | 2026Q4 |
| Continuation | ANTHROPIC | Freeze | 171.8728 | 0 | — | — | 2026Q4 |
| Remediated | ANTHROPIC | Freeze | 241.5204 | 0 | — | — | 2026Q4 |
| Continuation | CRWV | Manual | -1.2404 | 3.2404 | 0 | 2028Q4 | — |
| Remediated | CRWV | Manual | 3.9958 | 0 | 2.32 | — | — |
| Continuation | CRWV | Curve | -1.1763 | 3.1763 | 0 | 2028Q4 | — |
| Remediated | CRWV | Curve | 3.9958 | 0 | 2.32 | — | — |
| Continuation | CRWV | Freeze | -31.6668 | 33.6668 | 0 | 2027Q1 | — |
| Remediated | CRWV | Freeze | -25.8925 | 27.8925 | 0 | 2027Q1 | — |

OpenAI's manual and curve cash improve while their first default quarters stay in 2028Q2 and 2028Q3. In scenario freeze, cash worsens by $1.235B and first default stays in 2027Q4. These are whole-profile differences that include changes to counterparties and contagion. Anthropic's higher opening cash and the revised estimated financing proceeds increase its liquidity in all three paths. Scenario freeze still lets the separately modeled closing proceeds enter. CoreWeave's manual and curve no longer trigger default through 2028, while freeze still triggers in 2027Q1. Its opening cash-flow and facility corrections change financial capacity and network outcomes. None of the CoreWeave or OpenAI paths reaches modeled FCF break-even. These comparisons do not isolate individual changes or establish underlying private-company forecast inputs.

### GPU scenario horizon

A 2027Q1 purchase with a seven-year economic life previously disappeared from the refresh sensitivity because the browser forecast ended at 2033Q4. The browser now extends the timeline and annual table through the first eligible refresh for each positive scenario GPU cohort or purchase, subject to the existing 2040 simulation ceiling. A $2B GPU purchase with 50% replacement and 25% residual produces no refresh capital spending at 2033Q4, then $1B of purchases and $0.25B of disposal proceeds in 2034Q1. The operating profile and fiscal disclosures remain unchanged. The regression checks these amounts and the browser test verifies the 2034 annual row on all three pages.

GPU scenario output now displays the end-of-quarter cohort age weighted by purchase cost, sale proceeds, net refresh cash outflow, and FCF. The age is a scenario measure and is unavailable without a modeled fleet. When a three-year-old $2B cohort replaces half its cost with new equipment priced at par, the cost-weighted closing age is 1.5 years. The $1B replacement purchase less $0.25B proceeds gives $0.75B net refresh outflow. FCF retains its OCF-minus-CapEx definition and the proceeds are separately added as investing cash. Gross replacement CapEx remains visible.

### Full-engine 3–7 year GPU sensitivity

Run `node scripts/replay_audit4_gpu.cjs`. Each case assigns the selected company a hypothetical $10B GPU cohort acquired in 2026Q4. Reference cases change only economic life and use 25% quarterly replacement, a 20% resale residual and 10% lower replacement prices. Combined stress uses a four-year life, 5% residual and 30% lower prices, halves the selected company's reference revenue-growth input, adds 200 basis points to its interest rate and freezes its scenario financing. Contracted financing and other companies keep their audit profile. This is a normalized stress input, not a reconstruction of any company's GPU inventory. Cash and funding gap are in USD billions.

| Entity | Life | Profile | First refresh | 2030Q4 cash | 2030Q4 gap | 2032Q4 cash | 2032Q4 gap | First default |
| --- | ---: | --- | --- | ---: | ---: | ---: | ---: | --- |
| CRWV | 3 | Reference | 2029Q4 | -22.3586 | 24.3586 | -47.658 | 49.658 | 2029Q2 |
| CRWV | 4 | Reference | 2030Q4 | -16.4593 | 18.4593 | -42.3388 | 44.3388 | 2029Q4 |
| CRWV | 5 | Reference | 2031Q4 | -8.5108 | 10.5108 | -41.2249 | 43.2249 | 2030Q1 |
| CRWV | 6 | Reference | 2032Q4 | -2.3389 | 4.3389 | -35.1146 | 37.1146 | 2030Q4 |
| CRWV | 7 | Reference | 2033Q4 | 1.4033 | 0.5967 | -28.3399 | 30.3399 | 2031Q1 |
| CRWV | 4 | Combined stress | 2030Q4 | -83.0796 | 85.0796 | -137.2816 | 139.2816 | 2027Q1 |
| OPENAI | 3 | Reference | 2029Q4 | 48.3621 | 0 | 28.3766 | 0 | — |
| OPENAI | 4 | Reference | 2030Q4 | 51.9509 | 0 | 29.1296 | 0 | — |
| OPENAI | 5 | Reference | 2031Q4 | 53.7009 | 0 | 30.2651 | 0 | — |
| OPENAI | 6 | Reference | 2032Q4 | 53.7009 | 0 | 33.8539 | 0 | — |
| OPENAI | 7 | Reference | 2033Q4 | 53.7009 | 0 | 35.6039 | 0 | — |
| OPENAI | 4 | Combined stress | 2030Q4 | -169.7551 | 179.7551 | -297.5116 | 307.5116 | 2027Q3 |
| ANTHROPIC | 3 | Reference | 2029Q4 | 235.0445 | 0 | 197.6702 | 0 | — |
| ANTHROPIC | 4 | Reference | 2030Q4 | 238.6333 | 0 | 198.4232 | 0 | — |
| ANTHROPIC | 5 | Reference | 2031Q4 | 240.3833 | 0 | 199.5587 | 0 | — |
| ANTHROPIC | 6 | Reference | 2032Q4 | 240.3833 | 0 | 203.1475 | 0 | — |
| ANTHROPIC | 7 | Reference | 2033Q4 | 240.3833 | 0 | 204.8975 | 0 | — |
| ANTHROPIC | 4 | Combined stress | 2030Q4 | 210.5159 | 0 | 165.0847 | 0 | — |
| ORCL | 3 | Reference | 2029Q4 | 18.939 | 0 | 29.3583 | 0 | — |
| ORCL | 4 | Reference | 2030Q4 | 22.5278 | 0 | 30.1113 | 0 | — |
| ORCL | 5 | Reference | 2031Q4 | 24.2778 | 0 | 31.2468 | 0 | — |
| ORCL | 6 | Reference | 2032Q4 | 24.2778 | 0 | 34.8356 | 0 | — |
| ORCL | 7 | Reference | 2033Q4 | 24.2778 | 0 | 36.5856 | 0 | — |
| ORCL | 4 | Combined stress | 2030Q4 | -160.051 | 170.051 | -295.9463 | 305.9463 | 2027Q3 |

At the first eligible quarter, the reference scenario allocates $2.25B to replacement CapEx and $0.50B to resale proceeds, for a $1.75B investing cash outflow. Shortening life from six to four years advances this first outflow from 2032Q4 to 2030Q4. At 2030Q4 it reduces CoreWeave modeled cash by $14.1204B and increases the funding gap by the same amount. That full-model difference includes collateral and refinancing effects that can precede replacement. In the other three profiles the same 2030Q4 cash difference is $1.75B and no reference funding gap opens. The combined stress has multiple simultaneous changes. It does not isolate the effects of lower replacement prices, residual values or financing.

The end-to-end regression independently fixes a solvent zero-debt fixture and tests every economic life from three to seven years. Its $100B fleet produces $22.5B gross CapEx and $5B resale proceeds in each first eligible quarter, reducing FCF by $22.5B and cash by $17.5B against the no-refresh path. The accounting life remains fixed across all cases.

### Physical retirement scenario

An explicit physical limit now retires the remaining cohort in that quarter. The scenario assumes full replacement of the retired capacity at the configured replacement price. Economic refresh can still replace a portion earlier. Accounting life has no cash trigger. At physical retirement collateral uses the configurable retirement residual, zero by default. In the independent test, a $20B cohort with four-year physical and six-year economic life retires in 2030Q4. With a 10% price decline and 5% retirement residual, replacement spending is $18B, proceeds and opening collateral are $1B each, and FCF and cash fall $18B and $17B respectively against the no-refresh path.

### GPU collateral and lender recovery

A scenario cohort can explicitly pledge its modeled value to a single GPU-backed or equipment financing transaction through `pledgedTo`. At default, only remaining pledged equipment contributes to recovery, capped at funded principal, with the existing loss rate applied to residual EAD. Sold units are absent from the closing fleet and replacement units start without a lien. Unallocated company fleet value does not establish a lender's security. The independent TX27 scenario has $10B funded EAD, $2.4B modeled pledged recovery and 45% residual LGD. This gives one credit event with a $3.42B loss and $6.58B expected total recovery. The additional $50B unpledged fleet in the test contributes nothing to that lender's recovery. No real fleet-to-lien allocation is inferred.

### Financing horizon and browser checks

Manual amounts entered in 2033 previously appeared editable while the engine discarded them at the default six-year curve cutoff. Manual amounts now follow their explicit years and the same remaining and quarterly caps. The full-engine regression independently verifies four $1B payments in 2033 and a $4B cash increase with no remaining capacity. The browser test enters the late-year amount on each page, then switches to a curve and verifies that editing its equity base changes modeled funding. Curve horizons can extend the browser timeline within the engine's 2040 ceiling.

### Source-specific historical financing trends

Historical mode now uses each source's last two complete, consecutive annual Actual observations. Latest equity observations no longer displace an older, independently complete debt pair. The page shows the years and actual amounts used for each source and explicitly lists sources that lack usable records. Gaps within the latest pair, a zero starting denominator, partial years and estimates remain unavailable. Any gap after the last observation is part of the extrapolation, and projected amounts remain assumptions subject to funding caps. The browser fixture supplies synthetic historical records and checks disclosure and modeled cash funding. Company-level source coverage remains governed by the source register.

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
| A | OpenAI | -64.0448 | -13.2799 | 74.0448 | 2027Q4 |
| B | Anthropic | 104.8591 | -0.8568 | 0 | — |
| C | CoreWeave | -35.5456 | -3.2985 | 37.5456 | 2027Q1 |
| D | Oracle | -74.4788 | -20.0705 | 84.4788 | 2027Q4 |
| E | CoreWeave | -34.1842 | -3.3845 | 36.1842 | 2027Q1 |
| F | CoreWeave | -43.9584 | -4.9001 | 45.9584 | 2027Q1 |
| G | CoreWeave | -60.1254 | -5.7019 | 62.1254 | 2026Q4 |

Values are scenario results in USD billions. The cash identity includes loan and lease principal, collateral-related margin, equipment sale proceeds, investment sales and explicit unallocated guarantee payments.

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
| OPENAI | Base | -4.9107 | -6.87 | -8.37 | 8.37 | 0.5376 | 0 | 0 | 14.9107 | 14.9107 | 1.2562 | 2028Q3 | — |
| OPENAI | Revenue slowdown | -21.2172 | -10.408 | -11.908 | 11.908 | 0.3779 | 0 | 0 | 31.2172 | 31.2172 | 3.1142 | 2028Q2 | — |
| OPENAI | Funding taper (downside) | -30.9871 | -6.551 | -8.051 | 8.051 | 0.1863 | 0 | 0 | 40.9871 | 40.9871 | 1.2778 | 2027Q4 | — |
| OPENAI | Funding freeze | -47.4452 | -6.5821 | -8.0821 | 8.0821 | 0 | 0 | 0 | 57.4452 | 57.4452 | 1.2824 | 2027Q4 | — |
| OPENAI | Combined severe stress | -61.6883 | -11.1582 | -12.6582 | 12.6582 | 0 | 0 | 0 | 71.6883 | 71.6883 | 3.2266 | 2027Q3 | — |
| ANTHROPIC | Base | 279.5204 | 3.143 | 2.743 | 0 | — | 294.5204 | — | 0 | 0 | -0.3666 | — | 2026Q4 |
| ANTHROPIC | Revenue slowdown | 268.1146 | 0.9111 | 0.5111 | 0 | — | 283.1146 | — | 0 | 0 | -0.1606 | — | 2026Q4 |
| ANTHROPIC | Funding taper (downside) | 259.4114 | 3.1311 | 2.7311 | 0 | — | 274.4114 | — | 0 | 0 | -0.3651 | — | 2026Q4 |
| ANTHROPIC | Funding freeze | 241.303 | 3.1192 | 2.7192 | 0 | — | 256.303 | — | 0 | 0 | -0.3635 | — | 2026Q4 |
| ANTHROPIC | Combined severe stress | 229.8803 | 0.883 | 0.483 | 0 | — | 244.8803 | — | 0 | 0 | -0.1565 | — | 2026Q4 |

In the OpenAI paths, the modeled funding gap grows from $14.9107B in Base to $40.9871B under the Downside taper and $71.6883B under Combined severe stress. First model default advances from 2028Q3 to 2027Q3 between Base and Combined severe stress. Anthropic's strong opening liquidity and separate IPO proceeds estimate support positive ending cash in all five paths. Under Combined severe stress its quarterly FCF is $0.483B, versus $2.743B in Base. That result depends on the opening cash and operating assumptions. The separate no-proceeds sensitivity remains in the report. Minimum revenue growth is a local break-even calculation at existing costs and margins, not an annual growth forecast.

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
| P1. Four-layer network | The A–G stress regression verifies audited cash, principal, FCF and funding gap for every eligible borrower-quarter. L4 applies only known peer relationships and charges modeled floating-rate exposure. | A common evidence table for all specified bilateral pathways is still needed. L4 correlation and spread magnitudes remain scenario calibration. |
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
| TX26 standalone carrying amount arithmetic range | 4.583 principal less zero to 0.080 in combined non-recourse unamortized costs | 4.503 to 4.583 |

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
