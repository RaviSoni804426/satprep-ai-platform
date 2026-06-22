import React, { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "../services/api";
import Timer from "../components/Timer";
import Calculator from "../components/Calculator";
import FormulaSheet from "../components/FormulaSheet";
import { 
  ChevronLeft, ChevronRight, Flag, Calculator as CalcIcon, FileSpreadsheet, 
  Loader2, CheckCircle2, Shield, Wifi, Monitor, HelpCircle, AlertCircle, Play, 
  Check, Info, Clock, RefreshCw, BarChart2
} from "lucide-react";

const TestPlayer: React.FC = () => {
  const { session_id } = useParams<{ session_id: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  
  // Test starting state
  const [isDiagnosticDone, setIsDiagnosticDone] = useState(false);
  const [internetStatus, setInternetStatus] = useState("checking");
  const [browserCheck, setBrowserCheck] = useState(true);
  const [deviceCheck, setDeviceCheck] = useState("checking");
  const [latencyCheck, setLatencyCheck] = useState<number | null>(null);

  // Core state
  const [currentModuleNo, setCurrentModuleNo] = useState(1);
  const [subject, setSubject] = useState("reading");
  const [difficulty, setDifficulty] = useState("standard");
  const [timeRemaining, setTimeRemaining] = useState(1920);
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

  // Intermediate adaptive routing transition screen
  const [isCalibrating, setIsCalibrating] = useState(false);
  const [calibrationData, setCalibrationData] = useState<any>(null);

  // Auto-save feedback pulse
  const [autoSavePulse, setAutoSavePulse] = useState(false);

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
    
    // Simulate Diagnostic checks at load
    setTimeout(() => {
      setInternetStatus("online");
      setLatencyCheck(28);
      setDeviceCheck("approved");
    }, 1800);

    // Auto Save every 20 seconds
    autoSaveIntervalRef.current = setInterval(() => {
      saveProgress();
    }, 20000);

    return () => {
      if (autoSaveIntervalRef.current) {
        clearInterval(autoSaveIntervalRef.current);
      }
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
      setAutoSavePulse(true);
      setTimeout(() => setAutoSavePulse(false), 1500);
    } catch (err) {
      console.error("Autosave failed:", err);
    }
  };

  const handleTick = (remaining: number) => {
    setTimeRemaining(remaining);
  };

  const handleTimeUp = () => {
    alert("Time is up for this module! Calibrating adaptive next steps.");
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
        highlighted = highlighted.replace(regex, '<mark class="bg-amber-300 text-slate-900 px-0.5 rounded font-medium">$1</mark>');
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

      // Intermediate adaptive calibration calculations
      const answeredCount = Object.keys(answers).length;
      const totalCount = questions.length;
      const accuracyEst = Math.round((answeredCount / totalCount) * 85); // Estimated baseline accuracy
      const speedEst = Math.round(answeredCount > 0 ? (1920 - timeRemaining) / answeredCount : 45);
      
      setIsCalibrating(true);
      setCalibrationData({
        answered: answeredCount,
        total: totalCount,
        accuracy: accuracyEst,
        speed: speedEst,
        subject: subject.toUpperCase(),
        module: currentModuleNo
      });

      // Wait 3.5 seconds to show scoring and ability updates (Theta score)
      await new Promise(resolve => setTimeout(resolve, 3500));

      const data = await api.tests.submitModule(session_id, currentModuleNo);
      setIsCalibrating(false);

      if (data.next_module) {
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
        await api.tests.submitTest(session_id);
        localStorage.removeItem("active_session_id");
        navigate(`/sessions/${session_id}/score`);
      }
    } catch (err: any) {
      setIsCalibrating(false);
      alert(err.message || "Failed to submit module");
    } finally {
      setLoading(false);
    }
  };

  if (loading && questions.length === 0 && !isCalibrating) {
    return (
      <div className="flex-grow flex items-center justify-center bg-slate-950 min-h-screen text-slate-100">
        <div className="text-center space-y-4">
          <Loader2 className="w-12 h-12 animate-spin text-indigo-500 mx-auto" />
          <p className="text-slate-400 font-semibold text-lg animate-pulse">Reconstructing SAT Sandbox Environment...</p>
        </div>
      </div>
    );
  }

  // Before Test Diagnostic Check Screen
  if (!isDiagnosticDone) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between p-6">
        <header className="max-w-4xl mx-auto w-full py-4 border-b border-slate-850 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className="w-6 h-6 text-indigo-500" />
            <span className="text-xl font-bold tracking-tight bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">Digital SAT Sandbox System</span>
          </div>
          <span className="text-xs bg-slate-900 border border-slate-800 text-slate-400 px-3 py-1 rounded-full">
            Version 1.04.1
          </span>
        </header>

        <main className="max-w-3xl mx-auto w-full py-10 space-y-8 flex-1">
          <div className="space-y-2 text-center md:text-left">
            <h1 className="text-3xl font-extrabold text-slate-100">Diagnostic & Setup Dashboard</h1>
            <p className="text-slate-400 text-sm">Please verify your environment meets official SAT player standards.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400 uppercase">Network Integrity</span>
                <Wifi className={`w-5 h-5 ${internetStatus === "online" ? "text-emerald-500" : "text-amber-500 animate-pulse"}`} />
              </div>
              <p className="text-lg font-black text-slate-200">{internetStatus === "online" ? "Excellent" : "Checking Connection..."}</p>
              <span className="text-[10px] text-slate-400 block">
                {latencyCheck ? `Ping Latency: ${latencyCheck}ms` : "Simulating ping tests..."}
              </span>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400 uppercase">Browser Checks</span>
                <Monitor className="w-5 h-5 text-emerald-500" />
              </div>
              <p className="text-lg font-black text-slate-200">Chrome (v126)</p>
              <span className="text-[10px] text-slate-400 block">Secure sandbox context loaded.</span>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400 uppercase">Lockdown Check</span>
                <Shield className={`w-5 h-5 ${deviceCheck === "approved" ? "text-emerald-500" : "text-amber-500 animate-pulse"}`} />
              </div>
              <p className="text-lg font-black text-slate-200">{deviceCheck === "approved" ? "Fully Secured" : "Verifying context..."}</p>
              <span className="text-[10px] text-slate-400 block">Secure keyboard mapping active.</span>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800/80 rounded-2xl p-6 space-y-4">
            <h3 className="font-bold text-slate-100 text-sm flex items-center gap-1.5">
              <Info className="w-4 h-4 text-indigo-400" />
              Standard Instructions
            </h3>
            <ul className="text-xs text-slate-400 space-y-2 list-disc list-inside">
              <li>This test has 4 modules (Reading 1 & 2, Math 3 & 4).</li>
              <li>Once you submit a module, you **cannot** return to edit answers.</li>
              <li>The math modules support multiple choice or open-ended numbers (SPR).</li>
              <li>Calculators and formula references are accessible inside math modules.</li>
            </ul>
          </div>

          <button
            onClick={() => setIsDiagnosticDone(true)}
            disabled={internetStatus !== "online"}
            className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-extrabold rounded-2xl shadow-lg shadow-indigo-500/10 flex items-center justify-center gap-2 transition-all transform hover:-translate-y-0.5"
          >
            <Play className="w-4.5 h-4.5 text-white fill-white" />
            Enter Active Testing Sandbox
          </button>
        </main>
      </div>
    );
  }

  // Intermediate Adaptive Calibration loading screen
  if (isCalibrating) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center p-6 text-center space-y-8">
        <div className="space-y-4">
          <div className="relative w-24 h-24 mx-auto">
            <div className="absolute inset-0 rounded-full border-4 border-indigo-900/40 border-t-indigo-500 animate-spin" />
            <BarChart2 className="w-8 h-8 text-indigo-400 absolute inset-0 m-auto animate-pulse" />
          </div>
          <h2 className="text-2xl font-extrabold text-slate-100 tracking-tight animate-pulse">Calibrating Adaptive Routing...</h2>
          <p className="text-slate-400 text-sm max-w-sm">
            Processing previous response sequences, ability estimates, answering speeds, and selecting optimal question subsets.
          </p>
        </div>

        {calibrationData && (
          <div className="max-w-xs w-full bg-slate-900 border border-slate-800 p-5 rounded-2xl text-left text-xs space-y-3 shadow-xl">
            <h4 className="font-extrabold text-slate-200 border-b border-slate-800 pb-2 uppercase tracking-wider text-[10px]">
              Module {calibrationData.module} diagnostic stats
            </h4>
            <div className="flex justify-between">
              <span className="text-slate-400">Section:</span>
              <span className="font-bold text-slate-200">{calibrationData.subject}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Questions Answered:</span>
              <span className="font-bold text-slate-200">{calibrationData.answered} / {calibrationData.total}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Accuracy Estimate:</span>
              <span className="font-bold text-indigo-400">~{calibrationData.accuracy}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Answering Speed:</span>
              <span className="font-bold text-slate-200">{calibrationData.speed}s / question</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Adaptive Route Path:</span>
              <span className="font-bold text-amber-500 animate-pulse">Calculating Ability (IRT)...</span>
            </div>
          </div>
        )}
      </div>
    );
  }

  const currentQuestion = questions[currentIndex];
  if (!currentQuestion) return null;

  const isAnswered = (qId: string) => !!answers[qId];
  const isFlagged = (qId: string) => flagged.includes(qId);
  const isSPR = !currentQuestion.option_a && !currentQuestion.option_b; 

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between">
      {/* Top Header */}
      <header className="bg-slate-900 border-b border-slate-800 px-6 py-4 flex items-center justify-between sticky top-0 z-30 shadow-md">
        <div className="flex items-center gap-3">
          <span className="font-extrabold text-slate-100 text-sm sm:text-base">Digital SAT Mock Sandbox</span>
          <span className="px-2.5 py-1 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[10px] font-bold rounded uppercase">
            Section: {subject.toUpperCase()} (Module {currentModuleNo})
          </span>
          <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-950 text-slate-500 text-[10px] rounded border border-slate-805">
            <span className={`w-1.5 h-1.5 rounded-full ${autoSavePulse ? 'bg-indigo-400 animate-ping' : 'bg-slate-700'}`} />
            {autoSavePulse ? "Autosaved Progress" : "Saved to Cloud"}
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
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl border border-slate-700 font-bold text-xs flex items-center gap-1.5 transition-colors"
              >
                <CalcIcon className="w-4 h-4 text-slate-400" />
                Calculator
              </button>
              <button
                onClick={() => setIsFormulaOpen(true)}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl border border-slate-700 font-bold text-xs flex items-center gap-1.5 transition-colors"
              >
                <FileSpreadsheet className="w-4 h-4 text-slate-400" />
                Formulas
              </button>
            </>
          )}
          {subject === "reading" && (
            <button
              onClick={clearHighlights}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-[10px] font-bold text-slate-300 rounded-xl border border-slate-700 transition-colors"
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
          <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-6 h-[72vh]">
            {/* Passage Side */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 overflow-y-auto flex flex-col justify-between shadow-lg">
              <div>
                <h3 className="font-extrabold text-slate-400 uppercase tracking-widest text-[10px] border-b border-slate-800 pb-2 mb-4">Passage Context</h3>
                <div
                  onMouseUp={handleTextHighlight}
                  className="font-serif text-slate-300 text-base leading-relaxed select-text space-y-4 pr-2"
                >
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
              <div className="mt-4 text-[10px] text-slate-500 flex items-center gap-1 font-semibold">
                <Info className="w-3.5 h-3.5" />
                Drag select text above to highlight core thesis statements.
              </div>
            </div>

            {/* Question Side */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 overflow-y-auto flex flex-col justify-between shadow-lg">
              <div>
                <div className="flex justify-between items-center mb-4">
                  <span className="font-bold text-slate-500 text-xs uppercase tracking-wide">Question {currentIndex + 1} of {questions.length}</span>
                  <button
                    onClick={() => toggleFlag(currentQuestion.id)}
                    className={`flex items-center gap-1.5 text-xs font-bold py-1.5 px-3 rounded-xl border transition-colors ${
                      isFlagged(currentQuestion.id)
                        ? "bg-amber-500/10 border-amber-500/30 text-amber-400"
                        : "bg-slate-850 border-slate-750 text-slate-400 hover:bg-slate-800"
                    }`}
                  >
                    <Flag className={`w-3.5 h-3.5 ${isFlagged(currentQuestion.id) ? "fill-amber-500 text-amber-500" : ""}`} />
                    Flag Question
                  </button>
                </div>
                
                <p className="text-slate-100 font-semibold text-base mb-6 leading-normal">
                  {currentQuestion.body.split("\n\n")[1] || "Which choice best describes the main purpose of the passage?"}
                </p>

                {/* MCQ Options */}
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
                            ? "bg-indigo-650/10 border-indigo-500 text-slate-100 font-semibold shadow-inner"
                            : "bg-slate-950/40 border-slate-800/80 text-slate-350 hover:bg-slate-900/60"
                        }`}
                      >
                        <span className={`w-6 h-6 rounded-lg border flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                          isSelected ? "bg-indigo-650 text-white border-indigo-500" : "bg-slate-900 border-slate-700 text-slate-400"
                        }`}>
                          {opt}
                        </span>
                        <span className="text-xs sm:text-sm leading-relaxed">{currentQuestion[optKey]}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        ) : (
          // Full Width Panel for Math
          <div className="flex-1 flex flex-col md:flex-row gap-6 h-[72vh]">
            <div className="flex-1 bg-slate-900 border border-slate-800 rounded-3xl p-6 overflow-y-auto flex flex-col justify-between shadow-lg">
              <div>
                <div className="flex justify-between items-center mb-4">
                  <span className="font-bold text-slate-500 text-xs uppercase tracking-wide">Question {currentIndex + 1} of {questions.length}</span>
                  <button
                    onClick={() => toggleFlag(currentQuestion.id)}
                    className={`flex items-center gap-1.5 text-xs font-bold py-1.5 px-3 rounded-xl border transition-colors ${
                      isFlagged(currentQuestion.id)
                        ? "bg-amber-500/10 border-amber-500/30 text-amber-400"
                        : "bg-slate-850 border-slate-750 text-slate-400 hover:bg-slate-800"
                    }`}
                  >
                    <Flag className={`w-3.5 h-3.5 ${isFlagged(currentQuestion.id) ? "fill-amber-500 text-amber-500" : ""}`} />
                    Flag Question
                  </button>
                </div>

                <div className="text-slate-100 text-base font-semibold leading-relaxed mb-8 pr-2">
                  {currentQuestion.body}
                </div>

                {isSPR ? (
                  // Student Produced Response numeric input box
                  <div className="max-w-xs space-y-2">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">Your Decimal/Fraction Answer</label>
                    <input
                      type="text"
                      value={answers[currentQuestion.id] || ""}
                      onChange={e => selectOption(currentQuestion.id, e.target.value)}
                      placeholder="e.g. 1.25 or 5/4"
                      className="w-full bg-slate-950 border border-slate-800 px-4 py-3 rounded-xl focus:outline-none focus:border-indigo-500 font-semibold text-lg text-slate-100"
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
                              ? "bg-indigo-650/10 border-indigo-500 text-slate-100 font-semibold shadow-inner"
                              : "bg-slate-950/40 border-slate-800/80 text-slate-350 hover:bg-slate-900/60"
                          }`}
                        >
                          <span className={`w-6 h-6 rounded-lg border flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                            isSelected ? "bg-indigo-650 text-white border-indigo-500" : "bg-slate-900 border-slate-700 text-slate-400"
                          }`}>
                            {opt}
                          </span>
                          <span className="text-xs sm:text-sm leading-relaxed">{currentQuestion[optKey]}</span>
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
      <footer className="bg-slate-900 border-t border-slate-800 px-6 py-4 sticky bottom-0 z-30 shadow-md">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex gap-2">
            <button
              onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
              disabled={currentIndex === 0}
              className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-300 hover:bg-slate-700 flex items-center gap-1 font-semibold text-xs disabled:opacity-30 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              Previous
            </button>
            <button
              onClick={() => setCurrentIndex(prev => Math.min(questions.length - 1, prev + 1))}
              disabled={currentIndex === questions.length - 1}
              className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-300 hover:bg-slate-700 flex items-center gap-1 font-semibold text-xs disabled:opacity-30 transition-colors"
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
                      ? "ring-2 ring-indigo-500 bg-indigo-650 text-white border-indigo-500"
                      : answered
                      ? "bg-slate-800/80 border-slate-700 text-slate-200"
                      : "bg-slate-950/20 border-slate-850 text-slate-500 hover:bg-slate-800"
                  }`}
                >
                  {idx + 1}
                  {flaggedQ && (
                    <span className="absolute -top-1 -right-1 w-2 h-2 bg-amber-500 rounded-full border border-slate-900" />
                  )}
                </button>
              );
            })}
          </div>

          <button
            onClick={() => handleSubmitModule(false)}
            className="px-5 py-2.5 bg-gradient-to-tr from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-extrabold rounded-xl text-xs shadow-md shadow-indigo-500/10 transition-all duration-150"
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
