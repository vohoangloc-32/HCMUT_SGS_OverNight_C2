#!/usr/bin/env node
/**
 * Key-Holder Gateway MCP Server
 *
 * Exposes exactly three tools to any MCP-capable AI agent:
 *   - request_deploy
 *   - request_use_secret
 *   - request_send_external
 *
 * These tools ONLY create Action Requests in the gateway — they never execute directly.
 * Execution happens in the gateway only after N-of-M guardian approval.
 *
 * See docs/API.md and packages/shared/src/types.ts for the full contract.
 * See AGENTS.md rule 5: do NOT add new tools without updating docs/API.md and shared types.
 */
import 'dotenv/config';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import {
  DeployParametersSchema,
  UseSecretParametersSchema,
  SendExternalParametersSchema,
  CodeChangeParametersSchema,
} from '@key-holder/shared';
import { execSync } from 'child_process';
import { existsSync } from 'fs';

const GATEWAY_URL = process.env.GATEWAY_URL ?? 'http://localhost:3001';
const PROPOSER_USER_ID = process.env.MCP_PROPOSER_USER_ID ?? 'mcp-agent';
const AGENT_NAME = process.env.MCP_AGENT_NAME ?? 'unknown-agent';

// ── Tool definitions ──────────────────────────────────────────────────────────

const TOOLS = [
  {
    name: 'request_deploy',
    description:
      'Request a deployment to production. Requires N-of-M guardian approval before executing. ' +
      'Returns a request ID and status. NEVER executes the deploy directly.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        version: { type: 'string', description: 'Version string (e.g. "1.4.2")' },
        commit: { type: 'string', description: '7-40 character hex commit hash' },
      },
      required: ['version', 'commit'],
    },
  },
  {
    name: 'request_use_secret',
    description:
      'Request the gateway to use a named secret on your behalf. The secret value is NEVER ' +
      'returned to the agent. Requires N-of-M guardian approval before the gateway uses it. ' +
      'Returns a request ID and status.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        secret_name: {
          type: 'string',
          description:
            'Name of the secret (e.g. "PROD_API_KEY"). Uppercase alphanumeric + underscore.',
        },
        purpose: {
          type: 'string',
          description: 'Human-readable reason for using the secret (max 500 chars).',
        },
      },
      required: ['secret_name', 'purpose'],
    },
  },
  {
    name: 'request_send_external',
    description:
      'Request the gateway to send data to an external endpoint. Requires N-of-M guardian ' +
      'approval. Do NOT pass the actual payload — pass a reference to where the data lives. ' +
      'Returns a request ID and status.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        destination: { type: 'string', description: 'Full URL of the destination endpoint.' },
        payload_ref: {
          type: 'string',
          description:
            'Reference to the payload (e.g. file path, S3 key) — NOT the payload itself.',
        },
      },
      required: ['destination', 'payload_ref'],
    },
  },
  {
    name: 'get_action_status',
    description:
      'Check the current approval and execution status of an action request. ' +
      'Read-only: does NOT execute or modify anything.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        id: { type: 'string', description: 'Action Request ID (ULID) to check' },
      },
      required: ['id'],
    },
  },
  {
    name: 'request_code_change',
    description:
      'Request to apply a code change to the protected repository. The tool captures the ' +
      'current git diff in the agent workspace and sends the patch to the gateway for ' +
      'guardian approval. The tool NEVER applies the patch; it only creates an action request. ' +
      'The patch is applied only after N-of-M guardian approval and passing tests.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        title: { type: 'string', description: 'Short title for the code change (max 200 chars)' },
        description: {
          type: 'string',
          description: 'Detailed description of what the change does and why (max 2000 chars)',
        },
        workspace_path: {
          type: 'string',
          description: 'Absolute path to the agent workspace where the changes were made',
        },
      },
      required: ['title', 'description', 'workspace_path'],
    },
  },
];

// ── MCP Server ────────────────────────────────────────────────────────────────

