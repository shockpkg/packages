import fetch from 'node-fetch';

// The API this page loads download list from.
// https://airsdk.harman.com/download
const apiUrl = 'https://airsdk.harman.com/api/config-settings/download';

function addQueryParams(url, params) {
	return url + (url.includes('?') ? '&' : '?') +
		Object.entries(params)
			.map(a => a.map(encodeURIComponent).join('='))
			.join('&');
}

export async function list() {
	const response = await fetch(apiUrl);
	if (response.status !== 200) {
		throw new Error(`Unexpected status code: ${response.status}`);
	}
	const data = JSON.parse(await response.text());
	const cookies = [...response.headers]
		.map(a => (a[0] === 'set-cookie' ? a[1] : ''))
		.filter(c => c.startsWith('JSESSIONID='));

	const {latestVersion, id} = data;
	const {versionName: version, links} = latestVersion;
	if (!/^\d+\.\d+\.\d+\.\d+$/.test(version)) {
		throw new Error(`Version format: ${version}`);
	}

	const mappins = [
		[`air-sdk-${version}-windows`, 'SDK_FLEX_WIN'],
		[`air-sdk-${version}-windows-compiler`, 'SDK_AS_WIN'],
		[`air-sdk-${version}-mac`, 'SDK_FLEX_MAC'],
		[`air-sdk-${version}-mac-compiler`, 'SDK_AS_MAC'],
		[`air-sdk-${version}-linux`, 'SDK_FLEX_LIN'],
		[`air-sdk-${version}-linux-compiler`, 'SDK_AS_LIN']
	];

	const allLinks = new Set(Object.keys(links));
	allLinks.delete('RELEASE_NOTES');
	for (const [, prop] of mappins) {
		const link = links[prop];
		if (!link) {
			throw new Error(`Missing link: ${prop}`);
		}
		allLinks.delete(prop);
	}
	if (allLinks.size) {
		throw new Error(`Unknown links: ${[...allLinks].join(',')}`);
	}

	const downloads = [];
	for (const [name, prop] of mappins) {
		const link = links[prop];
		const source = addQueryParams((new URL(link, apiUrl)).href, {id});
		const file = decodeURI(
			source.split(/[?#]/)[0]
				.split('/')
				.pop()
		);
		downloads.push({
			name,
			file,
			source
		});
	}

	return {
		version,
		downloads,
		cookies
	};
}

export function cookies(list) {
	return list.map(c => c.split(';')[0]).join('; ');
}
