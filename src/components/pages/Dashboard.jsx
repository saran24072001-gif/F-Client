import { useState, useEffect, lazy, Suspense, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getDashboardChanges, getEffectivenessLogs, getNotifications, getUsers } from '../../api/apiRoutes';
import { getSyncedDate } from '../../utils/timeSync';
import {
  LogOut,
  GitPullRequest,
  CheckCircle,
  TrendingUp,
  Users as UsersIcon,
  LayoutGrid,
  FilePlus,
  ClipboardList,
  Menu,
  X,
  CheckCheck,
  ListTodo,
  Bell,
  ChevronDown,
  ChevronUp,
  Loader2
} from 'lucide-react';

const DashboardOverview = lazy(() => import('./DashboardOverview').then(m => ({ default: m.DashboardOverview })));
const AllRequests = lazy(() => import('./AllRequests').then(m => ({ default: m.AllRequests })));
const L1Request = lazy(() => import('./L1Request').then(m => ({ default: m.L1Request })));
const L3RequestTracker = lazy(() => import('./L3RequestTracker').then(m => ({ default: m.L3RequestTracker })));
const AllApprovals = lazy(() => import('./AllApprovals').then(m => ({ default: m.AllApprovals })));
const L2Validation = lazy(() => import('./L2Validation').then(m => ({ default: m.L2Validation })));
const Effectiveness = lazy(() => import('./Effectiveness').then(m => ({ default: m.Effectiveness })));
const Users = lazy(() => import('./Users').then(m => ({ default: m.Users })));
const Notifications = lazy(() => import('./Notifications').then(m => ({ default: m.Notifications })));
import nipponLogo from '../../assets/Nippon Logo.png';
import { useWebSocket } from '../../hooks/useWebSocket';

