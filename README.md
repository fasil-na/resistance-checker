# ResistanceApp

A modern React + Tailwind CSS dashboard with a Node.js + Express + TypeScript backend.

## Project Structure

- `frontend/`: React + Vite + TypeScript + Tailwind CSS
- `backend/`: Node.js + Express + TypeScript (using `tsx` for hot-reloading)

## Quick Start

1.  **Install dependencies** (at root):
    ```bash
    npm run install:all
    ```

2.  **Start both services** concurrently:
    ```bash
    npm run dev
    ```

## Endpoints

- **Frontend**: `http://localhost:5173` (or `5174` if busy)
- **Backend**: `http://localhost:5001`
  - Health Check: `GET /api/health`
  - Activities: `GET /api/activities`

## Features

- **Responsive Design**: Premium dashboard UI using Tailwind CSS.
- **Animations**: Smooth transitions with Framer Motion.
- **Modern Icons**: Lucide-React icons throughout.
- **Real-time Refresh**: Frontend can pull latest data from backend.
- **Modern TypeScript**: Strict types and ESM supported for both apps.
