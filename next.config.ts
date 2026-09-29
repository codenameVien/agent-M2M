import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // mongodb 드라이버는 서버에서만 쓰므로 번들에 넣지 않고 그대로 불러온다.
  serverExternalPackages: ["mongodb"],
};

export default nextConfig;
