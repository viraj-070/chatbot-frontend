# Pibot Chat

Simple React chat app with a separate Node backend proxy for Nvidia models.

## Setup

1. Install frontend packages:
`npm install`

2. Install backend packages:
`npm --prefix backend install`

3. Create backend env file:
Copy `backend/.env.example` to `backend/.env`

4. Add your Nvidia key in `backend/.env`:
`NVIDIA_API_KEY=your_key_here`

## Run

1. Start backend:
`npm run dev:backend`

2. Start frontend:
`npm run dev`

Frontend runs on `http://localhost:5173`.
Backend runs on `http://localhost:5188`.
