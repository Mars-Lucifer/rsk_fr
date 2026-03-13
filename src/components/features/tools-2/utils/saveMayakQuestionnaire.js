import { readMayakActiveUser } from "./readMayakActiveUser";

export async function saveMayakQuestionnaire({ questionnaireType, data, storageKey, onSecondCompleted }) {
    try {
        const activeUser = readMayakActiveUser();

        const response = await fetch("/api/mayak/saveQuestionnaire", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                userId: activeUser.id,
                questionnaireType,
                data,
            }),
        });

        if (!response.ok) {
            throw new Error("Ошибка сохранения");
        }

        if (questionnaireType === "Second") {
            localStorage.setItem(storageKey, "true");
            if (typeof onSecondCompleted === "function") {
                onSecondCompleted();
            }
        }

        return await response.json();
    } catch (error) {
        console.error("Ошибка:", error);
        throw error;
    }
}
