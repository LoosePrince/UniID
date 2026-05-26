const STORAGE_KEY = "uniid-theme";
const MEDIA_QUERY = "(prefers-color-scheme: dark)";

export function ThemeScript() {
  const script = `
(function () {
  try {
    var stored = window.localStorage.getItem("${STORAGE_KEY}");
    var mode = stored === "light" || stored === "dark" || stored === "system" ? stored : "system";
    var prefersDark = window.matchMedia && window.matchMedia("${MEDIA_QUERY}").matches;
    var resolved = mode === "system" ? (prefersDark ? "dark" : "light") : mode;
    var root = document.documentElement;
    root.classList.toggle("dark", resolved === "dark");
    root.style.colorScheme = resolved;
  } catch (error) {}
})();`;

  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}