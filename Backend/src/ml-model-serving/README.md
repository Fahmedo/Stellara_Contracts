# ML Model Serving Platform

A comprehensive machine learning model serving infrastructure for the Stellara Network, supporting A/B testing, canary deployments, automatic scaling, and real-time monitoring.

## Features

### 🚀 Model Registry & Versioning
- **Model Metadata Management**: Store accuracy, training date, features, hyperparameters
- **Version Control**: Support multiple model versions simultaneously
- **Format Support**: TensorFlow, PyTorch, ONNX models
- **Storage Integration**: IPFS-based model storage with fallback to cloud storage

### 🎯 Deployment Management
- **Canary Deployments**: Gradual rollout with configurable traffic splitting (90% v1, 10% v2)
- **Blue-Green Deployments**: Zero-downtime deployments
- **Auto-scaling**: CPU/memory-based scaling with configurable thresholds
- **Kubernetes Integration**: Native K8s deployment with health checks

### 📊 Performance Monitoring
- **Latency Tracking**: Real-time p50, p95, p99 latency metrics
- **Throughput Monitoring**: Requests per second/minute/hour
- **Error Rate Tracking**: Real-time error percentage and alerting
- **Resource Usage**: CPU, memory, GPU utilization monitoring

### 🔍 Drift Detection
- **Data Drift**: Statistical detection of input distribution changes
- **Performance Drift**: Automatic detection of accuracy/latency degradation
- **Concept Drift**: Prediction distribution analysis
- **Automated Alerts**: Configurable thresholds with notification system

### ⚡ Inference Service
- **Multi-format Support**: TensorFlow, PyTorch, ONNX runtime
- **Batch Processing**: Efficient batch inference capabilities
- **Request Routing**: Intelligent traffic routing based on deployment type
- **Model Caching**: In-memory model loading for optimal performance

### 🔄 Rollback Capability
- **60-second Rollback**: Quick rollback to previous stable version
- **Automated Triggers**: Rollback based on performance thresholds
- **Manual Control**: API-driven rollback operations
- **Audit Trail**: Complete rollback history and reasoning

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Model API    │    │   Deployment    │    │   Monitoring    │
│   Registry     │◄──►│   Manager      │◄──►│   Service       │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Storage      │    │   Kubernetes   │    │   Drift        │
│   Service      │    │   Cluster      │    │   Detection     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 ▼
                    ┌─────────────────┐
                    │   Inference    │
                    │   Service      │
                    └─────────────────┘
```

## API Endpoints

### Model Registry
- `POST /ml-models` - Register new model
- `GET /ml-models` - List all models
- `GET /ml-models/:id` - Get model details
- `GET /ml-models/versions/:name` - Get model versions
- `POST /ml-models/:id/promote` - Promote to production

### Deployment Management
- `POST /ml-deployments` - Create deployment
- `POST /ml-deployments/:id/deploy` - Deploy model
- `POST /ml-deployments/:id/canary` - Create canary deployment
- `POST /ml-deployments/:id/rollback` - Rollback deployment
- `POST /ml-deployments/:id/scale` - Scale deployment

### Inference
- `POST /ml-inference/predict` - Single prediction
- `POST /ml-inference/predict-batch` - Batch predictions
- `GET /ml-inference/model-info/:modelName` - Get model info

### Monitoring
- `GET /ml-monitoring/metrics/:modelId` - Get model metrics
- `GET /ml-monitoring/dashboard/:modelId` - Dashboard data
- `POST /ml-monitoring/metrics/:modelId/:deploymentId` - Record metrics

### Drift Detection
- `POST /ml-drift-detection/detect/:modelId/:deploymentId` - Trigger drift detection
- `GET /ml-drift-detection/history/:modelId` - Get drift history
- `PATCH /ml-drift-detection/resolve/:driftId` - Resolve drift alert

## Configuration

### Environment Variables
```bash
# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# Kubernetes Configuration
K8S_NAMESPACE=ml-models
K8S_CONFIG_PATH=/path/to/kubeconfig

# Model Storage
STORAGE_TYPE=ipfs
IPFS_HOST=localhost
IPFS_PORT=5001

# Monitoring
METRICS_ENABLED=true
DRIFT_DETECTION_INTERVAL=3600000
ALERT_WEBHOOK_URL=https://hooks.slack.com/...
```

### Model Registration
```typescript
const modelRequest = {
  name: "fraud-detection",
  version: "1.0.0",
  format: "tensorflow",
  metadata: {
    accuracy: 0.95,
    trainingDate: "2024-01-15",
    features: ["amount", "merchant", "location", "time"],
    hyperparameters: {
      learningRate: 0.001,
      epochs: 100
    }
  },
  inputSchema: {
    type: "object",
    required: ["amount", "merchant"],
    properties: {
      amount: { type: "number" },
      merchant: { type: "string" }
    }
  },
  outputSchema: {
    type: "object",
    properties: {
      fraudScore: { type: "number" },
      riskLevel: { type: "string" }
    }
  }
};
```

### Deployment Configuration
```typescript
const deploymentRequest = {
  modelId: "model-uuid",
  name: "fraud-detection-prod",
  type: "production",
  config: {
    replicas: 3,
    minReplicas: 1,
    maxReplicas: 10,
    cpuRequest: "500m",
    cpuLimit: "2000m",
    memoryRequest: "512Mi",
    memoryLimit: "2Gi",
    autoScaling: {
      enabled: true,
      targetCPUUtilization: 70,
      targetMemoryUtilization: 80,
      scaleUpCooldown: 300,
      scaleDownCooldown: 600
    },
    traffic: {
      percentage: 100
    },
    environment: {
      LOG_LEVEL: "info",
      MODEL_TIMEOUT: "5000"
    }
  },
  rollbackConfig: {
    enabled: true,
    timeout: 60,
    rollbackThresholds: {
      errorRate: 5.0,
      latencyP95: 5000,
      latencyP99: 10000
    }
  }
};
```

## Usage Examples

### Register a New Model
```bash
curl -X POST http://localhost:3000/ml-models \
  -H "Content-Type: multipart/form-data" \
  -F "name=fraud-detection" \
  -F "version=1.0.0" \
  -F "format=tensorflow" \
  -F "metadata={...}" \
  -F "modelFile=@model.pb"
