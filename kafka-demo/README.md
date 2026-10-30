# Kafka 生产者-消费者 Demo

基于 NestJS + `@nestjs/microservices`（Kafka Transport）的生产者-消费者示例，本地 Docker 起单节点 Kafka（KRaft 模式），支持 Docker / Kubernetes 两种部署方式。

## 架构

```
本地 Kafka (Docker, KRaft 单节点, 9092)
        ▲            ▲
        │ produce    │ consume
        │            │
┌───────┴─────┐ ┌────┴────────┐
│  producer    │ │  consumer   │
│  HTTP 3000   │ │  (纯微服务)  │
│  ClientKafka │ │  Kafka 服务端 │
└─────────────┘ └─────────────┘
```

- **producer**：NestJS HTTP 服务 + `ClientKafka`，`POST /emit` 时把消息发布到 Kafka topic `task`（每条带 `messageId` 幂等键）。
- **consumer**：NestJS 微服务 + `Transport.KAFKA`，通过 `@EventPattern('task')` 消费 `task` topic，并用 `messageId` 做幂等去重。
- 客户端与 Brokers 通过 `advertised.listeners = host.docker.internal:9092` 保持一致，容器/Pod 均可访问。

## 目录结构

```
kafka-demo/
├── producer/               # 生产者（HTTP 触发 + Kafka 发送）
│   ├── src/
│   │   ├── main.ts         # HTTP 入口，监听 3000
│   │   ├── app.module.ts   # ClientsModule.register(Transport.KAFKA)
│   │   └── app.controller.ts # GET /health、POST /emit（生成/接受 messageId）
│   ├── package.json
│   ├── tsconfig.json
│   └── Dockerfile
├── consumer/               # 消费者（纯微服务）
│   ├── src/
│   │   ├── main.ts         # createMicroservice + Transport.KAFKA
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

- Docker Desktop（K8s 方式需启用内置 Kubernetes）
- 已安装 `kubectl`（K8s 方式）

## 快速开始

### 1. 启动 Kafka（Docker, KRaft 单节点）

```bash
docker run -d --name kafka -p 9092:9092 \
  -e KAFKA_NODE_ID=1 \
  -e KAFKA_PROCESS_ROLES=broker,controller \
  -e KAFKA_LISTENERS=PLAINTEXT://:9092,CONTROLLER://:9093 \
  -e KAFKA_ADVERTISED_LISTENERS=PLAINTEXT://host.docker.internal:9092 \
  -e KAFKA_CONTROLLER_LISTENER_NAMES=CONTROLLER \
  -e KAFKA_LISTENER_SECURITY_PROTOCOL_MAP=CONTROLLER:PLAINTEXT,PLAINTEXT:PLAINTEXT \
  -e KAFKA_CONTROLLER_QUORUM_VOTERS=1@localhost:9093 \
  -e KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR=1 \
  -e KAFKA_AUTO_CREATE_TOPICS_ENABLE=true \
  apache/kafka:3.7.0
```

关键点：`KAFKA_ADVERTISED_LISTENERS` 必须是客户端能访问的地址（此处 `host.docker.internal:9092`），否则客户端连上后会拿到错误的 broker 地址而失败。

### 2. 确保 topic 存在（重要）

消费者订阅不存在的 topic 会直接崩溃（`UNKNOWN_TOPIC_OR_PARTITION`）。建议手动创建：

```bash
docker exec kafka /opt/kafka/bin/kafka-topics.sh --bootstrap-server localhost:9092 \
  --create --topic task --partitions 1 --replication-factor 1
```

确认：

```bash
docker exec kafka /opt/kafka/bin/kafka-topics.sh --bootstrap-server localhost:9092 --describe --topic task
```

### 3. 构建镜像

```bash
docker build -t kafka-demo-producer:latest kafka-demo/producer
docker build -t kafka-demo-consumer:latest kafka-demo/consumer

# K8s 方式建议打新 tag（避免 same-tag 镜像缓存问题）
docker tag kafka-demo-producer:latest kafka-demo-producer:v1
docker tag kafka-demo-consumer:latest kafka-demo-consumer:v1
```

### 4a. Docker 快速验证（不依赖 K8s）

```bash
docker run -d --name kafka-producer-test -p 3010:3000 \
  -e KAFKA_BROKERS=host.docker.internal:9092 kafka-demo-producer:latest

docker run -d --name kafka-consumer-test \
  -e KAFKA_BROKERS=host.docker.internal:9092 \
  -e KAFKA_GROUP_ID=task-consumer kafka-demo-consumer:latest
```

### 4b. Kubernetes 部署

```bash
kubectl apply -f kafka-demo/k8s/producer.yaml
kubectl apply -f kafka-demo/k8s/consumer.yaml
kubectl get pods -w
```

## 验证方法与验证成功

### 验证步骤

```powershell
# 1. 确认 topic 与消费者已加入消费组
docker exec kafka /opt/kafka/bin/kafka-topics.sh --bootstrap-server localhost:9092 --describe --topic task
docker logs kafka-consumer-test | Select-String "Consumer has joined"

