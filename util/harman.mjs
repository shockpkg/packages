import {retry} from './util.mjs';

// The API this page loads download list from.
// https://airsdk.harman.com/download
const apiUrl = 'https://airsdk.harman.com/api/config-settings/download';

// eslint-disable-next-line max-len
export const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:85.0) Gecko/20100101 Firefox/85.0';

function addQueryParams(url, params) {
	return url + (url.includes('?') ? '&' : '?') +
		Object.entries(params)
			.map(a => a.map(encodeURIComponent).join('='))
			.join('&');
}

export function cookies(list) {
	return list.map(c => c.split(';')[0]).join('; ');
}

export async function sdks() {
	const response = await retry(() => fetch(apiUrl, {
		headers: {
			'User-Agent': userAgent
		}
	}));
	if (response.status !== 200) {
		throw new Error(`Status code: ${response.status}: ${apiUrl}`);
	}
	const data = JSON.parse(await response.text());
	const cookies = [...response.headers]
		.map(a => (a[0] === 'set-cookie' ? a[1] : ''))
		.filter(c => c.startsWith('JSESSIONID='));

	const {latestVersion, id} = data;
	const {links} = latestVersion;

	const mappins = [
		['air-sdk-%version%-windows', 'SDK_FLEX_WIN'],
		['air-sdk-%version%-windows-compiler', 'SDK_AS_WIN'],
		['air-sdk-%version%-mac', 'SDK_FLEX_MAC'],
		['air-sdk-%version%-mac-compiler', 'SDK_AS_MAC'],
		['air-sdk-%version%-linux', 'SDK_FLEX_LIN'],
		['air-sdk-%version%-linux-compiler', 'SDK_AS_LIN']
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
	for (const [format, prop] of mappins) {
		const link = links[prop];
		const m = link.match(/\/(\d+\.\d+\.\d+\.\d+)\//);
		if (!m) {
			throw new Error(`Unknown version: ${link}`);
		}
		const [, version] = m;
		const name = format.replace('%version%', version);
		const source = addQueryParams((new URL(link, apiUrl)).href, {id});
		const file = decodeURI(
			source.split(/[?#]/)[0]
				.split('/')
				.pop()
		);
		downloads.push({
			name,
			version,
			file,
			source
		});
	}

	return {
		downloads,
		cookies
	};
}
