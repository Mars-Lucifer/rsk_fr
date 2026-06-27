import { motion, AnimatePresence } from "framer-motion";

export default function TransitionWrapper({ currentKey, children }) {
    // Плавная смена экранов МАЯК без дёрганья.
    // Раньше использовался mode="sync" со слайдом x:100% и переключением
    // position:absolute во время анимации — оба экрана держались одновременно
    // и «прыгали». Теперь mode="wait" (один экран за раз) + чистый fade по
    // opacity. Без сдвига (translate), чтобы во время анимации не появлялся
    // временный скроллбар, и элемент всегда остаётся в потоке.
    const variants = {
        initial: { opacity: 0 },
        animate: {
            opacity: 1,
            transition: { duration: 0.25, ease: "easeOut" },
        },
        exit: {
            opacity: 0,
            transition: { duration: 0.18, ease: "easeIn" },
        },
    };

    return (
        <AnimatePresence mode="wait" initial={false}>
            <motion.div
                key={currentKey}
                initial="initial"
                animate="animate"
                exit="exit"
                variants={variants}
                style={{
                    display: "flex",
                    flexDirection: "column",
                    width: "100%",
                    flex: "1",
                }}>
                {children}
            </motion.div>
        </AnimatePresence>
    );
}
