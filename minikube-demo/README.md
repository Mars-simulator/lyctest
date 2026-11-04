# 本地安装 minikube 并跑通示例应用

在 Windows + Docker Desktop 环境下用 Docker driver 安装 minikube，部署一个 nginx 示例应用，并给出完整的验证方法与实测结果。

> 本文档中的每一步都在 **Windows 11 + Docker Desktop 29.9.1 + minikube v1.39.0（K8s v1.37.0）** 上实际执行并验证通过，包含国内网络下的关键绕行方案。

## 一、环境与结论速览

| 项 | 值 |
| --- | --- |
| 操作系统 | Windows 11 Enterprise LTSC 2024（24H2） |
| 容器运行时 | Docker Desktop 29.9.1（containerd 2.3.4） |
| minikube | v1.39.0 |
| Kubernetes | v1.37.0 |
| CNI | **Calico**（默认 kindnet 在本环境会 OOM/崩溃，见第六节） |

核心结论：**国内网络下，kicbase 和所有业务镜像都必须先用 `docker pull`（走 Docker 加速器）拉到本地，再用 `minikube image load` 注入节点**，否则 minikube 直连 docker.io/gcr.io/quay.io 会超时。

## 二、安装 minikube

### 方式 A：官方 installer（推荐，本环境实测有效）

下载并运行官方安装包（比手工下载裸 exe 更可靠，裸 exe 容易下到不完整的文件）：

```powershell
# 下载安装包（浏览器下载通常比命令行快很多）
# https://github.com/kubernetes/minikube/releases/latest/download/minikube-installer.exe

# 静默安装
Start-Process -FilePath "$env:USERPROFILE\Downloads\minikube-installer.exe" -ArgumentList "/S" -Wait
```

安装目录为 `C:\Program Files\Kubernetes\Minikube`，并会自动写入系统 PATH。

**注意**：安装后当前终端不会立刻生效，需要刷新 PATH：

```powershell
$env:Path = [Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [Environment]::GetEnvironmentVariable("Path","User")
minikube version
```

预期输出：`minikube version: v1.39.0`。

### 方式 B：手动下载裸 exe

仅在 installer 不可用时使用。下载 `minikube-windows-amd64.exe`（官方约 137MB），改名为 `minikube.exe` 放到 `C:\Users\<user>\bin\`，再将该目录加入 PATH。

**务必校验文件完整性**：

```powershell
(Get-Item "C:\Users\farben\bin\minikube.exe").Length / 1MB   # 应约 137MB
```

若只有 80MB 等整数值，说明下载被截断，执行会报「指定的可执行文件不是此操作系统平台的有效应用程序」。

### 方式 C：包管理器

```powershell
choco install minikube -y
scoop install minikube
winget install Kubernetes.minikube
```

### 前置条件

- Docker Desktop 运行中（`docker version` 能返回 Server 版本）
- `kubectl` 已安装（minikube 通常自带一份）

## 三、启动集群（关键步骤，不能跳过）

### 3.1 先把 kicbase 拉到本地

minikube 拉 kicbase 时**不走** Docker 的 `registry-mirrors`，会直连 `docker.io` / `gcr.io`，国内必超时。必须先自己拉：

```powershell
docker pull kicbase/stable:v0.0.51
```

> 若该镜像也拉不到，改用阿里云镜像（并记下，启动时用 `--base-image` 指定）：
> ```powershell
> docker pull registry.cn-hangzhou.aliyuncs.com/google_containers/kicbase:v0.0.51
> ```

### 3.2 启动集群（使用 Calico CNI）

```powershell
minikube start --driver=docker --image-mirror-country=cn --cni=calico
```

参数说明：

- `--driver=docker`：复用 Docker Desktop，无需额外虚拟机
- `--image-mirror-country=cn`：k8s 组件走国内镜像源（阿里云）
- `--cni=calico`：**替代默认 kindnet**。kindnet 在本环境会 `OOMKilled` 或 `Error(ExitCode 2)` 反复重启，导致节点永远 `NotReady`（详见第六节）

若第 3.1 步用的是阿里云 kicbase，启动时补 `--base-image`：

```powershell
minikube start --driver=docker --image-mirror-country=cn --cni=calico `
  --base-image=registry.cn-hangzhou.aliyuncs.com/google_containers/kicbase:v0.0.51
```

