/**
 * Helper to calculate the unified display status of a change request.
 * Maps backend status values to consistent human-readable frontend statuses.
 * 
 * Possible return values:
 * - 'Rejected': If rejected at any stage (HOD, L2 validation, or L3 approvals)
 * - 'Closed': If successfully completed/closed at L3
 * - 'Approved': If L2 validation accepted, now in L3 approvals phase
 * - 'Pending L2': If HOD approved, awaiting requester L2 submission/QAD verification
 * - 'Pending L1 HOD': Newly created request awaiting HOD approvals
 */
export const getRequestDisplayStatus = (c) => {
  // 1. Immediate rejection at L1 HOD or L2 Validation level
  if (c.hodStatus === 'Rejected' || c.l2Status === 'Rejected') {
    return 'Rejected';
  }

  // 2. Check effectiveness QAD Approval Decision
  if (c.qaApproval === 'Approved') {
    return 'Closed';
  }
  if (c.qaApproval === 'Rejected') {
    return 'Rejected';
  }

  // 3. L3 decisions: only resolved after ALL departments have voted
  if (c.isL3Complete === 1 || c.isL3Complete === true) {
    if (c.hasL3Rejection === 1 || c.hasL3Rejection === true) {
      return 'Rejected';
    }
    return 'L3 Approved';
  }

  // 4. Fallback for Completed change request
  if (c.status === 'Completed') {
    return 'Closed';
  }

  // 5. Pending L3 (L3 is in progress, waiting for all departments)
  if (c.status === 'Approved' || (c.hodStatus === 'Approved' && c.l2Status === 'Accepted')) {
    return 'Pending L3';
  }

  // 6. Pending L2
  if (c.hodStatus === 'Approved') {
    return 'Pending L2';
  }

  // 7. Pending L1 HOD
  return 'Pending L1 HOD';
};
