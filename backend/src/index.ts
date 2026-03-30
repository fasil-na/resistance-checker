import express, { type Request, type Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001;

app.use(cors());
app.use(express.json());

// Sample data
const activities = [
    { id: 1, name: 'Daily Workout', status: 'Completed', icon: 'zap' },
    { id: 2, name: 'Morning Meditation', status: 'Pending', icon: 'sun' },
    { id: 3, name: 'Reading Session', status: 'Ongoing', icon: 'book' },
    { id: 4, name: 'Code Review', status: 'Completed', icon: 'code' },
];

app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/activities', (_req: Request, res: Response) => {
    res.json(activities);
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
