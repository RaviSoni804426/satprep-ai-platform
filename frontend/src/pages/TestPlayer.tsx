import React, { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "../services/api";
import Timer from "../components/Timer";
import Calculator from "../components/Calculator";
import FormulaSheet from "../components/FormulaSheet";
import { ChevronLeft, ChevronRight, Flag, Calculator as CalcIcon, FileSpreadsheet, Loader2 } from "lucide-react";

const TestPlayer: React.FC = () => {
  const { session_id } = useParams<{ session_id: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [currentModuleNo, setCurrentModuleNo] = useState(1);
  const [subject, setSubject] = useState("reading");
  const [difficulty, setDifficulty] = useState("standard");
  const [timeRemaining, setTimeRemaining] = useState(1800);
  const [questions, setQuestions] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  // Answers & Flags maps
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [flagged, setFlagged] = useState<string[]>([]);
  
  // Modals state
  const [isCalcOpen, setIsCalcOpen] = useState(false);
  const [isFormulaOpen, setIsFormulaOpen] = useState(false);
  
  // Highlight selections (Reading only)
  const [highlights, setHighlights] = useState<string[]>([]);


  const autoSaveIntervalRef = useRef<any>(null);
  const answersRef = useRef(answers);
  const flaggedRef = useRef(flagged);
  const timeRemainingRef = useRef(timeRemaining);

  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);

  useEffect(() => {
    flaggedRef.current = flagged;
  }, [flagged]);

  useEffect(() => {
    timeRemainingRef.current = timeRemaining;
  }, [timeRemaining]);

  const loadSessionState = async () => {
    if (!session_id) return;
    try {
      setLoading(true);
      const data = await api.tests.resume(session_id);
      
      setCurrentModuleNo(data.current_module);
      setTimeRemaining(data.time_remaining);
      setAnswers(data.answers || {});
      setFlagged(data.flagged || []);
      setQuestions(data.questions || []);
      setCurrentIndex(0);
      
      // Determine subject/difficulty based on module number
      if (data.current_module <= 2) {
        setSubject("reading");
      } else {
        setSubject("math");
      }
    } catch (err: any) {
      console.error(err);
      alert("Failed to load test session. Returning to dashboard.");
      navigate("/dashboard");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSessionState();
    
    // Set up Auto Save every 30 seconds
    autoSaveIntervalRef.current = setInterval(() => {
      saveProgress();
    }, 30000);

    return () => {
      if (autoSaveIntervalRef.current) {
        clearInterval(autoSaveIntervalRef.current);
      }
      // Save one final time on unmount
      saveProgress();
    };
  }, [session_id]);

  const saveProgress = async () => {
    if (!session_id) return;
    try {
      await api.tests.saveAnswers(session_id, {
        answers: answersRef.current,
        flagged: flaggedRef.current,
        time_remaining: timeRemainingRef.current
      });
    } catch (err) {
      console.error("Autosave failed:", err);
    }
  };

  const handleTick = (remaining: number) => {
    setTimeRemaining(remaining);
  };

  const handleTimeUp = () => {
    alert("Time is up! Submitting module automatically.");
    handleSubmitModule(true);
  };

  const toggleFlag = (qId: string) => {
    setFlagged(prev =>
      prev.includes(qId) ? prev.filter(id => id !== qId) : [...prev, qId]
    );
  };

  const selectOption = (qId: string, option: string) => {
    setAnswers(prev => ({
      ...prev,
      [qId]: option
    }));
  };

  const handleTextHighlight = () => {
    const selection = window.getSelection()?.toString().trim();
    if (selection && selection.length > 3) {
      setHighlights(prev => [...prev, selection]);
    }
  };

  const clearHighlights = () => {
    setHighlights([]);
  };

  const renderTextWithHighlights = (text: string) => {
    if (!text) return "";
    let highlighted = text;
    highlights.forEach(phrase => {
      if (!phrase) return;
      try {
        const escaped = phrase.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
        const regex = new RegExp(`(${escaped})`, 'gi');
        highlighted = highlighted.replace(regex, '<mark class="bg-yellow-200 text-gray-900 px-0.5 rounded">$1</mark>');
      } catch (err) {
        // ignore
      }
    });
    return highlighted;
  };

  const handleSubmitModule = async (force = false) => {
    if (!session_id) return;
    if (!force && !window.confirm("Are you sure you want to submit this module? You cannot return to it.")) {
      return;
    }
    
    try {
      setLoading(true);
      await saveProgress();
      
      const data = await api.tests.submitModule(session_id, currentModuleNo);
      
      if (data.next_module) {
        // Load next module questions
        setCurrentModuleNo(data.next_module.module_no);
        setTimeRemaining(data.next_module.time_limit_seconds);
        setAnswers({});
        setFlagged([]);
        setQuestions(data.next_module.questions || []);
        setSubject(data.next_module.subject);
        setDifficulty(data.next_module.difficulty);
        setCurrentIndex(0);
        setHighlights([]);
      } else {
        // Complete the test session
        await api.tests.submitTest(session_id);
        localStorage.removeItem("active_session_id");
        navigate(`/sessions/${session_id}/score`);
      }
    } catch (err: any) {
      alert(err.message || "Failed to submit module");
    } finally {
      setLoading(false);
    }
  };

  if (loading && questions.length === 0) {
    return (
      <div className="flex-grow flex items-center justify-center bg-slate-50 min-h-screen">
        <div className="text-center space-y-2">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
          <p className="text-gray-500 font-medium">Preparing test environment...</p>
        </div>
      </div>
    );
  }

  const currentQuestion = questions[currentIndex];
  if (!currentQuestion) return null;

  const isAnswered = (qId: string) => !!answers[qId];
  const isFlagged = (qId: string) => flagged.includes(qId);
  const isSPR = !currentQuestion.option_a && !currentQuestion.option_b; // Math student produced response

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between">
      {/* Top Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between sticky top-0 z-30 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="font-bold text-gray-900">Digital SAT Mock #1</span>
          <span className="px-2.5 py-1 bg-primary bg-opacity-10 text-primary text-xs font-bold rounded-lg uppercase">
            Section: {subject.toUpperCase()} ({difficulty})
          </span>
        </div>

        {/* Timer */}
        <Timer initialSeconds={timeRemaining} onTimeUp={handleTimeUp} onTick={handleTick} />

        {/* Tools bar */}
        <div className="flex items-center gap-2">
          {subject === "math" && (
            <>
              <button
                onClick={() => setIsCalcOpen(true)}
                className="px-3.5 py-2 bg-gray-50 hover:bg-gray-100 text-gray-600 rounded-xl border border-gray-200 font-semibold text-sm flex items-center gap-1.5 transition-colors"
              >
                <CalcIcon className="w-4 h-4 text-gray-500" />
                Calculator
              </button>
              <button
                onClick={() => setIsFormulaOpen(true)}
                className="px-3.5 py-2 bg-gray-50 hover:bg-gray-100 text-gray-600 rounded-xl border border-gray-200 font-semibold text-sm flex items-center gap-1.5 transition-colors"
              >
                <FileSpreadsheet className="w-4 h-4 text-gray-500" />
                Formulas
              </button>
            </>
          )}
          {subject === "reading" && (
            <button
              onClick={clearHighlights}
              className="px-3 py-2 bg-gray-50 hover:bg-gray-100 text-xs font-semibold text-gray-500 rounded-xl border border-gray-200 transition-colors"
            >
              Clear Highlights
            </button>
          )}
        </div>
      </header>

      {/* Main Question Panel */}
      <main className="flex-1 flex overflow-hidden p-6 max-w-7xl mx-auto w-full gap-6">
        {subject === "reading" ? (
          // Split Screen for Reading
          <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-6 h-[70vh]">
            {/* Passage Side */}
            <div className="premium-card p-6 overflow-y-auto bg-white border border-gray-200 flex flex-col justify-between">
              <div>
                <h3 className="font-bold text-gray-900 border-b border-gray-100 pb-2 mb-4">Passage</h3>
                <div
                  onMouseUp={handleTextHighlight}
                  className="font-passage text-gray-800 text-base leading-relaxed select-text space-y-4"
                >
                  {/* Process passage text to highlight */}
                  {highlights.length > 0 ? (
                    <p dangerouslySetInnerHTML={{
                      __html: renderTextWithHighlights(currentQuestion.body.split("\n\n")[0] || currentQuestion.body)
                    }} />
                  ) : (
                    <p>
                      {currentQuestion.body.split("\n\n")[0] || currentQuestion.body}
                    </p>
                  )}
                </div>
              </div>
              <div className="mt-4 text-xs text-gray-400">
                💡 Drag select text to highlight parts of the passage.
              </div>
            </div>

            {/* Question Side */}
            <div className="premium-card p-6 overflow-y-auto bg-white border border-gray-200 flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-center mb-4">
                  <span className="font-bold text-gray-500 text-sm">Question {currentIndex + 1} of {questions.length}</span>
                  <button
                    onClick={() => toggleFlag(currentQuestion.id)}
                    className={`flex items-center gap-1 text-sm font-semibold py-1.5 px-3 rounded-lg border ${
                      isFlagged(currentQuestion.id)
                        ? "bg-amber-50 border-amber-200 text-amber-600"
                        : "bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100"
                    } transition-colors`}
                  >
                    <Flag className={`w-4 h-4 ${isFlagged(currentQuestion.id) ? "fill-amber-500 text-amber-500" : ""}`} />
                    Flag
                  </button>
                </div>
                
                <p className="text-gray-800 font-semibold mb-6">
                  {currentQuestion.body.split("\n\n")[1] || "Which choice best describes the main purpose of the passage?"}
                </p>

                {/* Multiple choice options */}
                <div className="space-y-3">
                  {["A", "B", "C", "D"].map(opt => {
                    const optKey = `option_${opt.toLowerCase()}` as "option_a" | "option_b" | "option_c" | "option_d";
                    const isSelected = answers[currentQuestion.id] === opt;
                    return (
                      <button
                        key={opt}
                        onClick={() => selectOption(currentQuestion.id, opt)}
                        className={`w-full text-left p-4 rounded-xl border flex items-start gap-3 transition-colors ${
                          isSelected
                            ? "bg-blue-50 border-primary text-primary font-semibold"
                            : "bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100"
                        }`}
                      >
                        <span className={`w-6 h-6 rounded-full border flex items-center justify-center text-xs font-bold ${
                          isSelected ? "bg-primary text-white border-primary" : "bg-white border-gray-300 text-gray-500"
                        }`}>
                          {opt}
                        </span>
                        <span className="flex-1 text-sm">{currentQuestion[optKey]}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        ) : (
          // Full Width Panel for Math
          <div className="flex-1 flex flex-col md:flex-row gap-6 h-[70vh]">
            <div className="flex-1 premium-card p-6 overflow-y-auto bg-white border border-gray-200 flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-center mb-4">
                  <span className="font-bold text-gray-500 text-sm">Question {currentIndex + 1} of {questions.length}</span>
                  <button
                    onClick={() => toggleFlag(currentQuestion.id)}
                    className={`flex items-center gap-1 text-sm font-semibold py-1.5 px-3 rounded-lg border ${
                      isFlagged(currentQuestion.id)
                        ? "bg-amber-50 border-amber-200 text-amber-600"
                        : "bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100"
                    } transition-colors`}
                  >
                    <Flag className={`w-4 h-4 ${isFlagged(currentQuestion.id) ? "fill-amber-500 text-amber-500" : ""}`} />
                    Flag
                  </button>
                </div>

                <div className="text-gray-800 text-base font-semibold leading-relaxed mb-8">
                  {currentQuestion.body}
                </div>

                {isSPR ? (
                  // Student Produced Response numeric input box
                  <div className="max-w-xs space-y-2">
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider">Your Answer (Number or Fraction)</label>
                    <input
                      type="text"
                      value={answers[currentQuestion.id] || ""}
                      onChange={e => selectOption(currentQuestion.id, e.target.value)}
                      placeholder="e.g. 12.5 or 3/4"
                      className="w-full bg-gray-50 border border-gray-200 px-4 py-3 rounded-xl focus:outline-none focus:border-primary font-semibold text-lg"
                    />
                  </div>
                ) : (
                  // Multiple choice math questions
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {["A", "B", "C", "D"].map(opt => {
                      const optKey = `option_${opt.toLowerCase()}` as "option_a" | "option_b" | "option_c" | "option_d";
                      const isSelected = answers[currentQuestion.id] === opt;
                      return (
                        <button
                          key={opt}
                          onClick={() => selectOption(currentQuestion.id, opt)}
                          className={`w-full text-left p-4 rounded-xl border flex items-start gap-3 transition-colors ${
                            isSelected
                              ? "bg-blue-50 border-primary text-primary font-semibold"
                              : "bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100"
                          }`}
                        >
                          <span className={`w-6 h-6 rounded-full border flex items-center justify-center text-xs font-bold ${
                            isSelected ? "bg-primary text-white border-primary" : "bg-white border-gray-300 text-gray-500"
                          }`}>
                            {opt}
                          </span>
                          <span className="flex-1 text-sm font-semibold">{currentQuestion[optKey]}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer Navigation Bar */}
      <footer className="bg-white border-t border-gray-200 px-6 py-4 sticky bottom-0 z-30 shadow-md">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex gap-2">
            <button
              onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
              disabled={currentIndex === 0}
              className="px-4 py-2 border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 flex items-center gap-1 font-semibold text-sm disabled:opacity-50 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              Previous
            </button>
            <button
              onClick={() => setCurrentIndex(prev => Math.min(questions.length - 1, prev + 1))}
              disabled={currentIndex === questions.length - 1}
              className="px-4 py-2 border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 flex items-center gap-1 font-semibold text-sm disabled:opacity-50 transition-colors"
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Question Navigator Grid */}
          <div className="flex flex-wrap gap-1.5 justify-center max-w-lg md:max-w-xl">
            {questions.map((q, idx) => {
              const answered = isAnswered(q.id);
              const flaggedQ = isFlagged(q.id);
              const isCurrent = idx === currentIndex;
              
              return (
                <button
                  key={q.id}
                  onClick={() => setCurrentIndex(idx)}
                  className={`w-8 h-8 rounded-lg text-xs font-bold border transition-all flex items-center justify-center relative ${
                    isCurrent
                      ? "ring-2 ring-primary bg-primary text-white border-primary"
                      : answered
                      ? "bg-slate-100 border-slate-300 text-slate-700"
                      : "bg-white border-gray-200 text-gray-400 hover:bg-gray-50"
                  }`}
                >
                  {idx + 1}
                  {flaggedQ && (
                    <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-amber-500 rounded-full border border-white" />
                  )}
                </button>
              );
            })}
          </div>

          <button
            onClick={() => handleSubmitModule(false)}
            className="px-5 py-2 bg-gray-900 hover:bg-black text-white font-bold rounded-xl text-sm shadow-sm transition-all"
          >
            Submit Module
          </button>
        </div>
      </footer>

      {/* Floating Modals */}
      <Calculator isOpen={isCalcOpen} onClose={() => setIsCalcOpen(false)} />
      <FormulaSheet isOpen={isFormulaOpen} onClose={() => setIsFormulaOpen(false)} />
    </div>
  );
};

export default TestPlayer;
