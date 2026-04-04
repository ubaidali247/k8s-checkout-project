const express = require('express');
const app = express();

app.use(express.json());

app.get('/health', (req, res) => {
  res.send('OK');
});

app.get('/price', (req, res) => {
  const requestId = req.headers['x-request-id'] || 'N/A';
  console.log(`[Pricing] Request ID: ${requestId}`);

  res.json({
    product: "item-123",
    price: 100
  });
});

app.listen(3000, () => {
  console.log('Pricing service running on port 3000');
});
