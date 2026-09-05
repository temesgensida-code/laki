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

	let {
		fileMeta = null,
		isReceiver = false,
		isReadyToAccept = false,
		onAccept = () => {},
		onReject = () => {}
	} = $props();

	let fileType = $derived(fileMeta ? getFileTypeInfo(fileMeta.name, fileMeta.type) : null);
</script>

{#if fileMeta}
	<div class="w-full bg-zinc-900/90 border border-zinc-800 rounded-2xl p-5 sm:p-6 shadow-xl relative overflow-hidden">
		<div class="flex items-start gap-4">
			<!-- File Icon categorized -->
			<div class="flex-shrink-0 w-14 h-14 rounded-2xl flex items-center justify-center border {fileType?.color || 'text-zinc-400 bg-zinc-800 border-zinc-700'}">
				{#if fileType?.category === 'image'}
					<FileImage class="w-7 h-7" />
				{:else if fileType?.category === 'video'}
					<FileVideo class="w-7 h-7" />
				{:else if fileType?.category === 'audio'}
					<FileAudio class="w-7 h-7" />
				{:else if fileType?.category === 'archive'}
					<FileArchive class="w-7 h-7" />
				{:else if fileType?.category === 'code'}
					<FileCode class="w-7 h-7" />
				{:else if fileType?.category === 'document' || fileType?.category === 'pdf'}
					<FileText class="w-7 h-7" />
				{:else}
					<File class="w-7 h-7" />
				{/if}
			</div>

			<!-- Metadata -->
			<div class="flex-1 min-w-0">
				<div class="flex items-center gap-2 mb-1">
					<span class="text-xs font-mono px-2 py-0.5 rounded-full border {fileType?.color || 'bg-zinc-800 text-zinc-300 border-zinc-700'}">
						{fileType?.badge}
					</span>
					<span class="text-xs text-zinc-400 font-mono">
						{formatBytes(fileMeta.size)}
					</span>
				</div>
				<h3 class="text-base sm:text-lg font-semibold text-zinc-100 truncate" title={fileMeta.name}>
					{fileMeta.name}
				</h3>

				<div class="flex items-center gap-3 mt-2 text-xs text-zinc-400 font-mono">
					<div class="flex items-center gap-1">
						<Layers class="w-3.5 h-3.5 text-zinc-400" />
						<span>{fileMeta.totalChunks?.toLocaleString() || 0} chunks (64KB each)</span>
					</div>
					<div class="hidden sm:flex items-center gap-1 text-emerald-400">
						<ShieldCheck class="w-3.5 h-3.5" />
						<span>Direct P2P Stream</span>
					</div>
				</div>
			</div>
		</div>

		<!-- Receiver Action Buttons if Ready to Accept -->
		{#if isReceiver && isReadyToAccept}
			<div class="mt-6 pt-5 border-t border-zinc-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
				<div class="text-xs text-zinc-400">
					Sender has prepared this file. Click <strong class="text-zinc-200">Accept</strong> to begin the peer-to-peer data stream.
				</div>
				<div class="flex items-center gap-2.5">
					<button
						type="button"
						onclick={onReject}
						class="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl border border-zinc-700/80 hover:border-zinc-600 bg-zinc-800/60 hover:bg-zinc-800 text-zinc-300 text-sm font-medium transition-colors cursor-pointer flex items-center justify-center gap-1.5"
					>
						<XCircle class="w-4 h-4 text-zinc-400" />
						<span>Decline</span>
					</button>

					<button
						type="button"
						onclick={onAccept}
						class="flex-1 sm:flex-initial px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-semibold text-sm shadow-lg shadow-emerald-600/25 transition-all duration-150 active:scale-[0.98] cursor-pointer flex items-center justify-center gap-2"
					>
						<Download class="w-4 h-4" />
						<span>Accept & Download</span>
					</button>
				</div>
			</div>
		{/if}
	</div>
{/if}
