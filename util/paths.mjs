export function isSystem(path) {
	const parts = path.split('/');
	for (const part of parts) {
		if (part.startsWith('.')) {
			return true;
		}
		if (part === '__MACOSX') {
			return true;
		}
		if (path === 'ehthumbs.db') {
			return true;
		}
		if (path === 'Thumbs.db') {
			return true;
		}
	}
	return false;
}

export function isMetadata(path) {
	if (/\.txt$/i.test(path)) {
		return true;
	}
	if (/\.md$/i.test(path)) {
		return true;
	}
	return false;
}
