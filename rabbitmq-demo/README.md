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

- **producer**：NestJS HTTP 服务 + `ClientRMQ`，`POST /emit` 时把消息发布到 RabbitMQ 的 `tasks` 队列（每条消息带 `messageId` 幂等键）。
- **consumer**：NestJS 微服务 + `ServerRMQ`，通过 `@EventPattern('task')` 从 `tasks` 队列消费；**成功返回自动 ack、异常自动 nack 重试**，并用 `messageId` 做幂等去重。
- 两者都作为 K8s Deployment 部署，通过 `host.docker.internal:5672` 访问宿主机上的 RabbitMQ。

## 目录结构

```
rabbitmq-demo/
├── producer/               # 生产者（HTTP 触发 + amqp emit）
│   ├── src/
│   │   ├── main.ts         # HTTP 服务入口，监听 3000
│   │   ├── app.module.ts   # ClientsModule.register 注册 RMQ 客户端
│   │   └── app.controller.ts # GET /health、POST /emit（生成/接受 messageId）
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

# 打新 tag（见下方「踩坑 3」：避免 same-tag 镜像缓存问题；此处 v4 与 k8s 清单保持一致）
docker tag rabbitmq-demo-producer:latest rabbitmq-demo-producer:v4
docker tag rabbitmq-demo-consumer:latest rabbitmq-demo-consumer:v4
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
[consumer] received message: {"messageId":"...","text":"hello k8s","at":"2026-10-28T07:09:06.918Z"}
[consumer] 处理成功: ...
```

### 5. 验证幂等（相同 messageId 只处理一次）

连发两条相同 `messageId` 的消息（第二个请求把 `text` 改掉，但仍用同一 `messageId`）：

```bash
curl -X POST http://localhost:3009/emit -H "Content-Type: application/json" \
  -d '{"messageId":"idem-001","text":"first"}'
curl -X POST http://localhost:3009/emit -H "Content-Type: application/json" \
  -d '{"messageId":"idem-001","text":"second"}'

kubectl logs -l app=consumer --tail 20
```

预期：第一条正常处理，第二条被去重跳过：

```
[consumer] 处理成功: idem-001
[consumer] 重复消息，跳过: idem-001
```

### 6. 验证失败重试（nack）

发送 `text` 为 `fail` 的消息，consumer 处理时抛异常，NestJS 自动 nack 并重新入队：

```bash
curl -X POST http://localhost:3009/emit -H "Content-Type: application/json" \
  -d '{"text":"fail"}'
kubectl logs -l app=consumer --tail 20
```

预期持续看到：

```
[consumer] 处理失败，消息将重新入队: ...
Error: 模拟业务处理失败
```

> 注意：nack 默认 `requeue=true`，未限制重试次数时会无限重试并刷屏。生产应配合死信队列 + 有限重试。

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

独立微服务入口，用 `@EventPattern` 订阅队列，`noAck: false` 开启手动确认模式：

```ts
const app = await NestFactory.createMicroservice<MicroserviceOptions>(AppModule, {
  transport: Transport.RMQ,
  options: {
    urls: [process.env.RABBITMQ_URL ?? 'amqp://localhost:5672'],
    queue: 'tasks',
    queueOptions: { durable: true },
    noAck: false, // 手动确认模式：由 NestJS 依据 handler 结果决定 ack / nack
  },
});
```

#### 消费确认（ack / nack）

`noAck: false` 下，NestJS 会依据 handler 的执行结果自动确认，**无需手动 `channel.ack`**（手动 ack 与自动 ack 叠加会触发 `PRECONDITION_FAILED`）：

- handler **正常返回** → 自动 `ack`，消息从队列移除（消费确认）
- handler **抛异常** → 自动 `nack` 并重新入队（`requeue=true`），消息可被重试

```ts
@EventPattern('task')
async handleTask(@Payload() data: TaskMessage) {
  const { messageId } = data;

  // 幂等：已处理过则直接返回（正常返回即 ack，丢弃重复消息）
  if (this.processedIds.has(messageId)) {
    this.logger.warn(`[consumer] 重复消息，跳过: ${messageId}`);
    return;
  }

  try {
    await this.process(data);
    // 处理成功后才登记，即使随后 ack 丢失导致重投递也能被上面的去重拦下
    this.processedIds.add(messageId);
    this.logger.log(`[consumer] 处理成功: ${messageId}`);
    // 正常返回 = 自动 ack
  } catch (err) {
    this.logger.error(`[consumer] 处理失败，消息将重新入队: ${messageId}`, (err as Error).stack);
    throw err; // 抛异常 = 自动 nack + requeue
  }
}
```

#### 幂等处理（messageId 去重）

- producer 每条消息生成唯一 `messageId`（`randomUUID()`），也支持调用方指定，便于压测/验证。
- consumer 维护 `processedIds: Set<string>`，处理成功后登记；重复投递（ack 丢失、网络重试等）到达时直接跳过。
- 顺序很关键：**先处理成功 → 再登记 → 最后返回触发 ack**，保证「已处理」与「已确认」之间的重投递也能被识别。

```ts
private readonly processedIds = new Set<string>();
```

> 演示用内存 `Set`，仅单副本有效、重启即失。生产应改用 Redis `SETNX`（带 TTL）或数据库唯一约束，跨副本共享且可持久化。

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

### 5. 用裸 amqplib 直接发消息会被 NestJS 丢弃

NestJS 的 RMQ 传输层会在消息属性里携带 `pattern` 元数据，用于把消息路由到对应的 handler。若绕过 `ClientProxy`、用原生 `amqplib` 的 `channel.sendToQueue` 直接发消息，consumer 拿不到 pattern，会打印：

```
WARN [Server] An unsupported event was received. It has been negatively acknowledged, so it will not be re-delivered. Pattern: undefined
```

并直接 nack 丢弃。**验证消息必须走 `ClientProxy`（如本 demo 的 `POST /emit`）**，或在裸发时手动伪造 pattern 属性。

## 清理

```bash
kubectl delete -f rabbitmq-demo/k8s/producer.yaml
kubectl delete -f rabbitmq-demo/k8s/consumer.yaml
docker rm -f rabbitmq
```
