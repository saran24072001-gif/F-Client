import { useState, useEffect } from 'react';
import { Paperclip, Search, X, Eye, Save, Download, AlertTriangle, Loader2, Folder, Cpu, CheckCircle2, FileText, Calendar, EyeOff, Clock } from 'lucide-react';
import TablePagination from '@mui/material/TablePagination';
import {
  createEffectivenessLog,
  updateEffectivenessLog,
  getEffectivenessAttachment,
  getL1Details,
  getL1Attachment,
  getL2Details,
  getL2Attachment,
  getL3Details,
  getEffectivenessLogs,
  getEffectivenessCounts
} from '../../api/apiRoutes';
import { formatDateToDDMMYY, formatDateToDDMMYYYY, parseDDMMYYYYToDate } from '../../utils/dateUtils';
import { exportEffectivenessLogsPDF, exportRequestDetailsPDF } from '../../utils/pdfExport';
import { CustomDatePicker } from '../ui/CustomDatePicker';
import { useWebSocket } from '../../hooks/useWebSocket';

const generateEffId = () => `EFF-${Date.now().toString().substring(7)}`;

const getDefaultDateString = () => {
  const d = new Date();
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
};


export const Effectiveness = ({
  changes,
  effectivenessLogs,
  setEffectivenessLogs,
  logAction,
  setToastMsg,
  userRole,
  userDept,
  fetchChanges,
  autoOpenChangeNo = null,
  clearAutoOpen = () => { }
}) => {
  const isAdmin = userRole && (
    userRole.toLowerCase() === 'admin' ||
    userRole.toLowerCase() === 'administrator'
  );
  const isQADept = userDept && (
    userDept.toLowerCase() === 'qad'
  );
  const canUpdate = isAdmin || isQADept;
  const [activeMainTab, setActiveMainTab] = useState('ongoing'); // 'ongoing' | 'closed' | 'rejected'
  // Effectiveness Monitoring Form States
  const [effChangeNo, setEffChangeNo] = useState('');
  const [effMonthWise, setEffMonthWise] = useState(() => getDefaultDateString());
  const [effRemarks, setEffRemarks] = useState('');
  const [effAttachment, setEffAttachment] = useState('');
  const [effStatus, setEffStatus] = useState('');
  const [effQaApproval, setEffQaApproval] = useState('');
  const [editingEffLogId, setEditingEffLogId] = useState(null);
  const [selectedLog, setSelectedLog] = useState(null);
  const [selectedL1Details, setSelectedL1Details] = useState(null);
  const [selectedL2Details, setSelectedL2Details] = useState(null);
  const [isFetchingDetails, setIsFetchingDetails] = useState(false);
  const [activeTab, setActiveTab] = useState('l1');
  const [showCustomerApproval, setShowCustomerApproval] = useState(false);
  const [fileUrls, setFileUrls] = useState({});
  const [fileTypes, setFileTypes] = useState({});
  const [previewFile, setPreviewFile] = useState(null);
  const [uploadedFilesList, setUploadedFilesList] = useState([]);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [pendingAutoSelectChangeNo, setPendingAutoSelectChangeNo] = useState(null);

  useEffect(() => {
    if (effChangeNo) {
      const savedLog = effectivenessLogs.find(
        log => log.changeNo?.toLowerCase().trim() === effChangeNo.toLowerCase().trim()
      );
      if (savedLog) {
        setEditingEffLogId(savedLog.id);
        setEffMonthWise(savedLog.monthWise || getDefaultDateString());
        setEffRemarks(savedLog.remarks || '');
        setEffAttachment(savedLog.attachment || '');
        setEffStatus(savedLog.status || '');
        setEffQaApproval(savedLog.qaApproval || '');
      } else {
        setEditingEffLogId(null);
      }
    } else {
      setEditingEffLogId(null);
    }
  }, [effChangeNo, effectivenessLogs]);

  // Keep selectedLog in sync when effectivenessLogs updates in the background
  useEffect(() => {
    if (selectedLog) {
      const updatedLog = effectivenessLogs.find(log => log.changeNo === selectedLog.changeNo);
      if (updatedLog) {
        // In sync
      }
    }
  }, [effectivenessLogs, selectedLog]);

  // Listen to autoOpenChangeNo from Dashboard redirect
  useEffect(() => {
    if (autoOpenChangeNo) {
      const findAndSelectLog = async () => {
        try {
          const res = await getEffectivenessLogs(); // fetches all logs
          const matchingLog = res.data?.find(
            log => log.changeNo?.toLowerCase().trim() === autoOpenChangeNo.toLowerCase().trim()
          );
          if (matchingLog) {
            let targetTab = 'ongoing';
            if (matchingLog.qaApproval === 'Approved') {
              targetTab = 'closed';
            } else if (matchingLog.qaApproval === 'Rejected') {
              targetTab = 'rejected';
            }

            // Set pending selection so that it will be triggered once the tab logs load
            setPendingAutoSelectChangeNo(matchingLog.changeNo);

            if (activeMainTab !== targetTab) {
              setActiveMainTab(targetTab);
            }
          }
          if (clearAutoOpen) {
            clearAutoOpen();
          }
        } catch (err) {
          console.error('Error auto-opening effectiveness log:', err);
        }
      };
      findAndSelectLog();
    }
  }, [autoOpenChangeNo]);

  const [tabCounts, setTabCounts] = useState({ ongoing: 0, closed: 0, rejected: 0 });
  const [isFetchingLogs, setIsFetchingLogs] = useState(false);

  const fetchLogs = async (silent = false) => {
    if (!silent) setIsFetchingLogs(true);
    try {
      const [logsRes, countsRes] = await Promise.all([
        getEffectivenessLogs(activeMainTab),
        getEffectivenessCounts()
      ]);
      setEffectivenessLogs(logsRes.data);
      setTabCounts(countsRes.data);
    } catch (err) {
      console.error('Error fetching effectiveness logs:', err);
      if (setToastMsg) setToastMsg('Error loading effectiveness logs.');
    } finally {
      if (!silent) setIsFetchingLogs(false);
    }
  };

  useEffect(() => {
    fetchLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMainTab]);

  // Hook WebSocket listener for real-time effectiveness monitoring
  useWebSocket((data) => {
    console.log('📩 Received WebSocket message in Effectiveness:', data);
    if (data.type === 'REFRESH_EFFECTIVENESS' || data.type === 'REFRESH_CHANGES') {
      fetchLogs(true);
      if (selectedLog) {
        handleViewDetails(selectedLog.changeNo, true);
      }
    }
  });

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

  const handleViewAttachment = async (filename, logOrChangeNo = null, type = 'Effectiveness') => {
    if (!filename || filename === '-') return;
    setPreviewFile(filename);

    if (!fileUrls[filename]) {
      try {
        let response;
        if (type === 'L1') {
          response = await getL1Attachment(logOrChangeNo, filename);
        } else if (type === 'L2') {
          response = await getL2Attachment(logOrChangeNo, filename);
        } else {
          // Effectiveness
          const logId = logOrChangeNo?.id || logOrChangeNo;
          if (logId) {
            response = await getEffectivenessAttachment(logId, filename);
          } else {
            return;
          }
        }
        if (response && response.data) {
          const blobUrl = URL.createObjectURL(response.data);
          const mimeType = response.data.type;
          setFileTypes(prev => ({ ...prev, [filename]: mimeType }));
          setFileUrls(prev => ({ ...prev, [filename]: blobUrl }));
        }
      } catch (err) {
        console.error(`Error loading ${type} attachment from server:`, err);
      }
    }
  };

  const handleExportRequestDetailsPDF = () => {
    const isL3Complete = selectedL1Details?.crStatus?.toLowerCase() === 'completed' || selectedLog?.status?.toLowerCase() === 'completed';
    const currentEffLog = effectivenessLogs.find(
      l => l.changeNo?.toLowerCase().trim() === selectedLog?.changeNo?.toLowerCase().trim()
    );
    // Export full details: L1, L2, L3 always. Conditionally pass effectiveness log if available.
    exportRequestDetailsPDF(selectedL1Details, selectedL2Details, selectedLog, 'all', setToastMsg, currentEffLog || null);
  };

  const renderL1FilePill = (filename, changeNo) => {
    if (!filename) return null;
    const files = filename.split(',').map(s => s.trim()).filter(Boolean);
    return (
      <div className="mt-1 flex flex-wrap gap-2">
        {files.map((file, idx) => (
          <span
            key={idx}
            className="inline-flex items-center gap-[6px] bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-md py-1 px-2.5 text-[11px] font-medium text-[#0066cc] cursor-pointer max-w-full"
            onClick={() => handleViewAttachment(file, changeNo, 'L1')}
          >
            <Paperclip size={11} className="text-slate-400" />
            <span className="underline truncate max-w-[200px]">{file}</span>
          </span>
        ))}
      </div>
    );
  };

  const handleViewDetails = async (changeNo, silent = false) => {
    if (!silent) {
      setSelectedLog({
        changeNo: changeNo,
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
      });
      setSelectedL1Details(null);
      setSelectedL2Details(null);
      setIsFetchingDetails(true);
      setActiveTab('l1');
    }

    try {
      const [l1Res, l2Res, l3Res] = await Promise.all([
        getL1Details(changeNo),
        getL2Details(changeNo).catch(() => ({ data: null })),
        getL3Details(changeNo).catch(() => ({ data: null }))
      ]);

      setSelectedL1Details(l1Res.data);
      setSelectedL2Details(l2Res.data);

      const matchedL3 = l3Res.data;
      const newLogData = (matchedL3 && matchedL3.changeNo) ? matchedL3 : {
        changeNo: changeNo,
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
      console.error('Error fetching request details:', err);
    } finally {
      if (!silent) setIsFetchingDetails(false);
    }
  };

  // Search & Filter States
  const [effSearch, setEffSearch] = useState('');
  const [effFilterMonth, setEffFilterMonth] = useState('All');
  const [effFromDate, setEffFromDate] = useState('');
  const [effToDate, setEffToDate] = useState('');

  // Pagination State
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // Reset page when filters change
  useEffect(() => {
    setPage(0);
  }, [effSearch, effFilterMonth, effFromDate, effToDate]);

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

  // Formatted date (e.g., "2026-05-20" -> "20/05/26")
  const formatDateShort = (dateStr) => {
    return formatDateToDDMMYY(dateStr);
  };

  // Add or Edit Effectiveness Log
  const handleAddOrEditEff = async (e) => {
    e.preventDefault();
    if (!effChangeNo) {
      setToastMsg('Please select a Change Request.');
      return;
    }
    if (!effMonthWise) {
      setToastMsg({ text: 'Please select Month Wise.', isError: true });
      return;
    }

    // Validate: Month Wise must be on or after Change Date Start
    const selectedChangeForValidation = changes.find(c => c.id === effChangeNo);
    if (selectedChangeForValidation) {
      const rawStart = selectedChangeForValidation.dateStart || selectedChangeForValidation.rawDate || selectedChangeForValidation.date;
      if (rawStart) {
        // Parse effMonthWise (DD/MM/YYYY) into a Date
        let monthWiseDate = null;
        if (effMonthWise.includes('/')) {
          const parts = effMonthWise.split('/');
          if (parts.length === 3) {
            monthWiseDate = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
          }
        } else {
          monthWiseDate = new Date(effMonthWise);
        }
        // Parse startDate (YYYY-MM-DD) into a Date (compare at day level)
        const startParts = rawStart.split('-');
        const startDate = startParts.length === 3
          ? new Date(parseInt(startParts[0]), parseInt(startParts[1]) - 1, parseInt(startParts[2]))
          : new Date(rawStart);
        if (monthWiseDate && !isNaN(startDate) && !isNaN(monthWiseDate) && monthWiseDate < startDate) {
          setToastMsg({ text: `Month Wise date must be on or after the Change Start Date (${displayStartDate || rawStart}).`, isError: true });
          return;
        }
      }
    }
    if (!effRemarks || !effRemarks.trim()) {
      setToastMsg('Please enter Observation Remarks.');
      return;
    }
    if (!effAttachment) {
      setToastMsg('Please upload an Attachment.');
      return;
    }
    if (!effStatus) {
      setToastMsg('Please select Effectiveness Status.');
      return;
    }
    if (!effQaApproval) {
      setToastMsg('Please select QA Approval Decision.');
      return;
    }

    const selectedChange = changes.find(c => c.id === effChangeNo);
    const context = selectedChange ? selectedChange.title : 'External Assessment';
    const reqDate = selectedChange ? (selectedChange.rawDate || selectedChange.date) : new Date().toISOString().split('T')[0];
    const startDate = selectedChange ? (selectedChange.dateStart || selectedChange.rawDate || selectedChange.date) : new Date().toISOString().split('T')[0];

    const savedLog = effectivenessLogs.find(
      log => log.changeNo?.toLowerCase().trim() === effChangeNo.toLowerCase().trim()
    );

    if (savedLog) {
      // Edit mode
      const logData = {
        monthWise: effMonthWise,
        remarks: effRemarks,
        attachment: effAttachment,
        status: effStatus,
        qaApproval: effQaApproval
      };
      try {
        const response = await updateEffectivenessLog(savedLog.id, logData, uploadedFilesList);
        logAction('Effectiveness Log Updated', `Updated monitoring observations for change ${effChangeNo}.`);
        setToastMsg(`Log entry updated for ${effChangeNo}`);
        fetchLogs();
        if (fetchChanges) fetchChanges();
        handleCancelEditing();
      } catch (err) {
        console.error("Error updating log:", err);
        const errMsg = err.response?.data?.error || 'Failed to update effectiveness log.';
        setToastMsg({ text: errMsg, isError: true });
      }
    } else {
      // Create mode
      const newId = generateEffId();
      const logData = {
        id: newId,
        changeNo: effChangeNo,
        reqDate: reqDate,
        context: context,
        startDate: startDate,
        monthWise: effMonthWise,
        remarks: effRemarks,
        attachment: effAttachment,
        status: effStatus,
        qaApproval: effQaApproval
      };
      try {
        const response = await createEffectivenessLog(logData, uploadedFilesList);
        logAction('Effectiveness Log Created', `Created monitoring observations for change ${effChangeNo}.`);
        setToastMsg(`Log entry added for ${effChangeNo}`);
        fetchLogs();
        if (fetchChanges) fetchChanges();
        handleCancelEditing();
      } catch (err) {
        console.error("Error creating log:", err);
        const errMsg = err.response?.data?.error || 'Failed to create effectiveness log.';
        setToastMsg({ text: errMsg, isError: true });
      }
    }
  };

  // Cancel selection
  const handleCancelEditing = () => {
    setEffChangeNo('');
    setEditingEffLogId(null);
    setEffMonthWise(getDefaultDateString());
    setEffRemarks('');
    setEffAttachment('');
    setEffStatus('');
    setEffQaApproval('');
    setUploadedFilesList([]);
  };

  const handleMainTabChange = (tab) => {
    setActiveMainTab(tab);
    handleCancelEditing();
    // Reset filters when switching tabs to avoid confusing empty states
    setEffSearch('');
    setEffFilterMonth('All');
    setEffFromDate('');
    setEffToDate('');
    setPage(0);
  };

  const handleSelectChangeNo = (val) => {
    setEffChangeNo(val);
    const savedLog = effectivenessLogs.find(
      log => log.changeNo?.toLowerCase().trim() === val.toLowerCase().trim()
    );
    if (savedLog) {
      setEditingEffLogId(savedLog.id);
      setEffMonthWise(savedLog.monthWise || getDefaultDateString());
      setEffRemarks(savedLog.remarks || '');
      setEffAttachment(savedLog.attachment || '');
      setEffStatus(savedLog.status || '');
      setEffQaApproval(savedLog.qaApproval || '');
    } else {
      setEditingEffLogId(null);
      setEffMonthWise(getDefaultDateString());
      setEffRemarks('');
      setEffAttachment('');
      setEffStatus('');
      setEffQaApproval('');
    }
    setUploadedFilesList([]);
  };



  // Construct table logs directly from the backend effectivenessLogs database response
  const tableLogs = effectivenessLogs || [];

  // Extract unique months for filter from both saved logs and pending change requests
  const uniqueMonthsRaw = Array.from(
    new Set(
      tableLogs.map(log => {
        const val = log.monthWise || log.startDate || log.reqDate;
        return val ? formatMonthWise(val) : null;
      }).filter(Boolean)
    )
  ).filter(m => m !== '-' && m !== 'All' && m !== 'Pending');

  // Sort unique months chronologically
  const monthOrder = {
    Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
    Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11
  };
  const uniqueMonths = uniqueMonthsRaw.sort((a, b) => {
    const [aMonth, aYear] = a.split('-');
    const [bMonth, bYear] = b.split('-');
    const yearDiff = parseInt(aYear, 10) - parseInt(bYear, 10);
    if (yearDiff !== 0) return yearDiff;
    return monthOrder[aMonth] - monthOrder[bMonth];
  });

  const filteredLogs = tableLogs.filter(log => {
    const query = effSearch.toLowerCase();
    const matchesSearch = !query ||
      (log.changeNo || '').toLowerCase().includes(query) ||
      (log.context || '').toLowerCase().includes(query) ||
      (log.remarks || '').toLowerCase().includes(query);

    let matchesMonth = true;
    if (effFilterMonth !== 'All') {
      if (effFilterMonth === 'Pending') {
        matchesMonth = log.isPending;
      } else {
        const logMonth = log.monthWise ? formatMonthWise(log.monthWise) : formatMonthWise(log.startDate || log.reqDate);
        matchesMonth = logMonth === effFilterMonth;
      }
    }

    let matchesFromDate = true;
    let matchesToDate = true;
    if (effFromDate && effToDate) {
      const fD = parseDDMMYYYYToDate(effFromDate);
      const tD = parseDDMMYYYYToDate(effToDate);
      if (fD && tD) {
        fD.setHours(0, 0, 0, 0);
        tD.setHours(23, 59, 59, 999);
        const itemD = parseDDMMYYYYToDate(log.reqDate);
        matchesFromDate = itemD && itemD >= fD;
        matchesToDate = itemD && itemD <= tD;
      }
    }

    return matchesSearch && matchesMonth && matchesFromDate && matchesToDate;
  });

  const displayLogs = filteredLogs;

  // Listen to effectivenessLogs changes and select the pending change request
  useEffect(() => {
    if (pendingAutoSelectChangeNo && effectivenessLogs.length > 0) {
      const hasMatch = effectivenessLogs.some(
        log => log.changeNo?.toLowerCase().trim() === pendingAutoSelectChangeNo.toLowerCase().trim()
      );
      if (hasMatch) {
        handleSelectChangeNo(pendingAutoSelectChangeNo);

        // Calculate page index of the matching log
        const index = displayLogs.findIndex(
          log => log.changeNo?.toLowerCase().trim() === pendingAutoSelectChangeNo.toLowerCase().trim()
        );
        if (index !== -1) {
          const targetPage = Math.floor(index / rowsPerPage);
          setPage(targetPage);
        }

        setPendingAutoSelectChangeNo(null);
      }
    }
  }, [effectivenessLogs, pendingAutoSelectChangeNo, rowsPerPage, displayLogs]);

  const paginatedLogs = displayLogs.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  const handleExportPDF = () => {
    // Export all filtered logs for the current tab (respects all active filters)
    const logsToExport = displayLogs.map(l => ({
      ...l,
      reqDate: l.reqDate,
      startDate: l.startDate,
      qaApproval: l.qaApproval
    }));
    const tabLabel = activeMainTab === 'closed' ? 'Closed Requests' : activeMainTab === 'rejected' ? 'Rejected Requests' : 'Ongoing Monitoring';
    exportEffectivenessLogsPDF(logsToExport, {
      searchQuery: effSearch,
      monthFilter: effFilterMonth,
      fromDate: effFromDate,
      toDate: effToDate,
      tabLabel
    }, setToastMsg);
  };


  const selectedChange = changes.find(c => c.id === effChangeNo);

  const matchedLog = effectivenessLogs.find(
    log => log.changeNo?.toLowerCase().trim() === effChangeNo?.toLowerCase().trim()
  );

  const isAlreadyValidated = !!matchedLog;
  const isClosed = matchedLog?.qaApproval === 'Approved';
  const isQaUpdateBlocked = !!(matchedLog && !isAdmin && isQADept && (matchedLog.qaUpdateCount >= 1));
  const isUpdateBlocked = !isAdmin && (!canUpdate || isQaUpdateBlocked || isClosed);

  // Derive display values for requested date, context, start date
  const displayReqDate = selectedChange ? formatDateShort(selectedChange.rawDate || selectedChange.date) : '';
  const displayContext = selectedChange ? selectedChange.title : '';
  const displayStartDate = selectedChange ? formatDateShort(selectedChange.dateStart || selectedChange.rawDate || selectedChange.date) : '';

  return (
    <div className="space-y-[16px] animate-fade-in-up text-slate-800 pb-[40px]">
      <div>
        <h3 className="font-heading text-2xl font-bold text-slate-900">Effectiveness Monitoring</h3>
        <p className="text-slate-500 text-sm">Add observations and track 3-month post-implementation effectiveness logs.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-[24px] items-start">

        {/* LEFT COLUMN: Add Effectiveness Log Form */}
        {canUpdate && (
          <div className="lg:col-span-4 bg-white border border-slate-200/60 rounded-xl p-6 shadow-sm hover:shadow-md transition-all duration-300 space-y-[16px] h-fit">
            <div className="flex items-center gap-[8px] border-b border-slate-100 pb-[8px]">
              <Save size={16} className="text-[#0066cc]" />
              <h4 className="text-[13px] font-bold text-slate-900">Add Monitoring Log</h4>
            </div>

            <form onSubmit={handleAddOrEditEff} className="space-y-[14px]">
              {/* 4M CHANGE NO */}
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">4M Change No <span className="text-rose-500">*</span></label>
                <input
                  type="text"
                  disabled
                  placeholder="Click a row on the right to select"
                  className="w-full bg-slate-100 border border-slate-200 rounded-[6px] py-[8px] px-[12px] text-[12px] outline-none text-slate-500 cursor-not-allowed select-none animate-fade-in-up"
                  value={effChangeNo}
                />
              </div>

              {effChangeNo && isClosed ? (
                <div className="bg-emerald-50 border border-emerald-250 text-emerald-800 rounded-lg p-3 text-[11px] leading-relaxed flex items-start gap-2 animate-fade-in-up">
                  <CheckCircle2 size={14} className="shrink-0 mt-0.5 text-emerald-600" />
                  <div>
                    <span className="font-bold">Log Closed:</span> This effectiveness log has been Approved and Closed. No further updates are allowed.
                  </div>
                </div>
              ) : (
                <>
                  {effChangeNo && isAlreadyValidated && isQaUpdateBlocked && (
                    <div className="bg-amber-50 border border-amber-250 text-amber-800 rounded-lg p-3 text-[11px] leading-relaxed flex items-start gap-2 animate-fade-in-up">
                      <AlertTriangle size={14} className="shrink-0 mt-0.5 text-amber-600" />
                      <div>
                        <span className="font-bold">Log Locked:</span> You have already updated this effectiveness log once. Unlimited updates are allowed only for Administrators.
                      </div>
                    </div>
                  )}

                  {effChangeNo && isAlreadyValidated && isAdmin && (
                    <div className="bg-blue-50 border border-blue-200 text-blue-800 rounded-lg p-3 text-[11px] leading-relaxed flex items-start gap-2 animate-fade-in-up">
                      <AlertTriangle size={14} className="shrink-0 mt-0.5 text-blue-600" />
                      <div>
                        <span className="font-bold">Admin Edit Mode:</span> You have unlimited update access to modify this effectiveness log.
                      </div>
                    </div>
                  )}

                  {effChangeNo && isAlreadyValidated && isQADept && !isAdmin && !isQaUpdateBlocked && (
                    <div className="bg-blue-50 border border-blue-200 text-blue-800 rounded-lg p-3 text-[11px] leading-relaxed flex items-start gap-2 animate-fade-in-up">
                      <AlertTriangle size={14} className="shrink-0 mt-0.5 text-blue-600" />
                      <div>
                        <span className="font-bold">Edit Mode:</span> This effectiveness log has already been submitted. As a QA user, you can update it once.
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* REQUESTED DATE */}
              <div className="space-y-[4px]">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Requested Date <span className="text-rose-500">*</span></label>
                <input
                  type="text"
                  disabled
                  placeholder="Click a row on the right to select"
                  className="w-full bg-slate-100 border border-slate-200 rounded-[6px] py-[8px] px-[12px] text-[12px] outline-none text-slate-500 cursor-not-allowed select-none"
                  value={displayReqDate}
                />
              </div>

              {/* CONTEXT OF CHANGE */}
              <div className="space-y-[4px]">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Context of Change <span className="text-rose-500">*</span></label>
                <input
                  type="text"
                  disabled
                  placeholder="Click a row on the right to select"
                  className="w-full bg-slate-100 border border-slate-200 rounded-[6px] py-[8px] px-[12px] text-[12px] outline-none text-slate-500 cursor-not-allowed select-none"
                  value={displayContext}
                />
              </div>

              {/* CHANGE DATE START */}
              <div className="space-y-[4px]">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Change Date Start <span className="text-rose-500">*</span></label>
                <input
                  type="text"
                  disabled
                  placeholder="Click a row on the right to select"
                  className="w-full bg-slate-100 border border-slate-200 rounded-[6px] py-[8px] px-[12px] text-[12px] outline-none text-slate-500 cursor-not-allowed select-none"
                  value={displayStartDate}
                />
              </div>

              {/* MONTH WISE */}
              <div className="space-y-[4px] relative">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Month Wise <span className="text-rose-500">*</span></label>
                <CustomDatePicker
                  value={effMonthWise}
                  onChange={setEffMonthWise}
                  readOnly={true}
                  disabled={!effChangeNo || (isAlreadyValidated && isUpdateBlocked)}
                  minDate={(() => {
                    // Convert YYYY-MM-DD startDate to DD/MM/YYYY for the picker minDate
                    const rawStart = selectedChange?.dateStart || selectedChange?.rawDate || selectedChange?.date;
                    if (!rawStart) return undefined;
                    const parts = rawStart.split('-');
                    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
                    return undefined;
                  })()}
                  inputClassName={`w-full bg-slate-50 border border-slate-200 rounded-[6px] py-[8px] pl-[12px] pr-[30px] text-[12px] outline-none focus:border-[#0066cc] ${(!effChangeNo || (isAlreadyValidated && isUpdateBlocked)) ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-slate-50 border-slate-200 cursor-pointer'}`}
                  buttonClassName="right-[10px] top-[50%] -translate-y-1/2"
                />
                {effMonthWise && selectedChange && (() => {
                  // Show inline warning if current value is before start date
                  const rawStart = selectedChange.dateStart || selectedChange.rawDate || selectedChange.date;
                  if (!rawStart) return null;
                  let monthWiseDate = null;
                  if (effMonthWise.includes('/')) {
                    const p = effMonthWise.split('/');
                    if (p.length === 3) monthWiseDate = new Date(parseInt(p[2]), parseInt(p[1]) - 1, parseInt(p[0]));
                  } else { monthWiseDate = new Date(effMonthWise); }
                  const sp = rawStart.split('-');
                  const startD = sp.length === 3 ? new Date(parseInt(sp[0]), parseInt(sp[1]) - 1, parseInt(sp[2])) : new Date(rawStart);
                  if (monthWiseDate && !isNaN(startD) && !isNaN(monthWiseDate) && monthWiseDate < startD) {
                    return (
                      <span className="text-rose-500 text-[10px] block mt-[2px] font-semibold">
                        ⚠ Month Wise must be on or after Change Start Date ({displayStartDate})
                      </span>
                    );
                  }
                  return null;
                })()}
              </div>

              {/* OBSERVATION REMARKS */}
              <div className="space-y-[4px]">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Observation Remarks <span className="text-rose-500">*</span></label>
                <textarea
                  required
                  disabled={!effChangeNo || (isAlreadyValidated && isUpdateBlocked)}
                  rows={3}
                  placeholder="Enter evaluation remarks/results..."
                  maxLength={1000}
                  className={`w-full border rounded-[6px] py-[8px] px-[12px] text-[12px] outline-none focus:border-[#0066cc] ${(!effChangeNo || (isAlreadyValidated && isUpdateBlocked)) ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed' : 'bg-slate-50 border-slate-200'
                    }`}
                  value={effRemarks}
                  onChange={(e) => setEffRemarks(e.target.value)}
                />
                <div className="flex justify-between items-center text-[9px] text-slate-400">
                  <span>Enter observation remarks</span>
                  <span className={`${1000 - effRemarks.length <= 15 ? 'text-amber-600 font-bold animate-pulse' : 'text-slate-400'}`}>
                    {1000 - effRemarks.length} characters remaining (max 1000 chars)
                  </span>
                </div>
              </div>

              {/* ATTACHMENTS */}
              <div className="space-y-[4px]">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Attachments <span className="text-rose-500">*</span></label>
                <div className="flex gap-[8px]">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      required
                      readOnly
                      disabled={!effChangeNo || (isAlreadyValidated && isUpdateBlocked)}
                      placeholder="e.g. proof-log.pdf, image.png"
                      className={`w-full border rounded-[6px] py-[8px] px-[12px] text-[12px] outline-none pr-[30px] ${(!effChangeNo || (isAlreadyValidated && isUpdateBlocked)) ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed' : 'bg-slate-50 border-slate-200'
                        }`}
                      value={effAttachment}
                    />
                    {effAttachment && (!isAlreadyValidated || !isUpdateBlocked) && (
                      <button
                        type="button"
                        disabled={!effChangeNo || (isAlreadyValidated && isUpdateBlocked)}
                        onClick={() => {
                          setDeleteConfirm({
                            title: 'Clear All Attachments?',
                            message: 'Are you sure you want to clear all attachments from this field?',
                            onConfirm: () => {
                              setEffAttachment('');
                              setUploadedFilesList([]);
                            }
                          });
                        }}
                        className="absolute right-[10px] top-[10px] text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                        title="Clear all attachments"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                  <label className={`flex items-center justify-center gap-[6px] px-[12px] py-[8px] border border-slate-200 rounded-[6px] text-[12px] font-bold transition-all cursor-pointer ${(!effChangeNo || (isAlreadyValidated && isUpdateBlocked)) ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-white hover:bg-slate-50 text-slate-700'
                    }`}>
                    <Paperclip size={14} />
                    <span>Upload</span>
                    <input
                      key={effAttachment || ''}
                      type="file"
                      multiple
                      accept="image/*,application/pdf"
                      disabled={!effChangeNo || (isAlreadyValidated && isUpdateBlocked)}
                      className="hidden"
                      onChange={async (e) => {
                        const target = e.target;
                        if (target.files && target.files.length > 0) {
                          const files = Array.from(target.files);
                          const MAX_SIZE = 100 * 1024 * 1024; // 100MB
                          const tooLargeFiles = files.filter(f => f.size > MAX_SIZE);

                          if (tooLargeFiles.length > 0) {
                            if (setToastMsg) {
                              setToastMsg(`Upload not allowed: File(s) exceed 100MB limit: ${tooLargeFiles.map(f => f.name).join(', ')}`);
                            }
                            target.value = '';
                            return;
                          }

                          // Validate file type
                          const allowedFiles = files.filter(file => {
                            const isImage = file.type.startsWith('image/');
                            const isPdf = file.type === 'application/pdf';
                            const hasAllowedExt = /\.(jpg|jpeg|jfif|png|gif|webp|bold|png|gif|webp|bmp|svg|tiff|tif|ico|heic|heif|avif|pdf)$/i.test(file.name);
                            return (isImage || isPdf) && hasAllowedExt;
                          });

                          if (allowedFiles.length !== files.length) {
                            if (setToastMsg) {
                              setToastMsg('Only PDF and image files are allowed. Invalid files were skipped.');
                            }
                          }

                          if (allowedFiles.length === 0) {
                            target.value = '';
                            return;
                          }

                          const names = allowedFiles.map(f => f.name.replace(/,/g, '_'));

                          // Reset input value synchronously immediately to allow uploading the same file again
                          target.value = '';

                          // Store object URLs for preview
                          const newUrls = {};
                          const newTypes = {};
                          allowedFiles.forEach(file => {
                            const name = file.name.replace(/,/g, '_');
                            newUrls[name] = URL.createObjectURL(file);
                            newTypes[name] = file.type || 'application/octet-stream';
                          });
                          setFileUrls(prev => ({ ...prev, ...newUrls }));
                          setFileTypes(prev => ({ ...prev, ...newTypes }));

                          // Convert files to base64 for server upload
                          const base64Files = await Promise.all(
                            allowedFiles.map(async (file) => ({
                              name: file.name.replace(/,/g, '_'),
                              type: file.type || 'application/octet-stream',
                              data: await fileToBase64(file)
                            }))
                          );
                          setUploadedFilesList(prev => {
                            const existingNames = prev.map(f => f.name);
                            const newOnes = base64Files.filter(f => !existingNames.includes(f.name));
                            return [...prev, ...newOnes];
                          });

                          const existing = effAttachment ? effAttachment.split(',').map(s => s.trim()).filter(Boolean) : [];
                          const updated = Array.from(new Set([...existing, ...names])).join(', ');
                          setEffAttachment(updated);
                        }
                      }}
                    />
                  </label>
                </div>

                {/* Selected File Pills */}
                {effAttachment && (
                  <div className="flex flex-wrap gap-[6px] pt-[6px]">
                    {effAttachment.split(',').map(s => s.trim()).filter(Boolean).map((file, i) => (
                      <span key={i} className="inline-flex items-center gap-[4px] bg-slate-50 border border-slate-200 text-[11px] font-semibold text-slate-700 px-[8px] py-[2px] rounded-[4px] select-none">
                        <span
                          onClick={() => handleViewAttachment(file)}
                          className="truncate max-w-[150px] cursor-pointer hover:underline text-[#0066cc]"
                          title="Click to view file"
                        >
                          📎 {file}
                        </span>
                        {(!isAlreadyValidated || !isUpdateBlocked) && (
                          <button
                            type="button"
                            disabled={!effChangeNo || (isAlreadyValidated && isUpdateBlocked)}
                            onClick={() => {
                              setDeleteConfirm({
                                title: 'Delete Attachment?',
                                message: `Are you sure you want to delete "${file}"? This action cannot be undone.`,
                                onConfirm: () => {
                                  const existing = effAttachment.split(',').map(s => s.trim()).filter(Boolean);
                                  const updated = existing.filter(f => f !== file).join(', ');
                                  setEffAttachment(updated);
                                  setUploadedFilesList(prev => prev.filter(f => f.name !== file));
                                }
                              });
                            }}
                            className="text-slate-400 hover:text-rose-600 font-bold ml-[2px] cursor-pointer text-xs"
                          >
                            &times;
                          </button>
                        )}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* EFFECTIVENESS STATUS */}
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Effectiveness Status <span className="text-rose-500">*</span></label>
                <select
                  required
                  disabled={!effChangeNo || (isAlreadyValidated && isUpdateBlocked)}
                  className={`w-full border rounded-[6px] py-[8px] px-[12px] text-[12px] outline-none focus:border-[#0066cc] ${(!effChangeNo || (isAlreadyValidated && isUpdateBlocked)) ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed' : 'bg-slate-50 border-slate-200 cursor-pointer'
                    }`}
                  value={effStatus}
                  onChange={(e) => setEffStatus(e.target.value)}
                >
                  <option value="">Select Status</option>
                  <option value="Effectiveness Ok">Effectiveness Ok</option>
                  <option value="Effectiveness Not Ok">Effectiveness Not Ok</option>
                </select>
              </div>

              {/* QA APPROVAL DECISION */}
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">QA Approval Decision <span className="text-rose-500">*</span></label>
                <select
                  required
                  disabled={!effChangeNo || (isAlreadyValidated && isUpdateBlocked)}
                  className={`w-full border rounded-[6px] py-[8px] px-[12px] text-[12px] outline-none focus:border-[#0066cc] ${(!effChangeNo || (isAlreadyValidated && isUpdateBlocked)) ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed' : 'bg-slate-50 border-slate-200 cursor-pointer'
                    }`}
                  value={effQaApproval}
                  onChange={(e) => setEffQaApproval(e.target.value)}
                >
                  <option value="">Select QA Decision</option>
                  <option value="Approved">Approved</option>
                  <option value="Rejected">Rejected</option>
                </select>
              </div>

              {/* Buttons */}
              <div className="space-y-[8px] pt-[4px]">
                <button
                  type="submit"
                  disabled={!effChangeNo || (isAlreadyValidated && isUpdateBlocked)}
                  className="w-full flex items-center justify-center gap-[6px] bg-[#e6f0fa] hover:bg-[#d6e6f5] disabled:opacity-50 disabled:cursor-not-allowed border border-[#b2d1f0] text-[#0066cc] py-[10px] rounded-[6px] text-[12px] font-bold transition-all transform active:scale-[0.98] cursor-pointer"
                >
                  {!effChangeNo ? (
                    <span>Select a Request to Evaluate</span>
                  ) : isClosed ? (
                    <span>Log is Closed</span>
                  ) : (isAlreadyValidated && isUpdateBlocked) ? (
                    <span>Log Update Limit Reached</span>
                  ) : isAlreadyValidated ? (
                    <>
                      <Save size={14} />
                      <span>Update Log Entry</span>
                    </>
                  ) : (
                    <>
                      <Save size={14} />
                      <span>Add Log Entry</span>
                    </>
                  )}
                </button>
                {(editingEffLogId || effChangeNo) && (
                  <button
                    type="button"
                    onClick={handleCancelEditing}
                    className="w-full text-center py-[6px] text-slate-500 hover:text-slate-800 text-[11px] font-semibold cursor-pointer"
                  >
                    Cancel Selection
                  </button>
                )}
              </div>
            </form>
          </div>
        )}

        {/* RIGHT COLUMN: Table Column */}
        <div className={`${canUpdate ? 'lg:col-span-8' : 'lg:col-span-12'} space-y-[16px]`}>
          {/* Tabs for Active/Closed/Rejected Monitoring */}
          <div className="flex border-b border-slate-200 bg-white p-1 rounded-t-xl gap-2 shrink-0">
            <button
              type="button"
              onClick={() => handleMainTabChange('ongoing')}
              className={`flex-1 sm:flex-initial text-center py-2 px-5 text-xs font-bold transition-all duration-200 rounded-lg flex items-center justify-center gap-2 cursor-pointer ${activeMainTab === 'ongoing'
                ? 'bg-[#0066cc] text-white font-extrabold shadow-md'
                : 'bg-slate-100/60 text-slate-600 hover:bg-[#e6f0fa]/80 hover:text-[#0066cc] font-medium'
                }`}
            >
              <span>Ongoing Monitoring</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] transition-colors duration-200 ${activeMainTab === 'ongoing'
                ? 'bg-white text-[#0066cc] font-bold'
                : 'bg-slate-200 text-slate-600'
                }`}>
                {tabCounts.ongoing}
              </span>
            </button>
            <button
              type="button"
              onClick={() => handleMainTabChange('closed')}
              className={`flex-1 sm:flex-initial text-center py-2 px-5 text-xs font-bold transition-all duration-200 rounded-lg flex items-center justify-center gap-2 cursor-pointer ${activeMainTab === 'closed'
                ? 'bg-emerald-600 text-white font-extrabold shadow-md'
                : 'bg-slate-100/60 text-slate-600 hover:bg-emerald-50/80 hover:text-emerald-700 font-medium'
                }`}
            >
              <span>Closed Requests</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] transition-colors duration-200 ${activeMainTab === 'closed'
                ? 'bg-white text-emerald-600 font-bold'
                : 'bg-slate-200 text-slate-600'
                }`}>
                {tabCounts.closed}
              </span>
            </button>
            <button
              type="button"
              onClick={() => handleMainTabChange('rejected')}
              className={`flex-1 sm:flex-initial text-center py-2 px-5 text-xs font-bold transition-all duration-200 rounded-lg flex items-center justify-center gap-2 cursor-pointer ${activeMainTab === 'rejected'
                ? 'bg-rose-600 text-white font-extrabold shadow-md'
                : 'bg-slate-100/60 text-slate-600 hover:bg-rose-50/80 hover:text-rose-700 font-medium'
                }`}
            >
              <span>Rejected Requests</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] transition-colors duration-200 ${activeMainTab === 'rejected'
                ? 'bg-white text-rose-600 font-bold'
                : 'bg-slate-200 text-slate-600'
                }`}>
                {tabCounts.rejected}
              </span>
            </button>
          </div>

          {/* Search and Filters */}
          <div className="bg-white border border-slate-200/60 rounded-xl p-4 shadow-sm hover:shadow-md transition-all duration-300 flex flex-wrap gap-3 items-center w-full">
            <div className="flex-grow min-w-[200px] relative">
              <Search className="absolute left-3 top-2.5 text-slate-400" size={14} />
              <input
                type="text"
                placeholder="Search logs by change no or remarks..."
                className="w-full pl-8 pr-4 py-1.5 border border-slate-200 rounded-lg text-xs outline-none focus:border-[#0066cc]"
                value={effSearch}
                onChange={(e) => setEffSearch(e.target.value)}
              />
            </div>

            <div className="flex-1 min-w-[120px] max-w-[150px] relative">
              <CustomDatePicker
                value={effFromDate}
                onChange={(val) => {
                  if (val && effToDate) {
                    const [fd, fm, fy] = val.split('/');
                    const [td, tm, ty] = effToDate.split('/');
                    const fDate = new Date(fy, fm - 1, fd);
                    const tDate = new Date(ty, tm - 1, td);
                    if (fDate > tDate) {
                      setToastMsg({ text: "From Date cannot be later than To Date", isError: true });
                      return;
                    }
                  }
                  setEffFromDate(val);
                }}
                readOnly={true}
                placeholder="From Date"
                inputClassName="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-white outline-none focus:border-[#0066cc] placeholder-slate-400 text-slate-600 pr-8"
                buttonClassName="right-2 top-1/2 -translate-y-1/2 scale-90"
              />
            </div>

            <div className="flex-1 min-w-[120px] max-w-[150px] relative" onClickCapture={(e) => {
              if (!effFromDate) {
                e.stopPropagation();
                setToastMsg("Please select 'From Date' before selecting 'To Date'.");
              }
            }}>
              <CustomDatePicker
                value={effToDate}
                onChange={(val) => {
                  if (val && effFromDate) {
                    const [fd, fm, fy] = effFromDate.split('/');
                    const [td, tm, ty] = val.split('/');
                    const fDate = new Date(fy, fm - 1, fd);
                    const tDate = new Date(ty, tm - 1, td);
                    if (tDate < fDate) {
                      setToastMsg({ text: "To Date cannot be earlier than From Date", isError: true });
                      return;
                    }
                  }
                  setEffToDate(val);
                }}
                readOnly={true}
                placeholder="To Date"
                inputClassName={`w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-white outline-none focus:border-[#0066cc] placeholder-slate-400 text-slate-600 pr-8 ${!effFromDate ? 'opacity-70 cursor-not-allowed bg-slate-50' : ''}`}
                buttonClassName="right-2 top-1/2 -translate-y-1/2 scale-90"
                disabled={!effFromDate}
              />
            </div>

            {(effSearch || effFilterMonth !== 'All' || effFromDate || effToDate) && (
              <button
                onClick={() => {
                  setEffSearch('');
                  setEffFilterMonth('All');
                  setEffFromDate('');
                  setEffToDate('');
                }}
                className="text-[10px] font-bold text-rose-500 hover:text-rose-700 transition-colors cursor-pointer uppercase tracking-wider px-2"
              >
                Reset
              </button>
            )}

            <div>
              <select
                className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-white outline-none min-w-[120px] focus:border-[#0066cc]"
                value={effFilterMonth}
                onChange={(e) => setEffFilterMonth(e.target.value)}
              >
                <option value="All">All Months</option>
                {uniqueMonths.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={handleExportPDF}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0066cc] hover:bg-[#0052a3] text-white rounded-lg text-xs font-bold cursor-pointer transition-all shadow-sm duration-200 font-sans"
              title="Export effectiveness monitoring logs as PDF"
            >
              <Download size={12} />
              <span>Export PDF</span>
            </button>
          </div>

          {/* Logs Table Card */}
          <div className="bg-white border border-slate-200/60 rounded-xl shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-150 text-[10px]">
                    <th className="p-[8px] font-bold text-slate-500 uppercase tracking-wider w-[50px]">Sl No</th>
                    <th className="p-[8px] font-bold text-slate-500 uppercase tracking-wider">4M Change No</th>
                    <th className="p-[8px] font-bold text-slate-500 uppercase tracking-wider">Requested Date</th>
                    <th className="p-[8px] font-bold text-slate-500 uppercase tracking-wider w-[320px] min-w-[320px] max-w-[320px]">Context of Change</th>
                    <th className="p-[8px] font-bold text-slate-500 uppercase tracking-wider">Change Date Start</th>
                    <th className="p-[8px] font-bold text-slate-500 uppercase tracking-wider">Month Wise</th>
                    <th className="p-[8px] font-bold text-slate-500 uppercase tracking-wider">Remarks</th>
                    <th className="p-[8px] font-bold text-slate-500 uppercase tracking-wider">Attachment</th>
                    <th className="p-[8px] font-bold text-slate-500 uppercase tracking-wider">Effectiveness Status</th>
                    <th className="p-[8px] font-bold text-slate-500 uppercase tracking-wider">QA Approval</th>
                    <th className="p-[8px] w-10 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-[11px]">
                  {isFetchingLogs ? (
                    <tr>
                      <td colSpan={11} className="text-center py-[48px] text-slate-400">
                        <div className="flex flex-col items-center justify-center gap-[8px]">
                          <Loader2 className="animate-spin text-[#0066cc]" size={20} />
                          <span>Fetching effectiveness data...</span>
                        </div>
                      </td>
                    </tr>
                  ) : displayLogs.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="text-center py-10 text-slate-400">
                        No observations logs recorded.
                      </td>
                    </tr>
                  ) : (
                    paginatedLogs.map((log, idx) => {
                      return (
                        <tr
                          key={log.id}
                          className="hover:bg-slate-50/50 cursor-pointer transition-colors"
                          onClick={() => handleSelectChangeNo(log.changeNo)}
                        >
                          <td className="p-3 font-bold text-slate-400">{page * rowsPerPage + idx + 1}</td>
                          <td className="p-3 font-bold text-[#0066cc]">{log.changeNo}</td>
                          <td className="p-3 text-slate-500">{formatDateShort(log.reqDate)}</td>
                          <td className="p-3 font-medium text-slate-700 whitespace-normal break-words w-[320px] min-w-[320px] max-w-[320px]" title={log.context}>{log.context}</td>
                          <td className="p-3 text-slate-500">{formatDateShort(log.startDate)}</td>
                          <td className="p-3 font-medium text-slate-600">{log.monthWise || '-'}</td>
                          <td className="p-3 max-w-[200px] truncate text-slate-500" title={log.remarks}>{log.remarks}</td>

                          <td className="p-3 font-mono text-teal-655" onClick={(e) => e.stopPropagation()}>
                            {log.attachment ? (
                              <div className="flex flex-col gap-[4px]">
                                {log.attachment.split(',').map(s => s.trim()).filter(Boolean).map((file, idx) => (
                                  <span
                                    key={idx}
                                    onClick={() => handleViewAttachment(file, log)}
                                    className="inline-flex items-center gap-[4px] bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-md py-[2px] px-[6px] text-[10px] font-medium text-[#0066cc] cursor-pointer max-w-[120px] truncate"
                                    title="Click to view file"
                                  >
                                    <Paperclip size={10} className="text-slate-400" />
                                    <span className="underline truncate">{file}</span>
                                  </span>
                                ))}
                              </div>
                            ) : '-'}
                          </td>

                          <td className="p-3">
                            <span className={`inline-block w-full text-center px-[4px] py-[2px] rounded-[4px] border text-[9px] font-bold ${log.status === 'Effectiveness Ok'
                              ? 'bg-emerald-50 border-emerald-250 text-emerald-700'
                              : log.status === 'Pending'
                                ? 'bg-amber-50 border-amber-200 text-amber-700'
                                : 'bg-rose-50 border-rose-250 text-rose-700'
                              }`}>
                              {log.status}
                            </span>
                          </td>

                          <td className="p-3">
                            <span className={`inline-block w-full text-center px-[4px] py-[2px] rounded-[4px] border text-[9px] font-bold ${log.qaApproval === 'Approved'
                              ? 'bg-emerald-50 border-emerald-250 text-emerald-700'
                              : log.qaApproval === 'Pending'
                                ? 'bg-amber-50 border-amber-200 text-amber-700'
                                : 'bg-rose-50 border-rose-250 text-rose-700'
                              }`}>
                              {log.qaApproval}
                            </span>
                          </td>

                          <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={() => handleViewDetails(log.changeNo)}
                              className="p-[4px] hover:bg-slate-100 rounded text-slate-400 hover:text-[#0066cc] transition-colors cursor-pointer"
                              title="View Details"
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
            <TablePagination
              rowsPerPageOptions={[5, 10]}
              component="div"
              count={displayLogs.length}
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
      {/* Details Modal (L1, L2, L3, Effectiveness Tabs) */}
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
                  const currentEffLog = selectedLog ? effectivenessLogs.find(
                    l => l.changeNo?.toLowerCase().trim() === selectedLog.changeNo?.toLowerCase().trim()
                  ) : null;
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
                                {selectedL1Details.date_close ? formatDateToDDMMYYYY(selectedL1Details.date_close) : '-'}
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
                          <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Customer Approval Required / Clearence Details</span>
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
                                    <span className="font-medium text-slate-650 truncate max-w-[200px]" title={file}>{file}</span>
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
                            <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider font-sans">QA Setup Verification Attachment</span>
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
                      const currentEffLog = effectivenessLogs.find(
                        l => l.changeNo?.toLowerCase().trim() === selectedLog.changeNo?.toLowerCase().trim()
                      );

                      if (!currentEffLog) {
                        return (
                          <div className="text-center py-[64px] bg-slate-50 rounded-xl border border-dashed border-slate-200">
                            <AlertTriangle className="mx-auto mb-[12px] text-slate-350" size={32} />
                            <span className="text-slate-455 font-medium">Effectiveness monitoring log is pending creation/validation for this request.</span>
                          </div>
                        );
                      }

                      return (
                        <div className="space-y-[20px] animate-fade-in-up">
                          <h5 className="text-[12px] font-bold text-[#0066cc] uppercase tracking-wider border-b border-slate-100 pb-1.5 flex items-center gap-1.5">
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
                                    : 'bg-rose-50 border-rose-250 text-rose-700'
                                  }`}>
                                  {currentEffLog.status}
                                </span>
                              </div>
                            </div>
                            <div className="space-y-[4px]">
                              <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider font-sans">QA Approval</span>
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
            <div className="px-[24px] py-[16px] bg-slate-50 border-t border-slate-200 flex justify-end gap-[12px] shrink-0">
              <button
                onClick={handleExportRequestDetailsPDF}
                disabled={isFetchingDetails}
                className="px-[16px] py-[8px] bg-[#0066cc] hover:bg-[#0052a3] text-white disabled:opacity-50 disabled:cursor-not-allowed rounded-[6px] text-[12px] font-semibold transition-colors shadow-sm cursor-pointer flex items-center gap-[6px]"
                title="Export this request's full details (L1, L2, L3) as PDF"
              >
                <Download size={14} />
                <span>Export PDF</span>
              </button>
              <button
                onClick={() => setSelectedLog(null)}
                className="px-[16px] py-[8px] bg-white border border-slate-250 rounded-[6px] text-slate-650 hover:bg-slate-50 hover:text-slate-800 text-[12px] font-semibold transition-colors shadow-sm cursor-pointer"
              >
                Close Details
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Attachment Preview Modal (opens in the same page) */}
      {previewFile && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setPreviewFile(null)}
        >
          <div
            className="bg-white border border-slate-200 rounded-xl shadow-lg w-full max-w-2xl overflow-hidden animate-fade-in-up flex flex-col max-h-[85vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <span className="p-1.5 bg-teal-50 text-teal-600 rounded">
                  <Paperclip size={16} />
                </span>
                <span className="font-heading font-bold text-slate-800 text-sm">{previewFile}</span>
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
                (previewFile.toLowerCase().match(/\.(jpg|jpeg|jfif|png|gif|webp|bmp|svg|tiff|tif|ico|heic|heif|avif)$/) || (fileTypes[previewFile] && fileTypes[previewFile].startsWith('image/'))) ? (
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
                          <h3 className="font-heading font-extrabold text-base text-slate-900 mt-0.5">Effectiveness Observation Log</h3>
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono text-right">
                          DOC: QA-EFF-OBS<br />
                          REV: 03 (2026)
                        </div>
                      </div>
                      <div className="border-t border-slate-100 pt-3 space-y-2.5 text-xs text-slate-600">
                        <div className="flex justify-between border-b border-slate-50 pb-1.5"><span className="font-bold">Filename:</span> <span>{previewFile}</span></div>
                        <div className="flex justify-between border-b border-slate-50 pb-1.5"><span className="font-bold">System Status:</span> <span className="text-emerald-600 font-bold">Verified Log</span></div>
                        <div className="flex justify-between border-b border-slate-50 pb-1.5"><span className="font-bold">Verification Date:</span> <span>{formatDateToDDMMYY(new Date())}</span></div>
                      </div>
                      <div className="pt-2 space-y-2">
                        <div className="font-bold text-xs text-slate-800">Observation Evidence Summary:</div>
                        <p className="text-[11px] leading-relaxed text-slate-500">
                          Post-implementation effectiveness metrics compiled for this request confirm that the changes met the desired objectives. Calibration schedules and operational checklists were successfully submitted and verified against reference gauges.
                        </p>
                      </div>
                    </div>
                    <div className="border-t border-slate-150 pt-3 flex justify-between items-center text-[10px] text-slate-400 font-mono">
                      <span>OFFICIAL ELECTRONIC ATTACHMENT</span>
                      <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded font-bold">APPROVED</span>
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
                  <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 w-full h-[50vh] font-mono text-xs text-slate-350 overflow-auto text-left shadow-inner flex flex-col">
                    <div className="text-[10px] text-slate-555 pb-2 border-b border-slate-800 flex justify-between">
                      <span>{previewFile}</span>
                      <span>UTF-8 PLAINTEXT</span>
                    </div>
                    <pre className="mt-2 flex-1 leading-relaxed">
                      {`=== Observation Log Plaintext Evidence ===\n\n[INFO] - System observations started for Change No.\n[INFO] - Verification checked at ${new Date().toLocaleTimeString()}\n[SUCCESS] - Gauge measurements calibrated correctly within specifications.\n[SUCCESS] - Gauge R&R deviation: 0.12% (threshold: <5%)\n[INFO] - Sign-off approval recorded.\n\n==========================================`}
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
    </div>
  );
};
