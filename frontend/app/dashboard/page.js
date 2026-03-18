"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getMe, getNotes, createNote, updateNote, deleteNote, logoutUser } from "@/lib/api";
import NoteCard from "@/components/NoteCard";
import NoteForm from "@/components/NoteForm";
import NoteModal from "@/components/NoteModal";
import ThemeToggle from "@/components/ThemeToggle";

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingNote, setEditingNote] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const me = await getMe();
        setUser(me);
        const data = await getNotes();
        setNotes(data);
      } catch {
        router.replace("/login");
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  const handleCreate = async (title, content) => {
    const note = await createNote(title, content);
    setNotes((prev) => [note, ...prev]);
  };

  const handleDelete = async (id) => {
    await deleteNote(id);
    setNotes((prev) => prev.filter((n) => n.id !== id));
  };

  const handleUpdate = async (id, title, content) => {
    const updated = await updateNote(id, title, content);
    setNotes((prev) => prev.map((n) => (n.id === id ? updated : n)));
    setEditingNote(null);
  };

  const handleLogout = async () => {
    await logoutUser();
    router.replace("/login");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--paper)" }}>
        <div className="text-center space-y-4">
          <div className="font-serif text-2xl" style={{ color: "var(--ink-mute)" }}>
            Loading your notes…
          </div>
          <div className="flex gap-1.5 justify-center">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="w-2 h-2 rounded-full"
                style={{
                  background: "var(--accent)",
                  animation: `fadeIn 0.6s ease ${i * 0.2}s both`,
                }}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--paper)" }}>
      {/* Header */}
      <header
        className="sticky top-0 z-10 border-b"
        style={{
          background: "var(--paper)",
          backdropFilter: "blur(12px)",
          borderColor: "var(--border)",
        }}
      >
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs"
              style={{
                background: "linear-gradient(135deg, #c17d3c, #8b5a2b)",
                color: "white",
                letterSpacing: "0.5px",
                boxShadow: "0 2px 8px rgba(193, 125, 60, 0.4)"
              }}
            >
              NX
            </div>
            <span className="font-serif text-xl" style={{ color: "var(--ink)" }}>
              SHVX Notes
            </span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm font-mono hidden sm:block" style={{ color: "var(--ink-mute)" }}>
              {user?.email}
            </span>
            <ThemeToggle />
            <button
              onClick={handleLogout}
              className="btn-press px-4 py-2 rounded-xl text-sm font-medium border transition-colors hover:bg-white"
              style={{ borderColor: "var(--border)", color: "var(--ink-soft)" }}
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-10">
        {/* Welcome */}
        <div className="mb-10 animate-fadeUp">
          <h1 className="font-serif text-4xl mb-1" style={{ color: "var(--ink)" }}>
            Your Notes
          </h1>
          <p style={{ color: "var(--ink-mute)", fontSize: "15px" }}>
            {notes.length === 0
              ? "Nothing here yet. Create your first note below."
              : `${notes.length} note${notes.length !== 1 ? "s" : ""} — private to you`}
          </p>
        </div>

        {/* Create Note Form */}
        <div className="mb-10 animate-fadeUp" style={{ animationDelay: "0.05s" }}>
          <NoteForm onSubmit={handleCreate} />
        </div>

        {/* Notes Grid */}
        {notes.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2">
            {notes.map((note, i) => (
              <div
                key={note.id}
                className="animate-fadeUp"
                style={{ animationDelay: `${0.05 + i * 0.04}s` }}
              >
                <NoteCard
                  note={note}
                  onDelete={handleDelete}
                  onEdit={() => setEditingNote(note)}
                />
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Edit Modal */}
      {editingNote && (
        <NoteModal
          note={editingNote}
          onClose={() => setEditingNote(null)}
          onSave={handleUpdate}
        />
      )}
    </div>
  );
}
