# 📝 NoteKeeper — Multi-User Notes App

A full-stack secure notes application with JWT auth, PostgreSQL, and a polished Next.js UI.

## Tech Stack

| Layer      | Technology                              |
|------------|-----------------------------------------|
| Frontend   | Next.js 14 (App Router), Tailwind CSS   |
| Backend    | Node.js, Express.js                     |
| Auth       | JWT (HTTP-only cookies), bcrypt         |
| Database   | PostgreSQL + Prisma ORM                 |

---

## Folder Structure

```
notes-app/
├── backend/
│   ├── config/db.js
│   ├── controllers/
│   │   ├── authController.js
│   │   └── notesController.js
│   ├── middleware/authenticate.js
│   ├── routes/
│   │   ├── authRoutes.js
│   │   └── notesRoutes.js
│   ├── prisma/schema.prisma
│   ├── server.js
│   ├── package.json
│   └── .env.example
│
└── frontend/
    ├── app/
    │   ├── layout.js
    │   ├── globals.css
    │   ├── page.js
    │   ├── login/page.js
    │   ├── register/page.js
    │   └── dashboard/page.js
    ├── components/
    │   ├── NoteCard.js
    │   ├── NoteForm.js
    │   └── NoteModal.js
    ├── lib/api.js
    ├── jsconfig.json
    ├── next.config.js
    ├── tailwind.config.js
    ├── postcss.config.js
    ├── package.json
    └── .env.local.example
```

---

## Setup Instructions

### Prerequisites
- Node.js 18+
- PostgreSQL running locally (or use [Neon](https://neon.tech) / [Supabase](https://supabase.com) for cloud)

---

### 1. Backend

```bash
cd backend

# Install dependencies
npm install

# Set up environment
cp .env.example .env
# Edit .env — fill in DATABASE_URL and JWT_SECRET

# Generate Prisma client
npx prisma generate

# Run DB migration (creates tables)
npx prisma migrate dev --name init

# Start the server
npm run dev
# ✅ http://localhost:5000
```

**`backend/.env`**
```
DATABASE_URL="postgresql://postgres:yourpassword@localhost:5432/notesapp"
JWT_SECRET="your-super-secret-key-min-32-chars"
PORT=5000
CLIENT_URL="http://localhost:3000"
```

---

### 2. Frontend

```bash
cd frontend

# Install dependencies
npm install

# Set up environment
cp .env.local.example .env.local
# Edit .env.local

# Start Next.js dev server
npm run dev
# ✅ http://localhost:3000
```

**`frontend/.env.local`**
```
NEXT_PUBLIC_API_URL=http://localhost:5000
```

---

## API Reference

### Auth Routes
| Method | Path                  | Description        |
|--------|-----------------------|--------------------|
| POST   | /api/auth/register    | Create account     |
| POST   | /api/auth/login       | Login + set cookie |
| POST   | /api/auth/logout      | Clear cookie       |
| GET    | /api/auth/me          | Get current user   |

### Notes Routes (Protected — requires JWT cookie)
| Method | Path              | Description        |
|--------|-------------------|--------------------|
| GET    | /api/notes        | Get all your notes |
| POST   | /api/notes        | Create a note      |
| PUT    | /api/notes/:id    | Edit a note        |
| DELETE | /api/notes/:id    | Delete a note      |

---

## Security Model

- Passwords hashed with **bcrypt** (cost factor 10)
- JWT stored in **HTTP-only cookie** (inaccessible to JavaScript)
- Every note query filters by `userId` from the verified JWT
- Ownership verified before any update or delete
- CORS configured with `credentials: true` for cookie support
