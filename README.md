<p align="center">
  <img src="https://img.shields.io/badge/Arovave-Pricing%20Engine-FF6B35?style=for-the-badge&logo=data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cGF0aCBkPSJNMTIgMkw0IDdWMTdMOCAyMEgxNkwyMCAxN1Y3TDEyIDJaIiBzdHJva2U9IndoaXRlIiBzdHJva2Utd2lkdGg9IjIiLz48L3N2Zz4=&logoColor=white" alt="Arovave"/>
</p>

<h1 align="center">⚡ Arovave Pricing Engine</h1>

<p align="center">
  <strong>A powerful, real-time dynamic pricing platform for production companies.</strong><br/>
  Build complex cost calculators with drag-and-drop formulas, manage inputs centrally, and generate instant client-facing quotations — all from one beautiful admin interface.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/React-18.3-61DAFB?style=flat-square&logo=react&logoColor=white" alt="React"/>
  <img src="https://img.shields.io/badge/Vite-6.0-646CFF?style=flat-square&logo=vite&logoColor=white" alt="Vite"/>
  <img src="https://img.shields.io/badge/TypeScript-5.5-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript"/>
  <img src="https://img.shields.io/badge/Fastify-5.0-000000?style=flat-square&logo=fastify&logoColor=white" alt="Fastify"/>
  <img src="https://img.shields.io/badge/Supabase-Realtime-3ECF8E?style=flat-square&logo=supabase&logoColor=white" alt="Supabase"/>
  <img src="https://img.shields.io/badge/TailwindCSS-3.4-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white" alt="Tailwind"/>
  <img src="https://img.shields.io/badge/Prisma-6.0-2D3748?style=flat-square&logo=prisma&logoColor=white" alt="Prisma"/>
  <img src="https://img.shields.io/badge/Docker-Ready-2496ED?style=flat-square&logo=docker&logoColor=white" alt="Docker"/>
  <img src="https://img.shields.io/badge/Vercel-Deployed-000000?style=flat-square&logo=vercel&logoColor=white" alt="Vercel"/>
  <img src="https://img.shields.io/badge/Node-%3E%3D20-339933?style=flat-square&logo=node.js&logoColor=white" alt="Node"/>
</p>

---

## 🎯 What is This?

**Arovave Pricing Engine** is a full-stack platform that lets production companies (film, events, media) define **dynamic calculators** for pricing their services. Instead of manually computing costs in spreadsheets, admins visually build formulas using a drag-and-drop interface, and clients get an instant, interactive pricing page.

### The Problem It Solves

> *"How much will a 3-day shoot with 2 cameras, 5 crew members, and aerial coverage cost?"*

Instead of manually calculating this every time, Arovave lets you:

1. **Define inputs once** (e.g., "Number of Days", "Camera Type", "Crew Size")
2. **Build formulas visually** (drag inputs, add operators, chain calculations)
3. **Share a link** — clients pick their options and see prices update in real-time
4. **Generate PDF quotations** — one-click professional quotes

---

## ✨ Key Features

### 🏗️ Admin Panel
| Feature | Description |
|---------|-------------|
| **🎯 Input Hub** | Centralized input management — number fields, dropdowns, fixed values — shared across all calculators |
| **🧮 Formula Builder** | Drag-and-drop visual formula editor with operator buttons, cursor positioning, and nested formula references |
| **📂 Category System** | Organize calculators into categories with ordering |
| **💰 Rate Manager** | Manage local rates and per-calculator overrides |
| **⚡ Additional Charges** | Attach sub-calculators (charges) to parent calculators with cross-formula referencing |
| **🎚️ Profit & GST** | Built-in profit percentage and GST with admin hide/show toggles |
| **📊 Discount Ranges** | Configurable min/max discount sliders per calculator |
| **👁️ Preview & Reorder** | Preview user-facing order and drag to rearrange inputs/formulas |
| **💾 Save/Discard** | Draft-based editing with unsaved changes warnings — never lose or accidentally save work |

