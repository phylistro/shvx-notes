"use client";
import { useState } from "react";

export default function NoteForm({ onSubmit }) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await onSubmit(title, content);
      setTitle("");
      setContent("");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="rounded-2xl p-6 border"
      style={{ background: "var(--card)", borderColor: "var(--border)" }}
    >
      <h2 className="font-serif text-xl mb-4" style={{ color: "var(--ink)" }}>
        New Note
      </h2>

      {error && (
        <div
          className="mb-4 px-3 py-2 rounded-lg text-sm"
          style={{ background: "#fdf0ef", color: "var(--danger)" }}
        >
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          type="text"
          className="field w-full px-4 py-2.5 rounded-xl border text-sm font-medium"
          style={{
            background: "var(--paper)",
            borderColor: "var(--border)",
            color: "var(--ink)",
          }}
          placeholder="Note title…"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          maxLength={200}
        />
        <textarea
          className="field w-full px-4 py-3 rounded-xl border text-sm resize-none"
          style={{
            background: "var(--paper)",
            borderColor: "var(--border)",
            color: "var(--ink)",
            minHeight: "100px",
          }}
          placeholder="Write your note here…"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          required
        />
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={loading}
            className="btn-press px-5 py-2.5 rounded-xl text-sm font-medium"
            style={{
              background: loading ? "var(--accent-light)" : "var(--accent)",
              color: "white",
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            {loading ? "Saving…" : "Add note"}
          </button>
        </div>
      </form>
    </div>
  );
}
