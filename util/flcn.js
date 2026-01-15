import {createHash} from 'node:crypto';

import CRC64 from '@hqtsm/crc/crc-64/xz';
import {JSDOM} from 'jsdom';

import {retry} from './util.js';

const release = new Map([
	[
		'npapi',
		{
			type: 'windows-npapi',
			cdm: 'https://www.flash.cn/cdm/en/flashplayer.xml'
		}
	],
	[
		'ppapi',
		{
			type: 'windows-ppapi',
			cdm: 'https://www.flash.cn/cdm/en/flashplayerpp.xml'
		}
	],
	[
		'activex',
		{
			type: 'windows-activex',
			cdm: 'https://www.flash.cn/cdm/en/flashplayerax.xml'
		}
	],
	[
		'mac-npapi',
		{
			type: 'mac-npapi'
		}
	],
	[
		'mac-ppapi',
		{
			type: 'mac-ppapi'
		}
	],
	[
		'linux-32-tar-npapi',
		{
			type: 'linux-i386-npapi'
		}
	],
	[
		'linux-32-rpm-npapi',
		{
			type: 'linux-i386-npapi-rpm'
		}
	],
	[
		'linux-32-tar-ppapi',
		{
			type: 'linux-i386-ppapi'
		}
	],
	[
		'linux-32-rpm-ppapi',
		{
			type: 'linux-i386-ppapi-rpm'
		}
	],
	[
		'linux-64-tar-npapi',
		{
			type: 'linux-x86_64-npapi'
		}
	],
	[
		'linux-64-rpm-npapi',
		{
			type: 'linux-x86_64-npapi-rpm'
		}
	],
	[
		'linux-64-tar-ppapi',
		{
			type: 'linux-x86_64-ppapi'
		}
	],
	[
		'linux-64-rpm-ppapi',
		{
			type: 'linux-x86_64-ppapi-rpm'
		}
	]
]);

const debug = new Map([
	[
		'/cdm/latest/flashplayer_install_cn_debug.exe',
		{
			type: 'windows-npapi-debug',
			cdm: 'https://www.flash.cn/cdm/en/flashplayerdebug.xml'
		}
	],
	[
		'/cdm/latest/flashplayerpp_install_cn_debug.exe',
		{
			type: 'windows-ppapi-debug',
			cdm: 'https://www.flash.cn/cdm/en/flashplayerppdebug.xml'
		}
	],
	[
		'/cdm/latest/flashplayerax_install_cn_debug.exe',
		{
			type: 'windows-activex-debug',
			cdm: 'https://www.flash.cn/cdm/en/flashplayeraxdebug.xml'
		}
	],
	[
		'/cdm/latest/flashplayer_sa.exe',
		{
			type: 'windows-sa'
		}
	],
	[
		'/cdm/latest/flashplayer_sa_debug.exe',
		{
			type: 'windows-sa-debug'
		}
	],
	[
		'/cdm/latest/playerglobal.swc',
		{
			type: 'playerglobal'
		}
	]
]);

const dupes = new Map([
	// The pp_ax installer gets same installers from pp and ax.
	['pp_ax', ['activex', 'ppapi']]
]);

const aamHeaders = {
	'Cache-Control': 'no-cache',
	Pragma: 'no-cache',
	Referer: 'Adobe.referer',
	'User-Agent': 'Adobe Application Manager 2.0'
};

const algorithms = new Map([['TYPE1', 'sha256']]);

