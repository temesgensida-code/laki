<script>
	import {
		AlertTriangle,
		AlertCircle,
		RefreshCw
	} from '@lucide/svelte';
	import { theme } from '$lib/utils/theme.svelte.js';
	import { playChime } from '$lib/utils/sound.js';

	let {
		warning = '',
		error = '',
		retryCount = 0,
		onRetry = () => {},
		onReset = () => {}
	} = $props();

	function handleRetry() {
		playChime('click');
		onRetry();
	}

	function handleReset() {
		playChime('click');
		onReset();
	}
</script>

{#if error}
	<div
		class="w-full rounded-md p-4 sm:p-5 border shadow-md mb-4 transition-colors {theme.current === 'dark'
			? 'bg-[#21262F] border-rose-500/50 text-[#DEDCDC]'
			: 'bg-[#ECEAE9] border-rose-600/50 text-[#191D23]'}"
	>
		<div class="flex items-start gap-3">
			<div class="p-1.5 rounded-sm bg-rose-500/10 border border-rose-500/30 text-rose-500 flex-shrink-0 mt-0.5">
				<AlertCircle class="w-4 h-4" />
			</div>
			<div class="flex-1 min-w-0">
				<h4 class="text-xs sm:text-sm font-bold tracking-tight mb-1">Transfer Interrupted</h4>
				<p class="text-xs leading-relaxed mb-3 font-mono {theme.current === 'dark' ? 'text-[#989DAA]' : 'text-[#57707A]'}">
					{error}
				</p>
				<div class="flex items-center gap-2">
					<button
						type="button"
						onclick={handleRetry}
						class="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#57707A] hover:bg-[#7B919C] text-white text-xs font-semibold shadow border border-[#7B919C] transition-colors cursor-pointer active:translate-y-px"
					>
						<RefreshCw class="w-3.5 h-3.5" />
						<span>Retry Transfer</span>
					</button>

					<button
						type="button"
						onclick={handleReset}
						class="px-3 py-1.5 rounded-md border text-xs font-semibold transition-colors cursor-pointer active:translate-y-px {theme.current === 'dark'
							? 'bg-[#16191E] hover:bg-[#191D23] text-[#DEDCDC] border-[#57707A]/50'
							: 'bg-[#DFDCDB] hover:bg-[#D2CECE] text-[#191D23] border-[#989DAA]'}"
					>
						Start New Transfer
					</button>
				</div>
			</div>
		</div>
	</div>
{:else if warning}
	<div
		class="w-full rounded-md p-3 sm:p-4 border shadow-sm mb-4 transition-colors {theme.current === 'dark'
			? 'bg-[#21262F] border-amber-500/40 text-[#DEDCDC]'
			: 'bg-[#ECEAE9] border-amber-600/40 text-[#191D23]'}"
	>
		<div class="flex items-center gap-3">
			<div class="p-1 rounded-sm bg-amber-500/10 border border-amber-500/30 text-amber-500 flex-shrink-0">
				<AlertTriangle class="w-3.5 h-3.5 animate-pulse" />
			</div>
			<div class="flex-1 min-w-0">
				<p class="text-xs font-medium font-mono">
					{warning}
				</p>
			</div>
			<button
				type="button"
				onclick={handleRetry}
				class="flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold border transition-colors cursor-pointer flex-shrink-0 active:translate-y-px {theme.current === 'dark'
					? 'bg-[#16191E] hover:bg-[#191D23] text-[#DEDCDC] border-[#57707A]/50'
					: 'bg-[#DFDCDB] hover:bg-[#D2CECE] text-[#191D23] border-[#989DAA]'}"
			>
				<RefreshCw class="w-3 h-3" />
				<span>Reconnect</span>
			</button>
		</div>
	</div>
{/if}
