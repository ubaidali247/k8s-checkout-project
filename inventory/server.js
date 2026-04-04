const express = require('express');
const app = express();
app.use(express.json());

app.get('/health', (req, res) => res.send('OK'));

app.get('/stock/:sku', (req, res) => {
  const requestId = req.headers['x-request-id'] || 'N/A';
  console.log(`[Inventory] Request ID: ${requestId}, SKU: ${req.params.sku}`);
  res.json({ sku: req.params.sku, available: true, quantity: 50 });
});

app.get('/stock', (req, res) => {
  const requestId = req.headers['x-request-id'] || 'N/A';
  const quantity = parseInt(req.query.quantity) || 1;
  console.log(`[Inventory] Request ID: ${requestId}, Quantity requested: ${quantity}`);

  if (quantity > 10) {
    return res.status(200).json({
      available: false,
      quantity: 0,
      stock: 0,
      reason: 'Out of stock'
    });
  }

  res.json({ available: true, quantity: 50, stock: 50 });
});

app.listen(3001, () => console.log('Inventory service running on port 3001'));