function parseDigits(s) {
	return /^[\d.]+$/.test(s) ? s.split('.').map(s => +s || 0) : null;
}

export function primitive(a, b) {
	if (a === null && b !== null) {
		return -1;
	}
	if (b === null && a !== null) {
		return 1;
	}
	if (a < b) {
		return -1;
	}
	if (a > b) {
		return 1;
	}
	return 0;
}

export function human(a, b) {
	const aV = parseDigits(a);
	const bV = parseDigits(b);
	if (aV && bV) {
		const l = Math.max(a.length, b.length);
		for (let i = 0; i < l; i++) {
			const cmp = primitive(aV[i] || 0, bV[i] || 0);
			if (cmp) {
				return cmp;
			}
		}
	}
	return primitive(a, b);
}

export function humanTokens(a, b) {
	const l = Math.max(a.length, b.length);
	for (let i = 0; i < l; i++) {
		const cmp = human(a[i], b[i]);
		if (cmp) {
			return cmp;
		}
	}
	return 0;
}
