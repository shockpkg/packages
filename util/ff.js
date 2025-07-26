import {retry} from './util.js';

export async function getUserAgent() {
	const url = 'https://product-details.mozilla.org/1.0/firefox_versions.json';
	const [, body] = await retry(async () => {
		const response = await fetch(url);
		if (response.status !== 200) {
			throw new Error(`Status code: ${response.status}: ${url}`);
		}
		return [response, await response.json()];
	});
	const [v] = body.FIREFOX_ESR.split('.');
	return {
		headers: {
			// eslint-disable-next-line max-len
			'User-Agent': `Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:${v}.0) Gecko/20100101 Firefox/${v}.0`
		}
	};
}
