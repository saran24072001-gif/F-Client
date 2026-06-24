import { useState, useEffect } from 'react';
import {
  Search,
  Eye, EyeOff,
  X,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Filter,
  FileText,
  Paperclip,
  Folder,
  Calendar,
  RefreshCw,
  Building2,
  User,
  Hash,
  ShieldCheck,
  XCircle,
  MessageSquare,
  Download,
  Info,
  Layers,
  ArrowRight,
  Cpu,
  Save
} from 'lucide-react';
import TablePagination from '@mui/material/TablePagination';
import {
  getHodApprovalsByDept,
  getAllHodApprovals,
  submitHodApproval,
  getL1Details,
  getL1Attachment,
  getL2Details,
  getL2Attachment,
  getL3Details,
  getEffectivenessLogs,
  getEffectivenessAttachment
} from '../../api/apiRoutes';
import { formatDateToDDMMYYYY } from '../../utils/dateUtils';
import { exportApprovalsListPDF } from '../../utils/pdfExport';
import { useWebSocket } from '../../hooks/useWebSocket';

// Map raw DB dept string to display name
const mapDept = (raw) => {
  if (!raw) return '';
  const d = raw.trim().toLowerCase();
  if (d === 'qad') return 'QAD';
  if (d === 'ped') return 'PED';
  if (d === 'production') return 'Production';
  if (d === 'maintenance') return 'Maintenance';
  if (d === 'pc & l' || d === 'pcl') return 'PC & L';
  if (d === 'materials') return 'Materials';
  if (d === 'marketing') return 'Marketing';
  if (d === 'hr') return 'HR';
  if (d === 'safety') return 'Safety';
  if (d === 'unit head' || d === 'unit_head') return 'Unit Head';
  return raw;
};

// Check if target department is part of the required HOD approvals list
const isDeptInRequired = (note, raisedDept, dept) => {
  if (!note) {
    return mapDept(raisedDept) === mapDept(dept);
  }
  return note.split(',').map(s => mapDept(s.trim())).includes(mapDept(dept));
};

// Workflow stage label + styling based on crStatus
const workflowStageConfig = (crStatus) => {
  switch ((crStatus || '').toLowerCase()) {
    case 'pending':
      return { label: 'L1 – HOD Review', color: 'bg-amber-50 border-amber-200 text-amber-700', dot: 'bg-amber-500', level: 'L1' };
    case 'evaluating':
      return { label: 'L2 – QA Validation', color: 'bg-blue-50 border-blue-200 text-blue-700', dot: 'bg-blue-500', level: 'L2' };
    case 'approved':
      return { label: 'L3 – HOD Decisions', color: 'bg-indigo-50 border-indigo-200 text-indigo-700', dot: 'bg-indigo-500', level: 'L3' };
    case 'completed':
      return { label: 'Closed', color: 'bg-emerald-50 border-emerald-200 text-emerald-700', dot: 'bg-emerald-500', level: '✓' };
    default:
      return { label: crStatus || 'Unknown', color: 'bg-slate-50 border-slate-200 text-slate-600', dot: 'bg-slate-400', level: '?' };
  }
};

const StatusBadge = ({ status, prefix = '' }) => {
  const displayPrefix = prefix ? `${prefix} ` : '';
  if (!status || status === 'Pending') return (
    <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full border bg-amber-50 border-amber-200 text-amber-700">
      <Clock size={11} /> {displayPrefix}Pending
    </span>
  );
  if (status === 'Approved' || status === 'Accepted') return (
    <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full border bg-emerald-50 border-emerald-200 text-emerald-700">
      <CheckCircle2 size={11} /> {displayPrefix}Approved
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full border bg-rose-50 border-rose-200 text-rose-700">
      <XCircle size={11} /> {displayPrefix}Rejected
    </span>
  );
};

// Workflow steps strip shown in modal header
const WorkflowStrip = ({ crStatus, qaApproval }) => {
  const steps = [
    { key: 'L1', label: 'L1 HOD Review' },
    { key: 'L2', label: 'L2 QA Validation' },
    { key: 'L3', label: 'L3 HOD Decisions' },
    { key: 'Eff', label: 'Effectiveness' },
    { key: 'Done', label: 'Closed' },
  ];
  const statusLower = (crStatus || '').toLowerCase();
  const qaAppLower = (qaApproval || '').toLowerCase();

  let activeIdx = 0;
  if (statusLower === 'pending') {
    activeIdx = 0;
  } else if (statusLower === 'evaluating') {
    activeIdx = 1;
  } else if (statusLower === 'approved') {
    activeIdx = 2;
  } else if (statusLower === 'completed') {
    if (qaAppLower === 'approved') {
      activeIdx = 5;
    } else {
      activeIdx = 3;
    }
  }

  return (
    <div className="flex items-center gap-0 px-[4px] mt-[8px] overflow-x-auto justify-center">
      {steps.map((s, i) => (
        <div key={s.key} className="flex items-center">
          <div className="flex flex-col items-center relative">
            <div className={`w-[20px] h-[20px] sm:w-[24px] sm:h-[24px] rounded-full flex items-center justify-center text-[8px] sm:text-[10px] font-black border-2 transition-all ${i < activeIdx ? 'bg-emerald-500 border-emerald-500 text-white' :
              i === activeIdx ? 'bg-white border-white text-[#0066cc] shadow' :
                'bg-white/20 border-white/30 text-white/50'
              }`}>
              {i < activeIdx ? '✓' : (s.key === 'Done' ? '✓' : s.key)}
            </div>
            <span className={`text-[8px] sm:text-[9px] font-bold mt-[2px] whitespace-nowrap ${i === activeIdx ? 'text-white' : i < activeIdx ? 'text-emerald-200' : 'text-white/40'}`}>
              {s.label}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div className={`w-[12px] sm:w-[32px] h-[2px] mx-[2px] sm:mx-[4px] mb-[16px] transition-all ${i < activeIdx ? 'bg-emerald-400' : 'bg-white/20'}`} />
          )}
        </div>
      ))}
    </div>
  );
};

