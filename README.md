# ASTRALIFE AI — Complete React + Node Project

Intelligent Emergency Response & Green Corridor Network demo based on the ASTRALIFE AI presentation.

## Features
- Emergency registration form
- AI-style severity/priority analysis
- Ambulance selection by distance
- Hospital selection by availability and emergency type
- Green corridor simulation on a Leaflet map
- Predictive ambulance placement using sample historical data
- Emergency control-center dashboard
- SQLite-compatible local database through `sql.js`

## Requirements
- Node.js 20+ recommended
- npm 10+
- VS Code

## Folder structure
```text
ASTRALIFE-AI-connected/
├── backend/
│   ├── src/
│   │   ├── db.js
│   │   ├── engine.js
│   │   ├── seed.js
│   │   └── server.js
│   ├── package.json
│   └── astralife.db
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── App.jsx
│   │   ├── api.js
│   │   ├── main.jsx
│   │   └── styles.css
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
└── README.md
```

## 1. Backend
Open Terminal 1 in VS Code:
```cmd
cd backend
npm install
npm start
```
Backend: http://localhost:5000/api/health

## 2. Frontend
Open Terminal 2:
```cmd
cd frontend
npm install
npm run dev
```
Frontend: http://localhost:5173

The Vite proxy forwards `/api` requests to `http://localhost:5000`.

## Important
This is an academic/demo simulation. It does not control real ambulances, hospitals, traffic signals, or emergency services. Do not use it for real emergency dispatch decisions.

## Suggested VS Code extensions
- ESLint
- Prettier - Code formatter
- SQLite Viewer
- REST Client (optional)
