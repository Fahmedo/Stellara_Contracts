import { Injectable, Logger } from '@nestjs/common';
import { KubeConfig, AppsV1Api, CoreV1Api, NetworkingV1Api } from '@kubernetes/client-node';
import { ModelDeployment } from './model-deployment.entity';
import { MLModel, ModelFormat } from '../model-registry/entities/ml-model.entity';

@Injectable()
export class KubernetesService {
  private readonly logger = new Logger(KubernetesService.name);
  private readonly kubeConfig: KubeConfig;
  private readonly appsV1Api: AppsV1Api;
  private readonly coreV1Api: CoreV1Api;
  private readonly networkingV1Api: NetworkingV1Api;

  constructor() {
    this.kubeConfig = new KubeConfig();
    this.kubeConfig.loadFromDefault();
    
    this.appsV1Api = this.kubeConfig.makeApiClient(AppsV1Api);
    this.coreV1Api = this.kubeConfig.makeApiClient(CoreV1Api);
    this.networkingV1Api = this.kubeConfig.makeApiClient(NetworkingV1Api);
  }

  async createDeployment(deployment: ModelDeployment): Promise<any> {
    const namespace = 'ml-models';
    const deploymentName = deployment.name.toLowerCase().replace(/[^a-z0-9-]/g, '-');

    const deploymentManifest = {
      metadata: {
        name: deploymentName,
        namespace,
        labels: {
          app: deploymentName,
          model: deployment.model.name,
          version: deployment.model.version,
          type: deployment.type,
        },
      },
      spec: {
        replicas: deployment.config.replicas,
        selector: {
          matchLabels: {
            app: deploymentName,
          },
        },
        template: {
          metadata: {
            labels: {
              app: deploymentName,
              model: deployment.model.name,
              version: deployment.model.version,
              type: deployment.type,
            },
          },
          spec: {
            containers: [{
              name: 'model-server',
              image: this.getModelImage(deployment.model),
              ports: [{ containerPort: 8080 }],
              resources: {
                requests: {
                  cpu: deployment.config.cpuRequest,
                  memory: deployment.config.memoryRequest,
                },
                limits: {
                  cpu: deployment.config.cpuLimit,
                  memory: deployment.config.memoryLimit,
                },
              },
              env: [
                { name: 'MODEL_PATH', value: deployment.model.modelPath },
                { name: 'MODEL_FORMAT', value: deployment.model.format },
                { name: 'MODEL_NAME', value: deployment.model.name },
                { name: 'MODEL_VERSION', value: deployment.model.version },
                ...Object.entries(deployment.config.environment).map(([key, value]) => ({
                  name: key,
                  value,
                })),
              ],
              readinessProbe: {
                httpGet: {
                  path: '/health',
                  port: 8080,
                },
                initialDelaySeconds: 30,
                periodSeconds: 10,
              },
              livenessProbe: {
                httpGet: {
                  path: '/health',
                  port: 8080,
                },
                initialDelaySeconds: 60,
                periodSeconds: 30,
              },
            }],
          },
        },
      },
    };

    if (deployment.config.gpuRequest) {
      deploymentManifest.spec.template.spec.containers[0].resources.requests['nvidia.com/gpu'] = deployment.config.gpuRequest;
      deploymentManifest.spec.template.spec.containers[0].resources.limits['nvidia.com/gpu'] = deployment.config.gpuLimit;
    }

    try {
      const result = await this.appsV1Api.createNamespacedDeployment(namespace, deploymentManifest);
      this.logger.log(`Created deployment ${deploymentName} in namespace ${namespace}`);
      return { ...result.body, namespace, name: deploymentName };
    } catch (error) {
      this.logger.error(`Failed to create deployment ${deploymentName}:`, error);
      throw error;
    }
  }

  async createService(deployment: ModelDeployment): Promise<any> {
    const namespace = 'ml-models';
    const serviceName = deployment.name.toLowerCase().replace(/[^a-z0-9-]/g, '-');

    const serviceManifest = {
      metadata: {
        name: serviceName,
        namespace,
        labels: {
          app: serviceName,
          model: deployment.model.name,
          version: deployment.model.version,
          type: deployment.type,
        },
      },
      spec: {
        selector: {
          app: serviceName,
        },
        ports: [{
          port: 80,
          targetPort: 8080,
          protocol: 'TCP',
        }],
        type: 'ClusterIP',
      },
    };

    try {
      const result = await this.coreV1Api.createNamespacedService(namespace, serviceManifest);
      this.logger.log(`Created service ${serviceName} in namespace ${namespace}`);
      return { ...result.body, name: serviceName };
    } catch (error) {
      this.logger.error(`Failed to create service ${serviceName}:`, error);
      throw error;
    }
  }

  async createIngress(deployment: ModelDeployment): Promise<any> {
    const namespace = 'ml-models';
    const ingressName = deployment.name.toLowerCase().replace(/[^a-z0-9-]/g, '-');
    const serviceName = deployment.name.toLowerCase().replace(/[^a-z0-9-]/g, '-');
    const host = `${deployment.model.name}-${deployment.model.version}.ml.stellara.network`;

    const ingressManifest = {
      metadata: {
        name: ingressName,
        namespace,
        labels: {
          app: ingressName,
          model: deployment.model.name,
          version: deployment.model.version,
          type: deployment.type,
        },
        annotations: {
          'kubernetes.io/ingress.class': 'nginx',
          'nginx.ingress.kubernetes.io/rewrite-target': '/',
          'nginx.ingress.kubernetes.io/ssl-redirect': 'true',
          'nginx.ingress.kubernetes.io/rate-limit': '100',
          'nginx.ingress.kubernetes.io/rate-limit-window': '1m',
        },
      },
      spec: {
        rules: [{
          host,
          http: {
            paths: [{
              path: '/',
              pathType: 'Prefix',
              backend: {
                service: {
                  name: serviceName,
                  port: {
                    number: 80,
                  },
                },
              },
            }],
          },
        }],
        tls: [{
          hosts: [host],
          secretName: `${ingressName}-tls`,
        }],
      },
    };

    try {
      const result = await this.networkingV1Api.createNamespacedIngress(namespace, ingressManifest);
      this.logger.log(`Created ingress ${ingressName} for host ${host}`);
      return { ...result.body, name: ingressName, host };
    } catch (error) {
      this.logger.error(`Failed to create ingress ${ingressName}:`, error);
      throw error;
    }
  }

