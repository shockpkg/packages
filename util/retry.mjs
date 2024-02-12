/**
 * Retry once on error.
 *
 * @param f The function to try.
 * @returns The result.
 */
// eslint-disable-next-line require-await
export async function retry(f) {
	// eslint-disable-next-line require-await
	return f().catch(async () => f());
}
