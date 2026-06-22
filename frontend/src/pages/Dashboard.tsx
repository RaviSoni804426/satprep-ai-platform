import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { logout } from "../store/authSlice";
import { RootState } from "../store";
import { api } from "../services/api";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { 
  LogOut, BookOpen, AlertTriangle, Lightbulb, Play, Calendar, Clipboard, 
  Loader2, RefreshCw, Zap, Trophy, Award, Star, Compass, ArrowRight, 
  MessageSquare, Send, CheckCircle, PlayCircle, Target, 
  TrendingUp, Smile, Brain, Sparkles, CheckSquare
} from "lucide-react";

const Dashboard: React.FC = () => {
  const { user } = useSelector((state: RootState) => state.auth);
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const [analytics, setAnalytics] = useState<any>(null);
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [tests, setTests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTestSession, setActiveTestSession] = useState<string | null>(null);

  // Gamified Study Plan state
  const [completedTasks, setCompletedTasks] = useState<number[]>([]);

  // AI Coach Chat Drawer state
  const [isCoachOpen, setIsCoachOpen] = useState(false);
  const [coachInput, setCoachInput] = useState("");
  const [chatMessages, setChatMessages] = useState<Array<{ sender: "user" | "coach"; text: string }>>([
    { sender: "coach", text: "Hello! I am your AI Study Coach. I've analyzed your mock test history and target SAT score. Ask me anything, or try one of the suggestions below!" }
  ]);
  const [coachLoading, setCoachLoading] = useState(false);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const analyticData = await api.analytics.getMe();
      setAnalytics(analyticData);

      const recs = await api.recommendations.list();
      setRecommendations(recs.data || []);

      const testList = await api.tests.list();
      setTests(testList.data || []);
      
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
      console.error(recId, err);
    }
  };

  const toggleTask = (taskId: number) => {
    setCompletedTasks(prev => 
      prev.includes(taskId) ? prev.filter(id => id !== taskId) : [...prev, taskId]
    );
  };

  const sendCoachMessage = async (msgText: string) => {
    if (!msgText.trim()) return;
    setChatMessages(prev => [...prev, { sender: "user", text: msgText }]);
    setCoachInput("");
    setCoachLoading(true);
    try {
      const data = await api.coach.ask(msgText);
      setChatMessages(prev => [...prev, { sender: "coach", text: data.response }]);
    } catch (err) {
      console.error(err);
      setChatMessages(prev => [...prev, { sender: "coach", text: "Sorry, I had trouble reaching my scoring processors. Please try again!" }]);
    } finally {
      setCoachLoading(false);
    }
  };

  if (loading && !analytics) {
    return (
      <div className="flex-grow flex items-center justify-center bg-slate-900 min-h-screen">
        <div className="text-center space-y-4">
          <Loader2 className="w-12 h-12 animate-spin text-indigo-500 mx-auto" />
          <p className="text-slate-400 font-semibold text-lg animate-pulse">Synchronizing AI Models & Student Profile...</p>
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
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Header */}
      <header className="bg-slate-900/80 border-b border-slate-800/80 px-6 py-4 sticky top-0 z-40 backdrop-blur-md">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-tr from-indigo-600 to-purple-600 rounded-xl shadow-lg shadow-indigo-500/20">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <span className="text-xl font-black bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent tracking-tight">SATPrep AI</span>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden sm:block text-right">
              <div className="font-semibold text-slate-100 text-sm">{user?.full_name || user?.email}</div>
              <div className="text-xs text-indigo-400 font-medium capitalize flex items-center gap-1 justify-end">
                <Brain className="w-3 h-3" />
                Adaptive Track • {user?.role}
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="p-2.5 bg-slate-800 hover:bg-red-500/10 text-slate-400 hover:text-red-400 rounded-xl border border-slate-700/60 transition-all duration-200"
              title="Logout"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Dashboard Area */}
      <main className="max-w-7xl mx-auto px-6 py-8 flex-1 w-full space-y-8">
        
        {/* Welcome Hero & Status Bar */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-slate-800/60 rounded-3xl p-6 md:p-8 shadow-xl relative overflow-hidden flex flex-col md:flex-row justify-between gap-6">
          <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/5 rounded-full filter blur-3xl -mr-16 -mt-16 pointer-events-none" />
          <div className="space-y-3 z-10">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-500/15 border border-indigo-500/30 rounded-full text-indigo-300 text-xs font-semibold">
              <Zap className="w-3.5 h-3.5 fill-indigo-400 text-indigo-400" />
              AI Learning Profile Active
            </div>
            <h1 className="text-3xl font-extrabold text-slate-100 tracking-tight">
              Welcome back, {user?.full_name?.split(" ")[0] || "Scholar"}!
            </h1>
            <p className="text-slate-400 text-sm max-w-xl">
              You are currently on track to reach your SAT target score. Focus on your weakly-retained concepts today.
            </p>
          </div>
          
          <div className="flex flex-wrap items-center gap-3 z-10">
            {activeTestSession && (
              <button 
                onClick={handleResumeTest} 
                className="px-5 py-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold rounded-xl shadow-lg shadow-orange-500/20 flex items-center gap-2 transition-all duration-200 transform hover:-translate-y-0.5"
              >
                <Play className="w-4 h-4 fill-white" />
                Resume Active Mock
              </button>
            )}
            <button 
              onClick={fetchDashboardData} 
              className="p-3 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl transition-colors"
              title="Refresh Data"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Core Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-slate-900 border border-slate-800/80 rounded-2xl p-5 hover:border-slate-700 transition-all shadow-md">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Latest Score</span>
              <Target className="w-4 h-4 text-indigo-400" />
            </div>
            <div className="flex items-baseline gap-1.5 mt-3">
              <span className="text-3xl font-black text-slate-100">
                {analytics?.total_mocks > 0 ? analytics?.score_trend[analytics.score_trend.length - 1] : "—"}
              </span>
              {analytics?.total_mocks > 0 && <span className="text-xs text-slate-500">/ 1600</span>}
            </div>
            <div className="text-xs text-indigo-400 mt-2 flex items-center gap-1 font-semibold">
              <TrendingUp className="w-3 h-3" />
              Improvement: {analytics?.improvement_since_last >= 0 ? `+${analytics.improvement_since_last}` : analytics.improvement_since_last} pts
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800/80 rounded-2xl p-5 hover:border-slate-700 transition-all shadow-md">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Best Mock Score</span>
              <Trophy className="w-4 h-4 text-yellow-500" />
            </div>
            <div className="flex items-baseline gap-1.5 mt-3">
              <span className="text-3xl font-black text-yellow-400">{analytics?.best_score || "—"}</span>
              {analytics?.best_score > 0 && <span className="text-xs text-slate-500">/ 1600</span>}
            </div>
            <div className="text-xs text-slate-400 mt-2">
              Target: <span className="font-bold text-slate-300">{user?.target_score || 1450}</span>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800/80 rounded-2xl p-5 hover:border-slate-700 transition-all shadow-md">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Mocks Taken</span>
              <Clipboard className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="flex items-baseline gap-1.5 mt-3">
              <span className="text-3xl font-black text-slate-100">{analytics?.total_mocks || 0}</span>
            </div>
            <div className="text-xs text-slate-400 mt-2">
              Weekly Goal: <span className="font-semibold text-slate-200">1 Full Mock</span>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800/80 rounded-2xl p-5 hover:border-slate-700 transition-all shadow-md">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">XP & Streak</span>
              <Zap className="w-4 h-4 text-amber-500" />
            </div>
            <div className="flex items-baseline gap-3 mt-3">
              <span className="text-3xl font-black text-slate-100">{analytics?.xp_points || 50}</span>
              <span className="text-xs text-slate-400">XP</span>
            </div>
            <div className="text-xs text-amber-400 mt-2 flex items-center gap-1 font-semibold">
              <Smile className="w-3.5 h-3.5 fill-amber-500 text-amber-950" />
              Streak: {analytics?.streak_days || 1} days active
            </div>
          </div>
        </div>

        {/* Dashboard Main Grid Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Left Column (Study plan, Recommendations, Charts) */}
          <div className="lg:col-span-2 space-y-8">
            
            {/* Today's Study Plan */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-md space-y-4">
              <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                <CheckSquare className="w-5 h-5 text-indigo-400" />
                Today's Custom Study Plan
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {analytics?.today_study_plan.map((task: any) => {
                  const isDone = completedTasks.includes(task.id) || task.completed;
                  return (
                    <button
                      key={task.id}
                      onClick={() => toggleTask(task.id)}
                      className={`text-left p-4 rounded-2xl border transition-all duration-200 flex items-start gap-3 ${
                        isDone 
                          ? "bg-slate-950/50 border-slate-800/80 opacity-60" 
                          : "bg-slate-900 border-slate-800 hover:border-slate-700 shadow-sm"
                      }`}
                    >
                      <div className="mt-0.5">
                        {isDone ? (
                          <CheckCircle className="w-4 h-4 text-indigo-400 fill-indigo-950" />
                        ) : (
                          <div className="w-4 h-4 border border-slate-600 rounded" />
                        )}
                      </div>
                      <div className="space-y-1">
                        <p className={`text-xs font-semibold leading-snug ${isDone ? 'line-through text-slate-500' : 'text-slate-200'}`}>
                          {task.task}
                        </p>
                        <span className="inline-block px-2 py-0.5 bg-slate-800 text-[10px] text-slate-400 rounded-md font-medium">
                          {task.duration}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* AI Recommendations */}
            <div className="space-y-4">
              <h2 className="text-xl font-extrabold text-slate-100 flex items-center gap-2">
                <Lightbulb className="w-5 h-5 text-indigo-400" />
                Personalized AI Recommendations
              </h2>
              
              {recommendations.length === 0 ? (
                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center text-slate-400">
                  <Sparkles className="w-8 h-8 text-indigo-500 mx-auto mb-2 animate-pulse" />
                  Complete a mock test to unlock AI recommendations!
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {recommendations.map(rec => (
                    <div key={rec.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col justify-between relative hover:border-slate-700 transition-colors shadow-sm">
                      <button
                        onClick={() => handleDismissRec(rec.id)}
                        className="absolute right-4 top-4 text-slate-500 hover:text-slate-300 transition-colors text-lg"
                      >
                        ×
                      </button>
                      
                      <div className="space-y-3">
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-[10px] font-bold uppercase rounded-md">
                          {rec.type.replace("_", " ")}
                        </div>
                        <h3 className="font-bold text-slate-100 text-base leading-snug">{rec.content.title}</h3>
                        <p className="text-xs text-slate-400 leading-relaxed font-medium">
                          {rec.content.reason || "Generated based on your latest mock test answers."}
                        </p>

                        {rec.type === "practice_set" && (
                          <div className="space-y-2 pt-1">
                            <div className="flex flex-wrap gap-1.5">
                              {rec.content.topics?.slice(0, 2).map((t: string, idx: number) => (
                                <span key={idx} className="px-2 py-0.5 bg-slate-800 text-[10px] text-slate-300 rounded font-semibold border border-slate-700">
                                  {t}
                                </span>
                              ))}
                            </div>
                            <button
                              onClick={() => handleDismissRec(rec.id)}
                              className="mt-2 w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold transition-colors shadow-sm flex items-center justify-center gap-1"
                            >
                              Launch Practice Set <ArrowRight className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}

                        {rec.type === "study_plan" && (
                          <div className="grid grid-cols-2 gap-2 mt-2">
                            {Object.entries(rec.content.days || {}).slice(0, 2).map(([day, val]: any) => (
                              <div key={day} className="p-2.5 bg-slate-950/60 rounded-xl border border-slate-800">
                                <span className="font-bold text-[10px] text-slate-400">{day}</span>
                                <p className="text-xs text-slate-200 font-semibold mt-0.5 truncate">{val.topic}</p>
                                <span className="text-[9px] text-indigo-400 font-medium">{val.subject}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        {rec.type === "next_test" && (
                          <div className="flex items-start gap-3 mt-2 bg-slate-950/40 p-3 rounded-xl border border-slate-850">
                            <Calendar className="w-5 h-5 text-indigo-400 mt-0.5 flex-shrink-0" />
                            <div className="space-y-1">
                              <p className="text-xs text-slate-200 font-bold">Mock test recommended: {rec.content.recommend_date}</p>
                              <p className="text-[10px] text-slate-500 leading-snug">{rec.content.reason}</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Score Progression Trend Chart */}
            {trendData.length > 0 && (
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-md space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-slate-100">Score Progression & Prediction</h2>
                    <p className="text-slate-400 text-xs mt-0.5">Historical mock exams mapped alongside target trajectory.</p>
                  </div>
                  <div className="text-xs bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 font-bold px-2 py-1 rounded">
                    Confidence: High
                  </div>
                </div>
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={analytics?.prediction_graph || trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
                      <XAxis dataKey="mock" stroke="#64748b" fontSize={11} tickLine={false} />
                      <YAxis domain={[400, 1600]} stroke="#64748b" fontSize={11} tickLine={false} />
                      <Tooltip contentStyle={{ backgroundColor: "#0f172a", border: "1px solid #334155", borderRadius: "12px", color: "#f8fafc" }} />
                      <Line type="monotone" dataKey="score" stroke="#4f46e5" strokeWidth={3.5} activeDot={{ r: 6 }} name="Actual Score" />
                      <Line type="monotone" dataKey="prediction" stroke="#a855f7" strokeWidth={2} strokeDasharray="5 5" name="Predicted Path" />
                      <Line type="monotone" dataKey="target" stroke="#ec4899" strokeWidth={1.5} strokeDasharray="3 3" name="Target Target" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>

          {/* Right Column (Readiness Meter, Weak topics focus, available tests) */}
          <div className="space-y-8">
            
            {/* AI Readiness Meter */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-md text-center space-y-5 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-24 h-24 bg-gradient-to-br from-indigo-500/10 to-transparent rounded-full filter blur-xl" />
              
              <div className="flex items-center justify-between border-b border-slate-850 pb-3">
                <span className="font-bold text-slate-200 text-sm flex items-center gap-1.5">
                  <Brain className="w-4 h-4 text-indigo-400" />
                  AI Readiness Level
                </span>
                <span className="text-[10px] text-emerald-400 font-bold px-2 py-0.5 bg-emerald-500/10 rounded-full border border-emerald-500/20">
                  Target Match
                </span>
              </div>

              {/* Meter Gauge */}
              <div className="relative w-40 h-40 mx-auto flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="40" stroke="#1e293b" strokeWidth="8" fill="transparent" />
                  <circle 
                    cx="50" 
                    cy="50" 
                    r="40" 
                    stroke="url(#indigoGrad)" 
                    strokeWidth="8" 
                    fill="transparent" 
                    strokeDasharray="251.2" 
                    strokeDashoffset={251.2 - (251.2 * (analytics?.readiness_score || 0)) / 100}
                    strokeLinecap="round"
                  />
                  <defs>
                    <linearGradient id="indigoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#6366f1" />
                      <stop offset="100%" stopColor="#ec4899" />
                    </linearGradient>
                  </defs>
                </svg>
                <div className="absolute text-center">
                  <span className="text-3xl font-black text-slate-100">{analytics?.readiness_score || 0}%</span>
                  <p className="text-[9px] text-slate-400 uppercase tracking-widest mt-0.5">Readiness</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-left text-xs bg-slate-950/50 p-4 rounded-2xl border border-slate-850">
                <div className="space-y-1">
                  <span className="text-slate-400 text-[10px] uppercase">Confidence</span>
                  <p className="font-bold text-slate-200">High (88%)</p>
                </div>
                <div className="space-y-1">
                  <span className="text-slate-400 text-[10px] uppercase">Est. Exam Score</span>
                  <p className="font-bold text-indigo-300">{analytics?.total_mocks > 0 ? analytics.score_trend[analytics.score_trend.length - 1] + 40 : 1250} – {analytics?.best_score ? analytics.best_score + 80 : 1390}</p>
                </div>
                <div className="space-y-1 mt-2">
                  <span className="text-slate-400 text-[10px] uppercase">Expected Days</span>
                  <p className="font-bold text-slate-200">22 Days to Target</p>
                </div>
                <div className="space-y-1 mt-2">
                  <span className="text-slate-400 text-[10px] uppercase">Improvement</span>
                  <p className="font-bold text-emerald-400">+{analytics?.improvement_since_last || 40} pts</p>
                </div>
              </div>
            </div>

            {/* Strengths & Weaknesses */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-md space-y-5">
              <h3 className="font-bold text-slate-100 text-sm flex items-center gap-1.5">
                <Award className="w-4.5 h-4.5 text-indigo-400" />
                Concept Mastery Focus
              </h3>
              
              <div className="space-y-4 text-xs">
                {analytics?.weak_topics.length > 0 ? (
                  <div>
                    <span className="text-[10px] text-red-400 font-bold uppercase tracking-wider block mb-2">Growth Opportunities</span>
                    <div className="space-y-2">
                      {analytics.weak_topics.slice(0, 3).map((topic: string) => (
                        <div key={topic} className="flex items-center justify-between p-2.5 bg-red-950/20 border border-red-900/30 rounded-xl">
                          <span className="font-semibold text-red-300 truncate max-w-[150px]">{topic}</span>
                          <span className="px-2 py-0.5 bg-red-900/40 text-[9px] text-red-400 font-extrabold rounded uppercase">
                            Concept Gap
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-slate-400">Complete a mock test to identify weak areas.</p>
                )}

                {trendData.length > 0 && (
                  <div className="pt-2 border-t border-slate-850">
                    <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider block mb-2">Primary Strengths</span>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between p-2.5 bg-emerald-950/15 border border-emerald-900/20 rounded-xl">
                        <span className="font-semibold text-emerald-300">Expression of Ideas</span>
                        <span className="px-2 py-0.5 bg-emerald-900/40 text-[9px] text-emerald-400 font-extrabold rounded uppercase">
                          Strong
                        </span>
                      </div>
                      <div className="flex items-center justify-between p-2.5 bg-emerald-950/15 border border-emerald-900/20 rounded-xl">
                        <span className="font-semibold text-emerald-300">Linear Functions</span>
                        <span className="px-2 py-0.5 bg-emerald-900/40 text-[9px] text-emerald-400 font-extrabold rounded uppercase">
                          Mastered
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Test Catalog */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-md space-y-4">
              <h3 className="font-bold text-slate-100 text-sm flex items-center gap-1.5">
                <Clipboard className="w-4.5 h-4.5 text-indigo-400" />
                Digital SAT Mocks Catalog
              </h3>
              
              {tests.length === 0 ? (
                <p className="text-xs text-slate-400">No mock tests currently scheduled.</p>
              ) : (
                <div className="space-y-3.5">
                  {tests.map(test => (
                    <div key={test.id} className="p-4 bg-slate-950/60 border border-slate-800 rounded-2xl flex flex-col justify-between gap-3.5 hover:border-slate-700 transition-colors">
                      <div>
                        <span className="inline-block px-2 py-0.5 bg-indigo-500/10 text-indigo-400 text-[9px] font-extrabold rounded uppercase mb-1">
                          Full Length Mock
                        </span>
                        <h4 className="font-bold text-slate-200 text-sm">{test.name}</h4>
                        <p className="text-[11px] text-slate-500 mt-1 leading-normal">{test.description}</p>
                      </div>
                      <button
                        onClick={() => handleStartTest(test.id)}
                        className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-md shadow-indigo-500/10 transition-all duration-150 transform hover:-translate-y-0.5"
                      >
                        <PlayCircle className="w-4 h-4 text-white" />
                        Start Mock Test
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            {/* Gamification Achievements / Badges */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-md space-y-4">
              <h3 className="font-bold text-slate-100 text-sm flex items-center gap-1.5">
                <Star className="w-4.5 h-4.5 text-indigo-400" />
                Badges & Achievements
              </h3>
              
              <div className="grid grid-cols-4 gap-3">
                {analytics?.badges?.map((badge: any) => (
                  <div 
                    key={badge.id} 
                    className={`flex flex-col items-center p-2 rounded-xl border text-center transition-all ${
                      badge.unlocked 
                        ? "bg-indigo-950/30 border-indigo-500/30 text-indigo-300" 
                        : "bg-slate-950/20 border-slate-850 text-slate-600 opacity-40"
                    }`}
                    title={`${badge.name}: ${badge.desc}`}
                  >
                    <div className="p-1.5 bg-slate-900 rounded-full mb-1">
                      {badge.icon === "Trophy" && <Trophy className="w-4 h-4 text-yellow-500" />}
                      {badge.icon === "Zap" && <Zap className="w-4 h-4 text-amber-500" />}
                      {badge.icon === "Award" && <Award className="w-4 h-4 text-indigo-400" />}
                      {badge.icon === "Star" && <Star className="w-4 h-4 text-pink-400" />}
                    </div>
                    <span className="text-[8px] font-bold truncate max-w-[60px]">{badge.name}</span>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>

        {/* Adaptive Learning Path Map */}
        {analytics?.adaptive_learning_path?.length > 0 && (
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-md space-y-5">
            <h2 className="text-lg font-bold text-slate-100 flex items-center gap-1.5">
              <Compass className="w-5 h-5 text-indigo-400" />
              Your Adaptive Learning Roadmap (Score Target: {user?.target_score || 1450})
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 relative">
              {analytics.adaptive_learning_path.map((step: any, idx: number) => (
                <div key={idx} className={`p-4 rounded-2xl border flex flex-col justify-between gap-2 relative ${
                  step.status === "completed" 
                    ? "bg-slate-950/60 border-slate-800 text-slate-400" 
                    : step.status === "current"
                    ? "bg-indigo-950/40 border-indigo-500/40 text-slate-100 ring-2 ring-indigo-500/20"
                    : "bg-slate-900 border-slate-850 text-slate-400 opacity-60"
                }`}>
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-widest">{step.week}</span>
                      {step.status === "completed" && <CheckCircle className="w-3.5 h-3.5 text-indigo-500" />}
                      {step.status === "current" && <span className="w-2 h-2 bg-indigo-400 rounded-full animate-ping" />}
                    </div>
                    <h4 className="font-extrabold text-sm text-slate-200 mt-2">{step.topic}</h4>
                    <p className="text-[11px] text-slate-500 leading-snug mt-1">{step.goal}</p>
                  </div>
                  <span className={`self-start text-[8px] font-bold px-2 py-0.5 rounded-full uppercase mt-2 ${
                    step.status === "completed" 
                      ? "bg-slate-800 text-slate-400" 
                      : step.status === "current"
                      ? "bg-indigo-500/20 text-indigo-300"
                      : "bg-slate-950 text-slate-600"
                  }`}>
                    {step.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

      </main>

      {/* Floating AI Study Coach Button */}
      <button
        onClick={() => setIsCoachOpen(true)}
        className="fixed bottom-6 right-6 p-4 bg-gradient-to-tr from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-full shadow-2xl shadow-indigo-500/30 flex items-center justify-center hover:scale-105 active:scale-95 transition-all duration-150 z-40 border border-indigo-400/20"
      >
        <MessageSquare className="w-6 h-6 text-white" />
        <span className="absolute -top-1 -right-1 w-3 h-3 bg-pink-500 rounded-full border-2 border-slate-900 animate-ping" />
      </button>

      {/* AI Study Coach Drawer Panel */}
      {isCoachOpen && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 transition-opacity flex justify-end">
          <div className="w-full max-w-md bg-slate-900 border-l border-slate-800 h-full flex flex-col justify-between shadow-2xl relative animate-slide-in">
            {/* Coach Header */}
            <div className="bg-slate-950/60 border-b border-slate-850 p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center shadow-md">
                  <Brain className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-100 text-sm">AI Study Coach</h3>
                  <p className="text-[10px] text-indigo-400 font-semibold">Active SAT Diagnostic Analyzer</p>
                </div>
              </div>
              <button
                onClick={() => setIsCoachOpen(false)}
                className="text-slate-500 hover:text-slate-200 text-2xl transition-colors font-bold pr-2"
              >
                ×
              </button>
            </div>

            {/* Coach Chat Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-950/20">
              {chatMessages.map((msg, idx) => (
                <div 
                  key={idx} 
                  className={`flex ${msg.sender === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div className={`p-3.5 rounded-2xl max-w-[85%] text-xs leading-relaxed ${
                    msg.sender === "user" 
                      ? "bg-indigo-600 text-white rounded-br-none" 
                      : "bg-slate-800/80 text-slate-200 rounded-bl-none border border-slate-750"
                  }`}>
                    {msg.text}
                  </div>
                </div>
              ))}
              {coachLoading && (
                <div className="flex justify-start">
                  <div className="p-3 bg-slate-800/60 border border-slate-750 rounded-2xl rounded-bl-none flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
                    <span className="text-[10px] text-slate-400 font-medium">Analyzing learning metrics...</span>
                  </div>
                </div>
              )}
            </div>

            {/* Chat Preset Shortcuts */}
            <div className="p-3 bg-slate-900 border-t border-slate-850 space-y-2">
              <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider block">Quick Questions</span>
              <div className="flex flex-wrap gap-1.5">
                {[
                  "What should I study today?",
                  "Can I reach my target score?",
                  "Why is my score dropping?",
                  "What should I revise before the next mock?"
                ].map((txt) => (
                  <button
                    key={txt}
                    onClick={() => sendCoachMessage(txt)}
                    className="px-2.5 py-1 bg-slate-950 hover:bg-slate-800 text-[10px] text-slate-300 font-semibold rounded-lg border border-slate-800 transition-colors text-left"
                  >
                    {txt}
                  </button>
                ))}
              </div>
            </div>

            {/* Coach Input Box */}
            <div className="p-4 bg-slate-950/80 border-t border-slate-850 flex items-center gap-3">
              <input
                type="text"
                value={coachInput}
                onChange={(e) => setCoachInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") sendCoachMessage(coachInput); }}
                placeholder="Ask me anything about your score..."
                className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 placeholder-slate-600 font-medium"
              />
              <button
                onClick={() => sendCoachMessage(coachInput)}
                className="p-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl shadow-lg transition-colors flex items-center justify-center"
              >
                <Send className="w-4 h-4 text-white" />
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};

export default Dashboard;
