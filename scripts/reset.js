#!/usr/bin/env node
/**
 * Cross-platform Reset Script
 * Replaces Unix 'make reset' for Windows, macOS, and Linux.
 * Removes SQLite database and cleans demo state.
 */
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

console.log('==> Resetting Key-Holder Gateway demo state...');

// 1. Delete SQLite files
const filesToDelete = [
  path.join(rootDir, 'packages', 'gateway', 'data', 'gateway.db'),
  path.join(rootDir, 'packages', 'gateway', 'data', 'gateway.db.json'),
  path.join(rootDir, 'packages', 'gateway', 'data', 'gateway.db-journal'),
  path.join(rootDir, 'packages', 'gateway', 'data', 'gateway.db-wal'),
  path.join(rootDir, 'packages', 'gateway', 'data', 'gateway.db-shm'),
];

for (const file of filesToDelete) {
  try {
    if (fs.existsSync(file)) {
      fs.unlinkSync(file);
      console.log(`  Removed ${path.relative(rootDir, file)}`);
    }
  } catch (err) {
    console.warn(`  Warning: could not delete ${file} (${err.message})`);
  }
}

// 2. Reset mock-env/protected-repo git state if needed
const protectedRepoDir = path.join(rootDir, 'mock-env', 'protected-repo');
if (fs.existsSync(protectedRepoDir)) {
  try {
    // Reset to baseline commit if commits were added during demo
    execSync('git checkout -f main', { cwd: protectedRepoDir, stdio: 'pipe' });
    execSync('git reset --hard a4208db', { cwd: protectedRepoDir, stdio: 'pipe' });
    execSync('git clean -fd', { cwd: protectedRepoDir, stdio: 'pipe' });
    console.log('  Cleaned mock-env/protected-repo git state to baseline.');
  } catch (err) {
    // Ignore if not a git repo or already clean
  }
}

console.log('==> Reset complete. Ready for new scenario demo.\n');
