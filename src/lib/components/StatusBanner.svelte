<script>
	import {
		AlertTriangle,
		AlertCircle,
		WifiOff,
		RefreshCw,
		RotateCcw,
		XCircle,
		Info
	} from '@lucide/svelte';

	let {
		warning = '',
		error = '',
		retryCount = 0,
		onRetry = () => {},
		onReset = () => {}
	} = $props();
</script>

{#if error}
	<div class="w-full bg-rose-950/40 border border-rose-800/60 rounded-2xl p-4 sm:p-5 text-rose-200 shadow-lg mb-4 animate-in fade-in duration-200">
		<div class="flex items-start gap-3">
			<div class="p-2 rounded-xl bg-rose-900/60 border border-rose-700/50 text-rose-300 flex-shrink-0 mt-0.5">
				<AlertCircle class="w-5 h-5" />
			</div>
			<div class="flex-1 min-w-0">
				<h4 class="text-sm font-semibold text-rose-100 mb-1">Transfer Interrupted</h4>
				<p class="text-xs text-rose-300 leading-relaxed mb-3">
					{error}
				</p>
				<div class="flex items-center gap-2">
					<button
						type="button"
						onclick={onRetry}
						class="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-rose-800 hover:bg-rose-700 text-white text-xs font-semibold shadow transition-colors cursor-pointer"
					>
						<RefreshCw class="w-3.5 h-3.5" />
						<span>Retry Transfer</span>
					</button>

					<button
						type="button"
						onclick={onReset}
						class="px-3 py-1.5 rounded-lg bg-zinc-900/80 hover:bg-zinc-800 text-zinc-300 text-xs font-medium border border-zinc-700/60 transition-colors cursor-pointer"
					>
						Start New Transfer
					</button>
				</div>
			</div>
		</div>
	</div>
{:else if warning}
	<div class="w-full bg-amber-950/30 border border-amber-800/50 rounded-2xl p-3.5 sm:p-4 text-amber-200 shadow-md mb-4 animate-in fade-in duration-200">
		<div class="flex items-center gap-3">
			<div class="p-1.5 rounded-lg bg-amber-900/50 border border-amber-700/40 text-amber-300 flex-shrink-0">
				<AlertTriangle class="w-4 h-4 animate-pulse" />
			</div>
			<div class="flex-1 min-w-0">
				<p class="text-xs text-amber-200 font-medium">
					{warning}
				</p>
			</div>
			<button
				type="button"
				onclick={onRetry}
				class="flex items-center gap-1 px-2.5 py-1 rounded-md bg-amber-900/60 hover:bg-amber-800 text-amber-200 text-xs font-medium border border-amber-700/50 transition-colors cursor-pointer flex-shrink-0"
			>
				<RefreshCw class="w-3 h-3" />
				<span>Reconnect</span>
			</button>
		</div>
	</div>
{/if}
