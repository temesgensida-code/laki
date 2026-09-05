import {
	RTC_CONFIG,
	CHUNK_SIZE,
	HEADER_SIZE,
	DATA_PER_CHUNK,
	BUFFERED_AMOUNT_LOW_THRESHOLD,
	BUFFERED_AMOUNT_HIGH_WATERMARK,
	ICE_DISCONNECT_GRACE_PERIOD_MS,
	MAX_RETRY_ATTEMPTS,
	STALL_TIMEOUT_MS
} from './config.js';

/**
 * @typedef {Object} TransferStats
 * @property {number} bytesTransferred
 * @property {number} totalBytes
 * @property {number} progress (0 to 100)
 * @property {number} speed (bytes per second)
 * @property {number} eta (seconds)
 * @property {number} elapsedTime (seconds)
 * @property {number} currentChunk
 * @property {number} totalChunks
 * @property {number} bufferPercentage
 * @property {string} connectionStatus
 * @property {string} networkQuality ('optimal' | 'reconnecting' | 'stalled' | 'offline')
 * @property {'direct' | 'relay'} [routeType]
 * @property {string} [relayProtocol]
 */

export class TransferEngine {
	/**
	 * @param {import('./signalingClient.js').SignalingClient | import('./peerjsSignalingClient.js').PeerJsSignalingClient} signaling
	 * @param {'sender' | 'receiver'} role
	 * @param {Array<RTCIceServer>} [customIceServers]
	 */
	constructor(signaling, role, customIceServers = null) {
		this.signaling = signaling;
		this.role = role;
		this.customIceServers = customIceServers;

		/** @type {RTCPeerConnection | null} */
		this.pc = null;
		/** @type {RTCDataChannel | null} */
		this.dataChannel = null;

		// File and Chunk state
		/** @type {File | null} */
		this.file = null;
		/** @type {any | null} */
		this.fileMeta = null;

		/** @type {Array<ArrayBuffer | Uint8Array>} */
		this.receivedChunks = [];
		this.totalChunks = 0;
		this.chunksReceivedCount = 0;
		this.bytesTransferred = 0;
		this.totalBytes = 0;

		// State flags
		this.state = 'idle'; // 'idle' | 'waiting-peer' | 'ready-to-accept' | 'transferring' | 'paused' | 'reconnecting' | 'completed' | 'error' | 'rejected'
		this.isPaused = false;
		this.isDestroyed = false;
		this.transferStartTime = 0;
		this.transferPauseTime = 0;
		this.totalPausedDuration = 0;

		// Telemetry & speed calculation
		this.speedSamples = []; // [{ time, bytes }]
		this.currentSpeed = 0; // bytes/sec
		this.statsInterval = null;
		this.lastChunkTime = 0;
		this.stallCheckInterval = null;

		// Route detection (Direct vs Metered TURN Relay)
		this.routeType = 'direct'; // 'direct' | 'relay'
		this.relayProtocol = 'udp';
		this.isRelayAvailable = false;

		// Resilience & retry
		this.retryAttempts = 0;
		this.iceDisconnectTimer = null;
		this.errorMessage = '';
		this.warningMessage = '';
		this.networkQuality = 'optimal';

		/** @type {Record<string, Array<(data: any) => void>>} */
		this.listeners = {};

		this.bindSignalingEvents();
	}

	on(event, cb) {
		if (!this.listeners[event]) this.listeners[event] = [];
		this.listeners[event].push(cb);
		return () => this.off(event, cb);
	}

	off(event, cb) {
		if (!this.listeners[event]) return;
		this.listeners[event] = this.listeners[event].filter((c) => c !== cb);
	}

	emit(event, data) {
		const cbs = this.listeners[event] || [];
		for (const cb of cbs) {
			try {
				cb(data);
			} catch (err) {
				console.error(`[Engine] Listener error for ${event}:`, err);
			}
		}
	}

