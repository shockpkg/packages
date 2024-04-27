/**
 * Retry once on error.
 *
 * @param f The function to try.
 * @returns The result.
 */
// eslint-disable-next-line require-await
export async function retry(f) {
	// eslint-disable-next-line require-await
	return f().catch(async () => f());
}

export function * walk(list, children) {
	for (const q = list.map(o => [o, []]); q.length;) {
		const [o, p] = q.shift();
		yield [o, p];
		const cl = children(o);
		if (cl) {
			q.unshift(...cl.map(c => [c, [o, ...p]]));
		}
	}
}
