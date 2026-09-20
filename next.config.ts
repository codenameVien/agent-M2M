import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // better-sqlite3는 네이티브 모듈이라 번들에 넣지 않고 그대로 불러온다.
  serverExternalPackages: ["better-sqlite3"],
};

export default nextConfig;
