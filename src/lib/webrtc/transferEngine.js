import {
	RTC_CONFIG,
	CHUNK_SIZE,
	HEADER_SIZE,
	DATA_PER_CHUNK,
	BUFFERED_AMOUNT_LOW_THRESHOLD,
	BUFFERED_AMOUNT_HIGH_WATERMARK,
	ICE_DISCONNECT_GRACE_PERIOD_MS,
	MAX_RETRY_ATTEMPTS,
	STALL_TIMEOUT_MS,
	P2P_CONNECTION_TIMEOUT_MS
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
 * @property {'direct' | 'relay' | 'tunnel'} [routeType]
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
		this.sessionId = signaling?.sessionId || '';
		this.customIceServers = customIceServers;

		// Dual-Transport: 'webrtc' (direct P2P first) -> 'tunnel' (fail-safe HTTP chunk stream)
		this.transportMode = 'webrtc'; // 'webrtc' | 'tunnel'
		this.tunnelReader = null;
		this.isTunnelStreaming = false;

		// Categorize ICE servers: STUN only for initial P2P attempt
		this.allIceServers = customIceServers && customIceServers.length > 0
			? customIceServers
			: RTC_CONFIG.iceServers;

		this.stunIceServers = this.allIceServers.filter((srv) => {
			const urls = Array.isArray(srv.urls) ? srv.urls : [srv.urls];
			return urls.some((u) => u && typeof u === 'string' && u.startsWith('stun:'));
		});
		if (this.stunIceServers.length === 0) {
			this.stunIceServers = RTC_CONFIG.iceServers;
		}

		this.relayIceServers = this.allIceServers.filter((srv) => {
			const urls = Array.isArray(srv.urls) ? srv.urls : [srv.urls];
			return urls.some((u) => u && typeof u === 'string' && (u.startsWith('turn:') || u.startsWith('turns:')));
		});

		this.hasRelayServers = this.relayIceServers.length > 0;
		this.useRelay = false;
		this.p2pFallbackTimer = null;
		this.lastIceFailureTime = 0;
		this.pendingRemoteCandidates = [];

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

		// Route detection (Direct P2P vs Fail-Safe Server Tunnel vs TURN)
		this.routeType = 'direct'; // 'direct' | 'relay' | 'tunnel'
		this.relayProtocol = 'https';
		this.isRelayAvailable = true;

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

				if (this.role === 'sender') {
					if (this.fileMeta) {
						this.signaling.send('file-meta', this.fileMeta);
					}
					if (this.transportMode === 'webrtc' && (!this.pc || this.pc.connectionState === 'new')) {
						this.initPeerConnection();
						this.createAndSendOffer();
					}
				}
			} else if (info.status === 'disconnected') {
				if (this.state === 'transferring' && this.transportMode === 'webrtc') {
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

		this.signaling.on('fallback-to-tunnel', () => {
			if (this.transportMode !== 'tunnel') {
				console.log('[Engine] Remote peer requested Fail-Safe Server Tunnel fallback');
				this.triggerTunnelFallback(false);
			}
		});

		this.signaling.on('fallback-to-relay', () => {
			if (this.transportMode !== 'tunnel') {
				this.triggerTunnelFallback(false);
			}
		});

		this.signaling.on('request-ice-restart', () => {
			if (this.role === 'sender' && this.transportMode === 'webrtc') {
				this.handleIceFailure();
			}
		});

		let offerQueue = Promise.resolve();

		this.signaling.on('offer', (offer) => {
			if (this.role !== 'receiver' || !offer || this.transportMode === 'tunnel') return;
			offerQueue = offerQueue.then(async () => {
				try {
					if (!this.pc || this.pc.signalingState === 'closed') {
						this.initPeerConnection(this.useRelay);
					}
					if (this.pc.signalingState !== 'stable') {
						console.warn('[Engine] Offer received while signalingState is ' + this.pc.signalingState + ' - resetting PC');
						this.initPeerConnection(this.useRelay);
					}
					await this.pc.setRemoteDescription(new RTCSessionDescription(offer));
					await this.flushPendingCandidates();
					await this.pc.setLocalDescription();
					if (this.pc.localDescription) {
						const desc = { type: this.pc.localDescription.type, sdp: this.pc.localDescription.sdp };
						this.signaling.send('answer', desc);
					}
				} catch (err) {
					console.error('[Engine] Failed handling offer:', err);
				}
			});
		});

		this.signaling.on('answer', async (answer) => {
			if (this.role !== 'sender' || !this.pc || this.transportMode === 'tunnel') return;
			try {
				if (this.pc.signalingState === 'have-local-offer') {
					await this.pc.setRemoteDescription(new RTCSessionDescription(answer));
					await this.flushPendingCandidates();
				}
			} catch (err) {
				console.error('[Engine] Failed handling answer:', err);
			}
		});

		this.signaling.on('candidate', async (candidate) => {
			if (!this.pc || !candidate || this.transportMode === 'tunnel') return;
			if (!this.pc.remoteDescription) {
				this.pendingRemoteCandidates.push(candidate);
				return;
			}
			try {
				await this.pc.addIceCandidate(new RTCIceCandidate(candidate));
			} catch (err) {
				if (!err?.message?.includes('ufrag')) {
					console.warn('[Engine] Error adding ICE candidate:', err?.message || err);
				}
			}
		});

		this.signaling.on('accept-transfer', () => {
			if (this.role === 'sender') {
				if (this.transportMode === 'tunnel') {
					this.startTunnelStreaming(0);
				} else {
					this.startSending();
				}
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

		this.signaling.on('file-end', () => {
			if (this.role === 'receiver') {
				this.finalizeReceivedFile();
			}
		});

		this.signaling.on('ack', (msg) => {
			if (this.role === 'sender') {
				this.emit('ack-received', msg);
			}
		});
	}

	async flushPendingCandidates() {
		while (this.pendingRemoteCandidates.length > 0) {
			const candidate = this.pendingRemoteCandidates.shift();
			try {
				await this.pc?.addIceCandidate(new RTCIceCandidate(candidate));
			} catch (err) {
				if (!err?.message?.includes('ufrag')) {
					console.warn('[Engine] Error applying queued ICE candidate:', err?.message || err);
				}
			}
		}
	}

	/**
	 * Initialize RTCPeerConnection for Direct P2P.
	 */
	initPeerConnection(forceRelay = false) {
		if (this.transportMode === 'tunnel') return;

		if (forceRelay) {
			this.useRelay = true;
		}

		if (this.pc) {
			try {
				this.pc.close();
			} catch {
				// ignored
			}
		}
		this.pendingRemoteCandidates = [];

		if (this.p2pFallbackTimer) {
			clearTimeout(this.p2pFallbackTimer);
			this.p2pFallbackTimer = null;
		}
		if (this.iceDisconnectTimer) {
			clearTimeout(this.iceDisconnectTimer);
			this.iceDisconnectTimer = null;
		}

		const rawIceServers = this.stunIceServers;
		const activeIceServers = rawIceServers.map((srv) => {
			const urls = (Array.isArray(srv.urls) ? srv.urls : [srv.urls]).map((u) => {
				if (typeof u === 'string' && u.startsWith('stun:') && u.includes('?')) {
					return u.split('?')[0];
				}
				return u;
			});
			return { ...srv, urls: urls.length === 1 ? urls[0] : urls };
		});

		const rtcOptions = {
			iceServers: activeIceServers
		};

		console.log('[Engine] Initializing WebRTC in Direct P2P First mode');

		this.pc = new RTCPeerConnection(rtcOptions);

		this.pc.onicecandidate = (event) => {
			if (event.candidate) {
				const cand = event.candidate.toJSON
					? event.candidate.toJSON()
					: {
							candidate: event.candidate.candidate,
							sdpMid: event.candidate.sdpMid,
							sdpMLineIndex: event.candidate.sdpMLineIndex
					  };
				this.signaling.send('candidate', cand);
			}
		};

		this.pc.onicecandidateerror = (event) => {
			console.warn('[Engine] ICE candidate error:', event.url, event.errorCode, event.errorText);
		};

		// Direct P2P Timeout: if direct P2P does not establish within P2P_CONNECTION_TIMEOUT_MS, fall back to Server Stream Tunnel
		if (this.transportMode === 'webrtc') {
			this.p2pFallbackTimer = setTimeout(() => {
				// CRITICAL GUARD: Never abort if transfer is actively underway or DataChannel is open!
				if (
					this.state === 'transferring' ||
					this.state === 'completed' ||
					this.bytesTransferred > 0 ||
					this.chunksReceivedCount > 0 ||
					this.dataChannel?.readyState === 'open'
				) {
					console.log('[Engine] Direct P2P active - cancelling fallback timer.');
					if (this.p2pFallbackTimer) {
						clearTimeout(this.p2pFallbackTimer);
						this.p2pFallbackTimer = null;
					}
					return;
				}

				const state = this.pc?.iceConnectionState;
				if (state !== 'connected' && state !== 'completed' && !this.isDestroyed) {
					console.warn('[Engine] Direct P2P connection timeout. Falling back to Fail-Safe Server Tunnel...');
					this.triggerTunnelFallback(true);
				}
			}, P2P_CONNECTION_TIMEOUT_MS);
		}

		this.pc.oniceconnectionstatechange = () => {
			const state = this.pc?.iceConnectionState;
			this.emit('ice-state-change', state);

			if (state === 'connected' || state === 'completed') {
				if (this.p2pFallbackTimer) {
					clearTimeout(this.p2pFallbackTimer);
					this.p2pFallbackTimer = null;
				}
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
				console.warn('[Engine] Direct P2P ICE failed. Falling back to Fail-Safe Server Tunnel...');
				this.triggerTunnelFallback(true);
			}
		};

		this.pc.onconnectionstatechange = () => {
			const state = this.pc?.connectionState;
			this.emit('connection-state-change', state);

			if (state === 'connected') {
				if (this.p2pFallbackTimer) {
					clearTimeout(this.p2pFallbackTimer);
					this.p2pFallbackTimer = null;
				}
				this.inspectRouteType();
			} else if (state === 'failed') {
				console.warn('[Engine] RTCPeerConnection state is failed. Falling back to Server Tunnel...');
				this.triggerTunnelFallback(true);
			}
		};

		// Sender creates the DataChannel
		if (this.role === 'sender') {
			this.setupSenderDataChannel();
		} else {
			// Receiver listens for incoming DataChannel
			this.pc.ondatachannel = (event) => {
				this.setupReceiverDataChannel(event.channel);
			};
		}
	}

	/**
	 * Fallback immediately to the high-throughput Fail-Safe Server Stream Tunnel.
	 * Bypasses all WebRTC NAT, firewall, and browser restrictions with 100% reliability.
	 * @param {boolean} [notifyPeer=true]
	 */
	triggerTunnelFallback(notifyPeer = true) {
		if (this.isDestroyed || this.transportMode === 'tunnel') return;

		// Refuse fallback if WebRTC DataChannel is actively transferring
		if (this.dataChannel?.readyState === 'open' && this.state === 'transferring' && this.bytesTransferred > 0) {
			console.log('[Engine] Refusing fallback: WebRTC DataChannel is actively transferring.');
			return;
		}

		console.warn('[Engine] Activating Fail-Safe Server Stream Tunnel fallback...');
		this.transportMode = 'tunnel';
		this.routeType = 'tunnel';
		this.relayProtocol = 'https';
		this.networkQuality = 'optimal';
		this.warningMessage = '';
		this.emit('route-type-change', 'tunnel');

		if (this.p2pFallbackTimer) {
			clearTimeout(this.p2pFallbackTimer);
			this.p2pFallbackTimer = null;
		}
		if (this.iceDisconnectTimer) {
			clearTimeout(this.iceDisconnectTimer);
			this.iceDisconnectTimer = null;
		}

		if (this.pc) {
			try {
				this.pc.close();
			} catch {
				// ignored
			}
			this.pc = null;
		}
		if (this.dataChannel) {
			try {
				this.dataChannel.close();
			} catch {
				// ignored
			}
			this.dataChannel = null;
		}

		if (notifyPeer) {
			this.signaling.send('fallback-to-tunnel', { timestamp: Date.now() });
		}

		if (this.role === 'receiver') {
			this.connectTunnelStream();
		} else if (this.role === 'sender') {
			if (this.fileMeta) {
				this.signaling.send('file-meta', this.fileMeta);
			}
			if (this.state === 'transferring' || this.state === 'waiting-peer' || this.state === 'ready-to-accept') {
				this.startTunnelStreaming(this.chunksReceivedCount || 0);
			}
		}
	}

	/**
	 * Legacy alias: redirects to Fail-Safe Server Tunnel.
	 */
	triggerRelayFallback(notifyPeer = true) {
		this.triggerTunnelFallback(notifyPeer);
	}

	/**
	 * Receiver connects to the Server Stream Tunnel via HTTP ReadableStream.
	 */
	async connectTunnelStream() {
		if (this.isDestroyed || this.tunnelReader) return;

		try {
			console.log('[Engine] Receiver connecting to Fail-Safe Server Stream Tunnel...');
			const res = await fetch(`/api/tunnel/${encodeURIComponent(this.sessionId)}?role=receiver`);
			if (!res.ok || !res.body) {
				throw new Error(`Tunnel HTTP ${res.status}`);
			}

			this.routeType = 'tunnel';
			this.networkQuality = 'optimal';
			this.emit('route-type-change', 'tunnel');

			const reader = res.body.getReader();
			this.tunnelReader = reader;

			let buffer = new Uint8Array(0);

			while (!this.isDestroyed) {
				const { value, done } = await reader.read();
				if (done) break;
				if (!value) continue;

				// Append newly received bytes to buffer
				const combined = new Uint8Array(buffer.byteLength + value.byteLength);
				combined.set(buffer, 0);
				combined.set(value, buffer.byteLength);
				buffer = combined;

				// Parse framed chunks: [4 bytes packetLength][packetLength bytes payload]
				while (buffer.byteLength >= 4) {
					const packetLength = new DataView(buffer.buffer, buffer.byteOffset, 4).getUint32(0);
					if (buffer.byteLength < 4 + packetLength) {
						break; // Wait for complete packet
					}

					const chunkBuffer = buffer.slice(4, 4 + packetLength);
					buffer = buffer.slice(4 + packetLength);

					this.handleIncomingChunk(chunkBuffer.buffer);
				}
			}
		} catch (err) {
			if (!this.isDestroyed && this.state !== 'completed') {
				console.warn('[Engine] Tunnel stream connection closed or error:', err);
			}
		}
	}

	/**
	 * Sender streams chunks over Server Stream Tunnel via HTTP POST.
	 * @param {number} startChunkIndex
	 */
	async startTunnelStreaming(startChunkIndex) {
		if (!this.file || this.isDestroyed || this.isTunnelStreaming) return;

		this.isTunnelStreaming = true;
		this.transportMode = 'tunnel';
		this.routeType = 'tunnel';
		this.state = 'transferring';
		this.transferStartTime = Date.now();
		this.networkQuality = 'optimal';
		this.warningMessage = '';
		this.emit('state-change', this.state);
		this.emit('route-type-change', 'tunnel');
		this.startTelemetry();

		this.signaling.send('file-start', this.fileMeta);

		let chunkIndex = startChunkIndex;

		while (chunkIndex < this.totalChunks) {
			if (this.isPaused || this.state !== 'transferring' || this.isDestroyed) {
				this.isTunnelStreaming = false;
				return;
			}

			const startByte = chunkIndex * DATA_PER_CHUNK;
			const endByte = Math.min(startByte + DATA_PER_CHUNK, this.file.size);
			const slice = this.file.slice(startByte, endByte);
			const arrayBuffer = await slice.arrayBuffer();

			// 8-byte chunk header: chunkIndex (uint32) + totalChunks (uint32)
			const chunkPayload = new Uint8Array(HEADER_SIZE + arrayBuffer.byteLength);
			const view = new DataView(chunkPayload.buffer);
			view.setUint32(0, chunkIndex);
			view.setUint32(4, this.totalChunks);
			chunkPayload.set(new Uint8Array(arrayBuffer), HEADER_SIZE);

			// Framed packet: [4 bytes length prefix][chunkPayload]
			const framed = new Uint8Array(4 + chunkPayload.byteLength);
			new DataView(framed.buffer).setUint32(0, chunkPayload.byteLength);
			framed.set(chunkPayload, 4);

			try {
				const res = await fetch(`/api/tunnel/${encodeURIComponent(this.sessionId)}`, {
					method: 'POST',
					headers: { 'Content-Type': 'application/octet-stream' },
					body: framed.buffer
				});

				if (!res.ok) {
					throw new Error(`HTTP ${res.status}`);
				}

				const resData = await res.json().catch(() => ({}));
				if (resData.delivered === false) {
					await new Promise((r) => setTimeout(r, 40));
				}

				this.bytesTransferred = endByte;
				this.recordSpeedSample(arrayBuffer.byteLength);
				this.emit('chunk-sent', { chunkIndex, totalChunks: this.totalChunks });
			} catch (err) {
				console.warn('[Engine] Error posting tunnel chunk, retrying in 200ms:', err);
				await new Promise((r) => setTimeout(r, 200));
				continue;
			}

			chunkIndex++;

			// Micro-yield to keep UI thread fluid
			if (chunkIndex % 8 === 0) {
				await new Promise((r) => setTimeout(r, 0));
			}
		}

		if (this.bytesTransferred >= this.totalBytes) {
			this.stopTelemetry();
			this.state = 'completed';
			this.signaling.send('file-end', { success: true });

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
		this.isTunnelStreaming = false;
	}

	/**
	 * Inspect RTCStats to verify if route is direct P2P or TURN relay.
	 */
	async inspectRouteType() {
		if (this.transportMode === 'tunnel') {
			this.routeType = 'tunnel';
			return;
		}
		if (!this.pc) return;

		try {
			const stats = await this.pc.getStats();
			let isRelayed = false;
			let protocol = 'udp';

			for (const report of stats.values()) {
				if (report.type === 'candidate-pair' && report.state === 'succeeded') {
					const local = stats.get(report.localCandidateId);
					const remote = stats.get(report.remoteCandidateId);

					if (local?.candidateType === 'relay' || remote?.candidateType === 'relay') {
						isRelayed = true;
						protocol = local?.protocol || remote?.protocol || (this.useRelay ? 'tls' : 'udp');
					}
					break;
				}
			}

			this.routeType = isRelayed ? 'relay' : 'direct';
			this.relayProtocol = protocol;
			this.emit('route-type-change', this.routeType);
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
			if (this.p2pFallbackTimer) {
				clearTimeout(this.p2pFallbackTimer);
				this.p2pFallbackTimer = null;
			}
			this.emit('datachannel-open');
			this.inspectRouteType();
			if ((this.state === 'transferring' || this.state === 'reconnecting') && this.file) {
				this.state = 'transferring';
				this.emit('state-change', this.state);
				this.dataChannel.send(JSON.stringify({ type: 'file-start', ...this.fileMeta }));
				this.streamChunks(this.chunksReceivedCount || 0);
			}
		};

		this.dataChannel.onclose = () => {
			this.emit('datachannel-close');
		};

		this.dataChannel.onerror = (err) => {
			console.error('[Engine] Sender DataChannel error:', err);
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
			if (this.p2pFallbackTimer) {
				clearTimeout(this.p2pFallbackTimer);
				this.p2pFallbackTimer = null;
			}
			this.emit('datachannel-open');
			this.inspectRouteType();
		};

		this.dataChannel.onclose = () => {
			this.emit('datachannel-close');
		};

		this.dataChannel.onerror = (err) => {
			console.error('[Engine] Receiver DataChannel error:', err);
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
	 * Handle incoming binary chunk on receiver (via WebRTC or Server Tunnel).
	 * @param {ArrayBuffer} buffer
	 */
	handleIncomingChunk(buffer) {
		if (buffer.byteLength < HEADER_SIZE) return;
		if (this.p2pFallbackTimer) {
			clearTimeout(this.p2pFallbackTimer);
			this.p2pFallbackTimer = null;
		}

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
				} else {
					this.signaling.send('ack', {
						chunkIndex,
						bytesReceived: this.bytesTransferred
					});
				}
			}

			this.emit('chunk-received', {
				chunkIndex,
				totalChunks: this.totalChunks,
				bytesTransferred: this.bytesTransferred
			});

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
		if (!this.pc || this.transportMode === 'tunnel') return;
		try {
			const options = isIceRestart ? { iceRestart: true } : undefined;
			const offer = await this.pc.createOffer(options);
			await this.pc.setLocalDescription(offer);
			this.signaling.send('offer', offer);
		} catch (err) {
			console.error('[Engine] Failed to create offer:', err);
			this.triggerTunnelFallback(true);
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

		this.signaling.send('file-meta', this.fileMeta);

		if (this.transportMode === 'webrtc') {
			this.initPeerConnection();
			this.createAndSendOffer();
		}
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

		if (this.transportMode === 'tunnel') {
			this.connectTunnelStream();
		}

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
		if (this.p2pFallbackTimer) {
			clearTimeout(this.p2pFallbackTimer);
			this.p2pFallbackTimer = null;
		}

		if (this.transportMode === 'tunnel') {
			this.startTunnelStreaming(0);
			return;
		}

		this.state = 'transferring';
		this.transferStartTime = Date.now();
		this.emit('state-change', this.state);

		if (this.dataChannel?.readyState !== 'open') {
			await this.waitForChannelOpen();
		}

		if (this.dataChannel?.readyState === 'open') {
			this.dataChannel.send(JSON.stringify({ type: 'file-start', ...this.fileMeta }));
		}

		this.startTelemetry();
		this.streamChunks(0);
	}

	/**
	 * Core WebRTC chunk streaming loop with backpressure flow control.
	 * @param {number} startChunkIndex
	 */
	async streamChunks(startChunkIndex) {
		if (!this.file || !this.dataChannel) return;
		if (this.p2pFallbackTimer) {
			clearTimeout(this.p2pFallbackTimer);
			this.p2pFallbackTimer = null;
		}

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
			this.signaling.send('file-end', { success: true });

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
			if (this.transportMode === 'tunnel') {
				this.startTunnelStreaming(currentChunk);
			} else {
				this.streamChunks(currentChunk);
			}
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
				const chunkToResume = typeof fromChunk === 'number' ? fromChunk : Math.floor(this.bytesTransferred / DATA_PER_CHUNK);
				if (this.transportMode === 'tunnel') {
					this.startTunnelStreaming(chunkToResume);
				} else {
					this.streamChunks(chunkToResume);
				}
			}
		}
	}

	resumeSendingFrom(chunkIndex) {
		if (this.role !== 'sender') return;
		this.isPaused = false;
		this.state = 'transferring';
		if (this.transportMode === 'tunnel') {
			this.startTunnelStreaming(chunkIndex);
		} else {
			this.streamChunks(chunkIndex);
		}
	}

	/**
	 * Handle transient network drops and fluctuations.
	 * @param {string} reason
	 */
	handleNetworkFluctuation(reason) {
		if (this.state === 'reconnecting' || this.isDestroyed || this.transportMode === 'tunnel') return;

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
				console.warn('[Engine] Disconnect grace period expired, falling back to Server Tunnel');
				this.triggerTunnelFallback(true);
			}, ICE_DISCONNECT_GRACE_PERIOD_MS);
		}
	}

	/**
	 * WebRTC failure recovery: immediately falls back to Server Stream Tunnel.
	 */
	async handleIceFailure() {
		if (this.isDestroyed || this.transportMode === 'tunnel') return;
		console.warn('[Engine] WebRTC ICE failed. Switching to Fail-Safe Server Tunnel...');
		this.triggerTunnelFallback(true);
	}

	forceRetry() {
		this.triggerTunnelFallback(true);
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

		this.lastChunkTime = Date.now();
		this.stallCheckInterval = setInterval(() => {
			if (this.state === 'transferring' && !this.isPaused) {
				const timeSinceLast = Date.now() - this.lastChunkTime;
				if (timeSinceLast > STALL_TIMEOUT_MS) {
					this.networkQuality = 'stalled';
					this.warningMessage = 'Transfer stream stalled. Waiting for peer buffer...';
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
			connectionStatus: this.transportMode === 'tunnel' ? 'connected' : (this.pc?.connectionState || 'disconnected'),
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

		if (this.p2pFallbackTimer) {
			clearTimeout(this.p2pFallbackTimer);
			this.p2pFallbackTimer = null;
		}

		if (this.iceDisconnectTimer) {
			clearTimeout(this.iceDisconnectTimer);
			this.iceDisconnectTimer = null;
		}

		if (this.tunnelReader) {
			try {
				this.tunnelReader.cancel();
			} catch {
				// ignored
			}
			this.tunnelReader = null;
		}

		if (this.sessionId) {
			fetch(`/api/tunnel/${encodeURIComponent(this.sessionId)}`, { method: 'DELETE' }).catch(() => {});
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
