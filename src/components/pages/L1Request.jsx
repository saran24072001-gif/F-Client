import { useState, useEffect, useRef } from 'react';
import {
  Upload,
  Loader2,
  Plus,
  X,
  Trash2,
  AlertTriangle,
  RefreshCw,
  RotateCcw
} from 'lucide-react';
import { createL1Request, getProcesses, addProcess, deleteProcess, getMachines, addMachine, deleteMachine, getNextChangeNo, getDepartments, getServerTime } from '../../api/apiRoutes';
import { CustomDatePicker } from '../ui/CustomDatePicker';
import { formatDateToDDMMYYYY, parseDDMMYYYYToDate } from '../../utils/dateUtils';
import { useWebSocket } from '../../hooks/useWebSocket';

export const L1Request = ({
  userEmail,
  userRole,
  onTabChange,
  changes,
  setChanges,
  logAction,
  setToastMsg,
  fetchChanges,
  systemUsers = []
}) => {
  const isAdmin = userRole && userRole.toLowerCase().includes('admin');
  const [isDraftInitialized, setIsDraftInitialized] = useState(false);
  const draftLoadedRef = useRef(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState({});
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isProcessModalOpen, setIsProcessModalOpen] = useState(false);
  const [isMachineModalOpen, setIsMachineModalOpen] = useState(false);
  const [tempProcessName, setTempProcessName] = useState('');
  const [tempMachineNo, setTempMachineNo] = useState('');
  const [itemToDelete, setItemToDelete] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const [dbProcesses, setDbProcesses] = useState([]);
  const [dbMachines, setDbMachines] = useState([]);
  const [dbDepartments, setDbDepartments] = useState([]);

  // Users, processes, machines, and departments are retrieved solely from the database.

  useEffect(() => {
    fetchOptions();
    fetchNextChangeNo();
  }, []);

  useWebSocket((data) => {
    if (data.type === 'REFRESH_CHANGES') {
      fetchNextChangeNo();
    }
  });

  async function fetchNextChangeNo() {
    try {
      const res = await getNextChangeNo();
      setChangeNo(res.data.nextNo);
    } catch (e) {
      console.error('Error fetching next change number:', e);
      setChangeNo(`4M-2026-${Date.now().toString().slice(-8)}`);
    }
  }

  async function fetchOptions() {
    try {
      const [pRes, mRes, dRes] = await Promise.all([
        getProcesses(),
        getMachines(),
        getDepartments()
      ]);
      setDbProcesses(pRes.data);
      setDbMachines(mRes.data);
      setDbDepartments(dRes.data || []);
    } catch (e) {
      console.error('Error fetching options:', e);
    }
  }

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      localStorage.removeItem('cms_l1_draft');
      
      setUnit('UNIT-2');
      
      const now = new Date();
      setRequestedDate(formatDateToDDMMYYYY(now));
      const hrs = String(now.getHours()).padStart(2, '0');
      const mins = String(now.getMinutes()).padStart(2, '0');
      setRequestedTime(`${hrs}:${mins}`);
      
      setChangeIn({
        Man: false,
        Machine: false,
        Material: false,
        Method: false,
        Measurement: false,
        'Mother Nature': false
      });
      setFileDesc('');
      setFileImprovement('');
      setFileTraceFrom('');
      setFileTraceTo('');
      setFileRisk('');
      setFileSop('');
      setUploadedFilesList([]);
      
      let defaultDept = '';
      let defaultRequestBy = '';
      if (userEmail && systemUsers.length > 0) {
        const currentUser = systemUsers.find(u => u.email.toLowerCase() === userEmail.toLowerCase());
        if (currentUser) {
          defaultDept = currentUser.department || '';
          defaultRequestBy = currentUser.name || currentUser.email || '';
        }
      }
      setDept(defaultDept);
      setRequestBy(defaultRequestBy);
      
      setProcessName('');
      setProcessLine('');
      setMachineNo('');
      setContext('');
      setDescription('');
      setImprovementArea('');
      setChangeType('');
      setDateStart('');
      setTraceFrom('');
      setDateClose('');
      setTraceTo('');
      setRiskAnalysis('');
      setSopUpdate('');
      setHodApproval('');
      setCustomerApproval('');
      setImprovementTableData([]);
      setErrors({});

      await Promise.all([fetchOptions(), fetchNextChangeNo()]);
      setToastMsg('Form cleared and options refreshed successfully.');
    } catch (e) {
      console.error('Refresh error:', e);
      setToastMsg({ text: 'Failed to refresh data from server.', isError: true });
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleAddProcess = async () => {
    if (tempProcessName.trim()) {
      try {
        await addProcess(tempProcessName.trim());
        setProcessName(tempProcessName.trim());
        setTempProcessName('');
        setIsProcessModalOpen(false);
        fetchOptions();
      } catch (e) {
        console.error('Error adding process:', e);
      }
    }
  };

  const handleDeleteProcess = (name, e) => {
    e.stopPropagation();
    setItemToDelete({ type: 'process', name });
  };

  const handleDeleteMachine = (name, e) => {
    e.stopPropagation();
    setItemToDelete({ type: 'machine', name });
  };

  const confirmDelete = async () => {
    if (!itemToDelete) return;
    try {
      if (itemToDelete.type === 'process') {
        await deleteProcess(itemToDelete.name);
        if (processName === itemToDelete.name) setProcessName('');
      } else {
        await deleteMachine(itemToDelete.name);
        if (machineNo === itemToDelete.name) setMachineNo('');
      }
      fetchOptions();
    } catch (err) {
      console.error('Error deleting:', err);
    } finally {
      setItemToDelete(null);
    }
  };

  // Identifiers State
  const [unit, setUnit] = useState('UNIT-2');
  const [changeNo, setChangeNo] = useState('');
  const [requestedDate, setRequestedDate] = useState(() => formatDateToDDMMYYYY(new Date()));
  const [requestedTime, setRequestedTime] = useState(() => {
    const now = new Date();
    const hrs = String(now.getHours()).padStart(2, '0');
    const mins = String(now.getMinutes()).padStart(2, '0');
    return `${hrs}:${mins}`;
  });

  useEffect(() => {
    async function syncTime() {
      try {
        const start = Date.now();
        const res = await getServerTime();
        const serverTimeMs = new Date(res.data.time).getTime();
        const latency = (Date.now() - start) / 2;
        const offset = (serverTimeMs + latency) - Date.now();

        // Update initially synced date/time only if no draft exists
        const syncedNow = new Date(Date.now() + offset);
        const stored = localStorage.getItem('cms_l1_draft');
        if (!stored) {
          setRequestedDate(formatDateToDDMMYYYY(syncedNow));
          const hrs = String(syncedNow.getHours()).padStart(2, '0');
          const mins = String(syncedNow.getMinutes()).padStart(2, '0');
          setRequestedTime(`${hrs}:${mins}`);
        }
      } catch (err) {
        console.error('Failed to sync time with server, falling back to local time:', err);
      }
    }
    syncTime();
  }, []);

  const [changeIn, setChangeIn] = useState({
    Man: false,
    Machine: false,
    Material: false,
    Method: false,
    Measurement: false,
    'Mother Nature': false
  });

  // File states for supporting uploads (Effectiveness style)
  const [fileDesc, setFileDesc] = useState('');
  const [fileImprovement, setFileImprovement] = useState('');
  const [fileTraceFrom, setFileTraceFrom] = useState('');
  const [fileTraceTo, setFileTraceTo] = useState('');
  const [fileRisk, setFileRisk] = useState('');
  const [fileSop, setFileSop] = useState('');
  const [fileEffectiveness] = useState('');

  const [uploadedFilesList, setUploadedFilesList] = useState([]);

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

  // Request Details State
  const [dept, setDept] = useState('');
  const [requestBy, setRequestBy] = useState('');




  useEffect(() => {
    // Only set default if dept and requestBy are not already set (e.g. from draft)
    if (dept || requestBy) return;
    if (userEmail && systemUsers.length > 0) {
      const currentUser = systemUsers.find(u => u.email.toLowerCase() === userEmail.toLowerCase());
      if (currentUser) {
        if (currentUser.department) {
          setDept(currentUser.department);
        }
        if (currentUser.name) {
          setRequestBy(currentUser.name);
        } else {
          setRequestBy(currentUser.email);
        }
      }
    }
  }, [userEmail, systemUsers]);

  useEffect(() => {
    if (dept && systemUsers.length > 0) {
      const matchedUsers = systemUsers.filter(
        u => (u.department || '').toLowerCase() === dept.toLowerCase()
      );
      if (matchedUsers.length > 0) {
        // If requestBy is already set and matches one of the users in this department, don't overwrite it
        const requestByExistsInMatched = matchedUsers.some(
          u => (u.name || u.email || '').toLowerCase() === (requestBy || '').toLowerCase()
        );
        if (requestByExistsInMatched) return;

        const currentUser = systemUsers.find(u => u.email.toLowerCase() === userEmail.toLowerCase());
        if (currentUser && (currentUser.department || '').toLowerCase() === dept.toLowerCase()) {
          setRequestBy(currentUser.name || currentUser.email);
        } else {
          setRequestBy(matchedUsers[0].name || matchedUsers[0].email);
        }
      } else {
        setRequestBy('');
      }
    } else {
      setRequestBy('');
    }
  }, [dept, systemUsers, userEmail, requestBy]);

  const [processName, setProcessName] = useState('');
  const [processLine, setProcessLine] = useState('');
  const [machineNo, setMachineNo] = useState('');

  // Change Description State
  const [context, setContext] = useState('');
  const [description, setDescription] = useState('');

  // Implementation Timeline State
  const [improvementArea, setImprovementArea] = useState('');
  const [changeType, setChangeType] = useState('');
  const [dateStart, setDateStart] = useState('');
  const [traceFrom, setTraceFrom] = useState('');
  const [dateClose, setDateClose] = useState('');
  const [traceTo, setTraceTo] = useState('');

  // Risk Analysis State
  const [riskAnalysis, setRiskAnalysis] = useState('');
  const [sopUpdate, setSopUpdate] = useState('');
  const [hodApproval, setHodApproval] = useState('');
  const [customerApproval, setCustomerApproval] = useState('');
  const [effectivenessMonitoring] = useState('None');
  const [improvementTableData, setImprovementTableData] = useState([]);
  const [isImprovementModalOpen, setIsImprovementModalOpen] = useState(false);
  const [modalError, setModalError] = useState('');
  const lastAreaRef = useRef('');

  // Load draft from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem('cms_l1_draft');
      if (stored) {
        const draft = JSON.parse(stored);
        if (draft.userEmail === userEmail) {
          if (draft.unit !== undefined) setUnit(draft.unit);
          if (draft.requestedDate !== undefined) setRequestedDate(draft.requestedDate);
          if (draft.requestedTime !== undefined) setRequestedTime(draft.requestedTime);
          if (draft.changeIn !== undefined) setChangeIn(draft.changeIn);
          if (draft.fileDesc !== undefined) setFileDesc(draft.fileDesc);
          if (draft.fileImprovement !== undefined) setFileImprovement(draft.fileImprovement);
          if (draft.fileTraceFrom !== undefined) setFileTraceFrom(draft.fileTraceFrom);
          if (draft.fileTraceTo !== undefined) setFileTraceTo(draft.fileTraceTo);
          if (draft.fileRisk !== undefined) setFileRisk(draft.fileRisk);
          if (draft.fileSop !== undefined) setFileSop(draft.fileSop);
          if (draft.uploadedFilesList !== undefined) setUploadedFilesList(draft.uploadedFilesList);
          if (draft.dept !== undefined) setDept(draft.dept);
          if (draft.requestBy !== undefined) setRequestBy(draft.requestBy);
          if (draft.processName !== undefined) setProcessName(draft.processName);
          if (draft.processLine !== undefined) setProcessLine(draft.processLine);
          if (draft.machineNo !== undefined) setMachineNo(draft.machineNo);
          if (draft.context !== undefined) setContext(draft.context);
          if (draft.description !== undefined) setDescription(draft.description);
          if (draft.improvementArea !== undefined) setImprovementArea(draft.improvementArea);
          if (draft.changeType !== undefined) setChangeType(draft.changeType);
          if (draft.dateStart !== undefined) setDateStart(draft.dateStart);
          if (draft.traceFrom !== undefined) setTraceFrom(draft.traceFrom);
          if (draft.dateClose !== undefined) setDateClose(draft.dateClose);
          if (draft.traceTo !== undefined) setTraceTo(draft.traceTo);
          if (draft.riskAnalysis !== undefined) setRiskAnalysis(draft.riskAnalysis);
          if (draft.sopUpdate !== undefined) setSopUpdate(draft.sopUpdate);
          if (draft.hodApproval !== undefined) setHodApproval(draft.hodApproval);
          if (draft.customerApproval !== undefined) setCustomerApproval(draft.customerApproval);
          if (draft.improvementTableData !== undefined) setImprovementTableData(draft.improvementTableData);
          draftLoadedRef.current = true;
        } else {
          localStorage.removeItem('cms_l1_draft');
        }
      }
    } catch (e) {
      console.error('Error loading L1 draft:', e);
    } finally {
      setIsDraftInitialized(true);
    }
  }, [userEmail]);

  // Save draft to localStorage whenever fields change, but only after initialized
  useEffect(() => {
    if (!isDraftInitialized) return;
    try {
      const draft = {
        userEmail,
        unit,
        requestedDate,
        requestedTime,
        changeIn,
        fileDesc,
        fileImprovement,
        fileTraceFrom,
        fileTraceTo,
        fileRisk,
        fileSop,
        uploadedFilesList,
        dept,
        requestBy,
        processName,
        processLine,
        machineNo,
        context,
        description,
        improvementArea,
        changeType,
        dateStart,
        traceFrom,
        dateClose,
        traceTo,
        riskAnalysis,
        sopUpdate,
        hodApproval,
        customerApproval,
        improvementTableData
      };
      localStorage.setItem('cms_l1_draft', JSON.stringify(draft));
    } catch (e) {
      console.error('Error saving L1 draft:', e);
    }
  }, [
    isDraftInitialized,
    userEmail,
    unit,
    requestedDate,
    requestedTime,
    changeIn,
    fileDesc,
    fileImprovement,
    fileTraceFrom,
    fileTraceTo,
    fileRisk,
    fileSop,
    uploadedFilesList,
    dept,
    requestBy,
    processName,
    processLine,
    machineNo,
    context,
    description,
    improvementArea,
    changeType,
    dateStart,
    traceFrom,
    dateClose,
    traceTo,
    riskAnalysis,
    sopUpdate,
    hodApproval,
    customerApproval,
    improvementTableData
  ]);

  useEffect(() => {
    if (!isImprovementModalOpen) {
      setModalError('');
    }
  }, [isImprovementModalOpen]);

  useEffect(() => {
    const area = (improvementArea || '').toLowerCase();
    
    // If draft was loaded, synchronize lastAreaRef to avoid resetting table data
    if (draftLoadedRef.current) {
      lastAreaRef.current = area;
      draftLoadedRef.current = false;
      return;
    }

    if (area !== lastAreaRef.current) {
      lastAreaRef.current = area;
      setErrors(prev => {
        if (prev.improvementTable) {
          return { ...prev, improvementTable: '' };
        }
        return prev;
      });
      if (['cost', 'productivity', 'quality'].includes(area)) {
        let defaultRows = [];
        if (area === 'cost') {
          defaultRows = [
            { changeNo: changeNo, date: '', monthlySave: '', annualSave: '', roi: '' }
          ];
        } else if (area === 'productivity') {
          defaultRows = [
            { changeNo: changeNo, date: '', currentProd: '', improvedProd: '' }
          ];
        } else if (area === 'quality') {
          defaultRows = [
            { changeNo: changeNo, date: '', currentPpm: '', reducedPpm: '' }
          ];
        }
        setImprovementTableData(defaultRows);
      } else {
        setImprovementTableData([]);
      }
    } else {
      setImprovementTableData(prev => prev.map(row => ({ ...row, changeNo: changeNo })));
    }
  }, [improvementArea, changeNo]);

  const checkTableCompleteness = (tableData) => {
    const area = (improvementArea || '').toLowerCase();
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

  const handleUpdateCell = (rowIndex, field, value) => {
    const updatedList = improvementTableData.map((row, idx) => {
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
    setImprovementTableData(updatedList);

    if (checkTableCompleteness(updatedList)) {
      setErrors(prev => {
        if (prev.improvementTable) {
          return { ...prev, improvementTable: '' };
        }
        return prev;
      });
    }
  };

  const handleAddRow = () => {
    const area = (improvementArea || '').toLowerCase();
    let newRow = {};
    if (area === 'cost') {
      newRow = { changeNo: changeNo, date: '', monthlySave: '', annualSave: '', roi: '' };
    } else if (area === 'productivity') {
      newRow = { changeNo: changeNo, date: '', currentProd: '', improvedProd: '' };
    } else if (area === 'quality') {
      newRow = { changeNo: changeNo, date: '', currentPpm: '', reducedPpm: '' };
    }
    const updatedList = [...improvementTableData, newRow];
    setImprovementTableData(updatedList);
  };

  const handleDeleteRow = (rowIndex) => {
    const updatedList = improvementTableData.filter((_, idx) => idx !== rowIndex);
    setImprovementTableData(updatedList);
    if (checkTableCompleteness(updatedList)) {
      setErrors(prev => {
        if (prev.improvementTable) {
          return { ...prev, improvementTable: '' };
        }
        return prev;
      });
    }
  };

  const handleDoneClick = () => {
    if (!improvementTableData || improvementTableData.length === 0) {
      setModalError('Please add at least one row of data.');
      setErrors(prev => ({
        ...prev,
        improvementTable: `Please add at least one row in the ${improvementArea} Table.`
      }));
      return;
    }
    if (!checkTableCompleteness(improvementTableData)) {
      setModalError('Please fill in all empty fields marked in red.');
      setErrors(prev => ({
        ...prev,
        improvementTable: `Please fill in all fields in the ${improvementArea} Table.`
      }));
      return;
    }
    setModalError('');
    setErrors(prev => ({ ...prev, improvementTable: '' }));
    setIsImprovementModalOpen(false);
  };

  const handleCheckboxChange = (name) => {
    setChangeIn(prev => ({
      ...prev,
      [name]: !prev[name]
    }));
  };

  const handleHodApprovalToggle = (deptName) => {
    // For single selection, simply set the selected department or clear if re-selected
    if (hodApproval && hodApproval.trim() === deptName) {
      setHodApproval('');
    } else {
      setHodApproval(deptName);
    }
    if (errors.hodApproval) setErrors(prev => ({ ...prev, hodApproval: '' }));
  };


  const validateForm = () => {
    const newErrors = {};

    if (!unit) {
      newErrors.unit = 'Unit is required.';
    }

    const selectedChangesIn = Object.keys(changeIn).filter(k => changeIn[k]).join(', ');
    if (!selectedChangesIn) {
      newErrors.changeIn = 'Please select at least one Option.';
    }

    if (!dept || !dbDepartments.includes(dept)) {
      newErrors.dept = 'Please select a valid Department.';
    }

    if (!requestBy) {
      newErrors.requestBy = 'Requester Name is required.';
    }

    if (!processName || !processName.trim()) {
      newErrors.processName = isAdmin ? 'Please select a Process Name.' : 'Please enter a Process Name.';
    }

    if (!processLine || !processLine.trim()) {
      newErrors.processLine = 'Please enter a Process Line.';
    }

    if (!machineNo || !machineNo.trim()) {
      newErrors.machineNo = isAdmin ? 'Please select a Machine No.' : 'Please enter a Machine No.';
    }

    if (!context || !context.trim()) {
      newErrors.context = 'Context of Change is required.';
    } else if (context.length > 150) {
      newErrors.context = 'Context of Change must be at most 150 characters.';
    }
    if (!description || !description.trim()) {
      newErrors.description = 'Detailed description is required.';
    }
    
    if (!improvementArea) {
      newErrors.improvementArea = 'Please select a Change Improvement Area.';
    } else {
      const area = improvementArea.toLowerCase();
      if (['cost', 'productivity', 'quality'].includes(area)) {
        if (!improvementTableData || improvementTableData.length === 0) {
          newErrors.improvementTable = `Please fill the ${improvementArea} Table data.`;
        } else {
          let isTableIncomplete = false;
          for (const row of improvementTableData) {
            if (area === 'cost') {
              if (!row.date || !row.monthlySave || !row.annualSave || !row.roi) {
                isTableIncomplete = true;
                break;
              }
            } else if (area === 'productivity') {
              if (!row.date || !row.currentProd || !row.improvedProd) {
                isTableIncomplete = true;
                break;
              }
            } else if (area === 'quality') {
              if (!row.date || !row.currentPpm || !row.reducedPpm) {
                isTableIncomplete = true;
                break;
              }
            }
          }
          if (isTableIncomplete) {
            newErrors.improvementTable = `Please fill in all fields in the ${improvementArea} Table.`;
          }
        }
      }
    }

    if (!changeType) {
      newErrors.changeType = 'Please select a Permanent / Temporary option.';
    }

    if (!dateStart || !dateStart.trim()) {
      newErrors.dateStart = 'Please enter an Implement / Change Start Date .';
    } else {
      const parsedRequestDate = parseDDMMYYYYToDate(requestedDate);
      const parsedDateStart = parseDDMMYYYYToDate(dateStart);
      if (!parsedDateStart) {
        newErrors.dateStart = 'Please enter a valid date in dd/mm/yyyy format.';
      } else if (parsedRequestDate) {
        const dStart = new Date(parsedDateStart.getFullYear(), parsedDateStart.getMonth(), parsedDateStart.getDate());
        const dRequest = new Date(parsedRequestDate.getFullYear(), parsedRequestDate.getMonth(), parsedRequestDate.getDate());
        if (dStart < dRequest) {
          newErrors.dateStart = 'Start Date should be >= Change Request Date.';
        }
      }
    }

    if (!traceFrom || !traceFrom.trim()) {
      newErrors.traceFrom = 'Part Traceability Details (From) is required.';
    }

    if (!dateClose || (!dateClose.trim() && dateClose !== 'N/A')) {
      newErrors.dateClose = 'Please enter a Change Close Date .';
    } else if (dateClose !== 'N/A') {
      const parsedDateStart = parseDDMMYYYYToDate(dateStart);
      const parsedDateClose = parseDDMMYYYYToDate(dateClose);
      if (!parsedDateClose) {
        newErrors.dateClose = 'Please enter a valid date in dd/mm/yyyy format.';
      } else if (parsedDateStart) {
        const dClose = new Date(parsedDateClose.getFullYear(), parsedDateClose.getMonth(), parsedDateClose.getDate());
        const dStart = new Date(parsedDateStart.getFullYear(), parsedDateStart.getMonth(), parsedDateStart.getDate());
        if (dClose < dStart) {
          newErrors.dateClose = 'Close Date should be >= Start Date.';
        }
      }
    }

    if (!traceTo || (!traceTo.trim() && traceTo !== 'N/A')) {
      newErrors.traceTo = 'Part Traceability (To) is required.';
    }

    if (!riskAnalysis || !riskAnalysis.trim()) {
      newErrors.riskAnalysis = 'Please enter a Risk Analysis.';
    }

    if (!sopUpdate || !sopUpdate.trim()) {
      newErrors.sopUpdate = 'Please describe the Update in SOP / WI / Control Plan / FMEA.';
    }

    if (!hodApproval || !hodApproval.trim()) {
      newErrors.hodApproval = 'Please select the User Dept HOD Approval.';
    }

    if (!customerApproval) {
      newErrors.customerApproval = 'Please select if Customer Approval is Required.';
    }

    if (!fileDesc) {
      newErrors.fileDesc = 'Supporting file for Change Description is required.';
    }

    if (!fileImprovement) {
      newErrors.fileImprovement = 'Supporting file for Timeline is required.';
    }

    if (!fileTraceTo) {
      newErrors.fileTraceTo = 'Supporting file for Traceability (To) is required.';
    }

    if (!fileRisk) {
      newErrors.fileRisk = 'Supporting file for Risk Analysis is required.';
    }

    if (!fileSop) {
      newErrors.fileSop = 'Supporting files for SOP/WI/Control Plan/FMEA are required.';
    }

    return newErrors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const formErrors = validateForm();
    if (Object.keys(formErrors).length > 0) {
      setErrors(formErrors);
      setToastMsg('Please complete all required fields before submitting.');
      const firstErrorKey = Object.keys(formErrors)[0];
      const errorElement = document.getElementById(firstErrorKey);
      if (errorElement) {
        errorElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }

    setErrors({});
    setIsSubmitting(true);

    const selectedChangesIn = Object.keys(changeIn).filter(k => changeIn[k]).join(', ');

    const l1Data = {
      changeNo,
      unit,
      requestedTime,
      changeIn: selectedChangesIn,
      dept,
      requestBy,
      processName,
      processLine,
      machineNo,
      context,
      description,
      improvementArea,
      changeType,
      dateStart,
      traceFrom,
      dateClose,
      traceTo,
      riskAnalysis,
      sopUpdate,
      hodApproval,
      customerApproval,
      effectivenessMonitoring,
      fileDesc,
      fileImprovement,
      fileTraceFrom,
      fileTraceTo,
      fileRisk,
      fileSop,
      fileEffectiveness,
      improvementTableData
    };

    try {
      const response = await createL1Request(l1Data, uploadedFilesList);
      const newChange = response.data.change;

      if (fetchChanges) {
        await fetchChanges();
      } else {
        setChanges([newChange, ...changes]);
      }
      setToastMsg(`Successfully submitted L1 Change Request: ${newChange.id}`);
      logAction('L1 Request Created', `Successfully submitted L1 Change Request ${newChange.id} for department ${dept}`);

      // Clear L1 draft from localStorage
      localStorage.removeItem('cms_l1_draft');

      // Redirect back to dashboard overview
      onTabChange('dashboard');
    } catch (err) {
      console.error(err);
      const errMsg = err.response?.data?.error || 'Failed to save L1 request to server.';
      setToastMsg({ text: errMsg, isError: true });
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderAttachmentInput = (label, value, setValue, inputId, fieldName, isRequired = false, rightElement = null) => {
    const hasError = errors[fieldName];
    return (
      <div className="space-y-[4px]" id={fieldName}>
        <div className="flex justify-between items-center">
          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">{label} {isRequired && <span className="text-rose-500">*</span>}</label>
          {rightElement}
        </div>
        {value === 'N/A' ? (
          <div className="w-full max-w-[400px] bg-slate-100 border border-slate-200 rounded-[6px] py-[8px] px-[12px] text-[12px] text-slate-500 cursor-not-allowed">
            Not Applicable
          </div>
        ) : (
        <>
        <div className="flex gap-[8px] max-w-[400px]">
          <div className="relative flex-1">
            <input
              type="text"
              readOnly
              placeholder="e.g. proof-log.pdf, image.png"
              className={`w-full bg-slate-50 border rounded-[6px] py-[8px] pl-[12px] pr-[28px] text-[12px] outline-none transition-all duration-200 select-none ${
                hasError
                  ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500/10 text-rose-700'
                  : 'border-slate-200 focus:border-[#0066cc] focus:ring-[#0066cc]/10 text-slate-500'
              }`}
              value={value}
            />
            {value && (
              <button
                type="button"
                onClick={() => {
                  setDeleteConfirm({
                    title: 'Clear All Attachments?',
                    message: 'Are you sure you want to clear all attachments from this field?',
                    onConfirm: () => {
                      setValue('');
                      setUploadedFilesList(prev => prev.filter(f => f.fieldName !== fieldName));
                      if (hasError) setErrors(prev => ({ ...prev, [fieldName]: '' }));
                    }
                  });
                }}
                className="absolute right-[10px] top-[10px] text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                title="Clear all attachments"
              >
                <X size={12} />
              </button>
            )}
          </div>
          <label className={`flex items-center justify-center gap-[6px] px-[12px] py-[8px] border rounded-[6px] text-[11px] font-bold shadow-sm transition-all cursor-pointer select-none ${
            hasError
              ? 'border-rose-300 bg-rose-50/10 hover:bg-rose-50/20 text-rose-600'
              : 'border-slate-200 bg-white hover:bg-slate-50 text-[#0066cc]'
          }`}>
            <Upload size={12} />
            <span>Upload</span>
            <input
              key={value || ''}
              type="file"
              multiple
              accept="image/*,application/pdf"
              id={inputId}
              className="hidden"
              onChange={async (e) => {
                const target = e.target;
                if (target.files && target.files.length > 0) {
                  const files = Array.from(target.files);
                  const MAX_SIZE = 100 * 1024 * 1024; // 100MB
                  const tooLargeFiles = files.filter(f => f.size > MAX_SIZE);

                  if (tooLargeFiles.length > 0) {
                    setErrors(prev => ({
                      ...prev,
                      [fieldName]: `Upload not allowed: File(s) exceed 100MB limit: ${tooLargeFiles.map(f => f.name).join(', ')}`
                    }));
                    target.value = '';
                    return;
                  }

                  const names = files.map(f => f.name.replace(/,/g, '_'));

                  // Reset input value synchronously immediately to allow uploading the same file again
                  target.value = '';

                  // Convert files to base64 for server upload
                  const base64Files = await Promise.all(
                    files.map(async (file) => ({
                      name: file.name.replace(/,/g, '_'),
                      type: file.type || 'application/octet-stream',
                      data: await fileToBase64(file),
                      fieldName
                    }))
                  );

                  setUploadedFilesList(prev => {
                    const filtered = prev.filter(f => !(f.fieldName === fieldName && names.includes(f.name)));
                    return [...filtered, ...base64Files];
                  });

                  const existing = value ? value.split(',').map(s => s.trim()).filter(Boolean) : [];
                  const updated = Array.from(new Set([...existing, ...names])).join(', ');
                  setValue(updated);
                  if (hasError) setErrors(prev => ({ ...prev, [fieldName]: '' }));
                }
              }}
            />
          </label>
        </div>

        {/* Selected File Pills */}
        {value && (
          <div className="flex flex-wrap gap-[6px] pt-[4px]">
            {value.split(',').map(s => s.trim()).filter(Boolean).map((file, i) => (
              <span key={i} className="inline-flex items-center gap-[4px] bg-slate-100 border border-slate-200 text-[10px] font-medium text-slate-700 px-[8px] py-[2px] rounded-full select-none">
                <span className="truncate max-w-[150px] font-semibold">
                  📎 {file}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setDeleteConfirm({
                      title: 'Delete Attachment?',
                      message: `Are you sure you want to delete "${file}"? This action cannot be undone.`,
                      onConfirm: () => {
                        const existing = value.split(',').map(s => s.trim()).filter(Boolean);
                        const updated = existing.filter(f => f !== file).join(', ');
                        setValue(updated);
                        setUploadedFilesList(prev => prev.filter(f => !(f.fieldName === fieldName && f.name === file)));
                        if (hasError) setErrors(prev => ({ ...prev, [fieldName]: '' }));
                      }
                    });
                  }}
                  className="text-slate-450 hover:text-rose-650 font-bold ml-[2px] cursor-pointer text-[12px]"
                >
                  &times;
                </button>
              </span>
            ))}
          </div>
        )}
        </>
        )}
        {hasError && value !== 'N/A' && <span className="text-rose-500 text-[10px] block mt-[2px]">{hasError}</span>}
      </div>
    );
  };

  return (
    <div className="w-full space-y-[24px] animate-fade-in-up pb-[40px] text-slate-800">

      {/* Title & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200/60 pb-[16px]">
        <div>
          <h3 className="font-heading text-[20px] font-bold text-slate-900">New L1 Change Request</h3>
          <p className="text-slate-500 text-[12px] mt-[4px]">Change No: {changeNo} — Auto-assigned on submission</p>
        </div>
        <div className="flex items-center gap-[12px]">
          <button
            type="button"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-[6px] bg-white border border-slate-200 rounded-[6px] py-[8px] px-[12px] text-[12px] font-semibold text-slate-600 hover:bg-slate-50 hover:text-[#0066cc] hover:border-slate-300 transition-all duration-200 shadow-sm active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
          >
            <RefreshCw className={`w-[14px] h-[14px] ${isRefreshing ? 'animate-spin text-[#0066cc]' : ''}`} />
            <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-[24px]">

        {/* 1. Identifiers Section */}
        <div className="bg-white border border-slate-200/60 rounded-xl p-6 shadow-sm hover:shadow-md transition-all duration-300 space-y-[16px]">
          <h4 className="text-[13px] font-bold text-slate-900 border-b border-slate-100 pb-[8px]">Identifiers</h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-[16px]">
            {/* UNIT */}
            <div className="space-y-[4px]">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Unit <span className="text-rose-500">*</span></label>
              <select
                id="unit"
                value={unit}
                onChange={(e) => {
                  setUnit(e.target.value);
                  if (errors.unit) setErrors(prev => ({ ...prev, unit: '' }));
                }}
                className={`w-full bg-slate-50 border rounded-[6px] py-[8px] px-[12px] text-[12px] outline-none focus:ring-4 transition-all duration-200 ${
                  errors.unit 
                    ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500/10' 
                    : 'border-slate-200 focus:border-[#0066cc] focus:ring-[#0066cc]/10'
                }`}
              >
                <option value="">— Select Unit —</option>
                <option value="UNIT-2">UNIT-2</option>
              </select>
              {errors.unit && <span className="text-rose-500 text-[10px] block mt-[2px]">{errors.unit}</span>}
            </div>

            {/* 4M CHANGE NO */}
            <div className="space-y-[4px]">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">4M Change No <span className="text-rose-500">*</span></label>
              <div className="relative flex items-center">
                <span className="absolute left-[12px] text-slate-400 text-[12px]">#</span>
                <input
                  type="text"
                  disabled
                  value={changeNo}
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
                  value={requestedDate}
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
                  value={requestedTime}
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
          <div className="space-y-[6px] pt-[8px]" id="changeIn">
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Change In <span className="text-rose-500">*</span></label>
            <div className="flex flex-wrap gap-x-[16px] gap-y-[8px] text-[12px] text-slate-700 font-medium select-none">
              {Object.keys(changeIn).map(key => (
                <label key={key} className="flex items-center gap-[6px] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={changeIn[key]}
                    onChange={() => {
                      handleCheckboxChange(key);
                      if (errors.changeIn) setErrors(prev => ({ ...prev, changeIn: '' }));
                    }}
                    className="w-[14px] h-[14px] rounded border-slate-300 text-[#0066cc] focus:ring-[#0066cc]"
                  />
                  <span>{key}</span>
                </label>
              ))}
            </div>
            {errors.changeIn && <span className="text-rose-500 text-[10px] block mt-[2px]">{errors.changeIn}</span>}
          </div>
        </div>

        {/* 2. Request Details Section */}
        <div className="bg-white border border-slate-200/60 rounded-xl p-6 shadow-sm hover:shadow-md transition-all duration-300 space-y-[16px]">
          <h4 className="text-[13px] font-bold text-slate-900 border-b border-slate-100 pb-[8px]">Request Details</h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-[16px]">
            {/* CHANGE REQUEST DEPT */}
            <div className="space-y-[4px]">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Change Request Dept <span className="text-rose-500">*</span></label>
              <input
                type="text"
                readOnly
                id="dept"
                value={dept}
                placeholder="Auto-captured department"
                className={`w-full border rounded-[6px] py-[8px] px-[12px] text-[12px] outline-none font-semibold cursor-not-allowed ${
                  errors.dept 
                    ? 'border-rose-500 bg-rose-50/20 text-rose-700' 
                    : 'border-slate-200 bg-slate-100 text-slate-550'
                }`}
              />
              <span className="block text-[9px] text-slate-400 mt-[2px]">Auto-captured from logged-in user</span>
              {errors.dept && <span className="text-rose-500 text-[10px] block mt-[2px]">{errors.dept}</span>}
            </div>

            {/* CHANGE REQUEST BY */}
            <div className="space-y-[4px]">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Change Request By <span className="text-rose-500">*</span></label>
              <input
                type="text"
                readOnly
                id="requestBy"
                value={requestBy}
                placeholder="Select Department to populate"
                className={`w-full border rounded-[6px] py-[8px] px-[12px] text-[12px] outline-none font-semibold cursor-not-allowed ${
                  errors.requestBy
                    ? 'border-rose-500 bg-rose-50/20 text-rose-700'
                    : 'border-slate-200 bg-slate-100 text-slate-550'
                }`}
              />
              {errors.requestBy && <span className="text-rose-500 text-[10px] block mt-[2px]">{errors.requestBy}</span>}
            </div>

            {/* PROCESS NAME */}
            <div className="space-y-[4px]">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Process Name <span className="text-rose-500">*</span></label>
              {isAdmin ? (
                <div className="flex gap-[8px]">
                  <select
                    id="processName"
                    value={processName}
                    onChange={(e) => {
                      setProcessName(e.target.value);
                      if (errors.processName) setErrors(prev => ({ ...prev, processName: '' }));
                    }}
                    className={`flex-1 bg-slate-50 border rounded-[6px] py-[8px] px-[12px] text-[12px] outline-none focus:ring-4 transition-all duration-200 ${
                      errors.processName 
                        ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500/10' 
                        : 'border-slate-200 focus:border-[#0066cc] focus:ring-[#0066cc]/10'
                    }`}
                  >
                    <option value="">— Select or Add Process —</option>
                    {dbProcesses.map(p => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => {
                      setTempProcessName('');
                      setIsProcessModalOpen(true);
                    }}
                    className="flex items-center justify-center w-[36px] bg-slate-50 border border-slate-200 rounded-[6px] text-slate-500 hover:bg-slate-100 hover:text-[#0066cc] transition-colors"
                    title="View DB & Add Process"
                  >
                    <Plus size={16} />
                  </button>
                </div>
              ) : (
                <input
                  type="text"
                  id="processName"
                  placeholder="Enter Process Name"
                  value={processName}
                  onChange={(e) => {
                    setProcessName(e.target.value);
                    if (errors.processName) setErrors(prev => ({ ...prev, processName: '' }));
                  }}
                  className={`w-full bg-slate-50 border rounded-[6px] py-[8px] px-[12px] text-[12px] outline-none focus:ring-4 transition-all duration-200 ${
                    errors.processName 
                      ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500/10' 
                      : 'border-slate-200 focus:border-[#0066cc] focus:ring-[#0066cc]/10'
                  }`}
                />
              )}
              {errors.processName && <span className="text-rose-500 text-[10px] block mt-[2px]">{errors.processName}</span>}
            </div>

            {/* PROCESS LINE */}
            <div className="space-y-[4px]">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Process Line <span className="text-rose-500">*</span></label>
              <input
                type="text"
                id="processLine"
                placeholder="e.g. Line 3 / Bay B"
                value={processLine}
                maxLength={100}
                onChange={(e) => {
                  setProcessLine(e.target.value);
                  if (errors.processLine) setErrors(prev => ({ ...prev, processLine: '' }));
                }}
                className={`w-full bg-slate-50 border rounded-[6px] py-[8px] px-[12px] text-[12px] outline-none focus:ring-4 transition-all duration-200 ${
                  errors.processLine 
                    ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500/10' 
                    : 'border-slate-200 focus:border-[#0066cc] focus:ring-[#0066cc]/10'
                }`}
              />
              <div className="flex justify-between items-center text-[9px] text-slate-400">
                {errors.processLine ? (
                  <span className="text-rose-500 font-bold">{errors.processLine}</span>
                ) : (
                  <span>Specify the process line or bay</span>
                )}
                <span className={`${100 - processLine.length <= 15 ? 'text-amber-600 font-bold animate-pulse' : 'text-slate-400'}`}>
                  {100 - processLine.length} characters remaining (max 100 chars)
                </span>
              </div>
            </div>

            {/* MACHINE NO */}
            <div className="space-y-[4px] sm:col-span-2 lg:col-span-4">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Machine No <span className="text-rose-500">*</span></label>
              {isAdmin ? (
                <div className="flex gap-[8px] sm:max-w-[49%] lg:max-w-[24.4%]">
                  <select
                    id="machineNo"
                    value={machineNo}
                    onChange={(e) => {
                      setMachineNo(e.target.value);
                      if (errors.machineNo) setErrors(prev => ({ ...prev, machineNo: '' }));
                    }}
                    className={`flex-1 bg-slate-50 border rounded-[6px] py-[8px] px-[12px] text-[12px] outline-none focus:ring-4 transition-all duration-200 ${
                      errors.machineNo 
                        ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500/10' 
                        : 'border-slate-200 focus:border-[#0066cc] focus:ring-[#0066cc]/10'
                    }`}
                  >
                    <option value="">— Select or Add Machine —</option>
                    {dbMachines.map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => {
                      setTempMachineNo('');
                      setIsMachineModalOpen(true);
                    }}
                    className="flex items-center justify-center w-[36px] bg-slate-50 border border-slate-200 rounded-[6px] text-slate-500 hover:bg-slate-100 hover:text-[#0066cc] transition-colors"
                    title="View DB & Add Machine"
                  >
                    <Plus size={16} />
                  </button>
                </div>
              ) : (
                <input
                  type="text"
                  id="machineNo"
                  placeholder="Enter Machine No"
                  value={machineNo}
                  onChange={(e) => {
                    setMachineNo(e.target.value);
                    if (errors.machineNo) setErrors(prev => ({ ...prev, machineNo: '' }));
                  }}
                  className={`w-full bg-slate-50 border rounded-[6px] py-[8px] px-[12px] text-[12px] outline-none focus:ring-4 transition-all duration-200 sm:max-w-[49%] lg:max-w-[24.4%] ${
                    errors.machineNo 
                      ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500/10' 
                      : 'border-slate-200 focus:border-[#0066cc] focus:ring-[#0066cc]/10'
                  }`}
                />
              )}
              {errors.machineNo && <span className="text-rose-500 text-[10px] block mt-[2px]">{errors.machineNo}</span>}
            </div>
          </div>
        </div>

        {/* 3. Change Description Section */}
        <div className="bg-white border border-slate-200/60 rounded-xl p-6 shadow-sm hover:shadow-md transition-all duration-300 space-y-[16px]">
          <h4 className="text-[13px] font-bold text-slate-900 border-b border-slate-100 pb-[8px]">Change Description</h4>

          <div className="grid grid-cols-1 gap-[16px]">
            {/* CONTEXT OF CHANGE */}
            <div className="space-y-[4px]">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Context of Change <span className="text-rose-500">*</span></label>
              <textarea
                id="context"
                placeholder="Brief description of WHY this change is needed (min 10, max 150 characters)..."
                value={context}
                maxLength={150}
                onChange={(e) => {
                  setContext(e.target.value);
                  if (errors.context) setErrors(prev => ({ ...prev, context: '' }));
                }}
                rows={4}
                className={`w-full bg-slate-50 border rounded-[6px] py-[8px] px-[12px] text-[12px] outline-none focus:ring-4 transition-all duration-200 resize-none ${
                  errors.context 
                    ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500/10' 
                    : 'border-slate-200 focus:border-[#0066cc] focus:ring-[#0066cc]/10'
                }`}
              />
              <div className="flex justify-between items-center text-[9px] text-slate-400">
                {errors.context ? (
                  <span className="text-rose-500 font-bold">{errors.context}</span>
                ) : (
                  <span>Brief summary of the change context</span>
                )}
                <span className={`${150 - context.length <= 15 ? 'text-amber-600 font-bold animate-pulse' : 'text-slate-400'}`}>
                  {150 - context.length} characters remaining (max 150 chars / approx. 25 words)
                </span>
              </div>
            </div>

            {/* DETAILED CHANGE DESCRIPTION */}
            <div className="space-y-[4px]">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Detailed Change Description <span className="text-rose-500">*</span></label>
              <textarea
                id="description"
                placeholder="Describe the change — what, why, how, and expected outcome (min 20 characters)..."
                value={description}
                maxLength={1000}
                onChange={(e) => {
                  setDescription(e.target.value);
                  if (errors.description) setErrors(prev => ({ ...prev, description: '' }));
                }}
                rows={4}
                className={`w-full bg-slate-50 border rounded-[6px] py-[8px] px-[12px] text-[12px] outline-none focus:ring-4 transition-all duration-200 resize-none ${
                  errors.description 
                    ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500/10' 
                    : 'border-slate-200 focus:border-[#0066cc] focus:ring-[#0066cc]/10'
                }`}
              />
              <div className="flex justify-between items-center text-[9px] text-slate-400">
                {errors.description ? (
                  <span className="text-rose-500 font-bold">{errors.description}</span>
                ) : (
                  <span>Detailed description of the change</span>
                )}
                <span className={`${1000 - description.length <= 15 ? 'text-amber-600 font-bold animate-pulse' : 'text-slate-400'}`}>
                  {1000 - description.length} characters remaining (max 1000 chars)
                </span>
              </div>
            </div>

            {/* UPLOAD SUPPORTING FILES */}
            <div>
              {renderAttachmentInput("Upload Supporting Files", fileDesc, setFileDesc, "file-desc-input", "fileDesc", true)}
            </div>
          </div>
        </div>

        {/* 4. Implementation Timeline Section */}
        <div className="bg-white border border-slate-200/60 rounded-xl p-6 shadow-sm hover:shadow-md transition-all duration-300 space-y-[16px]">
          <h4 className="text-[13px] font-bold text-slate-900 border-b border-slate-100 pb-[8px]">Implementation Timeline</h4>

          <div className="grid grid-cols-1 gap-[16px]">
            {/* CHANGE IMPROVEMENT AREA */}
            <div className="space-y-[4px]">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Change Improvement Area <span className="text-rose-500">*</span></label>
              <select
                id="improvementArea"
                value={improvementArea}
                onChange={(e) => {
                  setImprovementArea(e.target.value);
                  if (errors.improvementArea) setErrors(prev => ({ ...prev, improvementArea: '' }));
                }}
                className={`w-full bg-slate-50 border rounded-[6px] py-[8px] px-[12px] text-[12px] outline-none focus:ring-4 transition-all duration-200 ${
                  errors.improvementArea 
                    ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500/10' 
                    : 'border-slate-200 focus:border-[#0066cc] focus:ring-[#0066cc]/10'
                }`}
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
              {errors.improvementArea && <span className="text-rose-500 text-[10px] block mt-[2px]">{errors.improvementArea}</span>}
            </div>

            {/* UPLOAD SUPPORTING FILES */}
            <div className="space-y-[4px]">
              {['cost', 'productivity', 'quality'].includes(improvementArea.toLowerCase()) && (
                <div className="pb-[4px]" id="improvementTable">
                  <button
                    type="button"
                    onClick={() => {
                      setIsImprovementModalOpen(true);
                    }}
                    className={`flex items-center gap-[8px] px-[16px] py-[8px] rounded-[6px] text-[12px] font-bold shadow-sm transition-all transform active:scale-[0.98] cursor-pointer ${
                      errors.improvementTable
                        ? 'bg-rose-50 border border-rose-500 text-rose-600 hover:bg-rose-100'
                        : 'bg-[#0066cc] hover:bg-[#0052a3] text-white'
                    }`}
                  >
                    <Plus size={14} />
                    <span>{improvementArea} Table</span>
                  </button>
                  {errors.improvementTable && <span className="text-rose-500 text-[10px] block mt-[4px]">{errors.improvementTable}</span>}
                </div>
              )}
              {renderAttachmentInput("Upload Supporting Files", fileImprovement, setFileImprovement, "file-improvement-input", "fileImprovement", true)}
            </div>

            {/* PERMANENT / TEMPORARY CHANGE */}
            <div className="space-y-[4px]">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Permanent / Temporary Change <span className="text-rose-500">*</span></label>
              <select
                id="changeType"
                value={changeType}
                onChange={(e) => {
                  const val = e.target.value;
                  setChangeType(val);
                  if (val === 'Temporary') {
                    if (dateClose === 'N/A') setDateClose('');
                    if (traceTo === 'N/A') setTraceTo('');
                    if (fileTraceTo === 'N/A') setFileTraceTo('');
                  }
                  if (errors.changeType) setErrors(prev => ({ ...prev, changeType: '' }));
                }}
                className={`w-full bg-slate-50 border rounded-[6px] py-[8px] px-[12px] text-[12px] outline-none focus:ring-4 transition-all duration-200 ${
                  errors.changeType 
                    ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500/10' 
                    : 'border-slate-200 focus:border-[#0066cc] focus:ring-[#0066cc]/10'
                }`}
              >
                <option value="">— Select —</option>
                <option value="Permanent">Permanent</option>
                <option value="Temporary">Temporary</option>
              </select>
              {errors.changeType && <span className="text-rose-500 text-[10px] block mt-[2px]">{errors.changeType}</span>}
            </div>

            {/* IMPLEMENT / CHANGE DATE START */}
            <div className="space-y-[4px]">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Implement / Change Start Date  <span className="text-rose-500">*</span></label>
              <CustomDatePicker
                id="dateStart"
                value={dateStart}
                onChange={(val) => {
                  setDateStart(val);
                  if (errors.dateStart) setErrors(prev => ({ ...prev, dateStart: '' }));
                }}
                readOnly={true}
                minDate={requestedDate}
                containerClassName=""
                inputClassName={`w-full bg-slate-50 border rounded-[6px] py-[8px] pl-[12px] pr-[28px] text-[12px] outline-none focus:ring-4 transition-all duration-200 ${
                  errors.dateStart 
                    ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500/10' 
                    : 'border-slate-200 focus:border-[#0066cc] focus:ring-[#0066cc]/10'
                }`}
                buttonClassName="right-[10px] top-[50%] -translate-y-1/2"
              />
              {errors.dateStart && <span className="text-rose-500 text-[10px] block mt-[2px]">{errors.dateStart}</span>}
            </div>

            {/* PART TRACEABILITY DETAILS (FROM CHANGES) */}
            <div className="space-y-[4px]">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Part Traceability Details (From Changes) <span className="text-rose-500">*</span></label>
              <textarea
                id="traceFrom"
                placeholder="Describe the change — what, why, how, and expected outcome (min 20 characters)..."
                value={traceFrom}
                maxLength={1000}
                onChange={(e) => {
                  setTraceFrom(e.target.value);
                  if (errors.traceFrom) setErrors(prev => ({ ...prev, traceFrom: '' }));
                }}
                rows={3}
                className={`w-full bg-slate-50 border rounded-[6px] py-[8px] px-[12px] text-[12px] outline-none focus:ring-4 transition-all duration-200 resize-none ${
                  errors.traceFrom 
                    ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500/10' 
                    : 'border-slate-200 focus:border-[#0066cc] focus:ring-[#0066cc]/10'
                }`}
              />
              <div className="flex justify-between items-center text-[9px] text-slate-400">
                {errors.traceFrom ? (
                  <span className="text-rose-500 font-bold">{errors.traceFrom}</span>
                ) : (
                  <span>Traceability detail for current setup</span>
                )}
                <span className={`${1000 - traceFrom.length <= 15 ? 'text-amber-600 font-bold animate-pulse' : 'text-slate-400'}`}>
                  {1000 - traceFrom.length} characters remaining (max 1000 chars)
                </span>
              </div>
            </div>

            {/* UPLOAD SUPPORTING FILES */}
            <div className="space-y-[4px]">
              {renderAttachmentInput("Upload Supporting Files", fileTraceFrom, setFileTraceFrom, "file-tracefrom-input", "fileTraceFrom")}
            </div>

            {/* CHANGE DATE CLOSE */}
            <div className="space-y-[4px]">
              <div className="flex justify-between items-center">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Change Close Date  <span className="text-rose-500">*</span></label>
                {changeType === 'Permanent' && (
                  <select
                    value={dateClose === 'N/A' ? 'N/A' : 'Required'}
                    onChange={(e) => {
                      const isNA = e.target.value === 'N/A';
                      setDateClose(isNA ? 'N/A' : '');
                      if (errors.dateClose) setErrors(prev => ({ ...prev, dateClose: '' }));
                    }}
                    className="text-[10px] bg-slate-50 border border-slate-200 rounded px-1 py-0.5 outline-none cursor-pointer text-slate-600 focus:border-[#0066cc]"
                  >
                    <option value="Required">Required</option>
                    <option value="N/A">N/A</option>
                  </select>
                )}
              </div>
              {dateClose === 'N/A' ? (
                <div className="w-full bg-slate-100 border border-slate-200 rounded-[6px] py-[8px] px-[12px] text-[12px] text-slate-500 cursor-not-allowed">
                  Not Applicable
                </div>
              ) : (
                <CustomDatePicker
                  id="dateClose"
                  value={dateClose}
                  onChange={(val) => {
                    setDateClose(val);
                    if (errors.dateClose) setErrors(prev => ({ ...prev, dateClose: '' }));
                  }}
                  readOnly={true}
                  minDate={dateStart || requestedDate}
                  containerClassName=""
                  inputClassName={`w-full bg-slate-50 border rounded-[6px] py-[8px] pl-[12px] pr-[28px] text-[12px] outline-none focus:ring-4 transition-all duration-200 ${
                    errors.dateClose 
                      ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500/10' 
                      : 'border-slate-200 focus:border-[#0066cc] focus:ring-[#0066cc]/10'
                  }`}
                  buttonClassName="right-[10px] top-[50%] -translate-y-1/2"
                />
              )}
              {errors.dateClose && dateClose !== 'N/A' && <span className="text-rose-500 text-[10px] block mt-[2px]">{errors.dateClose}</span>}
            </div>

            {/* PART TRACEABILITY DETAILS (TO CHANGES) */}
            <div className="space-y-[4px]">
              <div className="flex justify-between items-center">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Part Traceability Details (To Changes) <span className="text-rose-500">*</span></label>
                {changeType === 'Permanent' && (
                  <select
                    value={traceTo === 'N/A' ? 'N/A' : 'Required'}
                    onChange={(e) => {
                      const isNA = e.target.value === 'N/A';
                      setTraceTo(isNA ? 'N/A' : '');
                      if (errors.traceTo) setErrors(prev => ({ ...prev, traceTo: '' }));
                    }}
                    className="text-[10px] bg-slate-50 border border-slate-200 rounded px-1 py-0.5 outline-none cursor-pointer text-slate-600 focus:border-[#0066cc]"
                  >
                    <option value="Required">Required</option>
                    <option value="N/A">N/A</option>
                  </select>
                )}
              </div>
              {traceTo === 'N/A' ? (
                <div className="w-full bg-slate-100 border border-slate-200 rounded-[6px] py-[8px] px-[12px] text-[12px] text-slate-500 cursor-not-allowed">
                  Not Applicable
                </div>
              ) : (
                <>
                  <textarea
                    id="traceTo"
                    placeholder="Describe the change — what, why, how, and expected outcome (min 20 characters)..."
                    value={traceTo}
                    maxLength={1000}
                    onChange={(e) => {
                      setTraceTo(e.target.value);
                      if (errors.traceTo) setErrors(prev => ({ ...prev, traceTo: '' }));
                    }}
                    rows={3}
                    className={`w-full bg-slate-50 border rounded-[6px] py-[8px] px-[12px] text-[12px] outline-none focus:ring-4 transition-all duration-200 resize-none ${
                      errors.traceTo 
                        ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500/10' 
                        : 'border-slate-200 focus:border-[#0066cc] focus:ring-[#0066cc]/10'
                    }`}
                  />
                  <div className="flex justify-between items-center text-[9px] text-slate-400 mt-1">
                    {errors.traceTo ? (
                      <span className="text-rose-500 font-bold">{errors.traceTo}</span>
                    ) : (
                      <span>Traceability detail for proposed setup</span>
                    )}
                    <span className={`${1000 - traceTo.length <= 15 ? 'text-amber-600 font-bold animate-pulse' : 'text-slate-400'}`}>
                      {1000 - traceTo.length} characters remaining (max 1000 chars)
                    </span>
                  </div>
                </>
              )}
            </div>

            {/* UPLOAD SUPPORTING FILES */}
            <div className="space-y-[4px]">
              {renderAttachmentInput(
                "Upload Supporting Files", 
                fileTraceTo, 
                setFileTraceTo, 
                "file-traceto-input", 
                "fileTraceTo", 
                true,
                changeType === 'Permanent' ? (
                  <select
                    value={fileTraceTo === 'N/A' ? 'N/A' : 'Required'}
                    onChange={(e) => {
                      const isNA = e.target.value === 'N/A';
                      if (isNA) {
                        setFileTraceTo('N/A');
                        setUploadedFilesList(prev => prev.filter(f => f.fieldName !== 'fileTraceTo'));
                      } else {
                        setFileTraceTo('');
                      }
                      if (errors.fileTraceTo) setErrors(prev => ({ ...prev, fileTraceTo: '' }));
                    }}
                    className="text-[10px] bg-slate-50 border border-slate-200 rounded px-1 py-0.5 outline-none cursor-pointer text-slate-600 focus:border-[#0066cc]"
                  >
                    <option value="Required">Required</option>
                    <option value="N/A">N/A</option>
                  </select>
                ) : null
              )}
            </div>
          </div>
        </div>

        {/* 5. Risk Analysis Section */}
        <div className="bg-white border border-slate-200/60 rounded-xl p-6 shadow-sm hover:shadow-md transition-all duration-300 space-y-[16px]">
          <h4 className="text-[13px] font-bold text-slate-900 border-b border-slate-100 pb-[8px]">Risk Analysis</h4>

          <div className="grid grid-cols-1 gap-[16px]">
            {/* RISK ANALYSIS */}
            <div className="space-y-[4px]">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Risk Analysis <span className="text-rose-500">*</span></label>
              <textarea
                id="riskAnalysis"
                placeholder="Describe potential risks, their likelihood, impact, and mitigation measures..."
                value={riskAnalysis}
                maxLength={1000}
                onChange={(e) => {
                  setRiskAnalysis(e.target.value);
                  if (errors.riskAnalysis) setErrors(prev => ({ ...prev, riskAnalysis: '' }));
                }}
                rows={3}
                className={`w-full bg-slate-50 border rounded-[6px] py-[8px] px-[12px] text-[12px] outline-none focus:ring-4 transition-all duration-200 resize-none ${
                  errors.riskAnalysis 
                    ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500/10' 
                    : 'border-slate-200 focus:border-[#0066cc] focus:ring-[#0066cc]/10'
                }`}
              />
              <div className="flex justify-between items-center text-[9px] text-slate-400">
                {errors.riskAnalysis ? (
                  <span className="text-rose-500 font-bold">{errors.riskAnalysis}</span>
                ) : (
                  <span>Risk analysis details</span>
                )}
                <span className={`${1000 - riskAnalysis.length <= 15 ? 'text-amber-600 font-bold animate-pulse' : 'text-slate-400'}`}>
                  {1000 - riskAnalysis.length} characters remaining (max 1000 chars)
                </span>
              </div>
            </div>

            {/* UPLOAD SUPPORTING FILES */}
            <div>
              {renderAttachmentInput("Upload Supporting Files", fileRisk, setFileRisk, "file-risk-input", "fileRisk", true)}
            </div>

            {/* UPDATE IN SOP / WI / CONTROL PLAN / FMEA */}
            <div className="space-y-[4px]">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Update in SOP / WI / Control Plan / FMEA <span className="text-rose-500">*</span></label>
              <textarea
                id="sopUpdate"
                placeholder="Describe the updates required in SOP, Work Instructions, Control Plan, FMEA, etc..."
                value={sopUpdate}
                maxLength={1000}
                onChange={(e) => {
                  setSopUpdate(e.target.value);
                  if (errors.sopUpdate) setErrors(prev => ({ ...prev, sopUpdate: '' }));
                }}
                rows={3}
                className={`w-full bg-slate-50 border rounded-[6px] py-[8px] px-[12px] text-[12px] outline-none focus:ring-4 transition-all duration-200 resize-none ${
                  errors.sopUpdate 
                    ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500/10' 
                    : 'border-slate-200 focus:border-[#0066cc] focus:ring-[#0066cc]/10'
                }`}
              />
              <div className="flex justify-between items-center text-[9px] text-slate-400">
                {errors.sopUpdate ? (
                  <span className="text-rose-500 font-bold">{errors.sopUpdate}</span>
                ) : (
                  <span>Updates required details</span>
                )}
                <span className={`${1000 - sopUpdate.length <= 15 ? 'text-amber-600 font-bold animate-pulse' : 'text-slate-400'}`}>
                  {1000 - sopUpdate.length} characters remaining (max 1000 chars)
                </span>
              </div>
            </div>

            {/* Click to upload updated documents */}
            <div>
              {renderAttachmentInput("Upload Supporting Files (SOP, WI, Control Plan, FMEA)", fileSop, setFileSop, "file-sop-input", "fileSop", true)}
            </div>

            {/* USER DEPT HOD APPROVAL (single selection) */}
            <div className="space-y-[6px]" id="hodApproval">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">User Dept HOD Approval <span className="text-rose-500">*</span></label>
              {dbDepartments.length > 0 ? (
                <div className="flex flex-wrap gap-[10px] pt-[4px]">
                  {dbDepartments.map((deptName) => {
                    const isChecked = hodApproval && hodApproval.trim() === deptName;
                    return (
                      <label 
                        key={deptName} 
                        className={`flex items-center gap-[8px] py-[6px] px-[12px] border rounded-[6px] cursor-pointer hover:bg-slate-50 transition-all w-fit select-none ${
                          isChecked 
                            ? 'border-[#0066cc] bg-[#0066cc]/5' 
                            : errors.hodApproval
                            ? 'border-rose-300 bg-rose-50/10'
                            : 'border-slate-200 bg-white'
                        }`}
                      >
                        <input
                          type="radio"
                          name="hodApproval"
                          checked={isChecked}
                          onChange={() => handleHodApprovalToggle(deptName)}
                          className="w-[14px] h-[14px] rounded border-slate-300 text-[#0066cc] focus:ring-[#0066cc]"
                        />
                        <div className="text-[12px] flex items-center">
                          <span className="inline-block bg-slate-100 border border-slate-250 text-slate-500 rounded px-[6px] py-[1px] text-[9px] font-bold uppercase">
                            {deptName}
                          </span>
                        </div>
                      </label>
                    );
                  })}
                </div>
              ) : (
                <div className="text-slate-400 text-[12px] italic bg-slate-50 border border-slate-200 rounded-[6px] p-3 text-center">
                  No departments found.
                </div>
              )}
              {errors.hodApproval && <span className="text-rose-500 text-[10px] block mt-[2px]">{errors.hodApproval}</span>}
            </div>

            {/* CUSTOMER APPROVAL REQUIRED */}
            <div className="space-y-[4px]">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Customer Approval Required <span className="text-rose-500">*</span></label>
              <select
                id="customerApproval"
                value={customerApproval}
                onChange={(e) => {
                  setCustomerApproval(e.target.value);
                  if (errors.customerApproval) setErrors(prev => ({ ...prev, customerApproval: '' }));
                }}
                className={`w-full bg-slate-50 border rounded-[6px] py-[8px] px-[12px] text-[12px] outline-none focus:ring-4 transition-all duration-200 ${
                  errors.customerApproval 
                    ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500/10' 
                    : 'border-slate-200 focus:border-[#0066cc] focus:ring-[#0066cc]/10'
                }`}
              >
                <option value="">— Select —</option>
                <option value="Yes">Yes</option>
                <option value="No">No</option>
              </select>
              {errors.customerApproval && <span className="text-rose-500 text-[10px] block mt-[2px]">{errors.customerApproval}</span>}
            </div>


          </div>
        </div>

        {/* Footer Area with Centered Submit Button and Left-aligned Doc No */}
        <div className="flex flex-col sm:flex-row items-center justify-between pt-[24px] gap-4 w-full">
          <div className="text-[11px] font-bold text-black-400 sm:flex-1 text-left w-full sm:w-auto mt-auto mb-2 sm:mb-0">
            DOC NO : PRD/FR/156 R1
          </div>
          
          <div className="flex flex-col items-center justify-center gap-2 sm:flex-1">
            <button
              type="submit"
              disabled={isSubmitting || isAdmin}
              className="flex items-center justify-center gap-[8px] bg-[#0066cc] hover:bg-[#0052a3] disabled:opacity-60 disabled:cursor-not-allowed text-white px-[32px] py-[12px] rounded-[6px] text-[13px] font-bold shadow-md transition-all transform active:scale-[0.98] cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="animate-spin" size={16} />
                  <span>Submitting...</span>
                </>
              ) : (
                <span>Submit</span>
              )}
            </button>
            {isAdmin && (
              <span className="text-[11px] text-rose-500 font-semibold whitespace-nowrap text-center">
                Admin is not allowed to submit L1 request
              </span>
            )}
          </div>

          <div className="hidden sm:block sm:flex-1"></div>
        </div>
      </form>

      {/* Process Modal */}
      {isProcessModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-[16px]">
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsProcessModalOpen(false)} />
          <div className="relative bg-white w-full max-w-[400px] rounded-[16px] shadow-2xl border border-slate-200 flex flex-col z-10 max-h-[80vh]">
            <div className="bg-slate-50 px-[20px] py-[14px] border-b border-slate-100 flex items-center justify-between rounded-t-[16px]">
              <h4 className="text-[14px] font-bold text-slate-800">Process Names in DB</h4>
              <button onClick={() => setIsProcessModalOpen(false)} className="p-[4px] hover:bg-slate-200/60 rounded-full text-slate-400 hover:text-slate-650 transition-colors">
                <X size={16} />
              </button>
            </div>
            <div className="p-[20px] overflow-y-auto space-y-[16px]">
              <div className="space-y-[4px]">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Add New Process</label>
                <div className="flex gap-[8px]">
                  <input
                    type="text"
                    placeholder="Enter new process name..."
                    value={tempProcessName}
                    maxLength={100}
                    onChange={(e) => setTempProcessName(e.target.value)}
                    className="flex-1 bg-slate-50 border border-slate-200 rounded-[6px] py-[8px] px-[12px] text-[12px] outline-none focus:border-[#0066cc]"
                  />
                  <button
                    type="button"
                    onClick={handleAddProcess}
                    className="bg-[#0066cc] hover:bg-[#0052a3] text-white px-[12px] rounded-[6px] text-[12px] font-bold transition-colors cursor-pointer"
                  >
                    Add / Select
                  </button>
                </div>
              </div>
              <div className="space-y-[8px] pt-[8px] border-t border-slate-100">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Existing Processes</label>
                {dbProcesses.length > 0 ? (
                  <ul className="space-y-[4px]">
                    {dbProcesses.map(p => (
                      <li
                        key={p}
                        onClick={() => {
                          setProcessName(p);
                          setIsProcessModalOpen(false);
                        }}
                        className="bg-slate-50 hover:bg-[#e6f0fa] hover:text-[#0066cc] cursor-pointer px-[12px] py-[8px] rounded-[6px] text-[12px] text-slate-600 font-medium transition-colors border border-transparent hover:border-[#b2d1f0] flex justify-between items-center"
                      >
                        <span>{p}</span>
                        <button onClick={(e) => handleDeleteProcess(p, e)} className="text-slate-400 hover:text-rose-500 p-[4px] rounded-full hover:bg-white transition-colors" title="Delete Process">
                          <Trash2 size={14} />
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-[12px] text-slate-400">No existing processes found in DB.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Machine Modal */}
      {isMachineModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-[16px]">
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsMachineModalOpen(false)} />
          <div className="relative bg-white w-full max-w-[400px] rounded-[16px] shadow-2xl border border-slate-200 flex flex-col z-10 max-h-[80vh]">
            <div className="bg-slate-50 px-[20px] py-[14px] border-b border-slate-100 flex items-center justify-between rounded-t-[16px]">
              <h4 className="text-[14px] font-bold text-slate-800">Machine Nos in DB</h4>
              <button onClick={() => setIsMachineModalOpen(false)} className="p-[4px] hover:bg-slate-200/60 rounded-full text-slate-400 hover:text-slate-650 transition-colors">
                <X size={16} />
              </button>
            </div>
            <div className="p-[20px] overflow-y-auto space-y-[16px]">
              <div className="space-y-[4px]">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Add New Machine No</label>
                <div className="flex gap-[8px]">
                  <input
                    type="text"
                    placeholder="Enter new machine no..."
                    value={tempMachineNo}
                    maxLength={100}
                    onChange={(e) => setTempMachineNo(e.target.value)}
                    className="flex-1 bg-slate-50 border border-slate-200 rounded-[6px] py-[8px] px-[12px] text-[12px] outline-none focus:border-[#0066cc]"
                  />
                  <button
                    type="button"
                    onClick={async () => {
                      if (tempMachineNo.trim()) {
                        try {
                          await addMachine(tempMachineNo.trim());
                          setMachineNo(tempMachineNo.trim());
                          setTempMachineNo('');
                          setIsMachineModalOpen(false);
                          fetchOptions();
                        } catch (e) {
                          console.error('Error adding machine:', e);
                        }
                      }
                    }}
                    className="bg-[#0066cc] hover:bg-[#0052a3] text-white px-[12px] rounded-[6px] text-[12px] font-bold transition-colors cursor-pointer"
                  >
                    Add / Select
                  </button>
                </div>
              </div>
              <div className="space-y-[8px] pt-[8px] border-t border-slate-100">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Existing Machines</label>
                {dbMachines.length > 0 ? (
                  <ul className="space-y-[4px]">
                    {dbMachines.map(m => (
                      <li
                        key={m}
                        onClick={() => {
                          setMachineNo(m);
                          setIsMachineModalOpen(false);
                        }}
                        className="bg-slate-50 hover:bg-[#e6f0fa] hover:text-[#0066cc] cursor-pointer px-[12px] py-[8px] rounded-[6px] text-[12px] text-slate-600 font-medium transition-colors border border-transparent hover:border-[#b2d1f0] flex justify-between items-center"
                      >
                        <span>{m}</span>
                        <button onClick={(e) => handleDeleteMachine(m, e)} className="text-slate-400 hover:text-rose-500 p-[4px] rounded-full hover:bg-white transition-colors" title="Delete Machine">
                          <Trash2 size={14} />
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-[12px] text-slate-400">No existing machines found in DB.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {itemToDelete && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-[16px]">
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setItemToDelete(null)} />
          <div className="relative bg-white w-full max-w-[320px] rounded-[16px] shadow-2xl border border-slate-200 flex flex-col z-10 p-[24px] text-center animate-fade-in-up">
            <div className="mx-auto bg-rose-100 text-rose-600 p-[12px] rounded-full mb-[16px]">
              <AlertTriangle size={24} />
            </div>
            <h4 className="text-[16px] font-bold text-slate-800 mb-[8px]">Delete {itemToDelete.type === 'process' ? 'Process' : 'Machine'}?</h4>
            <p className="text-[13px] text-slate-500 mb-[24px]">
              Are you sure you want to delete "{itemToDelete.name}"? This action cannot be undone.
            </p>
            <div className="flex gap-[12px] w-full">
              <button
                onClick={() => setItemToDelete(null)}
                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 py-[10px] rounded-[8px] text-[13px] font-bold transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="flex-1 bg-rose-600 hover:bg-rose-700 text-white py-[10px] rounded-[8px] text-[13px] font-bold transition-colors shadow-sm"
              >
                Delete
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

      {/* Dynamic Table Input Modal */}
      {isImprovementModalOpen && ['cost', 'productivity', 'quality'].includes((improvementArea || '').toLowerCase()) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-[16px]">
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsImprovementModalOpen(false)} />
          <div className="relative bg-white w-full max-w-[850px] rounded-[16px] shadow-2xl border border-slate-200 flex flex-col z-10 max-h-[85vh] overflow-hidden animate-fade-in-up">
            <div className="bg-slate-50 px-[24px] py-[16px] border-b border-slate-100 flex items-center justify-between rounded-t-[16px]">
              <h4 className="text-[14px] font-bold text-slate-800 uppercase tracking-wider">
                {(improvementArea || '').toLowerCase() === 'cost' ? 'Cost Saving Data Table' : 
                 (improvementArea || '').toLowerCase() === 'productivity' ? 'Productivity Improvement Data Table' : 
                 'Quality Improvement Data Table'}
              </h4>
              <button onClick={() => setIsImprovementModalOpen(false)} className="p-[4px] hover:bg-slate-200/60 rounded-full text-slate-400 hover:text-slate-650 transition-colors">
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
                      {(improvementArea || '').toLowerCase() === 'cost' && (
                        <>
                          <th className="p-[10px]">Total Cost Saved / month (Rs)</th>
                          <th className="p-[10px]">Total Cost Saved / Annum (Rs)</th>
                          <th className="p-[10px]">ROI (Rs)</th>
                        </>
                      )}
                      {(improvementArea || '').toLowerCase() === 'productivity' && (
                        <>
                          <th className="p-[10px]">Current Productivity (nos)</th>
                          <th className="p-[10px]">Productivity Improved (nos)</th>
                        </>
                      )}
                      {(improvementArea || '').toLowerCase() === 'quality' && (
                        <>
                          <th className="p-[10px]">Current PPM</th>
                          <th className="p-[10px]">Reduced PPM</th>
                        </>
                      )}
                      <th className="p-[10px] w-[50px] text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {improvementTableData.map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50">
                        <td className="p-[8px] font-bold text-slate-400 text-center">{idx + 1}</td>
                        <td className="p-[8px]">
                          <input
                            type="text"
                            value={row.changeNo}
                            onChange={(e) => handleUpdateCell(idx, 'changeNo', e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-[6px] py-[6px] px-[10px] text-[11px] outline-none focus:border-[#0066cc]"
                          />
                        </td>
                        <td className="p-[8px]">
                          <CustomDatePicker
                            value={row.date}
                            onChange={(val) => handleUpdateCell(idx, 'date', val)}
                            readOnly={true}
                            minDate={requestedDate}
                            placeholder="dd/mm/yyyy"
                            inputClassName={`w-full bg-slate-50 border rounded-[6px] py-[6px] pl-[10px] pr-[24px] text-[11px] outline-none focus:border-[#0066cc] ${
                              modalError && !row.date ? 'border-rose-500 bg-rose-50/10 focus:border-rose-500' : 'border-slate-200'
                            }`}
                            buttonClassName="right-[6px] top-[50%] -translate-y-1/2"
                          />
                        </td>
                        {(improvementArea || '').toLowerCase() === 'cost' && (
                          <>
                            <td className="p-[8px]">
                              <input
                                type="number"
                                placeholder="0"
                                value={row.monthlySave}
                                onChange={(e) => handleUpdateCell(idx, 'monthlySave', e.target.value)}
                                className={`w-full bg-slate-50 border rounded-[6px] py-[6px] px-[10px] text-[11px] outline-none focus:border-[#0066cc] ${
                                  modalError && !row.monthlySave ? 'border-rose-500 bg-rose-50/10 focus:border-rose-500' : 'border-slate-200'
                                }`}
                              />
                            </td>
                            <td className="p-[8px]">
                              <input
                                type="number"
                                placeholder="0"
                                value={row.annualSave}
                                onChange={(e) => handleUpdateCell(idx, 'annualSave', e.target.value)}
                                className={`w-full bg-slate-50 border rounded-[6px] py-[6px] px-[10px] text-[11px] outline-none focus:border-[#0066cc] ${
                                  modalError && !row.annualSave ? 'border-rose-500 bg-rose-50/10 focus:border-rose-500' : 'border-slate-200'
                                }`}
                              />
                            </td>
                            <td className="p-[8px]">
                              <input
                                type="number"
                                placeholder="0"
                                value={row.roi}
                                onChange={(e) => handleUpdateCell(idx, 'roi', e.target.value)}
                                className={`w-full bg-slate-50 border rounded-[6px] py-[6px] px-[10px] text-[11px] outline-none focus:border-[#0066cc] ${
                                  modalError && !row.roi ? 'border-rose-500 bg-rose-50/10 focus:border-rose-500' : 'border-slate-200'
                                }`}
                              />
                            </td>
                          </>
                        )}
                        {(improvementArea || '').toLowerCase() === 'productivity' && (
                          <>
                            <td className="p-[8px]">
                              <input
                                type="number"
                                placeholder="0"
                                value={row.currentProd}
                                onChange={(e) => handleUpdateCell(idx, 'currentProd', e.target.value)}
                                className={`w-full bg-slate-50 border rounded-[6px] py-[6px] px-[10px] text-[11px] outline-none focus:border-[#0066cc] ${
                                  modalError && !row.currentProd ? 'border-rose-500 bg-rose-50/10 focus:border-rose-500' : 'border-slate-200'
                                }`}
                              />
                            </td>
                            <td className="p-[8px]">
                              <input
                                type="number"
                                placeholder="0"
                                value={row.improvedProd}
                                onChange={(e) => handleUpdateCell(idx, 'improvedProd', e.target.value)}
                                className={`w-full bg-slate-50 border rounded-[6px] py-[6px] px-[10px] text-[11px] outline-none focus:border-[#0066cc] ${
                                  modalError && !row.improvedProd ? 'border-rose-500 bg-rose-50/10 focus:border-rose-500' : 'border-slate-200'
                                }`}
                              />
                            </td>
                          </>
                        )}
                        {(improvementArea || '').toLowerCase() === 'quality' && (
                          <>
                            <td className="p-[8px]">
                              <input
                                type="number"
                                placeholder="0"
                                value={row.currentPpm}
                                onChange={(e) => handleUpdateCell(idx, 'currentPpm', e.target.value)}
                                className={`w-full bg-slate-50 border rounded-[6px] py-[6px] px-[10px] text-[11px] outline-none focus:border-[#0066cc] ${
                                  modalError && !row.currentPpm ? 'border-rose-500 bg-rose-50/10 focus:border-rose-500' : 'border-slate-200'
                                }`}
                              />
                            </td>
                            <td className="p-[8px]">
                              <input
                                type="number"
                                placeholder="0"
                                value={row.reducedPpm}
                                onChange={(e) => handleUpdateCell(idx, 'reducedPpm', e.target.value)}
                                className={`w-full bg-slate-50 border rounded-[6px] py-[6px] px-[10px] text-[11px] outline-none focus:border-[#0066cc] ${
                                  modalError && !row.reducedPpm ? 'border-rose-500 bg-rose-50/10 focus:border-rose-500' : 'border-slate-200'
                                }`}
                              />
                            </td>
                          </>
                        )}
                        <td className="p-[8px] text-center">
                          <button
                            type="button"
                            onClick={() => handleDeleteRow(idx)}
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
                onClick={handleAddRow}
                className="flex items-center gap-[6px] px-[12px] py-[6px] border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 rounded-[6px] text-[11px] font-bold shadow-sm transition-colors cursor-pointer select-none w-fit"
              >
                <Plus size={12} />
                <span>Add Row</span>
              </button>
            </div>

            <div className="bg-slate-50 px-[24px] py-[14px] border-t border-slate-100 flex items-center justify-between gap-[12px]">
              <div className="text-rose-600 text-[11.5px] font-bold">
                {modalError && (
                  <span className="flex items-center gap-[6px]">
                    <AlertTriangle size={14} className="text-rose-500 shrink-0" />
                    {modalError}
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={handleDoneClick}
                className="bg-[#0066cc] hover:bg-[#0052a3] text-white px-[20px] py-[8px] rounded-[6px] text-[12px] font-bold shadow-sm transition-colors cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
