<script>
	import {
		File,
		FileText,
		FileCode,
		FileArchive,
		FileAudio,
		FileVideo,
		FileImage,
		Download,
		XCircle,
		ShieldCheck,
		Layers
	} from '@lucide/svelte';
	import { formatBytes, getFileTypeInfo } from '$lib/utils/formatters.js';
	import { theme } from '$lib/utils/theme.svelte.js';
	import { playChime } from '$lib/utils/sound.js';

	let {
		fileMeta = null,
		isReceiver = false,
		isReadyToAccept = false,
		onAccept = () => {},
		onReject = () => {}
	} = $props();

	let fileType = $derived(fileMeta ? getFileTypeInfo(fileMeta.name, fileMeta.type) : null);

	function handleAccept() {
		playChime('click');
		onAccept();
	}

	function handleReject() {
		playChime('click');
		onReject();
	}
</script>

{#if fileMeta}
	<div
		class="w-full rounded-md p-5 sm:p-6 border transition-colors duration-200 {theme.current === 'dark'
			? 'bg-[#21262F] border-[#57707A]/40 shadow-lg'
			: 'bg-[#ECEAE9] border-[#C5BAC4] shadow-md'}"
	>
		<div class="flex items-start gap-4">
			<!-- File Icon with edgy geometry -->
			<div
				class="flex-shrink-0 w-12 sm:w-14 h-12 sm:h-14 rounded-md flex items-center justify-center border transition-colors {theme.current === 'dark'
					? 'bg-[#16191E] border-[#57707A]/60 text-[#7B919C]'
					: 'bg-[#DFDCDB] border-[#989DAA] text-[#57707A]'}"
			>
				{#if fileType?.category === 'image'}
					<FileImage class="w-6 sm:w-7 h-6 sm:h-7" />
				{:else if fileType?.category === 'video'}
					<FileVideo class="w-6 sm:w-7 h-6 sm:h-7" />
				{:else if fileType?.category === 'audio'}
					<FileAudio class="w-6 sm:w-7 h-6 sm:h-7" />
				{:else if fileType?.category === 'archive'}
					<FileArchive class="w-6 sm:w-7 h-6 sm:h-7" />
				{:else if fileType?.category === 'code'}
					<FileCode class="w-6 sm:w-7 h-6 sm:h-7" />
				{:else if fileType?.category === 'document' || fileType?.category === 'pdf'}
					<FileText class="w-6 sm:w-7 h-6 sm:h-7" />
				{:else}
					<File class="w-6 sm:w-7 h-6 sm:h-7" />
				{/if}
			</div>

			<!-- Metadata -->
			<div class="flex-1 min-w-0">
				<div class="flex items-center gap-2 mb-1">
					<span
						class="text-xs font-mono px-2 py-0.5 rounded-sm border uppercase {theme.current === 'dark'
							? 'bg-[#16191E] border-[#57707A]/50 text-[#DEDCDC]'
							: 'bg-[#DFDCDB] border-[#989DAA] text-[#191D23]'}"
					>
						{fileType?.badge}
					</span>
					<span
						class="text-xs font-mono {theme.current === 'dark'
							? 'text-[#989DAA]'
							: 'text-[#57707A]'}"
					>
						{formatBytes(fileMeta.size)}
					</span>
				</div>
				<h3
					class="text-base sm:text-lg font-bold tracking-tight truncate {theme.current === 'dark'
						? 'text-[#DEDCDC]'
						: 'text-[#191D23]'}"
					title={fileMeta.name}
				>
					{fileMeta.name}
				</h3>

				<div
					class="flex items-center gap-3 mt-2 text-xs font-mono {theme.current === 'dark'
						? 'text-[#989DAA]'
						: 'text-[#57707A]'}"
				>
					<div class="flex items-center gap-1">
						<Layers class="w-3.5 h-3.5 text-[#7B919C]" />
						<span>{fileMeta.totalChunks?.toLocaleString() || 0} chunks (64KB each)</span>
					</div>
					<div class="hidden sm:flex items-center gap-1 text-[#57707A] font-semibold">
						<ShieldCheck class="w-3.5 h-3.5" />
						<span>Direct P2P Stream</span>
					</div>
				</div>
			</div>
		</div>

		<!-- Receiver Action Buttons if Ready to Accept -->
		{#if isReceiver && isReadyToAccept}
			<div
				class="mt-5 pt-4 border-t flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 {theme.current === 'dark'
					? 'border-[#57707A]/30'
					: 'border-[#C5BAC4]'}"
			>
				<div
					class="text-xs {theme.current === 'dark'
						? 'text-[#989DAA]'
						: 'text-[#57707A]'}"
				>
					Sender prepared this file. Click <strong class="{theme.current === 'dark' ? 'text-[#DEDCDC]' : 'text-[#191D23]'}">Accept</strong> to start transfer.
				</div>
				<div class="flex items-center gap-2">
					<button
						type="button"
						onclick={handleReject}
						class="flex-1 sm:flex-initial px-4 py-2 rounded-md border text-xs sm:text-sm font-semibold transition-colors cursor-pointer flex items-center justify-center gap-1.5 active:translate-y-px {theme.current === 'dark'
							? 'bg-[#16191E] hover:bg-[#191D23] text-[#DEDCDC] border-[#57707A]/50'
							: 'bg-[#DFDCDB] hover:bg-[#D2CECE] text-[#191D23] border-[#989DAA]'}"
					>
						<XCircle class="w-4 h-4 text-[#989DAA]" />
						<span>Decline</span>
					</button>

					<button
						type="button"
						onclick={handleAccept}
						class="flex-1 sm:flex-initial px-5 py-2 rounded-md bg-[#57707A] hover:bg-[#7B919C] text-white font-semibold text-xs sm:text-sm shadow border border-[#7B919C] transition-all cursor-pointer flex items-center justify-center gap-2 active:translate-y-px"
					>
						<Download class="w-4 h-4" />
						<span>Accept & Download</span>
					</button>
				</div>
			</div>
		{/if}
	</div>
{/if}
