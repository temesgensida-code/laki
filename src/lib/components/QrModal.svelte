<script>
	import { X, QrCode, Smartphone } from '@lucide/svelte';
	import QRCode from 'qrcode';

	let {
		isOpen = false,
		url = '',
		onClose = () => {}
	} = $props();

	let qrDataUrl = $state('');

	$effect(() => {
		if (isOpen && url) {
			QRCode.toDataURL(url, {
				width: 320,
				margin: 2,
				color: {
					dark: '#ffffff',
					light: '#090b10'
				}
			})
				.then((data) => {
					qrDataUrl = data;
				})
				.catch((err) => {
					console.error('QR code generation failed:', err);
				});
		}
	});

	function handleKeydown(e) {
		if (e.key === 'Escape') {
			onClose();
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

{#if isOpen}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
		tabindex="-1"
		role="presentation"
	>
		<!-- Backdrop click overlay -->
		<button
			type="button"
			class="absolute inset-0 w-full h-full cursor-default bg-transparent border-none"
			onclick={onClose}
			aria-label="Close modal overlay"
		></button>

		<!-- Modal Card -->
		<div
			class="relative w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-2xl text-center z-10"
			role="dialog"
			aria-modal="true"
			aria-labelledby="qr-modal-title"
		>
			<button
				type="button"
				onclick={onClose}
				class="absolute top-4 right-4 p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors cursor-pointer"
				aria-label="Close"
			>
				<X class="w-4 h-4" />
			</button>

			<div class="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 mb-3">
				<QrCode class="w-5 h-5" />
			</div>

			<h3 id="qr-modal-title" class="text-lg font-semibold text-zinc-100 mb-1">
				Scan to Receive
			</h3>
			<p class="text-xs text-zinc-400 mb-5">
				Point your phone camera at this QR code to open the transfer link directly on mobile.
			</p>

			<!-- QR Code Image Frame -->
			<div class="p-4 bg-[#090b10] border border-zinc-800 rounded-xl inline-block mx-auto mb-4 shadow-inner">
				{#if qrDataUrl}
					<img src={qrDataUrl} alt="Transfer QR Code" class="w-56 h-56 rounded-lg object-contain" />
				{:else}
					<div class="w-56 h-56 flex items-center justify-center text-xs text-zinc-400">
						Generating QR code...
					</div>
				{/if}
			</div>

			<div class="flex items-center justify-center gap-1.5 text-xs text-zinc-400">
				<Smartphone class="w-3.5 h-3.5 text-indigo-400" />
				<span>Works on any iOS / Android browser</span>
			</div>
		</div>
	</div>
{/if}
