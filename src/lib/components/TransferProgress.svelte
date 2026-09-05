<script>
	import {
		Pause,
		Play,
		StopCircle,
		Gauge,
		Clock,
		Timer,
		Activity,
		Database,
		Layers,
		CheckCircle2
	} from '@lucide/svelte';
	import { formatBytes, formatSpeed, formatEta, formatDuration } from '$lib/utils/formatters.js';

	let {
		stats = null,
		isPaused = false,
		isSender = false,
		onTogglePause = () => {},
		onCancel = () => {}
	} = $props();

	let progressPercent = $derived(stats?.progress ? stats.progress.toFixed(1) : '0.0');
</script>

<div class="w-full bg-zinc-900/90 border border-zinc-800 rounded-2xl p-5 sm:p-6 shadow-xl relative overflow-hidden">
	<!-- Top Row: Status badge and Actions -->
	<div class="flex items-center justify-between gap-3 mb-4">
		<div class="flex items-center gap-2">
			{#if isPaused}
				<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
					<Pause class="w-3 h-3" />
					<span>Transfer Paused</span>
				</span>
			{:else if stats?.networkQuality === 'reconnecting'}
				<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-orange-500/10 text-orange-400 border border-orange-500/20 animate-pulse">
					<Activity class="w-3 h-3" />
					<span>Reconnecting link...</span>
				</span>
			{:else if stats?.networkQuality === 'stalled'}
				<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
					<Activity class="w-3 h-3" />
					<span>Buffering stream...</span>
				</span>
			{:else}
				<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
					<span class="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-ping"></span>
					<span>{isSender ? 'Streaming Chunks to Receiver' : 'Receiving Direct P2P Stream'}</span>
				</span>
			{/if}
		</div>

		<!-- Action controls: Pause / Resume & Cancel -->
		<div class="flex items-center gap-2">
			<button
				type="button"
				onclick={onTogglePause}
				class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer {isPaused
					? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm shadow-emerald-600/20'
					: 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700'}"
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
				onclick={onCancel}
				class="p-1.5 rounded-lg bg-zinc-800/80 hover:bg-rose-950/40 text-zinc-400 hover:text-rose-400 border border-zinc-700/60 hover:border-rose-800/40 transition-colors cursor-pointer"
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
				<span class="text-3xl font-extrabold tracking-tight text-white font-mono">
					{progressPercent}%
				</span>
				<span class="text-xs text-zinc-400 font-mono">
					({formatBytes(stats?.bytesTransferred || 0)} / {formatBytes(stats?.totalBytes || 0)})
				</span>
			</div>
			<div class="text-xs font-mono text-indigo-400 font-medium flex items-center gap-1">
				<Gauge class="w-3.5 h-3.5" />
				<span>{formatSpeed(stats?.speed || 0)}</span>
			</div>
		</div>

		<!-- The Animated Bar Container -->
		<div class="w-full h-3.5 bg-zinc-950 rounded-full p-0.5 overflow-hidden border border-zinc-800 relative">
			<div
				class="h-full rounded-full transition-all duration-300 ease-out relative overflow-hidden {isPaused
					? 'bg-amber-500'
					: 'bg-gradient-to-r from-indigo-500 via-indigo-400 to-cyan-400 shadow-sm shadow-indigo-500/50'}"
				style="width: {Math.max(1, Math.min(100, stats?.progress || 0))}%;"
			>
				<!-- Subtle shimmer animation overlay when transferring -->
				{#if !isPaused}
					<div class="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer"></div>
				{/if}
			</div>
		</div>
	</div>

	<!-- Telemetry Metrics Grid -->
	<div class="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 text-xs">
		<!-- Speed -->
		<div class="p-3 rounded-xl bg-zinc-950/60 border border-zinc-800/80">
			<div class="flex items-center gap-1.5 text-zinc-400 mb-1">
				<Activity class="w-3.5 h-3.5 text-indigo-400" />
				<span>Transfer Speed</span>
			</div>
			<div class="font-mono text-sm font-semibold text-zinc-100">
				{formatSpeed(stats?.speed || 0)}
			</div>
		</div>

		<!-- Time Remaining / ETA -->
		<div class="p-3 rounded-xl bg-zinc-950/60 border border-zinc-800/80">
			<div class="flex items-center gap-1.5 text-zinc-400 mb-1">
				<Timer class="w-3.5 h-3.5 text-cyan-400" />
				<span>Remaining (ETA)</span>
			</div>
			<div class="font-mono text-sm font-semibold text-zinc-100">
				{formatEta(stats?.eta || 0)}
			</div>
		</div>

		<!-- Elapsed Time -->
		<div class="p-3 rounded-xl bg-zinc-950/60 border border-zinc-800/80">
			<div class="flex items-center gap-1.5 text-zinc-400 mb-1">
				<Clock class="w-3.5 h-3.5 text-amber-400" />
				<span>Elapsed Time</span>
			</div>
			<div class="font-mono text-sm font-semibold text-zinc-100">
				{formatDuration(stats?.elapsedTime || 0)}
			</div>
		</div>

		<!-- Chunks count -->
		<div class="p-3 rounded-xl bg-zinc-950/60 border border-zinc-800/80">
			<div class="flex items-center gap-1.5 text-zinc-400 mb-1">
				<Layers class="w-3.5 h-3.5 text-emerald-400" />
				<span>Chunks Streamed</span>
			</div>
			<div class="font-mono text-sm font-semibold text-zinc-100">
				{stats?.currentChunk || 0} / {stats?.totalChunks || 0}
			</div>
		</div>
	</div>

	<!-- Flow Control Backpressure status (Sender view) -->
	{#if isSender && typeof stats?.bufferPercentage === 'number' && stats.bufferPercentage > 10}
		<div class="mt-3 pt-3 border-t border-zinc-800/60 flex items-center justify-between text-[11px] text-zinc-400">
			<div class="flex items-center gap-1.5">
				<Database class="w-3 h-3 text-cyan-400" />
				<span>WebRTC SCTP Buffer Backpressure:</span>
			</div>
			<div class="flex items-center gap-2">
				<div class="w-20 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
					<div class="h-full bg-cyan-400 rounded-full" style="width: {stats.bufferPercentage}%;"></div>
				</div>
				<span class="font-mono text-zinc-300">{Math.round(stats.bufferPercentage)}%</span>
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
