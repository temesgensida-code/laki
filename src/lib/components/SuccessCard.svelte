<script>
	import { CheckCircle2, Download, ArrowRight, Zap, ShieldCheck, Clock, Gauge, FileCheck } from '@lucide/svelte';
	import { formatBytes, formatSpeed, formatDuration } from '$lib/utils/formatters.js';

	let {
		result = null,
		isReceiver = false,
		onReset = () => {}
	} = $props();

	function triggerDownload() {
		if (result?.url && result?.filename) {
			const a = document.createElement('a');
			a.href = result.url;
			a.download = result.filename;
			document.body.appendChild(a);
			a.click();
			document.body.removeChild(a);
		}
	}
</script>

<div class="w-full bg-zinc-900/90 border border-zinc-800 rounded-2xl p-6 sm:p-8 shadow-2xl text-center relative overflow-hidden">
	<!-- Background glow effect -->
	<div class="absolute -top-24 left-1/2 -translate-x-1/2 w-64 h-64 bg-emerald-500/10 blur-3xl pointer-events-none"></div>

	<!-- Checkmark badge -->
	<div class="inline-flex items-center justify-center w-16 h-16 rounded-3xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 mb-5 shadow-lg shadow-emerald-500/10 animate-in zoom-in-75 duration-300">
		<CheckCircle2 class="w-9 h-9" />
	</div>

	<h3 class="text-xl sm:text-2xl font-bold text-white mb-2">
		Transfer Complete!
	</h3>
	<p class="text-sm text-zinc-400 max-w-md mx-auto mb-6">
		{isReceiver
			? 'The file was successfully assembled and verified in your browser memory.'
			: 'All chunks have been securely streamed and acknowledged by the receiver.'}
	</p>

	<!-- Transfer Stats Summary -->
	<div class="grid grid-cols-3 gap-2 sm:gap-3 max-w-lg mx-auto mb-6 text-left">
		<div class="p-3 rounded-xl bg-zinc-950/60 border border-zinc-800/80">
			<span class="text-[11px] text-zinc-400 block mb-0.5">Total Size</span>
			<span class="font-mono text-xs sm:text-sm font-semibold text-zinc-100">
				{formatBytes(result?.size || result?.totalBytes || 0)}
			</span>
		</div>
		<div class="p-3 rounded-xl bg-zinc-950/60 border border-zinc-800/80">
			<span class="text-[11px] text-zinc-400 block mb-0.5">Duration</span>
			<span class="font-mono text-xs sm:text-sm font-semibold text-zinc-100">
				{formatDuration(result?.duration || 0)}
			</span>
		</div>
		<div class="p-3 rounded-xl bg-zinc-950/60 border border-zinc-800/80">
			<span class="text-[11px] text-zinc-400 block mb-0.5">Avg Speed</span>
			<span class="font-mono text-xs sm:text-sm font-semibold text-emerald-400">
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
				class="w-full sm:w-auto px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm shadow-lg shadow-emerald-600/20 transition-all duration-150 active:scale-[0.98] cursor-pointer flex items-center justify-center gap-2"
			>
				<Download class="w-4 h-4" />
				<span>Download Again ({result.filename})</span>
			</button>
		{/if}

		<button
			type="button"
			onclick={onReset}
			class="w-full sm:w-auto px-5 py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-medium text-sm border border-zinc-700 transition-colors cursor-pointer flex items-center justify-center gap-2"
		>
			<span>Transfer Another File</span>
			<ArrowRight class="w-4 h-4 text-zinc-400" />
		</button>
	</div>
</div>
