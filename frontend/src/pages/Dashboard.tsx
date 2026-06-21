import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { logout } from "../store/authSlice";
import { RootState } from "../store";
import { api } from "../services/api";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { LogOut, BookOpen, AlertTriangle, Lightbulb, Play, Calendar, Clipboard, Loader2, RefreshCw } from "lucide-react";

const Dashboard: React.FC = () => {
  const { user } = useSelector((state: RootState) => state.auth);
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const [analytics, setAnalytics] = useState<any>(null);
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [tests, setTests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTestSession, setActiveTestSession] = useState<string | null>(null);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const analyticData = await api.analytics.getMe();
      setAnalytics(analyticData);

      const recs = await api.recommendations.list();
      setRecommendations(recs.data || []);

      const testList = await api.tests.list();
      setTests(testList.data || []);
      
      // Look for active sessions in cache or storage if any
      const activeSess = localStorage.getItem("active_session_id");
      if (activeSess) {
        setActiveTestSession(activeSess);
      }
    } catch (err) {
      console.error("Error loading dashboard data", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const handleLogout = () => {
    dispatch(logout());
    navigate("/login");
  };

  const handleStartTest = async (testId: string) => {
    try {
      setLoading(true);
      const data = await api.tests.start(testId);
      localStorage.setItem("active_session_id", data.session_id);
      navigate(`/test/${data.session_id}`);
    } catch (err: any) {
      alert(err.message || "Failed to start test");
    } finally {
      setLoading(false);
    }
  };

  const handleResumeTest = () => {
    if (activeTestSession) {
      navigate(`/test/${activeTestSession}`);
    }
  };

  const handleDismissRec = async (recId: string) => {
    try {
      await api.recommendations.dismiss(recId);
      setRecommendations(prev => prev.filter(r => r.id !== recId));
    } catch (err) {
      console.error(err);
    }
  };

  if (loading && !analytics) {
    return (
      <div className="flex-grow flex items-center justify-center bg-slate-50 min-h-screen">
        <div className="text-center space-y-2">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
          <p className="text-gray-500 font-medium">Loading your student portal...</p>
        </div>
      </div>
    );
  }

  // Map score trend to Recharts compatible list
  const trendData = analytics?.score_trend.map((score: number, idx: number) => ({
    name: `Mock #${idx + 1}`,
    Score: score
  })) || [];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 px-6 py-4 sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary bg-opacity-10 rounded-xl">
              <BookOpen className="w-6 h-6 text-primary" />
            </div>
            <span className="text-lg font-bold text-gray-900 tracking-tight">SATPrep AI</span>
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

      {/* Main Dashboard Area */}
      <main className="max-w-7xl mx-auto px-6 py-8 flex-1 w-full space-y-8">
        {/* Welcome Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Student Dashboard</h1>
            <p className="text-gray-500 text-sm mt-1">Monitor your score progression and personalized study targets.</p>
          </div>
          <div className="flex gap-3">
            {activeTestSession && (
              <button onClick={handleResumeTest} className="px-5 py-2.5 bg-orange-600 hover:bg-orange-700 text-white font-medium rounded-xl shadow-sm flex items-center gap-2 transition-all">
                <Play className="w-4 h-4 fill-white" />
                Resume Active Mock
              </button>
            )}
            <button onClick={fetchDashboardData} className="premium-btn-secondary p-2.5">
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Statistics cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="premium-card p-6 bg-white flex flex-col justify-between">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Latest Score</span>
            <div className="flex items-baseline gap-2 mt-4">
              <span className="text-4xl font-extrabold text-gray-950">{analytics?.avg_score ? analytics?.score_trend[analytics.score_trend.length - 1] : "—"}</span>
              <span className="text-xs text-gray-400">/ 1600</span>
            </div>
            <span className="text-xs text-gray-500 mt-2">Taken recently</span>
          </div>

          <div className="premium-card p-6 bg-white flex flex-col justify-between">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Best Score</span>
            <div className="flex items-baseline gap-2 mt-4">
              <span className="text-4xl font-extrabold text-primary">{analytics?.best_score || "—"}</span>
              <span className="text-xs text-gray-400">/ 1600</span>
            </div>
            <span className="text-xs text-blue-500 mt-2 font-medium">Target: {user?.target_score || 1400}</span>
          </div>

          <div className="premium-card p-6 bg-white flex flex-col justify-between">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Tests Completed</span>
            <div className="flex items-baseline gap-2 mt-4">
              <span className="text-4xl font-extrabold text-success">{analytics?.total_mocks || 0}</span>
            </div>
            <span className="text-xs text-gray-500 mt-2">Active practice attempts</span>
          </div>
        </div>

        {/* Score Progression Trend Chart */}
        {trendData.length > 0 && (
          <div className="premium-card p-6 bg-white space-y-4">
            <h2 className="text-lg font-bold text-gray-900">Score Progression Trend</h2>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} tickLine={false} />
                  <YAxis domain={[400, 1600]} stroke="#94a3b8" fontSize={12} tickLine={false} />
                  <Tooltip />
                  <Line type="monotone" dataKey="Score" stroke="#1D4ED8" strokeWidth={3} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Dashboard Grid (Recommendations, Weak Topics, Active Mocks) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* AI recommendations */}
          <div className="lg:col-span-2 space-y-6">
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <Lightbulb className="w-5 h-5 text-amber-500 fill-amber-500" />
              AI Study Recommendations
            </h2>
            
            {recommendations.length === 0 ? (
              <div className="premium-card p-8 text-center text-gray-500">
                Complete a mock test to unlock AI recommendations!
              </div>
            ) : (
              <div className="space-y-4">
                {recommendations.map(rec => (
                  <div key={rec.id} className="premium-card p-6 border-l-4 border-l-primary flex flex-col justify-between relative">
                    <button
                      onClick={() => handleDismissRec(rec.id)}
                      className="absolute right-4 top-4 text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      ×
                    </button>
                    <div>
                      <div className="text-xs font-semibold text-primary uppercase tracking-wider mb-1">
                        {rec.type.replace("_", " ")}
                      </div>
                      <h3 className="font-bold text-gray-900 text-lg mb-2">{rec.content.title}</h3>
                      
                      {rec.type === "practice_set" && (
                        <div className="space-y-2">
                          <p className="text-sm text-gray-600">
                            Boost your accuracy in topics:{" "}
                            <span className="font-semibold">{rec.content.topics?.join(", ")}</span>
                          </p>
                          <div className="flex gap-2 pt-2">
                            {rec.content.questions?.slice(0, 3).map((q: any, idx: number) => (
                              <span key={idx} className="px-2.5 py-1 bg-gray-100 text-gray-600 text-xs rounded-lg border border-gray-200">
                                {q.topic}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {rec.type === "study_plan" && (
                        <div className="grid grid-cols-2 gap-4 mt-2">
                          {Object.entries(rec.content.days || {}).slice(0, 2).map(([day, val]: any) => (
                            <div key={day} className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                              <span className="font-bold text-xs text-gray-700">{day}</span>
                              <p className="text-xs text-gray-600 font-semibold mt-1">{val.topic}</p>
                              <span className="text-[10px] text-primary font-medium">{val.subject}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {rec.type === "next_test" && (
                        <div className="flex items-center gap-4 mt-2">
                          <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl text-primary">
                            <Calendar className="w-6 h-6" />
                          </div>
                          <div>
                            <p className="text-sm text-gray-800 font-medium">Recommended: {rec.content.recommend_date}</p>
                            <p className="text-xs text-gray-500 mt-0.5">{rec.content.reason}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Side Panels (Weak Topics & Tests Catalog) */}
          <div className="space-y-8">
            {/* Weak topics card */}
            <div className="premium-card p-6 space-y-4">
              <h3 className="font-bold text-gray-900 text-base flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-500" />
                Weak Topics Focus
              </h3>
              
              {analytics?.weak_topics.length === 0 ? (
                <p className="text-sm text-gray-500">No major weak topics identified. Keep practicing!</p>
              ) : (
                <div className="space-y-2">
                  {analytics?.weak_topics.map((topic: string) => (
                    <div key={topic} className="flex items-center gap-2 p-2.5 bg-red-50 border border-red-100 rounded-xl text-red-700 text-sm font-semibold">
                      <span className="w-1.5 h-1.5 bg-red-500 rounded-full" />
                      {topic}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Test Catalog */}
            <div className="premium-card p-6 space-y-4">
              <h3 className="font-bold text-gray-900 text-base flex items-center gap-2">
                <Clipboard className="w-5 h-5 text-primary" />
                Available mock tests
              </h3>
              
              {tests.length === 0 ? (
                <p className="text-sm text-gray-500">No mocks scheduled. Check back later.</p>
              ) : (
                <div className="space-y-3">
                  {tests.map(test => (
                    <div key={test.id} className="p-4 bg-gray-50 border border-gray-200 rounded-2xl flex flex-col justify-between gap-3">
                      <div>
                        <h4 className="font-bold text-gray-900 text-sm">{test.name}</h4>
                        <p className="text-xs text-gray-500 mt-1">{test.description}</p>
                      </div>
                      <button
                        onClick={() => handleStartTest(test.id)}
                        className="w-full px-3 py-2 bg-primary hover:bg-primary-dark text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 shadow-sm transition-all"
                      >
                        <Play className="w-3.5 h-3.5 fill-white" />
                        Start Mock Test
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
