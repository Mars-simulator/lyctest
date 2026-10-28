# RabbitMQ 生产者-消费者 Demo（Kubernetes）

在本地 Docker Desktop Kubernetes 里，跑通一个基于 RabbitMQ 的 NestJS 生产者-消费者消息链路。

## 架构

```
宿主机 RabbitMQ (Docker: rabbitmq:3-management, 5672)
        ▲            ▲
        │ AMQP       │ AMQP
   publish            consume
        │            │
┌───────┴─────┐ ┌────┴────────┐
│  producer    │ │  consumer   │
│  K8s Pod     │ │  K8s Pod    │
│  3000 (HTTP) │ │  (纯微服务)  │
└─────────────┘ └─────────────┘
```

- **producer**：NestJS HTTP 服务 + `ClientRMQ`，`POST /emit` 时把消息发布到 RabbitMQ 的 `tasks` 队列。
- **consumer**：NestJS 微服务 + `ServerRMQ`，通过 `@EventPattern('task')` 从 `tasks` 队列消费并打印。
- 两者都作为 K8s Deployment 部署，通过 `host.docker.internal:5672` 访问宿主机上的 RabbitMQ。

## 目录结构

```
rabbitmq-demo/
├── producer/               # 生产者（HTTP 触发 + amqp emit）
│   ├── src/
│   │   ├── main.ts         # HTTP 服务入口，监听 3000
│   │   ├── app.module.ts   # ClientsModule.register 注册 RMQ 客户端
│   │   └── app.controller.ts # GET /health、POST /emit
│   ├── package.json
│   ├── tsconfig.json
│   └── Dockerfile
├── consumer/               # 消费者（纯微服务）
│   ├── src/
│   │   ├── main.ts         # createMicroservice + Transport.RMQ
│   │   ├── app.module.ts
│   │   └── app.controller.ts # @EventPattern('task') 消费
│   ├── package.json
│   ├── tsconfig.json
│   └── Dockerfile
└── k8s/
    ├── producer.yaml       # Deployment + NodePort Service
    └── consumer.yaml       # Deployment
```

## 前置条件

- Docker Desktop（已启用内置 Kubernetes，`kubectl` 可用）
- kubectl v1.36+

## 快速开始

### 1. 启动 RabbitMQ（宿主机 Docker）

```bash
docker run -d --name rabbitmq -p 5672:5672 -p 15672:15672 rabbitmq:3-management
```

- AMQP 端口：`5672`
- 管理界面：`http://localhost:15672`（默认 `guest / guest`）

### 2. 构建镜像

```bash
docker build -t rabbitmq-demo-producer:latest rabbitmq-demo/producer
docker build -t rabbitmq-demo-consumer:latest rabbitmq-demo/consumer

# 打新 tag（见下方「踩坑 3」：避免 same-tag 镜像缓存问题）
docker tag rabbitmq-demo-producer:latest rabbitmq-demo-producer:v2
docker tag rabbitmq-demo-consumer:latest rabbitmq-demo-consumer:v2
```

### 3. 部署到 Kubernetes

```bash
kubectl apply -f rabbitmq-demo/k8s/producer.yaml
kubectl apply -f rabbitmq-demo/k8s/consumer.yaml

kubectl get pods -w
```

### 4. 验证消息链路

通过端口转发触发 producer 发送一条消息：

```bash
kubectl port-forward svc/producer 3009:3000 &

curl -X POST http://localhost:3009/emit \
  -H "Content-Type: application/json" \
  -d '{"text":"hello k8s"}'
```

查看 consumer 日志，确认收到消息：

```bash
kubectl logs -l app=consumer --tail 20
```

预期看到：

```
Consumer is listening on RabbitMQ queue "tasks"
[consumer] received message: {"text":"hello k8s","at":"2026-10-28T07:09:06.918Z"}
```

## 实现要点

### 生产者（producer）

`ClientsModule.register` 注册 RMQ 客户端，通过 `ClientProxy.emit` 发布事件式消息（fire-and-forget）：

```ts
ClientsModule.register([
  {
    name: 'RABBITMQ_SERVICE',
    transport: Transport.RMQ,
    options: {
      urls: [process.env.RABBITMQ_URL ?? 'amqp://localhost:5672'],
      queue: 'tasks',
      queueOptions: { durable: true },
    },
  },
])
```

触发发送：

```ts
await lastValueFrom(this.client.emit('task', payload));
```

### 消费者（consumer）

独立微服务入口，用 `@EventPattern` 订阅队列：

```ts
const app = await NestFactory.createMicroservice<MicroserviceOptions>(AppModule, {
  transport: Transport.RMQ,
  options: {
    urls: [process.env.RABBITMQ_URL ?? 'amqp://localhost:5672'],
    queue: 'tasks',
    queueOptions: { durable: true },
    noAck: false, // 手动确认，处理成功才 ack
  },
});
```

```ts
@EventPattern('task')
handleTask(@Payload() data) {
  console.log(`[consumer] received message: ${JSON.stringify(data)}`);
}
```

## 踩坑记录

### 1. NestJS 12 RMQ transport 依赖拆分

`ClientRMQ`（客户端）和 `ServerRMQ`（服务端）**都依赖 `amqp-connection-manager`**（内部再使用 `amqplib`），不能只装 `amqplib`。

且该依赖是**懒加载**的——应用启动时不报错，第一次 `emit`/消费时才抛：

```
ERROR [PackageLoader] The "amqp-connection-manager" package is missing. Please, make sure to install it to use ClientRMQ.
```

**解决**：`producer` 和 `consumer` 的 `package.json` 都要同时包含：

```json
"amqp-connection-manager": "^4.1.0",
"amqplib": "^0.10.5"
```

### 2. Docker Desktop K8s 的 NodePort 在 Windows 不映射到 localhost

`producer` 虽然声明了 `type: NodePort` + `nodePort: 30080`，但 Windows 下 `localhost:30080` 并不会自动转发到 K8s 节点（`netstat` 看不到 30080 监听）。

**解决**：验证时改用 `kubectl port-forward svc/producer 3009:3000`。

（`host.docker.internal` 的 DNS 与 5672 端口连通本身是正常的，Pod 内可解析到 `192.168.65.254` 并 TCP 连通。）

### 3. 重新构建同 tag 镜像后 K8s 不拉取

`imagePullPolicy: IfNotPresent` 时，K8s 节点（containerd）会缓存镜像。重新构建 `:latest` 后，`rollout restart` 仍用旧镜像。

**解决**：每次改动后给镜像打新 tag（如 `v2`），并更新 Deployment 的 `image` 字段。

### 4. PowerShell 里多层引号转义

`kubectl exec -- node -e '...'` 在 PowerShell 下，脚本里的双引号会被逐层吞掉导致语法错误。

**解决**：需要传脚本给 Pod 内进程时，用 stdin 管道规避命令行转义：

```powershell
"console.log(1)" | kubectl exec -i deploy/producer -- node
```

## 清理

```bash
kubectl delete -f rabbitmq-demo/k8s/producer.yaml
kubectl delete -f rabbitmq-demo/k8s/consumer.yaml
docker rm -f rabbitmq
```
