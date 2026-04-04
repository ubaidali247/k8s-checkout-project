cd /mnt/c/Users/ubaid/k8s-checkout-project/k8s
python3 -c "
import os

pricing = '''apiVersion: apps/v1
kind: Deployment
metadata:
  name: pricing
spec:
  replicas: 1
  selector:
    matchLabels:
      app: pricing
  template:
    metadata:
      labels:
        app: pricing
    spec:
      containers:
      - name: pricing
        image: docker.io/library/pricing:latest
        imagePullPolicy: Never
        ports:
        - containerPort: 3000
        readinessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
---
apiVersion: v1
kind: Service
metadata:
  name: pricing-svc
spec:
  selector:
    app: pricing
  ports:
  - port: 3000
    targetPort: 3000
'''
open('pricing.yaml','w').write(pricing)
print('pricing.yaml done')
"