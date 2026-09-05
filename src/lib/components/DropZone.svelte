<script>
	import { UploadCloud, FileUp, Shield, Cpu, ArrowRight } from '@lucide/svelte';

	let { onFileSelected } = $props();

	let isDragging = $state(false);
	let fileInputElement;

	function handleDrop(e) {
		e.preventDefault();
		isDragging = false;
		if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
			const file = e.dataTransfer.files[0];
			if (file) {
				onFileSelected(file);
			}
		}
	}

	function handleDragOver(e) {
		e.preventDefault();
		isDragging = true;
	}

	function handleDragLeave(e) {
		e.preventDefault();
		isDragging = false;
	}

	function handleInputChange(e) {
		const target = e.target;
		if (target?.files && target.files.length > 0) {
			const file = target.files[0];
			if (file) {
				onFileSelected(file);
			}
		}
	}
</script>

<div class="w-full">
	<!-- Hidden file input -->
	<input
		type="file"
		bind:this={fileInputElement}
		onchange={handleInputChange}
		class="hidden"
		id="file-upload-input"
	/>

	<label
		for="file-upload-input"
		ondrop={handleDrop}
		ondragover={handleDragOver}
		ondragleave={handleDragLeave}
		class="relative flex flex-col items-center justify-center p-8 sm:p-12 rounded-2xl border-2 border-dashed cursor-pointer transition-all duration-200 group overflow-hidden {isDragging
			? 'border-indigo-400 bg-indigo-500/10 scale-[1.01] shadow-xl shadow-indigo-500/10'
			: 'border-zinc-800 hover:border-zinc-700 bg-zinc-900/40 hover:bg-zinc-900/70'}"
	>
		<!-- Ambient background glow on hover -->
		<div class="absolute -inset-1 bg-gradient-to-r from-indigo-500/5 to-cyan-500/5 blur-xl pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity"></div>

		<!-- Icon container -->
		<div class="relative mb-5 flex items-center justify-center w-16 h-16 rounded-2xl bg-zinc-800/80 border border-zinc-700/80 text-indigo-400 shadow-inner group-hover:scale-105 group-hover:border-indigo-500/50 group-hover:text-indigo-300 transition-all duration-200">
			<UploadCloud class="w-8 h-8 transition-transform group-hover:-translate-y-0.5" />
			<div class="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-indigo-600 border-2 border-zinc-900 flex items-center justify-center text-white">
				<FileUp class="w-3.5 h-3.5" />
			</div>
		</div>

		<!-- Main instructions -->
		<h3 class="text-lg sm:text-xl font-semibold text-zinc-100 mb-1.5 text-center">
			Drop a file here, or <span class="text-indigo-400 underline decoration-indigo-400/40 underline-offset-4 group-hover:text-indigo-300">browse</span>
		</h3>
		<p class="text-sm text-zinc-400 text-center max-w-md mb-6">
			Stream any size file directly from your machine to another device over high-speed WebRTC peer-to-peer data channels.
		</p>

		<!-- Feature Badges -->
		<div class="flex flex-wrap items-center justify-center gap-2 sm:gap-3 text-xs text-zinc-400">
			<div class="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-zinc-800/60 border border-zinc-700/50">
				<Cpu class="w-3.5 h-3.5 text-cyan-400" />
				<span>64 KB Chunk Streaming</span>
			</div>
			<div class="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-zinc-800/60 border border-zinc-700/50">
				<Shield class="w-3.5 h-3.5 text-emerald-400" />
				<span>Zero Cloud Storage</span>
			</div>
			<div class="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-zinc-800/60 border border-zinc-700/50">
				<ArrowRight class="w-3.5 h-3.5 text-indigo-400" />
				<span>Unlimited Size</span>
			</div>
		</div>
	</label>
</div>
