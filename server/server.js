const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

require('dotenv').config();

// Load webhook modules
const discordWebhook = require('./discord-webhook');
const settings = require('./settings');

// Load database module with error handling
let db;
let dbError = null;
try {
    db = require('./db');
} catch (error) {
    dbError = error;
    console.error('');
    console.error('═══════════════════════════════════════════════════════════');
    console.error('[SERVER] ❌ CRITICAL ERROR: Failed to load database module!');
    console.error('═══════════════════════════════════════════════════════════');
    console.error('');
    console.error('Error:', error.message);
    console.error('');
    console.error('📦 SOLUTION: Install sqlite3 on your production server:');
    console.error('');
    console.error('   cd /path/to/server');
    console.error('   npm install sqlite3');
    console.error('');
    console.error('If that fails (common on Linux servers), try:');
    console.error('');
    console.error('   sudo apt-get update');
    console.error('   sudo apt-get install -y build-essential python3');
    console.error('   npm install sqlite3 --build-from-source');
    console.error('');
    console.error('═══════════════════════════════════════════════════════════');
    console.error('');
    console.error('⚠️  Server will NOT start until sqlite3 is installed!');
    console.error('');
    process.exit(1);
}

const app = express();
app.use(cors());
app.use(express.json());

// ==================== SERVE CLIENT BUILD IN PRODUCTION ====================
const clientBuildPath = path.join(__dirname, '..', 'client', 'build');
if (fs.existsSync(clientBuildPath)) {
    console.log('[SERVER] Serving client build from:', clientBuildPath);
    app.use(express.static(clientBuildPath));
}

const MAPS_FILE = path.join(__dirname, 'maps.json');
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');

// ==================== JWT AUTH MIDDLEWARE ====================
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

    if (!token) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Invalid or expired token' });
    }
}

function requirePermission(permission) {
    return (req, res, next) => {
        if (!req.user) return res.status(401).json({ error: 'Authentication required' });
        // super_admin has all permissions
        if (req.user.role === 'super_admin') return next();
        if (req.user.permissions && req.user.permissions.includes(permission)) return next();
        return res.status(403).json({ error: 'Permission denied' });
    };
}

function requireSuperAdmin(req, res, next) {
    if (!req.user) return res.status(401).json({ error: 'Authentication required' });
    if (req.user.role !== 'super_admin') return res.status(403).json({ error: 'Super admin access required' });
    next();
}

let rooms = {};

// --- 5v5 MAPS ---
const DEFAULT_MAPS = [
    { name: "Dust2" }, { name: "Inferno" }, { name: "Mirage" },
    { name: "Overpass" }, { name: "Nuke" }, { name: "Anubis" }, { name: "Ancient" }
];

// --- WINGMAN MAPS ---
const WINGMAN_MAPS = [
    { name: "Vertigo" }, { name: "Nuke" }, { name: "Inferno" },
    { name: "Overpass" }, { name: "Sanctum" }, { name: "Poseidon" }
];

let activeMaps = [...DEFAULT_MAPS];

// --- LOAD DATA ---
async function loadData() {
    try {
        // Initialize SQLite database and create table if needed
        await db.initDatabase();

        // Initialize settings table for admin webhook
        await settings.initSettingsTable();

        // Load all matches from database
        const savedMatches = await db.loadAllMatches();
        savedMatches.forEach(match => {
            rooms[match.id] = match;
        });


        // Migration: Load from JSON if it exists (one-time migration)
        const HISTORY_FILE = path.join(__dirname, 'match_history.json');
        if (fs.existsSync(HISTORY_FILE) && savedMatches.length === 0) {
            try {
                const savedData = JSON.parse(fs.readFileSync(HISTORY_FILE));
                for (const match of savedData) {
                    const matchData = {
                        ...match,
                        finished: match.finished || false,
                        timerDuration: match.timerDuration || 60
                    };
                    await db.saveMatch(matchData);
                    rooms[match.id] = matchData;
                }
            } catch (jsonError) {
                console.error("[MIGRATION] Error loading from JSON:", jsonError);
            }
        }
    } catch (e) {
        // Database loading error handled silently
    }
}

// Start loading data (don't block server startup if DB fails)
loadData().catch(error => {
    console.error('[SERVER] ❌ Failed to initialize database on startup:', error.message);
    console.error('[SERVER] ⚠️  Server will start but database features may not work');
    console.error('[SERVER] 📦 Make sure sqlite3 is installed: npm install sqlite3');
});

if (fs.existsSync(MAPS_FILE)) {
    try {
        activeMaps = JSON.parse(fs.readFileSync(MAPS_FILE));
    } catch (e) { /* Maps load error handled silently */ }
} else {
    fs.writeFileSync(MAPS_FILE, JSON.stringify(activeMaps, null, 2));
}

