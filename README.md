# AI Credit Network

[简体中文](#chinese)

An institutional research model and interactive network platform mapping capital flows, financing structures, operational dependencies, and 4-layer credit contagion across the global AI infrastructure value chain (**50 entities**, **82 directed transaction records**).

## Audit 4 research branch

Open [the default page](index.html), [English](index_en.html), or [简体中文](index_zh.html) in a modern browser. Each page embeds the model and data and uses CDN resources.

The company forecast panel supports source-by-source manual financing and linear, exponential, logistic, or historical curves. Financing eligibility and limits feed cash and debt. The audit JSON includes the loan ledger, GPU cohorts, lease and guarantee schedules, and the inputs needed to replay the simulation.

Audit 4 acceptance remains open for the data and verification gaps listed in the [audit report](docs/audit4_remediation_report.md) and [historical field coverage](docs/audit4_field_coverage.md).

## Model capabilities

- **Strict Point-in-Time (PIT) Backtesting (`P0-1`)**: `getHistoricalSnapshot()` enforces `period <= targetQuarter` and `disclosedDate <= quarterEndDate` on both exact and fallback lookups with deterministic chronological sorting.
- **Announced vs. Active Lifecycle Separation (`P0-2`)**: `getTransactionLifecycle()` and `isTransactionActive()` separate `announcedDate`, `startQ`, and `endQ`. Announced-but-not-yet-active deals (e.g., `TX03`, `TX11`, `TX67`, `TX68`, `TX69`) display as future commitments without generating premature cash or operational flows.
- **Basel-Style EAD / LGD / Expected Loss Accounting (`P0-3`)**: `computeTransactionEAD()` decomposes Funded EAD (`max(0, drawn - repaid)`), Undrawn CCF EAD (`undrawn * CCF`), and Guarantee EAD, strictly distinguishing `amountDrawn === 0` from `null` and recording one-time deduplicated `creditEvents`.
- **Complete 4-Layer Contagion Engine (`P0-4`, `P1-2`)**:
  - **L1 Direct Financial**: One-time debt LGD, active guarantee calls, AR bad-debt write-offs, and non-cash equity impairments.
  - **L2 Commercial**: Revenue loss, defensive crisis CapEx cuts, and deduplicated upstream hardware demand shocks.
  - **L3 Operational**: 7 service categories (Cloud Computing, Take-or-Pay, Data Center Lease, Power Purchase Agreement, GPU/Server Supply, Cooling/Electrical Infrastructure, Critical Infrastructure) with substitution availability, switching window decay, and recovery.
  - **L4 Secondary Market**: Peer credit spread widening for leveraged sector peers without double-counting L1–L3 losses.
- **Phased guarantee schedule**. TX11 uses the disclosed $105B aggregate cap and adjustable project assumptions for activation, rent, calls and settlement.
- **Parent and SPV debt reconciliation**. TX26 records $4.583B of outstanding principal within the $8.5B CoreWeave facility at 2026Q3. The consolidated debt reconciliation eliminates overlap with the SPV. Facility-specific cumulative draws and availability remain unverified.
- **Three Browser Entry Points**: `index.html` (bilingual), `index_zh.html` (pure Chinese), and `index_en.html` (100% pure English, 0 Chinese characters).

## Repository Structure

```text
.
├── .github/workflows/ci.yml              # Cross-platform CI (Ubuntu, Windows, macOS)
├── data/
│   ├── entities.json / entities.csv      # 50 entities with verified SEC/official financials
│   ├── transactions.json / .csv          # 82 directed transactions with source URLs
│   └── schema.json                       # Schema metadata & anti-double-counting rules
├── docs/
│   ├── entity_data_coverage_matrix.md    # 50-entity x 19-quarter coverage matrix
│   └── v3_audit_remediation_report.md    # Full Audit 3.0 reproduction & remediation report
├── engine/
│   └── contagion_engine.js               # UMD Cash Flow & 4-Layer Contagion Engine
├── scripts/
│   ├── remediate_v3_data.py              # Reproducible v3.0 data remediation pipeline
│   └── sync_frontend_and_docs.py         # Frontend bundle & coverage matrix generator
├── tests/
│   ├── validate_schema_and_data.cjs      # JSON schema, CSV sync & referential integrity
│   ├── run_16_tests.cjs                  # 16 standard functional tests
│   ├── audit_regression.cjs              # 12 Audit 2.0/3.0 regression invariants
│   └── v3_independent_audit_tests.cjs    # 20 independent hand-calculated audit tests (T01-T20)
├── index.html                            # Bilingual interactive web app
├── index_zh.html                         # Pure Chinese interactive web app
└── index_en.html                         # Pure English interactive web app
```

## Running Tests Locally

```bash
node tests/validate_schema_and_data.cjs
node tests/run_16_tests.cjs
node tests/audit_regression.cjs
node tests/v3_independent_audit_tests.cjs
node tests/audit4_foundations.cjs
node tests/audit4_report.cjs
```

## Disclaimer

All forward projections and stress scenarios are illustrative structural simulations, not real-world default probability forecasts. Undisclosed private-company financials are explicitly marked `Unavailable` and excluded from synthetic default simulation.

---

<a name="chinese"></a>

## 简体中文

[返回英文](#ai-credit-network)

AI Credit Network 是一个交互式信用风险模拟器，覆盖 **50 个主体、82 笔有向交易**，用于分析 AI 基础设施产业链中的资金流、合同义务、运营依赖与信用风险传导。

### 快速启动

下载或克隆仓库后，用现代浏览器打开 [默认入口](index.html)、[中文版](index_zh.html) 或 [英文版](index_en.html)。页面内嵌数据与引擎，加载 CDN 资源需要联网。

### 第四轮审计整改

- 可以按公司、年份和来源手填融资，也可以用线性、指数、逻辑斯蒂或历史曲线预测。融资限额、租赁付款和 GPU 更新会进入现金流，下载的 JSON 可用于复算。
- TX26 截至 2026Q3 的未偿本金为 **45.83 亿美元**，总额度为 **85 亿美元**。累计提款和可提款额度仍待核实。TX11 的 **1,050 亿美元**是担保组合上限，逐项目分期可按情景调整。
- 第四轮审计尚未全部验收。已验证的功能和数据缺口见[第四轮审计报告](docs/audit4_remediation_report.md)和[历史字段覆盖矩阵](docs/audit4_field_coverage.md)。

- **历史数据与交易时点**。历史快照同时校验报告期和披露日。已公告但尚未生效的交易会显示为未来承诺，生效后才纳入相关现金流与运营影响。
- **信用敞口与担保**。区分已提款敞口、未提款承诺和担保敞口，按分期计划计入有效担保，并对信用损失事件去重。
- **四层传染**。分别模拟直接金融损失、商业收入冲击、运营服务中断和同行信用利差扩大。
- **母公司与 SPV 债务**。按追索权与合并口径核对余额，避免重复计入同一笔债务。

预测和压力测试用于比较假设情景。缺少披露的财务数据标为 `Unavailable`。详细规则及核对结果见[审计修订报告](docs/v3_audit_remediation_report.md)和[数据覆盖矩阵](docs/entity_data_coverage_matrix.md)。

### 运行测试

安装 Node.js 后，在项目根目录运行下面四项检查。仓库内的 GitHub Actions 工作流也使用这些命令。

```bash
node tests/validate_schema_and_data.cjs
node tests/run_16_tests.cjs
node tests/audit_regression.cjs
node tests/v3_independent_audit_tests.cjs
```
