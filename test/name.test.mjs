import {entries, packagePrefixes} from './shared.mjs';

describe('name', () => {
	for (const entry of entries) {
		it(entry.name, () => {
			expect(entry.name).toBe(entry.name.toLowerCase());
			expect(entry.name).toMatch(/^[a-z]/);
			expect(entry.name).toMatch(/[a-z0-9]$/);
			expect(entry.name).toMatch(/^[-a-z0-9_.]+$/);

			let prefixed = false;
			for (const prefix of packagePrefixes) {
				if (!entry.name.indexOf(`${prefix}-`)) {
					prefixed = true;
					break;
				}
			}
			expect(prefixed).toBe(true);
		});
	}
});
