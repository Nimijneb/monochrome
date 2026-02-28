/**
 * CLI download options that mirror the Monochrome app settings (Settings → Download).
 * Read from env; defaults match the app (filename template, zip folder template, M3U/M3U8/CUE/NFO/JSON on).
 *
 * Env vars (all optional):
 *   MONOCHROME_FILENAME_TEMPLATE   default: {trackNumber} - {artist} - {title}
 *   MONOCHROME_ZIP_FOLDER_TEMPLATE default: {albumTitle} - {albumArtist}
 *   MONOCHROME_M3U                 default: true
 *   MONOCHROME_M3U8                default: true
 *   MONOCHROME_CUE                 default: true
 *   MONOCHROME_NFO                 default: true
 *   MONOCHROME_JSON                default: true
 *   MONOCHROME_RELATIVE_PATHS      default: true
 *   MONOCHROME_DOWNLOAD_LYRICS     default: true (CLI: not implemented yet, option reserved)
 *   MONOCHROME_ROMAJI_LYRICS       default: true (CLI: not implemented yet)
 */

function envBool(key, defaultValue = true) {
    const v = process.env[key];
    if (v === undefined || v === '') return defaultValue;
    return v === '1' || v.toLowerCase() === 'true' || v.toLowerCase() === 'yes';
}

function envStr(key, defaultValue) {
    const v = process.env[key];
    if (v === undefined || v === '') return defaultValue;
    return v;
}

/**
 * @returns {{
 *   filenameTemplate: string,
 *   zipFolderTemplate: string,
 *   generateM3U: boolean,
 *   generateM3U8: boolean,
 *   generateCUE: boolean,
 *   generateNFO: boolean,
 *   generateJSON: boolean,
 *   useRelativePaths: boolean,
 *   downloadLyrics: boolean,
 *   romajiLyrics: boolean,
 * }}
 */
export function getDownloadOptions() {
    return {
        filenameTemplate: envStr(
            'MONOCHROME_FILENAME_TEMPLATE',
            '{trackNumber} - {artist} - {title}'
        ),
        zipFolderTemplate: envStr(
            'MONOCHROME_ZIP_FOLDER_TEMPLATE',
            '{albumTitle} - {albumArtist}'
        ),
        generateM3U: envBool('MONOCHROME_M3U', true),
        generateM3U8: envBool('MONOCHROME_M3U8', true),
        generateCUE: envBool('MONOCHROME_CUE', true),
        generateNFO: envBool('MONOCHROME_NFO', true),
        generateJSON: envBool('MONOCHROME_JSON', true),
        useRelativePaths: envBool('MONOCHROME_RELATIVE_PATHS', true),
        downloadLyrics: envBool('MONOCHROME_DOWNLOAD_LYRICS', true),
        romajiLyrics: envBool('MONOCHROME_ROMAJI_LYRICS', true),
    };
}
