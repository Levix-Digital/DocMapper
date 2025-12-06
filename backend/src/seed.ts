import { db, initDb } from './db';

const seed = () => {
    initDb();

    const testKey = 'cpx_live_test';
    const testDomain = 'localhost';
    const customer = 'Test Account';

    const insert = `INSERT OR IGNORE INTO licenses (key, authorized_domain, is_active, customer_name) VALUES (?, ?, 1, ?)`;

    db.run(insert, [testKey, testDomain, customer], function (err) {
        if (err) {
            return console.error("Error seeding data:", err.message);
        }
        console.log(`Seeded test key: ${testKey} for domain: ${testDomain}`);
        // Close DB connection after seeding to iterate quickly
        db.close();
    });
};

seed();
