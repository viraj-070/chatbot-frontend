# Pibot Chat ✌️

**An open-source interactive chat interface for AI chat system projects.**

This project is built to help you understand how modern AI chat interfaces work, featuring:

✨ **Real-time streaming responses** - See AI responses appear word by word  
💭 **Thinking UI indicators** - Beautiful loading states while AI processes  
🎨 **Syntax-highlighted code blocks** - Professional code rendering with copy functionality  
📊 **Rich content support** - Tables, lists, links, and formatted text using React Markdown  
🚀 **Clean architecture** - Separate frontend/backend for easy deployment

**Feel free to use this project** as a starting point for your own AI chat applications! Whether you're learning about streaming, building a chatbot, or creating an AI interface, this repo will help you get started.

**Contributions are welcome!** ✌️

## Project Structure

```
.
├── frontend/          # React frontend application
│   ├── src/          # Frontend source code
│   ├── public/       # Static assets
│   ├── .env          # Frontend environment variables
│   └── vercel.json   # Vercel deployment config
├── backend/          # Node.js Express backend
│   ├── index.js      # Backend server
│   └── .env          # Backend environment variables (API keys)
└── README.md
```

## Setup

### Backend Setup

1. Navigate to backend folder and install packages:

```bash
cd backend
npm install
```

2. Create backend env file:

```bash
copy .env.example .env
```

3. Get your free Nvidia API key:
   - Visit [Nvidia Build Platform](https://build.nvidia.com/settings/api-keys)
   - Search for any free AI model (like `meta/llama-3.1-8b-instruct`, `mistralai/mistral-7b-instruct`, etc.)
   - Click "Get API Key" to generate your key
   - Copy the generated API key

4. Add your Nvidia API key in `backend/.env`:

```
NVIDIA_API_KEY=your_key_here
```

You can also change the model in `backend/index.js` to any model you prefer from the platform!

### Frontend Setup

1. Navigate to frontend folder and install packages:

```bash
cd frontend
npm install
```

2. (Optional) Update frontend env file if needed:
   The frontend `.env` file is already configured to connect to `http://localhost:5188`.
   For production, update `VITE_API_BASE_URL` in Vercel environment variables.

## Run Development

1. Start backend (from root directory):

```bash
cd backend
npm run dev
```

2. Start frontend (from root directory in a new terminal):

```bash
cd frontend
npm run dev
```

- Frontend runs on `http://localhost:5173`
- Backend runs on `http://localhost:5188`

## Deployment

### Backend

Deploy the `backend/` folder to your preferred Node.js hosting service (Railway, Render, etc.)

### Frontend

The frontend is configured for Vercel deployment:

1. Connect your repository to Vercel
2. Set the root directory to `frontend`
3. Add environment variable in Vercel dashboard:
   - `VITE_API_BASE_URL` = your deployed backend URL

## Features in Detail

### 🎯 Streaming Responses

- Real-time Server-Sent Events (SSE) implementation
- Smooth text streaming with cursor animation
- Backward compatible with non-streaming responses

### 🎨 Code Blocks

- Syntax highlighting for all popular languages
- Copy-to-clipboard functionality with feedback
- Sticky header showing language name
- Dark theme using VS Code's color scheme

### 📝 React Markdown

- Full GFM (GitHub Flavored Markdown) support
- Custom styling for headings, lists, tables, and blockquotes
- Inline code snippets with orange accent
- Responsive and accessible

### 💡 UI/UX

- Clean, modern interface
- Thinking indicators for AI processing
- User messages in orange bubbles
- AI responses without backgrounds for better code visibility
- Auto-scroll to latest message

## Tech Stack

- **Frontend**: React + Vite
- **Styling**: Tailwind CSS
- **Markdown**: react-markdown + remark-gfm
- **Code Highlighting**: react-syntax-highlighter
- **Backend**: Node.js + Express
- **AI**: Nvidia AI API (supports multiple models)

## Contributing

Found a bug? Have an idea? Contributions are welcome!

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/cool-feature`)
3. Commit your changes (`git commit -m 'Add cool feature'`)
4. Push to the branch (`git push origin feature/cool-feature`)
5. Open a Pull Request

## License

Open source - feel free to use this project however you like!

## Notes

- Frontend uses environment variable `VITE_API_BASE_URL` to connect to backend
- No proxy configuration needed - direct API calls
- Backend handles all AI model configuration and API keys
- Frontend only sends messages and displays responses
- Restart backend after changes to enable streaming
