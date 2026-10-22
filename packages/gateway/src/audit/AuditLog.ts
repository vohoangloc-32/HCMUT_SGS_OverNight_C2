/**
 * AuditLog — interface for the append-only audit log.
 *
 * Currently backed by the SQLite audit_events table via appendAudit() in routes/actions.ts.
 * In production, this should be a tamper-evident log (e.g. Merkle-chained entries).
 *
 * TODO(P1): Add Merkle chain or external audit log for production.
 */
export interface AuditLog {
  append(entry: {
    actionRequestId: string;
    event: string;
    actor: string;
    detail: Record<string, unknown>;
  }): Promise<void>;
}
