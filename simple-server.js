import express from 'express';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => {
    res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

app.get('/api/bot/status', (req, res) => {
    res.send('Bot status: stopped (simulation)');
});

app.post('/api/bot/start', (req, res) => {
    res.send('Bot started (simulation)');
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`🤖 Bot endpoints available at http://localhost:${PORT}/api/bot`);
    console.log(`📊 Health check at http://localhost:${PORT}/api/health`);
});
