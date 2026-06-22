import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "../services/api";
import { 
  ChevronLeft, CheckCircle2, XCircle, AlertCircle, Clock, Tag, Home, 
  HelpCircle, Sparkles, BookOpen, AlertTriangle, ArrowRight, BarChart2, Check, Loader2
} from "lucide-react";

const AnswerReview: React.FC = () => {
  const { session_id } = useParams<{ session_id: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [review, setReview] = useState<any[]>([]);
  const [filter, setFilter] = useState<"all" | "correct" | "wrong" | "flagged">("all");
  const [savingMistakes, setSavingMistakes] = useState<Record<string, boolean>>({});
  const [saveSuccess, setSaveSuccess] = useState<Record<string, boolean>>({});

  const fetchReview = async () => {
    if (!session_id) return;
    try {
      setLoading(true);
      const data = await api.tests.review(session_id);
      setReview(data || []);
    } catch (err) {
      console.error(err);
      alert("Failed to load answer review.");
      navigate("/dashboard");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReview();
  }, [session_id]);

  const handleClassifyMistake = async (questionId: string, mistakeType: string) => {
    if (!session_id) return;
    setSavingMistakes(prev => ({ ...prev, [questionId]: true }));
    try {
      await api.tests.saveMistake(session_id, questionId, mistakeType);
      
      // Update local review state
      setReview(prev => 
        prev.map(item => 
          item.question_id === questionId 
            ? { ...item, mistake_type: mistakeType } 
            : item
        )
      );

      // Flash success indicator
      setSaveSuccess(prev => ({ ...prev, [questionId]: true }));
      setTimeout(() => {
        setSaveSuccess(prev => ({ ...prev, [questionId]: false }));
      }, 2000);
    } catch (err) {
      console.error("Failed to save mistake type:", err);
    } finally {
      setSavingMistakes(prev => ({ ...prev, [questionId]: false }));
    }
  };

  if (loading) {
    return (
      <div className="flex-grow flex items-center justify-center bg-slate-950 min-h-screen">
        <div className="text-center space-y-4">
          <Loader2 className="w-12 h-12 animate-spin text-indigo-500 mx-auto" />
          <p className="text-slate-400 font-semibold text-base">Gathering explanation modules...</p>
        </div>
      </div>
    );
  }

  // Apply filters
  const filteredQuestions = review.filter(q => {
    if (filter === "all") return true;
    if (filter === "correct") return q.is_correct === true;
    if (filter === "wrong") return q.is_correct === false || q.selected_option === null;
    if (filter === "flagged") return q.is_flagged === true;
    return true;
  });

  const MISTAKE_TYPES = [
    { value: "concept_error", label: "Concept Error" },
    { value: "calculation_error", label: "Calculation Error" },
    { value: "reading_error", label: "Reading Error" },
    { value: "vocabulary_error", label: "Vocabulary Error" },
    { value: "time_pressure", label: "Time Pressure" },
    { value: "guess", label: "Guess" },
    { value: "careless_mistake", label: "Careless Mistake" },
    { value: "misconception", label: "Misconception" }
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Header */}
      <header className="bg-slate-900 border-b border-slate-800 px-6 py-4 sticky top-0 z-30 shadow-md">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <button
            onClick={() => navigate(`/sessions/${session_id}/score`)}
            className="flex items-center gap-1.5 text-xs font-bold text-slate-450 hover:text-slate-200 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            Back to Score Report
          </button>
          <span className="font-extrabold text-slate-100 text-sm tracking-tight">Smart SAT Review Portal</span>
          <button 
            onClick={() => navigate("/dashboard")} 
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold flex items-center gap-1 border border-slate-750"
          >
            <Home className="w-3.5 h-3.5" />
            Home
          </button>
        </div>
      </header>

      {/* Main Review Section */}
      <main className="max-w-4xl mx-auto px-6 py-10 w-full flex-grow space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-slate-100 tracking-tight flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-indigo-400" />
              Smart Review & Misconception Analysis
            </h1>
            <p className="text-slate-400 text-xs mt-1 leading-normal">
              Review correct answers, trace common misconceptions, and classify your mistakes to update your AI Profile.
            </p>
          </div>

          {/* Filters */}
          <div className="flex gap-1 bg-slate-900 p-1.5 rounded-xl border border-slate-800 text-xs font-semibold self-start">
            <button
              onClick={() => setFilter("all")}
              className={`px-3 py-1.5 rounded-lg transition-colors ${filter === "all" ? "bg-indigo-600 text-white shadow-sm" : "text-slate-400 hover:text-slate-200"}`}
            >
              All ({review.length})
            </button>
            <button
              onClick={() => setFilter("correct")}
              className={`px-3 py-1.5 rounded-lg transition-colors ${filter === "correct" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "text-slate-400 hover:text-slate-200"}`}
            >
              Correct ({review.filter(q => q.is_correct === true).length})
            </button>
            <button
              onClick={() => setFilter("wrong")}
              className={`px-3 py-1.5 rounded-lg transition-colors ${filter === "wrong" ? "bg-rose-500/10 text-rose-450 border border-rose-500/20" : "text-slate-400 hover:text-slate-200"}`}
            >
              Incorrect ({review.filter(q => q.is_correct === false || q.selected_option === null).length})
            </button>
            <button
              onClick={() => setFilter("flagged")}
              className={`px-3 py-1.5 rounded-lg transition-colors ${filter === "flagged" ? "bg-amber-500/10 text-amber-400 border border-amber-500/20" : "text-slate-400 hover:text-slate-200"}`}
            >
              Flagged ({review.filter(q => q.is_flagged === true).length})
            </button>
          </div>
        </div>

        {/* Question List */}
        <div className="space-y-8">
          {filteredQuestions.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 p-12 text-center text-slate-400 rounded-3xl">
              No questions found matching your filter selection.
            </div>
          ) : (
            filteredQuestions.map((item, idx) => {
              const isMCQ = !!item.option_a || !!item.option_b;
              const unanswered = item.selected_option === null;
              
              return (
                <div key={item.question_id} className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-6 hover:border-slate-700/80 transition-colors shadow-lg relative overflow-hidden">
                  
                  {/* Status header */}
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-slate-200 text-sm">Question {idx + 1}</span>
                      <span className="px-2 py-0.5 bg-slate-950 border border-slate-800 text-slate-400 rounded text-[9px] font-bold uppercase">
                        Mod {item.module_no}
                      </span>
                      <span className="px-2 py-0.5 bg-indigo-500/10 border border-indigo-500/20 text-indigo-455 rounded text-[9px] font-bold uppercase">
                        {item.subject}
                      </span>
                      <span className="px-2 py-0.5 bg-purple-500/10 border border-purple-500/20 text-purple-400 rounded text-[9px] font-bold uppercase">
                        Diff Score: {item.difficulty_score || 55}
                      </span>
                    </div>

                    <div className="flex items-center gap-4 text-xs font-semibold">
                      {item.is_flagged && (
                        <span className="flex items-center gap-1 text-amber-400">
                          <AlertTriangle className="w-4 h-4 fill-amber-500/10 text-amber-500" />
                          Flagged
                        </span>
                      )}
                      {unanswered ? (
                        <span className="flex items-center gap-1.5 text-slate-500">
                          <AlertCircle className="w-4 h-4 text-slate-400" />
                          Unanswered
                        </span>
                      ) : item.is_correct ? (
                        <span className="flex items-center gap-1.5 text-emerald-400">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          Correct Answer
                        </span>
                      ) : (
                        <span className="flex items-center gap-1.5 text-rose-400">
                          <XCircle className="w-4 h-4 text-rose-400" />
                          Incorrect
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Body text */}
                  <div className="space-y-4">
                    {item.subject === "reading" ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div className="p-4 bg-slate-950/60 border border-slate-850 rounded-2xl font-serif text-sm leading-relaxed text-slate-350 max-h-52 overflow-y-auto">
                          {item.body.split("\n\n")[0] || item.body}
                        </div>
                        <div className="text-sm font-semibold text-slate-200 leading-normal pt-2">
                          {item.body.split("\n\n")[1] || "Which choice best describes the main purpose of the passage?"}
                        </div>
                      </div>
                    ) : (
                      <div className="text-sm font-semibold text-slate-200 leading-relaxed bg-slate-950/20 p-4 rounded-xl border border-slate-850">
                        {item.body}
                      </div>
                    )}
                  </div>

                  {/* Response display */}
                  {isMCQ ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {["A", "B", "C", "D"].map(opt => {
                        const optKey = `option_${opt.toLowerCase()}`;
                        const isCorrectOpt = item.correct_option === opt;
                        const isSelectedOpt = item.selected_option === opt;
                        
                        let borderStyle = "border-slate-800 bg-slate-950/30 text-slate-400";
                        if (isCorrectOpt) {
                          borderStyle = "border-emerald-500/40 bg-emerald-500/5 text-emerald-300 font-semibold";
                        } else if (isSelectedOpt && !item.is_correct) {
                          borderStyle = "border-rose-500/40 bg-rose-500/5 text-rose-350 font-semibold";
                        }

                        return (
                          <div key={opt} className={`p-4 rounded-xl border flex items-start gap-3 transition-all ${borderStyle}`}>
                            <span className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-extrabold flex-shrink-0 ${
                              isCorrectOpt 
                                ? "bg-emerald-500 text-slate-950" 
                                : isSelectedOpt 
                                ? "bg-rose-500 text-slate-950" 
                                : "bg-slate-900 border border-slate-700 text-slate-400"
                            }`}>
                              {opt}
                            </span>
                            <span className="text-xs sm:text-sm leading-relaxed">{item[optKey]}</span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="p-4 rounded-2xl bg-slate-950/40 border border-slate-850 flex flex-col md:flex-row md:items-center gap-4 justify-between">
                      <div className="space-y-1">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Your Inputted Answer</span>
                        <div className={`text-lg font-black ${item.is_correct ? "text-emerald-400" : "text-rose-400"}`}>
                          {item.selected_option || "—"}
                        </div>
                      </div>
                      
                      <div className="space-y-1">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Target Correct Answer</span>
                        <div className="text-lg font-black text-emerald-400">
                          {item.correct_option}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Smart Explanation & Misconception Analysis Card */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Explanation */}
                    {item.explanation && (
                      <div className="p-4.5 bg-indigo-500/5 border border-indigo-500/10 rounded-2xl space-y-2">
                        <h4 className="font-extrabold text-indigo-400 text-xs flex items-center gap-1.5">
                          <BookOpen className="w-4 h-4" />
                          Explanation & Walkthrough
                        </h4>
                        <p className="text-xs text-slate-350 leading-relaxed">{item.explanation}</p>
                      </div>
                    )}

                    {/* Misconception Alert */}
                    <div className="p-4.5 bg-purple-500/5 border border-purple-500/10 rounded-2xl space-y-2">
                      <h4 className="font-extrabold text-purple-400 text-xs flex items-center gap-1.5">
                        <AlertTriangle className="w-4 h-4 text-purple-400" />
                        Common Misconception
                      </h4>
                      <p className="text-xs text-slate-350 leading-relaxed">
                        {item.common_misconception}
                      </p>
                      <div className="pt-1.5 border-t border-purple-500/10 flex items-center justify-between text-[10px]">
                        <span className="text-slate-500 font-semibold">Related Concept:</span>
                        <span className="font-bold text-purple-300">{item.related_concept}</span>
                      </div>
                    </div>
                  </div>

                  {/* Adaptive Action CTA */}
                  <div className="flex flex-col md:flex-row items-center justify-between gap-4 p-4 bg-slate-950/60 border border-slate-850 rounded-2xl">
                    <div className="flex items-center gap-3 text-xs font-semibold w-full md:w-auto">
                      <div className="p-2 bg-indigo-500/10 rounded-xl">
                        <BarChart2 className="w-4 h-4 text-indigo-400" />
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 block uppercase">Concept Mastery</span>
                        <div className="flex items-center gap-2">
                          <div className="w-24 bg-slate-800 h-1.5 rounded-full overflow-hidden">
                            <div 
                              className={`h-full rounded-full ${item.is_correct ? 'bg-emerald-500' : 'bg-rose-500'}`} 
                              style={{ width: `${item.estimated_mastery}%` }}
                            />
                          </div>
                          <span className="font-bold text-slate-300">{item.estimated_mastery}%</span>
                        </div>
                      </div>
                    </div>

                    <div className="text-xs text-slate-400 flex items-center gap-1.5 w-full md:w-auto">
                      <span className="text-[10px] text-slate-500 uppercase block md:inline">Suggested Practice:</span>
                      <span className="font-bold text-indigo-300 flex items-center gap-1">
                        {item.suggested_next_practice}
                        <ArrowRight className="w-3.5 h-3.5" />
                      </span>
                    </div>
                  </div>

                  {/* Smart Mistake Self-Classification Dropdown */}
                  {!item.is_correct && (
                    <div className="pt-4 border-t border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                      <div className="space-y-1">
                        <span className="font-bold text-slate-300 flex items-center gap-1">
                          <HelpCircle className="w-4 h-4 text-indigo-400" />
                          Why did you get this wrong?
                        </span>
                        <p className="text-[11px] text-slate-500">
                          Classifying your error calibrates future AI study suggestions.
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <select
                          value={item.mistake_type || ""}
                          onChange={(e) => handleClassifyMistake(item.question_id, e.target.value)}
                          className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-xs font-semibold text-slate-300 focus:outline-none focus:border-indigo-500 w-44"
                        >
                          <option value="">-- Classify Mistake --</option>
                          {MISTAKE_TYPES.map(m => (
                            <option key={m.value} value={m.value}>{m.label}</option>
                          ))}
                        </select>
                        {savingMistakes[item.question_id] && (
                          <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
                        )}
                        {saveSuccess[item.question_id] && (
                          <span className="flex items-center gap-0.5 text-emerald-400 font-bold">
                            <Check className="w-3.5 h-3.5" />
                            Saved
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Metadata footer */}
                  <div className="flex items-center gap-4 text-[10px] text-slate-500 font-bold pt-1.5 border-t border-slate-850">
                    <div className="flex items-center gap-1">
                      <Tag className="w-3.5 h-3.5" />
                      Domain: {item.topic_name}
                    </div>
                    {item.time_taken_seconds !== null && (
                      <div className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        Time Taken: {item.time_taken_seconds}s
                      </div>
                    )}
                  </div>

                </div>
              );
            })
          )}
        </div>
      </main>
    </div>
  );
};

export default AnswerReview;
