#!/usr/bin/env node

/* eslint-disable no-console */
'use strict';

const path = require('path');

const fse = require('fs-extra');

const gencache = require('../util/gencache');
const hash = require('../util/hash');
const zip = require('../util/zip');
const paths = require('../util/paths');
const yaml = require('../util/yaml');

const packagesDir = path.join(path.dirname(__dirname), 'packages');

function pathToName(filepath) {
	return filepath.split('/').pop();
}

function isUninstaller(filename) {
	// Includes a typo variant.
	return /^uninstall_/i.test(filename) || /^uninsstall_/i.test(filename);
}

function filenameSuffix(filename) {
	const m = filename.match(
		// eslint-disable-next-line max-len
		/[-._]((linux|linuxpep|mac|macpep|win|winax|winpep|solaris|sa|release\.i386|release\.x86_64)[._].*)$/
	);
	if (!m) {
		throw new Error(`Unexpected file name: ${filename}`);
	}
	return m[1];
}

function filenameParts(filename) {
	const parts = filename.split('.');
	let ext = parts.pop();
	switch (ext) {
		case 'exe':
		case 'msi':
		case 'dmg':
		case 'rpm': {
			break;
		}
		case 'zip': {
			switch (parts[parts.length - 1]) {
				case 'app': {
					ext = `${parts.pop()}.${ext}`;
					break;
				}
				default: {
					// Do nothing.
				}
			}
			break;
		}
		case 'gz':
		case 'bz2': {
			switch (parts[parts.length - 1]) {
				case 'tar': {
					ext = `${parts.pop()}.${ext}`;
					break;
				}
				default: {
					throw new Error(
						// eslint-disable-next-line max-len
						`Unexpected compressed extension without archive: ${filename}`
					);
				}
			}
			break;
		}
		default: {
			throw new Error(`Unexpected file extension: ${filename}`);
		}
	}

	// Compensate for a double extension variant.
	const name = parts.join('.').replace(/\.exe^/i, '');
	return [name, ext];
}

function filenameSegments(fn) {
	const split = fn.split('.');
	const parts = split[0].split(/[-_]/);
	const dot = split.length > 1 ? split[1] : null;
	return [parts, dot];
}

function createMeta(filepath) {
	const filename = pathToName(filepath);
	const uninstaller = isUninstaller(filename);
	const suffix = filenameSuffix(filename);
	const [fn, ext] = filenameParts(suffix);
	const [fnParts, fnDot] = filenameSegments(fn);

	const meta = {
		platform: null,
		proc: null,
		type: null,
		debug: false,
		alt: null
	};

	const mapKindPlatformType = {
		win: ['windows', 'npapi'],
		winax: ['windows', 'activex'],
		winpep: ['windows', 'ppapi'],
		mac: ['mac', 'npapi'],
		macpep: ['mac', 'ppapi'],
		linux: ['linux', 'npapi'],
		linuxpep: ['linux', 'ppapi'],
		solaris: ['solaris', 'npapi']
	};

	const mapExtPlatformType = {
		dmg: ['mac', null],
		exe: ['windows', null],
		'tar.gz': ['linux', 'npapi'],
		rpm: ['linux', 'npapi']
	};

	const [kind] = fnParts;
	if (mapKindPlatformType[kind]) {
		fnParts.shift();
		const [platform, type] = mapKindPlatformType[kind];
		meta.platform = platform;
		meta.type = type;
	}
	else if (mapExtPlatformType[ext]) {
		const [platform, type] = mapExtPlatformType[ext];
		meta.platform = platform;
		meta.type = type;
	}
	else {
		throw new Error(`Unexpected kind/ext: ${kind}/${ext}`);
	}

	const infoSet = new Set(fnParts);
	if (infoSet.has('debug')) {
		infoSet.delete('debug');
		meta.debug = true;
	}
	if (infoSet.has('sa')) {
		infoSet.delete('sa');
		meta.type = 'sa';
	}
	if (infoSet.has('pkg')) {
		infoSet.delete('pkg');
		meta.alt = 'pkg';
	}

	if (ext === 'msi') {
		meta.alt = 'msi';
	}

	for (const proc of [
		'x86',
		'sparc',
		'32bit',
		'64bit'
	]) {
		if (infoSet.has(proc)) {
			meta.proc = proc;
			infoSet.delete(proc);
		}
	}

	if (fnDot) {
		meta.proc = fnDot;
	}

	if (infoSet.has('intel') && meta.platform === 'mac') {
		infoSet.delete('intel');
	}

	if (infoSet.has('release')) {
		if (meta.debug) {
			throw new Error('Found release and debug');
		}
		infoSet.delete('release');
	}

	if (uninstaller) {
		meta.type = 'uninstaller';
	}

	if (!meta.platform) {
		throw new Error(`Empty platform: /${fn}`);
	}

	if (!meta.type) {
		throw new Error(`Empty type: /${fn}`);
	}

	if (infoSet.size) {
		const parts = JSON.stringify([...infoSet]);
		throw new Error(`Did not read all the parts: ${fn}: ${parts}`);
	}

	return meta;
}

