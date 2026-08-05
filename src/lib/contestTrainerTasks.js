// Связь урока конкурса с заданием в тренажёре.
//
// ponytail: карта живёт во фронте, потому что в learning_service у курса нет
// полей под тренажёр. Как только в `courses` появятся trainer_section_id и
// trainer_task_range (docs/contest-core.md, §1.6), этот файл удаляется, а
// данные приходят вместе с уроком из API.
//
// Ключ — lesson_number, не id: номер урока стабилен, id зависит от порядка
// заливки в базу.

const CONTEST_TRAINER_TASKS = {
    1: { sectionId: "1-100", taskRange: "1-4", format: "Старт" },
    2: { sectionId: "1-100", taskRange: "5-8", format: "Текст" },
    3: { sectionId: "1-100", taskRange: "9-12", format: "Аудио" },
    4: { sectionId: "1-100", taskRange: "13-16", format: "Изображение" },
    5: { sectionId: "1-100", taskRange: "17-20", format: "Интерактив" },
    6: { sectionId: "1-100", taskRange: "21-24", format: "Видео" },
    7: { sectionId: "1-100", taskRange: "25-28", format: "Данные" },
    8: { sectionId: "1-100", taskRange: "29-32", format: "Итог" },
};

export function getContestTrainerTask(lessonNumber) {
    return CONTEST_TRAINER_TASKS[Number(lessonNumber)] || null;
}

// Отметка о сдаче тренажёрного задания. В submissions.file_url поле обязательное
// и рассчитано на ссылку, а тренажёр ссылки не отдаёт — кладём машиночитаемый
// маркер, чтобы модератор видел, что это не забытая пустая строка.
export function buildTrainerSubmissionMarker(trainerTask) {
    if (!trainerTask) return "trainer://unknown";
    return `trainer://${trainerTask.sectionId}/${trainerTask.taskRange}`;
}
