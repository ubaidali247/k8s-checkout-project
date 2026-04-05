# K8s Microservices Checkout System

A nanoservices-based e-commerce checkout system deployed on Kubernetes (K3s) with KEDA autoscaling, Postgres persistence, and Traefik ingress.

---

## System Architecture

    Browser / curl
          │
          ▼
    Ingress (Traefik) ── port 80
          │
          ▼
    Gateway Service ── port 3003
          │   serves: / (UI), /api/checkout, /api/ping, /api/arch, /health
          ▼
    Checkout Service ── port 3002
          │   handles: validation, timeouts, DB writes
          ├─────────────────────┬──────────────────────┐
          ▼                     ▼                      ▼
    Pricing Service       Inventory Service        Postgres
    port 3000             port 3001                port 5432
    /price, /health       /stock, /health          PVC-backed
                          KEDA scale-to-zero        Secret credentials

---

## Request Flow with Correlation ID

    Client
      │  POST /api/checkout  (X-Request-Id: abc)
      ▼
    Gateway ──logs──▶ [Gateway] Request ID: abc
      │  POST /checkout  (X-Request-Id: abc)
      ▼
    Checkout ──logs──▶ [Checkout] Request ID: abc
      ├── GET /price  (X-Request-Id: abc) ──▶ Pricing   ──logs──▶ [Pricing]   Request ID: abc
      └── GET /stock  (X-Request-Id: abc) ──▶ Inventory ──logs──▶ [Inventory] Request ID: abc
      │
      ├── writes order to Postgres (includes request_id column)
      │
      └── response  (X-Request-Id: abc) ──▶ Gateway ──▶ Client

---

## Services

| Service   | Port | Key Routes                                              | Dependencies              |
|-----------|------|---------------------------------------------------------|---------------------------|
| Gateway   | 3003 | `/`, `/api/checkout`, `/api/ping`, `/api/arch`, `/health` | Checkout                |
| Checkout  | 3002 | `/checkout`, `/health`                                  | Pricing, Inventory, Postgres |
| Pricing   | 3000 | `/price`, `/health`                                     | None                      |
| Inventory | 3001 | `/stock`, `/health`                                     | None                      |
| Postgres  | 5432 | TCP                                                     | PVC, Secret               |

---

## Features

- Request correlation via `X-Request-Id` across all four services
- KEDA scale-to-zero for Inventory (cron + kubernetes-workload triggers)
- Postgres persistence with PVC-backed storage and Secret-managed credentials
- Partial failure handling with 2s timeouts on all dependency calls
- Out-of-stock and invalid input edge case handling
- Live UI dashboard with health indicators, request log, and architecture diagram
- Traefik ingress routing
- Non-root containers (`USER node`)
- Readiness probes on all services

---

## Project Structure

    k8s-checkout-project/
    ├── gateway/
    │   ├── server.js          # UI, proxy, health proxy endpoints
    │   ├── Dockerfile
    │   └── package.json
    ├── checkout/
    │   ├── server.js          # Validation, orchestration, Postgres writes
    │   ├── Dockerfile
    │   └── package.json
    ├── pricing/
    │   ├── server.js          # Returns product price
    │   ├── Dockerfile
    │   └── package.json
    ├── inventory/
    │   ├── server.js          # Returns stock levels, out-of-stock logic
    │   ├── Dockerfile
    │   └── package.json
    └── k8s/
        ├── gateway.yaml       # Deployment + Service + Ingress
        ├── checkout.yaml      # Deployment + Service
        ├── pricing.yaml       # Deployment + Service
        ├── inventory.yaml     # Deployment + Service
        ├── postgres.yaml      # Deployment + Service + PVC + Secret
        └── keda-scaler.yaml   # ScaledObject (cron + workload triggers)

---

## Deploy from Scratch

### 1. Install KEDA

```bash
kubectl apply -f https://github.com/kedacore/keda/releases/download/v2.13.0/keda-2.13.0.yaml
```

### 2. Build Docker images

```bash
sudo docker build -t gateway:latest ./gateway
sudo docker build -t checkout:latest ./checkout
sudo docker build -t pricing:latest ./pricing
sudo docker build -t inventory:latest ./inventory
```

### 3. Import images into K3s

```bash
sudo docker save gateway:latest | sudo k3s ctr images import -
sudo docker save checkout:latest | sudo k3s ctr images import -
sudo docker save pricing:latest | sudo k3s ctr images import -
sudo docker save inventory:latest | sudo k3s ctr images import -
```

### 4. Deploy to K3s

```bash
kubectl apply -f k8s/postgres.yaml
kubectl apply -f k8s/pricing.yaml
kubectl apply -f k8s/inventory.yaml
kubectl apply -f k8s/checkout.yaml
kubectl apply -f k8s/gateway.yaml
kubectl apply -f k8s/keda-scaler.yaml
```

### 5. Verify

```bash
kubectl get pods,svc,ingress
kubectl get scaledobject
```

---

## Testing

### Happy path

```bash
curl -X POST http://<INGRESS-IP>/api/checkout \
  -H "Content-Type: application/json" \
  -H "X-Request-Id: test-001" \
  -d '{"productId":1,"quantity":2}'
```

Expected: `{"product":"item-123","price":100,"stock":50}`

### Out of stock (quantity > 10)

```bash
curl -X POST http://<INGRESS-IP>/api/checkout \
  -H "Content-Type: application/json" \
  -H "X-Request-Id: test-002" \
  -d '{"productId":1,"quantity":15}'
```

Expected: `{"error":"Out of stock","product":"item-123","price":100,"available":false}`

### Invalid input

```bash
curl -X POST http://<INGRESS-IP>/api/checkout \
  -H "Content-Type: application/json" \
  -H "X-Request-Id: test-003" \
  -d '{"productId":1,"quantity":-1}'
```

Expected: `{"error":"Invalid input","details":"quantity must be a positive number"}`

### Partial failure test

```bash
kubectl scale deployment/inventory --replicas=0
curl -X POST http://<INGRESS-IP>/api/checkout \
  -H "Content-Type: application/json" \
  -H "X-Request-Id: failure-test" \
  -d '{"productId":1,"quantity":2}'
kubectl scale deployment/inventory --replicas=1
```

### Verify Postgres persistence

```bash
kubectl exec -it deployment/postgres -- psql -U checkoutuser -d checkoutdb \
  -c "SELECT * FROM orders;"
```

### Check request correlation in logs

```bash
kubectl logs -l app=gateway
kubectl logs -l app=checkout
kubectl logs -l app=pricing
kubectl logs -l app=inventory
```

### KEDA scaler status

```bash
kubectl get scaledobject
```

---

## Troubleshooting Workflow

```bash
kubectl get pods
kubectl get svc
kubectl get ingress
kubectl get endpoints
kubectl describe pod -l app=gateway
kubectl get scaledobject
kubectl logs -l app=checkout
kubectl run toolbox --image=curlimages/curl --restart=Never --rm -it -- \
  curl http://checkout-svc:3002/health
```

---

## Security

- No plaintext passwords in manifests — Postgres credentials managed via Kubernetes Secret
- All containers run as non-root using `USER node`
- `imagePullPolicy: Never` — no external registry dependencies at runtime

---

## References

- Kubernetes Documentation: https://kubernetes.io/docs/
- KEDA Documentation: https://keda.sh/docs/2.13/
- K3s Documentation: https://docs.k3s.io/
- Traefik Documentation: https://doc.traefik.io/traefik/
- PostgreSQL Documentation: https://www.postgresql.org/docs/15/
- Node.js Express: https://expressjs.com/
- Axios HTTP Client: https://axios-http.com/docs/intro