  async deleteDeployment(deployment: ModelDeployment): Promise<void> {
    const namespace = deployment.deploymentMetadata?.kubernetesNamespace || 'ml-models';
    const deploymentName = deployment.deploymentMetadata?.deploymentName || 
      deployment.name.toLowerCase().replace(/[^a-z0-9-]/g, '-');

    try {
      await this.appsV1Api.deleteNamespacedDeployment(deploymentName, namespace);
      this.logger.log(`Deleted deployment ${deploymentName} from namespace ${namespace}`);
    } catch (error) {
      this.logger.error(`Failed to delete deployment ${deploymentName}:`, error);
      throw error;
    }
  }

  async deleteService(deployment: ModelDeployment): Promise<void> {
    const namespace = deployment.deploymentMetadata?.kubernetesNamespace || 'ml-models';
    const serviceName = deployment.deploymentMetadata?.serviceName || 
      deployment.name.toLowerCase().replace(/[^a-z0-9-]/g, '-');

    try {
      await this.coreV1Api.deleteNamespacedService(serviceName, namespace);
      this.logger.log(`Deleted service ${serviceName} from namespace ${namespace}`);
    } catch (error) {
      this.logger.error(`Failed to delete service ${serviceName}:`, error);
      throw error;
    }
  }

  async deleteIngress(deployment: ModelDeployment): Promise<void> {
    const namespace = deployment.deploymentMetadata?.kubernetesNamespace || 'ml-models';
    const ingressName = deployment.deploymentMetadata?.ingressName || 
      deployment.name.toLowerCase().replace(/[^a-z0-9-]/g, '-');

    try {
      await this.networkingV1Api.deleteNamespacedIngress(ingressName, namespace);
      this.logger.log(`Deleted ingress ${ingressName} from namespace ${namespace}`);
    } catch (error) {
      this.logger.error(`Failed to delete ingress ${ingressName}:`, error);
      throw error;
    }
  }

  async scaleDeployment(deploymentId: string, replicas: number): Promise<void> {
    const deployment = await this.findDeploymentById(deploymentId);
    const namespace = deployment.deploymentMetadata?.kubernetesNamespace || 'ml-models';
    const deploymentName = deployment.deploymentMetadata?.deploymentName || 
      deployment.name.toLowerCase().replace(/[^a-z0-9-]/g, '-');

    const scaleManifest = {
      metadata: {
        name: deploymentName,
        namespace,
      },
      spec: {
        replicas,
      },
    };

    try {
      await this.appsV1Api.replaceNamespacedDeploymentScale(deploymentName, namespace, scaleManifest);
      this.logger.log(`Scaled deployment ${deploymentName} to ${replicas} replicas`);
    } catch (error) {
      this.logger.error(`Failed to scale deployment ${deploymentName}:`, error);
      throw error;
    }
  }

  async getDeploymentMetrics(deployment: ModelDeployment): Promise<any> {
    const namespace = deployment.deploymentMetadata?.kubernetesNamespace || 'ml-models';
    const deploymentName = deployment.deploymentMetadata?.deploymentName || 
      deployment.name.toLowerCase().replace(/[^a-z0-9-]/g, '-');

    try {
      const deploymentResponse = await this.appsV1Api.readNamespacedDeployment(deploymentName, namespace);
      const podsResponse = await this.coreV1Api.listNamespacedPod(namespace, {
        labelSelector: `app=${deploymentName}`,
      });

      const deployment = deploymentResponse.body;
      const pods = podsResponse.body.items;

      return {
        replicas: deployment.spec.replicas,
        readyReplicas: deployment.status.readyReplicas || 0,
        availableReplicas: deployment.status.availableReplicas || 0,
        unavailableReplicas: deployment.status.unavailableReplicas || 0,
        pods: pods.map(pod => ({
          name: pod.metadata.name,
          phase: pod.status.phase,
          ready: pod.status.conditions?.find(c => c.type === 'Ready')?.status === 'True',
          restartCount: pod.status.containerStatuses?.[0]?.restartCount || 0,
          cpu: pod.status.containerStatuses?.[0]?.resources?.requests?.cpu,
          memory: pod.status.containerStatuses?.[0]?.resources?.requests?.memory,
        })),
      };
    } catch (error) {
      this.logger.error(`Failed to get metrics for deployment ${deploymentName}:`, error);
      throw error;
    }
  }

  private getModelImage(model: MLModel): string {
    const baseImage = 'stellara/model-server:latest';
    
    switch (model.format) {
      case ModelFormat.TENSORFLOW:
        return 'stellara/tensorflow-server:latest';
      case ModelFormat.PYTORCH:
        return 'stellara/pytorch-server:latest';
      case ModelFormat.ONNX:
        return 'stellara/onnx-server:latest';
      default:
        return baseImage;
    }
  }

  private async findDeploymentById(deploymentId: string): Promise<ModelDeployment> {
    return null;
  }
}
