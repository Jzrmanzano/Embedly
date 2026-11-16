/** Light or dark. With no saved choice the page follows the system setting (the CSS does that); a choice made with the toggle is remembered and wins. */
export type Theme = 'light' | 'dark';
export const THEME_KEY = 'embedly-theme';

export function savedTheme(): Theme | null {
  try { const v = localStorage.getItem(THEME_KEY); return v === 'light' || v === 'dark' ? v : null; } catch { return null; }
}
export const systemTheme = (): Theme => (typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
export const currentTheme = (): Theme => savedTheme() ?? systemTheme();

export function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  try { localStorage.setItem(THEME_KEY, theme); } catch { /* the choice just is not remembered */ }
}
