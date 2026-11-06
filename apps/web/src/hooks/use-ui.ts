import { useSyncExternalStore } from "react";
import { useSearchParams } from "react-router-dom";

type Theme = "light" | "dark";

/**
 * Tema como store global (não useState): o botão do menu e o switch de
 * Ajustes enxergam o mesmo valor. Escuro é o padrão; claro só se escolhido.
 */
const listeners = new Set<() => void>();

function readTheme(): Theme {
  try {
    return localStorage.getItem("theme") === "light" ? "light" : "dark";
  } catch {
    return document.documentElement.classList.contains("dark") ? "dark" : "light";
  }
}

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme === "dark" ? "#0f0e0d" : "#f4f2ee");
  try {
    localStorage.setItem("theme", theme);
  } catch {
    /* storage bloqueado: vale só nesta sessão (a classe no <html> segura) */
  }
  listeners.forEach((l) => l());
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export function useTheme() {
  const theme = useSyncExternalStore(subscribe, readTheme, () => "dark" as Theme);
  return [theme, () => applyTheme(theme === "dark" ? "light" : "dark")] as const;
}

/** Abre/fecha os formulários globais pela URL (?new=1, ?import=1): funciona em qualquer tela e com o atalho do PWA. */
export function useSheetParam(name: "new" | "import") {
  const [params, setParams] = useSearchParams();
  const open = params.get(name) === "1";
  const setOpen = (v: boolean) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (v) next.set(name, "1");
        else next.delete(name);
        return next;
      },
      { replace: true },
    );
  return [open, setOpen] as const;
}