function metaToName(version, meta) {
	return [
		'flash-player',
		version,
		meta.platform,
		meta.proc,
		meta.type,
		meta.debug ? 'debug' : null,
		meta.alt
	]
		.filter(Boolean)
		.join('-');
}

function checkPackagesUnique(packages) {
	const names = new Set();
	const sha256s = new Set();
	for (const {name, sha256} of packages) {
		if (names.has(name)) {
			throw new Error(`Duplicate package name: ${name}`);
		}
		if (names.has(name)) {
			throw new Error(`Duplicate package sha256: ${sha256}`);
		}
		names.add(name);
		sha256s.add(sha256);
	}
}

function sortCmp(a, b) {
	if (a < b) {
		return -1;
	}
	if (b < a) {
		return 1;
	}
	return 0;
}

function sortCmpList(a, b, getter, list) {
	const aValue = getter(a);
	const bValue = getter(b);
	const aIndex = list.indexOf(aValue);
	const bIndex = list.indexOf(bValue);
	if (aIndex < 0) {
		throw new Error('Unknown entry a');
	}
	if (bIndex < 0) {
		throw new Error('Unknown entry b');
	}
	return sortCmp(aIndex, bIndex);
}

function sortPackages(a, b) {
	const sorters = [
		[e => e.meta.platform, [
			'windows',
			'mac',
			'linux',
			'solaris'
		]],
		[e => e.meta.proc, [
			null,
			'sparc',
			'x86',
			'i386',
			'x86_64',
			'32bit',
			'64bit'
		]],
		[e => e.meta.type, [
			'npapi',
			'ppapi',
			'activex',
			'sa',
			'uninstaller'
		]],
		[e => e.meta.debug, [
			false,
			true
		]],
		[e => e.meta.alt, [
			null,
			'msi',
			'pkg'
		]]
	];
	for (const [getter, list] of sorters) {
		const r = sortCmpList(a, b, getter, list);
		if (r) {
			return r;
		}
	}
	return 0;
}

async function main() {
	const args = process.argv.slice(2);
	if (args.length < 1) {
		throw new Error('Missing version argument');
	}
	const [version] = args;

	console.log(version);

	const file = path.join(packagesDir, 'flash-player', `${version}.yaml`);

	const name = `flash-player-${version}-archive`;
	const url = `https://fpdownload.macromedia.com/get/flashplayer/installers/archive/fp_${version}_archive.zip`;

	console.log(`Name: ${name}`);
	console.log(`URL: ${url}`);

	// eslint-disable-next-line no-await-in-loop
	const cached = await gencache.ensure(name, url, progress => {
		const percent = progress * 100;
		process.stdout.write(`\rDownloading: ${percent.toFixed(2)}%\r`);
	});

	if (cached.downloaded) {
		console.log('');
	}
	else {
		console.log('Cached');
	}

	const stat = await fse.stat(cached.filepath);
	const {size} = stat;
	console.log(`Size: ${size}`);

	const [sha256, sha1, md5] =
		await hash.file(cached.filepath, ['sha256', 'sha1', 'md5']);
	console.log(`SHA256: ${sha256}`);
	console.log(`SHA1: ${sha1}`);
	console.log(`MD5: ${md5}`);
	console.log('');

	const packagesMeta = [];
	await zip.itterFile(cached.filepath, async info => {
		if (info.isDirector) {
			return;
		}
		const {filepath} = info;
		if (paths.isSystem(filepath) || paths.isMetadata(filepath)) {
			return;
		}
		const filename = pathToName(filepath);

		console.log(`Filepath: ${filepath}`);

		const data = await info.read();
		const size = data.length;
		console.log(`Size: ${size}`);

		const [sha256, sha1, md5] =
		await hash.buffer(data, ['sha256', 'sha1', 'md5']);
		console.log(`SHA256: ${sha256}`);
		console.log(`SHA1: ${sha1}`);
		console.log(`MD5: ${md5}`);

		const meta = createMeta(filepath);
		const name = metaToName(version, meta);
		console.log(`Name: ${name}`);

		packagesMeta.push({
			meta,
			name,
			file: filename,
			size,
			sha256,
			sha1,
			md5,
			source: filepath
		});

		console.log('');
	});

	checkPackagesUnique(packagesMeta);

	packagesMeta.sort(sortPackages);

	const packages = packagesMeta.map(entry => ({
		name: entry.name,
		file: entry.file,
		size: entry.size,
		sha256: entry.sha256,
		sha1: entry.sha1,
		md5: entry.md5,
		source: entry.source
	}));

	const entry = {
		name: `flash-player-${version}-archive`,
		file: url.split('/').pop(),
		size,
		sha256,
		sha1,
		md5,
		source: url
	};
	if (packages.length) {
		entry.packages = packages;
	}

	const doc = [entry];
	const data = yaml.packages(doc);
	await fse.writeFile(file, data, 'utf8');

	console.log('Done');
}
main().catch(err => {
	console.error(err);
	process.exitCode = 1;
});
