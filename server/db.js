const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_FILE = path.join(__dirname, 'match_history.db');

let db = null;

// Initialize database and create table if needed
function initDatabase() {
    return new Promise((resolve, reject) => {
        db = new sqlite3.Database(DB_FILE, (err) => {
            if (err) {
                console.error('[DB] Error opening database:', err);
                reject(err);
                return;
            }
            console.log('[DB] Connected to SQLite database');

            // Create table if it doesn't exist
            db.run(`
                CREATE TABLE IF NOT EXISTS match_history (
                    id TEXT PRIMARY KEY,
                    date TEXT NOT NULL,
                    teamA TEXT NOT NULL,
                    teamB TEXT NOT NULL,
                    teamALogo TEXT,
                    teamBLogo TEXT,
                    format TEXT NOT NULL,
                    sequence TEXT NOT NULL,
                    step INTEGER NOT NULL DEFAULT 0,
                    maps TEXT NOT NULL,
                    logs TEXT NOT NULL,
                    finished INTEGER NOT NULL DEFAULT 0,
                    lastPickedMap TEXT,
                    playedMaps TEXT NOT NULL,
                    useTimer INTEGER NOT NULL DEFAULT 0,
                    ready TEXT NOT NULL,
                    timerEndsAt INTEGER,
                    timerDuration INTEGER NOT NULL DEFAULT 60,
                    useCoinFlip INTEGER NOT NULL DEFAULT 0,
                    coinFlip TEXT,
                    keys_data TEXT NOT NULL
                )
            `, (err) => {
                if (err) {
                    console.error('[DB] Error creating table:', err);
                    reject(err);
                } else {
                    console.log('[DB] Table created/verified successfully');
                    resolve();
                }
            });
        });
    });
}

