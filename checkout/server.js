const express = require('express');
const axios = require('axios');
const { Pool } = require('pg');
const app = express();
app.use(express.json());

const PRICING_URL = process.env.PRICING_URL || 'http://localhost:3000/price';
const INVENTORY_URL = process.env.INVENTORY_URL || 'http://localhost:3001/stock';

const pool = new Pool({
  host: process.env.PGHOST || 'postgres-svc',
  user: process.env.PGUSER || 'checkoutuser',
  password: process.env.PGPASSWORD || 'checkoutpass',
  database: process.env.PGDATABASE || 'checkoutdb',
  port: 5432,
});

async function initDb() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id SERIAL PRIMARY KEY,
        product TEXT,
        price INT,
        stock INT,
        request_id TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('[Checkout] Database ready');
  } catch (err) {
    console.error('[Checkout] DB init error:', err.message);
  }
}

initDb();

app.get('/health', (req, res) => res.send('OK'));

app.post('/checkout', async (req, res) => {
  const requestId = req.headers['x-request-id'] || 'N/A';
  console.log(`[Checkout] Request ID: ${requestId}`);
  try {
    const pricing = await axios.get(PRICING_URL, {
      headers: { 'X-Request-Id': requestId },
      timeout: 2000
    });
    const inventory = await axios.get(INVENTORY_URL, {
      headers: { 'X-Request-Id': requestId },
      timeout: 2000
    });

    const result = {
      product: pricing.data.product,
      price: pricing.data.price,
      stock: inventory.data.stock
    };

    try {
      await pool.query(
        'INSERT INTO orders (product, price, stock, request_id) VALUES ($1, $2, $3, $4)',
        [result.product, result.price, result.stock, requestId]
      );
      console.log(`[Checkout] Order saved to DB for Request ID: ${requestId}`);
    } catch (dbErr) {
      console.error(`[Checkout] DB save error: ${dbErr.message}`);
    }

    res.json(result);
  } catch (err) {
    console.error(`[Checkout] Error: ${err.message}`);
    res.status(500).json({ error: 'Checkout failed', details: err.message });
  }
});

app.listen(3002, () => console.log('Checkout service running on port 3002'));