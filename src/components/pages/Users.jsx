import { useState, useEffect } from 'react';
import TablePagination from '@mui/material/TablePagination';
import {
  getUsers,
  deleteUser,
  signup,
  getRoles,
  getDepartments,
  updateUser
} from '../../api/apiRoutes';
import {
  AlertTriangle,
  Edit,
  Eye,
  EyeOff,
  Loader2,
  Plus,
  Search,
  Trash2,
  Users as UsersIcon,
  X,
  Download
} from 'lucide-react';
import { useWebSocket } from '../../hooks/useWebSocket';
import { exportUsersListPDF } from '../../utils/pdfExport';

export const Users = ({
  userEmail,
  logAction,
  setToastMsg,
  onLocalSignOut
}) => {
  const [users, setUsers] = useState([]);
  const [isFetchingUsers, setIsFetchingUsers] = useState(false);
  const [customRoles, setCustomRoles] = useState([]);
  const [customDepts, setCustomDepts] = useState([]);

  // Form states
  const [createUserFullName, setCreateUserFullName] = useState('');
  const [createUserEmail, setCreateUserEmail] = useState('');
  const [createUserPassword, setCreateUserPassword] = useState('');
  const [createUserRole, setCreateUserRole] = useState('');
  const [createUserDept, setCreateUserDept] = useState('');
  const [showFormPassword, setShowFormPassword] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState('');

  // Validation errors for Create User form
  const [createErrors, setCreateErrors] = useState({});

  // Validation errors for Edit User modal
  const [editErrors, setEditErrors] = useState({});
  const [userRoleFilter, setUserRoleFilter] = useState('All');
  
  // Pagination State
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // Reset page when search or filters change
  useEffect(() => {
    setPage(0);
  }, [userSearchQuery, userRoleFilter]);
  
  const [visiblePasswords, setVisiblePasswords] = useState({});
  const [isCreatingUser, setIsCreatingUser] = useState(false);

  // Modals
  const [userToDelete, setUserToDelete] = useState(null);

  // Edit User
  const [userToEdit, setUserToEdit] = useState(null);
  const [editUserFullName, setEditUserFullName] = useState('');
  const [editUserEmail, setEditUserEmail] = useState('');
  const [editUserPassword, setEditUserPassword] = useState('');
  const [editUserRole, setEditUserRole] = useState('');
  const [editUserDept, setEditUserDept] = useState('');
  const [editUserStatus, setEditUserStatus] = useState('Active');
  const [showEditFormPassword, setShowEditFormPassword] = useState(false);

  const fetchRoles = async () => {
    try {
      const response = await getRoles();
      setCustomRoles(response.data);
    } catch (error) {
      console.error('Error loading roles:', error);
    }
  };

  const fetchDepartments = async () => {
    try {
      const response = await getDepartments();
      setCustomDepts(response.data);
    } catch (error) {
      console.error('Error loading departments:', error);
    }
  };

  const fetchUsers = async () => {
    setIsFetchingUsers(true);
    try {
      const response = await getUsers();
      setUsers(response.data);
    } catch (error) {
      console.error(error);
      if (error.response?.status === 401 || error.response?.status === 403) {
        onLocalSignOut();
      } else {
        setToastMsg({ text: 'Error loading users from backend.', isError: true });
      }
    } finally {
      setIsFetchingUsers(false);
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchRoles();
    fetchDepartments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // WebSocket real-time updates for Users/Roles/Depts
  useWebSocket((data) => {
    console.log('📩 Received WebSocket message in Users:', data);
    if (data.type === 'REFRESH_USERS') {
      fetchUsers();
      fetchRoles();
      fetchDepartments();
    }
  });

  const validateCreateForm = () => {
    const errs = {};
    if (!createUserFullName.trim()) errs.fullName = 'Full name is required.';
    if (!createUserEmail.trim()) {
      errs.email = 'Email address is required.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(createUserEmail.trim())) {
      errs.email = 'Enter a valid email address.';
    }
    if (!createUserPassword.trim()) {
      errs.password = 'Password is required.';
    } else if (createUserPassword.trim().length < 6) {
      errs.password = 'Password must be at least 6 characters.';
    }
    if (!createUserRole) errs.role = 'Please select a role.';
    if (!createUserDept) errs.dept = 'Please select a department.';
    return errs;
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    const errs = validateCreateForm();
    if (Object.keys(errs).length > 0) {
      setCreateErrors(errs);
      return;
    }
    setCreateErrors({});
    
    setIsCreatingUser(true);
    try {
      await signup({
        email: createUserEmail.trim(),
        password: createUserPassword.trim(),
        role: createUserRole,
        name: createUserFullName.trim(),
        department: createUserDept
      });
      
      setToastMsg('User account created successfully!');
      logAction('User Registered', `Created account for ${createUserFullName.trim()} (${createUserEmail.trim()}) as ${createUserRole}.`);
      
      // Clear form and errors
      setCreateUserFullName('');
      setCreateUserEmail('');
      setCreateUserPassword('');
      setCreateUserRole('');
      setCreateUserDept('');
      setCreateErrors({});
      
      // Refresh list
      fetchUsers();
    } catch (err) {
      console.error(err);
      setToastMsg({ text: err.response?.data?.error || 'Error creating user account.', isError: true });
    } finally {
      setIsCreatingUser(false);
    }
  };

  const handleDeleteUser = (id, email, name) => {
    setUserToDelete({ id, email, name });
  };

  const executeDeleteUser = async () => {
    if (!userToDelete) return;
    const { id, email, name } = userToDelete;
    try {
      await deleteUser(id);
      setToastMsg('User deleted successfully.');
      logAction('User Deleted', `Removed account for ${name || email} (${email}).`);
      setUserToDelete(null);
      fetchUsers();
    } catch (err) {
      console.error(err);
      setToastMsg({ text: 'Error deleting user.', isError: true });
    }
  };

  const handleStartEditUser = (u) => {
    setUserToEdit(u);
    setEditUserFullName(u.name || '');
    setEditUserEmail(u.email || '');
    setEditUserPassword('');
    setEditUserRole(u.role || '');
    setEditUserDept(u.department || '');
    setEditUserStatus(u.status || 'Active');
    setShowEditFormPassword(false);
  };

  const validateEditForm = () => {
    const errs = {};
    if (!editUserFullName.trim()) errs.fullName = 'Full name is required.';
    if (editUserPassword.trim() && editUserPassword.trim().length < 6) {
      errs.password = 'Password must be at least 6 characters.';
    }
    if (!editUserRole) errs.role = 'Please select a role.';
    if (!editUserDept) errs.dept = 'Please select a department.';
    return errs;
  };

  const executeEditUser = async (e) => {
    e.preventDefault();
    if (!userToEdit) return;
    const errs = validateEditForm();
    if (Object.keys(errs).length > 0) {
      setEditErrors(errs);
      return;
    }
    setEditErrors({});
    try {
      const payload = {
        name: editUserFullName.trim(),
        email: editUserEmail.trim(),
        role: editUserRole,
        department: editUserDept,
        status: editUserStatus
      };
      if (editUserPassword.trim()) {
        payload.password = editUserPassword.trim();
      }
      await updateUser(userToEdit.id, payload);
      setToastMsg('User updated successfully.');
      logAction('User Updated', `Modified account for ${editUserFullName.trim()} (${editUserEmail.trim()}).`);
      setUserToEdit(null);
      setEditErrors({});
      fetchUsers();
    } catch (err) {
      console.error(err);
      setToastMsg({ text: err.response?.data?.error || 'Error updating user.', isError: true });
    }
  };

  const togglePasswordVisibility = (userId) => {
    setVisiblePasswords(prev => ({
      ...prev,
      [userId]: !prev[userId]
    }));
  };



  // Initials for Avatar — same colour for all roles
  const getAvatarStyles = () => 'bg-[#0066cc] text-white';

  // Role Badge styling
  const getRoleBadgeStyles = (role) => {
    const r = role.toLowerCase();
    if (r.includes('admin')) return 'bg-rose-50 border border-rose-150 text-rose-700';
    if (r.includes('hod')) return 'bg-purple-50 border border-purple-150 text-purple-700';
    if (r.includes('operator')) return 'bg-emerald-50 border border-emerald-150 text-emerald-700';
    if (r.includes('qa')) return 'bg-lime-50 border border-lime-200 text-lime-800';
    if (r.includes('manager')) return 'bg-amber-50 border border-amber-150 text-amber-700';
    return 'bg-slate-50 border border-slate-200 text-slate-700';
  };

  const filteredUsers = users.filter(u => {
    const query = userSearchQuery.toLowerCase();
    const nameMatch = (u.name || '').toLowerCase().includes(query);
    const emailMatch = (u.email || '').toLowerCase().includes(query);
    const matchesSearch = nameMatch || emailMatch;
    const matchesRole = userRoleFilter === 'All' || u.role === userRoleFilter;
    return matchesSearch && matchesRole;
  });

  const paginatedUsers = filteredUsers.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  const handleExportPDF = () => {
    exportUsersListPDF(filteredUsers, {
      searchQuery: userSearchQuery,
      roleFilter: userRoleFilter
    }, setToastMsg);
  };


  return (
    <div className="space-y-6 animate-fade-in-up">
      <div>
        <h3 className="font-heading text-2xl font-bold text-slate-900">User Management</h3>
        <p className="text-slate-500 text-sm">System accounts, authentication privileges, and security roles.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* 1. Left Sidebar: Create User Account */}
        <div className="lg:col-span-4 bg-white border border-slate-200/60 rounded-xl p-5 shadow-sm hover:shadow-md transition-all duration-300 space-y-4 relative">
          <div className="absolute inset-x-0 top-0 h-1 bg-[#0066cc] rounded-t-xl" />
          
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <UsersIcon size={18} className="text-[#0066cc]" />
            <h4 className="font-heading text-sm font-bold text-slate-900">Create User Account</h4>
          </div>

          <form onSubmit={handleCreateUser} className="space-y-4" noValidate>
            {/* Full Name */}
            <div className="space-y-1">
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Full Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. John Doe"
                className={`w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-4 transition-all duration-200 ${
                  createErrors.fullName
                    ? 'border-red-400 focus:border-red-400 focus:ring-red-400/10 bg-red-50/30'
                    : 'border-slate-200 focus:border-[#0066cc] focus:ring-[#0066cc]/10'
                }`}
                value={createUserFullName}
                onChange={(e) => { setCreateUserFullName(e.target.value); if (createErrors.fullName) setCreateErrors(p => ({...p, fullName: ''})); }}
                disabled={isCreatingUser}
              />
              {createErrors.fullName && <p className="text-[10px] text-red-500 font-medium mt-0.5">{createErrors.fullName}</p>}
            </div>

            {/* Email Address */}
            <div className="space-y-1">
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Email Address <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                placeholder="e.g. john.doe@plant.com"
                className={`w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-4 transition-all duration-200 ${
                  createErrors.email
                    ? 'border-red-400 focus:border-red-400 focus:ring-red-400/10 bg-red-50/30'
                    : 'border-slate-200 focus:border-[#0066cc] focus:ring-[#0066cc]/10'
                }`}
                value={createUserEmail}
                onChange={(e) => { setCreateUserEmail(e.target.value); if (createErrors.email) setCreateErrors(p => ({...p, email: ''})); }}
                disabled={isCreatingUser}
              />
              {createErrors.email && <p className="text-[10px] text-red-500 font-medium mt-0.5">{createErrors.email}</p>}
            </div>

            {/* Password */}
            <div className="space-y-1">
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Password <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type={showFormPassword ? 'text' : 'password'}
                  placeholder="Min 6 characters"
                  className={`w-full pl-3 pr-10 py-2 border rounded-lg text-sm outline-none focus:ring-4 transition-all duration-200 ${
                    createErrors.password
                      ? 'border-red-400 focus:border-red-400 focus:ring-red-400/10 bg-red-50/30'
                      : 'border-slate-200 focus:border-[#0066cc] focus:ring-[#0066cc]/10'
                  }`}
                  value={createUserPassword}
                  onChange={(e) => { setCreateUserPassword(e.target.value); if (createErrors.password) setCreateErrors(p => ({...p, password: ''})); }}
                  disabled={isCreatingUser}
                />
                <button
                  type="button"
                  onClick={() => setShowFormPassword(!showFormPassword)}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-650 cursor-pointer"
                >
                  {showFormPassword ? <Eye size={14} /> : <EyeOff size={14} />}
                </button>
              </div>
              {createErrors.password && <p className="text-[10px] text-red-500 font-medium mt-0.5">{createErrors.password}</p>}
            </div>

            {/* Role Selection */}
            <div className="space-y-1">
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Role <span className="text-red-500">*</span>
              </label>
              <select
                className={`w-full px-3 py-2 border rounded-lg text-sm bg-white outline-none focus:ring-4 transition-all duration-200 ${
                  createErrors.role
                    ? 'border-red-400 focus:border-red-400 focus:ring-red-400/10 bg-red-50/30'
                    : 'border-slate-200 focus:border-[#0066cc] focus:ring-[#0066cc]/10'
                }`}
                value={createUserRole}
                onChange={(e) => {
                  const newRole = e.target.value;
                  setCreateUserRole(newRole);
                  if (newRole.toLowerCase().includes('admin')) {
                    setCreateUserDept('General');
                    if (createErrors.dept) setCreateErrors(p => ({...p, dept: ''}));
                  } else if ((newRole.toLowerCase() === 'user' || newRole.toLowerCase() === 'hod') && createUserDept === 'General') {
                    setCreateUserDept('');
                  }
                  if (createErrors.role) setCreateErrors(p => ({...p, role: ''}));
                }}
                disabled={isCreatingUser}
              >
                <option value="">Select Role</option>
                {customRoles.map(role => (
                  <option key={role} value={role}>{role}</option>
                ))}
              </select>
              {createErrors.role && <p className="text-[10px] text-red-500 font-medium mt-0.5">{createErrors.role}</p>}
            </div>

            {/* Department Selection */}
            <div className="space-y-1">
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Department <span className="text-red-500">*</span>
              </label>
              <select
                className={`w-full px-3 py-2 border rounded-lg text-sm bg-white outline-none focus:ring-4 transition-all duration-200 ${
                  createErrors.dept
                    ? 'border-red-400 focus:border-red-400 focus:ring-red-400/10 bg-red-50/30'
                    : 'border-slate-200 focus:border-[#0066cc] focus:ring-[#0066cc]/10'
                }`}
                value={createUserDept}
                onChange={(e) => { setCreateUserDept(e.target.value); if (createErrors.dept) setCreateErrors(p => ({...p, dept: ''})); }}
                disabled={isCreatingUser || (createUserRole && createUserRole.toLowerCase().includes('admin'))}
              >
                <option value="">Select Department</option>
                {customDepts
                  .filter(dept => !(createUserRole && (createUserRole.toLowerCase() === 'user' || createUserRole.toLowerCase() === 'hod') && dept === 'General'))
                  .map(dept => (
                    <option key={dept} value={dept}>{dept}</option>
                  ))}
              </select>
              {createErrors.dept && <p className="text-[10px] text-red-500 font-medium mt-0.5">{createErrors.dept}</p>}
            </div>

            {/* Submit Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={isCreatingUser}
                className="w-full flex items-center justify-center gap-1.5 bg-[#0066cc] hover:bg-[#0052a3] disabled:opacity-60 text-white py-2 px-4 rounded-lg text-sm font-bold transition-all shadow-sm cursor-pointer"
              >
                {isCreatingUser ? (
                  <Loader2 className="animate-spin" size={14} />
                ) : (
                  <Plus size={14} />
                )}
                <span>Create Account</span>
              </button>
            </div>
          </form>
        </div>

        {/* 2. Right Panel: Users Directory Table */}
        <div className="lg:col-span-8 space-y-4">
          {/* Search and Filters */}
          <div className="bg-white border border-slate-200/60 rounded-xl p-4 shadow-sm hover:shadow-md transition-all duration-300 flex flex-wrap gap-3 items-center">
            <div className="flex-1 min-w-[200px] relative">
              <Search className="absolute left-3 top-2.5 text-slate-400" size={14} />
              <input
                type="text"
                placeholder="Search by name or email..."
                className="w-full pl-8 pr-4 py-1.5 border border-slate-200 rounded-lg text-xs outline-none focus:border-[#0066cc]"
                value={userSearchQuery}
                onChange={(e) => setUserSearchQuery(e.target.value)}
              />
            </div>

            <div>
              <select
                className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-white outline-none"
                value={userRoleFilter}
                onChange={(e) => setUserRoleFilter(e.target.value)}
              >
                <option value="All">All Roles</option>
                {customRoles.map(role => (
                  <option key={role} value={role}>{role}</option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={handleExportPDF}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0066cc] hover:bg-[#0052a3] text-white rounded-lg text-xs font-bold transition-all shadow-sm cursor-pointer"
              title="Export filtered users to PDF"
            >
              <Download size={12} />
              <span>Export PDF</span>
            </button>



          </div>

          {/* Users List Table */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              {isFetchingUsers ? (
                <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-2">
                  <Loader2 className="animate-spin text-[#0066cc]" size={32} />
                  <span>Loading users...</span>
                </div>
              ) : (
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-150">
                      <th className="p-3 font-bold text-slate-500 uppercase tracking-wider w-[50px]">Sl No</th>
                      <th className="p-3 font-bold text-slate-500 uppercase tracking-wider">User ID</th>
                      <th className="p-3 font-bold text-slate-500 uppercase tracking-wider">Name</th>
                      <th className="p-3 font-bold text-slate-500 uppercase tracking-wider">Email</th>
                      <th className="p-3 font-bold text-slate-500 uppercase tracking-wider">Password</th>
                      <th className="p-3 font-bold text-slate-500 uppercase tracking-wider">Role</th>
                      <th className="p-3 font-bold text-slate-500 uppercase tracking-wider">Department</th>
                      <th className="p-3 font-bold text-slate-500 uppercase tracking-wider">Status</th>
                      <th className="p-3 w-10 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredUsers.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="text-center py-10 text-slate-400">
                          No accounts found in directory.
                        </td>
                      </tr>
                    ) : (
                      paginatedUsers.map((u, idx) => {
                        const nameToUse = u.name && u.name.trim() ? u.name.trim() : u.email.split('@')[0];
                        const parts = nameToUse.split(/\s+/);
                        const initials = parts.length >= 2 
                          ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
                          : parts[0].substring(0, 2).toUpperCase();

                        const isPasswordVisible = !!visiblePasswords[u.id];

                        return (
                          <tr key={u.id} className="hover:bg-slate-50/70 transition-colors">
                            {/* Sl No */}
                            <td className="p-3 font-bold text-slate-400">{page * rowsPerPage + idx + 1}</td>
                            {/* User ID */}
                            <td className="p-3 font-mono font-bold text-slate-400">
                              USR-{String(u.id).padStart(3, '0')}
                            </td>
                            {/* Avatar + Name */}
                            <td className="p-3 font-medium text-slate-800">
                              <div className="flex items-center gap-2">
                                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold ${getAvatarStyles(u.role)}`}>
                                  {initials}
                                </div>
                                <span>{u.name || 'Unnamed User'}</span>
                              </div>
                            </td>
                            {/* Email */}
                            <td className="p-3 text-slate-500">{u.email}</td>
                            {/* Password mask/unmask */}
                            <td className="p-3 font-mono text-slate-500">
                              <div className="flex items-center gap-1.5">
                                <span>{isPasswordVisible ? u.password : '••••••••'}</span>
                                <button
                                  onClick={() => togglePasswordVisibility(u.id)}
                                  className="text-slate-400 hover:text-slate-650 cursor-pointer"
                                  title={isPasswordVisible ? "Hide Password" : "Show Password"}
                                >
                                  {isPasswordVisible ? <Eye size={11} /> : <EyeOff size={11} />}
                                </button>
                              </div>
                            </td>
                            {/* Role Badge */}
                            <td className="p-3">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${getRoleBadgeStyles(u.role)}`}>
                                {u.role}
                              </span>
                            </td>
                            {/* Department */}
                            <td className="p-3 text-slate-650 font-semibold">{u.department || '-'}</td>
                            {/* Status */}
                            <td className="p-3">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                (u.status || 'Active') === 'Active'
                                  ? 'bg-emerald-50 border border-emerald-150 text-emerald-700'
                                  : 'bg-rose-50 border border-rose-150 text-rose-700'
                              }`}>
                                {u.status || 'Active'}
                              </span>
                            </td>
                            {/* Actions */}
                            <td className="p-3 text-center">
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  onClick={() => handleStartEditUser(u)}
                                  className="p-1 text-slate-400 hover:text-sky-650 rounded hover:bg-sky-50 transition-colors cursor-pointer"
                                  title="Edit Account"
                                >
                                  <Edit size={13} />
                                </button>
                                {u.email !== userEmail && (
                                  <button
                                    onClick={() => handleDeleteUser(u.id, u.email, u.name)}
                                    className="p-1 text-slate-400 hover:text-rose-600 rounded hover:bg-rose-50 transition-colors cursor-pointer"
                                    title="Delete Account"
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              )}
            </div>
            <TablePagination
              rowsPerPageOptions={[5, 10]}
              component="div"
              count={filteredUsers.length}
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



      {/* Edit User Account Modal */}
      {userToEdit && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 p-6 max-w-md w-full mx-auto animate-scale-in relative">
            <div className="absolute inset-x-0 top-0 h-1 bg-[#0066cc] rounded-t-xl" />
            <button
              onClick={() => setUserToEdit(null)}
              className="absolute right-4 top-4 text-slate-400 hover:text-slate-655 cursor-pointer"
            >
              <X size={18} />
            </button>
            <h4 className="font-heading text-lg font-bold text-slate-900 mb-2">Edit User Account</h4>
            <p className="text-slate-500 text-xs mb-4">Modify account details, change role/department, or reset password.</p>
            <form onSubmit={executeEditUser} className="space-y-4" noValidate>
              {/* Full Name */}
              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. John Doe"
                  className={`w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-4 transition-all duration-200 ${
                    editErrors.fullName
                      ? 'border-red-400 focus:border-red-400 focus:ring-red-400/10 bg-red-50/30'
                      : 'border-slate-200 focus:border-[#0066cc] focus:ring-[#0066cc]/10'
                  }`}
                  value={editUserFullName}
                  onChange={(e) => { setEditUserFullName(e.target.value); if (editErrors.fullName) setEditErrors(p => ({...p, fullName: ''})); }}
                />
                {editErrors.fullName && <p className="text-[10px] text-red-500 font-medium mt-0.5">{editErrors.fullName}</p>}
              </div>

              {/* Email Address */}
              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Email Address <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  disabled
                  className="w-full bg-slate-100 border border-slate-200 rounded-lg py-2 px-3 text-sm text-slate-500 cursor-not-allowed"
                  value={editUserEmail}
                />
              </div>

              {/* Password */}
              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">Password <span className="text-xs text-slate-400 font-normal normal-case">(optional)</span></label>
                <div className="relative">
                  <input
                    type={showEditFormPassword ? 'text' : 'password'}
                    placeholder="Leave blank to keep current password"
                    className={`w-full pl-3 pr-10 py-2 border rounded-lg text-sm outline-none focus:ring-4 transition-all duration-200 ${
                      editErrors.password
                        ? 'border-red-400 focus:border-red-400 focus:ring-red-400/10 bg-red-50/30'
                        : 'border-slate-200 focus:border-[#0066cc] focus:ring-[#0066cc]/10'
                    }`}
                    value={editUserPassword}
                    onChange={(e) => { setEditUserPassword(e.target.value); if (editErrors.password) setEditErrors(p => ({...p, password: ''})); }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowEditFormPassword(!showEditFormPassword)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-655 cursor-pointer"
                  >
                    {showEditFormPassword ? <Eye size={14} /> : <EyeOff size={14} />}
                  </button>
                </div>
                {editErrors.password && <p className="text-[10px] text-red-500 font-medium mt-0.5">{editErrors.password}</p>}
              </div>

              {/* Role Selection */}
              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Role <span className="text-red-500">*</span>
                </label>
                <select
                  className={`w-full px-3 py-2 border rounded-lg text-sm bg-white outline-none focus:ring-4 transition-all duration-200 ${
                    editErrors.role
                      ? 'border-red-400 focus:border-red-400 focus:ring-red-400/10 bg-red-50/30'
                      : 'border-slate-200 focus:border-[#0066cc] focus:ring-[#0066cc]/10'
                  }`}
                  value={editUserRole}
                  onChange={(e) => {
                    const newRole = e.target.value;
                    setEditUserRole(newRole);
                    if (newRole.toLowerCase().includes('admin')) {
                      setEditUserDept('General');
                      if (editErrors.dept) setEditErrors(p => ({...p, dept: ''}));
                    } else if ((newRole.toLowerCase() === 'user' || newRole.toLowerCase() === 'hod') && editUserDept === 'General') {
                      setEditUserDept('');
                    }
                    if (editErrors.role) setEditErrors(p => ({...p, role: ''}));
                  }}
                >
                  <option value="">Select Role</option>
                  {customRoles.map(role => (
                    <option key={role} value={role}>{role}</option>
                  ))}
                </select>
                {editErrors.role && <p className="text-[10px] text-red-500 font-medium mt-0.5">{editErrors.role}</p>}
              </div>

              {/* Department Selection */}
              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Department <span className="text-red-500">*</span>
                </label>
                <select
                  className={`w-full px-3 py-2 border rounded-lg text-sm bg-white outline-none focus:ring-4 transition-all duration-200 ${
                    editErrors.dept
                      ? 'border-red-400 focus:border-red-400 focus:ring-red-400/10 bg-red-50/30'
                      : 'border-slate-200 focus:border-[#0066cc] focus:ring-[#0066cc]/10'
                  }`}
                  value={editUserDept}
                  onChange={(e) => { setEditUserDept(e.target.value); if (editErrors.dept) setEditErrors(p => ({...p, dept: ''})); }}
                  disabled={editUserRole && editUserRole.toLowerCase().includes('admin')}
                >
                  <option value="">Select Department</option>
                  {customDepts
                    .filter(dept => !(editUserRole && (editUserRole.toLowerCase() === 'user' || editUserRole.toLowerCase() === 'hod') && dept === 'General'))
                    .map(dept => (
                      <option key={dept} value={dept}>{dept}</option>
                    ))}
                </select>
                {editErrors.dept && <p className="text-[10px] text-red-500 font-medium mt-0.5">{editErrors.dept}</p>}
              </div>

              {/* Status */}
              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Status <span className="text-red-500">*</span>
                </label>
                <select
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white outline-none focus:border-[#0066cc] focus:ring-4 focus:ring-[#0066cc]/10 transition-all duration-200"
                  value={editUserStatus}
                  onChange={(e) => setEditUserStatus(e.target.value)}
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>

              <div className="flex justify-end gap-2.5 pt-2 border-t border-slate-100 mt-4">
                <button
                  type="button"
                  onClick={() => setUserToEdit(null)}
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-655 rounded-lg text-xs font-bold transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#0066cc] hover:bg-[#0052a3] text-white rounded-lg text-xs font-bold transition-all shadow-sm cursor-pointer"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete User Confirmation Modal */}
      {userToDelete && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 p-6 max-w-sm w-full mx-auto animate-scale-in relative">
            <button
              onClick={() => setUserToDelete(null)}
              className="absolute right-4 top-4 text-slate-400 hover:text-slate-655 cursor-pointer"
            >
              <X size={18} />
            </button>
            <div className="flex items-center gap-3 text-rose-600 mb-2">
              <AlertTriangle size={24} />
              <h4 className="font-heading text-lg font-bold text-slate-900">Delete Account</h4>
            </div>
            <p className="text-slate-500 text-xs mb-4">
              Are you sure you want to delete the user account for <strong>{userToDelete.name || userToDelete.email}</strong> ({userToDelete.email})? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setUserToDelete(null)}
                className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-655 rounded-lg text-xs font-bold transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={executeDeleteUser}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition-all shadow-sm cursor-pointer"
              >
                Delete User
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
