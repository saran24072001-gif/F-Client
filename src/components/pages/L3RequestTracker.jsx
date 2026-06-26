import { useState, useEffect } from 'react';
import { Save, Search, Eye, EyeOff, X, Loader2, AlertTriangle, Paperclip, Folder, Cpu, Clock, CheckCircle2, FileText, Calendar, Download, XCircle } from 'lucide-react';
import TablePagination from '@mui/material/TablePagination';
import { getL3Approvals, createL3Approval, getL1Details, getL1Attachment, getL2Details, getL2Attachment, getEffectivenessLogs, getEffectivenessAttachment } from '../../api/apiRoutes';
import { formatDateToDDMMYYYY, formatDateToDDMMYY } from '../../utils/dateUtils';
import { exportL3ApprovalsPDF, exportRequestDetailsPDF } from '../../utils/pdfExport';
import { useWebSocket } from '../../hooks/useWebSocket';

export const L3RequestTracker = ({
  userEmail,
  userRole,
  userDept,
  logAction,
  setToastMsg,
  fetchChanges,
  autoOpenChangeNo,
  clearAutoOpen
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFetchingLogs, setIsFetchingLogs] = useState(false);
  const [selectedLog, setSelectedLog] = useState(null);
  const [validationError, setValidationError] = useState('');

  // L3 Details Modal state hooks
  const [selectedL1Details, setSelectedL1Details] = useState(null);
  const [selectedL2Details, setSelectedL2Details] = useState(null);
  const [selectedEffDetails, setSelectedEffDetails] = useState(null);
  const [isFetchingDetails, setIsFetchingDetails] = useState(false);
  const [activeTab, setActiveTab] = useState('l1');
  const [previewFile, setPreviewFile] = useState(null);
  const [fileUrls, setFileUrls] = useState({});
  const [fileTypes, setFileTypes] = useState({});
  const [showCustomerApproval, setShowCustomerApproval] = useState(false);

  useEffect(() => {
    if (!selectedLog) {
      setShowCustomerApproval(false);
    }
  }, [selectedLog]);

  // Database approval logs
  const [approvalLogs, setApprovalLogs] = useState([]);

  // Selected row for editing
  const [selectedChangeId, setSelectedChangeId] = useState(null);

  // Form states
  const [formChangeNo, setFormChangeNo] = useState('');
  const [formDate, setFormDate] = useState('');
  const [formRequester, setFormRequester] = useState('');
  const [formStatus, setFormStatus] = useState('');

  // Inline field validation errors
  const [fieldErrors, setFieldErrors] = useState({});

  // Acting Department mapping
  const [actingDept, setActingDept] = useState('QAD');

  // Search & Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');

  // Pagination State
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // Map database department to L3 acting department
  const mapDbDeptToL3Dept = (dbDept) => {
    if (!dbDept) return 'QAD';
    const dept = dbDept.trim().toLowerCase();
    if (dept === 'qad') return 'QAD';
    if (dept === 'ped') return 'PED';
    if (dept === 'production') return 'Production';
    if (dept === 'maintenance') return 'Maintenance';
    if (dept === 'pc & l' || dept === 'pcl') return 'PC & L';
    if (dept === 'materials') return 'Materials';
    if (dept === 'marketing') return 'Marketing';
    if (dept === 'hr') return 'HR';
    if (dept === 'safety') return 'Safety';
    if (dept === 'unit head' || dept === 'unit_head') return 'Unit Head';
    return 'QAD'; // Fallback
  };

  // Formatted date (e.g., "2026-05-20" -> "20/05/26")
  const formatDateShort = (dateStr) => {
    return formatDateToDDMMYY(dateStr);
  };

  // Format month names (e.g. "2026-05" -> "May-26" or "12/06/2026" -> "Jun-26")
  const formatMonthWise = (val) => {
    if (!val) return "-";
    if (val.includes('/')) {
      const parts = val.split('/');
      if (parts.length === 3) {
        const month = parseInt(parts[1], 10);
        const year = parseInt(parts[2], 10);
        const date = new Date(year, month - 1, 1);
        if (!isNaN(date.getTime())) {
          const monthName = date.toLocaleDateString("en-US", { month: "short" });
          const yearShort = String(year).slice(-2);
          return `${monthName}-${yearShort}`;
        }
      }
    }
    if (val.includes('-')) {
      const parts = val.split("-");
      if (parts.length >= 2) {
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10);
        const date = new Date(year, month - 1, 1);
        if (!isNaN(date.getTime())) {
          const monthName = date.toLocaleDateString("en-US", { month: "short" });
          const yearShort = String(year).slice(-2);
          return `${monthName}-${yearShort}`;
        }
      }
    }
    return val;
  };

  // Map logged-in user email/role to initial acting department
  useEffect(() => {
    if (userDept) {
      const mapped = mapDbDeptToL3Dept(userDept);
      setActingDept(mapped);
    } else if (userEmail) {
      // Fallback to legacy hardcoded check if userDept is not yet resolved/available
      const email = userEmail.toLowerCase();
      if (email.includes('ravi.qa')) {
        setActingDept('QAD');
      } else if (email.includes('kumar.s')) {
        setActingDept('Production');
      } else if (email.includes('ped')) {
        setActingDept('PED');
      } else if (email.includes('manager')) {
        setActingDept('Production');
      } else {
        setActingDept('QAD');
      }
    }
  }, [userEmail, userDept]);

  // Dynamic form status prefill based on selected change request and acting department
  useEffect(() => {
    if (selectedChangeId) {
      const currentLog = approvalLogs.find(log => log.changeNo === selectedChangeId);
      if (currentLog) {
        let currentStatus = 'Pending';
        if (actingDept === 'PED') currentStatus = currentLog.ped;
        else if (actingDept === 'QAD') currentStatus = currentLog.qad;
        else if (actingDept === 'Production') currentStatus = currentLog.production;
        else if (actingDept === 'Maintenance') currentStatus = currentLog.maintenance;
        else if (actingDept === 'PC & L') currentStatus = currentLog.pcl;
        else if (actingDept === 'Materials') currentStatus = currentLog.materials;
        else if (actingDept === 'Marketing') currentStatus = currentLog.marketing;
        else if (actingDept === 'HR') currentStatus = currentLog.hr;
        else if (actingDept === 'Safety') currentStatus = currentLog.safety;
        else if (actingDept === 'Unit Head') currentStatus = currentLog.unitHead;

        setFormStatus(currentStatus === 'Pending' ? '' : (currentStatus || ''));
      }
    }
  }, [actingDept, selectedChangeId, approvalLogs]);

  // Click row to select it
  const handleSelectRow = (log) => {
    setValidationError('');
    setFieldErrors({});
    setSelectedChangeId(log.changeNo);
    setFormChangeNo(log.changeNo);
    setFormDate(formatDateToDDMMYYYY(log.date));
    setFormRequester(log.requester);
    const userIsAdmin = userRole && (
      userRole.toLowerCase() === 'admin' ||
      userRole.toLowerCase() === 'administrator'
    );
    if (userIsAdmin && log.raisedDept) {
      const mapped = mapDbDeptToL3Dept(log.raisedDept);
      setActingDept(mapped);
    }
  };

  const handleCancelEdit = () => {
    setSelectedChangeId(null);
    setFormChangeNo('');
    setFormDate('');
    setFormRequester('');
    setFormStatus('');
    setFieldErrors({});
  };

  const handleSaveApproval = async (e) => {
    e.preventDefault();

    if (!selectedChangeId || !formChangeNo.trim()) {
      setToastMsg('Please select a change request.');
      return;
    }

    if (!formStatus || formStatus === 'Pending') {
      setFieldErrors({ status: 'Please choose an approval status.' });
      return;
    }

    setFieldErrors({});

    // Find the log in state
    const currentLog = approvalLogs.find(log => log.changeNo === formChangeNo);
    if (!currentLog) {
      setValidationError('Selected change request was not found.');
      return;
    }

    if (currentLog.l2Decision !== 'Accepted') {
      setValidationError(`Error: Change Request ${currentLog.changeNo} cannot be signed off at L3 because L2 validation is not Accepted (Current L2 Status: ${currentLog.l2Decision || 'Pending'}).`);
      return;
    }

    setIsSubmitting(true);
    setValidationError('');

    const updatedLog = {
      changeNo: currentLog.changeNo,
      date: currentLog.date,
      requester: currentLog.requester,
      ped: actingDept === 'PED' ? formStatus : currentLog.ped,
      qad: actingDept === 'QAD' ? formStatus : currentLog.qad,
      production: actingDept === 'Production' ? formStatus : currentLog.production,
      maintenance: actingDept === 'Maintenance' ? formStatus : currentLog.maintenance,
      pcl: actingDept === 'PC & L' ? formStatus : currentLog.pcl,
      materials: actingDept === 'Materials' ? formStatus : currentLog.materials,
      marketing: actingDept === 'Marketing' ? formStatus : currentLog.marketing,
      hr: actingDept === 'HR' ? formStatus : currentLog.hr,
      safety: actingDept === 'Safety' ? formStatus : currentLog.safety,
      unitHead: actingDept === 'Unit Head' ? formStatus : currentLog.unitHead
    };

    try {
      await createL3Approval(updatedLog);

      if (setToastMsg) {
        setToastMsg(`Successfully saved ${actingDept} approval log for ${formChangeNo}`);
      }
      if (logAction) {
        logAction('L3 Log Saved', `Successfully logged L3 approval status: "${formStatus}" for department: ${actingDept} and Change No: ${formChangeNo}`);
      }

      await fetchLogs();
      if (fetchChanges) {
        await fetchChanges();
      }
      handleCancelEdit();
    } catch (err) {
      console.error(err);
      const errMsg = err.response?.data?.error || 'Error saving L3 approval log to database.';
      setValidationError(errMsg);
    } finally {
      setIsSubmitting(false);
    }
  };





  const handleViewDetails = async (log, silent = false) => {
    if (!silent) {
      // Open modal immediately with skeleton data to avoid blinking/flicker
      setSelectedLog(log);
      setSelectedL1Details(null);
      setSelectedL2Details(null);
      setSelectedEffDetails(null);
      setIsFetchingDetails(true);
      setActiveTab('l1');
    }

    try {
      const [l1Res, l2Res, effRes] = await Promise.all([
        getL1Details(log.changeNo),
        getL2Details(log.changeNo).catch(() => ({ data: null })),
        getEffectivenessLogs().catch(() => ({ data: [] }))
      ]);
      setSelectedL1Details(l1Res.data);
      setSelectedL2Details(l2Res.data);
      const matchedEff = effRes.data?.find(
        l => l.changeNo?.toLowerCase().trim() === log.changeNo?.toLowerCase().trim()
      );
      setSelectedEffDetails(matchedEff || null);
      setSelectedLog(log);
    } catch (err) {
      console.error(err);
      if (setToastMsg) setToastMsg('Error loading L1 change request details.');
    } finally {
      if (!silent) setIsFetchingDetails(false);
    }
  };

  // Reset page when search or status filters change
  useEffect(() => {
    setPage(0);
  }, [searchQuery, statusFilter]);

  // Fetch L3 logs from database
  const fetchLogs = async (silent = false) => {
    if (!silent) setIsFetchingLogs(true);
    try {
      const response = await getL3Approvals();
      setApprovalLogs(response.data);
    } catch (err) {
      console.error(err);
      if (setToastMsg) setToastMsg('Error loading L3 approvals from database.');
    } finally {
      if (!silent) setIsFetchingLogs(false);
    }
  };

  useEffect(() => {
    fetchLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useWebSocket((data) => {
    if (data.type === 'REFRESH_CHANGES') {
      fetchLogs(true);
      if (selectedLog) {
        handleViewDetails(selectedLog, true);
      }
    }
  });

  // Keep selectedLog in sync when approvalLogs updates in the background
  useEffect(() => {
    if (selectedLog) {
      const updatedLog = approvalLogs.find(l => l.changeNo === selectedLog.changeNo);
      if (updatedLog) {
        setSelectedLog(updatedLog);
      }
    }
  }, [approvalLogs, selectedLog]);

  // Clear L3 approvals sidebar form when the request is fully approved or removed from list
  useEffect(() => {
    if (selectedChangeId) {
      const exists = approvalLogs.some(l => l.changeNo === selectedChangeId);
      if (!exists) {
        handleCancelEdit();
      }
    }
  }, [approvalLogs, selectedChangeId]);

  useEffect(() => {
    if (autoOpenChangeNo && approvalLogs.length > 0) {
      const log = approvalLogs.find(l => l.changeNo === autoOpenChangeNo);
      if (log) {
        // Auto-select the row to populate the form on the left
        handleSelectRow(log);
        // Clear the state so it doesn't open again on re-renders
        if (clearAutoOpen) {
          clearAutoOpen();
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoOpenChangeNo, approvalLogs]);

  const handleViewAttachment = async (filename, logOrChangeNo, type = 'L1') => {
    if (!filename || filename === '-') return;
    setPreviewFile(filename);

    if (!fileUrls[filename]) {
      try {
        let response;
        if (type === 'L2') {
          const changeNo = logOrChangeNo?.changeNo || logOrChangeNo;
          response = await getL2Attachment(changeNo, filename);
        } else if (type === 'Effectiveness') {
          const logId = logOrChangeNo?.id || logOrChangeNo;
          response = await getEffectivenessAttachment(logId, filename);
        } else {
          const changeNo = logOrChangeNo?.changeNo || logOrChangeNo;
          response = await getL1Attachment(changeNo, filename);
        }
        const blobUrl = URL.createObjectURL(response.data);
        const mimeType = response.data.type;
        setFileTypes(prev => ({ ...prev, [filename]: mimeType }));
        setFileUrls(prev => ({ ...prev, [filename]: blobUrl }));
      } catch (err) {
        console.error(`Error loading ${type} attachment from server:`, err);
      }
    }
  };

  const renderL1FilePill = (filename, changeNo) => {
    if (!filename) return null;
    const files = filename.split(',').map(s => s.trim()).filter(Boolean);
    return (
      <div className="mt-1 flex flex-wrap gap-2">
        {files.map((file, idx) => {
          if (file.toLowerCase() === 'n/a') {
            return (
              <span key={idx} className="text-[12px] font-semibold text-slate-500 mt-1">
                {file}
              </span>
            );
          }
          return (
            <span
              key={idx}
              className="inline-flex items-center gap-[6px] bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-md py-1 px-2.5 text-[11px] font-medium text-[#0066cc] cursor-pointer max-w-full"
              onClick={() => handleViewAttachment(file, changeNo)}
            >
              <Paperclip size={11} className="text-slate-400" />
              <span className="underline truncate max-w-[200px]">{file}</span>
            </span>
          );
        })}
      </div>
    );
  };

  // Helper to determine the overall L3 approval status of a row log
  const getOverallL3Status = (logItem) => {
    const statuses = [
      logItem.ped,
      logItem.qad,
      logItem.production,
      logItem.maintenance,
      logItem.pcl,
      logItem.materials,
      logItem.marketing,
      logItem.hr,
      logItem.safety,
      logItem.unitHead
    ].map(s => (s || '').trim().toLowerCase());

    // Step 1: If ANY department has not yet voted (blank or 'pending') → Pending (highest priority)
    const allVoted = statuses.every(s => s === 'approved' || s === 'accepted' || s === 'rejected');
    if (!allVoted) {
      return 'Pending';
    }

    // Step 2: All 10 voted — if any one Rejected → Rejected
    if (statuses.includes('rejected')) {
      return 'Rejected';
    }

    // Step 3: All 10 voted and all Approved/Accepted → Approved
    return 'Approved';
  };

  // Filter logic
  const filteredLogs = approvalLogs.filter(log => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch = !q ||
      log.changeNo.toLowerCase().includes(q) ||
      log.requester.toLowerCase().includes(q);

    const overallStatus = getOverallL3Status(log);
    const matchesStatus = statusFilter === 'All' || overallStatus === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const paginatedLogs = filteredLogs.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  const handleExportPDF = () => {
    exportL3ApprovalsPDF(filteredLogs, { searchQuery, statusFilter }, setToastMsg);
  };

  const handleExportRequestDetailsPDF = () => {
    const isL3Complete = selectedL1Details?.crStatus?.toLowerCase() === 'completed' || selectedLog?.status?.toLowerCase() === 'completed';
    // Export full details: L1, L2, L3 always. Conditionally pass effectiveness log.
    exportRequestDetailsPDF(selectedL1Details, selectedL2Details, selectedLog, 'all', setToastMsg, isL3Complete ? selectedEffDetails : null);
  };

  const currentChangeLog = selectedChangeId ? approvalLogs.find(log => log.changeNo === selectedChangeId) : null;
  const isChangeClosed = !!(currentChangeLog && currentChangeLog.qaApproval === 'Approved');
  const isL2Accepted = !selectedChangeId || currentChangeLog?.l2Decision === 'Accepted';
  let isAlreadyValidated = false;
  if (currentChangeLog) {
    let deptStatus = 'Pending';
    if (actingDept === 'PED') deptStatus = currentChangeLog.ped;
    else if (actingDept === 'QAD') deptStatus = currentChangeLog.qad;
    else if (actingDept === 'Production') deptStatus = currentChangeLog.production;
    else if (actingDept === 'Maintenance') deptStatus = currentChangeLog.maintenance;
    else if (actingDept === 'PC & L') deptStatus = currentChangeLog.pcl;
    else if (actingDept === 'Materials') deptStatus = currentChangeLog.materials;
    else if (actingDept === 'Marketing') deptStatus = currentChangeLog.marketing;
    else if (actingDept === 'HR') deptStatus = currentChangeLog.hr;
    else if (actingDept === 'Safety') deptStatus = currentChangeLog.safety;
    else if (actingDept === 'Unit Head') deptStatus = currentChangeLog.unitHead;

    isAlreadyValidated = deptStatus && deptStatus !== 'Pending';
  }

  const isAdmin = userRole && (
    userRole.toLowerCase() === 'admin' ||
    userRole.toLowerCase() === 'administrator'
  );

  const showAsValidated = isAlreadyValidated && !isAdmin;

  const isHOD = userRole && (
    userRole.toLowerCase().includes('hod') ||
    userRole.toLowerCase().includes('unit head') ||
    userRole.toLowerCase().includes('unit_head') ||
    userRole.toLowerCase().includes('manager')
  );



  const canEdit = isAdmin || isHOD;

  const getSelectedLogUserStatus = () => {
    if (!selectedLog) return '';
    let status = 'Pending';
    if (actingDept === 'PED') status = selectedLog.ped;
    else if (actingDept === 'QAD') status = selectedLog.qad;
    else if (actingDept === 'Production') status = selectedLog.production;
    else if (actingDept === 'Maintenance') status = selectedLog.maintenance;
    else if (actingDept === 'PC & L') status = selectedLog.pcl;
    else if (actingDept === 'Materials') status = selectedLog.materials;
    else if (actingDept === 'Marketing') status = selectedLog.marketing;
    else if (actingDept === 'HR') status = selectedLog.hr;
    else if (actingDept === 'Safety') status = selectedLog.safety;
    else if (actingDept === 'Unit Head') status = selectedLog.unitHead;
    return status;
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-[24px] animate-fade-in-up text-slate-800 pb-[40px] items-start">

      {/* LEFT COLUMN: Add L3 Approval Log Form */}
      <div className="lg:col-span-4 bg-white border border-slate-200/60 rounded-xl p-[24px] shadow-sm hover:shadow-md transition-all duration-300 space-y-[16px] h-fit relative">
        <div className="absolute inset-x-0 top-0 h-1 bg-[#0066cc] rounded-t-xl" />
        <div className="flex items-center gap-[8px] border-b border-slate-100 pb-[8px]">
          <Save size={16} className="text-[#0066cc]" />
          <h4 className="text-[13px] font-bold text-slate-900">Add L3 Approval Log</h4>
        </div>

        <form onSubmit={handleSaveApproval} className="space-y-[14px]">

          {selectedChangeId && isChangeClosed ? (
            <div className="bg-emerald-50 border border-emerald-250 text-emerald-700 rounded-lg p-3 text-[11px] leading-relaxed flex items-start gap-2 animate-fade-in-up">
              <CheckCircle2 size={14} className="shrink-0 mt-0.5 text-emerald-600" />
              <div>
                <span className="font-bold">Approvals Closed:</span> This request has been Approved and Closed at the Effectiveness Monitoring stage. No further L3 approvals can be submitted.
              </div>
            </div>
          ) : (
            <>
              {selectedChangeId && !isL2Accepted && (
                <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-lg p-3 text-[11px] leading-relaxed flex items-start gap-2 animate-fade-in-up">
                  <AlertTriangle size={14} className="shrink-0 mt-0.5 text-rose-600" />
                  <div>
                    <span className="font-bold">L3 Sign-off Blocked:</span> This request has not passed L2 validation (Current L2 Status: <span className="font-bold uppercase">{currentChangeLog?.l2Decision || 'Pending'}</span>). L3 approvals can only be submitted for accepted L2 requests.
                  </div>
                </div>
              )}

              {selectedChangeId && isL2Accepted && !canEdit && (
                <div className="bg-amber-50 border border-amber-200 text-amber-700 rounded-lg p-3 text-[11px] leading-relaxed flex items-start gap-2 animate-fade-in-up">
                  <AlertTriangle size={14} className="shrink-0 mt-0.5 text-amber-600" />
                  <div>
                    <span className="font-bold">Not Authorized:</span> Only department HODs or an Administrator can sign off at Level 3. (Your Role: <span className="font-bold uppercase">{userRole || 'User'}</span>)
                  </div>
                </div>
              )}
            </>
          )}

          {/* Acting Department (Admin) Select dropdown */}
          {(userRole === 'Admin' || userRole === 'Administrator' || (userRole && userRole.toLowerCase() === 'admin')) && (
            <div className="space-y-[4px]">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Acting Department (Admin) <span className="text-rose-500">*</span></label>
              <select
                value={actingDept}
                disabled={!selectedChangeId || isChangeClosed}
                onChange={(e) => setActingDept(e.target.value)}
                className="w-full bg-slate-50 disabled:bg-slate-100 disabled:cursor-not-allowed border border-slate-200 rounded-[6px] py-[8px] px-[12px] text-[12px] outline-none focus:border-[#0066cc] cursor-pointer"
              >
                <option value="PED">PED</option>
                <option value="QAD">QAD</option>
                <option value="Production">Production</option>
                <option value="Maintenance">Maintenance</option>
                <option value="PC & L">PC & L</option>
                <option value="Materials">Materials</option>
                <option value="Marketing">Marketing</option>
                <option value="HR">HR</option>
                <option value="Safety">Safety</option>
                <option value="Unit Head">Unit Head</option>
              </select>
            </div>
          )}

          {/* 4M CHANGE NO */}
          <div className="space-y-[4px]">
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">4M Change No <span className="text-rose-500">*</span></label>
            <input
              type="text"
              placeholder="Click a row to select"
              value={formChangeNo}
              disabled
              className="w-full bg-slate-100 border border-slate-200 rounded-[6px] py-[8px] px-[12px] text-[12px] outline-none text-slate-550 select-none"
            />
          </div>

          {/* REQUESTED DATE */}
          <div className="space-y-[4px]">
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Requested Date <span className="text-rose-500">*</span></label>
            <input
              type="text"
              placeholder="Click a row to select"
              value={formDate}
              disabled
              className="w-full bg-slate-100 border border-slate-200 rounded-[6px] py-[8px] px-[12px] text-[12px] outline-none text-slate-550 select-none"
            />
          </div>

          {/* CHANGE REQUEST BY */}
          <div className="space-y-[4px]">
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Change Request By <span className="text-rose-500">*</span></label>
            <input
              type="text"
              placeholder="Click a row to select"
              value={formRequester}
              disabled
              className="w-full bg-slate-100 border border-slate-200 rounded-[6px] py-[8px] px-[12px] text-[12px] outline-none text-slate-550 select-none"
            />
          </div>

          {/* APPROVAL STATUS */}
          <div className="space-y-[4px]">
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Approval Status <span className="text-rose-500">*</span></label>
            <select
              value={formStatus}
              disabled={!selectedChangeId || showAsValidated || !isL2Accepted || !canEdit || isChangeClosed}
              onChange={(e) => {
                setFormStatus(e.target.value);
                if (e.target.value && e.target.value !== 'Pending') {
                  setFieldErrors(prev => ({ ...prev, status: '' }));
                }
              }}
              className={`w-full bg-slate-50 disabled:bg-slate-100 disabled:cursor-not-allowed border rounded-[6px] py-[8px] px-[12px] text-[12px] outline-none cursor-pointer ${fieldErrors.status ? 'border-rose-400' : 'border-slate-200 focus:border-[#0066cc]'
                }`}
            >
              <option value="">Select Status</option>
              <option value="Approved">Approved</option>
              <option value="Rejected">Rejected</option>
            </select>
            {fieldErrors.status && (
              <p className="text-[11px] text-rose-500 flex items-center gap-1 mt-0.5">
                <span className="inline-block w-[3px] h-[3px] rounded-full bg-rose-500 mt-[1px]" />
                {fieldErrors.status}
              </p>
            )}
          </div>

          {/* Submit / Cancel row */}
          <div className="space-y-[8px] pt-[4px]">
            <button
              type="submit"
              disabled={isSubmitting || !selectedChangeId || showAsValidated || !isL2Accepted || !canEdit || isChangeClosed}
              className="w-full flex items-center justify-center gap-[6px] bg-[#e6f0fa] hover:bg-[#d6e6f5] disabled:opacity-50 disabled:cursor-not-allowed border border-[#b2d1f0] text-[#0066cc] py-[10px] rounded-[6px] text-[12px] font-bold transition-all transform active:scale-[0.98] cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="animate-spin" size={14} />
                  <span>Saving Log...</span>
                </>
              ) : isChangeClosed ? (
                <span>Approvals Closed</span>
              ) : showAsValidated ? (
                <span>Log Already Saved</span>
              ) : !selectedChangeId ? (
                <span>Select a Request to Approve</span>
              ) : !isL2Accepted ? (
                <span className="truncate">L3 Sign-off Disabled (L2 {currentChangeLog?.l2Decision || 'Pending'})</span>
              ) : !canEdit ? (
                <span>Not Authorized to Approve</span>
              ) : (
                <>
                  <Save size={14} />
                  <span>{isAlreadyValidated ? 'Update Approval Log' : 'Save Approval Log'}</span>
                </>
              )}
            </button>

            {selectedChangeId && (
              <button
                type="button"
                onClick={handleCancelEdit}
                className="w-full text-center py-[6px] text-slate-500 hover:text-slate-800 text-[11px] font-semibold cursor-pointer"
              >
                Cancel Selection
              </button>
            )}
          </div>
        </form>
      </div>

      {/* RIGHT COLUMN: Table area */}
      <div className="lg:col-span-8 space-y-[16px]">
        {/* Search & Actions bar */}
        <div className="flex gap-[8px] items-center text-[11px] flex-wrap">
          <div className="relative flex-grow min-w-[200px]">
            <Search className="absolute left-[10px] top-[10px] text-slate-400" size={14} />
            <input
              type="text"
              placeholder="Search by change no or requester..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-[30px] pr-[12px] py-[8px] border border-slate-200 rounded-[6px] outline-none bg-white text-[12px] focus:border-[#0066cc]"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className={`px-[12px] py-[8px] border rounded-[6px] outline-none text-[12px] min-w-[150px] transition-all duration-200 ${statusFilter === 'Approved' ? 'text-emerald-600 border-emerald-300 bg-emerald-50/10 font-bold' :
                statusFilter === 'Rejected' ? 'text-rose-600 border-rose-300 bg-rose-50/10 font-bold' :
                  statusFilter === 'Pending' ? 'text-amber-600 border-amber-300 bg-amber-50/10 font-bold' :
                    'text-slate-500 border-slate-200 bg-white font-medium'
              }`}
          >
            <option value="All" className="text-slate-500 bg-white font-medium" style={{ color: '#64748b' }}>All Approval Status</option>
            <option value="Approved" className="text-emerald-600 bg-white font-bold" style={{ color: '#059669', fontWeight: 'bold' }}>Approved</option>
            <option value="Pending" className="text-amber-600 bg-white font-bold" style={{ color: '#d97706', fontWeight: 'bold' }}>Pending</option>
            <option value="Rejected" className="text-rose-600 bg-white font-bold" style={{ color: '#e11d48', fontWeight: 'bold' }}>Rejected</option>
          </select>

          <button
            type="button"
            onClick={handleExportPDF}
            className="flex items-center gap-[6px] bg-[#0066cc] hover:bg-[#0052a3] text-white px-[12px] py-[8px] rounded-[6px] text-[12px] font-bold cursor-pointer transition-all shadow-sm duration-200 font-sans"
            title="Export L3 approval tracker matrix as PDF"
          >
            <Download size={14} />
            <span>Export PDF</span>
          </button>


        </div>

        {/* Table Matrix */}
        <div className="bg-white border border-slate-200/60 rounded-xl shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden">
          {/* Desktop Table View */}
          <div className="hidden md:block">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse table-fixed min-w-[1020px]">
                <thead>
                  <tr className="bg-[#fdfaf5] border-b border-slate-150 text-[10px]">
                    <th className="p-[8px] font-bold text-slate-500 uppercase tracking-wider w-[50px]">Sl No</th>
                    <th className="p-[8px] font-bold text-slate-500 uppercase tracking-wider w-[105px]">4M Change No</th>
                    <th className="p-[8px] font-bold text-slate-500 uppercase tracking-wider w-[90px]">Requested Date</th>
                    <th className="p-[8px] font-bold text-slate-500 uppercase tracking-wider w-[110px]">Change Request By</th>
                    <th className="p-[8px] font-bold text-slate-500 uppercase tracking-wider text-center w-[70px]">PED</th>
                    <th className="p-[8px] font-bold text-slate-500 uppercase tracking-wider text-center w-[70px]">QAD</th>
                    <th className="p-[8px] font-bold text-slate-500 uppercase tracking-wider text-center w-[80px]">Production</th>
                    <th className="p-[8px] font-bold text-slate-500 uppercase tracking-wider text-center w-[80px]">Maintenance</th>
                    <th className="p-[8px] font-bold text-slate-500 uppercase tracking-wider text-center w-[70px]">PC & L</th>
                    <th className="p-[8px] font-bold text-slate-500 uppercase tracking-wider text-center w-[80px]">Materials</th>
                    <th className="p-[8px] font-bold text-slate-500 uppercase tracking-wider text-center w-[80px]">Marketing</th>
                    <th className="p-[8px] font-bold text-slate-500 uppercase tracking-wider text-center w-[70px]">HR</th>
                    <th className="p-[8px] font-bold text-slate-500 uppercase tracking-wider text-center w-[70px]">Safety</th>
                    <th className="p-[8px] font-bold text-slate-500 uppercase tracking-wider text-center w-[85px]">Unit Head</th>
                    <th className="p-[8px] font-bold text-slate-500 uppercase tracking-wider text-center w-[65px]">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-[11px]">
                  {isFetchingLogs ? (
                    <tr>
                      <td colSpan={15} className="text-center py-[48px] text-slate-400">
                        <div className="flex flex-col items-center justify-center gap-[8px]">
                          <Loader2 className="animate-spin text-[#0066cc]" size={20} />
                          <span>Fetching approvals data...</span>
                        </div>
                      </td>
                    </tr>
                  ) : filteredLogs.length === 0 ? (
                    <tr>
                      <td colSpan={15} className="text-center py-[48px] text-slate-400">
                        No L3 validation approval records found.
                      </td>
                    </tr>
                  ) : (
                    paginatedLogs.map((log, idx) => {
                      const isSelected = selectedChangeId === log.changeNo;
                      return (
                        <tr
                          key={idx}
                          onClick={() => handleSelectRow(log)}
                          className={`hover:bg-slate-50/50 cursor-pointer transition-colors ${isSelected ? 'bg-sky-50/60 hover:bg-sky-50/60 border-l-[3px] border-l-[#0066cc]' : ''
                            }`}
                        >
                          <td className="p-[8px] font-bold text-slate-400">{page * rowsPerPage + idx + 1}</td>
                          <td className="p-[8px] font-bold text-[#0066cc]">{log.changeNo}</td>
                          <td className="p-[8px] text-slate-500">{formatDateToDDMMYYYY(log.date)}</td>
                          <td className="p-[8px] font-medium text-slate-700 truncate" title={log.requester}>{log.requester}</td>

                          {/* Department Badges */}
                          {[
                            { val: log.ped, type: 'ped' },
                            { val: log.qad, type: 'qad' },
                            { val: log.production, type: 'production' },
                            { val: log.maintenance, type: 'maintenance' },
                            { val: log.pcl, type: 'pcl' },
                            { val: log.materials, type: 'materials' },
                            { val: log.marketing, type: 'marketing' },
                            { val: log.hr, type: 'hr' },
                            { val: log.safety, type: 'safety' },
                            { val: log.unitHead, type: 'unitHead' }
                          ].map((cell, cIdx) => {
                            const status = cell.val;
                            const isAccepted = status === 'Accepted' || status === 'Approved';
                            const isRejected = status === 'Rejected';
                            return (
                              <td key={cIdx} className="p-[8px] text-center">
                                <span className={`inline-block w-full text-center px-[4px] py-[2px] rounded-[4px] border text-[9px] font-bold ${isAccepted
                                    ? 'bg-emerald-50 border-emerald-250 text-emerald-700'
                                    : isRejected
                                      ? 'bg-rose-50 border-rose-250 text-rose-700'
                                      : 'bg-amber-50 border-amber-250 text-amber-700'
                                  }`}>
                                  {status}
                                </span>
                              </td>
                            );
                          })}

                          <td className="p-[8px] text-center" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => handleViewDetails(log)}
                              className="p-[4px] hover:bg-slate-100 rounded text-slate-400 hover:text-[#0066cc] transition-colors cursor-pointer"
                            >
                              <Eye size={12} />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile Cards View */}
          <div className="flex md:hidden flex-col gap-[12px] p-[12px] bg-slate-50">
            {isFetchingLogs ? (
              <div className="flex flex-col items-center justify-center py-[24px] text-slate-400">
                <Loader2 className="animate-spin text-[#0066cc]" size={20} />
                <span className="text-[12px] mt-1">Fetching approvals data...</span>
              </div>
            ) : filteredLogs.length === 0 ? (
              <div className="text-center py-[24px] text-slate-400 text-[12px]">
                No L3 validation approval records found.
              </div>
            ) : (
              paginatedLogs.map((log, idx) => {
                const isSelected = selectedChangeId === log.changeNo;
                return (
                  <div
                    key={idx}
                    onClick={() => handleSelectRow(log)}
                    className={`bg-white border rounded-[12px] p-[16px] shadow-sm hover:shadow-md transition-all duration-300 flex flex-col gap-[12px] ${isSelected ? 'border-[#0066cc] ring-2 ring-[#0066cc]/10' : 'border-slate-200'
                      }`}
                  >
                    <div className="flex justify-between items-center border-b border-slate-100 pb-[8px]">
                      <span className="font-mono font-bold text-[#0066cc] text-[12px] bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100">
                        {log.changeNo}
                      </span>
                      <span className="text-[11px] text-slate-550 font-semibold">{formatDateToDDMMYYYY(log.date)}</span>
                    </div>

                    <div className="flex flex-col gap-[2px]">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-sans">Change Request By</span>
                      <span className="text-[12px] font-semibold text-slate-800 break-words">{log.requester}</span>
                    </div>

                    <div className="flex flex-col gap-[6px] border-t border-slate-100 pt-[10px]">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-sans">L3 Approval Matrix</span>
                      <div className="grid grid-cols-2 gap-2 mt-1">
                        {[
                          { label: 'PED', val: log.ped },
                          { label: 'QAD', val: log.qad },
                          { label: 'Production', val: log.production },
                          { label: 'Maintenance', val: log.maintenance },
                          { label: 'PC & L', val: log.pcl },
                          { label: 'Materials', val: log.materials },
                          { label: 'Marketing', val: log.marketing },
                          { label: 'HR', val: log.hr },
                          { label: 'Safety', val: log.safety },
                          { label: 'Unit Head', val: log.unitHead }
                        ].map((dept, dIdx) => {
                          const status = dept.val || 'Pending';
                          const isAccepted = status === 'Accepted' || status === 'Approved';
                          const isRejected = status === 'Rejected';
                          return (
                            <div key={dIdx} className="flex justify-between items-center bg-slate-50 border border-slate-100 rounded px-2 py-1 text-[10px]">
                              <span className="font-bold text-slate-550">{dept.label}</span>
                              <span className={`inline-block px-[5px] py-[0.5px] rounded-[3px] border text-[8px] font-bold ${isAccepted
                                  ? 'bg-emerald-50 border-emerald-250 text-emerald-700'
                                  : isRejected
                                    ? 'bg-rose-50 border-rose-250 text-rose-700'
                                    : 'bg-amber-50 border-amber-250 text-amber-700'
                                }`}>
                                {status}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="flex justify-end border-t border-slate-100 pt-[12px] mt-[4px]">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleViewDetails(log);
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 rounded-lg text-[11px] font-bold text-slate-600 hover:border-[#0066cc] hover:text-[#0066cc] hover:bg-blue-50 transition-all shadow-sm cursor-pointer"
                      >
                        <Eye size={12} />
                        View Full Details
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
          <TablePagination
            rowsPerPageOptions={[5, 10]}
            component="div"
            count={filteredLogs.length}
            rowsPerPage={rowsPerPage}
            page={page}
            onPageChange={(event, newPage) => setPage(newPage)}
            onRowsPerPageChange={(event) => {
              setRowsPerPage(parseInt(event.target.value, 10));
              setPage(0);
            }}
            className="border-t border-slate-100"
          />
        </div>
      </div>

      {/* L3 Details Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-[16px]">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity"
            onClick={() => setSelectedLog(null)}
          />

          {/* Modal Container */}
          <div className="relative bg-white w-full max-w-[800px] max-h-[90vh] rounded-[16px] shadow-2xl border border-slate-200 overflow-hidden flex flex-col z-10 animate-fade-in-up">
            {/* Header */}
            <div className="bg-gradient-to-r from-slate-50 to-slate-100/50 px-[24px] py-[18px] border-b border-slate-200 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-[10px]">
                <span className="p-2 bg-[#e6f0fa] text-[#0066cc] rounded-lg">
                  <Eye size={18} />
                </span>
                <div>
                  <h4 className="text-[15px] font-bold text-slate-900">Change Request Details (L1, L2, L3, Effectiveness)</h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">Tracking details for: <span className="font-mono font-bold text-slate-600">{selectedLog.changeNo}</span></p>
                </div>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="p-[6px] hover:bg-slate-200/60 rounded-full text-slate-400 hover:text-slate-650 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Tabs Header */}
            <div className="flex h-11 border-b border-slate-200 bg-slate-50/50 shrink-0">
              <button
                onClick={() => setActiveTab('l1')}
                className={`flex-1 h-full flex items-center justify-center text-[12px] font-bold border-b-2 transition-colors ${activeTab === 'l1'
                  ? 'border-[#0066cc] text-[#0066cc]'
                  : 'border-transparent text-slate-500 hover:text-slate-850'
                  }`}
              >
                1. L1 Request
              </button>
              {selectedL1Details?.hodStatus !== 'Rejected' && (
                <button
                  onClick={() => setActiveTab('l2')}
                  className={`flex-1 h-full flex items-center justify-center text-[12px] font-bold border-b-2 transition-colors ${activeTab === 'l2'
                    ? 'border-[#0066cc] text-[#0066cc]'
                    : 'border-transparent text-slate-500 hover:text-slate-850'
                    }`}
                >
                  2. L2 Validation
                </button>
              )}
              {selectedL1Details?.hodStatus !== 'Rejected' && selectedL2Details?.status === 'Accepted' && (
                <button
                  onClick={() => setActiveTab('l3')}
                  className={`flex-1 h-full flex items-center justify-center text-[12px] font-bold border-b-2 transition-colors ${activeTab === 'l3'
                    ? 'border-[#0066cc] text-[#0066cc]'
                    : 'border-transparent text-slate-500 hover:text-slate-850'
                    }`}
                >
                  3. L3 Approval
                </button>
              )}
              {selectedL1Details?.hodStatus !== 'Rejected' && selectedL2Details?.status === 'Accepted' && (
                (() => {
                  const currentEffLog = selectedEffDetails;
                  const isEffRejected = currentEffLog && (
                    currentEffLog.qaApproval === 'Rejected' ||
                    currentEffLog.status === 'Effectiveness Not Ok' ||
                    currentEffLog.status === 'Rejected'
                  );
                  return (
                    <button
                      onClick={() => setActiveTab('effectiveness')}
                      className={`flex-1 h-full flex items-center justify-center text-[12px] font-bold border-b-2 transition-colors ${activeTab === 'effectiveness'
                        ? isEffRejected
                          ? 'border-rose-600 text-rose-600 font-extrabold bg-rose-50/30'
                          : 'border-[#0066cc] text-[#0066cc]'
                        : isEffRejected
                          ? 'border-transparent text-rose-655 hover:text-rose-800 bg-rose-50/10'
                          : 'border-transparent text-slate-500 hover:text-slate-850'
                        }`}
                    >
                      {isEffRejected && <AlertTriangle size={12} className="text-rose-600 mr-1 animate-pulse" />}
                      4. Effectiveness
                    </button>
                  );
                })()
              )}
            </div>

            {/* Content */}
            <div className={`p-[24px] overflow-y-auto space-y-[24px] text-[13px] text-slate-600 flex-1 ${isFetchingDetails ? 'flex flex-col justify-center items-center' : ''}`}>
              {isFetchingDetails ? (
                <div className="flex flex-col items-center justify-center py-[60px] gap-3 text-slate-400 my-auto animate-pulse">
                  <Loader2 className="animate-spin text-[#0066cc]" size={32} />
                  <span className="text-sm font-semibold text-slate-700">Loading Change Request details...</span>
                </div>
              ) : (
                <>
                  {activeTab === 'l1' && selectedL1Details && (
                    <div className="space-y-[20px] animate-fade-in-up">
                      {/* General Info */}
                      <div className="space-y-[12px]">
                        <h5 className="text-[12px] font-bold text-[#0066cc] uppercase tracking-wider border-b border-slate-100 pb-1.5 flex items-center gap-1.5">
                          <Folder size={14} />
                          <span>General Information</span>
                        </h5>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-[16px]">
                          <div className="space-y-[4px]">
                            <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Change No</span>
                            <span className="font-mono font-bold text-slate-800">{selectedL1Details.change_no}</span>
                          </div>
                          <div className="space-y-[4px]">
                            <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Requested Date</span>
                            <span className="font-medium text-slate-700">{selectedL1Details.crDate ? formatDateToDDMMYYYY(selectedL1Details.crDate) : '-'}</span>
                          </div>
                          <div className="space-y-[4px]">
                            <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Requested Time</span>
                            <span className="font-medium text-slate-700">{selectedL1Details.requested_time}</span>
                          </div>
                          <div className="space-y-[4px]">
                            <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Status</span>
                            <div className="flex gap-1.5 items-center mt-0.5">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${selectedL1Details.hodStatus === 'Rejected'
                                ? 'bg-rose-50 border-rose-220 text-rose-700'
                                : (selectedL1Details.hodStatus === 'Approved' || selectedL1Details.crStatus !== 'Pending')
                                  ? 'bg-emerald-50 border-emerald-220 text-emerald-700'
                                  : 'bg-amber-50 border-amber-220 text-amber-700'
                                }`}>
                                L1 {selectedL1Details.hodStatus === 'Rejected' ? 'Rejected' : ((selectedL1Details.hodStatus === 'Approved' || selectedL1Details.crStatus !== 'Pending') ? 'Approved' : 'Pending')}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-[16px] mt-[12px]">
                          <div className="space-y-[4px]">
                            <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Unit</span>
                            <span className="font-medium text-slate-700">{selectedL1Details.unit}</span>
                          </div>
                          <div className="space-y-[4px]">
                            <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Change In</span>
                            <span className="font-medium text-slate-750">{selectedL1Details.change_in}</span>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-[16px] mt-[12px]">
                          <div className="space-y-[4px] min-w-0">
                            <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Requested By</span>
                            <span className="font-semibold text-slate-800 block break-words">{selectedL1Details.request_by}</span>
                            {selectedL1Details.crRequester && selectedL1Details.crRequester.toLowerCase() !== selectedL1Details.request_by?.toLowerCase() && (
                              <span className="block text-[11px] text-slate-400 mt-0.5 font-mono break-all">{selectedL1Details.crRequester}</span>
                            )}
                          </div>
                          <div className="space-y-[4px]">
                            <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Department</span>
                            <span className="font-medium text-slate-700">{selectedL1Details.dept}</span>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-3 gap-[16px] mt-[12px]">
                          <div className="space-y-[4px] min-w-0">
                            <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Process Name</span>
                            <span className="font-medium text-slate-700 block break-words break-all">{selectedL1Details.process_name}</span>
                          </div>
                          <div className="space-y-[4px] min-w-0">
                            <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Process Line</span>
                            <span className="font-medium text-slate-700 block break-words break-all">{selectedL1Details.process_line}</span>
                          </div>
                          <div className="space-y-[4px] col-span-2 md:col-span-1 min-w-0">
                            <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Machine No</span>
                            <span className="font-mono text-slate-700 block break-words break-all">{selectedL1Details.machine_no}</span>
                          </div>
                        </div>
                      </div>

                      {/* Change Description */}
                      <div className="space-y-[12px] pt-4 border-t border-slate-100">
                        <h5 className="text-[12px] font-bold text-[#0066cc] uppercase tracking-wider border-b border-slate-100 pb-1.5 flex items-center gap-1.5">
                          <FileText size={14} />
                          <span>Change Description</span>
                        </h5>
                        <div className="grid grid-cols-1 gap-[16px]">
                          <div className="space-y-[6px] min-w-0">
                            <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider font-sans">Context of Change</span>
                            <div className="bg-slate-50 border border-slate-200 rounded-[8px] p-3 text-slate-700 min-h-[40px] leading-relaxed break-words whitespace-pre-wrap">
                              {selectedL1Details.title ? selectedL1Details.title.replace(/^\[L1 Request - [^\]]*\]\s*/, '') : ''}
                            </div>
                          </div>
                          <div className="space-y-[6px] min-w-0">
                            <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider font-sans">Detailed Change Description</span>
                            <div className="bg-slate-50 border border-slate-200 rounded-[8px] p-3 text-slate-700 min-h-[60px] leading-relaxed break-words whitespace-pre-wrap">
                              {selectedL1Details.description}
                            </div>
                          </div>
                        </div>
                        {selectedL1Details.file_desc && (
                          <div className="space-y-[4px] mt-2">
                            <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Supporting Files</span>
                            {renderL1FilePill(selectedL1Details.file_desc, selectedL1Details.change_no)}
                          </div>
                        )}
                      </div>

                      {/* Implementation Timeline */}
                      <div className="space-y-[12px] pt-4 border-t border-slate-100">
                        <h5 className="text-[12px] font-bold text-[#0066cc] uppercase tracking-wider border-b border-slate-100 pb-1.5 flex items-center gap-1.5">
                          <Calendar size={14} />
                          <span>Implementation Timeline</span>
                        </h5>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-[16px]">
                          <div className="space-y-[12px]">
                            <div className="space-y-[4px]">
                              <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Change Improvement Area</span>
                              <span className="font-semibold text-slate-800 text-xs block mt-0.5">{selectedL1Details.improvement_area || '-'}</span>
                            </div>

                            <div className="space-y-[4px]">
                              <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Supporting Files (Improvement)</span>
                              {selectedL1Details.file_improvement ? renderL1FilePill(selectedL1Details.file_improvement, selectedL1Details.change_no) : <span className="text-slate-500 font-medium text-xs">-</span>}
                            </div>

                            <div className="space-y-[4px]">
                              <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Permanent / Temporary Change</span>
                              <span className="font-semibold text-slate-800 text-xs block mt-0.5">{selectedL1Details.change_type || '-'}</span>
                            </div>

                            <div className="space-y-[4px]">
                              <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Implement / Change Date Start</span>
                              <span className="font-semibold text-slate-750 flex items-center gap-1.5 mt-0.5">
                                <Calendar size={13} className="text-slate-400" />
                                {selectedL1Details.date_start ? formatDateToDDMMYYYY(selectedL1Details.date_start) : '-'}
                              </span>
                            </div>

                            <div className="space-y-[4px]">
                              <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Part Traceability Details (From Changes)</span>
                              <div className="bg-slate-50 border border-slate-200 rounded-[8px] p-3 text-slate-700 min-h-[60px] leading-relaxed break-words text-xs">
                                {selectedL1Details.trace_from || '-'}
                              </div>
                              {selectedL1Details.file_trace_from && (
                                <div className="mt-2 space-y-[4px]">
                                  <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Supporting Files (Traceability From)</span>
                                  {renderL1FilePill(selectedL1Details.file_trace_from, selectedL1Details.change_no)}
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="space-y-[12px]">
                            <div className="space-y-[4px]">
                              <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Change Date Close</span>
                              <span className="font-semibold text-slate-750 flex items-center gap-1.5 mt-0.5">
                                <Calendar size={13} className="text-slate-400" />
                                {selectedL1Details.date_close ? formatDateToDDMMYYYY(selectedL1Details.date_close) : 'N/A'}
                              </span>
                            </div>

                            <div className="space-y-[4px]">
                              <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Part Traceability Details (To Changes)</span>
                              <div className="bg-slate-50 border border-slate-200 rounded-[8px] p-3 text-slate-700 min-h-[60px] leading-relaxed break-words text-xs">
                                {selectedL1Details.trace_to || '-'}
                              </div>
                              {selectedL1Details.file_trace_to && (
                                <div className="mt-2 space-y-[4px]">
                                  <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Supporting Files (Traceability To)</span>
                                  {renderL1FilePill(selectedL1Details.file_trace_to, selectedL1Details.change_no)}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* TABLE VIEW FOR IMPROVEMENT DATA */}
                        {(() => {
                          if (!selectedL1Details.improvement_table_data) return null;
                          let tableData;
                          try {
                            tableData = JSON.parse(selectedL1Details.improvement_table_data);
                          } catch (e) {
                            return null;
                          }
                          if (!Array.isArray(tableData) || tableData.length === 0) return null;

                          const area = (selectedL1Details.improvement_area || '').toLowerCase();
                          const hasCost = area === 'cost';
                          const hasProductivity = area === 'productivity';
                          const hasQuality = area === 'quality';

                          if (!hasCost && !hasProductivity && !hasQuality) return null;

                          return (
                            <div className="mt-3 border border-slate-200 rounded-[8px] overflow-hidden bg-white max-w-md">
                              <div className="bg-slate-50 px-3 py-2 border-b border-slate-200 text-[10px] font-bold text-slate-650 uppercase tracking-wider">
                                {hasCost ? 'Cost Saving Data' : hasProductivity ? 'Productivity Improvement Data' : 'Quality Improvement Data'}
                              </div>
                              <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse text-[11px]">
                                  <thead>
                                    <tr className="bg-slate-100/50 border-b border-slate-200 text-slate-500 font-semibold">
                                      <th className="p-2 w-[50px]">Sl No</th>
                                      <th className="p-2">4M #</th>
                                      <th className="p-2">Date</th>
                                      {hasCost && (
                                        <>
                                          <th className="p-2">Save/Month</th>
                                          <th className="p-2">Save/Annum</th>
                                          <th className="p-2">ROI</th>
                                        </>
                                      )}
                                      {hasProductivity && (
                                        <>
                                          <th className="p-2">Current</th>
                                          <th className="p-2">Improved</th>
                                        </>
                                      )}
                                      {hasQuality && (
                                        <>
                                          <th className="p-2">Current PPM</th>
                                          <th className="p-2">Reduced PPM</th>
                                        </>
                                      )}
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100">
                                    {tableData.map((row, idx) => (
                                      <tr key={idx} className="hover:bg-slate-50/50 text-slate-700">
                                        <td className="p-2 font-bold text-slate-400">{idx + 1}</td>
                                        <td className="p-2 font-mono font-medium">{row.changeNo}</td>
                                        <td className="p-2">{row.date || '-'}</td>
                                        {hasCost && (
                                          <>
                                            <td className="p-2 font-semibold">Rs. {row.monthlySave || '0'}</td>
                                            <td className="p-2 font-semibold">Rs. {row.annualSave || '0'}</td>
                                            <td className="p-2">{row.roi || '-'}</td>
                                          </>
                                        )}
                                        {hasProductivity && (
                                          <>
                                            <td className="p-2">{row.currentProd || '0'} nos</td>
                                            <td className="p-2 font-semibold">{row.improvedProd || '0'} nos</td>
                                          </>
                                        )}
                                        {hasQuality && (
                                          <>
                                            <td className="p-2">{row.currentPpm || '0'}</td>
                                            <td className="p-2 font-semibold">{row.reducedPpm || '0'}</td>
                                          </>
                                        )}
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          );
                        })()}
                      </div>

                      {/* Risk Analysis Card */}
                      <div className="space-y-[16px] pt-4 border-t border-slate-100">
                        <h5 className="text-[13px] font-bold text-slate-900 border-b border-slate-100 pb-1.5 flex items-center gap-1.5">
                          <span>Risk Analysis</span>
                        </h5>

                        <div className="space-y-[4px] min-w-0">
                          <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider font-sans">Risk Analysis</span>
                          <div className="bg-slate-50 border border-slate-200 rounded-[8px] p-3 text-slate-700 min-h-[60px] leading-relaxed break-words text-[12px] font-medium">
                            {selectedL1Details.risk_analysis || '-'}
                          </div>
                        </div>

                        <div className="space-y-[4px] min-w-0">
                          <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider font-sans">Supporting Files (Risk Analysis)</span>
                          {selectedL1Details.file_risk && selectedL1Details.file_risk !== '-' ? (
                            renderL1FilePill(selectedL1Details.file_risk, selectedL1Details.change_no)
                          ) : (
                            <span className="text-[12px] text-slate-400 italic">No file attached</span>
                          )}
                        </div>

                        <div className="space-y-[4px] min-w-0">
                          <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider font-sans">Update in SOP / WI / Control Plan / FMEA</span>
                          <div className="bg-slate-50 border border-slate-200 rounded-[8px] p-3 text-slate-700 min-h-[60px] leading-relaxed break-words text-[12px] font-medium">
                            {selectedL1Details.sop_update || '-'}
                          </div>
                        </div>

                        <div className="space-y-[4px] min-w-0">
                          <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider font-sans">Supporting Files (SOP, WI, Control Plan, FMEA)</span>
                          {selectedL1Details.file_sop && selectedL1Details.file_sop !== '-' ? (
                            renderL1FilePill(selectedL1Details.file_sop, selectedL1Details.change_no)
                          ) : (
                            <span className="text-[12px] text-slate-400 italic">No file attached</span>
                          )}
                        </div>

                        <div className="space-y-[4px]">
                          <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">User Dept HOD Approval</span>
                          {selectedL1Details.hod_approval ? (
                            <div className="pt-1">
                              <span className="inline-flex items-center gap-[6px] px-[10px] py-[6px] border border-[#0066cc] bg-[#0066cc]/5 text-[#0066cc] rounded-[6px] text-[10px] font-bold shadow-sm select-none">
                                <span className="w-[12px] h-[12px] rounded-full border border-[#0066cc] flex items-center justify-center">
                                  <span className="w-[6px] h-[6px] rounded-full bg-[#0066cc]" />
                                </span>
                                <span>{selectedL1Details.hod_approval}</span>
                              </span>
                            </div>
                          ) : (
                            <span className="text-[12px] text-slate-400 italic">No department selected</span>
                          )}
                        </div>

                        <div className="space-y-[4px]">
                          {showCustomerApproval && (
                            <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Customer Approval Required</span>
                          )}
                          <span className="font-semibold text-slate-750 flex items-center gap-1.5 mt-0.5 text-[12px]">
                            <span>{showCustomerApproval ? (selectedL1Details.customer_approval || '-') : '••••'}</span>
                            <button
                              type="button"
                              onClick={() => setShowCustomerApproval(!showCustomerApproval)}
                              className="p-0.5 hover:bg-slate-200/60 rounded text-slate-400 hover:text-[#0066cc] transition-colors cursor-pointer ml-1 inline-flex items-center justify-center"
                              title={showCustomerApproval ? "Hide Customer Approval" : "Show Customer Approval"}
                            >
                              {showCustomerApproval ? <EyeOff size={13} /> : <Eye size={13} />}
                            </button>
                          </span>
                        </div>

                        {selectedL1Details.hodStatus && (
                          <div className="space-y-[4px] mt-4 border-t border-slate-100 pt-4">
                            <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">HOD {selectedL1Details.hodStatus} Remarks / Comments ({selectedL1Details.hodDept || 'HOD'})</span>
                            <div className="bg-slate-50 border border-slate-200 rounded-[8px] p-[16px] text-slate-700 leading-relaxed min-h-[80px] max-h-[150px] overflow-y-auto break-words text-[12px]">
                              {selectedL1Details.hodRemarks || 'No remarks provided.'}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {activeTab === 'l2' && (
                    !selectedL2Details ? (
                      <div className="text-center py-[64px] bg-slate-50 rounded-xl border border-dashed border-slate-200">
                        <AlertTriangle className="mx-auto mb-[12px] text-slate-350" size={32} />
                        <span className="text-slate-400 font-medium">No L2 Validation Details found for this request.</span>
                      </div>
                    ) : (
                      <div className="space-y-[20px] animate-fade-in-up">
                        <h5 className="text-[12px] font-bold text-[#0066cc] uppercase tracking-wider border-b border-slate-100 pb-1.5 flex items-center gap-1.5">
                          <CheckCircle2 size={14} />
                          <span>L2 Validation Details</span>
                        </h5>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-[16px] bg-slate-50 border border-slate-150 rounded-[10px] p-[16px]">
                          <div className="space-y-[4px]">
                            <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Validation Date</span>
                            <span className="font-medium text-slate-700">{selectedL2Details.date || '-'}</span>
                          </div>
                          <div className="space-y-[4px]">
                            <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Validated By</span>
                            <span className="font-semibold text-slate-800">{selectedL2Details.requester || '-'}</span>
                          </div>
                          <div className="space-y-[4px]">
                            <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Validation Status</span>
                            <div>
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${selectedL2Details.status === 'Accepted'
                                ? 'bg-emerald-50 border-emerald-220 text-emerald-700'
                                : selectedL2Details.status === 'Rejected'
                                  ? 'bg-rose-50 border-rose-220 text-rose-700'
                                  : 'bg-amber-50 border-amber-220 text-amber-700'
                                }`}>
                                L2 {selectedL2Details.status === 'Accepted' ? 'Approved' : (selectedL2Details.status || 'Pending')}
                              </span>
                            </div>
                          </div>
                          <div className="space-y-[4px]">
                            <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Change No</span>
                            <span className="font-mono font-bold text-slate-800">{selectedL2Details.changeNo}</span>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-[16px] mt-4">
                          <div className="space-y-[6px]">
                            <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider font-sans">PED Validation Attachment</span>
                            <div className="space-y-2">
                              {!selectedL2Details.weldTest || selectedL2Details.weldTest === '-' ? (
                                <div className="bg-slate-50 border border-slate-200 rounded-[8px] p-3 text-slate-550 text-[12px] font-medium">-</div>
                              ) : (
                                selectedL2Details.weldTest.split(',').map(s => s.trim()).filter(Boolean).map((file, idx) => (
                                  <div key={idx} className="bg-slate-50 border border-slate-200 rounded-[8px] p-3 text-slate-700 flex items-center justify-between">
                                    <span className="font-medium text-slate-655 truncate max-w-[200px]" title={file}>{file}</span>
                                    <span
                                      className="text-[11px] font-semibold text-[#0066cc] hover:underline cursor-pointer select-none"
                                      onClick={() => handleViewAttachment(file, selectedL2Details.changeNo, 'L2')}
                                    >
                                      Preview
                                    </span>
                                  </div>
                                ))
                              )}
                            </div>
                          </div>

                          <div className="space-y-[6px]">
                            <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider font-sans">QAD Setup Verification Attachment</span>
                            <div className="space-y-2">
                              {!selectedL2Details.qaTest || selectedL2Details.qaTest === '-' ? (
                                <div className="bg-slate-50 border border-slate-200 rounded-[8px] p-3 text-slate-550 text-[12px] font-medium">-</div>
                              ) : (
                                selectedL2Details.qaTest.split(',').map(s => s.trim()).filter(Boolean).map((file, idx) => (
                                  <div key={idx} className="bg-slate-50 border border-slate-200 rounded-[8px] p-3 text-slate-700 flex items-center justify-between">
                                    <span className="font-medium text-slate-655 truncate max-w-[200px]" title={file}>{file}</span>
                                    <span
                                      className="text-[11px] font-semibold text-[#0066cc] hover:underline cursor-pointer select-none"
                                      onClick={() => handleViewAttachment(file, selectedL2Details.changeNo, 'L2')}
                                    >
                                      Preview
                                    </span>
                                  </div>
                                ))
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="space-y-[4px] mt-4">
                          <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Validator Remarks / Comments</span>
                          <div className="bg-slate-50 border border-slate-200 rounded-[8px] p-[16px] text-slate-700 leading-relaxed min-h-[80px] max-h-[150px] overflow-y-auto break-words">
                            {selectedL2Details.remarks || 'No remarks provided.'}
                          </div>
                        </div>
                      </div>
                    )
                  )}

                  {activeTab === 'l3' && selectedLog && (
                    <div className="space-y-[24px] animate-fade-in-up">
                      <h5 className="text-[12px] font-bold text-[#0066cc] uppercase tracking-wider border-b border-slate-100 pb-1.5 flex items-center gap-1.5">
                        <Cpu size={14} />
                        <span>L3 Approval Status Matrix</span>
                      </h5>

                      {/* Metadata */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-[16px] pb-[16px] border-b border-slate-100">
                        <div className="space-y-[4px]">
                          <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">4M Change No</span>
                          <span className="font-bold text-[#0066cc] text-[13px]">{selectedLog.changeNo}</span>
                        </div>
                        <div className="space-y-[4px]">
                          <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Change Request By</span>
                          <span className="font-medium text-slate-700">{selectedLog.requester}</span>
                        </div>
                        <div className="space-y-[4px]">
                          <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Requested Date</span>
                          <span className="font-medium text-slate-700">{selectedLog.date ? formatDateToDDMMYYYY(selectedLog.date) : '-'}</span>
                        </div>
                      </div>

                      {/* Matrix Grid */}
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-[12px]">
                        {[
                          { label: 'PED', prop: 'ped' },
                          { label: 'QAD', prop: 'qad' },
                          { label: 'Production', prop: 'production' },
                          { label: 'Maintenance', prop: 'maintenance' },
                          { label: 'PC & L', prop: 'pcl' },
                          { label: 'Materials', prop: 'materials' },
                          { label: 'Marketing', prop: 'marketing' },
                          { label: 'HR', prop: 'hr' },
                          { label: 'Safety', prop: 'safety' },
                          { label: 'Unit Head', prop: 'unitHead' }
                        ].map((dept, index) => {
                          const status = selectedLog[dept.prop] || 'Pending';
                          const isAccepted = status === 'Accepted' || status === 'Approved';
                          const isRejected = status === 'Rejected';
                          const badgeClass = isAccepted
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                            : isRejected
                              ? 'bg-rose-50 border-rose-200 text-rose-700'
                              : 'bg-amber-50 border-amber-200 text-amber-700';

                          return (
                            <div
                              key={index}
                              className="bg-slate-50 border border-slate-150 rounded-[10px] p-[12px] flex flex-col items-center justify-center text-center gap-[6px] shadow-sm hover:shadow transition-shadow"
                            >
                              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{dept.label}</span>
                              <span className={`inline-block px-[10px] py-[3px] rounded-full border text-[10px] font-bold shadow-sm ${badgeClass}`}>
                                L3 {status}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {activeTab === 'effectiveness' && (
                    (() => {
                      const currentEffLog = selectedEffDetails;

                      if (!currentEffLog) {
                        return (
                          <div className="text-center py-[64px] bg-slate-50 rounded-xl border border-dashed border-slate-200">
                            <AlertTriangle className="mx-auto mb-[12px] text-slate-350" size={32} />
                            <span className="text-slate-455 font-medium">Effectiveness monitoring log is pending creation/validation for this request.</span>
                          </div>
                        );
                      }

                      return (
                        <div className="space-y-[20px] animate-fade-in-up font-sans">
                          <h5 className="text-[12px] font-bold text-[#0066cc] uppercase tracking-wider border-b border-slate-100 pb-1.5 flex items-center gap-1.5 font-sans">
                            <Save size={14} />
                            <span>Effectiveness Monitoring Log Details</span>
                          </h5>

                          <div className="grid grid-cols-2 md:grid-cols-4 gap-[16px] bg-slate-50 border border-slate-150 rounded-[10px] p-[16px]">
                            <div className="space-y-[4px]">
                              <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Change No</span>
                              <span className="font-mono font-bold text-slate-800">{currentEffLog.changeNo}</span>
                            </div>
                            <div className="space-y-[4px]">
                              <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Requested Date</span>
                              <span className="font-medium text-slate-700">{formatDateShort(currentEffLog.reqDate)}</span>
                            </div>
                            <div className="space-y-[4px]">
                              <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Change Date Start</span>
                              <span className="font-medium text-slate-700">{formatDateShort(currentEffLog.startDate)}</span>
                            </div>
                            <div className="space-y-[4px]">
                              <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Month Wise</span>
                              <span className="font-medium text-slate-700">{formatMonthWise(currentEffLog.monthWise)}</span>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-[16px] mt-4">
                            <div className="space-y-[4px]">
                              <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider font-sans">Effectiveness Status</span>
                              <div>
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${currentEffLog.status === 'Effectiveness Ok'
                                  ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                                  : currentEffLog.status === 'Pending'
                                    ? 'bg-amber-50 border-amber-200 text-amber-700'
                                    : 'bg-rose-50 border-rose-255 text-rose-700'
                                  }`}>
                                  {currentEffLog.status}
                                </span>
                              </div>
                            </div>
                            <div className="space-y-[4px]">
                              <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider font-sans">QAD Approval</span>
                              <div>
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${currentEffLog.qaApproval === 'Approved'
                                  ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                                  : currentEffLog.qaApproval === 'Pending'
                                    ? 'bg-amber-50 border-amber-200 text-amber-700'
                                    : 'bg-rose-50 border-rose-250 text-rose-700'
                                  }`}>
                                  {currentEffLog.qaApproval}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="space-y-[6px] mt-4">
                            <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider font-sans">Attachments</span>
                            {currentEffLog.attachment ? (
                              <div className="flex flex-wrap gap-1.5">
                                {currentEffLog.attachment.split(',').map(s => s.trim()).filter(Boolean).map((file, idx) => (
                                  <span
                                    key={idx}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleViewAttachment(file, currentEffLog, 'Effectiveness');
                                    }}
                                    className="inline-flex items-center gap-1 bg-slate-50 border border-slate-150 text-[11px] font-medium text-slate-700 px-2.5 py-1 rounded-full hover:bg-slate-100 hover:border-teal-500 hover:text-teal-700 cursor-pointer"
                                    title="Click to view file"
                                  >
                                    📎 {file}
                                  </span>
                                ))}
                              </div>
                            ) : '-'}
                          </div>

                          <div className="space-y-[4px] mt-4">
                            <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider font-sans">Remarks / Comments</span>
                            <div className="bg-slate-50 border border-slate-150 rounded-[8px] p-[16px] text-slate-700 leading-relaxed min-h-[80px] max-h-[150px] overflow-y-auto break-words">
                              {currentEffLog.remarks}
                            </div>
                          </div>
                        </div>
                      );
                    })()
                  )}
                </>
              )}
            </div>

            {/* Footer */}
            <div className="px-[24px] py-[16px] bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4 shrink-0">
              <div>
                {activeTab === 'l1' ? (
                  selectedL1Details ? (
                    <span className={`inline-flex items-center gap-2 text-[11px] font-bold px-3 py-1.5 rounded-xl border ${selectedL1Details.crStatus !== 'Pending'
                        ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                        : 'text-amber-700 bg-amber-50 border-amber-200'
                      }`}>
                      {selectedL1Details.crStatus !== 'Pending' ? <CheckCircle2 size={14} /> : <Clock size={14} />}
                      L1 HOD Approval {selectedL1Details.crStatus === 'Pending' ? 'Pending' : 'Completed'}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-2 text-[11px] font-bold px-3 py-1.5 rounded-xl border text-amber-700 bg-amber-50 border-amber-200">
                      <Clock size={14} /> L1 HOD Approval Pending
                    </span>
                  )
                ) : activeTab === 'l2' ? (
                  selectedL2Details ? (
                    <span className={`inline-flex items-center gap-2 text-[11px] font-bold px-3 py-1.5 rounded-xl border ${selectedL2Details.status === 'Accepted'
                        ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                        : selectedL2Details.status === 'Rejected'
                          ? 'text-rose-700 bg-rose-50 border-rose-200'
                          : 'text-amber-700 bg-amber-50 border-amber-200'
                      }`}>
                      {selectedL2Details.status === 'Accepted' ? (
                        <CheckCircle2 size={14} />
                      ) : selectedL2Details.status === 'Rejected' ? (
                        <XCircle size={14} />
                      ) : (
                        <Clock size={14} />
                      )}
                      L2 QAD Validation {selectedL2Details.status === 'Accepted' ? 'Approved' : (selectedL2Details.status || 'Pending')}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-2 text-[11px] font-bold px-3 py-1.5 rounded-xl border text-amber-700 bg-amber-50 border-amber-200">
                      <Clock size={14} /> L2 QAD Validation Pending
                    </span>
                  )
                ) : activeTab === 'l3' ? (
                  selectedLog && (
                    <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-xl border ${getSelectedLogUserStatus() === 'Approved' || getSelectedLogUserStatus() === 'Accepted'
                        ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                        : getSelectedLogUserStatus() === 'Rejected'
                          ? 'text-rose-700 bg-rose-50 border-rose-200'
                          : 'text-amber-700 bg-amber-50 border-amber-200'
                      }`}>
                      {getSelectedLogUserStatus() === 'Approved' || getSelectedLogUserStatus() === 'Accepted' ? (
                        <CheckCircle2 size={13} />
                      ) : getSelectedLogUserStatus() === 'Rejected' ? (
                        <XCircle size={13} />
                      ) : (
                        <Clock size={13} />
                      )}
                      <span>Your L3 Status ({actingDept}): <span className="font-extrabold uppercase">{getSelectedLogUserStatus() || 'Pending'}</span></span>
                    </span>
                  )
                ) : (
                  (() => {
                    const currentEffLog = selectedEffDetails;
                    if (!currentEffLog) {
                      return (
                        <span className="inline-flex items-center gap-2 text-[11px] font-bold px-3 py-1.5 rounded-xl border text-amber-700 bg-amber-50 border-amber-200 font-sans">
                          <Clock size={14} /> Effectiveness Pending
                        </span>
                      );
                    }
                    const isEffRejected = currentEffLog.qaApproval === 'Rejected' || currentEffLog.status === 'Effectiveness Not Ok' || currentEffLog.status === 'Rejected';
                    return (
                      <span className={`inline-flex items-center gap-2 text-[11px] font-bold px-3 py-1.5 rounded-xl border font-sans ${currentEffLog.qaApproval === 'Approved' || currentEffLog.status === 'Effectiveness Ok'
                          ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                          : isEffRejected
                            ? 'text-rose-700 bg-rose-50 border-rose-200'
                            : 'text-amber-700 bg-amber-50 border-amber-200'
                        }`}>
                        {currentEffLog.qaApproval === 'Approved' || currentEffLog.status === 'Effectiveness Ok' ? (
                          <CheckCircle2 size={14} />
                        ) : isEffRejected ? (
                          <XCircle size={14} className="text-rose-600" />
                        ) : (
                          <Clock size={14} />
                        )}
                        Effectiveness Observation Status: <span className="font-extrabold uppercase">{currentEffLog.status || 'Pending'}</span>
                      </span>
                    );
                  })()
                )}
              </div>
              <div className="flex items-center gap-[12px] w-full sm:w-auto justify-center sm:justify-end">
                <button
                  onClick={handleExportRequestDetailsPDF}
                  disabled={isFetchingDetails}
                  className="px-[16px] py-[8px] bg-[#0066cc] hover:bg-[#0052a3] text-white disabled:opacity-50 disabled:cursor-not-allowed rounded-[6px] text-[12px] font-semibold transition-colors shadow-sm cursor-pointer flex items-center gap-[6px] whitespace-nowrap"
                  title="Export this request's full details (L1, L2, L3) as PDF"
                >
                  <Download size={14} />
                  <span>Export PDF</span>
                </button>
                <button
                  onClick={() => setSelectedLog(null)}
                  className="px-[16px] py-[8px] bg-white border border-slate-250 rounded-[6px] text-slate-650 hover:bg-slate-50 hover:text-slate-800 text-[12px] font-semibold transition-colors shadow-sm cursor-pointer whitespace-nowrap"
                >
                  Close Details
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Attachment Preview Modal */}
      {previewFile && (
        <div
          className="fixed inset-0 z-[60] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setPreviewFile(null)}
        >
          <div
            className="bg-white border border-slate-200 rounded-xl shadow-lg w-full max-w-2xl overflow-hidden animate-fade-in-up flex flex-col max-h-[85vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <span className="p-1.5 bg-[#e6f0fa] text-[#0066cc] rounded">
                  <Paperclip size={16} />
                </span>
                <span className="font-bold text-slate-800 text-sm">{previewFile}</span>
              </div>
              <button
                onClick={() => setPreviewFile(null)}
                className="text-slate-400 hover:text-slate-650 p-1 rounded hover:bg-slate-200 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 bg-slate-50 flex items-center justify-center min-h-[300px]">
              {fileUrls[previewFile] ? (
                (previewFile.toLowerCase().match(/\.(jpg|jpeg|jfif|png|gif|webp|bmp|svg|tiff|tif|ico|heic|heic|heif|avif)$/) || (fileTypes[previewFile] && fileTypes[previewFile].startsWith('image/'))) ? (
                  <img
                    src={fileUrls[previewFile]}
                    alt={previewFile}
                    className="max-w-full max-h-[60vh] object-contain rounded border border-slate-200"
                  />
                ) : (previewFile.toLowerCase().endsWith('.pdf') || (fileTypes[previewFile] && fileTypes[previewFile] === 'application/pdf')) ? (
                  <iframe
                    src={`${fileUrls[previewFile]}#navpanes=0`}
                    title={previewFile}
                    className="w-full h-[60vh] rounded border border-slate-200 bg-white"
                  />
                ) : (
                  <iframe
                    src={fileUrls[previewFile]}
                    title={previewFile}
                    className="w-full h-[60vh] rounded border border-slate-200 bg-white p-4 font-mono text-xs text-slate-700"
                  />
                )
              ) : (
                previewFile.toLowerCase().endsWith('.pdf') ? (
                  <div className="bg-white border border-slate-250 shadow-md p-8 w-full max-w-md aspect-[1/1.4] relative flex flex-col justify-between text-slate-800 select-none rounded animate-fade-in">
                    <div className="absolute top-0 inset-x-0 h-1 bg-[#0066cc]" />
                    <div className="space-y-4 flex-1">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-bold text-xs uppercase tracking-wider text-slate-400">Nippon Quality Assurance</div>
                          <h3 className="font-extrabold text-base text-slate-900 mt-0.5">Change Request Attachment</h3>
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono text-right">
                          DOC: L1-ATT-VER<br />
                          REV: 03 (2026)
                        </div>
                      </div>
                      <div className="border-t border-slate-100 pt-3 space-y-2.5 text-xs text-slate-600">
                        <div className="flex justify-between border-b border-slate-50 pb-1.5"><span className="font-bold">Filename:</span> <span>{previewFile}</span></div>
                        <div className="flex justify-between border-b border-slate-50 pb-1.5"><span className="font-bold">System Status:</span> <span className="text-emerald-600 font-bold">Verified File</span></div>
                      </div>
                      <div className="pt-2 space-y-2">
                        <div className="font-bold text-xs text-slate-800">Observation Summary:</div>
                        <p className="text-[11px] leading-relaxed text-slate-500">
                          This attachment supports the change request details. The document or image content was uploaded during the Level 1/Level 2 submission phase.
                        </p>
                      </div>
                    </div>
                    <div className="border-t border-slate-150 pt-3 flex justify-between items-center text-[10px] text-slate-400 font-mono">
                      <span>OFFICIAL ELECTRONIC ATTACHMENT</span>
                      <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded font-bold">VERIFIED</span>
                    </div>
                  </div>
                ) : previewFile.toLowerCase().match(/\.(jpg|jpeg|jfif|png|gif|webp|bmp|svg|tiff|tif|ico|heic|heif|avif)$/) ? (
                  <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-md max-w-sm w-full text-center space-y-4 animate-fade-in">
                    <div className="w-16 h-16 bg-teal-50 text-teal-650 rounded-full flex items-center justify-center mx-auto text-3xl">
                      🖼️
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-850 text-sm">{previewFile}</h4>
                      <p className="text-xs text-slate-450 mt-1">Mock Image Evidence</p>
                    </div>
                    <div className="bg-slate-50 border border-slate-150 p-4 rounded-lg flex items-center justify-center h-40">
                      <span className="text-[10px] text-slate-400 font-mono italic">[ Image Content Placeholder ]</span>
                    </div>
                    <p className="text-[10px] text-slate-400 italic">This is a mock placeholder showing where the image attachment will load.</p>
                  </div>
                ) : (
                  <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 w-full h-[50vh] font-mono text-xs text-slate-355 overflow-auto text-left shadow-inner flex flex-col">
                    <div className="text-[10px] text-slate-555 pb-2 border-b border-slate-800 flex justify-between">
                      <span>{previewFile}</span>
                      <span>UTF-8 PLAINTEXT</span>
                    </div>
                    <pre className="mt-2 flex-1 leading-relaxed text-slate-300">
                      {`=== Attachment Plaintext Evidence ===\n\n[INFO] - Supporting document for Change No: ${selectedLog?.changeNo}\n[SUCCESS] - Document content loaded successfully.\n\n==========================================`}
                    </pre>
                  </div>
                )
              )}
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setPreviewFile(null)}
                className="px-4 py-1.5 bg-[#0066cc] hover:bg-[#0052a3] text-white text-xs font-bold rounded-lg transition-colors cursor-pointer"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Validation Warning Modal */}
      {validationError && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-[16px]">
          <div className="fixed inset-0 bg-slate-900/65 backdrop-blur-xs" onClick={() => setValidationError('')} />
          <div className="relative bg-white w-full max-w-[400px] rounded-[12px] shadow-xl border border-slate-200 p-[20px] z-10 flex flex-col items-center text-center gap-[12px] animate-fade-in-up">
            <div className="w-[48px] h-[48px] rounded-full bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-500">
              <AlertTriangle size={24} />
            </div>
            <h4 className="text-[14px] font-bold text-slate-950">Validation Warning</h4>
            <p className="text-[12px] text-slate-500 leading-relaxed">{validationError}</p>
            <button
              onClick={() => setValidationError('')}
              className="mt-[4px] w-full py-[8px] bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold rounded-[6px] text-[12px] transition-colors cursor-pointer"
            >
              Understand
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
