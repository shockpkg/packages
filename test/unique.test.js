'use strict';

const {entries, entriesRoot} = require('./shared');

describe('unique', () => {
	describe('name', () => {
		const seen = new Set();
		for (const entry of entries) {
			it(entry.name, () => {
				expect(seen.has(entry.name)).toBe(false);
				seen.add(entry.name);
			});
		}
	});

	describe('sha256', () => {
		const seen = new Set();
		for (const entry of entries) {
			it(entry.sha256, () => {
				expect(seen.has(entry.sha256)).toBe(false);
				seen.add(entry.sha256);
			});
		}
	});

	describe('url', () => {
		const seen = new Set();
		for (const entry of entriesRoot) {
			it(entry.url, () => {
				expect(seen.has(entry.url)).toBe(false);
				seen.add(entry.url);
			});
		}
	});

	describe('path', () => {
		for (const entry of entries) {
			const {packages} = entry;
			if (!packages) {
				continue;
			}

			const seen = new Set();

			for (const pkg of packages) {
				it(`${entry.name}: ${pkg.path}`, () => {
					expect(seen.has(pkg.path)).toBe(false);
					seen.add(pkg.path);
				});
			}
		}
	});
});
