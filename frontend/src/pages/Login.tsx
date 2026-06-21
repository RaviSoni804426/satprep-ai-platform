import React, { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { setCredentials, setLoading, setError } from "../store/authSlice";
import { RootState } from "../store";
import { api } from "../services/api";
import { KeyRound, Mail, User as UserIcon, Eye, EyeOff, Loader2, BookOpen } from "lucide-react";

const Login: React.FC = () => {
  const [view, setView] = useState<"login" | "register" | "otp">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState("student");
  const [otp, setOtp] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");

  const { loading, error } = useSelector((state: RootState) => state.auth);
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    dispatch(setLoading(true));
    dispatch(setError(null));
    try {
      const data = await api.auth.register({ email, password, role, full_name: fullName });
      // Store credentials directly on successful registration
      const userProfile = await api.users.getMe();
      dispatch(setCredentials({ user: userProfile, access_token: data.access_token }));
      
      // Redirect to correct dashboard based on role
      if (userProfile.role === "student") {
        navigate("/dashboard");
      } else if (userProfile.role === "counsellor") {
        navigate("/counsellor");
      } else {
        navigate("/admin");
      }
    } catch (err: any) {
      dispatch(setError(err.message || "Registration failed"));
    } finally {
      dispatch(setLoading(false));
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    dispatch(setLoading(true));
    dispatch(setError(null));
    try {
      const data = await api.auth.verifyOtp({ email, otp });
      // OTP verified successfully, fetch profile to retrieve full name
      const userProfile = await api.users.getMe();
      // Store credentials in Redux
      dispatch(setCredentials({ user: userProfile, access_token: data.access_token }));
      
      // Redirect to dashboard based on role
      if (userProfile.role === "student") {
        navigate("/dashboard");
      } else if (userProfile.role === "counsellor") {
        navigate("/counsellor");
      } else {
        navigate("/admin");
      }
    } catch (err: any) {
      dispatch(setError(err.message || "Invalid OTP code"));
    } finally {
      dispatch(setLoading(false));
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    dispatch(setLoading(true));
    dispatch(setError(null));
    try {
      const data = await api.auth.login({ email, password });
      const userProfile = await api.users.getMe();
      dispatch(setCredentials({ user: userProfile, access_token: data.access_token }));
      
      if (userProfile.role === "student") {
        navigate("/dashboard");
      } else if (userProfile.role === "counsellor") {
        navigate("/counsellor");
      } else {
        navigate("/admin");
      }
    } catch (err: any) {
      if (err.message === "OTP_REQUIRED") {
        setView("otp");
        setSuccessMsg("Account not verified yet. Verification code resent.");
      } else {
        dispatch(setError(err.message || "Login failed"));
      }
    } finally {
      dispatch(setLoading(false));
    }
  };

  const handleGoogleLogin = async () => {
    dispatch(setLoading(true));
    dispatch(setError(null));
    try {
      // Simulate Google auth token callback
      const mockGoogleCredential = `${email || "student"}@example.com`;
      const data = await api.auth.google(mockGoogleCredential);
      
      // Store credentials
      const userProfile = await api.users.getMe();
      dispatch(setCredentials({ user: userProfile, access_token: data.access_token }));
      
      if (userProfile.role === "student") {
        navigate("/dashboard");
      } else if (userProfile.role === "counsellor") {
        navigate("/counsellor");
      } else {
        navigate("/admin");
      }
    } catch (err: any) {
      dispatch(setError(err.message || "Google Login failed"));
    } finally {
      dispatch(setLoading(false));
    }
  };

  return (
    <div className="flex-1 flex min-h-screen bg-slate-50">
      {/* Brand panel on the left */}
      <div className="hidden lg:flex lg:w-1/2 bg-primary relative overflow-hidden items-center justify-center p-12">
        <div className="absolute inset-0 bg-gradient-to-tr from-primary-dark via-primary to-indigo-600 opacity-90" />
        <div className="relative z-10 text-white max-w-lg space-y-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-white bg-opacity-10 backdrop-blur-md rounded-2xl">
              <BookOpen className="w-8 h-8" />
            </div>
            <span className="text-2xl font-extrabold tracking-tight">SATPrep AI</span>
          </div>
          <div className="space-y-4">
            <h1 className="text-4xl font-extrabold leading-tight tracking-tight">
              Adaptive Digital SAT Mock Test Portal
            </h1>
            <p className="text-blue-100 text-lg leading-relaxed">
              Experience the realistic, adaptive mock SAT that matches the College Board curriculum. Maximize your score with AI recommendations and in-depth performance analytics.
            </p>
          </div>
          <div className="flex gap-6 pt-4 border-t border-white border-opacity-20 text-sm">
            <div>
              <div className="font-extrabold text-2xl">4,000+</div>
              <div className="text-blue-200">Active Students</div>
            </div>
            <div>
              <div className="font-extrabold text-2xl">±30 pts</div>
              <div className="text-blue-200">Score Prediction Accuracy</div>
            </div>
            <div>
              <div className="font-extrabold text-2xl">99.9%</div>
              <div className="text-blue-200">Mock Similarity</div>
            </div>
          </div>
        </div>
      </div>

      {/* Auth Forms panel on the right */}
      <div className="flex-1 flex flex-col justify-center px-6 py-12 lg:px-24 bg-white relative">
        <div className="sm:mx-auto sm:w-full sm:max-w-md space-y-6">
          <div className="text-center">
            <h2 className="text-3xl font-extrabold text-gray-900 tracking-tight">
              {view === "login" && "Sign in to SATPrep AI"}
              {view === "register" && "Create your account"}
              {view === "otp" && "Verify your account"}
            </h2>
            <p className="text-sm text-gray-500 mt-2">
              {view === "login" && "Unlock your potential with adaptive mocks"}
              {view === "register" && "Start your score improvement journey"}
              {view === "otp" && "Enter the 6-digit code to get started"}
            </p>
          </div>

          {error && (
            <div className="p-4 bg-red-50 border border-red-100 rounded-2xl text-sm text-red-600 flex items-center gap-2">
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-4 bg-green-50 border border-green-100 rounded-2xl text-sm text-green-700">
              {successMsg}
            </div>
          )}

          {view === "login" && (
            <form className="space-y-4" onSubmit={handleLogin}>
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">Email address</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-3.5 w-5 h-5 text-gray-400" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl py-3 pl-12 pr-4 text-sm focus:outline-none focus:border-primary transition-colors"
                    placeholder="student@example.com"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">Password</label>
                <div className="relative">
                  <KeyRound className="absolute left-4 top-3.5 w-5 h-5 text-gray-400" />
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl py-3 pl-12 pr-12 text-sm focus:outline-none focus:border-primary transition-colors"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-3.5 hover:text-gray-600 text-gray-400"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <button type="submit" disabled={loading} className="w-full premium-btn mt-6">
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Sign In"}
              </button>
            </form>
          )}

          {view === "register" && (
            <form className="space-y-4" onSubmit={handleRegister}>
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">Full Name</label>
                <div className="relative">
                  <UserIcon className="absolute left-4 top-3.5 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={e => setFullName(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl py-3 pl-12 pr-4 text-sm focus:outline-none focus:border-primary transition-colors"
                    placeholder="Arjun Sharma"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">Email address</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-3.5 w-5 h-5 text-gray-400" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl py-3 pl-12 pr-4 text-sm focus:outline-none focus:border-primary transition-colors"
                    placeholder="student@example.com"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">Password</label>
                <div className="relative">
                  <KeyRound className="absolute left-4 top-3.5 w-5 h-5 text-gray-400" />
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl py-3 pl-12 pr-12 text-sm focus:outline-none focus:border-primary transition-colors"
                    placeholder="•••••••• (6+ characters)"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-3.5 hover:text-gray-600 text-gray-400"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">I am a</label>
                <select
                  value={role}
                  onChange={e => setRole(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl py-3 px-4 text-sm focus:outline-none focus:border-primary transition-colors"
                >
                  <option value="student">Student</option>
                  <option value="counsellor">Counsellor</option>
                  <option value="author">Content Author</option>
                  <option value="admin">Administrator</option>
                </select>
              </div>

              <button type="submit" disabled={loading} className="w-full premium-btn mt-6">
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Sign Up"}
              </button>
            </form>
          )}

          {view === "otp" && (
            <form className="space-y-4" onSubmit={handleVerifyOtp}>
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">Enter 6-digit Verification Code</label>
                <input
                  type="text"
                  required
                  maxLength={6}
                  value={otp}
                  onChange={e => setOtp(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl py-4 text-center tracking-[1em] text-2xl font-bold focus:outline-none focus:border-primary transition-colors"
                  placeholder="------"
                />
              </div>

              <button type="submit" disabled={loading} className="w-full premium-btn mt-6">
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Verify Code"}
              </button>
            </form>
          )}

          {view !== "otp" && (
            <div className="space-y-4">
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white px-2 text-gray-400">Or continue with</span>
              </div>
              <button
                onClick={handleGoogleLogin}
                className="w-full premium-btn-secondary"
              >
                <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                  <path fill="#EA4335" d="M12 5.04c1.66 0 3.2.57 4.38 1.69l3.27-3.27C17.67 1.48 15 0 12 0 7.35 0 3.37 2.67 1.44 6.56l3.86 3C6.25 6.78 8.89 5.04 12 5.04z" />
                  <path fill="#4285F4" d="M23.49 12.27c0-.81-.07-1.59-.2-2.36H12v4.51h6.46c-.28 1.48-1.12 2.73-2.38 3.58l3.7 2.87c2.16-2 3.71-4.94 3.71-8.6z" />
                  <path fill="#FBBC05" d="M5.3 14.44C5.06 13.73 4.93 12.98 4.93 12s.13-1.73.37-2.44L1.44 6.56C.52 8.4 0 10.15 0 12s.52 3.6 1.44 5.44l3.86-3z" />
                  <path fill="#34A853" d="M12 24c3.24 0 5.97-1.07 7.96-2.91l-3.7-2.87c-1.03.69-2.35 1.1-4.26 1.1-3.11 0-5.75-1.74-6.7-4.52l-3.86 3C3.37 21.33 7.35 24 12 24z" />
                </svg>
                Continue with Google
              </button>
            </div>
          )}

          <div className="text-center text-sm text-gray-500 mt-4">
            {view === "login" && (
              <>
                Don't have an account?{" "}
                <button onClick={() => setView("register")} className="text-primary font-semibold hover:underline">
                  Sign Up
                </button>
              </>
            )}
            {view === "register" && (
              <>
                Already have an account?{" "}
                <button onClick={() => setView("login")} className="text-primary font-semibold hover:underline">
                  Sign In
                </button>
              </>
            )}
            {view === "otp" && (
              <button onClick={() => setView("login")} className="text-primary font-semibold hover:underline">
                Back to Sign In
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
