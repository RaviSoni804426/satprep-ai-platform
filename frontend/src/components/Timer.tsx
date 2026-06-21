import React, { useEffect, useState } from "react";
import { Clock } from "lucide-react";

interface TimerProps {
  initialSeconds: number;
  onTimeUp: () => void;
  onTick?: (remaining: number) => void;
}

const Timer: React.FC<TimerProps> = ({ initialSeconds, onTimeUp, onTick }) => {
  const [seconds, setSeconds] = useState(initialSeconds);

  // Keep in sync with initialSeconds changes (e.g., when moving modules)
  useEffect(() => {
    setSeconds(initialSeconds);
  }, [initialSeconds]);

  useEffect(() => {
    if (seconds <= 0) {
      onTimeUp();
      return;
    }

    const timerId = setInterval(() => {
      setSeconds(prev => {
        const next = prev - 1;
        if (onTick) onTick(next);
        return next;
      });
    }, 1000);

    return () => clearInterval(timerId);
  }, [seconds, onTimeUp, onTick]);

  const formatTime = (totalSecs: number) => {
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  const isLowTime = seconds <= 300; // < 5 minutes

  return (
    <div
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-mono text-sm font-bold border transition-colors duration-300 ${
        isLowTime
          ? "bg-red-50 border-red-200 text-red-600 animate-pulse"
          : "bg-gray-50 border-gray-200 text-gray-700"
      }`}
    >
      <Clock className={`w-4 h-4 ${isLowTime ? "text-red-500 animate-bounce" : "text-gray-500"}`} />
      <span>{formatTime(seconds)}</span>
    </div>
  );
};

export default Timer;
