import { buildScaffold } from '../src/scaffold/index.js';
import { depsPlanFromFiles, treeFingerprint, treeManifest } from '../src/scaffold/deps.js';
import { BAKED_TARGETS } from '../src/scaffold/deps.js';

for (const target of BAKED_TARGETS) {
  const scaffold = buildScaffold({ target });
  const plan = depsPlanFromFiles(target, scaffold.files);
  console.log(`\n=== ${target} === fingerprint=${plan.fingerprint}`);
  for (const tree of plan.trees) {
    const deps = Object.keys(tree.dependencies).length + Object.keys(tree.devDependencies).length;
    console.log(`  ${tree.id.padEnd(10)} dir=${tree.dir || '.'} mount=${tree.mountPoint} deps=${deps} fp=${treeFingerprint(tree)}`);
  }
  console.log('  scaffold.deps =', JSON.stringify(scaffold.deps.trees.map(t => t.id)));
}