async function saveHistory(roomId = null) {
    try {
        if (roomId) {
            // Save specific room to SQLite
            const room = rooms[roomId];
            if (room) {
                await db.saveMatch(room);
            }
        } else {
            // Save all rooms (for bulk operations)
            const matchesArray = Object.values(rooms);
            for (const match of matchesArray) {
                await db.saveMatch(match);
            }
        }
    } catch (e) {
        console.error("[DB] Error saving history:", e);
    }
}

function saveMaps() {
    try {
        fs.writeFileSync(MAPS_FILE, JSON.stringify(activeMaps, null, 2));
    } catch (e) {
        console.error("Error saving maps:", e);
    }
}

// --- API ROUTES ---
// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        database: db ? 'connected' : 'error',
        timestamp: new Date().toISOString()
    });
});

// ==================== AUTH ROUTES ====================
app.post('/api/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password required' });
        }

        const user = await db.getUserByUsername(username);
        if (!user) {
            return res.status(401).json({ error: 'Invalid username or password' });
        }

        const valid = await db.verifyPassword(password, user.password_hash);
        if (!valid) {
            return res.status(401).json({ error: 'Invalid username or password' });
        }

        // Create JWT token
        const tokenPayload = {
            id: user.id,
            username: user.username,
            role: user.role,
            permissions: user.permissions
        };
        const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '24h' });

        res.json({
            token,
            user: {
                id: user.id,
                username: user.username,
                role: user.role,
                permissions: user.permissions,
                must_change_password: user.must_change_password
            }
        });
    } catch (error) {
        console.error('[AUTH] Login error:', error);
        res.status(500).json({ error: 'Login failed' });
    }
});

app.post('/api/auth/change-password', authenticateToken, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        if (!newPassword || newPassword.length < 4) {
            return res.status(400).json({ error: 'New password must be at least 4 characters' });
        }

        // Get the full user to verify current password
        const user = await db.getUserById(req.user.id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // If must_change_password, currentPassword check is optional (first login)
        if (!user.must_change_password) {
            if (!currentPassword) {
                return res.status(400).json({ error: 'Current password required' });
            }
            const valid = await db.verifyPassword(currentPassword, user.password_hash);
            if (!valid) {
                return res.status(401).json({ error: 'Current password is incorrect' });
            }
        }

        await db.updateUserPassword(user.id, newPassword);

        // Issue a new token with updated info
        const updatedUser = await db.getUserById(user.id);
        const tokenPayload = {
            id: updatedUser.id,
            username: updatedUser.username,
            role: updatedUser.role,
            permissions: updatedUser.permissions
        };
        const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '24h' });

        res.json({ success: true, token, message: 'Password changed successfully' });
    } catch (error) {
        console.error('[AUTH] Change password error:', error);
        res.status(500).json({ error: 'Failed to change password' });
    }
});

app.get('/api/auth/me', authenticateToken, async (req, res) => {
    try {
        const user = await db.getUserById(req.user.id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json({
            id: user.id,
            username: user.username,
            role: user.role,
            permissions: user.permissions,
            must_change_password: user.must_change_password
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to get user info' });
    }
});

// ==================== USER MANAGEMENT ROUTES (super_admin only) ====================
app.get('/api/admin/users', authenticateToken, requireSuperAdmin, async (req, res) => {
    try {
        const users = await db.getAllUsers();
        res.json(users);
    } catch (error) {
        console.error('[API] Error getting users:', error);
        res.status(500).json({ error: 'Failed to get users' });
    }
});

app.post('/api/admin/users', authenticateToken, requireSuperAdmin, async (req, res) => {
    try {
        const { username, password, role, permissions } = req.body;
        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password required' });
        }
        if (username.length < 3) {
            return res.status(400).json({ error: 'Username must be at least 3 characters' });
        }
        if (password.length < 4) {
            return res.status(400).json({ error: 'Password must be at least 4 characters' });
        }
        if (role && !['admin', 'super_admin'].includes(role)) {
            return res.status(400).json({ error: 'Invalid role. Must be admin or super_admin' });
        }

        const newUser = await db.createUser(username, password, role || 'admin', permissions || []);
        res.json({ success: true, user: newUser });
    } catch (error) {
        console.error('[API] Error creating user:', error);
        res.status(400).json({ error: error.message || 'Failed to create user' });
    }
});

app.put('/api/admin/users/:id', authenticateToken, requireSuperAdmin, async (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        const { role, permissions } = req.body;

        // Prevent self-demotion
        if (userId === req.user.id && role && role !== 'super_admin') {
            return res.status(400).json({ error: 'Cannot demote yourself' });
        }

        const updates = {};
        if (role !== undefined) updates.role = role;
        if (permissions !== undefined) updates.permissions = permissions;

        const updated = await db.updateUser(userId, updates);
        if (!updated) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({ success: true });
    } catch (error) {
        console.error('[API] Error updating user:', error);
        res.status(500).json({ error: 'Failed to update user' });
    }
});

app.delete('/api/admin/users/:id', authenticateToken, requireSuperAdmin, async (req, res) => {
    try {
        const userId = parseInt(req.params.id);

        // Prevent self-deletion
        if (userId === req.user.id) {
            return res.status(400).json({ error: 'Cannot delete yourself' });
        }

        const deleted = await db.deleteUser(userId);
        if (!deleted) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({ success: true });
    } catch (error) {
        console.error('[API] Error deleting user:', error);
        res.status(500).json({ error: 'Failed to delete user' });
    }
});

app.post('/api/admin/users/:id/reset-password', authenticateToken, requireSuperAdmin, async (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        const { newPassword } = req.body;

        if (!newPassword || newPassword.length < 4) {
            return res.status(400).json({ error: 'Password must be at least 4 characters' });
        }

        await db.updateUserPassword(userId, newPassword);
        await db.updateUser(userId, { must_change_password: true });
        res.json({ success: true });
    } catch (error) {
        console.error('[API] Error resetting password:', error);
        res.status(500).json({ error: 'Failed to reset password' });
    }
});

