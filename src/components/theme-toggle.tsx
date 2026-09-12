import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

export function ThemeToggle() {
  const [theme, setTheme] = useState(() => document.documentElement.dataset.theme === "light" ? "light" : "dark");
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme === "dark" ? "#101916" : "#f7f9f8");
    try { localStorage.setItem("elladria-theme", theme); } catch { /* Theme works even when storage is unavailable. */ }
  }, [theme]);
  const label = `Switch to ${theme === "dark" ? "light" : "dark"} mode`;
  return <button type="button" className="theme-toggle" aria-label={label} title={label} onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
    {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
  </button>;
}
