# Backend — AI Social Media Agent

## Kya Naya Hai Is Version Mein
- `content_agent.py` ab IMAGE dekh kar caption/hashtags likhta hai (Vision)
- `scheduler.py` — abhi placeholder "best time" deta hai (Phase 4 mein real banega)
- `main.py` mein naye endpoints: `/api/analyze-image`, `/api/best-time`, `/api/posts` (save karne ke liye)

## Setup (Aap Already In Steps Pe Hain)

Aap already `backend` folder bana chuki hain aur `venv` activate kar chuki hain.
Ab bas ye files is folder ke andar daalni hain, phir:

```
pip install -r requirements.txt
copy .env.example .env
```

Phir `.env` file kholo aur apni Anthropic API key dalo.

```
uvicorn app.main:app --reload
```

Backend chalega: `http://localhost:8000`
Test karne ke liye: `http://localhost:8000/docs`

## Frontend Se Connect Karna

Frontend ka `utils/api.js` update hoga taake:
- `/api/generate-content` ki jagah `/api/analyze-image` (image ke sath) call ho
- `/api/create-and-publish` ki jagah `/api/posts` (save karne ke liye) call ho

Iska agla prompt Antigravity ke liye main next message mein dunga.
