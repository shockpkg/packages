import {JSDOM} from 'jsdom';

import {retry} from './util.mjs';

const runtimeUrl = 'https://airsdk.harman.com/runtime';
const runtimeFileBase = 'https://airsdk.harman.com/assets/downloads';

const runtimeFiles = [
	['AdobeAIR.exe', 'windows', 'application/x-msdownload'],
	['AdobeAIR.dmg', 'mac', 'application/x-apple-diskimage']
];

const legacy = new Set([
	'25c1fcbf57427e963ffd0f860cd580bcedb7fecc3584d3210c1067130f7b531a',
	'8da552e22320544d5dd94903a900d446be43815d5ded96444f3cb40bb2681e0f'
]);

export async function runtimes(userAgent) {
	const response = await retry(() =>
		fetch(runtimeUrl, {
			headers: {
				...userAgent.headers
			}
		})
	);

	// The page has a 404 response code normally?
	if (response.status !== 200 && response.status !== 404) {
		throw new Error(`Status code: ${response.status}: ${runtimeUrl}`);
	}

	const html = await response.text();
	const page = new JSDOM(html, {url: response.url});
	const {document} = page.window;
	const scripts = document.querySelectorAll('script');
	if (!scripts.length) {
		throw new Error(`No script tags: ${runtimeUrl}`);
	}

	let version = '';
	let hashes = null;
	for (const script of [...scripts].reverse()) {
		const {src} = script;
		if (!src) {
			continue;
		}

		// eslint-disable-next-line no-await-in-loop
		const res = await retry(() =>
			fetch(src, {
				headers: {
					...userAgent.headers,
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
		throw new Error(`No version found: ${runtimeUrl}`);
	}

	if (!hashes) {
		throw new Error(`No hashes found: ${runtimeUrl}`);
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

		const source = `${runtimeFileBase}/${version}/${file}`;
		downloads.push({
			name: `air-runtime-${version}-${os}`,
			version,
			file,
			sha256,
			source,
			headers: {
				...userAgent.headers,
				Referer: runtimeUrl
			},
			mimetype,
			group: ['air-runtime', version]
		});
	}

	return downloads;
}
