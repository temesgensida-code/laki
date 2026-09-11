<script>
	import ThemeSoundToggle from '$lib/components/ThemeSoundToggle.svelte';
	import GoogleAuth from '$lib/components/GoogleAuth.svelte';
	import { theme } from '$lib/utils/theme.svelte.js';

	/** @type {{ user?: { id: string, email: string, name: string, picture?: string } | null }} */
	let { user = null } = $props();
</script>

<header
	class="w-full border-b sticky top-0 z-40 backdrop-blur-md transition-colors duration-200 {theme.current === 'dark'
		? 'border-[#57707A]/30 bg-[#191D23]/90'
		: 'border-[#C5BAC4] bg-[#DEDCDC]/90'}"
>
	<div class="max-w-4xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-3">
		<!-- Single Text Logo "Laki" -->
		<a
			href="/"
			class="font-lexend text-xl sm:text-2xl font-bold tracking-tight transition-colors {theme.current === 'dark'
				? 'text-[#DEDCDC] hover:text-[#C5BAC4]'
				: 'text-[#191D23] hover:text-[#57707A]'}"
		>
			Laki
		</a>

		<!-- Header Actions: Google Auth & Tactile Toggles -->
		<div class="flex items-center gap-2 sm:gap-3">
			<GoogleAuth {user} />
			<ThemeSoundToggle />
		</div>
	</div>
</header>
