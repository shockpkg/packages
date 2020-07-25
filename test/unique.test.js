'use strict';

const {entries, entriesRoot} = require('./shared');

describe('unique', () => {
	describe('name + sha256 + sha1 + md5', () => {
		const seen = new Set();
		for (const entry of entries) {
			it(entry.name, () => {
				expect(seen.has(entry.name)).toBe(false);
				seen.add(entry.name);
			});
			it(entry.sha256, () => {
				expect(seen.has(entry.sha256)).toBe(false);
				seen.add(entry.sha256);
			});
			it(entry.sha1, () => {
				expect(seen.has(entry.sha1)).toBe(false);
				seen.add(entry.sha1);
			});
			it(entry.md5, () => {
				expect(seen.has(entry.md5)).toBe(false);
				seen.add(entry.md5);
			});
		}
	});

	describe('source (root)', () => {
		const seen = new Set();
		for (const entry of entriesRoot) {
			it(entry.source, () => {
				expect(seen.has(entry.source)).toBe(false);
				seen.add(entry.source);
			});
		}
	});

	describe('source (child)', () => {
		for (const entry of entries) {
			const {packages} = entry;
			if (!packages) {
				continue;
			}

			const seen = new Set();

			for (const pkg of packages) {
				it(`${entry.name}: ${pkg.source}`, () => {
					expect(seen.has(pkg.source)).toBe(false);
					seen.add(pkg.source);
				});
			}
		}
	});
});
