# SHVX Notes

A secure, full-stack multi-user notes application built as part of the SHVX technical assessment.

## 🔗 Live Demo
- **Frontend:** https://shvx-notes.vercel.app
- **Backend:** https://shvx-notes-api.onrender.com

---

## 🛠️ Tech Stack

| Layer      | Technology                          |
|------------|-------------------------------------|
| Frontend   | Next.js 14 (App Router), Tailwind CSS |
| Backend    | Node.js, Express.js                 |
| Auth       | JWT (HTTP-only cookies), bcrypt     |
| Database   | PostgreSQL (Neon)                   |
| ORM        | Prisma                              |
| Deployment | Vercel (frontend), Render (backend) |

---

## ✨ Features

-  Secure user registration and login
-  JWT authentication via HTTP-only cookies
-  Create, view, edit and delete personal notes
-  Each user sees only their own notes
-  Dark / Light mode toggle
-  Fully responsive design

---

## Security

- Passwords hashed with **bcrypt**
- JWT stored in **HTTP-only cookies** (not localStorage)
- Every note query filtered by `userId` from verified JWT
- Ownership verified before any update or delete
- CORS configured with credentials support

---

## Database Schema
```prisma
model User {
  id        String   @id @default(uuid())
  email     String   @unique
  password  String
  createdAt DateTime @default(now())
  notes     Note[]
}

model Note {
  id        String   @id @default(uuid())
  title     String
  content   String
  userId    String
  createdAt DateTime @default(now())
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

---

## 🔌 API Endpoints

### Auth
| Method | Endpoint              | Description         |
|--------|-----------------------|---------------------|
| POST   | /api/auth/register    | Register new user   |
| POST   | /api/auth/login       | Login + set cookie  |
| POST   | /api/auth/logout      | Clear cookie        |
| GET    | /api/auth/me          | Get current user    |

### Notes (Protected)
| Method | Endpoint          | Description       |
|--------|-------------------|-------------------|
| GET    | /api/notes        | Get all my notes  |
| POST   | /api/notes        | Create a note     |
| PUT    | /api/notes/:id    | Edit a note       |
| DELETE | /api/notes/:id    | Delete a note     |

---

##  Project Structure
```
shvx-notes/
├── backend/
│   ├── config/         # Database client
│   ├── controllers/    # Auth & Notes logic
│   ├── middleware/      # JWT verification
│   ├── routes/         # API routes
│   ├── prisma/         # Schema & migrations
│   └── server.js       # Express entry point
│
└── frontend/
    ├── app/            # Next.js pages
    ├── components/     # Reusable UI components
    └── lib/            # API utility functions
```

---

## Local Setup

### Backend
```bash
cd backend
npm install
# Create .env  and fill in values
npx prisma generate
npx prisma migrate dev --name init
npm run dev
```

### Frontend
```bash
cd frontend
npm install
# Create .env.local from .env.local.example
npm run dev
```

### Environment Variables

**backend/.env**
```
DATABASE_URL="your-neon-postgresql-url"
JWT_SECRET="your-secret-key"
PORT=5000
CLIENT_URL="http://localhost:3000"
```

**frontend/.env.local**
```
NEXT_PUBLIC_API_URL=http://localhost:5000
```

---

## Author
Built for SHVX Technical Assessment
