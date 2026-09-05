// Tactile Web Audio feedback
let audioCtx = null;
let soundEnabled = true;

if (typeof window !== 'undefined') {
	soundEnabled = localStorage.getItem('sound_enabled') !== 'false';
}

export function isSoundEnabled() {
	return soundEnabled;
}

export function toggleSound() {
	soundEnabled = !soundEnabled;
	if (typeof localStorage !== 'undefined') {
		localStorage.setItem('sound_enabled', String(soundEnabled));
	}
	return soundEnabled;
}

export function playChime(type = 'click') {
	if (!soundEnabled || typeof window === 'undefined') return;
	try {
		const AudioContext = window.AudioContext || window.webkitAudioContext;
		if (!AudioContext) return;
		if (!audioCtx) audioCtx = new AudioContext();
		if (audioCtx.state === 'suspended') audioCtx.resume();

		const now = audioCtx.currentTime;
		const osc = audioCtx.createOscillator();
		const gain = audioCtx.createGain();

		osc.connect(gain);
		gain.connect(audioCtx.destination);

		if (type === 'click') {
			osc.type = 'sine';
			osc.frequency.setValueAtTime(600, now);
			osc.frequency.exponentialRampToValueAtTime(300, now + 0.05);
			gain.gain.setValueAtTime(0.08, now);
			gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
			osc.start(now);
			osc.stop(now + 0.05);
		} else if (type === 'success') {
			osc.type = 'triangle';
			osc.frequency.setValueAtTime(523.25, now);
			osc.frequency.setValueAtTime(659.25, now + 0.08);
			gain.gain.setValueAtTime(0.12, now);
			gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
			osc.start(now);
			osc.stop(now + 0.35);
		} else if (type === 'notify') {
			osc.type = 'sine';
			osc.frequency.setValueAtTime(440, now);
			gain.gain.setValueAtTime(0.08, now);
			gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
			osc.start(now);
			osc.stop(now + 0.12);
		}
	} catch {
		// Silent catch for autoplay policies
	}
}
