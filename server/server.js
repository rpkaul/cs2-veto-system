const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const db = require('./db');

require('dotenv').config(); 

const app = express();
app.use(cors());
app.use(express.json());

const MAPS_FILE = path.join(__dirname, 'maps.json');
const MASTER_SECRET = process.env.ADMIN_SECRET || "default_secret"; 

let rooms = {};

// --- 5v5 MAPS ---
const DEFAULT_MAPS = [
    { name: "Dust2" }, { name: "Inferno" }, { name: "Mirage" },
    { name: "Overpass" }, { name: "Nuke" }, { name: "Anubis" }, { name: "Ancient" }
];

// --- WINGMAN MAPS ---
const WINGMAN_MAPS = [
    { name: "Vertigo" }, { name: "Nuke" }, { name: "Inferno" },
    { name: "Overpass" }, { name: "Rooftop" }
];

let activeMaps = [...DEFAULT_MAPS];

// --- LOAD DATA ---
async function loadData() {
    try {
        // Initialize SQLite database and create table if needed
        await db.initDatabase();
        
        // Load all matches from database
        const savedMatches = await db.loadAllMatches();
        savedMatches.forEach(match => {
            rooms[match.id] = match;
        });
        
        console.log(`[DB] Loaded ${savedMatches.length} matches from SQLite database`);
        
        // Migration: Load from JSON if it exists (one-time migration)
        const HISTORY_FILE = path.join(__dirname, 'match_history.json');
        if (fs.existsSync(HISTORY_FILE) && savedMatches.length === 0) {
            try {
                const savedData = JSON.parse(fs.readFileSync(HISTORY_FILE));
                console.log(`[MIGRATION] Found ${savedData.length} matches in JSON, migrating to SQLite...`);
                for (const match of savedData) {
                    const matchData = { 
                        ...match, 
                        finished: match.finished || false,
                        timerDuration: match.timerDuration || 60
                    };
                    await db.saveMatch(matchData);
                    rooms[match.id] = matchData;
                }
                console.log(`[MIGRATION] Migrated ${savedData.length} matches to SQLite`);
            } catch (jsonError) {
                console.error("[MIGRATION] Error loading from JSON:", jsonError);
            }
        }
    } catch (e) { 
        console.error("[DB] Error loading data:", e);
    }
}

// Start loading data
loadData();

