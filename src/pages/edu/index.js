/**
 * Справочник переехал в общий раздел «Организации».
 *
 * Страница не удалена, а оставлена редиректом: адрес /edu успел разойтись по
 * переписке, пока раздел был отдельным. Постоянный редирект — чтобы поисковики
 * и закладки перешли на новый адрес сами.
 */
export async function getServerSideProps({ query }) {
    const params = new URLSearchParams(query).toString();

    return {
        redirect: {
            destination: params ? `/organizations?${params}` : "/organizations",
            permanent: true,
        },
    };
}

export default function EduRedirect() {
    return null;
}
