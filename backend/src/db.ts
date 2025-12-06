import sqlite3 from 'sqlite3';
import path from 'path';

const dbPath = path.resolve(__dirname, '../licenses.db');

export const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
    } else {
        console.log('Connected to the SQLite database.');
    }
});

export const initDb = () => {
    db.serialize(() => {
        db.run(`CREATE TABLE IF NOT EXISTS licenses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            key TEXT NOT NULL UNIQUE,
            authorized_domain TEXT NOT NULL,
            is_active INTEGER DEFAULT 1,
            customer_name TEXT
        )`, (err) => {
            if (err) {
                console.error("Error creating table:", err.message);
            } else {
                console.log("Licenses table ready.");
            }
        });
    });
};
