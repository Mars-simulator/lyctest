# 账务服务 Kubernetes 部署

用纯 YAML 把账务服务（`APP_ROLE=ledger`）及其依赖部署到 minikube，并暴露访问。

## 一、资源清单

| 文件 | 内容 | 说明 |
| --- | --- | --- |
| `00-namespace.yaml` | `Namespace/ledger` | 独立命名空间 |
| `01-secret.yaml` | `Secret/ledger-secret` | DB 口令、JWT 密钥 |
| `02-mysql.yaml` | PVC + Deployment + Service | `mysql:3306`，1Gi 持久卷 |
| `03-redis.yaml` | Deployment + Service | `redis:6379`，emptyDir |
| `04-account-service.yaml` | Deployment + Service | 账户服务，账务服务调用它做归属校验 |
| `05-ledger-service.yaml` | Deployment + Service | **账务服务**，NodePort `30082` |

拓扑：

```
                  ┌────────────────────────────┐
  NodePort 30082  │      ledger-service        │  2 副本
  ───────────────▶│  /ledger/transactions/*     │
                  └──────────┬─────────────────┘
                             │ HTTP
                             │ GET /internal/accounts/:id/validate
                             ▼
                  ┌────────────────────────────┐
                  │      account-service       │  1 副本
                  │  /auth/*  /ledger/accounts │
                  └───────┬──────────┬─────────┘
                          ▼          ▼
                     ┌────────┐ ┌────────┐
                     │ mysql  │ │ redis  │
                     └────────┘ └────────┘
```

## 二、部署

### 1. 注入镜像（minikube 特有）

集群内无法直连 docker.io，必须先在宿主机拉取再注入节点：

```powershell
minikube image load nest-typeorm-crud-ledger-service:latest `
  nest-typeorm-crud-account-service:latest redis:7-alpine mysql:8.0

# 镜像导入后若 kubelet 仍报 ImagePullBackOff，重启节点内 containerd 触发重扫
docker exec minikube systemctl restart containerd
```

### 2. 应用清单

```powershell
kubectl apply -f k8s/ledger/
kubectl rollout status deployment/ledger-service -n ledger
```

### 3. 检查

```powershell
kubectl get pods -n ledger
kubectl get svc -n ledger
```

期望：

```
NAME                               READY   STATUS    RESTARTS
account-service-5f5fcfddf4-46wxs   1/1     Running   0
ledger-service-6df9bdfdb-jg7sq     1/1     Running   0
ledger-service-6df9bdfdb-pmxfs     1/1     Running   0
mysql-75fd9f556-npnh7              1/1     Running   0
redis-58684bfcbf-q2xp4             1/1     Running   0

NAME              TYPE        CLUSTER-IP       PORT(S)
account-service   ClusterIP   10.108.103.153   3001/TCP
ledger-service    NodePort    10.98.240.118    3002:30082/TCP
mysql             ClusterIP   10.102.41.240    3306/TCP
redis             ClusterIP   10.104.158.77    6379/TCP
```

## 三、暴露与访问

### 方式 1：NodePort（已配置 30082）

集群内 / 节点内可达：

```powershell
docker exec minikube curl -s http://127.0.0.1:30082/health
```

> **Windows + Docker driver 注意**：宿主机直接访问 `http://$(minikube ip):30082` 通常不通（节点 IP 在 WSL2 内部）。
> 需要在宿主机访问时用下面两种方式。

`minikube service` 会自动建立 tunnel 并打印可访问地址（交互式，会保持前台）：

```powershell
minikube service ledger-service -n ledger --url
```

### 方式 2：port-forward（脚本/自动化推荐）

```powershell
kubectl port-forward -n ledger svc/ledger-service 8082:3002
kubectl port-forward -n ledger svc/account-service 8081:3001
```

访问：`http://localhost:8082/health`

### 方式 3：集群内服务名

```
http://ledger-service.ledger.svc.cluster.local:3002
http://account-service.ledger.svc.cluster.local:3001
```

## 四、验证

### 健康检查

```powershell
# 期望 {"status":"ok",...}
curl.exe http://localhost:8082/health
# 期望 {"status":"ok","info":{},"error":{},...}（会检查 DB 与 Redis）
curl.exe http://localhost:8082/ready
```

