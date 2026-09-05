<script>
	import { Copy, Check, QrCode, Link2, KeyRound, Sparkles } from '@lucide/svelte';
	import { theme } from '$lib/utils/theme.svelte.js';
	import { playChime } from '$lib/utils/sound.js';

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
			playChime('click');
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

<div
	class="w-full rounded-md p-5 sm:p-6 border transition-colors duration-200 {theme.current === 'dark'
		? 'bg-[#21262F] border-[#57707A]/40 shadow-lg'
		: 'bg-[#ECEAE9] border-[#C5BAC4] shadow-md'}"
>
	<!-- Top indicator bar -->
	<div class="flex items-center justify-between gap-3 mb-5">
		<div class="flex items-center gap-2.5">
			<span class="flex h-2.5 w-2.5 relative">
				{#if peerConnected}
					<span class="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
				{:else}
					<span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#7B919C] opacity-75"></span>
					<span class="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#57707A]"></span>
				{/if}
			</span>
			<span
				class="text-xs sm:text-sm font-semibold tracking-tight {peerConnected
					? 'text-emerald-500'
					: (theme.current === 'dark' ? 'text-[#DEDCDC]' : 'text-[#191D23]')}"
			>
				{peerConnected ? 'Receiver Connected • Ready' : 'Waiting for receiver to open link...'}
			</span>
		</div>

		<button
			type="button"
			onclick={onShowQr}
			class="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md border transition-colors cursor-pointer {theme.current === 'dark'
				? 'bg-[#16191E] hover:bg-[#191D23] text-[#DEDCDC] border-[#57707A]/50'
				: 'bg-[#DFDCDB] hover:bg-[#D2CECE] text-[#191D23] border-[#989DAA]'}"
		>
			<QrCode class="w-3.5 h-3.5 text-[#57707A]" />
			<span>Show QR</span>
		</button>
	</div>

	<!-- Sharable Link Box -->
	<div class="mb-4">
		<label
			class="block text-xs font-semibold mb-1.5 flex items-center gap-1.5 {theme.current === 'dark'
				? 'text-[#989DAA]'
				: 'text-[#57707A]'}"
		>
			<Link2 class="w-3.5 h-3.5 text-[#57707A]" />
			<span>Sharable WebRTC Link</span>
		</label>
		<div class="flex items-center gap-2">
			<div class="relative flex-1">
				<input
					type="text"
					readonly
					value={shareUrl}
					class="w-full rounded-md px-3.5 py-2.5 text-xs sm:text-sm font-mono border focus:outline-none select-all transition-colors {theme.current === 'dark'
						? 'bg-[#16191E] border-[#57707A]/50 text-[#DEDCDC] focus:border-[#7B919C]'
						: 'bg-[#DFDCDB] border-[#989DAA] text-[#191D23] focus:border-[#57707A]'}"
				/>
			</div>
			<button
				type="button"
				onclick={() => copyToClipboard(shareUrl, false)}
				class="flex items-center gap-1.5 px-4 py-2.5 rounded-md font-semibold text-xs sm:text-sm text-white transition-all duration-150 cursor-pointer active:translate-y-px {copiedLink
					? 'bg-emerald-600 border border-emerald-500'
					: (theme.current === 'dark'
						? 'bg-[#57707A] hover:bg-[#7B919C] border border-[#7B919C]'
						: 'bg-[#57707A] hover:bg-[#191D23] border border-[#57707A]')}"
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
	<div
		class="pt-3 border-t flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs {theme.current === 'dark'
			? 'border-[#57707A]/30 text-[#989DAA]'
			: 'border-[#C5BAC4] text-[#57707A]'}"
	>
		<div class="flex items-center gap-2">
			<KeyRound class="w-3.5 h-3.5 text-[#7B919C]" />
			<span>Direct Session Code:</span>
			<span
				class="font-mono text-xs sm:text-sm font-bold px-2 py-0.5 rounded-md border {theme.current === 'dark'
					? 'bg-[#16191E] border-[#57707A]/60 text-[#DEDCDC]'
					: 'bg-[#DFDCDB] border-[#989DAA] text-[#191D23]'}"
			>
				{sessionId}
			</span>
			<button
				type="button"
				onclick={() => copyToClipboard(sessionId, true)}
				class="p-1 cursor-pointer transition-colors {theme.current === 'dark'
					? 'text-[#989DAA] hover:text-[#DEDCDC]'
					: 'text-[#57707A] hover:text-[#191D23]'}"
				title="Copy session code"
			>
				{#if copiedCode}
					<Check class="w-3.5 h-3.5 text-emerald-500" />
				{:else}
					<Copy class="w-3.5 h-3.5" />
				{/if}
			</button>
		</div>

		<p class="text-[11px] flex items-center gap-1 font-mono">
			<Sparkles class="w-3 h-3 text-[#7B919C]" />
			Keep tab open to stream directly.
		</p>
	</div>
</div>