// Get available permissions list
app.get('/api/admin/permissions', authenticateToken, requireSuperAdmin, (req, res) => {
    res.json(db.ALL_PERMISSIONS);
});

// ==================== PUBLIC ROUTES ====================
app.get('/api/history', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const results = await db.getPaginatedMatches(page, limit);
        res.json(results);
    } catch (error) {
        console.error("[API] Error fetching history:", error);
        res.status(500).json({ error: "Failed to fetch history" });
    }
});

app.get('/api/maps', (req, res) => res.json(activeMaps));

// ==================== ADMIN ROUTES (JWT protected) ====================
app.post('/api/admin/history', authenticateToken, async (req, res) => {
    try {
        // Combine in-memory active rooms with database matches
        const activeMatches = Object.values(rooms).map(({ timerHandle, ...keep }) => keep);
        const dbMatches = await db.getAllMatches();

        // Create a map of all matches, prioritizing in-memory (active) ones
        const matchMap = new Map();
        dbMatches.forEach(m => matchMap.set(m.id, m));
        activeMatches.forEach(m => matchMap.set(m.id, m));

        const allMatches = Array.from(matchMap.values())
            .sort((a, b) => new Date(b.date) - new Date(a.date));
        res.json(allMatches);
    } catch (error) {
        console.error("[API] Error fetching admin history:", error);
        res.status(500).json({ error: "Failed to fetch history" });
    }
});

app.post('/api/admin/delete', authenticateToken, requirePermission('delete_match'), async (req, res) => {
    try {
        const room = rooms[req.body.id];
        if (room) {
            if (room.timerHandle) clearTimeout(room.timerHandle);
            delete rooms[req.body.id];
        }

        // Delete from database
        await db.deleteMatch(req.body.id);
        res.json({ success: true });
    } catch (error) {
        console.error("[API] Error deleting match:", error);
        res.status(500).json({ error: "Failed to delete match" });
    }
});

app.post('/api/admin/reset', authenticateToken, requirePermission('nuke_history'), async (req, res) => {
    Object.values(rooms).forEach(r => { if (r.timerHandle) clearTimeout(r.timerHandle); });
    rooms = {};
    try {
        await db.deleteAllMatches();
    } catch (e) {
        console.error("[API] Error clearing database:", e);
    }
    res.json({ success: true });
});

app.post('/api/admin/maps/get', authenticateToken, (req, res) => {
    res.json(activeMaps);
});

app.post('/api/admin/maps/update', authenticateToken, requirePermission('manage_maps'), (req, res) => {
    if (!Array.isArray(req.body.maps)) return res.status(400).json({ error: "Invalid Data" });
    activeMaps = req.body.maps;
    saveMaps();
    res.json({ success: true, maps: activeMaps });
});

app.post('/api/admin/webhook/get', authenticateToken, async (req, res) => {
    try {
        const webhookUrl = await settings.getAdminWebhook();
        res.json({ webhookUrl: webhookUrl || '' });
    } catch (error) {
        console.error("[API] Error getting admin webhook:", error);
        res.status(500).json({ error: "Failed to get webhook" });
    }
});

app.post('/api/admin/webhook/set', authenticateToken, requirePermission('manage_webhook'), async (req, res) => {
    try {
        const { webhookUrl } = req.body;

        // Validate webhook URL if provided
        if (webhookUrl && !discordWebhook.isValidDiscordWebhook(webhookUrl)) {
            return res.status(400).json({ error: "Invalid Discord webhook URL" });
        }

        await settings.setAdminWebhook(webhookUrl || '');
        res.json({ success: true });
    } catch (error) {
        console.error("[API] Error setting admin webhook:", error);
        res.status(500).json({ error: "Failed to set webhook" });
    }
});

