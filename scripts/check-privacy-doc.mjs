// Fails if the contract exposes a public fact that docs/privacy-model.md does not document.
// Every `export ledger` field and every `export circuit` must appear (in backticks) in the doc,
// so a new public field or entry point cannot ship without a disclosure row.
import { readFileSync } from 'node:fs';

const source = readFileSync('contracts/src/eclipse.compact', 'utf8');
const doc = readFileSync('docs/privacy-model.md', 'utf8');

const fields = [...source.matchAll(/^export ledger (\w+)/gm)].map((m) => m[1]);
const circuits = [...source.matchAll(/^export circuit (\w+)/gm)].map((m) => m[1]);

const missing = [...fields, ...circuits].filter((name) => !doc.includes(`\`${name}`));

if (missing.length > 0) {
  console.error(`docs/privacy-model.md does not document: ${missing.join(', ')}`);
  process.exit(1);
}
console.log(
  `privacy-model.md documents all ${fields.length} ledger fields and ${circuits.length} circuits`,
);