### 🛒 Sales Page (Client-Facing)
| Feature | Description |
|---------|-------------|
| **📱 Responsive Calculator** | Beautiful, mobile-first pricing interface |
| **⚡ Real-time Computation** | Prices update instantly as users change inputs |
| **📄 PDF Quotation** | One-click professional quotation generation with `jsPDF` |
| **🔄 Multi-Calculator** | Support for multiple calculators with additional charges per category |

### 🔧 Engine (Core)
| Feature | Description |
|---------|-------------|
| **🔢 Deterministic Math** | Powered by `Decimal.js` — no floating point errors, ever |
| **📝 Formula Parser** | Tokenized formula parsing with bracket matching and operator precedence |
| **⚙️ Executor** | Resolves formula chains, dependency graphs, and cross-references |
| **✅ Validator** | Validates formula integrity, circular references, and missing inputs |
| **🔄 Conditional Logic** | Supports conditional calculations |
| **📏 Rounding** | Configurable rounding strategies |

---

## 🏛️ Architecture

```
arovave-pricing-engine/
├── 📦 packages/
│   ├── engine/          ← Pure TypeScript calculation engine
│   │   ├── calculator.ts    # Core calculator logic
│   │   ├── parser.ts        # Formula tokenizer & parser
│   │   ├── executor.ts      # Formula chain executor
│   │   ├── resolver.ts      # Dependency resolver
│   │   ├── validator.ts     # Formula integrity validator
│   │   ├── conditional.ts   # Conditional logic handler
│   │   ├── rounding.ts      # Rounding strategies
│   │   └── types.ts         # Shared type definitions
│   │
│   ├── server/          ← Fastify REST API
│   │   ├── src/app.ts       # Server entry point
│   │   └── prisma/          # Database schema & migrations
│   │
│   └── web/             ← React SPA (Admin + Sales)
│       ├── components/
│       │   ├── admin/
│       │   │   ├── AdminPanel.tsx              # Main admin dashboard
│       │   │   ├── InputHub.tsx                # Centralized input management
│       │   │   ├── DragDropCalculatorBuilder.tsx # Visual formula editor
│       │   │   ├── CategoryTree.tsx            # Category management
│       │   │   └── RateManager.tsx             # Rate configuration
│       │   ├── QuotationModal.tsx              # PDF quote generator
│       │   └── Layout.tsx                      # App shell
│       ├── pages/
│       │   ├── admin/AdminPanel.tsx            # Admin route
│       │   └── sales/SalesCalculator.tsx       # Client calculator
│       └── stores/
│           ├── templateStore.ts                # Zustand state management
│           └── supabaseSync.ts                 # Real-time Supabase sync
│
├── 🐳 docker-compose.yml    # Full stack orchestration
├── 🔧 Dockerfile.server     # Server container
├── 🔧 Dockerfile.web        # Frontend container
└── 🚀 vercel.json           # Vercel deployment config
```

### Data Flow

```mermaid
graph LR
    A[Admin Panel] -->|Define Inputs & Formulas| B[Zustand Store]
    B -->|Real-time Sync| C[Supabase]
    C -->|Load on Visit| D[Sales Page]
    D -->|User Selects Options| E[Engine]
    E -->|Deterministic Calc| F[Live Price Display]
    F -->|Generate| G[PDF Quotation]
```

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** ≥ 20.0.0
- **npm** ≥ 9.0.0
- **Git**

### 1. Clone & Install

```bash
git clone https://github.com/your-org/arovave-pricing-engine.git
cd arovave-pricing-engine
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` with your **Supabase** credentials:

```env
# Supabase Configuration
SUPABASE_URL="https://your-project.supabase.co"
SUPABASE_ANON_KEY="your-anon-key"
SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
DATABASE_URL="postgresql://..."

# Frontend (Vite)
VITE_SUPABASE_URL="https://your-project.supabase.co"
VITE_SUPABASE_ANON_KEY="your-anon-key"
VITE_API_URL="http://localhost:3001"
```

