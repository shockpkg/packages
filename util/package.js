'use strict';

const {readFile} = require('fs/promises');
const {join: pathJoin} = require('path');

const yaml = require('js-yaml');

async function read(type, version) {
	const dir = pathJoin(__dirname, '..', 'packages');
	return yaml.load(
		await readFile(pathJoin(dir, type, `${version}.yaml`))
	);
}

exports.read = read;
