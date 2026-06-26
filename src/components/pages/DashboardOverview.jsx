import { useState, useEffect } from 'react';
import {
  Clock,
  Loader2,
  BarChart3,
  LayoutGrid,
  Calendar,
  GitBranch,
  Layers,
  Settings,
  ShieldAlert,
  CheckCircle,
  Download,
  CheckCheck,
  Eye,
  EyeOff,
  X,
  Paperclip,
  Folder,
  Cpu,
  CheckCircle2,
  FileText,
  AlertTriangle,
  Upload,
  Plus,
  Trash2
} from 'lucide-react';
import TablePagination from '@mui/material/TablePagination';
import { formatDateToDDMMYY, parseDDMMYYYYToDate, formatDateToDDMMYYYY } from '../../utils/dateUtils';
import { getRequestDisplayStatus } from '../../utils/statusUtils';
import { getSyncedDate } from '../../utils/timeSync';
import { CustomDatePicker } from '../ui/CustomDatePicker';
import { useWebSocket } from '../../hooks/useWebSocket';
import {
  getProcesses,
  getMachines,
  getL1Details,
  getL1Attachment,
  getL2Details,
  getL2Attachment,
  getL3Details,
  updateChangeDetails,
  getEffectivenessLogs,
  getEffectivenessAttachment,
  getDepartments,
  getDashboardCounts
} from '../../api/apiRoutes';
import {
  exportDashboardRequestsPDF,
  exportDepartmentAnalyticsPDF,
  exportProcessAnalyticsPDF,
  exportCategoryAnalyticsPDF,
  exportMonthlyAnalyticsPDF,
  exportApprovalStatusAnalyticsPDF,
  exportImprovementBenefitsPDF,
  exportRequestDetailsPDF
} from '../../utils/pdfExport';


const convertDDMMYYYYToYYYYMMDD = (val) => {
  if (!val) return '';
  const parts = val.split('/');
  if (parts.length === 3) {
    const d = parts[0].padStart(2, '0');
    const m = parts[1].padStart(2, '0');
    const y = parts[2];
    return `${y}-${m}-${d}`;
  }
  return val;
};

