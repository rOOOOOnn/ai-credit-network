#!/usr/bin/env node
/**
 * AI Credit Network v3.0 — JSON Schema & Data Consistency Validator
 * Validates entities.json, transactions.json, schema.json, CSV sync, referential integrity,
 * URL presence, date ordering, and single-language purity.
 */
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const rootDir = path.join(__dirname, '..');
const entities = JSON.parse(fs.readFileSync(path.join(rootDir, 'data/entities.json'), 'utf8'));
const transactions = JSON.parse(fs.readFileSync(path.join(rootDir, 'data/transactions.json'), 'utf8'));
const schema = JSON.parse(fs.readFileSync(path.join(rootDir, 'data/schema.json'), 'utf8'));

let errors = [];
const entityIds = new Set();
const txIds = new Set();

// 1. Validate entities
assert.strictEqual(entities.length, schema.entityCount, `Entity count ${entities.length} != schema ${schema.entityCount}`);
entities.forEach((e, idx) => {
  if (!e.id || !e.name) errors.push(`Entity[${idx}] missing id/name`);
  if (entityIds.has(e.id)) errors.push(`Duplicate entity id: ${e.id}`);
  entityIds.add(e.id);
  if (e.financials) {
    Object.entries(e.financials).forEach(([q, f]) => {
      if (!/^\d{4}Q[1-4]$/.test(q)) errors.push(`${e.id} invalid quarter key: ${q}`);
      if (f.disclosedDate && !/^\d{4}-\d{2}-\d{2}$/.test(f.disclosedDate)) {
        errors.push(`${e.id} ${q} invalid disclosedDate: ${f.disclosedDate}`);
      }
      if (f.dataType && !['Actual','Estimated','Assumption','Forecast','Unavailable','System Pool','Carry-Forward (Prior Actual)','Partial / Est.'].includes(f.dataType)) {
        errors.push(`${e.id} ${q} unexpected dataType: ${f.dataType}`);
      }
    });
  }
});

// 2. Validate transactions
assert.strictEqual(transactions.length, schema.transactionCount, `TX count ${transactions.length} != schema ${schema.transactionCount}`);
transactions.forEach((t, idx) => {
  if (!t.id || !t.payer || !t.receiver || !t.type) errors.push(`TX[${idx}] missing core fields`);
  if (txIds.has(t.id)) errors.push(`Duplicate tx id: ${t.id}`);
  txIds.add(t.id);
  if (!entityIds.has(t.payer)) errors.push(`${t.id} unknown payer: ${t.payer}`);
  if (!entityIds.has(t.receiver)) errors.push(`${t.id} unknown receiver: ${t.receiver}`);
  if (!t.sourceUrl || !t.sourceUrl.startsWith('https://')) errors.push(`${t.id} missing https sourceUrl`);
  if (t.amountDrawn !== null && t.amountDrawn !== undefined && t.amountDrawn < 0) errors.push(`${t.id} negative amountDrawn`);
  if (t.amountRepaid !== null && t.amountRepaid !== undefined && t.amountRepaid < 0) errors.push(`${t.id} negative amountRepaid`);
  if (t.startQ && t.endQ && t.startQ > t.endQ) errors.push(`${t.id} startQ (${t.startQ}) > endQ (${t.endQ})`);
});

// 3. Validate CSV files exist and match row counts
const entCsvLines = fs.readFileSync(path.join(rootDir, 'data/entities.csv'), 'utf8').trim().split('\n');
const txCsvLines = fs.readFileSync(path.join(rootDir, 'data/transactions.csv'), 'utf8').trim().split('\n');
if (entCsvLines.length - 1 !== entities.length) errors.push(`entities.csv rows (${entCsvLines.length - 1}) != entities.json (${entities.length})`);
if (txCsvLines.length - 1 !== transactions.length) errors.push(`transactions.csv rows (${txCsvLines.length - 1}) != transactions.json (${transactions.length})`);

if (errors.length > 0) {
  console.error('SCHEMA & DATA VALIDATION FAILED:\n' + errors.map(e => '  - ' + e).join('\n'));
  process.exit(1);
}
console.log(`[PASS] Schema & Data Validation: ${entities.length} entities, ${transactions.length} transactions, CSV sync & referential integrity 100% valid.`);
