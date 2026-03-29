const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');

const DB_FILE = path.join(__dirname, 'match_history.db');

let db = null;

// Default permissions for reference
const ALL_PERMISSIONS = [
    'create_match',
    'delete_match',
    'reset_match',
    'manage_maps',
    'manage_webhook',
    'nuke_history',
    'view_history',
    'manage_users'
];

// Initialize database and create tables if needed
function initDatabase() {
    return new Promise((resolve, reject) => {
        db = new sqlite3.Database(DB_FILE, (err) => {
            if (err) {
                console.error('[DB] Error opening database:', err);
                reject(err);
                return;
            }
            console.log('[DB] Connected to SQLite database');

            // Create match_history table
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
                    keys_data TEXT NOT NULL,
                    tempWebhookUrl TEXT
                )
            `, (err) => {
                if (err) {
                    console.error('[DB] Error creating match_history table:', err);
                    reject(err);
                    return;
                }
                console.log('[DB] match_history table created/verified successfully');

                // Create users table
                db.run(`
                    CREATE TABLE IF NOT EXISTS users (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        username TEXT UNIQUE NOT NULL,
                        password_hash TEXT NOT NULL,
                        role TEXT NOT NULL DEFAULT 'admin',
                        permissions TEXT NOT NULL DEFAULT '[]',
                        must_change_password INTEGER NOT NULL DEFAULT 0,
                        created_at TEXT NOT NULL,
                        updated_at TEXT NOT NULL
                    )
                `, async (err) => {
                    if (err) {
                        console.error('[DB] Error creating users table:', err);
                        reject(err);
                        return;
                    }
                    console.log('[DB] users table created/verified successfully');

                    // Seed default super admin if no users exist
                    try {
                        await seedDefaultAdmin();
                        resolve();
                    } catch (seedErr) {
                        console.error('[DB] Error seeding default admin:', seedErr);
                        reject(seedErr);
                    }
                });
            });
        });
    });
}

// Seed a default super_admin if no users exist
function seedDefaultAdmin() {
    return new Promise((resolve, reject) => {
        db.get('SELECT COUNT(*) as count FROM users', [], async (err, row) => {
            if (err) {
                reject(err);
                return;
            }
            if (row.count === 0) {
                try {
                    const hash = await bcrypt.hash('admin123', 10);
                    const now = new Date().toISOString();
                    db.run(
                        `INSERT INTO users (username, password_hash, role, permissions, must_change_password, created_at, updated_at)
                         VALUES (?, ?, ?, ?, ?, ?, ?)`,
                        ['admin', hash, 'super_admin', JSON.stringify(ALL_PERMISSIONS), 1, now, now],
                        (err) => {
                            if (err) {
                                reject(err);
                            } else {
                                console.log('[DB] ✅ Default super admin created (username: admin, password: admin123)');
                                resolve();
                            }
                        }
                    );
                } catch (hashErr) {
                    reject(hashErr);
                }
            } else {
                resolve();
            }
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
            useTimer, ready, timerEndsAt, timerDuration, useCoinFlip, coinFlip, keys, tempWebhookUrl
        } = match;

        const query = `
            INSERT OR REPLACE INTO match_history (
                id, date, teamA, teamB, teamALogo, teamBLogo, format,
                sequence, step, maps, logs, finished, lastPickedMap, playedMaps,
                useTimer, ready, timerEndsAt, timerDuration, useCoinFlip, coinFlip, keys_data, tempWebhookUrl
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        db.run(query, [
            id, date, teamA, teamB, teamALogo || null, teamBLogo || null, format,
            JSON.stringify(sequence), step, JSON.stringify(maps), JSON.stringify(logs),
            finished ? 1 : 0, lastPickedMap || null, JSON.stringify(playedMaps),
            useTimer ? 1 : 0, JSON.stringify(ready), timerEndsAt || null,
            timerDuration || 60, useCoinFlip ? 1 : 0,
            coinFlip ? JSON.stringify(coinFlip) : null, JSON.stringify(keys),
            tempWebhookUrl || null
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
                keys: JSON.parse(row.keys_data),
                tempWebhookUrl: row.tempWebhookUrl
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
                            coinFlip: coinFlip ? JSON.parse(coinFlip) : null,
                            tempWebhookUrl: rest.tempWebhookUrl
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
                    keys: JSON.parse(keys_data),
                    tempWebhookUrl: rest.tempWebhookUrl
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

// Delete all matches
function deleteAllMatches() {
    return new Promise((resolve, reject) => {
        if (!db) {
            reject(new Error('Database not initialized'));
            return;
        }

        db.run('DELETE FROM match_history', [], (err) => {
            if (err) {
                console.error('[DB] Error deleting all matches:', err);
                reject(err);
            } else {
                console.log('[DB] All matches deleted');
                resolve(true);
            }
        });
    });
}

// ==================== USER MANAGEMENT ====================

// Get user by username
function getUserByUsername(username) {
    return new Promise((resolve, reject) => {
        if (!db) { reject(new Error('Database not initialized')); return; }
        db.get('SELECT * FROM users WHERE username = ?', [username], (err, row) => {
            if (err) { reject(err); return; }
            if (row) {
                row.permissions = JSON.parse(row.permissions);
                row.must_change_password = row.must_change_password === 1;
            }
            resolve(row || null);
        });
    });
}

// Get user by ID
function getUserById(id) {
    return new Promise((resolve, reject) => {
        if (!db) { reject(new Error('Database not initialized')); return; }
        db.get('SELECT * FROM users WHERE id = ?', [id], (err, row) => {
            if (err) { reject(err); return; }
            if (row) {
                row.permissions = JSON.parse(row.permissions);
                row.must_change_password = row.must_change_password === 1;
            }
            resolve(row || null);
        });
    });
}

// Get all users (without password hashes)
function getAllUsers() {
    return new Promise((resolve, reject) => {
        if (!db) { reject(new Error('Database not initialized')); return; }
        db.all('SELECT id, username, role, permissions, must_change_password, created_at, updated_at FROM users ORDER BY created_at ASC', [], (err, rows) => {
            if (err) { reject(err); return; }
            resolve(rows.map(row => ({
                ...row,
                permissions: JSON.parse(row.permissions),
                must_change_password: row.must_change_password === 1
            })));
        });
    });
}

// Create a new user
function createUser(username, password, role, permissions) {
    return new Promise(async (resolve, reject) => {
        if (!db) { reject(new Error('Database not initialized')); return; }
        try {
            const hash = await bcrypt.hash(password, 10);
            const now = new Date().toISOString();
            db.run(
                `INSERT INTO users (username, password_hash, role, permissions, must_change_password, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [username, hash, role || 'admin', JSON.stringify(permissions || []), 1, now, now],
                function(err) {
                    if (err) {
                        if (err.message.includes('UNIQUE')) {
                            reject(new Error('Username already exists'));
                        } else {
                            reject(err);
                        }
                    } else {
                        resolve({ id: this.lastID, username, role: role || 'admin', permissions: permissions || [] });
                    }
                }
            );
        } catch (hashErr) {
            reject(hashErr);
        }
    });
}

// Update user (role, permissions)
function updateUser(id, updates) {
    return new Promise((resolve, reject) => {
        if (!db) { reject(new Error('Database not initialized')); return; }
        const now = new Date().toISOString();
        const fields = [];
        const values = [];

        if (updates.role !== undefined) { fields.push('role = ?'); values.push(updates.role); }
        if (updates.permissions !== undefined) { fields.push('permissions = ?'); values.push(JSON.stringify(updates.permissions)); }
        if (updates.must_change_password !== undefined) { fields.push('must_change_password = ?'); values.push(updates.must_change_password ? 1 : 0); }

        fields.push('updated_at = ?');
        values.push(now);
        values.push(id);

        db.run(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, values, function(err) {
            if (err) { reject(err); } else { resolve(this.changes > 0); }
        });
    });
}

// Update user password
function updateUserPassword(id, newPassword) {
    return new Promise(async (resolve, reject) => {
        if (!db) { reject(new Error('Database not initialized')); return; }
        try {
            const hash = await bcrypt.hash(newPassword, 10);
            const now = new Date().toISOString();
            db.run(
                'UPDATE users SET password_hash = ?, must_change_password = 0, updated_at = ? WHERE id = ?',
                [hash, now, id],
                function(err) {
                    if (err) { reject(err); } else { resolve(this.changes > 0); }
                }
            );
        } catch (hashErr) {
            reject(hashErr);
        }
    });
}

// Delete a user
function deleteUser(id) {
    return new Promise((resolve, reject) => {
        if (!db) { reject(new Error('Database not initialized')); return; }
        db.run('DELETE FROM users WHERE id = ?', [id], function(err) {
            if (err) { reject(err); } else { resolve(this.changes > 0); }
        });
    });
}

// Verify user password
function verifyPassword(plainPassword, hash) {
    return bcrypt.compare(plainPassword, hash);
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
    deleteAllMatches,
    closeDatabase,
    // User management
    getUserByUsername,
    getUserById,
    getAllUsers,
    createUser,
    updateUser,
    updateUserPassword,
    deleteUser,
    verifyPassword,
    ALL_PERMISSIONS
};
