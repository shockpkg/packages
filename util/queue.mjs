export async function queue(list, each, threads = 1) {
	const q = [...list];
	await Promise.all(
		new Array(threads).fill(0).map(async () => {
			while (q.length) {
				// eslint-disable-next-line no-await-in-loop
				await each(q.shift());
			}
		})
	);
}
