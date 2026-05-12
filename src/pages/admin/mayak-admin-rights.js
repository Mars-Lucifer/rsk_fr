export async function getServerSideProps() {
    return {
        redirect: {
            destination: "/admin/mayak-tokens?type=external_link",
            permanent: false,
        },
    };
}

export default function AdminMayakAdminRightsRedirect() {
    return null;
}
