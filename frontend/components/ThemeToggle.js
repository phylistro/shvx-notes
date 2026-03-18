"use client";
import { useTheme } from "./ThemeProvider";

export default function ThemeToggle() {
    const { theme, toggleTheme } = useTheme();
    const isDark = theme === "dark";

    return (
        <button
            onClick={toggleTheme}
            aria-label="Toggle dark mode"
            className="btn-press relative inline-flex items-center justify-center w-10 h-10 rounded-xl border"
            style={{ borderColor: "var(--border)", background: "var(--paper-warm)", color: "var(--ink-soft)" }}
        >
            <span style={{
                position: "absolute", fontSize: "16px",
                transition: "opacity 0.3s ease, transform 0.3s ease",
                opacity: isDark ? 0 : 1,
                transform: isDark ? "scale(0.5) rotate(90deg)" : "scale(1) rotate(0deg)",
            }}>☀️</span>

            <span style={{
                position: "absolute", fontSize: "16px",
                transition: "opacity 0.3s ease, transform 0.3s ease",
                opacity: isDark ? 1 : 0,
                transform: isDark ? "scale(1) rotate(0deg)" : "scale(0.5) rotate(-90deg)",
            }}>🌙</span>
        </button>
    );
}