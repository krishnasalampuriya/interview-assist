# Interview Assist - Product Plan

## Project Idea

Interview Assist is a lightweight live coding interview assistant for engineering managers and senior engineers.

The core problem is that interviewers often join interviews without a well-matched coding question ready. This leads to repeated old questions, questions that are too easy for senior candidates, or questions that are too hard for freshers.

The app helps an interviewer quickly create a role-specific live coding interview by using:

- Candidate resume content
- Job description content
- A curated coding question bank
- A structured LLM-generated interview plan before retrieval
- LangGraph orchestration for the recommendation workflow
- Semantic search over question metadata
- LLM-based recommendation and final evaluation
- Resume-based non-coding discussion questions for the interviewer

The goal for the first version is a simple, polished demo project suitable for personal use and LinkedIn showcase.

## V1 Product Scope

V1 will be simple, no-login, and session-link based.

### Interviewer Flow

1. Interviewer opens the app.
2. Interviewer pastes candidate resume text or uploads a resume document.
3. Interviewer pastes job description text or uploads a JD document.
4. Backend analyzes the resume and JD.
5. App suggests 3-4 resume-based discussion questions for the interviewer.
6. App recommends 3 suitable coding questions.
7. Interviewer selects one coding question.
8. App creates a candidate link.
9. Interviewer shares the link with the candidate.
10. Interviewer watches the candidate code live.
11. Interviewer can add notes during the interview.
12. Interviewer ends the interview.
13. App generates a final AI evaluation report.

### Candidate Flow

1. Candidate opens the shared interview link.
2. Candidate enters their name.
3. Candidate sees the selected question, sample test cases, language selector, editor, and timer.
4. Candidate writes Python, C++, or pseudocode.
5. Candidate can submit when done, or interviewer can end the session.

### Final Report

The final report should include:

- Overall score
- Problem-solving assessment
- Code quality assessment
- Correctness assessment
- Edge cases missed
- Complexity discussion
- Strengths
- Concerns
- Suggested follow-up questions
- Interviewer notes

### Resume-Based Discussion Questions

Before the coding round starts, the interviewer should see 3-4 non-coding questions generated from the candidate resume and JD.

These questions should help the interviewer quickly probe:

- Candidate project depth
- Claimed skills and real usage
- Architecture and design ownership
- Debugging or production experience
- Role-specific experience from the JD
- Gaps, transitions, or unusually strong claims in the resume

These are separate from coding questions and are meant for live conversation during the first few minutes of the interview.

## Intentional V1 Non-Goals

These are intentionally excluded from the first version:

- User login
- Organization/team management
- Payment or SaaS features
- Real code execution
- Docker or sandboxed runners
- Video/audio calling
- PDF resume upload
- Large production database

The app may show sample test cases visually, but candidate code will not be executed in v1. The final evaluation will be LLM-based.

## Recommended Tech Stack

### Backend

- FastAPI
- Python
- REST endpoints for interview creation, recommendation, question selection, and final evaluation
- FastAPI WebSockets for live code sync
- JSON question bank
- In-memory embedding cache
- SQLite optional for saved sessions/reports

### Frontend

- React
- TypeScript
- Vite
- Tailwind CSS
- shadcn/ui
- Monaco Editor

### AI/RAG

V1 will use a simple RAG-style recommendation system:

1. Store curated coding questions in a JSON file.
2. Each question has metadata such as skills, difficulty, role tags, target seniority, sample test cases, and evaluation rubric.
3. LangGraph orchestrates the recommendation workflow.
4. LLM reads resume and JD and creates a structured interview plan/search profile.
5. Backend retrieves matching questions from the question bank using the structured plan and question metadata.
6. Embedding search can replace or augment metadata retrieval after the first public demo.
7. LLM reranks the best matches and returns the top 3 with explanations.

This is preferred over generating questions entirely at runtime because curated questions improve quality, trust, consistency, and demo credibility.

### LangGraph Recommendation Flow

The recommendation workflow should be implemented as a LangGraph graph:

```text
resume + JD
  -> create_interview_plan
  -> retrieve_coding_questions
  -> rerank_coding_questions
  -> generate_discussion_questions
  -> response
```

The interview plan should be structured data, for example:

```json
{
  "candidate_level": "mid",
  "target_difficulty": "medium",
  "role_type": "backend",
  "primary_skills": ["python", "fastapi", "sql", "api design"],
  "secondary_skills": ["testing", "debugging", "system design"],
  "avoid_topics": ["advanced dynamic programming"],
  "coding_question_focus": ["hash maps", "arrays", "strings"],
  "discussion_question_focus": ["production debugging", "API ownership"]
}
```

For the first working implementation, `create_interview_plan`, `rerank_coding_questions`, and `generate_discussion_questions` call the LLM when a key is configured and fall back to deterministic logic if the LLM is unavailable.

## Question Bank Shape

Example question format:

```json
{
  "id": "arrays-two-pointer-001",
  "title": "Merge Overlapping Intervals",
  "difficulty": "medium",
  "target_levels": ["fresher", "mid"],
  "skills": ["arrays", "sorting", "edge cases"],
  "role_tags": ["backend", "fullstack", "sde"],
  "time_limit_minutes": 30,
  "description": "Given a list of intervals, merge all overlapping intervals.",
  "sample_test_cases": [
    {
      "input": "[[1,3],[2,6],[8,10]]",
      "expected_output": "[[1,6],[8,10]]"
    }
  ],
  "expected_approach": "Sort intervals by start time, then scan and merge overlapping intervals.",
  "evaluation_rubric": [
    "Handles overlapping intervals",
    "Handles non-overlapping intervals",
    "Handles empty input",
    "Explains time and space complexity"
  ]
}
```

## Backend API Sketch

Initial endpoints:

- `POST /api/interviews`
  - Create an interview draft from resume text and JD.

- `POST /api/interviews/{interview_id}/recommend-questions`
  - Analyze resume/JD and return 3 recommended questions.

- `POST /api/interviews/{interview_id}/discussion-questions`
  - Analyze resume/JD and return 3-4 non-coding interviewer questions.

- `POST /api/interviews/{interview_id}/select-question`
  - Save the selected question and prepare the candidate session.

- `GET /api/interviews/{interview_id}`
  - Fetch interview state.

- `POST /api/interviews/{interview_id}/evaluate`
  - Generate final evaluation from question, code, language, and interviewer notes.

- `WebSocket /ws/interviews/{interview_id}`
  - Sync candidate code, language, timer/status, and events between candidate and interviewer views.

## Frontend Screens

### Interviewer Setup Screen

- Resume text input
- JD text input
- Resume/JD upload with text extraction
- Generate questions button
- Loading/progress state

### Resume Discussion Questions Screen or Panel

- 3-4 suggested non-coding questions
- Reason each question is worth asking
- Resume/JD signal behind the question

### Question Recommendation Screen

- 3 recommended question cards
- Difficulty, skills tested, time estimate
- Why this question fits the candidate
- Select question action

### Interviewer Live Room

- Candidate link copy control
- Selected question
- Live code editor in read-only or observation mode
- Candidate status
- Timer and initial duration override
- Interviewer notes
- End interview button
- Final report panel

### Candidate Room

- Candidate name entry
- Selected question
- Sample test cases
- Language selector: Python, C++, Pseudocode
- Monaco code editor
- Timer
- Live status

## Implementation Checklist

### Phase 1 - Project Skeleton

- [x] Create backend FastAPI project
- [x] Create frontend React/Vite project
- [x] Add basic README and env example
- [x] Add shared project structure

### Phase 2 - Question Bank and Recommendation

- [x] Create `backend/data/questions.json`
- [x] Add 20-30 curated coding questions
- [x] Implement question loading
- [x] Implement simple keyword-based recommendation service
- [x] Introduce LangGraph workflow wrapper for recommendations
- [x] Implement deterministic interview plan fallback
- [x] Implement LLM candidate/JD signal extraction
- [x] Replace fallback planner with LLM-generated structured plan
- [ ] Replace keyword scoring with embedding search
- [x] Add LLM reranking of retrieved questions
- [x] Implement top 3 recommendation endpoint
- [x] Connect interviewer UI to recommendation endpoint
- [x] Implement resume-based discussion question generation
- [x] Show 3-4 discussion questions in interviewer UI