### 3. Run Development Server

```bash
# Frontend only (most common)
npm run dev

# Backend + Frontend
npm run dev:all

# Individual packages
npm run dev:web      # React app on :5173
npm run dev:server   # Fastify API on :3001
```

### 4. Open in Browser

| Page | URL | Description |
|------|-----|-------------|
| **Admin Panel** | `http://localhost:5173/admin` | Build calculators, manage inputs |
| **Sales Page** | `http://localhost:5173/` | Client-facing calculator |

---

## 🐳 Docker Deployment

Spin up the entire stack with one command:

```bash
docker compose up -d
```

This starts:
- **PostgreSQL 15** on port `54322`
- **Fastify Server** on port `3001`
- **Vite Dev Server** on port `5173`

---

## ☁️ Vercel Deployment

The frontend deploys directly to **Vercel**:

```bash
npm run build
vercel --prod
```

The `vercel.json` configuration handles routing automatically.

---

## 🧪 Testing

```bash
# Run all tests
npm test

# Engine tests only
npm run test:engine

# Server tests only
npm run test:server
```

The engine uses **Vitest** with deterministic math assertions powered by `Decimal.js`.

---

## 🛠️ Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend** | React 18 + Vite 6 | Blazing fast UI with HMR |
| **Styling** | TailwindCSS 3.4 | Utility-first responsive design |
| **State** | Zustand 5 | Lightweight reactive state management |
| **Forms** | React Hook Form + Zod | Type-safe form validation |
| **Icons** | Lucide React | Beautiful, consistent iconography |
| **PDF** | jsPDF | Client-side quotation generation |
| **Data** | xlsx | Excel import/export support |
| **Routing** | React Router 7 | Client-side navigation |
| **Backend** | Fastify 5 | High-performance REST API |
| **ORM** | Prisma 6 | Type-safe database access |
| **Database** | Supabase (PostgreSQL) | Hosted Postgres with real-time sync |
| **Math** | Decimal.js | Arbitrary-precision floating-point arithmetic |
| **Testing** | Vitest 2 | Fast unit & integration tests |
| **Language** | TypeScript 5.5 | End-to-end type safety |
| **Deploy** | Vercel + Docker | Flexible deployment options |

---

## 📁 NPM Scripts Reference

| Script | Description |
|--------|-------------|
| `npm run dev` | Start frontend dev server |
| `npm run dev:all` | Start both frontend & backend |
| `npm run dev:server` | Start backend only |
| `npm run dev:web` | Start frontend only |
| `npm run build` | Build all packages for production |
| `npm run test` | Run all test suites |
| `npm run test:engine` | Run engine tests |
| `npm run test:server` | Run server tests |
| `npm run lint` | Lint all TypeScript files |
| `npm run format` | Format code with Prettier |

---

## 🔐 Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `SUPABASE_URL` | ✅ | Supabase project URL |
| `SUPABASE_ANON_KEY` | ✅ | Supabase anonymous key |
| `SUPABASE_SERVICE_ROLE_KEY` | ⚠️ Server only | Supabase admin key |
| `VITE_SUPABASE_URL` | ✅ | Frontend Supabase URL |
| `VITE_SUPABASE_ANON_KEY` | ✅ | Frontend Supabase key |
| `VITE_API_URL` | ✅ | Backend API endpoint |
| `PORT` | Optional | Server port (default: `3001`) |
| `HOST` | Optional | Server host (default: `0.0.0.0`) |
| `NODE_ENV` | Optional | Environment (`development`/`production`) |

---

## 📄 License

This project is **private** and proprietary to [Arovave](https://arovave.in).

---

<p align="center">
  <sub>Built with ❤️ by the Arovave team</sub>
</p>
