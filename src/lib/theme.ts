import { useState, useEffect } from "react";
import { Sun, Moon } from "lucide-react";
import { createElement } from "react";

export type Theme = "dark" | "light";

export function useTheme() {
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    const saved = localStorage.getItem("mf_theme") as Theme | null;
    const t = saved ?? "dark";
    setTheme(t);
    document.documentElement.classList.toggle("light", t === "light");
  }, []);

  const toggle = () => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem("mf_theme", next);
    document.documentElement.classList.toggle("light", next === "light");
  };

  return { theme, toggle };
}

export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  return createElement(
    "button",
    {
      onClick: toggle,
      "aria-label": "Toggle theme",
      className:
        "flex items-center justify-center size-7 border border-border text-muted-foreground hover:text-foreground hover:bg-surface-hover transition-colors flex-shrink-0",
    },
    createElement(theme === "dark" ? Sun : Moon, { className: "size-3.5" })
  );
}