启动成功的关键标志：

```
* 配置 Calico (Container Networking Interface) ...
* 完成！kubectl 现在已配置，默认使用"minikube"集群和"default"命名空间
```

### 3.3 把 Calico 镜像注入节点（国内网络必做）

minikube 节点内的 containerd 拉 `quay.io` 很慢（实测 3 分钟仍未完成），导致 `calico-node` 卡在 `Init:0/3`。解决办法：宿主机 Docker 直连 `quay.io` 是通的，用它拉完再注入节点。

```powershell
# 1) 用 Docker 拉三个 Calico 镜像（宿主机直连 quay.io 可用）
docker pull quay.io/calico/cni:v3.32.2
docker pull quay.io/calico/node:v3.32.2
docker pull quay.io/calico/kube-controllers:v3.32.2

# 2) 注入 minikube 节点
minikube image load quay.io/calico/cni:v3.32.2 quay.io/calico/node:v3.32.2 quay.io/calico/kube-controllers:v3.32.2

# 3) 重启节点内 containerd，让它重新扫描本地镜像（关键，否则仍会去 Pull）
docker exec minikube systemctl restart containerd
```

### 3.4 等待节点 Ready

```powershell
kubectl wait --for=condition=Ready node/minikube --timeout=180s
kubectl get nodes
```

预期：

```
NAME       STATUS   ROLES           AGE   VERSION
minikube   Ready    control-plane   ...   v1.37.0
```

同时 `kube-system` 下所有 Pod 应为 `Running`：

```powershell
kubectl get pods -n kube-system
```

## 四、部署示例应用

### 4.1 先把镜像注入节点

`nginx:alpine` 在节点内同样拉不动（docker.io 不通），先拉后注入：

```powershell
docker pull nginx:alpine
minikube image load nginx:alpine
```

### 4.2 部署

```powershell
kubectl apply -f minikube-demo/hello.yaml
```

清单内容（`hello.yaml`）：

- `Deployment/hello`：2 个 `nginx:alpine` 副本
- `Service/hello`：NodePort，映射到节点 `30080`

若之前已有失败 Pod，删除让 Deployment 重建（重建后会用上注入的本地镜像）：

```powershell
kubectl delete pod -l app=hello
```

## 五、验证方法与实测结果

### 1. 集群就绪

```powershell
minikube status
kubectl get nodes -o wide
```

**实测**：

```
minikube
type: Control Plane
host: Running
kubelet: Running
apiserver: Running
kubeconfig: Configured

NAME       STATUS   ROLES           AGE   VERSION
minikube   Ready    control-plane   12m   v1.37.0
```

### 2. 工作负载就绪

```powershell
kubectl get deployments
kubectl get pods -o wide
kubectl rollout status deployment/hello
```

**实测**：

```
NAME    READY   UP-TO-DATE   AVAILABLE   AGE
hello   2/2     2            2           3m23s

NAME                     READY   STATUS    RESTARTS   AGE   IP              NODE
hello-5cf899fd58-2fgks   1/1     Running   0          22s   10.244.120.70   minikube
hello-5cf899fd58-f2q8l   1/1     Running   0          23s   10.244.120.69   minikube
```

### 3. 服务与端点

```powershell
kubectl get svc hello
kubectl get endpoints hello
```

**实测**：

```
NAME    TYPE       CLUSTER-IP       EXTERNAL-IP   PORT(S)        AGE
hello   NodePort   10.106.184.115   <none>        80:30080/TCP   3m23s

NAME    ENDPOINTS                           AGE
hello   10.244.120.69:80,10.244.120.70:80   3m24s
```

> `v1 Endpoints is deprecated` 只是提示，不影响使用；可改用 `kubectl get endpointslices`。

### 4. 集群内访问（不依赖端口转发，最可靠）

```powershell
kubectl exec deploy/hello -- wget -qO- http://hello
```

**实测**：返回 nginx 欢迎页

```html
<!DOCTYPE html>
<html>
<head>
<title>Welcome to nginx!</title>
...
```

