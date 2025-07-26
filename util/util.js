export async function retry(f) {
	let r;
	try {
		r = await f();
	} catch {
		r = await f();
	}
	return r;
}

export function list(arrayLike) {
	const r = [];
	const {length} = arrayLike;
	for (let i = 0; i < length; i++) {
		r.push(arrayLike[i]);
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

export function yyyymmdd() {
	return new Date().toISOString().replace(/(-|T.*)/g, '');
}
