import 'dotenv/config';
import express from 'express';
import { query } from './config/db.js';

const app = express();
const PORT = process.env.PORT || 5000;

// Lets the server read JSON sent in request bodies
app.use(express.json());

// Health check 1: is the API alive?
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', app: 'CivicSync', time: new Date().toISOString() });
});

// Health check 2: can the API reach the database (and is PostGIS on)?
app.get('/api/health/db', async (req, res) => {
  try {
    const result = await query(
      'SELECT PostGIS_Version() AS postgis, version() AS postgres'
    );
    res.json({ status: 'ok', ...result.rows[0] });
  } catch (err) {
    // The detailed error goes to OUR terminal only. We never send
    // internal details to the browser, because attackers could use them.
    console.error('DB health check failed:', err.message);
    res.status(500).json({ status: 'error', message: 'Database connection failed' });
  }
});

app.listen(PORT, () => {
  console.log(`CivicSync API running on http://localhost:${PORT}`);
});