# 2. 发送一条消息（Docker 方式；K8s 方式用 kubectl port-forward svc/kafka-producer 3009:3000）
Invoke-RestMethod -Uri "http://localhost:3010/emit" -Method Post -ContentType "application/json" -Body '{"text":"hello kafka"}' | ConvertTo-Json -Compress

# 3. 查看消费者日志
docker logs kafka-consumer-test --tail 5
```

### 验证成功的证据（本机实际输出）

**producer 发送返回**：

```json
{"sent":{"messageId":"f6a9631a-d1a4-475e-a191-288f354fa712","text":"hello kafka","at":"2026-10-30T08:11:13.545Z"}}
```

**consumer 接收日志**：

```
Consumer is listening on Kafka topic "task"
[consumer] received message: {"messageId":"f6a9631a-d1a4-475e-a191-288f354fa712","text":"hello kafka","at":"2026-10-30T08:11:13.545Z"}
[consumer] 处理成功: f6a9631a-d1a4-475e-a191-288f354fa712
```

`messageId` 与 `at` 时间戳两端**完全一致**，即证明消息经 Kafka 端到端流转成功。

### 唯一标识端到端证明（更硬）

```powershell
$id = "kafka-proof-" + (Get-Date -Format "yyyyMMdd-HHmmss-fff")
Invoke-RestMethod -Uri "http://localhost:3010/emit" -Method Post -ContentType "application/json" -Body (@{text=$id} | ConvertTo-Json)
docker logs kafka-consumer-test | Select-String $id
```

能 grep 到该唯一 ID，即确定性证明这条特定消息被完整消费。

### 判定成功标准

1. `POST /emit` 返回带 `messageId` 的 `sent`
2. consumer 日志出现相同 `messageId` + 相同 `at` 的 `received message`
3. 出现 `处理成功: <messageId>`

## 实现要点

### 生产者（producer）

```ts
ClientsModule.register([
  {
    name: 'KAFKA_SERVICE',
    transport: Transport.KAFKA,
    options: {
      client: {
        clientId: 'producer',
        brokers: [process.env.KAFKA_BROKERS ?? 'localhost:9092'],
      },
      producer: { allowAutoTopicCreation: true },
    },
  },
])
```

- `ClientKafka` 需**显式 connect**（`onModuleInit` 中 `await this.client.connect()`），否则发不出消息。
- `emit(topic, payload)` 的第一个参数是 topic 名。

### 消费者（consumer）

```ts
const app = await NestFactory.createMicroservice<MicroserviceOptions>(AppModule, {
  transport: Transport.KAFKA,
  options: {
    client: {
      clientId: 'consumer',
      brokers: [process.env.KAFKA_BROKERS ?? 'localhost:9092'],
    },
    consumer: {
      groupId: process.env.KAFKA_GROUP_ID ?? 'task-consumer',
    },
  },
});
```

```ts
@EventPattern('task')
async handleTask(@Payload() data: TaskMessage) { ... }
```

### 幂等处理（messageId 去重）

- producer 每条消息生成唯一 `messageId`（`randomUUID()`），也可由调用方指定。
- consumer 维护 `processedIds: Set<string>`，处理成功后登记；Kafka 至少一次投递可能重放，重复消息直接跳过。

> 演示用内存 `Set`，仅单副本有效、重启即失。生产应改用 Redis `SETNX`（带 TTL）或数据库唯一约束。

## 踩坑记录

### 1. topic 不存在导致 consumer 崩溃

consumer 订阅不存在的 topic 时报 `UNKNOWN_TOPIC_OR_PARTITION` / `This server does not host this topic-partition`，Node 进程直接退出。

**解决**：先确保 topic 存在（`allowAutoTopicCreation` 或手动 `kafka-topics.sh --create`），再启动 consumer。

### 2. consumer 订阅前发出的消息会漏收

Kafka 消费者默认 `fromBeginning: false`，只消费订阅之后的消息。若先发消息、后启动 consumer，该消息不会被消费。

**解决**：先确认日志出现 `Consumer has joined`，再发消息；或按需设置 `fromBeginning: true`。

### 3. ClientKafka 不 connect 发不出消息

`ClientKafka` 不像 `ClientRMQ` 那样自动连接，必须在 `onModuleInit` 里显式 `await client.connect()`。

### 4. `advertised.listeners` 配置错误

若 `advertised.listeners` 配成 `localhost:9092`，容器/Pod 连上 broker 后会拿到 `localhost:9092` 的地址，无法再连（Pod 的 localhost 是自己）。

**解决**：设为客户端可访问的地址，本 demo 用 `host.docker.internal:9092`。

### 5. KafkaJS v2 分区器告警（可忽略）

```
WARN [undefined] KafkaJS v2.0.0 switched default partitioner...
```

仅提示默认分区器变更，不影响功能；可用 `KAFKAJS_NO_PARTITIONER_WARNING=1` 静默。

## 清理

```bash
docker rm -f kafka-producer-test kafka-consumer-test
docker rm -f kafka

# K8s 方式
kubectl delete -f kafka-demo/k8s/producer.yaml
kubectl delete -f kafka-demo/k8s/consumer.yaml
```
