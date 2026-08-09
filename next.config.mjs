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

    // Растры набора МАЯКа — статика, которая меняется только вместе с печатным набором,
    // а сцена /mayak-guide-3d тянет их больше сотни за заход. По умолчанию Next отдаёт
    // public/ с max-age=0, то есть каждый повторный вход перепроверяет каждый файл
    // отдельным запросом, и по HTTP/1.1 эти сто запросов идут в шесть соединений.
    // Неделя кэша с фоновым обновлением: правим набор — растр приезжает к следующему дню.
    // Дорожка озвучки версионируется в имени (?v=N), ей длинный кэш безопасен.
    async headers() {
        return [
            {
                source: "/mayak-guide/:path*",
                headers: [{ key: "Cache-Control", value: "public, max-age=604800, stale-while-revalidate=2592000" }],
            },
        ];
    },

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
