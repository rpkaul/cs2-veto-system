const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_FILE = path.join(__dirname, 'match_history.db');

console.log('[MIGRATION] Starting database migration...');

const db = new sqlite3.Database(DB_FILE, (err) => {
    if (err) {
        console.error('[MIGRATION] Error opening database:', err);
        process.exit(1);
    }
    console.log('[MIGRATION] Connected to database');
});

// Check if column exists
db.get("PRAGMA table_info(match_history)", (err, row) => {
    if (err) {
        console.error('[MIGRATION] Error checking table:', err);
        db.close();
        process.exit(1);
    }
});

// Add column if it doesn't exist
db.run(`ALTER TABLE match_history ADD COLUMN tempWebhookUrl TEXT`, (err) => {
    if (err) {
        if (err.message.includes('duplicate column name')) {
            console.log('[MIGRATION] Column tempWebhookUrl already exists, skipping...');
        } else {
            console.error('[MIGRATION] Error adding column:', err);
            db.close();
            process.exit(1);
        }
    } else {
        console.log('[MIGRATION] ✅ Successfully added tempWebhookUrl column');
    }

    db.close((err) => {
        if (err) {
            console.error('[MIGRATION] Error closing database:', err);
        } else {
            console.log('[MIGRATION] Migration complete!');
        }
    });
});
