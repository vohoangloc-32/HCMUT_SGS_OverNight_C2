import type { ActionRequest, Approval } from '@key-holder/shared';
import type { QuorumEngine } from './QuorumEngine.js';
import { ERROR_CODES } from '@key-holder/shared';

/**
 * InMemoryQuorumEngine — application-level quorum counter.
 *
 * FAKE: This has NO cryptographic guarantees. It counts approvals in the
 * gateway process only. A compromised gateway process can bypass it.
 *
 * This is intentional for UI development. See DECISIONS.md F-01.
 *
 * TODO(P1): Once TC-02 is verified, replace or wrap with TideQuorumEngine
 * that delegates cryptographic quorum enforcement to TideCloak.
 */
export class InMemoryQuorumEngine implements QuorumEngine {
  private readonly required: number;
  private readonly total: number;

  constructor(config: { required: number; total: number }) {
    this.required = config.required;
    this.total = config.total;
  }

  getTotal(): number {
    return this.total;
  }

  async recordApproval(
    request: ActionRequest,
    guardianId: string,
    parametersHash: string
  ): Promise<{ approvals: Approval[]; quorumReached: boolean }> {
    // Check expiry
    if (new Date(request.expiresAt) < new Date()) {
      throw Object.assign(new Error('Request has expired'), { code: ERROR_CODES.EXPIRED });
    }

    // Check self-approval
    if (guardianId === request.proposer.userId) {
      throw Object.assign(new Error('Proposer cannot approve their own request'), {
        code: ERROR_CODES.SELF_APPROVAL,
      });
    }

    // Check already decided
    const existing = request.approvals.find((a: Approval) => a.guardianId === guardianId);
    if (existing) {
      throw Object.assign(new Error('Guardian has already decided on this request'), {
        code: ERROR_CODES.ALREADY_DECIDED,
      });
    }

    // Check hash match
    if (parametersHash !== request.parametersHash) {
      throw Object.assign(
        new Error('Parameters hash mismatch — parameters may have been tampered with'),
        { code: ERROR_CODES.HASH_MISMATCH }
      );
    }

    const newApproval: Approval = {
      guardianId,
      decision: 'approve',
      at: new Date().toISOString(),
      parametersHash,
    };

    const approvals = [...request.approvals, newApproval];
    const quorumReached = approvals.filter((a: Approval) => a.decision === 'approve').length >= this.required;

    return { approvals, quorumReached };
  }

  async recordRejection(
    request: ActionRequest,
    guardianId: string
  ): Promise<{ approvals: Approval[] }> {
    const newApproval: Approval = {
      guardianId,
      decision: 'reject',
      at: new Date().toISOString(),
      parametersHash: request.parametersHash,
    };
    return { approvals: [...request.approvals, newApproval] };
  }

  isQuorumMet(request: ActionRequest): boolean {
    return (
      request.approvals.filter((a: Approval) => a.decision === 'approve').length >= this.required
    );
  }
}
