import {DOMParser} from '@xmldom/xmldom';

import {retry} from './retry.mjs';

// eslint-disable-next-line max-len
export const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:85.0) Gecko/20100101 Firefox/85.0';

const ids = [
	['npapi', 'windows-npapi'],
	['/cdm/latest/flashplayer_install_cn_debug.exe', 'windows-npapi-debug'],
	['ppapi', 'windows-ppapi'],
	['/cdm/latest/flashplayerpp_install_cn_debug.exe', 'windows-ppapi-debug'],
	['activex', 'windows-activex'],
	['/cdm/latest/flashplayerax_install_cn_debug.exe', 'windows-activex-debug'],
	['mac-npapi', 'mac-npapi'],
	['mac-ppapi', 'mac-ppapi'],
	['/cdm/latest/flashplayer_sa.exe', 'windows-sa'],
	['/cdm/latest/flashplayer_sa_debug.exe', 'windows-sa-debug'],
	['linux-32-tar-npapi', 'linux-i386-npapi'],
	['linux-32-rpm-npapi', 'linux-i386-npapi-rpm'],
	['linux-32-tar-ppapi', 'linux-i386-ppapi'],
	['linux-32-rpm-ppapi', 'linux-i386-ppapi-rpm'],
	['linux-64-tar-npapi', 'linux-x86_64-npapi'],
	['linux-64-rpm-npapi', 'linux-x86_64-npapi-rpm'],
	['linux-64-tar-ppapi', 'linux-x86_64-ppapi'],
	['linux-64-rpm-ppapi', 'linux-x86_64-ppapi-rpm'],
	['playerglobal', 'playerglobal']
];
const idTypes = new Map(ids);
const idIndex = new Map(ids.map((v, i) => [v[0], i]));

const dupes = new Map([
	// The pp_ax installer gets same installers from pp and ax.
	['pp_ax', ['activex', 'ppapi']]
]);

function parseJsonP(jsonp) {
	const m = jsonp.match(/^\s*[a-z0-9_$]+\s*\((.+)\)\s*;?\s*$/im);
	if (!m) {
		throw new Error('Invalid JOSNP');
	}
	return JSON.parse(m[1]);
}

function parseJsonV(jsonv) {
	const json = jsonv.substring(
		jsonv.indexOf('{'),
		jsonv.lastIndexOf('}') + 1
	);
	return JSON.parse(json);
}

function getSource(downloadUrl, version) {
	const url = downloadUrl;
	let r = url;
	const m = url.match(
		// eslint-disable-next-line max-len
		/^(.*)\/cdm\/(latest|webplayer)\/flashplayer(.*)_install_cn_(web|debug)\.exe/
	);
	if (m) {
		const [, base,,, kind] = m;
		let [,,, type] = m;
		if (type) {
			if (type !== 'ax') {
				type += 'api';
			}
			type += '_';
		}
		const s = kind === 'debug' ? `_${kind}` : '';
		const v = version.replaceAll('.', '');
		r = `${base}/flashplayer/${v}/install_flash_player${s}_${type}cn.exe`;
	}
	if (
		/web/i.test(r) ||
		(
			/latest.*debug\.exe$/i.test(r) &&
			!/flashplayer_sa/i.test(r)
		)
	) {
		throw new Error(`Unresolved web installer: ${url}`);
	}
	return r;
}

