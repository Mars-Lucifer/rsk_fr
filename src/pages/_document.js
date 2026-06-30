import { Html, Head, Main, NextScript } from "next/document";

export default function Document(props) {
    return (
        <Html lang="ru">
            <Head>
                <style>{`
          /* Можно оставить стили, если нужны адаптивные правки для desktop */
          @media (max-width: 900px) {
            body:not([data-pathname^="/tools"]):not([data-pathname^="/results"]) .desktop {
              display: block;
            }
          }
        `}</style>

                {/* Скрипт Яндекс.Метрики */}
                <script
                    dangerouslySetInnerHTML={{
                        __html: `(function(m,e,t,r,i,k,a){
                m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};
                m[i].l=1*new Date();
                for (var j = 0; j < document.scripts.length; j++) {
                    if (document.scripts[j].src === r) { return; }
                }
                k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a);
            })(window, document,'script','https://mc.yandex.ru/metrika/tag.js?id=106306672', 'ym');

            ym(106306672, 'init', {
                ssr:true,
                webvisor:true,
                clickmap:true,
                ecommerce:"dataLayer",
                accurateTrackBounce:true,
                trackLinks:true
            });`,
                    }}></script>

                {/* noscript для Яндекс.Метрики */}
                <noscript>
                    <div>
                        <img src="https://mc.yandex.ru/watch/106306672" style={{ position: "absolute", left: "-9999px" }} alt="" />
                    </div>
                </noscript>
            </Head>

            <body data-pathname={props.__NEXT_DATA__?.page || ""}>
                <div className="desktop w-full">
                    <Main />
                    <NextScript />
                </div>
            </body>
        </Html>
    );
}
