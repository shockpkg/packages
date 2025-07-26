import {spawn} from 'node:child_process';

export async function backup(file, group, path, progress) {
	const p = spawn('./bin/backup', ['backup.ini', file, group, path]);
	let stdout = '';
	p.stdout.on('data', data => {
		stdout += data.toString();
		stdout = stdout.slice(stdout.lastIndexOf('\n', stdout.length - 2) + 1);
		progress(stdout.trim());
	});
	return new Promise((resolve, reject) => {
		p.once('exit', resolve);
		p.once('error', reject);
	});
}
