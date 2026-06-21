import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "../services/api";
import { ChevronLeft, CheckCircle2, XCircle, AlertCircle, Clock, Tag } from "lucide-react";

const AnswerReview: React.FC = () => {
  const { session_id } = useParams<{ session_id: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [review, setReview] = useState<any[]>([]);
  const [filter, setFilter] = useState<"all" | "correct" | "wrong" | "flagged">("all");

  useEffect(() => {
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
    fetchReview();
  }, [session_id]);

  if (loading) {
    return (
      <div className="flex-grow flex items-center justify-center bg-slate-50 min-h-screen">
        <Loader className="w-8 h-8 animate-spin text-primary" />
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

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Top Header */}
      <header className="bg-white border-b border-gray-100 px-6 py-4 sticky top-0 z-30 shadow-sm">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <button
            onClick={() => navigate(`/sessions/${session_id}/score`)}
            className="flex items-center gap-1.5 text-sm font-semibold text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            Back to Score Report
          </button>
          <span className="font-bold text-gray-900">Answer Review Portal</span>
          <button onClick={() => navigate("/dashboard")} className="premium-btn-secondary px-3 py-1.5 text-xs">
            Home
          </button>
        </div>
      </header>

      {/* Main Review Section */}
      <main className="max-w-4xl mx-auto px-6 py-10 w-full flex-grow space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">Mock Test Review</h1>
            <p className="text-gray-500 text-sm mt-0.5">Filter and review each question with detailed explanations.</p>
          </div>

          {/* Filters */}
          <div className="flex gap-1 bg-gray-100 p-1 rounded-xl border border-gray-200 text-xs font-semibold">
            <button
              onClick={() => setFilter("all")}
              className={`px-3 py-1.5 rounded-lg transition-colors ${filter === "all" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
            >
              All ({review.length})
            </button>
            <button
              onClick={() => setFilter("correct")}
              className={`px-3 py-1.5 rounded-lg transition-colors ${filter === "correct" ? "bg-white text-success shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
            >
              Correct ({review.filter(q => q.is_correct === true).length})
            </button>
            <button
              onClick={() => setFilter("wrong")}
              className={`px-3 py-1.5 rounded-lg transition-colors ${filter === "wrong" ? "bg-white text-danger shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
            >
              Incorrect ({review.filter(q => q.is_correct === false || q.selected_option === null).length})
            </button>
            <button
              onClick={() => setFilter("flagged")}
              className={`px-3 py-1.5 rounded-lg transition-colors ${filter === "flagged" ? "bg-white text-warning shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
            >
              Flagged ({review.filter(q => q.is_flagged === true).length})
            </button>
          </div>
        </div>

        {/* Question List */}
        <div className="space-y-6">
          {filteredQuestions.length === 0 ? (
            <div className="premium-card p-12 text-center text-gray-500 bg-white">
              No questions found matching your filter selection.
            </div>
          ) : (
            filteredQuestions.map((item, idx) => {
              const isMCQ = !!item.option_a || !!item.option_b;
              const unanswered = item.selected_option === null;
              
              return (
                <div key={item.question_id} className="premium-card bg-white p-6 border border-gray-200 space-y-6">
                  {/* Status header */}
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-gray-500 text-sm">Question {idx + 1}</span>
                      <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-[10px] font-semibold uppercase">
                        Module {item.module_no}
                      </span>
                      <span className="px-2 py-0.5 bg-blue-50 text-primary rounded text-[10px] font-semibold uppercase">
                        {item.subject}
                      </span>
                    </div>

                    <div className="flex items-center gap-4 text-xs">
                      {item.is_flagged && (
                        <span className="flex items-center gap-1 text-warning font-semibold">
                          <AlertCircle className="w-4 h-4 fill-warning text-white" />
                          Flagged
                        </span>
                      )}
                      {unanswered ? (
                        <span className="flex items-center gap-1 text-gray-500 font-semibold">
                          <AlertCircle className="w-4 h-4 text-gray-400" />
                          Unanswered
                        </span>
                      ) : item.is_correct ? (
                        <span className="flex items-center gap-1 text-success font-semibold">
                          <CheckCircle2 className="w-4 h-4 text-success" />
                          Correct
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-danger font-semibold">
                          <XCircle className="w-4 h-4 text-danger" />
                          Incorrect
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Body text */}
                  <div className="space-y-4">
                    {/* Render passage split if reading module */}
                    {item.subject === "reading" ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 font-passage text-sm leading-relaxed text-gray-700 max-h-48 overflow-y-auto">
                          {item.body.split("\n\n")[0] || item.body}
                        </div>
                        <div className="text-sm font-semibold text-gray-800">
                          {item.body.split("\n\n")[1] || "Which choice best describes the main purpose of the passage?"}
                        </div>
                      </div>
                    ) : (
                      <div className="text-sm font-semibold text-gray-800 leading-relaxed">
                        {item.body}
                      </div>
                    )}
                  </div>

                  {/* Response display */}
                  {isMCQ ? (
                    // MCQ options with color highlights
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {["A", "B", "C", "D"].map(opt => {
                        const optKey = `option_${opt.toLowerCase()}`;
                        const isCorrectOpt = item.correct_option === opt;
                        const isSelectedOpt = item.selected_option === opt;
                        
                        let borderStyle = "border-gray-200 bg-gray-50 text-gray-700";
                        if (isCorrectOpt) {
                          borderStyle = "border-success bg-green-50 text-green-700 font-semibold";
                        } else if (isSelectedOpt && !item.is_correct) {
                          borderStyle = "border-danger bg-red-50 text-red-700 font-semibold";
                        }

                        return (
                          <div key={opt} className={`p-4 rounded-xl border flex items-start gap-3 ${borderStyle}`}>
                            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                              isCorrectOpt ? "bg-success text-white" : isSelectedOpt ? "bg-danger text-white" : "bg-white border border-gray-300 text-gray-500"
                            }`}>
                              {opt}
                            </span>
                            <span className="text-sm flex-1">{item[optKey]}</span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    // SPR Response
                    <div className="p-4 rounded-xl bg-gray-50 border border-gray-100 flex flex-col md:flex-row md:items-center gap-4 justify-between">
                      <div className="space-y-1">
                        <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Your Answer</span>
                        <div className={`text-lg font-bold ${item.is_correct ? "text-success" : "text-danger"}`}>
                          {item.selected_option || "—"}
                        </div>
                      </div>
                      
                      <div className="space-y-1">
                        <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Correct Answer</span>
                        <div className="text-lg font-bold text-success">
                          {item.correct_option}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Explanation card */}
                  {item.explanation && (
                    <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl space-y-1">
                      <h4 className="font-bold text-blue-900 text-sm">Explanation</h4>
                      <p className="text-xs text-blue-800 leading-relaxed">{item.explanation}</p>
                    </div>
                  )}

                  {/* Metadata footer */}
                  <div className="flex items-center gap-4 text-xs text-gray-400 font-semibold pt-1">
                    <div className="flex items-center gap-1">
                      <Tag className="w-3.5 h-3.5" />
                      Topic: {item.topic_name}
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

// Helper for Loader
const Loader: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={`animate-spin ${className}`} fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
  </svg>
);

export default AnswerReview;
