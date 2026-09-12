<script>
	import ThemeSoundToggle from '$lib/components/ThemeSoundToggle.svelte';
	import GoogleAuth from '$lib/components/GoogleAuth.svelte';
	import { theme } from '$lib/utils/theme.svelte.js';
	import { page } from '$app/state';
	import { ArrowLeftRight, Users } from '@lucide/svelte';

	/** @type {{ user?: { id: string, email: string, name: string, picture?: string } | null }} */
	let { user = null } = $props();
</script>

<header
	class="w-full border-b sticky top-0 z-40 backdrop-blur-md transition-colors duration-200 {theme.current === 'dark'
		? 'border-[#57707A]/30 bg-[#191D23]/90'
		: 'border-[#C5BAC4] bg-[#DEDCDC]/90'}"
>
	<div class="max-w-5xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-4">
		<!-- Left: Brand & Navigation -->
		<div class="flex items-center gap-4 sm:gap-6">
			<!-- Text Logo "Laki" -->
			<a
				href="/"
				class="font-lexend text-xl sm:text-2xl font-bold tracking-tight transition-colors {theme.current === 'dark'
					? 'text-[#DEDCDC] hover:text-white'
					: 'text-[#191D23] hover:text-[#57707A]'}"
			>
				Laki
			</a>

			<!-- Navigation Links (Transfer vs Community) -->
			<nav class="flex items-center gap-1 sm:gap-1.5 p-1 rounded-lg border {theme.current === 'dark'
				? 'bg-[#16191E] border-[#57707A]/30'
				: 'bg-[#ECEAE9] border-[#C5BAC4]'}">
				<a
					href="/"
					class="px-2.5 sm:px-3 py-1 text-xs font-medium rounded-md flex items-center gap-1.5 transition-all {page.url.pathname === '/'
						? (theme.current === 'dark' ? 'bg-[#21262F] text-[#DEDCDC] shadow-sm font-semibold' : 'bg-white text-[#191D23] shadow-sm font-semibold')
						: (theme.current === 'dark' ? 'text-[#989DAA] hover:text-[#DEDCDC]' : 'text-[#57707A] hover:text-[#191D23]')}"
				>
					<ArrowLeftRight class="w-3.5 h-3.5" />
					<span>Transfer</span>
				</a>

				<a
					href="/community"
					class="px-2.5 sm:px-3 py-1 text-xs font-medium rounded-md flex items-center gap-1.5 transition-all {page.url.pathname.startsWith('/community')
						? (theme.current === 'dark' ? 'bg-[#21262F] text-[#DEDCDC] shadow-sm font-semibold' : 'bg-white text-[#191D23] shadow-sm font-semibold')
						: (theme.current === 'dark' ? 'text-[#989DAA] hover:text-[#DEDCDC]' : 'text-[#57707A] hover:text-[#191D23]')}"
				>
					<Users class="w-3.5 h-3.5" />
					<span>Community</span>
				</a>
			</nav>
		</div>

		<!-- Right: Google Auth & Theme/Sound Toggles -->
		<div class="flex items-center gap-2 sm:gap-3">
			<GoogleAuth {user} />
			<ThemeSoundToggle />
		</div>
	</div>
</header>
