<script>
	import { onMount, onDestroy } from 'svelte';
	import Navbar from '$lib/components/Navbar.svelte';
	import DropZone from '$lib/components/DropZone.svelte';
	import ShareCard from '$lib/components/ShareCard.svelte';
	import FileCard from '$lib/components/FileCard.svelte';
	import TransferProgress from '$lib/components/TransferProgress.svelte';
	import StatusBanner from '$lib/components/StatusBanner.svelte';
	import SuccessCard from '$lib/components/SuccessCard.svelte';
	import QrModal from '$lib/components/QrModal.svelte';

	import { SignalingClient } from '$lib/webrtc/signalingClient.js';
	import { PeerJsSignalingClient } from '$lib/webrtc/peerjsSignalingClient.js';
	import { TransferEngine } from '$lib/webrtc/transferEngine.js';
	import { generateSessionId } from '$lib/utils/formatters.js';
	import { theme } from '$lib/utils/theme.svelte.js';
	import { playChime } from '$lib/utils/sound.js';
	import {
		Send,
		Download,
		Link2,
		ShieldCheck,
		Zap,
		Globe,
		RotateCcw,
		Sparkles
	} from '@lucide/svelte';

	// Reactive state variables
	let activeTab = $state('send'); // 'send' | 'receive'
	let sessionId = $state('');
	let manualInputCode = $state('');
	let clientId = $state('');

	// Engine & Signaling instances
	/** @type {any | null} */
	let signaling = $state(null);
	/** @type {TransferEngine | null} */
	let engine = $state(null);

	// Transfer UI state
	let transferState = $state('idle'); // 'idle' | 'waiting-peer' | 'ready-to-accept' | 'transferring' | 'paused' | 'reconnecting' | 'completed' | 'error' | 'rejected'
	let isPaused = $state(false);
	let peerConnected = $state(false);
	let fileMeta = $state(null);
	let stats = $state(null);
	let completedResult = $state(null);
	let warningMessage = $state('');
	let errorMessage = $state('');

	// Cached ICE servers
	let cachedIceServers = $state([]);

	// Modals
	let showQrModal = $state(false);

	// Computed share URL
	let shareUrl = $derived.by(() => {
		if (typeof window === 'undefined' || !sessionId) return '';
		return `${window.location.origin}/?session=${sessionId}`;
	});

	async function fetchIceServers() {
		if (cachedIceServers.length > 0) return cachedIceServers;
		try {
			const res = await fetch('/api/ice');
			if (res.ok) {
				const data = await res.json();
				if (Array.isArray(data.iceServers) && data.iceServers.length > 0) {
					cachedIceServers = data.iceServers;
					return data.iceServers;
				}
			}
		} catch (err) {
			console.warn('[Laki] Could not load dynamic ICE servers, using defaults:', err);
		}
		return [];
	}

	onMount(async () => {
		clientId = 'client-' + Math.random().toString(36).substring(2, 9);

		// Pre-fetch Metered STUN/TURN ICE credentials
		await fetchIceServers();

		// Check if URL has ?session= or ?code= parameter
		const urlParams = new URLSearchParams(window.location.search);
		const urlSession = urlParams.get('session') || urlParams.get('code');

		if (urlSession) {
			// Automatically join in receive mode
			activeTab = 'receive';
			sessionId = urlSession.trim();
			initReceiver(sessionId);
		} else {
			// Initialize default sender session ID
			sessionId = generateSessionId();
		}
	});

	onDestroy(() => {
		cleanup();
	});

	function cleanup() {
		if (engine) {
			engine.destroy();
			engine = null;
		}
		if (signaling) {
			signaling.destroy();
			signaling = null;
		}
	}

	// ----------------------------------------------------
	// SENDER WORKFLOW
	// ----------------------------------------------------
	async function handleFileSelected(file) {
		cleanup();
		if (!sessionId) {
			sessionId = generateSessionId();
		}

		errorMessage = '';
		warningMessage = '';
		completedResult = null;
		stats = null;

		const iceServers = await fetchIceServers();

		// Use PeerJS signaling server with fallback capability
		try {
			signaling = new PeerJsSignalingClient(sessionId, 'sender', clientId, iceServers);
		} catch (e) {
			console.warn('[Laki] PeerJS signaling fallback to SSE:', e);
			signaling = new SignalingClient(sessionId, 'sender', clientId);
		}

		engine = new TransferEngine(signaling, 'sender', iceServers);
		setupEngineListeners(engine);

		fileMeta = {
			name: file.name,
			size: file.size,
			type: file.type || 'application/octet-stream'
		};

		engine.setFileToSend(file);
	}

	// ----------------------------------------------------
	// RECEIVER WORKFLOW
	// ----------------------------------------------------
	function handleJoinSessionSubmit(e) {
		e?.preventDefault();
		const code = manualInputCode.trim();
		if (!code) return;

		let extractedId = code;
		if (code.includes('session=')) {
			try {
				const u = new URL(code);
				extractedId = u.searchParams.get('session') || code;
			} catch {
				const match = code.match(/session=([a-zA-Z0-9_-]+)/);
				if (match) extractedId = match[1];
			}
		}

		sessionId = extractedId;
		initReceiver(sessionId);
	}

	async function initReceiver(targetSessionId) {
		cleanup();
		errorMessage = '';
		warningMessage = '';
		completedResult = null;
		stats = null;
		fileMeta = null;

		const iceServers = await fetchIceServers();

		try {
			signaling = new PeerJsSignalingClient(targetSessionId, 'receiver', clientId, iceServers);
		} catch (e) {
			console.warn('[Laki] PeerJS signaling fallback to SSE:', e);
			signaling = new SignalingClient(targetSessionId, 'receiver', clientId);
		}

		engine = new TransferEngine(signaling, 'receiver', iceServers);
		setupEngineListeners(engine);

		transferState = 'waiting-peer';
	}

	function handleAcceptTransfer() {
		if (engine) {
			engine.acceptTransfer();
		}
	}

	function handleRejectTransfer() {
		if (engine) {
			engine.rejectTransfer();
		}
	}

	// ----------------------------------------------------
	// ENGINE EVENTS
	// ----------------------------------------------------
	function setupEngineListeners(eng) {
		eng.on('state-change', (newState) => {
			transferState = newState;
			isPaused = newState === 'paused';
		});

		eng.on('peer-connected', () => {
			peerConnected = true;
			playChime('notify');
		});

		eng.on('file-meta-received', (meta) => {
			fileMeta = meta;
			playChime('notify');
		});

		eng.on('stats', (newStats) => {
			stats = newStats;
		});

		eng.on('warning', (msg) => {
			warningMessage = msg;
		});

		eng.on('error', (msg) => {
			errorMessage = msg;
		});

		eng.on('transfer-complete', (res) => {
			completedResult = { ...res, size: fileMeta?.size || res.totalBytes };
			playChime('success');
		});

		eng.on('file-received', (res) => {
			completedResult = res;
			playChime('success');
			try {
				const a = document.createElement('a');
				a.href = res.url;
				a.download = res.filename;
				document.body.appendChild(a);
				a.click();
				document.body.removeChild(a);
			} catch (err) {
				console.error('Auto download trigger failed:', err);
			}
		});
	}

	// Controls
	function handleTogglePause() {
		if (engine) {
			engine.togglePause();
		}
	}

	function handleCancel() {
		if (confirm('Are you sure you want to cancel the transfer?')) {
			cleanup();
			transferState = 'idle';
			fileMeta = null;
			stats = null;
			if (activeTab === 'send') {
				sessionId = generateSessionId();
			}
		}
	}

	function handleRetry() {
		errorMessage = '';
		warningMessage = '';
		if (engine) {
			engine.forceRetry();
		}
	}

	function resetAll() {
		cleanup();
		transferState = 'idle';
		fileMeta = null;
		stats = null;
		completedResult = null;
		errorMessage = '';
		warningMessage = '';
		manualInputCode = '';

		if (window.history.pushState) {
			const cleanUrl = window.location.protocol + '//' + window.location.host + window.location.pathname;
			window.history.pushState({ path: cleanUrl }, '', cleanUrl);
		}

		if (activeTab === 'send') {
			sessionId = generateSessionId();
		}
	}

	function switchTab(tab) {
		if (transferState === 'transferring') {
			if (!confirm('A transfer is in progress. Are you sure you want to switch?')) {
				return;
			}
		}
		playChime('click');
		activeTab = tab;
		resetAll();
	}

	function generateSampleFile(sizeMb = 10) {
		playChime('click');
		const bytes = sizeMb * 1024 * 1024;
		const buffer = new Uint8Array(bytes);
		for (let i = 0; i < buffer.length; i += 1024) {
			buffer[i] = i % 256;
		}
		const sampleBlob = new Blob([buffer], { type: 'application/octet-stream' });
		const sampleFile = new File([sampleBlob], `sample-${sizeMb}MB-dataset.bin`, {
			type: 'application/octet-stream'
		});
		handleFileSelected(sampleFile);
	}
