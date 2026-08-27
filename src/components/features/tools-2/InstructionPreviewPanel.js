import Button from "@/components/ui/Button";
import CloseIcon from "@/assets/general/close.svg";

const IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "avif"];

function getPreviewFileMeta(url = "") {
    const match = String(url).match(/filename=([^&]+)/i);
    const decodedName = match ? decodeURIComponent(match[1]) : "";
    const extension = decodedName.includes(".") ? decodedName.split(".").pop().toLowerCase() : "";
    return {
        extension,
        isImage: IMAGE_EXTENSIONS.includes(extension),
    };
}

function buildEmbeddedPreviewUrl(url = "", extension = "") {
    if (extension !== "pdf") {
        return url;
    }

    const normalizedUrl = String(url || "");
    const [baseUrl, hash = ""] = normalizedUrl.split("#");
    const hashParams = new URLSearchParams(hash);

    if (!hashParams.has("page")) {
        hashParams.set("page", "1");
    }
    hashParams.set("zoom", "page-width");
    hashParams.set("view", "FitH");
    hashParams.set("pagemode", "none");

    return `${baseUrl}#${hashParams.toString()}`;
}

export default function InstructionPreviewPanel({ previewFileUrl, previewTitle, onClose }) {
    if (!previewFileUrl) return null;

    const { extension, isImage } = getPreviewFileMeta(previewFileUrl);
    const title = previewTitle || "Карта задания";
    const embeddedPreviewUrl = buildEmbeddedPreviewUrl(previewFileUrl, extension);

    const handleOpenSeparate = () => {
        if (typeof window !== "undefined") {
            window.open(previewFileUrl, "_blank", "noopener,noreferrer");
        }
    };

    return (
        <div data-tour="card-panel" className="flex h-full min-h-[320px] flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between gap-2 border-b border-slate-200 px-3 py-2">
                <div className="min-w-0">
                    <h6 className="text-black !text-base leading-tight">{title}</h6>
                </div>
                <div className="flex items-center gap-1.5">
                    <Button inverted type="button" onClick={handleOpenSeparate} className="!px-2.5 !py-1.5 !text-xs !rounded-lg">
                        {"Открыть отдельно"}
                    </Button>
                    <Button icon className="!bg-transparent !text-black hover:!bg-black/5" onClick={onClose} title={"Скрыть панель"}>
                        <CloseIcon />
                    </Button>
                </div>
            </div>
            <div className="min-h-0 flex-1 overflow-auto bg-slate-50">
                {isImage ? (
                    <div className="p-3">
                        <img src={previewFileUrl} alt={title} className="h-auto w-full rounded-lg border border-slate-200 bg-white" />
                    </div>
                ) : (
                    <iframe title={title} src={embeddedPreviewUrl} className="h-full min-h-[76vh] w-full border-0 bg-white" />
                )}
            </div>
        </div>
    );
}
