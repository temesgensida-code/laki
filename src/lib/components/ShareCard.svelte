<script>
	import { Copy, Check, QrCode, Link2, KeyRound, Loader2, Sparkles } from '@lucide/svelte';

	let {
		shareUrl = '',
		sessionId = '',
		peerConnected = false,
		onShowQr
	} = $props();

	let copiedLink = $state(false);
	let copiedCode = $state(false);

	async function copyToClipboard(text, isCode = false) {
		try {
			await navigator.clipboard.writeText(text);
			if (isCode) {
				copiedCode = true;
				setTimeout(() => (copiedCode = false), 2000);
			} else {
				copiedLink = true;
				setTimeout(() => (copiedLink = false), 2000);
			}
		} catch (err) {
			console.error('Failed to copy text:', err);
		}
	}
</script>

<div class="w-full bg-zinc-900/80 border border-zinc-800 rounded-2xl p-5 sm:p-6 shadow-xl relative overflow-hidden">
	<!-- Top indicator band -->
	<div class="flex items-center justify-between gap-3 mb-5">
		<div class="flex items-center gap-2.5">
			<span class="flex h-3 w-3 relative">
				{#if peerConnected}
					<span class="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
				{:else}
					<span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
					<span class="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
				{/if}
			</span>
			<span class="text-sm font-medium {peerConnected ? 'text-emerald-400' : 'text-amber-400'}">
				{peerConnected ? 'Receiver Connected • Ready' : 'Waiting for receiver to open link...'}
			</span>
		</div>

		<button
			type="button"
			onclick={onShowQr}
			class="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-zinc-800 hover:bg-zinc-750 text-zinc-300 border border-zinc-700/60 hover:border-zinc-600 transition-colors cursor-pointer"
		>
			<QrCode class="w-3.5 h-3.5 text-indigo-400" />
			<span>Show QR</span>
		</button>
	</div>

	<!-- Sharable Link Box -->
	<div class="mb-4">
		<label class="block text-xs font-medium text-zinc-400 mb-1.5 flex items-center gap-1.5">
			<Link2 class="w-3.5 h-3.5 text-indigo-400" />
			<span>Sharable WebRTC Link</span>
		</label>
		<div class="flex items-center gap-2">
			<div class="relative flex-1">
				<input
					type="text"
					readonly
					value={shareUrl}
					class="w-full bg-zinc-950/80 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-mono text-zinc-200 focus:outline-none focus:border-indigo-500/80 select-all"
				/>
			</div>
			<button
				type="button"
				onclick={() => copyToClipboard(shareUrl, false)}
				class="flex items-center gap-1.5 px-4 py-2.5 rounded-xl font-medium text-xs sm:text-sm transition-all duration-150 cursor-pointer {copiedLink
					? 'bg-emerald-600 text-white shadow-md shadow-emerald-500/20'
					: 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/20 active:scale-[0.98]'}"
			>
				{#if copiedLink}
					<Check class="w-4 h-4 text-white" />
					<span>Copied!</span>
				{:else}
					<Copy class="w-4 h-4 text-white" />
					<span>Copy Link</span>
				{/if}
			</button>
		</div>
	</div>

	<!-- Join Code Alternate -->
	<div class="pt-3 border-t border-zinc-800/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
		<div class="flex items-center gap-2">
			<KeyRound class="w-3.5 h-3.5 text-zinc-400" />
			<span class="text-xs text-zinc-400">Direct Session Code:</span>
			<span class="font-mono text-xs sm:text-sm font-bold text-zinc-100 bg-zinc-950 px-2 py-0.5 rounded border border-zinc-800">
				{sessionId}
			</span>
			<button
				type="button"
				onclick={() => copyToClipboard(sessionId, true)}
				class="text-zinc-400 hover:text-zinc-200 transition-colors p-1 cursor-pointer"
				title="Copy session code"
			>
				{#if copiedCode}
					<Check class="w-3.5 h-3.5 text-emerald-400" />
				{:else}
					<Copy class="w-3.5 h-3.5" />
				{/if}
			</button>
		</div>

		<p class="text-[11px] text-zinc-400 flex items-center gap-1">
			<Sparkles class="w-3 h-3 text-indigo-400" />
			Keep this browser tab open to stream file data directly.
		</p>
	</div>
</div>
