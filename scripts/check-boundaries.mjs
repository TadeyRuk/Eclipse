#!/usr/bin/env node
/**
 * Static import-boundary checker for Eclipse.
 * Walks TypeScript sources and enforces package / feature / shared boundaries.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const errors = [];

const importPattern =
  /(?:import|export)\s+(?:type\s+)?(?:[\s\S]*?\s+from\s+)?['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

function walk(dir, acc = []) {
  if (!existsSync(dir)) return acc;
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === 'dist' || entry === 'coverage') continue;
    const full = path.join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, acc);
    else if (/\.(ts|tsx|mts|cts)$/.test(entry) && !entry.endsWith('.d.ts')) acc.push(full);
  }
  return acc;
}

function rel(file) {
  return path.relative(root, file).split(path.sep).join('/');
}

function resolveLocal(fromFile, specifier) {
  if (!specifier.startsWith('.')) return null;
  const base = path.resolve(path.dirname(fromFile), specifier);
  for (const candidate of [
    `${base}.ts`,
    `${base}.tsx`,
    path.join(base, 'index.ts'),
    path.join(base, 'index.tsx'),
  ]) {
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

function featureNameOf(fileRel) {
  const m = fileRel.match(/^apps\/web\/src\/features\/([^/]+)\//);
  return m ? m[1] : null;
}

function isFeatureRoot(resolvedRel) {
  return /\/features\/[^/]+\/index\.(ts|tsx)$/.test(resolvedRel);
}

function collectImports(file) {
  const source = readFileSync(file, 'utf8');
  const specs = [];
  for (const match of source.matchAll(importPattern)) {
    const spec = match[1] ?? match[2];
    if (spec) specs.push(spec);
  }
  return specs;
}

function fail(file, message) {
  errors.push(`${rel(file)}: ${message}`);
}

const FORBIDDEN_SDK_CONCRETE = [
  'LaceAdapter',
  'MidnightAdapter',
  'MidnightJsTransport',
  'ProofClient',
  'ReceiptStore',
  'witnessHelpers',
];

// Check packages
for (const file of walk(path.join(root, 'packages'))) {
  const fileRel = rel(file);
  if (fileRel.includes('/tests/') || fileRel.includes('/__tests__/')) continue;

  for (const spec of collectImports(file)) {
    if (spec.includes('apps/web') || spec.startsWith('../../apps/web')) {
      fail(file, `packages must not import web code (${spec})`);
    }
  }
}

// Check web app
const webSrc = path.join(root, 'apps/web/src');
for (const file of walk(webSrc)) {
  const fileRel = rel(file);
  const isTest =
    fileRel.includes('.test.') ||
    fileRel.includes('/test/') ||
    fileRel.includes('/__tests__/');

  const fromFeature = featureNameOf(fileRel);

  for (const spec of collectImports(file)) {
    const resolved = resolveLocal(file, spec);
    const targetRel = resolved ? rel(resolved) : null;
    const targetFeature = targetRel ? featureNameOf(targetRel) : null;

    // Rule: shared/ must never import app/ or features/
    if (fileRel.startsWith('apps/web/src/shared/') && targetRel) {
      if (
        targetRel.startsWith('apps/web/src/features/') ||
        targetRel.startsWith('apps/web/src/app/')
      ) {
        fail(file, `shared must not import app or features (${spec})`);
      }
    }

    // Rule: features must import sibling features only through public roots
    if (fromFeature && targetFeature && fromFeature !== targetFeature) {
      if (!isFeatureRoot(targetRel)) {
        fail(file, `feature internals are private (${spec})`);
      }
    }

    // Rule: app must import features through public roots
    if (fileRel.startsWith('apps/web/src/app/') && targetFeature) {
      if (!isFeatureRoot(targetRel)) {
        fail(file, `app must import features through public roots (${spec})`);
      }
    }

    // Production-only rules
    if (!isTest) {
      // Forbidden concrete SDK classes / internals
      for (const forbidden of FORBIDDEN_SDK_CONCRETE) {
        if (spec.includes(forbidden)) {
          fail(file, `web production code must not import SDK adapter internals (${spec})`);
        }
      }

      // Generated contract module is loaded only by composition.ts
      if (
        (spec.includes('contracts/managed/eclipse') ||
          (targetRel && targetRel.includes('contracts/managed/eclipse'))) &&
        fileRel !== 'apps/web/src/app/composition.ts'
      ) {
        fail(file, `generated contract code may only be imported by app/composition.ts (${spec})`);
      }
    }
  }
}

if (errors.length) {
  console.error('Boundary check failed:');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log('Boundary check passed.');
