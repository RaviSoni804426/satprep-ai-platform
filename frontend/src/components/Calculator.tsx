import React, { useState, useRef, useEffect } from "react";
import { X, ArrowRight, RotateCcw } from "lucide-react";

interface CalculatorProps {
  isOpen: boolean;
  onClose: () => void;
}

const Calculator: React.FC<CalculatorProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<"standard" | "graphing">("standard");
  const [expr, setExpr] = useState("");
  const [result, setResult] = useState("");
  const [graphFunc, setGraphFunc] = useState("x * x"); // default y = x^2
  
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Standard calculator key handlers
  const handleKey = (val: string) => {
    if (val === "C") {
      setExpr("");
      setResult("");
    } else if (val === "⌫") {
      setExpr(prev => prev.slice(0, -1));
    } else if (val === "=") {
      try {
        // Safe evaluation simulation (for mathematical expressions only)
        // Convert symbols
        let formatted = expr
          .replace(/π/g, "Math.PI")
          .replace(/e/g, "Math.E")
          .replace(/sin\(/g, "Math.sin(")
          .replace(/cos\(/g, "Math.cos(")
          .replace(/tan\(/g, "Math.tan(")
          .replace(/sqrt\(/g, "Math.sqrt(")
          .replace(/log\(/g, "Math.log10(")
          .replace(/ln\(/g, "Math.log(")
          .replace(/\^/g, "**");
          
        const evalResult = new Function(`return ${formatted}`)();
        setResult(String(Number(evalResult).toFixed(4)).replace(/\.?0+$/, ""));
      } catch (err) {
        setResult("Error");
      }
    } else {
      setExpr(prev => prev + val);
    }
  };

  // Draw Graph on canvas
  const drawGraph = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // Clear
    ctx.clearRect(0, 0, width, height);

    // Draw grid
    ctx.strokeStyle = "#e2e8f0";
    ctx.lineWidth = 1;

    const scale = 30; // 30 pixels per unit
    const centerX = width / 2;
    const centerY = height / 2;

    // Vertical grid lines
    for (let x = 0; x < width; x += scale) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }

    // Horizontal grid lines
    for (let y = 0; y < height; y += scale) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Draw Axes
    ctx.strokeStyle = "#475569";
    ctx.lineWidth = 2;
    // X-axis
    ctx.beginPath();
    ctx.moveTo(0, centerY);
    ctx.lineTo(width, centerY);
    ctx.stroke();
    // Y-axis
    ctx.beginPath();
    ctx.moveTo(centerX, 0);
    ctx.lineTo(centerX, height);
    ctx.stroke();

    // Plot function
    ctx.strokeStyle = "#1D4ED8";
    ctx.lineWidth = 2.5;
    ctx.beginPath();

    let started = false;
    for (let screenX = 0; screenX < width; screenX++) {
      // Convert screen coordinate to graph x value
      const x = (screenX - centerX) / scale;
      
      try {
        // Safe evaluation of mathematical x expression
        // e.g. "x * x" -> replaces "x" with value
        // Note: we sanitize input to only contain math variables
        const cleanExpr = graphFunc
          .replace(/Math\./g, "")
          .replace(/sin/g, "Math.sin")
          .replace(/cos/g, "Math.cos")
          .replace(/tan/g, "Math.tan")
          .replace(/sqrt/g, "Math.sqrt")
          .replace(/\^/g, "**")
          // Replace stand alone x variable
          .replace(/\bx\b/g, `(${x})`);
          
        const y = new Function(`return ${cleanExpr}`)();
        
        if (typeof y === "number" && !isNaN(y) && isFinite(y)) {
          // Convert graph y value to screen coordinate
          const screenY = centerY - (y * scale);
          
          if (screenY >= 0 && screenY <= height) {
            if (!started) {
              ctx.moveTo(screenX, screenY);
              started = true;
            } else {
              ctx.lineTo(screenX, screenY);
            }
          } else {
            started = false;
          }
        } else {
          started = false;
        }
      } catch (err) {
        // Skip invalid points
        started = false;
      }
    }
    ctx.stroke();
  };

  useEffect(() => {
    if (activeTab === "graphing" && isOpen) {
      drawGraph();
    }
  }, [activeTab, graphFunc, isOpen]);

  if (!isOpen) return null;

  const btnClass = "p-3 text-sm font-semibold rounded-xl bg-gray-50 border border-gray-100 hover:bg-gray-100 transition-colors text-gray-700 active:scale-95";
  const opClass = "p-3 text-sm font-semibold rounded-xl bg-blue-50 border border-blue-100 hover:bg-blue-100 transition-colors text-primary active:scale-95";
  const fnClass = "p-3 text-xs font-semibold rounded-xl bg-indigo-50 border border-indigo-100 hover:bg-indigo-100 transition-colors text-indigo-700 active:scale-95";

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-40 flex items-center justify-center p-4">
      <div className="relative bg-white rounded-2xl max-w-md w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <div className="flex gap-4">
            <button
              onClick={() => setActiveTab("standard")}
              className={`text-sm font-semibold transition-colors pb-1 border-b-2 ${activeTab === "standard" ? "text-primary border-primary" : "text-gray-500 border-transparent"}`}
            >
              Scientific
            </button>
            <button
              onClick={() => setActiveTab("graphing")}
              className={`text-sm font-semibold transition-colors pb-1 border-b-2 ${activeTab === "graphing" ? "text-primary border-primary" : "text-gray-500 border-transparent"}`}
            >
              Graphing (y = f(x))
            </button>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-xl transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === "standard" ? (
          <div className="p-6">
            {/* Display screen */}
            <div className="bg-gray-50 border border-gray-100 rounded-2xl p-4 mb-4 text-right">
              <div className="text-gray-400 text-sm overflow-x-auto whitespace-nowrap min-h-[20px]">{expr || "0"}</div>
              <div className="text-gray-800 text-2xl font-bold truncate mt-1">{result || "0"}</div>
            </div>

            {/* Buttons Layout */}
            <div className="grid grid-cols-5 gap-2">
              <button onClick={() => handleKey("sin(")} className={fnClass}>sin</button>
              <button onClick={() => handleKey("cos(")} className={fnClass}>cos</button>
              <button onClick={() => handleKey("tan(")} className={fnClass}>tan</button>
              <button onClick={() => handleKey("C")} className="p-3 text-sm font-bold rounded-xl bg-red-50 border border-red-100 hover:bg-red-100 text-red-600 active:scale-95">C</button>
              <button onClick={() => handleKey("⌫")} className="p-3 text-sm font-bold rounded-xl bg-orange-50 border border-orange-100 hover:bg-orange-100 text-orange-600 active:scale-95">⌫</button>

              <button onClick={() => handleKey("sqrt(")} className={fnClass}>√</button>
              <button onClick={() => handleKey("^")} className={fnClass}>xʸ</button>
              <button onClick={() => handleKey("log(")} className={fnClass}>log</button>
              <button onClick={() => handleKey("ln(")} className={fnClass}>ln</button>
              <button onClick={() => handleKey("/")} className={opClass}>÷</button>

              <button onClick={() => handleKey("(")} className={btnClass}>(</button>
              <button onClick={() => handleKey("7")} className={btnClass}>7</button>
              <button onClick={() => handleKey("8")} className={btnClass}>8</button>
              <button onClick={() => handleKey("9")} className={btnClass}>9</button>
              <button onClick={() => handleKey("*")} className={opClass}>×</button>

              <button onClick={() => handleKey(")")} className={btnClass}>)</button>
              <button onClick={() => handleKey("4")} className={btnClass}>4</button>
              <button onClick={() => handleKey("5")} className={btnClass}>5</button>
              <button onClick={() => handleKey("6")} className={btnClass}>6</button>
              <button onClick={() => handleKey("-")} className={opClass}>-</button>

              <button onClick={() => handleKey("π")} className={btnClass}>π</button>
              <button onClick={() => handleKey("1")} className={btnClass}>1</button>
              <button onClick={() => handleKey("2")} className={btnClass}>2</button>
              <button onClick={() => handleKey("3")} className={btnClass}>3</button>
              <button onClick={() => handleKey("+")} className={opClass}>+</button>

              <button onClick={() => handleKey("e")} className={btnClass}>e</button>
              <button onClick={() => handleKey("0")} className={btnClass}>0</button>
              <button onClick={() => handleKey(".")} className={btnClass}>.</button>
              <button
                onClick={() => handleKey("=")}
                className="col-span-2 p-3 text-sm font-bold rounded-xl bg-primary hover:bg-primary-dark text-white active:scale-95 shadow-sm transition-all"
              >
                =
              </button>
            </div>
          </div>
        ) : (
          <div className="p-6 space-y-4">
            {/* Input area */}
            <div className="flex items-center gap-3">
              <span className="text-gray-500 font-medium">y = </span>
              <input
                type="text"
                value={graphFunc}
                onChange={(e) => setGraphFunc(e.target.value)}
                placeholder="e.g. x * x - 2"
                className="flex-1 bg-gray-50 border border-gray-200 px-4 py-2 rounded-xl text-sm font-mono focus:outline-none focus:border-primary"
              />
              <button onClick={drawGraph} className="p-2 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors">
                <RotateCcw className="w-4 h-4 text-gray-600" />
              </button>
            </div>

            {/* Canvas */}
            <div className="bg-slate-50 border border-gray-100 rounded-2xl flex items-center justify-center p-2">
              <canvas
                ref={canvasRef}
                width={360}
                height={260}
                className="rounded-xl border border-gray-200 bg-white"
              />
            </div>
            
            <p className="text-xs text-gray-400 font-mono text-center">
              Variables: x. Examples: <span className="underline">x*x</span>, <span className="underline">sin(x)</span>, <span className="underline">2*x + 1</span>
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Calculator;
