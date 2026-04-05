const express = require('express');
const axios = require('axios');
const app = express();
app.use(express.json());

const CHECKOUT_URL = process.env.CHECKOUT_URL || 'http://localhost:3002/checkout';

app.get('/health', (req, res) => res.send('OK'));
app.get('/api/ping', (req, res) => res.send('Pong'));
app.get('/api/arch', (req, res) => res.send('Microservices: Gateway -> Checkout -> (Pricing + Inventory + Postgres)'));

app.get('/', (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>E-Commerce Checkout System</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', sans-serif; background: #f0f2f5; color: #333; }
    header { background: #1a1a2e; color: white; padding: 20px 40px; display: flex; align-items: center; gap: 15px; }
    header h1 { font-size: 1.5rem; }
    header span { background: #16213e; padding: 4px 12px; border-radius: 20px; font-size: 0.8rem; color: #4cc9f0; }
    .container { max-width: 1100px; margin: 30px auto; padding: 0 20px; display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
    .card { background: white; border-radius: 12px; padding: 24px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
    .card h2 { font-size: 1rem; color: #666; margin-bottom: 16px; text-transform: uppercase; letter-spacing: 1px; }
    .services { grid-column: 1 / -1; display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
    .svc { background: white; border-radius: 10px; padding: 16px; text-align: center; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
    .svc .dot { width: 12px; height: 12px; border-radius: 50%; background: #ccc; margin: 0 auto 8px; }
    .svc .dot.green { background: #2ecc71; box-shadow: 0 0 8px #2ecc71; }
    .svc .dot.red { background: #e74c3c; box-shadow: 0 0 8px #e74c3c; }
    .svc-name { font-weight: 600; font-size: 0.9rem; }
    .svc-status { font-size: 0.75rem; color: #999; margin-top: 4px; }
    input, select { width: 100%; padding: 10px 14px; border: 1px solid #ddd; border-radius: 8px; font-size: 0.95rem; margin-bottom: 12px; }
    button { width: 100%; padding: 12px; background: #1a1a2e; color: white; border: none; border-radius: 8px; font-size: 1rem; cursor: pointer; transition: background 0.2s; }
    button:hover { background: #16213e; }
    button:disabled { background: #999; cursor: not-allowed; }
    .result { margin-top: 16px; padding: 14px; border-radius: 8px; font-size: 0.9rem; display: none; }
    .result.success { background: #eafaf1; border: 1px solid #2ecc71; }
    .result.error { background: #fdf0f0; border: 1px solid #e74c3c; }
    .result pre { white-space: pre-wrap; word-break: break-all; }
    .log-box { background: #1a1a2e; border-radius: 8px; padding: 16px; height: 220px; overflow-y: auto; font-family: monospace; font-size: 0.8rem; color: #4cc9f0; }
    .log-box .entry { margin-bottom: 6px; border-bottom: 1px solid #16213e; padding-bottom: 6px; }
    .log-box .entry .time { color: #888; }
    .log-box .entry .ok { color: #2ecc71; }
    .log-box .entry .err { color: #e74c3c; }
    .arch { grid-column: 1 / -1; }
    .arch-diagram { display: flex; align-items: center; justify-content: center; gap: 0; flex-wrap: wrap; margin-top: 10px; }
    .node { background: #1a1a2e; color: white; padding: 10px 18px; border-radius: 8px; font-size: 0.85rem; text-align: center; }
    .node.dep { background: #16213e; border: 1px solid #4cc9f0; color: #4cc9f0; }
    .arrow { color: #999; font-size: 1.2rem; padding: 0 8px; }
    .deps { display: flex; flex-direction: column; gap: 8px; }
    label { font-size: 0.85rem; color: #666; margin-bottom: 4px; display: block; }
  </style>
</head>
<body>
  <header>
    <h1>🛒 E-Commerce Checkout System</h1>
    <span>Kubernetes / K3s</span>
    <span>Microservices</span>
  </header>
  <div class="container">
    <div class="services">
      <div class="svc"><div class="dot" id="dot-gateway"></div><div class="svc-name">Gateway</div><div class="svc-status" id="status-gateway">Checking...</div></div>
      <div class="svc"><div class="dot" id="dot-checkout"></div><div class="svc-name">Checkout</div><div class="svc-status" id="status-checkout">Checking...</div></div>
      <div class="svc"><div class="dot" id="dot-pricing"></div><div class="svc-name">Pricing</div><div class="svc-status" id="status-pricing">Checking...</div></div>
      <div class="svc"><div class="dot" id="dot-inventory"></div><div class="svc-name">Inventory</div><div class="svc-status" id="status-inventory">Checking...</div></div>
    </div>
    <div class="card">
      <h2>Place Order</h2>
      <label>Product ID</label>
      <input type="number" id="productId" value="1" min="1">
      <label>Quantity (>10 triggers out-of-stock)</label>
      <input type="number" id="quantity" value="1" min="1">
      <label>Request ID</label>
      <input type="text" id="requestId" value="req-001">
      <button onclick="placeOrder()" id="btn">Place Order</button>
      <div class="result" id="result"></div>
    </div>
    <div class="card">
      <h2>Request Log</h2>
      <div class="log-box" id="log"></div>
    </div>
    <div class="card arch">
      <h2>System Architecture</h2>
      <div class="arch-diagram">
        <div class="node">Browser</div><div class="arrow">→</div>
        <div class="node">Ingress<br><small>Traefik</small></div><div class="arrow">→</div>
        <div class="node">Gateway<br><small>:3003</small></div><div class="arrow">→</div>
        <div class="node">Checkout<br><small>:3002</small></div><div class="arrow">→</div>
        <div class="deps">
          <div class="node dep">Pricing :3000</div>
          <div class="node dep">Inventory :3001</div>
          <div class="node dep">Postgres :5432</div>
        </div>
      </div>
    </div>
  </div>
  <script>
    async function checkHealth(service, url) {
      try {
        const r = await fetch(url);
        document.getElementById('dot-' + service).className = r.ok ? 'dot green' : 'dot red';
        document.getElementById('status-' + service).textContent = r.ok ? 'Healthy' : 'Unhealthy';
      } catch {
        document.getElementById('dot-' + service).className = 'dot red';
        document.getElementById('status-' + service).textContent = 'Unavailable';
      }
    }
    function checkAllHealth() {
      checkHealth('gateway', '/health');
      checkHealth('checkout', '/api/health/checkout');
      checkHealth('pricing', '/api/health/pricing');
      checkHealth('inventory', '/api/health/inventory');
    }
    function addLog(requestId, status, message) {
      const log = document.getElementById('log');
      const time = new Date().toLocaleTimeString();
      const cls = status === 'OK' ? 'ok' : 'err';
      log.innerHTML = '<div class="entry"><span class="time">' + time + '</span> <span class="' + cls + '">[' + status + ']</span> ' + requestId + ' — ' + message + '</div>' + log.innerHTML;
    }
    async function placeOrder() {
      const productId = document.getElementById('productId').value;
      const quantity = document.getElementById('quantity').value;
      const requestId = document.getElementById('requestId').value || ('req-' + Date.now());
      const btn = document.getElementById('btn');
      const result = document.getElementById('result');
      btn.disabled = true;
      btn.textContent = 'Processing...';
      result.style.display = 'none';
      try {
        const start = Date.now();
        const r = await fetch('/api/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Request-Id': requestId },
          body: JSON.stringify({ productId: parseInt(productId), quantity: parseInt(quantity) })
        });
        const elapsed = Date.now() - start;
        const data = await r.json();
        if (r.ok) {
          result.className = 'result success';
          result.innerHTML = '<strong>Order Successful!</strong><br><pre>' + JSON.stringify(data, null, 2) + '</pre><br><small>Latency: ' + elapsed + 'ms | Request-Id: ' + requestId + '</small>';
          addLog(requestId, 'OK', 'Order placed in ' + elapsed + 'ms');
        } else {
          result.className = 'result error';
          result.innerHTML = '<strong>' + (data.error || 'Failed') + '</strong><br><pre>' + JSON.stringify(data, null, 2) + '</pre><br><small>Latency: ' + elapsed + 'ms</small>';
          addLog(requestId, 'ERR', data.error || 'Unknown error');
        }
        result.style.display = 'block';
      } catch (err) {
        result.className = 'result error';
        result.innerHTML = '<strong>Network Error</strong><br>' + err.message;
        result.style.display = 'block';
        addLog(requestId, 'ERR', err.message);
      }
      btn.disabled = false;
      btn.textContent = 'Place Order';
    }
    checkAllHealth();
    setInterval(checkAllHealth, 10000);
  </script>
</body>
</html>`);
});

app.get('/api/health/checkout', async (req, res) => {
  try { await axios.get('http://checkout-svc:3002/health', { timeout: 2000 }); res.send('OK'); }
  catch { res.status(503).send('UNAVAILABLE'); }
});

app.get('/api/health/pricing', async (req, res) => {
  try { await axios.get('http://pricing-svc:3000/health', { timeout: 2000 }); res.send('OK'); }
  catch { res.status(503).send('UNAVAILABLE'); }
});

app.get('/api/health/inventory', async (req, res) => {
  try { await axios.get('http://inventory-svc:3001/health', { timeout: 2000 }); res.send('OK'); }
  catch { res.status(503).send('UNAVAILABLE'); }
});

app.post('/api/checkout', async (req, res) => {
  const requestId = req.headers['x-request-id'] || 'N/A';
  console.log(`[Gateway] Request ID: ${requestId}`);
  try {
    const response = await axios.post(CHECKOUT_URL, req.body, {
      headers: { 'X-Request-Id': requestId },
      timeout: 3000
    });
    res.json(response.data);
  } catch (err) {
    console.error(`[Gateway] Error for Request ID: ${requestId}: ${err.message}`);
    if (err.response) {
      return res.status(err.response.status).json(err.response.data);
    }
    const isTimeout = err.code === 'ECONNABORTED';
    const isRefused = err.code === 'ECONNREFUSED';
    const status = (isTimeout || isRefused) ? 503 : 500;
    res.status(status).json({
      error: isTimeout
        ? 'Checkout service did not respond in time'
        : isRefused
          ? 'Checkout service is unavailable'
          : 'Gateway error',
      requestId
    });
  }
});

app.listen(3003, () => console.log('Gateway service running on port 3003'));