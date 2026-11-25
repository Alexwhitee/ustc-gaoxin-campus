# 中科大高新校区 · 湖畔信标

用键盘和鼠标从图书教育中心走到永怀湖。支持第一人称探索、实时多人同房、校园打卡和像素校园互见。地图覆盖 31 座建筑，游戏实时渲染建筑立面、阴影与湖面反射。

[公开试玩 · LAKESIDE](https://ustc-gaoxin-lakeside.r3694211.workers.dev/gaoxin-sandbox/index.html?room=LAKESIDE) · [项目介绍](https://ustc-gaoxin-campus.pages.dev/) · [运行手册](https://ustc-gaoxin-campus.pages.dev/guide/) · [English setup](https://ustc-gaoxin-campus.pages.dev/en/guide/)

## 湖畔信标 · 1–20 人沙盒

把公开试玩链接发给同学，大家可以在电脑浏览器以访客身份进入同一个 LAKESIDE 房间。访客房间状态和积分随该局运行，公开试玩无需账户。

从南门车库出生，开电动车配送，或前往湖岸和红砖广场争夺信标。在任一交付站按 E 结算。安全区以外可以自由交战，单人房间会有 NPC 守卫。用 WASD 移动或开车，鼠标瞄准，左键发射，Q 切换装备，空格手刹，E 上下车和互动，Esc 释放鼠标。

安装 Node.js 22 与依赖后，从仓库根目录在两个终端分别执行以下命令。

```bash
npm run dev -- --hostname 127.0.0.1 --port 3157
GAOXIN_PORT=3158 GAOXIN_UPSTREAM=http://127.0.0.1:3157 npm run campus:3d
```

打开[湖畔信标](http://127.0.0.1:3158/gaoxin-sandbox/?room=LAKESIDE)。同房链接最多 20 位玩家，随时加入或退出。断线后有 30 秒恢复窗口，退出时释放车辆和信标。登录玩家的累计积分写入独立的 `data/campus-sandbox.db`，可用 `GAOXIN_SANDBOX_DB` 指定数据卷位置。

公开试玩由 Cloudflare Workers 托管游戏和 HTTPS/WSS，Durable Objects 按房间运行游戏逻辑。拥有该 Cloudflare 项目权限时，可以用以下命令更新公开服务。

```bash
node scripts/build-sandbox-public.mjs
wrangler deploy --config wrangler.sandbox.toml
PROJECT_SITE_URL=https://ustc-gaoxin-campus.pages.dev/ node site/build.mjs
wrangler pages deploy site/dist --project-name ustc-gaoxin-campus --branch main
```

如需自托管带账户的版本，在服务端启动 Next.js 与一个 `campus:3d` 房间进程，将 HTTPS 反向代理指向房间网关端口。代理需传递原始 `Host` 以及 WebSocket 的 `Upgrade` 和 `Connection` 头。

```bash
node --test tests/gaoxin-3d.node-test.mjs tests/gaoxin-sandbox.node-test.mjs
node tests/gaoxin-sandbox-soak.mjs 1800
uv run --python 3.11 --with bpy==5.0.1 python scripts/build-sandbox-art.py
```

`tests/gaoxin-sandbox.browser.js` 可通过 Playwright CLI 的 `run-code` 实测两个桌面窗口。[参考项目与迁移记录](TOOLING.md)记录了源码版本和适配范围。

## 快速开始

安装 Node.js 22，并使用支持 WebGL 2 的桌面浏览器。将项目克隆后，运行：

```bash
git clone https://github.com/Alexwhitee/ustc-gaoxin-campus.git
cd ustc-gaoxin-campus
npm ci
npm run dev -- --hostname 127.0.0.1 --port 3107
```

另开一个终端，在同一目录运行 `npm run campus:3d`。打开[本机多人校园](http://127.0.0.1:3108/gaoxin-3d/index.html?room=GAOXIN)。点击「进入校园」后用 WASD 行走、鼠标转头、E 互动。第二个独立浏览器窗口可使用同一房间链接加入。

## JLUAI 应用

3D 游戏沿用 JLUAI 的应用入口、账号以及像素校园位置同步。JLUAI 起初由社区与像素校园两个模块合并而来。

## 技术栈

- **Next.js 15**（App Router，standalone 产物）+ React 19 + TypeScript（strict）
- **Tailwind CSS 3** + Radix UI（shadcn 风格手写组件）
- **SQLite + Drizzle ORM**（better-sqlite3，WAL 模式；建表 DDL 幂等，启动自动执行 + 种子数据）
- **Phaser 3**：像素校园（3200×2400 世界完全程序化 Canvas 绘制，零外部素材）
- 认证：自建 session（scrypt 密码哈希 + httpOnly cookie，30 天）

## 功能

**社区**：信息流（全部/关注/短文/作品，分页）、8 个话题、帖子详情（楼中楼评论、点赞、收藏、分享、浏览计数去重）、发布、广场热榜、聊天室（持久化 + 增量轮询）、通知（评论/回复/点赞/关注，未读红点）、每日签到与经验等级、个人主页（帖子 + 收藏）、用户页（关注/粉丝统计）。

**像素校园 `/campus`**：总览模式（拖拽/滚轮/双指缩放、点楼看信息卡）、行走模式（WASD/方向键，移动端虚拟摇杆 + 交互按钮）、24 个机器人同学、多人 presence 同步（380ms 轮询，在线数如实展示「真实 N 人 + 机器人 24」）、昼夜系统、小地图、伪天气（按日期种子生成，演示数据）。

**账号**：用户名 + 密码注册登录，emoji 头像；种子演示用户不可登录；游客可浏览全部内容，写操作需登录（服务端鉴权，身份一律取自 session）。

## 本地运行

```bash
nvm use 22   # 或自行安装 Node.js 22
npm ci
npm run dev   # http://localhost:3000
```

数据库文件默认在 `./data/jluai.db`（首次启动自动建表 + 写入种子数据）。可用环境变量见 `.env.example`。

```bash
npm run build && npm start   # 生产模式
npm run lint                 # ESLint
npm test                     # vitest 单元测试
npm audit --omit=dev          # 检查生产依赖已知漏洞
```

Next.js 与 eslint-config-next 固定为 15.5.29。`package.json` 的 overrides 为 Next.js 使用的
PostCSS 和 TypeScript ESLint 使用的 minimatch 指定修复版本；上游依赖采用修复版本后可移除对应覆盖。

## 服务器部署（推荐 Docker Compose）

从仓库根目录部署。采用单机单实例，数据库保存在 Docker 数据卷中。
服务器需安装 Docker Engine、Compose v2.20+ 和 Nginx；不需要另装 Node、npm 或 SQLite。

```bash
cd /opt/jluai   # 将本项目源码放在此处
cp .env.example .env
# 修改 .env 中 NEXT_PUBLIC_CAMPUS 等公开配置后再构建
# 生产构建会执行 lint、测试和 TypeScript 检查；建议至少 2 GB 内存

docker compose up -d --build --wait
curl -fsS http://127.0.0.1:3000/api/health
```

`/api/health` 检查数据库连接，成功返回 `{"status":"ok"}`，故障返回 503；响应不缓存。
构建在 Linux 中完成，避免 macOS 的 better-sqlite3 原生模块被带上服务器。
`NEXT_PUBLIC_*` 是构建期变量，修改后必须重新构建。默认时区为 `Asia/Shanghai`，签到日期不随服务器时区改变。

### 对外访问与 HTTPS

Compose 默认只监听 `127.0.0.1:3000`。在服务器安装反向代理配置：

```bash
sudo install -m 644 deploy/nginx.conf /etc/nginx/sites-available/jluai
sudo ln -s /etc/nginx/sites-available/jluai /etc/nginx/sites-enabled/jluai
sudo nginx -t && sudo systemctl reload nginx
```

先将 `server_name _;` 改为服务器 IP 或域名；已有默认站点时，应由管理员确认该域名没有被其他站点占用。
如果修改了 `.env` 的 `PORT`，同步修改 Nginx 的 upstream 端口。
公网只需开放 80/443。域名解析完成后，为该 Nginx 站点配置 TLS 证书和 HTTP → HTTPS 重定向。
代理配置会覆盖转发头，使应用能够正确识别 HTTPS cookie 和限流 IP；应用端口应始终保持仅本机可访问。
纯 HTTP 可以完成部署验证，真实账号应通过 HTTPS 使用。

### 日常维护、备份与恢复

```bash
docker compose ps
docker compose logs --tail=100 -f app
# 更新源码后重新构建并等待健康检查；升级前先备份
docker compose exec -T app bash backup-db.sh
docker compose up -d --build --wait
# 停止服务，保留全部数据卷
docker compose down
```

容器日志自动轮转（每份 10 MB，最多三份）。Compose 数据卷 `data` 保存数据库，`backups` 保存最近七份备份。
备份使用 SQLite 在线 backup API，包含 WAL 中尚未 checkpoint 的数据，通过 `quick_check` 后才轮转。
数据库不存在或备份失败时返回非零退出码，保留旧备份。数据库和备份不会进入镜像或构建上下文。
**不要执行 `docker compose down -v` 或删除数据卷**，这些操作会永久删除数据。

每日备份可添加到服务器 crontab（把目录改为实际项目路径）：

```cron
30 3 * * * cd /opt/jluai && /usr/bin/docker compose exec -T app bash backup-db.sh >> /var/log/jluai-backup.log 2>&1
```

备份卷与服务在同一台机器，需要另行复制到异机存储。复制所有备份到宿主机：

```bash
mkdir -p ./backups
chmod 700 ./backups
docker compose cp app:/app/backups/. ./backups/
```

恢复时先停止应用，用只读备份替换数据库，并清理与旧数据库配套的 WAL/SHM 文件。
以下命令**会覆盖当前数据库**，仅在确认备份正确且已保存当前数据后执行：

```bash
docker compose stop app
# 将待恢复的备份放到项目目录 backups/restore.db
docker compose run --rm --no-deps --user root --cap-add DAC_OVERRIDE --cap-add CHOWN \
  -v "$PWD/backups:/restore:ro" --entrypoint sh app -ec '
    test -s /restore/restore.db
    restore_tmp=$(mktemp /app/data/restore.XXXXXX)
    cp /restore/restore.db "$restore_tmp"
    node -e '\''const D=require("better-sqlite3");const d=new D(process.argv[1]);if(d.pragma("quick_check",{simple:true})!=="ok")process.exit(1);d.pragma("journal_mode = DELETE");d.close()'\'' "$restore_tmp"
    chmod 600 "$restore_tmp"
    chown node:node "$restore_tmp"
    rm -f /app/data/jluai.db-wal /app/data/jluai.db-shm
    mv "$restore_tmp" /app/data/jluai.db
  '
docker compose up -d --wait
```

`--wait` 失败时检查日志；Compose 不会自动恢复上一个镜像。数据卷不会被重建。
未来含数据库结构变更的版本，需要先确认旧代码是否兼容新结构；恢复旧代码不会自动恢复数据。

### 无 Docker 运行环境：systemd 备选

运行服务器安装 **Node.js 22**、Nginx、rsync、curl，本地安装 Docker。
`deploy.sh` 从 Docker 镜像提取目标架构 standalone 产物，通过 SSH 发布到独立 release 目录，
原子切换 `/opt/jluai/src` 符号链接；健康检查失败时切回原代码，数据库始终位于 `/opt/jluai/data`。
SSH 账号需要写入 `/opt/jluai`、切换服务及设置文件所有者的权限；以下初始化命令由管理员执行。

```bash
sudo useradd --system --user-group --home-dir /opt/jluai --shell /usr/sbin/nologin jluai
sudo install -d -o jluai -g jluai -m 750 /opt/jluai/data /opt/jluai/backups
sudo mkdir -p /opt/jluai/releases
sudo install -m 644 deploy/jluai.service /etc/systemd/system/jluai.service
sudo systemctl daemon-reload
sudo systemctl enable jluai
# /opt/jluai/.env 可覆盖 DATABASE_PATH 等运行配置；不要在其中覆盖 HOSTNAME 为公网地址
```

如旧服务器的 `/opt/jluai/src` 是实际目录，先在维护窗口停止服务，将它移到
`/opt/jluai/releases/legacy`，再创建 `/opt/jluai/src` 指向该目录的符号链接。
现有数据库无需移动；新 systemd 服务需要 `jluai` 用户可写数据目录与应用 `.next/cache`。
确认 Node 位于 `/usr/bin/node`，否则调整服务文件的 `ExecStart`。

```bash
# 在本地项目目录执行；SSH 别名由 ~/.ssh/config 管理
PLATFORM=linux/amd64 ./deploy.sh root@your-server
# ARM64 服务器使用 PLATFORM=linux/arm64
```

脚本不预设任何服务器地址，不会自动安装服务或修改 Nginx。该流程使用 Debian bookworm 构建原生模块，
目标系统需有兼容的 glibc（Debian 12 / Ubuntu 24.04 或更新版本）；其他系统优先使用 Compose。
历史 release 保留以便回滚，由管理员在确认不再使用后清理；回滚只恢复代码。

部署方式依据 [Next.js 自托管文档](https://nextjs.org/docs/15/app/guides/self-hosting) 和
[Docker Next.js 指南](https://docs.docker.com/guides/nextjs/)。

## 目录结构

```
app/
  (forum)/        论坛页面组（侧栏布局）：/ /topics /posts /users /square /chat /me /notifications /login /terms /privacy
  campus/         像素校园（独立布局，无侧栏）
  api/            posts/comments/like/favorite/view, users/[id]/follow, checkin, chat,
                  notifications, auth/{register,login,logout,me}, presence
components/
  forum/          论坛组件（feed/post-card/comment-section/login-dialog/sidebar…）
  campus/         游戏 HUD、挂载、虚拟摇杆
  ui/             基础组件（button/dialog/input/tabs/avatar…）
  auth-provider.tsx  客户端登录态 Context
lib/
  db/             Drizzle schema、连接（幂等迁移 + 种子）
  auth.ts         scrypt + session + 限流
  queries.ts      全部数据访问（读/写/统计/通知/签到/聊天）
  campus/         Phaser 场景、校园包数据、程序化渲染
scripts/          osm-to-campus.mjs（OSM → 校园包生成器）
deploy/           systemd 单元与 Nginx 配置
Dockerfile / compose.yaml  Linux 生产镜像、数据卷、日志轮转与健康检查
```

## 校园包：切换与新增

像素校园的世界数据是声明式的「校园包」（`lib/campus/types.ts` 里的 `CampusPack`），
渲染器与玩法代码对任何校园包零改动复用。已内置：

- `jlu` 吉林大学中心校区·前卫南区（手绘简化布局）
- `ustc` 中国科学技术大学·东校区（OSM 数据生成 + 人工校准）
- `ustc-gaoxin` 中国科学技术大学·高新校区（OSM 数据生成 + 人工校准）

**切换校园**（三选一，优先级从高到低）：

1. URL 参数：`/campus?campus=ustc` 或 `/campus?campus=ustc-gaoxin`
2. HUD 总览页头的下拉框
3. 环境变量：`NEXT_PUBLIC_CAMPUS=ustc`（构建时默认值）

多人 presence 按校区隔离，不同校区的玩家互相不可见。

### 高新校区第一人称 3D

在两个终端从本目录启动 jluai 和实时房间入口。

```bash
npm run dev -- --hostname 127.0.0.1 --port 3107
npm run campus:3d
```

打开 [3D 房间](http://127.0.0.1:3108/gaoxin-3d/index.html)。点击「进入校园」后用 WASD 行走、鼠标转头、E 互动，按 Esc 释放鼠标。同一房间链接支持最多六人。房间进度保存在运行中的进程内，短暂掉线后可恢复。仅启动 Next 时，3D 页面可通过「校园互见」接原像素校园的位置同步。房间入口默认只监听本机，端口和上游可通过 `GAOXIN_PORT`、`GAOXIN_UPSTREAM` 配置。

用 `node --test tests/gaoxin-3d.node-test.mjs` 核对校园碰撞、各片区可达性和房间规则。已有 Playwright CLI 时，可先打开上述地址，再把 `tests/gaoxin-3d.browser.js` 作为 `run-code` 的输入复跑双窗口任务。

**新增一个校园**（三步）：

```bash
# ① 跑生成器：给出校园内一个种子坐标( lat,lon ),脚本自动匹配 OSM 大学多边形,
#    拉取建筑/道路/水域/球场,投影成像素网格,输出 CampusPack 初稿
node scripts/osm-to-campus.mjs --id mycampus \
  --name "XX大学像素地图" --subtitle "XX大学 · 主校区" \
  --seed "31.8395,117.2630" --grid-w 200 \
  --out lib/campus/campuses/mycampus.ts
# （OSM 没覆盖好时也可 --bbox S,W,N,E 手动框范围）

# ② 人工校准生成的 TS 文件:出生点 spawn(放主路上)、校门 gates、
#    装饰 decorations(喷泉/樱花/自行车/公告栏)、机器人 bots(昵称/台词/落点)、气候 weather
#    数据 © OpenStreetMap 贡献者(ODbL 1.0),保留署名即可

# ③ 在 lib/campus/registry.ts 注册,完成
```


## 已知边界

- presence 与限流为单实例内存态（不可直接多进程或水平扩容；扩容前需共享存储）。presence 最多保留 1000 个活跃连接，闲置 6 秒过期
- IP 属地为固定展示「吉林」，未接真实归属地库
- 天气为按日期生成的演示数据
- 图片为程序化占位图（渐变 + emoji），未接真实上传

## 来源说明

JLUAI 社区参考了 [jluai.bitmiracle.cn](https://jluai.bitmiracle.cn) 的功能。第三方素材与地图数据详见 [第三方许可证与署名](THIRD_PARTY_NOTICES.md)。

## 维护项目官网

官网采用 `site/` 中无依赖的双语模板。中英文文案在 `site/content.mjs`，页面布局在 `site/build.mjs`，项目实拍图在 `site/assets/`。构建脚本同时检查页面、语言配对和锚点。

```bash
PROJECT_SITE_URL=https://ustc-gaoxin-campus.pages.dev/ node site/build.mjs
python3 -m http.server 4184 --bind 127.0.0.1 --directory site/dist
```

使用已登录的 Wrangler，通过 Cloudflare Pages Direct Upload 发布静态产物。生产分支为 `main`。

```bash
WRANGLER_SEND_METRICS=false wrangler pages deploy site/dist --project-name ustc-gaoxin-campus --branch main
```
