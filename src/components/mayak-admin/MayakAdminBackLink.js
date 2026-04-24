import Link from "next/link";

export default function MayakAdminBackLink({ href = "/admin?view=sections", label = "Назад в админку МАЯК", className = "", onClick }) {
    return (
        <Link
            href={href}
            onClick={onClick}
            className={`inline-flex w-auto items-center justify-center rounded-[1rem] border border-(--color-gray-plus-50) bg-white px-4 py-3 text-sm font-semibold text-(--color-black) transition hover:border-(--color-main) hover:text-(--color-main) ${className}`.trim()}>
            {label}
        </Link>
    );
}
