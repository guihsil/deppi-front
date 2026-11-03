import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  experimental: {
    authInterrupts: true,
    agentUpgrade: "security",
  },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async rewrites() {
    const configuredUrl = process.env.API_BASE_URL;
    if (!configuredUrl) {
      throw new Error("A variável de ambiente API_BASE_URL não está configurada.");
    }

    let backendUrl: URL;
    try {
      backendUrl = new URL(configuredUrl);
    } catch {
      throw new Error("A variável API_BASE_URL deve conter uma URL absoluta válida.");
    }

    if (
      (backendUrl.protocol !== "http:" && backendUrl.protocol !== "https:") ||
      backendUrl.search ||
      backendUrl.hash
    ) {
      throw new Error("A variável API_BASE_URL deve ser uma URL HTTP(S) sem query ou fragmento.");
    }

    const basePath = backendUrl.pathname.replace(/\/+$/, "");
    return [
      {
        source: "/backend/:path*",
        destination: `${backendUrl.origin}${basePath}/:path*`,
      },
    ];
  },
};

export default nextConfig;
