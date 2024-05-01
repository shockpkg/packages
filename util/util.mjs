export async function retry(f) {
	let r;
	try {
		r = await f();
	} catch (_) {
		r = await f();
	}
	return r;
}

export function* walk(list, children) {
	for (const q = list.map(o => [o, []]); q.length; ) {
		const [o, p] = q.shift();
		yield [o, p];
		const cl = children(o);
		if (cl) {
			q.unshift(...cl.map(c => [c, [o, ...p]]));
		}
	}
}
