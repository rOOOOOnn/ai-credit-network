# AI Credit Network & Financial Contagion Simulator

[简体中文](#chinese)

An interactive simulator for exploring how financing obligations and liquidity shocks propagate across the AI infrastructure supply chain. The v3.0 release includes the second-round audit remediation and a dataset with **50 entities and 82 directed transaction records**.

## Quick start

Download or clone the repository and open [index_en.html](index_en.html) for English or [index_zh.html](index_zh.html) for Chinese. The [default entry](index.html) also opens the simulator. The pages embed the data and engine. A modern browser and internet access for CDN assets are sufficient.

## Try a stress scenario

Select a forecast quarter and a company, then change its growth or financing assumptions. Compare its cash, debt and free cash flow before and after the change, and trace how the shock affects counterparties and upstream hardware suppliers.

## Data and model

- The [transaction ledger](data/transactions.json) records payer-to-recipient relationships, with source links and confidence grades. The [schema](data/schema.json) documents the time periods and rules for avoiding double counting.
- The four upstream channels model order cuts, receivable write-offs, cloud capex contraction and financing support effects such as guarantees and equity impairment.
- The [simulation engine](engine/contagion_engine.js) models revolving credit draws, financing constraints, debt maturities and GPU collateral haircuts. It also avoids charging the same write-off across quarters beyond the underlying principal.
- Forecasts depend on data coverage and scenario assumptions. Fragility scores are comparative scenario outputs.

The standalone HTML files embed the dataset. Changes to files in [data/](data/) must also be reflected in the HTML snapshots to appear in the browser.

## Run the tests

With Node.js installed, run both suites from the repository root. They cover 16 standard checks and 12 audit regressions.

```bash
node tests/run_16_tests.cjs
node tests/audit_regression.cjs
```

---

<a name="chinese"></a>

## 简体中文

[返回英文](#ai-credit-network--financial-contagion-simulator)

这是一个交互式信用风险模拟器，用来探索 AI 基础设施产业链中的融资义务，以及流动性冲击如何沿交易对手传导。v3.0 版采用二轮审计修订数据，包含 **50 个主体和 82 笔有向交易记录**。

### 快速启动

下载或克隆仓库后，打开 [中文版](index_zh.html) 或 [英文版](index_en.html)，也可以使用 [默认入口](index.html)。页面内嵌数据和引擎，使用现代浏览器即可运行，加载 CDN 资源需要联网。

### 试一个压力情景

选中一个预测季度和一家公司，调整其营收增速或融资假设。对比调整前后的现金、债务和自由现金流，并追踪冲击如何传至交易对手和上游硬件供应商。

### 数据与模型

- [交易台账](data/transactions.json) 按付款方到收款方记录关系，并附来源链接和置信度。[数据结构说明](data/schema.json) 记录时间区间和防重复计算规则。
- 四条上游传染渠道涵盖订单削减、应收账款核销、云厂商资本支出收缩，以及担保和股权减值等融资支持相关影响。
- [模拟引擎](engine/contagion_engine.js) 处理循环信贷提款、融资约束、债务到期和 GPU 抵押品折价，并限制同一笔核销的跨季度累计损失。
- 预测取决于数据覆盖与情景假设。脆弱性评分用于比较模拟情景。

HTML 页面内嵌数据。[data/](data/) 中的数据变更需要同步到 HTML 快照，才能在浏览器中生效。

### 运行测试

安装 Node.js 后，在仓库根目录运行以下两套测试，分别覆盖 16 项常规检查和 12 项审计回归检查。

```bash
node tests/run_16_tests.cjs
node tests/audit_regression.cjs
```
