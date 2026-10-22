#!/usr/bin/env node
/**
 * Cross-platform Live Watcher for Protected Repo Git Log
 * Replaces Unix 'watch -n1 ...' for Windows PowerShell, macOS, and Linux.
 */
import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const protectedRepoPath = path.resolve(__dirname, '..', 'mock-env', 'protected-repo');

function clearScreen() {
  process.stdout.write(process.platform === 'win32' ? '\x1Bc' : '\x1B[2J\x1B[3J\x1B[H');
}

console.log('Starting live watch on protected repo: ' + protectedRepoPath);

function tick() {
  clearScreen();
  const time = new Date().toLocaleTimeString();
  console.log(`\x1b[36m====================================================================\x1b[0m`);
  console.log(`\x1b[36m  PROTECTED REPO GIT LOG (LIVE WATCH) - ${time}\x1b[0m`);
  console.log(`\x1b[36m  Directory: mock-env/protected-repo\x1b[0m`);
  console.log(`\x1b[36m====================================================================\x1b[0m\n`);

  try {
    const log = execSync('git log --oneline -n 5', {
      cwd: protectedRepoPath,
      encoding: 'utf-8',
    }).trim();
    console.log(log || '(No commits found)');
  } catch (err) {
    console.error('Error reading git log:', err.message);
  }

  console.log(`\n\x1b[90m(Auto-refreshing every 1 second. Press Ctrl+C to exit)\x1b[0m`);
}

tick();
setInterval(tick, 1000);
