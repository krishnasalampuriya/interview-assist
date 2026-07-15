# Interview Assist Backend

FastAPI backend for the Interview Assist app.

## Local Setup

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env
uvicorn app.main:app --reload --port 8000
```

Health check:

```text
http://localhost:8000/health
```
