# 🧮 Arovave Marketing Calculator

> **Dynamic Deterministic Pricing Engine Platform** — A powerful, admin-configurable calculator system for generating instant pricing quotes across product categories.

![Node.js](https://img.shields.io/badge/Node.js-≥20.0-339933?logo=node.js&logoColor=white)
![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-6-646CFF?logo=vite&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-Cloud-3ECF8E?logo=supabase&logoColor=white)
![Vercel](https://img.shields.io/badge/Deployed_on-Vercel-000?logo=vercel&logoColor=white)

---

## 📋 Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Features](#features)
- [Formula Engine](#formula-engine)
- [Deployment](#deployment)
- [Environment Variables](#environment-variables)

---

## Overview

Arovave Marketing Calculator is a **no-code pricing tool** that lets administrators build complex, multi-formula calculators through a visual drag-and-drop interface. Sales teams use the customer-facing side to generate instant price quotes by selecting product categories, filling inputs, and viewing real-time calculated results.

### Key Highlights

- 🏗️ **Admin Panel** — Visual calculator builder with drag-and-drop formula construction
- 💰 **Sales Page** — Clean, customer-facing calculator with category navigation
- 🌳 **Category Tree** — Unlimited nested categories for organizing calculators
- 📊 **Formula Chaining** — Reference results of one formula in another
- 🔢 **Precision Math** — Uses `Decimal.js` for exact financial calculations (no floating-point errors)
- ☁️ **Cloud Sync** — Real-time data persistence via Supabase with localStorage fallback
- 📄 **PDF Quotations** — Generate downloadable quote documents

---

## Architecture

```
┌─────────────────────────────────────────────────┐
│                   Monorepo Root                  │
│                (npm workspaces)                  │
├─────────────┬──────────────┬────────────────────┤
│  packages/  │  packages/   │    packages/       │
│   engine    │   server     │      web           │
│  (shared    │  (API layer) │  (React SPA)       │
│   types)    │              │                    │
└─────────────┴──────────────┴────────────────────┘
                                      │
                              ┌───────┴────────┐
                              │                │
                         Admin Panel     Sales Page
                         /admin          /
```

### Data Flow

```
Admin builds calculator → Zustand Store → Supabase (cloud)
                                ↓
Sales user opens page → Store hydrates from Supabase → 
User fills inputs → Formula Engine evaluates → Results displayed
```

---

## Tech Stack

| Layer         | Technology                                          |
|---------------|-----------------------------------------------------|
| **Frontend**  | React 18 + TypeScript 5 + Vite 6                   |
| **Styling**   | Tailwind CSS 3                                      |
| **State**     | Zustand 5 (with persist middleware)                 |
| **Math**      | Decimal.js (arbitrary-precision arithmetic)         |
| **Database**  | Supabase (PostgreSQL + real-time)                   |
| **Icons**     | Lucide React                                        |
| **Forms**     | React Hook Form + Zod validation                    |
| **PDF**       | jsPDF                                               |
| **Routing**   | React Router DOM 7                                  |
| **Deploy**    | Vercel                                              |

---

## Project Structure

```
arovave.in calculator/
├── packages/
│   ├── engine/              # Shared types & calculation logic
│   ├── server/              # Backend API (Fastify)
│   └── web/                 # React frontend (main app)
│       └── src/
│           ├── components/
│           │   ├── admin/
│           │   │   ├── CategoryTree.tsx         # Nested category manager
│           │   │   ├── InputHub.tsx             # Centralized input definitions
│           │   │   ├── DragDropCalculatorBuilder.tsx  # Formula builder UI
│           │   │   └── RateManager.tsx          # Rate management
│           │   └── QuotationModal.tsx           # PDF quote generator
│           ├── pages/
│           │   ├── admin/                       # Admin panel pages
│           │   ├── auth/                        # Authentication
│           │   └── sales/
│           │       └── SalesCalculator.tsx       # Customer-facing calculator
│           ├── stores/
│           │   └── templateStore.ts             # Central state + calculation engine
│           └── types/
│               └── calculator.ts                # TypeScript type definitions
├── docker-compose.yml
├── vercel.json
└── package.json              # Workspace root
```

---

## Getting Started

### Prerequisites

- **Node.js** ≥ 20.0
- **npm** ≥ 9.0
- A **Supabase** project (free tier works)

### Installation

```bash
# 1. Clone the repository
git clone <repo-url>
cd arovave.in-calculator

# 2. Install dependencies (all workspaces)
npm install

# 3. Set up environment variables
cp .env.example .env
# Edit .env with your Supabase credentials

# 4. Start development server
npm run dev
```

The app will be available at `http://localhost:5173`

### Available Scripts

| Command              | Description                              |
|----------------------|------------------------------------------|
| `npm run dev`        | Start web frontend dev server            |
| `npm run dev:server` | Start backend API server                 |
| `npm run dev:all`    | Start both frontend and backend          |
| `npm run build`      | Production build (all packages)          |
| `npm run lint`       | Run ESLint across all packages           |
| `npm run format`     | Format code with Prettier                |
| `npm run test`       | Run test suites                          |

---

## Features

### 🏗️ Admin Panel (`/admin`)

#### Category Tree

- Unlimited nesting of product categories
- Drag-to-reorder support
- Each leaf category can have one calculator assigned

#### Input Hub

Centralized input definitions shared across all calculators:

| Input Type        | Description                                          |
|-------------------|------------------------------------------------------|
| **Number**        | Numeric field with a default rate                    |
| **Dropdown**      | Select from predefined options, each with a rate     |
| **Fixed**         | Hidden constant value used in calculations           |
| **Reference List**| Multilevel tree of categories with leaf-node rates   |

#### Calculator Builder

- **Drag-and-drop** formula construction
- **Operator support**: `+`, `-`, `×`, `÷`, `%`
- **Formula chaining**: Reference results of earlier formulas
- **Brackets**: Full support for `(` `)` grouping
- **Save/Edit/Discard** workflow with snapshot-based undo
- **Formula settings**: Round results, min/max clamping, hide from sales page
- **Preview & Reorder**: Arrange how inputs and formulas appear to users

#### Additional Features

- **Local Rates** — Calculator-specific rate overrides
- **Profit %** — Auto-add profit margin on subtotal
- **GST %** — Auto-add tax on (subtotal + profit)
- **Discount Range** — Allow sales team to apply configurable discounts
- **Charge Calculators** — Additional charges linked to a parent calculator

### 💰 Sales Page (`/`)

- Category browsing with breadcrumb navigation
- Real-time calculation as inputs change
- Expandable charge sections
- Extra charge lines (manual additions)
- Grand total with optional grand discount
- **PDF Quotation** generation

---

## Formula Engine

The calculation engine lives in `templateStore.ts` and uses a **Shunting-Yard algorithm** for expression evaluation with **Decimal.js** precision.

### How It Works

1. **Inputs are resolved** → Each input's value (user-entered or rate) is mapped to its ID
2. **Formulas are topologically sorted** → Dependencies (`formula_ref`) are always evaluated first
3. **Tokens are evaluated** → Shunting-yard converts infix tokens to result via operator precedence
4. **Post-processing** → Rounding, min/max clamping applied per formula

### Operator Precedence

| Precedence | Operators      | Description         |
|------------|----------------|---------------------|
| 2 (high)   | `×` `*` `÷` `/`| Multiplication, Division |
| 1 (low)    | `+` `-`        | Addition, Subtraction    |
| Postfix    | `%`            | Divide by 100 (percentage) |

### Formula Chaining Example

```
Formula 1: "Area"     = Length × Width           → 24
Formula 2: "Cost"     = [Area] × Rate_per_sqft   → 24 × 7 = 168
Formula 3: "Pipe"     = 2 × (Length + Width)      → 22
Formula 4: "Structure"= MS_Pipe × [Pipe]          → 9 × 22 = 198
```

Formulas are **dependency-aware** — even if "Structure" is listed before "Pipe" in the UI, the engine will compute "Pipe" first because "Structure" references it.

### Percentage Operator

The `%` operator is **unary postfix** — it divides the preceding value by 100:

```
10 × 15 %  →  10 × 0.15  =  1.5
100 + 18 % →  100 + 0.18  =  100.18
```

---

## Deployment

### Vercel (Recommended)

The app is configured for Vercel deployment:

```json
// vercel.json
{ "buildCommand": "vite build" }
```

**Vercel Settings:**

| Setting           | Value            |
|-------------------|------------------|
| Framework Preset  | Vite             |
| Root Directory    | `packages/web`   |
| Build Command     | `vite build`     |
| Output Directory  | `dist`           |

> **Note:** Enable "Include files outside root directory" in Vercel settings since the web package references the workspace root.

### Docker

```bash
# Build and start all services
docker-compose up --build

# Or build individually
docker build -f Dockerfile.web -t arovave-web .
docker build -f Dockerfile.server -t arovave-server .
```

---

## Environment Variables

| Variable                    | Description                     | Required |
|-----------------------------|---------------------------------|----------|
| `VITE_SUPABASE_URL`        | Supabase project URL            | ✅       |
| `VITE_SUPABASE_ANON_KEY`   | Supabase anonymous key          | ✅       |
| `VITE_API_URL`             | Backend API URL                 | Optional |
| `DATABASE_URL`             | PostgreSQL connection string    | Server   |
| `SUPABASE_SERVICE_ROLE_KEY`| Supabase service role key       | Server   |
| `PORT`                     | Server port (default: 3001)     | Server   |

---

## Data Persistence

The app uses a **dual-layer persistence** strategy:

1. **localStorage** (via Zustand persist) — Instant hydration on page load
2. **Supabase** — Cloud sync for cross-device access and data durability

On startup, the store hydrates from localStorage first (instant), then fetches the latest state from Supabase. Changes are auto-synced to Supabase in the background.

---

## License

Private — ©2026 Arovave. All rights reserved.
"# arovave_markiting_calculator" 
