import { useRef, useCallback } from "react";

// Undo-стек для Ctrl+Z (снимки {tasks, texts}).
// saveSnapshot читает актуальные значения из tasksRef/textsRef — поэтому стабилен
// и может вызываться из других обработчиков (handlePasteMulti, keydown) без
// устаревших замыканий.
export const useUndoStack = ({ tasksRef, textsRef, setTasks, setTexts, isDirtyRef }) => {
    const undoStack = useRef([]);

    const saveSnapshot = useCallback(() => {
        undoStack.current.push({
            tasks: JSON.parse(JSON.stringify(tasksRef.current)),
            texts: JSON.parse(JSON.stringify(textsRef.current)),
        });
        if (undoStack.current.length > 30) undoStack.current.shift();
    }, [tasksRef, textsRef]);

    const applyUndo = useCallback(() => {
        const snapshot = undoStack.current.pop();
        if (!snapshot) return;
        setTasks(snapshot.tasks);
        setTexts(snapshot.texts);
        isDirtyRef.current = true;
    }, [setTasks, setTexts, isDirtyRef]);

    return { saveSnapshot, applyUndo };
};
