<script>
	import { X, FilePlus2, ShieldCheck, Mail, Loader2 } from '@lucide/svelte';
	import { theme } from '$lib/utils/theme.svelte.js';
	import { playChime } from '$lib/utils/sound.js';

	/** 
	 * @type {{ 
	 *   isOpen: boolean, 
	 *   user: any,
	 *   onClose: () => void,
	 *   onSuccess: (newRequest: any) => void
	 * }} 
	 */
	let { isOpen = false, user, onClose, onSuccess } = $props();

	let title = $state('');
	let description = $state('');
	let email = $state('');
	let isSubmitting = $state(false);
	let errorMessage = $state('');

	// Sync default email when user changes
	$effect(() => {
		if (user?.email && !email) {
			email = user.email;
		}
	});

	function handleClose() {
		if (isSubmitting) return;
		playChime('click');
		errorMessage = '';
		onClose();
	}

	async function handleSubmit(e) {
		e.preventDefault();
		if (isSubmitting) return;

		errorMessage = '';
		const trimmedTitle = title.trim();
		const trimmedDesc = description.trim();
		const trimmedEmail = email.trim();

		if (!trimmedTitle || trimmedTitle.length < 3) {
			errorMessage = 'Please enter a title (at least 3 characters).';
			return;
		}

		if (!trimmedDesc || trimmedDesc.length < 5) {
			errorMessage = 'Please provide a clear description of the file you need.';
			return;
		}

		if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
			errorMessage = 'A valid notification email is required.';
			return;
		}

		isSubmitting = true;
		playChime('click');

		try {
			const res = await fetch('/api/community/requests', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					title: trimmedTitle,
					description: trimmedDesc,
					email: trimmedEmail
				})
			});

			const data = await res.json();

			if (!res.ok || !data.success) {
				errorMessage = data.error || 'Failed to submit request. Please try again.';
				isSubmitting = false;
				return;
			}

			playChime('complete');
			title = '';
			description = '';
			onSuccess(data.request);
			onClose();
		} catch (err) {
			errorMessage = 'Network error while submitting request.';
		} finally {
			isSubmitting = false;
		}
	}
</script>

{#if isOpen}
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
			<div class="flex items-center gap-3 mb-5">
				<div
					class="w-10 h-10 rounded-lg flex items-center justify-center border {theme.current === 'dark'
						? 'bg-[#21262F] border-[#57707A]/50 text-sky-400'
						: 'bg-[#DFDCDB] border-[#C5BAC4] text-sky-600'}"
				>
					<FilePlus2 class="w-5 h-5" />
				</div>
				<div>
					<h3 class="font-lexend text-base sm:text-lg font-bold">Ask the Community for a File</h3>
					<p class="text-xs {theme.current === 'dark' ? 'text-[#989DAA]' : 'text-[#57707A]'}">
						Post a request for volunteers to share via file.io (24h availability)
					</p>
				</div>
			</div>

			{#if errorMessage}
				<div class="mb-4 p-3 rounded-lg text-xs font-medium border bg-red-500/10 border-red-500/30 text-red-400">
					{errorMessage}
				</div>
			{/if}

			<!-- Form -->
			<form onsubmit={handleSubmit} class="space-y-4">
				<!-- Resource Title -->
				<div>
					<label for="req-title" class="block text-xs font-semibold mb-1.5">
						Resource / File Title <span class="text-red-400">*</span>
					</label>
					<input
						id="req-title"
						type="text"
						bind:value={title}
						placeholder="e.g. Ubuntu 24.04 Server ISO or React 19 Cheat Sheet"
						maxlength="150"
						required
						class="w-full px-3 py-2 text-xs rounded-lg border outline-none transition-all {theme.current === 'dark'
							? 'bg-[#16191E] border-[#57707A]/40 focus:border-[#7B919C] text-[#DEDCDC]'
							: 'bg-white border-[#C5BAC4] focus:border-[#57707A] text-[#191D23]'}"
					/>
				</div>

				<!-- Description -->
				<div>
					<label for="req-desc" class="block text-xs font-semibold mb-1.5">
						Description & Details <span class="text-red-400">*</span>
					</label>
					<textarea
						id="req-desc"
						bind:value={description}
						rows="3"
						placeholder="Explain what specific format, edition, or details you are looking for..."
						maxlength="2500"
						required
						class="w-full px-3 py-2 text-xs rounded-lg border outline-none transition-all resize-none {theme.current === 'dark'
							? 'bg-[#16191E] border-[#57707A]/40 focus:border-[#7B919C] text-[#DEDCDC]'
							: 'bg-white border-[#C5BAC4] focus:border-[#57707A] text-[#191D23]'}"
					></textarea>
				</div>

				<!-- Notification Email -->
				<div>
					<label for="req-email" class="block text-xs font-semibold mb-1.5 flex items-center justify-between">
						<span>Your Notification Email <span class="text-red-400">*</span></span>
						<span class="text-[11px] font-normal flex items-center gap-1 text-emerald-400">
							<ShieldCheck class="w-3.5 h-3.5" /> Site-only / Private
						</span>
					</label>
					<div class="relative">
						<div class="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-[#57707A]">
							<Mail class="w-3.5 h-3.5" />
						</div>
						<input
							id="req-email"
							type="email"
							bind:value={email}
							placeholder="you@example.com"
							required
							class="w-full pl-8 pr-3 py-2 text-xs rounded-lg border outline-none transition-all {theme.current === 'dark'
								? 'bg-[#16191E] border-[#57707A]/40 focus:border-[#7B919C] text-[#DEDCDC]'
								: 'bg-white border-[#C5BAC4] focus:border-[#57707A] text-[#191D23]'}"
						/>
					</div>
					<p class="text-[11px] mt-1.5 leading-normal {theme.current === 'dark' ? 'text-[#989DAA]' : 'text-[#57707A]'}">
						🔒 Your email address is kept strictly confidential on our server and is never published on the board. It is only used to alert you when a volunteer fulfills this file.
					</p>
				</div>

				<!-- Actions -->
				<div class="pt-3 flex items-center justify-end gap-2 border-t {theme.current === 'dark' ? 'border-[#57707A]/20' : 'border-[#C5BAC4]/50'}">
					<button
						type="button"
						onclick={handleClose}
						disabled={isSubmitting}
						class="px-3.5 py-2 text-xs font-medium rounded-lg border transition-colors cursor-pointer {theme.current === 'dark'
							? 'border-[#57707A]/40 hover:bg-[#21262F] text-[#DEDCDC]'
							: 'border-[#C5BAC4] hover:bg-[#DFDCDB] text-[#191D23]'}"
					>
						Cancel
					</button>

					<button
						type="submit"
						disabled={isSubmitting}
						class="px-4 py-2 text-xs font-semibold rounded-lg border transition-all cursor-pointer flex items-center gap-1.5 edgy-btn {theme.current === 'dark'
							? 'bg-[#57707A] hover:bg-[#7B919C] text-white border-[#7B919C]'
							: 'bg-[#57707A] hover:bg-[#191D23] text-white border-[#57707A]'}"
					>
						{#if isSubmitting}
							<Loader2 class="w-3.5 h-3.5 animate-spin" />
							<span>Publishing...</span>
						{:else}
							<span>Post Request</span>
						{/if}
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}
