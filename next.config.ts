import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    webpack: (config, { dev }) => {
        if (dev) {
            // Next.js 16.1.6 (webpack 5.98.0) has a dev-mode bug where pdfjs-dist v5's
            // pdf.mjs (which declares a top-level `var __webpack_exports__ = {}`) breaks
            // inside Next's eval()-based source map wrapper, throwing
            // "Object.defineProperty called on non-object" on import. The webpack fix
            // landed in 5.103.0, which Next doesn't bundle yet. Workaround: stop using
            // eval()-wrapped modules for dev bundles (loses dev source maps).
            config.devtool = false;
            config.plugins = config.plugins.filter(
                (plugin) => plugin?.constructor?.name !== 'EvalSourceMapDevToolPlugin'
            );
        }
        return config;
    },
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