	/**
	 * Setup signaling event listeners.
	 */
	bindSignalingEvents() {
		this.signaling.on('peer-status', (info) => {
			if (info.status === 'connected') {
				this.warningMessage = '';
				this.emit('peer-connected', info);

				// If we are sender and have a peer connected, create offer
				if (this.role === 'sender' && (!this.pc || this.pc.connectionState === 'new')) {
					this.initPeerConnection();
					this.createAndSendOffer();
				}
			} else if (info.status === 'disconnected') {
				if (this.state === 'transferring') {
					this.handleNetworkFluctuation('Peer temporarily disconnected from signaling relay');
				}
			}
		});

		this.signaling.on('file-meta', (meta) => {
			this.fileMeta = meta;
			this.totalBytes = meta.size;
			this.totalChunks = meta.totalChunks;
			if (this.state === 'idle' || this.state === 'waiting-peer') {
				this.state = 'ready-to-accept';
				this.emit('state-change', this.state);
			}
			this.emit('file-meta-received', meta);
		});

		this.signaling.on('offer', async (offer) => {
			if (this.role === 'receiver') {
				if (!this.pc) this.initPeerConnection();
				try {
					await this.pc.setRemoteDescription(new RTCSessionDescription(offer));
					const answer = await this.pc.createAnswer();
					await this.pc.setLocalDescription(answer);
					this.signaling.send('answer', answer);
				} catch (err) {
					console.error('[Engine] Failed handling offer:', err);
					this.setError('Failed to negotiate WebRTC offer with sender.');
				}
			}
		});

		this.signaling.on('answer', async (answer) => {
			if (this.role === 'sender' && this.pc) {
				try {
					await this.pc.setRemoteDescription(new RTCSessionDescription(answer));
				} catch (err) {
					console.error('[Engine] Failed handling answer:', err);
				}
			}
		});

		this.signaling.on('candidate', async (candidate) => {
			if (this.pc && candidate) {
				try {
					await this.pc.addIceCandidate(new RTCIceCandidate(candidate));
				} catch (err) {
					console.warn('[Engine] Error adding ICE candidate:', err);
				}
			}
		});

		this.signaling.on('accept-transfer', () => {
			if (this.role === 'sender') {
				this.startSending();
			}
		});

		this.signaling.on('reject-transfer', () => {
			this.state = 'rejected';
			this.errorMessage = 'The receiver declined the file transfer.';
			this.emit('state-change', this.state);
		});

		this.signaling.on('pause-transfer', () => {
			this.handleRemotePause();
		});

		this.signaling.on('resume-transfer', (data) => {
			this.handleRemoteResume(data?.fromChunk);
		});

		this.signaling.on('request-resume', (data) => {
			if (this.role === 'sender') {
				this.resumeSendingFrom(data.startFromChunk || 0);
			}
		});
	}

	/**
	 * Initialize RTCPeerConnection with dynamic Metered STUN/TURN configuration.
	 */
	initPeerConnection() {
		if (this.pc) {
			try {
				this.pc.close();
			} catch {
				// ignored
			}
		}

		const rtcOptions = {
			iceServers:
				this.customIceServers && this.customIceServers.length > 0
					? this.customIceServers
					: RTC_CONFIG.iceServers,
			iceCandidatePoolSize: 10
		};

		this.pc = new RTCPeerConnection(rtcOptions);

		this.pc.onicecandidate = (event) => {
			if (event.candidate) {
				this.signaling.send('candidate', event.candidate.toJSON());
			}
		};

		this.pc.oniceconnectionstatechange = () => {
			const state = this.pc?.iceConnectionState;
			this.emit('ice-state-change', state);

			if (state === 'connected' || state === 'completed') {
				if (this.iceDisconnectTimer) {
					clearTimeout(this.iceDisconnectTimer);
					this.iceDisconnectTimer = null;
				}
				this.networkQuality = 'optimal';
				this.warningMessage = '';
				this.retryAttempts = 0;

				this.inspectRouteType();

				if (this.state === 'reconnecting') {
					this.state = 'transferring';
					this.emit('state-change', this.state);
				}
			} else if (state === 'disconnected') {
				this.handleNetworkFluctuation('Network fluctuation detected. Verifying peer connection...');
			} else if (state === 'failed') {
				this.handleIceFailure();
			}
		};

		this.pc.onconnectionstatechange = () => {
			const state = this.pc?.connectionState;
			this.emit('connection-state-change', state);

			if (state === 'connected') {
				this.inspectRouteType();
			} else if (state === 'failed') {
				this.handleIceFailure();
			}
		};

		if (this.role === 'sender') {
			this.setupSenderDataChannel();
		} else {
			this.pc.ondatachannel = (event) => {
				this.setupReceiverDataChannel(event.channel);
			};
		}
	}

