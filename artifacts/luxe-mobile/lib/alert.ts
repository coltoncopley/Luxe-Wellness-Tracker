import { Alert as NativeAlert, Platform } from "react-native";
import type { AlertButton } from "react-native";

import colors from "@/constants/colors";

/**
 * Cross-platform Alert.
 *
 * React Native's Alert is a no-op on react-native-web, which silently breaks
 * every confirm dialog and chooser (camera vs. photo library, delete
 * confirmations, ...) in the web preview. On web we render a small DOM dialog
 * styled with the LUXE palette instead; on iOS/Android we delegate to the
 * native Alert.
 */
function webAlert(title: string, message?: string, buttons?: AlertButton[]): void {
  if (typeof document === "undefined") return;

  const btns: AlertButton[] = buttons && buttons.length > 0 ? buttons : [{ text: "OK" }];
  const dark =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches;
  const palette = dark ? colors.dark : colors.light;

  const backdrop = document.createElement("div");
  Object.assign(backdrop.style, {
    position: "fixed",
    inset: "0",
    background: "rgba(15, 23, 41, 0.55)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: "99999",
    padding: "24px",
  });

  const card = document.createElement("div");
  Object.assign(card.style, {
    background: palette.card,
    color: palette.cardForeground,
    borderRadius: "16px",
    padding: "20px",
    width: "100%",
    maxWidth: "320px",
    boxShadow: "0 12px 40px rgba(0,0,0,0.35)",
    fontFamily:
      "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  });

  const titleEl = document.createElement("div");
  titleEl.textContent = title;
  Object.assign(titleEl.style, {
    fontSize: "16px",
    fontWeight: "600",
    textAlign: "center",
    whiteSpace: "pre-wrap",
  });
  card.appendChild(titleEl);

  if (message) {
    const msgEl = document.createElement("div");
    msgEl.textContent = message;
    Object.assign(msgEl.style, {
      fontSize: "13px",
      lineHeight: "1.45",
      color: palette.mutedForeground,
      textAlign: "center",
      marginTop: "8px",
      whiteSpace: "pre-wrap",
    });
    card.appendChild(msgEl);
  }

  const btnWrap = document.createElement("div");
  Object.assign(btnWrap.style, {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    marginTop: "16px",
  });

  const close = () => backdrop.remove();

  for (const btn of btns) {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = btn.text ?? "OK";
    Object.assign(b.style, {
      border: "none",
      borderRadius: "12px",
      padding: "12px",
      fontSize: "14px",
      fontWeight: "600",
      cursor: "pointer",
      fontFamily: "inherit",
    });
    if (btn.style === "destructive") {
      Object.assign(b.style, {
        background: "transparent",
        color: palette.destructive,
        border: `1px solid ${palette.destructive}`,
      });
    } else if (btn.style === "cancel") {
      Object.assign(b.style, {
        background: palette.secondary,
        color: palette.secondaryForeground,
      });
    } else {
      Object.assign(b.style, {
        background: palette.primary,
        color: palette.primaryForeground,
      });
    }
    b.addEventListener("click", () => {
      close();
      btn.onPress?.();
    });
    btnWrap.appendChild(b);
  }

  card.appendChild(btnWrap);
  backdrop.appendChild(card);

  backdrop.addEventListener("click", (e) => {
    if (e.target === backdrop) {
      const cancel = btns.find((b) => b.style === "cancel");
      close();
      cancel?.onPress?.();
    }
  });

  document.body.appendChild(backdrop);
}

export const Alert = {
  alert(title: string, message?: string, buttons?: AlertButton[]): void {
    if (Platform.OS === "web") {
      webAlert(title, message, buttons);
    } else {
      NativeAlert.alert(title, message, buttons);
    }
  },
};
