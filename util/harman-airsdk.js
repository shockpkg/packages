'use strict';

const puppeteer = require('puppeteer');

const base = 'https://airsdk.harman.com/download';

// const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function list() {
	const browser = await puppeteer.launch({
		// headless: false
	});
	const page = await browser.newPage();
	await page.goto(base);
	await page.waitForFunction(() => {
		/* eslint-disable */
		const el = document.querySelector(
			'#downloadContent [type="checkbox"]'
		);
		if (el && !el.checked) {
			el.click();
		}
		return !![...document.querySelectorAll('#downloadArea a')].filter(
			a => a.href.includes('?id=')
		).length;
		/* eslint-enable */
	});
	const info = await page.evaluate(() => {
		/* eslint-disable */
		const title = document.querySelector(
			'#downloadContent .contentTitle'
		).textContent;
		const downloads = [...document.querySelectorAll('#downloadArea a')].map(
			a => a.href
		);
		return '' + JSON.stringify({
			title,
			downloads
		});
		/* eslint-enable */
	});
	const cookies = await page.cookies(base);
	await page.close();
	await browser.close();

	const {title, downloads} = JSON.parse(info);

	// Parse out the version.
	const titleMatch = title.match(/version\s+([\d.]+)(\s|$)/i);
	if (!titleMatch) {
		throw new Error(`Failed to extract version from title: ${title}`);
	}
	const [, version] = titleMatch;

	// Parse out the downloads.
	const downloadsClean = [];
	for (const download of downloads) {
		const file = download.split('?')[0].split('#')[0].split('/').pop();
		const isMac = /macos/i.test(file);
		const isWindows = /windows/i.test(file);
		const isFlex = /flex/i.test(file);
		if (!isMac && !isWindows) {
			continue;
		}
		const name = ['air-sdk', version];
		if (isMac) {
			name.push('mac');
		}
		if (isWindows) {
			name.push('windows');
		}
		if (!isFlex) {
			name.push('compiler');
		}
		downloadsClean.push({
			name: name.join('-'),
			file,
			source: download
		});
	}
	downloadsClean.sort((a, b) => {
		a = a.name.includes('compiler') ? 1 : 0;
		b = b.name.includes('compiler') ? 1 : 0;
		return a - b;
	});
	downloadsClean.sort((a, b) => {
		a = a.name.includes('windows') ? 0 : 1;
		b = b.name.includes('windows') ? 0 : 1;
		return a - b;
	});

	// Parse out required cookies.
	const cookiesClean = cookies.filter(c => c.name === 'JSESSIONID');

	return {
		version,
		downloads: downloadsClean,
		cookies: cookiesClean
	};
}
exports.list = list;

function cookies(list) {
	return list.map(c => [
		c.name,
		c.value
	].map(encodeURIComponent).join('=')).join('; ');
}
exports.cookies = cookies;
