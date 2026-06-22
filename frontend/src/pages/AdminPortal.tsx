import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { logout } from "../store/authSlice";
import { RootState } from "../store";
import { api } from "../services/api";
import { LogOut, BookOpen, Users, HelpCircle, BarChart3, Database, FileUp, FileDown, PlusCircle, CheckCircle, Loader2, XCircle, Lock, Unlock, Eye, ShieldAlert, Trash2 } from "lucide-react";

const AdminPortal: React.FC = () => {
  const { user } = useSelector((state: RootState) => state.auth);
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<"users" | "questions" | "analytics" | "reports">("analytics");
  const [loading, setLoading] = useState(false);

  // Users tab state
  const [usersList, setUsersList] = useState<any[]>([]);
  const [usersSearch, setUsersSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  
  // User approval dashboard workflow states
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showActionModal, setShowActionModal] = useState<"approve" | "reject" | "suspend" | "reactivate" | null>(null);
  const [actionNotes, setActionNotes] = useState("");
  const [actionReason, setActionReason] = useState("");
  const [adminSummary, setAdminSummary] = useState<any>(null);

  const handleDeleteUser = async (userId: string) => {
    if (!window.confirm("Are you sure you want to permanently delete this user account? This action cannot be undone.")) return;
    
    setLoading(true);
    try {
      await api.admin.deleteUser(userId);
      alert("User deleted successfully!");
      loadTabContent();
    } catch (err: any) {
      alert(err.message || "Failed to delete user");
    } finally {
      setLoading(false);
    }
  };

  // Questions tab state
  const [questionsList, setQuestionsList] = useState<any[]>([]);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [showAddQForm, setShowAddQForm] = useState(false);
  const [newQBody, setNewQBody] = useState("");
  const [newQOptA, setNewQOptA] = useState("");
  const [newQOptB, setNewQOptB] = useState("");
  const [newQOptC, setNewQOptC] = useState("");
  const [newQOptD, setNewQOptD] = useState("");
  const [newQCorrect, setNewQCorrect] = useState("A");
  const [newQExplanation, setNewQExplanation] = useState("");
  const [newQDifficulty, setNewQDifficulty] = useState("medium");

  // Analytics tab state
  const [platformStats, setPlatformStats] = useState<any>(null);

  const handleLogout = () => {
    dispatch(logout());
    navigate("/login");
  };

  const loadTabContent = async () => {
    setLoading(true);
    try {
      if (activeTab === "users") {
        const data = await api.users.list(roleFilter || undefined, usersSearch || undefined, statusFilter || undefined);
        setUsersList(data.data || []);
        const summaryData = await api.admin.getAdminSummary();
        setAdminSummary(summaryData);
      } else if (activeTab === "questions") {
        const data = await api.admin.listQuestions();
        setQuestionsList(data || []);
      } else if (activeTab === "analytics") {
        const data = await api.analytics.getPlatform();
        setPlatformStats(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTabContent();
  }, [activeTab, roleFilter, usersSearch, statusFilter]);

  // Approval Dashboard Operations
  const handleUserActionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser || !showActionModal) return;
    
    setLoading(true);
    try {
      if (showActionModal === "approve") {
        await api.admin.approveUser(selectedUser.id, actionNotes || undefined);
      } else if (showActionModal === "reject") {
        await api.admin.rejectUser(selectedUser.id, actionReason || undefined, actionNotes || undefined);
      } else if (showActionModal === "suspend") {
        await api.admin.suspendUser(selectedUser.id, actionNotes || undefined);
      } else if (showActionModal === "reactivate") {
        await api.admin.reactivateUser(selectedUser.id, actionNotes || undefined);
      }
      
      setShowActionModal(null);
      setActionNotes("");
      setActionReason("");
      setSelectedUser(null);
      loadTabContent();
      alert("Action completed successfully!");
    } catch (err: any) {
      alert(err.message || "Action failed");
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    try {
      setLoading(true);
      await api.admin.updateUserRole(userId, newRole);
      loadTabContent();
      alert("User role updated successfully!");
    } catch (err: any) {
      alert(err.message || "Failed to update role");
    } finally {
      setLoading(false);
    }
  };

  const handleApproveQuestion = async (qId: string) => {
    try {
      await api.admin.approveQuestion(qId);
      setQuestionsList(prev =>
        prev.map(q => (q.id === qId ? { ...q, is_approved: true } : q))
      );
    } catch (err: any) {
      alert(err.message || "Failed to approve question");
    }
  };

  const handleAddQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      await api.admin.createQuestion({
        body: newQBody,
        option_a: newQOptA || null,
        option_b: newQOptB || null,
        option_c: newQOptC || null,
        option_d: newQOptD || null,
        correct_option: newQCorrect,
        explanation: newQExplanation || null,
        difficulty: newQDifficulty,
        topic_id: null
      });
      alert("Question created successfully!");
      setShowAddQForm(false);
      // Reset fields
      setNewQBody("");
      setNewQOptA("");
      setNewQOptB("");
      setNewQOptC("");
      setNewQOptD("");
      setNewQCorrect("A");
      setNewQExplanation("");
      setNewQDifficulty("medium");
      
      // Reload list
      loadTabContent();
    } catch (err: any) {
      alert(err.message || "Failed to create question");
    } finally {
      setLoading(false);
    }
  };

  const handleImportCsv = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!csvFile) return;
    try {
      setLoading(true);
      const res = await api.admin.importQuestions(csvFile);
      alert(`Successfully imported ${res.imported} questions from CSV!`);
      setCsvFile(null);
      loadTabContent();
    } catch (err: any) {
      alert(err.message || "Failed to import CSV");
    } finally {
      setLoading(false);
    }
  };

  const handleExport = (type: string) => {
    const url = api.admin.exportUrl(type);
    window.open(url, "_blank");
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 px-6 py-4 sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary bg-opacity-10 rounded-xl">
              <BookOpen className="w-6 h-6 text-primary" />
            </div>
            <span className="text-lg font-bold text-gray-900">SATPrep AI Admin</span>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="font-semibold text-gray-900">{user?.full_name || user?.email}</div>
              <div className="text-xs text-gray-500 capitalize">{user?.role}</div>
            </div>
            <button
              onClick={handleLogout}
              className="p-2 bg-gray-50 hover:bg-red-50 text-gray-500 hover:text-red-600 rounded-xl transition-colors"
              title="Logout"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Grid */}
      <main className="max-w-7xl mx-auto px-6 py-8 flex-1 w-full flex flex-col md:flex-row gap-8">
        
        {/* Navigation Sidebar */}
        <aside className="w-full md:w-64 space-y-2 shrink-0">
          <button
            onClick={() => setActiveTab("analytics")}
            className={`w-full text-left p-3.5 rounded-xl font-bold text-sm flex items-center gap-3 transition-colors ${
              activeTab === "analytics" ? "bg-primary text-white" : "bg-white border border-gray-150 text-gray-600 hover:bg-gray-50"
            }`}
          >
            <BarChart3 className="w-5 h-5" />
            Platform Analytics
          </button>
          
          <button
            onClick={() => setActiveTab("users")}
            className={`w-full text-left p-3.5 rounded-xl font-bold text-sm flex items-center gap-3 transition-colors ${
              activeTab === "users" ? "bg-primary text-white" : "bg-white border border-gray-150 text-gray-600 hover:bg-gray-50"
            }`}
          >
            <Users className="w-5 h-5" />
            User Management
          </button>

          <button
            onClick={() => setActiveTab("questions")}
            className={`w-full text-left p-3.5 rounded-xl font-bold text-sm flex items-center gap-3 transition-colors ${
              activeTab === "questions" ? "bg-primary text-white" : "bg-white border border-gray-150 text-gray-600 hover:bg-gray-50"
            }`}
          >
            <Database className="w-5 h-5" />
            Question CMS
          </button>

          <button
            onClick={() => setActiveTab("reports")}
            className={`w-full text-left p-3.5 rounded-xl font-bold text-sm flex items-center gap-3 transition-colors ${
              activeTab === "reports" ? "bg-primary text-white" : "bg-white border border-gray-150 text-gray-600 hover:bg-gray-50"
            }`}
          >
            <FileDown className="w-5 h-5" />
            Report Exporter
          </button>
        </aside>

        {/* Tab content area */}
        <div className="flex-grow space-y-6">
          {loading && (
            <div className="flex justify-center p-4">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          )}

          {/* Platform Analytics Panel */}
          {activeTab === "analytics" && platformStats && (
            <div className="space-y-6">
              <h2 className="text-2xl font-extrabold text-gray-900">Platform Analytics</h2>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="premium-card bg-white p-6">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Total Mocks Taken</span>
                  <span className="text-3xl font-extrabold text-gray-950 mt-1 block">{platformStats.total_tests_taken}</span>
                </div>
                <div className="premium-card bg-white p-6">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Platform Avg Score</span>
                  <span className="text-3xl font-extrabold text-primary mt-1 block">{platformStats.avg_platform_score}</span>
                </div>
                <div className="premium-card bg-white p-6">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Test Completion Rate</span>
                  <span className="text-3xl font-extrabold text-success mt-1 block">{Math.round(Number(platformStats.completion_rate * 100))}%</span>
                </div>
                <div className="premium-card bg-white p-6">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Active Users (30d)</span>
                  <span className="text-3xl font-extrabold text-purple-600 mt-1 block">{platformStats.active_students_30d}</span>
                </div>
              </div>
            </div>
          )}

          {/* User Management Panel */}
          {activeTab === "users" && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <h2 className="text-2xl font-extrabold text-gray-900">User Approval Dashboard</h2>
                
                <div className="flex flex-wrap gap-2">
                  <select
                    value={statusFilter}
                    onChange={e => setStatusFilter(e.target.value)}
                    className="bg-white border border-gray-200 px-3 py-2 rounded-xl text-xs font-semibold focus:outline-none focus:border-primary shadow-sm"
                  >
                    <option value="">All Statuses</option>
                    <option value="Pending">Pending Approval</option>
                    <option value="Approved">Approved</option>
                    <option value="Rejected">Rejected</option>
                    <option value="Suspended">Suspended</option>
                  </select>
                  <select
                    value={roleFilter}
                    onChange={e => setRoleFilter(e.target.value)}
                    className="bg-white border border-gray-200 px-3 py-2 rounded-xl text-xs font-semibold focus:outline-none focus:border-primary shadow-sm"
                  >
                    <option value="">All Roles</option>
                    <option value="student">Student</option>
                    <option value="counsellor">Counsellor</option>
                    <option value="author">Content Author</option>
                    <option value="admin">Administrator</option>
                  </select>
                  <input
                    type="text"
                    value={usersSearch}
                    onChange={e => setUsersSearch(e.target.value)}
                    placeholder="Search name/email..."
                    className="bg-white border border-gray-200 px-3 py-2 rounded-xl text-xs focus:outline-none focus:border-primary w-44 shadow-sm"
                  />
                </div>
              </div>

              {/* Premium Dashboard Metrics Cards */}
              {adminSummary && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                  <div className="premium-card bg-white p-5 border border-gray-150 shadow-sm rounded-2xl">
                    <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider block">Pending Counsellors</span>
                    <span className="text-2xl font-extrabold text-amber-700 mt-1 block">{adminSummary.pending_counsellors}</span>
                  </div>
                  <div className="premium-card bg-white p-5 border border-gray-150 shadow-sm rounded-2xl">
                    <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider block">Pending Authors</span>
                    <span className="text-2xl font-extrabold text-amber-700 mt-1 block">{adminSummary.pending_authors}</span>
                  </div>
                  <div className="premium-card bg-white p-5 border border-gray-150 shadow-sm rounded-2xl">
                    <span className="text-[10px] font-bold text-green-600 uppercase tracking-wider block">Approved Users</span>
                    <span className="text-2xl font-extrabold text-success mt-1 block">{adminSummary.approved_users}</span>
                  </div>
                  <div className="premium-card bg-white p-5 border border-gray-150 shadow-sm rounded-2xl">
                    <span className="text-[10px] font-bold text-rose-600 uppercase tracking-wider block">Rejected / Suspended</span>
                    <span className="text-2xl font-extrabold text-rose-700 mt-1 block">{(adminSummary.rejected_users || 0) + (adminSummary.suspended_users || 0)}</span>
                  </div>
                  <div className="premium-card bg-white p-5 border border-gray-150 shadow-sm rounded-2xl">
                    <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider block">Total Students</span>
                    <span className="text-2xl font-extrabold text-primary mt-1 block">{adminSummary.total_students}</span>
                  </div>
                </div>
              )}

              <div className="premium-card bg-white overflow-hidden border border-gray-150 shadow-sm rounded-2xl">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-gray-100 text-xs font-bold text-gray-500 uppercase tracking-wider">
                        <th className="px-6 py-4">Full Name</th>
                        <th className="px-6 py-4">Email</th>
                        <th className="px-6 py-4">Assigned Role</th>
                        <th className="px-6 py-4 text-center">Approval Status</th>
                        <th className="px-6 py-4 text-center">Quick Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-sm text-gray-700">
                      {usersList.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-6 py-8 text-center text-gray-400">
                            No registration requests found matching current filters.
                          </td>
                        </tr>
                      ) : (
                        usersList.map(u => (
                          <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                            <td className="px-6 py-4 font-semibold text-gray-900">{u.full_name || "—"}</td>
                            <td className="px-6 py-4">
                              <div className="flex flex-col">
                                <span className="font-mono text-xs text-gray-800">{u.email}</span>
                                {u.created_at && (
                                  <span className="text-[10px] text-gray-400 mt-0.5">
                                    Registered: {new Date(u.created_at).toLocaleDateString()}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <select
                                value={u.role}
                                onChange={e => handleRoleChange(u.id, e.target.value)}
                                className="bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs font-bold text-gray-700 focus:outline-none focus:border-primary transition-colors cursor-pointer"
                              >
                                <option value="student">Student</option>
                                <option value="counsellor">Counsellor</option>
                                <option value="author">Content Author</option>
                                <option value="admin">Admin</option>
                              </select>
                            </td>
                            <td className="px-6 py-4 text-center">
                              <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border uppercase tracking-wider ${
                                u.approval_status === "Approved" ? "bg-green-50 text-success border-green-200" :
                                u.approval_status === "Pending" ? "bg-amber-50 text-amber-700 border-amber-200 animate-pulse" :
                                u.approval_status === "Rejected" ? "bg-rose-50 text-rose-700 border-rose-200" :
                                "bg-slate-100 text-slate-700 border-slate-300"
                              }`}>
                                {u.approval_status}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex justify-center items-center gap-2">
                                <button
                                  onClick={() => { setSelectedUser(u); setShowDetailsModal(true); }}
                                  className="p-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                                  title="View Details"
                                >
                                  <Eye className="w-4 h-4" />
                                </button>
                                
                                {u.approval_status === "Pending" && (
                                  <>
                                    <button
                                      onClick={() => { setSelectedUser(u); setShowActionModal("approve"); }}
                                      className="p-1.5 bg-green-50 text-success hover:bg-green-100 rounded-lg transition-colors"
                                      title="Approve User"
                                    >
                                      <CheckCircle className="w-4 h-4" />
                                    </button>
                                    <button
                                      onClick={() => { setSelectedUser(u); setShowActionModal("reject"); }}
                                      className="p-1.5 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-lg transition-colors"
                                      title="Reject User"
                                    >
                                      <XCircle className="w-4 h-4" />
                                    </button>
                                  </>
                                )}
                                
                                {u.approval_status === "Approved" && (
                                  <button
                                    onClick={() => { setSelectedUser(u); setShowActionModal("suspend"); }}
                                    className="p-1.5 bg-amber-50 text-amber-700 hover:bg-amber-100 rounded-lg transition-colors"
                                    title="Suspend User"
                                  >
                                    <Lock className="w-4 h-4" />
                                  </button>
                                )}
                                
                                {(u.approval_status === "Suspended" || u.approval_status === "Rejected") && (
                                  <button
                                    onClick={() => { setSelectedUser(u); setShowActionModal("reactivate"); }}
                                    className="p-1.5 bg-green-50 text-success hover:bg-green-100 rounded-lg transition-colors"
                                    title="Reactivate User"
                                  >
                                    <Unlock className="w-4 h-4" />
                                  </button>
                                )}

                                {user?.id !== u.id && (
                                  <button
                                    onClick={() => handleDeleteUser(u.id)}
                                    className="p-1.5 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                                    title="Delete User"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Recent Registrations and Approval History Lists */}
              {adminSummary && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
                  {/* Recent Registrations Panel */}
                  <div className="premium-card bg-white p-6 border border-gray-150 shadow-sm rounded-2xl space-y-4">
                    <div className="flex items-center gap-2 border-b border-gray-100 pb-3">
                      <Users className="w-5 h-5 text-primary" />
                      <h3 className="font-bold text-gray-900 text-sm">Recent Registrations</h3>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-50 text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                            <th className="px-4 py-2">User</th>
                            <th className="px-4 py-2">Role</th>
                            <th className="px-4 py-2">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 text-xs">
                          {adminSummary.recent_registrations?.length === 0 ? (
                            <tr>
                              <td colSpan={3} className="px-4 py-4 text-center text-gray-400">
                                No recent registrations.
                              </td>
                            </tr>
                          ) : (
                            adminSummary.recent_registrations?.map((r: any) => (
                              <tr key={r.id} className="hover:bg-slate-50">
                                <td className="px-4 py-2">
                                  <div className="font-semibold text-gray-800">{r.full_name || "—"}</div>
                                  <div className="text-[10px] text-gray-500 font-mono">{r.email}</div>
                                </td>
                                <td className="px-4 py-2 capitalize font-medium text-gray-600">{r.role}</td>
                                <td className="px-4 py-2">
                                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border uppercase tracking-wider ${
                                    r.approval_status === "Approved" ? "bg-green-50 text-success border-green-200" :
                                    r.approval_status === "Pending" ? "bg-amber-50 text-amber-700 border-amber-200" :
                                    r.approval_status === "Rejected" ? "bg-rose-50 text-rose-700 border-rose-200" :
                                    "bg-slate-100 text-slate-700 border-slate-300"
                                  }`}>
                                    {r.approval_status}
                                  </span>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Approval History Panel */}
                  <div className="premium-card bg-white p-6 border border-gray-150 shadow-sm rounded-2xl space-y-4">
                    <div className="flex items-center gap-2 border-b border-gray-100 pb-3">
                      <CheckCircle className="w-5 h-5 text-success" />
                      <h3 className="font-bold text-gray-900 text-sm">Approval History</h3>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-50 text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                            <th className="px-4 py-2">User</th>
                            <th className="px-4 py-2">Outcome</th>
                            <th className="px-4 py-2">Processed By / Details</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 text-xs">
                          {adminSummary.approval_history?.length === 0 ? (
                            <tr>
                              <td colSpan={3} className="px-4 py-4 text-center text-gray-400">
                                No history available.
                              </td>
                            </tr>
                          ) : (
                            adminSummary.approval_history?.map((h: any) => (
                              <tr key={h.id} className="hover:bg-slate-50">
                                <td className="px-4 py-2">
                                  <div className="font-semibold text-gray-800">{h.full_name || "—"}</div>
                                  <div className="text-[10px] text-gray-500 font-mono">{h.email}</div>
                                </td>
                                <td className="px-4 py-2">
                                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border uppercase tracking-wider ${
                                    h.approval_status === "Approved" ? "bg-green-50 text-success border-green-200" :
                                    h.approval_status === "Rejected" ? "bg-rose-50 text-rose-700 border-rose-200" :
                                    h.approval_status === "Suspended" ? "bg-amber-50 text-amber-700 border-amber-200" :
                                    "bg-slate-100 text-slate-700 border-slate-300"
                                  }`}>
                                    {h.approval_status}
                                  </span>
                                </td>
                                <td className="px-4 py-2 text-gray-600">
                                  {h.approved_by_name && (
                                    <div className="font-semibold">By: {h.approved_by_name}</div>
                                  )}
                                  {h.approval_notes && (
                                    <div className="text-[10px] text-gray-500 italic truncate max-w-[150px]">
                                      Note: "{h.approval_notes}"
                                    </div>
                                  )}
                                  {h.rejection_reason && (
                                    <div className="text-[10px] text-rose-600 font-medium truncate max-w-[150px]">
                                      Reason: {h.rejection_reason}
                                    </div>
                                  )}
                                </td>
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
          )}

          {/* Question CMS Panel */}
          {activeTab === "questions" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-extrabold text-gray-900">Question CMS</h2>
                <button
                  onClick={() => setShowAddQForm(!showAddQForm)}
                  className="px-4 py-2 bg-gray-900 hover:bg-black text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition-colors shadow-sm"
                >
                  <PlusCircle className="w-4 h-4" />
                  {showAddQForm ? "Close Form" : "Add Question"}
                </button>
              </div>

              {/* Add Question Form */}
              {showAddQForm && (
                <form onSubmit={handleAddQuestion} className="p-6 bg-white border border-gray-150 rounded-2xl shadow-sm space-y-4">
                  <h3 className="font-bold text-gray-900 text-sm">Add New Mock Question</h3>
                  
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Question Body</label>
                    <textarea
                      required
                      value={newQBody}
                      onChange={e => setNewQBody(e.target.value)}
                      rows={4}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-primary"
                      placeholder="Enter question text or passage..."
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Option A</label>
                      <input
                        type="text"
                        value={newQOptA}
                        onChange={e => setNewQOptA(e.target.value)}
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none"
                        placeholder="Option A"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Option B</label>
                      <input
                        type="text"
                        value={newQOptB}
                        onChange={e => setNewQOptB(e.target.value)}
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none"
                        placeholder="Option B"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Option C</label>
                      <input
                        type="text"
                        value={newQOptC}
                        onChange={e => setNewQOptC(e.target.value)}
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none"
                        placeholder="Option C"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Option D</label>
                      <input
                        type="text"
                        value={newQOptD}
                        onChange={e => setNewQOptD(e.target.value)}
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none"
                        placeholder="Option D"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Correct Answer</label>
                      <input
                        type="text"
                        required
                        value={newQCorrect}
                        onChange={e => setNewQCorrect(e.target.value)}
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none"
                        placeholder="e.g. A or numeric value"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Difficulty</label>
                      <select
                        value={newQDifficulty}
                        onChange={e => setNewQDifficulty(e.target.value)}
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none"
                      >
                        <option value="easy">Easy</option>
                        <option value="medium">Medium</option>
                        <option value="hard">Hard</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Explanation</label>
                    <textarea
                      value={newQExplanation}
                      onChange={e => setNewQExplanation(e.target.value)}
                      rows={2}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none"
                      placeholder="Add explanation notes..."
                    />
                  </div>

                  <button type="submit" className="premium-btn px-6 py-2">
                    Create Question
                  </button>
                </form>
              )}

              {/* Bulk import box */}
              <div className="p-6 bg-slate-50 border border-dashed border-gray-300 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <h4 className="font-bold text-gray-900 text-sm">Bulk Import from CSV</h4>
                  <p className="text-xs text-gray-500">Provide a CSV containing: body, correct_option, difficulty, topic_name, etc.</p>
                </div>
                <form onSubmit={handleImportCsv} className="flex items-center gap-2">
                  <input
                    type="file"
                    accept=".csv"
                    required
                    onChange={(e) => setCsvFile(e.target.files?.[0] || null)}
                    className="text-xs text-gray-500"
                  />
                  <button type="submit" className="premium-btn px-4 py-2 text-xs">
                    <FileUp className="w-3.5 h-3.5" />
                    Upload
                  </button>
                </form>
              </div>

              {/* Roster list */}
              <div className="space-y-4">
                <h3 className="font-bold text-gray-900 text-base">Question Bank Inventory</h3>
                <div className="grid grid-cols-1 gap-4">
                  {questionsList.map(q => (
                    <div key={q.id} className="premium-card bg-white p-6 border border-gray-100 flex items-start justify-between gap-4">
                      <div className="space-y-2">
                        <p className="text-sm text-gray-800 line-clamp-2 font-medium">{q.body}</p>
                        <div className="flex gap-2 text-[10px] font-bold text-gray-500 uppercase">
                          <span className="px-2 py-0.5 bg-gray-100 rounded">Diff: {q.difficulty}</span>
                          <span className={`px-2 py-0.5 rounded ${q.is_approved ? "bg-green-50 text-success border border-green-200" : "bg-yellow-50 text-warning border border-yellow-200"}`}>
                            {q.is_approved ? "Approved" : "Pending Review"}
                          </span>
                        </div>
                      </div>
                      {!q.is_approved && (
                        <button
                          onClick={() => handleApproveQuestion(q.id)}
                          className="px-3 py-1.5 bg-success hover:bg-green-700 text-white rounded-lg text-xs font-bold shadow-sm transition-colors flex items-center gap-1 shrink-0"
                        >
                          <CheckCircle className="w-3.5 h-3.5" />
                          Approve
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Report Exporter Panel */}
          {activeTab === "reports" && (
            <div className="space-y-6">
              <h2 className="text-2xl font-extrabold text-gray-900">Export Platform Logs</h2>
              <p className="text-sm text-gray-500 mt-1">Download CSV formats for mock scores, completions, and user databases.</p>
              
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-4">
                <button onClick={() => handleExport("scores")} className="premium-card p-6 text-center hover:bg-slate-50 transition-colors flex flex-col items-center gap-3">
                  <div className="p-3.5 bg-blue-50 border border-blue-100 text-primary rounded-full">
                    <FileDown className="w-8 h-8" />
                  </div>
                  <h4 className="font-bold text-gray-900 text-sm">Score Reports CSV</h4>
                  <p className="text-xs text-gray-400">Contains composite, section metrics, and timestamps.</p>
                </button>

                <button onClick={() => handleExport("users")} className="premium-card p-6 text-center hover:bg-slate-50 transition-colors flex flex-col items-center gap-3">
                  <div className="p-3.5 bg-green-50 border border-green-100 text-success rounded-full">
                    <Users className="w-8 h-8" />
                  </div>
                  <h4 className="font-bold text-gray-900 text-sm">Users Registry CSV</h4>
                  <p className="text-xs text-gray-400">All registered profiles with roles and verified states.</p>
                </button>

                <button onClick={() => handleExport("completion")} className="premium-card p-6 text-center hover:bg-slate-50 transition-colors flex flex-col items-center gap-3">
                  <div className="p-3.5 bg-indigo-50 border border-indigo-100 text-indigo-700 rounded-full">
                    <HelpCircle className="w-8 h-8" />
                  </div>
                  <h4 className="font-bold text-gray-900 text-sm">Completions CSV</h4>
                  <p className="text-xs text-gray-400">Starts vs completions and active mock statistics.</p>
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Details Modal */}
      {showDetailsModal && selectedUser && (
        <div className="fixed inset-0 bg-slate-900 bg-opacity-50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl border border-slate-100 flex flex-col max-h-[90vh]">
            <div className="p-6 bg-slate-50 border-b border-gray-150 flex items-center justify-between">
              <h3 className="text-lg font-extrabold text-slate-900">User Registration Details</h3>
              <button
                onClick={() => { setShowDetailsModal(false); setSelectedUser(null); }}
                className="text-gray-400 hover:text-gray-600 font-bold text-sm bg-gray-100 p-1.5 rounded-full"
              >
                ✕
              </button>
            </div>
            
            <div className="p-6 space-y-4 overflow-y-auto flex-1 text-sm">
              <div className="grid grid-cols-3 py-2 border-b border-gray-50">
                <span className="font-bold text-gray-400 uppercase tracking-wider text-[10px]">User ID</span>
                <span className="col-span-2 font-mono text-xs text-gray-800 break-all">{selectedUser.id}</span>
              </div>
              <div className="grid grid-cols-3 py-2 border-b border-gray-50">
                <span className="font-bold text-gray-400 uppercase tracking-wider text-[10px]">Full Name</span>
                <span className="col-span-2 text-gray-800 font-semibold">{selectedUser.full_name || "—"}</span>
              </div>
              <div className="grid grid-cols-3 py-2 border-b border-gray-50">
                <span className="font-bold text-gray-400 uppercase tracking-wider text-[10px]">Email Address</span>
                <span className="col-span-2 font-mono text-gray-800">{selectedUser.email}</span>
              </div>
              <div className="grid grid-cols-3 py-2 border-b border-gray-50">
                <span className="font-bold text-gray-400 uppercase tracking-wider text-[10px]">Assigned Role</span>
                <span className="col-span-2 capitalize font-semibold text-slate-700">{selectedUser.role}</span>
              </div>
              <div className="grid grid-cols-3 py-2 border-b border-gray-50">
                <span className="font-bold text-gray-400 uppercase tracking-wider text-[10px]">Date Registered</span>
                <span className="col-span-2 text-gray-700">
                  {selectedUser.created_at ? new Date(selectedUser.created_at).toLocaleString() : "—"}
                </span>
              </div>
              <div className="grid grid-cols-3 py-2 border-b border-gray-50">
                <span className="font-bold text-gray-400 uppercase tracking-wider text-[10px]">Registration IP</span>
                <span className="col-span-2 font-mono text-gray-700">{selectedUser.registration_ip || "Not Available"}</span>
              </div>
              <div className="grid grid-cols-3 py-2 border-b border-gray-50">
                <span className="font-bold text-gray-400 uppercase tracking-wider text-[10px]">Device Info</span>
                <span className="col-span-2 text-xs text-gray-500 break-words">{selectedUser.registration_user_agent || "Not Available"}</span>
              </div>
              
              <div className="p-4 bg-slate-50 rounded-2xl space-y-2 mt-4">
                <h4 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider">Approval Workflow History</h4>
                
                <div className="grid grid-cols-3 py-1 border-b border-gray-200 border-opacity-50">
                  <span className="font-semibold text-gray-500 text-xs">Status</span>
                  <span className="col-span-2">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      selectedUser.approval_status === "Approved" ? "bg-green-50 text-success border border-green-200" :
                      selectedUser.approval_status === "Pending" ? "bg-amber-50 text-amber-700 border-amber-200" :
                      selectedUser.approval_status === "Rejected" ? "bg-rose-50 text-rose-700 border-rose-200" :
                      "bg-slate-100 text-slate-700 border-slate-300"
                    }`}>
                      {selectedUser.approval_status}
                    </span>
                  </span>
                </div>
                {selectedUser.approved_by_name && (
                  <div className="grid grid-cols-3 py-1 border-b border-gray-200 border-opacity-50">
                    <span className="font-semibold text-gray-500 text-xs">Processed By</span>
                    <span className="col-span-2 text-xs font-semibold text-gray-700">{selectedUser.approved_by_name}</span>
                  </div>
                )}
                {selectedUser.approval_date && (
                  <div className="grid grid-cols-3 py-1 border-b border-gray-200 border-opacity-50">
                    <span className="font-semibold text-gray-500 text-xs">Processed At</span>
                    <span className="col-span-2 text-xs text-gray-700">{new Date(selectedUser.approval_date).toLocaleString()}</span>
                  </div>
                )}
                {selectedUser.rejection_reason && (
                  <div className="grid grid-cols-3 py-1 border-b border-gray-200 border-opacity-50 text-rose-700">
                    <span className="font-semibold text-rose-500 text-xs">Rejection Reason</span>
                    <span className="col-span-2 text-xs font-medium">{selectedUser.rejection_reason}</span>
                  </div>
                )}
                {selectedUser.approval_notes && (
                  <div className="grid grid-cols-3 py-1">
                    <span className="font-semibold text-gray-500 text-xs">Notes</span>
                    <span className="col-span-2 text-xs text-gray-600 italic break-words">"{selectedUser.approval_notes}"</span>
                  </div>
                )}
              </div>
            </div>
            
            <div className="p-6 bg-slate-50 border-t border-gray-150 flex justify-end">
              <button
                onClick={() => { setShowDetailsModal(false); setSelectedUser(null); }}
                className="px-5 py-2.5 bg-gray-900 hover:bg-black text-white font-bold rounded-xl text-xs transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Action Modals */}
      {showActionModal && selectedUser && (
        <div className="fixed inset-0 bg-slate-900 bg-opacity-50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form onSubmit={handleUserActionSubmit} className="bg-white rounded-3xl max-w-md w-full overflow-hidden shadow-2xl border border-slate-100">
            <div className="p-6 bg-slate-50 border-b border-gray-150 flex items-center gap-2">
              <ShieldAlert className={`w-5 h-5 ${showActionModal === "reject" ? "text-rose-500" : "text-primary"}`} />
              <h3 className="text-base font-extrabold text-slate-900 text-left">
                {showActionModal === "approve" && "Confirm Registration Approval"}
                {showActionModal === "reject" && "Decline Registration Request"}
                {showActionModal === "suspend" && "Confirm Account Suspension"}
                {showActionModal === "reactivate" && "Reactivate User Account"}
              </h3>
            </div>
            
            <div className="p-6 space-y-4 text-sm text-left">
              <p className="text-gray-600">
                Are you sure you want to {showActionModal} the registration request for:
                <br />
                <strong className="text-slate-900 font-bold">{selectedUser.full_name || selectedUser.email}</strong> 
                <span className="text-xs text-gray-500"> ({selectedUser.email})</span>?
              </p>
              
              {showActionModal === "reject" && (
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Rejection Reason (Required)</label>
                  <textarea
                    required
                    value={actionReason}
                    onChange={e => setActionReason(e.target.value)}
                    rows={3}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-primary focus:bg-white transition-colors"
                    placeholder="Enter reason for declining the registration..."
                  />
                </div>
              )}
              
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Internal Notes (Optional)</label>
                <textarea
                  value={actionNotes}
                  onChange={e => setActionNotes(e.target.value)}
                  rows={2}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-primary focus:bg-white transition-colors"
                  placeholder="Add details, observations, or rationale..."
                />
              </div>
            </div>
            
            <div className="p-6 bg-slate-50 border-t border-gray-150 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => { setShowActionModal(null); setActionNotes(""); setActionReason(""); setSelectedUser(null); }}
                className="px-4 py-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 font-bold rounded-xl text-xs transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className={`px-4 py-2 text-white font-bold rounded-xl text-xs transition-colors ${
                  showActionModal === "reject" ? "bg-rose-600 hover:bg-rose-700" :
                  showActionModal === "suspend" ? "bg-amber-600 hover:bg-amber-700" :
                  "bg-green-600 hover:bg-green-700"
                }`}
              >
                Confirm
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default AdminPortal;
