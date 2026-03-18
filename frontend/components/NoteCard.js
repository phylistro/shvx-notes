"use client";
import { useState } from "react";

export default function NoteCard({ note, onDelete, onEdit }) {
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!confirm("Delete this note?")) return;
    setDeleting(true);
    try {
      await onDelete(note.id);
    } catch {
      setDeleting(false);
    }
  };

  const date = new Date(note.createdAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div
      className="note-card rounded-2xl p-5 border flex flex-col gap-3"
      style={{ background: "var(--card)", borderColor: "var(--border)", minHeight: "160px" }}
    >
      <div className="flex-1">
        <h3
          className="font-semibold text-base mb-1.5 leading-snug"
          style={{ color: "var(--ink)" }}
        >
          {note.title}
        </h3>
        <p
          className="text-sm leading-relaxed line-clamp-4"
          style={{ color: "var(--ink-soft)" }}
        >
          {note.content}
        </p>
      </div>

      <div
        className="flex items-center justify-between pt-2 border-t"
        style={{ borderColor: "var(--border)" }}
      >
        <span className="text-xs font-mono" style={{ color: "var(--ink-mute)" }}>
          {date}
        </span>
        <div className="flex gap-2">
          <button
            onClick={onEdit}
            className="btn-press px-3 py-1.5 rounded-lg text-xs font-medium border"
            style={{ borderColor: "var(--border)", color: "var(--ink-soft)" }}
          >
            Edit
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="btn-press px-3 py-1.5 rounded-lg text-xs font-medium"
            style={{
              background: deleting ? "#f5c6c3" : "#fdf0ef",
              color: "var(--danger)",
              cursor: deleting ? "not-allowed" : "pointer",
            }}
          >
            {deleting ? "…" : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}
