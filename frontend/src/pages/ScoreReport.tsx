import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "../services/api";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { BookOpen, Trophy, Sparkles, AlertTriangle, ArrowRight, Home, FileText, Loader2 } from "lucide-react";

const ScoreReport: React.FC = () => {
  const { session_id } = useParams<{ session_id: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [score, setScore] = useState<any>(null);
  const [pollCount, setPollCount] = useState(0);

  const fetchScore = async () => {
    if (!session_id) return;
    try {
      const data = await api.tests.getScore(session_id);
      if (data._status === 202) {
        // Processing, trigger reload after 2s
        setPollCount(prev => prev + 1);
      } else {
        setScore(data);
        setLoading(false);
      }
    } catch (err: any) {
      console.error(err);
      if (err.message === "SCORE_PROCESSING") {
        setPollCount(prev => prev + 1);
      } else {
        alert("Failed to load score report.");
        navigate("/dashboard");
      }
    }
  };

  useEffect(() => {
    fetchScore();
  }, [session_id]);

  // Handle polling for score processing
  useEffect(() => {
    if (pollCount > 0 && loading) {
      const timer = setTimeout(() => {
        fetchScore();
      }, 2000); // Poll every 2 seconds
      return () => clearTimeout(timer);
    }
  }, [pollCount, loading]);

  if (loading) {
    return (
      <div className="flex-grow flex items-center justify-center bg-slate-50 min-h-screen">
        <div className="text-center space-y-4 max-w-sm p-8 bg-white border border-gray-150 rounded-2xl shadow-sm">
          <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto" />
          <h2 className="text-xl font-bold text-gray-900">Calculating your score...</h2>
          <p className="text-gray-500 text-sm">
            Our scoring engine is processing your answers, mapping to scaled SAT curves, and running AI recommendations.
          </p>
        </div>
      </div>
    );
  }

  if (!score) return null;

  // Prepare skill breakdown data for Recharts
  const skillData = Object.entries(score.skill_breakdown || {}).map(([skill, val]: any) => ({
    skill: skill.replace("_", " "),
    Mastery: val
  }));

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col print:bg-white">
      {/* Top Header */}
      <header className="bg-white border-b border-gray-100 px-6 py-4 sticky top-0 z-30 shadow-sm print:hidden">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BookOpen className="w-6 h-6 text-primary" />
            <span className="text-lg font-bold text-gray-900">SATPrep AI Score Portal</span>
          </div>
          <button onClick={() => navigate("/dashboard")} className="premium-btn-secondary py-2 px-3 text-xs">
            <Home className="w-4 h-4" />
            Dashboard
          </button>
        </div>
      </header>

      {/* Main Score Report Card */}
      <main className="max-w-4xl mx-auto px-6 py-10 w-full flex-1 space-y-8 print:p-0">
        <div className="text-center space-y-2 print:text-left print:mb-6">
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">SAT Mock Test Score Report</h1>
          <p className="text-gray-500 text-sm">Generated on {new Date(score.calculated_at).toLocaleDateString()}</p>
        </div>

        {/* Score Display Card */}
        <div className="premium-card bg-white p-8 border border-gray-200 relative overflow-hidden">
          <div className="absolute right-0 top-0 w-32 h-32 bg-primary bg-opacity-5 rounded-full translate-x-12 -translate-y-12" />
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-center">
            {/* Total Composite Score */}
            <div className="text-center md:border-r border-gray-100 space-y-2">
              <div className="flex justify-center text-amber-500 mb-1">
                <Trophy className="w-8 h-8 fill-amber-500 bg-opacity-10 bg-amber-100 p-1.5 rounded-full" />
              </div>
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Composite Score</span>
              <div className="text-5xl font-black text-gray-900">{score.total_score}</div>
              <p className="text-xs text-gray-500 font-medium">Confidence Band: {score.band_low} – {score.band_high}</p>
            </div>

            {/* Reading and Math sections */}
            <div className="col-span-2 grid grid-cols-2 gap-4 text-center">
              <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100 space-y-1">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Reading & Writing</span>
                <div className="text-3xl font-bold text-gray-900">{score.reading_scaled}</div>
                <span className="text-xs text-gray-400">Raw: {score.reading_raw} / 54</span>
              </div>
              
              <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100 space-y-1">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Mathematics</span>
                <div className="text-3xl font-bold text-gray-900">{score.math_scaled}</div>
                <span className="text-xs text-gray-400">Raw: {score.math_raw} / 44</span>
              </div>
            </div>
          </div>
        </div>

        {/* Skill breakdown chart */}
        <div className="premium-card bg-white p-6 border border-gray-200 space-y-4">
          <h2 className="text-lg font-bold text-gray-900">Skill Domain Mastery Breakdown</h2>
          <p className="text-xs text-gray-500">Mastery percentages based on correct answers in each topic category.</p>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={skillData} layout="vertical" margin={{ top: 5, right: 10, left: 40, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                <XAxis type="number" domain={[0, 100]} stroke="#94a3b8" fontSize={11} />
                <YAxis dataKey="skill" type="category" stroke="#475569" fontSize={11} width={180} />
                <Tooltip formatter={(value) => [`${value}%`, "Mastery"]} />
                <Bar dataKey="Mastery" fill="#1D4ED8" radius={[0, 4, 4, 0]} barSize={16} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Action CTAs */}
        <div className="flex gap-4 justify-center print:hidden">
          <button
            onClick={() => navigate(`/sessions/${session_id}/review`)}
            className="px-6 py-3 bg-gray-900 hover:bg-black text-white font-bold rounded-xl shadow-sm flex items-center gap-2 transition-all"
          >
            <FileText className="w-5 h-5" />
            Review Correct & Incorrect Answers
          </button>
          <button
            onClick={handlePrint}
            className="premium-btn-secondary px-6 py-3"
          >
            Print / Save PDF Score Report
          </button>
        </div>
      </main>
    </div>
  );
};

export default ScoreReport;