### 5. 宿主机访问（HTTP 200）

```powershell
$p = Start-Process kubectl -ArgumentList 'port-forward','svc/hello','8081:80' -PassThru -WindowStyle Hidden
Start-Sleep -Seconds 4
try {
  $r = Invoke-WebRequest -Uri "http://localhost:8081" -UseBasicParsing
  Write-Output ("HTTP_STATUS=" + $r.StatusCode)
} finally {
  Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue
}
```

**实测**：`HTTP_STATUS=200`

> 不建议用 `minikube service hello --url` 做自动化验证：Docker driver 下它会保持 tunnel 进程不退出，容易挂住脚本。需要外部 URL 时可交互式运行。

### 6. 访问日志

```powershell
kubectl logs -l app=hello --tail=6
```

**实测**：两次 200 请求都到达了 Pod

```
192.168.49.2 - - [04/Nov/2026:09:06:31 +0000] "GET / HTTP/1.1" 200 896 "-" "Wget" "-"
127.0.0.1    - - [04/Nov/2026:09:06:47 +0000] "GET / HTTP/1.1" 200 896 "-" "Mozilla/5.0 ... PowerShell" "-"
```

### 7. 自愈能力（可选）

```powershell
$pod = (kubectl get pods -l app=hello -o jsonpath="{.items[0].metadata.name}")
kubectl delete pod $pod
kubectl get pods -l app=hello -w
```

**判定**：被删 Pod 消失，随即出现新的 `Running` Pod。

### 8. 扩缩容（可选）

```powershell
kubectl scale deployment hello --replicas=3
kubectl get deployments
```

**判定**：`READY` 变为 `3/3`。

## 六、验证通过的整体判据

同时满足以下 6 条即视为全链路跑通：

1. `kubectl get nodes` → 节点 `Ready`
2. `kubectl get deployments` → `READY 2/2`
3. `kubectl get pods` → 全部 `Running`，`RESTARTS=0`
4. `kubectl get endpoints hello` → 有 2 个 Pod IP
5. `kubectl exec deploy/hello -- wget -qO- http://hello` → 返回 nginx 欢迎页
6. `kubectl port-forward` 后宿主机访问 → `HTTP 200`，且日志有访问记录

## 七、实战踩坑记录（本环境真实遇到的问题）

### 1. minikube 裸 exe 下载被截断

**现象**：`minikube.exe` 只有 80MB（官方约 137MB），执行报「指定的可执行文件不是此操作系统平台的有效应用程序」。

**排查**：文件头 `4D 5A`（MZ）、PE 签名 `0x00004550`、Machine `0x8664`（amd64）都正常，但大小是 80MB 整——下载被截断，不是架构问题。

**解决**：改用官方 `minikube-installer.exe`，或重新下载并校验大小。

### 2. kicbase 拉不下来，`minikube start` 卡死

**现象**：日志显示

```
failed to download docker.io/kicbase/stable:v0.0.51 ... dial tcp 128.121.243.106:443 超时
failed to download gcr.io/k8s-minikube/kicbase:v0.0.51 ... dial tcp 142.251.188.82:443 超时
Downloading: https://github.com/kubernetes/minikube/releases/download/v1.39.0/kicbase-v0.0.51-amd64.tar
```

GitHub 回退下载也长期 0 字节。

**根因**：minikube 拉 kicbase 不走 Docker 的 `registry-mirrors`，直连 docker.io/gcr.io。

**解决**：先 `docker pull kicbase/stable:v0.0.51`（走 Docker 加速器）。

### 3. kindnet 反复 OOM / 崩溃，节点永远 NotReady

**现象**：

```
kindnet-7lvdf   0/1  OOMKilled   4 (81s ago)
kubectl describe node → container runtime network not ready:
  NetworkPluginNotReady message: Network plugin returns error: cni plugin not initialized
```

**排查**：kindnet 的 `memory limit` 只有 `50Mi`：

```
requests={"cpu":"100m","memory":"50Mi"}
limits={"cpu":"100m","memory":"50Mi"}
```

