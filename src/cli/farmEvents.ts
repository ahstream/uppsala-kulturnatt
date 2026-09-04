#!/usr/bin/env node
import { spawnSync } from 'child_process';

const scripts = ['createFilters', 'createEvents', 'createSubEvents', 'mergeEvents', 'finalizeEvents', 'packEvents'];

export function farmEvents(): Error | null {
  for (const script of scripts) {
    console.log(`\n> ${script}`);
    const result = spawnSync('npm', ['run', script], { stdio: 'inherit', shell: process.platform === 'win32' });

    if (result.error) return new Error(`Failed to run ${script}: ${result.error.message}`);

    if (result.status !== 0) {
      return new Error(`Aborting: ${script} failed with exit code ${result.status ?? 1}.`);
    }
  }

  return null;
}

if (require.main === module) {
  const error = farmEvents();
  if (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
