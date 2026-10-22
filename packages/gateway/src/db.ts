import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'fs';
import { dirname } from 'path';

export interface Statement {
  run(...params: unknown[]): { changes: number; lastInsertRowid: number | bigint };
  get(...params: unknown[]): Record<string, unknown> | undefined;
  all(...params: unknown[]): Record<string, unknown>[];
}

export interface Db {
  exec(sql: string): void;
  prepare(sql: string): Statement;
  pragma(pragma: string): void;
  close(): void;
}

interface ActionRequestRow {
  id: string;
  tool: string;
  parameters: string;
  parameters_hash: string;
  proposer: string;
  source: string;
  risk_signals: string;
  created_at: string;
  expires_at: string;
  status: string;
  approvals: string;
  required_approvals: number;
  total_guardians: number;
}

interface AuditEventRow {
  id: string;
  action_request_id: string;
  event: string;
  actor: string;
  at: string;
  detail: string;
}

class PureDb implements Db {
  private filePath: string | null = null;
  private actionRequests: Map<string, ActionRequestRow> = new Map();
  private auditEvents: AuditEventRow[] = [];

  constructor(dbPath: string) {
    if (dbPath !== ':memory:') {
      this.filePath = dbPath.endsWith('.json') ? dbPath : `${dbPath}.json`;
      mkdirSync(dirname(this.filePath), { recursive: true });
      this.load();
    }
  }

  private load() {
    if (!this.filePath || !existsSync(this.filePath)) return;
    try {
      const raw = readFileSync(this.filePath, 'utf-8');
      const data = JSON.parse(raw);
      if (Array.isArray(data.actionRequests)) {
        for (const row of data.actionRequests) {
          this.actionRequests.set(row.id, row);
        }
      }
      if (Array.isArray(data.auditEvents)) {
        this.auditEvents = data.auditEvents;
      }
    } catch (err) {
      console.warn('[db] Warning: Could not read DB file, starting clean store:', err);
    }
  }

  private persist() {
    if (!this.filePath) return;
    try {
      const data = {
        actionRequests: Array.from(this.actionRequests.values()),
        auditEvents: this.auditEvents,
      };
      writeFileSync(this.filePath, JSON.stringify(data, null, 2), 'utf-8');
    } catch (err) {
      console.warn('[db] Warning: Could not persist DB file:', err);
    }
  }

  exec(_sql: string): void {
    // Schema migration no-op for pure store
  }

  pragma(_pragma: string): void {
    // Pragma no-op
  }

  close(): void {
    this.persist();
  }

