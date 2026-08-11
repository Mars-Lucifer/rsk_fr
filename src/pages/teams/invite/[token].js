import { useEffect, useState } from "react";
import { useRouter } from "next/router";

import Header from "@/components/layout/Header";
import Layout from "@/components/layout/Layout";
import Button from "@/components/ui/Button";

import { translateTeamError } from "@/lib/contestTeamErrors";

// Страница приглашения в команду. Открывается по ссылке, которую рассылает
// лидер: в конкурсе это единственный путь в команду.
//
// Показываем состав до вступления и заранее объясняем отказ — участник должен
// понимать, чего ему не хватает, а не упираться в ошибку после нажатия.
export default function TeamInvitePage() {
    const router = useRouter();
    const { token } = router.query;

    const [state, setState] = useState({ status: "loading", data: null, error: "" });
    const [isJoining, setIsJoining] = useState(false);
    const [joinError, setJoinError] = useState("");

    useEffect(() => {
        if (!router.isReady || !token) return;

        let cancelled = false;
        const load = async () => {
            try {
                const response = await fetch(`/api/teams/invite/${encodeURIComponent(token)}`, { credentials: "include" });
                const payload = await response.json();
                if (cancelled) return;

                if (response.status === 401) {
                    router.replace(`/auth?next=${encodeURIComponent(`/teams/invite/${token}`)}`);
                    return;
                }

                if (!payload.success) {
                    setState({ status: "error", data: null, error: translateTeamError(payload.error, "Ссылка недействительна") });
                    return;
                }

                setState({ status: "ready", data: payload.data, error: "" });
            } catch (err) {
                if (!cancelled) setState({ status: "error", data: null, error: err.message });
            }
        };

        load();
        return () => {
            cancelled = true;
        };
    }, [router, router.isReady, token]);

    const join = async () => {
        setIsJoining(true);
        setJoinError("");
        try {
            const response = await fetch(`/api/teams/join-invite/${encodeURIComponent(token)}`, {
                method: "POST",
                credentials: "include",
            });
            const payload = await response.json();

            if (!payload.success) {
                setJoinError(translateTeamError(payload.error, "Не удалось вступить в команду"));
                return;
            }

            router.push("/teams/my");
        } catch (err) {
            setJoinError(err.message);
        } finally {
            setIsJoining(false);
        }
    };

    const team = state.data?.team;
    const composition = state.data?.composition;
    const canJoin = Boolean(state.data?.can_join);
    const reason = state.data?.message ? translateTeamError(state.data.message, "") : "";

    return (
        <Layout>
            <Header>
                <Header.Heading>
                    Команды <span className="text-(--color-gray-black)">/</span> Приглашение
                </Header.Heading>
            </Header>

            <div className="hero">
                <div className="block-wrapper col-span-6 max-[900px]:col-span-12 h-fit gap-[1.25rem]">
                    {state.status === "loading" && <p>Проверяем приглашение...</p>}

                    {state.status === "error" && (
                        <>
                            <h5>Приглашение не открылось</h5>
                            <p style={{ color: "var(--color-gray-black)" }}>{state.error}</p>
                            <Button small onClick={() => router.push("/teams")}>
                                К списку команд
                            </Button>
                        </>
                    )}

                    {state.status === "ready" && (
                        <>
                            <div className="flex flex-col gap-[.5rem]">
                                <h5>Вас приглашают в команду</h5>
                                <h6>{team?.name}</h6>
                                <p style={{ color: "var(--color-gray-black)" }}>
                                    {team?.organization_name || "Организация не указана"}
                                    {team?.region ? `, ${team.region}` : ""}
                                </p>
                            </div>

                            <hr />

                            <div className="flex flex-col gap-[.5rem]">
                                <h6>Состав</h6>
                                <p>
                                    {composition?.total ?? 0} из 4: преподавателей {composition?.teachers ?? 0} из 3, студентов {composition?.students ?? 0} из 1
                                </p>
                            </div>

                            <hr />

                            {canJoin ? (
                                <div className="flex flex-col gap-[.75rem]">
                                    <Button onClick={join} disabled={isJoining}>
                                        {isJoining ? "Вступаем..." : "Вступить в команду"}
                                    </Button>
                                    {joinError && <p style={{ color: "var(--color-red)" }}>{joinError}</p>}
                                </div>
                            ) : (
                                <div className="flex flex-col gap-[.75rem]">
                                    <p style={{ color: "var(--color-red)" }}>{reason || "Вступить в эту команду нельзя"}</p>
                                    {/^Сначала выберите организацию/.test(reason) && (
                                        <Button small onClick={() => router.push("/profile?tab=settings")}>
                                            Указать организацию
                                        </Button>
                                    )}
                                    {/^Сначала завершите этап/.test(reason) && (
                                        <Button small onClick={() => router.push("/cours")}>
                                            К урокам конкурса
                                        </Button>
                                    )}
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </Layout>
    );
}
