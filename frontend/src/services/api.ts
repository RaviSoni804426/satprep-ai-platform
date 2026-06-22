import { store } from "../store";
import { logout } from "../store/authSlice";

const BASE_URL = "/v1";

async function apiFetch(path: string, options: RequestInit = {}) {
  const state = store.getState();
  const token = state.auth.token;

  const headers = new Headers(options.headers);
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  if (!headers.has("Content-Type") && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers
  });

  if (response.status === 401) {
    store.dispatch(logout());
    throw new Error("UNAUTHORIZED");
  }

  if (response.status === 202) {
    // Return custom status for score processing or accepted state
    const data = await response.json();
    return { ...data, _status: 202 };
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || "API_ERROR");
  }

  return response.json();
}

export const api = {
  auth: {
    register: (body: any) => apiFetch("/auth/register", { method: "POST", body: JSON.stringify(body) }),
    verifyOtp: (body: any) => apiFetch("/auth/otp/verify", { method: "POST", body: JSON.stringify(body) }),
    login: (body: any) => apiFetch("/auth/login", { method: "POST", body: JSON.stringify(body) }),
    logout: () => apiFetch("/auth/logout", { method: "POST" }),
    google: (credential: string) => apiFetch("/auth/google", { method: "POST", body: JSON.stringify({ credential }) })
  },
  users: {
    getMe: () => apiFetch("/users/me"),
    updateMe: (body: any) => apiFetch("/users/me", { method: "PATCH", body: JSON.stringify(body) }),
    list: (role?: string, search?: string, page = 1, limit = 50) => {
      let url = `/users?page=${page}&limit=${limit}`;
      if (role) url += `&role=${role}`;
      if (search) url += `&search=${encodeURIComponent(search)}`;
      return apiFetch(url);
    }
  },
  tests: {
    list: () => apiFetch("/tests"),
    start: (testId: string) => apiFetch(`/tests/${testId}/start`, { method: "POST" }),
    saveAnswers: (sessionId: string, body: any) => apiFetch(`/sessions/${sessionId}/answers`, { method: "POST", body: JSON.stringify(body) }),
    submitModule: (sessionId: string, moduleNo: number) => apiFetch(`/sessions/${sessionId}/modules/${moduleNo}/submit`, { method: "POST" }),
    submitTest: (sessionId: string) => apiFetch(`/sessions/${sessionId}/submit`, { method: "POST" }),
    getScore: (sessionId: string) => apiFetch(`/sessions/${sessionId}/score`),
    resume: (sessionId: string) => apiFetch(`/sessions/${sessionId}/resume`),
    review: (sessionId: string) => apiFetch(`/sessions/${sessionId}/review`),
    saveMistake: (sessionId: string, questionId: string, mistakeType: string) => apiFetch(`/sessions/${sessionId}/questions/${questionId}/mistake`, { method: "POST", body: JSON.stringify({ mistake_type: mistakeType }) })
  },
  coach: {
    ask: (question: string) => apiFetch("/coach/ask", { method: "POST", body: JSON.stringify({ question }) })
  },
  analytics: {
    getMe: () => apiFetch("/analytics/me"),
    getStudent: (studentId: string) => apiFetch(`/analytics/students/${studentId}`),
    getPlatform: () => apiFetch("/analytics/platform")
  },
  recommendations: {
    list: () => apiFetch("/recommendations/me"),
    dismiss: (recId: string) => apiFetch(`/recommendations/${recId}/dismiss`, { method: "PATCH" })
  },
  admin: {
    createQuestion: (body: any) => apiFetch("/admin/questions", { method: "POST", body: JSON.stringify(body) }),
    approveQuestion: (qId: string) => apiFetch(`/admin/questions/${qId}/approve`, { method: "PATCH" }),
    listQuestions: () => apiFetch("/admin/questions"),
    importQuestions: (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      return apiFetch("/admin/questions/import", { method: "POST", body: formData });
    },
    exportUrl: (type: string) => `/v1/admin/reports/export?type=${type}`
  },
  counsellor: {
    students: () => apiFetch("/counsellor/students")
  }
};