	/**
	 * Inspect RTCStats to determine if connection is direct P2P or relayed via TURN.
	 */
	async inspectRouteType() {
		if (!this.pc) return;
		try {
			const stats = await this.pc.getStats();
			let selectedPair = null;

			stats.forEach((report) => {
				if (report.type === 'transport' && report.selectedCandidatePairId) {
					selectedPair = stats.get(report.selectedCandidatePairId);
				} else if (report.type === 'candidate-pair' && (report.selected || report.nominated)) {
					selectedPair = report;
				}
			});

			if (selectedPair) {
				const localCandidate = stats.get(selectedPair.localCandidateId);
				const remoteCandidate = stats.get(selectedPair.remoteCandidateId);

				const isRelayed =
					localCandidate?.candidateType === 'relay' ||
					remoteCandidate?.candidateType === 'relay';

				this.routeType = isRelayed ? 'relay' : 'direct';
				this.relayProtocol =
					localCandidate?.protocol || remoteCandidate?.protocol || 'udp';
			}
		} catch {
			// ignore stats retrieval errors
		}
	}

	/**
	 * Setup DataChannel on sender side.
	 */
	setupSenderDataChannel() {
		if (!this.pc) return;
		this.dataChannel = this.pc.createDataChannel('lakiFileTransfer', {
			ordered: true
		});
		this.dataChannel.binaryType = 'arraybuffer';
		this.dataChannel.bufferedAmountLowThreshold = BUFFERED_AMOUNT_LOW_THRESHOLD;

		this.dataChannel.onopen = () => {
			this.emit('datachannel-open');
			this.inspectRouteType();
		};

		this.dataChannel.onclose = () => {
			this.emit('datachannel-close');
		};

		this.dataChannel.onerror = (err) => {
			console.error('[Engine] Sender DataChannel error:', err);
			this.setError('DataChannel communication error occurred.');
		};

		this.dataChannel.onmessage = (event) => {
			try {
				if (typeof event.data === 'string') {
					const msg = JSON.parse(event.data);
					if (msg.type === 'ack') {
						this.emit('ack-received', msg);
					} else if (msg.type === 'pause') {
						this.handleRemotePause();
					} else if (msg.type === 'resume') {
						this.handleRemoteResume(msg.fromChunk);
					} else if (msg.type === 'ping') {
						this.dataChannel?.send(JSON.stringify({ type: 'pong' }));
					}
				}
			} catch {
				// non-json
			}
		};
	}

	/**
	 * Setup DataChannel on receiver side.
	 * @param {RTCDataChannel} channel
	 */
	setupReceiverDataChannel(channel) {
		this.dataChannel = channel;
		this.dataChannel.binaryType = 'arraybuffer';

		this.dataChannel.onopen = () => {
			this.emit('datachannel-open');
			this.inspectRouteType();
		};

		this.dataChannel.onclose = () => {
			this.emit('datachannel-close');
		};

		this.dataChannel.onerror = (err) => {
			console.error('[Engine] Receiver DataChannel error:', err);
			this.setError('DataChannel communication error occurred.');
		};

		this.dataChannel.onmessage = (event) => {
			this.lastChunkTime = Date.now();

			if (typeof event.data === 'string') {
				try {
					const msg = JSON.parse(event.data);
					if (msg.type === 'file-start') {
						this.fileMeta = msg;
						this.totalBytes = msg.size;
						this.totalChunks = msg.totalChunks;
						this.receivedChunks = new Array(this.totalChunks);
						this.chunksReceivedCount = 0;
						this.bytesTransferred = 0;
						this.startTelemetry();
					} else if (msg.type === 'file-end') {
						this.finalizeReceivedFile();
					} else if (msg.type === 'pause') {
						this.handleRemotePause();
					} else if (msg.type === 'resume') {
						this.handleRemoteResume();
					}
				} catch {
					// ignored
				}
			} else if (event.data instanceof ArrayBuffer) {
				this.handleIncomingChunk(event.data);
			}
		};
	}