app.post('/api/admin/webhook/test', authenticateToken, requirePermission('manage_webhook'), async (req, res) => {
    try {
        const { webhookUrl } = req.body;

        if (!webhookUrl) {
            return res.status(400).json({ error: "Webhook URL required" });
        }

        await discordWebhook.testWebhook(webhookUrl);
        res.json({ success: true, message: "Webhook test successful" });
    } catch (error) {
        console.error("[API] Error testing webhook:", error);
        res.status(500).json({ error: error.message || "Webhook test failed" });
    }
});

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

// Track connected users
let connectedUsers = 0;
// Track users per room (roomId -> count)
const roomUserCounts = {};

// Function to broadcast user count to all clients
function broadcastUserCount() {
    io.emit('user_count', connectedUsers);
}

// Function to broadcast room-specific user count
function broadcastRoomUserCount(roomId) {
    const count = roomUserCounts[roomId] || 0;
    io.to(roomId).emit('room_user_count', { roomId, count });
}

const SEQUENCES = {
    bo1: [{ t: 'A', a: 'ban' }, { t: 'A', a: 'ban' }, { t: 'B', a: 'ban' }, { t: 'B', a: 'ban' }, { t: 'B', a: 'ban' }, { t: 'A', a: 'ban' }, { t: 'B', a: 'side' }],
    bo3: [{ t: 'A', a: 'ban' }, { t: 'B', a: 'ban' }, { t: 'A', a: 'pick' }, { t: 'B', a: 'side' }, { t: 'B', a: 'pick' }, { t: 'A', a: 'side' }, { t: 'B', a: 'ban' }, { t: 'A', a: 'ban' }, { t: 'B', a: 'side' }],
    bo5: [{ t: 'A', a: 'ban' }, { t: 'B', a: 'ban' }, { t: 'A', a: 'pick' }, { t: 'B', a: 'side' }, { t: 'B', a: 'pick' }, { t: 'A', a: 'side' }, { t: 'A', a: 'pick' }, { t: 'B', a: 'side' }, { t: 'B', a: 'pick' }, { t: 'A', a: 'side' }, { t: 'System', a: 'knife' }],
    faceit_bo1: [{ t: 'A', a: 'ban' }, { t: 'B', a: 'ban' }, { t: 'A', a: 'ban' }, { t: 'B', a: 'ban' }, { t: 'A', a: 'ban' }, { t: 'B', a: 'ban' }, { t: 'System', a: 'knife' }],
    faceit_bo3: [{ t: 'A', a: 'ban' }, { t: 'B', a: 'ban' }, { t: 'A', a: 'pick' }, { t: 'B', a: 'side' }, { t: 'B', a: 'pick' }, { t: 'A', a: 'side' }, { t: 'A', a: 'ban' }, { t: 'B', a: 'ban' }, { t: 'System', a: 'knife' }],
    faceit_bo5: [{ t: 'A', a: 'ban' }, { t: 'B', a: 'ban' }, { t: 'A', a: 'pick' }, { t: 'B', a: 'side' }, { t: 'B', a: 'pick' }, { t: 'A', a: 'side' }, { t: 'A', a: 'pick' }, { t: 'B', a: 'side' }, { t: 'B', a: 'pick' }, { t: 'A', a: 'side' }, { t: 'System', a: 'knife' }],
    wingman_bo1: [{ t: 'A', a: 'ban' }, { t: 'B', a: 'ban' }, { t: 'A', a: 'ban' }, { t: 'B', a: 'ban' }, { t: 'A', a: 'ban' }, { t: 'System', a: 'knife' }],
    wingman_bo3: [{ t: 'A', a: 'ban' }, { t: 'A', a: 'ban' }, { t: 'A', a: 'pick' }, { t: 'B', a: 'side' }, { t: 'B', a: 'pick' }, { t: 'A', a: 'side' }, { t: 'B', a: 'ban' }, { t: 'System', a: 'knife' }]
};

const generateKey = (len = 16) => crypto.randomBytes(len).toString('hex');

const startTurnTimer = (roomId) => {
    const room = rooms[roomId];
    if (!room || room.finished) return;
    if (room.timerHandle) clearTimeout(room.timerHandle);
    const timerSeconds = room.timerDuration || 60; // Get timer duration in seconds
    const duration = timerSeconds * 1000; // Convert to milliseconds
    room.timerEndsAt = Date.now() + duration;
    room.timerHandle = setTimeout(() => { handleAutoAction(roomId); }, duration);
};

