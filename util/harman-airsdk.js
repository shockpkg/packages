'use strict';

const url = require('url');

const {requestPromise} = require('./request');

// The API this page loads download list from.
// https://airsdk.harman.com/download
const apiUrl = 'https://airsdk.harman.com/api/config-settings/download';

function addQueryParams(url, params) {
	return url + (url.includes('?') ? '&' : '?') +
		Object.entries(params)
			.map(a => a.map(encodeURIComponent).join('='))
			.join('&');
}

async function list() {
	const {response} = await requestPromise(apiUrl);
	const {statusCode} = response;
	if (statusCode !== 200) {
		throw new Error(`Unexpected status code: ${statusCode}`);
	}
	const data = JSON.parse(response.body);
	const cookies = response.headers['set-cookie']
		.filter(c => c.startsWith('JSESSIONID='));

	const {latestVersion, id} = data;
	const {versionName: version, links} = latestVersion;
	if (!/^\d+\.\d+\.\d+\.\d+$/.test(version)) {
		throw new Error(`Version format: ${version}`);
	}

	const downloads = [];
	for (const [name, prop] of [
		[`air-sdk-${version}-windows`, 'SDK_FLEX_WIN'],
		[`air-sdk-${version}-windows-compiler`, 'SDK_AS_WIN'],
		[`air-sdk-${version}-mac`, 'SDK_FLEX_MAC'],
		[`air-sdk-${version}-mac-compiler`, 'SDK_AS_MAC'],
		[`air-sdk-${version}-linux`, 'SDK_FLEX_LIN'],
		[`air-sdk-${version}-linux-compiler`, 'SDK_AS_LIN']
	]) {
		const link = links[prop];
		if (!link) {
			throw new Error(`Missing link: ${prop}`);
		}
		const source = addQueryParams(url.resolve(apiUrl, link), {id});
		const file = decodeURI(
			source.split(/[?#]/)[0]
				.split('/')
				.pop()
		);
		downloads.push({
			name,
			file,
			source
		});
	}

	return {
		version,
		downloads,
		cookies
	};
}
exports.list = list;

function cookies(list) {
	return list.map(c => c.split(';')[0]).join('; ');
}
exports.cookies = cookies;
