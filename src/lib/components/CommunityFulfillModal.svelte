<script>
	import { X, UploadCloud, File, AlertCircle, Loader2, CheckCircle2, Clock } from '@lucide/svelte';
	import { theme } from '$lib/utils/theme.svelte.js';
	import { playChime } from '$lib/utils/sound.js';

	/**
	 * @type {{
	 *   isOpen: boolean,
	 *   requestItem: any,
	 *   onClose: () => void,
	 *   onSuccess: (fulfillmentData: any) => void
	 * }}
	 */
	let { isOpen = false, requestItem, onClose, onSuccess } = $props();

	/** @type {File | null} */
	let selectedFile = $state(null);
	let isUploading = $state(false);
	let errorMessage = $state('');
	let isDragging = $state(false);

	function formatBytes(bytes, decimals = 2) {
		if (!bytes) return '0 B';
		const k = 1024;
		const dm = decimals < 0 ? 0 : decimals;
		const sizes = ['B', 'KB', 'MB', 'GB'];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
	}

	function handleFileChange(e) {
		const files = e.target.files;
		if (files && files.length > 0) {
			selectedFile = files[0];
			errorMessage = '';
			playChime('click');
		}
	}

	function handleDragOver(e) {
		e.preventDefault();
		isDragging = true;
	}

	function handleDragLeave() {
		isDragging = false;
	}

	function handleDrop(e) {
		e.preventDefault();
		isDragging = false;
		if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
			selectedFile = e.dataTransfer.files[0];
			errorMessage = '';
			playChime('click');
		}
	}

	function handleClose() {
		if (isUploading) return;
		playChime('click');
		selectedFile = null;
		errorMessage = '';
		onClose();
	}

	async function handleUpload() {
		if (!selectedFile || !requestItem) return;

		// 100MB check
		if (selectedFile.size > 100 * 1024 * 1024) {
			errorMessage = 'File size exceeds maximum allowed size (100MB).';
			return;
		}

		isUploading = true;
		errorMessage = '';
		playChime('click');

		try {
			const formData = new FormData();
			formData.append('file', selectedFile);

			const res = await fetch(`/api/community/requests/${requestItem.id}/fulfill`, {
				method: 'POST',
				body: formData
			});

			const data = await res.json();

			if (!res.ok || !data.success) {
				errorMessage = data.error || 'Failed to upload resource. Please try again.';
				isUploading = false;
				return;
			}

			playChime('complete');
			onSuccess(data.fulfillment);
			onClose();
		} catch (err) {
			errorMessage = 'Network error while uploading file.';
		} finally {
			isUploading = false;
		}
	}
</script>