const handleAutoAction = (roomId) => {
    const room = rooms[roomId];
    if (!room || room.finished) return;
    const step = room.sequence[room.step];
    if (!step) return; // Safety check: step might be undefined

    if (step.a === 'ban' || step.a === 'pick') {
        const availableMaps = room.maps.filter(m => m.status === 'available');
        if (availableMaps.length > 0) {
            const randomMap = availableMaps[Math.floor(Math.random() * availableMaps.length)];
            // Get team name based on step.t
            const teamName = step.t === 'A' ? (room.teamA || 'Team A') : (step.t === 'B' ? (room.teamB || 'Team B') : 'System');
            if (step.a === 'ban') {
                randomMap.status = 'banned';
                room.logs.push(`[AUTO-BAN] ${teamName} banned ${randomMap.name} (Timeout)`);
            } else {
                randomMap.status = 'picked';
                randomMap.pickedBy = step.t;
                room.lastPickedMap = randomMap.name;
                room.playedMaps.push(randomMap.name);
                room.logs.push(`[AUTO-PICK] ${teamName} picked ${randomMap.name} (Timeout)`);
            }
            room.step++;
        }
    } else if (step.a === 'side') {
        let target = room.lastPickedMap;
        if (!target) { const d = room.maps.find(m => m.status === 'available'); if (d) target = d.name; }
        const idx = room.maps.findIndex(m => m.name === target);
        if (idx !== -1) {
            const randomSide = Math.random() > 0.5 ? 'CT' : 'T';
            room.maps[idx].side = randomSide;
            // Get team name based on step.t (same as ban/pick logic)
            const teamName = step.t === 'A' ? (room.teamA || 'Team A') : (step.t === 'B' ? (room.teamB || 'Team B') : 'System');
            const lastLogIndex = room.logs.length - 1;
            const lastLog = room.logs[lastLogIndex];
            if (lastLog && lastLog.includes(`picked ${target}`)) {
                room.logs[lastLogIndex] = `${lastLog} (${teamName} chose ${randomSide} side for ${target})`;
            } else {
                room.logs.push(`[AUTO-SIDE] ${teamName} chose ${randomSide} for ${target} (Timeout)`);
            }
            room.lastPickedMap = null;
            room.step++;
        }
    }

    checkMatchEnd(room);
    if (!room.finished) { startTurnTimer(roomId); } else { room.timerEndsAt = null; }
    saveHistory(roomId);
    const { keys, timerHandle, tempWebhookUrl: _twh, ...safe } = room;
    io.to(roomId).emit('update_state', safe);
};

const checkMatchEnd = (room) => {
    let checking = true;
    while (checking && !room.finished) {
        checking = false;
        if (room.step >= room.sequence.length) {
            room.finished = true;
            const d = room.maps.find(m => m.status === 'available');
            if (d && d.status !== 'picked') { d.status = 'decider'; room.playedMaps.push(d.name); }
            break;
        }
        const nextStep = room.sequence[room.step];
        if (nextStep && nextStep.a === 'knife') {
            const d = room.maps.find(m => m.status === 'available');
            if (d) { d.status = 'decider'; d.side = 'Knife'; room.playedMaps.push(d.name); room.logs.push(`[DECIDER] ${d.name} (Knife for Side)`); }
            room.finished = true;
            checking = false;
        }
    }
};

// Helper function to send webhook notifications
async function notifyWebhook(roomId, eventType, data) {
    try {
        const room = rooms[roomId];
        if (!room) return;

        // Get admin webhook
        const adminWebhook = await settings.getAdminWebhook();

        // Send to admin webhook (if configured)
        if (adminWebhook) {
            await discordWebhook.sendDiscordNotification(adminWebhook, room, eventType, data);
        }

        // Send to match-specific webhook (if provided)
        if (room.tempWebhookUrl) {
            await discordWebhook.sendDiscordNotification(room.tempWebhookUrl, room, eventType, data);
        }
    } catch (error) {
        console.error('[WEBHOOK] Error sending notification:', error);
    }
}

