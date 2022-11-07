import yaml from 'js-yaml';

export function packages(doc) {
	const y = yaml.dump(doc, {
		lineWidth: 1000000,
		noRefs: true,
		indent: 2
	});
	const r = y
		.replace(/^(\s*- )/gm, '\n$1')
		.replace(/:\n\n/g, ':\n')
		.trim();
	return `${r}\n`;
}
