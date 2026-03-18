const prisma = require("../config/db");

// GET /api/notes
const getNotes = async (req, res) => {
  try {
    const notes = await prisma.note.findMany({
      where: { userId: req.userId },
      orderBy: { createdAt: "desc" },
    });
    return res.status(200).json(notes);
  } catch (err) {
    console.error("Get notes error:", err);
    return res.status(500).json({ error: "Internal server error." });
  }
};

// POST /api/notes
const createNote = async (req, res) => {
  const { title, content } = req.body;

  if (!title || !content) {
    return res.status(400).json({ error: "Title and content are required." });
  }

  if (title.length > 200) {
    return res.status(400).json({ error: "Title must be under 200 characters." });
  }

  try {
    const note = await prisma.note.create({
      data: {
        title,
        content,
        userId: req.userId,
      },
    });
    return res.status(201).json(note);
  } catch (err) {
    console.error("Create note error:", err);
    return res.status(500).json({ error: "Internal server error." });
  }
};

// PUT /api/notes/:id
const updateNote = async (req, res) => {
  const { id } = req.params;
  const { title, content } = req.body;

  if (!title || !content) {
    return res.status(400).json({ error: "Title and content are required." });
  }

  try {
    // Verify note belongs to this user
    const existing = await prisma.note.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: "Note not found." });
    if (existing.userId !== req.userId) {
      return res.status(403).json({ error: "Access denied." });
    }

    const updated = await prisma.note.update({
      where: { id },
      data: { title, content },
    });
    return res.status(200).json(updated);
  } catch (err) {
    console.error("Update note error:", err);
    return res.status(500).json({ error: "Internal server error." });
  }
};

// DELETE /api/notes/:id
const deleteNote = async (req, res) => {
  const { id } = req.params;

  try {
    // Verify note belongs to this user before deleting
    const existing = await prisma.note.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: "Note not found." });
    if (existing.userId !== req.userId) {
      return res.status(403).json({ error: "Access denied." });
    }

    await prisma.note.delete({ where: { id } });
    return res.status(200).json({ message: "Note deleted." });
  } catch (err) {
    console.error("Delete note error:", err);
    return res.status(500).json({ error: "Internal server error." });
  }
};

module.exports = { getNotes, createNote, updateNote, deleteNote };
