export const repository = 'https://github.com/Alexwhitee/ustc-gaoxin-campus';
export const liveGame = 'https://ustc-gaoxin-campus.pages.dev/gaoxin-sandbox/index.html?room=LAKESIDE';

export const commands = `git clone ${repository}.git
cd ustc-gaoxin-campus
npm ci
npm run dev -- --hostname 127.0.0.1 --port 3107`;
export const roomCommand = 'npm run campus:3d';
export const game = 'http://127.0.0.1:3108/gaoxin-3d/index.html?room=GAOXIN';

export const content = {
  'zh-CN': {
    language: '中文', name: '高新校区漫游', home: '项目介绍', guide: '运行手册',
    skip: '跳到正文', nav: '主导航', languageNav: '语言选择', contents: '本页目录', repoLabel: 'GitHub 源码',
    place: '安徽合肥 · 中国科学技术大学',
    title: ['中科大高新校区', '湖畔信标'],
    summary: '从南门车库开车出发，沿永怀湖配送，或和同学在红砖广场争夺信标。打开同一个试玩链接就能进入公共房间。',
    playOnline: '试玩《湖畔信标》', start: '本地运行指南', homeMore: '查看画面',
    heroAlt: '游戏实拍。永怀湖对岸的图书教育中心塔楼、红砖裙楼与湖中倒影。',
    heroCaption: '游戏实拍 · 永怀湖畔的图书教育中心',
    facts: [['第三人称', 'WASD 步行与驾驶'], ['最多 20 人', '共用房间与实时活动'], ['访客直接进房', '使用电脑键盘和鼠标']],
    explore: '从广场走到永怀湖',
    features: [
      ['lake', '镜头里的永怀湖', '水面会反射楼群与树木。阳光、窗框和铺装让校园各片区有自己的质感。', '永怀湖的水面波纹和对岸建筑倒影'],
      ['sandbox', '在湖岸争夺信标', '拿到信标后可选择两个交付点中的任意一个。一个人也能开车配送，或与 NPC 争夺信标。', '《湖畔信标》湖岸场景，画面显示玩家角色、小地图和活动提示'],
    ],
    guideTitle: '在线试玩与本地运行',
    guideSummary: '用电脑浏览器打开试玩链接即可进房。以下也提供经典校园漫游的本地运行步骤。',
    sections: {
      online: ['加入《湖畔信标》', '在支持 WebGL 2 的桌面浏览器打开链接，点击「进入沙盒」。把同一个链接发给同学，大家会进入 LAKESIDE 房间。WASD 移动或开车，E 上下车和互动，Esc 释放鼠标。'],
      install: ['下载并启动经典漫游', '准备 Node.js 22。在第一个终端运行以下命令，Next.js 会在本机 3107 端口提供游戏页面和像素校园。'],
      room: ['启动多人房间', '在同一仓库目录另开一个终端。房间服务使用 3108 端口，在同一地址提供网页和 WebSocket。'],
      play: ['进入校园', '打开本机游戏并点击「进入校园」。WASD 行走，鼠标转头，E 在提示点互动，Esc 释放鼠标。'],
      multiplayer: ['和同学一起打卡', '在另一个独立窗口打开同一个房间链接。可用「切换房间」填写不同的显示名，也可复制链接给能访问同一游戏服务的同学。同房最多六人，短暂掉线可恢复，重启房间服务会清空当前的房间进度。'],
      troubleshooting: ['检查运行状态', '页面打不开时，先确认两个终端都在运行。在线房间需要从 3108 端口进入。从 Next.js 入口打开时，可用「校园互见」与同校区的像素校园玩家同步位置。'],
      about: ['关于地图和官网', '地图依据 OpenStreetMap 数据和人工校准生成，画面由游戏实时渲染。官网由 Cloudflare Pages 托管，公开试玩的房间运行在 Cloudflare Workers。'],
    },
    openGame: '打开本机游戏',
    footer: '非官方校园游戏项目',
  },
  en: {
    language: 'English', name: 'Gaoxin Campus Walk', home: 'Overview', guide: 'Setup',
    skip: 'Skip to content', nav: 'Main navigation', languageNav: 'Language selector', contents: 'On this page', repoLabel: 'GitHub source',
    place: 'University of Science and Technology of China · Hefei',
    title: ['USTC Gaoxin Campus', 'Lakeside Beacon'],
    summary: 'Drive out of the south gate garage, make deliveries around Yonghuai Lake, or race classmates for the beacon in the brick plaza. Share the playtest link to meet in one public room.',
    playOnline: 'Play Lakeside Beacon', start: 'Local setup guide', homeMore: 'View screenshots',
    heroAlt: 'In-game view across Yonghuai Lake to the Library and Education Center tower and its brick base.',
    heroCaption: 'In game · Library and Education Center from Yonghuai Lake',
    facts: [['Third person', 'WASD to walk and drive'], ['Up to 20 players', 'Shared room and live events'], ['Guest access', 'Desktop keyboard and mouse']],
    explore: 'From the courtyard to the lake',
    features: [
      ['lake', 'Looking out over Yonghuai Lake', 'The lake reflects campus buildings and trees. Sunlight, window frames and paving give each area a different character.', 'Ripples on Yonghuai Lake reflect the buildings on the far shore'],
      ['sandbox', 'Race for the beacon', 'Carry the beacon to either drop-off. Solo players can also make timed deliveries or compete with NPC guards for the beacon.', 'A player by the lake with the minimap and event prompts on screen'],
    ],
    guideTitle: 'Online playtest and local setup',
    guideSummary: 'Open the playtest link in a desktop browser to join. You can also follow the local steps below to run the classic campus walk.',
    sections: {
      online: ['Join Lakeside Beacon', 'Open the link in a desktop browser with WebGL 2 and click 进入沙盒 to enter. Send classmates the same link to meet in LAKESIDE. Use WASD to move and drive, E to enter or leave vehicles and interact, and Esc to release the pointer.'],
      install: ['Clone and start the classic campus walk', 'Install Node.js 22 and run these commands in the first terminal. Next.js serves the game and the pixel campus on local port 3107.'],
      room: ['Start the multiplayer service', 'Open a second terminal in the same repository directory. The room service serves the page and the WebSocket connection together on port 3108.'],
      play: ['Enter the campus', 'Open the local game and click 进入校园. Use WASD to walk, the mouse to look, E to interact at a prompt and Esc to release the pointer.'],
      multiplayer: ['Check in with classmates', 'Open the same room link in another independent browser window. Choose a different display name using 切换房间. You can share the link with classmates who can reach the same game server. Rooms hold six players. Brief disconnects can be recovered. Restarting the room service clears room progress.'],
      troubleshooting: ['Check the services', 'If the page will not open, make sure both terminals are still running. Use port 3108 for live rooms. When opened through Next.js, 校园互见 syncs positions with players on the same pixel campus.'],
      about: ['About the map and website', 'The map uses OpenStreetMap data and manual adjustments. The screenshots come from the real-time game. Cloudflare Pages hosts this website, and Cloudflare Workers hosts the public playtest rooms.'],
    },
    openGame: 'Open the local game',
    footer: 'Unofficial campus game project',
  },
};
