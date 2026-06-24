import axiosInstance from './axiosInstance';

/**
 * Fetch all HOD approval requests (admin view).
 */
export const getAllHodApprovals = () => {
  return axiosInstance.get('/hod-approvals');
};

/**
 * Fetch HOD approval requests for a specific department.
 * @param {string} dept - e.g. "PED", "HR", "Quality"
 */
export const getHodApprovalsByDept = (dept) => {
  return axiosInstance.get(`/hod-approvals/dept/${encodeURIComponent(dept)}`);
};

/**
 * Submit HOD approval or rejection for a change request.
 * @param {string} changeNo - e.g. "4M-2026-1"
 * @param {string} hodDept  - e.g. "PED"
 * @param {string} status   - "Approved" | "Rejected"
 * @param {string} remarks  - optional remarks
 */
export const submitHodApproval = (changeNo, hodDept, status, remarks = '') => {
  return axiosInstance.post('/hod-approvals', {
    changeNo,
    hodDept,
    status,
    remarks
  });
};
