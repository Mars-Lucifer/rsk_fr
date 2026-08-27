/**
 * Карточка организации переехала в общий раздел «Организации».
 * Ключ прежний — ИНН, поэтому адрес переводится один в один.
 */
export async function getServerSideProps({ params }) {
    return {
        redirect: {
            destination: `/organizations/${String(params.inn)}`,
            permanent: true,
        },
    };
}

export default function EduCardRedirect() {
    return null;
}
