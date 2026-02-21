/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: false,
    logging: {
        fetches: {
            fullUrl: false,
        },
    },
    // TODO: [Bug] ignoreDuringBuilds disables ESLint checks in CI; re-enable to catch lint regressions before deployment
    eslint: {
        ignoreDuringBuilds: true,
    },
    // TODO: [Bug] ignoreBuildErrors suppresses real TypeScript type errors from CI/CD; should be false in production to catch regressions at build time
    typescript: {
        ignoreBuildErrors: true,
    },
    experimental: {
        typedRoutes: true,
        serverActions: {
            allowedOrigins: ["localhost:3000"],
        },
    },
    images: {
        domains: ["i.pravatar.cc", "api.dicebear.com"],
        dangerouslyAllowSVG: true,
        contentDispositionType: "attachment",
        contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
        remotePatterns: [
            {
                protocol: "https",
                hostname: "lh3.googleusercontent.com",
            },
        ],
    },
};

module.exports = nextConfig;
