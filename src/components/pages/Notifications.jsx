import { useState, useEffect } from 'react';
import {
  Search,
  CheckCheck,
  Mail,
  Check,
  FileText,
  Layers,
  Activity,
  Clock,
  Filter,
  RotateCcw
} from 'lucide-react';
import {
  toggleNotificationRead,
  markAllNotificationsRead,
  getDepartments
} from '../../api/apiRoutes';


export const Notifications = ({ setToastMsg, notifications, setNotifications, fetchNotifications, userRole, userDept, onTabChange }) => {
  const alerts = notifications || [];
  const [search, setSearch] = useState('');
  const [activeFilterTab, setActiveFilterTab] = useState('All'); // 'All' | 'Unread'
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [filterLevel, setFilterLevel] = useState('All');
  const [filterCategory, setFilterCategory] = useState('All');
  const [filterType, setFilterType] = useState('All');
  const [filterDept, setFilterDept] = useState('All');
  const [dbDepartments, setDbDepartments] = useState([]);

  useEffect(() => {
    fetchNotifications();
    const fetchDepts = async () => {
      try {
        const res = await getDepartments();
        if (Array.isArray(res.data)) {
          setDbDepartments(res.data);
        }
      } catch (err) {
        console.error('Error fetching departments:', err);
      }
    };
    fetchDepts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsRead();
      await fetchNotifications();
      setToastMsg('All notifications marked as read.');
    } catch (error) {
      console.error(error);
      setToastMsg({ text: 'Error marking notifications as read.', isError: true });
    }
  };

  const toggleReadStatus = async (id) => {
    try {
      const response = await toggleNotificationRead(id);
      // Backend returns the updated notification item in response.data
      setNotifications(prev => prev.map(n => n.id === id ? response.data : n));
    } catch (error) {
      console.error(error);
      setToastMsg({ text: 'Error updating notification status.', isError: true });
    }
  };

  // Departments are now fetched directly from the DB
  const deptList = dbDepartments.filter(d => d.trim().toLowerCase() !== 'general');

  // Determine the level badge text
  const getLevelBadge = (alert) => {
    if ((alert.id && alert.id.startsWith('L2-NOTIF')) || (alert.id && alert.id.includes('L2-VAL'))) return 'L2 VALIDATION';
    if (alert.id && alert.id.startsWith('L3-')) return 'L3 APPROVAL';
    if (alert.id && alert.id.startsWith('L1-')) return 'L1 APPROVAL';
    if (alert.id && alert.id.startsWith('EFF-')) return 'EFFECTIVENESS';
    if (alert.id && alert.id.startsWith('ALR-')) return 'SYSTEM';
    return 'NOTIFICATION';
  };

  const activeFilterCount =
    (filterLevel !== 'All' ? 1 : 0) +
    (filterCategory !== 'All' ? 1 : 0) +
    (filterType !== 'All' ? 1 : 0) +
    (filterDept !== 'All' ? 1 : 0);

  const hasActiveFilters = activeFilterCount > 0;

  const handleResetFilters = () => {
    setFilterLevel('All');
    setFilterCategory('All');
    setFilterType('All');
    setFilterDept('All');
    setSearch('');
  };

  // Filter and Search logic
  const filteredAlerts = alerts.filter(alert => {
    const matchesSearch =
      alert.title.toLowerCase().includes(search.toLowerCase()) ||
      alert.details.toLowerCase().includes(search.toLowerCase()) ||
      (alert.changeNo && alert.changeNo.toLowerCase().includes(search.toLowerCase())) ||
      (alert.category && alert.category.toLowerCase().includes(search.toLowerCase())) ||
      (alert.dept && alert.dept.toLowerCase().includes(search.toLowerCase()));

    if (!matchesSearch) return false;

    if (activeFilterTab === 'Unread' && alert.isRead) return false;

    if (filterLevel !== 'All' && getLevelBadge(alert) !== filterLevel) return false;

    if (filterCategory !== 'All') {
      const cat = (alert.category || 'GENERAL').toUpperCase();
      if (cat !== filterCategory.toUpperCase()) return false;
    }

    if (filterType !== 'All' && alert.type !== filterType) return false;

    if (filterDept !== 'All' && (alert.dept || '').trim().toLowerCase() !== filterDept.trim().toLowerCase()) return false;

    return true;
  });

  // Calculate counts dynamically
  const countAll = alerts.length;
  const countUnread = alerts.filter(a => !a.isRead).length;

  // Color mapping for notification accent bars and badges
  const getAccentColor = (color) => {
    switch (color) {
      case 'green': return { bar: 'bg-emerald-500', badge: 'bg-emerald-600', badgeText: 'text-white', icon: 'text-emerald-600', iconBg: 'bg-emerald-50', actionBtn: 'text-emerald-600 hover:text-emerald-700' };
      case 'red': return { bar: 'bg-rose-500', badge: 'bg-rose-600', badgeText: 'text-white', icon: 'text-rose-600', iconBg: 'bg-rose-50', actionBtn: 'text-rose-600 hover:text-rose-700' };
      case 'orange': return { bar: 'bg-amber-500', badge: 'bg-amber-600', badgeText: 'text-white', icon: 'text-amber-600', iconBg: 'bg-amber-50', actionBtn: 'text-amber-600 hover:text-amber-700' };
      case 'blue':
      default: return { bar: 'bg-indigo-500', badge: 'bg-indigo-600', badgeText: 'text-white', icon: 'text-indigo-600', iconBg: 'bg-indigo-50', actionBtn: 'text-indigo-600 hover:text-indigo-700' };
    }
  };

  // Determine which icon to use based on notification type/category
  const getNotifIcon = (alert) => {
    if (alert.type === 'System Logs') return <Activity size={18} />;
    if (alert.id && alert.id.startsWith('L2-NOTIF')) return <FileText size={18} />;
    if (alert.id && alert.id.startsWith('L3-')) return <Layers size={18} />;
    if (alert.id && alert.id.startsWith('L1-')) return <FileText size={18} />;
    if (alert.id && alert.id.startsWith('EFF-')) return <CheckCheck size={18} />;
    return <Layers size={18} />;
  };

  // Level badge function has been moved up to be available to filtering logic.

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Title */}
      <div>
        <h3 className="font-heading text-2xl font-bold text-slate-900">Notifications Centre</h3>
        <p className="text-slate-500 text-sm">Review alerts, track approvals, and manage notification triggers for Plant A.</p>
      </div>

      {/* Control bar */}
      <div className="bg-white border border-slate-200/60 rounded-xl p-4 shadow-sm hover:shadow-md transition-all duration-300 space-y-4">
        <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
          {/* Search and Filters Toggle */}
          <div className="flex-1 flex items-center gap-2 max-w-lg">
            <div className="relative flex-grow">
              <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
              <input
                type="text"
                placeholder="Search by ID, title, department..."
                className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-xs outline-none focus:border-[#0066cc] focus:ring-4 focus:ring-[#0066cc]/10 transition-all duration-200"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <button
              onClick={() => setShowFilterPanel(!showFilterPanel)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold border transition-all cursor-pointer select-none ${
                showFilterPanel || hasActiveFilters
                  ? 'bg-blue-50 border-blue-200 text-blue-700 shadow-sm'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Filter size={14} />
              <span>Filters</span>
              {activeFilterCount > 0 && (
                <span className="ml-1 px-1.5 py-0.5 bg-blue-600 text-white rounded-full text-[9px] font-extrabold animate-pulse">
                  {activeFilterCount}
                </span>
              )}
            </button>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleMarkAllRead}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border border-slate-200 bg-white text-slate-600 hover:bg-blue-50 hover:border-blue-200 hover:text-blue-700 transition-all cursor-pointer"
            >
              <CheckCheck size={14} />
              <span>Mark All Read</span>
            </button>
          </div>
        </div>

        {/* Collapsible Filter Panel */}
        {showFilterPanel && (
          <div className="border-t border-slate-100 pt-4 mt-2 space-y-3 animate-fade-in-up">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Filter size={12} className="text-[#0066cc]" />
                Filter Options
              </span>
              {hasActiveFilters && (
                <button
                  onClick={handleResetFilters}
                  className="text-[10px] font-bold text-rose-600 hover:text-rose-700 flex items-center gap-1 transition-colors uppercase tracking-wider cursor-pointer"
                >
                  <RotateCcw size={10} />
                  Reset Filters
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              {/* Level Filter */}
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Approval Level</label>
                <select
                  value={filterLevel}
                  onChange={(e) => setFilterLevel(e.target.value)}
                  className="w-full p-2 border border-slate-200 rounded-lg text-xs bg-slate-50 outline-none focus:border-[#0066cc] focus:ring-2 focus:ring-[#0066cc]/10 transition-all cursor-pointer font-medium text-slate-700"
                >
                  <option value="All">All Levels</option>
                  <option value="L1 APPROVAL">L1 HOD Approval</option>
                  <option value="L2 VALIDATION">L2 Validation</option>
                  <option value="L3 APPROVAL">L3 Final Approval</option>
                  <option value="EFFECTIVENESS">Effectiveness</option>
                 
                </select>
              </div>

              {/* 4M Category Filter */}
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">4M Category</label>
                <select
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                  className="w-full p-2 border border-slate-200 rounded-lg text-xs bg-slate-50 outline-none focus:border-[#0066cc] focus:ring-2 focus:ring-[#0066cc]/10 transition-all cursor-pointer font-medium text-slate-700"
                >
                  <option value="All">All Categories</option>
                  <option value="MAN">Man</option>
                  <option value="MACHINE">Machine</option>
                  <option value="MATERIAL">Material</option>
                  <option value="METHOD">Method</option>
                  <option value="MEASUREMENT">Measurement</option>
                  <option value="MOTHER NATURE">Mother Nature</option>
                </select>
              </div>

              {/* Department Filter */}
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Department</label>
                <select
                  value={filterDept}
                  onChange={(e) => setFilterDept(e.target.value)}
                  className="w-full p-2 border border-slate-200 rounded-lg text-xs bg-slate-50 outline-none focus:border-[#0066cc] focus:ring-2 focus:ring-[#0066cc]/10 transition-all cursor-pointer font-medium text-slate-700"
                >
                  <option value="All">All Departments</option>
                  {deptList.map(dept => (
                    <option key={dept} value={dept}>{dept}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Filters tabs bar */}
        <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-3">
          {[
            { id: 'All', label: 'All Alerts', count: countAll, badgeColor: 'bg-blue-600 text-white' },
            { id: 'Unread', label: 'Unread', count: countUnread, badgeColor: 'bg-rose-600 text-white' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveFilterTab(tab.id)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer border ${activeFilterTab === tab.id
                ? 'bg-blue-50 border-blue-200 text-blue-700 shadow-sm'
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
            >
              <span>{tab.label}</span>
              <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-extrabold ${tab.badgeColor}`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Notifications list */}
      <div className="space-y-4">
        {filteredAlerts.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl p-10 text-center text-slate-400 text-xs">
            No notifications match the current filter settings.
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3 mb-2">
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-slate-200 to-transparent"></div>
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 bg-slate-50 px-4">Live Activity Streams</span>
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-slate-200 to-transparent"></div>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {filteredAlerts.map(alert => {
                const colors = getAccentColor(alert.color);
                return (
                  <div
                    key={alert.id}
                    onClick={() => {
                      if (alert.changeNo) {
                        if (!alert.isRead) {
                          toggleReadStatus(alert.id);
                        }
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
                        
                        let targetTab = (isHOD || isAdmin || isQA) ? 'all-approvals' : 'all-requests';
                        
                        const idStr = (alert.id || '').toUpperCase();
                        const titleStr = (alert.title || '').toUpperCase();
                        const detailsStr = (alert.details || '').toUpperCase();
                        
                        // Removed isL2
                        // Removed isL3
                        // Removed isL1

                        if (idStr.startsWith('L3-')) {
                          targetTab = 'l3';
                        } else if (idStr.startsWith('L1-HOD-NOTIF-L2-')) {
                          targetTab = 'approvals';
                        } else if (idStr.startsWith('L2-')) {
                          targetTab = 'approvals';
                        } else if (idStr.startsWith('EFF-')) {
                          targetTab = 'effectiveness';
                        } else if (idStr.startsWith('L1-') || idStr.startsWith('HOD-DECISION-')) {
                          targetTab = (isHOD || isAdmin || isQA) ? 'all-approvals' : 'all-requests';
                        } else {
                          // Fallback to substring matching if ID prefix is generic
                          const isL3 = idStr.includes('L3') || titleStr.includes('L3') || detailsStr.includes('L3');
                          const isL2 = idStr.includes('L2') || titleStr.includes('L2') || detailsStr.includes('L2');
                          const isL1 = idStr.includes('L1') || titleStr.includes('L1') || detailsStr.includes('L1') || idStr.includes('HOD-DECISION');
                          const isEff = idStr.includes('EFF') || titleStr.includes('EFFECTIVENESS') || detailsStr.includes('EFFECTIVENESS');

                          if (isL3) {
                            targetTab = 'l3';
                          } else if (isL2) {
                            targetTab = 'approvals';
                          } else if (isEff) {
                            targetTab = 'effectiveness';
                          } else if (isL1) {
                            targetTab = (isHOD || isAdmin || isQA) ? 'all-approvals' : 'all-requests';
                          }
                        }
                        
                        if (onTabChange) {
                          onTabChange(targetTab, alert.changeNo);
                        }
                      }
                    }}
                    className={`relative group overflow-hidden bg-white rounded-xl border shadow-sm hover:shadow-xl transition-all duration-300 transform hover:-translate-y-0.5 ${alert.changeNo ? 'cursor-pointer' : ''} ${alert.isRead ? 'border-slate-150 opacity-75' : 'border-slate-200'}`}
                  >
                    {/* Accent bar */}
                    <div className={`absolute top-0 left-0 w-1 h-full ${colors.bar}`}></div>

                    <div className="p-4 pl-5">
                      {/* Header row */}
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex items-center gap-2.5">
                          <div className={`p-1.5 ${colors.iconBg} ${colors.icon} rounded-lg`}>
                            {getNotifIcon(alert)}
                          </div>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`text-[9px] font-black ${colors.badge} ${colors.badgeText} px-1.5 py-0.5 rounded shadow-sm`}>
                                {getLevelBadge(alert)}
                              </span>
                              {alert.changeNo && (
                                <span className="text-[9px] font-black bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">
                                  #{alert.changeNo}
                                </span>
                              )}
                              {alert.dept && (
                                <span className="text-[9px] font-bold bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded border border-blue-100">
                                  {alert.dept}
                                </span>
                              )}
                              {!alert.isRead && (
                                <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" title="Unread"></span>
                              )}
                            </div>
                            <h3 className="text-sm font-bold text-slate-900 mt-0.5">{alert.title}</h3>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <div className="flex items-center gap-1 text-slate-400">
                            <Clock size={10} />
                            <span className="text-[9px] font-bold">{alert.time}</span>
                          </div>
                          {alert.category && alert.category !== 'GENERAL' && (
                            <span className="text-[8px] font-black uppercase tracking-wider bg-slate-50 text-slate-400 px-1.5 py-0.5 rounded border border-slate-100">
                              {alert.category}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Details */}
                      <div className="bg-slate-50 rounded-lg p-2.5 mb-3 border border-slate-100">
                        <p className="text-[11px] text-slate-600 leading-relaxed">{alert.details}</p>
                      </div>

                      {/* Action buttons */}
                      <div className="flex justify-between items-center bg-white pt-1">
                        <div className="flex items-center gap-2">
                          <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold border border-white shadow-sm ${alert.isRead ? 'bg-slate-200 text-slate-600' : `${colors.badge} ${colors.badgeText}`}`}>
                            {alert.type === 'Action Required' ? '!' : '✓'}
                          </div>
                          <span className="text-[9px] font-bold text-slate-500">{alert.type}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleReadStatus(alert.id);
                            }}
                            className="flex items-center gap-1 text-[9px] font-black text-slate-500 hover:text-slate-700 transition-colors uppercase tracking-wider cursor-pointer"
                          >
                            {alert.isRead ? <><Mail size={10} /> Mark Unread</> : <><Check size={10} /> Mark Read</>}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
