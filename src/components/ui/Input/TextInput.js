import { useState } from "react";

export default function TextInput({ value: controlledValue, onChange, name, big, small, ...props }) {
    const isControlled = controlledValue !== undefined;
    const [uncontrolledValue, setUncontrolledValue] = useState(controlledValue || "");
    const value = isControlled ? controlledValue : uncontrolledValue;

    const handle = (nextValue) => {
        if (!isControlled) {
            setUncontrolledValue(nextValue);
        }

        onChange?.({ target: { name, value: nextValue } });
    };

    return <input value={value} onChange={(event) => handle(event.target.value)} name={name} className={`w-full ${big ? "big" : small ? "small" : ""}`} {...props} />;
}
