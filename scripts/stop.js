#!/usr/bin/env node
/**
 * Cross-platform Stop Script
 * Frees ports 3001 (Gateway), 5173 (Guardian UI), 4001 (Fake Prod), and 4002 (Fake External).
 */
import { execSync } from 'child_process';

const PORTS = [3001, 4001, 4002, 5173];
console.log('==> Checking and freeing demo ports: ' + PORTS.join(', ') + '...');

const isWindows = process.platform === 'win32';

for (const port of PORTS) {
  try {
    if (isWindows) {
      const output = execSync(`netstat -ano | findstr :${port}`, { stdio: ['pipe', 'pipe', 'ignore'] }).toString();
      const lines = output.trim().split('\n');
      const pids = new Set();
      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        const pid = parts[parts.length - 1];
        if (pid && pid !== '0' && parts[1]?.endsWith(`:${port}`)) {
          pids.add(pid);
        }
      }
      for (const pid of pids) {
        try {
          execSync(`taskkill /F /PID ${pid}`, { stdio: 'ignore' });
          console.log(`  Killed process ${pid} on port ${port}`);
        } catch {}
      }
    } else {
      execSync(`lsof -ti:${port} | xargs kill -9 2>/dev/null || true`, { stdio: 'ignore' });
    }
  } catch {
    // Port was already free
  }
}

console.log('==> All ports freed.\n');
