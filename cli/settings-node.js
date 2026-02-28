/**
 * Node CLI settings for the Monochrome API.
 * Provides getInstances() without localStorage; uses env or built-in defaults.
 *
 * Same contract as js/storage.js apiSettings.getInstances(type):
 * - type 'api' → search, artist, album, playlist (fetchWithRetry default).
 * - type 'streaming' → track/stream URLs (fetchWithRetry(..., { type: 'streaming' })).
 * Default list below matches the app's fallback in storage.js when uptime fetch fails.
 */

const DEFAULT_INSTANCES = {
    api: [
        { url: 'https://eu-central.monochrome.tf', version: '2.4' },
        { url: 'https://us-west.monochrome.tf', version: '2.4' },
        { url: 'https://arran.monochrome.tf', version: '2.4' },
        { url: 'https://triton.squid.wtf', version: '2.4' },
        { url: 'https://api.monochrome.tf', version: '2.3' },
        { url: 'https://monochrome-api.samidy.com', version: '2.3' },
        { url: 'https://maus.qqdl.site', version: '2.2' },
        { url: 'https://vogel.qqdl.site', version: '2.2' },
        { url: 'https://katze.qqdl.site', version: '2.2' },
        { url: 'https://hund.qqdl.site', version: '2.2' },
        { url: 'https://tidal.kinoplus.online', version: '2.2' },
        { url: 'https://wolf.qqdl.site', version: '2.2' },
    ],
    streaming: [
        { url: 'https://arran.monochrome.tf', version: '2.4' },
        { url: 'https://triton.squid.wtf', version: '2.4' },
        { url: 'https://maus.qqdl.site', version: '2.2' },
        { url: 'https://vogel.qqdl.site', version: '2.2' },
        { url: 'https://katze.qqdl.site', version: '2.2' },
        { url: 'https://hund.qqdl.site', version: '2.2' },
        { url: 'https://wolf.qqdl.site', version: '2.2' },
    ],
};

/**
 * @param {string} [type] - 'api' or 'streaming'
 * @returns {Promise<Array<{ url: string, version?: string }>>}
 */
export async function getInstances(type = 'api') {
    const single = process.env.MONOCHROME_API_URL;
    if (single) {
        const base = single.replace(/\/$/, '');
        return [{ url: base, version: '2.4' }];
    }
    const list = DEFAULT_INSTANCES[type] || DEFAULT_INSTANCES.api;
    return [...list];
}

export const nodeApiSettings = {
    getInstances,
};
