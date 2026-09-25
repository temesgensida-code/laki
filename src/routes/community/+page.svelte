<script>
	import { onMount } from 'svelte';
	import Navbar from '$lib/components/Navbar.svelte';
	import CommunityRequestModal from '$lib/components/CommunityRequestModal.svelte';
	import CommunityFulfillModal from '$lib/components/CommunityFulfillModal.svelte';
	import CommunityAgreeModal from '$lib/components/CommunityAgreeModal.svelte';
	import GoogleIcon from '$lib/components/GoogleIcon.svelte';
	import { theme } from '$lib/utils/theme.svelte.js';
	import { playChime } from '$lib/utils/sound.js';
	import {
		Plus,
		Users,
		UploadCloud,
		Download,
		CheckCircle2,
		Clock,
		AlertCircle,
		Search,
		Bell,
		ShieldCheck,
		ExternalLink,
		FileText,
		Sparkles,
		RotateCw,
		X
	} from '@lucide/svelte';

	let { data } = $props();

	/** @type {any[]} */
	let requests = $state([]);
	let user = $derived(data.user);

	$effect(() => {
		if (data.requests) {
			requests = data.requests;
		}
	});

	// Modals state
	let isRequestModalOpen = $state(false);
	let isFulfillModalOpen = $state(false);
	let isAgreeModalOpen = $state(false);

	/** @type {any | null} */
	let activeRequest = $state(null);

	// Filters & Search
	let filterStatus = $state('all'); // 'all' | 'pending' | 'fulfilled'
	let searchQuery = $state('');
	let isRefreshing = $state(false);
	let authErrorMessage = $state('');

	onMount(() => {
		if (typeof window !== 'undefined') {
			const urlParams = new URLSearchParams(window.location.search);
			const authError = urlParams.get('auth_error');
			if (authError) {
				authErrorMessage = decodeURIComponent(authError);
				urlParams.delete('auth_error');
				const remainder = urlParams.toString();
				const cleanUrl = window.location.pathname + (remainder ? `?${remainder}` : '');
				window.history.replaceState({}, '', cleanUrl);
			}
		}
	});

	// Relative time helper
	function timeAgo(dateString) {
		if (!dateString) return '';
		const date = new Date(dateString);
		const now = new Date();
		const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);

		if (diffSec < 60) return 'Just now';
		if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
		if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
		return `${Math.floor(diffSec / 86400)}d ago`;
	}

	// Expiry countdown helper
	function formatExpiryTime(expiresAtString) {
		if (!expiresAtString) return '24 hours';
		const expiresAt = new Date(expiresAtString);
		const now = new Date();
		const diffMs = expiresAt.getTime() - now.getTime();

		if (diffMs <= 0) return 'Expired';

		const hours = Math.floor(diffMs / (1000 * 60 * 60));
		const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

		if (hours > 0) {
			return `${hours}h ${minutes}m left`;
		}
		return `${minutes}m left`;
	}

	function formatBytes(bytes, decimals = 1) {
		if (!bytes) return '0 B';
		const k = 1024;
		const dm = decimals < 0 ? 0 : decimals;
		const sizes = ['B', 'KB', 'MB', 'GB'];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
	}

	// Filtered requests list
	let filteredRequests = $derived(
		requests.filter((r) => {
			if (filterStatus === 'pending' && r.status !== 'pending') return false;
			if (filterStatus === 'fulfilled' && r.status !== 'fulfilled') return false;

			if (searchQuery.trim()) {
				const query = searchQuery.toLowerCase();
				const matchTitle = r.title?.toLowerCase().includes(query);
				const matchDesc = r.description?.toLowerCase().includes(query);
				const matchName = r.requester?.name?.toLowerCase().includes(query);
				if (!matchTitle && !matchDesc && !matchName) return false;
			}

			return true;
		})
	);

	async function refreshRequests() {
		isRefreshing = true;
		playChime('click');
		try {
			const res = await fetch('/api/community/requests');
			const result = await res.json();
			if (result.success && Array.isArray(result.requests)) {
				requests = result.requests;
			}
		} catch (err) {
			console.error('Failed to refresh requests:', err);
		} finally {
			isRefreshing = false;
		}
	}

	function handleOpenRequestModal() {
		if (!user) {
			window.location.href = '/auth/google?returnUrl=/community';
			return;
		}
		playChime('click');
		isRequestModalOpen = true;
	}

	function handleOpenFulfill(req) {
		if (!user) {
			window.location.href = '/auth/google?returnUrl=/community';
			return;
		}
		playChime('click');
		activeRequest = req;
		isFulfillModalOpen = true;
	}

	function handleOpenAgree(req) {
		if (!user) {
			window.location.href = '/auth/google?returnUrl=/community';
			return;
		}
		playChime('click');
		activeRequest = req;
		isAgreeModalOpen = true;
	}

	function handleRequestCreated(newReq) {
		requests = [newReq, ...requests];
	}

	function handleFulfillmentSuccess(fulfillment) {
		if (!activeRequest) return;
		requests = requests.map((r) => {
			if (r.id === activeRequest.id) {
				return {
					...r,
					status: 'fulfilled',
					fulfillment
				};
			}
			return r;
		});
	}

	function handleAgreeSuccess(updated) {
		if (!activeRequest) return;
		requests = requests.map((r) => {
			if (r.id === activeRequest.id) {
				return {
					...r,
					hasSubscribed: updated.hasSubscribed,
					subscriberCount: updated.subscriberCount
				};
			}
			return r;
		});
	}
