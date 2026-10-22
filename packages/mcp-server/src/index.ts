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
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import {
  DeployParametersSchema,
  UseSecretParametersSchema,
  SendExternalParametersSchema,
} from '@key-holder/shared';

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
          description: 'Name of the secret (e.g. "PROD_API_KEY"). Uppercase alphanumeric + underscore.',
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
          description: 'Reference to the payload (e.g. file path, S3 key) — NOT the payload itself.',
        },
      },
      required: ['destination', 'payload_ref'],
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

  // Validate parameters against shared schema
  let parameters: Record<string, unknown>;
  try {
    parameters = validateToolArgs(name, args);
  } catch (err: unknown) {
    const e = err as Error;
    return {
      content: [{ type: 'text', text: `Validation error: ${e.message}` }],
      isError: true,
    };
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

function validateToolArgs(
  toolName: string,
  args: unknown
): Record<string, unknown> {
  const schemas: Record<string, z.ZodTypeAny> = {
    request_deploy: DeployParametersSchema,
    request_use_secret: UseSecretParametersSchema,
    request_send_external: SendExternalParametersSchema,
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
