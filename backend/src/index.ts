import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import licenseRoutes from './routes/license';
import { initDb } from './db';

dotenv.config();

// Initialize Database
initDb();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.use('/api', licenseRoutes);

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
