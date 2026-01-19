# Counter Strike Veto System

A professional, real-time map veto system for Counter-Strike 2 matches. Built with React, Node.js, Socket.IO, and SQLite.

![Counter Strike Veto System](https://img.shields.io/badge/CS2-%20VetoSystem-blue) ![License](https://img.shields.io/badge/license-MIT-green) ![Node](https://img.shields.io/badge/node-%3E%3D14.0.0-brightgreen)

## ✨ Features

- **Real-time Synchronization** - Live updates using Socket.IO for all participants
- **Multiple Veto Formats** - Supports VRS, Faceit, Wingman, and Custom veto formats
- **Timer System** - Configurable auto-ban/pick timer (30s, 45s, 60s, 90s, 120s)
- **Coin Flip** - Built-in coin flip functionality for starting side selection
- **Admin Panel** - Full control panel with match management, reset, and undo features
- **SQLite Database** - Persistent storage with efficient SQL queries
- **Sound Notifications** - Audio feedback for bans, picks, and countdown
- **Mobile Responsive** - Works seamlessly on desktop and mobile devices
- **Match History** - Complete history of all past veto sessions
- **Team Customization** - Add team names, logos, and custom map pools


### Prerequisites

- Node.js >= 14.0.0
- npm or yarn

### Installation

**Clone the repository**
```bash
git clone https://github.com/rpkaul/cs2-veto-system.git
cd cs2-veto-system
```

**Install dependencies**

Backend:
```bash
cd server
npm install
```

Frontend:
```bash
cd ../client
npm install
```

**Configure environment variables**

Create a `.env` file in the `server` directory:
```env
ADMIN_SECRET=your_secure_admin_password_here
```

**Start the application**

Terminal 1 - Backend:
```bash
cd server
node server.js
```

Terminal 2 - Frontend:
```bash
cd client
npm start
```

**Access the application**

- Main App: http://localhost:3000
- Admin Panel: http://localhost:3000/admin

## 📁 Project Structure

```
cs2-veto-system/
├── client/                 # React frontend
│   ├── public/            # Static assets
│   ├── src/               # React components and logic
│   │   └── App.js         # Main application component
│   └── package.json
├── server/                # Node.js backend
│   ├── db.js              # SQLite database module
│   ├── server.js          # Express & Socket.IO server
│   └── package.json
├── .gitignore
├── LICENSE
└── README.md
```

### Creating a Match

1. Visit the home page
2. Enter Team A and Team B names
3. (Optional) Upload team logos
4. Select veto format (VRS, Faceit, Wingman, or Custom)
5. (Optional) Enable timer and select duration
6. (Optional) Enable coin flip
7. Click Bo1, Bo3, or Bo5 to create match
8. Share the generated links with teams

### Admin Features

Visit `/admin` and authenticate with your admin secret


### Veto Process

- **Team A/B Views**: Each team gets a unique link to see only their turn
- **Admin View**: Full control and visibility of the entire process
- **Spectator View**: View-only access to watch the veto


---

⭐ If you found this project helpful, please give it a star!
