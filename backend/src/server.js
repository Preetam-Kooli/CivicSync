import 'dotenv/config';
import express from 'express';

const app = express();
const PORT = process.env.PORT || 5000;

// Lets the server read JSON sent in request bodies
app.use(express.json());

// Health check: a tiny endpoint to prove the API is alive
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', app: 'CivicSync', time: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`CivicSync API running on http://localhost:${PORT}`);
});