function urlFile(url) {
	return decodeURIComponent(url.split(/[#?]/)[0].split('/').pop());
}

function dateNorm(date) {
	const pieces = date.split('/');
	if (pieces.length === 3) {
		return pieces.reverse().join('-');
	}
	return date;
}

function mimetype(file) {
	if (/\.exe$/i.test(file)) {
		return 'application/x-msdownload';
	}
	if (/\.dmg$/i.test(file)) {
		return 'application/x-apple-diskimage';
	}
	if (/\.rpm$/i.test(file)) {
		return 'application/octet-stream';
	}
	if (/\.tar\.gz$/i.test(file)) {
		return 'application/octet-stream';
	}
	if (/\.swc$/i.test(file)) {
		return 'application/octet-stream';
	}
	return null;
}

function parseJsonP(jsonp) {
	const m = jsonp.match(/^\s*[\w$]+\s*\((.+)\)\s*;?\s*$/im);
	if (!m) {
		throw new Error('Invalid JSONP');
	}
	return JSON.parse(m[1]);
}

function parseJsonV(jsonv) {
	const json = jsonv.slice(jsonv.indexOf('{'), jsonv.lastIndexOf('}') + 1);
	return JSON.parse(json);
}

async function downloadCDM({
	head,
	assetPath,
	size,
	partSize,
	partCount,
	lastPartSize,
	hashes,
	algo
}) {
	const res = await retry(() =>
		fetch(assetPath, {
			method: head ? 'HEAD' : 'GET',
			headers: aamHeaders
		})
	);
	if (res.status !== 200) {
		throw new Error(`Status code: ${res.status}: ${assetPath}`);
	}

	let total = 0;
	let partC = 0;
	let partI = 0;
	let reader;
	const hash = data => createHash(algo).update(data).digest('hex');
	const part = new Uint8Array(partSize);
	return {
		size,
		stream: new ReadableStream({
			async pull(controller) {
				reader ??= res.body.getReader();
				const {value, done} = await reader.read();
				if (value) {
					total += value.length;
					if (total > size) {
						throw new Error(
							`Bad size: ${total} > ${size}: ${assetPath}`
						);
					}

					for (let d, v = value; v.length; v = v.slice(d.length)) {
						d = v.slice(0, partSize - partI);
						part.set(d, partI);
						partI += d.length;
						const last = partC + 1 === partCount;
						const partEnd = last ? lastPartSize : partSize;
						if (partI !== partEnd) {
							continue;
						}

						const e = hashes[partC];
						const h = hash(part.slice(0, partEnd));
						if (e.toLowerCase() !== h.toLowerCase()) {
							const u = assetPath;
							throw new Error(
								`Bad chunk [${partC}]: ${h} != ${e}: ${u}`
							);
						}
						partC++;
						partI = 0;
					}

					controller.enqueue(value);
				}
				if (done) {
					if (total !== size) {
						throw new Error(
							`Bad size: ${total} != ${size}: ${assetPath}`
						);
					}
					controller.close();
				}
			}
		})
	};
}

async function fetchCDM(type, cdm, date) {
	const res = await retry(() =>
		fetch(cdm, {
			headers: aamHeaders
		})
	);
	if (res.status !== 200) {
		throw new Error(`Status code: ${res.status}: ${cdm}`);
	}

	const xml = await res.text();
	const {DOMParser} = new JSDOM('').window;
	const doc = new DOMParser().parseFromString(xml, 'text/xml');
	const manifests = new Map();

	for (const pkg of doc.querySelectorAll(
		'application:root > packages > package'
	)) {
		const title = pkg.querySelector(':scope > title')?.textContent;
		if (title !== 'Adobe Flash Player') {
			throw new Error(`Unexpected title: ${title}: ${cdm}`);
		}
		const version = pkg.querySelector(':scope > version')?.textContent;
		if (!version) {
			throw new Error(`Missing version: ${cdm}`);
		}
		const manifestUrl = pkg.querySelector(
			':scope > actions > download > manifestUrl'
		)?.textContent;
		if (!manifestUrl) {
			throw new Error(`Missing manifestUrl: ${cdm}`);
		}
		manifests.set(manifestUrl, version);
	}

	return Promise.all(
		[...manifests].map(async ([url, version]) => {
			const res = await retry(() =>
				fetch(url, {
					headers: aamHeaders
				})
			);
			if (res.status !== 200) {
				throw new Error(`Status code: ${res.status}: ${url}`);
			}
			const xml = await res.text();
			const doc = new DOMParser().parseFromString(xml, 'text/xml');
			const assetSize = doc.querySelector(
				'manifest:scope > assetSize'
			)?.textContent;
			const size = +assetSize;
			if (!Number.isInteger(size) || size < 0) {
				throw new Error(`Invalid assetSize: ${assetSize}: ${url}`);
			}
			const assetPath = doc.querySelector(
				'manifest:scope > assetPath'
			)?.textContent;
			if (!assetPath) {
				throw new Error(`Missing assetPath: ${url}`);
			}

			const validationInfo = doc.querySelector(
				'manifest:scope > validationInfo'
			);
			if (!validationInfo) {
				throw new Error(`Missing validationInfo: ${url}`);
			}
			const segmentSize = validationInfo.querySelector(
				':scope > segmentSize'
			)?.textContent;
			const partSize = +segmentSize;
			if (!partSize || partSize < 0) {
				throw new Error(`Invalid segmentSize: ${segmentSize}: ${url}`);
			}
			const segmentCount = validationInfo.querySelector(
				':scope > segmentCount'
			)?.textContent;
			const partCount = +segmentCount;
			if (!partCount || partCount < 0) {
				throw new Error(
					`Invalid segmentCount: ${segmentCount}: ${url}`
				);
			}
			const lastSegmentSize = validationInfo.querySelector(
				':scope > lastSegmentSize'
			)?.textContent;
			const lastPartSize = +lastSegmentSize;
			if (lastPartSize && lastPartSize < 0) {
				throw new Error(
					`Invalid lastSegmentSize: ${lastSegmentSize}: ${url}`
				);
			}
			const algorithm =
				validationInfo.querySelector(':scope > algorithm')?.textContent;
			const algo = algorithms.get(algorithm);
			if (!algo) {
				throw new Error(`Invalid algorithm: ${url}`);
			}

			const segments = validationInfo.querySelectorAll(
				':scope > segments > segment'
			);
			if (segments.length !== partCount) {
				throw new Error(
					`Invalid segments: ${segments.length}/${partCount}: ${url}`
				);
			}
			const hashes = [];
			for (const seg of segments) {
				const segmentNumber = seg.getAttribute('segmentNumber');
				const i = +segmentNumber;
				if (!Number.isInteger(i) || i < 0 || i >= partCount) {
					throw new Error(
						`Invalid segmentNumber: ${segmentNumber}: ${url}`
					);
				}
				const hash = seg.textContent;
				if (!hash) {
					throw new Error(`Missing segment [${i}] hash: ${url}`);
				}
				if (hashes[i]) {
					throw new Error(`Duplicate segment [${i}] hash: ${url}`);
				}
				hashes[i] = hash;
			}

			const file = urlFile(assetPath);
			if (!file) {
				throw new Error(`Bad file name: ${assetPath}: ${url}`);
			}

			return {
				name: `flash-player-${version}-${type}-cn`,
				file,
				size,
				date,
				version,
				group: ['flash-player', version],
				async download(head = false) {
					return downloadCDM({
						head,
						assetPath,
						size,
						partSize,
						partCount,
						lastPartSize,
						hashes,
						algo
					});
				}
			};
		})
	);
}

async function downloadDirect({head, source, userAgent, referer, mime}) {
	const url = `${source}?_=${Date.now()}`;
	const res = await retry(() =>
		fetch(url, {
			method: head ? 'HEAD' : 'GET',
			headers: {
				...userAgent.headers,
				Referer: referer
			}
		})
	);
	if (res.status !== 200) {
		throw new Error(`Status code: ${res.status}: ${url}`);
	}

	const ct = res.headers.get('content-type');
	if (ct !== mime) {
		throw new Error(`Invalid content-type: ${ct} != ${mime}: ${url}`);
	}

	const cl = res.headers.get('content-length');
	const size = +cl;
	if (!Number.isInteger(size) || size < 0) {
		throw new Error(`Invalid content-length: ${cl}: ${url}`);
	}

	// Wrong name, common mistake.
	const crc64xz = res.headers.get('x-cos-hash-crc64ecma');

	let total = 0;
	let crc;
	let reader;
	return {
		size,
		stream: new ReadableStream({
			async pull(controller) {
				crc ??= CRC64.init();
				reader ??= res.body.getReader();
				const {value, done} = await reader.read();
				if (value) {
					total += value.length;
					if (total > size) {
						throw new Error(`Bad size: ${total} > ${size}: ${url}`);
					}
					crc = CRC64.update(crc, value);
					controller.enqueue(value);
				}
				if (done) {
					if (total !== size) {
						throw new Error(
							`Bad size: ${total} != ${size}: ${url}`
						);
					}
					crc = CRC64.finalize(crc);
					if (crc64xz !== crc.toString()) {
						throw new Error(
							`Bad crc64xz: ${crc64xz} != ${crc}: ${url}`
						);
					}
					controller.close();
				}
			}
		})
	};
}

async function listRelease(userAgent) {
	const htmlUrl = 'https://www.flash.cn/download';
	const fverUrl = 'https://api.flash.cn/config/flashVersion';
	const jsRes = await retry(() =>
		fetch(fverUrl, {
			headers: {
				...userAgent.headers,
				Referer: htmlUrl
			}
		})
	);
	if (jsRes.status !== 200) {
		throw new Error(`Status code: ${jsRes.status}: ${htmlUrl}`);
	}

	const versions = parseJsonP(await jsRes.text());
	const r = [];
	const cdms = [];
	const ids = new Set();
	for (const [id, info] of Object.entries(versions)) {
		if (id.startsWith('fc-') || dupes.has(id)) {
			continue;
		}

		const rel = release.get(id);
		if (!rel) {
			throw new Error(`Unknown id: ${id}`);
		}

		const {version} = info;
		const date = dateNorm(info.date);
		const {type, cdm} = rel;
		if (cdm) {
			cdms.push({
				id,
				type,
				cdm,
				date
			});
			continue;
		}

		// Not used.
		// if (
		// 	info.downloadURLForWin8 &&
		// 	info.downloadURLForWin8 !== info.downloadURL
		// ) {
		// 	throw new Error(`Unexpected Win8 URL: ${info.downloadURLForWin8}`);
		// }

		const source = info.downloadURL;
		const file = urlFile(source);
		r.push({
			name: `flash-player-${info.version}-${type}-cn`,
			file,
			size: info.size,
			date,
			version,
			group: ['flash-player', version],
			async download(head = false) {
				return downloadDirect({
					head,
					source,
					userAgent,
					referer: htmlUrl,
					mime: mimetype(file)
				});
			}
		});
		ids.add(id);
	}

	await Promise.all(
		cdms.map(async ({id, type, cdm, date}) => {
			const list = await fetchCDM(type, cdm, date);
			if (list.length) {
				ids.add(id);
				r.push(...list);
			}
		})
	);

	const missing = [...release.keys()].filter(s => !ids.has(s));
	if (missing.length) {
		throw new Error(`Missing: ${missing.join(',')}`);
	}

	return r;
}

async function listDebug(userAgent) {
	const htmlUrl = 'https://www.flash.cn/support/debug-downloads';
	const htmlRes = await retry(() =>
		fetch(htmlUrl, {
			headers: {
				...userAgent.headers
			}
		})
	);
	if (htmlRes.status !== 200) {
		throw new Error(`Status code: ${htmlRes.status}: ${htmlUrl}`);
	}

	const html = await htmlRes.text();
	const page = new JSDOM(html, {url: htmlRes.url});
	const hrefs = [...page.window.document.querySelectorAll('a')]
		.map(a => new URL(a.href))
		.filter(u => u.pathname.startsWith('/cdm/'));

	const jsUrl = 'https://api.flash.cn/config/debugFlashVersion';
	const jsRes = await retry(() =>
		fetch(jsUrl, {
			headers: {
				...userAgent.headers,
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
	const cdms = [];
	const ids = new Set();
	for (const u of hrefs) {
		const id = u.pathname;
		const dbg = debug.get(id);
		if (!dbg) {
			throw new Error(`Unknown file: ${u.href}`);
		}

		const {type, cdm} = dbg;
		if (cdm) {
			cdms.push({
				id,
				type,
				cdm,
				date: dated
			});
			continue;
		}

		const source = u.href;
		const file = urlFile(source);
		const family =
			type === 'playerglobal' ? 'flash-playerglobal' : 'flash-player';
		const suf = type === 'playerglobal' ? 'cn' : `${type}-cn`;
		const ver =
			type === 'playerglobal'
				? version.replace(/^(\d+\.\d+)\..*/, '$1')
				: version;
		r.push({
			name: `${family}-${version}-${suf}`,
			file,
			size: null,
			date: dated,
			version,
			group: [family, ver],
			async download(head = false) {
				return downloadDirect({
					head,
					source,
					userAgent,
					referer: htmlUrl,
					mime: mimetype(file)
				});
			}
		});
		ids.add(id);
	}

	await Promise.all(
		cdms.map(async ({id, type, cdm, date}) => {
			const list = await fetchCDM(type, cdm, date);
			if (list.length) {
				ids.add(id);
				r.push(...list);
			}
		})
	);

	const missing = [...debug.keys()].filter(s => !ids.has(s));
	if (missing.length) {
		throw new Error(`Missing: ${missing.join(',')}`);
	}

	return r;
}

export async function downloads(userAgent) {
	return (await Promise.all([listRelease(userAgent), listDebug(userAgent)]))
		.flat()
		.sort((a, b) => {
			a = a.name;
			b = b.name;
			if (a < b) {
				return -1;
			}
			if (a > b) {
				return 1;
			}
			return 0;
		});
}