```

### Create Canary Deployment
```bash
curl -X POST http://localhost:3000/ml-deployments \
  -H "Content-Type: application/json" \
  -d '{
    "modelId": "model-uuid",
    "name": "fraud-detection-canary",
    "type": "canary",
    "config": {
      "replicas": 1,
      "traffic": { "percentage": 10 }
    }
  }'
```

### Make Prediction
```bash
curl -X POST http://localhost:3000/ml-inference/predict \
  -H "Content-Type: application/json" \
  -d '{
    "modelName": "fraud-detection",
    "input": {
      "amount": 150.00,
      "merchant": "online-store",
      "location": "US"
    }
  }'
```

## Monitoring & Alerting

### Metrics Collection
- **Real-time Metrics**: Latency, throughput, error rates
- **Resource Metrics**: CPU, memory, GPU utilization
- **Business Metrics**: Model accuracy, prediction distribution
- **Custom Metrics**: Model-specific performance indicators

### Alert Configuration
```typescript
const alertConfig = {
  latency: {
    p95: { threshold: 5000, severity: "high" },
    p99: { threshold: 10000, severity: "critical" }
  },
  errorRate: {
    threshold: 5.0, // 5%
    severity: "critical"
  },
  drift: {
    dataDrift: { threshold: 0.3, severity: "medium" },
    performanceDrift: { threshold: 0.2, severity: "high" }
  }
};
```

### Dashboard Integration
- **Grafana**: Pre-built dashboards for ML metrics
- **Prometheus**: Metrics collection and alerting
- **Kibana**: Log aggregation and analysis
- **Custom UI**: Built-in monitoring dashboard

## Security & Compliance

### Model Security
- **Access Control**: Role-based model access
- **Data Encryption**: Encrypted model storage
- **Audit Logging**: Complete model lifecycle audit trail
- **Version Control**: Immutable model versions

### Compliance Features
- **GDPR Compliance**: Data privacy controls
- **Model Explainability**: Feature importance tracking
- **Bias Detection**: Fairness metrics monitoring
- **Data Governance**: Data lineage tracking

## Performance Optimization

### Model Loading
- **Lazy Loading**: Load models on first request
- **Memory Caching**: In-memory model storage
- **Pre-warming**: Preload production models
- **Resource Pooling**: GPU resource management

### Request Optimization
- **Batch Processing**: Efficient batch inference
- **Connection Pooling**: Database connection reuse
- **Caching**: Response caching for identical requests
- **Compression**: Request/response compression

## Troubleshooting

### Common Issues
1. **Model Loading Errors**: Check model format and storage path
2. **High Latency**: Monitor resource usage and scaling
3. **Drift Alerts**: Review data quality and model retraining
4. **Deployment Failures**: Check Kubernetes cluster status

### Debug Commands
```bash
# Check model status
curl http://localhost:3000/ml-models/{modelId}

# Check deployment health
curl http://localhost:3000/ml-deployments/{deploymentId}/metrics

# Check drift detection status
curl http://localhost:3000/ml-drift-detection/history/{modelId}
```

## Development

### Local Development Setup
```bash
# Install dependencies
npm install

# Start development server
npm run start:dev

# Run tests
npm test

# Build for production
npm run build
```

### Testing
```bash
# Unit tests
npm run test

# Integration tests
npm run test:e2e

# Performance tests
npm run perf:test
```

## Roadmap

### Upcoming Features
- **Multi-cloud Support**: AWS, GCP, Azure deployment
- **Model Registry UI**: Web-based model management
- **Advanced Drift Detection**: Deep learning-based drift detection
- **Auto-retraining**: Automated model retraining pipeline
- **Federated Learning**: Privacy-preserving model updates

### Performance Improvements
- **GPU Acceleration**: CUDA support for inference
- **Model Optimization**: ONNX model optimization
- **Edge Deployment**: Model deployment to edge devices
- **Real-time Streaming**: Streaming inference support

## Support

For support and questions:
- **Documentation**: [ML Platform Docs](./docs/ml-platform)
- **Issues**: [GitHub Issues](https://github.com/stellara-network/issues)
- **Community**: [Discord Server](https://discord.gg/stellara)
- **Email**: ml-support@stellara.network

## License

This ML Model Serving Platform is licensed under the MIT License. See [LICENSE](./LICENSE) for details.
