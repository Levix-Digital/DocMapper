import { Router, Request, Response } from 'express';
import { db } from '../db';
import rateLimit from 'express-rate-limit';

const router = Router();

// Rate Limiting: Max 100 requests per minute per IP
const verifyLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 100, // limit each IP to 100 requests per windowMs
    message: { valid: false, error: 'Too many requests, please try again later.' }
});

router.post('/verify', verifyLimiter, (req: Request, res: Response) => {
    const { key, domain } = req.body;

    if (!key || !domain) {
        return res.status(400).json({ valid: false, error: 'Missing key or domain' });
    }

    // Validate key format (Starts with cpx_live_)
    if (!key.startsWith('cpx_live_')) {
        return res.status(400).json({ valid: false, error: 'Invalid license key format' });
    }

    // Database Query
    const query = `SELECT * FROM licenses WHERE key = ? AND authorized_domain = ? AND is_active = 1`;

    db.get(query, [key, domain], (err, row) => {
        if (err) {
            console.error("Database error during verification:", err.message);
            // Treat DB error as network/server error (500) so client retries
            return res.status(500).json({ valid: false, error: 'Internal server error' });
        }

        if (row) {
            return res.json({ valid: true });
        } else {
            // Log unauthorized attempt
            console.warn(`Unauthorized license attempt. Key: ${key}, Domain: ${domain}, IP: ${req.ip}`);
            return res.status(403).json({ valid: false, error: 'License invalid' });
        }
    });
});

export default router;
