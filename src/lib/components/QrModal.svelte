<script>
	import { X, QrCode, Smartphone } from '@lucide/svelte';
	import QRCode from 'qrcode';
	import { theme } from '$lib/utils/theme.svelte.js';

	let {
		isOpen = false,
		url = '',
		onClose = () => {}
	} = $props();

	let qrDataUrl = $state('');

	$effect(() => {
		if (isOpen && url) {
			const isDark = theme.current === 'dark';
			QRCode.toDataURL(url, {
				width: 320,
				margin: 2,
				color: {
					dark: isDark ? '#DEDCDC' : '#191D23',
					light: isDark ? '#16191E' : '#DFDCDB'
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
		class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200"
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

		<!-- Modal Card with edgy geometry -->
		<div
			class="relative w-full max-w-sm rounded-md p-6 border shadow-2xl text-center z-10 transition-colors {theme.current === 'dark'
				? 'bg-[#21262F] border-[#57707A]/40'
				: 'bg-[#ECEAE9] border-[#C5BAC4]'}"
			role="dialog"
			aria-modal="true"
			aria-labelledby="qr-modal-title"
		>
			<button
				type="button"
				onclick={onClose}
				class="absolute top-4 right-4 p-1.5 rounded-md border transition-colors cursor-pointer {theme.current === 'dark'
					? 'bg-[#16191E] text-[#989DAA] hover:text-[#DEDCDC] border-[#57707A]/50'
					: 'bg-[#DFDCDB] text-[#57707A] hover:text-[#191D23] border-[#989DAA]'}"
				aria-label="Close"
			>
				<X class="w-4 h-4" />
			</button>

			<div
				class="inline-flex items-center justify-center w-10 h-10 rounded-md border mb-3 transition-colors {theme.current === 'dark'
					? 'bg-[#16191E] border-[#57707A]/60 text-[#7B919C]'
					: 'bg-[#DFDCDB] border-[#989DAA] text-[#57707A]'}"
			>
				<QrCode class="w-5 h-5" />
			</div>

			<h3
				id="qr-modal-title"
				class="text-lg font-bold tracking-tight mb-1 {theme.current === 'dark'
					? 'text-[#DEDCDC]'
					: 'text-[#191D23]'}"
			>
				Scan to Receive
			</h3>
			<p
				class="text-xs mb-5 {theme.current === 'dark'
					? 'text-[#989DAA]'
					: 'text-[#57707A]'}"
			>
				Point your phone camera at this QR code to open the transfer link directly.
			</p>

			<!-- QR Code Image Frame -->
			<div
				class="p-4 rounded-md border inline-block mx-auto mb-4 {theme.current === 'dark'
					? 'bg-[#16191E] border-[#57707A]/50'
					: 'bg-[#DFDCDB] border-[#989DAA]'}"
			>
				{#if qrDataUrl}
					<img src={qrDataUrl} alt="Transfer QR Code" class="w-56 h-56 rounded-sm object-contain" />
				{:else}
					<div
						class="w-56 h-56 flex items-center justify-center text-xs font-mono {theme.current === 'dark'
							? 'text-[#989DAA]'
							: 'text-[#57707A]'}"
					>
						Generating QR code...
					</div>
				{/if}
			</div>

			<div
				class="flex items-center justify-center gap-1.5 text-xs font-mono {theme.current === 'dark'
					? 'text-[#989DAA]'
					: 'text-[#57707A]'}"
			>
				<Smartphone class="w-3.5 h-3.5 text-[#57707A]" />
				<span>Works on any iOS / Android browser</span>
			</div>
		</div>
	</div>
{/if}
