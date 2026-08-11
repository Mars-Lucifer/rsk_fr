import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";

import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input/Input";
import Textarea from "@/components/ui/Textarea";
import DropdownInput from "@/components/ui/Input/DropdownInput";
import Switcher from "@/components/ui/Switcher";
import { getPortalOrganizationId } from "@/lib/portalProfile";
import StudentIcon from "@/assets/general/cours_les.svg";
import StaffIcon from "@/assets/general/persons.svg";
import OrgRegistrySearch from "@/components/features/auth/OrgRegistrySearch";
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
function RoleCard({ value, current, onSelect, title, hint, Icon }) {
    const isActive = current === value;
    return (
        <button
            type="button"
            onClick={() => onSelect(value)}
            className="flex flex-col gap-[0.25rem] p-[0.875rem] rounded-[0.75rem] text-left transition"
            style={{
                border: `1.5px solid ${isActive ? "var(--color-blue)" : "var(--color-gray-plus-50)"}`,
                background: isActive ? "var(--color-blue-noise)" : "transparent",
            }}>
            <span className="flex items-center justify-between gap-[0.5rem] w-full">
                <span className="flex items-center gap-[0.5rem]">
                    {Icon ? <Icon style={{ width: "1.25rem", height: "1.25rem", color: isActive ? "var(--color-blue)" : "var(--color-gray-white)" }} /> : null}
                    {/* Цвет задаём явно: у неактивной карточки текст сливался с фоном. */}
                    <span className="big" style={{ fontWeight: 600, color: "var(--color-black)" }}>
                        {title}
                    </span>
                </span>
                <span
                    className="inline-block rounded-full"
                    style={{
                        width: "0.875rem",
                        height: "0.875rem",
                        border: `1.5px solid ${isActive ? "var(--color-blue)" : "var(--color-gray-white)"}`,
                        background: isActive ? "var(--color-blue)" : "transparent",
                    }}
                />
            </span>
            <span className="text-sm" style={{ color: "var(--color-gray-black)" }}>
                {hint}
            </span>
        </button>
    );
}

