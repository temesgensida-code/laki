<script>
	import { onDestroy, onMount } from 'svelte';
	import { LogOut, ChevronDown, User, ShieldCheck } from '@lucide/svelte';
	import GoogleIcon from '$lib/components/GoogleIcon.svelte';
	import { theme } from '$lib/utils/theme.svelte.js';
	import { playChime } from '$lib/utils/sound.js';

	/** @type {{ user?: { id: string, email: string, name: string, picture?: string } | null }} */
	let { user = null } = $props();

	let isOpen = $state(false);
	/** @type {HTMLDivElement | null} */
	let containerRef = $state(null);

	function toggleMenu() {
		isOpen = !isOpen;
		playChime('click');
	}

	function handleSignOut() {
		playChime('click');
	}

	/** @param {MouseEvent} event */
	function handleOutsideClick(event) {
		if (containerRef && !containerRef.contains(/** @type {Node} */ (event.target))) {
			isOpen = false;
		}
	}

	/** @param {KeyboardEvent} event */
	function handleKeydown(event) {
		if (event.key === 'Escape' && isOpen) {
			isOpen = false;
		}
	}

	onMount(() => {
		if (typeof window !== 'undefined') {
			window.addEventListener('click', handleOutsideClick);
			window.addEventListener('keydown', handleKeydown);
		}
	});

	onDestroy(() => {
		if (typeof window !== 'undefined') {
			window.removeEventListener('click', handleOutsideClick);
			window.removeEventListener('keydown', handleKeydown);
		}
	});
</script>

<div class="relative inline-block text-left" bind:this={containerRef}>
	{#if user}
		<!-- Authenticated User Capsule Trigger -->
		<button
			type="button"
			onclick={toggleMenu}
			aria-expanded={isOpen}
			aria-haspopup="true"
			class="h-9 px-2 flex items-center gap-2 rounded-lg border transition-all cursor-pointer edgy-btn {theme.current === 'dark'
				? 'bg-[#191D23] hover:bg-[#21262F] text-[#DEDCDC] border-[#57707A]/50 shadow-inner'
				: 'bg-[#ECEAE9] hover:bg-[#DFDCDB] text-[#191D23] border-[#C5BAC4] shadow-sm'}"
			title="Google Account: {user.name} ({user.email})"
		>
			{#if user.picture}
				<img
					src={user.picture}
					alt={user.name}
					class="w-5 h-5 rounded-full object-cover ring-1 {theme.current === 'dark'
						? 'ring-[#57707A]'
						: 'ring-[#7B919C]'}"
					referrerpolicy="no-referrer"
				/>
			{:else}
				<div
					class="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold uppercase bg-[#57707A] text-white"
				>
					{user.name ? user.name.charAt(0) : 'U'}
				</div>
			{/if}

			<span class="text-xs font-medium max-w-[90px] sm:max-w-[120px] truncate hidden xs:inline">
				{user.name}
			</span>

			<ChevronDown
				class="w-3.5 h-3.5 transition-transform duration-150 {isOpen ? 'rotate-180 text-[#57707A]' : 'text-[#989DAA]'}"
			/>
		</button>

		<!-- Dropdown Menu -->
		{#if isOpen}
			<div
				class="absolute right-0 mt-2 w-64 sm:w-72 rounded-lg border shadow-xl z-50 py-2 transition-all edgy-card animate-in fade-in zoom-in-95 duration-100 {theme.current === 'dark'
					? 'bg-[#21262F] border-[#57707A]/40 text-[#DEDCDC]'
					: 'bg-[#ECEAE9] border-[#C5BAC4] text-[#191D23]'}"
				role="menu"
			>
				<!-- Profile Header -->
				<div class="px-4 py-3 border-b {theme.current === 'dark' ? 'border-[#57707A]/25' : 'border-[#C5BAC4]/70'}">
					<div class="flex items-center gap-3">
						{#if user.picture}
							<img
								src={user.picture}
								alt={user.name}
								class="w-10 h-10 rounded-full object-cover ring-2 ring-[#57707A]/40"
								referrerpolicy="no-referrer"
							/>
						{:else}
							<div
								class="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold uppercase bg-[#57707A] text-white"
							>
								{user.name ? user.name.charAt(0) : 'U'}
							</div>
						{/if}

						<div class="flex-1 min-w-0">
							<p class="text-sm font-semibold truncate">{user.name}</p>
							<p class="text-xs truncate {theme.current === 'dark' ? 'text-[#989DAA]' : 'text-[#57707A]'}">
								{user.email}
							</p>
						</div>
					</div>

					<div class="mt-2.5 flex items-center gap-1.5 text-[11px] font-mono {theme.current === 'dark' ? 'text-[#7B919C]' : 'text-[#57707A]'}">
						<GoogleIcon size={13} />
						<span>Authenticated with Google</span>
					</div>
				</div>

				<!-- Actions -->
				<div class="p-1.5">
					<a
						href="/auth/logout"
						onclick={handleSignOut}
						class="w-full flex items-center gap-2.5 px-3 py-2 text-xs rounded-md transition-colors font-medium cursor-pointer {theme.current === 'dark'
							? 'text-red-300 hover:bg-red-500/15 hover:text-red-200'
							: 'text-red-700 hover:bg-red-500/10 hover:text-red-800'}"
						role="menuitem"
					>
						<LogOut class="w-4 h-4" />
						<span>Sign out</span>
					</a>
				</div>
			</div>
		{/if}
	{:else}
		<!-- Unauthenticated: Sign in with Google Button -->
		<a
			href="/auth/google"
			class="h-9 px-3 flex items-center gap-2 rounded-lg border font-medium text-xs transition-all edgy-btn cursor-pointer shadow-sm {theme.current === 'dark'
				? 'bg-[#191D23] hover:bg-[#21262F] text-[#DEDCDC] border-[#57707A]/50 hover:border-[#7B919C]'
				: 'bg-[#ECEAE9] hover:bg-[#DFDCDB] text-[#191D23] border-[#C5BAC4] hover:border-[#7B919C]'}"
			title="Sign in with Google"
		>
			<GoogleIcon size={16} />
			<span class="hidden sm:inline">Sign in with Google</span>
			<span class="sm:hidden">Sign in</span>
		</a>
	{/if}
</div>
