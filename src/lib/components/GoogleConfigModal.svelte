<script>
	import { X, ExternalLink, KeyRound, Copy, Check } from '@lucide/svelte';
	import { theme } from '$lib/utils/theme.svelte.js';
	import { playChime } from '$lib/utils/sound.js';

	/** @type {{ isOpen: boolean, onClose: () => void }} */
	let { isOpen = false, onClose } = $props();

	let copied = $state(false);

	const envSnippet = `GOOGLE_CLIENT_ID="your-google-client-id.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="your-google-client-secret"
AUTH_SECRET="${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}"`;

	function copySnippet() {
		navigator.clipboard.writeText(envSnippet);
		copied = true;
		playChime('click');
		setTimeout(() => {
			copied = false;
		}, 2000);
	}

	function handleClose() {
		playChime('click');
		onClose();
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
			<!-- Close button -->
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
						? 'bg-[#21262F] border-[#57707A]/50 text-amber-400'
						: 'bg-[#DFDCDB] border-[#C5BAC4] text-amber-600'}"
				>
					<KeyRound class="w-5 h-5" />
				</div>
				<div>
					<h3 class="font-lexend text-base sm:text-lg font-bold">Google OAuth Setup Required</h3>
					<p class="text-xs {theme.current === 'dark' ? 'text-[#989DAA]' : 'text-[#57707A]'}">
						Credentials not yet detected in your environment
					</p>
				</div>
			</div>

			<!-- Instructions -->
			<div class="space-y-3 text-xs leading-relaxed">
				<p>
					To enable Google Sign-In, you need to create OAuth 2.0 credentials in the Google Cloud Console:
				</p>

				<ol class="list-decimal list-inside space-y-1.5 pl-1 text-[11px] sm:text-xs">
					<li>
						Open the
						<a
							href="https://console.cloud.google.com/apis/credentials"
							target="_blank"
							rel="noreferrer"
							class="underline font-medium text-sky-400 inline-flex items-center gap-0.5"
						>
							Google Cloud Console <ExternalLink class="w-3 h-3 inline" />
						</a>
					</li>
					<li>Create a project and configure the OAuth consent screen.</li>
					<li>Create credentials: <strong>OAuth client ID &gt; Web application</strong>.</li>
					<li>
						Add Authorized redirect URI:
						<code class="px-1.5 py-0.5 rounded font-mono text-[11px] {theme.current === 'dark' ? 'bg-[#16191E]' : 'bg-[#DFDCDB]'}">
							http://localhost:5173/auth/google/callback
						</code>
					</li>
					<li>Add the variables below to your <code class="font-mono font-bold">.env</code> file:</li>
				</ol>

				<!-- Snippet box -->
				<div class="relative mt-2">
					<pre
						class="p-3 rounded-lg font-mono text-[11px] overflow-x-auto border select-all {theme.current === 'dark'
							? 'bg-[#16191E] border-[#57707A]/40 text-[#DEDCDC]'
							: 'bg-[#DFDCDB] border-[#C5BAC4] text-[#191D23]'}"
					><code>{envSnippet}</code></pre>
					<button
						type="button"
						onclick={copySnippet}
						class="absolute top-2 right-2 px-2 py-1 rounded text-[10px] font-mono flex items-center gap-1 border cursor-pointer transition-colors {theme.current === 'dark'
							? 'bg-[#21262F] border-[#57707A]/50 hover:bg-[#2A313C] text-[#DEDCDC]'
							: 'bg-[#ECEAE9] border-[#C5BAC4] hover:bg-[#DFDCDB] text-[#191D23]'}"
					>
						{#if copied}
							<Check class="w-3 h-3 text-emerald-400" />
							<span>Copied</span>
						{:else}
							<Copy class="w-3 h-3" />
							<span>Copy</span>
						{/if}
					</button>
				</div>
			</div>

			<!-- Footer -->
			<div class="mt-6 flex justify-end">
				<button
					type="button"
					onclick={handleClose}
					class="px-4 py-2 text-xs font-semibold rounded-lg border transition-all cursor-pointer edgy-btn {theme.current === 'dark'
						? 'bg-[#57707A] hover:bg-[#7B919C] text-white border-[#7B919C]'
						: 'bg-[#57707A] hover:bg-[#191D23] text-white border-[#57707A]'}"
				>
					Understood
				</button>
			</div>
		</div>
	</div>
{/if}
