<script>
	import { Radio, ShieldCheck, Zap } from '@lucide/svelte';

	let { status = 'Ready' } = $props();
</script>

<header class="w-full border-b border-zinc-800/80 bg-[#090b10]/90 backdrop-blur-md sticky top-0 z-40">
	<div class="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
		<!-- Brand Logo -->
		<div class="flex items-center gap-3">
			<div class="relative flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-cyan-400 shadow-md shadow-indigo-500/20 text-white font-bold text-lg">
				<Zap class="w-5 h-5 fill-white text-white" />
				<span class="absolute -top-1 -right-1 flex h-2.5 w-2.5">
					<span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
					<span class="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
				</span>
			</div>
			<div>
				<div class="flex items-center gap-2">
					<span class="font-bold text-base sm:text-lg tracking-tight text-white">Laki<span class="text-indigo-400">Drop</span></span>
					<span class="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">WebRTC P2P</span>
				</div>
				<p class="text-xs text-zinc-400 hidden sm:block">Zero-server encrypted file transfer</p>
			</div>
		</div>

		<!-- Status & Badges -->
		<div class="flex items-center gap-3">
			<div class="flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-900/80 border border-zinc-800 text-xs font-mono text-zinc-300">
				<Radio class="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
				<span class="hidden md:inline text-zinc-400">P2P Network:</span>
				<span class="text-emerald-400 font-medium">Direct STUN Active</span>
			</div>

			<div class="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-indigo-950/40 border border-indigo-800/40 text-xs text-indigo-300">
				<ShieldCheck class="w-3.5 h-3.5 text-indigo-400" />
				<span>E2E Direct</span>
			</div>
		</div>
	</div>
</header>
