export function packageUrl(sha256, file) {
	return [
		`https://archive.org/download/shockpkg_packages_${sha256[0]}`,
		sha256.substr(0, 2),
		sha256.substr(2, 2),
		sha256.substr(4),
		encodeURIComponent(file)
	].join('/');
}
