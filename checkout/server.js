const express = require('express');
const axios = require('axios');
const { Pool } = require('pg');
const app = express();
app.use(express.json());

const PRICING_URL = process.env.PRICING_URL || 'http://localhost:3000/price';
const INVENTORY_URL = process.env.INVENTORY_URL || 'http://localhost:3001/stock';

// Structured JSON logger
function log(level, service, message, extra = {}) {
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    service,
    message,
    ...extra
  }));
}

// Prometheus metrics
let httpRequestsTotal = {};
let httpRequestDuration = {};

function recordRequest(method, path, status, durationMs) {
  const key = `${method}_${path}_${status}`;
  httpRequestsTotal[key] = (httpRequestsTotal[key] || 0) + 1;
  if (!httpRequestDuration[key]) httpRequestDuration[key] = [];
  httpRequestDuration[key].push(durationMs);
}

app.get('/metrics', (req, res) => {
  let output = '';
  output += '# HELP http_requests_total Total HTTP requests\n';
  output += '# TYPE http_requests_total counter\n';
  for (const [key, count] of Object.entries(httpRequestsTotal)) {
    const [method, path, status] = key.split('_');
    output += `http_requests_total{service="checkout",method="${method}",path="${path}",status="${status}"} ${count}\n`;
  }
  output += '# HELP http_request_duration_ms HTTP request duration\n';
  output += '# TYPE http_request_duration_ms gauge\n';
  for (const [key, durations] of Object.entries(httpRequestDuration)) {
    const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
    const [method, path, status] = key.split('_');
    output += `http_request_duration_ms{service="checkout",method="${method}",path="${path}",status="${status}"} ${avg.toFixed(2)}\n`;
  }
  res.set('Content-Type', 'text/plain');
  res.send(output);
});

const pool = new Pool({
  host: process.env.PGHOST || 'postgres-svc',
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE,
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
        status TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    log('info', 'checkout', 'Database ready');
  } catch (err) {
    log('error', 'checkout', 'DB init error', { error: err.message });
  }
}

initDb();

app.get('/health', (req, res) => res.send('OK'));

app.post('/checkout', async (req, res) => {
  const requestId = req.headers['x-request-id'] || 'N/A';
  const { quantity } = req.body;
  const start = Date.now();

  if (!quantity || typeof quantity !== 'number' || quantity <= 0) {
    log('warn', 'checkout', 'Invalid input', { requestId, quantity });
    return res.status(400).json({ error: 'Invalid input', details: 'quantity must be a positive number', requestId });
  }

  log('info', 'checkout', 'Processing checkout', { requestId, quantity });

  try {
    const pricing = await axios.get(PRICING_URL, {
      headers: { 'X-Request-Id': requestId },
      timeout: 2000
    });

    const inventory = await axios.get(`${INVENTORY_URL}?quantity=${quantity}`, {
      headers: { 'X-Request-Id': requestId },
      timeout: 2000
    });

    if (!inventory.data.available) {
      log('warn', 'checkout', 'Out of stock', { requestId, quantity });
      try {
        await pool.query(
          'INSERT INTO orders (product, price, stock, request_id, status) VALUES ($1, $2, $3, $4, $5)',
          [pricing.data.product, pricing.data.price, 0, requestId, 'out_of_stock']
        );
      } catch (dbErr) {
        log('error', 'checkout', 'DB insert error', { requestId, error: dbErr.message });
      }
      const duration = Date.now() - start;
      recordRequest('POST', 'checkout', '400', duration);
      return res.status(400).json({ error: 'Out of stock', product: pricing.data.product, price: pricing.data.price, available: false });
    }

    const result = { product: pricing.data.product, price: pricing.data.price, stock: inventory.data.stock };

    try {
      await pool.query(
        'INSERT INTO orders (product, price, stock, request_id, status) VALUES ($1, $2, $3, $4, $5)',
        [result.product, result.price, result.stock, requestId, 'success']
      );
      log('info', 'checkout', 'Order saved', { requestId, product: result.product, price: result.price });
    } catch (dbErr) {
      log('error', 'checkout', 'DB insert error', { requestId, error: dbErr.message });
    }

    const duration = Date.now() - start;
    recordRequest('POST', 'checkout', '200', duration);
    log('info', 'checkout', 'Checkout complete', { requestId, durationMs: duration });
    res.json(result);

  } catch (err) {
    const duration = Date.now() - start;
    const isTimeout = err.code === 'ECONNABORTED';
    const isRefused = err.code === 'ECONNREFUSED';
    const status = (isTimeout || isRefused) ? 503 : 500;
    log('error', 'checkout', 'Checkout failed', { requestId, durationMs: duration, error: err.m