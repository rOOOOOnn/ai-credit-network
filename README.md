# AI Credit Network & Financial Contagion Simulator

## 1. 项目概览
本项目为全球 AI 产业链融资网络、债务结构与信用风险传染模拟器，严格执行 Phase 1.5 实证数据底稿与防重复计算规则：
- **44 个核心节点**（含 38 家核心公司与项目 SPV + 外围 `External Capital Market / Private Credit Ocean`）。
- **57 笔已核实有向交易**，严格区分 Equity、Direct Loan / RCF、GPU-Backed Financing、Project Finance、Corporate Bond/ABS、Cloud Computing Purchase、Take-or-Pay、Data Center Lease、Loan Guarantee，双向资金流拆分为独立有向边，每笔交易均附原始披露链接与 A/B/C 置信度。

## 2. 快速启动
- **浏览器启动**：用现代浏览器打开 `index.html` 或 `index_zh.html` 使用中文版，打开 `index_en.html` 使用英文版。无需安装项目依赖。页面通过 CDN 加载 D3.js、Chart.js、Tailwind CSS 和字体，完整功能需要联网。
- **本地运行 16 项自动化测试**：安装 Node.js 后，在项目根目录运行以下命令。
  ```bash
  node tests/run_16_tests.cjs
  ```

## 3. 目录结构
- `index.html`、`index_zh.html`、`index_en.html`：交互式网站的默认入口、中文入口和英文入口（D3.js v7 + Chart.js v4 + Tailwind CSS + 内嵌引擎与数据）。
- `data/entities.json` & `data/entities.csv`：44 个主体基础信息与 2022Q1–2026Q3 财报/披露状态。
- `data/transactions.json` & `data/transactions.csv`：57 笔有向融资与合同交易总账及原始链接。
- `data/schema.json`：数据版本与防重复计算审计规范。
- `engine/contagion_engine.js`：Mode A/B 现金流预测、Private Credit Ocean 约束、三级爆雷判定与多跳传染引擎。
- `tests/run_16_tests.cjs` & `tests/test_results.md`：16 项自动化测试脚本与本地生成的执行报告。

## 4. 持续数据更新与 Bloomberg 导入
点击网站顶部「导入/更新数据」按钮，可直接上传或粘贴 CSV / Excel(TSV) / JSON 数据，用于补充 Bloomberg `FA`/`DDIS`/`DLEN`/`LSRC` 字段、替换 `Unknown` 贷款人、更新季度付款计划或将 `Estimated` 升级为 `Actual`。系统自动递增版本号并支持一键回滚。
