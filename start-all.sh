#!/bin/bash

# =============================
# Kill any Node processes using ports 3000-3003
# =============================
for port in 3000 3001 3002 3003; do
  pid=$(lsof -t -i :$port)
  if [ ! -z "$pid" ]; then
    echo "Killing process on port $port (PID $pid)"
    kill -9 $pid
  fi
done

# =============================
# Start services in background
# =============================

# Pricing
cd pricing
nohup node server.js > ../logs/pricing.log 2>&1 &
echo "Pricing started on port 3000"

# Inventory
cd ../inventory
nohup node server.js > ../logs/inventory.log 2>&1 &
echo "Inventory started on port 3001"

# Checkout
cd ../checkout
nohup node server.js > ../logs/checkout.log 2>&1 &
echo "Checkout started on port 3002"

# Gateway
cd ../gateway
nohup node server.js > ../logs/gateway.log 2>&1 &
echo "Gateway started on port 3003"

echo "All services started. Logs are in ./logs/"