	/**
	 * Handle incoming binary chunk on receiver.
	 * @param {ArrayBuffer} buffer
	 */
	handleIncomingChunk(buffer) {
		if (buffer.byteLength < HEADER_SIZE) return;

		const view = new DataView(buffer);
		const chunkIndex = view.getUint32(0);
		const totalChunks = view.getUint32(4);

		if (!this.receivedChunks.length && totalChunks > 0) {
			this.totalChunks = totalChunks;
			this.receivedChunks = new Array(totalChunks);
		}

		// Extract file data payload (skipping 8-byte header)
		const payload = buffer.slice(HEADER_SIZE);

		if (!this.receivedChunks[chunkIndex]) {
			this.receivedChunks[chunkIndex] = payload;
			this.chunksReceivedCount++;
			this.bytesTransferred += payload.byteLength;
			this.recordSpeedSample(payload.byteLength);

			// Send periodic ack every 32 chunks or when finished
			if (chunkIndex % 32 === 0 || this.chunksReceivedCount === this.totalChunks) {
				if (this.dataChannel?.readyState === 'open') {
					try {
						this.dataChannel.send(
							JSON.stringify({
								type: 'ack',
								chunkIndex,
								bytesReceived: this.bytesTransferred
							})
						);
					} catch {
						// ignored
					}
				}
			}

			// If all chunks received, finalize
			if (this.chunksReceivedCount === this.totalChunks && this.totalChunks > 0) {
				this.finalizeReceivedFile();
			}
		}
	}

	/**
	 * Assemble received chunks into a Blob and finish.
	 */
	finalizeReceivedFile() {
		if (this.state === 'completed') return;

		this.stopTelemetry();
		this.state = 'completed';

		const mime = this.fileMeta?.type || 'application/octet-stream';
		const blob = new Blob(this.receivedChunks, { type: mime });
		const fileUrl = URL.createObjectURL(blob);

		const result = {
			blob,
			url: fileUrl,
			filename: this.fileMeta?.name || 'downloaded-file',
			size: this.totalBytes,
			mime,
			duration: (Date.now() - this.transferStartTime - this.totalPausedDuration) / 1000,
			averageSpeed: this.totalBytes / Math.max(1, (Date.now() - this.transferStartTime - this.totalPausedDuration) / 1000)
		};

		this.emit('file-received', result);
		this.emit('state-change', this.state);
	}

	/**
	 * Create WebRTC offer and broadcast to peer.
	 */
	async createAndSendOffer(isIceRestart = false) {
		if (!this.pc) return;
		try {
			const options = isIceRestart ? { iceRestart: true } : undefined;
			const offer = await this.pc.createOffer(options);
			await this.pc.setLocalDescription(offer);
			this.signaling.send('offer', offer);
		} catch (err) {
			console.error('[Engine] Failed to create offer:', err);
			this.setError('Failed to create WebRTC connection offer.');
		}
	}

	/**
	 * Sender initiates file selection and prepares metadata.
	 * @param {File} file
	 */
	setFileToSend(file) {
		this.file = file;
		this.totalBytes = file.size;
		this.totalChunks = Math.ceil(file.size / DATA_PER_CHUNK);

		this.fileMeta = {
			name: file.name,
			size: file.size,
			type: file.type || 'application/octet-stream',
			totalChunks: this.totalChunks,
			chunkSize: CHUNK_SIZE
		};

		this.state = 'waiting-peer';
		this.emit('state-change', this.state);

		// Broadcast file metadata to session
		this.signaling.send('file-meta', this.fileMeta);

		// If peer already connected, initiate connection
		this.initPeerConnection();
		this.createAndSendOffer();
	}

	/**
	 * Receiver accepts the transfer.
	 */
	acceptTransfer() {
		if (this.role !== 'receiver') return;
		this.state = 'transferring';
		this.transferStartTime = Date.now();
		this.emit('state-change', this.state);

		this.startTelemetry();

		// Notify sender via DataChannel if open, or via signaling
		if (this.dataChannel?.readyState === 'open') {
			this.dataChannel.send(JSON.stringify({ type: 'accept-transfer' }));
		}
		this.signaling.send('accept-transfer', { accepted: true });
	}

	/**
	 * Receiver rejects the transfer.
	 */
	rejectTransfer() {
		if (this.role !== 'receiver') return;
		this.state = 'rejected';
		this.emit('state-change', this.state);

		if (this.dataChannel?.readyState === 'open') {
			this.dataChannel.send(JSON.stringify({ type: 'reject-transfer' }));
		}
		this.signaling.send('reject-transfer', { rejected: true });
	}