export const DashboardOverview = ({
  changes,
  isFetchingChanges,
  // onTabChange,
  setToastMsg,
  usersList = [],
  isAdmin = false
}) => {
  const [isGridView, setIsGridView] = useState(false);

  // Details Modal States
  const [selectedLog, setSelectedLog] = useState(null);
  const [selectedL1Details, setSelectedL1Details] = useState(null);
  const [selectedL2Details, setSelectedL2Details] = useState(null);
  const [selectedEffDetails, setSelectedEffDetails] = useState(null);
  const [isFetchingDetails, setIsFetchingDetails] = useState(false);
  const [activeTab, setActiveTab] = useState('l1');
  const [previewFile, setPreviewFile] = useState(null);
  const [fileUrls, setFileUrls] = useState({});
  const [fileTypes, setFileTypes] = useState({});
  const [activeAnalyticsTab, setActiveAnalyticsTab] = useState('Department');
  const [showCustomerApproval, setShowCustomerApproval] = useState(false);

  // Edit Mode States
  const [isEditMode, setIsEditMode] = useState(false);
  const [editL1Data, setEditL1Data] = useState({});
  const [editL2Data, setEditL2Data] = useState({});
  const [editL3Data, setEditL3Data] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [uploadedFilesList, setUploadedFilesList] = useState([]);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  useEffect(() => {
    setIsEditMode(false);
  }, [activeTab]);

  // Table editor modal states
  const [isTableModalOpen, setIsTableModalOpen] = useState(false);
  const [tableModalError, setTableModalError] = useState('');
  const [tempTableData, setTempTableData] = useState([]);

  const handleUpdateEditTableCell = (rowIndex, field, value) => {
    const updatedList = tempTableData.map((row, idx) => {
      if (idx !== rowIndex) return row;
      const updated = { ...row, [field]: value };
      if (field === 'monthlySave') {
        const val = parseFloat(value);
        if (!isNaN(val)) {
          updated.annualSave = String(val * 12);
        } else {
          updated.annualSave = '';
        }
      }
      return updated;
    });
    setTempTableData(updatedList);

    if (checkEditTableCompleteness(updatedList)) {
      setTableModalError('');
    }
  };

  const handleAddEditTableRow = () => {
    const changeNo = editL1Data.change_no || editL1Data.changeNo || selectedLog?.changeNo || '';
    const area = (editL1Data.improvement_area || '').toLowerCase();
    let newRow = {};
    if (area === 'cost') {
      newRow = { changeNo: changeNo, date: '', monthlySave: '', annualSave: '', roi: '' };
    } else if (area === 'productivity') {
      newRow = { changeNo: changeNo, date: '', currentProd: '', improvedProd: '' };
    } else if (area === 'quality') {
      newRow = { changeNo: changeNo, date: '', currentPpm: '', reducedPpm: '' };
    }
    setTempTableData([...tempTableData, newRow]);
  };

  const handleDeleteEditTableRow = (rowIndex) => {
    const updatedList = tempTableData.filter((_, idx) => idx !== rowIndex);
    setTempTableData(updatedList);
    if (checkEditTableCompleteness(updatedList)) {
      setTableModalError('');
    }
  };

  const checkEditTableCompleteness = (tableData) => {
    const area = (editL1Data.improvement_area || '').toLowerCase();
    if (!tableData || tableData.length === 0) return false;
    for (const row of tableData) {
      if (area === 'cost') {
        if (!row.date || !row.monthlySave || !row.annualSave || !row.roi) return false;
      } else if (area === 'productivity') {
        if (!row.date || !row.currentProd || !row.improvedProd) return false;
      } else if (area === 'quality') {
        if (!row.date || !row.currentPpm || !row.reducedPpm) return false;
      }
    }
    return true;
  };

  const handleEditTableDone = () => {
    if (tempTableData.length === 0) {
      setTableModalError('Please add at least one row of data.');
      return;
    }
    if (!checkEditTableCompleteness(tempTableData)) {
      setTableModalError('Please fill all fields in the table.');
      return;
    }
    setTableModalError('');
    setEditL1Data(prev => ({
      ...prev,
      improvement_table_data: JSON.stringify(tempTableData)
    }));
    setIsTableModalOpen(false);
  };

  const canEdit = isAdmin;

  const fileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = reader.result;
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = error => reject(error);
    });
  };

  useEffect(() => {
    if (!selectedLog) {
      setShowCustomerApproval(false);
      setIsEditMode(false);
    }
  }, [selectedLog]);

  // Separate Benefit Filters
  const [benefitFilterType, setBenefitFilterType] = useState('All');
  const [benefitFilterMonth, setBenefitFilterMonth] = useState('All');
  const [benefitFilterSearch, setBenefitFilterSearch] = useState('');

  // Pagination State
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(5);


  const [dashboardCounts, setDashboardCounts] = useState({
    total: 0,
    approved: 0,
    closed: 0,
    rejected: 0,
    pending: 0
  });
  const [isFetchingCounts, setIsFetchingCounts] = useState(false);

  const fetchCounts = async (silent = false) => {
    if (!silent) setIsFetchingCounts(true);
    try {
      const response = await getDashboardCounts();
      setDashboardCounts(response.data);
    } catch (err) {
      console.error('Error fetching dashboard counts:', err);
    } finally {
      if (!silent) setIsFetchingCounts(false);
    }
  };

  useEffect(() => {
    fetchCounts(true);
  }, [changes]);

  // Department Filters
  const [deptFilterMonth, setDeptFilterMonth] = useState('All');
  const [deptFilterFromDate, setDeptFilterFromDate] = useState('');
  const [deptFilterToDate, setDeptFilterToDate] = useState('');
  const [deptFilterPerson, setDeptFilterPerson] = useState('All');
  const [deptFilterProcess, setDeptFilterProcess] = useState('All');
  const [deptFilterMachine, setDeptFilterMachine] = useState('All');

  // Process Filters
  const [procFilterMonth, setProcFilterMonth] = useState('All');
  const [procFilterFromDate, setProcFilterFromDate] = useState('');
  const [procFilterToDate, setProcFilterToDate] = useState('');
  const [procFilterPerson, setProcFilterPerson] = useState('All');
  const [procFilterProcess, setProcFilterProcess] = useState('All');
  const [procFilterMachine, setProcFilterMachine] = useState('All');

  // 6M Category Filters
  const [catFilterMonth, setCatFilterMonth] = useState('All');
  const [catFilterFromDate, setCatFilterFromDate] = useState('');
  const [catFilterToDate, setCatFilterToDate] = useState('');
  const [catFilterPerson, setCatFilterPerson] = useState('All');
  const [catFilterProcess, setCatFilterProcess] = useState('All');
  const [catFilterMachine, setCatFilterMachine] = useState('All');

  // Monthly Filters
  const [monthFilterMonth, setMonthFilterMonth] = useState('All');
  const [monthFilterFromDate, setMonthFilterFromDate] = useState('');
  const [monthFilterToDate, setMonthFilterToDate] = useState('');
  const [monthFilterPerson, setMonthFilterPerson] = useState('All');
  const [monthFilterProcess, setMonthFilterProcess] = useState('All');
  const [monthFilterMachine, setMonthFilterMachine] = useState('All');

  // Approval Status Filters
  const [apprFilterMonth, setApprFilterMonth] = useState('All');
  const [apprFilterFromDate, setApprFilterFromDate] = useState('');
  const [apprFilterToDate, setApprFilterToDate] = useState('');
  const [apprFilterStatus, setApprFilterStatus] = useState('All');

  // Table Filters (Recent change requests)
  const [tableFilterMonth, setTableFilterMonth] = useState('All');
  const [tableFilterFromDate, setTableFilterFromDate] = useState('');
  const [tableFilterToDate, setTableFilterToDate] = useState('');
  const [tableFilterPerson, setTableFilterPerson] = useState('All');
  const [tableFilterProcess, setTableFilterProcess] = useState('All');
  const [tableFilterMachine, setTableFilterMachine] = useState('All');

  useEffect(() => {
    setPage(0);
  }, [
    activeAnalyticsTab,
    isGridView,
    tableFilterMonth, tableFilterFromDate, tableFilterToDate, tableFilterPerson, tableFilterProcess, tableFilterMachine,
    deptFilterMonth, deptFilterFromDate, deptFilterToDate, deptFilterPerson, deptFilterProcess, deptFilterMachine,
    procFilterMonth, procFilterFromDate, procFilterToDate, procFilterPerson, procFilterProcess, procFilterMachine,
    catFilterMonth, catFilterFromDate, catFilterToDate, catFilterPerson, catFilterProcess, catFilterMachine,
    monthFilterMonth, monthFilterFromDate, monthFilterToDate, monthFilterPerson, monthFilterProcess, monthFilterMachine,
    apprFilterMonth, apprFilterFromDate, apprFilterToDate, apprFilterStatus,
    benefitFilterMonth, benefitFilterSearch, benefitFilterType
  ]);


  // Helper checks to see if filters are applied
  const isDeptFilterApplied = deptFilterMonth !== 'All' || deptFilterFromDate !== '' || deptFilterToDate !== '' || deptFilterPerson !== 'All' || deptFilterProcess !== 'All' || deptFilterMachine !== 'All';
  const isProcFilterApplied = procFilterMonth !== 'All' || procFilterFromDate !== '' || procFilterToDate !== '' || procFilterPerson !== 'All' || procFilterProcess !== 'All' || procFilterMachine !== 'All';
  const isCatFilterApplied = catFilterMonth !== 'All' || catFilterFromDate !== '' || catFilterToDate !== '' || catFilterPerson !== 'All' || catFilterProcess !== 'All' || catFilterMachine !== 'All';
  const isMonthFilterApplied = monthFilterMonth !== 'All' || monthFilterFromDate !== '' || monthFilterToDate !== '' || monthFilterPerson !== 'All' || monthFilterProcess !== 'All' || monthFilterMachine !== 'All';
  const isApprFilterApplied = apprFilterMonth !== 'All' || apprFilterFromDate !== '' || apprFilterToDate !== '' || apprFilterStatus !== 'All';
  const isBenefitFilterApplied = benefitFilterType !== 'All' || benefitFilterMonth !== 'All' || benefitFilterSearch !== '';
  const isTableFilterApplied = tableFilterMonth !== 'All' || tableFilterFromDate !== '' || tableFilterToDate !== '' || tableFilterPerson !== 'All' || tableFilterProcess !== 'All' || tableFilterMachine !== 'All';

  const resetDeptFilters = () => {
    setDeptFilterMonth('All');
    setDeptFilterFromDate('');
    setDeptFilterToDate('');
    setDeptFilterPerson('All');
    setDeptFilterProcess('All');
    setDeptFilterMachine('All');
  };

  const resetProcFilters = () => {
    setProcFilterMonth('All');
    setProcFilterFromDate('');
    setProcFilterToDate('');
    setProcFilterPerson('All');
    setProcFilterProcess('All');
    setProcFilterMachine('All');
  };

  const resetCatFilters = () => {
    setCatFilterMonth('All');
    setCatFilterFromDate('');
    setCatFilterToDate('');
    setCatFilterPerson('All');
    setCatFilterProcess('All');
    setCatFilterMachine('All');
  };

  const resetMonthFilters = () => {
    setMonthFilterMonth('All');
    setMonthFilterFromDate('');
    setMonthFilterToDate('');
    setMonthFilterPerson('All');
    setMonthFilterProcess('All');
    setMonthFilterMachine('All');
  };

  const resetApprFilters = () => {
    setApprFilterMonth('All');
    setApprFilterFromDate('');
    setApprFilterToDate('');
    setApprFilterStatus('All');
  };

  const resetBenefitFilters = () => {
    setBenefitFilterType('All');
    setBenefitFilterMonth('All');
    setBenefitFilterSearch('');
  };

  const resetTableFilters = () => {
    setTableFilterMonth('All');
    setTableFilterFromDate('');
    setTableFilterToDate('');
    setTableFilterPerson('All');
    setTableFilterProcess('All');
    setTableFilterMachine('All');
  };

  const isTabFilterApplied = (tab) => {
    if (tab === 'Department') return isDeptFilterApplied;
    if (tab === 'Process') return isProcFilterApplied;
    if (tab === '6M Category') return isCatFilterApplied;
    if (tab === 'Monthly') return isMonthFilterApplied;
    if (tab === 'Approval Status') return isApprFilterApplied;
    if (tab === 'Improvement Benefits') return isBenefitFilterApplied;
    return false;
  };

  const resetTabFilters = (tab) => {
    if (tab === 'Department') resetDeptFilters();
    else if (tab === 'Process') resetProcFilters();
    else if (tab === '6M Category') resetCatFilters();
    else if (tab === 'Monthly') resetMonthFilters();
    else if (tab === 'Approval Status') resetApprFilters();
    else if (tab === 'Improvement Benefits') resetBenefitFilters();
  };

  const [dbProcesses, setDbProcesses] = useState([]);
  const [dbMachines, setDbMachines] = useState([]);
  const [dbDepartments, setDbDepartments] = useState([]);

  const fetchOptions = async () => {
    try {
      const [pRes, mRes, deptRes] = await Promise.all([getProcesses(), getMachines(), getDepartments()]);
      setDbProcesses(pRes.data);
      setDbMachines(mRes.data);
      setDbDepartments(deptRes.data);
    } catch (e) {
      console.error('Error fetching process/machine/department options:', e);
    }
  };

  useEffect(() => {
    fetchOptions();
  }, []);

  useWebSocket((data) => {
    if (data.type === 'REFRESH_CHANGES') {
      fetchCounts(true);
      if (selectedLog) {
        handleViewDetails({
          id: selectedLog.changeNo,
          requester: selectedLog.requester,
          rawDate: selectedLog.date,
          status: selectedLog.status,
          hodStatus: selectedLog.hodStatus
        }, true); // silent = true
      }
    } else if (data.type === 'REFRESH_USERS') {
      fetchOptions();
    }
  });


  const monthsList = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
  ];
  const monthOptions = monthsList;

  const uniquePersons = [
    { email: 'All', name: 'All Persons', department: '', role: '' },
    ...(() => {
      const peopleMap = new Map();
      usersList.forEach(u => {
        if (u.email) {
          const emailLower = u.email.toLowerCase();
          peopleMap.set(emailLower, {
            email: u.email,
            name: u.name || '',
            department: u.department || '',
            role: u.role || ''
          });
        }
      });
      changes.forEach(c => {
        const email = c.requesterEmail;
        const name = c.requester;
        if (email) {
          const emailLower = email.toLowerCase();
          if (!peopleMap.has(emailLower)) {
            peopleMap.set(emailLower, {
              email: email,
              name: name || email.split('@')[0],
              department: c.dept || c.department || '',
              role: ''
            });
          }
        } else if (name) {
          const nameLower = name.toLowerCase();
          if (!peopleMap.has(nameLower)) {
            peopleMap.set(nameLower, {
              email: '',
              name: name,
              department: c.dept || c.department || '',
              role: ''
            });
          }
        }
      });
      return Array.from(peopleMap.values());
    })()
  ];
  const uniqueProcesses = ['All', ...new Set([...dbProcesses, ...changes.map(c => c.processName).filter(Boolean)])];
  const uniqueMachines = ['All', ...new Set([...dbMachines, ...changes.map(c => c.machineNo).filter(Boolean)])];

  const getFilteredData = (
    monthVal,
    fromDateVal,
    toDateVal,
    personVal,
    processVal,
    machineVal,
    statusVal = 'All'
  ) => {
    return changes.filter(c => {
      let matchesMonth = true;
      if (monthVal !== 'All') {
        try {
          const d = parseDDMMYYYYToDate(c.rawDate || c.date);
          if (d && !isNaN(d.getTime())) {
            const itemMonthName = d.toLocaleDateString('en-US', { month: 'short' });
            matchesMonth = (itemMonthName === monthVal);
          } else {
            matchesMonth = false;
          }
        } catch {
          matchesMonth = false;
        }
      }

      let matchesFromDate = true;
      let matchesToDate = true;
      if (fromDateVal && toDateVal) {
        const fD = parseDDMMYYYYToDate(fromDateVal);
        const tD = parseDDMMYYYYToDate(toDateVal);
        if (fD && tD) {
          fD.setHours(0, 0, 0, 0);
          tD.setHours(23, 59, 59, 999);
          const itemD = parseDDMMYYYYToDate(c.rawDate || c.date);
          matchesFromDate = itemD && itemD >= fD;
          matchesToDate = itemD && itemD <= tD;
        }
      } else if (fromDateVal || toDateVal) {
        matchesFromDate = false;
        matchesToDate = false;
      }

      const matchesPerson = personVal === 'All' ||
        (c.requesterEmail && c.requesterEmail.toLowerCase() === personVal.toLowerCase()) ||
        (c.requester && c.requester.toLowerCase() === personVal.toLowerCase());
      const matchesProcess = processVal === 'All' || c.processName === processVal;
      const matchesMachine = machineVal === 'All' || c.machineNo === machineVal;

      let matchesStatus = true;
      if (statusVal !== 'All') {
        const dispStatus = getRequestDisplayStatus(c);
        if (statusVal === 'Approved' || statusVal === 'L3 Approved') matchesStatus = dispStatus === 'Approved' || dispStatus === 'L3 Approved';
        else if (statusVal === 'Closed') matchesStatus = dispStatus === 'Closed';
        else if (statusVal === 'Rejected') matchesStatus = dispStatus === 'Rejected';
        else if (statusVal === 'Pending') matchesStatus = dispStatus.startsWith('Pending');
        else matchesStatus = false;
      }

      return matchesMonth && matchesFromDate && matchesToDate && matchesPerson && matchesProcess && matchesMachine && matchesStatus;
    });
  };

  // Extract all improvement data rows
  const costSavingRows = [];
  const productivityRows = [];
  const qualityRows = [];

  changes.forEach(c => {
    if (c.improvementTableData) {
      try {
        const rows = typeof c.improvementTableData === 'string'
          ? JSON.parse(c.improvementTableData)
          : c.improvementTableData;

        if (Array.isArray(rows)) {
          const area = (c.improvementArea || '').toLowerCase();
          rows.forEach(r => {
            const rowWithDefaults = {
              ...r,
              changeNo: r.changeNo || c.id || c.changeNo || '',
              date: r.date ? formatDateToDDMMYY(r.date) : ''
            };
            if (area === 'cost') {
              costSavingRows.push(rowWithDefaults);
            } else if (area === 'productivity') {
              productivityRows.push(rowWithDefaults);
            } else if (area === 'quality') {
              qualityRows.push(rowWithDefaults);
            }
          });
        }
      } catch (e) {
        console.error('Error parsing improvementTableData for change:', c.id, e);
      }
    }
  });

  const getFilteredBenefitsChanges = () => {
    return changes.filter(c => {
      if (!c.improvementTableData) return false;
      const area = (c.improvementArea || '').toLowerCase();
      if (benefitFilterType !== 'All' && area !== benefitFilterType.toLowerCase()) return false;

      let matchesMonth = true;
      if (benefitFilterMonth !== 'All') {
        try {
          const rows = typeof c.improvementTableData === 'string'
            ? JSON.parse(c.improvementTableData)
            : c.improvementTableData;
          if (Array.isArray(rows)) {
            matchesMonth = rows.some(r => {
              const parts = r.date ? r.date.split('/') : [];
              if (parts.length === 3) {
                const monthIdx = parseInt(parts[1], 10) - 1;
                const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                return months[monthIdx] === benefitFilterMonth;
              }
              return false;
            });
          } else {
            matchesMonth = false;
          }
        } catch {
          matchesMonth = false;
        }
      }

      const matchesSearch = !benefitFilterSearch ||
        (c.changeNo && c.changeNo.toLowerCase().includes(benefitFilterSearch.toLowerCase())) ||
        (c.id && c.id.toLowerCase().includes(benefitFilterSearch.toLowerCase()));

      return matchesMonth && matchesSearch;
    });
  };

  const getActiveTabFilteredChanges = () => {
    if (isGridView) {
      return getFilteredData(tableFilterMonth, tableFilterFromDate, tableFilterToDate, tableFilterPerson, tableFilterProcess, tableFilterMachine);
    }
    if (activeAnalyticsTab === 'Department') {
      return getFilteredData(deptFilterMonth, deptFilterFromDate, deptFilterToDate, deptFilterPerson, deptFilterProcess, deptFilterMachine);
    }
    if (activeAnalyticsTab === 'Process') {
      return getFilteredData(procFilterMonth, procFilterFromDate, procFilterToDate, procFilterPerson, procFilterProcess, procFilterMachine);
    }
    if (activeAnalyticsTab === '6M Category') {
      return getFilteredData(catFilterMonth, catFilterFromDate, catFilterToDate, catFilterPerson, catFilterProcess, catFilterMachine);
    }
    if (activeAnalyticsTab === 'Monthly') {
      return getFilteredData(monthFilterMonth, monthFilterFromDate, monthFilterToDate, monthFilterPerson, monthFilterProcess, monthFilterMachine);
    }
    if (activeAnalyticsTab === 'Approval Status') {
      return getFilteredData(apprFilterMonth, apprFilterFromDate, apprFilterToDate, 'All', 'All', 'All', apprFilterStatus);
    }
    if (activeAnalyticsTab === 'Improvement Benefits') {
      return getFilteredBenefitsChanges();
    }
    return changes;
  };

  const filteredChangesForTable = getActiveTabFilteredChanges();

  const isActiveTabDateRangeIncomplete = () => {
    if (isGridView) {
      return isDateRangeIncomplete(tableFilterFromDate, tableFilterToDate);
    }
    if (activeAnalyticsTab === 'Department') {
      return isDateRangeIncomplete(deptFilterFromDate, deptFilterToDate);
    }
    if (activeAnalyticsTab === 'Process') {
      return isDateRangeIncomplete(procFilterFromDate, procFilterToDate);
    }
    if (activeAnalyticsTab === '6M Category') {
      return isDateRangeIncomplete(catFilterFromDate, catFilterToDate);
    }
    if (activeAnalyticsTab === 'Monthly') {
      return isDateRangeIncomplete(monthFilterFromDate, monthFilterToDate);
    }
    if (activeAnalyticsTab === 'Approval Status') {
      return isDateRangeIncomplete(apprFilterFromDate, apprFilterToDate);
    }
    return false;
  };



  const formattedDbChanges = (changes || []).slice(0, 5).map((c, idx) => {
    const displayDate = formatDateToDDMMYY(c.rawDate || c.date);
    const displayStatus = getRequestDisplayStatus(c);

    return {
      slNo: idx + 1,
      id: c.id,
      machineNo: c.machineNo || '',
      processName: c.processName || '',
      department: c.dept || c.department || 'PRODUCTION',
      date: displayDate,
      status: displayStatus,
      // preserve all needed properties for modal view
      requester: c.requester,
      title: c.title,
      rawDate: c.rawDate || c.date,
      requesterEmail: c.requesterEmail,
      hodStatus: c.hodStatus,
      l2Status: c.l2Status,
      hasL3Rejection: c.hasL3Rejection,
      isL3Complete: c.isL3Complete
    };
  });

  const totalCount = dashboardCounts.total;
  const approvedCount = dashboardCounts.approved;
  const closedCount = dashboardCounts.closed;
  const rejectedCount = dashboardCounts.rejected;
  const pendingCount = dashboardCounts.pending;

  const allTableRows = formattedDbChanges;
  const paginatedTableRows = allTableRows;

  // Load details handler
  async function handleViewDetails(request, silent = false) {
    if (!silent) {
      // Open modal immediately with skeleton data to avoid blinking/flicker
      setSelectedLog({
        changeNo: request.id,
        requester: request.requester,
        requesterEmail: request.requesterEmail,
        date: request.rawDate,
        status: request.status,
        hodStatus: request.hodStatus,
        ped: 'Pending',
        quality: 'Pending',
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
      setSelectedEffDetails(null);
      setIsFetchingDetails(true);
      setActiveTab('l1');
    }

    try {
      const [l1Res, l2Res, l3Res, effRes] = await Promise.all([
        getL1Details(request.id),
        getL2Details(request.id).catch(() => ({ data: null })),
        getL3Details(request.id).catch(() => ({ data: null })),
        getEffectivenessLogs().catch(() => ({ data: [] }))
      ]);

      setSelectedL1Details(l1Res.data);
      setSelectedL2Details(l2Res.data);
      const matchedEff = effRes.data?.find(
        l => l.changeNo?.toLowerCase().trim() === request.id?.toLowerCase().trim()
      );
      setSelectedEffDetails(matchedEff || null);

      if (!silent) {
        setEditL1Data(l1Res.data || {});
        setEditL2Data(l2Res.data || {});
      }

      const matchedL3 = l3Res.data;
      const newLogData = (matchedL3 && matchedL3.changeNo) ? { ...matchedL3, status: request.status || matchedL3.status, hodStatus: request.hodStatus, requesterEmail: request.requesterEmail } : {
        changeNo: request.id,
        requester: request.requester,
        requesterEmail: request.requesterEmail,
        date: request.rawDate,
        status: request.status || matchedL3?.status,
        hodStatus: request.hodStatus,
        ped: 'Pending',
        quality: 'Pending',
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

      if (!silent) {
        setEditL3Data(newLogData || {});
      }
    } catch (err) {
      console.error('Error fetching request details:', err);
    } finally {
      if (!silent) setIsFetchingDetails(false);
    }
  }

  const handleViewAttachment = async (filename, changeNo, type = 'L1') => {
    if (!filename || filename === '-') return;
    setPreviewFile(filename);

    if (!fileUrls[filename]) {
      try {
        let response;
        if (type === 'L2') {
          response = await getL2Attachment(changeNo, filename);
        } else if (type === 'Effectiveness') {
          response = await getEffectivenessAttachment(changeNo, filename);
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

  const handleExportRequestDetailsPDF = () => {
    // Mirror the exact same tab visibility conditions used in the modal tab header
    const showL2 = selectedL1Details?.hodStatus !== 'Rejected' && selectedL2Details !== null;
    const showL3 = showL2 && selectedL2Details?.status === 'Accepted';
    const showEff = showL3 && (
      (selectedLog?.status || '').toLowerCase() === 'completed' ||
      selectedEffDetails !== null
    );

    // Determine export scope based on which tabs are visible
    let targetTab;
    if (showEff) {
      targetTab = 'all';        // 4 tabs visible → export everything
    } else if (showL3) {
      targetTab = 'l3';         // 3 tabs visible → export L1 + L2 + L3
    } else if (showL2) {
      targetTab = 'l2';         // 2 tabs visible → export L1 + L2 only
    } else {
      targetTab = 'l1';         // only L1 tab visible → export L1 only
    }

    const currentEffLog = showEff ? (selectedEffDetails || null) : null;
    exportRequestDetailsPDF(selectedL1Details, selectedL2Details, selectedLog, targetTab, setToastMsg, currentEffLog);
  };

  const handleClosePreview = () => {
    if (previewFile && fileUrls[previewFile]) {
      URL.revokeObjectURL(fileUrls[previewFile]);
      setFileUrls(prev => {
        const copy = { ...prev };
        delete copy[previewFile];
        return copy;
      });
      setFileTypes(prev => {
        const copy = { ...prev };
        delete copy[previewFile];
        return copy;
      });
    }
    setPreviewFile(null);
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

  const handleExportPDF = () => {
    const recentChangesOverall = (changes || []).slice(0, 5);
    exportDashboardRequestsPDF(recentChangesOverall, {}, setToastMsg);
  };


  const handleExportSpecificTab = (tabName) => {
    if (tabName === 'Department') {
      const deptFiltered = getFilteredData(deptFilterMonth, deptFilterFromDate, deptFilterToDate, deptFilterPerson, deptFilterProcess, deptFilterMachine);
      exportDepartmentAnalyticsPDF(deptFiltered, {
        month: deptFilterMonth,
        fromDate: deptFilterFromDate,
        toDate: deptFilterToDate,
        person: deptFilterPerson,
        process: deptFilterProcess,
        machine: deptFilterMachine,
        status: 'All'
      }, setToastMsg, dbDepartments);
    } else if (tabName === 'Process') {
      const procFiltered = getFilteredData(procFilterMonth, procFilterFromDate, procFilterToDate, procFilterPerson, procFilterProcess, procFilterMachine);
      exportProcessAnalyticsPDF(procFiltered, {
        month: procFilterMonth,
        fromDate: procFilterFromDate,
        toDate: procFilterToDate,
        person: procFilterPerson,
        process: procFilterProcess,
        machine: procFilterMachine,
        status: 'All'
      }, setToastMsg, dbProcesses);
    } else if (tabName === '6M Category') {
      const catFiltered = getFilteredData(catFilterMonth, catFilterFromDate, catFilterToDate, catFilterPerson, catFilterProcess, catFilterMachine);
      exportCategoryAnalyticsPDF(catFiltered, {
        month: catFilterMonth,
        fromDate: catFilterFromDate,
        toDate: catFilterToDate,
        person: catFilterPerson,
        process: catFilterProcess,
        machine: catFilterMachine,
        status: 'All'
      }, setToastMsg);
    } else if (tabName === 'Monthly') {
      const monthFiltered = getFilteredData(monthFilterMonth, monthFilterFromDate, monthFilterToDate, monthFilterPerson, monthFilterProcess, monthFilterMachine);
      exportMonthlyAnalyticsPDF(monthFiltered, {
        month: monthFilterMonth,
        fromDate: monthFilterFromDate,
        toDate: monthFilterToDate,
        person: monthFilterPerson,
        process: monthFilterProcess,
        machine: monthFilterMachine,
        status: 'All'
      }, setToastMsg);
    } else if (tabName === 'Approval Status') {
      const apprFiltered = getFilteredData(apprFilterMonth, apprFilterFromDate, apprFilterToDate, 'All', 'All', 'All', apprFilterStatus);
      exportApprovalStatusAnalyticsPDF(apprFiltered, {
        month: apprFilterMonth,
        fromDate: apprFilterFromDate,
        toDate: apprFilterToDate,
        person: 'All',
        process: 'All',
        machine: 'All',
        status: apprFilterStatus
      }, setToastMsg);
    } else if (tabName === 'Improvement Benefits') {
      // For Improvement Benefits, apply its separate filters
      const filteredCost = costSavingRows.filter(row => {
        let matchesMonth = true;
        if (benefitFilterMonth !== 'All') {
          const parts = row.date.split('/');
          if (parts.length === 3) {
            const monthIdx = parseInt(parts[1], 10) - 1;
            const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            matchesMonth = months[monthIdx] === benefitFilterMonth;
          } else {
            matchesMonth = false;
          }
        }
        const matchesSearch = !benefitFilterSearch || row.changeNo.toLowerCase().includes(benefitFilterSearch.toLowerCase());
        return matchesMonth && matchesSearch;
      });

      const filteredProductivity = productivityRows.filter(row => {
        let matchesMonth = true;
        if (benefitFilterMonth !== 'All') {
          const parts = row.date.split('/');
          if (parts.length === 3) {
            const monthIdx = parseInt(parts[1], 10) - 1;
            const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            matchesMonth = months[monthIdx] === benefitFilterMonth;
          } else {
            matchesMonth = false;
          }
        }
        const matchesSearch = !benefitFilterSearch || row.changeNo.toLowerCase().includes(benefitFilterSearch.toLowerCase());
        return matchesMonth && matchesSearch;
      });

      const filteredQuality = qualityRows.filter(row => {
        let matchesMonth = true;
        if (benefitFilterMonth !== 'All') {
          const parts = row.date.split('/');
          if (parts.length === 3) {
            const monthIdx = parseInt(parts[1], 10) - 1;
            const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            matchesMonth = months[monthIdx] === benefitFilterMonth;
          } else {
            matchesMonth = false;
          }
        }
        const matchesSearch = !benefitFilterSearch || row.changeNo.toLowerCase().includes(benefitFilterSearch.toLowerCase());
        return matchesMonth && matchesSearch;
      });

      exportImprovementBenefitsPDF(
        filteredCost,
        filteredProductivity,
        filteredQuality,
        {
          type: benefitFilterType,
          month: benefitFilterMonth,
          search: benefitFilterSearch
        },
        setToastMsg
      );
    }
  };

  const handleExportActiveTab = () => {
    handleExportSpecificTab(activeAnalyticsTab);
  };


  // Helper filters render
  const renderFilters = ({
    monthVal, setMonthVal,
    fromDateVal, setFromDateVal,
    toDateVal, setToDateVal,
    personVal, setPersonVal,
    processVal, setProcessVal,
    machineVal, setMachineVal
  }) => (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-[8px] p-[12px] bg-slate-50/50 border-y border-slate-100 text-[10px]">
      <div className="space-y-[2px]">
        <label className="block font-bold text-slate-400 uppercase tracking-wider">By Month</label>
        <select
          className="w-full px-[6px] py-[4px] border border-slate-200 rounded-[4px] bg-white outline-none"
          value={monthVal}
          onChange={(e) => {
            const nextVal = e.target.value;
            setMonthVal(nextVal);
            if (nextVal !== 'All') {
              setFromDateVal('');
              setToDateVal('');
            }
          }}
        >
          <option value="All">All Months</option>
          {monthOptions.map(m => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
      </div>
      <div className="space-y-[2px]">
        <label className="block font-bold text-slate-400 uppercase tracking-wider">From Date</label>
        <CustomDatePicker
          value={fromDateVal}
          onChange={(val) => {
            if (val && toDateVal) {
              const [fd, fm, fy] = val.split('/');
              const [td, tm, ty] = toDateVal.split('/');
              const fDate = new Date(fy, fm - 1, fd);
              const tDate = new Date(ty, tm - 1, td);
              if (fDate > tDate) {
                setToastMsg("'From Date' cannot be later than 'To Date'.");
                return;
              }
            }
            setFromDateVal(val);
            if (val) {
              setMonthVal('All');
            }
          }}
          readOnly={true}
          inputClassName="w-full pl-[6px] pr-[24px] py-[4px] border border-slate-200 rounded-[4px] bg-white outline-none placeholder-slate-355 text-slate-500"
          buttonClassName="right-[6px] top-[50%] -translate-y-1/2"
        />
      </div>
      <div className="space-y-[2px]">
        <label className="block font-bold text-slate-400 uppercase tracking-wider">To Date</label>
        <div onClickCapture={(e) => {
          if (!fromDateVal) {
            e.stopPropagation();
            setToastMsg("Please select 'From Date' before selecting 'To Date'.");
          }
        }}>
          <CustomDatePicker
            value={toDateVal}
            onChange={(val) => {
              if (val && fromDateVal) {
                const [fd, fm, fy] = fromDateVal.split('/');
                const [td, tm, ty] = val.split('/');
                const fDate = new Date(fy, fm - 1, fd);
                const tDate = new Date(ty, tm - 1, td);
                if (tDate < fDate) {
                  setToastMsg("'To Date' cannot be earlier than 'From Date'.");
                  return;
                }
              }
              setToDateVal(val);
              if (val) {
                setMonthVal('All');
              }
            }}
            readOnly={true}
            inputClassName={`w-full pl-[6px] pr-[24px] py-[4px] border border-slate-200 rounded-[4px] bg-white outline-none placeholder-slate-355 text-slate-500 ${!fromDateVal ? 'opacity-70 cursor-not-allowed bg-slate-50' : ''}`}
            buttonClassName="right-[6px] top-[50%] -translate-y-1/2"
            disabled={!fromDateVal}
          />
        </div>
      </div>
      <div className="space-y-[2px]">
        <label className="block font-bold text-slate-400 uppercase tracking-wider">By Person</label>
        <select
          className="w-full px-[6px] py-[4px] border border-slate-200 rounded-[4px] bg-white outline-none"
          value={personVal}
          onChange={(e) => setPersonVal(e.target.value)}
        >
          {uniquePersons
            .filter(p => p.email === 'All' || (p.department || '').trim().toLowerCase() !== 'general')
            .map(p => {
              if (p.email === 'All') return <option key="All" value="All">All Persons</option>;

              const value = p.email || p.name;
              const displayName = p.name || (p.email ? p.email.split('@')[0] : 'Unknown');

              const roleLower = (p.role || '').toLowerCase();
              const isUserHOD = roleLower.includes('hod') ||
                roleLower.includes('unit head') ||
                roleLower.includes('unit_head') ||
                roleLower.includes('manager');
              const deptName = p.department || '';

              let labelSuffix = '';
              if (deptName) {
                labelSuffix = isUserHOD ? `${deptName} - HOD` : deptName;
              } else if (isUserHOD) {
                labelSuffix = 'HOD';
              }

              const label = labelSuffix ? `${displayName} (${labelSuffix})` : displayName;
              return (
                <option key={value} value={value}>
                  {label}
                </option>
              );
            })}
        </select>
      </div>
      <div className="space-y-[2px]">
        <label className="block font-bold text-slate-400 uppercase tracking-wider">By Process</label>
        <select
          className="w-full px-[6px] py-[4px] border border-slate-200 rounded-[4px] bg-white outline-none"
          value={processVal}
          onChange={(e) => setProcessVal(e.target.value)}
        >
          {uniqueProcesses.map(p => (
            <option key={p} value={p}>{p === 'All' ? 'All Processes' : p}</option>
          ))}
        </select>
      </div>
      <div className="space-y-[2px]">
        <label className="block font-bold text-slate-400 uppercase tracking-wider">By M/C No</label>
        <select
          className="w-full px-[6px] py-[4px] border border-slate-200 rounded-[4px] bg-white outline-none"
          value={machineVal}
          onChange={(e) => setMachineVal(e.target.value)}
        >
          {uniqueMachines.map(m => (
            <option key={m} value={m}>{m === 'All' ? 'All Machines' : m}</option>
          ))}
        </select>
      </div>
    </div>
  );

  const renderStatusFilters = ({
    monthVal, setMonthVal,
    fromDateVal, setFromDateVal,
    toDateVal, setToDateVal,
    statusVal, setStatusVal
  }) => (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-[8px] p-[12px] bg-slate-50/50 border-y border-slate-100 text-[10px]">
      <div className="space-y-[2px]">
        <label className="block font-bold text-slate-400 uppercase tracking-wider">By Month</label>
        <select
          className="w-full px-[6px] py-[4px] border border-slate-200 rounded-[4px] bg-white outline-none"
          value={monthVal}
          onChange={(e) => {
            const nextVal = e.target.value;
            setMonthVal(nextVal);
            if (nextVal !== 'All') {
              setFromDateVal('');
              setToDateVal('');
            }
          }}
        >
          <option value="All">All Months</option>
          {monthOptions.map(m => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
      </div>
      <div className="space-y-[2px]">
        <label className="block font-bold text-slate-400 uppercase tracking-wider">From Date</label>
        <CustomDatePicker
          value={fromDateVal}
          onChange={(val) => {
            if (val && toDateVal) {
              const [fd, fm, fy] = val.split('/');
              const [td, tm, ty] = toDateVal.split('/');
              const fDate = new Date(fy, fm - 1, fd);
              const tDate = new Date(ty, tm - 1, td);
              if (fDate > tDate) {
                setToastMsg("'From Date' cannot be later than 'To Date'.");
                return;
              }
            }
            setFromDateVal(val);
            if (val) {
              setMonthVal('All');
            }
          }}
          readOnly={true}
          inputClassName="w-full pl-[6px] pr-[24px] py-[4px] border border-slate-200 rounded-[4px] bg-white outline-none placeholder-slate-355 text-slate-500"
          buttonClassName="right-[6px] top-[50%] -translate-y-1/2"
        />
      </div>
      <div className="space-y-[2px]">
        <label className="block font-bold text-slate-400 uppercase tracking-wider">To Date</label>
        <div onClickCapture={(e) => {
          if (!fromDateVal) {
            e.stopPropagation();
            setToastMsg("Please select 'From Date' before selecting 'To Date'.");
          }
        }}>
          <CustomDatePicker
            value={toDateVal}
            onChange={(val) => {
              if (val && fromDateVal) {
                const [fd, fm, fy] = fromDateVal.split('/');
                const [td, tm, ty] = val.split('/');
                const fDate = new Date(fy, fm - 1, fd);
                const tDate = new Date(ty, tm - 1, td);
                if (tDate < fDate) {
                  setToastMsg("'To Date' cannot be earlier than 'From Date'.");
                  return;
                }
              }
              setToDateVal(val);
              if (val) {
                setMonthVal('All');
              }
            }}
            readOnly={true}
            inputClassName={`w-full pl-[6px] pr-[24px] py-[4px] border border-slate-200 rounded-[4px] bg-white outline-none placeholder-slate-355 text-slate-500 ${!fromDateVal ? 'opacity-70 cursor-not-allowed bg-slate-50' : ''}`}
            buttonClassName="right-[6px] top-[50%] -translate-y-1/2"
            disabled={!fromDateVal}
          />
        </div>
      </div>
      <div className="space-y-[2px]">
        <label className="block font-bold text-slate-400 uppercase tracking-wider">By Status</label>
        <select
          className={`w-full px-[6px] py-[4px] border rounded-[4px] outline-none transition-all duration-200 ${statusVal === 'Approved' || statusVal === 'L3 Approved' ? 'text-emerald-600 border-emerald-355 bg-emerald-50/10 font-bold' :
            statusVal === 'Rejected' ? 'text-rose-600 border-rose-350 bg-rose-50/10 font-bold' :
              statusVal === 'Closed' ? 'text-blue-600 border-blue-350 bg-blue-50/10 font-bold' :
                statusVal === 'Pending' ? 'text-amber-600 border-amber-350 bg-amber-50/10 font-bold' :
                  'text-slate-500 border-slate-200 bg-white font-medium'
            }`}
          value={statusVal}
          onChange={(e) => setStatusVal(e.target.value)}
        >
          <option value="All" className="text-slate-500 bg-white font-medium" style={{ color: '#64748b' }}>All Statuses</option>
          <option value="L3 Approved" className="text-emerald-600 bg-white font-bold" style={{ color: '#059669', fontWeight: 'bold' }}>L3 Approved</option>
          <option value="Rejected" className="text-rose-600 bg-white font-bold" style={{ color: '#e11d48', fontWeight: 'bold' }}>Rejected</option>
          <option value="Closed" className="text-blue-600 bg-white font-bold" style={{ color: '#2563eb', fontWeight: 'bold' }}>Closed</option>
          <option value="Pending" className="text-amber-600 bg-white font-bold" style={{ color: '#d97706', fontWeight: 'bold' }}>Pending</option>
        </select>
      </div>
    </div>
  );

  const renderFiltersForTab = (tabName) => {
    if (tabName === 'Department') {
      return renderFilters({
        monthVal: deptFilterMonth, setMonthVal: setDeptFilterMonth,
        fromDateVal: deptFilterFromDate, setFromDateVal: setDeptFilterFromDate,
        toDateVal: deptFilterToDate, setToDateVal: setDeptFilterToDate,
        personVal: deptFilterPerson, setPersonVal: setDeptFilterPerson,
        processVal: deptFilterProcess, setProcessVal: setDeptFilterProcess,
        machineVal: deptFilterMachine, setMachineVal: setDeptFilterMachine
      });
    }
    if (tabName === 'Process') {
      return renderFilters({
        monthVal: procFilterMonth, setMonthVal: setProcFilterMonth,
        fromDateVal: procFilterFromDate, setFromDateVal: setProcFilterFromDate,
        toDateVal: procFilterToDate, setToDateVal: setProcFilterToDate,
        personVal: procFilterPerson, setPersonVal: setProcFilterPerson,
        processVal: procFilterProcess, setProcessVal: setProcFilterProcess,
        machineVal: procFilterMachine, setMachineVal: setProcFilterMachine
      });
    }
    if (tabName === '6M Category') {
      return renderFilters({
        monthVal: catFilterMonth, setMonthVal: setCatFilterMonth,
        fromDateVal: catFilterFromDate, setFromDateVal: setCatFilterFromDate,
        toDateVal: catFilterToDate, setToDateVal: setCatFilterToDate,
        personVal: catFilterPerson, setPersonVal: setCatFilterPerson,
        processVal: catFilterProcess, setProcessVal: setCatFilterProcess,
        machineVal: catFilterMachine, setMachineVal: setCatFilterMachine
      });
    }
    if (tabName === 'Monthly') {
      return renderFilters({
        monthVal: monthFilterMonth, setMonthVal: setMonthFilterMonth,
        fromDateVal: monthFilterFromDate, setFromDateVal: setMonthFilterFromDate,
        toDateVal: monthFilterToDate, setToDateVal: setMonthFilterToDate,
        personVal: monthFilterPerson, setPersonVal: setMonthFilterPerson,
        processVal: monthFilterProcess, setProcessVal: setMonthFilterProcess,
        machineVal: monthFilterMachine, setMachineVal: setMonthFilterMachine
      });
    }
    if (tabName === 'Approval Status') {
      return renderStatusFilters({
        monthVal: apprFilterMonth, setMonthVal: setApprFilterMonth,
        fromDateVal: apprFilterFromDate, setFromDateVal: setApprFilterFromDate,
        toDateVal: apprFilterToDate, setToDateVal: setApprFilterToDate,
        statusVal: apprFilterStatus, setStatusVal: setApprFilterStatus
      });
    }
    return null;
  };

  // Reusable Chart Renderers
  const renderDepartmentChart = (dataList, height = 'h-[160px]') => {
    const departmentNames = dbDepartments && dbDepartments.length > 0
      ? dbDepartments
      : ['PED', 'QAD', 'PRODUCTION', 'MAINTENANCE', 'PC & L', 'MATERIALS', 'MARKETING', 'HR', 'SAFETY'];

    const counts = {};
    departmentNames.forEach(d => {
      counts[d] = 0;
    });

    dataList.forEach(c => {
      const rawDept = (c.dept || c.department || '').trim().toUpperCase();
      if (!rawDept) return;

      const matchedDept = departmentNames.find(d => d.toUpperCase() === rawDept);
      if (matchedDept) {
        counts[matchedDept]++;
      } else {
        let mapped = null;
        if (rawDept.includes('PED')) mapped = 'PED';
        else if (rawDept.includes('QA') || rawDept.includes('QUALITY')) mapped = 'QAD';
        else if (rawDept.includes('PROD')) mapped = 'PRODUCTION';
        else if (rawDept.includes('MAINT')) mapped = 'MAINTENANCE';
        else if (rawDept.includes('PC')) mapped = 'PC & L';
        else if (rawDept.includes('MATER')) mapped = 'MATERIALS';
        else if (rawDept.includes('MARKET')) mapped = 'MARKETING';
        else if (rawDept.includes('HR')) mapped = 'HR';
        else if (rawDept.includes('SAFE')) mapped = 'SAFETY';

        if (mapped) {
          const dbMapped = departmentNames.find(d => d.toUpperCase().includes(mapped.toUpperCase()) || mapped.toUpperCase().includes(d.toUpperCase()));
          if (dbMapped) {
            counts[dbMapped]++;
            return;
          }
        }

        const substringMatch = departmentNames.find(d =>
          rawDept.includes(d.toUpperCase()) || d.toUpperCase().includes(rawDept)
        );
        if (substringMatch) {
          counts[substringMatch]++;
        }
      }
    });

    const data = Object.keys(counts)
      .filter(key => key.trim().toUpperCase() !== 'GENERAL')
      .map(key => ({
        label: key,
        value: counts[key]
      }));

    const maxVal = Math.max(...data.map(item => item.value), 5);

    const getLabelElements = (label) => {
      const upper = label.trim().toUpperCase();
      let short = label;
      let full = label;

      if (upper === 'PRODUCTION') {
        short = 'PROD';
        full = 'PRODUCTION';
      } else if (upper === 'MAINTENANCE') {
        short = 'MAINT';
        full = 'MAINTENANCE';
      } else if (upper === 'MATERIALS') {
        short = 'MAT';
        full = 'MATERIALS';
      } else if (upper === 'MARKETING') {
        short = 'MKTG';
        full = 'MARKETING';
      } else if (upper === 'SAFETY') {
        short = 'SAFE';
        full = 'SAFETY';
      } else if (upper === 'GENERAL') {
        short = 'GEN';
        full = 'GENERAL';
      } else if (upper === 'QUALITY ASSURANCE' || upper === 'QAD') {
        short = 'QAD';
        full = 'QAD';
      } else if (upper === 'UNIT HEAD') {
        short = 'UNIT HD';
        full = 'UNIT HEAD';
      } else if (upper === 'PURCHASE & MATERIALS') {
        short = 'PURCH/MAT';
        full = 'PURCHASE & MATERIALS';
      } else if (upper === 'PC & L' || upper === 'PC&L') {
        short = 'PC&L';
        full = 'PC & L';
      } else if (label.length > 8) {
        if (label.includes('&')) {
          short = label.split('&').map(part => part.trim().substring(0, 4)).join('&');
        } else {
          short = label.substring(0, 6) + '.';
        }
      }

      return { short, full };
    };

    return (
      <div className="w-full overflow-x-auto pb-[8px] scrollbar-thin">
        <div className={`flex justify-around items-end ${height} px-[10px] mt-[10px] min-w-[550px] lg:min-w-0`}>
          {data.map((item, idx) => {
            const barHeight = (item.value / maxVal) * 100;
            const { short, full } = getLabelElements(item.label);
            return (
              <div key={idx} className="flex flex-col items-center min-w-[35px] max-w-[65px] w-full h-full justify-end group">
                <span className="text-[10px] font-bold text-slate-600 mb-[4px]">{item.value}</span>
                <div className="w-full h-[65%] flex items-end justify-center">
                  <div
                    className="w-full bg-[#1e60aa] hover:bg-[#1a5292] transition-all rounded-t-[2px]"
                    style={{ height: `${barHeight}%`, minHeight: '4px' }}
                  />
                </div>
                <span
                  className="text-[8px] font-bold text-slate-400 mt-[6px] whitespace-nowrap uppercase tracking-wider text-center font-sans cursor-help"
                  title={item.label}
                >
                  <span className="hidden lg:inline">{full}</span>
                  <span className="inline lg:hidden">{short}</span>
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderProcessChart = (dataList, height = 'h-[160px]') => {
    const processNames = dbProcesses || [];

    const counts = {};
    processNames.forEach(p => {
      counts[p] = 0;
    });

    dataList.forEach(c => {
      if (!c.processName) return;
      const pNameNormalized = c.processName.trim().toLowerCase();
      const matchedProcess = processNames.find(p => p.toLowerCase() === pNameNormalized);
      if (matchedProcess) {
        counts[matchedProcess]++;
      } else {
        const substringMatch = processNames.find(p => pNameNormalized.includes(p.toLowerCase()) || p.toLowerCase().includes(pNameNormalized));
        if (substringMatch) {
          counts[substringMatch]++;
        }
      }
    });

    const data = Object.keys(counts).map(key => ({
      label: key,
      value: counts[key]
    }));

    const maxVal = Math.max(...data.map(item => item.value), 5);

    return (
      <div className={`flex justify-around items-end ${height} px-[10px] mt-[10px]`}>
        {data.map((item, idx) => {
          const barHeight = (item.value / maxVal) * 100;
          return (
            <div key={idx} className="flex flex-col items-center min-w-[50px] max-w-[80px] w-full h-full justify-end group">
              <span className="text-[10px] font-bold text-slate-600 mb-[4px]">{item.value}</span>
              <div className="w-full h-[65%] flex items-end justify-center">
                <div
                  className="w-full bg-[#2e7d32] hover:bg-[#1b5e20] transition-all rounded-t-[2px]"
                  style={{ height: `${barHeight}%`, minHeight: '4px' }}
                />
              </div>
              <span className="text-[8px] font-bold text-slate-400 mt-[6px] whitespace-nowrap uppercase tracking-wider text-center">
                {item.label}
              </span>
            </div>
          );
        })}
      </div>
    );
  };

  const renderCategoryChart = (dataList, height = 'h-[160px]') => {
    const counts = {
      'Man': 0,
      'Mac': 0,
      'Met': 0,
      'Mat': 0,
      'Mea': 0,
      'Mot': 0
    };

    dataList.forEach(c => {
      const catStr = (c.changeIn || c.title || c.id || '').trim().toLowerCase();
      let matchedAny = false;
      if (catStr.includes('man') || catStr.includes('train')) { counts['Man']++; matchedAny = true; }
      if (catStr.includes('mac') || catStr.includes('machin') || catStr.includes('weld')) { counts['Mac']++; matchedAny = true; }
      if (catStr.includes('met') || catStr.includes('calib') || catStr.includes('sso') || catStr.includes('db') || catStr.includes('api') || catStr.includes('vulner')) { counts['Met']++; matchedAny = true; }
      if (catStr.includes('mat') || catStr.includes('spec') || catStr.includes('cool')) { counts['Mat']++; matchedAny = true; }
      if (catStr.includes('mea') || catStr.includes('gauge') || catStr.includes('check') || catStr.includes('repeat')) { counts['Mea']++; matchedAny = true; }
      if (catStr.includes('mot') || catStr.includes('nature') || catStr.includes('env')) { counts['Mot']++; matchedAny = true; }
      if (!matchedAny) counts['Met']++; // fallback
    });

    const colors = {
      'Man': '#1e60aa',
      'Mac': '#673ab7',
      'Met': '#795548',
      'Mat': '#009688',
      'Mea': '#8bc34a',
      'Mot': '#d32f2f'
    };

    const data = Object.keys(counts).map(key => ({
      label: key,
      value: counts[key],
      color: colors[key]
    }));

    const maxVal = Math.max(...data.map(item => item.value), 5);

    return (
      <div className={`flex justify-between items-end ${height} px-[10px] mt-[10px]`}>
        {data.map((item, idx) => {
          const barHeight = (item.value / maxVal) * 100;
          return (
            <div key={idx} className="flex flex-col items-center w-[12%] h-full justify-end group">
              <span className="text-[10px] font-bold text-slate-600 mb-[4px]">{item.value}</span>
              <div className="w-full h-[65%] flex items-end justify-center">
                <div
                  className="w-full transition-all rounded-t-[2px]"
                  style={{ height: `${barHeight}%`, minHeight: '4px', backgroundColor: item.color }}
                />
              </div>
              <span className="text-[8px] font-bold text-slate-400 mt-[6px] whitespace-nowrap uppercase tracking-wider text-center">
                {item.label}
              </span>
            </div>
          );
        })}
      </div>
    );
  };

  const renderMonthlyChart = (dataList, height = 'h-[160px]') => {
    const hasDateFilter = !!(monthFilterFromDate || monthFilterToDate);
    const hasMonthFilter = monthFilterMonth !== 'All';
    let datesToShow = [];

    if (hasDateFilter) {
      let startDate = null;
      let endDate = null;

      if (monthFilterFromDate) {
        startDate = parseDDMMYYYYToDate(monthFilterFromDate);
      }
      if (monthFilterToDate) {
        endDate = parseDDMMYYYYToDate(monthFilterToDate);
      }

      // Fallback: if one date is empty, find min/max from actual data
      if (dataList.length > 0) {
        const parsedDates = dataList
          .map(c => parseDDMMYYYYToDate(c.rawDate || c.date))
          .filter(Boolean);
        if (parsedDates.length > 0) {
          if (!startDate) {
            startDate = new Date(Math.min(...parsedDates.map(d => d.getTime())));
          }
          if (!endDate) {
            endDate = new Date(Math.max(...parsedDates.map(d => d.getTime())));
          }
        }
      }

      if (startDate && endDate) {
        const sD = new Date(startDate);
        sD.setHours(0, 0, 0, 0);
        const eD = new Date(endDate);
        eD.setHours(0, 0, 0, 0);

        const msDiff = eD.getTime() - sD.getTime();
        const daysDiff = Math.ceil(msDiff / (1000 * 60 * 60 * 24)) + 1;

        if (daysDiff > 0 && daysDiff <= 31) {
          // Generate day-by-day dates
          for (let i = 0; i < daysDiff; i++) {
            const nextDate = new Date(sD);
            nextDate.setDate(sD.getDate() + i);
            const label = nextDate.toLocaleDateString('en-US', { day: '2-digit', month: 'short' });
            datesToShow.push({ label, dateStr: formatDateToDDMMYY(nextDate) });
          }
        } else {
          // Range is wider than 31 days. Group by Month!
          const startYear = sD.getFullYear();
          const startMonth = sD.getMonth();
          const endYear = eD.getFullYear();
          const endMonth = eD.getMonth();

          let curYear = startYear;
          let curMonth = startMonth;

          while (curYear < endYear || (curYear === endYear && curMonth <= endMonth)) {
            const dateObj = new Date(curYear, curMonth, 1);
            const label = dateObj.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
            datesToShow.push({ label, year: curYear, month: curMonth });

            curMonth++;
            if (curMonth > 11) {
              curMonth = 0;
              curYear++;
            }
          }
        }
      }
    } else if (hasMonthFilter) {
      const monthsList = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const monthIdx = monthsList.indexOf(monthFilterMonth);
      if (monthIdx !== -1) {
        const currentYear = getSyncedDate().getFullYear();
        const daysInMonth = new Date(currentYear, monthIdx + 1, 0).getDate();
        for (let i = 1; i <= daysInMonth; i++) {
          const dateObj = new Date(currentYear, monthIdx, i);
          const label = dateObj.toLocaleDateString('en-US', { day: '2-digit', month: 'short' });
          datesToShow.push({ label, dateStr: formatDateToDDMMYY(dateObj) });
        }
      }
    }

    if (datesToShow.length === 0) {
      // Default: 12 months view
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const counts = Array(12).fill(0);

      dataList.forEach(c => {
        const dVal = c.rawDate || c.date;
        if (!dVal) return;
        try {
          const d = parseDDMMYYYYToDate(dVal);
          if (d && !isNaN(d.getTime())) {
            const monthIdx = d.getMonth();
            counts[monthIdx]++;
          }
        } catch {
          // ignore
        }
      });

      const data = months.map((m, idx) => ({
        label: m,
        value: counts[idx]
      }));

      const maxVal = Math.max(...data.map(item => item.value), 5);

      return (
        <div className={`flex justify-between items-end ${height} px-[5px] mt-[10px]`}>
          {data.map((item, idx) => {
            const barHeight = (item.value / maxVal) * 100;
            return (
              <div key={idx} className="flex flex-col items-center w-[7%] h-full justify-end group">
                <span className="text-[10px] font-bold text-slate-600 mb-[4px]">{item.value}</span>
                <div className="w-full h-[65%] flex items-end justify-center">
                  <div
                    className="w-full bg-[#1e60aa] hover:bg-[#1a5292] transition-all rounded-t-[2px]"
                    style={{ height: `${barHeight}%`, minHeight: '4px' }}
                  />
                </div>
                <span className="text-[8px] font-bold text-slate-400 mt-[6px] whitespace-nowrap uppercase tracking-wider text-center">
                  {item.label}
                </span>
              </div>
            );
          })}
        </div>
      );
    } else {
      // Custom Date Range / Selected Month (Date-wise counts)
      const dataMap = datesToShow.map(dInfo => ({
        label: dInfo.label,
        value: 0
      }));

      dataList.forEach(c => {
        const dVal = c.rawDate || c.date;
        if (!dVal) return;
        const d = parseDDMMYYYYToDate(dVal);
        if (!d) return;

        const idx = datesToShow.findIndex(dInfo => {
          if (dInfo.dateStr) {
            return dInfo.dateStr === formatDateToDDMMYY(dVal);
          } else {
            return d.getFullYear() === dInfo.year && d.getMonth() === dInfo.month;
          }
        });

        if (idx !== -1) {
          dataMap[idx].value++;
        }
      });

      const maxVal = Math.max(...dataMap.map(item => item.value), 5);

      const barWidthClass = datesToShow.length <= 10
        ? 'w-[8%]'
        : datesToShow.length <= 20
          ? 'w-[4%]'
          : 'w-[2.5%]';

      return (
        <div className={`flex justify-between items-end ${height} px-[10px] mt-[10px] overflow-x-auto overflow-y-hidden gap-2`}>
          {dataMap.map((item, idx) => {
            const barHeight = (item.value / maxVal) * 100;
            return (
              <div
                key={idx}
                className={`flex flex-col items-center h-full justify-end group min-w-[36px] ${barWidthClass}`}
              >
                <span className="text-[10px] font-bold text-slate-600 mb-[4px]">{item.value}</span>
                <div className="w-full h-[65%] flex items-end justify-center">
                  <div
                    className="w-full bg-[#1e60aa] hover:bg-[#1a5292] transition-all rounded-t-[2px]"
                    style={{ height: `${barHeight}%`, minHeight: item.value > 0 ? '2px' : '0px' }}
                  />
                </div>
                <span className="text-[8px] font-bold text-slate-500 mt-[6px] whitespace-nowrap uppercase tracking-wider text-center rotate-45 sm:rotate-0 translate-y-0.5">
                  {item.label}
                </span>
              </div>
            );
          })}
        </div>
      );
    }
  };

  const renderApprovalStatusChart = (dataList, height = 'h-[180px]') => {
    // Check if user has selected a custom date range filter or a specific month filter
    const hasDateFilter = !!(apprFilterFromDate || apprFilterToDate);
    const hasMonthFilter = apprFilterMonth !== 'All';
    let datesToShow = []; // array of { label: string, dateStr: string } (dateStr is DD/MM/YY)

    if (hasDateFilter) {
      let startDate = null;
      let endDate = null;

      if (apprFilterFromDate) {
        startDate = parseDDMMYYYYToDate(apprFilterFromDate);
      }
      if (apprFilterToDate) {
        endDate = parseDDMMYYYYToDate(apprFilterToDate);
      }

      // Fallback: if one date is empty, find min/max from actual data
      if (dataList.length > 0) {
        const parsedDates = dataList
          .map(c => parseDDMMYYYYToDate(c.rawDate || c.date))
          .filter(Boolean);
        if (parsedDates.length > 0) {
          if (!startDate) {
            startDate = new Date(Math.min(...parsedDates.map(d => d.getTime())));
          }
          if (!endDate) {
            endDate = new Date(Math.max(...parsedDates.map(d => d.getTime())));
          }
        }
      }

      if (startDate && endDate) {
        // Normalize times to midnight for comparison
        const sD = new Date(startDate);
        sD.setHours(0, 0, 0, 0);
        const eD = new Date(endDate);
        eD.setHours(0, 0, 0, 0);

        const msDiff = eD.getTime() - sD.getTime();
        const daysDiff = Math.ceil(msDiff / (1000 * 60 * 60 * 24)) + 1;

        if (daysDiff > 0 && daysDiff <= 31) {
          // Generate day-by-day dates
          for (let i = 0; i < daysDiff; i++) {
            const nextDate = new Date(sD);
            nextDate.setDate(sD.getDate() + i);
            const label = nextDate.toLocaleDateString('en-US', { day: '2-digit', month: 'short' });
            datesToShow.push({ label, dateStr: formatDateToDDMMYY(nextDate) });
          }
        } else {
          // Range is wider than 31 days. Group by Month!
          const startYear = sD.getFullYear();
          const startMonth = sD.getMonth();
          const endYear = eD.getFullYear();
          const endMonth = eD.getMonth();

          let curYear = startYear;
          let curMonth = startMonth;

          while (curYear < endYear || (curYear === endYear && curMonth <= endMonth)) {
            const dateObj = new Date(curYear, curMonth, 1);
            const label = dateObj.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
            datesToShow.push({ label, year: curYear, month: curMonth });

            curMonth++;
            if (curMonth > 11) {
              curMonth = 0;
              curYear++;
            }
          }
        }
      }
    } else if (hasMonthFilter) {
      const monthsList = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const monthIdx = monthsList.indexOf(apprFilterMonth);
      if (monthIdx !== -1) {
        const currentYear = getSyncedDate().getFullYear();
        const daysInMonth = new Date(currentYear, monthIdx + 1, 0).getDate();
        for (let i = 1; i <= daysInMonth; i++) {
          const dateObj = new Date(currentYear, monthIdx, i);
          const label = dateObj.toLocaleDateString('en-US', { day: '2-digit', month: 'short' });
          datesToShow.push({ label, dateStr: formatDateToDDMMYY(dateObj) });
        }
      }
    }

    // If no date range filter or we couldn't resolve dates, default to 12 months view
    if (datesToShow.length === 0) {
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const dataMap = months.map(m => ({ label: m, appr: 0, closed: 0, rej: 0, pend: 0 }));

      dataList.forEach(c => {
        const dVal = c.rawDate || c.date;
        if (!dVal) return;
        try {
          const d = parseDDMMYYYYToDate(dVal);
          if (d && !isNaN(d.getTime())) {
            const monthIdx = d.getMonth();
            const dispStatus = getRequestDisplayStatus(c);
            if (dispStatus === 'Approved' || dispStatus === 'L3 Approved') {
              dataMap[monthIdx].appr++;
            } else if (dispStatus === 'Closed') {
              dataMap[monthIdx].closed++;
            } else if (dispStatus === 'Rejected') {
              dataMap[monthIdx].rej++;
            } else {
              dataMap[monthIdx].pend++;
            }
          }
        } catch {
          // ignore
        }
      });

      const maxVal = Math.max(
        ...dataMap.map(item => Math.max(item.appr, item.closed, item.rej, item.pend)),
        5
      );

      return (
        <div className={`flex justify-between items-end ${height} px-[10px] mt-[10px]`}>
          {dataMap.map((item, idx) => {
            const hAppr = (item.appr / maxVal) * 100;
            const hClosed = (item.closed / maxVal) * 100;
            const hRej = (item.rej / maxVal) * 100;
            const hPend = (item.pend / maxVal) * 100;

            return (
              <div key={idx} className="flex flex-col items-center w-[7%] h-full justify-end group">
                <div className="flex items-end justify-center gap-[2px] w-full h-[85%]">
                  {/* Approved */}
                  <div className="flex flex-col items-center justify-end w-[22%] h-full">
                    {item.appr > 0 && (
                      <span className="text-[#059669] text-[8px] font-bold mb-[2px]">
                        {item.appr}
                      </span>
                    )}
                    <div
                      className="w-full bg-[#059669] rounded-t-[1px]"
                      style={{ height: `${hAppr}%`, minHeight: item.appr > 0 ? '2px' : '0px' }}
                    />
                  </div>

                  {/* Closed */}
                  <div className="flex flex-col items-center justify-end w-[22%] h-full">
                    {item.closed > 0 && (
                      <span className="text-[#2563eb] text-[8px] font-bold mb-[2px]">
                        {item.closed}
                      </span>
                    )}
                    <div
                      className="w-full bg-[#2563eb] rounded-t-[1px]"
                      style={{ height: `${hClosed}%`, minHeight: item.closed > 0 ? '2px' : '0px' }}
                    />
                  </div>

                  {/* Rejected */}
                  <div className="flex flex-col items-center justify-end w-[22%] h-full">
                    {item.rej > 0 && (
                      <span className="text-[#dc2626] text-[8px] font-bold mb-[2px]">
                        {item.rej}
                      </span>
                    )}
                    <div
                      className="w-full bg-[#dc2626] rounded-t-[1px]"
                      style={{ height: `${hRej}%`, minHeight: item.rej > 0 ? '2px' : '0px' }}
                    />
                  </div>

                  {/* Pending */}
                  <div className="flex flex-col items-center justify-end w-[22%] h-full">
                    {item.pend > 0 && (
                      <span className="text-[#d97706] text-[8px] font-bold mb-[2px]">
                        {item.pend}
                      </span>
                    )}
                    <div
                      className="w-full bg-[#d97706] rounded-t-[1px]"
                      style={{ height: `${hPend}%`, minHeight: item.pend > 0 ? '2px' : '0px' }}
                    />
                  </div>
                </div>

                <span className="text-[9px] font-bold text-slate-400 mt-[6px] uppercase tracking-wider">
                  {item.label}
                </span>
              </div>
            );
          })}
        </div>
      );
    } else {
      // Custom Date Range (Date-wise chart representation)
      const dataMap = datesToShow.map(dInfo => ({
        label: dInfo.label,
        appr: 0,
        closed: 0,
        rej: 0,
        pend: 0
      }));

      dataList.forEach(c => {
        const dVal = c.rawDate || c.date;
        if (!dVal) return;
        const d = parseDDMMYYYYToDate(dVal);
        if (!d) return;

        const idx = datesToShow.findIndex(dInfo => {
          if (dInfo.dateStr) {
            return dInfo.dateStr === formatDateToDDMMYY(dVal);
          } else {
            return d.getFullYear() === dInfo.year && d.getMonth() === dInfo.month;
          }
        });

        if (idx !== -1) {
          const dispStatus = getRequestDisplayStatus(c);
          if (dispStatus === 'Approved' || dispStatus === 'L3 Approved') {
            dataMap[idx].appr++;
          } else if (dispStatus === 'Closed') {
            dataMap[idx].closed++;
          } else if (dispStatus === 'Rejected') {
            dataMap[idx].rej++;
          } else {
            dataMap[idx].pend++;
          }
        }
      });

      const maxVal = Math.max(
        ...dataMap.map(item => Math.max(item.appr, item.closed, item.rej, item.pend)),
        5
      );

      // Dynamically calculate width of bar groups depending on count to prevent squeeze/overflow
      const barWidthClass = datesToShow.length <= 10
        ? 'w-[8%]'
        : datesToShow.length <= 20
          ? 'w-[4%]'
          : 'w-[2.5%]';

      return (
        <div className={`flex justify-between items-end ${height} px-[10px] mt-[10px] overflow-x-auto overflow-y-hidden gap-2`}>
          {dataMap.map((item, idx) => {
            const hAppr = (item.appr / maxVal) * 100;
            const hClosed = (item.closed / maxVal) * 100;
            const hRej = (item.rej / maxVal) * 100;
            const hPend = (item.pend / maxVal) * 100;

            return (
              <div
                key={idx}
                className={`flex flex-col items-center h-full justify-end group min-w-[36px] ${barWidthClass}`}
              >
                <div className="flex items-end justify-center gap-[2px] w-full h-[85%]">
                  {/* Approved */}
                  <div className="flex flex-col items-center justify-end w-[22%] h-full">
                    {item.appr > 0 && (
                      <span className="text-[#059669] text-[8px] font-bold mb-[2px]">
                        {item.appr}
                      </span>
                    )}
                    <div
                      className="w-full bg-[#059669] rounded-t-[1px]"
                      style={{ height: `${hAppr}%`, minHeight: item.appr > 0 ? '2px' : '0px' }}
                    />
                  </div>

                  {/* Closed */}
                  <div className="flex flex-col items-center justify-end w-[22%] h-full">
                    {item.closed > 0 && (
                      <span className="text-[#2563eb] text-[8px] font-bold mb-[2px]">
                        {item.closed}
                      </span>
                    )}
                    <div
                      className="w-full bg-[#2563eb] rounded-t-[1px]"
                      style={{ height: `${hClosed}%`, minHeight: item.closed > 0 ? '2px' : '0px' }}
                    />
                  </div>

                  {/* Rejected */}
                  <div className="flex flex-col items-center justify-end w-[22%] h-full">
                    {item.rej > 0 && (
                      <span className="text-[#dc2626] text-[8px] font-bold mb-[2px]">
                        {item.rej}
                      </span>
                    )}
                    <div
                      className="w-full bg-[#dc2626] rounded-t-[1px]"
                      style={{ height: `${hRej}%`, minHeight: item.rej > 0 ? '2px' : '0px' }}
                    />
                  </div>

                  {/* Pending */}
                  <div className="flex flex-col items-center justify-end w-[22%] h-full">
                    {item.pend > 0 && (
                      <span className="text-[#d97706] text-[8px] font-bold mb-[2px]">
                        {item.pend}
                      </span>
                    )}
                    <div
                      className="w-full bg-[#d97706] rounded-t-[1px]"
                      style={{ height: `${hPend}%`, minHeight: item.pend > 0 ? '2px' : '0px' }}
                    />
                  </div>
                </div>

                <span className="text-[8px] font-bold text-slate-500 mt-[6px] whitespace-nowrap uppercase tracking-wider text-center rotate-45 sm:rotate-0 translate-y-0.5">
                  {item.label}
                </span>
              </div>
            );
          })}
        </div>
      );
    }
  };

  const isDateRangeIncomplete = (fromDate, toDate) => {
    return (fromDate && !toDate) || (!fromDate && toDate);
  };

  const renderDateRangePlaceholder = () => (
    <div className="text-center py-12 text-slate-400 font-medium text-[12px] bg-slate-50/50 border border-dashed border-slate-200 rounded-xl w-full">
      Please select both From Date and To Date to view date range analytics.
    </div>
  );

  const renderImprovementBenefits = () => {
    // 1. Apply separate filters
    const filteredCost = costSavingRows.filter(row => {
      let matchesMonth = true;
      if (benefitFilterMonth !== 'All') {
        const parts = row.date.split('/');
        if (parts.length === 3) {
          const monthIdx = parseInt(parts[1], 10) - 1;
          const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
          matchesMonth = months[monthIdx] === benefitFilterMonth;
        } else {
          matchesMonth = false;
        }
      }
      const matchesSearch = !benefitFilterSearch || row.changeNo.toLowerCase().includes(benefitFilterSearch.toLowerCase());
      return matchesMonth && matchesSearch;
    });

    const filteredProductivity = productivityRows.filter(row => {
      let matchesMonth = true;
      if (benefitFilterMonth !== 'All') {
        const parts = row.date.split('/');
        if (parts.length === 3) {
          const monthIdx = parseInt(parts[1], 10) - 1;
          const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
          matchesMonth = months[monthIdx] === benefitFilterMonth;
        } else {
          matchesMonth = false;
        }
      }
      const matchesSearch = !benefitFilterSearch || row.changeNo.toLowerCase().includes(benefitFilterSearch.toLowerCase());
      return matchesMonth && matchesSearch;
    });

    const filteredQuality = qualityRows.filter(row => {
      let matchesMonth = true;
      if (benefitFilterMonth !== 'All') {
        const parts = row.date.split('/');
        if (parts.length === 3) {
          const monthIdx = parseInt(parts[1], 10) - 1;
          const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
          matchesMonth = months[monthIdx] === benefitFilterMonth;
        } else {
          matchesMonth = false;
        }
      }
      const matchesSearch = !benefitFilterSearch || row.changeNo.toLowerCase().includes(benefitFilterSearch.toLowerCase());
      return matchesMonth && matchesSearch;
    });

    // Max values for chart scaling
    const maxCostVal = Math.max(...filteredCost.map(r => parseFloat(r.monthlySave) || 0), 1000);
    const maxAnnualVal = Math.max(...filteredCost.map(r => parseFloat(r.annualSave) || 0), 12000);
    const maxRoiVal = Math.max(...filteredCost.map(r => parseFloat(r.roi) || 0), 1000);
    const maxProdVal = Math.max(...filteredProductivity.flatMap(r => [parseFloat(r.currentProd) || 0, parseFloat(r.improvedProd) || 0]), 10);
    const maxQualityVal = Math.max(...filteredQuality.flatMap(r => [parseFloat(r.currentPpm) || 0, parseFloat(r.reducedPpm) || 0]), 100);

    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    const showCost = benefitFilterType === 'All' || benefitFilterType === 'Cost';
    const showProductivity = benefitFilterType === 'All' || benefitFilterType === 'Productivity';
    const showQuality = benefitFilterType === 'All' || benefitFilterType === 'Quality';

    return (
      <div className="space-y-[24px]">
        {/* SEPARATE FILTER BAR */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-[12px] p-[16px] bg-slate-50 border border-slate-200 rounded-xl text-[11px] shadow-sm">
          <div className="space-y-[4px]">
            <label className="block font-bold text-slate-500 uppercase tracking-wider">Improvement Type</label>
            <select
              className="w-full px-[8px] py-[6px] border border-slate-200 rounded-[6px] bg-white text-slate-700 font-semibold outline-none focus:border-[#0066cc] focus:ring-1 focus:ring-[#0066cc]/20 transition-all"
              value={benefitFilterType}
              onChange={(e) => setBenefitFilterType(e.target.value)}
            >
              <option value="All">All Benefits</option>
              <option value="Cost">Cost Saving</option>
              <option value="Productivity">Productivity Improvement</option>
              <option value="Quality">Quality Improvement</option>
            </select>
          </div>

          <div className="space-y-[4px]">
            <label className="block font-bold text-slate-500 uppercase tracking-wider">Month</label>
            <select
              className="w-full px-[8px] py-[6px] border border-slate-200 rounded-[6px] bg-white text-slate-700 font-semibold outline-none focus:border-[#0066cc] focus:ring-1 focus:ring-[#0066cc]/20 transition-all"
              value={benefitFilterMonth}
              onChange={(e) => setBenefitFilterMonth(e.target.value)}
            >
              <option value="All">All Months</option>
              {months.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          <div className="space-y-[4px]">
            <label className="block font-bold text-slate-500 uppercase tracking-wider">Search 4M Change No</label>
            <input
              type="text"
              placeholder="e.g. 4M-2026-2..."
              className="w-full px-[8px] py-[6px] border border-slate-200 rounded-[6px] bg-white text-slate-700 placeholder-slate-400 font-semibold outline-none focus:border-[#0066cc] focus:ring-1 focus:ring-[#0066cc]/20 transition-all"
              value={benefitFilterSearch}
              onChange={(e) => setBenefitFilterSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Cost Saving Section */}
        {showCost && (
          <div className="space-y-[12px] bg-white border border-slate-200/80 rounded-xl p-[20px] shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h5 className="text-[13px] font-bold text-[#1e60aa] uppercase tracking-wider">Cost Saving</h5>
            </div>

            {/* Cost Saving Charts Grid */}
            {filteredCost.length > 0 ? (
              <div className="grid grid-cols-1 gap-6">
                {/* Monthly Save Chart */}
                <div className="bg-slate-50/50 border border-slate-200/50 rounded-xl p-4 shadow-sm">
                  <h6 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-3">Cost Saved / Month (Rs) per Change Request</h6>
                  <div className="flex justify-start items-end h-[160px] gap-6 overflow-x-auto pb-4 px-2 min-w-full">
                    {filteredCost.map((row, idx) => {
                      const val = parseFloat(row.monthlySave) || 0;
                      const pct = (val / maxCostVal) * 100;
                      return (
                        <div key={idx} className="flex flex-col items-center min-w-[70px] max-w-[100px] h-full justify-end group">
                          <span className="text-[9px] font-bold text-slate-600 mb-1">Rs. {val}</span>
                          <div className="w-full h-[65%] flex items-end justify-center">
                            <div
                              className="w-8 bg-gradient-to-t from-[#154a85] to-[#1e60aa] hover:from-[#1a5292] hover:to-[#226ec2] transition-all rounded-t-[3px] shadow-sm cursor-pointer"
                              style={{ height: `${Math.max(pct, 4)}%` }}
                            />
                          </div>
                          <span className="text-[9px] font-bold text-slate-500 mt-2 truncate max-w-full" title={row.changeNo}>
                            {row.changeNo}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Annual Save Chart */}
                <div className="bg-slate-50/50 border border-slate-200/50 rounded-xl p-4 shadow-sm">
                  <h6 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-3">Total Cost Saved / Annum (Rs) per Change Request</h6>
                  <div className="flex justify-start items-end h-[160px] gap-6 overflow-x-auto pb-4 px-2 min-w-full">
                    {filteredCost.map((row, idx) => {
                      const val = parseFloat(row.annualSave) || 0;
                      const pct = (val / maxAnnualVal) * 100;
                      return (
                        <div key={idx} className="flex flex-col items-center min-w-[70px] max-w-[100px] h-full justify-end group">
                          <span className="text-[9px] font-bold text-slate-600 mb-1">Rs. {val}</span>
                          <div className="w-full h-[65%] flex items-end justify-center">
                            <div
                              className="w-8 bg-gradient-to-t from-[#0284c7] to-[#0ea5e9] hover:from-[#0369a1] hover:to-[#0284c7] transition-all rounded-t-[3px] shadow-sm cursor-pointer"
                              style={{ height: `${Math.max(pct, 4)}%` }}
                            />
                          </div>
                          <span className="text-[9px] font-bold text-slate-500 mt-2 truncate max-w-full" title={row.changeNo}>
                            {row.changeNo}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* ROI Chart */}
                <div className="bg-slate-50/50 border border-slate-200/50 rounded-xl p-4 shadow-sm">
                  <h6 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-3">ROI (Rs) per Change Request</h6>
                  <div className="flex justify-start items-end h-[160px] gap-6 overflow-x-auto pb-4 px-2 min-w-full">
                    {filteredCost.map((row, idx) => {
                      const val = parseFloat(row.roi) || 0;
                      const pct = (val / maxRoiVal) * 100;
                      return (
                        <div key={idx} className="flex flex-col items-center min-w-[70px] max-w-[100px] h-full justify-end group">
                          <span className="text-[9px] font-bold text-slate-600 mb-1">Rs. {val}</span>
                          <div className="w-full h-[65%] flex items-end justify-center">
                            <div
                              className="w-8 bg-gradient-to-t from-[#0f766e] to-[#14b8a6] hover:from-[#0d9488] hover:to-[#0f766e] transition-all rounded-t-[3px] shadow-sm cursor-pointer"
                              style={{ height: `${Math.max(pct, 4)}%` }}
                            />
                          </div>
                          <span className="text-[9px] font-bold text-slate-500 mt-2 truncate max-w-full" title={row.changeNo}>
                            {row.changeNo}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-6 text-slate-400 bg-slate-50/50 border border-dashed border-slate-200 rounded-xl text-[12px]">
                No Cost Saving chart data matching filter criteria.
              </div>
            )}

            {/* Cost Saving Table */}
            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm bg-white">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-[11px] min-w-[700px]">
                  <thead>
                    <tr className="bg-[#1e60aa] text-white border-b border-[#154a85] font-semibold">
                      <th className="p-[10px] border-r border-[#1a5596] w-[8%]">Sl No</th>
                      <th className="p-[10px] border-r border-[#1a5596] w-[15%]">4M </th>
                      <th className="p-[10px] border-r border-[#1a5596] w-[18%]">Implementation date</th>
                      <th className="p-[10px] border-r border-[#1a5596] w-[22%]">Total Cost Saved / month(Rs)</th>
                      <th className="p-[10px] border-r border-[#1a5596] w-[22%]">Total Cost Saved / Annum(Rs)</th>
                      <th className="p-[10px] w-[15%]">ROI (Rs)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredCost.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-[16px] text-center text-slate-400 font-medium">
                          No Cost Saving data available matching selection.
                        </td>
                      </tr>
                    ) : (
                      filteredCost.map((row, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/50 text-slate-700 font-medium odd:bg-slate-50/20">
                          <td className="p-[10px] border-r border-slate-100 font-bold text-slate-400">{idx + 1}</td>
                          <td className="p-[10px] border-r border-slate-100 font-bold text-[#0066cc]">{row.changeNo}</td>
                          <td className="p-[10px] border-r border-slate-100 text-slate-500">{row.date}</td>
                          <td className="p-[10px] border-r border-slate-100 font-semibold text-slate-800">Rs. {row.monthlySave || '0'}</td>
                          <td className="p-[10px] border-r border-slate-100 font-semibold text-slate-800">Rs. {row.annualSave || '0'}</td>
                          <td className="p-[10px] text-slate-600">{row.roi || '-'}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Productivity Improvement Section */}
        {showProductivity && (
          <div className="space-y-[12px] bg-white border border-slate-200/80 rounded-xl p-[20px] shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h5 className="text-[13px] font-bold text-[#1e60aa] uppercase tracking-wider">Productivity Improvement</h5>
            </div>

            {/* Productivity Chart */}
            {filteredProductivity.length > 0 ? (
              <div className="bg-slate-50/50 border border-slate-200/50 rounded-xl p-4">
                <div className="flex justify-between items-center mb-3">
                  <h6 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Productivity (nos) per Change Request</h6>
                  <div className="flex items-center gap-3 text-[9px] font-bold text-slate-500">
                    <div className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-sm bg-slate-400" />
                      <span>Current</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-sm bg-[#2e7d32]" />
                      <span>Improved</span>
                    </div>
                  </div>
                </div>
                <div className="flex justify-start items-end h-[160px] gap-8 overflow-x-auto pb-4 px-2 min-w-full">
                  {filteredProductivity.map((row, idx) => {
                    const curr = parseFloat(row.currentProd) || 0;
                    const imp = parseFloat(row.improvedProd) || 0;
                    const pctCurr = (curr / maxProdVal) * 100;
                    const pctImp = (imp / maxProdVal) * 100;
                    return (
                      <div key={idx} className="flex flex-col items-center min-w-[80px] h-full justify-end">
                        <div className="flex gap-1 mb-1 text-[9px] font-bold text-slate-600">
                          <span>{curr}</span>
                          <span>/</span>
                          <span className="text-[#2e7d32]">{imp}</span>
                        </div>
                        <div className="flex items-end gap-1.5 h-[65%] justify-center">
                          <div
                            className="w-5 bg-slate-400 hover:bg-slate-500 transition-all rounded-t-[2px] shadow-sm cursor-pointer"
                            style={{ height: `${Math.max(pctCurr, 4)}%` }}
                          />
                          <div
                            className="w-5 bg-[#2e7d32] hover:bg-[#1b5e20] transition-all rounded-t-[2px] shadow-sm cursor-pointer"
                            style={{ height: `${Math.max(pctImp, 4)}%` }}
                          />
                        </div>
                        <span className="text-[9px] font-bold text-slate-500 mt-2 truncate max-w-full" title={row.changeNo}>
                          {row.changeNo}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="text-center py-6 text-slate-400 bg-slate-50/50 border border-dashed border-slate-200 rounded-xl text-[12px]">
                No Productivity chart data matching filter criteria.
              </div>
            )}

            {/* Productivity Table */}
            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm bg-white">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-[11px] min-w-[700px]">
                  <thead>
                    <tr className="bg-[#1e60aa] text-white border-b border-[#154a85] font-semibold">
                      <th className="p-[10px] border-r border-[#1a5596] w-[8%]">Sl No</th>
                      <th className="p-[10px] border-r border-[#1a5596] w-[17%]">4M</th>
                      <th className="p-[10px] border-r border-[#1a5596] w-[20%]">Implementation date</th>
                      <th className="p-[10px] border-r border-[#1a5596] w-[27%]">Current Productivity (nos)</th>
                      <th className="p-[10px] w-[28%]">Productivity Improved (nos)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredProductivity.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-[16px] text-center text-slate-400 font-medium">
                          No Productivity Improvement data available matching selection.
                        </td>
                      </tr>
                    ) : (
                      filteredProductivity.map((row, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/50 text-slate-700 font-medium odd:bg-slate-50/20">
                          <td className="p-[10px] border-r border-slate-100 font-bold text-slate-400">{idx + 1}</td>
                          <td className="p-[10px] border-r border-slate-100 font-bold text-[#0066cc]">{row.changeNo}</td>
                          <td className="p-[10px] border-r border-slate-100 text-slate-500">{row.date}</td>
                          <td className="p-[10px] border-r border-slate-100 text-slate-600">{row.currentProd || '0'} nos</td>
                          <td className="p-[10px] font-bold text-slate-800">{row.improvedProd || '0'} nos</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Quality Improvement Section */}
        {showQuality && (
          <div className="space-y-[12px] bg-white border border-slate-200/80 rounded-xl p-[20px] shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h5 className="text-[13px] font-bold text-[#1e60aa] uppercase tracking-wider">Quality Improvement</h5>
            </div>

            {/* Quality Chart */}
            {filteredQuality.length > 0 ? (
              <div className="bg-slate-50/50 border border-slate-200/50 rounded-xl p-4">
                <div className="flex justify-between items-center mb-3">
                  <h6 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Quality PPM Reduction per Change Request</h6>
                  <div className="flex items-center gap-3 text-[9px] font-bold text-slate-500">
                    <div className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-sm bg-rose-500" />
                      <span>Current PPM</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-sm bg-[#8bc34a]" />
                      <span>Reduced PPM</span>
                    </div>
                  </div>
                </div>
                <div className="flex justify-start items-end h-[160px] gap-8 overflow-x-auto pb-4 px-2 min-w-full">
                  {filteredQuality.map((row, idx) => {
                    const curr = parseFloat(row.currentPpm) || 0;
                    const red = parseFloat(row.reducedPpm) || 0;
                    const pctCurr = (curr / maxQualityVal) * 100;
                    const pctRed = (red / maxQualityVal) * 100;
                    return (
                      <div key={idx} className="flex flex-col items-center min-w-[80px] h-full justify-end">
                        <div className="flex gap-1 mb-1 text-[9px] font-bold text-slate-655">
                          <span className="text-rose-600">{curr}</span>
                          <span>/</span>
                          <span className="text-[#689f38]">{red}</span>
                        </div>
                        <div className="flex items-end gap-1.5 h-[65%] justify-center">
                          <div
                            className="w-5 bg-rose-500 hover:bg-rose-600 transition-all rounded-t-[2px] shadow-sm cursor-pointer"
                            style={{ height: `${Math.max(pctCurr, 4)}%` }}
                          />
                          <div
                            className="w-5 bg-[#8bc34a] hover:bg-[#7cb342] transition-all rounded-t-[2px] shadow-sm cursor-pointer"
                            style={{ height: `${Math.max(pctRed, 4)}%` }}
                          />
                        </div>
                        <span className="text-[9px] font-bold text-slate-500 mt-2 truncate max-w-full" title={row.changeNo}>
                          {row.changeNo}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="text-center py-6 text-slate-400 bg-slate-50/50 border border-dashed border-slate-200 rounded-xl text-[12px]">
                No Quality chart data matching filter criteria.
              </div>
            )}

            {/* Quality Table */}
            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm bg-white">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-[11px] min-w-[700px]">
                  <thead>
                    <tr className="bg-[#1e60aa] text-white border-b border-[#154a85] font-semibold">
                      <th className="p-[10px] border-r border-[#1a5596] w-[8%]">Sl No</th>
                      <th className="p-[10px] border-r border-[#1a5596] w-[17%]">4M </th>
                      <th className="p-[10px] border-r border-[#1a5596] w-[20%]">Implementation date</th>
                      <th className="p-[10px] border-r border-[#1a5596] w-[27%]">Current PPM</th>
                      <th className="p-[10px] w-[28%]">Reduced PPM</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredQuality.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-[16px] text-center text-slate-400 font-medium">
                          No Quality Improvement data available matching selection.
                        </td>
                      </tr>
                    ) : (
                      filteredQuality.map((row, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/50 text-slate-700 font-medium odd:bg-slate-50/20">
                          <td className="p-[10px] border-r border-slate-100 font-bold text-slate-400">{idx + 1}</td>
                          <td className="p-[10px] border-r border-slate-100 font-bold text-[#0066cc]">{row.changeNo}</td>
                          <td className="p-[10px] border-r border-slate-100 text-slate-500">{row.date}</td>
                          <td className="p-[10px] border-r border-slate-100 text-slate-600">{row.currentPpm || '0'}</td>
                          <td className="p-[10px] font-bold text-slate-800">{row.reducedPpm || '0'}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const handleSaveEdits = async () => {
    setIsSaving(true);
    try {
      if (activeTab === 'l1') {
        const area = (editL1Data.improvement_area || '').toLowerCase();
        if (['cost', 'productivity', 'quality'].includes(area)) {
          let parsedRows = [];
          try {
            if (editL1Data.improvement_table_data) {
              parsedRows = JSON.parse(editL1Data.improvement_table_data);
            }
          } catch (e) {
            console.error("Failed to parse improvement_table_data JSON:", e);
          }

          if (!checkEditTableCompleteness(parsedRows)) {
            setToastMsg({ text: `Please fill in all details in the ${editL1Data.improvement_area} Saving/Improvement Data Table.`, isError: true });
            setIsSaving(false);
            return;
          }
        }
        await updateChangeDetails(selectedLog.changeNo, 'l1', editL1Data, uploadedFilesList);
        setSelectedL1Details(editL1Data);
      } else if (activeTab === 'l2') {
        await updateChangeDetails(selectedLog.changeNo, 'l2', editL2Data, uploadedFilesList);
        setSelectedL2Details(editL2Data);
      } else if (activeTab === 'l3') {
        await updateChangeDetails(selectedLog.changeNo, 'l3', editL3Data);
        setSelectedLog(editL3Data);
      }
      setToastMsg(`${activeTab.toUpperCase()} details updated successfully!`);
      setIsEditMode(false);
      setUploadedFilesList([]);
    } catch (err) {
      console.error(err);
      const errMsg = err.response?.data?.error || 'Failed to save updates.';
      setToastMsg({ text: errMsg, isError: true });
    } finally {
      setIsSaving(false);
    }
  };

  const renderDynamicEditForm = (data, setData, tab = 'l1') => {
    if (!data) return <div className="text-sm text-slate-500">No data available to edit.</div>;

    const renderFieldInput = (label, key, options = {}) => {
      const value = data[key];
      const placeholder = options.placeholder || '';
      const type = options.type || 'text';
      const disabled = options.disabled || false;

      if (key === 'improvement_table_data') {
        const area = (data.improvement_area || '').toLowerCase();
        if (!['cost', 'productivity', 'quality'].includes(area)) {
          return null;
        }

        const tableDataStr = value || '';
        let parsedRows = [];
        try {
          if (tableDataStr) {
            parsedRows = JSON.parse(tableDataStr);
          }
        } catch (e) {
          console.error("Failed to parse improvement_table_data JSON:", e);
        }
        const rowCount = parsedRows.length;
        const areaLabel = data.improvement_area || 'Cost';

        return (
          <div key={key} className="space-y-[4px] min-w-0">
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">{label}</label>
            <div className="flex gap-[8px]">
              <div className="relative flex-1">
                <input
                  type="text"
                  readOnly
                  placeholder={`No ${areaLabel.toLowerCase()} table data entered`}
                  className="w-full bg-slate-50 disabled:bg-slate-100 disabled:text-slate-500 border border-slate-200 rounded-[6px] py-[8px] pl-[12px] pr-[28px] text-[12px] outline-none text-slate-550 select-none font-medium text-slate-700"
                  value={rowCount > 0 ? `${rowCount} row${rowCount > 1 ? 's' : ''} entered (${areaLabel} Saving Data)` : ''}
                />
                {rowCount > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setDeleteConfirm({
                        title: 'Clear Table Data?',
                        message: 'Are you sure you want to clear all table rows?',
                        onConfirm: () => {
                          setData({ ...data, [key]: '' });
                        }
                      });
                    }}
                    className="absolute right-[10px] top-[10px] text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                    title="Clear table data"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={() => {
                  const changeNo = data.change_no || data.changeNo || selectedLog?.changeNo || '';
                  let defaultRows = [];
                  try {
                    if (tableDataStr) {
                      defaultRows = JSON.parse(tableDataStr);
                    }
                  } catch (err) {
                    console.error('Failed to parse table data:', err);
                  }

                  if (!defaultRows || defaultRows.length === 0) {
                    if (area === 'cost') {
                      defaultRows = [{ changeNo, date: '', monthlySave: '', annualSave: '', roi: '' }];
                    } else if (area === 'productivity') {
                      defaultRows = [{ changeNo, date: '', currentProd: '', improvedProd: '' }];
                    } else if (area === 'quality') {
                      defaultRows = [{ changeNo, date: '', currentPpm: '', reducedPpm: '' }];
                    }
                  } else {
                    defaultRows = defaultRows.map(r => ({ ...r, changeNo: r.changeNo || changeNo }));
                  }

                  setTempTableData(defaultRows);
                  setTableModalError('');
                  setIsTableModalOpen(true);
                }}
                className="flex items-center justify-center gap-[6px] px-[12px] py-[8px] border border-slate-200 bg-white hover:bg-slate-50 text-[#0066cc] rounded-[6px] text-[11px] font-bold shadow-sm transition-all cursor-pointer select-none shrink-0"
              >
                <FileText size={12} />
                <span>Edit Table</span>
              </button>
            </div>
          </div>
        );
      }

      const fileKeys = [
        'file_desc', 'file_improvement', 'file_trace_from', 'file_trace_to',
        'file_risk', 'file_sop', 'file_effectiveness',
        'weldTest', 'qaTest'
      ];

      if (fileKeys.includes(key)) {
        return (
          <div key={key} className="space-y-[4px] min-w-0">
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">{label}</label>
            <div className="flex gap-[8px]">
              <div className="relative flex-1">
                <input
                  type="text"
                  readOnly
                  placeholder="No file attached"
                  className="w-full bg-slate-50 disabled:bg-slate-100 disabled:text-slate-500 border border-slate-200 rounded-[6px] py-[8px] pl-[12px] pr-[28px] text-[12px] outline-none text-slate-550 select-none font-medium text-slate-700"
                  value={value || ''}
                />
                {value && value !== '-' && (
                  <button
                    type="button"
                    onClick={() => {
                      setDeleteConfirm({
                        title: 'Clear Attachments?',
                        message: 'Are you sure you want to clear all attachments from this field?',
                        onConfirm: () => {
                          setData({ ...data, [key]: '' });
                          setUploadedFilesList(prev => prev.filter(f => f.fieldName !== key));
                        }
                      });
                    }}
                    className="absolute right-[10px] top-[10px] text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                    title="Clear attachments"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
              <label className="flex items-center justify-center gap-[6px] px-[12px] py-[8px] border border-slate-200 bg-white hover:bg-slate-50 text-[#0066cc] rounded-[6px] text-[11px] font-bold shadow-sm transition-all cursor-pointer select-none">
                <Upload size={12} />
                <span>Upload</span>
                <input
                  type="file"
                  multiple
                  accept="image/*,application/pdf"
                  className="hidden"
                  onChange={async (e) => {
                    const target = e.target;
                    if (target.files && target.files.length > 0) {
                      const files = Array.from(target.files);
                      const MAX_SIZE = 100 * 1024 * 1024; // 100MB
                      const tooLargeFiles = files.filter(f => f.size > MAX_SIZE);

                      if (tooLargeFiles.length > 0) {
                        setToastMsg({ text: `Upload not allowed: File(s) exceed 100MB limit: ${tooLargeFiles.map(f => f.name).join(', ')}`, isError: true });
                        target.value = '';
                        return;
                      }

                      const names = files.map(f => f.name.replace(/,/g, '_'));
                      target.value = '';

                      const base64Files = await Promise.all(
                        files.map(async (file) => {
                          const name = file.name.replace(/,/g, '_');
                          // Create local blob URL for immediate preview before save
                          const localUrl = URL.createObjectURL(file);
                          setFileUrls(prev => ({ ...prev, [name]: localUrl }));
                          setFileTypes(prev => ({ ...prev, [name]: file.type || 'application/octet-stream' }));

                          return {
                            name,
                            type: file.type || 'application/octet-stream',
                            data: await fileToBase64(file),
                            fieldName: key
                          };
                        })
                      );

                      setUploadedFilesList(prev => {
                        const filtered = prev.filter(f => !(f.fieldName === key && names.includes(f.name)));
                        return [...filtered, ...base64Files];
                      });

                      const existing = value && value !== '-' ? value.split(',').map(s => s.trim()).filter(Boolean) : [];
                      const updated = Array.from(new Set([...existing, ...names])).join(', ');
                      setData({ ...data, [key]: updated });
                    }
                  }}
                />
              </label>
            </div>

            {/* Selected File Pills */}
            {value && value !== '-' && (
              <div className="flex flex-wrap gap-[6px] pt-[4px]">
                {value.split(',').map(s => s.trim()).filter(Boolean).map((file, i) => (
                  <span key={i} className="inline-flex items-center gap-[6px] bg-slate-100 border border-slate-200 text-[10px] font-medium text-slate-700 px-[8px] py-[2px] rounded-full select-none">
                    <span
                      className="truncate max-w-[150px] font-semibold text-[#0066cc] cursor-pointer hover:underline"
                      onClick={() => handleViewAttachment(file, data.change_no || data.changeNo || selectedLog.changeNo, tab === 'l2' ? 'L2' : 'L1')}
                      title="Click to preview file"
                    >
                      📎 {file}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setDeleteConfirm({
                          title: 'Delete Attachment?',
                          message: `Are you sure you want to delete "${file}"?`,
                          onConfirm: () => {
                            const existing = value.split(',').map(s => s.trim()).filter(Boolean);
                            const updated = existing.filter(f => f !== file).join(', ');
                            setData({ ...data, [key]: updated });
                            setUploadedFilesList(prev => prev.filter(f => !(f.fieldName === key && f.name === file)));
                          }
                        });
                      }}
                      className="text-slate-400 hover:text-rose-600 font-bold ml-[2px] cursor-pointer text-[12px]"
                    >
                      &times;
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        );
      }

      const isTextArea = type === 'textarea' || (typeof value === 'string' && value.length > 80);

      return (
        <div key={key} className="space-y-[4px] min-w-0">
          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">{label}</label>
          {isTextArea ? (
            <textarea
              className="w-full bg-slate-50 disabled:bg-slate-105 disabled:text-slate-500 border border-slate-200 rounded-[6px] py-[8px] px-[12px] text-[12px] outline-none focus:ring-4 focus:ring-[#0066cc]/10 focus:border-[#0066cc] transition-all duration-200 resize-none font-medium text-slate-700"
              rows={options.rows || 3}
              value={value || ''}
              disabled={disabled}
              placeholder={placeholder}
              maxLength={1000}
              onChange={(e) => setData({ ...data, [key]: e.target.value })}
            />
          ) : (
            <input
              type={type}
              className="w-full bg-slate-50 disabled:bg-slate-105 disabled:text-slate-500 border border-slate-200 rounded-[6px] py-[8px] px-[12px] text-[12px] outline-none focus:ring-4 focus:ring-[#0066cc]/10 focus:border-[#0066cc] transition-all duration-200 font-medium text-slate-700"
              value={value || ''}
              disabled={disabled}
              placeholder={placeholder}
              maxLength={type === 'text' ? 100 : undefined}
              onChange={(e) => setData({ ...data, [key]: e.target.value })}
            />
          )}
        </div>
      );
    };

    if (tab === 'l1') {

      const processOptions = Array.from(new Set([
        ...dbProcesses,
        ...(data.process_name ? [data.process_name] : [])
      ]));
      const machineOptions = Array.from(new Set([
        ...dbMachines,
        ...(data.machine_no ? [data.machine_no] : [])
      ]));

      return (
        <div className="space-y-[24px] animate-fade-in-up text-slate-800">
          {/* Identifiers Card */}
          <div className="bg-white border border-slate-200/60 rounded-xl p-6 shadow-sm hover:shadow-md transition-all duration-300 space-y-[16px]">
            <h4 className="text-[13px] font-bold text-slate-900 border-b border-slate-100 pb-[8px]">Identifiers</h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-[16px]">
              {/* UNIT */}
              <div className="space-y-[4px]">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Unit <span className="text-rose-500">*</span></label>
                <select
                  value={data.unit || ''}
                  onChange={(e) => setData({ ...data, unit: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-[6px] py-[8px] px-[12px] text-[12px] outline-none focus:border-[#0066cc] focus:ring-4 focus:ring-[#0066cc]/10 transition-all duration-200 text-slate-700 font-medium"
                >
                  <option value="">— Select Unit —</option>
                  <option value="UNIT-2">UNIT-2</option>
                </select>
              </div>

              {/* 4M CHANGE NO */}
              <div className="space-y-[4px]">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">4M Change No <span className="text-rose-500">*</span></label>
                <div className="relative flex items-center">
                  <span className="absolute left-[12px] text-slate-400 text-[12px]">#</span>
                  <input
                    type="text"
                    disabled
                    value={data.change_no || ''}
                    className="w-full bg-slate-100 border border-slate-200 rounded-[6px] py-[8px] pl-[24px] pr-[54px] text-[12px] text-slate-500 cursor-not-allowed outline-none font-medium"
                  />
                  <span className="absolute right-[8px] bg-sky-50 border border-sky-100 text-[#0066cc] text-[9px] font-bold rounded px-[6px] py-[2px] uppercase select-none">
                    Auto
                  </span>
                </div>
                <span className="block text-[9px] text-slate-400 mt-[2px]">Unique ID auto-assigned on submission</span>
              </div>

              {/* REQUESTED DATE */}
              <div className="space-y-[4px]">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Requested Date <span className="text-rose-500">*</span></label>
                <div className="relative flex items-center">
                  <input
                    type="text"
                    disabled
                    value={data.crDate ? formatDateToDDMMYYYY(data.crDate) : '-'}
                    className="w-full bg-slate-100 border border-slate-200 rounded-[6px] py-[8px] pl-[12px] pr-[54px] text-[12px] text-slate-500 cursor-not-allowed outline-none font-medium"
                  />
                  <span className="absolute right-[8px] bg-sky-50 border border-sky-100 text-[#0066cc] text-[9px] font-bold rounded px-[6px] py-[2px] uppercase select-none">
                    Auto
                  </span>
                </div>
                <span className="block text-[9px] text-slate-400 mt-[2px]">Auto-captured: today's date</span>
              </div>

              {/* TIME */}
              <div className="space-y-[4px]">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Time <span className="text-rose-500">*</span></label>
                <div className="relative flex items-center">
                  <input
                    type="text"
                    disabled
                    value={data.requested_time || ''}
                    className="w-full bg-slate-100 border border-slate-200 rounded-[6px] py-[8px] pl-[12px] pr-[54px] text-[12px] text-slate-500 cursor-not-allowed outline-none font-medium"
                  />
                  <span className="absolute right-[8px] bg-slate-50 border border-slate-200 text-slate-600 text-[9px] font-bold rounded px-[6px] py-[2px] uppercase select-none">
                    Captured
                  </span>
                </div>
                <span className="block text-[9px] text-slate-400 mt-[2px]">Auto-captured on load</span>
              </div>
            </div>

            {/* CHANGE IN */}
            <div className="space-y-[6px] pt-[8px]">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Change In <span className="text-rose-500">*</span></label>
              <div className="flex flex-wrap gap-x-[16px] gap-y-[8px] text-[12px] text-slate-700 font-medium select-none">
                {['Man', 'Machine', 'Material', 'Method', 'Measurement', 'Mother Nature'].map(key => {
                  const isChecked = (data.change_in || '').split(',').map(s => s.trim()).includes(key);
                  return (
                    <label key={key} className="flex items-center gap-[6px] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {
                          const existing = (data.change_in || '').split(',').map(s => s.trim()).filter(Boolean);
                          let updated;
                          if (existing.includes(key)) {
                            updated = existing.filter(k => k !== key);
                          } else {
                            updated = [...existing, key];
                          }
                          setData({ ...data, change_in: updated.join(', ') });
                        }}
                        className="w-[14px] h-[14px] rounded border-slate-300 text-[#0066cc] focus:ring-[#0066cc]"
                      />
                      <span>{key}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Request Details Card */}
          <div className="bg-white border border-slate-200/60 rounded-xl p-6 shadow-sm hover:shadow-md transition-all duration-300 space-y-[16px]">
            <h4 className="text-[13px] font-bold text-slate-900 border-b border-slate-100 pb-[8px]">Request Details</h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-[16px]">
              {/* CHANGE REQUEST DEPT */}
              <div className="space-y-[4px]">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Change Request Dept <span className="text-rose-500">*</span></label>
                <input
                  type="text"
                  disabled
                  value={data.dept || ''}
                  className="w-full bg-slate-100 border border-slate-200 rounded-[6px] py-[8px] px-[12px] text-[12px] text-slate-500 cursor-not-allowed outline-none font-semibold"
                />
                <span className="block text-[9px] text-slate-400 mt-[2px]">Auto-captured from logged-in user</span>
              </div>

              {/* CHANGE REQUEST BY */}
              <div className="space-y-[4px]">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Change Request By <span className="text-rose-500">*</span></label>
                <input
                  type="text"
                  disabled
                  value={data.request_by || ''}
                  className="w-full bg-slate-100 border border-slate-200 rounded-[6px] py-[8px] px-[12px] text-[12px] text-slate-500 cursor-not-allowed outline-none font-semibold"
                />
              </div>

              {/* PROCESS NAME */}
              <div className="space-y-[4px]">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Process Name <span className="text-rose-500">*</span></label>
                {isAdmin ? (
                  <select
                    value={data.process_name || ''}
                    onChange={(e) => setData({ ...data, process_name: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-[6px] py-[8px] px-[12px] text-[12px] outline-none focus:border-[#0066cc] focus:ring-4 focus:ring-[#0066cc]/10 transition-all duration-200 text-slate-700 font-medium"
                  >
                    <option value="">— Select or Add Process —</option>
                    {processOptions.filter(p => p !== 'All').map(p => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={data.process_name || ''}
                    onChange={(e) => setData({ ...data, process_name: e.target.value })}
                    placeholder="Enter Process Name"
                    className="w-full bg-slate-50 border border-slate-200 rounded-[6px] py-[8px] px-[12px] text-[12px] outline-none focus:border-[#0066cc] focus:ring-4 focus:ring-[#0066cc]/10 transition-all duration-200 text-slate-700 font-medium"
                  />
                )}
              </div>

              {/* PROCESS LINE */}
              <div className="space-y-[4px]">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Process Line <span className="text-rose-500">*</span></label>
                <input
                  type="text"
                  disabled
                  placeholder="e.g. Line 3 / Bay B"
                  value={data.process_line || ''}
                  className="w-full bg-slate-100 border border-slate-200 rounded-[6px] py-[8px] px-[12px] text-[12px] text-slate-500 cursor-not-allowed outline-none font-semibold"
                />
              </div>

              {/* MACHINE NO */}
              <div className="space-y-[4px]">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Machine No <span className="text-rose-500">*</span></label>
                {isAdmin ? (
                  <select
                    value={data.machine_no || ''}
                    onChange={(e) => setData({ ...data, machine_no: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-[6px] py-[8px] px-[12px] text-[12px] outline-none focus:border-[#0066cc] focus:ring-4 focus:ring-[#0066cc]/10 transition-all duration-200 text-slate-700 font-medium"
                  >
                    <option value="">— Select or Add Machine —</option>
                    {machineOptions.filter(m => m !== 'All').map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={data.machine_no || ''}
                    onChange={(e) => setData({ ...data, machine_no: e.target.value })}
                    placeholder="Enter Machine No"
                    className="w-full bg-slate-50 border border-slate-200 rounded-[6px] py-[8px] px-[12px] text-[12px] outline-none focus:border-[#0066cc] focus:ring-4 focus:ring-[#0066cc]/10 transition-all duration-200 text-slate-700 font-medium"
                  />
                )}
              </div>
            </div>
          </div>

          {/* Change Description */}
          <div className="bg-white border border-slate-200/60 rounded-xl p-6 shadow-sm hover:shadow-md transition-all duration-300 space-y-[20px]">
            <h4 className="text-[13px] font-bold text-slate-900 border-b border-slate-100 pb-[8px]">Change Description</h4>

            {/* CONTEXT OF CHANGE */}
            <div className="space-y-[4px]">
              <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider">
                Context of Change <span className="text-rose-500">*</span>
              </label>
              <textarea
                value={data.title || ''}
                maxLength={150}
                onChange={(e) => setData({ ...data, title: e.target.value })}
                placeholder="Brief description of WHY this change is needed (min 10, max 150 characters)..."
                className="w-full bg-slate-50 border border-slate-200 rounded-[6px] py-[8px] px-[12px] text-[12px] outline-none focus:ring-4 focus:ring-[#0066cc]/10 focus:border-[#0066cc] transition-all duration-200 resize-none font-medium text-slate-700 h-[80px]"
              />
              <div className="flex justify-between items-center text-[9px] text-slate-400">
                <span>{(data.title || '').length} / 10 min</span>
                <span className={`${150 - (data.title || '').length <= 15 ? 'text-amber-600 font-bold animate-pulse' : 'text-slate-400'}`}>
                  {150 - (data.title || '').length} characters remaining (max 150 chars)
                </span>
              </div>
            </div>

            {/* DETAILED CHANGE DESCRIPTION */}
            <div className="space-y-[4px]">
              <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider">
                Detailed Change Description <span className="text-rose-500">*</span>
              </label>
              <textarea
                value={data.description || ''}
                onChange={(e) => setData({ ...data, description: e.target.value })}
                placeholder="Describe the change — what, why, how, and expected outcome "
                className="w-full bg-slate-50 border border-slate-200 rounded-[6px] py-[8px] px-[12px] text-[12px] outline-none focus:ring-4 focus:ring-[#0066cc]/10 focus:border-[#0066cc] transition-all duration-200 resize-none font-medium text-slate-700 h-[100px]"
              />
              <div className="flex justify-between items-center text-[9px] text-slate-400">
                <span>{(data.description || '').length} / 20 min</span>
                <span>
                  {(data.description || '').length} characters entered
                </span>
              </div>
            </div>

            {/* UPLOAD SUPPORTING FILES */}
            <div className="space-y-[4px]">
              <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider">
                Upload Supporting Files <span className="text-rose-500">*</span>
              </label>
              <div className="flex gap-[8px]">
                <div className="relative flex-1">
                  <input
                    type="text"
                    readOnly
                    placeholder="e.g. proof-log.pdf, image.png"
                    value={data.file_desc || ''}
                    className="w-full bg-slate-50 border border-slate-200 rounded-[6px] py-[8px] px-[12px] text-[12px] outline-none text-slate-500 select-none font-medium text-slate-700"
                  />
                  {data.file_desc && data.file_desc !== '-' && (
                    <button
                      type="button"
                      onClick={() => {
                        setDeleteConfirm({
                          title: 'Clear Attachments?',
                          message: 'Are you sure you want to clear all attachments from this field?',
                          onConfirm: () => {
                            setData({ ...data, file_desc: '' });
                            setUploadedFilesList(prev => prev.filter(f => f.fieldName !== 'file_desc'));
                          }
                        });
                      }}
                      className="absolute right-[10px] top-[10px] text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                      title="Clear attachments"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>
                <label className="flex items-center justify-center gap-[6px] px-[16px] py-[8px] border border-[#0066cc] bg-white hover:bg-slate-50 text-[#0066cc] rounded-[6px] text-[11px] font-bold shadow-sm transition-all cursor-pointer select-none">
                  <Upload size={12} />
                  <span>Upload</span>
                  <input
                    type="file"
                    multiple
                    accept="image/*,application/pdf"
                    className="hidden"
                    onChange={async (e) => {
                      const target = e.target;
                      if (target.files && target.files.length > 0) {
                        const files = Array.from(target.files);
                        const MAX_SIZE = 100 * 1024 * 1024; // 100MB
                        const tooLargeFiles = files.filter(f => f.size > MAX_SIZE);

                        if (tooLargeFiles.length > 0) {
                          setToastMsg({ text: `Upload not allowed: File(s) exceed 100MB limit: ${tooLargeFiles.map(f => f.name).join(', ')}`, isError: true });
                          target.value = '';
                          return;
                        }

                        const names = files.map(f => f.name.replace(/,/g, '_'));
                        target.value = '';

                        const base64Files = await Promise.all(
                          files.map(async (file) => {
                            const name = file.name.replace(/,/g, '_');
                            const localUrl = URL.createObjectURL(file);
                            setFileUrls(prev => ({ ...prev, [name]: localUrl }));
                            setFileTypes(prev => ({ ...prev, [name]: file.type || 'application/octet-stream' }));

                            return {
                              name,
                              type: file.type || 'application/octet-stream',
                              data: await fileToBase64(file),
                              fieldName: 'file_desc'
                            };
                          })
                        );

                        setUploadedFilesList(prev => {
                          const filtered = prev.filter(f => !(f.fieldName === 'file_desc' && names.includes(f.name)));
                          return [...filtered, ...base64Files];
                        });

                        const existing = data.file_desc && data.file_desc !== '-' ? data.file_desc.split(',').map(s => s.trim()).filter(Boolean) : [];
                        const updated = Array.from(new Set([...existing, ...names])).join(', ');
                        setData({ ...data, file_desc: updated });
                      }
                    }}
                  />
                </label>
              </div>

              {/* Selected File Pills */}
              {data.file_desc && data.file_desc !== '-' && (
                <div className="flex flex-wrap gap-[6px] pt-[4px]">
                  {data.file_desc.split(',').map(s => s.trim()).filter(Boolean).map((file, i) => (
                    <span key={i} className="inline-flex items-center gap-[6px] bg-slate-100 border border-slate-200 text-[10px] font-medium text-slate-700 px-[8px] py-[2px] rounded-full select-none">
                      <span
                        className="truncate max-w-[150px] font-semibold text-[#0066cc] cursor-pointer hover:underline"
                        onClick={() => handleViewAttachment(file, data.change_no || data.changeNo || selectedLog.changeNo, 'L1')}
                        title="Click to preview file"
                      >
                        📎 {file}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setDeleteConfirm({
                            title: 'Delete Attachment?',
                            message: `Are you sure you want to delete "${file}"?`,
                            onConfirm: () => {
                              const existing = data.file_desc.split(',').map(s => s.trim()).filter(Boolean);
                              const updated = existing.filter(f => f !== file).join(', ');
                              setData({ ...data, file_desc: updated });
                              setUploadedFilesList(prev => prev.filter(f => !(f.fieldName === 'file_desc' && f.name === file)));
                            }
                          });
                        }}
                        className="text-slate-400 hover:text-rose-600 font-bold ml-[2px] cursor-pointer text-[12px]"
                      >
                        &times;
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Implementation Timeline */}
          <div className="bg-white border border-slate-200/60 rounded-xl p-6 shadow-sm hover:shadow-md transition-all duration-300 space-y-[16px]">
            <h4 className="text-[13px] font-bold text-slate-900 border-b border-slate-100 pb-[8px]">Implementation Timeline</h4>

            <div className="grid grid-cols-1 gap-[16px]">
              {/* CHANGE IMPROVEMENT AREA * */}
              <div className="space-y-[4px]">
                <label className="block text-[10px] font-bold text-slate-650 uppercase tracking-wider">
                  Change Improvement Area <span className="text-rose-500">*</span>
                </label>
                <select
                  value={data.improvement_area || ''}
                  onChange={(e) => {
                    const newArea = e.target.value;
                    const changeNo = data.change_no || data.changeNo || selectedLog?.changeNo || '';
                    let newTableData = '';
                    if (selectedL1Details && newArea.toLowerCase() === (selectedL1Details.improvement_area || '').toLowerCase()) {
                      newTableData = selectedL1Details.improvement_table_data || '';
                    } else if (['cost', 'productivity', 'quality'].includes(newArea.toLowerCase())) {
                      let defaultRows = [];
                      if (newArea.toLowerCase() === 'cost') {
                        defaultRows = [{ changeNo, date: '', monthlySave: '', annualSave: '', roi: '' }];
                      } else if (newArea.toLowerCase() === 'productivity') {
                        defaultRows = [{ changeNo, date: '', currentProd: '', improvedProd: '' }];
                      } else if (newArea.toLowerCase() === 'quality') {
                        defaultRows = [{ changeNo, date: '', currentPpm: '', reducedPpm: '' }];
                      }
                      newTableData = JSON.stringify(defaultRows);
                    }
                    setData({ ...data, improvement_area: newArea, improvement_table_data: newTableData });
                  }}
                  className="w-full bg-slate-50 border border-slate-200 rounded-[6px] py-[8px] px-[12px] text-[12px] outline-none focus:border-[#0066cc] focus:ring-4 focus:ring-[#0066cc]/10 transition-all duration-200 text-slate-700 font-medium"
                >
                  <option value="">— Select Area —</option>
                  <option value="Productivity">Productivity</option>
                  <option value="Quality">Quality</option>
                  <option value="Cost">Cost</option>
                  <option value="Delivery">Delivery</option>
                  <option value="Safety">Safety</option>
                  <option value="Morale">Morale</option>
                  <option value="Environment">Environment</option>
                  <option value="Poka Yoke">Poka Yoke</option>
                </select>
              </div>

              {/* UPLOAD SUPPORTING FILES * for improvement_area */}
              {renderFieldInput('Upload Supporting Files *', 'file_improvement')}

              {/* PERMANENT / TEMPORARY CHANGE * */}
              <div className="space-y-[4px]">
                <label className="block text-[10px] font-bold text-slate-655 uppercase tracking-wider">
                  Permanent / Temporary Change <span className="text-rose-500">*</span>
                </label>
                <select
                  value={data.change_type || ''}
                  onChange={(e) => setData({ ...data, change_type: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-[6px] py-[8px] px-[12px] text-[12px] outline-none focus:border-[#0066cc] focus:ring-4 focus:ring-[#0066cc]/10 transition-all duration-200 text-slate-700 font-medium"
                >
                  <option value="">— Select —</option>
                  <option value="Permanent">Permanent</option>
                  <option value="Temporary">Temporary</option>
                </select>
              </div>

              {/* IMPLEMENT / CHANGE DATE START * */}
              <div className="space-y-[4px] relative">
                <label className="block text-[10px] font-bold text-slate-655 uppercase tracking-wider">
                  Implement / Change Date Start <span className="text-rose-500">*</span>
                </label>
                <CustomDatePicker
                  value={data.date_start ? formatDateToDDMMYYYY(data.date_start) : ''}
                  placeholder="dd/mm/yyyy"
                  onChange={(val) => setData({ ...data, date_start: convertDDMMYYYYToYYYYMMDD(val) })}
                  readOnly={true}
                  inputClassName="w-full pl-[12px] pr-[32px] py-[8px] border border-slate-200 bg-slate-50 rounded-[6px] text-[12px] font-medium text-slate-700 outline-none focus:border-[#0066cc] focus:ring-4 focus:ring-[#0066cc]/10 transition-all duration-200"
                />
              </div>

              {/* OPENING QUANTITY */}
              <div className="space-y-[4px] relative">
                <label className="block text-[10px] font-bold text-slate-655 uppercase tracking-wider">
                  Opening Quantity
                </label>
                <input
                  type="number"
                  value={data.opening_quantity || ''}
                  onChange={(e) => setData({ ...data, opening_quantity: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-[6px] py-[8px] px-[12px] text-[12px] outline-none focus:border-[#0066cc] focus:ring-4 focus:ring-[#0066cc]/10 transition-all duration-200 text-slate-700 font-medium"
                />
              </div>

              {/* PART TRACEABILITY DETAILS (FROM CHANGES) * */}
              <div className="space-y-[4px]">
                <label className="block text-[10px] font-bold text-slate-655 uppercase tracking-wider">
                  Part Traceability Details (From Changes) <span className="text-rose-500">*</span>
                </label>
                <textarea
                  value={data.trace_from || ''}
                  maxLength={1000}
                  onChange={(e) => setData({ ...data, trace_from: e.target.value })}
                  placeholder="Describe the change — what, why, how, and expected outcome "
                  className="w-full bg-slate-50 border border-slate-200 rounded-[8px] py-[8px] px-[12px] text-[12px] outline-none focus:ring-4 focus:ring-[#0066cc]/10 focus:border-[#0066cc] transition-all duration-200 resize-none font-medium text-slate-700 h-[80px]"
                />
                <div className="flex justify-between items-center text-[9px] text-slate-400">
                  <span>{(data.trace_from || '').length} / 20 min</span>
                  <span className={`${1000 - (data.trace_from || '').length <= 15 ? 'text-amber-600 font-bold animate-pulse' : 'text-slate-400'}`}>
                    {1000 - (data.trace_from || '').length} characters remaining (max 1000 chars)
                  </span>
                </div>
              </div>

              {/* UPLOAD SUPPORTING FILES (for trace from) */}
              {renderFieldInput('Upload Supporting Files', 'file_trace_from')}

              {/* CHANGE DATE CLOSE * */}
              <div className="space-y-[4px] relative">
                <label className="block text-[10px] font-bold text-slate-655 uppercase tracking-wider">
                  Change Date Close <span className="text-rose-500">*</span>
                </label>
                <CustomDatePicker
                  value={data.date_close ? formatDateToDDMMYYYY(data.date_close) : ''}
                  placeholder="dd/mm/yyyy"
                  onChange={(val) => setData({ ...data, date_close: convertDDMMYYYYToYYYYMMDD(val) })}
                  readOnly={true}
                  inputClassName="w-full pl-[12px] pr-[32px] py-[8px] border border-slate-200 bg-slate-50 rounded-[6px] text-[12px] font-medium text-slate-700 outline-none focus:border-[#0066cc] focus:ring-4 focus:ring-[#0066cc]/10 transition-all duration-200"
                  buttonClassName="right-[12px] top-[10px]"
                />
              </div>

              {/* CLOSED QUANTITY */}
              <div className="space-y-[4px] relative">
                <label className="block text-[10px] font-bold text-slate-655 uppercase tracking-wider">
                  Closed Quantity
                </label>
                <input
                  type="number"
                  value={data.closed_quantity || ''}
                  disabled={data.change_type === 'Temporary' && (!data.date_close || data.date_close === 'N/A')}
                  onChange={(e) => setData({ ...data, closed_quantity: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-[6px] py-[8px] px-[12px] text-[12px] outline-none focus:border-[#0066cc] focus:ring-4 focus:ring-[#0066cc]/10 transition-all duration-200 text-slate-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>

              {/* PART TRACEABILITY DETAILS (TO CHANGES) * */}
              <div className="space-y-[4px]">
                <label className="block text-[10px] font-bold text-slate-655 uppercase tracking-wider">
                  Part Traceability Details (To Changes) <span className="text-rose-500">*</span>
                </label>
                <textarea
                  value={data.trace_to || ''}
                  maxLength={1000}
                  onChange={(e) => setData({ ...data, trace_to: e.target.value })}
                  placeholder="Describe the change — what, why, how, and expected outcome "
                  className="w-full bg-slate-50 border border-slate-200 rounded-[6px] py-[8px] px-[12px] text-[12px] outline-none focus:ring-4 focus:ring-[#0066cc]/10 focus:border-[#0066cc] transition-all duration-200 resize-none font-medium text-slate-700 h-[80px]"
                />
                <div className="flex justify-between items-center text-[9px] text-slate-400">
                  <span>{(data.trace_to || '').length} / 20 min</span>
                  <span className={`${1000 - (data.trace_to || '').length <= 15 ? 'text-amber-600 font-bold animate-pulse' : 'text-slate-400'}`}>
                    {1000 - (data.trace_to || '').length} characters remaining (max 1000 chars)
                  </span>
                </div>
              </div>

              {/* UPLOAD SUPPORTING FILES * (for trace to) */}
              {renderFieldInput('Upload Supporting Files *', 'file_trace_to')}

              {/* Dynamic Improvement Table Data edit field at bottom of timeline */}
              {renderFieldInput('Improvement Table Data', 'improvement_table_data')}
            </div>
          </div>

          {/* Risk Analysis Card */}
          <div className="bg-white border border-slate-200/60 rounded-xl p-6 shadow-sm hover:shadow-md transition-all duration-300 space-y-[16px]">
            <h4 className="text-[13px] font-bold text-slate-900 border-b border-slate-100 pb-[8px] flex items-center gap-1.5">
              <span>Risk Analysis</span>
            </h4>

            {/* RISK ANALYSIS * */}
            <div className="space-y-[4px]">
              <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                RISK ANALYSIS <span className="text-rose-500">*</span>
              </label>
              <textarea
                value={data.risk_analysis || ''}
                maxLength={1000}
                onChange={(e) => setData({ ...data, risk_analysis: e.target.value })}
                placeholder="Describe potential risks, their likelihood, impact, and mitigation measures..."
                className="w-full bg-slate-50 border border-slate-200 rounded-[6px] py-[8px] px-[12px] text-[12px] outline-none focus:ring-4 focus:ring-[#0066cc]/10 focus:border-[#0066cc] transition-all duration-200 resize-none font-medium text-slate-700 h-[100px]"
              />
              <div className="flex justify-end text-[9px] text-slate-400 mt-1">
                <span className={`${1000 - (data.risk_analysis || '').length <= 15 ? 'text-amber-600 font-bold animate-pulse' : 'text-slate-400'}`}>
                  {1000 - (data.risk_analysis || '').length} characters remaining (max 1000 chars)
                </span>
              </div>
            </div>

            {/* UPLOAD SUPPORTING FILES * (file_risk) */}
            <div className="space-y-[4px]">
              <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                UPLOAD SUPPORTING FILES <span className="text-rose-500">*</span>
              </label>
              <div className="flex gap-[8px]">
                <div className="relative flex-1">
                  <input
                    type="text"
                    readOnly
                    placeholder="e.g. proof-log.pdf, image.png"
                    className="w-full bg-slate-50 border border-slate-200 rounded-[6px] py-[8px] pl-[12px] pr-[28px] text-[12px] outline-none text-slate-700 select-none font-medium placeholder-slate-400"
                    value={data.file_risk || ''}
                  />
                  {data.file_risk && data.file_risk !== '-' && (
                    <button
                      type="button"
                      onClick={() => {
                        setDeleteConfirm({
                          title: 'Clear Attachments?',
                          message: 'Are you sure you want to clear all attachments from this field?',
                          onConfirm: () => {
                            setData({ ...data, file_risk: '' });
                            setUploadedFilesList(prev => prev.filter(f => f.fieldName !== 'file_risk'));
                          }
                        });
                      }}
                      className="absolute right-[10px] top-[10px] text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                      title="Clear attachments"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>
                <label className="flex items-center justify-center gap-[6px] px-[12px] py-[8px] border border-slate-200 bg-white hover:bg-slate-50 text-[#0066cc] rounded-[6px] text-[11px] font-bold shadow-sm transition-all cursor-pointer select-none">
                  <Upload size={12} />
                  <span>Upload</span>
                  <input
                    type="file"
                    multiple
                    accept="image/*,application/pdf"
                    className="hidden"
                    onChange={async (e) => {
                      const target = e.target;
                      if (target.files && target.files.length > 0) {
                        const files = Array.from(target.files);
                        const MAX_SIZE = 100 * 1024 * 1024; // 100MB
                        const tooLargeFiles = files.filter(f => f.size > MAX_SIZE);

                        if (tooLargeFiles.length > 0) {
                          setToastMsg({ text: `Upload not allowed: File(s) exceed 100MB limit: ${tooLargeFiles.map(f => f.name).join(', ')}`, isError: true });
                          target.value = '';
                          return;
                        }

                        const names = files.map(f => f.name.replace(/,/g, '_'));
                        target.value = '';

                        const base64Files = await Promise.all(
                          files.map(async (file) => {
                            const name = file.name.replace(/,/g, '_');
                            const localUrl = URL.createObjectURL(file);
                            setFileUrls(prev => ({ ...prev, [name]: localUrl }));
                            setFileTypes(prev => ({ ...prev, [name]: file.type || 'application/octet-stream' }));

                            return {
                              name,
                              type: file.type || 'application/octet-stream',
                              data: await fileToBase64(file),
                              fieldName: 'file_risk'
                            };
                          })
                        );

                        setUploadedFilesList(prev => {
                          const filtered = prev.filter(f => !(f.fieldName === 'file_risk' && names.includes(f.name)));
                          return [...filtered, ...base64Files];
                        });

                        const existing = data.file_risk && data.file_risk !== '-' ? data.file_risk.split(',').map(s => s.trim()).filter(Boolean) : [];
                        const updated = Array.from(new Set([...existing, ...names])).join(', ');
                        setData({ ...data, file_risk: updated });
                      }
                    }}
                  />
                </label>
              </div>
              {/* Selected File Pills */}
              {data.file_risk && data.file_risk !== '-' && (
                <div className="flex flex-wrap gap-[6px] pt-[4px]">
                  {data.file_risk.split(',').map(s => s.trim()).filter(Boolean).map((file, i) => (
                    <span key={i} className="inline-flex items-center gap-[6px] bg-slate-100 border border-slate-200 text-[10px] font-medium text-slate-700 px-[8px] py-[2px] rounded-full select-none">
                      <span
                        className="truncate max-w-[150px] font-semibold text-[#0066cc] cursor-pointer hover:underline"
                        onClick={() => handleViewAttachment(file, data.change_no || data.changeNo || selectedLog.changeNo, 'L1')}
                        title="Click to preview file"
                      >
                        📎 {file}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setDeleteConfirm({
                            title: 'Delete Attachment?',
                            message: `Are you sure you want to delete "${file}"?`,
                            onConfirm: () => {
                              const existing = data.file_risk.split(',').map(s => s.trim()).filter(Boolean);
                              const updated = existing.filter(f => f !== file).join(', ');
                              setData({ ...data, file_risk: updated });
                              setUploadedFilesList(prev => prev.filter(f => !(f.fieldName === 'file_risk' && f.name === file)));
                            }
                          });
                        }}
                        className="text-slate-400 hover:text-rose-600 font-bold ml-[2px] cursor-pointer text-[12px]"
                      >
                        &times;
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* UPDATE IN SOP / WI / CONTROL PLAN / FMEA * */}
            <div className="space-y-[4px]">
              <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                UPDATE IN SOP / WI / CONTROL PLAN / FMEA <span className="text-rose-500">*</span>
              </label>
              <textarea
                value={data.sop_update || ''}
                maxLength={1000}
                onChange={(e) => setData({ ...data, sop_update: e.target.value })}
                placeholder="Describe the updates required in SOP, Work Instructions, Control Plan, FMEA, etc..."
                className="w-full bg-slate-50 border border-slate-200 rounded-[6px] py-[8px] px-[12px] text-[12px] outline-none focus:ring-4 focus:ring-[#0066cc]/10 focus:border-[#0066cc] transition-all duration-200 resize-none font-medium text-slate-700 h-[100px]"
              />
              <div className="flex justify-end text-[9px] text-slate-400 mt-1">
                <span className={`${1000 - (data.sop_update || '').length <= 15 ? 'text-amber-600 font-bold animate-pulse' : 'text-slate-400'}`}>
                  {1000 - (data.sop_update || '').length} characters remaining (max 1000 chars)
                </span>
              </div>
            </div>

            {/* UPLOAD SUPPORTING FILES (SOP, WI, CONTROL PLAN, FMEA) * */}
            <div className="space-y-[4px]">
              <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                UPLOAD SUPPORTING FILES (SOP, WI, CONTROL PLAN, FMEA) <span className="text-rose-500">*</span>
              </label>
              <div className="flex gap-[8px]">
                <div className="relative flex-1">
                  <input
                    type="text"
                    readOnly
                    placeholder="e.g. proof-log.pdf, image.png"
                    className="w-full bg-slate-50 border border-slate-200 rounded-[6px] py-[8px] pl-[12px] pr-[28px] text-[12px] outline-none text-slate-700 select-none font-medium placeholder-slate-400"
                    value={data.file_sop || ''}
                  />
                  {data.file_sop && data.file_sop !== '-' && (
                    <button
                      type="button"
                      onClick={() => {
                        setDeleteConfirm({
                          title: 'Clear Attachments?',
                          message: 'Are you sure you want to clear all attachments from this field?',
                          onConfirm: () => {
                            setData({ ...data, file_sop: '' });
                            setUploadedFilesList(prev => prev.filter(f => f.fieldName !== 'file_sop'));
                          }
                        });
                      }}
                      className="absolute right-[10px] top-[10px] text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                      title="Clear attachments"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>
                <label className="flex items-center justify-center gap-[6px] px-[12px] py-[8px] border border-slate-200 bg-white hover:bg-slate-50 text-[#0066cc] rounded-[6px] text-[11px] font-bold shadow-sm transition-all cursor-pointer select-none">
                  <Upload size={12} />
                  <span>Upload</span>
                  <input
                    type="file"
                    multiple
                    accept="image/*,application/pdf"
                    className="hidden"
                    onChange={async (e) => {
                      const target = e.target;
                      if (target.files && target.files.length > 0) {
                        const files = Array.from(target.files);
                        const MAX_SIZE = 100 * 1024 * 1024; // 100MB
                        const tooLargeFiles = files.filter(f => f.size > MAX_SIZE);

                        if (tooLargeFiles.length > 0) {
                          setToastMsg({ text: `Upload not allowed: File(s) exceed 100MB limit: ${tooLargeFiles.map(f => f.name).join(', ')}`, isError: true });
                          target.value = '';
                          return;
                        }

                        const names = files.map(f => f.name.replace(/,/g, '_'));
                        target.value = '';

                        const base64Files = await Promise.all(
                          files.map(async (file) => {
                            const name = file.name.replace(/,/g, '_');
                            const localUrl = URL.createObjectURL(file);
                            setFileUrls(prev => ({ ...prev, [name]: localUrl }));
                            setFileTypes(prev => ({ ...prev, [name]: file.type || 'application/octet-stream' }));

                            return {
                              name,
                              type: file.type || 'application/octet-stream',
                              data: await fileToBase64(file),
                              fieldName: 'file_sop'
                            };
                          })
                        );

                        setUploadedFilesList(prev => {
                          const filtered = prev.filter(f => !(f.fieldName === 'file_sop' && names.includes(f.name)));
                          return [...filtered, ...base64Files];
                        });

                        const existing = data.file_sop && data.file_sop !== '-' ? data.file_sop.split(',').map(s => s.trim()).filter(Boolean) : [];
                        const updated = Array.from(new Set([...existing, ...names])).join(', ');
                        setData({ ...data, file_sop: updated });
                      }
                    }}
                  />
                </label>
              </div>
              {/* Selected File Pills */}
              {data.file_sop && data.file_sop !== '-' && (
                <div className="flex flex-wrap gap-[6px] pt-[4px]">
                  {data.file_sop.split(',').map(s => s.trim()).filter(Boolean).map((file, i) => (
                    <span key={i} className="inline-flex items-center gap-[6px] bg-slate-100 border border-slate-200 text-[10px] font-medium text-slate-700 px-[8px] py-[2px] rounded-full select-none">
                      <span
                        className="truncate max-w-[150px] font-semibold text-[#0066cc] cursor-pointer hover:underline"
                        onClick={() => handleViewAttachment(file, data.change_no || data.changeNo || selectedLog.changeNo, 'L1')}
                        title="Click to preview file"
                      >
                        📎 {file}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setDeleteConfirm({
                            title: 'Delete Attachment?',
                            message: `Are you sure you want to delete "${file}"?`,
                            onConfirm: () => {
                              const existing = data.file_sop.split(',').map(s => s.trim()).filter(Boolean);
                              const updated = existing.filter(f => f !== file).join(', ');
                              setData({ ...data, file_sop: updated });
                              setUploadedFilesList(prev => prev.filter(f => !(f.fieldName === 'file_sop' && f.name === file)));
                            }
                          });
                        }}
                        className="text-slate-400 hover:text-rose-600 font-bold ml-[2px] cursor-pointer text-[12px]"
                      >
                        &times;
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* USER DEPT HOD APPROVAL * */}
            <div className="space-y-[4px]">
              <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                USER DEPT HOD APPROVAL <span className="text-rose-500">*</span>
              </label>
              <div className="flex flex-wrap gap-[8px] pt-[2px]">
                {(dbDepartments && dbDepartments.length > 0 ? dbDepartments : [
                  'PED', 'QAD', 'Production', 'Maintenance', 'PC & L',
                  'Materials', 'Marketing', 'HR', 'Safety', 'General',
                  'Unit Head'
                ]).map((dept) => {
                  const isSelected = data.hod_approval && data.hod_approval.trim().toUpperCase() === dept.trim().toUpperCase();
                  return (
                    <button
                      key={dept}
                      type="button"
                      disabled={true}
                      className={`flex items-center gap-[6px] px-[10px] py-[6px] border rounded-[6px] text-[10px] font-bold transition-all duration-200 cursor-not-allowed select-none ${isSelected
                        ? 'border-[#0066cc]/60 bg-[#0066cc]/5 text-[#0066cc]/80 shadow-sm'
                        : 'border-slate-100 bg-slate-50/50 text-slate-400'
                        }`}
                    >
                      <span className={`w-[12px] h-[12px] rounded-full border flex items-center justify-center transition-all ${isSelected ? 'border-[#0066cc]/60' : 'border-slate-200'
                        }`}>
                        {isSelected && <span className="w-[6px] h-[6px] rounded-full bg-[#0066cc]/80" />}
                      </span>
                      <span>{dept}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* CUSTOMER APPROVAL REQUIRED * */}
            <div className="space-y-[4px]">
              <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                CUSTOMER APPROVAL REQUIRED <span className="text-rose-500">*</span>
              </label>
              <select
                value={data.customer_approval || ''}
                onChange={(e) => setData({ ...data, customer_approval: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-[6px] py-[8px] px-[12px] text-[12px] outline-none focus:border-[#0066cc] focus:ring-4 focus:ring-[#0066cc]/10 transition-all duration-200 text-slate-700 font-medium cursor-pointer"
              >
                <option value="">— Select —</option>
                <option value="Yes">Yes</option>
                <option value="No">No</option>
              </select>
            </div>
          </div>


        </div>
      );
    }

    if (tab === 'l2') {
      return (
        <div className="bg-white border border-slate-200/60 rounded-xl p-6 shadow-sm hover:shadow-md transition-all duration-300 space-y-[20px] animate-fade-in-up">
          <h4 className="text-[13px] font-bold text-slate-900 border-b border-slate-100 pb-[8px] flex items-center gap-1.5">
            <CheckCircle2 size={14} className="text-[#0066cc]" />
            <span>L2 Validation Details</span>
          </h4>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-[16px] bg-slate-50 border border-slate-150 rounded-[10px] p-[16px]">
            {renderFieldInput('Validation Date', 'date')}
            {renderFieldInput('Validated By', 'requester')}
            {renderFieldInput('Validation Status', 'status')}
            {renderFieldInput('Change No', 'changeNo', { disabled: true })}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-[16px]">
            {renderFieldInput('PED Validation Attachment', 'weldTest')}
            {renderFieldInput('QAD Setup Verification Attachment', 'qaTest')}
          </div>

          <div className="mt-4 pt-4 border-t border-slate-100">
            {renderFieldInput('Validator Remarks / Comments', 'remarks', { type: 'textarea' })}
          </div>


        </div>
      );
    }

    if (tab === 'l3') {
      return (
        <div className="bg-white border border-slate-200/60 rounded-xl p-6 shadow-sm hover:shadow-md transition-all duration-300 space-y-[20px] animate-fade-in-up">
          <h4 className="text-[13px] font-bold text-slate-900 border-b border-slate-100 pb-[8px] flex items-center gap-1.5">
            <Cpu size={14} className="text-[#0066cc]" />
            <span>L3 Approval Status Matrix</span>
          </h4>

          {/* Metadata */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-[16px] pb-[16px] border-b border-slate-100">
            {renderFieldInput('4M Change No', 'changeNo', { disabled: true })}
            {renderFieldInput('Change Request By', 'requester', { disabled: true })}
            {renderFieldInput('Requested Date', 'date', { disabled: true })}
          </div>

          {/* Matrix Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-[12px]">
            {renderFieldInput('PED', 'ped')}
            {renderFieldInput('QAD', 'qad')}
            {renderFieldInput('Production', 'production')}
            {renderFieldInput('Maintenance', 'maintenance')}
            {renderFieldInput('PC & L', 'pcl')}
            {renderFieldInput('Materials', 'materials')}
            {renderFieldInput('Marketing', 'marketing')}
            {renderFieldInput('HR', 'hr')}
            {renderFieldInput('Safety', 'safety')}
            {renderFieldInput('Unit Head', 'unitHead')}
          </div>


        </div>
      );
    }

    return (
      <div className="bg-white border border-slate-200/60 rounded-xl p-6 shadow-sm hover:shadow-md transition-all duration-300 space-y-[16px] animate-fade-in-up">
        <h4 className="text-[13px] font-bold text-slate-900 border-b border-slate-100 pb-[8px] flex items-center gap-1.5">
          <FileText size={14} className="text-[#0066cc]" /> {tab === 'l2' ? 'Validation Details' : 'Approval Details'}
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-[16px]">
          {Object.keys(data).map((key) => {
            if (['id', 'change_no', 'changeNo'].includes(key)) return null;
            return renderFieldInput(key.replace(/_/g, ' '), key);
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-[32px] animate-fade-in-up">
      {/* KPIs Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-[20px]">
        {/* Total Requests */}
        <div className="bg-white border border-slate-200/60 rounded-xl p-5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-full h-[3px] bg-[#0066cc]" />
          <div className="flex justify-between items-start">
            <div>
              <h4 className="text-[11.5px] font-bold text-slate-400 uppercase tracking-wider font-sans h-[36px] flex items-center">Total Requests</h4>
              <div className="text-[32px] font-bold text-slate-900 mt-2 font-heading tracking-tight">
                {isFetchingChanges || isFetchingCounts ? <Loader2 className="animate-spin text-slate-400" size={24} /> : totalCount}
              </div>
            </div>
            <div className="p-2.5 bg-[#e6f0fa] text-[#0066cc] rounded-lg group-hover:scale-110 transition-transform duration-300">
              <BarChart3 size={20} />
            </div>
          </div>
        </div>

        {/* Approved */}
        <div className="bg-white border border-slate-200/60 rounded-xl p-5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-full h-[3px] bg-emerald-500" />
          <div className="flex justify-between items-start">
            <div>
              <h4 className="text-[11.5px] font-bold text-slate-400 uppercase tracking-wider font-sans h-[36px] flex items-center">L3 Approved</h4>
              <div className="text-[32px] font-bold text-emerald-600 mt-2 font-heading tracking-tight">
                {isFetchingChanges || isFetchingCounts ? <Loader2 className="animate-spin text-slate-400" size={24} /> : approvedCount}
              </div>
            </div>
            <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-lg group-hover:scale-110 transition-transform duration-300">
              <CheckCircle size={20} />
            </div>
          </div>
        </div>

        {/* Pending Approval */}
        <div className="bg-white border border-slate-200/60 rounded-xl p-5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-full h-[3px] bg-amber-500" />
          <div className="flex justify-between items-start">
            <div>
              <h4 className="text-[11.5px] font-bold text-slate-400 uppercase tracking-wider font-sans h-[36px] flex items-center">Pending Approval</h4>
              <div className="text-[32px] font-bold text-amber-600 mt-2 font-heading tracking-tight">
                {isFetchingChanges || isFetchingCounts ? <Loader2 className="animate-spin text-slate-400" size={24} /> : pendingCount}
              </div>
            </div>
            <div className="p-2.5 bg-amber-50 text-amber-600 rounded-lg group-hover:scale-110 transition-transform duration-300">
              <Clock size={20} />
            </div>
          </div>
        </div>

        {/* Rejected */}
        <div className="bg-white border border-slate-200/60 rounded-xl p-5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-full h-[3px] bg-rose-500" />
          <div className="flex justify-between items-start">
            <div>
              <h4 className="text-[11.5px] font-bold text-slate-400 uppercase tracking-wider font-sans h-[36px] flex items-center">Rejected</h4>
              <div className="text-[32px] font-bold text-rose-600 mt-2 font-heading tracking-tight">
                {isFetchingChanges || isFetchingCounts ? <Loader2 className="animate-spin text-slate-400" size={24} /> : rejectedCount}
              </div>
            </div>
            <div className="p-2.5 bg-rose-50 text-rose-600 rounded-lg group-hover:scale-110 transition-transform duration-300">
              <ShieldAlert size={20} />
            </div>
          </div>
        </div>

        {/* Closed */}
        <div className="bg-white border border-slate-200/60 rounded-xl p-5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-full h-[3px] bg-indigo-500" />
          <div className="flex justify-between items-start">
            <div>
              <h4 className="text-[11.5px] font-bold text-slate-400 uppercase tracking-wider font-sans h-[36px] flex items-center">Effective Closed</h4>
              <div className="text-[32px] font-bold text-indigo-600 mt-2 font-heading tracking-tight">
                {isFetchingChanges || isFetchingCounts ? <Loader2 className="animate-spin text-slate-400" size={24} /> : closedCount}
              </div>
            </div>
            <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-lg group-hover:scale-110 transition-transform duration-300">
              <CheckCheck size={20} />
            </div>
          </div>
        </div>
      </div>

      {/* Analytics Main Section */}
      <div className="space-y-[20px]">
        {/* Plant Change Analytics Title Header */}
        <div className="flex justify-between items-center flex-wrap gap-[12px]">
          <div className="flex items-center gap-[8px]">
            <h3 className="font-heading text-[18px] font-bold text-slate-900">Plant Change Analytics</h3>
            <BarChart3 size={18} className="text-slate-400" />
          </div>

          <div className="flex items-center gap-[12px]">
            {/* Show tab segments ONLY in Tab View mode */}
            {!isGridView && (
              <div className="flex flex-wrap items-center justify-center bg-slate-100 p-[4px] rounded-[6px] border border-slate-200 gap-y-1">
                {['Department', 'Process', '6M Category', 'Monthly', 'Approval Status', 'Improvement Benefits'].map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveAnalyticsTab(tab)}
                    className={`px-[12px] py-[6px] text-[11px] font-bold rounded-[4px] transition-all cursor-pointer ${activeAnalyticsTab === tab
                      ? 'bg-white text-[#1e60aa] shadow-sm'
                      : 'text-slate-500 hover:text-slate-800'
                      }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>
            )}

            {/* View Mode Toggle button */}
            <button
              onClick={() => setIsGridView(!isGridView)}
              className="flex items-center gap-[6px] border border-slate-200 bg-white hover:bg-slate-50 px-[12px] py-[6px] rounded-[6px] text-[11px] font-bold text-slate-600 transition-all cursor-pointer"
            >
              <LayoutGrid size={12} />
              <span>{isGridView ? 'Tab View' : 'Grid View'}</span>
            </button>
          </div>
        </div>

        {/* Toggleable Layout modes */}
        {!isGridView ? (
          /* TAB VIEW (Single Chart Layout) */
          <div className="bg-white border border-slate-200/60 rounded-xl p-6 shadow-sm hover:shadow-md transition-all duration-300 space-y-[20px]">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h4 className="text-[14px] font-bold text-slate-800">
                {activeAnalyticsTab === 'Department' && 'Department Wise Change'}
                {activeAnalyticsTab === 'Process' && 'Process Wise Change'}
                {activeAnalyticsTab === '6M Category' && '6M Category Change'}
                {activeAnalyticsTab === 'Monthly' && 'Monthly Change'}
                {activeAnalyticsTab === 'Approval Status' && 'Overall Change Approval Status'}
                {activeAnalyticsTab === 'Improvement Benefits' && 'Improvement Benefits'}
              </h4>
              <div className="flex items-center gap-[8px]">
                {isTabFilterApplied(activeAnalyticsTab) && (
                  <button
                    onClick={() => resetTabFilters(activeAnalyticsTab)}
                    className="flex items-center gap-1 px-2.5 py-1.5 text-rose-600 hover:text-rose-700 bg-rose-50 border border-rose-100 hover:border-rose-200 rounded-lg text-xs font-bold transition-all cursor-pointer font-sans shadow-sm"
                  >
                    <X size={12} />
                    <span>Reset Filters</span>
                  </button>
                )}
                <button
                  onClick={handleExportActiveTab}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0066cc] hover:bg-[#0052a3] text-white rounded-lg text-xs font-bold transition-all shadow-sm cursor-pointer font-sans"
                  title={`Export ${activeAnalyticsTab} Analytics to PDF`}
                >
                  <Download size={12} />
                  <span>Export PDF</span>
                </button>
              </div>
            </div>

            {/* Render filter block based on selected analytics tab */}
            {renderFiltersForTab(activeAnalyticsTab)}

            {/* Render selected chart */}
            {activeAnalyticsTab === 'Department' && (
              isDateRangeIncomplete(deptFilterFromDate, deptFilterToDate)
                ? renderDateRangePlaceholder()
                : renderDepartmentChart(getFilteredData(deptFilterMonth, deptFilterFromDate, deptFilterToDate, deptFilterPerson, deptFilterProcess, deptFilterMachine))
            )}
            {activeAnalyticsTab === 'Process' && (
              isDateRangeIncomplete(procFilterFromDate, procFilterToDate)
                ? renderDateRangePlaceholder()
                : renderProcessChart(getFilteredData(procFilterMonth, procFilterFromDate, procFilterToDate, procFilterPerson, procFilterProcess, procFilterMachine))
            )}
            {activeAnalyticsTab === '6M Category' && (
              isDateRangeIncomplete(catFilterFromDate, catFilterToDate)
                ? renderDateRangePlaceholder()
                : renderCategoryChart(getFilteredData(catFilterMonth, catFilterFromDate, catFilterToDate, catFilterPerson, catFilterProcess, catFilterMachine))
            )}
            {activeAnalyticsTab === 'Monthly' && (
              isDateRangeIncomplete(monthFilterFromDate, monthFilterToDate)
                ? renderDateRangePlaceholder()
                : renderMonthlyChart(getFilteredData(monthFilterMonth, monthFilterFromDate, monthFilterToDate, monthFilterPerson, monthFilterProcess, monthFilterMachine))
            )}
            {activeAnalyticsTab === 'Approval Status' && (
              isDateRangeIncomplete(apprFilterFromDate, apprFilterToDate)
                ? renderDateRangePlaceholder()
                : renderApprovalStatusChart(getFilteredData(apprFilterMonth, apprFilterFromDate, apprFilterToDate, 'All', 'All', 'All', apprFilterStatus))
            )}
            {activeAnalyticsTab === 'Improvement Benefits' && renderImprovementBenefits()}
          </div>
        ) : (
          /* GRID VIEW (2x2 smaller charts + 1 full-width chart layout) */
          <div className="space-y-[20px]">
            {/* 2x2 Grid of 4 Smaller Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-[20px]">
              {/* 1. Department Wise Change */}
              <div className="bg-white border border-slate-200/60 rounded-xl p-6 shadow-sm hover:shadow-md transition-all duration-300 space-y-[16px]">
                <div className="flex items-center justify-between">
                  <h4 className="text-[13px] font-bold text-slate-800">Department Wise Change</h4>
                  <div className="flex items-center gap-2">
                    {isDeptFilterApplied && (
                      <button
                        onClick={resetDeptFilters}
                        className="flex items-center gap-0.5 px-2 py-0.5 text-rose-600 hover:text-rose-700 bg-rose-50 border border-rose-100 hover:border-rose-200 rounded text-[10px] font-bold transition-all cursor-pointer font-sans"
                      >
                        <X size={10} />
                        <span>Reset</span>
                      </button>
                    )}
                    <button
                      onClick={() => handleExportSpecificTab('Department')}
                      className="text-[#0066cc] hover:text-[#0052a3] p-1 transition-colors cursor-pointer"
                      title="Export Department Analytics to PDF"
                    >
                      <Download size={14} />
                    </button>
                    <GitBranch size={14} className="text-slate-400" />
                  </div>
                </div>
                {renderFiltersForTab('Department')}
                {isDateRangeIncomplete(deptFilterFromDate, deptFilterToDate)
                  ? renderDateRangePlaceholder()
                  : renderDepartmentChart(getFilteredData(deptFilterMonth, deptFilterFromDate, deptFilterToDate, deptFilterPerson, deptFilterProcess, deptFilterMachine), 'h-[140px]')}
              </div>

              {/* 2. Process Wise Change */}
              <div className="bg-white border border-slate-200/60 rounded-xl p-6 shadow-sm hover:shadow-md transition-all duration-300 space-y-[16px]">
                <div className="flex items-center justify-between">
                  <h4 className="text-[13px] font-bold text-slate-800">Process Wise Change</h4>
                  <div className="flex items-center gap-2">
                    {isProcFilterApplied && (
                      <button
                        onClick={resetProcFilters}
                        className="flex items-center gap-0.5 px-2 py-0.5 text-rose-600 hover:text-rose-700 bg-rose-50 border border-rose-100 hover:border-rose-200 rounded text-[10px] font-bold transition-all cursor-pointer font-sans"
                      >
                        <X size={10} />
                        <span>Reset</span>
                      </button>
                    )}
                    <button
                      onClick={() => handleExportSpecificTab('Process')}
                      className="text-[#0066cc] hover:text-[#0052a3] p-1 transition-colors cursor-pointer"
                      title="Export Process Analytics to PDF"
                    >
                      <Download size={14} />
                    </button>
                    <Settings size={14} className="text-slate-400" />
                  </div>
                </div>
                {renderFiltersForTab('Process')}
                {isDateRangeIncomplete(procFilterFromDate, procFilterToDate)
                  ? renderDateRangePlaceholder()
                  : renderProcessChart(getFilteredData(procFilterMonth, procFilterFromDate, procFilterToDate, procFilterPerson, procFilterProcess, procFilterMachine), 'h-[140px]')}
              </div>

              {/* 3. 6M Category Change */}
              <div className="bg-white border border-slate-200/60 rounded-xl p-6 shadow-sm hover:shadow-md transition-all duration-300 space-y-[16px]">
                <div className="flex items-center justify-between">
                  <h4 className="text-[13px] font-bold text-slate-800">6M Category Change</h4>
                  <div className="flex items-center gap-2">
                    {isCatFilterApplied && (
                      <button
                        onClick={resetCatFilters}
                        className="flex items-center gap-0.5 px-2 py-0.5 text-rose-600 hover:text-rose-700 bg-rose-50 border border-rose-100 hover:border-rose-200 rounded text-[10px] font-bold transition-all cursor-pointer font-sans"
                      >
                        <X size={10} />
                        <span>Reset</span>
                      </button>
                    )}
                    <button
                      onClick={() => handleExportSpecificTab('6M Category')}
                      className="text-[#0066cc] hover:text-[#0052a3] p-1 transition-colors cursor-pointer"
                      title="Export 6M Category Analytics to PDF"
                    >
                      <Download size={14} />
                    </button>
                    <Layers size={14} className="text-slate-400" />
                  </div>
                </div>
                {renderFiltersForTab('6M Category')}
                {isDateRangeIncomplete(catFilterFromDate, catFilterToDate)
                  ? renderDateRangePlaceholder()
                  : renderCategoryChart(getFilteredData(catFilterMonth, catFilterFromDate, catFilterToDate, catFilterPerson, catFilterProcess, catFilterMachine), 'h-[140px]')}
              </div>

              {/* 4. Monthly Change */}
              <div className="bg-white border border-slate-200/60 rounded-xl p-6 shadow-sm hover:shadow-md transition-all duration-300 space-y-[16px]">
                <div className="flex items-center justify-between">
                  <h4 className="text-[13px] font-bold text-slate-800">Monthly Change</h4>
                  <div className="flex items-center gap-2">
                    {isMonthFilterApplied && (
                      <button
                        onClick={resetMonthFilters}
                        className="flex items-center gap-0.5 px-2 py-0.5 text-rose-600 hover:text-rose-700 bg-rose-50 border border-rose-100 hover:border-rose-200 rounded text-[10px] font-bold transition-all cursor-pointer font-sans"
                      >
                        <X size={10} />
                        <span>Reset</span>
                      </button>
                    )}
                    <button
                      onClick={() => handleExportSpecificTab('Monthly')}
                      className="text-[#0066cc] hover:text-[#0052a3] p-1 transition-colors cursor-pointer"
                      title="Export Monthly Analytics to PDF"
                    >
                      <Download size={14} />
                    </button>
                    <Calendar size={14} className="text-slate-400" />
                  </div>
                </div>
                {renderFiltersForTab('Monthly')}
                {isDateRangeIncomplete(monthFilterFromDate, monthFilterToDate)
                  ? renderDateRangePlaceholder()
                  : renderMonthlyChart(getFilteredData(monthFilterMonth, monthFilterFromDate, monthFilterToDate, monthFilterPerson, monthFilterProcess, monthFilterMachine), 'h-[140px]')}
              </div>
            </div>

            {/* 5. Overall Change Approval Status (Full-width Card at bottom of Grid Mode) */}
            <div className="bg-white border border-slate-200/60 rounded-xl p-6 shadow-sm hover:shadow-md transition-all duration-300 space-y-[16px]">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-[8px]">
                  <h4 className="text-[13px] font-bold text-slate-800">Overall Change Approval Status</h4>
                  <ShieldAlert size={14} className="text-slate-400" />
                </div>
                {/* Legends & Export */}
                <div className="flex items-center gap-[16px] text-[10px] font-bold text-slate-500 select-none">
                  <div className="flex items-center gap-[12px]">
                    <div className="flex items-center gap-[4px]">
                      <span className="w-[8px] h-[8px] rounded-full bg-[#059669]" />
                      <span>L3 Approved</span>
                    </div>
                    <div className="flex items-center gap-[4px]">
                      <span className="w-[8px] h-[8px] rounded-full bg-[#2563eb]" />
                      <span>Closed</span>
                    </div>
                    <div className="flex items-center gap-[4px]">
                      <span className="w-[8px] h-[8px] rounded-full bg-[#dc2626]" />
                      <span>Rejected</span>
                    </div>
                    <div className="flex items-center gap-[4px]">
                      <span className="w-[8px] h-[8px] rounded-full bg-[#d97706]" />
                      <span>Pending</span>
                    </div>
                  </div>
                  {isApprFilterApplied && (
                    <button
                      onClick={resetApprFilters}
                      className="flex items-center gap-0.5 px-2 py-0.5 text-rose-600 hover:text-rose-700 bg-rose-50 border border-rose-100 hover:border-rose-200 rounded text-[10px] font-bold transition-all cursor-pointer font-sans"
                    >
                      <X size={10} />
                      <span>Reset</span>
                    </button>
                  )}
                  <button
                    onClick={() => handleExportSpecificTab('Approval Status')}
                    className="text-[#0066cc] hover:text-[#0052a3] p-1 transition-colors cursor-pointer"
                    title="Export Approval Status Analytics to PDF"
                  >
                    <Download size={14} />
                  </button>
                </div>
              </div>
              {renderFiltersForTab('Approval Status')}
              {isDateRangeIncomplete(apprFilterFromDate, apprFilterToDate)
                ? renderDateRangePlaceholder()
                : renderApprovalStatusChart(getFilteredData(apprFilterMonth, apprFilterFromDate, apprFilterToDate, 'All', 'All', 'All', apprFilterStatus), 'h-[180px]')}
            </div>

            {/* 6. Improvement Benefits (Full-width Card at bottom of Grid Mode) */}
            <div className="bg-white border border-slate-200/60 rounded-xl p-6 shadow-sm hover:shadow-md transition-all duration-300 space-y-[16px]">
              <div className="flex items-center justify-between border-b border-slate-100 pb-[8px] flex-wrap gap-2">
                <div className="flex items-center gap-[8px]">
                  <h4 className="text-[13px] font-bold text-slate-800">Improvement Benefits</h4>
                  <BarChart3 size={14} className="text-slate-400" />
                </div>
                <div className="flex items-center gap-2">
                  {isBenefitFilterApplied && (
                    <button
                      onClick={resetBenefitFilters}
                      className="flex items-center gap-1 px-2.5 py-1.5 text-rose-600 hover:text-rose-700 bg-rose-50 border border-rose-100 hover:border-rose-200 rounded-lg text-xs font-bold transition-all cursor-pointer font-sans shadow-sm"
                    >
                      <X size={12} />
                      <span>Reset Filters</span>
                    </button>
                  )}
                  <button
                    onClick={() => handleExportSpecificTab('Improvement Benefits')}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0066cc] hover:bg-[#0052a3] text-white rounded-lg text-xs font-bold transition-all shadow-sm cursor-pointer font-sans"
                    title="Export Improvement Benefits Report to PDF"
                  >
                    <Download size={12} />
                    <span>Export PDF</span>
                  </button>
                </div>
              </div>
              {renderImprovementBenefits()}
            </div>
          </div>
        )}
      </div>

      {/* Recent Change Requests Table */}
      <div className="bg-white border border-slate-200/60 rounded-xl shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden">
        <div className="p-[20px] border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div className="flex items-center gap-2">
            <h3 className="font-heading text-[18px] font-bold text-slate-900">Recent change requests</h3>
            <Clock size={18} className="text-slate-400" />
          </div>
          <div className="flex items-center gap-[12px] flex-wrap">
            <span className="bg-slate-100 border border-slate-200 text-slate-500 rounded-full px-[10px] py-[2px] text-[10px] font-bold select-none">
              Showing {Math.min(5, changes.length)} of {changes.length}
            </span>
            <button
              onClick={handleExportPDF}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0066cc] hover:bg-[#0052a3] text-white rounded-lg text-xs font-bold transition-all shadow-sm cursor-pointer font-sans"
              title="Export recent change requests to PDF"
            >
              <Download size={12} />
              <span>Export PDF</span>
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          {isFetchingChanges ? (
            <div className="flex flex-col items-center justify-center py-[64px] gap-[8px] text-slate-400">
              <Loader2 className="animate-spin text-[#0066cc]" size={28} />
              <span className="text-[14px]">Fetching changes...</span>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-150">
                  <th className="p-[16px] text-[11px] font-bold text-slate-500 uppercase tracking-wider">SL. NO.</th>
                  <th className="p-[16px] text-[11px] font-bold text-slate-500 uppercase tracking-wider">CHANGE NO.</th>
                  <th className="p-[16px] text-[11px] font-bold text-slate-500 uppercase tracking-wider">MACHINE NO.</th>
                  <th className="p-[16px] text-[11px] font-bold text-slate-500 uppercase tracking-wider">DEPARTMENT</th>
                  <th className="p-[16px] text-[11px] font-bold text-slate-500 uppercase tracking-wider">REQUEST DATE</th>
                  <th className="p-[16px] text-[11px] font-bold text-slate-500 uppercase tracking-wider">STATUS</th>
                  <th className="p-[16px] text-[11px] font-bold text-slate-500 uppercase tracking-wider">ACTION</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedTableRows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-[24px] text-slate-400 text-[13px]">
                      No recent change requests found.
                    </td>
                  </tr>
                ) : (
                  paginatedTableRows.map((r, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50">
                      <td className="p-[16px] text-[12px] text-slate-500 font-semibold">{r.slNo}</td>
                      <td className="p-[16px] text-[12px] font-bold text-[#0066cc] hover:underline cursor-pointer" onClick={() => handleViewDetails(r)}>{r.id}</td>
                      <td className="p-[16px] text-[12px] text-slate-600 font-medium">{r.machineNo}</td>
                      <td className="p-[16px] text-[12px] text-slate-600 font-medium">{r.department}</td>
                      <td className="p-[16px] text-[12px] text-slate-500">{r.date}</td>
                      <td className="p-[16px]">
                        <span className={`inline-flex items-center gap-[4px] px-[10px] py-[2px] rounded-full text-[11px] font-semibold border ${r.status?.startsWith('Pending') ? 'bg-amber-50 border-amber-200 text-amber-700' :
                          r.status === 'Approved' || r.status === 'L3 Approved' ? 'bg-emerald-50 border-emerald-250 text-emerald-700' :
                            r.status === 'Rejected' ? 'bg-rose-50 border-rose-250 text-rose-700' :
                              r.status === 'Closed' ? 'bg-blue-50 border-blue-200 text-blue-700' :
                                'bg-teal-50 border-teal-200 text-teal-700'
                          }`}>
                          {r.status}
                        </span>
                      </td>
                      <td className="p-[16px]">
                        <button
                          onClick={() => handleViewDetails(r)}
                          className="p-1.5 hover:bg-slate-100 hover:text-[#0066cc] text-slate-400 rounded-md transition-colors cursor-pointer"
                          title="View Details"
                        >
                          <Eye size={16} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Details Modal (L1, L2, L3 Tabs) */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-[16px]">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity"
            onClick={() => {
              if (isEditMode) {
                setIsEditMode(false);
                setUploadedFilesList([]);
              } else {
                setSelectedLog(null);
              }
            }}
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
                  <div className="flex items-center gap-2">
                    <h4 className="text-[15px] font-bold text-slate-900">Change Request Details (L1, L2, L3)</h4>
                    {canEdit && activeTab === 'l1' && (
                      <button
                        onClick={() => setIsEditMode(!isEditMode)}
                        className={`ml-3 px-3.5 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider transition-colors border ${isEditMode
                          ? 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                          : 'bg-[#0066cc] text-white border-[#0052a3] hover:bg-[#0052a3] shadow-[0_2px_6px_rgba(0,102,204,0.2)]'
                          }`}
                      >
                        {isEditMode ? 'Cancel Edit' : 'Edit Mode'}
                      </button>
                    )}
                    {isEditMode && (
                      <button
                        onClick={handleSaveEdits}
                        disabled={isSaving}
                        className="ml-2 px-3 py-1 bg-emerald-600 text-white rounded-full text-[10px] font-bold uppercase tracking-wider hover:bg-emerald-700 transition-colors flex items-center gap-1 disabled:opacity-50"
                      >
                        {isSaving ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
                        Save
                      </button>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">Tracking details for: <span className="font-mono font-bold text-slate-600">{selectedLog.changeNo}</span></p>
                </div>
              </div>
              <button
                onClick={() => {
                  if (isEditMode) {
                    setIsEditMode(false);
                    setUploadedFilesList([]);
                  } else {
                    setSelectedLog(null);
                  }
                }}
                className="p-[6px] hover:bg-slate-200/60 rounded-full text-slate-400 hover:text-slate-655 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Tabs Header */}
            <div className="flex h-11 border-b border-slate-200 bg-slate-50/50 shrink-0">
              <button
                onClick={() => { setActiveTab('l1'); setIsEditMode(false); }}
                className={`flex-1 h-full flex items-center justify-center text-[12px] font-bold border-b-2 transition-colors ${activeTab === 'l1'
                  ? 'border-[#0066cc] text-[#0066cc]'
                  : 'border-transparent text-slate-500 hover:text-slate-850'
                  }`}
              >
                1. L1 Request Details
              </button>
              {selectedL1Details?.hodStatus !== 'Rejected' && (
                <button
                  onClick={() => { setActiveTab('l2'); setIsEditMode(false); }}
                  className={`flex-1 h-full flex items-center justify-center text-[12px] font-bold border-b-2 transition-colors ${activeTab === 'l2'
                    ? 'border-[#0066cc] text-[#0066cc]'
                    : 'border-transparent text-slate-500 hover:text-slate-850'
                    }`}
                >
                  2. L2 Validation Details
                </button>
              )}
              {selectedL1Details?.hodStatus !== 'Rejected' && selectedL2Details?.status === 'Accepted' && (
                <button
                  onClick={() => { setActiveTab('l3'); setIsEditMode(false); }}
                  className={`flex-1 h-full flex items-center justify-center text-[12px] font-bold border-b-2 transition-colors ${activeTab === 'l3'
                    ? 'border-[#0066cc] text-[#0066cc]'
                    : 'border-transparent text-slate-500 hover:text-slate-850'
                    }`}
                >
                  3. L3 Approval Details
                </button>
              )}
              {selectedL1Details?.hodStatus !== 'Rejected' && selectedL2Details?.status === 'Accepted' && ((selectedLog?.status || '').toLowerCase() === 'completed' || selectedEffDetails !== null) && (
                <button
                  onClick={() => { setActiveTab('effectiveness'); setIsEditMode(false); }}
                  className={`flex-1 h-full flex items-center justify-center text-[12px] font-bold border-b-2 transition-colors ${activeTab === 'effectiveness'
                    ? (selectedEffDetails && (selectedEffDetails.qaApproval === 'Rejected' || selectedEffDetails.status === 'Effectiveness Not Ok' || selectedEffDetails.status === 'Rejected'))
                      ? 'border-rose-600 text-rose-600 font-extrabold bg-rose-50/30'
                      : 'border-[#0066cc] text-[#0066cc]'
                    : (selectedEffDetails && (selectedEffDetails.qaApproval === 'Rejected' || selectedEffDetails.status === 'Effectiveness Not Ok' || selectedEffDetails.status === 'Rejected'))
                      ? 'border-transparent text-rose-650 hover:text-rose-800 bg-rose-50/10'
                      : 'border-transparent text-slate-500 hover:text-slate-850'
                    }`}
                >
                  {(selectedEffDetails && (selectedEffDetails.qaApproval === 'Rejected' || selectedEffDetails.status === 'Effectiveness Not Ok' || selectedEffDetails.status === 'Rejected')) && (
                    <AlertTriangle size={12} className="text-rose-600 mr-1 animate-pulse" />
                  )}
                  4. Effectiveness
                </button>
              )}
            </div>

            {/* Content */}
            <div className={`p-[24px] overflow-y-auto space-y-[24px] text-[13px] text-slate-600 flex-1 ${isFetchingDetails ? 'flex flex-col justify-center items-center' : ''}`}>
              {isFetchingDetails ? (
                <div className="flex flex-col items-center justify-center py-[60px] gap-3 text-slate-400 my-auto">
                  <Loader2 className="animate-spin text-[#0066cc]" size={32} />
                  <span className="text-sm font-semibold text-slate-700">Loading Change Request details...</span>
                </div>
              ) : (
                <>
                  {activeTab === 'l1' && selectedL1Details && (
                    <div className="space-y-[20px]">
                      {isEditMode ? renderDynamicEditForm(editL1Data, setEditL1Data, 'l1') : (
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
                              {/* Column 1 */}
                              <div className="space-y-[12px]">
                                <div className="space-y-[4px]">
                                  <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Change Improvement Area</span>
                                  <span className="font-semibold text-slate-800 text-xs block mt-0.5">{selectedL1Details.improvement_area || '-'}</span>
                                </div>

                                <div className="space-y-[4px]">
                                  <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Upload Supporting Files (Improvement)</span>
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
                                  <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Opening Quantity</span>
                                  <span className="font-semibold text-slate-800 text-xs block mt-0.5">{selectedL1Details.opening_quantity || '-'}</span>
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

                              {/* Column 2 */}
                              <div className="space-y-[12px]">
                                <div className="space-y-[4px]">
                                  <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Change Date Close</span>
                                  <span className="font-semibold text-slate-750 flex items-center gap-1.5 mt-0.5">
                                    <Calendar size={13} className="text-slate-400" />
                                    {selectedL1Details.date_close ? formatDateToDDMMYYYY(selectedL1Details.date_close) : 'N/A'}
                                  </span>
                                </div>

                                <div className="space-y-[4px]">
                                  <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Closed Quantity</span>
                                  <span className="font-semibold text-slate-800 text-xs block mt-0.5">{selectedL1Details.closed_quantity || '-'}</span>
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
                                  <div className="bg-slate-50 px-3 py-2 border-b border-slate-200 text-[10px] font-bold text-slate-655 uppercase tracking-wider">
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

                          {/* Risk Analysis Card (Read-Only) */}
                          <div className="space-y-[16px] pt-4 border-t border-slate-100">
                            <h5 className="text-[13px] font-bold text-slate-900 border-b border-slate-100 pb-1.5 flex items-center gap-1.5">
                              <span>Risk Analysis</span>
                            </h5>

                            {/* RISK ANALYSIS */}
                            <div className="space-y-[4px] min-w-0">
                              <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">RISK ANALYSIS</span>
                              <div className="bg-slate-50 border border-slate-200 rounded-[8px] p-3 text-slate-700 min-h-[60px] leading-relaxed break-words text-[12px] font-medium">
                                {selectedL1Details.risk_analysis || '-'}
                              </div>
                            </div>

                            {/* UPLOAD SUPPORTING FILES (file_risk) */}
                            <div className="space-y-[4px] min-w-0">
                              <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">SUPPORTING FILES</span>
                              {selectedL1Details.file_risk && selectedL1Details.file_risk !== '-' ? (
                                renderL1FilePill(selectedL1Details.file_risk, selectedL1Details.change_no)
                              ) : (
                                <span className="text-[12px] text-slate-400 italic">No file attached</span>
                              )}
                            </div>

                            {/* UPDATE IN SOP / WI / CONTROL PLAN / FMEA */}
                            <div className="space-y-[4px] min-w-0">
                              <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">UPDATE IN SOP / WI / CONTROL PLAN / FMEA</span>
                              <div className="bg-slate-50 border border-slate-200 rounded-[8px] p-3 text-slate-700 min-h-[60px] leading-relaxed break-words text-[12px] font-medium">
                                {selectedL1Details.sop_update || '-'}
                              </div>
                            </div>

                            {/* UPLOAD SUPPORTING FILES (SOP, WI, CONTROL PLAN, FMEA) */}
                            <div className="space-y-[4px] min-w-0">
                              <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">SUPPORTING FILES (SOP, WI, CONTROL PLAN, FMEA)</span>
                              {selectedL1Details.file_sop && selectedL1Details.file_sop !== '-' ? (
                                renderL1FilePill(selectedL1Details.file_sop, selectedL1Details.change_no)
                              ) : (
                                <span className="text-[12px] text-slate-400 italic">No file attached</span>
                              )}
                            </div>

                            {/* USER DEPT HOD APPROVAL */}
                            <div className="space-y-[4px]">
                              <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">USER DEPT HOD APPROVAL</span>
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

                            {/* CUSTOMER APPROVAL REQUIRED */}
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

                            {/* HOD status and comments (if approved/rejected) */}
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
                  )}

                  {activeTab === 'l2' && (
                    !selectedL2Details ? (
                      <div className="text-center py-[64px] bg-slate-50 rounded-xl border border-dashed border-slate-200">
                        <AlertTriangle className="mx-auto mb-[12px] text-slate-300" size={32} />
                        <span className="text-slate-400 font-medium">No L2 Validation Details found for this request.</span>
                      </div>
                    ) : (
                      <div className="space-y-[20px]">
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
                            <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">PED Validation Attachment</span>
                            <div className="space-y-2">
                              {!selectedL2Details.weldTest || selectedL2Details.weldTest === '-' ? (
                                <div className="bg-slate-50 border border-slate-200 rounded-[8px] p-3 text-slate-550 text-[12px] font-medium">
                                  -
                                </div>
                              ) : (
                                selectedL2Details.weldTest.split(',').map(s => s.trim()).filter(Boolean).map((file, idx) => (
                                  <div key={idx} className="bg-slate-50 border border-slate-200 rounded-[8px] p-3 text-slate-700 flex items-center justify-between">
                                    <span className="font-medium text-slate-655 truncate max-w-[200px]" title={file}>
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
                            <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">QAD Setup Verification Attachment</span>
                            <div className="space-y-2">
                              {!selectedL2Details.qaTest || selectedL2Details.qaTest === '-' ? (
                                <div className="bg-slate-50 border border-slate-200 rounded-[8px] p-3 text-slate-550 text-[12px] font-medium">
                                  -
                                </div>
                              ) : (
                                selectedL2Details.qaTest.split(',').map(s => s.trim()).filter(Boolean).map((file, idx) => (
                                  <div key={idx} className="bg-slate-50 border border-slate-200 rounded-[8px] p-3 text-slate-700 flex items-center justify-between">
                                    <span className="font-medium text-slate-655 truncate max-w-[200px]" title={file}>
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
                          // Map label to the corresponding property in selectedLog safely
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
                          const isAccepted = status === 'Accepted' || status === 'Approved' || status === 'Acknowledge';
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
                          <div className="text-center py-[64px] bg-slate-50 rounded-xl border border-dashed border-slate-200 w-full animate-fade-in-up">
                            <AlertTriangle className="mx-auto mb-[12px] text-slate-350" size={32} />
                            <span className="text-slate-400 font-medium">Effectiveness monitoring log is pending creation/validation for this request.</span>
                          </div>
                        );
                      }

                      return (
                        <div className="space-y-[20px] animate-fade-in-up">
                          <h5 className="text-[12px] font-bold text-[#0066cc] uppercase tracking-wider border-b border-slate-100 pb-1.5 flex items-center gap-1.5 font-sans">
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
                                    : 'bg-rose-50 border-rose-200 text-rose-700'
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
                className="px-[16px] py-[8px] bg-white border border-slate-250 rounded-[6px] text-slate-655 hover:bg-slate-50 hover:text-slate-800 text-[12px] font-semibold transition-colors shadow-sm cursor-pointer"
              >
                Close Details
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Improvement Table Edit Modal */}
      {isTableModalOpen && ['cost', 'productivity', 'quality'].includes((editL1Data.improvement_area || '').toLowerCase()) && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-[16px]">
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsTableModalOpen(false)} />
          <div className="relative bg-white w-full max-w-[850px] rounded-[16px] shadow-2xl border border-slate-200 flex flex-col z-10 max-h-[85vh] overflow-hidden animate-fade-in-up">
            <div className="bg-slate-50 px-[24px] py-[16px] border-b border-slate-100 flex items-center justify-between rounded-t-[16px]">
              <h4 className="text-[14px] font-bold text-slate-800 uppercase tracking-wider">
                {(editL1Data.improvement_area || '').toLowerCase() === 'cost' ? 'Cost Saving Data Table' :
                  (editL1Data.improvement_area || '').toLowerCase() === 'productivity' ? 'Productivity Improvement Data Table' :
                    'Quality Improvement Data Table'}
              </h4>
              <button onClick={() => setIsTableModalOpen(false)} className="p-[4px] hover:bg-slate-200/60 rounded-full text-slate-400 hover:text-slate-655 transition-colors">
                <X size={18} />
              </button>
            </div>

            <div className="p-[24px] overflow-y-auto space-y-[16px]">
              <div className="overflow-x-auto w-full">
                <table className="w-full text-left border-collapse min-w-[650px] text-[12px]">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold">
                      <th className="p-[10px] w-[60px]">Sl No</th>
                      <th className="p-[10px] w-[150px]">4M #</th>
                      <th className="p-[10px] w-[160px]">Implementation Date</th>
                      {(editL1Data.improvement_area || '').toLowerCase() === 'cost' && (
                        <>
                          <th className="p-[10px]">Total Cost Saved / month (Rs)</th>
                          <th className="p-[10px]">Total Cost Saved / Annum (Rs)</th>
                          <th className="p-[10px]">ROI (Rs)</th>
                        </>
                      )}
                      {(editL1Data.improvement_area || '').toLowerCase() === 'productivity' && (
                        <>
                          <th className="p-[10px]">Current Productivity (nos)</th>
                          <th className="p-[10px]">Productivity Improved (nos)</th>
                        </>
                      )}
                      {(editL1Data.improvement_area || '').toLowerCase() === 'quality' && (
                        <>
                          <th className="p-[10px]">Current PPM</th>
                          <th className="p-[10px]">Reduced PPM</th>
                        </>
                      )}
                      <th className="p-[10px] w-[50px] text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {tempTableData.map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50">
                        <td className="p-[8px] font-bold text-slate-400 text-center">{idx + 1}</td>
                        <td className="p-[8px]">
                          <input
                            type="text"
                            value={row.changeNo || ''}
                            onChange={(e) => handleUpdateEditTableCell(idx, 'changeNo', e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-[6px] py-[6px] px-[10px] text-[11px] outline-none focus:border-[#0066cc]"
                          />
                        </td>
                        <td className="p-[8px]">
                          <CustomDatePicker
                            value={row.date || ''}
                            onChange={(val) => handleUpdateEditTableCell(idx, 'date', val)}
                            readOnly={true}
                            minDate={editL1Data.crDate ? formatDateToDDMMYYYY(editL1Data.crDate) : ''}
                            placeholder="dd/mm/yyyy"
                            inputClassName={`w-full bg-slate-50 border rounded-[6px] py-[6px] pl-[10px] pr-[24px] text-[11px] outline-none focus:border-[#0066cc] ${tableModalError && !row.date ? 'border-rose-500 bg-rose-50/10 focus:border-rose-500' : 'border-slate-200'
                              }`}
                            buttonClassName="right-[6px] top-[50%] -translate-y-1/2"
                          />
                        </td>
                        {(editL1Data.improvement_area || '').toLowerCase() === 'cost' && (
                          <>
                            <td className="p-[8px]">
                              <input
                                type="number"
                                placeholder="0"
                                value={row.monthlySave || ''}
                                onChange={(e) => handleUpdateEditTableCell(idx, 'monthlySave', e.target.value)}
                                className={`w-full bg-slate-50 border rounded-[6px] py-[6px] px-[10px] text-[11px] outline-none focus:border-[#0066cc] ${tableModalError && !row.monthlySave ? 'border-rose-500 bg-rose-50/10 focus:border-rose-500' : 'border-slate-200'
                                  }`}
                              />
                            </td>
                            <td className="p-[8px]">
                              <input
                                type="number"
                                placeholder="0"
                                value={row.annualSave || ''}
                                onChange={(e) => handleUpdateEditTableCell(idx, 'annualSave', e.target.value)}
                                className={`w-full bg-slate-50 border rounded-[6px] py-[6px] px-[10px] text-[11px] outline-none focus:border-[#0066cc] ${tableModalError && !row.annualSave ? 'border-rose-500 bg-rose-50/10 focus:border-rose-500' : 'border-slate-200'
                                  }`}
                              />
                            </td>
                            <td className="p-[8px]">
                              <input
                                type="number"
                                placeholder="0"
                                value={row.roi || ''}
                                onChange={(e) => handleUpdateEditTableCell(idx, 'roi', e.target.value)}
                                className={`w-full bg-slate-50 border rounded-[6px] py-[6px] px-[10px] text-[11px] outline-none focus:border-[#0066cc] ${tableModalError && !row.roi ? 'border-rose-500 bg-rose-50/10 focus:border-rose-500' : 'border-slate-200'
                                  }`}
                              />
                            </td>
                          </>
                        )}
                        {(editL1Data.improvement_area || '').toLowerCase() === 'productivity' && (
                          <>
                            <td className="p-[8px]">
                              <input
                                type="number"
                                placeholder="0"
                                value={row.currentProd || ''}
                                onChange={(e) => handleUpdateEditTableCell(idx, 'currentProd', e.target.value)}
                                className={`w-full bg-slate-50 border rounded-[6px] py-[6px] px-[10px] text-[11px] outline-none focus:border-[#0066cc] ${tableModalError && !row.currentProd ? 'border-rose-500 bg-rose-50/10 focus:border-rose-500' : 'border-slate-200'
                                  }`}
                              />
                            </td>
                            <td className="p-[8px]">
                              <input
                                type="number"
                                placeholder="0"
                                value={row.improvedProd || ''}
                                onChange={(e) => handleUpdateEditTableCell(idx, 'improvedProd', e.target.value)}
                                className={`w-full bg-slate-50 border rounded-[6px] py-[6px] px-[10px] text-[11px] outline-none focus:border-[#0066cc] ${tableModalError && !row.improvedProd ? 'border-rose-500 bg-rose-50/10 focus:border-rose-500' : 'border-slate-200'
                                  }`}
                              />
                            </td>
                          </>
                        )}
                        {(editL1Data.improvement_area || '').toLowerCase() === 'quality' && (
                          <>
                            <td className="p-[8px]">
                              <input
                                type="number"
                                placeholder="0"
                                value={row.currentPpm || ''}
                                onChange={(e) => handleUpdateEditTableCell(idx, 'currentPpm', e.target.value)}
                                className={`w-full bg-slate-50 border rounded-[6px] py-[6px] px-[10px] text-[11px] outline-none focus:border-[#0066cc] ${tableModalError && !row.currentPpm ? 'border-rose-500 bg-rose-50/10 focus:border-rose-500' : 'border-slate-200'
                                  }`}
                              />
                            </td>
                            <td className="p-[8px]">
                              <input
                                type="number"
                                placeholder="0"
                                value={row.reducedPpm || ''}
                                onChange={(e) => handleUpdateEditTableCell(idx, 'reducedPpm', e.target.value)}
                                className={`w-full bg-slate-50 border rounded-[6px] py-[6px] px-[10px] text-[11px] outline-none focus:border-[#0066cc] ${tableModalError && !row.reducedPpm ? 'border-rose-500 bg-rose-50/10 focus:border-rose-500' : 'border-slate-200'
                                  }`}
                              />
                            </td>
                          </>
                        )}
                        <td className="p-[8px] text-center">
                          <button
                            type="button"
                            onClick={() => handleDeleteEditTableRow(idx)}
                            className="p-[4px] hover:bg-slate-100 rounded text-slate-400 hover:text-rose-600 transition-colors"
                            title="Delete Row"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <button
                type="button"
                onClick={handleAddEditTableRow}
                className="flex items-center gap-[6px] px-[12px] py-[6px] border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 rounded-[6px] text-[11px] font-bold shadow-sm transition-colors cursor-pointer select-none w-fit"
              >
                <Plus size={12} />
                <span>Add Row</span>
              </button>
            </div>

            <div className="bg-slate-50 px-[24px] py-[14px] border-t border-slate-100 flex items-center justify-between gap-[12px]">
              <div className="text-rose-600 text-[11.5px] font-bold">
                {tableModalError && (
                  <span className="flex items-center gap-[6px]">
                    <AlertTriangle size={14} className="text-rose-500 shrink-0" />
                    {tableModalError}
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={handleEditTableDone}
                className="bg-[#0066cc] hover:bg-[#0052a3] text-white px-[20px] py-[8px] rounded-[6px] text-[12px] font-bold shadow-sm transition-colors cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Attachment Preview Modal */}
      {previewFile && (
        <div
          className="fixed inset-0 z-[60] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={handleClosePreview}
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
                onClick={handleClosePreview}
                className="text-slate-400 hover:text-slate-655 p-1 rounded hover:bg-slate-200 transition-colors cursor-pointer"
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
                          <div className="font-bold text-xs uppercase tracking-wider text-slate-450">India Nippon Electricals Limited</div>
                          <h3 className="font-extrabold text-base text-slate-900 mt-0.5">Change Request Attachment</h3>
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono text-right">
                          DOC: L1-ATT-VER<br />
                          REV: 03 (2026)
                        </div>
                      </div>
                      <div className="border-t border-slate-100 pt-3 space-y-2.5 text-xs text-slate-650">
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
                ) : previewFile.toLowerCase().match(/\.(jpg|jpeg|jfif|png|gif|webp|bmp|svg|tiff|tif|ico|heic|heic|heif|avif)$/) ? (
                  <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-md max-w-sm w-full text-center space-y-4 animate-fade-in">
                    <div className="w-16 h-16 bg-teal-50 text-teal-650 rounded-full flex items-center justify-center mx-auto text-3xl">
                      🖼️
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-850 text-sm">{previewFile}</h4>
                      <p className="text-xs text-slate-455 mt-1">Mock Image Evidence</p>
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

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-[8px]">
              {fileUrls[previewFile] && (
                <a
                  href={fileUrls[previewFile]}
                  download={previewFile}
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer flex items-center gap-[6px]"
                  title="Download attachment locally"
                >
                  <Download size={12} />
                  <span>Download File</span>
                </a>
              )}
              <button
                onClick={handleClosePreview}
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
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-[16px]">
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
