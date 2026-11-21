<script>
	import { Moon, Sun, Volume2, VolumeX } from '@lucide/svelte';
	import { theme } from '$lib/utils/theme.svelte.js';
	import { isSoundEnabled, toggleSound, playChime } from '$lib/utils/sound.js';

	let soundOn = $state(true);

	$effect(() => {
		if (typeof window !== 'undefined') {
			soundOn = isSoundEnabled();
		}
	});

	function handleToggleSound() {
		soundOn = toggleSound();
		if (soundOn) {
			playChime('click');
		}
	}

	function handleToggleTheme(mode) {
		if (theme.current !== mode) {
			theme.setTheme(mode);
			playChime('click');
		}
	}
</script>

<div class="flex items-center gap-1 sm:gap-2">
	<!-- Sound Toggle Capsule (matching uploaded image) -->
	<div
		class="h-7.5 sm:h-9 px-0.5 sm:px-1 flex items-center rounded-md sm:rounded-lg border transition-all select-none {theme.current === 'dark'
			? 'bg-[#191D23] border-[#57707A]/50 shadow-inner'
			: 'bg-[#C5BAC4]/50 border-[#989DAA]/60 shadow-inner'}"
		title="Toggle sound feedback"
	>
		<!-- Active/Inactive Speaker Button -->
		<button
			type="button"
			onclick={handleToggleSound}
			class="w-5.5 h-5.5 sm:w-7 sm:h-7 flex items-center justify-center rounded sm:rounded-md transition-all cursor-pointer {soundOn
				? 'bg-[#57707A] text-white shadow-sm border border-[#7B919C]'
				: 'text-[#989DAA] hover:text-[#7B919C]'}"
			aria-label="Sound on"
		>
			<Volume2 class="w-3.5 h-3.5 sm:w-4 sm:h-4 {soundOn ? 'stroke-[2.2]' : 'stroke-[1.7]'}" />
		</button>

		<!-- Mute Button -->
		<button
			type="button"
			onclick={handleToggleSound}
			class="w-5.5 h-5.5 sm:w-7 sm:h-7 flex items-center justify-center rounded sm:rounded-md transition-all cursor-pointer {!soundOn
				? 'bg-[#57707A] text-white shadow-sm border border-[#7B919C]'
				: 'text-[#989DAA] hover:text-[#7B919C]'}"
			aria-label="Sound muted"
		>
			<VolumeX class="w-3.5 h-3.5 sm:w-4 sm:h-4 {!soundOn ? 'stroke-[2.2]' : 'stroke-[1.7]'}" />
		</button>
	</div>

	<!-- Dark/Light Mode Capsule (matching uploaded image) -->
	<div
		class="h-7.5 sm:h-9 px-0.5 sm:px-1 flex items-center rounded-md sm:rounded-lg border transition-all select-none {theme.current === 'dark'
			? 'bg-[#191D23] border-[#57707A]/50 shadow-inner'
			: 'bg-[#C5BAC4]/50 border-[#989DAA]/60 shadow-inner'}"
		title="Toggle dark / light theme"
	>
		<!-- Moon (Dark Mode) -->
		<button
			type="button"
			onclick={() => handleToggleTheme('dark')}
			class="w-5.5 h-5.5 sm:w-7 sm:h-7 flex items-center justify-center rounded sm:rounded-md transition-all cursor-pointer {theme.current === 'dark'
				? 'bg-[#57707A] text-white shadow-sm border border-[#7B919C]'
				: 'text-[#989DAA] hover:text-[#7B919C]'}"
			aria-label="Dark mode"
		>
			<Moon class="w-3.5 h-3.5 sm:w-4 sm:h-4 {theme.current === 'dark' ? 'stroke-[2.2]' : 'stroke-[1.7]'}" />
		</button>

		<!-- Sun (Light Mode) -->
		<button
			type="button"
			onclick={() => handleToggleTheme('light')}
			class="w-5.5 h-5.5 sm:w-7 sm:h-7 flex items-center justify-center rounded sm:rounded-md transition-all cursor-pointer {theme.current === 'light'
				? 'bg-[#57707A] text-white shadow-sm border border-[#7B919C]'
				: 'text-[#989DAA] hover:text-[#7B919C]'}"
			aria-label="Light mode"
		>
			<Sun class="w-3.5 h-3.5 sm:w-4 sm:h-4 {theme.current === 'light' ? 'stroke-[2.2]' : 'stroke-[1.7]'}" />
		</button>
	</div>
</div>
