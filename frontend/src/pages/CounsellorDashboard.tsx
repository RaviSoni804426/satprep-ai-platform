import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { logout } from "../store/authSlice";
import { RootState } from "../store";
import { api } from "../services/api";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { LogOut, BookOpen, Search, ArrowUpRight, ArrowDownRight, Minus, CheckCircle, AlertTriangle, XCircle, FileText, Loader2, User } from "lucide-react";

const CounsellorDashboard: React.FC = () => {
  const { user } = useSelector((state: RootState) => state.auth);
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [selectedStudent, setSelectedStudent] = useState<any | null>(null);
  const [studentAnalytics, setStudentAnalytics] = useState<any>(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);

  const fetchRoster = async () => {
    try {
      setLoading(true);
      const data = await api.counsellor.students();
      setStudents(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRoster();
  }, []);

  const handleLogout = () => {
    dispatch(logout());
    navigate("/login");
  };

  const handleSelectStudent = async (student: any) => {
    setSelectedStudent(student);
    try {
      setLoadingAnalytics(true);
      const data = await api.analytics.getStudent(student.id);
      setStudentAnalytics(data);
    } catch (err) {
      console.error(err);
      setStudentAnalytics(null);
    } finally {
      setLoadingAnalytics(false);
    }
  };

  const handleExport = (type: string) => {
    // Triggers download of CSV
    const url = api.admin.exportUrl(type);
    window.open(url, "_blank");
  };

  // Filter roster
  const filteredStudents = students.filter(s =>
    s.full_name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 px-6 py-4 sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary bg-opacity-10 rounded-xl">
              <BookOpen className="w-6 h-6 text-primary" />
            </div>
            <span className="text-lg font-bold text-gray-900">SATPrep AI Counsellor</span>
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

      {/* Main Layout Grid */}
      <main className="max-w-7xl mx-auto px-6 py-8 flex-1 w-full grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Side: Roster */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">My Students</h1>
              <p className="text-sm text-gray-500 mt-0.5">Track and advise your assigned student cohorts.</p>
            </div>
            
            <div className="flex gap-2">
              <button
                onClick={() => handleExport("scores")}
                className="px-3.5 py-2 border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 font-semibold text-xs rounded-xl shadow-sm flex items-center gap-1.5 transition-all"
              >
                <FileText className="w-4 h-4 text-gray-500" />
                Export Scores
              </button>
            </div>
          </div>

          {/* Search bar */}
          <div className="relative">
            <Search className="absolute left-4 top-3.5 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search students by name..."
              className="w-full bg-white border border-gray-200 rounded-xl py-3 pl-12 pr-4 text-sm focus:outline-none focus:border-primary transition-colors shadow-sm"
            />
          </div>

          {/* Roster Table card */}
          {loading ? (
            <div className="premium-card p-12 text-center bg-white flex items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : filteredStudents.length === 0 ? (
            <div className="premium-card p-12 text-center text-gray-500 bg-white">
              No students found in your roster.
            </div>
          ) : (
            <div className="premium-card bg-white overflow-hidden border border-gray-100 shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100 text-xs font-bold text-gray-500 uppercase tracking-wider">
                      <th className="px-6 py-4">Name</th>
                      <th className="px-6 py-4 text-center">Latest Score</th>
                      <th className="px-6 py-4 text-center">Best Score</th>
                      <th className="px-6 py-4 text-center">Trend</th>
                      <th className="px-6 py-4 text-center">Readiness Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-sm text-gray-700">
                    {filteredStudents.map(student => {
                      const isSelected = selectedStudent?.id === student.id;
                      return (
                        <tr
                          key={student.id}
                          onClick={() => handleSelectStudent(student)}
                          className={`hover:bg-slate-50 cursor-pointer transition-colors ${
                            isSelected ? "bg-blue-50 bg-opacity-50" : ""
                          }`}
                        >
                          <td className="px-6 py-4 font-semibold text-gray-900">{student.full_name}</td>
                          <td className="px-6 py-4 text-center font-bold text-gray-900">{student.latest_score || "—"}</td>
                          <td className="px-6 py-4 text-center font-bold text-gray-500">{student.best_score || "—"}</td>
                          <td className="px-6 py-4 text-center">
                            <div className="flex justify-center">
                              {student.trend === "up" && <ArrowUpRight className="w-5 h-5 text-success" />}
                              {student.trend === "down" && <ArrowDownRight className="w-5 h-5 text-danger" />}
                              {student.trend === "stable" && <Minus className="w-5 h-5 text-gray-400" />}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex justify-center">
                              {student.status === "Ready" && (
                                <span className="px-2.5 py-1 bg-green-50 border border-green-200 text-success text-xs font-bold rounded-lg flex items-center gap-1">
                                  <CheckCircle className="w-3.5 h-3.5 text-success" />
                                  Ready
                                </span>
                              )}
                              {student.status === "Almost Ready" && (
                                <span className="px-2.5 py-1 bg-amber-50 border border-amber-200 text-warning text-xs font-bold rounded-lg flex items-center gap-1">
                                  <AlertTriangle className="w-3.5 h-3.5 text-warning" />
                                  Almost Ready
                                </span>
                              )}
                              {student.status === "Needs Work" && (
                                <span className="px-2.5 py-1 bg-red-50 border border-red-200 text-danger text-xs font-bold rounded-lg flex items-center gap-1">
                                  <XCircle className="w-3.5 h-3.5 text-danger" />
                                  Needs Work
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Right Side: Student Detail Drilldown */}
        <div className="space-y-6">
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <User className="w-5 h-5 text-primary" />
            Student Insights
          </h2>

          {!selectedStudent ? (
            <div className="premium-card p-8 text-center text-gray-500 bg-white">
              Select a student from the roster to view their score trends, topic accuracy, and weak areas.
            </div>
          ) : loadingAnalytics ? (
            <div className="premium-card p-12 text-center bg-white flex items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : !studentAnalytics ? (
            <div className="premium-card p-8 text-center text-red-500 bg-white">
              Error fetching student analytics logs.
            </div>
          ) : (
            <div className="premium-card bg-white p-6 border border-gray-150 shadow-sm space-y-6">
              {/* Header info */}
              <div>
                <h3 className="font-extrabold text-gray-900 text-lg">{selectedStudent.full_name}</h3>
                <span className="text-xs text-gray-400">Student Analytics Summary</span>
              </div>

              {/* Stat card list */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-gray-50 border border-gray-100 rounded-xl">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Average score</span>
                  <span className="text-xl font-extrabold text-gray-900 mt-1 block">{studentAnalytics.avg_score || "—"}</span>
                </div>
                <div className="p-4 bg-gray-50 border border-gray-100 rounded-xl">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Best Score</span>
                  <span className="text-xl font-extrabold text-primary mt-1 block">{studentAnalytics.best_score || "—"}</span>
                </div>
              </div>

              {/* Progress Chart */}
              {studentAnalytics.score_trend?.length > 0 && (
                <div className="space-y-2">
                  <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Score Progression</span>
                  <div className="h-44 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={studentAnalytics.score_trend.map((s: number, i: number) => ({ name: `#${i+1}`, Score: s }))}
                        margin={{ top: 5, right: 5, left: -25, bottom: 0 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} />
                        <YAxis domain={[400, 1600]} stroke="#94a3b8" fontSize={10} />
                        <Tooltip />
                        <Line type="monotone" dataKey="Score" stroke="#1D4ED8" strokeWidth={2.5} activeDot={{ r: 4 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* Section accuracy */}
              <div className="space-y-3">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider block">Section Performance</span>
                <div className="space-y-2">
                  <div>
                    <div className="flex justify-between text-xs font-semibold text-gray-700 mb-1">
                      <span>Reading & Writing</span>
                      <span>{studentAnalytics.accuracy?.reading || 0}% Accuracy</span>
                    </div>
                    <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                      <div className="bg-primary h-full rounded-full" style={{ width: `${studentAnalytics.accuracy?.reading || 0}%` }} />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-xs font-semibold text-gray-700 mb-1">
                      <span>Mathematics</span>
                      <span>{studentAnalytics.accuracy?.math || 0}% Accuracy</span>
                    </div>
                    <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                      <div className="bg-success h-full rounded-full" style={{ width: `${studentAnalytics.accuracy?.math || 0}%` }} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Weak topics card */}
              <div className="space-y-3 border-t border-gray-100 pt-4">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider block">Identified Weak Areas</span>
                {studentAnalytics.weak_topics?.length === 0 ? (
                  <p className="text-xs text-gray-500 font-medium">No major weak areas flagged yet.</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {studentAnalytics.weak_topics?.map((topic: string) => (
                      <span key={topic} className="px-2 py-1 bg-red-50 border border-red-150 text-danger rounded-lg text-xs font-bold">
                        {topic}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default CounsellorDashboard;
