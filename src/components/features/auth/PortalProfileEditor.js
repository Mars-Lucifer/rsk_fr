import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input/Input";
import Textarea from "@/components/ui/Textarea";
import DropdownInput from "@/components/ui/Input/DropdownInput";
import Switcher from "@/components/ui/Switcher";
import { getPortalOrganizationId, getPortalOrganizationLabel } from "@/lib/portalProfile";
import StudentIcon from "@/assets/general/cours_les.svg";
import StaffIcon from "@/assets/general/persons.svg";
import OrganizationPicker from "@/components/features/auth/OrganizationPicker";
import { primePortalProfileCache } from "@/lib/portalProfileClient";
import { removeCookie, setCookie } from "@/utils/cookies";

function getProfileData(profilePayload) {
    if (profilePayload && typeof profilePayload === "object" && profilePayload.data && typeof profilePayload.data === "object") {
        return profilePayload.data;
    }
    return profilePayload && typeof profilePayload === "object" ? profilePayload : {};
}

function buildInitialFormState(profilePayload) {
    const data = getProfileData(profilePayload);
    return {
        Organization: getPortalOrganizationId(data),
        Region: String(data.Region || "").trim(),
        Surname: String(data.Surname || "").trim(),
        NameIRL: String(data.NameIRL || "").trim(),
        Patronymic: String(data.Patronymic || "").trim(),
        Description: String(data.Description || "").trim(),
        role: String(data.role || data.Type || "student").trim() || "student",
    };
}

// Подпись над полем: в макете у каждого поля есть название, а плейсхолдер
// исчезает при вводе и перестаёт объяснять, что именно заполнено.
function Field({ label, children }) {
    return (
        <label className="flex flex-col gap-[0.375rem]">
            <span className="text-sm" style={{ color: "var(--color-gray-black)" }}>
                {label}
            </span>
            {children}
        </label>
    );
}

// Тип профиля карточками, а не переключателем: у каждого варианта есть
// пояснение, и промахнуться сложнее.
function RoleCard({ value, current, onSelect, title, Icon, iconViewBox, disabled = false }) {
    const isActive = current === value;
    return (
        <button
            type="button"
            disabled={disabled}
            onClick={() => onSelect(value)}
            // justify-start! перебивает глобальное правило для button
            // (justify-content: center): из-за него иконки двух карточек стояли
            // на разной вертикали — блок съезжал вслед за длиной подписи.
            className="flex items-center justify-start! gap-[0.75rem] p-[1rem]! rounded-[0.75rem] text-left transition"
            style={{
                border: `1.5px solid ${isActive ? "var(--color-blue)" : "var(--color-gray-plus-50)"}`,
                background: isActive ? "var(--color-blue-noise)" : "transparent",
                cursor: disabled ? "default" : "pointer",
                opacity: disabled && !isActive ? 0.55 : 1,
            }}>
            {/* viewBox задаём руками: svgr прогоняет иконки через svgo, тот по
                умолчанию вырезает viewBox, и растянутый до 1.5rem svg рисует
                содержимое в исходном масштабе (16 и 14 px) в углу бокса —
                иконки выходят разного размера и не по центру. */}
            {Icon ? (
                <span className="flex items-center justify-center shrink-0" style={{ width: "1.5rem", height: "1.5rem", color: isActive ? "var(--color-blue)" : "var(--color-gray-white)" }}>
                    <Icon viewBox={iconViewBox} preserveAspectRatio="xMidYMid meet" style={{ width: "100%", height: "100%", display: "block" }} />
                </span>
            ) : null}
            {/* Цвет задаём явно: у неактивной карточки текст сливался с фоном. */}
            <span className="big" style={{ fontWeight: 600, color: "var(--color-black)" }}>
                {title}
            </span>
        </button>
    );
}

