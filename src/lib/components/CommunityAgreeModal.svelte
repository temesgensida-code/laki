<script>
	import { X, Bell, ShieldCheck, Mail, Loader2, Check } from '@lucide/svelte';
	import { theme } from '$lib/utils/theme.svelte.js';
	import { playChime } from '$lib/utils/sound.js';

	/**
	 * @type {{
	 *   isOpen: boolean,
	 *   requestItem: any,
	 *   user: any,
	 *   onClose: () => void,
	 *   onSuccess: (updatedData: { hasSubscribed: boolean, subscriberCount: number }) => void
	 * }}
	 */
	let { isOpen = false, requestItem, user, onClose, onSuccess } = $props();

	let email = $state('');
	let isLoading = $state(false);
	let errorMessage = $state('');

	$effect(() => {
		if (user?.email && !email) {
			email = user.email;
		}
	});

	function handleClose() {
		if (isLoading) return;
		playChime('click');
		errorMessage = '';
		onClose();
	}

	async function handleSubscribe(e) {
		e.preventDefault();
		if (!requestItem || isLoading) return;

		const trimmedEmail = email.trim();
		if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
			errorMessage = 'Please enter a valid notification email.';
			return;
		}

		isLoading = true;
		errorMessage = '';
		playChime('click');

		try {
			const res = await fetch(`/api/community/requests/${requestItem.id}/agree`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email: trimmedEmail })
			});

			const data = await res.json();
			if (!res.ok || !data.success) {
				errorMessage = data.error || 'Failed to register interest.';
				isLoading = false;
				return;
			}

			playChime('complete');
			onSuccess({
				hasSubscribed: true,
				subscriberCount: data.subscriberCount
			});
			onClose();
		} catch (err) {
			errorMessage = 'Network error while subscribing.';
		} finally {
			isLoading = false;
		}
	}

	async function handleUnsubscribe() {
		if (!requestItem || isLoading) return;

		isLoading = true;
		errorMessage = '';
		playChime('click');

		try {
			const res = await fetch(`/api/community/requests/${requestItem.id}/agree`, {
				method: 'DELETE'
			});

			const data = await res.json();
			if (!res.ok || !data.success) {
				errorMessage = data.error || 'Failed to cancel subscription.';
				isLoading = false;
				return;
			}

			playChime('click');
			onSuccess({
				hasSubscribed: false,
				subscriberCount: data.subscriberCount
			});
			onClose();
		} catch (err) {
			errorMessage = 'Network error while unsubscribing.';
		} finally {
			isLoading = false;
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
			class="relative w-full max-w-md rounded-xl border shadow-2xl p-6 transition-all edgy-card {theme.current === 'dark'
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
						? 'bg-[#21262F] border-[#57707A]/50 text-indigo-400'
						: 'bg-[#DFDCDB] border-[#C5BAC4] text-indigo-600'}"
				>
					<Bell class="w-5 h-5" />
				</div>
				<div>
					<h3 class="font-lexend text-base sm:text-lg font-bold">
						{requestItem.hasSubscribed ? 'Subscribed to Resource' : 'I Need This File Too'}
					</h3>
					<p class="text-xs truncate max-w-[240px] {theme.current === 'dark' ? 'text-[#989DAA]' : 'text-[#57707A]'}">
						"{requestItem.title}"
					</p>
				</div>
			</div>

			{#if errorMessage}
				<div class="mb-4 p-3 rounded-lg text-xs font-medium border bg-red-500/10 border-red-500/30 text-red-400">
					{errorMessage}
				</div>
			{/if}

			{#if requestItem.hasSubscribed}
				<div class="py-4 space-y-3">
					<div class="p-3.5 rounded-lg border flex items-center gap-3 {theme.current === 'dark'
						? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
						: 'bg-emerald-50 border-emerald-300 text-emerald-800'}">
						<Check class="w-5 h-5 flex-shrink-0 text-emerald-400" />
						<div class="text-xs leading-relaxed">
							<strong>You are subscribed!</strong> You will be notified via email immediately when a volunteer shares this file.
						</div>
					</div>

					<p class="text-xs {theme.current === 'dark' ? 'text-[#989DAA]' : 'text-[#57707A]'}">
						No longer need this file? You can unsubscribe below.
					</p>

					<div class="pt-2 flex justify-end gap-2">
						<button
							type="button"
							onclick={handleClose}
							class="px-3.5 py-2 text-xs font-medium rounded-lg border transition-colors cursor-pointer {theme.current === 'dark'
								? 'border-[#57707A]/40 hover:bg-[#21262F] text-[#DEDCDC]'
								: 'border-[#C5BAC4] hover:bg-[#DFDCDB] text-[#191D23]'}"
						>
							Keep Subscribed
						</button>

						<button
							type="button"
							onclick={handleUnsubscribe}
							disabled={isLoading}
							class="px-3.5 py-2 text-xs font-semibold rounded-lg border transition-all cursor-pointer text-red-400 hover:bg-red-500/15 border-red-500/30"
						>
							{#if isLoading}
								<Loader2 class="w-3.5 h-3.5 animate-spin" />
							{:else}
								Unsubscribe
							{/if}
						</button>
					</div>
				</div>
			{:else}
				<form onsubmit={handleSubscribe} class="space-y-4">
					<p class="text-xs leading-relaxed {theme.current === 'dark' ? 'text-[#989DAA]' : 'text-[#57707A]'}">
						Add your email to agree with this request and boost its community priority. You will automatically receive an email alert with the download link once a volunteer fulfills it.
					</p>

					<!-- Notification Email Input -->
					<div>
						<label for="agree-email" class="block text-xs font-semibold mb-1.5 flex items-center justify-between">
							<span>Notification Email <span class="text-red-400">*</span></span>
							<span class="text-[11px] font-normal flex items-center gap-1 text-emerald-400">
								<ShieldCheck class="w-3.5 h-3.5" /> Kept Private
							</span>
						</label>
						<div class="relative">
							<div class="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-[#57707A]">
								<Mail class="w-3.5 h-3.5" />
							</div>
							<input
								id="agree-email"
								type="email"
								bind:value={email}
								placeholder="you@example.com"
								required
								class="w-full pl-8 pr-3 py-2 text-xs rounded-lg border outline-none transition-all {theme.current === 'dark'
									? 'bg-[#16191E] border-[#57707A]/40 focus:border-[#7B919C] text-[#DEDCDC]'
									: 'bg-white border-[#C5BAC4] focus:border-[#57707A] text-[#191D23]'}"
							/>
						</div>
					</div>

					<!-- Actions -->
					<div class="pt-3 flex items-center justify-end gap-2 border-t {theme.current === 'dark' ? 'border-[#57707A]/20' : 'border-[#C5BAC4]/50'}">
						<button
							type="button"
							onclick={handleClose}
							disabled={isLoading}
							class="px-3.5 py-2 text-xs font-medium rounded-lg border transition-colors cursor-pointer {theme.current === 'dark'
								? 'border-[#57707A]/40 hover:bg-[#21262F] text-[#DEDCDC]'
								: 'border-[#C5BAC4] hover:bg-[#DFDCDB] text-[#191D23]'}"
						>
							Cancel
						</button>

						<button
							type="submit"
							disabled={isLoading}
							class="px-4 py-2 text-xs font-semibold rounded-lg border transition-all cursor-pointer flex items-center gap-1.5 edgy-btn {theme.current === 'dark'
								? 'bg-indigo-600 hover:bg-indigo-500 text-white border-indigo-500'
								: 'bg-indigo-700 hover:bg-indigo-800 text-white border-indigo-700'}"
						>
							{#if isLoading}
								<Loader2 class="w-3.5 h-3.5 animate-spin" />
								<span>Saving...</span>
							{:else}
								<Bell class="w-3.5 h-3.5" />
								<span>Agree & Notify Me</span>
							{/if}
						</button>
					</div>
				</form>
			{/if}
		</div>
	</div>
{/if}
