"use client";
import { useState, useEffect } from "react";

export default function NoteModal({ note, onClose, onSave }) {
  const [title, setTitle] = useState(note.title);
  const [content, setContent] = useState(note.content);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Close on Escape key
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const handleSave = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await onSave(note.id, title, content);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fadeIn"
      style={{ background: "rgba(26, 26, 46, 0.5)", backdropFilter: "blur(4px)" }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="w-full max-w-lg rounded-2xl p-7 border animate-fadeUp"
        style={{ background: "var(--card)", borderColor: "var(--border)" }}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-serif text-2xl" style={{ color: "var(--ink)" }}>
            Edit Note
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-lg hover:bg-gray-100"
            style={{ color: "var(--ink-mute)" }}
          >
            ✕
          </button>
        </div>

        {error && (
          <div
            className="mb-4 px-3 py-2 rounded-lg text-sm"
            style={{ background: "#fdf0ef", color: "var(--danger)" }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-3">
          <input
            type="text"
            className="field w-full px-4 py-2.5 rounded-xl border text-sm font-medium"
            style={{
              background: "var(--paper)",
              borderColor: "var(--border)",
              color: "var(--ink)",
            }}
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
              minHeight: "160px",
            }}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            required
          />
          <div className="flex gap-3 justify-end pt-1">
            <button
              type="button"
              onClick={onClose}
              className="btn-press px-5 py-2.5 rounded-xl text-sm font-medium border"
              style={{ borderColor: "var(--border)", color: "var(--ink-soft)" }}
            >
              Cancel
            </button>
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
              {loading ? "Saving…" : "Save changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