</script>

<div
	class="min-h-screen flex flex-col transition-colors duration-200 {theme.current === 'dark'
		? 'bg-[#191D23] text-[#DEDCDC]'
		: 'bg-[#DEDCDC] text-[#191D23]'}"
>
	<Navbar />

	<main class="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-12">
		<!-- Hero Title / Status -->
		<div class="text-center max-w-2xl mx-auto mb-8 sm:mb-10">
			<div
				class="inline-flex items-center gap-2 px-3 py-1 rounded-md text-xs font-mono mb-4 border transition-colors {theme.current === 'dark'
					? 'bg-[#16191E] text-[#989DAA] border-[#57707A]/40'
					: 'bg-[#DFDCDB] text-[#57707A] border-[#C5BAC4]'}"
			>
				<Sparkles class="w-3.5 h-3.5 text-[#57707A]" />
				<span>Direct Peer-to-Peer Transfer • End-to-End Encrypted</span>
			</div>
			<h1
				class="font-lexend text-3xl sm:text-5xl font-extrabold tracking-tight mb-3 sm:mb-4 {theme.current === 'dark'
					? 'text-[#DEDCDC]'
					: 'text-[#191D23]'}"
			>
				Send files directly.<br />
				<span class="text-[#57707A]">
					No cloud. No size limits.
				</span>
			</h1>
			<p
				class="text-xs sm:text-sm max-w-lg mx-auto leading-relaxed {theme.current === 'dark'
					? 'text-[#989DAA]'
					: 'text-[#57707A]'}"
			>
				Fast, private WebRTC streaming. Files fly directly between devices through chunked data channels with automatic backpressure and network recovery.
			</p>
		</div>

		<!-- Mode Switcher Tabs (Edgy Capsule) -->
		<div class="flex justify-center mb-8">
			<div
				class="inline-flex p-1 rounded-md border transition-colors {theme.current === 'dark'
					? 'bg-[#16191E] border-[#57707A]/40 shadow-inner'
					: 'bg-[#DFDCDB] border-[#C5BAC4] shadow-inner'}"
			>
				<button
					type="button"
					onclick={() => switchTab('send')}
					class="flex items-center gap-2 px-5 py-2 rounded-md text-xs sm:text-sm font-semibold transition-all duration-150 cursor-pointer active:translate-y-px {activeTab === 'send'
						? 'bg-[#57707A] text-white shadow-sm border border-[#7B919C]'
						: (theme.current === 'dark' ? 'text-[#989DAA] hover:text-[#DEDCDC]' : 'text-[#57707A] hover:text-[#191D23]')}"
				>
					<Send class="w-4 h-4" />
					<span>Send File</span>
				</button>
				<button
					type="button"
					onclick={() => switchTab('receive')}
					class="flex items-center gap-2 px-5 py-2 rounded-md text-xs sm:text-sm font-semibold transition-all duration-150 cursor-pointer active:translate-y-px {activeTab === 'receive'
						? 'bg-[#57707A] text-white shadow-sm border border-[#7B919C]'
						: (theme.current === 'dark' ? 'text-[#989DAA] hover:text-[#DEDCDC]' : 'text-[#57707A] hover:text-[#191D23]')}"
				>
					<Download class="w-4 h-4" />
					<span>Receive File</span>
				</button>
			</div>
		</div>

		<!-- Notifications & Network Fluctuation Banners -->
		<StatusBanner
			warning={warningMessage}
			error={errorMessage}
			retryCount={engine?.retryAttempts || 0}
			onRetry={handleRetry}
			onReset={resetAll}
		/>

		<!-- ============================================== -->
		<!-- TAB 1: SENDER VIEW -->
		<!-- ============================================== -->
		{#if activeTab === 'send'}
			<div class="space-y-6 animate-in fade-in duration-200">
				<!-- Stage 1: No file chosen yet -->
				{#if transferState === 'idle'}
					<DropZone onFileSelected={handleFileSelected} />

					<!-- Quick demo generator for rapid testing -->
					<div class="text-center pt-2">
						<span class="text-xs mr-2 {theme.current === 'dark' ? 'text-[#989DAA]' : 'text-[#57707A]'}">Want to test right now?</span>
						<button
							type="button"
							onclick={() => generateSampleFile(15)}
							class="text-xs font-semibold text-[#57707A] hover:text-[#7B919C] underline decoration-2 underline-offset-4 cursor-pointer"
						>
							Generate 15 MB test sample file
						</button>
					</div>

				<!-- Stage 2: File chosen, waiting for receiver / ready -->
				{:else if transferState === 'waiting-peer' || transferState === 'ready-to-accept'}
					<ShareCard
						{shareUrl}
						{sessionId}
						{peerConnected}
						onShowQr={() => (showQrModal = true)}
					/>
					<FileCard {fileMeta} />

				<!-- Stage 3: Transfer in progress or paused -->
				{:else if transferState === 'transferring' || transferState === 'paused' || transferState === 'reconnecting'}
					<FileCard {fileMeta} />
					<TransferProgress
						{stats}
						{isPaused}
						isSender={true}
						onTogglePause={handleTogglePause}
						onCancel={handleCancel}
					/>

				<!-- Stage 4: Transfer completed -->
				{:else if transferState === 'completed'}
					<SuccessCard
						result={completedResult}
						isReceiver={false}
						onReset={resetAll}
					/>

				<!-- Stage 5: Receiver rejected -->
				{:else if transferState === 'rejected'}
					<div
						class="w-full rounded-md p-8 text-center border {theme.current === 'dark'
							? 'bg-[#21262F] border-[#57707A]/40 text-[#DEDCDC]'
							: 'bg-[#ECEAE9] border-[#C5BAC4] text-[#191D23]'}"
					>
						<p class="text-sm font-semibold mb-4">The receiver declined this file transfer.</p>
						<button
							type="button"
							onclick={resetAll}
							class="px-4 py-2 rounded-md bg-[#57707A] hover:bg-[#7B919C] text-white text-xs font-semibold cursor-pointer border border-[#7B919C]"
						>
							Select Another File
						</button>
					</div>
				{/if}
			</div>

		<!-- ============================================== -->
		<!-- TAB 2: RECEIVER VIEW -->
		<!-- ============================================== -->
		{:else if activeTab === 'receive'}
			<div class="space-y-6 animate-in fade-in duration-200">
				<!-- Stage 1: Awaiting manual session input if no session active -->
				{#if transferState === 'idle' && !sessionId}
					<form
						onsubmit={handleJoinSessionSubmit}
						class="w-full rounded-md p-6 sm:p-8 border shadow-lg transition-colors {theme.current === 'dark'
							? 'bg-[#21262F] border-[#57707A]/40'
							: 'bg-[#ECEAE9] border-[#C5BAC4]'}"
					>
						<div class="flex items-center gap-2 mb-2">
							<Link2 class="w-5 h-5 text-[#57707A]" />
							<h3 class="text-base sm:text-lg font-bold tracking-tight {theme.current === 'dark' ? 'text-[#DEDCDC]' : 'text-[#191D23]'}">
								Enter Transfer Link or Code
							</h3>
						</div>
						<p class="text-xs mb-5 {theme.current === 'dark' ? 'text-[#989DAA]' : 'text-[#57707A]'}">
							Paste the link or 6-character session code provided by the sender to connect and receive the file.
						</p>

						<div class="flex flex-col sm:flex-row items-center gap-2.5">
							<input
								type="text"
								bind:value={manualInputCode}
								placeholder="e.g. swift-4a8x or full link"
								class="w-full rounded-md px-3.5 py-2.5 text-xs sm:text-sm font-mono border focus:outline-none transition-colors {theme.current === 'dark'
									? 'bg-[#16191E] border-[#57707A]/50 text-[#DEDCDC] focus:border-[#7B919C]'
									: 'bg-[#DFDCDB] border-[#989DAA] text-[#191D23] focus:border-[#57707A]'}"
								required
							/>
							<button
								type="submit"
								class="w-full sm:w-auto px-5 py-2.5 rounded-md bg-[#57707A] hover:bg-[#7B919C] text-white font-semibold text-xs sm:text-sm border border-[#7B919C] transition-all duration-150 active:translate-y-px cursor-pointer whitespace-nowrap"
							>
								Connect to Sender
							</button>
						</div>
					</form>

				<!-- Stage 2: Waiting for sender metadata -->
				{:else if transferState === 'waiting-peer' && !fileMeta}
					<div
						class="w-full rounded-md p-8 sm:p-12 text-center border transition-colors {theme.current === 'dark'
							? 'bg-[#21262F] border-[#57707A]/40'
							: 'bg-[#ECEAE9] border-[#C5BAC4]'}"
					>
						<div
							class="inline-flex items-center justify-center w-12 h-12 rounded-md border mb-4 transition-colors {theme.current === 'dark'
								? 'bg-[#16191E] border-[#57707A]/60 text-[#7B919C]'
								: 'bg-[#DFDCDB] border-[#989DAA] text-[#57707A]'}"
						>
							<Globe class="w-6 h-6 animate-pulse" />
						</div>
						<h3 class="text-base sm:text-lg font-bold tracking-tight mb-2 {theme.current === 'dark' ? 'text-[#DEDCDC]' : 'text-[#191D23]'}">
							Connecting to Sender Session
						</h3>
						<p class="text-xs font-mono mb-4 {theme.current === 'dark' ? 'text-[#989DAA]' : 'text-[#57707A]'}">
							Session: <span class="font-bold text-[#57707A]">{sessionId}</span>
						</p>
						<p class="text-xs max-w-md mx-auto {theme.current === 'dark' ? 'text-[#989DAA]' : 'text-[#57707A]'}">
							Negotiating WebRTC STUN peer-to-peer data channel. Waiting for sender to provide file details...
						</p>
					</div>

				<!-- Stage 3: File details received, waiting for user to click "Accept" -->
				{:else if transferState === 'ready-to-accept' || (fileMeta && transferState === 'waiting-peer')}
					<FileCard
						{fileMeta}
						isReceiver={true}
						isReadyToAccept={true}
						onAccept={handleAcceptTransfer}
						onReject={handleRejectTransfer}
					/>

				<!-- Stage 4: Receiving chunks -->
				{:else if transferState === 'transferring' || transferState === 'paused' || transferState === 'reconnecting'}
					<FileCard {fileMeta} />
					<TransferProgress
						{stats}
						{isPaused}
						isSender={false}
						onTogglePause={handleTogglePause}
						onCancel={handleCancel}
					/>

				<!-- Stage 5: Received & Assembled -->
				{:else if transferState === 'completed'}
					<SuccessCard
						result={completedResult}
						isReceiver={true}
						onReset={resetAll}
					/>

				<!-- Stage 6: Declined -->
				{:else if transferState === 'rejected'}
					<div
						class="w-full rounded-md p-8 text-center border {theme.current === 'dark'
							? 'bg-[#21262F] border-[#57707A]/40 text-[#DEDCDC]'
							: 'bg-[#ECEAE9] border-[#C5BAC4] text-[#191D23]'}"
					>
						<p class="text-sm font-semibold mb-4">You declined this file transfer.</p>
						<button
							type="button"
							onclick={resetAll}
							class="px-4 py-2 rounded-md border text-xs font-semibold cursor-pointer {theme.current === 'dark'
								? 'bg-[#16191E] hover:bg-[#191D23] text-[#DEDCDC] border-[#57707A]/50'
								: 'bg-[#DFDCDB] hover:bg-[#D2CECE] text-[#191D23] border-[#989DAA]'}"
						>
							Receive Another File
						</button>
					</div>
				{/if}
			</div>
		{/if}

		<!-- Security & Technical Features Footer Info (Edgy Cards) -->
		<div class="mt-14 pt-8 border-t grid grid-cols-1 md:grid-cols-3 gap-4 text-left {theme.current === 'dark' ? 'border-[#57707A]/30' : 'border-[#C5BAC4]'}">
			<div
				class="p-4 rounded-md border transition-colors {theme.current === 'dark'
					? 'bg-[#21262F]/40 border-[#57707A]/30'
					: 'bg-[#ECEAE9] border-[#C5BAC4]'}"
			>
				<div class="flex items-center gap-2 text-xs font-bold mb-1.5 {theme.current === 'dark' ? 'text-[#DEDCDC]' : 'text-[#191D23]'}">
					<ShieldCheck class="w-4 h-4 text-[#57707A]" />
					<span>Zero-Knowledge Relay</span>
				</div>
				<p class="text-xs leading-relaxed {theme.current === 'dark' ? 'text-[#989DAA]' : 'text-[#57707A]'}">
					File contents never touch a central storage server. Data is streamed in memory directly between browser RTCDataChannels.
				</p>
			</div>

			<div
				class="p-4 rounded-md border transition-colors {theme.current === 'dark'
					? 'bg-[#21262F]/40 border-[#57707A]/30'
					: 'bg-[#ECEAE9] border-[#C5BAC4]'}"
			>
				<div class="flex items-center gap-2 text-xs font-bold mb-1.5 {theme.current === 'dark' ? 'text-[#DEDCDC]' : 'text-[#191D23]'}">
					<Zap class="w-4 h-4 text-[#7B919C]" />
					<span>Backpressure Flow Control</span>
				</div>
				<p class="text-xs leading-relaxed {theme.current === 'dark' ? 'text-[#989DAA]' : 'text-[#57707A]'}">
					Adaptive 64 KB chunking with automated buffer watermarking prevents browser tab crashes during multi-gigabyte transfers.
				</p>
			</div>

			<div
				class="p-4 rounded-md border transition-colors {theme.current === 'dark'
					? 'bg-[#21262F]/40 border-[#57707A]/30'
					: 'bg-[#ECEAE9] border-[#C5BAC4]'}"
			>
				<div class="flex items-center gap-2 text-xs font-bold mb-1.5 {theme.current === 'dark' ? 'text-[#DEDCDC]' : 'text-[#191D23]'}">
					<RotateCcw class="w-4 h-4 text-[#989DAA]" />
					<span>Automatic Network Recovery</span>
				</div>
				<p class="text-xs leading-relaxed {theme.current === 'dark' ? 'text-[#989DAA]' : 'text-[#57707A]'}">
					Integrated ICE restarts, chunk sequence verification, and resilient retry mechanisms maintain your transfer even through Wi-Fi drops.
				</p>
			</div>
		</div>
	</main>

	<!-- Footer -->
	<footer
		class="w-full border-t py-6 text-center text-xs font-mono transition-colors {theme.current === 'dark'
			? 'border-[#57707A]/30 text-[#989DAA]'
			: 'border-[#C5BAC4] text-[#57707A]'}"
	>
		Laki • Direct WebRTC Peer-to-Peer Protocol
	</footer>

	<!-- QR Code Modal for Mobile Sharing -->
	<QrModal
		isOpen={showQrModal}
		url={shareUrl}
		onClose={() => (showQrModal = false)}
	/>
</div>
