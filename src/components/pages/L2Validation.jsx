import { useState, useEffect } from 'react';
import { Save, Search, Eye, EyeOff, Paperclip, X, AlertTriangle, Loader2, Calendar, Folder, Cpu, Clock, CheckCircle2, FileText, Download } from 'lucide-react';
import { useWebSocket } from '../../hooks/useWebSocket';
import TablePagination from '@mui/material/TablePagination';
import { getL2ValidationLogs, createL2ValidationLog, getL1Details, getL1Attachment, getL2Attachment, getL2Details, getL3Details } from '../../api/apiRoutes';
import { formatDateToDDMMYYYY } from '../../utils/dateUtils';
import { exportL2ValidationLogsPDF, exportRequestDetailsPDF } from '../../utils/pdfExport';

export const L2Validation = ({
  changes,
  userRole,
  userEmail,
  userDept,
  setToastMsg,
  fetchChanges,
  fetchNotifications,
  autoOpenChangeNo,
  clearAutoOpen,
  systemUsers = [],
  userName = ''
}) => {
  // Modal states
  const [validationError, setValidationError] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  // L1 Details Modal states
  const [selectedL1Details, setSelectedL1Details] = useState(null);
  const [selectedL2Details, setSelectedL2Details] = useState(null);
  const [selectedLog, setSelectedLog] = useState(null);
  const [isFetchingL1, setIsFetchingL1] = useState(false);
  const [previewFile, setPreviewFile] = useState(null);
  const [fileUrls, setFileUrls] = useState({});
  const [fileTypes, setFileTypes] = useState({});
  const [showCustomerApproval, setShowCustomerApproval] = useState(false);

  // DB Logs states
  const [validationLogs, setValidationLogs] = useState([]);
  const [isFetchingLogs, setIsFetchingLogs] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form states
  const [formChangeNo, setFormChangeNo] = useState('');
  const [formDate, setFormDate] = useState('');
  const [formRequester, setFormRequester] = useState('');
  const [formStatus, setFormStatus] = useState('');
  const [formRemarks, setFormRemarks] = useState('');

  // Inline field validation errors
  const [fieldErrors, setFieldErrors] = useState({});

  // File Upload states
  const [pedFiles, setPedFiles] = useState([]);
  const [qaFiles, setQaFiles] = useState([]);
  const [existingPedFiles, setExistingPedFiles] = useState([]);
  const [existingQaFiles, setExistingQaFiles] = useState([]);

  const fileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const base64String = reader.result.split(',')[1];
        resolve(base64String);
      };
      reader.onerror = (error) => reject(error);
    });
  };

  // Search & Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [decisionFilter, setDecisionFilter] = useState('All');

  // Pagination State
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // Reset page when search or filters change
  useEffect(() => {
    setPage(0);
  }, [searchQuery, decisionFilter]);

  useEffect(() => {
    if (!selectedL1Details) {
      setShowCustomerApproval(false);
    }
  }, [selectedL1Details]);

  const fetchLogs = async (silent = false) => {
    if (!silent) setIsFetchingLogs(true);
    try {
      const response = await getL2ValidationLogs();
      setValidationLogs(response.data);
    } catch (err) {
      console.error(err);
      if (setToastMsg) setToastMsg('Error loading L2 validation logs from backend.');
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
      if (selectedL1Details) {
        handleViewL1Details(selectedL1Details.change_no, true);
      }
    }
  });

  useEffect(() => {
    if (changes && changes.length > 0 && validationLogs) {
      const activeL2Nos = new Set((validationLogs || []).map(log => log.changeNo?.toLowerCase().trim()));
      const approvedChanges = changes.filter(
        c => activeL2Nos.has(c.id?.toLowerCase().trim())
      );

      if (autoOpenChangeNo) {
        const targetChange = approvedChanges.find(c => c.id.toLowerCase().trim() === autoOpenChangeNo.toLowerCase().trim());
        if (targetChange) {
          setFormChangeNo(targetChange.id);
          setFormDate(formatDateToDDMMYYYY(targetChange.date));
          setFormRequester(targetChange.requestBy || targetChange.requester || '');
        }
        if (clearAutoOpen) clearAutoOpen();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [changes, validationLogs, autoOpenChangeNo]);

  // Sync form inputs with saved validation logs when formChangeNo or validationLogs changes
  useEffect(() => {
    // Clear field-level errors and file selections whenever the selected record changes
    setFieldErrors({});
    setPedFiles([]);
    setQaFiles([]);

    if (formChangeNo) {
      const matchedChange = changes?.find(c => c.id.toLowerCase().trim() === formChangeNo.toLowerCase().trim());
      if (matchedChange) {
        setFormDate(formatDateToDDMMYYYY(matchedChange.date));
      }
      
      const savedLog = validationLogs.find(
        log => log.changeNo?.toLowerCase().trim() === formChangeNo.toLowerCase().trim()
      );
      
      if (savedLog) {
        setFormStatus(savedLog.status || '');
        setFormRemarks(savedLog.remarks === '-' ? '' : savedLog.remarks || '');
        if (savedLog.requester && savedLog.status !== 'Rejected') {
          setFormRequester(savedLog.requester);
        } else {
          setFormRequester(userName || userEmail || '');
        }
        setExistingPedFiles(savedLog.weldTest && savedLog.weldTest !== '-' ? savedLog.weldTest.split(',').map(s => s.trim()).filter(Boolean) : []);
        setExistingQaFiles(savedLog.qaTest && savedLog.qaTest !== '-' ? savedLog.qaTest.split(',').map(s => s.trim()).filter(Boolean) : []);
      } else {
        setFormStatus('');
        setFormRemarks('');
        setFormRequester(userName || userEmail || '');
        setExistingPedFiles([]);
        setExistingQaFiles([]);
      }
    } else {
      setFormStatus('');
      setFormRemarks('');
      setFormRequester('');
      setExistingPedFiles([]);
      setExistingQaFiles([]);
    }
  }, [formChangeNo, validationLogs, changes, userName, userEmail]);

  const handleSaveLog = async (e) => {
    e.preventDefault();

    // Per-field validation
    const errors = {};
    const existingLog = validationLogs.find(
      log => log.changeNo?.toLowerCase().trim() === formChangeNo.toLowerCase().trim()
    );

    if (isQualityOrAdmin && !areQadFieldsDisabled) {
      if (!formStatus) errors.status = 'Please select a validation status.';
      if (!formRemarks.trim()) errors.remarks = 'Remarks are required.';
      if (qaFiles.length === 0 && existingQaFiles.length === 0) {
        errors.qaFile = 'QAD Setup Verification Attachment is required.';
      }
      const hasPedInDb = existingLog && existingLog.weldTest && existingLog.weldTest !== '-';
      if (pedFiles.length === 0 && !hasPedInDb) {
        errors.pedFile = ' attachment is required.';
      }
    } else if (isRaisedByUserOrAdmin || (isQualityOrAdmin && areQadFieldsDisabled)) {
      const hasPedInDb = existingLog && existingLog.weldTest && existingLog.weldTest !== '-';
      if (pedFiles.length === 0 && !hasPedInDb) {
        errors.pedFile = ' attachment is required.';
      }
    }

    if (!formRequester.trim()) {
      errors.requester = 'Please select a validator.';
    }

    if (!formDate.trim()) {
      setValidationError('Change request data is missing. Please select a valid row from the table.');
      return;
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});

    setIsSubmitting(true);
    try {
      const attachments = [];
      for (const file of pedFiles) {
        const base64Data = await fileToBase64(file);
        attachments.push({
          fieldName: 'weld_test',
          name: file.name.replace(/,/g, '_'),
          type: file.type || 'application/octet-stream',
          data: base64Data
        });
      }
      for (const file of qaFiles) {
        const base64Data = await fileToBase64(file);
        attachments.push({
          fieldName: 'qa_test',
          name: file.name.replace(/,/g, '_'),
          type: file.type || 'application/octet-stream',
          data: base64Data
        });
      }

      const logData = {
        changeNo: formChangeNo.trim(),
        date: formDate.trim(),
        requester: formRequester.trim(),
        weldTest: [...existingPedFiles, ...pedFiles.map(f => f.name.replace(/,/g, '_'))].join(', ') || '-',
        qaTest: [...existingQaFiles, ...qaFiles.map(f => f.name.replace(/,/g, '_'))].join(', ') || '-',
        status: formStatus,
        remarks: formRemarks.trim()
      };

      await createL2ValidationLog(logData, attachments);

      if (fetchChanges) await fetchChanges();
      if (fetchNotifications) await fetchNotifications();

      if (setToastMsg) {
        setToastMsg(`Successfully saved L2 validation log for ${formChangeNo}`);
      }

      await fetchLogs();

      // Reset form fields after successful submission
      setFormChangeNo('');
      setFormDate('');
      setFormRequester('');
      setFormStatus('');
      setFormRemarks('');
      setExistingPedFiles([]);
      setExistingQaFiles([]);
      setPedFiles([]);
      setQaFiles([]);
      setFieldErrors({});
    } catch (err) {
      console.error(err);
      const errMsg = err.response?.data?.error || 'Error saving L2 validation log to database.';
      setValidationError(errMsg);
    } finally {
      setIsSubmitting(false);
    }
  };



  async function handleViewL1Details(changeNo, silent = false) {
    if (!silent) {
      // Open modal immediately with skeleton data to avoid blinking/flicker
      setSelectedL1Details({
        change_no: changeNo,
        title: 'Loading details...',
        unit: '',
        requested_time: '',
        dept: '',
        request_by: '',
        process_name: '',
        process_line: '',
        machine_no: '',
        description: '',
        improvement_area: '',
        change_type: '',
        trace_from: '',
        trace_to: '',
        risk_analysis: '',
        sop_update: '',
        hod_approval: '',
        customer_approval: '',
        effectiveness_monitoring: ''
      });
      setSelectedL2Details(null);
      setSelectedLog(null);
      setIsFetchingL1(true);
    }

    try {
      const [l1Res, l2Res, l3Res] = await Promise.all([
        getL1Details(changeNo),
        getL2Details(changeNo).catch(() => ({ data: null })),
        getL3Details(changeNo).catch(() => ({ data: null }))
      ]);
      setSelectedL1Details(l1Res.data);
      setSelectedL2Details(l2Res.data);

      const matchedChange = changes?.find(c => c.id === changeNo);

      if (l2Res.data) {
        setSelectedLog(l2Res.data);
        return;
      }

      const matchedL3 = l3Res.data;
      const isL3Valid = matchedL3 && matchedL3.changeNo;

      const newLogData = {
        changeNo: changeNo,
        date: matchedChange ? formatDateToDDMMYYYY(matchedChange.date) : '-',
        requester: matchedChange ? (matchedChange.requestBy || matchedChange.requester || '-') : '-',
        status: isL3Valid ? matchedL3.status : 'Pending',
        remarks: isL3Valid ? matchedL3.remarks : '-',
        weldTest: '-',
        qaTest: '-',
        ped: 'Pending',
        qad: 'Pending',
        production: 'Pending',
        maintenance: 'Pending',
        pcl: 'Pending',
        materials: 'Pending',
        marketing: 'Pending',
        hr: 'Pending',
        safety: 'Pending',
        unitHead: 'Pending'
      };
      setSelectedLog(newLogData);
    } catch (err) {
      console.error(err);
      if (setToastMsg) setToastMsg('Error loading change request details.');
    } finally {
      if (!silent) setIsFetchingL1(false);
    }
  }

  const handleExportRequestDetailsPDF = () => {
    exportRequestDetailsPDF(selectedL1Details, selectedL2Details, selectedLog, 'l1', setToastMsg, null);
  };

  const handleCloseModal = () => {
    setSelectedL1Details(null);
    setSelectedL2Details(null);
    setSelectedLog(null);
  };

  const handleViewAttachment = async (filename, changeNo, type = 'L1') => {
    if (!filename || filename === '-') return;
    setPreviewFile(filename);

    if (!fileUrls[filename]) {
      try {
        let response;
        if (type === 'L2') {
          response = await getL2Attachment(changeNo, filename);
        } else {
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

  const isAlreadyValidated = (validationLogs || []).some(
    log => log.changeNo?.toLowerCase().trim() === formChangeNo?.toLowerCase().trim() && !log.isPending
  );

  // Construct L2 table rows directly from the backend validationLogs database response
  const tableLogs = validationLogs || [];

  const matchedChange = changes?.find(c => c.id.toLowerCase().trim() === formChangeNo.toLowerCase().trim());
  const isRaisedByUser = matchedChange && userEmail &&
    matchedChange.requesterEmail?.toLowerCase().trim() === userEmail.toLowerCase().trim();

  const isSameDeptUser = matchedChange && userDept &&
    matchedChange.dept?.toLowerCase().trim() === userDept.toLowerCase().trim();

  const isRequesterOrDeptMember = isRaisedByUser || isSameDeptUser;

  const isAdmin = userRole && (
    userRole.toLowerCase() === 'admin' ||
    userRole.toLowerCase() === 'administrator'
  );

  const isQuality = userDept && (
    userDept.toLowerCase() === 'qad'
  );

  const isQualityOrAdmin = isQuality || isAdmin;
  const isRaisedByUserOrAdmin = isRequesterOrDeptMember || isAdmin;

  const canEdit = isQualityOrAdmin || isRequesterOrDeptMember;

  const matchedL2 = validationLogs.find(
    log => log.changeNo?.toLowerCase().trim() === formChangeNo.toLowerCase().trim()
  );
  const isL2AlreadyValidated = matchedL2 && (matchedL2.status === 'Accepted' || matchedL2.status === 'Rejected');

  const hasPedUploaded = matchedL2 && matchedL2.weldTest && matchedL2.weldTest !== '-';
  const canUploadPed = !hasPedUploaded || matchedL2.status === 'Rejected';

  const isChangeClosed = !!(matchedChange && matchedChange.qaApproval === 'Approved');

  const areQadFieldsDisabled = !formChangeNo.trim() || isChangeClosed || (!isAdmin && (!isQualityOrAdmin || isL2AlreadyValidated || !hasPedUploaded));

  const isSaveDisabled = isSubmitting || !formChangeNo.trim() || isChangeClosed || (!isAdmin && (!canEdit || (
    // If Accepted, completely locked
    (matchedL2 && matchedL2.status === 'Accepted') ||
    // If Rejected, locked for Quality/Admin, and locked for requester unless they selected a new file to reset
    (matchedL2 && matchedL2.status === 'Rejected' && !(isRaisedByUserOrAdmin && pedFiles.length > 0)) ||
    // If Pending, locked for standard requester since they already uploaded the PED file
    (matchedL2 && matchedL2.status === 'Pending' && isRequesterOrDeptMember && !isQualityOrAdmin && hasPedUploaded)
  ))) || (isQuality && !isAdmin && !isRequesterOrDeptMember && !hasPedUploaded);

  // Filter logic
  const filteredLogs = tableLogs.filter(log => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch = !q ||
      log.changeNo.toLowerCase().includes(q) ||
      (log.remarks && log.remarks.toLowerCase().includes(q)) ||
      log.requester.toLowerCase().includes(q);

    let matchesDecision = false;
    if (decisionFilter === 'All') {
      matchesDecision = true;
    } else if (decisionFilter === 'Accepted') {
      matchesDecision = log.status === 'Accepted';
    } else if (decisionFilter === 'Rejected') {
      matchesDecision = log.status === 'Rejected';
    } else if (decisionFilter === 'QAD Approval Needed') {
      matchesDecision = log.status === 'Pending' && log.weldTest && log.weldTest !== '-';
    } else if (decisionFilter === 'Pending Requester Validation') {
      matchesDecision = log.status === 'Pending' && (!log.weldTest || log.weldTest === '-');
    }

    return matchesSearch && matchesDecision;
  });

  const paginatedLogs = filteredLogs.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  const handleExportPDF = () => {
    exportL2ValidationLogsPDF(filteredLogs, { searchQuery, decisionFilter }, setToastMsg);
  };



  return (
    <div className="space-y-6 min-w-0 animate-fade-in-up">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-[24px] text-slate-800 items-start">

        {/* LEFT COLUMN: Add L2 Validation Log Form */}
        <div className="lg:col-span-4 min-w-0 bg-white border border-slate-200/60 rounded-xl p-6 shadow-sm hover:shadow-md transition-all duration-300 space-y-[16px] h-fit relative">
          <div className="absolute inset-x-0 top-0 h-1 bg-[#0066cc] rounded-t-xl" />
          <div className="flex items-center gap-[8px] border-b border-slate-100 pb-[8px]">
            <Save size={16} className="text-[#0066cc]" />
            <h4 className="text-[13px] font-bold text-slate-900">Add L2 Validation Log</h4>
          </div>

          {formChangeNo && isChangeClosed ? (
            <div className="bg-emerald-50 border border-emerald-250 text-emerald-800 rounded-lg p-3 text-[11px] flex items-start gap-2 animate-fade-in mb-3">
              <CheckCircle2 size={14} className="text-emerald-500 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Validation Closed:</span> This change request has been Approved and Closed at the Effectiveness Monitoring stage. No further L2 modifications are allowed.
              </div>
            </div>
          ) : (
            <>
              {formChangeNo && isRequesterOrDeptMember && !isQualityOrAdmin && (
                <div className="bg-blue-50 border border-blue-200 text-blue-800 rounded-lg p-3 text-[11px] flex items-start gap-2 animate-fade-in mb-3">
                  <AlertTriangle size={14} className="text-blue-500 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Notice:</span> You raised this change request or belong to the same department. You are authorized to upload the <span className="font-semibold">Requester Validation Attachment</span>. QAD department will review and complete the validation.
                  </div>
                </div>
              )}

              {formChangeNo && !hasPedUploaded && isQualityOrAdmin && (
                <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-lg p-3 text-[11px] flex items-start gap-2 animate-fade-in mb-3">
                  <AlertTriangle size={14} className="text-amber-500 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Awaiting Requester Validation:</span> The requester has not completed their validation attachment yet. QAD fields will remain disabled until the requester attachment is uploaded.
                  </div>
                </div>
              )}

              {formChangeNo && !isRequesterOrDeptMember && isQualityOrAdmin && !isL2AlreadyValidated && hasPedUploaded && (
                <div className="bg-blue-50 border border-blue-200 text-blue-800 rounded-lg p-3 text-[11px] flex items-start gap-2 animate-fade-in mb-3">
                  <AlertTriangle size={14} className="text-blue-500 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Notice:</span> You are logged in as {isAdmin ? 'Admin' : 'QAD'}. You are authorized to complete the L2 validation status, remarks, and upload the <span className="font-semibold">QAD Setup Verification Attachment</span>.
                  </div>
                </div>
              )}

              {formChangeNo && isRequesterOrDeptMember && isQualityOrAdmin && !isL2AlreadyValidated && (
                <div className="bg-blue-50 border border-blue-200 text-blue-800 rounded-lg p-3 text-[11px] flex items-start gap-2 animate-fade-in mb-3">
                  <AlertTriangle size={14} className="text-blue-550 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Notice:</span> You are the creator or department member of this change request and {isAdmin ? 'an Admin' : 'a QAD'} member. {!hasPedUploaded ? 'Please upload the Requester Validation Attachment first. After saving, you will be authorized to update the remaining L2 validation fields.' : 'You have full permissions to update all L2 validation fields.'}
                  </div>
                </div>
              )}

              {formChangeNo && isL2AlreadyValidated && isQualityOrAdmin && !isAdmin && (
                <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-lg p-3 text-[11px] flex items-start gap-2 animate-fade-in mb-3">
                  <AlertTriangle size={14} className="text-amber-500 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Validation Locked:</span> L2 validation has already been completed (Status: <span className="font-bold uppercase">{matchedL2.status === 'Accepted' ? 'Approved' : matchedL2.status}</span>). QAD members and Admins cannot update these fields again.
                  </div>
                </div>
              )}

              {formChangeNo && isL2AlreadyValidated && isAdmin && (
                <div className="bg-sky-50 border border-sky-200 text-sky-850 rounded-lg p-3 text-[11px] flex items-start gap-2 animate-fade-in mb-3">
                  <CheckCircle2 size={14} className="text-sky-500 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Administrator Access:</span> This validation record is completed (Status: <span className="font-bold uppercase">{matchedL2.status === 'Accepted' ? 'Approved' : matchedL2.status}</span>). As an Admin, you are authorized to modify status, remarks, or delete files.
                  </div>
                </div>
              )}

              {formChangeNo && isRequesterOrDeptMember && matchedL2 && matchedL2.status === 'Accepted' && (
                <div className="bg-emerald-50 border border-emerald-250 text-emerald-800 rounded-lg p-3 text-[11px] flex items-start gap-2 animate-fade-in mb-3">
                  <AlertTriangle size={14} className="text-emerald-500 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Validation Completed:</span> This request has already been validated and Approved by QAD. No further actions are required.
                  </div>
                </div>
              )}

              {formChangeNo && isRequesterOrDeptMember && matchedL2 && matchedL2.status === 'Rejected' && (
                <div className="bg-rose-50 border border-rose-250 text-rose-800 rounded-lg p-3 text-[11px] flex items-start gap-2 animate-fade-in mb-3">
                  <AlertTriangle size={14} className="text-rose-505 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Validation Rejected:</span> L2 validation has been rejected by QAD. Please upload a new <span className="font-semibold">Requester Validation Attachment</span> to reset the status to Pending and notify QAD for re-evaluation.
                  </div>
                </div>
              )}

              {formChangeNo && !isRequesterOrDeptMember && !isQualityOrAdmin && (
                <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-lg p-3 text-[11px] flex items-start gap-2 animate-fade-in mb-3">
                  <AlertTriangle size={14} className="text-rose-500 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Access Restricted:</span> L2 validation can only be submitted by the person who raised this change request, department members, or QAD department members / Admins.
                  </div>
                </div>
              )}
            </>
          )}

          <form onSubmit={handleSaveLog} className="space-y-[14px]">
            {/* 4M CHANGE NO */}
            <div className="space-y-[4px]">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">4M Change No <span className="text-rose-500">*</span></label>
              <input
                type="text"
                placeholder="Click a row on the right to select"
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
                placeholder="Click a row on the right to select"
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
                placeholder={formChangeNo.trim() ? "Logged-in user name" : "Click a row on the right to select"}
                value={formRequester}
                disabled
                className="w-full bg-slate-100 border border-slate-200 rounded-[6px] py-[8px] px-[12px] text-[12px] outline-none text-slate-550 select-none cursor-not-allowed"
              />
              {fieldErrors.requester && (
                <p className="text-[11px] text-rose-500 flex items-center gap-1 mt-0.5">
                  <span className="inline-block w-[3px] h-[3px] rounded-full bg-rose-500 mt-[1px]" />
                  {fieldErrors.requester}
                </p>
              )}
            </div>

            {/* REQUESTER VALIDATION ATTACHMENT */}
            <div className="space-y-[4px]">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Requester Validation Attachment <span className="text-rose-500">*</span></label>
              <input
                key={`ped-${formChangeNo}-${pedFiles.map(f => f.name).join(',')}`}
                type="file"
                multiple
                accept="image/*,application/pdf"
                disabled={!formChangeNo.trim() || isChangeClosed || (!isAdmin && (!isRaisedByUserOrAdmin || !canUploadPed))}
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    const files = Array.from(e.target.files);
                    const MAX_SIZE = 100 * 1024 * 1024; // 100MB
                    const tooLargeFiles = files.filter(f => f.size > MAX_SIZE);

                    if (tooLargeFiles.length > 0) {
                      setFieldErrors(prev => ({
                        ...prev,
                        pedFile: `Upload not allowed: File(s) exceed 100MB limit: ${tooLargeFiles.map(f => f.name).join(', ')}`
                      }));
                      e.target.value = '';
                      return;
                    }

                    const validFiles = [];
                    let hasInvalid = false;
                    files.forEach(file => {
                      const isImage = file.type.startsWith('image/');
                      const isPdf = file.type === 'application/pdf';
                      const hasAllowedExt = /\.(jpg|jpeg|jfif|png|gif|webp|bmp|svg|tiff|tif|ico|heic|heif|avif|pdf)$/i.test(file.name);
                      if ((isImage || isPdf) && hasAllowedExt) {
                        validFiles.push(file);
                      } else {
                        hasInvalid = true;
                      }
                    });
                    if (hasInvalid) {
                      setFieldErrors(prev => ({ ...prev, pedFile: 'Some files were skipped (only PDF and image files are allowed).' }));
                    } else {
                      setFieldErrors(prev => ({ ...prev, pedFile: '' }));
                    }
                    setPedFiles(prev => [...prev, ...validFiles]);
                    e.target.value = '';
                  }
                }}
                className={`w-full text-[11px] text-slate-550 file:mr-[8px] file:py-[4px] file:px-[8px] file:rounded-[4px] file:border file:bg-slate-50 file:text-[11px] file:font-semibold hover:file:bg-slate-100 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed ${fieldErrors.pedFile ? 'file:border-rose-400 border border-rose-300 rounded-[6px] p-1' : 'file:border-slate-200'
                  }`}
              />
              {/* Selected PED file chips */}
              {pedFiles.length > 0 && (
                <div className="flex flex-wrap gap-[6px] mt-1">
                  {pedFiles.map((file, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-[5px] bg-[#e6f0fa] border border-[#b2d1f0] text-[#0066cc] rounded-[5px] py-[3px] pl-[8px] pr-[5px] text-[10px] font-semibold max-w-full"
                    >
                      <Paperclip size={10} className="shrink-0" />
                      <span className="truncate max-w-[140px]" title={file.name}>{file.name}</span>
                      {formChangeNo.trim() && isRaisedByUserOrAdmin && canUploadPed && (
                        <button
                          type="button"
                          onClick={() => {
                            setDeleteConfirm({
                              title: 'Remove File Selection?',
                              message: `Are you sure you want to remove "${file.name}" from selection?`,
                              onConfirm: () => {
                                setPedFiles(prev => prev.filter((_, i) => i !== idx));
                              }
                            });
                          }}
                          className="ml-[2px] hover:bg-[#b2d1f0] rounded-full p-[2px] transition-colors cursor-pointer shrink-0"
                        >
                          <X size={9} />
                        </button>
                      )}
                    </span>
                  ))}
                </div>
              )}
              {/* Already Uploaded PED Files */}
              {existingPedFiles.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-[6px]">
                  {existingPedFiles.map((file, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-[5px] bg-[#f0f9ff] border border-[#bae6fd] text-[#0284c7] rounded-[5px] py-[3px] pl-[8px] pr-[5px] text-[10px] font-semibold max-w-full"
                    >
                      <Paperclip size={10} className="shrink-0" />
                      <span
                        className="underline truncate max-w-[140px] cursor-pointer"
                        onClick={() => handleViewAttachment(file, formChangeNo, 'L2')}
                        title="Click to view/download previously uploaded file"
                      >
                        {file}
                      </span>
                      {formChangeNo.trim() && !isChangeClosed && (isAdmin || (isRaisedByUserOrAdmin && canUploadPed)) && (
                        <button
                          type="button"
                          onClick={() => {
                            setDeleteConfirm({
                              title: 'Delete Uploaded File?',
                              message: `Are you sure you want to delete the uploaded file "${file}"? This will be saved upon submitting the form.`,
                              onConfirm: () => {
                                setExistingPedFiles(prev => prev.filter(f => f !== file));
                              }
                            });
                          }}
                          className="ml-[2px] hover:bg-[#bae6fd] rounded-full p-[2px] transition-colors cursor-pointer shrink-0"
                          title="Delete previously uploaded file"
                        >
                          <X size={9} />
                        </button>
                      )}
                    </span>
                  ))}
                </div>
              )}
              {fieldErrors.pedFile && (
                <p className="text-[11px] text-rose-500 flex items-center gap-1 mt-0.5">
                  <span className="inline-block w-[3px] h-[3px] rounded-full bg-rose-500 mt-[1px]" />
                  {fieldErrors.pedFile}
                </p>
              )}
            </div>

            {/* APPROVER SET UP VERIFICATION (QAD) ATTACHMENT */}
            <div className="space-y-[4px]">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Approver Set Up Verification(QAD) Attachment <span className="text-rose-500">*</span></label>
              <input
                key={`qa-${formChangeNo}-${qaFiles.map(f => f.name).join(',')}`}
                type="file"
                multiple
                accept="image/*,application/pdf"
                disabled={areQadFieldsDisabled}
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    const files = Array.from(e.target.files);
                    const MAX_SIZE = 100 * 1024 * 1024; // 100MB
                    const tooLargeFiles = files.filter(f => f.size > MAX_SIZE);

                    if (tooLargeFiles.length > 0) {
                      setFieldErrors(prev => ({
                        ...prev,
                        qaFile: `Upload not allowed: File(s) exceed 100MB limit: ${tooLargeFiles.map(f => f.name).join(', ')}`
                      }));
                      e.target.value = '';
                      return;
                    }

                    const validFiles = [];
                    let hasInvalid = false;
                    files.forEach(file => {
                      const isImage = file.type.startsWith('image/');
                      const isPdf = file.type === 'application/pdf';
                      const hasAllowedExt = /\.(jpg|jpeg|jfif|png|gif|webp|bmp|svg|tiff|tif|ico|heic|heif|avif|pdf)$/i.test(file.name);
                      if ((isImage || isPdf) && hasAllowedExt) {
                        validFiles.push(file);
                      } else {
                        hasInvalid = true;
                      }
                    });
                    if (hasInvalid) {
                      setFieldErrors(prev => ({ ...prev, qaFile: 'Some files were skipped (only PDF and image files are allowed).' }));
                    } else {
                      setFieldErrors(prev => ({ ...prev, qaFile: '' }));
                    }
                    setQaFiles(prev => [...prev, ...validFiles]);
                    e.target.value = '';
                  }
                }}
                className={`w-full text-[11px] text-slate-555 file:mr-[8px] file:py-[4px] file:px-[8px] file:rounded-[4px] file:border file:bg-slate-50 file:text-[11px] file:font-semibold hover:file:bg-slate-100 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed ${fieldErrors.qaFile ? 'file:border-rose-400 border border-rose-300 rounded-[6px] p-1' : 'file:border-slate-200'
                  }`}
              />
              {/* Selected QAD file chips */}
              {qaFiles.length > 0 && (
                <div className="flex flex-wrap gap-[6px] mt-1">
                  {qaFiles.map((file, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-[5px] bg-[#e6f0fa] border border-[#b2d1f0] text-[#0066cc] rounded-[5px] py-[3px] pl-[8px] pr-[5px] text-[10px] font-semibold max-w-full"
                    >
                      <Paperclip size={10} className="shrink-0" />
                      <span className="truncate max-w-[140px]" title={file.name}>{file.name}</span>
                      {formChangeNo.trim() && isQualityOrAdmin && !isL2AlreadyValidated && (
                        <button
                          type="button"
                          onClick={() => {
                            setDeleteConfirm({
                              title: 'Remove File Selection?',
                              message: `Are you sure you want to remove "${file.name}" from selection?`,
                              onConfirm: () => {
                                setQaFiles(prev => prev.filter((_, i) => i !== idx));
                              }
                            });
                          }}
                          className="ml-[2px] hover:bg-[#b2d1f0] rounded-full p-[2px] transition-colors cursor-pointer shrink-0"
                        >
                          <X size={9} />
                        </button>
                      )}
                    </span>
                  ))}
                </div>
              )}
              {/* Already Uploaded QAD Files */}
              {existingQaFiles.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-[6px]">
                  {existingQaFiles.map((file, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-[5px] bg-[#f0f9ff] border border-[#bae6fd] text-[#0284c7] rounded-[5px] py-[3px] pl-[8px] pr-[5px] text-[10px] font-semibold max-w-full"
                    >
                      <Paperclip size={10} className="shrink-0" />
                      <span
                        className="underline truncate max-w-[140px] cursor-pointer"
                        onClick={() => handleViewAttachment(file, formChangeNo, 'L2')}
                        title="Click to view/download previously uploaded file"
                      >
                        {file}
                      </span>
                      {formChangeNo.trim() && !isChangeClosed && (isAdmin || (isQualityOrAdmin && !isL2AlreadyValidated)) && (
                        <button
                          type="button"
                          onClick={() => {
                            setDeleteConfirm({
                              title: 'Delete Uploaded File?',
                              message: `Are you sure you want to delete the uploaded file "${file}"? This will be saved upon submitting the form.`,
                              onConfirm: () => {
                                setExistingQaFiles(prev => prev.filter(f => f !== file));
                              }
                            });
                          }}
                          className="ml-[2px] hover:bg-[#bae6fd] rounded-full p-[2px] transition-colors cursor-pointer shrink-0"
                          title="Delete previously uploaded file"
                        >
                          <X size={9} />
                        </button>
                      )}
                    </span>
                  ))}
                </div>
              )}
              {fieldErrors.qaFile && (
                <p className="text-[11px] text-rose-500 flex items-center gap-1 mt-0.5">
                  <span className="inline-block w-[3px] h-[3px] rounded-full bg-rose-500 mt-[1px]" />
                  {fieldErrors.qaFile}
                </p>
              )}
            </div>

            {/* APPROVER VALIDATION STATUS */}
            <div className="space-y-[4px]">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Approver Validation Status <span className="text-rose-500">*</span></label>
              <select
                value={formStatus}
                disabled={areQadFieldsDisabled}
                onChange={(e) => {
                  setFormStatus(e.target.value);
                  setFieldErrors(prev => ({ ...prev, status: '' }));
                }}
                className={`w-full bg-slate-50 disabled:bg-slate-100 border rounded-[6px] py-[8px] px-[12px] text-[12px] outline-none focus:border-[#0066cc] focus:ring-4 focus:ring-[#0066cc]/10 transition-all duration-200 disabled:cursor-not-allowed text-slate-555 ${fieldErrors.status ? 'border-rose-400 bg-rose-50/30' : 'border-slate-200'
                  }`}
              >
                <option value="">Select Status</option>
                <option value="Accepted">Approved</option>
                <option value="Rejected">Rejected</option>
              </select>
              {fieldErrors.status && (
                <p className="text-[11px] text-rose-500 flex items-center gap-1 mt-0.5">
                  <span className="inline-block w-[3px] h-[3px] rounded-full bg-rose-500 mt-[1px]" />
                  {fieldErrors.status}
                </p>
              )}
            </div>

            {/* REMARKS */}
            <div className="space-y-[4px]">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Remarks <span className="text-rose-500">*</span></label>
              <textarea
                placeholder="Enter Remarks..."
                rows={3}
                value={formRemarks}
                maxLength={1000}
                disabled={areQadFieldsDisabled}
                onChange={(e) => {
                  setFormRemarks(e.target.value);
                  setFieldErrors(prev => ({ ...prev, remarks: '' }));
                }}
                className={`w-full bg-slate-50 disabled:bg-slate-100 border rounded-[6px] py-[8px] px-[12px] text-[12px] outline-none focus:border-[#0066cc] focus:ring-4 focus:ring-[#0066cc]/10 transition-all duration-200 resize-none disabled:cursor-not-allowed text-slate-555 ${fieldErrors.remarks ? 'border-rose-400 bg-rose-50/30' : 'border-slate-200'
                  }`}
              />
              <div className="flex justify-between items-center text-[9px] text-slate-400">
                {fieldErrors.remarks ? (
                  <p className="text-[11px] text-rose-500 flex items-center gap-1 mt-0.5">
                    <span className="inline-block w-[3px] h-[3px] rounded-full bg-rose-500 mt-[1px]" />
                    {fieldErrors.remarks}
                  </p>
                ) : (
                  <span>Provide L2 validation remarks</span>
                )}
                <span className={`${1000 - formRemarks.length <= 15 ? 'text-amber-600 font-bold animate-pulse' : 'text-slate-400'}`}>
                  {1000 - formRemarks.length} characters remaining (max 1000 chars)
                </span>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isSaveDisabled}
              className="w-full flex items-center justify-center gap-[6px] bg-[#e6f0fa] hover:bg-[#d6e6f5] disabled:opacity-60 border border-[#b2d1f0] text-[#0066cc] py-[10px] rounded-[6px] text-[12px] font-bold transition-all transform active:scale-[0.98] cursor-pointer disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="animate-spin" size={14} />
                  <span>Saving Validation Log...</span>
                </>
              ) : !formChangeNo.trim() ? (
                <span>Select a Request to Validate</span>
              ) : isChangeClosed ? (
                <span>Validation is Closed</span>
              ) : !canEdit ? (
                <span>Access Restricted</span>
              ) : (isQuality && !isAdmin && !isRaisedByUser && !hasPedUploaded) ? (
                <span>Awaiting Requester Attachment</span>
              ) : (matchedL2 && matchedL2.status === 'Accepted') && !isAdmin ? (
                <span>Validation Locked (Approved)</span>
              ) : (matchedL2 && matchedL2.status === 'Rejected' && !(isRaisedByUserOrAdmin && pedFiles.length > 0)) && !isAdmin ? (
                <span>Validation Locked (Rejected)</span>
              ) : (matchedL2 && matchedL2.status === 'Rejected' && isRaisedByUserOrAdmin && pedFiles.length > 0) ? (
                <>
                  <Save size={14} />
                  <span>Reset & Resubmit Validation</span>
                </>
              ) : (matchedL2 && matchedL2.status === 'Pending' && isRaisedByUser && !isQualityOrAdmin && hasPedUploaded) ? (
                <span>Awaiting QAD Review</span>
              ) : isAlreadyValidated ? (
                <>
                  <Save size={14} />
                  <span>Update Validation Log</span>
                </>
              ) : (
                <>
                  <Save size={14} />
                  <span>Save Validation Log</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* RIGHT COLUMN: Table Area */}
        <div className="lg:col-span-8 min-w-0 space-y-[16px]">
          {/* Search & Action bar */}
          <div className="bg-white border border-slate-200/60 rounded-xl p-4 shadow-sm hover:shadow-md transition-all duration-300 flex flex-wrap gap-3 items-center">
            <div className="flex-1 min-w-[200px] relative">
              <Search className="absolute left-3 top-2.5 text-slate-400" size={14} />
              <input
                type="text"
                placeholder="Search by change no or remarks..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-4 py-1.5 border border-slate-200 rounded-lg text-xs outline-none focus:border-[#0066cc]"
              />
            </div>

            <div>
              <select
                value={decisionFilter}
                onChange={(e) => setDecisionFilter(e.target.value)}
                className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-white outline-none focus:border-[#0066cc]"
              >
                <option value="All">All Decisions</option>
                <option value="Rejected">Rejected</option>
                <option value="QAD Approval Needed">QAD Approval Needed</option>
                <option value="Pending Requester Validation">Pending Requester Validation</option>
              </select>
            </div>

            <button
              type="button"
              onClick={handleExportPDF}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0066cc] hover:bg-[#0052a3] text-white rounded-lg text-xs font-bold transition-all shadow-sm cursor-pointer"
              title="Export L2 validation logs as PDF"
            >
              <Download size={12} />
              <span>Export PDF</span>
            </button>
          </div>

          {/* Table layout */}
          <div className="bg-white border border-slate-200/60 rounded-xl shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden">
            {/* Desktop Table View */}
            <div className="hidden md:block">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[1000px]">
                  <thead>
                    <tr className="bg-[#fdfaf5] border-b border-slate-150">
                      <th className="p-[12px] text-[10px] font-bold text-slate-500 uppercase tracking-wider">Sl No</th>
                      <th className="p-[12px] text-[10px] font-bold text-slate-500 uppercase tracking-wider">4M Change No</th>
                      <th className="p-[12px] text-[10px] font-bold text-slate-500 uppercase tracking-wider">Requested Date</th>
                      <th className="p-[12px] text-[10px] font-bold text-slate-500 uppercase tracking-wider">Change Request By</th>
                      <th className="p-[12px] text-[10px] font-bold text-slate-500 uppercase tracking-wider">Requester Validation</th>
                      <th className="p-[12px] text-[10px] font-bold text-slate-500 uppercase tracking-wider">Approver Set Up Verification(QAD)</th>
                      <th className="p-[12px] text-[10px] font-bold text-slate-500 uppercase tracking-wider">Approver Validation Status</th>
                      <th className="p-[12px] text-[10px] font-bold text-slate-500 uppercase tracking-wider">Remarks</th>
                      <th className="p-[12px] text-[10px] font-bold text-slate-500 uppercase tracking-wider text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-[12px]">
                    {isFetchingLogs ? (
                      <tr>
                        <td colSpan={9} className="text-center py-[48px] text-slate-400">
                          <div className="flex flex-col items-center justify-center gap-[8px]">
                            <Loader2 className="animate-spin text-[#0066cc]" size={20} />
                            <span>Fetching validation logs...</span>
                          </div>
                        </td>
                      </tr>
                    ) : filteredLogs.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="text-center py-[48px] text-slate-400">
                          No L2 validation records found.
                        </td>
                      </tr>
                    ) : (
                      paginatedLogs.map((log, idx) => (
                        <tr
                          key={idx}
                          className="hover:bg-slate-50/50 cursor-pointer"
                          onClick={() => {
                            setFormChangeNo(log.changeNo || '');
                            setFormDate(formatDateToDDMMYYYY(log.date));
                            setFormRequester(log.requester || '');
                          }}
                        >
                          <td className="p-[12px] font-bold text-slate-400">{page * rowsPerPage + idx + 1}</td>
                          <td className="p-[12px] font-bold text-[#0066cc]">{log.changeNo}</td>
                          <td className="p-[12px] text-slate-500">{formatDateToDDMMYYYY(log.date)}</td>
                          <td className="p-[12px] font-medium text-slate-700">{log.requester}</td>
                          <td className="p-[12px]">
                            <div className="flex flex-wrap gap-[4px]">
                              {(log.weldTest && log.weldTest !== '-'
                                ? log.weldTest.split(',').map(s => s.trim()).filter(Boolean)
                                : [log.weldTest || '-']
                              ).map((fname, fi) => (
                                <span
                                  key={fi}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleViewAttachment(fname, log.changeNo, 'L2');
                                  }}
                                  className="inline-flex items-center gap-[4px] text-slate-500 hover:text-[#0066cc] cursor-pointer"
                                >
                                  <Paperclip size={12} className="text-slate-400" />
                                  <span className="underline truncate max-w-[120px]">{fname}</span>
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="p-[12px]">
                            <div className="flex flex-wrap gap-[4px]">
                              {(log.qaTest && log.qaTest !== '-'
                                ? log.qaTest.split(',').map(s => s.trim()).filter(Boolean)
                                : [log.qaTest || '-']
                              ).map((fname, fi) => (
                                <span
                                  key={fi}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleViewAttachment(fname, log.changeNo, 'L2');
                                  }}
                                  className="inline-flex items-center gap-[4px] text-slate-500 hover:text-[#0066cc] cursor-pointer"
                                >
                                  <Paperclip size={12} className="text-slate-400" />
                                  <span className="underline truncate max-w-[120px]">{fname}</span>
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="p-[12px]">
                            <span className={`inline-flex items-center px-[8px] py-[2px] rounded-full text-[10px] font-semibold border ${log.status === 'Accepted'
                              ? 'bg-emerald-50 border-emerald-250 text-emerald-700'
                              : log.status === 'Pending'
                                ? (log.weldTest && log.weldTest !== '-' ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-amber-50 border-amber-250 text-amber-700')
                                : 'bg-rose-50 border-rose-250 text-rose-700'
                              }`}>
                              {log.status === 'Accepted'
                                ? 'Approved'
                                : log.status === 'Pending'
                                  ? (log.weldTest && log.weldTest !== '-' ? 'QAD Approval Needed' : 'Pending Requester Validation')
                                  : log.status}
                            </span>
                          </td>
                          <td className="p-[12px] text-slate-500 max-w-[220px] truncate" title={log.remarks}>
                            {log.remarks}
                          </td>
                          <td className="p-[12px] text-center">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleViewL1Details(log.changeNo);
                              }}
                              className="p-[4px] hover:bg-slate-100 rounded text-slate-400 hover:text-[#0066cc] transition-colors cursor-pointer"
                            >
                              <Eye size={14} />
                            </button>
                          </td>
                        </tr>
                      ))
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
                  <span className="text-[12px] mt-1">Fetching validation logs...</span>
                </div>
              ) : filteredLogs.length === 0 ? (
                <div className="text-center py-[24px] text-slate-400 text-[12px]">
                  No L2 validation records found.
                </div>
              ) : (
                paginatedLogs.map((log, idx) => (
                  <div
                    key={idx}
                    onClick={() => {
                      setFormChangeNo(log.changeNo || '');
                      setFormDate(formatDateToDDMMYYYY(log.date));
                      setFormRequester(log.requester || '');
                    }}
                    className="bg-white border border-slate-200 rounded-[12px] p-[16px] shadow-sm hover:shadow-md transition-all duration-300 flex flex-col gap-[12px]"
                  >
                    <div className="flex justify-between items-center border-b border-slate-100 pb-[8px]">
                      <span className="font-mono font-bold text-[#0066cc] text-[12px] bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100">
                        {log.changeNo}
                      </span>
                      <span className={`inline-flex items-center px-[8px] py-[2px] rounded-full text-[10px] font-semibold border ${log.status === 'Accepted'
                        ? 'bg-emerald-50 border-emerald-250 text-emerald-700'
                        : log.status === 'Pending'
                          ? (log.weldTest && log.weldTest !== '-' ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-amber-50 border-amber-250 text-amber-700')
                          : 'bg-rose-50 border-rose-250 text-rose-700'
                        }`}>
                        {log.status === 'Accepted'
                          ? 'Approved'
                          : log.status === 'Pending'
                            ? (log.weldTest && log.weldTest !== '-' ? 'QAD Approval Needed' : 'Pending Requester Validation')
                            : log.status}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-[8px] gap-x-[12px]">
                      <div className="flex flex-col gap-[2px]">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Requested Date</span>
                        <span className="text-[12px] font-semibold text-slate-755">{formatDateToDDMMYYYY(log.date)}</span>
                      </div>
                      <div className="flex flex-col gap-[2px]">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Requested By</span>
                        <span className="text-[12px] font-semibold text-slate-755 break-words">{log.requester}</span>
                      </div>

                      <div className="flex flex-col gap-[2px] col-span-2">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-sans">Requester Validation</span>
                        <div className="flex flex-wrap gap-[4px] mt-0.5">
                          {(log.weldTest && log.weldTest !== '-'
                            ? log.weldTest.split(',').map(s => s.trim()).filter(Boolean)
                            : [log.weldTest || '-']
                          ).map((fname, fi) => (
                            <span
                              key={fi}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleViewAttachment(fname, log.changeNo, 'L2');
                              }}
                              className="inline-flex items-center gap-[4px] text-[#0066cc] hover:underline cursor-pointer bg-slate-50 border border-slate-200 px-2 py-0.5 rounded text-[11px]"
                            >
                              <Paperclip size={11} className="text-slate-400" />
                              <span className="truncate max-w-[120px]">{fname}</span>
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="flex flex-col gap-[2px] col-span-2">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-sans">QAD Setup Verification</span>
                        <div className="flex flex-wrap gap-[4px] mt-0.5">
                          {(log.qaTest && log.qaTest !== '-'
                            ? log.qaTest.split(',').map(s => s.trim()).filter(Boolean)
                            : [log.qaTest || '-']
                          ).map((fname, fi) => (
                            <span
                              key={fi}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleViewAttachment(fname, log.changeNo, 'L2');
                              }}
                              className="inline-flex items-center gap-[4px] text-[#0066cc] hover:underline cursor-pointer bg-slate-50 border border-slate-200 px-2 py-0.5 rounded text-[11px]"
                            >
                              <Paperclip size={11} className="text-slate-400" />
                              <span className="truncate max-w-[120px]">{fname}</span>
                            </span>
                          ))}
                        </div>
                      </div>

                      {log.remarks && log.remarks !== '-' && (
                        <div className="flex flex-col gap-[2px] col-span-2 border-t border-slate-100 pt-2">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-sans">Remarks</span>
                          <p className="text-[12px] text-slate-655 bg-slate-50 border border-slate-150 rounded p-2 mt-0.5 break-words">{log.remarks}</p>
                        </div>
                      )}
                    </div>

                    <div className="flex justify-end border-t border-slate-100 pt-[12px] mt-[4px]">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleViewL1Details(log.changeNo);
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 rounded-lg text-[11px] font-bold text-slate-600 hover:border-[#0066cc] hover:text-[#0066cc] hover:bg-blue-50 transition-all shadow-sm cursor-pointer"
                      >
                        <Eye size={12} />
                        View Details
                      </button>
                    </div>
                  </div>
                ))
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
      </div>
      {/* Validation Warning Modal */}
      {validationError && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-[16px]">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity"
            onClick={() => setValidationError('')}
          />

          {/* Modal Container */}
          <div className="relative bg-white w-full max-w-[400px] rounded-[16px] shadow-2xl border border-slate-200 overflow-hidden flex flex-col z-10">
            {/* Header */}
            <div className="bg-rose-50 px-[20px] py-[14px] border-b border-rose-100 flex items-center justify-between">
              <div className="flex items-center gap-[8px] text-rose-800">
                <AlertTriangle size={16} className="text-rose-600" />
                <h4 className="text-[13px] font-bold">Validation Alert</h4>
              </div>
              <button
                onClick={() => setValidationError('')}
                className="p-[4px] hover:bg-rose-100/60 rounded-full text-rose-450 hover:text-rose-650 transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Content */}
            <div className="p-[20px] text-[12px] text-slate-600 leading-relaxed">
              {validationError}
            </div>

            {/* Footer */}
            <div className="px-[20px] py-[12px] bg-slate-50 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setValidationError('')}
                className="px-[14px] py-[6px] bg-rose-600 hover:bg-rose-700 text-white rounded-[6px] text-[12px] font-semibold transition-colors shadow-sm cursor-pointer"
              >
                Okay
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Attachment Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-[16px]">
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setDeleteConfirm(null)} />
          <div className="relative bg-white w-full max-w-[320px] rounded-[16px] shadow-2xl border border-slate-200 flex flex-col z-10 p-[24px] text-center animate-fade-in-up">
            <div className="mx-auto bg-rose-100 text-rose-600 p-[12px] rounded-full mb-[16px]">
              <AlertTriangle size={24} />
            </div>
            <h4 className="text-[16px] font-bold text-slate-800 mb-[8px]">
              {deleteConfirm.title || 'Delete Attachment?'}
            </h4>
            <p className="text-[13px] text-slate-500 mb-[24px]">
              {deleteConfirm.message || 'Are you sure you want to delete this attachment? This action cannot be undone.'}
            </p>
            <div className="flex gap-[12px] w-full">
              <button
                type="button"
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 py-[10px] rounded-[8px] text-[13px] font-bold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  deleteConfirm.onConfirm();
                  setDeleteConfirm(null);
                }}
                className="flex-1 bg-rose-600 hover:bg-rose-700 text-white py-[10px] rounded-[8px] text-[13px] font-bold transition-colors shadow-sm cursor-pointer"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* L1 Request Details Modal */}
      {selectedL1Details && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-[16px]">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity"
            onClick={() => setSelectedL1Details(null)}
          />

          {/* Modal Container */}
          <div className="relative bg-white w-full sm:w-[720px] max-w-full h-full sm:h-auto sm:max-h-[92vh] sm:rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col z-10 animate-fade-in-up">
            {/* Header */}
            <div className="bg-gradient-to-r from-slate-50 to-slate-100/50 px-[24px] py-[18px] border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-[10px]">
                <span className="p-2 bg-[#e6f0fa] text-[#0066cc] rounded-lg">
                  <Eye size={18} />
                </span>
                <div>
                  <h4 className="text-[15px] font-bold text-slate-900">L1 Change Request Details</h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">Request details for change request: <span className="font-mono font-bold text-slate-600">{selectedL1Details.change_no}</span></p>
                </div>
              </div>
              <button
                onClick={handleCloseModal}
                className="p-[6px] hover:bg-slate-200/60 rounded-full text-slate-400 hover:text-slate-650 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Content */}
            <div className={`p-[24px] overflow-y-auto space-y-[24px] text-[13px] text-slate-650 flex-1 ${isFetchingL1 ? 'flex flex-col justify-center items-center' : ''}`}>
              {isFetchingL1 ? (
                <div className="flex flex-col items-center justify-center py-[60px] gap-3 text-slate-400 my-auto">
                  <Loader2 className="animate-spin text-[#0066cc]" size={32} />
                  <span className="text-sm font-semibold text-slate-700">Loading L1 Request details...</span>
                </div>
              ) : (
                <>

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
                      } catch {
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
                      <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider font-sans">Risk Analysis </span>
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
                </>
              )}

            </div>

            {/* Footer */}
            <div className="px-[16px] sm:px-[24px] py-[16px] bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
              <span className="hidden sm:inline text-[11px] font-semibold text-slate-400">Nippon Change Management System</span>
              <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto justify-center sm:justify-start">
                <button
                  onClick={handleExportRequestDetailsPDF}
                  disabled={isFetchingL1}
                  className="px-[16px] py-[8px] bg-[#0066cc] hover:bg-[#0052a3] text-white disabled:opacity-50 disabled:cursor-not-allowed rounded-[6px] text-[12px] font-semibold transition-colors shadow-sm cursor-pointer flex items-center gap-[6px] whitespace-nowrap"
                  title="Export this request's full details (L1, L2, L3) as PDF"
                >
                  <Download size={14} />
                  <span>Export PDF</span>
                </button>
                <button
                  onClick={handleCloseModal}
                  className="px-[16px] py-[8px] bg-white border border-slate-200 rounded-[6px] text-slate-655 hover:bg-slate-50 hover:text-slate-800 text-[12px] font-semibold transition-colors shadow-sm cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Attachment Preview Modal (opens in the same page) */}
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
                className="text-slate-400 hover:text-slate-600 p-1 rounded hover:bg-slate-200 transition-colors cursor-pointer"
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
                          This attachment supports the change request validation details for change no {selectedL1Details?.change_no}. The document or image content was uploaded during the Level 1 submission phase.
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
                      {`=== Attachment Plaintext Evidence ===\n\n[INFO] - Supporting document for Change No: ${selectedL1Details?.change_no}\n[SUCCESS] - Document content loaded successfully.\n\n==========================================`}
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
    </div>
  );
};
