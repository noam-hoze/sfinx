/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: false,
    experimental: {
        typedRoutes: true,
        serverActions: {
            allowedOrigins: ["localhost:3000"],
        },
    },
    images: {
        domains: ["i.pravatar.cc"],
    },
};

module.exports = nextConfig;
