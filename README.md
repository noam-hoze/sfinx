# **Sfinx AI — Autonomous Technical Screening Interviewers**

Sfinx is an AI system that conducts, scores, and ranks technical candidates automatically. It delivers consistent, scalable screening interviews that replicate hiring-manager judgment and reduce time spent on early-stage assessments.

<img width="1408" height="706" alt="image" src="https://github.com/user-attachments/assets/0a5712cd-2491-4552-ac49-ca6e841c28c9" />

## **Demo Flow — `/interview` Page**

* **Session Initialization**

  * Creates a new interview session, loads the interviewer persona, and opens a streaming Realtime API connection.

* **Voice Interaction Loop**

  * Candidate speaks; audio is streamed to the model.
  * The interviewer responds in real time with adaptive, context-aware follow-ups.
  * The UI displays transcripts and maintains session state.

* **Dynamic Reasoning Layer**

  * Each turn is processed through the structured-reasoning pipeline.
  * Follow-up questions depend on candidate answers and retrieved context.

* **Scoring Output**

  * At the end of the session, a scoring pass is triggered.
  * Generates a structured evaluation summary and ranking score displayed in the UI.

---

## **Overview**

* Built as a **Next.js application** serving both the frontend UI and backend API routes.
* Provides autonomous interviewer agents for technical roles.
* Supports real-time dialogue, adaptive questioning, and structured scoring.
* Outputs standardized evaluation summaries and rankings for hiring teams.

---

## **Architecture**

* **Next.js (App Router)** as the core framework:

  * Frontend pages, interactive UI, and candidate interface
  * API routes for interview orchestration, scoring, and retrieval
  * Server Actions for secure model-calling and data operations
* Backend logic implemented within Next.js using Node/TypeScript and Python microservices where needed.
* Data stored in Neon/PostgreSQL with a custom JSON vector index for retrieval.
* All components containerized with Docker and deployable on GCP Cloud Run.

---

## **Key Capabilities**

* **AI Interviewer Engine**

  * OpenAI Realtime API for low-latency conversation
  * Chat Completions for structured reasoning and interviewer follow-ups

* **Hybrid Retrieval System**

  * Embedding search (text-embedding-3-small)
  * BM25-style lexical scoring
  * Dynamic injection of manager preferences and prior interactions

* **Persona + Prompt Assembly**

  * Combines persona, few-shot interviewer examples, retrieved context, and dialogue history
  * Produces consistent role-specific interviewer behavior

* **Evaluation & Ranking Engine**

  * Assesses correctness, reasoning depth, clarity, and problem-solving
  * Generates standardized, comparable candidate scores

---

## **Tech Stack**

* Framework: **Next.js**, React, TypeScript
* Backend: Node.js, Python (auxiliary services)
* AI/ML: OpenAI Realtime API, Chat Completions, custom vector index
* Infra: Docker, Neon/Postgres, GCP Cloud Run

---

## **Local Development**

* Clone the repo
* Install dependencies (`npm install` or `pnpm install`)
* Configure environment variables (OpenAI keys, DB URL, etc.)
* Start development server (`npm run dev`)

---

## **Project Purpose**

* Standardize technical screening
* Reduce HR and engineering time spent on early-stage interviews
* Provide consistent, high-signal assessments at scale

---

## **Contact**

* Noam Hoze
* linkedin.com/in/noam-hoze
