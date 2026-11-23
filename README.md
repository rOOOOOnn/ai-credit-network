# AI Credit Network & Financial Contagion Simulator

[简体中文 ↓](#chinese)

An interactive credit-risk simulator for the AI industry. Explore how financing and contractual payments connect companies, special-purpose vehicles (SPVs), and external funding pools, then stress-test how liquidity shocks propagate through their counterparties.

**v7 data snapshot** · 44 network nodes · 57 directed transactions · November 24, 2026

## Quick start

Clone or download the repository and open the [English interface](index_en.html) or the [Chinese interface](index_zh.html) in a modern browser. The default [entry page](index.html) is also in Chinese.

The pages embed the dataset and simulation engine. No installation or local server is required. An internet connection is needed to load D3.js, Chart.js, Tailwind CSS, and fonts from CDNs.

## Try a stress scenario

1. Select a forecast quarter and click a company to inspect its counterparties, cash, debt, and free cash flow.
2. Lower its quarterly revenue growth or increase its interest rate or capital spending. Watch how its cash balance and fragility score respond.
3. Adjust external funding capacity to see how financing shortfalls and counterparty losses change. Export CSV or JSON to compare scenarios.

## Data and model

- **Directed transactions.** Edges run from payer to recipient. Reciprocal flows are recorded separately, and commitments and actual drawdowns have distinct fields. The ledger provides source links and A/B/C confidence grades.
- **Quarterly timeline.** The historical window runs from Q1 2022 through Q3 2026. Q4 2026 has partial coverage, and the forecast runs from Q1 2027 through Q4 2028. Historical coverage varies by entity and quarter.
- **Cash flow forecasts.** Mode A provides a revenue benchmark for covering cash obligations alongside a baseline growth projection. Mode B projects revenue from the prior quarter. The engine calculates quarterly cash, free cash flow, debt, and liquidity stress.
- **Funding and contagion.** The Private Credit Ocean represents unidentified funding providers and constrains available financing. Stress scenarios track lost receipts and credit losses across counterparties.
- **Data updates.** Import CSV, TSV, or JSON through the interface, roll back an import using version history, or export the current snapshot.

Forecasts depend on data coverage, funding assumptions, and model rules. Fragility scores compare scenarios and do not estimate real-world default probabilities.

## Repository and tests

| Path | Contents |
| --- | --- |
| [data/](data/) | Entity and transaction data in CSV and JSON. [schema.json](data/schema.json) documents the data version, quarter ranges, and rules for avoiding double counting. |
| [engine/contagion_engine.js](engine/contagion_engine.js) | Quarterly cash flows, funding constraints, fragility scoring, and contagion calculations |
| [tests/run_16_tests.cjs](tests/run_16_tests.cjs) | 16 regression checks covering historical data visibility, duplicate financing, cash-flow direction, and default propagation |

With Node.js installed, run this command from the repository root. The test report is generated locally at `tests/test_results.md`.

```bash
node tests/run_16_tests.cjs
```

---

<a name="chinese"></a>
## 简体中文

[English ↑](#ai-credit-network--financial-contagion-simulator)

一个用来探索 AI 产业链信用风险的交互式模拟器。它将公司、项目融资载体（SPV）和外部资金池放在同一张有向网络图上，展示融资及合同付款关系，并模拟流动性冲击如何沿交易对手传导。

**v7 数据快照** · 44 个网络节点 · 57 笔有向交易记录 · 数据版本日期 2026-11-24

### 快速启动

克隆或下载仓库后，用现代浏览器打开对应文件。

| 语言 | 入口 |
| --- | --- |
| 中文 | [index.html](index.html) 或 [index_zh.html](index_zh.html) |
| English | [index_en.html](index_en.html) |

页面内嵌数据与模拟引擎，无需安装项目依赖或启动本地服务器。D3.js、Chart.js、Tailwind CSS 和字体通过 CDN 加载，完整功能需要联网。

### 试一个压力情景

1. 将时间轴切换到预测季度，点击一个公司节点，查看其交易对手、现金、债务和自由现金流。
2. 在公司面板调低季度营收增速，或提高利息、资本支出等假设，观察现金余额与脆弱性评分如何变化。
3. 调整外部融资容量，观察模型中的融资缺口和交易对手损失。可导出 CSV 或 JSON，用于比较情景结果。

### 数据与模型

- **交易方向** · 每条边从付款方指向收款方。双向交易分别记录，合同承诺与实际提款分字段保存。台账提供来源链接和 A/B/C 置信度。
- **时间轴** · 2022Q1–2026Q3 为历史区间，2026Q4 为部分披露区间，2027Q1–2028Q4 为预测区间。历史数据的可用性因主体和季度而异。
- **现金流预测** · Mode A 提供覆盖现金义务所需的营收基准，同时按基线增长假设预测营收。Mode B 使用基于上一季度营收的增长路径。引擎按季度计算现金、自由现金流、债务余额和流动性压力。
- **融资约束与传染** · 模型用 Private Credit Ocean 归集未识别的资金提供方并限制可用融资。在压力情景下，模型追踪应收损失与信用损失如何传至交易对手。
- **数据更新** · 页面支持导入 CSV、TSV 或 JSON，查看导入版本历史并回滚，也可以导出当前快照。

预测结果取决于数据覆盖、融资假设和模型规则。脆弱性评分用于比较模型情景，不能作为实际违约概率。

### 项目结构与测试

| 路径 | 内容 |
| --- | --- |
| [data/](data/) | 主体和交易的 CSV、JSON 数据，[schema.json](data/schema.json) 记录版本、季度范围及防重复计算规则 |
| [engine/contagion_engine.js](engine/contagion_engine.js) | 季度现金流、融资约束、脆弱性评分与传染计算 |
| [tests/run_16_tests.cjs](tests/run_16_tests.cjs) | 回归测试，覆盖历史数据可见性、交易去重、资金流方向和违约传导 |

安装 Node.js 后，在项目根目录运行下面的命令。测试报告会生成在本地的 `tests/test_results.md`。

```bash
node tests/run_16_tests.cjs
```
