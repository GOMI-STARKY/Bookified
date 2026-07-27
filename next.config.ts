import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    experimental: {
        proxyClientMaxBodySize: '100mb',
        serverActions: {
            bodySizeLimit: '100mb',
        }
    },
    images: { remotePatterns: [
            { protocol: 'https', hostname: 'covers.openlibrary.org' },
            { protocol: 'https', hostname: '*.blob.vercel-storage.com' },
        ]}
};

export default nextConfig;
