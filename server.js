const express = require('express');
const axios = require('axios');
const app = express();

app.use(express.json());

const PRICING_URL = 'http://localhost:3000/price';
const INVENTORY_URL = 'http://localhost:3001/stock';

app.get('/health', (req, res) => res.send('OK'));

app.post('/checkout', async (req, res) => {
  const requestId = req.headers['x-request-id'] || 'N/A';
  console.log(`[Checkout] Request ID: ${requestId}`);
  try {
    const pricing = await axios.get(PRICING_URL, { headers: { 'X-Request-Id': requestId }, timeout: 2000 });
    const inventory = await axios.get(INVENTORY_URL, { headers: { 'X-Request-Id': requestId }, timeout: 2000 });
    res.json({
      product: pricing.data.product,
      price: pricing.data.price,
      available: inventory.data.available,
      quantity: inventory.data.quantity
    });
  } catch (err) {
    console.error(`[Checkout] Error: ${err.message}`);
    res.status(500).json({ error: 'Checkout failed', details: err.message });
  }
});

app.listen(3002, () => console.log('Checkout service running on port 3002'));
