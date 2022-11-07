import {readFile} from 'fs/promises';
import {dirname, join as pathJoin} from 'path';
import {fileURLToPath} from 'url';

import yaml from 'js-yaml';

const __dirname = dirname(fileURLToPath(import.meta.url));

export async function read(type, version) {
	const dir = pathJoin(__dirname, '..', 'packages');
	return yaml.load(
		await readFile(pathJoin(dir, type, `${version}.yaml`))
	);
}
