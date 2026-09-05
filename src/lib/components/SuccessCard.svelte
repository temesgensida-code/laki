<script>
	import { onMount } from 'svelte';
	import { CheckCircle2, Download, ArrowRight } from '@lucide/svelte';
	import { formatBytes, formatSpeed, formatDuration } from '$lib/utils/formatters.js';
	import { theme } from '$lib/utils/theme.svelte.js';
	import { playChime } from '$lib/utils/sound.js';

	let {
		result = null,
		isReceiver = false,
		onReset = () => {}
	} = $props();

	onMount(() => {
		playChime('success');
	});

	function triggerDownload() {
		playChime('click');
		if (result?.url && result?.filename) {
			const a = document.createElement('a');
			a.href = result.url;
			a.download = result.filename;
			document.body.appendChild(a);
			a.click();
			document.body.removeChild(a);
		}
	}

	function handleReset() {
		playChime('click');
		onReset();
	}
</script>

<div
	class="w-full rounded-md p-6 sm:p-8 border text-center relative overflow-hidden transition-colors duration-200 {theme.current === 'dark'
		? 'bg-[#21262F] border-[#57707A]/40 shadow-2xl'
		: 'bg-[#ECEAE9] border-[#C5BAC4] shadow-xl'}"
>
	<!-- Checkmark badge with edgy styling -->
	<div
		class="inline-flex items-center justify-center w-14 h-14 rounded-md border mb-5 transition-colors {theme.current === 'dark'
			? 'bg-[#16191E] border-[#57707A] text-[#7B919C]'
			: 'bg-[#DFDCDB] border-[#57707A] text-[#57707A]'}"
	>
		<CheckCircle2 class="w-8 h-8" />
	</div>

	<h3
		class="text-xl sm:text-2xl font-bold tracking-tight mb-2 {theme.current === 'dark'
			? 'text-[#DEDCDC]'
			: 'text-[#191D23]'}"
	>
		Transfer Complete
	</h3>
	<p
		class="text-xs sm:text-sm max-w-md mx-auto mb-6 {theme.current === 'dark'
			? 'text-[#989DAA]'
			: 'text-[#57707A]'}"
	>
		{isReceiver
			? 'The file was successfully assembled and verified in your browser memory.'
			: 'All chunks have been securely streamed and acknowledged by the receiver.'}
	</p>

	<!-- Transfer Stats Summary (Edgy boxes) -->
	<div class="grid grid-cols-3 gap-2 sm:gap-3 max-w-lg mx-auto mb-6 text-left">
		<div
			class="p-3 rounded-sm border {theme.current === 'dark'
				? 'bg-[#16191E] border-[#57707A]/40'
				: 'bg-[#DFDCDB] border-[#C5BAC4]'}"
		>
			<span class="text-[11px] block mb-0.5 font-mono {theme.current === 'dark' ? 'text-[#989DAA]' : 'text-[#57707A]'}">Total Size</span>
			<span class="font-mono text-xs sm:text-sm font-semibold {theme.current === 'dark' ? 'text-[#DEDCDC]' : 'text-[#191D23]'}">
				{formatBytes(result?.size || result?.totalBytes || 0)}
			</span>
		</div>
		<div
			class="p-3 rounded-sm border {theme.current === 'dark'
				? 'bg-[#16191E] border-[#57707A]/40'
				: 'bg-[#DFDCDB] border-[#C5BAC4]'}"
		>
			<span class="text-[11px] block mb-0.5 font-mono {theme.current === 'dark' ? 'text-[#989DAA]' : 'text-[#57707A]'}">Duration</span>
			<span class="font-mono text-xs sm:text-sm font-semibold {theme.current === 'dark' ? 'text-[#DEDCDC]' : 'text-[#191D23]'}">
				{formatDuration(result?.duration || 0)}
			</span>
		</div>
		<div
			class="p-3 rounded-sm border {theme.current === 'dark'
				? 'bg-[#16191E] border-[#57707A]/40'
				: 'bg-[#DFDCDB] border-[#C5BAC4]'}"
		>
			<span class="text-[11px] block mb-0.5 font-mono {theme.current === 'dark' ? 'text-[#989DAA]' : 'text-[#57707A]'}">Avg Speed</span>
			<span class="font-mono text-xs sm:text-sm font-semibold text-[#57707A]">
				{formatSpeed(result?.averageSpeed || 0)}
			</span>
		</div>
	</div>

	<!-- Action Buttons -->
	<div class="flex flex-col sm:flex-row items-center justify-center gap-3">
		{#if isReceiver && result?.url}
			<button
				type="button"
				onclick={triggerDownload}
				class="w-full sm:w-auto px-6 py-2.5 rounded-md bg-[#57707A] hover:bg-[#7B919C] text-white font-semibold text-xs sm:text-sm shadow border border-[#7B919C] transition-all duration-150 active:translate-y-px cursor-pointer flex items-center justify-center gap-2"
			>
				<Download class="w-4 h-4" />
				<span>Download Again ({result.filename})</span>
			</button>
		{/if}

		<button
			type="button"
			onclick={handleReset}
			class="w-full sm:w-auto px-5 py-2.5 rounded-md border text-xs sm:text-sm font-semibold transition-colors cursor-pointer flex items-center justify-center gap-2 active:translate-y-px {theme.current === 'dark'
				? 'bg-[#16191E] hover:bg-[#191D23] text-[#DEDCDC] border-[#57707A]/50'
				: 'bg-[#DFDCDB] hover:bg-[#D2CECE] text-[#191D23] border-[#989DAA]'}"
		>
			<span>Transfer Another File</span>
			<ArrowRight class="w-4 h-4 text-[#989DAA]" />
		</button>
	</div>
</div>
