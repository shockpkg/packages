import {DOMParser} from '@xmldom/xmldom';

import {list, retry} from './util.mjs';

// The API this page loads download list from.
// https://airsdk.harman.com/download
const sdkUrl = 'https://airsdk.harman.com/download';
const sdkUrlV = 'https://airsdk.harman.com/download/%version%';
const apiUrl = 'https://airsdk.harman.com/api/config-settings/download';
const apiUrlV = 'https://airsdk.harman.com/api/versions/%version%';
const releaseNotesUrl = 'https://airsdk.harman.com/api/versions/release-notes';

const runtimeBase = 'https://airsdk.harman.com/runtime';
const runtimeFileBase = 'https://airsdk.harman.com/assets/downloads';
const releaseNotesBase = 'https://airsdk.harman.com/release_notes';

export const userAgent =
	// eslint-disable-next-line max-len
	'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:85.0) Gecko/20100101 Firefox/85.0';

const runtimeFiles = [
	['AdobeAIR.exe', 'windows', 'application/x-msdownload'],
	['AdobeAIR.dmg', 'mac', 'application/x-apple-diskimage']
];

const mappings = [
	['air-sdk-%version%-windows', 'SDK_FLEX_WIN'],
	['air-sdk-%version%-windows-compiler', 'SDK_AS_WIN'],
	['air-sdk-%version%-mac', 'SDK_FLEX_MAC'],
	['air-sdk-%version%-mac-compiler', 'SDK_AS_MAC'],
	['air-sdk-%version%-linux', 'SDK_FLEX_LIN'],
	['air-sdk-%version%-linux-compiler', 'SDK_AS_LIN']
];

const legacy = new Set([
	'25c1fcbf57427e963ffd0f860cd580bcedb7fecc3584d3210c1067130f7b531a',
	'8da552e22320544d5dd94903a900d446be43815d5ded96444f3cb40bb2681e0f'
]);

function addQueryParams(url, params) {
	return (
		url +
		(url.includes('?') ? '&' : '?') +
		Object.entries(params)
			.map(a => `${a[0]}=${encodeURIComponent(a[1])}`)
			.join('&')
	);
}

export function cookies(list) {
	return list.map(c => c.split(';')[0]).join('; ');
}

export async function sdksList() {
	const response = await retry(() =>
		fetch(releaseNotesUrl, {
			headers: {
				'User-Agent': userAgent,
				Referer: releaseNotesBase
			}
		})
	);
	if (response.status !== 200) {
		throw new Error(`Status code: ${response.status}: ${releaseNotesUrl}`);
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
			const source = new URL(link, releaseNotesBase).href;
			const file = decodeURI(source.split(/[#?]/)[0].split('/').pop());
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

export async function sdks(version = null) {
	const referer =
		version === null ? sdkUrl : sdkUrlV.replaceAll('%version%', version);
	const response = await retry(() =>
		fetch(apiUrl, {
			headers: {
				'User-Agent': userAgent,
				Referer: referer
			}
		})
	);
	if (response.status !== 200) {
		throw new Error(`Status code: ${response.status}: ${apiUrl}`);
	}

	const data = JSON.parse(await response.text());
	const cookies = [...response.headers]
		.map(a => (a[0] === 'set-cookie' ? a[1] : ''))
		.filter(c => c.startsWith('JSESSIONID='));

	const {id} = data;
	let links;

	if (version === null) {
		// eslint-disable-next-line prefer-destructuring
		links = data.latestVersion.links;
	} else {
		const response = await retry(() =>
			fetch(apiUrlV.replaceAll('%version%', version), {
				headers: {
					'User-Agent': userAgent,
					Referer: referer
				}
			})
		);
		if (response.status !== 200) {
			throw new Error(`Status code: ${response.status}: ${apiUrl}`);
		}

		const data = JSON.parse(await response.text());
		// eslint-disable-next-line prefer-destructuring
		links = data.links;
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
		const source = new URL(link, sdkUrl).href;
		const url = addQueryParams(source, {id});
		const file = decodeURI(source.split(/[#?]/)[0].split('/').pop());
		downloads.push({
			name,
			version,
			file,
			source,
			url,
			mimetype: 'application/octet-stream',
			group: ['air-sdk', version]
		});
	}

	return {
		downloads,
		cookies
	};
}

export async function runtimes() {
	const response = await retry(() =>
		fetch(runtimeBase, {
			headers: {
				'User-Agent': userAgent
			}
		})
	);

	// The page has a 404 response code normally?
	if (response.status !== 200 && response.status !== 404) {
		throw new Error(`Status code: ${response.status}: ${runtimeBase}`);
	}

	const html = await response.text();

	const domParser = new DOMParser({errorHandler: () => {}});
	const dom = domParser.parseFromString(html, 'text/html');
	// eslint-disable-next-line unicorn/prefer-query-selector
	const scripts = list(dom.getElementsByTagName('script'));
	if (!scripts.length) {
		throw new Error(`No script tags: ${runtimeBase}`);
	}

	let version = '';
	let hashes = null;
	for (const script of [...scripts].reverse()) {
		const src = script.getAttribute('src');
		if (!src) {
			continue;
		}

		const {href} = new URL(src, response.url);

		// eslint-disable-next-line no-await-in-loop
		const res = await retry(() =>
			fetch(href, {
				headers: {
					'User-Agent': userAgent,
					Referer: response.url
				}
			})
		);
		if (res.status !== 200) {
			continue;
		}

		// eslint-disable-next-line no-await-in-loop
		const js = await res.text();
		const m = js.match(/air\s+runtime\s+-\s+version\s+((?:\d+\.){3}\d+)/i);
		if (m) {
			// eslint-disable-next-line prefer-destructuring
			version = m[1];
			hashes = js.match(/[\da-f]{64} \*adobeair\.(exe|dmg)/gi);
			break;
		}
	}

	if (!version) {
		throw new Error(`No version found: ${runtimeBase}`);
	}

	if (!hashes) {
		throw new Error(`No hashes found: ${runtimeBase}`);
	}

	const sha256s = new Map();
	for (const line of hashes) {
		const [hash, file] = line.split(' *');
		const sha256 = hash.toLowerCase();
		if (legacy.has(sha256)) {
			continue;
		}

		if (sha256s.has(file)) {
			throw new Error(`Duplicate hash for: ${file}`);
		}

		sha256s.set(file, hash);
	}

	const downloads = [];
	for (const [file, os, mimetype] of runtimeFiles) {
		const sha256 = sha256s.get(file);
		if (!sha256) {
			throw new Error(`No sha256 for: ${file}`);
		}

		downloads.push({
			name: `air-runtime-${version}-${os}`,
			version,
			file,
			sha256,
			source: `${runtimeFileBase}/${version}/${file}`,
			mimetype,
			group: ['air-runtime', version]
		});
	}

	return downloads;
}
