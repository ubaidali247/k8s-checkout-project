const express = require('express');
const app = express();
app.use(express.json());

app.get('/health', (req, res) => res.send('OK'));

app.get('/stock', (req, res) => {
  const requestId = req.headers['x-request-id'] || 'N/A';
  console.log(`[Inventory] Request ID: ${requestId}`);
  res.json({
    product: "item-123",
    stock: 50
  });
});

app.listen(3001, () => console.log('Inventory service running on port 3001'));