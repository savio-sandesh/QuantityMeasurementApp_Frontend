import { Injectable, computed, effect, signal } from '@angular/core';

export type AppTheme = 'light' | 'dark';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly storageKey = 'qm-theme';
  private readonly themeSignal = signal<AppTheme>(this.getInitialTheme());

  readonly theme = computed(() => this.themeSignal());
  readonly isDark = computed(() => this.themeSignal() === 'dark');

  constructor() {
    // Keep body classes and persisted preference in sync with the reactive theme state.
    effect(() => {
      this.applyThemeToBody(this.themeSignal());
    });
  }

  toggleTheme(): void {
    this.themeSignal.update((current) => (current === 'light' ? 'dark' : 'light'));
  }

  private getInitialTheme(): AppTheme {
    // Restore explicit user choice first; otherwise fall back to OS preference.
    const saved = localStorage.getItem(this.storageKey);
    if (saved === 'dark' || saved === 'light') {
      return saved;
    }

    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  private applyThemeToBody(theme: AppTheme): void {
    const body = document.body;
    body.classList.toggle('dark-theme', theme === 'dark');
    body.classList.toggle('light-theme', theme === 'light');
    localStorage.setItem(this.storageKey, theme);
  }
}