**尝试**：`kubectl set resources daemonset/kindnet --limits=memory=256Mi --requests=memory=128Mi` 后，OOM 变为 `Error(ExitCode 2)`，仍然崩溃（日志正常启动后即退出）。

**解决**：换 CNI：

```powershell
minikube delete
minikube start --driver=docker --image-mirror-country=cn --cni=calico
```

### 4. Calico 镜像从 quay.io 拉不动

**现象**：`calico-node` 卡在 `Init:0/3` 三分多钟，事件显示

```
Normal  Pulling  kubelet  spec.initContainers{upgrade-ipam}: Pulling image "quay.io/calico/cni:v3.32.2"
```

**关键发现**：宿主机 Docker 直连 quay.io **是通的**（`docker pull` 秒级完成），只有 minikube 节点内的 containerd 拉不动。

**解决**：`docker pull` 三个 calico 镜像 → `minikube image load` → 重启节点 containerd。

### 5. 镜像已注入节点，kubelet 却仍 Pulling

**现象**：`crictl images` 能看到 `quay.io/calico/cni:v3.32.2`，`imagePullPolicy` 也是 `IfNotPresent`，但 Pod 事件仍是 `Pulling`，卡住不前。

**解决**：

```powershell
docker exec minikube systemctl restart containerd
```

重启后 containerd 重新扫描本地镜像，calico-node 立即变为 `Running`，节点转 `Ready`。

### 6. 业务镜像 `ImagePullBackOff`

**现象**：`hello` Pod 为 `ImagePullBackOff`（`nginx:alpine` 拉不到）。

**解决**：

```powershell
docker pull nginx:alpine
minikube image load nginx:alpine
kubectl delete pod -l app=hello   # 让 Deployment 用本地镜像重建
```

### 7. `minikube service --url` 挂住脚本

**现象**：Docker driver 下该命令会保持 tunnel 进程，在自动化脚本里不会退出。

**解决**：验证外部访问改用 `kubectl port-forward svc/hello 8081:80` + `Invoke-WebRequest`。

### 8. 端口占用

| 端口 | 用途 | 冲突处理 |
| --- | --- | --- |
| `30080` | Service NodePort | 被占用时改 `nodePort` |
| `8081` | port-forward 本地端口 | 被占用时换一个 |

## 八、常用运维命令

```powershell
minikube dashboard                              # 打开 K8s Dashboard
minikube ip                                     # 查看节点 IP
minikube image ls                               # 查看节点内镜像
kubectl describe pod <pod>                      # 排查 Pod 异常
kubectl get events --sort-by=.lastTimestamp     # 按时间查看事件
kubectl port-forward svc/hello 8081:80          # 端口转发
kubectl exec -it deploy/hello -- sh             # 进入容器
```

## 九、清理

```powershell
kubectl delete -f minikube-demo/hello.yaml
minikube stop      # 停止集群（保留状态，下次 start 很快）
minikube delete    # 彻底删除集群（释放磁盘）
```

## 十、快速重装清单（照抄即可）

```powershell
# 1. 安装
Start-Process -FilePath "$env:USERPROFILE\Downloads\minikube-installer.exe" -ArgumentList "/S" -Wait
$env:Path = [Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [Environment]::GetEnvironmentVariable("Path","User")

# 2. 预拉 kicbase
docker pull kicbase/stable:v0.0.51

# 3. 启动（Calico）
minikube start --driver=docker --image-mirror-country=cn --cni=calico

# 4. 注入 Calico 镜像并重启 containerd
docker pull quay.io/calico/cni:v3.32.2
docker pull quay.io/calico/node:v3.32.2
docker pull quay.io/calico/kube-controllers:v3.32.2
minikube image load quay.io/calico/cni:v3.32.2 quay.io/calico/node:v3.32.2 quay.io/calico/kube-controllers:v3.32.2
docker exec minikube systemctl restart containerd
kubectl wait --for=condition=Ready node/minikube --timeout=180s

# 5. 预拉业务镜像
docker pull nginx:alpine
minikube image load nginx:alpine

# 6. 部署并验证
kubectl apply -f minikube-demo/hello.yaml
kubectl rollout status deployment/hello
kubectl get pods -o wide
kubectl exec deploy/hello -- wget -qO- http://hello
```
