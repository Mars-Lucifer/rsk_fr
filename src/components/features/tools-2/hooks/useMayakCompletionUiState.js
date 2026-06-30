import { useEffect, useState } from "react";

export function useMayakCompletionUiState() {
    const [showFirstQuestionnaire, setShowFirstQuestionnaire] = useState(false);
    const [showSecondQuestionnaire, setShowSecondQuestionnaire] = useState(false);
    const [showThirdQuestionnaire, setShowThirdQuestionnaire] = useState(false);
    const [hasCompletedQuestionnaire, setHasCompletedQuestionnaire] = useState(false);
    const [completionLoading, setCompletionLoading] = useState(false);
    const [completionTestingDone, setCompletionTestingDone] = useState(false);
    const [completionSurveyDone, setCompletionSurveyDone] = useState(false);
    const [showSessionCompletionPopup, setShowSessionCompletionPopup] = useState(false);
    const [showRankingTestPopup, setShowRankingTestPopup] = useState(false);
    const [rankingForceRetake, setRankingForceRetake] = useState(false);

    useEffect(() => {
        window.__openRankingTestPopup = () => {
            setRankingForceRetake(true);
            setShowRankingTestPopup(true);
        };

        return () => {
            delete window.__openRankingTestPopup;
        };
    }, []);

    return {
        showFirstQuestionnaire,
        setShowFirstQuestionnaire,
        showSecondQuestionnaire,
        setShowSecondQuestionnaire,
        showThirdQuestionnaire,
        setShowThirdQuestionnaire,
        hasCompletedQuestionnaire,
        setHasCompletedQuestionnaire,
        completionLoading,
        setCompletionLoading,
        completionTestingDone,
        setCompletionTestingDone,
        completionSurveyDone,
        setCompletionSurveyDone,
        showSessionCompletionPopup,
        setShowSessionCompletionPopup,
        showRankingTestPopup,
        setShowRankingTestPopup,
        rankingForceRetake,
        setRankingForceRetake,
    };
}
