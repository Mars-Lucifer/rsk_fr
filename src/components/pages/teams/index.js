import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import Header from "@/components/layout/Header";
import Link from "next/link";

import Button from "@/components/ui/Button";

import Folder from "@/components/other/Folder";

import LinkIcon from "@/assets/general/link.svg";
import Notify from "@/assets/general/notify.svg";
import SettsIcon from "@/assets/general/setts.svg";
import DeleteIcon from "@/assets/general/delete.svg";

import { translateTeamError } from "@/lib/contestTeamErrors";

export default function TeamIndexPage({ goTo, teamData }) {
    const [idUserTeam, setIdUserTeam] = useState(null);
    const [Lider, setLider] = useState(null);
    // Ссылка-приглашение: одна на команду, видит только лидер.
    const [inviteUrl, setInviteUrl] = useState("");
    const [inviteError, setInviteError] = useState("");
    const [isCopied, setIsCopied] = useState(false);

    const team = teamData;
    const router = useRouter();

    const completedTasks = team?.team_info?.tasks_completed ?? 0;
    const teamPoints = team?.team_info?.points ?? 0;

    useEffect(() => {
        if (!team?.team_info) return;

        const ApiIdUserTeam = async () => {
            try {
                const response = await fetch("/api/teams/myteam", {
                    method: "GET",
                    headers: { "Content-Type": "application/json" },
                    credentials: "include",
                });

                const data = await response.json();
                if (data.success) {
                    setIdUserTeam(data.data[0].team.id);
                    setLider(data.data[0].is_leader);
                } else {
                    console.error("Invalid orgList data:", data);
                    setIdUserTeam(null);
                }
            } catch (err) {
                console.error("Request error:", err);
                setIdUserTeam(null);
            }
        };
        ApiIdUserTeam();
    }, [team?.team_info.id]);

    if (!teamData) {
        return <p>Команда не найдена или загружается...</p>;
    }

    const LeaveTeam = async () => {
        try {
            const response = await fetch(`/api/teams/leave/${team.team_info.id}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
            });

            const data = await response.json();
            if (data.success) {
                alert("Вы покинули команду");
                router.refresh();
                return true;
            } else {
                alert("Произошла ошибка: ", data.error);
                console.error("Join team error:", data.error);
                return false;
            }
        } catch (err) {
            alert("Произошла ошибка: ", data);
            console.error("Request error:", err);
            return false;
        }
    };

    // Ссылку тянем только по требованию лидера: бэкенд отдаёт её лишь ему,
    // а остальным вернул бы 403 и мусор в консоли.
    const loadInvite = async (regenerate = false) => {
        setInviteError("");
        setIsCopied(false);
        try {
            const response = await fetch(`/api/teams/invite-link/${team.team_info.id}`, {
                method: regenerate ? "POST" : "GET",
                credentials: "include",
            });
            const payload = await response.json();

            if (!payload.success) {
                setInviteError(translateTeamError(payload.error, "Не удалось получить ссылку"));
                return;
            }

            const url = `${window.location.origin}/teams/invite/${payload.data.invite_token}`;
            setInviteUrl(url);

            try {
                await navigator.clipboard.writeText(url);
                setIsCopied(true);
            } catch {
                // Буфер обмена может быть недоступен (нет https или отказ в правах) —
                // ссылка всё равно показана текстом, её можно выделить руками.
            }
        } catch (err) {
            setInviteError(err.message);
        }
    };

    const removeMember = async (userId, memberName) => {
        if (!window.confirm(`Исключить участника ${memberName} из команды?`)) return;

        try {
            const response = await fetch(`/api/teams/remove-member/${team.team_info.id}?userId=${userId}`, {
                method: "DELETE",
                credentials: "include",
            });
            const payload = await response.json();

            if (!payload.success) {
                alert(translateTeamError(payload.error, "Не удалось исключить участника"));
                return;
            }

            window.location.reload();
        } catch (err) {
            alert(err.message);
        }
    };

    const leader = team.members.find((member) => member.is_leader);
    const leaderName = leader ? `${(leader.name || "").trim()} ${(leader.surname || "").trim()}`.trim() || "Незаполнено" : "Незаполнено";

    const DeleteTeam = async () => {
        console.log("Frontend Log: Attempting to delete team with ID:", team.team_info.id);
        try {
            const apiUrl = `/api/teams/delete_team/${team.team_info.id}`;
            console.log("Frontend Log: Calling internal API URL:", apiUrl);
            const response = await fetch(apiUrl, {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
            });

            const data = await response.json();
            if (data.success) {
                alert("Команда успешно удалена");
                router.push("/teams"); // Перенаправление на страницу команд после успешного удаления
                return true;
            } else {
                console.error("Frontend Log: Error response from internal API:", data);
                alert(`Произошла ошибка: ${data.error || data.message || "Неизвестная ошибка"}`);
                return false;
            }
        } catch (err) {
            alert(`Произошла ошибка сети: ${err.message || err}`);
            console.error("Request error:", err);
            return false;
        }
    };
    

    return (
        <>
            <Header>
                <Header.Heading>
                    Команды <span className="text-(--color-gray-black)">/</span> {team.team_info.name}
                </Header.Heading>
                <div className="flex items-center gap-[.75rem]">
                    {idUserTeam === team.team_info.id && Lider && (
                        <Button red className={"w-fit! shadow-none!"} onClick={DeleteTeam}>
                            <DeleteIcon />
                            Удалить
                        </Button>
                    )}
                    {idUserTeam === team.team_info.id && Lider && (
                        <Button icon onClick={() => goTo("settings")}>
                            <SettsIcon />
                        </Button>
                    )}
                    <Button icon>
                        <Notify />
                    </Button>
                </div>            </Header>

            <div className="hero hero-team-layout">
                <div className="grid col-span-12 grid-cols-12 gap-[1.25rem]">
                    <div className="gap-[1rem] bg-(--color-white-gray) col-span-12 h-fit flex items-center justify-center rounded-[1rem] px-[1rem] py-[.75rem]">
                        <div className="h-[2rem] aspect-square rounded-full bg-(--color-blue-noise)"></div>
                        <h6>{team.team_info.name}</h6>
                    </div>

                    <div className="block-wrapper col-span-4 max-[900px]:col-span-6 max-[640px]:col-span-12 h-fit">
                        <div className="flex flex-col gap-[.5rem]">
                            <h6>Описание</h6>
                            <p>{team.team_info.description ? team.team_info.description : "Незаполнено"}</p>
                        </div>
                        <hr />
                        <div className="flex flex-col gap-[.5rem]">
                            <h6>Руководитель</h6>
                            <div className="flex items-center gap-[.5rem]">
                                <div className="h-[2rem] aspect-square rounded-full bg-(--color-orange-noise)"></div>
                                <span className="link">{leaderName}</span>
                            </div>
                            <div className="flex w-2/3 items-center gap-[.5rem] max-[900px]:w-full max-[640px]:flex-col">
                                <Button
                                    onClick={LeaveTeam}
                                    small
                                     disabled={!idUserTeam || idUserTeam !== team.team_info.id}
                                 >
                                     Выйти
                                 </Button>
                             </div>
                            {/* Вступление в конкурсе только по ссылке-приглашению:
                                открытой кнопки «Вступить» здесь больше нет. */}
                            {idUserTeam !== team.team_info.id && (
                                <p className="text-sm" style={{ color: "var(--color-gray-black)" }}>
                                    Вступить можно только по ссылке-приглашению — попросите её у лидера команды.
                                </p>
                            )}
                        </div>
                    </div>

                    <div className="block-wrapper col-span-4 max-[900px]:col-span-6 max-[640px]:col-span-12 h-fit">
                        <div className="flex flex-col gap-[.5rem]">
                            <h6>Организация</h6>
                            <Link href={"/organizations/" + team.team_info.organization_id} className="group cursor-pointer flex items-center justify-between w-full">
                                <span className="flex-1 link">{team.team_info.organization_name ? team.team_info.organization_name : "Незаполнено"}</span>
                                <LinkIcon className="text-(--color-gray-white) group-hover:text-(--color-black)" style={{ transition: "all .3s ease-in-out" }} />
                            </Link>
                        </div>
                        <hr />
                        <div className="flex flex-col gap-[.5rem]">
                            <h6>Регион</h6>
                            <p>{team.team_info.region ? team.team_info.region : "Незаполнено"}</p>
                        </div>
                    </div>

                    <Folder
                        team
                        projects={String(completedTasks)}
                        cases="0"
                        coins={String(teamPoints)}
                        onClick={() => goTo("workfolder")}
                    />
                </div>

                {/* Приглашение видит только лидер: ссылка — его инструмент сбора команды. */}
                {idUserTeam === team.team_info.id && Lider && (
                    <div className="block-wrapper gap-[.75rem] col-span-12 h-fit">
                        <h5>Приглашение в команду</h5>
                        <p className="text-sm" style={{ color: "var(--color-gray-black)" }}>
                            Одна ссылка на команду, срока действия нет. Отправьте её тем, кого хотите позвать: вступить смогут только участники вашей
                            организации, закрывшие этап «Я».
                        </p>

                        <div className="flex items-center gap-[.5rem] max-[640px]:flex-col max-[640px]:items-stretch">
                            <Button small onClick={() => loadInvite(false)}>
                                {inviteUrl ? "Показать ссылку снова" : "Получить ссылку"}
                            </Button>
                            {inviteUrl && (
                                <Button small onClick={() => loadInvite(true)}>
                                    Перевыпустить
                                </Button>
                            )}
                        </div>

                        {inviteUrl && (
                            <div className="flex flex-col gap-[.25rem] p-[.75rem] rounded-[.75rem]" style={{ background: "var(--color-white-gray)" }}>
                                <span className="text-sm" style={{ wordBreak: "break-all" }}>
                                    {inviteUrl}
                                </span>
                                <span className="text-sm" style={{ color: isCopied ? "var(--color-green-peace)" : "var(--color-gray-black)" }}>
                                    {isCopied ? "Ссылка скопирована в буфер обмена" : "Скопируйте ссылку вручную"}
                                </span>
                            </div>
                        )}

                        {inviteError && <p style={{ color: "var(--color-red)" }}>{inviteError}</p>}
                    </div>
                )}

                <div className="block-wrapper gap-[1.25rem] col-span-12 h-fit">
                    <h5>Участники</h5>
                    <div className="grid grid-cols-2 gap-[.75rem] max-[900px]:grid-cols-1">
                        {team.members.map((member, idx) => (
                            <div
                                key={idx}
                                className="group flex items-center p-[1rem] rounded-[1rem] gap-[.75rem]
          border-solid border-[1.5px] border-(--color-gray-plus-50) hover:bg-(--color-gray-plus-50) transition"
                                aria-label={member.name ? `${member.name} ${member.surname}` : "Незаполнено"}>
                                <div className="h-[2rem] aspect-square rounded-full bg-(--color-red-noise)"></div>
                                <span className="link big group-hover:text-(--color-blue)">{member.name ? `${member.name} ${member.surname}` : "Незаполнено"}</span>
                                {member.is_leader && (
                                    <span className="text-sm" style={{ color: "var(--color-gray-black)" }}>
                                        лидер
                                    </span>
                                )}
                                {/* Исключать может только лидер и только других. */}
                                {idUserTeam === team.team_info.id && Lider && !member.is_leader && (
                                    <Button
                                        small
                                        red
                                        className="ml-auto w-fit! shadow-none!"
                                        onClick={() => removeMember(member.user_id, `${member.name || ""} ${member.surname || ""}`.trim() || "участника")}>
                                        Исключить
                                    </Button>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </>
    );
}

