import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 部署用 standalone 产物（node .next/standalone/server.js），本地 next start 也可用
  output: "standalone",
  // better-sqlite3 是原生模块，不打包进 server bundle（需要随环境安装）
  serverExternalPackages: ["better-sqlite3"],
  outputFileTracingIncludes: {
    "/gaoxin-3d/vendor/*": [
      "./node_modules/three/build/three.module.js",
      "./node_modules/three/build/three.core.js",
      "./node_modules/three/examples/jsm/objects/Reflector.js",
    ],
  },
  poweredByHeader: false,
  async headers() {
    return [{
      source: "/:path*",
      headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "SAMEORIGIN" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      ],
    }];
  },
};

export default nextConfig;