{#if isOpen && requestItem}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150"
		role="dialog"
		aria-modal="true"
	>
		<div
			class="relative w-full max-w-lg rounded-xl border shadow-2xl p-6 transition-all edgy-card {theme.current === 'dark'
				? 'bg-[#191D23] border-[#57707A]/40 text-[#DEDCDC]'
				: 'bg-[#ECEAE9] border-[#C5BAC4] text-[#191D23]'}"
		>
			<!-- Close Button -->
			<button
				type="button"
				onclick={handleClose}
				class="absolute top-4 right-4 p-1.5 rounded-lg border transition-colors cursor-pointer {theme.current === 'dark'
					? 'bg-[#21262F] border-[#57707A]/40 hover:bg-[#2A313C] text-[#989DAA]'
					: 'bg-[#DFDCDB] border-[#C5BAC4] hover:bg-[#DEDCDC] text-[#57707A]'}"
				aria-label="Close"
			>
				<X class="w-4 h-4" />
			</button>

			<!-- Header -->
			<div class="flex items-center gap-3 mb-4">
				<div
					class="w-10 h-10 rounded-lg flex items-center justify-center border {theme.current === 'dark'
						? 'bg-[#21262F] border-[#57707A]/50 text-emerald-400'
						: 'bg-[#DFDCDB] border-[#C5BAC4] text-emerald-600'}"
				>
					<UploadCloud class="w-5 h-5" />
				</div>
				<div>
					<h3 class="font-lexend text-base sm:text-lg font-bold">Fulfill Resource Request</h3>
					<p class="text-xs truncate max-w-[280px] sm:max-w-sm {theme.current === 'dark' ? 'text-[#989DAA]' : 'text-[#57707A]'}">
						For "{requestItem.title}"
					</p>
				</div>
			</div>

			{#if errorMessage}
				<div class="mb-4 p-3 rounded-lg text-xs font-medium border bg-red-500/10 border-red-500/30 text-red-400">
					{errorMessage}
				</div>
			{/if}

			<!-- Upload Dropzone -->
			<div
				role="region"
				aria-label="File upload dropzone"
				ondragover={handleDragOver}
				ondragleave={handleDragLeave}
				ondrop={handleDrop}
				class="border-2 border-dashed rounded-xl p-6 text-center transition-all {isDragging
					? 'border-emerald-400 bg-emerald-500/10'
					: (theme.current === 'dark' ? 'border-[#57707A]/40 bg-[#16191E]' : 'border-[#C5BAC4] bg-white')}"
			>
				{#if selectedFile}
					<div class="flex items-center justify-center gap-3">
						<div
							class="w-10 h-10 rounded-lg flex items-center justify-center border {theme.current === 'dark'
								? 'bg-[#21262F] border-[#57707A]/40 text-sky-400'
								: 'bg-[#DFDCDB] border-[#C5BAC4] text-sky-600'}"
						>
							<File class="w-5 h-5" />
						</div>
						<div class="text-left min-w-0 flex-1">
							<p class="text-xs font-semibold truncate">{selectedFile.name}</p>
							<p class="text-[11px] {theme.current === 'dark' ? 'text-[#989DAA]' : 'text-[#57707A]'}">
								{formatBytes(selectedFile.size)}
							</p>
						</div>
						<button
							type="button"
							onclick={() => { selectedFile = null; playChime('click'); }}
							class="p-1 rounded text-red-400 hover:bg-red-500/10 transition-colors"
						>
							<X class="w-4 h-4" />
						</button>
					</div>
				{:else}
					<UploadCloud class="w-10 h-10 mx-auto mb-2 {theme.current === 'dark' ? 'text-[#57707A]' : 'text-[#7B919C]'}" />
					<p class="text-xs font-semibold mb-1">Drag and drop file here, or browse</p>
					<p class="text-[11px] mb-3 {theme.current === 'dark' ? 'text-[#989DAA]' : 'text-[#57707A]'}">
						Any format accepted (up to 100MB)
					</p>

					<label
						class="inline-block px-3.5 py-1.5 text-xs font-semibold rounded-lg border transition-all cursor-pointer edgy-btn {theme.current === 'dark'
							? 'bg-[#21262F] border-[#57707A]/50 hover:bg-[#2A313C] text-[#DEDCDC]'
							: 'bg-[#ECEAE9] border-[#C5BAC4] hover:bg-[#DFDCDB] text-[#191D23]'}"
					>
						Browse File
						<input type="file" onchange={handleFileChange} class="hidden" />
					</label>
				{/if}
			</div>

			<!-- 24-Hour Expiration & Notification Callout -->
			<div class="mt-4 p-3 rounded-lg border text-xs leading-relaxed {theme.current === 'dark'
				? 'bg-[#16191E] border-[#57707A]/30 text-[#989DAA]'
				: 'bg-[#DFDCDB]/50 border-[#C5BAC4] text-[#57707A]'}">
				<div class="flex items-center gap-1.5 font-semibold text-amber-400 mb-1">
					<Clock class="w-3.5 h-3.5" />
					<span>24-Hour Availability Rule</span>
				</div>
				<p class="text-[11px]">
					Uploaded via the <strong>file.io API</strong>. The download link will automatically expire after <strong>24 hours</strong>. The requester and all waiting subscribers will immediately receive an email notification with the download link.
				</p>
			</div>

			<!-- Footer -->
			<div class="mt-5 flex items-center justify-end gap-2 border-t pt-4 {theme.current === 'dark' ? 'border-[#57707A]/20' : 'border-[#C5BAC4]/50'}">
				<button
					type="button"
					onclick={handleClose}
					disabled={isUploading}
					class="px-3.5 py-2 text-xs font-medium rounded-lg border transition-colors cursor-pointer {theme.current === 'dark'
						? 'border-[#57707A]/40 hover:bg-[#21262F] text-[#DEDCDC]'
						: 'border-[#C5BAC4] hover:bg-[#DFDCDB] text-[#191D23]'}"
				>
					Cancel
				</button>

				<button
					type="button"
					onclick={handleUpload}
					disabled={!selectedFile || isUploading}
					class="px-4 py-2 text-xs font-semibold rounded-lg border transition-all cursor-pointer flex items-center gap-1.5 edgy-btn {theme.current === 'dark'
						? 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed'
						: 'bg-emerald-700 hover:bg-emerald-800 text-white border-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed'}"
				>
					{#if isUploading}
						<Loader2 class="w-3.5 h-3.5 animate-spin" />
						<span>Uploading to file.io...</span>
					{:else}
						<UploadCloud class="w-3.5 h-3.5" />
						<span>Upload & Share</span>
					{/if}
				</button>
			</div>
		</div>
	</div>
{/if}
