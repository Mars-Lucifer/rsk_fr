import { useEffect, useRef, useState } from "react";
import Button from "@/components/ui/Button";
import VK from "@/assets/general/vk.svg";
import { PUBLIC_PORTAL_API_BASE } from "@/lib/portalApiBase";

export default function VKWidget() {
  const initialized = useRef(false);
  const [sdkState, setSdkState] = useState("loading");

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    const initVK = () => {
      if (!window.VKIDSDK) {
        setSdkState("error");
        return;
      }

      try {
        window.VKIDSDK.Config.init({
          app: 54409000,
          redirectUrl: `${PUBLIC_PORTAL_API_BASE}/auth/users_interaction/auth/vk/callback`,
          responseMode: window.VKIDSDK.ConfigResponseMode.Redirect,
          source: window.VKIDSDK.ConfigSource.LOWCODE,
          scope: "email",
          mode: window.VKIDSDK.ConfigAuthMode.InNewWindow,
        });
        setSdkState("ready");
      } catch (error) {
        console.error("VK SDK init failed:", error);
        setSdkState("error");
      }
    };

    if (window.VKIDSDK?.Auth?.login) {
      initVK();
      return;
    }

    const existingScript = document.querySelector('script[data-vkid-sdk="true"]');
    const handleLoad = () => initVK();
    const handleError = () => setSdkState("error");

    if (existingScript) {
      existingScript.addEventListener("load", handleLoad);
      existingScript.addEventListener("error", handleError);
      return () => {
        existingScript.removeEventListener("load", handleLoad);
        existingScript.removeEventListener("error", handleError);
      };
    }

    const script = document.createElement("script");
    script.src = "https://unpkg.com/@vkid/sdk@<3.0.0/dist-sdk/umd/index.js";
    script.async = true;
    script.dataset.vkidSdk = "true";
    script.addEventListener("load", handleLoad);
    script.addEventListener("error", handleError);
    document.body.appendChild(script);

    return () => {
      script.removeEventListener("load", handleLoad);
      script.removeEventListener("error", handleError);
    };
  }, []);

  const handleVKLogin = () => {
    if (!window.VKIDSDK?.Auth?.login) return;

    const originalOpen = window.open;

    window.open = (url, target, features) => {
      const width = 620;
      const height = 700;
      const left = (window.screen.width - width) / 2;
      const top = (window.screen.height - height) / 2;
      return originalOpen(url, target, `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`);
    };

    window.VKIDSDK.Auth.login()
      .catch(() => {}) // ошибки можно игнорировать, редирект на сервер
      .finally(() => {
        window.open = originalOpen;
      });
  };

  return (
    <Button
      inverted
      className="w-full h-full !p-0 gap-[6px] justify-center"
      onClick={handleVKLogin}
    >
      {sdkState === "ready" ? "VK ID" : sdkState === "error" ? "VK ID unavailable" : "VK ID loading..."} <VK />
    </Button>
  );
}
