/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: false,
    devIndicators: false,

    // Корень проекта — эта папка, а не то, что Next угадает по лок-файлам.
    // В рабочих копиях под .worktrees/ он находит лок-файл родительского репозитория,
    // объявляет корнем его и начинает резолвить react-dom из ../../node_modules,
    // пока сам react берётся отсюда. Две половины React из разных деревьев дают
    // «Invalid hook call» в любом компоненте со своим рендерером (three, r3f).
    outputFileTracingRoot: import.meta.dirname,

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