	/**
	 * Sender begins streaming file chunks.
	 */
	async startSending() {
		if (this.role !== 'sender' || !this.file) return;

		this.state = 'transferring';
		this.transferStartTime = Date.now();
		this.emit('state-change', this.state);

		if (this.dataChannel?.readyState === 'open') {
			this.dataChannel.send(JSON.stringify({ type: 'file-start', ...this.fileMeta }));
		}

		this.startTelemetry();
		await this.streamChunks(0);
	}

	/**
	 * Core chunk streaming loop with backpressure flow control.
	 * @param {number} startChunkIndex
	 */
	async streamChunks(startChunkIndex) {
		if (!this.file || !this.dataChannel) return;

		let chunkIndex = startChunkIndex;

		while (chunkIndex < this.totalChunks) {
			if (this.isPaused || this.state !== 'transferring' || this.isDestroyed) {
				return;
			}

			// Ensure DataChannel is open
			if (this.dataChannel.readyState !== 'open') {
				this.handleNetworkFluctuation('DataChannel not open during transmission');
				await this.waitForChannelOpen();
				if (this.state !== 'transferring') return;
			}

			// Flow control: backpressure
			if (this.dataChannel.bufferedAmount > BUFFERED_AMOUNT_HIGH_WATERMARK) {
				await this.waitForBufferDrain();
			}

			// Read file slice
			const startByte = chunkIndex * DATA_PER_CHUNK;
			const endByte = Math.min(startByte + DATA_PER_CHUNK, this.file.size);
			const slice = this.file.slice(startByte, endByte);
			const arrayBuffer = await slice.arrayBuffer();

			// Construct chunk with 8-byte header
			const packet = new Uint8Array(HEADER_SIZE + arrayBuffer.byteLength);
			const view = new DataView(packet.buffer);
			view.setUint32(0, chunkIndex);
			view.setUint32(4, this.totalChunks);
			packet.set(new Uint8Array(arrayBuffer), HEADER_SIZE);

			try {
				this.dataChannel.send(packet.buffer);
				this.bytesTransferred = endByte;
				this.recordSpeedSample(arrayBuffer.byteLength);
				this.emit('chunk-sent', { chunkIndex, totalChunks: this.totalChunks });
			} catch (err) {
				console.warn('[Engine] Error sending chunk, waiting and retrying:', err);
				await new Promise((r) => setTimeout(r, 200));
				continue;
			}

			chunkIndex++;

			// Brief micro-yield to keep UI thread fluid
			if (chunkIndex % 16 === 0) {
				await new Promise((r) => setTimeout(r, 0));
			}
		}

		// Finish transfer
		if (this.bytesTransferred >= this.totalBytes) {
			this.stopTelemetry();
			this.state = 'completed';

			if (this.dataChannel?.readyState === 'open') {
				this.dataChannel.send(JSON.stringify({ type: 'file-end' }));
			}

			const duration = (Date.now() - this.transferStartTime - this.totalPausedDuration) / 1000;
			const averageSpeed = this.totalBytes / Math.max(1, duration);

			this.emit('transfer-complete', {
				totalBytes: this.totalBytes,
				duration,
				averageSpeed,
				filename: this.fileMeta?.name
			});
			this.emit('state-change', this.state);
		}
	}

	async waitForBufferDrain() {
		if (!this.dataChannel) return;
		return new Promise((resolve) => {
			const check = () => {
				if (!this.dataChannel || this.dataChannel.bufferedAmount <= BUFFERED_AMOUNT_LOW_THRESHOLD) {
					resolve();
				} else {
					setTimeout(check, 10);
				}
			};
			check();
		});
	}

	async waitForChannelOpen() {
		if (!this.dataChannel) return;
		if (this.dataChannel.readyState === 'open') return;

		return new Promise((resolve) => {
			const onOpen = () => {
				this.dataChannel?.removeEventListener('open', onOpen);
				resolve();
			};
			this.dataChannel.addEventListener('open', onOpen);
			setTimeout(resolve, 5000);
		});
	}