function urlFile(url) {
	return decodeURIComponent(
		url.split(/[?#]/)[0].split('/').pop()
	);
}

function dateNorm(date) {
	const pieces = date.split('/');
	if (pieces.length === 3) {
		return pieces.reverse().join('-');
	}
	return date;
}

async function listRelease() {
	const htmlUrl = 'https://www.flash.cn/download';
	const fverUrl = 'https://api.flash.cn/config/flashVersion';
	const jsRes = await retry(() => fetch(fverUrl, {
		headers: {
			'User-Agent': userAgent,
			Referer: htmlUrl
		}
	}));
	if (jsRes.status !== 200) {
		throw new Error(`Status code: ${jsRes.status}: ${htmlUrl}`);
	}

	const versions = parseJsonP(await jsRes.text());
	const r = [];
	const ids = new Set();
	for (const [id, info] of Object.entries(versions)) {
		if (id.startsWith('fc-')) {
			continue;
		}

		ids.add(id);

		if (dupes.has(id)) {
			continue;
		}

		// Not used.
		// if (
		// 	info.downloadURLForWin8 &&
		// 	info.downloadURLForWin8 !== info.downloadURL
		// ) {
		// 	throw new Error(`Unexpected Win8 URL: ${info.downloadURLForWin8}`);
		// }

		const source = getSource(info.downloadURL, info.version);
		const type = idTypes.get(id);
		if (!type) {
			throw new Error(`Unknown id: ${id}`);
		}
		r.push({
			name: `flash-player-${info.version}-${type}-cn`,
			file: urlFile(source),
			source,
			referer: htmlUrl,
			list: 'release',
			id,
			date: dateNorm(info.date),
			version: info.version,
			size: info.size
		});
	}

	for (const [id, duped] of dupes) {
		if (ids.has(id)) {
			const missing = duped.filter(id => !ids.has(id));
			if (missing.length) {
				throw new Error(`Missing ${id} dupes: ${missing.join(',')}`);
			}
		}
	}

	return r;
}

function c2a(a) {
	const r = [];
	for (let i = 0; i < a.length; i++) {
		r.push(a[i]);
	}
	return r;
}

async function listDebug() {
	const htmlUrl = 'https://www.flash.cn/support/debug-downloads';
	const htmlRes = await retry(() => fetch(htmlUrl, {
		headers: {
			'User-Agent': userAgent
		}
	}));
	if (htmlRes.status !== 200) {
		throw new Error(`Status code: ${htmlRes.status}: ${htmlUrl}`);
	}

	const html = await htmlRes.text();

	const jsUrl = 'https://api.flash.cn/config/debugFlashVersion';
	const jsRes = await retry(() => fetch(jsUrl, {
		headers: {
			'User-Agent': userAgent,
			Referer: htmlUrl
		}
	}));
	if (jsRes.status !== 200) {
		throw new Error(`Status code: ${jsRes.status}: ${jsUrl}`);
	}

	const js = await jsRes.text();

	const {version, date} = parseJsonV(js);
	const dated = dateNorm(date);

	const r = [];
	const dom = (new DOMParser()).parseFromString(html, 'text/html');
	const aTags = c2a(dom.getElementsByClassName('dc-download'))
		.map(e => c2a(e.getElementsByTagName('a')))
		.flat(1);
	for (const a of aTags) {
		const u = (new URL(a.getAttribute('href'), htmlUrl));
		const source = getSource(u.href, version);
		const file = urlFile(source);
		if (/playerglobal/i.test(file)) {
			r.push({
				name: `flash-playerglobal-${version}-cn`,
				file,
				source,
				referer: htmlUrl,
				list: 'debug',
				id: 'playerglobal',
				date: dated,
				version,
				size: null
			});
		}
		else if (/flash_?player/i.test(file)) {
			const id = u.pathname;
			const type = idTypes.get(id);
			if (!type) {
				throw new Error(`Unknown id: ${id}`);
			}
			r.push({
				name: `flash-player-${version}-${type}-cn`,
				file,
				source,
				referer: htmlUrl,
				list: 'debug',
				id,
				date: dated,
				version,
				size: null
			});
		}
		else {
			throw new Error(`Unknown file type: ${file}`);
		}
	}
	return r;
}

export async function list() {
	return (await Promise.all([listRelease(), listDebug()])).flat()
		.sort((a, b) => (idIndex.get(a.id) || 0) - (idIndex.get(b.id) || 0));
}