### 端到端：登录 → 开户 → 存入 → 查余额

```powershell
$login = Invoke-RestMethod -Uri "http://localhost:8081/auth/login" -Method Post `
  -ContentType "application/json" -Body '{"username":"admin","password":"admin123"}'
$h = @{ Authorization = "Bearer " + $login.accessToken }

# 开户（账户服务）
$acct = Invoke-RestMethod -Uri "http://localhost:8081/ledger/accounts" -Method Post `
  -Headers $h -ContentType "application/json" `
  -Body '{"name":"k8s-demo-account","type":"asset","currency":"CNY"}'

# 存入 100 元（账务服务，内部调用账户服务做校验）
Invoke-RestMethod -Uri "http://localhost:8082/ledger/transactions/deposit" -Method Post `
  -Headers $h -ContentType "application/json" `
  -Body ('{"accountId":' + $acct.id + ',"amount":10000,"remark":"k8s-deploy-verify"}')

# 余额
Invoke-RestMethod -Uri ("http://localhost:8081/ledger/accounts/" + $acct.id + "/balance") -Headers $h
```

实测结果：

```json
{"id":1,"txnNo":"DP20261105799f27e11f494830","type":"deposit","amount":10000,
 "amountYuan":"100.00","toAccountId":2,"toBalanceAfter":10000,"status":"success"}

{"accountId":2,"accountNo":"AC20261105060118897863","currency":"CNY",
 "balance":10000,"balanceYuan":"100.00"}
```

### 确认跨服务调用

```powershell
kubectl logs -n ledger deploy/account-service --tail=50 | Select-String "internal/accounts"
```

期望看到账务服务 Pod 的 IP 发起调用：

```
"headers":{"host":"account-service:3001",...},"remoteAddress":"::ffff:10.244.120.76"
"msg":"GET /internal/accounts/2/validate?action=deposit 200"
```

## 五、设计说明

### initContainer 等待依赖

账务服务启动前用 `wait-for-deps` 探活 `mysql:3306`、`redis:6379`、`account-service:3001`，
避免依赖未就绪时进程反复 `CrashLoopBackOff`。探测用镜像自带的 Node 做 TCP 连接，不依赖 `nc`。

### DB_SYNC 与副本数

- `account-service`：`DB_SYNC=true`，首次启动创建 `account` / `user` 表。
- `ledger-service`：`DB_SYNC=true`，创建 `ledger_transaction` 表。

**首次部署先以 1 副本启动**，完成建表后再扩容（schema 无差异时 TypeORM 不会执行 DDL，扩容安全）：

```powershell
kubectl scale deployment/ledger-service -n ledger --replicas=2
```

若一开始就 2 副本且表不存在，两个实例会并发 `CREATE TABLE`，可能触发 DDL 冲突导致其中一方重启。
生产环境应改用 migration 并关闭 `DB_SYNC`。

### 探针

| 探针 | 路径 | 作用 |
| --- | --- | --- |
| readiness | `/ready` | 检查 DB / Redis，未就绪不接流量 |
| liveness | `/health` | 仅确认进程存活，避免依赖抖动导致误杀 |

## 六、常见问题

| 现象 | 原因 | 解决 |
| --- | --- | --- |
| `ImagePullBackOff` | 镜像未注入节点 / kubelet 未重扫 | `minikube image load` + 重启 containerd |
| `Table 'nest_crud_demo.ledger_transaction' doesn't exist` | 账务服务 `DB_SYNC=false` 且账户服务不建该表 | 账务服务设 `DB_SYNC=true` 并重启 |
| `account-service` 启动后多次重启 | MySQL 初始化未完成时已启动 | 已由 initContainer 规避；偶发重启后自愈 |
| 宿主机访问 `minikube ip:30082` 超时 | Windows + Docker driver 网络隔离 | 用 `minikube service --url` 或 `kubectl port-forward` |
| `POST /ledger/accounts` 返回 404 | 开户接口在账户服务，不在账务服务 | 请求打 `account-service:3001` |

## 七、清理

```powershell
kubectl delete -f k8s/ledger/
# 注意：PVC 可能残留，彻底清除需删除命名空间
kubectl delete namespace ledger
```