io.on('connection', (socket) => {
    // Track which rooms this socket is in
    socket.currentRoom = null;

    // Increment user count on connection
    connectedUsers++;
    // Send current count to the new client immediately
    socket.emit('user_count', connectedUsers);
    // Broadcast to all clients
    broadcastUserCount();

    socket.on('create_match', ({ teamA, teamB, teamALogo, teamBLogo, format, customMapNames, customSequence, useTimer, useCoinFlip, timerDuration, tempWebhookUrl }) => {
        console.log('[CREATE_MATCH] Timer enabled:', useTimer, 'Timer duration:', timerDuration, 'Type:', typeof timerDuration);
        const roomId = generateKey(6);
        let finalSequence = SEQUENCES[format];
        if (format === 'custom' && Array.isArray(customSequence) && customSequence.length > 0) finalSequence = customSequence;

        let finalMaps = [];
        if (format.startsWith('wingman')) {
            finalMaps = WINGMAN_MAPS.map(m => ({ name: m.name, customImage: null, status: 'available', pickedBy: null, side: null }));
        } else if (format === 'custom' && Array.isArray(customMapNames) && customMapNames.length > 0) {
            finalMaps = customMapNames.map(name => {
                const existing = activeMaps.find(m => m.name === name);
                return { name: name, customImage: existing ? (existing.customImage || null) : null, status: 'available', pickedBy: null, side: null };
            });
        } else {
            finalMaps = activeMaps.map(m => ({ name: m.name, customImage: m.customImage || null, status: 'available', pickedBy: null, side: null }));
        }

        const parsedTimerDuration = useTimer ? (parseInt(timerDuration) || 60) : 60;
        rooms[roomId] = {
            id: roomId, date: new Date().toISOString(),
            keys: { admin: generateKey(8), A: generateKey(8), B: generateKey(8) },
            teamA: teamA || "Team A", teamB: teamB || "Team B",
            teamALogo: teamALogo || null, teamBLogo: teamBLogo || null,
            format, sequence: finalSequence, step: 0, maps: finalMaps,
            logs: [], finished: false, lastPickedMap: null, playedMaps: [],
            useTimer: !!useTimer, ready: { A: false, B: false }, timerEndsAt: null, timerHandle: null,
            timerDuration: parsedTimerDuration, // Store timer duration in seconds
            useCoinFlip: !!useCoinFlip,
            coinFlip: useCoinFlip ? { status: 'waiting_call', winner: null, result: null } : null,
            tempWebhookUrl: tempWebhookUrl || null
        };
        saveHistory(roomId);

        // Send webhook notification for match creation
        notifyWebhook(roomId, 'match_created', {});

        socket.emit('match_created', { roomId, keys: rooms[roomId].keys });
    });

    socket.on('join_room', ({ roomId, key }) => {
        if (!rooms[roomId]) return socket.emit('error', 'Match not found');

        // Leave previous room if any
        if (socket.currentRoom && socket.currentRoom !== roomId) {
            roomUserCounts[socket.currentRoom] = Math.max(0, (roomUserCounts[socket.currentRoom] || 0) - 1);
            socket.leave(socket.currentRoom);
            broadcastRoomUserCount(socket.currentRoom);
        }

        // Join new room
        socket.join(roomId);
        socket.currentRoom = roomId;

        // Increment room user count
        roomUserCounts[roomId] = (roomUserCounts[roomId] || 0) + 1;
        broadcastRoomUserCount(roomId);

        const room = rooms[roomId];
        let role = 'viewer';
        if (key === room.keys.admin) role = 'admin';
        else if (key === room.keys.A) role = 'A';
        else if (key === room.keys.B) role = 'B';
        socket.emit('role_assigned', role);
        const { keys, timerHandle, tempWebhookUrl: _twh, ...safe } = room;
        socket.emit('update_state', safe);

    });

    socket.on('team_ready', ({ roomId, key }) => {
        const room = rooms[roomId];
        if (!room || room.finished || !room.useTimer) return;
        let role = null;
        if (key === room.keys.A) role = 'A';
        else if (key === room.keys.B) role = 'B';
        if (role && !room.ready[role]) {
            room.ready[role] = true;
            const teamName = role === 'A' ? room.teamA : room.teamB;
            room.logs.push(`[READY] ${teamName} is Ready`);

            // Send webhook for team ready
            notifyWebhook(roomId, 'ready', { team: teamName });

            const coinFlipDone = !room.useCoinFlip || (room.coinFlip && room.coinFlip.status === 'done');
            if (room.ready.A && room.ready.B && coinFlipDone) {
                room.logs.push(`[SYSTEM] Both teams ready! Timer started.`);
                startTurnTimer(roomId);
            }
            saveHistory(roomId);
            const { keys, timerHandle, tempWebhookUrl: _twh, ...safe } = room;
            io.to(roomId).emit('update_state', safe);
        }
    });

    socket.on('coin_call', ({ roomId, call, key }) => {
        const room = rooms[roomId];
        if (!room || !room.useCoinFlip || !room.coinFlip || room.coinFlip.status !== 'waiting_call') return;
        if (key !== room.keys.A) return;

        const result = crypto.randomInt(0, 2) === 0 ? 'heads' : 'tails';
        const winner = (call === result) ? 'A' : 'B';

        room.coinFlip.result = result;
        room.coinFlip.winner = winner;
        room.coinFlip.status = 'deciding';

        const winnerName = winner === 'A' ? room.teamA : room.teamB;
        room.logs.push(`[COIN] ${room.teamA} called ${call.toUpperCase()}. Result: ${result.toUpperCase()}. Winner: ${winnerName}`);

        // Send webhook for coin flip result
        notifyWebhook(roomId, 'coin_flip', { result, winner: winnerName });

        saveHistory(roomId);
        const { keys, timerHandle, tempWebhookUrl: _twh, ...safe } = room;
        io.to(roomId).emit('update_state', safe);
    });

    socket.on('coin_decision', ({ roomId, decision, key }) => {
        // decision: 'first' (We Start) or 'second' (They Start)
        const room = rooms[roomId];
        if (!room || !room.useCoinFlip || room.coinFlip.status !== 'deciding') return;
        const winner = room.coinFlip.winner;
        if (key !== room.keys[winner]) return;

        let swapSequence = false;
        // Default: A starts.
        // If A is winner and picks 'second', B starts (swap).
        // If B is winner and picks 'first', B starts (swap).
        if (winner === 'A' && decision === 'second') swapSequence = true;
        if (winner === 'B' && decision === 'first') swapSequence = true;

        if (swapSequence) {
            room.sequence = room.sequence.map(step => {
                if (step.t === 'A') return { ...step, t: 'B' };
                if (step.t === 'B') return { ...step, t: 'A' };
                return step;
            });
        }

        // FIXED LOGIC: Base log on the DECISION, not the swap
        const winnerName = winner === 'A' ? room.teamA : room.teamB;
        if (decision === 'first') {
            room.logs.push(`[COIN] ${winnerName} chose to start first.`);
        } else {
            room.logs.push(`[COIN] ${winnerName} chose to let opponent start.`);
        }

        room.coinFlip.status = 'done';
        if (room.useTimer && room.ready.A && room.ready.B) { startTurnTimer(roomId); }
        saveHistory(roomId);
        const { keys, timerHandle, tempWebhookUrl: _twh, ...safe } = room;
        io.to(roomId).emit('update_state', safe);
    });

    socket.on('action', ({ roomId, data, key }) => {
        const room = rooms[roomId];
        if (!room || room.finished) return;
        if (room.useTimer && (!room.ready.A || !room.ready.B)) return;
        if (room.useCoinFlip && (!room.coinFlip || room.coinFlip.status !== 'done')) return;

        const currentStep = room.sequence[room.step];
        if (!currentStep) return; // Safety check: step might be undefined
        if (currentStep.t !== 'System' && key !== room.keys.admin && key !== room.keys[currentStep.t]) return;

        if (currentStep.a === 'ban' || currentStep.a === 'pick') {
            const idx = room.maps.findIndex(m => m.name === data);
            if (idx === -1 || room.maps[idx].status !== 'available') return;
            const map = room.maps[idx];
            const teamName = currentStep.t === 'A' ? room.teamA : room.teamB;

            if (currentStep.a === 'ban') {
                map.status = 'banned';
                room.logs.push(`[BAN] ${teamName} banned ${map.name}`);

                // Send webhook for ban
                notifyWebhook(roomId, 'ban', { mapName: map.name, team: teamName });
            } else {
                map.status = 'picked';
                map.pickedBy = currentStep.t;
                room.lastPickedMap = map.name;
                room.playedMaps.push(map.name);
                room.logs.push(`[PICK] ${teamName} picked ${map.name}`);

                // Send webhook for pick (side will be added later)
                notifyWebhook(roomId, 'pick', { mapName: map.name, team: teamName, side: null });
            }
            room.step++;
        } else if (currentStep.a === 'side') {
            let target = room.lastPickedMap;
            if (!target) { const d = room.maps.find(m => m.status === 'available'); if (d) target = d.name; }
            const idx = room.maps.findIndex(m => m.name === target);
            if (idx !== -1) {
                room.maps[idx].side = data;
                const teamName = currentStep.t === 'A' ? room.teamA : room.teamB;
                const lastLogIndex = room.logs.length - 1;
                const lastLog = room.logs[lastLogIndex];
                if (lastLog && lastLog.includes(`picked ${target}`)) {
                    room.logs[lastLogIndex] = `${lastLog} (${teamName} chose ${data} side for ${target})`;
                } else {
                    room.logs.push(`[SIDE] ${teamName} chose ${data} side for ${target}`);
                }

                // Send webhook for side selection
                notifyWebhook(roomId, 'side', { mapName: target, team: teamName, side: data });

                room.lastPickedMap = null;
                room.step++;
            }
        }

        if (room.useTimer) {
            if (room.timerHandle) { clearTimeout(room.timerHandle); room.timerEndsAt = null; }
            if (!room.finished && room.ready.A && room.ready.B) { startTurnTimer(roomId); }
        }
        checkMatchEnd(room);

        // Send webhook if match just finished
        if (room.finished) {
            notifyWebhook(roomId, 'match_complete', {});
        }

        saveHistory(roomId);
        const { keys, timerHandle, tempWebhookUrl: _twh, ...safe } = room;
        io.to(roomId).emit('update_state', safe);
    });

    socket.on('admin_reset_match', ({ roomId, token }) => {
        const room = rooms[roomId];
        let authorized = false;
        if (token) { try { jwt.verify(token, JWT_SECRET); authorized = true; } catch(e) {} }
        if (!room || !authorized) return;
        if (room.timerHandle) clearTimeout(room.timerHandle);
        room.step = 0;
        room.logs = [`[ADMIN] Match reset by Admin`];
        room.finished = false;
        room.lastPickedMap = null;
        room.playedMaps = [];
        room.timerEndsAt = null;
        room.ready = { A: false, B: false };
        // Preserve timerDuration when resetting
        if (!room.timerDuration) room.timerDuration = 60;
        room.coinFlip = room.useCoinFlip ? { status: 'waiting_call', winner: null, result: null } : null;
        room.maps.forEach(m => { m.status = 'available'; m.pickedBy = null; m.side = null; });
        saveHistory(roomId);
        const { keys, timerHandle, tempWebhookUrl: _twh, ...safe } = room;
        io.to(roomId).emit('update_state', safe);
    });

    socket.on('admin_undo_step', ({ roomId, token }) => {
        const room = rooms[roomId];
        let authorized = false;
        if (token) { try { jwt.verify(token, JWT_SECRET); authorized = true; } catch(e) {} }
        if (!room || !authorized || room.step === 0) return;
        if (room.timerHandle) clearTimeout(room.timerHandle);
        room.timerEndsAt = null;
        room.step--;
        if (room.finished) room.finished = false;
        const lastLog = room.logs[room.logs.length - 1];
        if (!lastLog) return; // Safety check: no logs to undo
        if (lastLog.includes('(') && lastLog.includes('side for')) {
            const splitIdx = lastLog.indexOf('(');
            const mapNameMatch = lastLog.match(/side for (.*?)\)/);
            if (mapNameMatch) {
                const mapName = mapNameMatch[1];
                const map = room.maps.find(m => m.name === mapName);
                if (map) map.side = null;
                room.logs[room.logs.length - 1] = lastLog.substring(0, splitIdx).trim();
                room.lastPickedMap = mapName;
            }
        } else {
            room.logs.pop();
            let mapName = null;
            for (const m of room.maps) { if (lastLog.includes(m.name)) { mapName = m.name; break; } }
            if (mapName) {
                const map = room.maps.find(m => m.name === mapName);
                if (map) {
                    if (lastLog.includes('[BAN]')) map.status = 'available';
                    if (lastLog.includes('[PICK]')) { map.status = 'available'; map.pickedBy = null; room.playedMaps = room.playedMaps.filter(p => p !== mapName); }
                    if (lastLog.includes('[DECIDER]')) { map.status = 'available'; map.side = null; room.playedMaps = room.playedMaps.filter(p => p !== mapName); }
                    if (lastLog.includes('[SIDE]') || lastLog.includes('[AUTO-SIDE]')) { map.side = null; room.lastPickedMap = mapName; }
                }
            }
        }
        if (room.useTimer && room.ready.A && room.ready.B && !room.finished) { startTurnTimer(roomId); }
        saveHistory(roomId);
        const { keys, timerHandle, tempWebhookUrl: _twh, ...safe } = room;
        io.to(roomId).emit('update_state', safe);
    });

    // Cleanup on disconnect (prevents memory leaks)
    socket.on('disconnect', () => {
        // Decrement room user count if socket was in a room
        if (socket.currentRoom) {
            roomUserCounts[socket.currentRoom] = Math.max(0, (roomUserCounts[socket.currentRoom] || 0) - 1);
            broadcastRoomUserCount(socket.currentRoom);
        }

        // Decrement total user count on disconnect
        connectedUsers = Math.max(0, connectedUsers - 1);
        broadcastUserCount();
        // Note: We don't clean up timers here because multiple users can be in the same room
        // Timers are cleaned up when rooms are deleted or matches finish
    });
});

// ==================== CATCH-ALL: SERVE CLIENT FOR SPA ROUTING ====================
if (fs.existsSync(clientBuildPath)) {
    app.use((req, res, next) => {
        // Only catch non-API, non-socket routes
        if (!req.path.startsWith('/api/') && !req.path.startsWith('/socket.io/')) {
            res.sendFile(path.join(clientBuildPath, 'index.html'));
        } else {
            next();
        }
    });
}

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`[SERVER] ✅ Running on port ${PORT}`);
    console.log(`[SERVER] Environment: ${process.env.NODE_ENV || 'development'}`);
    if (fs.existsSync(clientBuildPath)) {
        console.log(`[SERVER] Serving client build from: ${clientBuildPath}`);
    } else {
        console.log(`[SERVER] No client build found at: ${clientBuildPath}`);
        console.log(`[SERVER] Run 'cd client && npm run build' to create production build`);
    }
});