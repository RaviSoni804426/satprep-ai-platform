import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { RootState } from "./store";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import TestPlayer from "./pages/TestPlayer";
import ScoreReport from "./pages/ScoreReport";
import AnswerReview from "./pages/AnswerReview";
import CounsellorDashboard from "./pages/CounsellorDashboard";
import AdminPortal from "./pages/AdminPortal";

// Route guard for authentication and roles
interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: string[];
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles }) => {
  const { isAuthenticated, user } = useSelector((state: RootState) => state.auth);

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    // Redirect to correct default role dashboard
    if (user.role === "student") return <Navigate to="/dashboard" replace />;
    if (user.role === "counsellor") return <Navigate to="/counsellor" replace />;
    return <Navigate to="/admin" replace />;
  }

  return <>{children}</>;
};

// Route director for root path
const RootDirector: React.FC = () => {
  const { isAuthenticated, user } = useSelector((state: RootState) => state.auth);

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  if (user.role === "student") return <Navigate to="/dashboard" replace />;
  if (user.role === "counsellor") return <Navigate to="/counsellor" replace />;
  return <Navigate to="/admin" replace />;
};

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        {/* Root fallback */}
        <Route path="/" element={<RootDirector />} />

        {/* Public auth */}
        <Route path="/login" element={<Login />} />

        {/* Student panel */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute allowedRoles={["student"]}>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/test/:session_id"
          element={
            <ProtectedRoute allowedRoles={["student"]}>
              <TestPlayer />
            </ProtectedRoute>
          }
        />

        {/* Shared score details */}
        <Route
          path="/sessions/:session_id/score"
          element={
            <ProtectedRoute allowedRoles={["student", "counsellor", "admin"]}>
              <ScoreReport />
            </ProtectedRoute>
          }
        />
        <Route
          path="/sessions/:session_id/review"
          element={
            <ProtectedRoute allowedRoles={["student", "counsellor", "admin"]}>
              <AnswerReview />
            </ProtectedRoute>
          }
        />

        {/* Counsellor panel */}
        <Route
          path="/counsellor"
          element={
            <ProtectedRoute allowedRoles={["counsellor", "admin"]}>
              <CounsellorDashboard />
            </ProtectedRoute>
          }
        />

        {/* Admin and Author CMS panel */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute allowedRoles={["author", "admin"]}>
              <AdminPortal />
            </ProtectedRoute>
          }
        />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
