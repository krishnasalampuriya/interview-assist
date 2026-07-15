# Interview Assist - Public Deployment Plan

## Recommended V1 Hosting

Use two hosted services for the first public demo:

- Frontend: Vercel, because the React/Vite app is static after build and Vercel has a simple custom-domain flow.
- Backend: Render Web Service, because it can run the FastAPI app as a long-running ASGI service with WebSocket support.

This keeps the Gemini API key only on the backend. Never put `GEMINI_API_KEY` in the frontend environment.

## Frontend Deployment

Host the `frontend` folder on Vercel.

The `frontend` folder includes `vercel.json` with a single-page app rewrite so direct candidate links such as `/candidate/{session_id}` open correctly in production.

Recommended settings:

- Framework preset: Vite
- Root directory: `frontend`
- Install command: `npm install`
- Build command: `npm run build`
- Output directory: `dist`

Environment variable:

```text
VITE_API_BASE_URL=https://your-backend-service.onrender.com
```

After deployment, Vercel will provide a `vercel.app` URL. A custom domain can be added later from Vercel Domains.

## Backend Deployment

Host the `backend` folder on Render as a Web Service.

Recommended settings:

- Runtime: Python
- Root directory: `backend`
- Build command: `pip install -r requirements.txt`
- Start command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`

Environment variables:

```text
GEMINI_API_KEY=your-real-key
GEMINI_MODEL=gemini-3.1-flash-lite
FRONTEND_BASE_URL=https://your-frontend-domain.com
CORS_ORIGINS=["https://your-frontend-domain.com","https://your-vercel-preview-url.vercel.app"]
```

Render will provide an `onrender.com` URL. If you want a branded API URL later, add something like `api.yourdomain.com` as a Render custom domain.

## Custom Domain Shape

Recommended public URLs:

```text
https://interview-assist.yourdomain.com       Frontend
https://api.interview-assist.yourdomain.com   Backend, optional
```

For the LinkedIn demo, it is fine to start with:

```text
https://your-project.vercel.app
https://your-backend-service.onrender.com
```

## Important V1 Limitation

Interview sessions are currently stored in memory. That is fine for a first public demo, but sessions will disappear if the backend restarts or scales to multiple instances.

Before a serious public launch, add SQLite/Postgres persistence for:

- Interview sessions
- Candidate code snapshots
- Interviewer notes
- Final evaluation reports

## Go-Live Checklist

- [ ] Push repo to GitHub.
- [ ] Deploy backend on Render.
- [ ] Add backend env vars on Render.
- [ ] Deploy frontend on Vercel.
- [ ] Add `VITE_API_BASE_URL` on Vercel.
- [ ] Update backend `FRONTEND_BASE_URL` and `CORS_ORIGINS` after frontend URL is known.
- [ ] Test one full live interview flow on production URLs.
- [ ] Add a custom domain once the demo URL works.
- [ ] Add basic persistence before sharing widely.
