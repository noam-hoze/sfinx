# **Sfinx AI — Autonomous Technical Screening Interviewers**

Sfinx is an open-source, AI-powered autonomous technical screening interviewer system. It conducts, scores, and ranks technical candidates automatically, delivering consistent, scalable screening interviews that replicate hiring-manager judgment while significantly reducing time spent on early-stage assessments.

<img width="1408" height="706" alt="Sfinx Platform Preview" src="https://github.com/user-attachments/assets/0a5712cd-2491-4552-ac49-ca6e841c28c9" />

---

## 🌟 Key Capabilities

- **🎙️ Real-time Voice & Dialogue Engine**: Utilizes OpenAI Realtime API and Chat Completions for low-latency conversational interviews with adaptive follow-up questioning.
- **🧠 Dynamic Reasoning Pipeline**: Analyzes candidate answers in real time, assembling persona context, dialogue history, and job criteria for structured interviewer decision-making.
- **📊 Candidate Evaluation & Ranking Engine**: Multi-metric scoring system assessing technical correctness, problem-solving depth, communication clarity, and paste/integrity metrics.
- **🏢 Hiring Manager & Company Dashboard**: Review candidate rankings, view detailed stage breakdowns, inspect interview transcripts, and configure custom job criteria.
- **⚙️ Modular Feature Flagging**: Selectively enable or disable optional integrations like Rive mascot animations (`NEXT_PUBLIC_MASCOT_ENABLED`) or ElevenLabs TTS (`NEXT_PUBLIC_TTS_ENABLED`).

---

## 🏗️ Architecture & Tech Stack

Sfinx is built as a unified single-repo Next.js App Router application:

- **Framework**: [Next.js](https://nextjs.org/) (App Router, React 18/19, TypeScript)
- **Database & ORM**: [Prisma ORM](https://www.prisma.io/) with Neon PostgreSQL
- **Authentication**: NextAuth.js (Credentials & Google OAuth providers)
- **Styling**: Tailwind CSS & Framer Motion
- **AI Integration**: OpenAI Realtime API & Chat Completions (`gpt-4o-mini`, `o4-mini`)
- **Voice & Animation**: ElevenLabs TTS & Rive WebGL Interactive Mascot
- **Testing**: Vitest (Unit/Integration) & Playwright (E2E)

---

## 🚀 Quick Start Guide

### Prerequisites

- **Node.js**: Version 20 (see [.nvmrc](file:///.nvmrc)). Run `nvm use 20` if using Node Version Manager.
- **Package Manager**: `pnpm` (v10+ recommended).

### 1. Clone the Repository

```bash
git clone https://github.com/noam-hoze/sfinx.git
cd sfinx
```

### 2. Install Dependencies

```bash
pnpm install
```

### 3. Environment Configuration

Copy the template environment configuration file to `.env.local`:

```bash
cp .env .env.local
```

Edit `.env.local` to provide your OpenAI API key and local configuration. Minimum required variables:

```env
OPENAI_API_KEY="your-openai-api-key"
DATABASE_URL="postgresql://user:password@localhost:5432/sfinx?sslmode=require"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-generated-nextauth-secret"
```

### 4. Database Setup & Seeding

Generate the Prisma client, push the schema to your database, and seed the initial company and candidate data:

```bash
# Generate Prisma Client
npx prisma generate

# Push database schema
pnpm db:push:dev

# Seed database with demo company and candidate data
pnpm setup:companies:dev
```

### 5. Launch Development Server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🔑 Default Credentials & Authentication

- **Pre-seeded Candidate Account**:
  - **Email**: `noam.hoze@gmail.com`
  - **Password**: `sfinx`
- **Self Registration**:
  - You can also register a fresh test candidate account anytime at [http://localhost:3000/signup](http://localhost:3000/signup).

---

## ⚙️ Environment Variables Reference

| Environment Variable | Description | Default / Example |
| :--- | :--- | :--- |
| `OPENAI_API_KEY` | OpenAI API Key for real-time interview & evaluation models | `sk-proj-...` |
| `NEXT_PUBLIC_OPENAI_EVALUATION_MODEL` | Model used for candidate evaluation and scoring | `gpt-4o-mini` |
| `DATABASE_URL` | PostgreSQL database connection URL | `postgresql://...` |
| `NEXTAUTH_URL` | Canonical URL for NextAuth authentication redirects | `http://localhost:3000` |
| `NEXTAUTH_SECRET` | Secret key used to encrypt NextAuth JWT sessions | `random-secret-string` |
| `NEXT_PUBLIC_MASCOT_ENABLED` | Toggle Rive WebGL animated interviewer mascot | `false` |
| `NEXT_PUBLIC_TTS_ENABLED` | Toggle ElevenLabs Text-To-Speech voice synthesis | `false` |
| `ELEVENLABS_API_KEY` | (Optional) ElevenLabs API Key for voice generation | `sk_...` |
| `ELEVEN_LABS_CANDIDATE_VOICE_ID` | (Optional) ElevenLabs Voice ID | `wJqPPQ618aTW29mptyoc` |
| `NEXT_PUBLIC_USE_SPLIT_EVALUATION` | Enable ultra-fast 3-call next question generation pipeline | `true` |

---

## 🛠️ Key CLI Commands

| Command | Purpose |
| :--- | :--- |
| `pnpm dev` | Starts the Next.js development server on port 3000 |
| `pnpm build` | Generates Prisma client and builds production Next.js bundle |
| `pnpm lint` | Runs Next.js ESLint static analysis check |
| `pnpm test` | Runs unit & service test suites using Vitest |
| `pnpm db:push:dev` | Pushes Prisma schema changes to dev database |
| `pnpm setup:companies:dev` | Syncs schema and populates test company & candidate seeds |
| `pnpm studio:dev` | Opens Prisma Studio GUI for database inspection |

---

## 📁 Repository Overview

```
sfinx/
├── app/                  # Next.js App Router (pages, API routes, components)
│   ├── (features)/       # Feature slices (interview, company-dashboard)
│   ├── api/              # Backend API handlers (interviews, scoring, tts)
│   └── shared/           # Cross-cutting components, contexts, & services
├── server/               # Server-side business logic, Prisma schema & db-scripts
├── shared/               # Shared utilities, types, and domain services
├── docs/                 # System architecture, specs, and feature documentation
├── public/               # Static images and web assets
├── package.json          # Dependencies and script definitions
└── README.md             # Open-source project documentation
```

---

## 🤝 Contributing

Contributions are welcome! Please feel free to open an issue or submit a pull request for improvements, bug fixes, or new interviewer capabilities.

---

## 📄 License

This project is licensed under the MIT License.

---

## 👤 Author & Contact

- **Noam Hoze**
- **LinkedIn**: [linkedin.com/in/noam-hoze](https://linkedin.com/in/noam-hoze)