function resolveSelectedOrganization(orgList, organizationId) {
    return orgList.find((item) => String(item.id ?? item.organization_id ?? "") === String(organizationId || "")) || null;
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
}) {
    const initialState = useMemo(() => buildInitialFormState(profilePayload), [profilePayload]);
    const profileData = getProfileData(profilePayload);

    const [formData, setFormData] = useState(initialState);
    const [region, setRegion] = useState(initialState.Region);
    const [role, setRole] = useState(initialState.role);
    const [orgList, setOrgList] = useState([]);
    const [isSaving, setIsSaving] = useState(false);
    const [orgFieldTyped, setOrgFieldTyped] = useState(false);
    const orgDropdownRef = useRef(null);

    useEffect(() => {
        setFormData(initialState);
        setRegion(initialState.Region);
        setRole(initialState.role);
        setOrgFieldTyped(false);
    }, [initialState]);

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

    useEffect(() => {
        if (!region) {
            setOrgList([]);
            return undefined;
        }

        let cancelled = false;
        const loadOrganizations = async () => {
            try {
                const response = await fetch(`/api/org/all?region=${encodeURIComponent(region)}`, {
                    credentials: "include",
                });
                const payload = await response.json().catch(() => ({}));
                if (!cancelled) {
                    setOrgList(payload.success ? payload.data || [] : []);
                }
            } catch (error) {
                if (!cancelled) {
                    console.error("Failed to load organizations:", error);
                    setOrgList([]);
                }
            }
        };

        loadOrganizations();
        return () => {
            cancelled = true;
        };
    }, [region]);

    const updateField = (name, value) => {
        setFormData((prev) => ({
            ...prev,
            [name]: value,
        }));
    };

    const handleSubmit = async () => {
        let organizationField = formData.Organization;
        if (orgDropdownRef.current && typeof orgDropdownRef.current.commitPendingValue === "function") {
            const committed = orgDropdownRef.current.commitPendingValue();
            if (committed !== undefined && committed !== null) {
                organizationField = committed;
            }
        }

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
            orgChanged && Number.isFinite(orgIdNum) && orgIdNum >= 1
                ? resolveSelectedOrganization(orgList, orgIdNum)
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

            if (orgChanged && selectedOrganization == null && Number.isFinite(orgIdNum) && orgIdNum >= 1) {
                selectedOrganization = resolveSelectedOrganization(orgList, orgIdNum);
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

    const handleOrgFromRegistry = (org) => {
        const id = org?.id ?? org?.organization_id;
        if (!id) return;

        setOrgList((prev) => (prev.some((item) => String(item.id) === String(id)) ? prev : [...prev, org]));
        updateField("Organization", String(id));
        setOrgFieldTyped(true);
        // Регион берём из реестра: он обязателен для команды, а руками участник
        // впишет его иначе, чем в справочнике.
        if (org.region) {
            setRegion(org.region);
            setFormData((prev) => ({ ...prev, Region: org.region }));
        }
    };

    const content = (
        <>
            {/* Раскладка в две колонки: слева кто участник, справа откуда он.
                Раньше всё шло одной узкой лентой, и на широком экране форма
                занимала треть ширины, а поиск организации терялся между полями. */}
            <div className="flex flex-col gap-[1.25rem] p-[1.5rem] rounded-[1rem] max-[640px]:p-[1rem]" style={{ background: "var(--color-white)", border: "1.5px solid var(--color-gray-plus-50)" }}>
                <h5>{title || "Профиль"}</h5>
                {description ? (
                    <p className="text-sm" style={{ color: "var(--color-gray-black)" }}>
                        {description}
                    </p>
                ) : null}

                <div className="grid grid-cols-2 gap-[1.25rem] items-start max-[900px]:grid-cols-1">
                    {/* Левая колонка — человек */}
                    <div className="flex flex-col gap-[0.75rem]">
                        <Field label="Фамилия">
                            <Input type="text" name="Surname" placeholder="Введите фамилию" value={formData.Surname} onChange={(event) => updateField("Surname", event.target.value)} required />
                        </Field>
                        <Field label="Имя">
                            <Input type="text" name="NameIRL" placeholder="Введите имя" value={formData.NameIRL} onChange={(event) => updateField("NameIRL", event.target.value)} required />
                        </Field>
                        <Field label="Отчество">
                            <Input type="text" name="Patronymic" placeholder="Введите отчество" value={formData.Patronymic} onChange={(event) => updateField("Patronymic", event.target.value)} />
                        </Field>

                        {showDescription ? (
                            <Field label="О себе">
                                <Textarea inverted name="Description" placeholder="Краткое описание поможет другим участникам лучше вас узнать" value={formData.Description} onChange={(event) => updateField("Description", event.target.value)} />
                            </Field>
                        ) : null}
                    </div>

                    {/* Правая колонка — организация целиком: регион, выбор из списка
                        и поиск по ИНН, если в списке её нет. Порядок сверху вниз
                        совпадает с порядком действий. */}
                    <div className="flex flex-col gap-[1.25rem]">
                        <div className="flex flex-col gap-[0.75rem] p-[1.25rem] rounded-[1rem] max-[640px]:p-[1rem]" style={{ border: "1.5px solid var(--color-gray-plus-50)" }}>
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
                                />
                            </Field>

                            <Field label="Организация">
                                <DropdownInput
                                    ref={orgDropdownRef}
                                    id="Organization"
                                    name="Organization"
                                    placeholder={region ? "Начните вводить название" : "Сначала выберите регион"}
                                    value={formData.Organization}
                                    options={orgList}
                                    onChange={(event) => updateField("Organization", event.target.value)}
                                    onQueryChange={() => setOrgFieldTyped(true)}
                                    disabled={!region}
                                />
                            </Field>

                            <hr style={{ borderColor: "var(--color-gray-plus-50)" }} />

                            <Field label="Нет в списке? Найдите по ИНН">
                                {/* Список в базе неполный, и без этого участник
                                    из непопавшего колледжа не двигается дальше. */}
                                <OrgRegistrySearch showHint={false} onSelected={handleOrgFromRegistry} />
                            </Field>

                            <p className="text-sm" style={{ color: "var(--color-gray-black)" }}>
                                Если организации нет ни в списке, ни в реестре, заполните{" "}
                                <Link target="_blank" className="text-(--color-blue)" href="https://forms.yandex.ru/u/690391e1068ff0a3ba625eef">
                                    форму
                                </Link>
                                .
                            </p>
                        </div>

                        {showRole ? (
                            <div className="flex flex-col gap-[0.75rem] p-[1.25rem] rounded-[1rem] max-[640px]:p-[1rem]" style={{ border: "1.5px solid var(--color-gray-plus-50)" }}>
                                <h6>Тип профиля</h6>
                                <div className="grid grid-cols-2 gap-[0.75rem] max-[640px]:grid-cols-1">
                                    <RoleCard value="student" current={role} onSelect={setRole} title="Студент" hint="Учебная деятельность" Icon={StudentIcon} />
                                    <RoleCard value="teacher" current={role} onSelect={setRole} title="Сотрудник" hint="Рабочая деятельность" Icon={StaffIcon} />
                                </div>
                            </div>
                        ) : null}
                    </div>
                </div>

                <div className="flex items-center gap-[1rem] pt-[0.25rem] max-[640px]:flex-col max-[640px]:items-stretch">
                    <Button className="w-fit! max-[640px]:w-full!" onClick={handleSubmit} disabled={isSaving || !isDirty}>
                        {isSaving ? "Сохранение..." : submitLabel}
                    </Button>
                </div>
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
