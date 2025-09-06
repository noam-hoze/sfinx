/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: false,
    experimental: {
        typedRoutes: true,
        serverActions: {
            allowedOrigins: ["localhost:3000"],
        },
    },
};

module.exports = nextConfig;
