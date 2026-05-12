import { useEffect, useState } from "react";

export function useMediaQuery(query) {
    const [matches, setMatches] = useState(false);

    useEffect(() => {
        if (typeof window === "undefined") {
            return undefined;
        }

        const media = window.matchMedia(query);
        const listener = () => {
            setMatches(media.matches);
        };

        listener();
        media.addEventListener("change", listener);
        return () => media.removeEventListener("change", listener);
    }, [query]);

    return matches;
}
