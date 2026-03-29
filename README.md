# CS2 Map Veto

Real-time Counter-Strike 2 map veto system with Bo1/Bo3/Bo5, coin flip, side selection, and Discord webhook support.

## Setup

### 1. Server

```bash
cd server
npm install
cp .env.example .env   # edit .env with your secrets
node server.js          # runs on port 3001
```

### 2. Client

```bash
cd client
npm install
npm start               # runs on port 3000
```

### Environment Variables (`server/.env`)

```env
PORT=3001
JWT_SECRET=your_jwt_secret
```

## Default Admin Login

- URL: `http://localhost:3000/admin`
- Username: `admin`
- Password: `admin123`
- You'll be prompted to change password on first login

## Tech Stack

React 19 · Express 5 · Socket.IO 4 · SQLite3 · JWT Auth
