import Button from "@/components/ui/Button";

export default function Buffer({ onClose, onInsert, onUpdate, buffer, currentField }) {
    const bufferItems = buffer[currentField] || [];

    // Функция для удаления элемента из буфера
    const handleDelete = (itemToDelete, index) => {
        // Создаем новый массив без удаляемого элемента
        const newBufferItems = [...bufferItems.slice(0, index), ...bufferItems.slice(index + 1)];

        // Обновляем буфер через callback
        const newBuffer = { ...buffer, [currentField]: newBufferItems };
        onUpdate(newBuffer);
    };

    return (
        <div className="w-full h-full bg-white absolute top-0 left-0 p-[2rem]">
            <div className="flex relative h-full w-full border-dashed border-(--color-gray-plus) rounded-[0.75rem] items-center justify-center border-[3px]">
                {/* ... (кнопка закрытия без изменений) ... */}

                <div className="flex flex-col gap-[1.5rem] items-center w-[80%]">
                    {/* ... (заголовок без изменений) ... */}

                    <div className="flex flex-col gap-[0.5rem] w-full">
                        {bufferItems.length === 0 && (
                            <div className="text-center text-gray-400 py-4">
                                Нет сохраненных вариантов
                            </div>
                        )}
                        {bufferItems.map((item, index) => (
                            <div key={index} className="group flex items-center gap-[0.5rem]">
                                <Button inverted className="!justify-start flex-1 text-left overflow-hidden text-ellipsis whitespace-nowrap" onClick={() => onInsert(item)}>
                                    {item}
                                </Button>
                                <div
                                    className="flex items-center justify-center w-6 h-6 rounded-full hover:bg-[var(--color-red-noise)] text-black hover:text-[var(--color-red)] transition-all duration-200 ml-2 cursor-pointer flex-shrink-0"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleDelete(item, index);
                                    }}
                                    title="Удалить этот вариант">
                                    <svg width="10" height="10" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                                        <path d="M13 1L1 13M1 1L13 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                </div>
                            </div>
                        ))}
                    </div>
                    <Button inverted className="!w-[60%]" onClick={onClose}>
                        Вернуться назад
                    </Button>
                </div>
            </div>
        </div>
    );
}
