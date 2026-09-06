import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

// Use the parser already shipped with Next, without adding a second CSS toolchain.
const require = createRequire(import.meta.url);
const nextRequire = createRequire(require.resolve('next/package.json'));
const postcss = nextRequire('postcss');
const source = readFileSync(new URL('../src/app/globals.css', import.meta.url), 'utf8');
let css;
try {
  css = postcss.parse(source);
} catch (error) {
  console.error(`Platform CSS: ${error.reason} at ${error.line}:${error.column}`);
  process.exit(1);
}
const structuralSelectors = [
  '.accessGate', '.platformPageSignal', '.platformPageHeroGrid',
  '.creatorRequirements', '.workspaceRibbon', '.originalGrid',
];

for (const selector of structuralSelectors) {
  let unconditional = false;
  css.walkRules(rule => {
    if (!rule.selectors.includes(selector)) return;
    let motionConditional = false;
    let conditional = false;
    for (let parent = rule.parent; parent; parent = parent.parent) {
      if (parent.type !== 'atrule') continue;
      conditional = true;
      if (/prefers-reduced-motion/.test(parent.params ?? '')) motionConditional = true;
    }
    assert(!motionConditional, `${selector}: layout must not depend on motion preference`);
    if (!conditional) unconditional = true;
  });
  assert(unconditional, `${selector}: needs a shared, unconditional layout rule`);
}

// A common source of the original defect was an accidentally nested media block.
css.walkAtRules('media', rule => {
  for (let parent = rule.parent; parent; parent = parent.parent) {
    assert(!(parent.type === 'atrule' && /prefers-reduced-motion/.test(parent.params ?? '')),
      'Responsive breakpoints must not be nested inside reduced-motion overrides');
  }
});

console.log('Platform CSS parsed; shared layouts are independent of motion preference.');
