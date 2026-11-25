# 湖畔信标参考项目记录

三个工作副本位于本机 `GitHub-xiangmu` 项目库，独立于游戏仓库。

| 项目与固定版本 | 运行方式 | 在湖畔信标中的用途 |
|---|---|---|
| [Overdrive City · 288fc54](https://github.com/appleweiping/overdrive-city/tree/288fc54a5bb163f4945617639987c0a2dea59e59) | `python3 -m http.server 4179`，`node --test test/city.test.mjs` | 对照限时配送、路线检查点与结算节奏。校园事件和资产自行实现。 |
| [gta7 · bd5ee61](https://github.com/depixeled-chris/gta7/tree/bd5ee61af4759881c235077605d33be9342108e8) | Node.js 22，`npm ci`、`npm test`、`npm run dev` | 移植固定步长驾驶的速度分解，改用校园坐标、限速和障碍查询。保留 MIT 署名。 |
| [Fully AI Arena FPS · 920b123](https://github.com/Hazzad123/fully-ai-arena-fps/tree/920b123d67015d5e8151a4ebd6742d8015d538be) | Node.js 22，`npm ci`、`npm test`、`npm run build`、`npm start` | 比较命中遮挡、房间与机器人压测。采用自有服务端模拟和美术资产。 |

本项目用 Three.js 加载 Blender 导出的原创车库、车辆、广场与湖岸道具。可用 `scripts/build-sandbox-art.py` 重现 GLB。模型、运行方式和测试入口见 [README](README.md)。

三个样本分别通过 6、164、258 项自动化测试。另在浏览器验证了 Overdrive 的配送检查点结算、gta7 的上下车与建筑碰撞、Arena 的双窗口自由混战开局。Overdrive 的检查点验证使用其调试入口。gta7 上游长套件后段的车辆爆炸用例失败并出现页面加载超时，校园版仅采用其已单独验证的驾驶计算。

## 本地验收记录

- macOS Apple M4，Chromium，1920×1080 中画质。一个画面客户端与 19 个自动连接同房，移动和转向短测的中位帧率为 59.9 FPS，P95 帧时间为 16.7 毫秒。
- 双浏览器验证晚加入、互相同步、上下车和刷新恢复。单人浏览器实测击败守卫、拾取并交付信标。旧漫游的撞墙、双人任务与恢复测试通过。
- Node.js 22 的生产构建可经网关加载 GLB。登录玩家在隔离测试数据库完成配送取得 3 分，换房后读回累计积分。通过本机证书校验测试同源 HTTPS/WSS，并在模拟 150 毫秒往返延迟下验证输入确认和短线重连。
- 本机 20 个自动 WebSocket 客户端连续运行 1,801 秒，处理 701,400 帧快照与 30 次断开重连，服务端计算 P95 为 2.5 毫秒。测试覆盖车辆、走路、发射和房间容量。