  prepare(sql: string): Statement {
    const s = sql.trim();

    // INSERT INTO action_requests
    if (s.startsWith('INSERT INTO action_requests')) {
      return {
        run: (...params: unknown[]) => {
          const row: ActionRequestRow = {
            id: String(params[0]),
            tool: String(params[1]),
            parameters: String(params[2]),
            parameters_hash: String(params[3]),
            proposer: String(params[4]),
            source: String(params[5]),
            risk_signals: String(params[6]),
            created_at: String(params[7]),
            expires_at: String(params[8]),
            status: String(params[9]),
            approvals: String(params[10]),
            required_approvals: Number(params[11]),
            total_guardians: Number(params[12]),
          };
          this.actionRequests.set(row.id, row);
          this.persist();
          return { changes: 1, lastInsertRowid: 0 };
        },
        get: () => undefined,
        all: () => [],
      };
    }

    // UPDATE action_requests SET approvals = ?, status = ? WHERE id = ?
    if (s.includes('UPDATE action_requests') && s.includes('SET approvals = ?, status = ? WHERE id = ?')) {
      return {
        run: (...params: unknown[]) => {
          const approvals = String(params[0]);
          const status = String(params[1]);
          const id = String(params[2]);
          const row = this.actionRequests.get(id);
          if (row) {
            row.approvals = approvals;
            row.status = status;
            this.persist();
            return { changes: 1, lastInsertRowid: 0 };
          }
          return { changes: 0, lastInsertRowid: 0 };
        },
        get: () => undefined,
        all: () => [],
      };
    }

    // UPDATE action_requests SET status = 'executed' WHERE id = ?
    if (s.includes('UPDATE action_requests') && s.includes("status = 'executed'")) {
      return {
        run: (...params: unknown[]) => {
          const id = String(params[0]);
          const row = this.actionRequests.get(id);
          if (row) {
            row.status = 'executed';
            this.persist();
            return { changes: 1, lastInsertRowid: 0 };
          }
          return { changes: 0, lastInsertRowid: 0 };
        },
        get: () => undefined,
        all: () => [],
      };
    }

    // UPDATE action_requests SET approvals = ?, status = 'rejected' WHERE id = ?
    if (s.includes('UPDATE action_requests') && s.includes("status = 'rejected'")) {
      return {
        run: (...params: unknown[]) => {
          const approvals = String(params[0]);
          const id = String(params[1]);
          const row = this.actionRequests.get(id);
          if (row) {
            row.approvals = approvals;
            row.status = 'rejected';
            this.persist();
            return { changes: 1, lastInsertRowid: 0 };
          }
          return { changes: 0, lastInsertRowid: 0 };
        },
        get: () => undefined,
        all: () => [],
      };
    }

    // SELECT COUNT(*) as c FROM action_requests WHERE status = ?
    if (s.includes('SELECT COUNT(*) as c FROM action_requests WHERE status = ?')) {
      return {
        run: () => ({ changes: 0, lastInsertRowid: 0 }),
        get: (...params: unknown[]) => {
          const status = String(params[0]);
          const count = Array.from(this.actionRequests.values()).filter((r) => r.status === status).length;
          return { c: count };
        },
        all: () => [],
      };
    }

    // SELECT COUNT(*) as c FROM action_requests
    if (s.includes('SELECT COUNT(*) as c FROM action_requests')) {
      return {
        run: () => ({ changes: 0, lastInsertRowid: 0 }),
        get: () => {
          return { c: this.actionRequests.size };
        },
        all: () => [],
      };
    }

    // SELECT * FROM action_requests WHERE status = ? LIMIT ? OFFSET ?
    if (s.includes('SELECT * FROM action_requests WHERE status = ? LIMIT ? OFFSET ?')) {
      return {
        run: () => ({ changes: 0, lastInsertRowid: 0 }),
        get: () => undefined,
        all: (...params: unknown[]) => {
          const status = String(params[0]);
          const limit = Number(params[1] ?? 50);
          const offset = Number(params[2] ?? 0);
          return Array.from(this.actionRequests.values())
            .filter((r) => r.status === status)
            .slice(offset, offset + limit) as unknown as Record<string, unknown>[];
        },
      };
    }

    // SELECT * FROM action_requests LIMIT ? OFFSET ?
    if (s.includes('SELECT * FROM action_requests LIMIT ? OFFSET ?')) {
      return {
        run: () => ({ changes: 0, lastInsertRowid: 0 }),
        get: () => undefined,
        all: (...params: unknown[]) => {
          const limit = Number(params[0] ?? 50);
          const offset = Number(params[1] ?? 0);
          return Array.from(this.actionRequests.values())
            .slice(offset, offset + limit) as unknown as Record<string, unknown>[];
        },
      };
    }

    // SELECT * FROM action_requests WHERE id = ?
    if (s.includes('SELECT * FROM action_requests WHERE id = ?')) {
      return {
        run: () => ({ changes: 0, lastInsertRowid: 0 }),
        get: (...params: unknown[]) => {
          const id = String(params[0]);
          return this.actionRequests.get(id) as unknown as Record<string, unknown> | undefined;
        },
        all: (...params: unknown[]) => {
          const id = String(params[0]);
          const row = this.actionRequests.get(id);
          return row ? [row as unknown as Record<string, unknown>] : [];
        },
      };
    }

    // INSERT INTO audit_events
    if (s.startsWith('INSERT INTO audit_events')) {
      return {
        run: (...params: unknown[]) => {
          const row: AuditEventRow = {
            id: String(params[0]),
            action_request_id: String(params[1]),
            event: String(params[2]),
            actor: String(params[3]),
            at: String(params[4]),
            detail: String(params[5] ?? '{}'),
          };
          this.auditEvents.push(row);
          this.persist();
          return { changes: 1, lastInsertRowid: 0 };
        },
        get: () => undefined,
        all: () => [],
      };
    }

    // SELECT * FROM audit_events ORDER BY at ASC
    if (s.includes('SELECT * FROM audit_events')) {
      return {
        run: () => ({ changes: 0, lastInsertRowid: 0 }),
        get: () => undefined,
        all: () => {
          return [...this.auditEvents] as unknown as Record<string, unknown>[];
        },
      };
    }

    // Fallback statement
    return {
      run: () => ({ changes: 0, lastInsertRowid: 0 }),
      get: () => undefined,
      all: () => [],
    };
  }
}

export function initDb(dbPath: string): Db {
  return new PureDb(dbPath);
}
