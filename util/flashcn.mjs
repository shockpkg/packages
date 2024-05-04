import {DOMParser} from '@xmldom/xmldom';

import {retry, list} from './util.mjs';

export const userAgent =
	// eslint-disable-next-line max-len
	'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:85.0) Gecko/20100101 Firefox/85.0';

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
	['/cdm/latest/playerglobal.swc', 'playerglobal']
];
const idIndex = new Map(ids.map((v, i) => [v[0], i]));
const idDebug = new Map(ids.filter(a => a[0].includes('/')));
const idRelease = new Map(ids.filter(a => !idDebug.has(a[0])));

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
		const [, base, , , kind] = m;
		let [, , , type] = m;
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
		(/latest.*debug\.exe$/i.test(r) && !/flashplayer_sa/i.test(r))
	) {
		throw new Error(`Unresolved web installer: ${url}`);
	}
	return r;
}

function urlFile(url) {
	return decodeURIComponent(url.split(/[?#]/)[0].split('/').pop());
}

function dateNorm(date) {
	const pieces = date.split('/');
	if (pieces.length === 3) {
		return pieces.reverse().join('-');
	}
	return date;
}

function mimetype(file) {
	if (/\.exe/i.test(file)) {
		return 'application/x-msdownload';
	}
	if (/\.dmg/i.test(file)) {
		return 'application/x-apple-diskimage';
	}
	if (/\.rpm/i.test(file)) {
		return 'application/octet-stream';
	}
	if (/\.tar\.gz/i.test(file)) {
		return 'application/octet-stream';
	}
	if (/\.swc/i.test(file)) {
		return 'application/octet-stream';
	}
	return null;
}

async function listRelease() {
	const htmlUrl = 'https://www.flash.cn/download';
	const fverUrl = 'https://api.flash.cn/config/flashVersion';
	const jsRes = await retry(() =>
		fetch(fverUrl, {
			headers: {
				'User-Agent': userAgent,
				Referer: htmlUrl
			}
		})
	);
	if (jsRes.status !== 200) {
		throw new Error(`Status code: ${jsRes.status}: ${htmlUrl}`);
	}

	const versions = parseJsonP(await jsRes.text());
	const r = [];
	const ids = new Set();
	for (const [id, info] of Object.entries(versions)) {
		if (id.startsWith('fc-') || dupes.has(id)) {
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
		const file = urlFile(source);
		const type = idRelease.get(id);
		if (!type) {
			throw new Error(`Unknown id: ${id}`);
		}

		r.push({
			name: `flash-player-${info.version}-${type}-cn`,
			file,
			source,
			referer: htmlUrl,
			list: 'release',
			id,
			date: dateNorm(info.date),
			version: info.version,
			size: info.size,
			mimetype: mimetype(file)
		});
		ids.add(id);
	}

	const missing = [...idRelease.keys()].filter(s => !ids.has(s));
	if (missing.length) {
		throw new Error(`Missing: ${missing.join(',')}`);
	}

	return r;
}

async function listDebug() {
	const htmlUrl = 'https://www.flash.cn/support/debug-downloads';
	const htmlRes = await retry(() =>
		fetch(htmlUrl, {
			headers: {
				'User-Agent': userAgent
			}
		})
	);
	if (htmlRes.status !== 200) {
		throw new Error(`Status code: ${htmlRes.status}: ${htmlUrl}`);
	}

	const html = await htmlRes.text();

	const domParser = new DOMParser({errorHandler: {}});
	const dom = domParser.parseFromString(html, 'text/html');
	const hrefs = list(dom.getElementsByTagName('a'))
		.map(a => new URL(a.getAttribute('href') || '', htmlRes.url))
		.filter(u => u.pathname.startsWith('/cdm/'));

	const jsUrl = 'https://api.flash.cn/config/debugFlashVersion';
	const jsRes = await retry(() =>
		fetch(jsUrl, {
			headers: {
				'User-Agent': userAgent,
				Referer: htmlUrl
			}
		})
	);
	if (jsRes.status !== 200) {
		throw new Error(`Status code: ${jsRes.status}: ${jsUrl}`);
	}

	const js = await jsRes.text();

	const {version, date} = parseJsonV(js);
	const dated = dateNorm(date);

	const r = [];
	const ids = new Set();
	for (const u of hrefs) {
		const source = getSource(u.href, version);
		const file = urlFile(source);
		const id = u.pathname;
		const type = idDebug.get(id);
		if (!type) {
			throw new Error(`Unknown file: ${u.href}`);
		}

		const name =
			type === 'playerglobal'
				? `flash-playerglobal-${version}-cn`
				: `flash-player-${version}-${type}-cn`;
		r.push({
			name,
			file,
			source,
			referer: htmlUrl,
			list: 'debug',
			id,
			date: dated,
			version,
			size: null,
			mimetype: mimetype(file)
		});
		ids.add(id);
	}

	const missing = [...idDebug.keys()].filter(s => !ids.has(s));
	if (missing.length) {
		throw new Error(`Missing: ${missing.join(',')}`);
	}

	return r;
}

export async function downloads() {
	return (await Promise.all([listRelease(), listDebug()]))
		.flat()
		.sort((a, b) => (idIndex.get(a.id) || 0) - (idIndex.get(b.id) || 0));
}
