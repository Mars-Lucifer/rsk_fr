import { useState, useEffect, useRef } from "react";

import Image from "next/image";
import ImageIcon from "@/assets/general/image.svg";

export default function ImageInput({ value: controlledValue, onChange, onImageChange, accept = "image/*", name, ...props }) {
    const [preview, setPreview] = useState(null);
    const fileRef = useRef();

    useEffect(() => {
        if (controlledValue) {
            return undefined;
        }

        const frameId = window.requestAnimationFrame(() => {
            setPreview(null);
        });

        return () => window.cancelAnimationFrame(frameId);
    }, [controlledValue]);

    const handleFile = (file) => {
        onChange?.({ target: { name, value: file.name } });
        onImageChange?.(file);
    };

    const handleImageChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onloadend = () => {
            setPreview(reader.result);
            handleFile(file);
        };
        reader.readAsDataURL(file);
    };

    const handleRemove = () => {
        setPreview(null);
        fileRef.current.value = "";
        onChange?.({ target: { name, value: "" } });
    };

    return (
        <>
            <input type="file" ref={fileRef} accept={accept} onChange={handleImageChange} className="hidden" id={`image-upload-${name}`} {...props} />
            <label htmlFor={`image-upload-${name}`} className="cursor-pointer w-full block aspect-square">
                {preview ? (
                    <div className="relative w-full h-full">
                        <Image src={preview} alt="Превью изображения" className="object-contain" width={100} height={100} />
                        <div
                            onClick={(e) => {
                                e.preventDefault();
                                handleRemove();
                            }}>
                            <svg width="20" height="20" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path
                                    d="M25.3333 4H6.66667C5.19391 4 4 5.19391 4 6.66667V25.3333C4 26.8061 5.19391 28 6.66667 28H25.3333C26.8061 28 28 26.8061 28 25.3333V6.66667C28 5.19391 26.8061 4 25.3333 4Z"
                                    stroke="#08090A"
                                    strokeWidth="2.66667"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                />
                                <path
                                    d="M12.0002 14.6667C13.4729 14.6667 14.6668 13.4728 14.6668 12C14.6668 10.5273 13.4729 9.33337 12.0002 9.33337C10.5274 9.33337 9.3335 10.5273 9.3335 12C9.3335 13.4728 10.5274 14.6667 12.0002 14.6667Z"
                                    stroke="#08090A"
                                    strokeWidth="2.66667"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                />
                                <path
                                    d="M28 20L23.8853 15.8853C23.3853 15.3854 22.7071 15.1046 22 15.1046C21.2929 15.1046 20.6147 15.3854 20.1147 15.8853L8 28"
                                    stroke="#08090A"
                                    strokeWidth="2.66667"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                />
                            </svg>
                        </div>
                    </div>
                ) : (
                    <ImageIcon />
                )}
            </label>
        </>
    );
}
