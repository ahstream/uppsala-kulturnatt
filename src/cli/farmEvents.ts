#!/usr/bin/env node
import { spawnSync } from 'child_process';

const scripts = ['createFilters', 'createEvents', 'createSubEvents', 'mergeEvents', 'finalizeEvents', 'packEvents'];

for (const script of scripts) {
  console.log(`\n> ${script}`);
  const result = spawnSync('npm', ['run', script], { stdio: 'inherit', shell: process.platform === 'win32' });

  if (result.error) {
    console.error(`Failed to run ${script}:`, result.error.message);
    process.exit(1);
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
