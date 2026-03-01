import { Html, Head, Main, NextScript } from "next/document";

export default function Document(props) {
  return (
    <Html lang="ru">
      <Head>
        <style>{`
          .mobile {
            display: none;
          }
          @media (max-width: 900px) {
            body:not([data-pathname^="/tools"]):not([data-pathname^="/prep-session"]):not([data-pathname^="/results"]) .desktop {
              display: none;
            }
            body:not([data-pathname^="/tools"]):not([data-pathname^="/prep-session"]):not([data-pathname^="/results"]) .mobile {
              display: flex;
              padding: 40px;
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
          }}
        ></script>

        {/* noscript для Яндекс.Метрики */}
        <noscript>
          <div>
            <img
              src="https://mc.yandex.ru/watch/106306672"
              style={{ position: "absolute", left: "-9999px" }}
              alt=""
            />
          </div>
        </noscript>
      </Head>

      <body data-pathname={props.__NEXT_DATA__?.page || ""}>
        <div className="desktop">
          <Main />
          <NextScript />
        </div>
        <div className="mobile flex flex-col w-full h-screen justify-center items-center gap-[8px]">
          <h3 className="w-full text-center">Упс...</h3>
          <p className="w-full text-center">
            Мобильная версия пока недоступна. Используйте ПК для сайта, но
            инструменты МАЯК ОКО и тренажер доступны.
          </p>
        </div>
      </body>
    </Html>
  );
}