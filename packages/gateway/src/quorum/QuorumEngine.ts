import type { ActionRequest, Approval } from '@key-holder/shared';

/**
 * QuorumEngine — interface for quorum evaluation and approval recording.
 *
 * The real implementation (TideQuorumEngine) will delegate to TideCloak once
 * TC-02 is verified. Until then, InMemoryQuorumEngine is used.
 */
export interface QuorumEngine {
  /**
   * Record a guardian's approval decision for a request.
   * Validates that:
   * - The guardian has not already voted (ALREADY_DECIDED)
   * - The guardian is not the proposer (SELF_APPROVAL)
   * - The parametersHash matches (HASH_MISMATCH)
   * - The request has not expired (EXPIRED)
   *
   * Returns the updated approval list and whether quorum was reached.
   */
  recordApproval(
    request: ActionRequest,
    guardianId: string,
    parametersHash: string
  ): Promise<{ approvals: Approval[]; quorumReached: boolean }>;

  /**
   * Record a guardian's rejection of a request.
   * Any single rejection terminates the request.
   */
  recordRejection(
    request: ActionRequest,
    guardianId: string
  ): Promise<{ approvals: Approval[] }>;

  /**
   * Check whether quorum is currently met for a request.
   */
  isQuorumMet(request: ActionRequest): boolean;
}
