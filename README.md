# Pharmacy Management System Backend (`pharmacy-management-be`)

A modular, production-ready Express backend written in TypeScript with Prisma ORM.

## Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Language**: TypeScript
- **Database ORM**: Prisma (PostgreSQL / MySQL / SQLite compatible)
- **Validation**: Zod
- **Security & Logging**: Helmet, CORS, Morgan

---

## Getting Started

### 1. Installation

Install project dependencies:

```bash
npm install
```

### 2. Environment Setup

Copy the environment template file:

```bash
cp .env.example .env
```

Update `DATABASE_URL` in `.env` with your PostgreSQL database credentials.

### 3. Prisma Migration & Client Generation

Generate Prisma Client:

```bash
npm run prisma:generate
```

Run Database Migrations:

```bash
npm run prisma:migrate
```

### 4. Seed Demo Lengkap

Setelah migration terpasang, isi tenant demo, dua cabang, lima role/akun, dan
data operasional dengan:

```bash
npm run prisma:seed
```

Semua akun demo memakai password `Password123!`: `superadmin@apotek.local`,
`owner@apotek.local`, `admin@apotek.local`, `apj@apotek.local`, dan
`cashier@apotek.local`. PIN APJ adalah `123456`. Detail seed tersedia di
[`prisma/README.md`](prisma/README.md).

### 5. Running the Development Server

```bash
npm run dev
```

The server will start at `http://localhost:5000`.

---

## API Endpoints

- **Root**: `GET /`
- **Health Check**: `GET /api/v1/health`

---

## Folder Structure

```
pharmacy-management-be/
├── prisma/
│   └── schema.prisma        # Prisma Database Schema
├── src/
│   ├── config/              # Environment & App Configuration
│   ├── lib/                 # Shared Singletons (Prisma Client)
│   ├── middlewares/         # Express Middlewares (Error, 404)
│   ├── modules/             # Feature Modules (Health, Auth, etc.)
│   ├── routes/              # Central Router
│   ├── utils/               # Helper Functions (Response Wrappers)
│   ├── app.ts               # Express App Instance Configuration
│   └── index.ts             # Entry Point & Listener
├── .env.example
├── package.json
└── tsconfig.json
```

codex resume 01a04b5c-4237-7e42-bce6-0a6821ef888e