export const Dashboard = ({ userEmail, userRole, userName, onSignOut }) => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('dashboard'); // 'dashboard' | 'new-request' | 'all-requests' | 'approvals' | 'effectiveness' | 'reports' | 'audit-log' | 'users' | 'settings' | 'notifications'
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [levelOpen, setLevelOpen] = useState(true);
  const [notifications, setNotifications] = useState([]);
  const [userDept, setUserDept] = useState('');
  const isHOD = userRole && (
    userRole.toLowerCase().includes('hod') ||
    userRole.toLowerCase().includes('unit head') ||
    userRole.toLowerCase().includes('unit_head') ||
    userRole.toLowerCase().includes('manager')
  );

  const isAdmin = userRole && userRole.toLowerCase().includes('admin');
  const isQA = userDept && (
    userDept.toLowerCase() === 'qad'
  );
  const handleLocalSignOut = () => {
    logAction('Sign Out', 'User logged out of the system.');
    onSignOut();
    navigate('/');
  };

  // Database States
  const [changes, setChanges] = useState([]);
  const [usersList, setUsersList] = useState([]);
  const [isFetchingChanges, setIsFetchingChanges] = useState(false);

  // Global Toast State
  const [toastMsg, setToastMsg] = useState(null);

  // Effectiveness Monitoring State (loaded from backend API)
  const [effectivenessLogs, setEffectivenessLogs] = useState([]);

  useEffect(() => {
    const stored = localStorage.getItem('cms_audit_logs');
    if (!stored) {
      const defaultAudit = [
        {
          id: 'AUD-001',
          timestamp: new Date(getSyncedDate().getTime() - 3600000).toISOString(),
          action: 'User Login',
          user: 'admin@cms.com',
          details: 'Successfully authenticated as Administrator.'
        },
        {
          id: 'AUD-002',
          timestamp: new Date(getSyncedDate().getTime() - 7200000).toISOString(),
          action: 'Status Updated',
          user: 'manager@cms.com',
          details: 'Approved change request CHG-8901.'
        },
        {
          id: 'AUD-003',
          timestamp: new Date(getSyncedDate().getTime() - 10800000).toISOString(),
          action: 'Change Created',
          user: 'requester@cms.com',
          details: 'Created new change request CHG-8899.'
        },
        {
          id: 'AUD-004',
          timestamp: new Date(getSyncedDate().getTime() - 14400000).toISOString(),
          action: 'Status Updated',
          user: 'admin@cms.com',
          details: 'Marked change request CHG-8895 as Completed.'
        }
      ];
      localStorage.setItem('cms_audit_logs', JSON.stringify(defaultAudit));
    }
  }, []);

  // Helper to log audit actions
  const logAction = (action, details) => {
    const newLog = {
      id: `AUD-${Date.now().toString().substring(7)}`,
      timestamp: getSyncedDate().toISOString(),
      action,
      user: userEmail || 'system',
      details
    };
    const stored = localStorage.getItem('cms_audit_logs');
    const prev = stored ? JSON.parse(stored) : [];
    const updated = [newLog, ...prev];
    localStorage.setItem('cms_audit_logs', JSON.stringify(updated));
  };

  // Fetch changes from the backend
  const fetchChanges = async (silent = false) => {
    if (!silent) setIsFetchingChanges(true);
    try {
      const response = await getDashboardChanges();
      setChanges(response.data);
    } catch (error) {
      console.error(error);
      if (error.response?.status === 401 || error.response?.status === 403) {
        handleLocalSignOut();
      } else {
        setToastMsg({ text: 'Failed to load changes from backend.', isError: true });
      }
    } finally {
      if (!silent) setIsFetchingChanges(false);
    }
  };

  // Fetch initial data
  // Fetch effectiveness logs from backend
  const fetchEffectiveness = async () => {
    try {
      const response = await getEffectivenessLogs();
      setEffectivenessLogs(response.data);
    } catch (error) {
      console.error(error);
      setToastMsg({ text: 'Failed to load effectiveness logs from server.', isError: true });
    }
  };

  // Fetch notifications from backend
  const fetchNotifications = async () => {
    try {
      const response = await getNotifications();
      setNotifications(response.data);
    } catch (error) {
      console.error(error);
      setToastMsg({ text: 'Failed to load notifications from server.', isError: true });
    }
  };

  useEffect(() => {
    const token = localStorage.getItem('cms_token') || sessionStorage.getItem('cms_token');
    if (token) {
      fetchChanges();
      fetchEffectiveness();
      fetchNotifications();
      logAction('Session Started', `User initialized session with role: ${userRole}`);
    } else {
      navigate('/', { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate]);

  const fetchUserDept = useCallback(async () => {
    try {
      const response = await getUsers();
      const list = response.data || [];
      setUsersList(list);
      if (userEmail) {
        const currentUser = list.find(u => u.email.toLowerCase() === userEmail.toLowerCase());
        if (currentUser && currentUser.department) {
          setUserDept(currentUser.department);
        }
      }
    } catch (err) {
      console.error('Error fetching user department and users list:', err);
    }
  }, [userEmail, setUsersList, setUserDept]);

  useEffect(() => {
    fetchUserDept();
  }, [fetchUserDept]);

  // Clear toast notifications
  useEffect(() => {
    if (toastMsg) {
      const timer = setTimeout(() => setToastMsg(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toastMsg]);

  // WebSocket real-time updates integration
  useWebSocket((data) => {
    console.log('📩 Received WebSocket message in Dashboard:', data);
    if (data.type === 'REFRESH_CHANGES') {
      fetchChanges(true);
    } else if (data.type === 'REFRESH_NOTIFICATIONS') {
      fetchNotifications();
    } else if (data.type === 'REFRESH_EFFECTIVENESS') {
      fetchEffectiveness();
      fetchChanges(true);
    } else if (data.type === 'REFRESH_USERS') {
      fetchUserDept();
    }
  });



  const [showProfileModal, setShowProfileModal] = useState(false);
  const [autoOpenChangeNo, setAutoOpenChangeNo] = useState(null);

  // Helper to handle tab select
  const handleTabChange = (tabId, payloadChangeNo = null) => {
    setActiveTab(tabId);
    setAutoOpenChangeNo(payloadChangeNo);
    setMobileMenuOpen(false);
  };

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-800 font-sans">

      {/* 1. Sidebar Left Panel */}
      <aside className={`fixed inset-y-0 left-0 z-40 w-64 bg-white border-r border-slate-200 flex flex-col justify-between transform transition-transform duration-300 md:translate-x-0 ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>

        {/* Sidebar Header Logo */}
        <div>
          <div className="px-6 py-5 flex items-center justify-between border-b border-slate-200">
            <div>
              <h1 className="font-heading text-2xl font-extrabold tracking-tight text-[#0066cc] flex items-center gap-2">
                4M CMS
              </h1>
              <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider mt-0.5">Change Management</p>
            </div>
            {/* Mobile close button */}
            <button onClick={() => setMobileMenuOpen(false)} className="md:hidden text-slate-400 hover:text-slate-700">
              <X size={20} />
            </button>
          </div>

          {/* Navigation Links Group */}
          <nav className="p-4 space-y-1.5 overflow-y-auto max-h-[calc(100vh-160px)]">

            {/* Dashboard */}
            <button
              onClick={() => handleTabChange('dashboard')}
              className={`w-full flex items-center justify-between px-3 py-2.5 text-sm font-medium transition-all duration-200 cursor-pointer rounded-lg ${activeTab === 'dashboard'
                ? 'bg-gradient-to-r from-sky-50 to-[#e6f0fa]/40 text-[#0066cc] border-l-[3.5px] border-[#0066cc] font-semibold'
                : 'text-black hover:text-[#0066cc] hover:bg-slate-50'
                }`}
            >
              <div className="flex items-center gap-3">
                <LayoutGrid size={18} className={activeTab === 'dashboard' ? 'text-[#0066cc]' : 'text-slate-400'} />
                <span>Dashboard</span>
              </div>
            </button>

            {/* All Requests */}
            <button
              onClick={() => handleTabChange('all-requests')}
              className={`w-full flex items-center justify-between px-3 py-2.5 text-sm font-medium transition-all duration-200 cursor-pointer rounded-lg ${activeTab === 'all-requests'
                ? 'bg-gradient-to-r from-sky-50 to-[#e6f0fa]/40 text-[#0066cc] border-l-[3.5px] border-[#0066cc] font-semibold'
                : 'text-black hover:text-[#0066cc] hover:bg-slate-50'
                }`}
            >
              <div className="flex items-center gap-3">
                <ClipboardList size={18} className={activeTab === 'all-requests' ? 'text-[#0066cc]' : 'text-slate-400'} />
                <span>All Requests</span>
              </div>
            </button>

            {/* All Approvals (HOD & Admin & QA) */}
            {(isHOD || isAdmin || isQA) && (
              <button
                onClick={() => handleTabChange('all-approvals')}
                className={`w-full flex items-center justify-between px-3 py-2.5 text-sm font-medium transition-all duration-200 cursor-pointer rounded-lg ${activeTab === 'all-approvals'
                  ? 'bg-gradient-to-r from-sky-50 to-[#e6f0fa]/40 text-[#0066cc] border-l-[3.5px] border-[#0066cc] font-semibold'
                  : 'text-black hover:text-[#0066cc] hover:bg-slate-50'
                  }`}
              >
                <div className="flex items-center gap-3">
                  <CheckCheck size={18} className={activeTab === 'all-approvals' ? 'text-[#0066cc]' : 'text-slate-400'} />
                  <span>All L1 Approvals</span>
                </div>
              </button>
            )}

            {/* Level Expandable */}
            <div className="space-y-0.5">
              <button
                onClick={() => setLevelOpen(!levelOpen)}
                className={`w-full flex items-center justify-between px-3 py-2.5 text-sm font-medium transition-all duration-200 cursor-pointer rounded-lg ${(activeTab === 'l1' || activeTab === 'approvals' || activeTab === 'l3')
                  ? 'bg-gradient-to-r from-sky-50 to-[#e6f0fa]/40 text-[#0066cc] border-l-[3.5px] border-[#0066cc] font-semibold'
                  : 'text-black hover:text-[#0066cc] hover:bg-slate-50'
                  }`}
              >
                <div className="flex items-center gap-3">
                  <FilePlus size={18} className={(activeTab === 'l1' || activeTab === 'approvals') ? 'text-[#0066cc]' : 'text-slate-400'} />
                  <span>Level</span>
                </div>
                {levelOpen ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
              </button>

              {/* L1, L2 and L3 Sub-menu */}
              {levelOpen && (
                <div className="pl-6 space-y-0.5 border-l border-slate-100 ml-5 py-1">
                  {/* L1 */}
                  <button
                    onClick={() => handleTabChange('l1')}
                    className={`w-full flex items-center justify-between px-3 py-2 text-xs font-medium transition-all duration-200 cursor-pointer rounded-lg ${activeTab === 'l1'
                      ? 'bg-gradient-to-r from-sky-50/70 to-[#e6f0fa]/30 text-[#0066cc] border-l-[2.5px] border-[#0066cc] font-semibold'
                      : 'text-black hover:text-[#0066cc] hover:bg-slate-50'
                      }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <CheckCircle size={14} className={activeTab === 'l1' ? 'text-[#0066cc]' : 'text-slate-400'} />
                      <span>L1</span>
                    </div>
                  </button>

                  {/* L2 */}
                  <button
                    onClick={() => handleTabChange('approvals')}
                    className={`w-full flex items-center justify-between px-3 py-2 text-xs font-medium transition-all duration-200 cursor-pointer rounded-lg ${activeTab === 'approvals'
                      ? 'bg-gradient-to-r from-sky-50/70 to-[#e6f0fa]/30 text-[#0066cc] border-l-[2.5px] border-[#0066cc] font-semibold'
                      : 'text-black hover:text-[#0066cc] hover:bg-slate-50'
                      }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <CheckCheck size={14} className={activeTab === 'approvals' ? 'text-[#0066cc]' : 'text-slate-400'} />
                      <span>L2</span>
                    </div>
                  </button>

                  {/* L3 */}
                  <button
                    onClick={() => handleTabChange('l3')}
                    className={`w-full flex items-center justify-between px-3 py-2 text-xs font-medium transition-all duration-200 cursor-pointer rounded-lg ${activeTab === 'l3'
                      ? 'bg-gradient-to-r from-sky-50/70 to-[#e6f0fa]/30 text-[#0066cc] border-l-[2.5px] border-[#0066cc] font-semibold'
                      : 'text-black hover:text-[#0066cc] hover:bg-slate-50'
                      }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <ListTodo size={14} className={activeTab === 'l3' ? 'text-[#0066cc]' : 'text-slate-400'} />
                      <span>L3</span>
                    </div>
                  </button>
                </div>
              )}
            </div>

            {/* Effectiveness */}
            <button
              onClick={() => handleTabChange('effectiveness')}
              className={`w-full flex items-center justify-between px-3 py-2.5 text-sm font-medium transition-all duration-200 cursor-pointer rounded-lg ${activeTab === 'effectiveness'
                ? 'bg-gradient-to-r from-sky-50 to-[#e6f0fa]/40 text-[#0066cc] border-l-[3.5px] border-[#0066cc] font-semibold'
                : 'text-black hover:text-[#0066cc] hover:bg-slate-50'
                }`}
            >
              <div className="flex items-center gap-3">
                <TrendingUp size={18} className={activeTab === 'effectiveness' ? 'text-[#0066cc]' : 'text-slate-400'} />
                <span>Effectiveness</span>
              </div>
            </button>

            {/* Notifications */}
            <button
              onClick={() => handleTabChange('notifications')}
              className={`w-full flex items-center justify-between px-3 py-2.5 text-sm font-medium transition-all duration-200 cursor-pointer rounded-lg ${activeTab === 'notifications'
                ? 'bg-gradient-to-r from-sky-50 to-[#e6f0fa]/40 text-[#0066cc] border-l-[3.5px] border-[#0066cc] font-semibold'
                : 'text-black hover:text-[#0066cc] hover:bg-slate-50'
                }`}
            >
              <div className="flex items-center gap-3">
                <Bell size={18} className={activeTab === 'notifications' ? 'text-[#0066cc]' : 'text-slate-400'} />
                <span>Notifications</span>
              </div>
              {notifications.filter(n => !n.isRead).length > 0 && (
                <span className="min-w-[20px] h-[20px] px-1.5 flex items-center justify-center bg-rose-600 text-white font-bold text-[10px] rounded-full animate-badge-blink">
                  {notifications.filter(n => !n.isRead).length}
                </span>
              )}
            </button>

            {/* Users (Admin Only) */}
            {userRole && userRole.toLowerCase().includes('admin') && (
              <button
                onClick={() => handleTabChange('users')}
                className={`w-full flex items-center justify-between px-3 py-2.5 text-sm font-medium transition-all duration-200 cursor-pointer rounded-lg ${activeTab === 'users'
                  ? 'bg-gradient-to-r from-sky-50 to-[#e6f0fa]/40 text-[#0066cc] border-l-[3.5px] border-[#0066cc] font-semibold'
                  : 'text-black hover:text-[#0066cc] hover:bg-slate-50'
                  }`}
              >
                <div className="flex items-center gap-3">
                  <UsersIcon size={18} className={activeTab === 'users' ? 'text-[#0066cc]' : 'text-slate-400'} />
                  <span>Users</span>
                </div>
              </button>
            )}



          </nav>
        </div>

        {/* Sidebar Footer User Details */}
        <div className="p-4 border-t border-slate-200 bg-white">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setShowProfileModal(true)}
              className="flex items-center gap-3 cursor-pointer text-left focus:outline-none hover:bg-slate-50 p-1.5 rounded-lg -ml-1.5 transition-all duration-200 shrink-0"
              title="View profile details"
            >
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-600 to-indigo-700 text-white flex items-center justify-center font-bold text-sm shadow-[0_2px_8px_rgba(37,99,235,0.25)] shrink-0">
                {(userName || userEmail || 'A')[0].toUpperCase()}
              </div>
              <div className="text-left">
                <div className="text-sm font-bold text-slate-800 leading-tight max-w-[110px] truncate" title={userName || userEmail}>
                  {userName || (userEmail ? userEmail.split('@')[0] : 'Admin')}
                </div>
                <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider leading-none mt-0.5">
                  {userRole || 'Administrator'}
                </span>
                {userDept && (
                  <span className="block text-[9px] font-semibold text-slate-500 tracking-wide mt-0.5" title={`Department: ${userDept}`}>
                    Dept: {userDept}
                  </span>
                )}
              </div>
            </button>
            {/* Logout button */}
            <button
              onClick={handleLocalSignOut}
              className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer transition-colors"
              title="Sign Out"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      {/* 2. Main Content Right Panel */}
      <div className="flex-1 md:pl-64 flex flex-col min-h-screen min-w-0">

        {/* Top Header Bar */}
        <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-sm border-b border-slate-200 px-[10px] sm:px-[24px] py-[10px] sm:py-[16px] flex items-center justify-between">
          <div className="flex items-center gap-[6px] sm:gap-[12px] min-w-0">
            {/* Mobile menu toggle */}
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden p-[6px] text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-[8px] shrink-0"
            >
              <Menu size={18} />
            </button>
            <div className="min-w-0">
              <h2 className="font-heading text-[13px] xs:text-[15px] sm:text-[20px] md:text-[22px] font-bold text-slate-900 leading-tight truncate">
                {activeTab === 'dashboard' ? 'Overview' :
                  activeTab === 'approvals' ? 'L2 Validation Workflow' :
                    activeTab === 'notifications' ? 'Notifications' :
                      activeTab === 'l1' ? 'New L1 Change Request' :
                        activeTab === 'l3' ? 'L3 Request Tracker & Final Approval' :
                          activeTab === 'all-requests' ? 'All Change Requests' :
                            activeTab === 'all-approvals' ? 'All L1 Approvals' :
                              activeTab === 'effectiveness' ? 'Effectiveness' :
                                activeTab === 'users' ? 'Users' :
                                  activeTab.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-[8px] sm:gap-[16px] shrink-0">



            {/* Bell icon - visible on all tabs */}
            <button
              onClick={() => handleTabChange('notifications')}
              className="relative p-[8px] text-slate-600 hover:text-[#0066cc] bg-slate-100 hover:bg-slate-200/50 rounded-full transition-colors cursor-pointer"
              title="Notifications"
            >
              <Bell size={20} />
              {notifications.filter(n => !n.isRead).length > 0 && (
                <span className="absolute -top-[4px] -right-[4px] min-w-[18px] h-[18px] px-[4px] flex items-center justify-center bg-rose-600 text-white font-bold text-[9px] rounded-full border-2 border-white animate-badge-blink">
                  {notifications.filter(n => !n.isRead).length}
                </span>
              )}
            </button>

            {/* Sign Out button - always visible */}
            <button
              onClick={handleLocalSignOut}
              title="Sign Out"
              className="flex items-center gap-[6px] bg-white border border-slate-250 hover:bg-rose-50 hover:border-rose-500 hover:text-rose-600 text-slate-600 p-[6px] sm:px-[14px] sm:py-[6px] rounded-[8px] text-[12px] font-semibold cursor-pointer transition-colors"
            >
              <LogOut size={12} />
              <span className="hidden sm:inline">Sign Out</span>
            </button>

            {/* Nippon Logo in assets */}
            <div className="pl-[4px] sm:pl-[8px] border-l border-slate-200">
              <img src={nipponLogo} alt="Nippon Logo" className="h-[24px] sm:h-[32px] w-auto object-contain select-none" />
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-grow py-[24px] px-[24px] w-full max-w-none min-w-0">
          <Suspense fallback={
            <div className="flex flex-col items-center justify-center py-[100px] gap-2 text-slate-500">
              <Loader2 className="animate-spin text-[#0066cc]" size={24} />
              <span className="text-[12px] font-semibold">Loading tab content...</span>
            </div>
          }>
            {/* TAB: DASHBOARD OVERVIEW */}
            {activeTab === 'dashboard' && (
              <DashboardOverview
                changes={changes}
                isFetchingChanges={isFetchingChanges}
                onTabChange={handleTabChange}
                setToastMsg={setToastMsg}
                usersList={usersList}
                isAdmin={isAdmin}
                userEmail={userEmail}
                userName={userName}
                fetchChanges={fetchChanges}
              />
            )}

            {/* TAB: ALL REQUESTS */}
            {activeTab === 'all-requests' && (
              <AllRequests
                changes={changes}
                onTabChange={handleTabChange}
                setToastMsg={setToastMsg}
                usersList={usersList}
                autoOpenChangeNo={autoOpenChangeNo}
                clearAutoOpen={() => setAutoOpenChangeNo(null)}
                isAdmin={isAdmin}
                userEmail={userEmail}
                userName={userName}
                fetchChanges={fetchChanges}
              />
            )}

            {/* TAB: APPROVALS */}
            {activeTab === 'approvals' && (
              <L2Validation
                changes={changes}
                userRole={userRole}
                userEmail={userEmail}
                userDept={userDept}
                setToastMsg={setToastMsg}
                fetchChanges={fetchChanges}
                fetchNotifications={fetchNotifications}
                autoOpenChangeNo={autoOpenChangeNo}
                clearAutoOpen={() => setAutoOpenChangeNo(null)}
                systemUsers={usersList}
                userName={userName}
              />
            )}

            {/* TAB: L1 REQUEST */}
            {activeTab === 'l1' && (
              <L1Request
                userEmail={userEmail}
                userRole={userRole}
                onTabChange={handleTabChange}
                changes={changes}
                setChanges={setChanges}
                logAction={logAction}
                setToastMsg={setToastMsg}
                onLocalSignOut={handleLocalSignOut}
                fetchChanges={fetchChanges}
                systemUsers={usersList}
              />
            )}

            {/* TAB: L3 REQUEST TRACKER (Admin / L3 sub-menu) */}
            {activeTab === 'l3' && (
              <L3RequestTracker
                userEmail={userEmail}
                userRole={userRole}
                userDept={userDept}
                logAction={logAction}
                setToastMsg={setToastMsg}
                fetchChanges={fetchChanges}
                autoOpenChangeNo={autoOpenChangeNo}
                clearAutoOpen={() => setAutoOpenChangeNo(null)}
              />
            )}

            {/* TAB: ALL APPROVALS (HOD dedicated view) */}
            {activeTab === 'all-approvals' && (
              <AllApprovals
                userEmail={userEmail}
                userRole={userRole}
                userDept={userDept}
                logAction={logAction}
                setToastMsg={setToastMsg}
                fetchChanges={fetchChanges}
                autoOpenChangeNo={autoOpenChangeNo}
                clearAutoOpen={() => setAutoOpenChangeNo(null)}
              />
            )}

            {/* TAB: EFFECTIVENESS MONITORING */}
            {activeTab === 'effectiveness' && (
              <Effectiveness
                changes={changes}
                effectivenessLogs={effectivenessLogs}
                setEffectivenessLogs={setEffectivenessLogs}
                logAction={logAction}
                setToastMsg={setToastMsg}
                userRole={userRole}
                userDept={userDept}
                fetchChanges={fetchChanges}
                autoOpenChangeNo={autoOpenChangeNo}
                clearAutoOpen={() => setAutoOpenChangeNo(null)}
              />
            )}

            {/* TAB: NOTIFICATIONS */}
            {activeTab === 'notifications' && (
              <Notifications
                setToastMsg={setToastMsg}
                notifications={notifications}
                setNotifications={setNotifications}
                fetchNotifications={fetchNotifications}
                userRole={userRole}
                userDept={userDept}
                onTabChange={handleTabChange}
              />
            )}

            {/* TAB: USERS LIST (Admin Only) */}
            {activeTab === 'users' && userRole && userRole.toLowerCase().includes('admin') && (
              <Users
                userRole={userRole}
                userEmail={userEmail}
                logAction={logAction}
                setToastMsg={setToastMsg}
                onLocalSignOut={handleLocalSignOut}
              />
            )}


          </Suspense>
        </main>
      </div>

      {/* Global Toast Notification */}
      {toastMsg && (() => {
        const text = typeof toastMsg === 'object' ? toastMsg.text : toastMsg;
        const isError = typeof toastMsg === 'object'
          ? !!toastMsg.isError
          : /fail|error|denied|invalid|required|must|limit|locked|please|cannot|no\s+data|no\s+record|skipped|skip|not\s+allowed|only|wrong|warning|incorrect|unable|at\s+least/i.test(text);
        
        // Replace "Error" or "error" with more meaningful words like "Failed"
        const cleanedMsg = typeof text === 'string'
          ? text.replace(/\bError\b/g, 'Failed').replace(/\berror\b/g, 'failed')
          : text;

        return (
          <div className={`fixed bottom-6 right-6 text-white rounded-xl px-4 py-3 flex items-center gap-2 shadow-xl z-50 animate-slide-in-right text-xs sm:text-sm font-medium ${isError ? 'bg-rose-700' : 'bg-emerald-600'}`}>
            {isError
              ? <span className="text-xs sm:text-sm select-none">❌</span>
              : <CheckCircle size={16} className="text-white" />
            }
            <span>{cleanedMsg}</span>
          </div>
        );
      })()}

      {/* Profile Details Modal */}
      {showProfileModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" 
            onClick={() => setShowProfileModal(false)} 
          />
          
          {/* Modal Container */}
          <div className="relative bg-white w-full max-w-[420px] rounded-2xl shadow-2xl border border-slate-200/80 overflow-hidden z-10 transform scale-100 transition-all duration-300">
            {/* Header / Accent top */}
            <div className="h-2 bg-gradient-to-r from-blue-600 to-indigo-700" />
            
            {/* Close Button */}
            <button 
              onClick={() => setShowProfileModal(false)}
              className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors"
              title="Close"
            >
              <X size={18} />
            </button>

            {/* Modal Body */}
            <div className="p-6 flex flex-col items-center text-center">
              {/* Large Avatar */}
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-600 to-indigo-700 text-white flex items-center justify-center font-bold text-2xl shadow-[0_4px_14px_rgba(37,99,235,0.3)] mb-4">
                {(userName || userEmail || 'A')[0].toUpperCase()}
              </div>

              {/* User Name */}
              <h3 className="text-lg font-bold text-slate-800 tracking-tight">
                {userName || (userEmail ? userEmail.split('@')[0] : 'Admin User')}
              </h3>
              
              {/* Role badge */}
              <span className={`inline-block mt-2 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider border ${
                (userRole || '').toLowerCase().includes('admin')
                  ? 'bg-rose-50 border-rose-250 text-rose-700'
                  : (userRole || '').toLowerCase().includes('hod') || (userRole || '').toLowerCase().includes('manager')
                  ? 'bg-purple-50 border-purple-250 text-purple-700'
                  : 'bg-slate-50 border-slate-200 text-slate-700'
              }`}>
                {userRole || 'Administrator'}
              </span>

              {/* Divider */}
              <div className="w-full border-t border-slate-100 my-5" />

              {/* Profile Details List */}
              <div className="w-full text-left space-y-4">
                {/* Email detail */}
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Email Address</span>
                  <span className="text-sm font-semibold text-slate-700 break-all">{userEmail || 'N/A'}</span>
                </div>

                {/* Department detail */}
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Department</span>
                  <span className="text-sm font-semibold text-slate-700">{userDept || 'Not Assigned'}</span>
                </div>
              </div>

              {/* Close Action button */}
              <button
                onClick={() => setShowProfileModal(false)}
                className="mt-6 w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2 px-4 rounded-lg text-xs transition-colors"
              >
                Close Profile
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