export const AllApprovals = ({
  userEmail,
  userRole,
  userDept,
  setToastMsg,
  logAction,
  fetchChanges,
  autoOpenChangeNo,
  clearAutoOpen
}) => {
  const [requests, setRequests] = useState([]);
  const [isFetching, setIsFetching] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actingDept, setActingDept] = useState(() => mapDept(userDept) || '');

  // Modal
  const [selectedReq, setSelectedReq] = useState(null);
  const [l1Details, setL1Details] = useState(null);
  const [selectedL2Details, setSelectedL2Details] = useState(null);
  const [selectedEffDetails, setSelectedEffDetails] = useState(null);
  const [selectedLog, setSelectedLog] = useState(null);
  const [activeTab, setActiveTab] = useState('l1');
  const [isFetchingDetails, setIsFetchingDetails] = useState(false);
  const [remarks, setRemarks] = useState('');
  const [fileUrls, setFileUrls] = useState({});
  const [fileTypes, setFileTypes] = useState({});
  const [previewFile, setPreviewFile] = useState(null);
  const [showCustomerApproval, setShowCustomerApproval] = useState(false);

  useEffect(() => {
    if (!selectedReq) {
      setShowCustomerApproval(false);
    }
  }, [selectedReq]);

  // Filter & Search
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [stageFilter, setStageFilter] = useState('All');
  const [scopeFilter, setScopeFilter] = useState('MyDept');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [showLegend, setShowLegend] = useState(false);

  const isAdmin = userRole && (
    userRole.toLowerCase() === 'admin' ||
    userRole.toLowerCase() === 'administrator'
  );
  const isHOD = userRole && (
    userRole.toLowerCase().includes('hod') ||
    userRole.toLowerCase().includes('manager') ||
    userRole.toLowerCase().includes('unit head')
  );
  const isQA = userDept && (
    userDept.toLowerCase() === 'qad'
  );


  useEffect(() => {
    if (isAdmin) {
      setScopeFilter('All');
    } else {
      setScopeFilter('MyDept');
    }
  }, [isAdmin]);

  useEffect(() => { setPage(0); }, [search, statusFilter, stageFilter, scopeFilter]);

  // Resolve acting department from DB user record
  useEffect(() => {
    if (userDept) {
      setActingDept(mapDept(userDept));
    }
  }, [userDept]);

  const fetchRequests = async (silent = false) => {
    if (!silent) setIsFetching(true);
    try {
      let res;
      if (isAdmin) {
        res = await getAllHodApprovals();
      } else {
        const dept = actingDept || mapDept(userDept) || 'General';
        res = await getHodApprovalsByDept(dept);
      }

      setRequests(res.data || []);
    } catch (err) {
      console.error(err);
      if (setToastMsg) setToastMsg({ text: 'Error loading HOD approval requests.', isError: true });
    } finally {
      if (!silent) setIsFetching(false);
    }
  };

  useEffect(() => {
    if (actingDept || isAdmin) fetchRequests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actingDept, isAdmin]);

  useWebSocket((data) => {
    if (data.type === 'REFRESH_CHANGES') {
      fetchRequests(true);
      if (selectedReq) {
        handleOpenModal(selectedReq, true);
      }
    }
  });

  const handleOpenModal = async (req, silent = false) => {
    if (!silent) {
      setSelectedReq(req);
      setRemarks(req.hodRemarks || '');
      setL1Details(null);
      setSelectedL2Details(null);
      setSelectedEffDetails(null);
      setSelectedLog({
        changeNo: req.changeNo,
        requester: req.requestBy || req.requesterEmail,
        date: req.date,
        status: req.crStatus,
        hodStatus: req.hodStatus,
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
      setIsFetchingDetails(true);
      setActiveTab('l1');
    }
    try {
      const [l1Res, l2Res, l3Res, effRes] = await Promise.all([
        getL1Details(req.changeNo),
        getL2Details(req.changeNo).catch(() => ({ data: null })),
        getL3Details(req.changeNo).catch(() => ({ data: null })),
        getEffectivenessLogs().catch(() => ({ data: [] }))
      ]);
      setL1Details(l1Res.data);
      setSelectedL2Details(l2Res.data);
      const matchedEff = effRes.data?.find(
        l => l.changeNo?.toLowerCase().trim() === req.changeNo?.toLowerCase().trim()
      );
      setSelectedEffDetails(matchedEff || null);

      const matchedL3 = l3Res.data;
      const newLogData = (matchedL3 && matchedL3.changeNo) ? { ...matchedL3, hodStatus: req.hodStatus } : {
        changeNo: req.changeNo,
        requester: req.requestBy || req.requesterEmail,
        date: req.date,
        hodStatus: req.hodStatus,
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
      console.error('Error fetching L1/L2/L3/Eff details:', err);
    } finally {
      if (!silent) setIsFetchingDetails(false);
    }
  };

  // Keep selectedReq in sync when requests updates in the background
  useEffect(() => {
    if (selectedReq) {
      const updatedReq = requests.find(r => r.changeNo === selectedReq.changeNo);
      if (updatedReq) {
        setSelectedReq(updatedReq);
      }
    }
  }, [requests, selectedReq]);

  // Auto-open from notification click
  useEffect(() => {
    if (autoOpenChangeNo && requests.length > 0) {
      const req = requests.find(r => r.changeNo === autoOpenChangeNo);
      if (req) {
        handleOpenModal(req);
        if (clearAutoOpen) clearAutoOpen();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoOpenChangeNo, requests]);

  const handleCloseModal = () => {
    setSelectedReq(null);
    setL1Details(null);
    setSelectedL2Details(null);
    setSelectedEffDetails(null);
    setSelectedLog(null);
    setRemarks('');
    setPreviewFile(null);
  };

  const handleViewAttachment = async (filename, changeNo, type = 'L1') => {
    if (!filename || filename === '-') return;
    setPreviewFile(filename);
    if (!fileUrls[filename]) {
      try {
        let res;
        if (type === 'L2') {
          res = await getL2Attachment(changeNo, filename);
        } else if (type === 'Effectiveness') {
          res = await getEffectivenessAttachment(changeNo, filename);
        } else {
          res = await getL1Attachment(changeNo, filename);
        }
        const url = URL.createObjectURL(res.data);
        const mimeType = res.data.type;
        setFileTypes(prev => ({ ...prev, [filename]: mimeType }));
        setFileUrls(prev => ({ ...prev, [filename]: url }));
      } catch (err) {
        console.error(`Error loading ${type} attachment:`, err);
      }
    }
  };

  const renderL1FilePill = (filename, changeNo) => {
    if (!filename) return null;
    const files = filename.split(',').map(s => s.trim()).filter(Boolean);
    return (
      <div className="mt-1 flex flex-wrap gap-2">
        {files.map((file, idx) => (
          <span
            key={idx}
            className="inline-flex items-center gap-[6px] bg-slate-50 hover:bg-slate-105 border border-slate-200 rounded-md py-1 px-2.5 text-[11px] font-medium text-[#0066cc] cursor-pointer max-w-full"
            onClick={() => handleViewAttachment(file, changeNo)}
          >
            <Paperclip size={11} className="text-slate-400" />
            <span className="underline truncate max-w-[200px]">{file}</span>
          </span>
        ))}
      </div>
    );
  };

  const handleDecision = async (status) => {
    if (!selectedReq) return;
    setIsSubmitting(true);
    try {
      await submitHodApproval(selectedReq.changeNo, actingDept, status, remarks);
      if (setToastMsg) {
        if (status === 'Approved') {
          setToastMsg({
            text: ` ${actingDept} HOD approval saved as "${status}" for ${selectedReq.changeNo}`,
            isError: false
          });
        } else {
          setToastMsg({
            text: ` ${actingDept} HOD approval saved as "${status}" for ${selectedReq.changeNo}`,
            isError: true
          });
        }
      }
      if (logAction) logAction('HOD Approval', `${status} for ${selectedReq.changeNo} by ${actingDept} HOD`);
      await fetchRequests();
      if (fetchChanges) await fetchChanges();
      handleCloseModal();
    } catch (err) {
      console.error(err);
      const msg = err.response?.data?.error || 'Failed to save HOD approval.';
      if (setToastMsg) setToastMsg({ text: msg, isError: true });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getRequestEffectiveStatus = (r) => {
    if (r.crStatus?.toLowerCase() === 'approved') {
      if (isAdmin) {
        const statuses = [
          r.l3_ped, r.l3_qad, r.l3_production, r.l3_maintenance, r.l3_pcl,
          r.l3_materials, r.l3_marketing, r.l3_hr, r.l3_safety, r.l3_unitHead
        ].map(s => (s || 'Pending'));
        if (statuses.includes('Rejected')) return 'Rejected';
        if (statuses.every(s => s === 'Approved' || s === 'Accepted')) return 'Approved';
        return 'Pending';
      } else {
        const deptKey = actingDept === 'PED' ? 'l3_ped' :
          actingDept === 'QAD' ? 'l3_qad' :
            actingDept === 'Production' ? 'l3_production' :
              actingDept === 'Maintenance' ? 'l3_maintenance' :
                actingDept === 'PC & L' ? 'l3_pcl' :
                  actingDept === 'Materials' ? 'l3_materials' :
                    actingDept === 'Marketing' ? 'l3_marketing' :
                      actingDept === 'HR' ? 'l3_hr' :
                        actingDept === 'Safety' ? 'l3_safety' :
                          actingDept === 'Unit Head' ? 'l3_unitHead' : '';
        let L3Status = deptKey ? (r[deptKey] || 'Pending') : 'Pending';
        if (L3Status === 'Accepted') L3Status = 'Approved';
        return L3Status;
      }
    }
    return r.rejectCount > 0 ? 'Rejected' : (r.hodStatus || 'Pending');
  };

  const getDecisionStatusAndPrefix = (r) => {
    const statusLower = (r.crStatus || '').toLowerCase();
    if (statusLower === 'approved') {
      return { status: getRequestEffectiveStatus(r), prefix: 'L3' };
    }
    if (r.rejectCount > 0) {
      return { status: 'Rejected', prefix: '' };
    }
    if (statusLower === 'evaluating') {
      return { status: 'Approved', prefix: 'L1' };
    }
    if (statusLower === 'completed') {
      return { status: 'Approved', prefix: 'L3' };
    }
    return { status: r.hodStatus || 'Pending', prefix: 'L1' };
  };

  // Filter
  const filtered = requests.filter(r => {
    const q = search.toLowerCase();
    const matchSearch = !q ||
      r.changeNo.toLowerCase().includes(q) ||
      (r.requestBy || '').toLowerCase().includes(q) ||
      (r.dept || '').toLowerCase().includes(q);
    const l1Status = r.hodStatus || 'Pending';
    const matchStatus = statusFilter === 'All' || l1Status === statusFilter;
    const stageInfo = workflowStageConfig(r.crStatus);
    const matchStage = stageFilter === 'All' || stageInfo.level === stageFilter;
    const isL3Stage = r.crStatus?.toLowerCase() === 'approved';
    const matchScope = scopeFilter === 'All' || mapDept(r.dept) === actingDept || isDeptInRequired(r.hodApprovalNote, r.dept, actingDept);
    return matchSearch && matchStatus && matchStage && matchScope;
  });
  const paginated = filtered.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  const handleExportPDF = () => {
    exportApprovalsListPDF(filtered, {
      searchQuery: search,
      statusFilter,
      actingDept
    }, setToastMsg);
  };

  // Stats
  const pendingCount = requests.filter(r => {
    const stageInfo = workflowStageConfig(r.crStatus);
    if (stageFilter !== 'All' && stageInfo.level !== stageFilter) return false;
    const isL3Stage = r.crStatus?.toLowerCase() === 'approved';
    const isMyDept = isAdmin || ((isHOD || isQA) && (mapDept(r.dept) === actingDept || isDeptInRequired(r.hodApprovalNote, r.dept, actingDept)));
    if (scopeFilter !== 'All' && !isMyDept) return false;
    return (r.hodStatus || 'Pending') === 'Pending';
  }).length;

  const approvedCount = requests.filter(r => {
    const stageInfo = workflowStageConfig(r.crStatus);
    if (stageFilter !== 'All' && stageInfo.level !== stageFilter) return false;
    const isL3Stage = r.crStatus?.toLowerCase() === 'approved';
    const isMyDept = isAdmin || ((isHOD || isQA) && (mapDept(r.dept) === actingDept || isDeptInRequired(r.hodApprovalNote, r.dept, actingDept)));
    if (scopeFilter !== 'All' && !isMyDept) return false;
    return r.hodStatus === 'Approved';
  }).length;

  const rejectedCount = requests.filter(r => {
    const stageInfo = workflowStageConfig(r.crStatus);
    if (stageFilter !== 'All' && stageInfo.level !== stageFilter) return false;
    const isL3Stage = r.crStatus?.toLowerCase() === 'approved';
    const isMyDept = isAdmin || ((isHOD || isQA) && (mapDept(r.dept) === actingDept || isDeptInRequired(r.hodApprovalNote, r.dept, actingDept)));
    if (scopeFilter !== 'All' && !isMyDept) return false;
    return r.hodStatus === 'Rejected';
  }).length;

  const alreadyDecided = selectedReq &&
    selectedReq.hodStatus &&
    selectedReq.hodStatus !== 'Pending';

  const isChangeClosed = !!(selectedReq && selectedReq.qaApproval === 'Approved');

  const selectedStage = selectedReq ? workflowStageConfig(selectedReq.crStatus) : null;

  return (
    <div className="space-y-6 animate-fade-in-up pb-10">

      {/* ─── Header ─── */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-[16px]">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#0066cc] to-indigo-600 flex items-center justify-center shadow-md shadow-blue-200">
              <ShieldCheck size={16} className="text-white" />
            </div>
            <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">All L1 Approvals</h2>
          </div>
          <p className="text-sm text-slate-500 ml-10">
            Review L1 HOD approval decisions for change requests —{' '}
            <span className="font-semibold text-[#0066cc]">{actingDept || '...'}</span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-[12px] w-full md:w-auto">

          <button
            onClick={fetchRequests}
            disabled={isFetching}
            className="flex-grow md:flex-grow-0 flex items-center justify-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm cursor-pointer disabled:opacity-60"
          >
            <RefreshCw size={14} className={isFetching ? 'animate-spin text-[#0066cc]' : ''} />
            Refresh
          </button>
          <button
            onClick={handleExportPDF}
            className="flex-grow md:flex-grow-0 flex items-center justify-center gap-2 px-4 py-2 bg-[#0066cc] hover:bg-[#0052a3] text-white rounded-xl text-sm font-semibold transition-all shadow-sm cursor-pointer"
            title="Export filtered approvals to PDF"
          >
            <Download size={14} />
            Export PDF
          </button>
        </div>
      </div>



      {/* ─── Summary Cards ─── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-[16px]">
        {[
          { label: 'Awaiting  Decision', value: pendingCount, icon: <Clock size={18} />, gradient: 'from-amber-500 to-orange-500', border: 'border-amber-100', text: 'text-amber-700', sublabel: 'L1 HOD Review Pending' },
          { label: 'Approved ', value: approvedCount, icon: <CheckCircle2 size={18} />, gradient: 'from-emerald-500 to-teal-500', border: 'border-emerald-100', text: 'text-emerald-700', sublabel: 'L1 HOD Approved' },
          { label: 'Rejected ', value: rejectedCount, icon: <XCircle size={18} />, gradient: 'from-rose-500 to-pink-500', border: 'border-rose-100', text: 'text-rose-700', sublabel: 'L1 HOD Rejected' },
        ].map((card, i) => (
          <div key={i} className={`relative bg-white border ${card.border} rounded-2xl p-4 shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden group`}>
            <div className={`absolute top-0 right-0 w-20 h-20 rounded-full bg-gradient-to-br ${card.gradient} opacity-[0.07] -translate-y-4 translate-x-4 group-hover:opacity-[0.13] transition-opacity`} />
            <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${card.gradient} flex items-center justify-center text-white shadow-sm mb-3`}>
              {card.icon}
            </div>
            <div className={`text-3xl font-black ${card.text}`}>{card.value}</div>
            <div className="text-xs font-semibold text-slate-700 mt-0.5">{card.label}</div>
            <div className="text-[10px] text-slate-400 font-medium mt-0.5">{card.sublabel}</div>
          </div>
        ))}
      </div>

      {/* ─── Filters ─── */}
      <div className="bg-white border border-slate-200/70 rounded-2xl p-[16px] shadow-sm space-y-3">
        <div className="flex flex-col lg:flex-row gap-[12px] lg:items-center">
          <div className="relative flex-1 w-full lg:w-auto lg:min-w-[200px]">
            <Search className="absolute left-3 top-2.5 text-slate-400" size={15} />
            <input
              type="text"
              placeholder="Search by Change No., Requester, Department..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-xs outline-none focus:border-[#0066cc] focus:ring-4 focus:ring-[#0066cc]/10 transition-all"
            />
          </div>
          <div className="flex flex-wrap items-center gap-[8px]">
            <Filter size={14} className="text-slate-400 shrink-0" />
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">HOD Decision:</span>
            <div className="flex items-center gap-1.5 flex-wrap">
              {['All', 'Pending', 'Approved', 'Rejected'].map(f => (
                <button
                  key={f}
                  onClick={() => setStatusFilter(f)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer ${statusFilter === f
                    ? 'bg-[#0066cc] text-white border-[#0066cc] shadow-md shadow-blue-200'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Scope/Source filter row */}
        {!isAdmin && (
          <div className="flex flex-wrap items-center gap-[8px] pt-2.5 border-t border-slate-100">
            <Building2 size={14} className="text-slate-400 shrink-0" />
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">Request Source:</span>
            <div className="flex items-center gap-1.5 flex-wrap">
              {[
                { key: 'MyDept', label: `My Department (${actingDept || '...'})` },
                { key: 'All', label: 'All Departments' },
              ].map(sc => (
                <button
                  key={sc.key}
                  onClick={() => setScopeFilter(sc.key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer ${scopeFilter === sc.key
                    ? 'bg-[#0066cc] text-white border-[#0066cc] shadow-md shadow-blue-100'
                    : 'bg-white text-slate-650 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                >
                  {sc.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ─── Table ─── */}
      <div className="bg-white border border-slate-200/70 rounded-2xl shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden">
        {isFetching ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3 text-slate-400">
            <Loader2 className="animate-spin text-[#0066cc]" size={28} />
            <span className="text-sm font-semibold">Loading approval requests...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3 text-slate-400">
            <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center">
              <ShieldCheck size={28} className="text-slate-300" />
            </div>
            <p className="text-sm font-semibold">No approval requests found</p>
            <p className="text-xs text-slate-400">Try adjusting your search or filter</p>
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[700px]">
                  <thead>
                    <tr className="bg-gradient-to-r from-slate-50 to-slate-100/50 border-b border-slate-200 text-[10px] uppercase tracking-wider">
                      <th className="px-5 py-3.5 font-black text-slate-500 w-[80px]">Sl No</th>
                      <th className="px-5 py-3.5 font-black text-slate-500"><div className="flex items-center gap-1.5"><Hash size={11} />Change No.</div></th>

                      <th className="px-5 py-3.5 font-black text-slate-500"><div className="flex items-center gap-1.5"><Calendar size={11} />Date</div></th>
                      <th className="px-5 py-3.5 font-black text-slate-500"><div className="flex items-center gap-1.5"><User size={11} />Requested By</div></th>
                      <th className="px-5 py-3.5 font-black text-slate-500"><div className="flex items-center gap-1.5"><Building2 size={11} />Dept</div></th>
                      <th className="px-5 py-3.5 font-black text-slate-500">L1 HOD Decision</th>
                      <th className="px-5 py-3.5 font-black text-slate-500 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {paginated.map((req, idx) => {
                      const isL1Pending = req.crStatus === 'Pending';
                      const isPendingDecision = !req.hodStatus || req.hodStatus === 'Pending';
                      const isMyDept = isAdmin || ((isHOD || isQA) && isDeptInRequired(req.hodApprovalNote, req.dept, actingDept));
                      const isRejected = req.rejectCount > 0;
                      const isActionable = isL1Pending && isPendingDecision && isMyDept && !isRejected;
                      const stage = workflowStageConfig(req.crStatus);
                      return (
                        <tr key={idx} className="hover:bg-blue-50/30 transition-colors group">
                          <td className="px-5 py-3.5 font-bold text-slate-400">
                            {page * rowsPerPage + idx + 1}
                          </td>
                          <td className="px-5 py-3.5">
                            <span className="font-mono font-bold text-[#0066cc] text-[12px] bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100">
                              {req.changeNo}
                            </span>
                          </td>

                          <td className="px-5 py-3.5 text-[12px] text-slate-500 font-medium">{req.date || '-'}</td>
                          <td className="px-5 py-3.5">
                            <div className="text-[12px] font-semibold text-slate-800 truncate max-w-[160px]">{req.requestBy || req.requesterEmail}</div>
                            <div className="text-[10px] text-slate-400 font-mono">{req.requesterEmail}</div>
                          </td>
                          <td className="px-5 py-3.5">
                            <span className="text-[11px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">{req.dept || '-'}</span>
                          </td>
                          <td className="px-5 py-3.5">
                            <StatusBadge status={req.hodStatus || 'Pending'} />
                          </td>
                          <td className="px-5 py-3.5 text-center">
                            <button
                              onClick={() => handleOpenModal(req)}
                              className={`inline-flex items-center gap-1.5 px-3 py-1.5 border rounded-lg text-[11px] font-bold transition-all shadow-sm cursor-pointer group-hover:shadow ${isActionable
                                ? 'bg-amber-50 border-amber-300 text-amber-700 hover:bg-amber-100'
                                : 'bg-white border-slate-200 text-slate-600 hover:border-[#0066cc] hover:text-[#0066cc] hover:bg-blue-50'
                                }`}
                            >
                              <Eye size={12} />
                              {isActionable ? 'Review & Decide' : 'View'}
                              {isActionable && (
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                              )}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mobile Cards View */}
            <div className="flex md:hidden flex-col gap-[12px] p-[12px] bg-slate-50">
              {paginated.map((req, idx) => {
                const isL1Pending = req.crStatus === 'Pending';
                const isPendingDecision = !req.hodStatus || req.hodStatus === 'Pending';
                const isMyDept = isAdmin || ((isHOD || isQA) && isDeptInRequired(req.hodApprovalNote, req.dept, actingDept));
                const isRejected = req.rejectCount > 0;
                const isActionable = isL1Pending && isPendingDecision && isMyDept && !isRejected;
                const stage = workflowStageConfig(req.crStatus);
                return (
                  <div key={idx} className="bg-white border border-slate-200 rounded-[12px] p-[16px] shadow-sm hover:shadow-md transition-all duration-300 flex flex-col gap-[12px]">
                    <div className="flex justify-between items-center border-b border-slate-100 pb-[8px]">
                      <span className="font-mono font-bold text-[#0066cc] text-[12px] bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100">
                        {req.changeNo}
                      </span>
                      <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full border ${stage.color}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${stage.dot} ${isActionable ? 'animate-pulse' : ''}`} />
                        {stage.label}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-[8px] gap-x-[12px]">
                      <div className="flex flex-col gap-[2px]">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Requested Date</span>
                        <span className="text-[12px] font-semibold text-slate-700 break-words">{req.date || '-'}</span>
                      </div>
                      <div className="flex flex-col gap-[2px]">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Department</span>
                        <span className="text-[12px] font-semibold text-slate-700 break-words">{req.dept || '-'}</span>
                      </div>
                      <div className="flex flex-col gap-[2px] col-span-2">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Requested By</span>
                        <div className="text-[12px] font-semibold text-slate-800 break-words">{req.requestBy || req.requesterEmail}</div>
                        <span className="text-[10px] text-slate-400 font-mono">{req.requesterEmail}</span>
                      </div>
                    </div>

                    <div className="flex justify-between items-center border-t border-slate-100 pt-[12px] mt-[4px]">
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Decision</span>
                        <StatusBadge status={req.hodStatus || 'Pending'} />
                      </div>

                      <button
                        onClick={() => handleOpenModal(req)}
                        className={`inline-flex items-center gap-1.5 px-4 py-2 border rounded-lg text-[11px] font-bold transition-all shadow-sm cursor-pointer ${isActionable
                          ? 'bg-amber-50 border-amber-300 text-amber-700 hover:bg-amber-100 shadow'
                          : 'bg-white border-slate-200 text-slate-600 hover:border-[#0066cc] hover:text-[#0066cc] hover:bg-blue-50'
                          }`}
                      >
                        <Eye size={12} />
                        {isActionable ? 'Review & Decide' : 'View'}
                        {isActionable && (
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="border-t border-slate-100">
              <TablePagination
                rowsPerPageOptions={[5, 10]}
                component="div"
                count={filtered.length}
                rowsPerPage={rowsPerPage}
                page={page}
                onPageChange={(_, p) => setPage(p)}
                onRowsPerPageChange={e => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
              />
            </div>
          </>
        )}
      </div>

      {/* ─── Details Modal ─── */}
      {selectedReq && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-[16px]">
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={handleCloseModal} />

          <div className="relative bg-white w-full sm:w-[720px] max-w-full h-full sm:h-auto sm:max-h-[92vh] sm:rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col z-10 animate-fade-in-up">

            {/* Modal Header */}
            <div className="bg-gradient-to-r from-[#0066cc] to-indigo-600 px-6 py-5 shrink-0">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                    <FileText size={18} className="text-white" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-[15px] font-extrabold text-white">L1 Change Request Review</h4>
                      {selectedStage && (
                        <span className={`inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full ${selectedStage.color} border`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${selectedStage.dot}`} />
                          {selectedStage.label}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-blue-100 mt-0.5">
                      <span className="font-mono font-bold text-white">{selectedReq.changeNo}</span>
                      <span className="mx-2 text-blue-300">·</span>
                      Raised by: <span className="font-semibold text-white">{selectedReq.requestBy || selectedReq.requesterEmail}</span>
                    </p>
                  </div>
                </div>
                <button onClick={handleCloseModal} className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer shrink-0">
                  <X size={16} />
                </button>
              </div>

            </div>

            {/* Approval type info bar */}
            {isChangeClosed ? (
              <div className="bg-emerald-50 border-b border-emerald-200 px-6 py-2.5 flex items-center gap-2 shrink-0">
                <CheckCircle2 size={13} className="text-emerald-600 shrink-0" />
                <p className="text-[11px] text-emerald-800 font-semibold">
                  <strong>Approvals Closed:</strong> This change request has been Approved and Closed at the Effectiveness Monitoring stage. No further approvals or remarks can be submitted.
                </p>
              </div>
            ) : (
              <div className="bg-amber-50 border-b border-amber-200 px-6 py-2.5 flex items-center gap-2 shrink-0">
                <ShieldCheck size={13} className="text-amber-600 shrink-0" />
                <p className="text-[11px] text-amber-800 font-semibold">
                  <strong>L1 HOD Approval</strong> — You are reviewing this change request as <span className="text-[#0066cc] font-black">{actingDept}</span> HOD.
                  {alreadyDecided
                    ? <span className="ml-1 text-slate-500 font-normal">A decision has already been recorded.</span>
                    : ''
                  }
                </p>
              </div>
            )}



            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5 text-[13px] text-slate-700">
              {isFetchingDetails ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-400">
                  <Loader2 className="animate-spin text-[#0066cc]" size={24} />
                  <span className="text-sm font-semibold">Loading request details...</span>
                </div>
              ) : (
                <>
                  {activeTab === 'l1' && (
                    l1Details ? (
                      <div className="space-y-5">
                        {/* General Info */}
                        <div className="space-y-[12px]">
                          <h5 className="text-[12px] font-bold text-[#0066cc] uppercase tracking-wider border-b border-slate-100 pb-1.5 flex items-center gap-1.5">
                            <Folder size={14} />
                            <span>General Information</span>
                          </h5>
                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-[16px]">
                            <div className="space-y-[4px]">
                              <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Change No</span>
                              <span className="font-mono font-bold text-slate-800">{l1Details.change_no}</span>
                            </div>
                            <div className="space-y-[4px]">
                              <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Requested Date</span>
                              <span className="font-medium text-slate-700">{l1Details.crDate ? formatDateToDDMMYYYY(l1Details.crDate) : '-'}</span>
                            </div>
                            <div className="space-y-[4px]">
                              <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Requested Time</span>
                              <span className="font-medium text-slate-700">{l1Details.requested_time}</span>
                            </div>
                            <div className="space-y-[4px]">
                              <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Status</span>
                              <div className="flex gap-1.5 items-center mt-0.5">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${l1Details.hodStatus === 'Rejected'
                                  ? 'bg-rose-50 border-rose-220 text-rose-700'
                                  : (l1Details.hodStatus === 'Approved' || l1Details.crStatus !== 'Pending')
                                    ? 'bg-emerald-50 border-emerald-220 text-emerald-700'
                                    : 'bg-amber-50 border-amber-220 text-amber-700'
                                  }`}>
                                  L1 {l1Details.hodStatus === 'Rejected' ? 'Rejected' : ((l1Details.hodStatus === 'Approved' || l1Details.crStatus !== 'Pending') ? 'Approved' : 'Pending')}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 md:grid-cols-4 gap-[16px] mt-[12px]">
                            <div className="space-y-[4px]">
                              <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Unit</span>
                              <span className="font-medium text-slate-700">{l1Details.unit}</span>
                            </div>
                            <div className="space-y-[4px]">
                              <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Change In</span>
                              <span className="font-medium text-slate-750">{l1Details.change_in}</span>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 md:grid-cols-4 gap-[16px] mt-[12px]">
                            <div className="space-y-[4px] min-w-0">
                              <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Requested By</span>
                              <span className="font-semibold text-slate-800 block break-words">{l1Details.request_by}</span>
                              {l1Details.crRequester && l1Details.crRequester.toLowerCase() !== l1Details.request_by?.toLowerCase() && (
                                <span className="block text-[11px] text-slate-400 mt-0.5 font-mono break-all">{l1Details.crRequester}</span>
                              )}
                            </div>
                            <div className="space-y-[4px]">
                              <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Department</span>
                              <span className="font-medium text-slate-700">{l1Details.dept}</span>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-[16px] mt-[12px]">
                            <div className="space-y-[4px] min-w-0">
                              <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Process Name</span>
                              <span className="font-medium text-slate-700 block break-words break-all">{l1Details.process_name}</span>
                            </div>
                            <div className="space-y-[4px] min-w-0">
                              <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Process Line</span>
                              <span className="font-medium text-slate-700 block break-words break-all">{l1Details.process_line}</span>
                            </div>
                            <div className="space-y-[4px] col-span-2 md:col-span-1 min-w-0">
                              <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Machine No</span>
                              <span className="font-mono text-slate-700 block break-words break-all">{l1Details.machine_no}</span>
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
                                {l1Details.title ? l1Details.title.replace(/^\[L1 Request - [^\]]*\]\s*/, '') : ''}
                              </div>
                            </div>
                            <div className="space-y-[6px] min-w-0">
                              <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider font-sans">Detailed Change Description</span>
                              <div className="bg-slate-50 border border-slate-200 rounded-[8px] p-3 text-slate-700 min-h-[60px] leading-relaxed break-words whitespace-pre-wrap">
                                {l1Details.description}
                              </div>
                            </div>
                          </div>
                          {l1Details.file_desc && (
                            <div className="space-y-[4px] mt-2">
                              <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Supporting Files</span>
                              {renderL1FilePill(l1Details.file_desc, l1Details.change_no)}
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
                                <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider font-sans">Change Improvement Area</span>
                                <span className="font-semibold text-slate-800 text-xs block mt-0.5">{l1Details.improvement_area || '-'}</span>
                              </div>

                              <div className="space-y-[4px]">
                                <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider font-sans">Supporting Files (Improvement)</span>
                                {l1Details.file_improvement ? renderL1FilePill(l1Details.file_improvement, l1Details.change_no) : <span className="text-slate-500 font-medium text-xs">-</span>}
                              </div>

                              <div className="space-y-[4px]">
                                <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider font-sans">Permanent / Temporary Change</span>
                                <span className="font-semibold text-slate-800 text-xs block mt-0.5">{l1Details.change_type || '-'}</span>
                              </div>

                              <div className="space-y-[4px]">
                                <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider font-sans">Implement / Change Date Start</span>
                                <span className="font-semibold text-slate-750 flex items-center gap-1.5 mt-0.5 text-xs">
                                  <Calendar size={13} className="text-slate-400" />
                                  {l1Details.date_start ? formatDateToDDMMYYYY(l1Details.date_start) : '-'}
                                </span>
                              </div>

                              <div className="space-y-[4px]">
                                <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider font-sans">Part Traceability Details (From Changes)</span>
                                <div className="bg-slate-50 border border-slate-200 rounded-[8px] p-3 text-slate-700 min-h-[60px] leading-relaxed break-words text-xs whitespace-pre-wrap">
                                  {l1Details.trace_from || '-'}
                                </div>
                                {l1Details.file_trace_from && (
                                  <div className="mt-2 space-y-[4px]">
                                    <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider font-sans">Supporting Files (Traceability From)</span>
                                    {renderL1FilePill(l1Details.file_trace_from, l1Details.change_no)}
                                  </div>
                                )}
                              </div>
                            </div>

                            <div className="space-y-[12px]">
                              <div className="space-y-[4px]">
                                <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider font-sans">Change Date Close</span>
                                <span className="font-semibold text-slate-750 flex items-center gap-1.5 mt-0.5 text-xs">
                                  <Calendar size={13} className="text-slate-400" />
                                  {l1Details.date_close ? formatDateToDDMMYYYY(l1Details.date_close) : '-'}
                                </span>
                              </div>

                              <div className="space-y-[4px]">
                                <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider font-sans">Part Traceability Details (To Changes)</span>
                                <div className="bg-slate-50 border border-slate-200 rounded-[8px] p-3 text-slate-700 min-h-[60px] leading-relaxed break-words text-xs whitespace-pre-wrap">
                                  {l1Details.trace_to || '-'}
                                </div>
                                {l1Details.file_trace_to && (
                                  <div className="mt-2 space-y-[4px]">
                                    <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider font-sans">Supporting Files (Traceability To)</span>
                                    {renderL1FilePill(l1Details.file_trace_to, l1Details.change_no)}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* TABLE VIEW FOR IMPROVEMENT DATA */}
                          {(() => {
                            if (!l1Details.improvement_table_data) return null;
                            let tableData;
                            try {
                              tableData = JSON.parse(l1Details.improvement_table_data);
                            } catch (e) {
                              return null;
                            }
                            if (!Array.isArray(tableData) || tableData.length === 0) return null;

                            const area = (l1Details.improvement_area || '').toLowerCase();
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
                              {l1Details.risk_analysis || '-'}
                            </div>
                          </div>

                          <div className="space-y-[4px] min-w-0">
                            <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider font-sans">Supporting Files (Risk Analysis)</span>
                            {l1Details.file_risk && l1Details.file_risk !== '-' ? (
                              renderL1FilePill(l1Details.file_risk, l1Details.change_no)
                            ) : (
                              <span className="text-[12px] text-slate-400 italic">No file attached</span>
                            )}
                          </div>

                          <div className="space-y-[4px] min-w-0">
                            <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider font-sans">Update in SOP / WI / Control Plan / FMEA</span>
                            <div className="bg-slate-50 border border-slate-200 rounded-[8px] p-3 text-slate-700 min-h-[60px] leading-relaxed break-words text-[12px] font-medium">
                              {l1Details.sop_update || '-'}
                            </div>
                          </div>

                          <div className="space-y-[4px] min-w-0">
                            <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider font-sans">Supporting Files (SOP, WI, Control Plan, FMEA)</span>
                            {l1Details.file_sop && l1Details.file_sop !== '-' ? (
                              renderL1FilePill(l1Details.file_sop, l1Details.change_no)
                            ) : (
                              <span className="text-[12px] text-slate-400 italic">No file attached</span>
                            )}
                          </div>

                          <div className="space-y-[4px]">
                            <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">User Dept HOD Approval</span>
                            {l1Details.hod_approval ? (
                              <div className="pt-1">
                                <span className="inline-flex items-center gap-[6px] px-[10px] py-[6px] border border-[#0066cc] bg-[#0066cc]/5 text-[#0066cc] rounded-[6px] text-[10px] font-bold shadow-sm select-none">
                                  <span className="w-[12px] h-[12px] rounded-full border border-[#0066cc] flex items-center justify-center">
                                    <span className="w-[6px] h-[6px] rounded-full bg-[#0066cc]" />
                                  </span>
                                  <span>{l1Details.hod_approval}</span>
                                </span>
                              </div>
                            ) : (
                              <span className="text-[12px] text-slate-400 italic">No department selected</span>
                            )}
                          </div>

                          <div className="space-y-[4px]">
                            <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Customer Approval Required / Clearence Details</span>
                            <span className="font-semibold text-slate-750 flex items-center gap-1.5 mt-0.5 text-[12px]">
                              <span>{showCustomerApproval ? (l1Details.customer_approval || '-') : '••••'}</span>
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

                          {l1Details.hodStatus && (
                            <div className="space-y-[4px] mt-4 border-t border-slate-100 pt-4">
                              <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">HOD {l1Details.hodStatus} Remarks / Comments ({l1Details.hodDept || 'HOD'})</span>
                              <div className="bg-slate-50 border border-slate-200 rounded-[8px] p-[16px] text-slate-700 leading-relaxed min-h-[80px] max-h-[150px] overflow-y-auto break-words text-[12px]">
                                {l1Details.hodRemarks || 'No remarks provided.'}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* If already decided — show previous decision */}
                        {alreadyDecided && (
                          <section className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2">
                            <h5 className="text-[11px] font-black text-slate-600 uppercase tracking-widest flex items-center gap-1.5">
                              <ShieldCheck size={13} /> Previous HOD Decision
                            </h5>
                            <div className="flex items-center gap-3">
                              <StatusBadge status={selectedReq.hodStatus} />
                              <span className="text-[12px] text-slate-500">
                                by{' '}
                                <span className="font-semibold text-slate-700">
                                  {selectedReq.hodName || selectedReq.hodEmail}
                                </span>{' '}
                                {selectedReq.hodDept && (
                                  <span className="text-slate-400 font-normal">({selectedReq.hodDept})</span>
                                )}
                              </span>
                            </div>
                            {selectedReq.hodRemarks && (
                              <p className="text-[12px] text-slate-600 bg-white border border-slate-200 rounded-lg p-2.5 leading-relaxed">{selectedReq.hodRemarks}</p>
                            )}
                          </section>
                        )}

                        {/* Remarks input */}
                        {!alreadyDecided && !isChangeClosed && selectedReq.rejectCount === 0 && (isAdmin || (isHOD && isDeptInRequired(selectedReq.hodApprovalNote, selectedReq.dept, actingDept))) && (
                          <div className="space-y-2 pt-2 border-t border-slate-100">
                            <label className="flex items-center gap-1.5 text-[11px] font-black text-slate-500 uppercase tracking-wider">
                              <MessageSquare size={12} /> Remarks <span className="text-slate-400 font-normal normal-case">(optional)</span>
                            </label>
                            <textarea
                              rows={3}
                              value={remarks}
                              maxLength={1000}
                              onChange={e => setRemarks(e.target.value)}
                              placeholder="Enter your remarks or reason for decision..."
                              className="w-full border border-slate-200 rounded-xl p-3 text-[12px] text-slate-700 outline-none focus:border-[#0066cc] focus:ring-4 focus:ring-[#0066cc]/10 transition-all resize-none"
                            />
                            <div className="flex justify-end text-[9px] text-slate-400 mt-1">
                              <span className={`${1000 - remarks.length <= 15 ? 'text-amber-600 font-bold animate-pulse' : 'text-slate-400'}`}>
                                {1000 - remarks.length} characters remaining (max 1000 chars)
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-400">
                        <FileText size={28} className="text-slate-300" />
                        <p className="text-sm">No L1 request details found for this change.</p>
                      </div>
                    )
                  )}

                  {activeTab === 'l2' && (
                    !selectedL2Details ? (
                      <div className="text-center py-[64px] bg-slate-50 rounded-xl border border-dashed border-slate-200 w-full">
                        <AlertTriangle className="mx-auto mb-[12px] text-slate-300" size={32} />
                        <span className="text-slate-400 font-medium">No L2 Validation Details found for this request.</span>
                      </div>
                    ) : (
                      <div className="space-y-[20px]">
                        <h5 className="text-[12px] font-bold text-[#0066cc] uppercase tracking-wider border-b border-slate-100 pb-1.5 flex items-center gap-1.5">
                          <CheckCircle2 size={14} />
                          <span>L2 Validation Details</span>
                        </h5>

                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-[16px] bg-slate-50 border border-slate-200 rounded-[10px] p-[16px]">
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
                                L2 {selectedL2Details.status || 'Pending'}
                              </span>
                            </div>
                          </div>
                          <div className="space-y-[4px]">
                            <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Change No</span>
                            <span className="font-mono font-bold text-slate-800">{selectedL2Details.changeNo}</span>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-[16px] mt-4">
                          <div className="space-y-[6px]">
                            <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">PED Validation Attachment</span>
                            <div className="space-y-2">
                              {!selectedL2Details.weldTest || selectedL2Details.weldTest === '-' ? (
                                <div className="bg-slate-50 border border-slate-200 rounded-[8px] p-3 text-slate-550 text-[12px] font-medium">
                                  -
                                </div>
                              ) : (
                                selectedL2Details.weldTest.split(',').map(s => s.trim()).filter(Boolean).map((file, idx) => (
                                  <div key={idx} className="bg-slate-50 border border-slate-200 rounded-[8px] p-3 text-slate-700 flex items-center justify-between">
                                    <span className="font-medium text-slate-650 truncate max-w-[200px]" title={file}>
                                      {file}
                                    </span>
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
                            <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">QA Setup Verification Attachment</span>
                            <div className="space-y-2">
                              {!selectedL2Details.qaTest || selectedL2Details.qaTest === '-' ? (
                                <div className="bg-slate-50 border border-slate-200 rounded-[8px] p-3 text-slate-550 text-[12px] font-medium">
                                  -
                                </div>
                              ) : (
                                selectedL2Details.qaTest.split(',').map(s => s.trim()).filter(Boolean).map((file, idx) => (
                                  <div key={idx} className="bg-slate-50 border border-slate-200 rounded-[8px] p-3 text-slate-700 flex items-center justify-between">
                                    <span className="font-medium text-slate-650 truncate max-w-[200px]" title={file}>
                                      {file}
                                    </span>
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
                    <div className="space-y-[20px]">
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
                          <span className="font-medium text-slate-750">{selectedLog.requester}</span>
                        </div>
                        <div className="space-y-[4px]">
                          <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Requested Date</span>
                          <span className="font-medium text-slate-700">{selectedLog.date ? formatDateToDDMMYYYY(selectedLog.date) : '-'}</span>
                        </div>
                      </div>

                      {/* Matrix Grid */}
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-[12px]">
                        {[
                          { label: 'PED', value: selectedLog.ped },
                          { label: 'QAD', value: selectedLog.qad },
                          { label: 'Production', value: selectedLog.production },
                          { label: 'Maintenance', value: selectedLog.maintenance },
                          { label: 'PC & L', value: selectedLog.pcl },
                          { label: 'Materials', value: selectedLog.materials },
                          { label: 'Marketing', value: selectedLog.marketing },
                          { label: 'HR', value: selectedLog.hr },
                          { label: 'Safety', value: selectedLog.safety },
                          { label: 'Unit Head', value: selectedLog.unitHead }
                        ].map((dept, index) => {
                          const propMap = {
                            'PED': selectedLog.ped,
                            'QAD': selectedLog.qad,
                            'Production': selectedLog.production,
                            'Maintenance': selectedLog.maintenance,
                            'PC & L': selectedLog.pcl || selectedLog.ped,
                            'Materials': selectedLog.materials,
                            'Marketing': selectedLog.marketing,
                            'HR': selectedLog.hr,
                            'Safety': selectedLog.safety,
                            'Unit Head': selectedLog.unitHead || selectedLog.unit_head
                          };
                          const status = propMap[dept.label] || 'Pending';
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
                          <div className="text-center py-[64px] bg-slate-50 rounded-xl border border-dashed border-slate-200 w-full">
                            <AlertTriangle className="mx-auto mb-[12px] text-slate-350" size={32} />
                            <span className="text-slate-400 font-medium">Effectiveness monitoring log is pending creation/validation for this request.</span>
                          </div>
                        );
                      }

                      return (
                        <div className="space-y-[20px] animate-fade-in-up">
                          <h5 className="text-[12px] font-bold text-[#0066cc] uppercase tracking-wider border-b border-slate-100 pb-1.5 flex items-center gap-1.5">
                            <CheckCircle2 size={14} />
                            <span>Effectiveness Monitoring Log Details</span>
                          </h5>

                          <div className="grid grid-cols-2 md:grid-cols-4 gap-[16px] bg-slate-50 border border-slate-150 rounded-[10px] p-[16px]">
                            <div className="space-y-[4px]">
                              <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Change No</span>
                              <span className="font-mono font-bold text-slate-800">{currentEffLog.changeNo}</span>
                            </div>
                            <div className="space-y-[4px]">
                              <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Requested Date</span>
                              <span className="font-medium text-slate-700">{currentEffLog.reqDate ? formatDateToDDMMYYYY(currentEffLog.reqDate) : '-'}</span>
                            </div>
                            <div className="space-y-[4px]">
                              <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Change Date Start</span>
                              <span className="font-medium text-slate-700">{currentEffLog.startDate ? formatDateToDDMMYYYY(currentEffLog.startDate) : '-'}</span>
                            </div>
                            <div className="space-y-[4px]">
                              <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Month Wise</span>
                              <span className="font-medium text-slate-700">{currentEffLog.monthWise || '-'}</span>
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
                                      handleViewAttachment(file, currentEffLog.id, 'Effectiveness');
                                    }}
                                    className="inline-flex items-center gap-1 bg-slate-50 border border-slate-150 text-[11px] font-medium text-slate-700 px-2.5 py-1 rounded-full hover:bg-slate-100 hover:border-[#0066cc] hover:text-[#0066cc] cursor-pointer"
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

            {/* Modal Footer — Decision */}
            <div className="border-t border-slate-200 bg-slate-50 px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto justify-center sm:justify-start">
                {activeTab === 'l1' ? (
                  alreadyDecided ? (
                    <span className={`inline-flex items-center gap-2 text-[12px] font-bold px-3 py-1.5 rounded-xl border ${selectedReq.hodStatus === 'Approved'
                      ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                      : 'text-rose-700 bg-rose-50 border-rose-200'
                      }`}>
                      {selectedReq.hodStatus === 'Approved' ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                      {(() => {
                        const showAsSelf = !isAdmin && isHOD && userEmail && selectedReq.hodEmail && userEmail.toLowerCase() === selectedReq.hodEmail.toLowerCase();
                        if (showAsSelf) {
                          return `Already ${selectedReq.hodStatus} by You`;
                        } else {
                          const displayName = selectedReq.hodName || selectedReq.hodEmail || 'HOD';
                          const displayDept = selectedReq.hodDept ? ` (${selectedReq.hodDept})` : '';
                          return `Already ${selectedReq.hodStatus} by ${displayName}${displayDept}`;
                        }
                      })()}
                    </span>
                  ) : isChangeClosed ? (
                    <span className="inline-flex items-center gap-2 text-[12px] font-bold px-3 py-1.5 rounded-xl border text-emerald-700 bg-emerald-50 border-emerald-200">
                      <CheckCircle2 size={14} className="text-emerald-600" /> L1 Approvals Closed
                    </span>
                  ) : selectedReq.rejectCount > 0 ? (
                    <span className="inline-flex items-center gap-2 text-[12px] font-bold px-3 py-1.5 rounded-xl border text-rose-700 bg-rose-50 border-rose-200">
                      <XCircle size={14} /> L1 HOD Approval Rejected
                    </span>
                  ) : selectedReq.crStatus && selectedReq.crStatus.toLowerCase() !== 'pending' ? (
                    <span className="inline-flex items-center gap-2 text-[12px] font-bold px-3 py-1.5 rounded-xl border text-emerald-700 bg-emerald-50 border-emerald-200">
                      <CheckCircle2 size={14} /> L1 HOD Approval Completed
                    </span>
                  ) : (isAdmin || (isHOD && isDeptInRequired(selectedReq.hodApprovalNote, selectedReq.dept, actingDept))) ? (
                    <>
                      <span className="text-[11px] font-bold text-slate-600">
                        Your L1 decision as <span className="text-[#0066cc]">{actingDept}</span> HOD:
                      </span>
                      <button
                        onClick={() => handleDecision('Approved')}
                        disabled={isSubmitting}
                        className="flex items-center gap-1.5 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-[12px] font-bold shadow-md shadow-emerald-200 transition-all cursor-pointer"
                      >
                        {isSubmitting ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
                        Approve
                      </button>
                      <button
                        onClick={() => handleDecision('Rejected')}
                        disabled={isSubmitting}
                        className="flex items-center gap-1.5 px-5 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-xl text-[12px] font-bold shadow-md shadow-rose-200 transition-all cursor-pointer"
                      >
                        {isSubmitting ? <Loader2 size={13} className="animate-spin" /> : <XCircle size={13} />}
                        Reject
                      </button>
                    </>
                  ) : (
                    <span className="text-[12px] font-semibold text-slate-500 bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-xl">
                      Awaiting {mapDept(selectedReq.hodApprovalNote || selectedReq.dept)} HOD Decision
                    </span>
                  )
                ) : activeTab === 'l2' ? (
                  selectedL2Details ? (
                    <span className={`inline-flex items-center gap-2 text-[12px] font-bold px-3 py-1.5 rounded-xl border ${selectedL2Details.status === 'Accepted'
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
                      L2 QA Validation {selectedL2Details.status === 'Accepted' ? 'Approved' : (selectedL2Details.status || 'Pending')}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-2 text-[12px] font-bold px-3 py-1.5 rounded-xl border text-amber-700 bg-amber-50 border-amber-200">
                      <Clock size={14} /> L2 QA Validation Pending
                    </span>
                  )
                ) : (
                  (() => {
                    const statusLower = (selectedReq.crStatus || '').toLowerCase();
                    if (statusLower === 'completed') {
                      return (
                        <span className="inline-flex items-center gap-2 text-[12px] font-bold px-3 py-1.5 rounded-xl border text-emerald-700 bg-emerald-50 border-emerald-200">
                          <CheckCircle2 size={14} /> L3 HOD Decisions Completed
                        </span>
                      );
                    } else if (statusLower === 'approved') {
                      return (
                        <span className="inline-flex items-center gap-2 text-[12px] font-bold px-3 py-1.5 rounded-xl border text-indigo-700 bg-indigo-50 border-indigo-200">
                          <Clock size={14} /> L3 HOD Decisions In Progress
                        </span>
                      );
                    } else if (statusLower === 'rejected') {
                      return (
                        <span className="inline-flex items-center gap-2 text-[12px] font-bold px-3 py-1.5 rounded-xl border text-rose-700 bg-rose-50 border-rose-200">
                          <XCircle size={14} /> L3 HOD Decisions Rejected
                        </span>
                      );
                    } else {
                      return (
                        <span className="inline-flex items-center gap-2 text-[12px] font-bold px-3 py-1.5 rounded-xl border text-slate-500 bg-slate-100 border-slate-200">
                          <Clock size={14} /> Awaiting L1 / L2 Completion
                        </span>
                      );
                    }
                  })()
                )}
              </div>
              <button
                onClick={handleCloseModal}
                className="flex items-center gap-1.5 px-5 py-2 bg-white border border-slate-200 rounded-xl text-[12px] font-bold text-slate-600 hover:bg-slate-100 hover:border-slate-300 transition-all shadow-sm cursor-pointer whitespace-nowrap"
              >
                <X size={13} /> Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Attachment Preview ─── */}
      {previewFile && (
        <div className="fixed inset-0 z-[60] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-6" onClick={() => setPreviewFile(null)}>
          <div className="relative bg-white rounded-2xl shadow-2xl overflow-hidden max-w-4xl w-full max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 bg-slate-50">
              <span className="font-bold text-slate-800 text-[13px] truncate max-w-[80%]">{previewFile}</span>
              <button onClick={() => setPreviewFile(null)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-200 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer">
                <X size={16} />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-slate-100/60">
              {fileUrls[previewFile] ? (
                (previewFile.match(/\.(png|jpg|jpeg|gif|webp)$/i) || (fileTypes[previewFile] && fileTypes[previewFile].startsWith('image/')))
                  ? <img src={fileUrls[previewFile]} alt={previewFile} className="max-w-full max-h-[70vh] rounded-xl shadow-lg object-contain" />
                  : <iframe src={fileUrls[previewFile]} title={previewFile} className="w-full h-[70vh] rounded-xl border border-slate-200 shadow" />
              ) : (
                <div className="flex flex-col items-center gap-3 text-slate-400 py-16">
                  <Loader2 className="animate-spin text-[#0066cc]" size={28} />
                  <span className="text-sm font-semibold">Loading preview...</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
