<script>
	import ThemeSoundToggle from '$lib/components/ThemeSoundToggle.svelte';
	import { theme } from '$lib/utils/theme.svelte.js';
</script>

<header
	class="w-full border-b sticky top-0 z-40 backdrop-blur-md transition-colors duration-200 {theme.current === 'dark'
		? 'border-[#57707A]/30 bg-[#191D23]/90'
		: 'border-[#C5BAC4] bg-[#DEDCDC]/90'}"
>
	<div class="max-w-4xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between">
		<!-- Single Text Logo "Laki" -->
		<a
			href="/"
			class="text-xl sm:text-2xl font-bold tracking-tight transition-colors {theme.current === 'dark'
				? 'text-[#DEDCDC] hover:text-[#C5BAC4]'
				: 'text-[#191D23] hover:text-[#57707A]'}"
		>
			Laki
		</a>

		<!-- Tactile Toggles (Sound & Theme from reference design) -->
		<ThemeSoundToggle />
	</div>
</header>