	togglePause() {
		if (this.isPaused) {
			this.resume();
		} else {
			this.pause();
		}
	}

	pause() {
		if (this.state !== 'transferring') return;
		this.isPaused = true;
		this.state = 'paused';
		this.transferPauseTime = Date.now();
		this.emit('state-change', this.state);

		const msg = { type: 'pause' };
		if (this.dataChannel?.readyState === 'open') {
			this.dataChannel.send(JSON.stringify(msg));
		}
		this.signaling.send('pause-transfer', msg);
	}

	resume() {
		if (this.state !== 'paused') return;
		this.isPaused = false;
		this.state = 'transferring';
		if (this.transferPauseTime > 0) {
			this.totalPausedDuration += Date.now() - this.transferPauseTime;
			this.transferPauseTime = 0;
		}
		this.emit('state-change', this.state);

		const msg = { type: 'resume' };
		if (this.dataChannel?.readyState === 'open') {
			this.dataChannel.send(JSON.stringify(msg));
		}
		this.signaling.send('resume-transfer', msg);

		if (this.role === 'sender') {
			const currentChunk = Math.floor(this.bytesTransferred / DATA_PER_CHUNK);
			this.streamChunks(currentChunk);
		}
	}

	handleRemotePause() {
		if (this.state === 'transferring') {
			this.isPaused = true;
			this.state = 'paused';
			this.transferPauseTime = Date.now();
			this.emit('state-change', this.state);
		}
	}

	handleRemoteResume(fromChunk) {
		if (this.state === 'paused') {
			this.isPaused = false;
			this.state = 'transferring';
			if (this.transferPauseTime > 0) {
				this.totalPausedDuration += Date.now() - this.transferPauseTime;
				this.transferPauseTime = 0;
			}
			this.emit('state-change', this.state);

			if (this.role === 'sender') {
				const start = typeof fromChunk === 'number' ? fromChunk : Math.floor(this.bytesTransferred / DATA_PER_CHUNK);
				this.streamChunks(start);
			}
		}
	}

	/**
	 * Resume transmission from specific chunk after reconnection.
	 * @param {number} chunkIndex
	 */
	resumeSendingFrom(chunkIndex) {
		this.bytesTransferred = chunkIndex * DATA_PER_CHUNK;
		this.state = 'transferring';
		this.isPaused = false;
		this.emit('state-change', this.state);
		this.streamChunks(chunkIndex);
	}

	/**
	 * Handle transient network drops and fluctuations.
	 * @param {string} reason
	 */
	handleNetworkFluctuation(reason) {
		if (this.state === 'reconnecting' || this.isDestroyed) return;

		console.warn('[Engine] Network fluctuation:', reason);
		this.networkQuality = 'reconnecting';
		this.warningMessage = reason;
		this.emit('warning', this.warningMessage);

		if (this.state === 'transferring') {
			this.state = 'reconnecting';
			this.emit('state-change', this.state);
		}

		if (!this.iceDisconnectTimer) {
			this.iceDisconnectTimer = setTimeout(() => {
				console.warn('[Engine] Disconnect grace period expired, attempting ICE restart');
				this.handleIceFailure();
			}, ICE_DISCONNECT_GRACE_PERIOD_MS);
		}
	}

	/**
	 * Force ICE restart or re-negotiate connection when connection failed.
	 */
	async handleIceFailure() {
		if (this.isDestroyed) return;

		if (this.retryAttempts >= MAX_RETRY_ATTEMPTS) {
			this.setError('Connection failed after maximum retry attempts. Check firewall or network settings.');
			return;
		}

		this.retryAttempts++;
		this.networkQuality = 'reconnecting';
		this.warningMessage = `Attempting connection recovery (Attempt ${this.retryAttempts}/${MAX_RETRY_ATTEMPTS})...`;
		this.emit('warning', this.warningMessage);

		console.log(`[Engine] Initiating ICE restart recovery attempt ${this.retryAttempts}...`);

		// Re-initialize PeerConnection with ICE restart
		this.initPeerConnection();

		if (this.role === 'sender') {
			this.createAndSendOffer(true);
		} else {
			this.signaling.send('request-resume', {
				startFromChunk: this.chunksReceivedCount
			});
		}
	}

	forceRetry() {
		this.retryAttempts = 0;
		this.handleIceFailure();
	}