</script>

<svelte:head>
	<title>Community Resource Board • LakiDrop</title>
</svelte:head>

<div class="min-h-screen flex flex-col font-sans transition-colors duration-200 {theme.current === 'dark'
	? 'bg-[#16191E] text-[#DEDCDC]'
	: 'bg-[#DEDCDC] text-[#191D23]'}">

	<!-- Header Navbar -->
	<Navbar {user} />

	<!-- Main Content Area -->
	<main class="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8">

		<!-- Auth Error Notification Banner -->
		{#if authErrorMessage}
			<div class="mb-6 p-4 rounded-xl border flex items-start justify-between gap-3 bg-red-500/10 border-red-500/30 text-red-400">
				<div class="flex items-start gap-3">
					<AlertCircle class="w-5 h-5 flex-shrink-0 mt-0.5" />
					<div class="text-xs sm:text-sm">
						<p class="font-bold">Google Sign-in Notice</p>
						<p class="mt-0.5 opacity-90">{authErrorMessage}</p>
					</div>
				</div>
				<button
					type="button"
					onclick={() => (authErrorMessage = '')}
					class="p-1 rounded-md hover:bg-red-500/20 text-red-400 cursor-pointer"
					aria-label="Dismiss error"
				>
					<X class="w-4 h-4" />
				</button>
			</div>
		{/if}

		<!-- Hero Section -->
		<div class="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
			<div>
				<div class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold tracking-wide uppercase mb-2 {theme.current === 'dark'
					? 'bg-[#21262F] text-sky-400 border border-[#57707A]/40'
					: 'bg-[#ECEAE9] text-sky-700 border border-[#C5BAC4]'}">
					<Users class="w-3.5 h-3.5" />
					<span>Community Resource Exchange</span>
				</div>
				<h1 class="text-2xl sm:text-3xl font-extrabold tracking-tight font-lexend">
					File Requests & Volunteer Hub
				</h1>
				<p class="text-xs sm:text-sm mt-1 max-w-xl leading-relaxed {theme.current === 'dark' ? 'text-[#989DAA]' : 'text-[#57707A]'}">
					Ask the community for resources you need, or volunteer to share requested files via <strong>file.io</strong>. Uploaded files remain accessible for <strong>24 hours</strong>.
				</p>
			</div>

			<!-- Ask for Resource Button -->
			<div class="flex-shrink-0">
				<button
					type="button"
					onclick={handleOpenRequestModal}
					class="w-full sm:w-auto px-4 py-2.5 text-xs font-semibold rounded-lg border transition-all cursor-pointer flex items-center justify-center gap-2 edgy-btn shadow-md {theme.current === 'dark'
						? 'bg-[#57707A] hover:bg-[#7B919C] text-white border-[#7B919C]'
						: 'bg-[#57707A] hover:bg-[#191D23] text-white border-[#57707A]'}"
				>
					<Plus class="w-4 h-4" />
					<span>Ask for Resource</span>
				</button>
			</div>
		</div>

		<!-- Sign-In Callout for Unauthenticated Visitors -->
		{#if !user}
			<div class="mb-8 p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 edgy-card {theme.current === 'dark'
				? 'bg-[#191D23] border-[#57707A]/40'
				: 'bg-[#ECEAE9] border-[#C5BAC4]'}">
				<div class="flex items-center gap-3">
					<div class="w-10 h-10 rounded-lg flex items-center justify-center border {theme.current === 'dark'
						? 'bg-[#21262F] border-[#57707A]/50 text-sky-400'
						: 'bg-white border-[#C5BAC4] text-sky-600'}">
						<Users class="w-5 h-5" />
					</div>
					<div>
						<h3 class="text-sm font-bold">Google Account Required for Community Actions</h3>
						<p class="text-xs {theme.current === 'dark' ? 'text-[#989DAA]' : 'text-[#57707A]'}">
							Sign in with Google to post requests, agree to files for instant notification, or volunteer uploads.
						</p>
					</div>
				</div>

				<a
					href="/auth/google?returnUrl=/community"
					class="px-4 py-2 text-xs font-semibold rounded-lg border transition-all flex items-center justify-center gap-2 cursor-pointer edgy-btn {theme.current === 'dark'
						? 'bg-[#21262F] hover:bg-[#2A313C] text-white border-[#57707A]/60'
						: 'bg-white hover:bg-[#DFDCDB] text-[#191D23] border-[#C5BAC4]'}"
				>
					<GoogleIcon size={16} />
					<span>Sign in with Google</span>
				</a>
			</div>
		{/if}

		<!-- Filters and Search Bar -->
		<div class="mb-6 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
			<!-- Status Filter Pills -->
			<div class="flex items-center gap-1.5 p-1 rounded-lg border {theme.current === 'dark'
				? 'bg-[#191D23] border-[#57707A]/30'
				: 'bg-[#ECEAE9] border-[#C5BAC4]'}">
				<button
					type="button"
					onclick={() => { filterStatus = 'all'; playChime('click'); }}
					class="px-3 py-1.5 text-xs rounded-md transition-all cursor-pointer {filterStatus === 'all'
						? (theme.current === 'dark' ? 'bg-[#21262F] text-white font-semibold shadow-sm' : 'bg-white text-[#191D23] font-semibold shadow-sm')
						: (theme.current === 'dark' ? 'text-[#989DAA] hover:text-[#DEDCDC]' : 'text-[#57707A] hover:text-[#191D23]')}"
				>
					All ({requests.length})
				</button>
				<button
					type="button"
					onclick={() => { filterStatus = 'pending'; playChime('click'); }}
					class="px-3 py-1.5 text-xs rounded-md transition-all cursor-pointer {filterStatus === 'pending'
						? (theme.current === 'dark' ? 'bg-[#21262F] text-amber-400 font-semibold shadow-sm' : 'bg-white text-amber-700 font-semibold shadow-sm')
						: (theme.current === 'dark' ? 'text-[#989DAA] hover:text-[#DEDCDC]' : 'text-[#57707A] hover:text-[#191D23]')}"
				>
					Pending ({requests.filter(r => r.status === 'pending').length})
				</button>
				<button
					type="button"
					onclick={() => { filterStatus = 'fulfilled'; playChime('click'); }}
					class="px-3 py-1.5 text-xs rounded-md transition-all cursor-pointer {filterStatus === 'fulfilled'
						? (theme.current === 'dark' ? 'bg-[#21262F] text-emerald-400 font-semibold shadow-sm' : 'bg-white text-emerald-700 font-semibold shadow-sm')
						: (theme.current === 'dark' ? 'text-[#989DAA] hover:text-[#DEDCDC]' : 'text-[#57707A] hover:text-[#191D23]')}"
				>
					Fulfilled ({requests.filter(r => r.status === 'fulfilled').length})
				</button>
			</div>

			<!-- Search & Refresh -->
			<div class="flex items-center gap-2">
				<div class="relative flex-1 sm:w-60">
					<Search class="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#57707A]" />
					<input
						type="text"
						bind:value={searchQuery}
						placeholder="Search requests..."
						class="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border outline-none transition-all {theme.current === 'dark'
							? 'bg-[#191D23] border-[#57707A]/40 focus:border-[#7B919C] text-[#DEDCDC]'
							: 'bg-white border-[#C5BAC4] focus:border-[#57707A] text-[#191D23]'}"
					/>
				</div>

				<button
					type="button"
					onclick={refreshRequests}
					class="p-2 rounded-lg border transition-all cursor-pointer {theme.current === 'dark'
						? 'bg-[#191D23] border-[#57707A]/40 hover:bg-[#21262F] text-[#989DAA]'
						: 'bg-[#ECEAE9] border-[#C5BAC4] hover:bg-[#DFDCDB] text-[#57707A]'}"
					title="Refresh request board"
				>
					<RotateCw class="w-3.5 h-3.5 {isRefreshing ? 'animate-spin' : ''}" />
				</button>
			</div>
		</div>

		<!-- Requests Feed -->
		{#if filteredRequests.length === 0}
			<div class="py-16 text-center border rounded-xl edgy-card {theme.current === 'dark'
				? 'bg-[#191D23] border-[#57707A]/30'
				: 'bg-[#ECEAE9] border-[#C5BAC4]'}">
				<FileText class="w-10 h-10 mx-auto mb-3 {theme.current === 'dark' ? 'text-[#57707A]' : 'text-[#7B919C]'}" />
				<h3 class="text-sm font-semibold mb-1">No Resource Requests Found</h3>
				<p class="text-xs max-w-sm mx-auto mb-4 {theme.current === 'dark' ? 'text-[#989DAA]' : 'text-[#57707A]'}">
					{searchQuery ? 'Try a different search query or filter.' : 'Be the first to ask the community for a file you need!'}
				</p>
				<button
					type="button"
					onclick={handleOpenRequestModal}
					class="px-4 py-2 text-xs font-semibold rounded-lg border transition-all cursor-pointer edgy-btn {theme.current === 'dark'
						? 'bg-[#57707A] hover:bg-[#7B919C] text-white border-[#7B919C]'
						: 'bg-[#57707A] hover:bg-[#191D23] text-white border-[#57707A]'}"
				>
					Create First Request
				</button>
			</div>
		{:else}
			<div class="space-y-0">
				{#each filteredRequests as req, index (req.id)}
					<!-- Individual Community Request (No Box Container, Shrunk Low-Height) -->
					<div class="py-2.5 sm:py-3 transition-colors">
						<!-- Top Row: Requester Info, Badges & Action Buttons -->
						<div class="flex flex-wrap items-center justify-between gap-2 mb-1.5">
							<!-- Left Meta: Avatar, Name, Time, Status, Subscribers -->
							<div class="flex items-center gap-2 min-w-0 flex-wrap">
								{#if req.requester?.picture}
									<img
										src={req.requester.picture}
										alt={req.requester.name}
										class="w-5 h-5 rounded-full object-cover ring-1 {theme.current === 'dark' ? 'ring-[#57707A]' : 'ring-[#7B919C]'}"
										referrerpolicy="no-referrer"
									/>
								{:else}
									<div class="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold uppercase bg-[#57707A] text-white">
										{req.requester?.name ? req.requester.name.charAt(0) : 'U'}
									</div>
								{/if}

								<span class="text-xs font-bold truncate">{req.requester?.name || 'Community Member'}</span>

								{#if req.isRequester}
									<span class="px-1.5 py-0.2 rounded text-[9px] font-semibold bg-sky-500/15 text-sky-400 border border-sky-500/25">
										You
									</span>
								{/if}

								<span class="text-[11px] {theme.current === 'dark' ? 'text-[#989DAA]' : 'text-[#57707A]'}">
									&bull; {timeAgo(req.createdAt)}
								</span>

								<!-- Status Badge (compact) -->
								{#if req.status === 'fulfilled'}
									<span class="px-2 py-0.5 rounded text-[10px] font-medium flex items-center gap-1 border bg-emerald-500/15 border-emerald-500/35 text-emerald-400">
										<CheckCircle2 class="w-3 h-3" /> Fulfilled
									</span>
								{:else if req.status === 'expired'}
									<span class="px-2 py-0.5 rounded text-[10px] font-medium flex items-center gap-1 border bg-zinc-500/15 border-zinc-500/35 text-zinc-400">
										<Clock class="w-3 h-3" /> Expired (24h)
									</span>
								{:else}
									<span class="px-2 py-0.5 rounded text-[10px] font-medium flex items-center gap-1 border bg-amber-500/15 border-amber-500/35 text-amber-400">
										<Clock class="w-3 h-3" /> Pending
									</span>
								{/if}

								<!-- Waiting count indicator -->
								{#if req.subscriberCount > 0}
									<span class="text-[11px] flex items-center gap-1 {theme.current === 'dark' ? 'text-[#989DAA]' : 'text-[#57707A]'}">
										<Users class="w-3 h-3" />
										<span>{req.subscriberCount} waiting</span>
									</span>
								{/if}
							</div>

							<!-- Right Meta: Compact Action Buttons -->
							<div class="flex items-center gap-1.5 shrink-0 ml-auto">
								<!-- "I Need This Too / Agree" Button -->
								{#if !req.isRequester && req.status === 'pending'}
									<button
										type="button"
										onclick={() => handleOpenAgree(req)}
										class="h-7 px-2.5 text-xs font-semibold rounded-md border transition-all cursor-pointer flex items-center gap-1.5 edgy-btn {req.hasSubscribed
											? (theme.current === 'dark'
												? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40'
												: 'bg-indigo-50 text-indigo-800 border-indigo-300')
											: (theme.current === 'dark'
												? 'bg-[#21262F] hover:bg-[#2A313C] text-[#DEDCDC] border-[#57707A]/40'
												: 'bg-white hover:bg-[#DFDCDB] text-[#191D23] border-[#C5BAC4]')}"
									>
										<Bell class="w-3 h-3" />
										<span>{req.hasSubscribed ? 'Subscribed' : 'I Need This Too'}</span>
									</button>
								{/if}

								<!-- "Volunteer / Share File" Button -->
								{#if req.status === 'pending'}
									<button
										type="button"
										onclick={() => handleOpenFulfill(req)}
										class="h-7 px-2.5 text-xs font-semibold rounded-md border transition-all cursor-pointer flex items-center gap-1.5 edgy-btn {theme.current === 'dark'
											? 'bg-emerald-600/90 hover:bg-emerald-600 text-white border-emerald-500/60'
											: 'bg-emerald-700 hover:bg-emerald-800 text-white border-emerald-700'}"
									>
										<UploadCloud class="w-3.5 h-3.5" />
										<span>Volunteer File</span>
									</button>
								{/if}
							</div>
						</div>

						<!-- Middle Row: Title & Description (Compact) -->
						<div class="space-y-0.5">
							<h2 class="text-sm sm:text-base font-bold font-lexend tracking-tight {theme.current === 'dark' ? 'text-[#DEDCDC]' : 'text-[#191D23]'}">
								{req.title}
							</h2>
							{#if req.description}
								<p class="text-xs leading-relaxed whitespace-pre-line {theme.current === 'dark' ? 'text-[#989DAA]' : 'text-[#57707A]'}">
									{req.description}
								</p>
							{/if}
						</div>

						<!-- Fulfilled Download Bar (Slim 1-line strip if Fulfilled) -->
						{#if req.status === 'fulfilled' && req.fulfillment}
							<div class="mt-2 py-1.5 px-3 rounded-lg flex flex-wrap items-center justify-between gap-2 text-xs border {theme.current === 'dark'
								? 'bg-[#21262F]/60 border-emerald-500/30'
								: 'bg-white/80 border-emerald-600/30'}">
								<div class="flex items-center gap-2 min-w-0">
									<FileText class="w-3.5 h-3.5 text-emerald-400 shrink-0" />
									<span class="font-medium text-xs truncate max-w-[180px] sm:max-w-xs">{req.fulfillment.fileName}</span>
									<span class="text-[10px] font-mono opacity-70">({formatBytes(req.fulfillment.fileSize)})</span>
									<span class="text-[11px] hidden sm:inline {theme.current === 'dark' ? 'text-[#989DAA]' : 'text-[#57707A]'}">
										by <strong class="text-current">{req.fulfillment.fulfilledBy?.name || 'Volunteer'}</strong>
									</span>
									<span class="text-amber-400 font-semibold text-[11px] inline-flex items-center gap-0.5 ml-1">
										<Clock class="w-3 h-3" /> {formatExpiryTime(req.fulfillment.expiresAt)}
									</span>
								</div>

								<a
									href={req.fulfillment.fileLink}
									target="_blank"
									rel="noreferrer"
									download
									class="h-6 px-2.5 text-xs font-semibold rounded border transition-all flex items-center gap-1.5 cursor-pointer shrink-0 {theme.current === 'dark'
										? 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-500'
										: 'bg-emerald-700 hover:bg-emerald-800 text-white border-emerald-700'}"
								>
									<Download class="w-3 h-3" />
									<span>Download</span>
									<ExternalLink class="w-2.5 h-2.5 opacity-70" />
								</a>
							</div>
						{/if}
					</div>

					<!-- Thin horizontal line separator between requests only -->
					{#if index < filteredRequests.length - 1}
						<hr class="border-t transition-colors my-2.5 sm:my-3 {theme.current === 'dark' ? 'border-[#57707A]/25' : 'border-[#C5BAC4]/70'}" />
					{/if}
				{/each}
			</div>
		{/if}
	</main>
</div>

<!-- Modal Components -->
<CommunityRequestModal
	isOpen={isRequestModalOpen}
	{user}
	onClose={() => (isRequestModalOpen = false)}
	onSuccess={handleRequestCreated}
/>

<CommunityFulfillModal
	isOpen={isFulfillModalOpen}
	requestItem={activeRequest}
	onClose={() => { isFulfillModalOpen = false; activeRequest = null; }}
	onSuccess={handleFulfillmentSuccess}
/>

<CommunityAgreeModal
	isOpen={isAgreeModalOpen}
	requestItem={activeRequest}
	{user}
	onClose={() => { isAgreeModalOpen = false; activeRequest = null; }}
	onSuccess={handleAgreeSuccess}
/>
