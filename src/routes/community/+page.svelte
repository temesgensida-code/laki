<script>
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
		RotateCw
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
			window.location.href = '/auth/google';
			return;
		}
		playChime('click');
		isRequestModalOpen = true;
	}

	function handleOpenFulfill(req) {
		if (!user) {
			window.location.href = '/auth/google';
			return;
		}
		playChime('click');
		activeRequest = req;
		isFulfillModalOpen = true;
	}

	function handleOpenAgree(req) {
		if (!user) {
			window.location.href = '/auth/google';
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
					href="/auth/google"
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
					<!-- Individual Resource Request Card -->
					<article class="p-5 sm:p-6 rounded-xl border transition-all edgy-card {theme.current === 'dark'
						? 'bg-[#191D23] border-[#57707A]/40'
						: 'bg-[#ECEAE9] border-[#C5BAC4]'}">

						<!-- Top Requester Meta & Status Badge -->
						<div class="flex items-center justify-between gap-3 mb-3">
							<!-- Requester Identity -->
							<div class="flex items-center gap-2.5 min-w-0">
								{#if req.requester?.picture}
									<img
										src={req.requester.picture}
										alt={req.requester.name}
										class="w-7 h-7 rounded-full object-cover ring-1 {theme.current === 'dark' ? 'ring-[#57707A]' : 'ring-[#7B919C]'}"
										referrerpolicy="no-referrer"
									/>
								{:else}
									<div class="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold uppercase bg-[#57707A] text-white">
										{req.requester?.name ? req.requester.name.charAt(0) : 'U'}
									</div>
								{/if}

								<div class="min-w-0">
									<div class="flex items-center gap-1.5">
										<span class="text-xs font-bold truncate">{req.requester?.name || 'Community Member'}</span>
										{#if req.isRequester}
											<span class="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-sky-500/20 text-sky-400 border border-sky-500/30">
												You
											</span>
										{/if}
									</div>
									<span class="text-[10px] {theme.current === 'dark' ? 'text-[#989DAA]' : 'text-[#57707A]'}">
										Requested {timeAgo(req.createdAt)}
									</span>
								</div>
							</div>

							<!-- Status Badge -->
							<div>
								{#if req.status === 'fulfilled'}
									<div class="px-2.5 py-1 rounded-md text-[11px] font-semibold flex items-center gap-1.5 border bg-emerald-500/15 border-emerald-500/40 text-emerald-400">
										<CheckCircle2 class="w-3.5 h-3.5" />
										<span>Fulfilled</span>
									</div>
								{:else if req.status === 'expired'}
									<div class="px-2.5 py-1 rounded-md text-[11px] font-semibold flex items-center gap-1.5 border bg-zinc-500/15 border-zinc-500/40 text-zinc-400">
										<Clock class="w-3.5 h-3.5" />
										<span>Expired (24h)</span>
									</div>
								{:else}
									<div class="px-2.5 py-1 rounded-md text-[11px] font-semibold flex items-center gap-1.5 border bg-amber-500/15 border-amber-500/40 text-amber-400">
										<Clock class="w-3.5 h-3.5" />
										<span>Pending Volunteer</span>
									</div>
								{/if}
							</div>
						</div>

						<!-- Title and Description -->
						<div class="mb-4">
							<h2 class="text-base sm:text-lg font-bold font-lexend tracking-tight mb-1.5">
								{req.title}
							</h2>
							<p class="text-xs sm:text-sm leading-relaxed whitespace-pre-line {theme.current === 'dark' ? 'text-[#DEDCDC]/90' : 'text-[#191D23]/90'}">
								{req.description}
							</p>
						</div>

						<!-- Fulfilled Download Box (If Fulfilled) -->
						{#if req.status === 'fulfilled' && req.fulfillment}
							<div class="mb-4 p-4 rounded-xl border {theme.current === 'dark'
								? 'bg-[#16191E] border-emerald-500/30'
								: 'bg-white border-emerald-600/40'}">
								<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
									<div class="flex items-center gap-3 min-w-0">
										<div class="w-10 h-10 rounded-lg flex items-center justify-center border bg-emerald-500/15 border-emerald-500/30 text-emerald-400 flex-shrink-0">
											<FileText class="w-5 h-5" />
										</div>
										<div class="min-w-0">
											<div class="flex items-center gap-1.5">
												<p class="text-xs font-bold truncate">{req.fulfillment.fileName}</p>
												<span class="text-[10px] font-mono opacity-70">
													({formatBytes(req.fulfillment.fileSize)})
												</span>
											</div>
											<p class="text-[11px] {theme.current === 'dark' ? 'text-[#989DAA]' : 'text-[#57707A]'}">
												Fulfilled by <strong class="text-[#DEDCDC]">{req.fulfillment.fulfilledBy?.name || 'Volunteer'}</strong> &bull;
												<span class="text-amber-400 font-semibold inline-flex items-center gap-0.5">
													<Clock class="w-3 h-3 inline" /> {formatExpiryTime(req.fulfillment.expiresAt)}
												</span>
											</p>
										</div>
									</div>

									<!-- Download Button -->
									<a
										href={req.fulfillment.fileLink}
										target="_blank"
										rel="noreferrer"
										download
										class="px-4 py-2 text-xs font-semibold rounded-lg border transition-all flex items-center justify-center gap-1.5 cursor-pointer edgy-btn flex-shrink-0 {theme.current === 'dark'
											? 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-500'
											: 'bg-emerald-700 hover:bg-emerald-800 text-white border-emerald-700'}"
									>
										<Download class="w-3.5 h-3.5" />
										<span>Download File</span>
										<ExternalLink class="w-3 h-3 opacity-70" />
									</a>
								</div>

								<div class="mt-2.5 pt-2 border-t flex items-center justify-between text-[10px] font-mono {theme.current === 'dark'
									? 'border-[#57707A]/20 text-[#7B919C]'
									: 'border-[#C5BAC4]/50 text-[#57707A]'}">
									<span>Hosted via file.io API &bull; 24-hour single lifecycle</span>
									<span>Expires: {new Date(req.fulfillment.expiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
								</div>
							</div>
						{/if}

						<!-- Card Footer: Subscribers Count & Actions -->
						<div class="flex flex-wrap items-center justify-between gap-3 pt-3 border-t {theme.current === 'dark' ? 'border-[#57707A]/20' : 'border-[#C5BAC4]/50'}">
							<!-- Waiting count / subscribers info -->
							<div class="flex items-center gap-2 text-xs {theme.current === 'dark' ? 'text-[#989DAA]' : 'text-[#57707A]'}">
								<Users class="w-3.5 h-3.5" />
								<span>
									{#if req.subscriberCount > 0}
										<strong>{req.subscriberCount}</strong> {req.subscriberCount === 1 ? 'other person' : 'people'} also waiting for this
									{:else}
										Requester waiting for volunteer
									{/if}
								</span>
							</div>

							<!-- Action Buttons -->
							<div class="flex items-center gap-2">
								<!-- "I Need This Too / Agree" Button -->
								{#if !req.isRequester && req.status === 'pending'}
									<button
										type="button"
										onclick={() => handleOpenAgree(req)}
										class="px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all cursor-pointer flex items-center gap-1.5 edgy-btn {req.hasSubscribed
											? (theme.current === 'dark'
												? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40'
												: 'bg-indigo-50 text-indigo-800 border-indigo-300')
											: (theme.current === 'dark'
												? 'bg-[#21262F] hover:bg-[#2A313C] text-[#DEDCDC] border-[#57707A]/40'
												: 'bg-white hover:bg-[#DFDCDB] text-[#191D23] border-[#C5BAC4]')}"
									>
										<Bell class="w-3.5 h-3.5" />
										<span>{req.hasSubscribed ? 'Subscribed' : 'I Need This Too'}</span>
									</button>
								{/if}

								<!-- "Fulfill / Share File" Button -->
								{#if req.status === 'pending'}
									<button
										type="button"
										onclick={() => handleOpenFulfill(req)}
										class="px-3.5 py-1.5 text-xs font-semibold rounded-lg border transition-all cursor-pointer flex items-center gap-1.5 edgy-btn {theme.current === 'dark'
											? 'bg-emerald-600/90 hover:bg-emerald-600 text-white border-emerald-500/60'
											: 'bg-emerald-700 hover:bg-emerald-800 text-white border-emerald-700'}"
									>
										<UploadCloud class="w-3.5 h-3.5" />
										<span>Volunteer / Share File</span>
									</button>
								{/if}
							</div>
						</div>
					</article>

					<!-- Thin horizontal line separator between requests as requested (Requirement 6) -->
					{#if index < filteredRequests.length - 1}
						<div class="py-3 sm:py-4">
							<hr class="border-t transition-colors {theme.current === 'dark' ? 'border-[#57707A]/25' : 'border-[#C5BAC4]/70'}" />
						</div>
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