// Save or update a match in database
function saveMatch(match) {
    return new Promise((resolve, reject) => {
        if (!db) {
            reject(new Error('Database not initialized'));
            return;
        }

        const {
            id, date, teamA, teamB, teamALogo, teamBLogo, format,
            sequence, step, maps, logs, finished, lastPickedMap, playedMaps,
            useTimer, ready, timerEndsAt, timerDuration, useCoinFlip, coinFlip, keys
        } = match;

        const query = `
            INSERT OR REPLACE INTO match_history (
                id, date, teamA, teamB, teamALogo, teamBLogo, format,
                sequence, step, maps, logs, finished, lastPickedMap, playedMaps,
                useTimer, ready, timerEndsAt, timerDuration, useCoinFlip, coinFlip, keys_data
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        db.run(query, [
            id, date, teamA, teamB, teamALogo || null, teamBLogo || null, format,
            JSON.stringify(sequence), step, JSON.stringify(maps), JSON.stringify(logs),
            finished ? 1 : 0, lastPickedMap || null, JSON.stringify(playedMaps),
            useTimer ? 1 : 0, JSON.stringify(ready), timerEndsAt || null,
            timerDuration || 60, useCoinFlip ? 1 : 0,
            coinFlip ? JSON.stringify(coinFlip) : null, JSON.stringify(keys)
        ], (err) => {
            if (err) {
                console.error('[DB] Error saving match:', err);
                reject(err);
            } else {
                resolve();
            }
        });
    });
}

// Load all matches from database
function loadAllMatches() {
    return new Promise((resolve, reject) => {
        if (!db) {
            reject(new Error('Database not initialized'));
            return;
        }

        db.all('SELECT * FROM match_history ORDER BY date DESC', [], (err, rows) => {
            if (err) {
                console.error('[DB] Error loading matches:', err);
                reject(err);
                return;
            }

            const matches = rows.map(row => ({
                id: row.id,
                date: row.date,
                teamA: row.teamA,
                teamB: row.teamB,
                teamALogo: row.teamALogo,
                teamBLogo: row.teamBLogo,
                format: row.format,
                sequence: JSON.parse(row.sequence),
                step: row.step,
                maps: JSON.parse(row.maps),
                logs: JSON.parse(row.logs),
                finished: row.finished === 1,
                lastPickedMap: row.lastPickedMap,
                playedMaps: JSON.parse(row.playedMaps),
                useTimer: row.useTimer === 1,
                ready: JSON.parse(row.ready),
                timerEndsAt: row.timerEndsAt,
                timerDuration: row.timerDuration || 60,
                useCoinFlip: row.useCoinFlip === 1,
                coinFlip: row.coinFlip ? JSON.parse(row.coinFlip) : null,
                keys: JSON.parse(row.keys_data)
            }));

            resolve(matches);
        });
    });
}

// Get paginated matches (for public history)
function getPaginatedMatches(page = 1, limit = 10) {
    return new Promise((resolve, reject) => {
        if (!db) {
            reject(new Error('Database not initialized'));
            return;
        }

        const offset = (page - 1) * limit;

        // Get total count
        db.get('SELECT COUNT(*) as total FROM match_history WHERE finished = 1', [], (err, countRow) => {
            if (err) {
                console.error('[DB] Error getting count:', err);
                reject(err);
                return;
            }

            const totalMatches = countRow.total;

            // Get paginated matches
            db.all(
                'SELECT * FROM match_history WHERE finished = 1 ORDER BY date DESC LIMIT ? OFFSET ?',
                [limit, offset],
                (err, rows) => {
                    if (err) {
                        console.error('[DB] Error getting paginated matches:', err);
                        reject(err);
                        return;
                    }

                    const matches = rows.map(row => {
                        const { keys_data, sequence, maps, logs, ready, playedMaps, coinFlip, ...rest } = row;
                        return {
                            ...rest,
                            finished: rest.finished === 1,
                            useTimer: rest.useTimer === 1,
                            useCoinFlip: rest.useCoinFlip === 1,
                            sequence: JSON.parse(sequence),
                            maps: JSON.parse(maps),
                            logs: JSON.parse(logs),
                            ready: JSON.parse(ready),
                            playedMaps: JSON.parse(playedMaps),
                            coinFlip: coinFlip ? JSON.parse(coinFlip) : null
                        };
                    });

                    resolve({
                        matches,
                        totalMatches,
                        totalPages: Math.ceil(totalMatches / limit),
                        currentPage: page
                    });
                }
            );
        });
    });
}

// Get all matches (for admin)
function getAllMatches() {
    return new Promise((resolve, reject) => {
        if (!db) {
            reject(new Error('Database not initialized'));
            return;
        }

        db.all('SELECT * FROM match_history ORDER BY date DESC', [], (err, rows) => {
            if (err) {
                console.error('[DB] Error getting all matches:', err);
                reject(err);
                return;
            }

            const matches = rows.map(row => {
                const { keys_data, sequence, maps, logs, ready, playedMaps, coinFlip, ...rest } = row;
                return {
                    ...rest,
                    finished: rest.finished === 1,
                    useTimer: rest.useTimer === 1,
                    useCoinFlip: rest.useCoinFlip === 1,
                    sequence: JSON.parse(sequence),
                    maps: JSON.parse(maps),
                    logs: JSON.parse(logs),
                    ready: JSON.parse(ready),
                    playedMaps: JSON.parse(playedMaps),
                    coinFlip: coinFlip ? JSON.parse(coinFlip) : null,
                    keys: JSON.parse(keys_data)
                };
            });

            resolve(matches);
        });
    });
}

// Delete a match
function deleteMatch(matchId) {
    return new Promise((resolve, reject) => {
        if (!db) {
            reject(new Error('Database not initialized'));
            return;
        }

        db.run('DELETE FROM match_history WHERE id = ?', [matchId], (err) => {
            if (err) {
                console.error('[DB] Error deleting match:', err);
                reject(err);
            } else {
                resolve(true);
            }
        });
    });
}

// Close database connection
function closeDatabase() {
    return new Promise((resolve, reject) => {
        if (db) {
            db.close((err) => {
                if (err) {
                    console.error('[DB] Error closing database:', err);
                    reject(err);
                } else {
                    console.log('[DB] Database connection closed');
                    resolve();
                }
            });
        } else {
            resolve();
        }
    });
}

module.exports = {
    initDatabase,
    saveMatch,
    loadAllMatches,
    getPaginatedMatches,
    getAllMatches,
    deleteMatch,
    closeDatabase
};