const server = new Server(
  { name: 'key-holder-gateway', version: '0.1.0' },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: TOOLS };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  // Read-only status tool
  if (name === 'get_action_status') {
    const id = (args as { id?: string })?.id;
    if (!id || typeof id !== 'string') {
      return {
        content: [{ type: 'text', text: 'Validation error: Missing or invalid "id" parameter.' }],
        isError: true,
      };
    }

    try {
      const response = await fetch(`${GATEWAY_URL}/actions/${encodeURIComponent(id)}`);
      if (!response.ok) {
        return {
          content: [{ type: 'text', text: `Action request not found (HTTP ${response.status})` }],
          isError: true,
        };
      }

      const data = (await response.json()) as {
        id: string;
        tool: string;
        status: string;
        approvals: unknown[];
        requiredApprovals: number;
        totalGuardians: number;
        parametersHash: string;
        riskSignals: string[];
        createdAt: string;
        expiresAt: string;
      };

      return {
        content: [
          {
            type: 'text',
            text: [
              `📋 Action Request Status`,
              `ID: ${data.id}`,
              `Tool: ${data.tool}`,
              `Status: ${data.status}`,
              `Approvals: ${data.approvals?.length ?? 0} of ${data.requiredApprovals} required (${data.totalGuardians} guardians total)`,
              `Risk Signals: ${data.riskSignals?.length ? data.riskSignals.join(', ') : 'none'}`,
              `Parameters Hash: ${data.parametersHash}`,
              `Created: ${data.createdAt}`,
              `Expires: ${data.expiresAt}`,
            ].join('\n'),
          },
        ],
      };
    } catch (err: unknown) {
      const e = err as Error;
      return {
        content: [{ type: 'text', text: `Failed to query gateway: ${e.message}` }],
        isError: true,
      };
    }
  }

  // Code change tool: compute diff in workspace against protected repo HEAD
  let parameters: Record<string, unknown>;
  if (name === 'request_code_change') {
    const rawArgs = (args ?? {}) as Record<string, unknown>;
    const title = typeof rawArgs.title === 'string' ? rawArgs.title.trim() : '';
    const description = typeof rawArgs.description === 'string' ? rawArgs.description.trim() : '';
    const workspacePath =
      typeof rawArgs.workspace_path === 'string' ? rawArgs.workspace_path.trim() : '';

    if (!title) {
      return {
        content: [{ type: 'text', text: 'Validation error: "title" is required and cannot be empty.' }],
        isError: true,
      };
    }
    if (!description) {
      return {
        content: [{ type: 'text', text: 'Validation error: "description" is required and cannot be empty.' }],
        isError: true,
      };
    }
    if (!workspacePath) {
      return {
        content: [{ type: 'text', text: 'Validation error: "workspace_path" is required and cannot be empty.' }],
        isError: true,
      };
    }

    if (!existsSync(workspacePath)) {
      return {
        content: [{ type: 'text', text: `Validation error: workspace_path does not exist: "${workspacePath}"` }],
        isError: true,
      };
    }

    // Determine baseSha from gateway /repo/log or workspace git HEAD
    let baseSha = '';
    try {
      const repoRes = await fetch(`${GATEWAY_URL}/repo/log`);
      if (repoRes.ok) {
        const logData = (await repoRes.json()) as { ok?: boolean; head?: string };
        if (logData.ok && logData.head && logData.head !== 'unknown') {
          baseSha = logData.head.trim();
        }
      }
    } catch {
      // Gateway /repo/log may not be available; fallback to workspace git
    }

    if (!baseSha) {
      try {
        baseSha = execSync('git rev-parse HEAD', { cwd: workspacePath, encoding: 'utf-8' }).trim();
      } catch (err) {
        return {
          content: [
            { type: 'text', text: `Failed to determine git HEAD in workspace: ${(err as Error).message}` },
          ],
          isError: true,
        };
      }
    }

    // Stage intent-to-add for untracked files
    try {
      execSync('git add -N .', { cwd: workspacePath, stdio: ['pipe', 'pipe', 'pipe'] });
    } catch {
      // Best effort
    }

    let patch = '';
    try {
      patch = execSync(`git diff ${baseSha}`, {
        cwd: workspacePath,
        encoding: 'utf-8',
        maxBuffer: 10 * 1024 * 1024,
      }).trim();
    } catch {
      try {
        patch = execSync('git diff HEAD', {
          cwd: workspacePath,
          encoding: 'utf-8',
          maxBuffer: 10 * 1024 * 1024,
        }).trim();
      } catch (err) {
        return {
          content: [{ type: 'text', text: `Failed to generate git diff: ${(err as Error).message}` }],
          isError: true,
        };
      }
    }

    if (!patch) {
      return {
        content: [{ type: 'text', text: 'No code changes detected in workspace. Diff is empty.' }],
        isError: true,
      };
    }

    let filesTouched: string[] = [];
    try {
      const filesOut = execSync(`git diff --name-only ${baseSha}`, {
        cwd: workspacePath,
        encoding: 'utf-8',
      }).trim();
      filesTouched = filesOut.split(/\r?\n/).map((f) => f.trim()).filter(Boolean);
    } catch {
      try {
        const filesOut = execSync('git diff --name-only HEAD', {
          cwd: workspacePath,
          encoding: 'utf-8',
        }).trim();
        filesTouched = filesOut.split(/\r?\n/).map((f) => f.trim()).filter(Boolean);
      } catch {
        const matches = patch.match(/^diff --git a\/(.+?) b\/(.+?)$/gm);
        if (matches) {
          filesTouched = matches.map((m) => m.replace(/^diff --git a\/(.+?) b\/.+$/, '$1'));
        }
      }
    }

    if (filesTouched.length === 0) {
      filesTouched = ['workspace'];
    }

    parameters = {
      title,
      description,
      patch,
      baseSha,
      filesTouched,
    };
  } else {
    // Validate parameters against shared schema
    try {
      parameters = validateToolArgs(name, args);
    } catch (err: unknown) {
      const e = err as Error;
      return {
        content: [{ type: 'text', text: `Validation error: ${e.message}` }],
        isError: true,
      };
    }
  }

  // Call gateway to create an Action Request
  try {
    const response = await fetch(`${GATEWAY_URL}/actions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tool: name,
        parameters,
        proposer: { userId: PROPOSER_USER_ID, agent: AGENT_NAME },
        source: { kind: 'direct' },
      }),
    });

    const data = (await response.json()) as Record<string, unknown>;

    if (!response.ok) {
      return {
        content: [{ type: 'text', text: `Gateway error: ${JSON.stringify(data)}` }],
        isError: true,
      };
    }

    const result = data as {
      id: string;
      status: string;
      parametersHash: string;
      expiresAt: string;
      requiredApprovals: number;
      totalGuardians: number;
    };

    return {
      content: [
        {
          type: 'text',
          text: [
            `✅ Action request created.`,
            ``,
            `ID: ${result.id}`,
            `Status: ${result.status}`,
            `Tool: ${name}`,
            `Requires: ${result.requiredApprovals} of ${result.totalGuardians} guardian approvals`,
            `Expires: ${result.expiresAt}`,
            ``,
            `⏳ Waiting for guardian approval. The action will NOT execute until quorum is met.`,
            `🔑 Guardian UI: ${process.env.GUARDIAN_UI_URL ?? 'http://localhost:5173'}`,
          ].join('\n'),
        },
      ],
    };
  } catch (err: unknown) {
    const e = err as Error;
    return {
      content: [{ type: 'text', text: `Failed to reach gateway at ${GATEWAY_URL}: ${e.message}` }],
      isError: true,
    };
  }
});

// ── Validation ────────────────────────────────────────────────────────────────

function validateToolArgs(toolName: string, args: unknown): Record<string, unknown> {
  const schemas: Record<string, z.ZodTypeAny> = {
    request_deploy: DeployParametersSchema,
    request_use_secret: UseSecretParametersSchema,
    request_send_external: SendExternalParametersSchema,
    request_code_change: CodeChangeParametersSchema,
  };

  const schema = schemas[toolName];
  if (!schema) throw new Error(`Unknown tool: ${toolName}`);

  return schema.parse(args) as Record<string, unknown>;
}

// ── Start ─────────────────────────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Key-Holder Gateway MCP server started (stdio transport)');
}

main().catch((err) => {
  console.error('MCP server failed to start:', err);
  process.exit(1);
});
