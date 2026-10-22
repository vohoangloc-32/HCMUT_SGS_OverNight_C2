/**
 * codeChangeExecutor — REAL executor for request_code_change.
 *
 * Runs ONLY after quorum approval. Applies a git patch to the protected repo.
 *
 * Steps:
 *   1. Verify parametersHash still matches the stored patch + baseSha.
 *   2. Verify the protected repo HEAD still equals baseSha (else BASE_CHANGED).
 *   3. Refuse patches touching protected paths (.git/, gateway config).
 *   4. `git apply --check` to validate the patch.
 *   5. Create a temp branch, apply the patch, run the repo's tests.
 *   6. If tests pass: fast-forward main and commit with Approved-by trailers.
 *   7. If tests fail: do NOT merge; return status=failed with test output.
 *
 * REAL: This executor actually runs git commands and tests.
 * LIMITATION (PoC): The agent and gateway share the same OS user.
 *   Directory-level separation is a PoC assumption, not a security boundary.
 *   A production system would use separate containers or OS users.
 */
import { execSync, type ExecSyncOptionsWithStringEncoding } from 'child_process';
import { writeFileSync, unlinkSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { createHash, randomBytes } from 'crypto';
import type { ActionRequest } from '@key-holder/shared';

/** Protected path patterns — patches touching these are refused. */
const PROTECTED_PATH_PATTERNS = [
  /^\.git\//,
  /^\.git$/,
  /\.env$/,
  /gateway/i,
  /mcp-server/i,
  /\.github\//,
  /docker-compose/i,
  /Makefile$/,
  /Dockerfile/i,
];

export interface CodeChangeResult {
  ok: boolean;
  detail: string;
  commitSha?: string;
  testOutput?: string;
}

/**
 * Compute the canonical parametersHash for a code change.
 * This is sha256(canonical(patch + baseSha)) matching how actions.ts creates the hash.
 */
export function codeChangeParamsHash(patch: string, baseSha: string): string {
  const canonical = JSON.stringify({ baseSha, patch }, ['baseSha', 'patch']);
  const hex = createHash('sha256').update(canonical, 'utf8').digest('hex');
  return `sha256:${hex}`;
}

/**
 * Deterministic risk signals for a diff patch.
 */
export function computeCodeChangeRiskSignals(patch: string, filesTouched: string[]): string[] {
  const signals: string[] = [];

  // New network calls / URLs outside allowlist
  const urlPattern = /https?:\/\/[^\s'"]+/gi;
  const fetchPattern = /\+.*\b(fetch|axios|http\.request|https\.request|XMLHttpRequest|\.get\(|\.post\()\b/i;
  if (urlPattern.test(patch) || fetchPattern.test(patch)) {
    signals.push('new-network-call');
  }

  // Reads of process.env or secret files
  const envPattern = /\+.*\b(process\.env|dotenv|\.env|secrets?\.json|credentials)/i;
  if (envPattern.test(patch)) {
    signals.push('env-access');
  }

  // New dependencies
  const depPattern = /\+.*"(dependencies|devDependencies|peerDependencies)"/i;
  const requirePattern = /\+.*\b(require\(|import\s+.*from\s+['"](?!\.))/ ;
  if (depPattern.test(patch) || requirePattern.test(patch)) {
    signals.push('new-dependency');
  }

  // Changes to CI/config files
  const ciFiles = filesTouched.filter(f =>
    /\.(yml|yaml)$/i.test(f) ||
    /Dockerfile/i.test(f) ||
    /docker-compose/i.test(f) ||
    /\.github\//i.test(f) ||
    /Makefile$/i.test(f) ||
    /\.eslintrc/i.test(f) ||
    /tsconfig/i.test(f)
  );
  if (ciFiles.length > 0) {
    signals.push('ci-config-change');
  }

  // Very large diff (> 500 added lines)
  const addedLines = (patch.match(/^\+[^+]/gm) || []).length;
  if (addedLines > 500) {
    signals.push('large-diff');
  }

  // Protected paths
  const protectedTouched = filesTouched.filter(f =>
    PROTECTED_PATH_PATTERNS.some(p => p.test(f))
  );
  if (protectedTouched.length > 0) {
    signals.push('protected-path');
  }

  return [...new Set(signals)];
}

/**
 * Check if the patch touches any protected paths.
 * Returns the list of offending files, or empty array if clean.
 */
export function checkProtectedPaths(filesTouched: string[]): string[] {
  return filesTouched.filter(f =>
    PROTECTED_PATH_PATTERNS.some(p => p.test(f))
  );
}

function git(repoPath: string, args: string): string {
  const opts: ExecSyncOptionsWithStringEncoding = {
    cwd: repoPath,
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe'],
    timeout: 60_000,
  };
  return execSync(`git ${args}`, opts).trim();
}

export async function codeChangeExecutor(
  actionRequest: ActionRequest,
  approvers: string[]
): Promise<CodeChangeResult> {
  const protectedRepoPath = process.env.PROTECTED_REPO_PATH;
  if (!protectedRepoPath) {
    return { ok: false, detail: 'PROTECTED_REPO_PATH environment variable not set' };
  }

  if (!existsSync(protectedRepoPath)) {
    return { ok: false, detail: `Protected repo path does not exist: ${protectedRepoPath}` };
  }

  const params = actionRequest.parameters as {
    title: string;
    description: string;
    patch: string;
    baseSha: string;
    filesTouched: string[];
  };

  const { patch, baseSha, filesTouched, title, description } = params;

  // 1. Check protected paths (refuse before doing any git work)
  const protectedFiles = checkProtectedPaths(filesTouched);
  if (protectedFiles.length > 0) {
    return {
      ok: false,
      detail: `PROTECTED_PATH: Patch touches protected paths: ${protectedFiles.join(', ')}`,
    };
  }

  // 2. Verify parametersHash matches stored patch + baseSha
  const expectedHash = codeChangeParamsHash(patch, baseSha);
  if (expectedHash !== actionRequest.parametersHash) {
    return {
      ok: false,
      detail: `HASH_MISMATCH: Stored hash ${actionRequest.parametersHash} does not match recomputed hash ${expectedHash}`,
    };
  }

  // 3. Verify the protected repo HEAD still equals baseSha
  let currentHead: string;
  try {
    currentHead = git(protectedRepoPath, 'rev-parse HEAD');
  } catch (err) {
    return { ok: false, detail: `Failed to read protected repo HEAD: ${(err as Error).message}` };
  }

  if (!currentHead.startsWith(baseSha) && !baseSha.startsWith(currentHead.slice(0, baseSha.length))) {
    // Compare short SHA to long SHA
    const shortHead = currentHead.slice(0, baseSha.length);
    if (shortHead !== baseSha && currentHead !== baseSha) {
      return {
        ok: false,
        detail: `BASE_CHANGED: Protected repo HEAD is ${currentHead}, but patch was based on ${baseSha}`,
      };
    }
  }

  // 4. Write patch to temp file
  const tmpDir = join(protectedRepoPath, '..', '.gateway-tmp');
  mkdirSync(tmpDir, { recursive: true });
  const patchFile = join(tmpDir, `patch-${randomBytes(8).toString('hex')}.diff`);

  try {
    writeFileSync(patchFile, patch, 'utf-8');

    // 5. git apply --check
    try {
      git(protectedRepoPath, `apply --check "${patchFile}"`);
    } catch (err) {
      return {
        ok: false,
        detail: `Patch does not apply cleanly: ${(err as Error).message}`,
      };
    }

    // 6. Create a temp branch, apply, and run tests
    const tempBranch = `gateway-review-${randomBytes(4).toString('hex')}`;
    try {
      git(protectedRepoPath, `checkout -b ${tempBranch}`);
      git(protectedRepoPath, `apply "${patchFile}"`);
      git(protectedRepoPath, 'add -A');

      // Build the commit message with Approved-by trailers
      const trailers = approvers.map(a => `Approved-by: ${a}`).join('\n');
      const commitMsg = `${title}\n\n${description}\n\n${trailers}`;
      const commitMsgFile = join(tmpDir, `msg-${randomBytes(4).toString('hex')}.txt`);
      writeFileSync(commitMsgFile, commitMsg, 'utf-8');

      git(protectedRepoPath, `commit --file="${commitMsgFile}" --author="Key-Holder Gateway <gateway@key-holder.local>"`);

      try {
        unlinkSync(commitMsgFile);
      } catch { /* ignore */ }

      // 7. Run tests
      let testOutput: string;
      try {
        testOutput = execSync('npm test', {
          cwd: protectedRepoPath,
          encoding: 'utf-8',
          stdio: ['pipe', 'pipe', 'pipe'],
          timeout: 120_000,
        });
      } catch (err) {
        const e = err as { stdout?: string; stderr?: string; message?: string };
        testOutput = (e.stdout ?? '') + '\n' + (e.stderr ?? '');

        // Tests failed — do NOT merge. Rollback.
        try {
          git(protectedRepoPath, 'checkout main');
          git(protectedRepoPath, `branch -D ${tempBranch}`);
        } catch { /* best effort rollback */ }

        return {
          ok: false,
          detail: `TESTS_FAILED: Tests did not pass. Patch NOT merged.`,
          testOutput: testOutput.slice(0, 4000),
        };
      }

      // 8. Tests passed — fast-forward main
      const commitSha = git(protectedRepoPath, 'rev-parse HEAD');
      git(protectedRepoPath, 'checkout main');
      git(protectedRepoPath, `merge --ff-only ${tempBranch}`);
      git(protectedRepoPath, `branch -d ${tempBranch}`);

      return {
        ok: true,
        detail: `Patch applied and tests passed. Merged to main as ${commitSha.slice(0, 7)}.`,
        commitSha,
        testOutput: testOutput.slice(0, 2000),
      };
    } catch (err) {
      // Rollback on any error
      try {
        git(protectedRepoPath, 'checkout main');
        git(protectedRepoPath, `branch -D ${tempBranch}`);
      } catch { /* best effort */ }

      return {
        ok: false,
        detail: `Executor error: ${(err as Error).message}`,
      };
    }
  } finally {
    // Clean up temp patch file
    try {
      unlinkSync(patchFile);
    } catch { /* ignore */ }
  }
}
