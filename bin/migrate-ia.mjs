#!/usr/bin/env node

/* eslint-disable no-console */
import {readFile, writeFile} from 'fs/promises';

import yaml from 'js-yaml';

import {packages as encodePackages} from '../util/yaml.mjs';

async function main() {
	const args = process.argv.slice(2);
	if (args.length < 1) {
		throw new Error('Args: file.yaml');
	}
	const [file] = args;

	const doc = yaml.load(await readFile(file, 'utf8'));
	for (const p of doc) {
		const {file, sha256} = p;
		p.source = [
			`https://archive.org/download/shockpkg_packages_${sha256[0]}`,
			sha256.substr(0, 2),
			sha256.substr(2, 2),
			sha256.substr(4),
			file
		].join('/');
	}

	await writeFile(file, encodePackages(doc));
}
main().catch(err => {
	console.error(err);
	process.exitCode = 1;
});
