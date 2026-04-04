# K8s Checkout System

A microservices-based e-commerce checkout system deployed on Kubernetes (K3s).

## Architecture

Browser → Ingress (Traefik) → Gateway → Checkout → Pricing + Inventory + Postgres

## Services

| Service | Port | Description |
|---------|------|-------------|
| Gateway | 3003 | Public entry point, serves UI |
| Checkout | 3002 | Orchestrates pricing + inventory |
| Pricing | 3000 | Returns product price |
| Inventory | 3001 | Returns stock levels |
| Postgres | 5432 | Persists order records |

## Deploy from scratch

### 1. Build and import images
```bash
sudo docker build -t gateway:latest ./gateway
sudo docker build -t checkout:latest ./checkout
sudo docker build -t pricing:latest ./pricing
sudo docker build -t inventory:latest ./inventory

sudo docker save gateway:latest | sudo k3s ctr images import -
sudo docker save checkout:latest | sudo k3s ctr images import -
sudo docker save pricing:latest | sudo k3s ctr images import -
sudo docker save inventory:latest | sudo k3s ctr images import -
```

### 2. Deploy to K3s
```bash
kubectl apply -f k8s/postgres.yaml
kubectl apply -f k8s/pricing.yaml
kubectl apply -f k8s/inventory.yaml
kubectl apply -f k8s/checkout.yaml
kubectl apply -f k8s/gateway.yaml
kubectl apply -f k8s/keda-scaler.yaml
```

### 3. Verify
```bash
kubectl get pods,svc,ingress
```

### 4. Test
```bash
curl -X POST http://<INGRESS-IP>/api/checkout \
  -H "Content-Type: application/json" \
  -H "X-Request-Id: test-001" \
  -d '{"productId":1,"quantity":2}'
```

## Features

- ✅ Request correlation via X-Request-Id across all services
- ✅ KEDA scale-to-zero for inventory service
- ✅ Postgres persistence with PVC-backed storage
- ✅ Partial failure handling with timeouts
- ✅ Live health dashboard UI
- ✅ Traefik ingress routing