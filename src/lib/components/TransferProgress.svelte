<script>
	import {
		Pause,
		Play,
		StopCircle,
		Gauge,
		Clock,
		Timer,
		Activity,
		Layers
	} from '@lucide/svelte';
	import { formatBytes, formatSpeed, formatEta, formatDuration } from '$lib/utils/formatters.js';
	import { theme } from '$lib/utils/theme.svelte.js';
	import { playChime } from '$lib/utils/sound.js';

	let {
		stats = null,
		isPaused = false,
		isSender = false,
		onTogglePause = () => {},
		onCancel = () => {}
	} = $props();

	let progressPercent = $derived(stats?.progress ? stats.progress.toFixed(1) : '0.0');

	function handlePause() {
		playChime('click');
		onTogglePause();
	}

	function handleCancel() {
		playChime('click');
		onCancel();
	}
</script>

<div
	class="w-full rounded-md p-5 sm:p-6 border transition-colors duration-200 {theme.current === 'dark'
		? 'bg-[#21262F] border-[#57707A]/40 shadow-lg'
		: 'bg-[#ECEAE9] border-[#C5BAC4] shadow-md'}"
>
	<!-- Top Row: Status badge and Actions -->
	<div class="flex items-center justify-between gap-3 mb-4">
		<div class="flex items-center gap-2">
			{#if isPaused}
				<span
					class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-sm text-xs font-semibold border {theme.current === 'dark'
						? 'bg-[#16191E] border-amber-500/40 text-amber-400'
						: 'bg-[#DFDCDB] border-amber-600/40 text-amber-700'}"
				>
					<Pause class="w-3 h-3" />
					<span>Transfer Paused</span>
				</span>
			{:else if stats?.networkQuality === 'reconnecting'}
				<span
					class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-sm text-xs font-semibold border animate-pulse {theme.current === 'dark'
						? 'bg-[#16191E] border-orange-500/40 text-orange-400'
						: 'bg-[#DFDCDB] border-orange-600/40 text-orange-700'}"
				>
					<Activity class="w-3 h-3" />
					<span>Reconnecting link...</span>
				</span>
			{:else if stats?.networkQuality === 'stalled'}
				<span
					class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-sm text-xs font-semibold border {theme.current === 'dark'
						? 'bg-[#16191E] border-amber-500/40 text-amber-400'
						: 'bg-[#DFDCDB] border-amber-600/40 text-amber-700'}"
				>
					<Activity class="w-3 h-3" />
					<span>Buffering stream...</span>
				</span>
			{:else}
				<span
					class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-sm text-xs font-semibold border {theme.current === 'dark'
						? 'bg-[#16191E] border-[#57707A]/60 text-[#DEDCDC]'
						: 'bg-[#DFDCDB] border-[#7B919C] text-[#191D23]'}"
				>
					<span class="w-1.5 h-1.5 rounded-full bg-[#57707A] animate-ping"></span>
					<span>{isSender ? 'Streaming Chunks to Receiver' : 'Receiving Direct P2P Stream'}</span>
				</span>
			{/if}
		</div>

		<!-- Action controls: Pause / Resume & Cancel -->
		<div class="flex items-center gap-2">
			<button
				type="button"
				onclick={handlePause}
				class="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer active:translate-y-px {isPaused
					? 'bg-emerald-600 hover:bg-emerald-500 text-white border border-emerald-500'
					: (theme.current === 'dark'
						? 'bg-[#16191E] hover:bg-[#191D23] text-[#DEDCDC] border border-[#57707A]/50'
						: 'bg-[#DFDCDB] hover:bg-[#D2CECE] text-[#191D23] border border-[#989DAA]')}"
				title={isPaused ? 'Resume transfer' : 'Pause transfer'}
			>
				{#if isPaused}
					<Play class="w-3.5 h-3.5 fill-white" />
					<span>Resume</span>
				{:else}
					<Pause class="w-3.5 h-3.5" />
					<span>Pause</span>
				{/if}
			</button>

			<button
				type="button"
				onclick={handleCancel}
				class="p-1.5 rounded-md transition-colors cursor-pointer border active:translate-y-px {theme.current === 'dark'
					? 'bg-[#16191E] hover:bg-rose-950/40 text-[#989DAA] hover:text-rose-400 border-[#57707A]/50 hover:border-rose-700/50'
					: 'bg-[#DFDCDB] hover:bg-rose-100 text-[#57707A] hover:text-rose-600 border-[#989DAA] hover:border-rose-400'}"
				title="Abort transfer"
			>
				<StopCircle class="w-4 h-4" />
			</button>
		</div>
	</div>

	<!-- Main Progress Bar -->
	<div class="mb-5">
		<div class="flex items-baseline justify-between mb-2">
			<div class="flex items-baseline gap-2">
				<span
					class="text-3xl font-extrabold tracking-tight font-mono {theme.current === 'dark'
						? 'text-[#DEDCDC]'
						: 'text-[#191D23]'}"
				>
					{progressPercent}%
				</span>
				<span
					class="text-xs font-mono {theme.current === 'dark'
						? 'text-[#989DAA]'
						: 'text-[#57707A]'}"
				>
					({formatBytes(stats?.bytesTransferred || 0)} / {formatBytes(stats?.totalBytes || 0)})
				</span>
			</div>
			<div
				class="text-xs font-mono font-semibold flex items-center gap-1 {theme.current === 'dark'
					? 'text-[#7B919C]'
					: 'text-[#57707A]'}"
			>
				<Gauge class="w-3.5 h-3.5" />
				<span>{formatSpeed(stats?.speed || 0)}</span>
			</div>
		</div>

		<!-- The Edgy Progress Bar Container -->
		<div
			class="w-full h-3 rounded-sm p-0.5 overflow-hidden border relative transition-colors {theme.current === 'dark'
				? 'bg-[#16191E] border-[#57707A]/50'
				: 'bg-[#DFDCDB] border-[#989DAA]'}"
		>
			<div
				class="h-full rounded-none transition-all duration-300 ease-out relative overflow-hidden {isPaused
					? 'bg-amber-500'
					: 'bg-[#57707A]'}"
				style="width: {Math.max(1, Math.min(100, stats?.progress || 0))}%;"
			>
				{#if !isPaused}
					<div class="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer"></div>
				{/if}
			</div>
		</div>
	</div>

	<!-- Telemetry Metrics Grid (Edgy boxes) -->
	<div class="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 text-xs">
		<!-- Speed -->
		<div
			class="p-3 rounded-sm border {theme.current === 'dark'
				? 'bg-[#16191E] border-[#57707A]/40'
				: 'bg-[#DFDCDB] border-[#C5BAC4]'}"
		>
			<div
				class="flex items-center gap-1.5 mb-1 {theme.current === 'dark'
					? 'text-[#989DAA]'
					: 'text-[#57707A]'}"
			>
				<Activity class="w-3.5 h-3.5 text-[#57707A]" />
				<span>Speed</span>
			</div>
			<div
				class="font-mono text-sm font-semibold {theme.current === 'dark'
					? 'text-[#DEDCDC]'
					: 'text-[#191D23]'}"
			>
				{formatSpeed(stats?.speed || 0)}
			</div>
		</div>

		<!-- Time Remaining / ETA -->
		<div
			class="p-3 rounded-sm border {theme.current === 'dark'
				? 'bg-[#16191E] border-[#57707A]/40'
				: 'bg-[#DFDCDB] border-[#C5BAC4]'}"
		>
			<div
				class="flex items-center gap-1.5 mb-1 {theme.current === 'dark'
					? 'text-[#989DAA]'
					: 'text-[#57707A]'}"
			>
				<Timer class="w-3.5 h-3.5 text-[#7B919C]" />
				<span>ETA</span>
			</div>
			<div
				class="font-mono text-sm font-semibold {theme.current === 'dark'
					? 'text-[#DEDCDC]'
					: 'text-[#191D23]'}"
			>
				{formatEta(stats?.eta || 0)}
			</div>
		</div>

		<!-- Elapsed Time -->
		<div
			class="p-3 rounded-sm border {theme.current === 'dark'
				? 'bg-[#16191E] border-[#57707A]/40'
				: 'bg-[#DFDCDB] border-[#C5BAC4]'}"
		>
			<div
				class="flex items-center gap-1.5 mb-1 {theme.current === 'dark'
					? 'text-[#989DAA]'
					: 'text-[#57707A]'}"
			>
				<Clock class="w-3.5 h-3.5 text-[#989DAA]" />
				<span>Elapsed</span>
			</div>
			<div
				class="font-mono text-sm font-semibold {theme.current === 'dark'
					? 'text-[#DEDCDC]'
					: 'text-[#191D23]'}"
			>
				{formatDuration(stats?.elapsedTime || 0)}
			</div>
		</div>

		<!-- Chunks count -->
		<div
			class="p-3 rounded-sm border {theme.current === 'dark'
				? 'bg-[#16191E] border-[#57707A]/40'
				: 'bg-[#DFDCDB] border-[#C5BAC4]'}"
		>
			<div
				class="flex items-center gap-1.5 mb-1 {theme.current === 'dark'
					? 'text-[#989DAA]'
					: 'text-[#57707A]'}"
			>
				<Layers class="w-3.5 h-3.5 text-[#57707A]" />
				<span>Chunks</span>
			</div>
			<div
				class="font-mono text-sm font-semibold {theme.current === 'dark'
					? 'text-[#DEDCDC]'
					: 'text-[#191D23]'}"
			>
				{stats?.currentChunk || 0} / {stats?.totalChunks || 0}
			</div>
		</div>
	</div>

	<!-- Flow Control Backpressure status -->
	{#if isSender && typeof stats?.bufferPercentage === 'number' && stats.bufferPercentage > 10}
		<div
			class="mt-3 pt-3 border-t flex items-center justify-between text-[11px] {theme.current === 'dark'
				? 'border-[#57707A]/30 text-[#989DAA]'
				: 'border-[#C5BAC4] text-[#57707A]'}"
		>
			<div class="flex items-center gap-1.5">
				<span>WebRTC SCTP Buffer Backpressure:</span>
			</div>
			<div class="flex items-center gap-2">
				<div class="w-20 h-1.5 rounded-none bg-zinc-800 overflow-hidden">
					<div class="h-full bg-[#57707A]" style="width: {stats.bufferPercentage}%;"></div>
				</div>
				<span class="font-mono font-semibold">{Math.round(stats.bufferPercentage)}%</span>
			</div>
		</div>
	{/if}
</div>

<style>
	@keyframes shimmer {
		0% {
			transform: translateX(-100%);
		}
		100% {
			transform: translateX(100%);
		}
	}
	.animate-shimmer {
		animation: shimmer 1.8s infinite linear;
	}
</style>
