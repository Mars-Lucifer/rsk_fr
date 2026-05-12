export async function getServerSideProps() {
    return {
        redirect: {
            destination: "/admin/mayak-tokens?type=session",
            permanent: false,
        },
    };
}

export default function AdminMayakSessionsRedirect() {
    return null;
}