export default function PortalProfileEditor({
    mode = "gate",
    profilePayload,
    onSaved,
    submitLabel = "Сохранить",
    title = "",
    description = "",
    showDescription = false,
    showRole = false,
    readOnly = false,
    headerSlot = null,
}) {
    const initialState = useMemo(() => buildInitialFormState(profilePayload), [profilePayload]);
    const profileData = getProfileData(profilePayload);
    const organizationLabel = getPortalOrganizationLabel(profilePayload) || "";

    const [formData, setFormData] = useState(initialState);
    const [region, setRegion] = useState(initialState.Region);
    const [role, setRole] = useState(initialState.role);
    // Выбранная организация целиком, а не только id: после сохранения нужно
    // показать её название, не ходя за ним ещё раз.
    const currentOrgOption = useMemo(() => {
        const id = getPortalOrganizationId(profilePayload);
        const label = getPortalOrganizationLabel(profilePayload);
        return id && label ? { id: String(id), short_name: label } : null;
    }, [profilePayload]);
    const [selectedOrg, setSelectedOrg] = useState(currentOrgOption);
    const [isSaving, setIsSaving] = useState(false);
    const [orgFieldTyped, setOrgFieldTyped] = useState(false);
    const selectedOrganizationLabel = selectedOrg?.short_name || selectedOrg?.full_name || organizationLabel;

    useEffect(() => {
        setFormData(initialState);
        setRegion(initialState.Region);
        setRole(initialState.role);
        setOrgFieldTyped(false);
        setSelectedOrg(currentOrgOption);
    }, [initialState, currentOrgOption]);

    const isDirty = useMemo(() => {
        return (
            orgFieldTyped ||
            String(formData.Organization || "") !== String(initialState.Organization || "") ||
            String(formData.Region || "") !== String(initialState.Region || "") ||
            String(formData.Surname || "") !== String(initialState.Surname || "") ||
            String(formData.NameIRL || "") !== String(initialState.NameIRL || "") ||
            String(formData.Patronymic || "") !== String(initialState.Patronymic || "") ||
            String(formData.Description || "") !== String(initialState.Description || "") ||
            String(role || "") !== String(initialState.role || "")
        );
    }, [formData, initialState, orgFieldTyped, role]);

    const updateField = (name, value) => {
        setFormData((prev) => ({
            ...prev,
            [name]: value,
        }));
    };

    const handleSubmit = async () => {
        // Организация теперь только выбирается из выдачи поиска, руками её
        // не вписать — значит и «дожимать» набранный текст перед отправкой
        // больше нечего.
        const organizationField = formData.Organization;

        const orgStrRequired = String(organizationField ?? "").trim();
        if (!formData.Surname?.trim() || !formData.NameIRL?.trim() || !orgStrRequired) {
            alert("Для входа в MAYAK заполните фамилию, имя и организацию.");
            return;
        }

        const changes = {};
        if (profileData.id) {
            changes.id = profileData.id;
        }

        if (String(formData.Surname || "") !== String(initialState.Surname || "")) {
            changes.Surname = formData.Surname;
        }
        if (String(formData.NameIRL || "") !== String(initialState.NameIRL || "")) {
            changes.NameIRL = formData.NameIRL;
        }
        if (String(formData.Patronymic || "") !== String(initialState.Patronymic || "")) {
            changes.Patronymic = formData.Patronymic;
        }
        if (String(formData.Description || "") !== String(initialState.Description || "")) {
            changes.Description = formData.Description;
        }
        if (String(formData.Region || "") !== String(initialState.Region || "")) {
            changes.Region = formData.Region;
        }
        if (String(organizationField ?? "") !== String(initialState.Organization ?? "")) {
            const orgIdRaw = String(organizationField ?? "").trim();
            const orgIdNum = Number.parseInt(orgIdRaw, 10);
            if (!Number.isFinite(orgIdNum) || orgIdNum < 1) {
                alert("Укажите организацию из списка или числовой ID существующей организации.");
                return;
            }
            changes.Organization_id = orgIdNum;
        }
        if (showRole && String(role || "") !== String(initialState.role || "")) {
            changes.role = role;
        }

        if (Object.keys(changes).length === 0) {
            if (typeof onSaved === "function") {
                onSaved(profilePayload);
            }
            return;
        }

        const orgChanged = String(organizationField ?? "") !== String(initialState.Organization ?? "");
        const orgIdRaw = String(organizationField ?? "").trim();
        const orgIdNum = Number.parseInt(orgIdRaw, 10);
        let selectedOrganization =
            orgChanged && Number.isFinite(orgIdNum) && orgIdNum >= 1 && String(selectedOrg?.id ?? "") === String(orgIdNum)
                ? selectedOrg
                : null;
        if (
            orgChanged &&
            selectedOrganization == null &&
            Number.isFinite(orgIdNum) &&
            orgIdNum >= 1
        ) {
            try {
                const verifyRes = await fetch(`/api/org/${orgIdNum}`, { credentials: "include" });
                const verifyPayload = await verifyRes.json().catch(() => ({}));
                if (!verifyRes.ok || !verifyPayload.success) {
                    alert("Организации с таким ID нет. Проверьте номер или выберите организацию из списка.");
                    return;
                }
                selectedOrganization = verifyPayload.data;
            } catch {
                alert("Не удалось проверить организацию. Попробуйте ещё раз.");
                return;
            }
        }

        setIsSaving(true);
        try {
            const response = await fetch("/api/profile/update", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(changes),
                credentials: "include",
            });
            const payload = await response.json().catch(() => ({}));

            if (!response.ok) {
                alert(payload?.error || "Не удалось сохранить профиль.");
                return;
            }

            const nextData = {
                ...profileData,
                Surname: formData.Surname,
                NameIRL: formData.NameIRL,
                Patronymic: formData.Patronymic,
                Description: formData.Description,
                Region: formData.Region,
                role,
                Type: role,
                ...(orgChanged && Number.isFinite(orgIdNum) && orgIdNum >= 1
                    ? {
                          organization_id: orgIdNum,
                          Organization_id: orgIdNum,
                          Organization: {
                              ...(profileData.Organization || {}),
                              ...(selectedOrganization || {}),
                              id: selectedOrganization?.id ?? selectedOrganization?.organization_id ?? orgIdNum,
                              short_name:
                                  selectedOrganization?.short_name ||
                                  selectedOrganization?.name ||
                                  profileData?.Organization?.short_name ||
                                  "",
                          },
                      }
                    : {}),
            };

            primePortalProfileCache({ success: true, data: nextData });

            const orgCookieId = getPortalOrganizationId(nextData);
            if (orgCookieId) {
                setCookie("organization", orgCookieId);
            } else {
                removeCookie("organization");
            }

            setOrgFieldTyped(false);

            if (typeof onSaved === "function") {
                onSaved({ success: true, data: nextData });
            }
        } catch (error) {
            console.error("Failed to update portal profile:", error);
            alert("Ошибка соединения. Попробуйте еще раз.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleOrganizationSelected = (org) => {
        const id = org?.id ?? org?.organization_id;
        if (!id) return;

        setSelectedOrg({ ...org, id: String(id) });
        updateField("Organization", String(id));
        setOrgFieldTyped(true);
    };

    const content = (
        <>
            {/* Раскладка в две колонки: слева кто участник, справа откуда он.
                Раньше всё шло одной узкой лентой, и на широком экране форма
                занимала треть ширины, а поиск организации терялся между полями. */}
            <div className="flex flex-col gap-[1.25rem] p-[1.5rem] rounded-[1rem] max-[640px]:p-[1rem]" style={{ background: "var(--color-white)", border: "1.5px solid var(--color-gray-plus-50)" }}>
                <div className="flex items-center justify-between gap-[1rem]">
                    <h5>{title || "Профиль"}</h5>
                    {headerSlot}
                </div>
                {description ? (
                    <p className="text-sm" style={{ color: "var(--color-gray-black)" }}>
                        {description}
                    </p>
                ) : null}

                <div className="grid grid-cols-2 gap-[1.25rem] items-start max-[900px]:grid-cols-1">
                    {/* Левая колонка — человек */}
                    <div className="flex flex-col gap-[0.75rem]">
                        <Field label="Фамилия">
                            <Input type="text" name="Surname" placeholder="Введите фамилию" value={formData.Surname} onChange={(event) => updateField("Surname", event.target.value)} disabled={readOnly} required />
                        </Field>
                        <Field label="Имя">
                            <Input type="text" name="NameIRL" placeholder="Введите имя" value={formData.NameIRL} onChange={(event) => updateField("NameIRL", event.target.value)} disabled={readOnly} required />
                        </Field>
                        <Field label="Отчество">
                            <Input type="text" name="Patronymic" placeholder="Введите отчество" value={formData.Patronymic} onChange={(event) => updateField("Patronymic", event.target.value)} disabled={readOnly} />
                        </Field>

                        {showDescription ? (
                            <Field label="О себе">
                                <Textarea inverted name="Description" placeholder="Краткое описание поможет другим участникам лучше вас узнать" value={formData.Description} onChange={(event) => updateField("Description", event.target.value)} disabled={readOnly} />
                            </Field>
                        ) : null}

                        {showRole ? (
                            <div className="flex flex-col gap-[0.5rem]">
                                <span className="text-sm" style={{ color: "var(--color-gray-black)" }}>
                                    Тип профиля
                                </span>
                                <div className="grid grid-cols-2 gap-[0.75rem] max-[640px]:grid-cols-1">
                                    <RoleCard value="student" current={role} onSelect={setRole} title="Студент" Icon={StudentIcon} iconViewBox="0 0 16 16" disabled={readOnly} />
                                    <RoleCard value="teacher" current={role} onSelect={setRole} title="Сотрудник" Icon={StaffIcon} iconViewBox="0 0 14 14" disabled={readOnly} />
                                </div>
                            </div>
                        ) : null}
                    </div>

                    {/* Правая колонка — организация целиком: где человек учится
                        или работает, и всё, чем это меняют. Раньше поле
                        «Организация» стояло слева, а искали её справа — две
                        половины одного действия в разных углах формы. */}
                    <div className="flex flex-col gap-[1.25rem]">
                        <div className="flex flex-col gap-[0.75rem]">
                            <h6>Организация</h6>

                            <Field label="Регион">
                                <DropdownInput
                                    id="Region"
                                    name="Region"
                                    placeholder="Выберите регион"
                                    value={region}
                                    onChange={(event) => {
                                        const nextRegion = event.target.value || "";
                                        setRegion(nextRegion);
                                        setFormData((prev) => ({
                                            ...prev,
                                            Region: nextRegion,
                                            Organization: "",
                                        }));
                                    }}
                                    src="/data/regions.txt"
                                    disabled={readOnly}
                                />
                            </Field>

                            {/* В просмотре берём название прямо из профиля:
                                поиск ищет по базе и реестру, а показать нужно
                                то, что уже сохранено. */}
                            {readOnly ? (
                                <Field label="Организация">
                                    <Input type="text" name="OrganizationLabel" value={organizationLabel} placeholder="Не указана" disabled readOnly />
                                </Field>
                            ) : (
                                <>
                                    <Field label="Организация">
                                        {/* Регион только сужает выдачу, искать можно и без него.
                                            Пока поле блокировалось до выбора региона, участник с
                                            пустым регионом упирался в мёртвое поле: организация
                                            в профиле не показана и выбрать её нечем. */}
                                        <OrganizationPicker region={region} valueLabel={selectedOrganizationLabel} onSelected={handleOrganizationSelected} />
                                    </Field>

                                    <p className="text-sm" style={{ color: "var(--color-gray-black)" }}>
                                        Если организации нет нигде, заполните{" "}
                                        <Link target="_blank" className="text-(--color-blue)" href="https://forms.yandex.ru/u/690391e1068ff0a3ba625eef">
                                            форму
                                        </Link>
                                        .
                                    </p>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                {readOnly ? null : (
                    <div className="flex items-center gap-[1rem] pt-[0.25rem] max-[640px]:flex-col max-[640px]:items-stretch">
                        <Button className="w-fit! max-[640px]:w-full!" onClick={handleSubmit} disabled={isSaving || !isDirty}>
                            {isSaving ? "Сохранение..." : submitLabel}
                        </Button>
                    </div>
                )}
            </div>
        </>
    );

    if (mode === "full") {
        // `.hero` — сетка из 12 колонок, и без col-span-12 карточка занимает
        // одну колонку: форма сжимается в узкую ленту, а поля наезжают друг
        // на друга. Tailwind-класс grid-cols-1 здесь не помогает — правило
        // из spacing.css перебивает его.
        return (
            <div className="hero">
                <div className="col-span-12">{content}</div>
            </div>
        );
    }

    return <div className="flex flex-col gap-[1rem] w-full">{content}</div>;
}
