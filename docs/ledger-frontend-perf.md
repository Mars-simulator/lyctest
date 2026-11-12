# 账务页面性能分析记录

对象是 `qiankun-demo/sub-app` 改造成真实账务页之后的样子：登录、账户列表（100 个）、流水表格、入金表单，数据来自本地跑着的 account-service 和 ledger-service。

最后落到生产构建的性能分 100、LCP 1.9s、TBT 50ms。期间试了两个方向：数据快照是负收益，已回退；流水分页是正收益，留下来了。

## 测试条件

| 项 | 值 |
| --- | --- |
| Lighthouse | 13.6.0 |
| Chrome | HeadlessChrome 157 |
| 模式 | mobile，4 倍 CPU 节流 + Slow 4G 模拟 |
| 构建 | `vite build` + `vite preview` |
| 数据 | 102 个账户，单账户 2000 条流水 |
| 采样 | 每个场景单次运行（Lighthouse 内部跑 5 次取中位） |

后端在 Docker 里，接口本地响应 6–30ms。Lighthouse 的节流会把这部分放大，但和真实跨机房部署仍有差距，看绝对值时记得打折。

## 基线

先看同一份代码在 dev server 和生产构建下的差距。

| 场景 | 构建 | 性能分 | FCP | LCP | TBT | CLS | 传输体积 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 子应用独立 | dev server | 82 | 0.7s | 4.9s | 50ms | 0.021 | 616 KiB |
| 子应用独立 | 生产构建 | 96 | 0.8s | 1.6s | 220ms | 0.021 | 51 KiB |
| 微前端 | 主应用 dev | 91 | 2.7s | 2.7s | 120ms | 0 | 1002 KiB |
| 微前端 | 全生产构建 | 99 | 0.8s | 0.8s | 120ms | 0 | 83 KiB |

dev server 那一行不用太当真。616 KiB 里大部分是未压缩的 ESM，光 `unminified-javascript` 一项就报 288 KB。换成生产构建只剩 51 KiB，LCP 从 4.9s 掉到 1.6s。

微前端那两行有意思。主应用跑 dev 时整页 1 MB，因为 qiankun 运行时本身 200 多 KB，加上两套未压缩产物。换成全生产构建降到 83 KiB，LCP 反而只有 0.8s，比子应用独立运行的 1.6s 还快。

这个反直觉的结果来自测量口径。微前端下 `/sub-app` 的主文档几乎是空的，子应用内容由 qiankun 异步注入，LCP 提前锁定在主应用的侧边栏上。子应用独立运行时，LCP 得等 Vue 挂载出余额卡片才成立。所以微前端那个 0.8s 不代表账务页更快，只是"什么时候算画完"提前了。

另外 TBT 这个指标飘得厉害。同一份代码同一台机器，先后测出 50ms、90ms、120ms、220ms，机器负载一变结果就变。单次值只能看量级。

## 1.9 秒的 LCP 花在哪

子应用独立运行、生产构建、100 行流水的情况下，FCP 0.8s，LCP 1.9s，中间这 1.1 秒是排查重点。

第一反应是接口串行。页面流程是拿 token → 请求账户列表（3001）→ 拿到第一个账户 id → 再请求流水（3002），两个请求串起来，本地 100ms 出头。

但做了对照后否掉了这个猜测。把数据行数从 100 改成 20，接口返回的 JSON 从 25 KB 降到 5 KB，LCP 完全没动，还是 1.9s。请求量不是瓶颈。

再看主线程。`mainthread-work-breakdown` 在 0.6–0.9s，`bootup-time` 0.2–0.3s，剩下的是渲染。4 倍 CPU 节流下，Vue 挂载 100 个账户按钮加上百行表格，把首次绘制推到 0.8s，最大内容元素到 1.9s 才稳定。

结论是 CSR 的固有成本，不是网络也不是代码写得烂。这段延迟里能动的只有"渲染多少东西"。

## 快照方案（失败，已回退）

页面九成的访问是"打开看看余额和最近流水"，数据几分钟内不会变。想法是把上次的账户列表、选中账户、流水存进 localStorage，6 小时过期，下次打开先渲染快照，再后台并发刷新账户和流水。

本地 Lighthouse 测过之后放弃了：

| 指标 | 无快照 | 有快照 | 变化 |
| --- | --- | --- | --- |
| 性能分 | 99 | 92 | -7 |
| LCP | 1.9s | 2.0s | 略差 |
| TBT | 90ms | 310ms | +244% |
| CLS | 0.021 | 0.021 | 不变 |

原因很直接：命中快照先渲染一遍 100 个账户加 100 行表格，后台刷新回来又整表替换一次，主线程做了两遍完整渲染。这个页面渲染成本远大于请求成本，缓存省下的 100ms 请求时间，抵不过多出来的一轮 DOM 重建。

