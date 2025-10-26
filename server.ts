import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import problemRoutes from './routes/problems.js';

dotenv.config();

const app = express();
app.use(cors()); // ✅ Allow cross-origin requests
app.use(express.json());

// 👇 Root route (just to confirm server is working)
app.get('/', (req, res) => {
    res.send('✅ Server is running successfully!');
});

// 👇 API routes
app.use('/api/problems', problemRoutes);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`🚀 Backend running on port ${PORT}`));
