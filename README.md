# Pibot Chat

Simple open-source AI chat app with separate frontend and backend.

## What this project contains

- `frontend/`: React + Vite chat UI
- `backend/`: Node.js + Express API server

## Features

- Multi-chat sidebar (create, rename, delete)
- Streaming AI responses
- Markdown and code block rendering
- Search in current chat
- Built-in full-screen code sandbox (HTML/CSS/JS editor + live output)
- Light and dark theme

## What is used here

- Chat history and app state are stored in browser localStorage
- NVIDIA API key is used from backend env file
- Sandbox runs code in a sandboxed iframe with Monaco editor

## Setup

1. Backend

```bash
cd backend
npm install
```

Create `backend/.env` and add:

```env
NVIDIA_API_KEY=your_key_here
```

Run backend:

```bash
npm run dev
```

2. Frontend

```bash
cd frontend
npm install
npm run dev
```

## Notes

- Frontend default runs on `http://localhost:5173`
- Backend runs on `http://localhost:5188`
- Frontend uses `VITE_API_BASE_URL` to call backend
