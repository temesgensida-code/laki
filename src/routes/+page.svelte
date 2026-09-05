<script>
	import { onMount, onDestroy } from 'svelte';
	import { page } from '$app/state';
	import Navbar from '$lib/components/Navbar.svelte';
	import DropZone from '$lib/components/DropZone.svelte';
	import ShareCard from '$lib/components/ShareCard.svelte';
	import FileCard from '$lib/components/FileCard.svelte';
	import TransferProgress from '$lib/components/TransferProgress.svelte';
	import StatusBanner from '$lib/components/StatusBanner.svelte';
	import SuccessCard from '$lib/components/SuccessCard.svelte';
	import QrModal from '$lib/components/QrModal.svelte';

	import { SignalingClient } from '$lib/webrtc/signalingClient.js';
	import { TransferEngine } from '$lib/webrtc/transferEngine.js';
	import { generateSessionId } from '$lib/utils/formatters.js';
	import {
		Send,
		Download,
		Link2,
		ShieldCheck,
		Zap,
		Globe,
		RotateCcw,
		HelpCircle,
		Sparkles,
		CheckCircle2
	} from '@lucide/svelte';

	// Reactive state variables
	let activeTab = $state('send'); // 'send' | 'receive'
	let sessionId = $state('');
	let manualInputCode = $state('');
	let clientId = $state('');

	// Engine & Signaling instances
	/** @type {SignalingClient | null} */
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

	// Modals
	let showQrModal = $state(false);

	// Computed share URL
	let shareUrl = $derived.by(() => {
		if (typeof window === 'undefined' || !sessionId) return '';
		return `${window.location.origin}/?session=${sessionId}`;
	});

	onMount(() => {
		clientId = 'client-' + Math.random().toString(36).substring(2, 9);

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
	function handleFileSelected(file) {
		cleanup();
		if (!sessionId) {
			sessionId = generateSessionId();
		}

		errorMessage = '';
		warningMessage = '';
		completedResult = null;
		stats = null;

		signaling = new SignalingClient(sessionId, 'sender', clientId);
		engine = new TransferEngine(signaling, 'sender');
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
		// If user pasted a full URL, extract the session param
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

	function initReceiver(targetSessionId) {
		cleanup();
		errorMessage = '';
		warningMessage = '';
		completedResult = null;
		stats = null;
		fileMeta = null;

		signaling = new SignalingClient(targetSessionId, 'receiver', clientId);
		engine = new TransferEngine(signaling, 'receiver');
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
		});

		eng.on('file-meta-received', (meta) => {
			fileMeta = meta;
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
		});

		eng.on('file-received', (res) => {
			completedResult = res;
			// Automatically trigger browser download
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

		// Clear URL parameters without reloading
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
		activeTab = tab;
		resetAll();
	}

	// Quick sample test file generator
	function generateSampleFile(sizeMb = 10) {
		const bytes = sizeMb * 1024 * 1024;
		const buffer = new Uint8Array(bytes);
		// Fill with recognizable pattern
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

<div class="min-h-screen flex flex-col bg-[#090b10] text-zinc-100 selection:bg-indigo-500/30">
	<Navbar />

	<main class="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-12">
		<!-- Hero Title / Status -->
		<div class="text-center max-w-2xl mx-auto mb-8 sm:mb-10">
			<div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 text-xs font-mono mb-4">
				<Sparkles class="w-3.5 h-3.5 text-indigo-400" />
				<span>Direct Peer-to-Peer Transfer • End-to-End Encrypted</span>
			</div>
			<h1 class="text-3xl sm:text-5xl font-extrabold tracking-tight text-white mb-3 sm:mb-4">
				Send files directly.<br />
				<span class="bg-gradient-to-r from-indigo-400 via-cyan-400 to-emerald-400 bg-clip-text text-transparent">
					No cloud. No size limits.
				</span>
			</h1>
			<p class="text-sm sm:text-base text-zinc-400">
				Fast, private WebRTC streaming. Files fly directly between devices through chunked data channels with automatic backpressure and network recovery.
			</p>
		</div>

		<!-- Mode Switcher Tabs (Send / Receive) -->
		<div class="flex justify-center mb-8">
			<div class="inline-flex p-1 rounded-xl bg-zinc-900 border border-zinc-800 shadow-inner">
				<button
					type="button"
					onclick={() => switchTab('send')}
					class="flex items-center gap-2 px-5 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all duration-150 cursor-pointer {activeTab === 'send'
						? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
						: 'text-zinc-400 hover:text-zinc-200'}"
				>
					<Send class="w-4 h-4" />
					<span>Send File</span>
				</button>
				<button
					type="button"
					onclick={() => switchTab('receive')}
					class="flex items-center gap-2 px-5 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all duration-150 cursor-pointer {activeTab === 'receive'
						? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
						: 'text-zinc-400 hover:text-zinc-200'}"
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
						<span class="text-xs text-zinc-400 mr-2">Want to test right now?</span>
						<button
							type="button"
							onclick={() => generateSampleFile(15)}
							class="text-xs font-medium text-indigo-400 hover:text-indigo-300 underline decoration-indigo-400/30 underline-offset-4 cursor-pointer"
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
					<div class="w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-8 text-center">
						<p class="text-base text-zinc-200 mb-4">The receiver declined this file transfer.</p>
						<button
							type="button"
							onclick={resetAll}
							class="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold cursor-pointer"
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
						class="w-full bg-zinc-900/80 border border-zinc-800 rounded-2xl p-6 sm:p-8 shadow-xl"
					>
						<div class="flex items-center gap-2.5 mb-3">
							<Link2 class="w-5 h-5 text-indigo-400" />
							<h3 class="text-lg font-semibold text-zinc-100">Enter Transfer Link or Code</h3>
						</div>
						<p class="text-xs sm:text-sm text-zinc-400 mb-5">
							Paste the link or 6-character session code provided by the sender to connect and receive the file.
						</p>

						<div class="flex flex-col sm:flex-row items-center gap-3">
							<input
								type="text"
								bind:value={manualInputCode}
								placeholder="e.g. swift-4a8x or full link"
								class="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm font-mono text-zinc-100 placeholder-zinc-400 focus:outline-none focus:border-indigo-500"
								required
							/>
							<button
								type="submit"
								class="w-full sm:w-auto px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm shadow-lg shadow-indigo-600/25 transition-all duration-150 active:scale-[0.98] cursor-pointer whitespace-nowrap"
							>
								Connect to Sender
							</button>
						</div>
					</form>

				<!-- Stage 2: Waiting for sender metadata -->
				{:else if transferState === 'waiting-peer' && !fileMeta}
					<div class="w-full bg-zinc-900/80 border border-zinc-800 rounded-2xl p-8 sm:p-12 text-center">
						<div class="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 mb-4">
							<Globe class="w-6 h-6 animate-pulse" />
						</div>
						<h3 class="text-lg font-semibold text-zinc-100 mb-2">Connecting to Sender Session</h3>
						<p class="text-xs text-zinc-400 max-w-sm mx-auto mb-4 font-mono">
							Session: <span class="text-indigo-400">{sessionId}</span>
						</p>
						<p class="text-xs text-zinc-400 max-w-md mx-auto">
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
					<div class="w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-8 text-center">
						<p class="text-base text-zinc-200 mb-4">You declined this file transfer.</p>
						<button
							type="button"
							onclick={resetAll}
							class="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold cursor-pointer border border-zinc-700"
						>
							Receive Another File
						</button>
					</div>
				{/if}
			</div>
		{/if}

		<!-- Security & Technical Features Footer Info -->
		<div class="mt-16 pt-8 border-t border-zinc-800/60 grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
			<div class="p-4 rounded-xl bg-zinc-900/30 border border-zinc-800/40">
				<div class="flex items-center gap-2 text-zinc-200 text-sm font-semibold mb-1.5">
					<ShieldCheck class="w-4 h-4 text-emerald-400" />
					<span>Zero-Knowledge Relay</span>
				</div>
				<p class="text-xs text-zinc-400 leading-relaxed">
					File contents never touch a central storage server. Data is streamed in memory directly between browser RTCDataChannels.
				</p>
			</div>

			<div class="p-4 rounded-xl bg-zinc-900/30 border border-zinc-800/40">
				<div class="flex items-center gap-2 text-zinc-200 text-sm font-semibold mb-1.5">
					<Zap class="w-4 h-4 text-indigo-400" />
					<span>Backpressure Flow Control</span>
				</div>
				<p class="text-xs text-zinc-400 leading-relaxed">
					Adaptive 64 KB chunking with automated buffer watermarking prevents browser tab crashes during multi-gigabyte transfers.
				</p>
			</div>

			<div class="p-4 rounded-xl bg-zinc-900/30 border border-zinc-800/40">
				<div class="flex items-center gap-2 text-zinc-200 text-sm font-semibold mb-1.5">
					<RotateCcw class="w-4 h-4 text-cyan-400" />
					<span>Automatic Network Recovery</span>
				</div>
				<p class="text-xs text-zinc-400 leading-relaxed">
					Integrated ICE restarts, chunk sequence verification, and resilient retry mechanisms maintain your transfer even through Wi-Fi drops.
				</p>
			</div>
		</div>
	</main>

	<!-- Footer -->
	<footer class="w-full border-t border-zinc-800/60 py-6 text-center text-xs text-zinc-400 font-mono">
		LakiDrop WebRTC • Direct Peer-to-Peer Protocol
	</footer>

	<!-- QR Code Modal for Mobile Sharing -->
	<QrModal
		isOpen={showQrModal}
		url={shareUrl}
		onClose={() => (showQrModal = false)}
	/>
</div>
