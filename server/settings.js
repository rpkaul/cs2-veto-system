const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_FILE = path.join(__dirname, 'match_history.db');

let db = null;

// Initialize settings table
function initSettingsTable() {
    return new Promise((resolve, reject) => {
        db = new sqlite3.Database(DB_FILE, (err) => {
            if (err) {
                console.error('[SETTINGS] Error opening database:', err);
                reject(err);
                return;
            }

            // Create settings table if it doesn't exist
            db.run(`
                CREATE TABLE IF NOT EXISTS settings (
                    key TEXT PRIMARY KEY,
                    value TEXT
                )
            `, (err) => {
                if (err) {
                    console.error('[SETTINGS] Error creating settings table:', err);
                    reject(err);
                } else {
                    console.log('[SETTINGS] Settings table created/verified successfully');
                    resolve();
                }
            });
        });
    });
}

// Get admin webhook URL
function getAdminWebhook() {
    return new Promise((resolve, reject) => {
        if (!db) {
            reject(new Error('Database not initialized'));
            return;
        }

        db.get('SELECT value FROM settings WHERE key = ?', ['admin_webhook'], (err, row) => {
            if (err) {
                console.error('[SETTINGS] Error getting admin webhook:', err);
                reject(err);
            } else {
                resolve(row ? row.value : null);
            }
        });
    });
}

// Set admin webhook URL
function setAdminWebhook(url) {
    return new Promise((resolve, reject) => {
        if (!db) {
            reject(new Error('Database not initialized'));
            return;
        }

        db.run(
            'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
            ['admin_webhook', url],
            (err) => {
                if (err) {
                    console.error('[SETTINGS] Error setting admin webhook:', err);
                    reject(err);
                } else {
                    console.log('[SETTINGS] Admin webhook updated successfully');
                    resolve();
                }
            }
        );
    });
}

module.exports = {
    initSettingsTable,
    getAdminWebhook,
    setAdminWebhook
};
