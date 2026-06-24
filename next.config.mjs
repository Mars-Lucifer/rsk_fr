/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: false,
    devIndicators: false,

    serverExternalPackages: ['@react-pdf/renderer', '@react-pdf/layout', '@react-pdf/pdfkit', '@react-pdf/font', 'pdf-to-img', 'pdfjs-dist', '@napi-rs/canvas'],
    webpack(config) {
        config.module.rules.push({
            test: /\.svg$/,
            issuer: /\.[jt]sx?$/,
            use: ["@svgr/webpack"],
        });
        return config;
    },
};

export default nextConfig;