Current recommendation behavior with Gemini configured:

- LangGraph first asks Gemini to create a structured interview plan from resume and JD.
- The backend retrieves candidate coding questions from the JSON bank using deterministic scoring.
- Gemini reranks the retrieved candidates and chooses the final 3 questions.
- Gemini generates 4 resume/JD-specific non-coding discussion questions.
- Deterministic fallback remains available if Gemini is unavailable.

Current v1 recommendation behavior:

- Tokenizes resume and JD text.
- Infers a rough seniority and matching difficulty when possible.
- Scores questions by skill, role tag, difficulty, target level, title, and summary overlap.
- Returns the top 3 questions with fit reasons and extracted signals.
- This is intentionally a working first pass before embeddings and LLM reranking.

### Phase 3 - Interview Session

- [x] Create interview session model
- [x] Implement session creation endpoint
- [x] Implement selected-question endpoint
- [x] Generate candidate link
- [x] Store in memory or SQLite for v1
- [x] Add interviewer-controlled initial timer duration
- [x] Add candidate name capture
- [x] Add end-interview endpoint

### Phase 4 - Live Coding Room

- [x] Implement FastAPI WebSocket room manager
- [x] Candidate sends code updates
- [x] Interviewer receives code updates live
- [x] Sync language and session status
- [x] Add timer state
- [x] Add Monaco editor in candidate room

### Phase 5 - LLM Evaluation

- [x] Implement final evaluation prompt
- [x] Include question rubric, expected approach, candidate code, language, and notes
- [x] Return structured final report
- [x] Display report in interviewer UI
- [x] Test final evaluation with Gemini API key

### Phase 6 - Polish for LinkedIn Demo

- [x] Make interviewer and candidate views visually polished
- [ ] Add realistic sample data
- [ ] Add loading and empty states
- [x] Add one-click copy for candidate link
- [ ] Add demo-friendly final report
- [ ] Record or prepare demo flow
- [x] Add public deployment plan

## Future Version Ideas

- Broader document extraction formats beyond PDF, DOCX, and plain-text files
- Real Python code execution
- Secure Docker-based runner
- Larger question bank
- ChromaDB or Postgres vector search
- LangGraph workflow for multi-step AI recommendation
- Login and saved interview history
- Company/team workspace
- Candidate anti-cheating signals
- Export report as PDF
- Video-call integrations
- More programming languages

## Current Decisions

- Build for personal showcase first, not SaaS.
- Use FastAPI because it matches current backend experience.
- Use React/Vite/Tailwind/shadcn/ui for polished frontend.
- Use Monaco Editor for candidate code editing.
- No login in v1.
- No real code execution in v1.
- Use LangGraph in v1 for recommendation workflow orchestration.
- Use JSON question bank plus metadata retrieval in v1; add embeddings later if recommendation quality needs it.
- Use an LLM-generated interview plan before RAG retrieval when LLM integration is enabled.
- Use LLM for candidate/JD understanding, reranking, and final evaluation.
- Generate separate non-coding discussion questions from resume/JD for the interviewer.
- Let the interviewer override the initial timer before selecting the coding question.
- Deploy v1 as a public demo with Vercel frontend and Render backend.

## Question Bank Source Notes

- The initial question bank contains 30 free LeetCode questions: 10 easy, 10 medium, and 10 hard.
- Public metadata was fetched from LeetCode on 2026-07-16 using its GraphQL endpoint.
- Stored LeetCode metadata includes problem id, title slug, public URL, difficulty, acceptance rate, paid-only flag, and topic tags.
- Full LeetCode problem statements and official sample test cases are intentionally not copied into this repository.
- Interview summaries, expected approaches, and rubrics are original project metadata written for this app.
