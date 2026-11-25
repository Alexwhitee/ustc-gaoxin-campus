export const repository = 'https://github.com/Alexwhitee/ustc-gaoxin-campus';

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
    title: ['中科大高新校区', '第一人称漫游'],
    summary: '从图书教育中心出发，沿永怀湖走一圈。用键盘和鼠标探索校园，也可以邀请同学加入实时房间，一起完成打卡。',
    start: '本地运行指南', homeMore: '查看画面',
    heroAlt: '游戏实拍。永怀湖对岸的图书教育中心塔楼、红砖裙楼与湖中倒影。',
    heroCaption: '游戏实拍 · 永怀湖畔的图书教育中心',
    facts: [['第一人称', 'WASD 行走，鼠标转头'], ['最多 6 人', '同房互见与任务同步'], ['31 座建筑', '从图教中心到宿舍与运动区']],
    explore: '从广场走到永怀湖',
    features: [
      ['lake', '镜头里的永怀湖', '水面会反射楼群与树木。阳光、窗框和铺装让校园各片区有自己的质感。', '永怀湖的水面波纹和对岸建筑倒影'],
      ['room', '与同学在广场集合', '加入同一房间就能看到对方的角色和名字。按 E 完成图教中心与永怀湖的打卡，进度同步给全房。', '图教中心广场上，另一位玩家的角色和昵称显示在画面中'],
    ],
    guideTitle: '在本机运行校园漫游',
    guideSummary: '准备 Node.js 22 和支持 WebGL 2 的桌面浏览器。第一次启动会自动创建本地 SQLite 数据库。',
    sections: {
      install: ['下载并启动应用', '在第一个终端运行以下命令。Next.js 在本机 3107 端口启动，提供游戏页面和像素校园。'],
      room: ['启动多人房间', '在同一仓库目录另开一个终端。房间服务使用 3108 端口，在同一地址提供网页和 WebSocket。'],
      play: ['进入校园', '打开本机游戏并点击「进入校园」。WASD 行走，鼠标转头，E 在提示点互动，Esc 释放鼠标。'],
      multiplayer: ['和同学一起打卡', '在另一个独立窗口打开同一个房间链接。可用「切换房间」填写不同的显示名，也可复制链接给能访问同一游戏服务的同学。同房最多六人，短暂掉线可恢复，重启房间服务会清空当前的房间进度。'],
      troubleshooting: ['检查运行状态', '页面打不开时，先确认两个终端都在运行。在线房间需要从 3108 端口进入。从 Next.js 入口打开时，可用「校园互见」与同校区的像素校园玩家同步位置。'],
      about: ['关于地图和官网', '地图依据 OpenStreetMap 数据和人工校准生成，画面由游戏实时渲染。本介绍站展示实拍和运行说明，公开的 Pages 地址仅托管这些静态内容。'],
    },
    openGame: '打开本机游戏',
    footer: '非官方校园游戏项目',
  },
  en: {
    language: 'English', name: 'Gaoxin Campus Walk', home: 'Overview', guide: 'Setup',
    skip: 'Skip to content', nav: 'Main navigation', languageNav: 'Language selector', contents: 'On this page', repoLabel: 'GitHub source',
    place: 'University of Science and Technology of China · Hefei',
    title: ['USTC Gaoxin Campus', 'A first-person walk'],
    summary: 'Set out from the Library and Education Center and follow the shore of Yonghuai Lake. Explore with a keyboard and mouse, or invite classmates to a live room and check in together.',
    start: 'Local setup guide', homeMore: 'View screenshots',
    heroAlt: 'In-game view across Yonghuai Lake to the Library and Education Center tower and its brick base.',
    heroCaption: 'In game · Library and Education Center from Yonghuai Lake',
    facts: [['First person', 'WASD to walk, mouse to look'], ['Up to 6 players', 'Live rooms and shared check-ins'], ['31 buildings', 'Library, residence halls and sports areas']],
    explore: 'From the courtyard to the lake',
    features: [
      ['lake', 'Looking out over Yonghuai Lake', 'The lake reflects campus buildings and trees. Sunlight, window frames and paving give each area a different character.', 'Ripples on Yonghuai Lake reflect the buildings on the far shore'],
      ['room', 'Meet classmates in the courtyard', 'Join the same room to see each other’s character and name. Press E to check in at the center and the lake. The whole room shares the progress.', 'Another player and their name appear in the library courtyard'],
    ],
    guideTitle: 'Run the campus walk locally',
    guideSummary: 'Use Node.js 22 and a desktop browser with WebGL 2. The app creates a local SQLite database on first launch.',
    sections: {
      install: ['Clone and start the app', 'Run these commands in the first terminal. Next.js serves the game and the pixel campus on local port 3107.'],
      room: ['Start the multiplayer service', 'Open a second terminal in the same repository directory. The room service serves the page and the WebSocket connection together on port 3108.'],
      play: ['Enter the campus', 'Open the local game and click 进入校园. Use WASD to walk, the mouse to look, E to interact at a prompt and Esc to release the pointer.'],
      multiplayer: ['Check in with classmates', 'Open the same room link in another independent browser window. Choose a different display name using 切换房间. You can share the link with classmates who can reach the same game server. Rooms hold six players. Brief disconnects can be recovered. Restarting the room service clears room progress.'],
      troubleshooting: ['Check the services', 'If the page will not open, make sure both terminals are still running. Use port 3108 for live rooms. When opened through Next.js, 校园互见 syncs positions with players on the same pixel campus.'],
      about: ['About the map and website', 'The map uses OpenStreetMap data and manual adjustments. The screenshots come from the real-time game. The public Pages site serves project information and setup instructions.'],
    },
    openGame: 'Open the local game',
    footer: 'Unofficial campus game project',
  },
};
