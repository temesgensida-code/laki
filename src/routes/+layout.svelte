<script>
	import favicon from '$lib/assets/favicon.png';
	import '../app.css';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" type="image/png" href={favicon} />
	<title>LakiDrop • WebRTC Peer-to-Peer File Transfer</title>
</svelte:head>

{@render children()}
