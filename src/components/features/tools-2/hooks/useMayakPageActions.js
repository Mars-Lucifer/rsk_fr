import { useCallback } from "react";

export function useMayakPageActions({ goTo, handleSubmitSecondQuestionnaire, setShowRolePopup }) {
    const handleOpenHistory = useCallback(() => {
        sessionStorage.setItem("previousPage", "trainer");
        goTo("history");
    }, [goTo]);

    const handleCloseRolePopup = useCallback(() => {
        setShowRolePopup(false);
    }, [setShowRolePopup]);

    const handleSubmitSecondQuestionnaireWithFeedback = useCallback(
        async (data) => {
            try {
                await handleSubmitSecondQuestionnaire(data);
            } catch (error) {
                console.error("Ошибка анкетирования:", error);
                alert("Произошла ошибка при сохранении анкеты. Пожалуйста, попробуйте еще раз.");
            }
        },
        [handleSubmitSecondQuestionnaire]
    );

    return {
        handleCloseRolePopup,
        handleOpenHistory,
        handleSubmitSecondQuestionnaireWithFeedback,
    };
}
