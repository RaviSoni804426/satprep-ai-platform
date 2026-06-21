import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { logout } from "../store/authSlice";
import { RootState } from "../store";
import { api } from "../services/api";
import { LogOut, BookOpen, Users, HelpCircle, BarChart3, Database, FileUp, FileDown, PlusCircle, CheckCircle, Loader2 } from "lucide-react";

const AdminPortal: React.FC = () => {
  const { user } = useSelector((state: RootState) => state.auth);
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<"users" | "questions" | "analytics" | "reports">("analytics");
  const [loading, setLoading] = useState(false);

  // Users tab state
  const [usersList, setUsersList] = useState<any[]>([]);
  const [usersTotal, setUsersTotal] = useState(0);
  const [usersSearch, setUsersSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");

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
        const data = await api.users.list(roleFilter || undefined, usersSearch || undefined);
        setUsersList(data.data || []);
        setUsersTotal(data.total || 0);
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
  }, [activeTab, roleFilter, usersSearch]);

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
                  <span className="text-3xl font-extrabold text-success mt-1 block">{int(platformStats.completion_rate * 100)}%</span>
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
                <h2 className="text-2xl font-extrabold text-gray-900">User Directory</h2>
                
                <div className="flex gap-2">
                  <select
                    value={roleFilter}
                    onChange={e => setRoleFilter(e.target.value)}
                    className="bg-white border border-gray-200 px-3 py-2 rounded-xl text-xs font-semibold focus:outline-none"
                  >
                    <option value="">All Roles</option>
                    <option value="student">Students</option>
                    <option value="counsellor">Counsellors</option>
                    <option value="author">Authors</option>
                    <option value="admin">Admins</option>
                  </select>
                  <input
                    type="text"
                    value={usersSearch}
                    onChange={e => setUsersSearch(e.target.value)}
                    placeholder="Search name/email..."
                    className="bg-white border border-gray-200 px-3 py-2 rounded-xl text-xs focus:outline-none focus:border-primary w-40"
                  />
                </div>
              </div>

              <div className="premium-card bg-white overflow-hidden border border-gray-100 shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-100 text-xs font-bold text-gray-500 uppercase tracking-wider">
                        <th className="px-6 py-4">Full Name</th>
                        <th className="px-6 py-4">Email</th>
                        <th className="px-6 py-4">Role</th>
                        <th className="px-6 py-4 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-sm text-gray-700">
                      {usersList.map(u => (
                        <tr key={u.id}>
                          <td className="px-6 py-4 font-semibold text-gray-900">{u.full_name || "—"}</td>
                          <td className="px-6 py-4 font-mono text-xs">{u.email}</td>
                          <td className="px-6 py-4 capitalize font-semibold text-gray-600">{u.role}</td>
                          <td className="px-6 py-4 text-center">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              u.is_active ? "bg-green-50 text-success border border-green-200" : "bg-red-50 text-danger border border-red-200"
                            }`}>
                              {u.is_active ? "Active" : "Inactive"}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
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
    </div>
  );
};

// Quick helper to cast values safely in JSX
const int = (val: any) => Math.round(Number(val));

export default AdminPortal;
