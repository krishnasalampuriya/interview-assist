# Interview Assist

Interview Assist is a lightweight live coding interview assistant for engineering managers and senior engineers.

V1 is a no-login demo app where an interviewer pastes a candidate resume and job description, gets 3 role-fit coding question recommendations from a curated RAG-style question bank, shares a candidate link, watches the candidate code live, and generates an AI evaluation report.

Resume and job description input supports both direct text paste and document upload. The backend extracts text from PDF, DOCX, TXT, MD, CSV, JSON, and RTF-style plain text files.

## Project Structure

```text
backend/   FastAPI API, WebSocket room manager, question recommendation services
frontend/  React + Vite + TypeScript UI
docs/      Product plan and implementation notes
```

## V1 Decisions

- FastAPI backend
- React/Vite frontend
- JSON question bank with deterministic retrieval
- LangGraph recommendation workflow
- Gemini for resume/JD interview planning, coding-question reranking, discussion questions, and final evaluation
- No login
- No real code execution

See the full plan in [docs/product-plan.md](docs/product-plan.md).

## Question Bank

The initial bank lives in [backend/data/questions.json](backend/data/questions.json). It contains 30 free LeetCode questions: 10 easy, 10 medium, and 10 hard.

Only public metadata is stored from LeetCode: problem id, title slug, URL, difficulty, acceptance rate, paid-only flag, and topic tags. Full LeetCode statements and official sample cases are not copied.

## Backend

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env
uvicorn app.main:app --reload --port 8000
```

Health endpoint:

```text
http://localhost:8000/health
```

Question endpoints:

```text
GET  http://localhost:8000/api/questions
POST http://localhost:8000/api/documents/extract-text
POST http://localhost:8000/api/recommendations/questions
POST http://localhost:8000/api/interviews
GET  http://localhost:8000/api/interviews/{session_id}
POST http://localhost:8000/api/interviews/{session_id}/select-question
POST http://localhost:8000/api/interviews/{session_id}/candidate
POST http://localhost:8000/api/interviews/{session_id}/end
POST http://localhost:8000/api/interviews/{session_id}/evaluate
WS   ws://localhost:8000/ws/interviews/{session_id}
```

## Frontend

```powershell
cd frontend
npm install
npm run dev
```

Frontend URL:

```text
http://localhost:5173
```

Candidate room preview:

```text
http://localhost:5173/candidate/demo-session
```

## Public Deployment

Recommended v1 deployment is Vercel for the `frontend` folder and Render for the `backend` folder. See [docs/deployment-plan.md](docs/deployment-plan.md).
