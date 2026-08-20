/**
 * Aplica el tema ANTES del primer pintado.
 *
 * Si esto se hiciera desde un efecto de React, la app arrancaría clara y
 * pasaría a oscura en el primer frame: un flash blanco en la cara, de noche,
 * cada vez que se abre. Por eso es un script bloqueante y chiquito en <head>.
 */
const script = `
(function () {
  try {
    var stored = localStorage.getItem("casa-theme");
    var dark = stored
      ? stored === "dark"
      : window.matchMedia("(prefers-color-scheme: dark)").matches;
    document.documentElement.classList.toggle("dark", dark);
  } catch (e) {
    // localStorage bloqueado (modo privado, cookies off): queda el tema claro.
  }
})();
`;

export function ThemeScript() {
  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