	/**
	 * Record chunk size for moving-average transfer speed.
	 * @param {number} bytes
	 */
	recordSpeedSample(bytes) {
		const now = Date.now();
		this.speedSamples.push({ time: now, bytes });

		// Keep samples within last 2.5 seconds
		const cutoff = now - 2500;
		this.speedSamples = this.speedSamples.filter((s) => s.time >= cutoff);

		if (this.speedSamples.length > 1) {
			const elapsedSec = (now - this.speedSamples[0].time) / 1000;
			const totalSampleBytes = this.speedSamples.reduce((sum, s) => sum + s.bytes, 0);
			if (elapsedSec > 0.1) {
				// Smooth current speed with exponential moving average
				const instantaneous = totalSampleBytes / elapsedSec;
				this.currentSpeed = this.currentSpeed === 0 ? instantaneous : this.currentSpeed * 0.7 + instantaneous * 0.3;
			}
		}
	}

	/**
	 * Start periodic stats telemetry emitting every 250ms.
	 */
	startTelemetry() {
		this.stopTelemetry();

		this.statsInterval = setInterval(() => {
			this.inspectRouteType();
			this.emitStats();
		}, 250);

		// Stall detection interval
		this.lastChunkTime = Date.now();
		this.stallCheckInterval = setInterval(() => {
			if (this.state === 'transferring' && !this.isPaused) {
				const timeSinceLast = Date.now() - this.lastChunkTime;
				if (timeSinceLast > STALL_TIMEOUT_MS) {
					this.networkQuality = 'stalled';
					this.warningMessage = 'Transfer stream stalled. Waiting for peer data buffer...';
					this.emit('warning', this.warningMessage);
				}
			}
		}, 3000);
	}

	stopTelemetry() {
		if (this.statsInterval) {
			clearInterval(this.statsInterval);
			this.statsInterval = null;
		}
		if (this.stallCheckInterval) {
			clearInterval(this.stallCheckInterval);
			this.stallCheckInterval = null;
		}
	}

	/**
	 * Emit current real-time transfer stats.
	 */
	emitStats() {
		const progress = this.totalBytes > 0 ? Math.min(100, (this.bytesTransferred / this.totalBytes) * 100) : 0;
		const remainingBytes = Math.max(0, this.totalBytes - this.bytesTransferred);
		const eta = this.currentSpeed > 0 ? remainingBytes / this.currentSpeed : 0;
		const elapsedTime = this.transferStartTime > 0 ? Math.max(0, (Date.now() - this.transferStartTime - this.totalPausedDuration) / 1000) : 0;

		const bufferPct =
			this.dataChannel && this.role === 'sender'
				? Math.min(100, (this.dataChannel.bufferedAmount / BUFFERED_AMOUNT_HIGH_WATERMARK) * 100)
				: 0;

		/** @type {TransferStats} */
		const stats = {
			bytesTransferred: this.bytesTransferred,
			totalBytes: this.totalBytes,
			progress,
			speed: this.currentSpeed,
			eta,
			elapsedTime,
			currentChunk: this.role === 'sender' ? Math.floor(this.bytesTransferred / DATA_PER_CHUNK) : this.chunksReceivedCount,
			totalChunks: this.totalChunks,
			bufferPercentage: bufferPct,
			connectionStatus: this.pc?.connectionState || 'disconnected',
			networkQuality: this.networkQuality,
			routeType: this.routeType,
			relayProtocol: this.relayProtocol
		};

		this.emit('stats', stats);
	}

	setError(msg) {
		this.state = 'error';
		this.errorMessage = msg;
		this.networkQuality = 'offline';
		this.stopTelemetry();
		this.emit('state-change', this.state);
		this.emit('error', msg);
	}

	/**
	 * Destroy engine and release all resources.
	 */
	destroy() {
		this.isDestroyed = true;
		this.stopTelemetry();

		if (this.iceDisconnectTimer) {
			clearTimeout(this.iceDisconnectTimer);
		}

		if (this.dataChannel) {
			try {
				this.dataChannel.close();
			} catch {
				// ignored
			}
			this.dataChannel = null;
		}

		if (this.pc) {
			try {
				this.pc.close();
			} catch {
				// ignored
			}
			this.pc = null;
		}

		this.listeners = {};
	}
}
