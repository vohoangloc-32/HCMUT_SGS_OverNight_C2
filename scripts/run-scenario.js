#!/usr/bin/env node
/**
 * Cross-platform runner for scenarios 1-5.
 * On Windows, finds Git Bash or WSL bash automatically.
 */
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const scenarioArg = process.argv[2] || '1';

const scenarioMap = {
  '1': 'scripts/scenario-1-normal.sh',
  '2': 'scripts/scenario-2-legit-deploy.sh',
  '3': 'scripts/scenario-3-prompt-injection.sh',
  '4': 'scripts/scenario-4-manual-attacker.sh',
  '5': 'scripts/scenario-5-param-swap.sh',
  'a': 'scripts/real-code-change.js',
  'b': 'scripts/real-code-injection.js',
};

const target = scenarioMap[scenarioArg.toLowerCase()];
if (!target) {
  console.error(`Unknown scenario: ${scenarioArg}. Available: 1, 2, 3, 4, 5, a, b`);
  process.exit(1);
}

if (target.endsWith('.js')) {
  // Directly run node
  const res = spawnSync('node', [target], { stdio: 'inherit' });
  process.exit(res.status ?? 0);
}

// Target is .sh
let bashCmd = 'bash';
if (process.platform === 'win32') {
  const gitBashPaths = [
    'C:\\Program Files\\Git\\bin\\bash.exe',
    'C:\\Program Files (x86)\\Git\\bin\\bash.exe',
    process.env.LOCALAPPDATA + '\\Programs\\Git\\bin\\bash.exe',
  ];
  for (const p of gitBashPaths) {
    if (p && fs.existsSync(p)) {
      bashCmd = p;
      break;
    }
  }
}

const res = spawnSync(bashCmd, [target], { stdio: 'inherit' });
process.exit(res.status ?? 0);
