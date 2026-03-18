const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

// Shared fetch wrapper — always sends cookies, always returns JSON
async function apiFetch(path, options = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    credentials: "include", // Send HTTP-only cookie on every request
    headers: { "Content-Type": "application/json", ...options.headers },
    ...options,
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || "Something went wrong.");
  }
  return data;
}

// Auth
export const registerUser = (email, password) =>
  apiFetch("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });

export const loginUser = (email, password) =>
  apiFetch("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });

export const logoutUser = () =>
  apiFetch("/api/auth/logout", { method: "POST" });

export const getMe = () => apiFetch("/api/auth/me");

// Notes
export const getNotes = () => apiFetch("/api/notes");

export const createNote = (title, content) =>
  apiFetch("/api/notes", {
    method: "POST",
    body: JSON.stringify({ title, content }),
  });

export const updateNote = (id, title, content) =>
  apiFetch(`/api/notes/${id}`, {
    method: "PUT",
    body: JSON.stringify({ title, content }),
  });

export const deleteNote = (id) =>
  apiFetch(`/api/notes/${id}`, { method: "DELETE" });