if (fs.existsSync(MAPS_FILE)) {
    try {
        activeMaps = JSON.parse(fs.readFileSync(MAPS_FILE));
    } catch (e) { console.error("Maps load error", e); }
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

app.post('/api/admin/history', async (req, res) => {
    if (req.body.secret !== MASTER_SECRET) return res.status(403).json({ error: "Invalid Key" });
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

app.post('/api/admin/delete', async (req, res) => {
    if (req.body.secret !== MASTER_SECRET) return res.status(403).json({ error: "Invalid Key" });
    try {
        const room = rooms[req.body.id];
        if (room) {
            if(room.timerHandle) clearTimeout(room.timerHandle);
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

app.post('/api/admin/reset', (req, res) => {
    if (req.body.secret !== MASTER_SECRET) return res.status(403).json({ error: "Invalid Key" });
    Object.values(rooms).forEach(r => { if(r.timerHandle) clearTimeout(r.timerHandle); });
    rooms = {}; 
    if(fs.existsSync(HISTORY_FILE)) fs.unlinkSync(HISTORY_FILE);
    res.json({ success: true });
});

app.post('/api/admin/maps/get', (req, res) => {
    if (req.body.secret !== MASTER_SECRET) return res.status(403).json({ error: "Invalid Key" });
    res.json(activeMaps);
});

app.post('/api/admin/maps/update', (req, res) => {
    if (req.body.secret !== MASTER_SECRET) return res.status(403).json({ error: "Invalid Key" });
    if (!Array.isArray(req.body.maps)) return res.status(400).json({ error: "Invalid Data" });
    activeMaps = req.body.maps;
    saveMaps();
    res.json({ success: true, maps: activeMaps });
});

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

const SEQUENCES = {
  bo1: [ { t: 'A', a: 'ban' }, { t: 'A', a: 'ban' }, { t: 'B', a: 'ban' }, { t: 'B', a: 'ban' }, { t: 'B', a: 'ban' }, { t: 'A', a: 'ban' }, { t: 'B', a: 'side' } ],
  bo3: [ { t: 'A', a: 'ban' }, { t: 'B', a: 'ban' }, { t: 'A', a: 'pick' }, { t: 'B', a: 'side' }, { t: 'B', a: 'pick' }, { t: 'A', a: 'side' }, { t: 'B', a: 'ban' }, { t: 'A', a: 'ban' }, { t: 'B', a: 'side' } ],
  bo5: [ { t: 'A', a: 'ban' }, { t: 'B', a: 'ban' }, { t: 'A', a: 'pick' }, { t: 'B', a: 'side' }, { t: 'B', a: 'pick' }, { t: 'A', a: 'side' }, { t: 'A', a: 'pick' }, { t: 'B', a: 'side' }, { t: 'B', a: 'pick' }, { t: 'A', a: 'side' }, { t: 'System', a: 'knife' } ],
  faceit_bo1: [ { t: 'A', a: 'ban' }, { t: 'B', a: 'ban' }, { t: 'A', a: 'ban' }, { t: 'B', a: 'ban' }, { t: 'A', a: 'ban' }, { t: 'B', a: 'ban' }, { t: 'System', a: 'knife' } ],
  faceit_bo3: [ { t: 'A', a: 'ban' }, { t: 'B', a: 'ban' }, { t: 'A', a: 'pick' }, { t: 'B', a: 'side' }, { t: 'B', a: 'pick' }, { t: 'A', a: 'side' }, { t: 'A', a: 'ban' }, { t: 'B', a: 'ban' }, { t: 'System', a: 'knife' } ],
  faceit_bo5: [ { t: 'A', a: 'ban' }, { t: 'B', a: 'ban' }, { t: 'A', a: 'pick' }, { t: 'B', a: 'side' }, { t: 'B', a: 'pick' }, { t: 'A', a: 'side' }, { t: 'A', a: 'pick' }, { t: 'B', a: 'side' }, { t: 'B', a: 'pick' }, { t: 'A', a: 'side' }, { t: 'System', a: 'knife' } ],
  wingman_bo1: [ { t: 'A', a: 'ban' }, { t: 'B', a: 'ban' }, { t: 'A', a: 'ban' }, { t: 'B', a: 'ban' }, { t: 'System', a: 'knife' } ],
  wingman_bo3: [ { t: 'A', a: 'ban' }, { t: 'B', a: 'ban' }, { t: 'A', a: 'pick' }, { t: 'B', a: 'side' }, { t: 'B', a: 'pick' }, { t: 'A', a: 'side' }, { t: 'System', a: 'knife' } ]
};

const generateKey = (len=16) => crypto.randomBytes(len).toString('hex');

const startTurnTimer = (roomId) => {
    const room = rooms[roomId];
    if (!room || room.finished) return;
    if (room.timerHandle) clearTimeout(room.timerHandle);
    const timerSeconds = room.timerDuration || 60; // Get timer duration in seconds
    const duration = timerSeconds * 1000; // Convert to milliseconds
    console.log('[TIMER] Starting timer for room', roomId, '- Room timerDuration:', room.timerDuration, '- Using:', timerSeconds, 'seconds');
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
        if (!target) { const d = room.maps.find(m => m.status === 'available'); if(d) target = d.name; }
        const idx = room.maps.findIndex(m => m.name === target);
        if (idx !== -1) {
            const randomSide = Math.random() > 0.5 ? 'CT' : 'T';
            room.maps[idx].side = randomSide;
            const lastPickedMapObj = room.maps.find(m => m.name === target && m.pickedBy);
            const teamName = lastPickedMapObj && lastPickedMapObj.pickedBy ? 
                (lastPickedMapObj.pickedBy === 'A' ? room.teamA : (lastPickedMapObj.pickedBy === 'B' ? room.teamB : 'System')) : 
                'System';
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
    if(!room.finished) { startTurnTimer(roomId); } else { room.timerEndsAt = null; }
    saveHistory(roomId);
    const { keys, timerHandle, ...safe } = room;
    io.to(roomId).emit('update_state', safe);
};

const checkMatchEnd = (room) => {
    let checking = true;
    while(checking && !room.finished) {
        checking = false;
        if (room.step >= room.sequence.length) {
            room.finished = true;
            const d = room.maps.find(m => m.status === 'available');
            if(d && d.status !== 'picked') { d.status='decider'; room.playedMaps.push(d.name); }
            break;
        }
        const nextStep = room.sequence[room.step];
        if (nextStep && nextStep.a === 'knife') {
            const d = room.maps.find(m => m.status === 'available');
            if(d) { d.status='decider'; d.side='Knife'; room.playedMaps.push(d.name); room.logs.push(`[DECIDER] ${d.name} (Knife for Side)`); }
            room.finished = true;
            checking = false;
        }
    }
};

io.on('connection', (socket) => {
  socket.on('create_match', ({ teamA, teamB, teamALogo, teamBLogo, format, customMapNames, customSequence, useTimer, useCoinFlip, timerDuration }) => {
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
    console.log('[SERVER] Room created - useTimer:', !!useTimer, 'timerDuration received:', timerDuration, 'parsed:', parsedTimerDuration);
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
      coinFlip: useCoinFlip ? { status: 'waiting_call', winner: null, result: null } : null
    };
    saveHistory(roomId);
    socket.emit('match_created', { roomId, keys: rooms[roomId].keys });
  });

  socket.on('join_room', ({ roomId, key }) => {
    if (!rooms[roomId]) return socket.emit('error', 'Match not found');
    socket.join(roomId);
    const room = rooms[roomId];
    let role = 'viewer';
    if (key === room.keys.admin) role = 'admin';
    else if (key === room.keys.A) role = 'A';
    else if (key === room.keys.B) role = 'B';
    socket.emit('role_assigned', role);
    const { keys, timerHandle, ...safe } = room;
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
          room.logs.push(`[READY] ${role === 'A' ? room.teamA : room.teamB} is Ready`);
          const coinFlipDone = !room.useCoinFlip || (room.coinFlip && room.coinFlip.status === 'done');
          if (room.ready.A && room.ready.B && coinFlipDone) {
              room.logs.push(`[SYSTEM] Both teams ready! Timer started.`);
              startTurnTimer(roomId);
          }
          saveHistory(roomId);
          const { keys, timerHandle, ...safe } = room;
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
      
      room.logs.push(`[COIN] ${room.teamA} called ${call.toUpperCase()}. Result: ${result.toUpperCase()}. Winner: ${winner === 'A' ? room.teamA : room.teamB}`);
      saveHistory();
      const { keys, timerHandle, ...safe } = room;
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
      const { keys, timerHandle, ...safe } = room;
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
        if (currentStep.a === 'ban') {
            map.status = 'banned';
            room.logs.push(`[BAN] ${currentStep.t === 'A' ? room.teamA : room.teamB} banned ${map.name}`);
        } else {
            map.status = 'picked';
            map.pickedBy = currentStep.t;
            room.lastPickedMap = map.name;
            room.playedMaps.push(map.name);
            room.logs.push(`[PICK] ${currentStep.t === 'A' ? room.teamA : room.teamB} picked ${map.name}`);
        }
        room.step++;
    } else if (currentStep.a === 'side') {
        let target = room.lastPickedMap;
        if (!target) { const d = room.maps.find(m => m.status === 'available'); if(d) target = d.name; }
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
            room.lastPickedMap = null;
            room.step++;
        }
    }

    if (room.useTimer) {
        if (room.timerHandle) { clearTimeout(room.timerHandle); room.timerEndsAt = null; }
        if (!room.finished && room.ready.A && room.ready.B) { startTurnTimer(roomId); }
    }
    checkMatchEnd(room);
    saveHistory(roomId);
    const { keys, timerHandle, ...safe } = room;
    io.to(roomId).emit('update_state', safe);
  });

  socket.on('admin_reset_match', ({ roomId, secret }) => {
      const room = rooms[roomId];
      if (!room || secret !== MASTER_SECRET) return;
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
      const { keys, timerHandle, ...safe } = room;
      io.to(roomId).emit('update_state', safe);
  });

  socket.on('admin_undo_step', ({ roomId, secret }) => {
      const room = rooms[roomId];
      if (!room || secret !== MASTER_SECRET || room.step === 0) return;
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
      const { keys, timerHandle, ...safe } = room;
      io.to(roomId).emit('update_state', safe);
  });

  // Cleanup on disconnect (prevents memory leaks)
  socket.on('disconnect', () => {
      // Note: We don't clean up timers here because multiple users can be in the same room
      // Timers are cleaned up when rooms are deleted or matches finish
  });
});

server.listen(3001, () => console.log('SERVER 3001'));