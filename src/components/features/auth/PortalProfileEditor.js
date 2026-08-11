import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";

import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input/Input";
import Textarea from "@/components/ui/Textarea";
import DropdownInput from "@/components/ui/Input/DropdownInput";
import Switcher from "@/components/ui/Switcher";
import { getPortalOrganizationId } from "@/lib/portalProfile";
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

    const content = (
        <>
            {title ? <h6>{title}</h6> : null}
            {description ? <p className="text-(--color-gray-black)">{description}</p> : null}
            <div className="flex flex-col gap-[0.75rem]">
                <div className="flex gap-[0.75rem] max-[640px]:flex-col">
                    <div className="flex flex-col gap-[0.5rem] flex-1">
                        <Input type="text" name="Surname" placeholder="Фамилия" value={formData.Surname} onChange={(event) => updateField("Surname", event.target.value)} required />
                        <Input type="text" name="NameIRL" placeholder="Имя" value={formData.NameIRL} onChange={(event) => updateField("NameIRL", event.target.value)} required />
                        <Input type="text" name="Patronymic" placeholder="Отчество" value={formData.Patronymic} onChange={(event) => updateField("Patronymic", event.target.value)} />
                    </div>
                </div>

                {showDescription ? <Textarea inverted name="Description" placeholder="Расскажите о себе кратко" value={formData.Description} onChange={(event) => updateField("Description", event.target.value)} /> : null}

                <DropdownInput
                    ref={orgDropdownRef}
                    id="Organization"
                    name="Organization"
                    placeholder="Организация"
                    value={formData.Organization}
                    options={orgList}
                    onChange={(event) => updateField("Organization", event.target.value)}
                    onQueryChange={() => setOrgFieldTyped(true)}
                    disabled={!region}
                />
                {/* Организации из реестра: список в базе неполный, и без этого
                    участник из непопавшего колледжа никуда не двигается. */}
                <OrgRegistrySearch
                    onSelected={(org) => {
                        const id = org?.id ?? org?.organization_id;
                        if (!id) return;

                        setOrgList((prev) => (prev.some((item) => String(item.id) === String(id)) ? prev : [...prev, org]));
                        updateField("Organization", String(id));
                        setOrgFieldTyped(true);
                        // Регион берём из реестра: он обязателен для команды,
                        // а руками участник впишет его иначе, чем в справочнике.
                        if (org.region) {
                            setRegion(org.region);
                            setFormData((prev) => ({ ...prev, Region: org.region }));
                        }
                    }}
                />
                <DropdownInput
                    id="Region"
                    name="Region"
                    placeholder="Регион"
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
                {!region ? <p className="text-(--color-gray-black)">Сначала выберите регион, после этого станет доступна организация.</p> : null}
                <p className="text-(--color-gray-black)">
                    Если вашей организации нет в списке, заполните{" "}
                    <Link target="_blank" className="text-(--color-blue)" href="https://forms.yandex.ru/u/690391e1068ff0a3ba625eef">
                        форму
                    </Link>
                    .
                </p>

                {showRole ? (
                    <div className="flex flex-col gap-[0.5rem]">
                        <span className="big">Тип профиля</span>
                        <Switcher value={role} onChange={setRole}>
                            <Switcher.Option value="student">Студент</Switcher.Option>
                            <Switcher.Option value="teacher">Сотрудник</Switcher.Option>
                        </Switcher>
                    </div>
                ) : null}

                <Button onClick={handleSubmit} disabled={isSaving || !isDirty}>
                    {isSaving ? "Сохранение..." : submitLabel}
                </Button>
            </div>
        </>
    );

    if (mode === "full") {
        return <div className="hero grid-cols-1">{content}</div>;
    }

    return <div className="flex flex-col gap-[1rem] w-full">{content}</div>;
}
