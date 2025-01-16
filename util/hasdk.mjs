import {retry} from './util.mjs';

const dcUrl = 'https://airsdk.harman.com/download';
const dcApi = 'https://airsdk.harman.com/api/config-settings/download';

const dvUrl = 'https://airsdk.harman.com/download/%version%';
const dvApi = 'https://airsdk.harman.com/api/versions/%version%';

const rnUrl = 'https://airsdk.harman.com/release_notes';
const rnApi = 'https://airsdk.harman.com/api/versions/release-notes';

const mappings = [
	['air-sdk-%version%-windows', 'SDK_FLEX_WIN'],
	['air-sdk-%version%-windows-compiler', 'SDK_AS_WIN'],
	['air-sdk-%version%-mac', 'SDK_FLEX_MAC'],
	['air-sdk-%version%-mac-compiler', 'SDK_AS_MAC'],
	['air-sdk-%version%-linux', 'SDK_FLEX_LIN'],
	['air-sdk-%version%-linux-compiler', 'SDK_AS_LIN']
];

export async function list(userAgent) {
	const response = await retry(() =>
		fetch(rnApi, {
			headers: {
				...userAgent.headers,
				Referer: rnUrl
			}
		})
	);
	if (response.status !== 200) {
		throw new Error(`Status code: ${response.status}: ${rnApi}`);
	}

	const data = JSON.parse(await response.text());
	const r = [];
	for (const {links} of data) {
		if (!links) {
			continue;
		}
		for (const [format, prop] of mappings) {
			const link = links[prop];
			if (!link) {
				continue;
			}
			const m = link.match(/\/((?:\d+\.){3}\d+)\//);
			if (!m) {
				throw new Error(`Unknown version: ${link}`);
			}
			const [, version] = m;
			const name = format.replaceAll('%version%', version);
			const url = new URL(link, rnUrl);
			const source = url.href;
			const file = decodeURIComponent(url.pathname.split('/').pop());
			r.push({
				name,
				version,
				file,
				source,
				group: ['air-sdk', version]
			});
		}
	}
	return r;
}

export async function sdks(userAgent, version = '') {
	const versioned = version && version !== 'latest' && version !== 'current';
	const referer = versioned ? dvUrl.replaceAll('%version%', version) : dcUrl;
	const response = await retry(() =>
		fetch(dcApi, {
			headers: {
				...userAgent.headers,
				Referer: referer
			}
		})
	);
	if (response.status !== 200) {
		throw new Error(`Status code: ${response.status}: ${dcApi}`);
	}

	const data = JSON.parse(await response.text());
	const cookie = [...response.headers]
		.map(a => (a[0] === 'set-cookie' ? a[1] : ''))
		.filter(c => c.startsWith('JSESSIONID='))
		.map(c => c.split(';')[0])
		.join('; ');

	const {id} = data;
	let links;

	if (versioned) {
		const response = await retry(() =>
			fetch(dvApi.replaceAll('%version%', version), {
				headers: {
					...userAgent.headers,
					Referer: referer
				}
			})
		);
		if (response.status !== 200) {
			throw new Error(`Status code: ${response.status}: ${dcApi}`);
		}

		const data = JSON.parse(await response.text());
		links = data.links;
	} else {
		links = data.latestVersion.links;
	}

	const allLinks = new Set(Object.keys(links));
	allLinks.delete('RELEASE_NOTES');
	for (const [, prop] of mappings) {
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
	for (const [format, prop] of mappings) {
		const link = links[prop];
		const m = link.match(/\/((?:\d+\.){3}\d+)\//);
		if (!m) {
			throw new Error(`Unknown version: ${link}`);
		}
		const [, version] = m;
		const name = format.replaceAll('%version%', version);
		const url = new URL(link, referer);
		const source = url.href;
		const file = decodeURIComponent(url.pathname.split('/').pop());
		url.searchParams.set('id', id);
		downloads.push({
			name,
			version,
			file,
			source,
			url: url.href,
			headers: {
				...userAgent.headers,
				Referer: referer,
				Cookie: cookie
			},
			mimetype: 'application/octet-stream',
			group: ['air-sdk', version]
		});
	}

	return downloads;
}
