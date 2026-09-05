// Reactive Theme manager using Svelte 5 runes
class ThemeManager {
	current = $state('dark');

	constructor() {
		if (typeof window !== 'undefined') {
			const saved = localStorage.getItem('laki_theme');
			if (saved === 'light') {
				this.current = 'light';
				this.apply('light');
			} else {
				this.current = 'dark';
				this.apply('dark');
			}
		}
	}

	apply(mode) {
		if (typeof document !== 'undefined') {
			const root = document.documentElement;
			if (mode === 'light') {
				root.classList.remove('dark');
				root.classList.add('light');
			} else {
				root.classList.remove('light');
				root.classList.add('dark');
			}
			localStorage.setItem('laki_theme', mode);
		}
	}

	setTheme(mode) {
		this.current = mode;
		this.apply(mode);
	}

	toggle() {
		const next = this.current === 'dark' ? 'light' : 'dark';
		this.setTheme(next);
	}
}

export const theme = new ThemeManager();
