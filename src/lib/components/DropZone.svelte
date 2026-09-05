<script>
	import { UploadCloud, FileUp, Shield, Cpu, ArrowRight } from '@lucide/svelte';
	import { theme } from '$lib/utils/theme.svelte.js';
	import { playChime } from '$lib/utils/sound.js';

	let { onFileSelected } = $props();

	let isDragging = $state(false);
	let fileInputElement;

	function handleDrop(e) {
		e.preventDefault();
		isDragging = false;
		if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
			const file = e.dataTransfer.files[0];
			if (file) {
				playChime('click');
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
				playChime('click');
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
		class="relative flex flex-col items-center justify-center p-8 sm:p-12 rounded-lg border-2 border-dashed cursor-pointer transition-all duration-200 group overflow-hidden {theme.current === 'dark'
			? (isDragging
				? 'border-[#7B919C] bg-[#57707A]/20 scale-[1.005]'
				: 'border-[#57707A]/40 hover:border-[#57707A] bg-[#21262F]/60 hover:bg-[#21262F]')
			: (isDragging
				? 'border-[#57707A] bg-[#C5BAC4]/40 scale-[1.005]'
				: 'border-[#C5BAC4] hover:border-[#7B919C] bg-[#ECEAE9] hover:bg-[#F2EFEB]')}"
	>
		<!-- Center icon container with edgy geometry -->
		<div
			class="relative mb-5 flex items-center justify-center w-16 h-16 rounded-md border transition-all duration-200 {theme.current === 'dark'
				? 'bg-[#16191E] border-[#57707A]/60 text-[#7B919C] group-hover:border-[#7B919C] group-hover:text-[#DEDCDC]'
				: 'bg-[#DFDCDB] border-[#989DAA] text-[#57707A] group-hover:border-[#57707A] group-hover:text-[#191D23]'}"
		>
			<UploadCloud class="w-8 h-8 transition-transform group-hover:-translate-y-0.5" />
			<div
				class="absolute -bottom-1 -right-1 w-6 h-6 rounded-sm flex items-center justify-center text-white bg-[#57707A] border {theme.current === 'dark'
					? 'border-[#191D23]'
					: 'border-[#DEDCDC]'}"
			>
				<FileUp class="w-3.5 h-3.5" />
			</div>
		</div>

		<!-- Main instructions -->
		<h3
			class="text-lg sm:text-xl font-bold tracking-tight mb-1.5 text-center transition-colors {theme.current === 'dark'
				? 'text-[#DEDCDC]'
				: 'text-[#191D23]'}"
		>
			Drop a file here, or
			<span
				class="underline decoration-2 underline-offset-4 {theme.current === 'dark'
					? 'text-[#7B919C] decoration-[#57707A] group-hover:text-[#DEDCDC]'
					: 'text-[#57707A] decoration-[#7B919C] group-hover:text-[#191D23]'}"
			>
				browse
			</span>
		</h3>
		<p
			class="text-xs sm:text-sm text-center max-w-md mb-6 leading-relaxed {theme.current === 'dark'
				? 'text-[#989DAA]'
				: 'text-[#57707A]'}"
		>
			Stream any size file directly between devices via peer-to-peer WebRTC data channels.
		</p>

		<!-- Feature Badges with edgy styling -->
		<div class="flex flex-wrap items-center justify-center gap-2 sm:gap-3 text-xs">
			<div
				class="flex items-center gap-1.5 px-2.5 py-1 rounded-md border font-mono {theme.current === 'dark'
					? 'bg-[#16191E] border-[#57707A]/40 text-[#989DAA]'
					: 'bg-[#DFDCDB] border-[#C5BAC4] text-[#57707A]'}"
			>
				<Cpu class="w-3.5 h-3.5 text-[#57707A]" />
				<span>64 KB Chunk Streaming</span>
			</div>
			<div
				class="flex items-center gap-1.5 px-2.5 py-1 rounded-md border font-mono {theme.current === 'dark'
					? 'bg-[#16191E] border-[#57707A]/40 text-[#989DAA]'
					: 'bg-[#DFDCDB] border-[#C5BAC4] text-[#57707A]'}"
			>
				<Shield class="w-3.5 h-3.5 text-[#7B919C]" />
				<span>Zero Cloud Storage</span>
			</div>
			<div
				class="flex items-center gap-1.5 px-2.5 py-1 rounded-md border font-mono {theme.current === 'dark'
					? 'bg-[#16191E] border-[#57707A]/40 text-[#989DAA]'
					: 'bg-[#DFDCDB] border-[#C5BAC4] text-[#57707A]'}"
			>
				<ArrowRight class="w-3.5 h-3.5 text-[#989DAA]" />
				<span>Unlimited Size</span>
			</div>
		</div>
	</label>
</div>