`refreshInBackground()` 里做过 `Promise.all` 并发，但没救回来。代码已全部删除，`App.vue` 回到串行加载。

## 分页（有效，已保留）

既然渲染是主要成本，那就少渲染。流水改成每页 20 行，带上一页/下一页。

| 指标 | 100 行一次渲染 | 20 行 + 分页 | 变化 |
| --- | --- | --- | --- |
| 性能分 | 99 | 100 | +1 |
| TBT | 120ms | 50ms | -58% |
| 传输体积 | 83 KiB | 63 KiB | -24% |
| LCP | 1.9s | 1.9s | 不变 |

TBT 砍掉一多半，传输体积也小了。LCP 没动，说明 LCP 元素不受行数影响，大概率是页面上方的余额卡片——它和行数无关，只跟 Vue 何时挂载完成有关。

要再压 LCP，只能从"Vue 挂载前能不能先画出东西"下手，也就是 SSR 或静态预渲染。这个页面 LCP 已经拿 0.98 分（2.5s 以内都是满分），投入产出比不划算，没做。

## 没做的几件事

**虚拟滚动**。本来为 100 行表格准备了方案，测完发现 100 行的 TBT 才 120ms，渲染耗时在数据里排不上号。分页已经解决问题，再叠虚拟滚动是给自己加复杂度。

**首屏骨架**。想过在 HTML 里预置灰色占位，但快照实验已经证明：同一次加载里多做一次 DOM 操作就是负收益，骨架被 Vue 替换时同样要销毁重建一遍。没有真实数据支撑就没上。

**preconnect**。`index.html` 里加了到 3001 和 3002 的预连接，本地回环测不出效果，跨机房时能省一次握手。留着，成本为零。

## 改造过程中修的两个 bug

性能测试前先保证页面能正常跑，这里踩了两个坑，都和性能无关但会直接白屏。

第一个是流水接口的 `pageSize`。我图省事传了 200，后端 `QueryTransactionDto` 上是 `@Max(100)`，直接 400。前端 catch 到错误后清掉 token 退回登录页，页面上只剩一个登录框。最坑的是 Lighthouse 测出来 100 分——因为只渲染了个登录表单。发现后改成 100 重测，之前几轮数据全部作废。

第二个是 qiankun 的加载方式。子应用 dev 模式下 Vite 会注入 `<script type="module" src="/@vite/client">`，qiankun 把它当普通脚本执行，报 `Cannot use import statement outside a module`。另外 `vite-plugin-qiankun` 生成的入口是 `import('/src/main.js')`，这个绝对路径在沙箱里按主应用的 origin 解析，实际请求到了 5173，子应用生命周期永远注册不上，表现为卡在 `beforeLoad` 不报任何错。

两处都在 `vite.config.js` 里用 `transformIndexHtml` 处理了，细节写在 `qiankun-demo/README.md`。

## 结论

生产构建下 100 分，LCP 1.9s，TBT 50ms，没有继续优化的空间。真正能改的只有 SSR 那条路，而这个页面已经不需要。

前端这边更值得关注的是接口变慢时会发生什么。账务流水分页查询在 20 万行数据下要 90ms（见 `docs/loadtest-report.md`），数据涨到千万级会变成秒级，那时候前端做得再好也白搭。之前准备但回退的快照方案，等接口真慢到 500ms 以上时可能会重新变得有意义——届时它省下的就不是 100ms，而是用户盯着空白页的几秒。

## 复现

```powershell
# 后端
docker compose --profile split start mysql redis account-service ledger-service

# 子应用
cd qiankun-demo/sub-app
npm run build
npx vite preview --port 5175 --strictPort

# 冷启动
lighthouse "http://localhost:5175/sub-app/?token=<jwt>" `
  --only-categories=performance --output=json --output-path=docs/lighthouse/cold.json `
  --chrome-flags="--headless=new --no-sandbox"

# 二次访问（保留 localStorage，否则 Lighthouse 每次都会清空）
lighthouse "http://localhost:5175/sub-app/?token=<jwt>" `
  --only-categories=performance --disable-storage-reset `
  --chrome-flags="--headless=new --no-sandbox --user-data-dir=C:\temp\lh-profile" `
  --output=json --output-path=docs/lighthouse/warm.json
```

原始报告在 `docs/lighthouse/`，有用的几份：`final-baseline.json`（100 行）、`final-cache.json`（快照）、`after-paging.json`（分页）、`before-mobile.json`（dev）、`before-micro-prod-mobile.json`（微前端）。带 `_warmup` 前缀的是预热跑，不用看。
