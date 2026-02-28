/**
 * Node-only helpers to download tracks to disk using the Monochrome API.
 * Supports direct stream URLs only (no DASH/blob in Node).
 * Uses same templates and M3U/M3U8/CUE/NFO/JSON options as the Monochrome app.
 */

import fs from 'fs';
import path from 'path';
import { generateM3U, generateM3U8, generateCUE, generateNFO, generateJSON } from './lib/playlist-generator.js';
import { getDownloadOptions } from './download-settings.js';

const SANITIZE_RE = /[\\/:*?"<>|\s]+/g;

function sanitizeForFilename(value) {
    if (!value) return 'Unknown';
    return String(value).replace(SANITIZE_RE, '_').replace(/_+/g, '_').trim() || 'Unknown';
}

function getTrackTitle(track, fallback = 'Unknown Title') {
    if (!track?.title) return fallback;
    return track.version ? `${track.title} (${track.version})` : track.title;
}

function getExtensionForQuality(quality) {
    return quality === 'LOW' || quality === 'HIGH' ? 'm4a' : 'flac';
}

/** Same placeholders as js/utils.js formatTemplate: trackNumber, artist, title, album, albumArtist, albumTitle, year */
function formatTemplate(template, data) {
    let result = template;
    result = result.replace(/\{trackNumber\}/g, data.trackNumber != null ? String(data.trackNumber).padStart(2, '0') : '00');
    result = result.replace(/\{artist\}/g, sanitizeForFilename(data.artist || 'Unknown Artist'));
    result = result.replace(/\{title\}/g, sanitizeForFilename(data.title || 'Unknown Title'));
    result = result.replace(/\{album\}/g, sanitizeForFilename(data.album || 'Unknown Album'));
    result = result.replace(/\{albumArtist\}/g, sanitizeForFilename(data.albumArtist || 'Unknown Artist'));
    result = result.replace(/\{albumTitle\}/g, sanitizeForFilename(data.albumTitle || 'Unknown Album'));
    result = result.replace(/\{year\}/g, data.year != null && data.year !== '' ? String(data.year) : '');
    return result;
}

/**
 * Build a safe filename for a track using the app's filename template.
 * @param {object} options - From getDownloadOptions(); uses filenameTemplate.
 */
export function buildTrackFilename(track, quality, extension = null, options = null) {
    const opts = options || getDownloadOptions();
    const ext = extension || getExtensionForQuality(quality);
    const artistName = track.artist?.name || track.artists?.[0]?.name || 'Unknown Artist';
    const data = {
        trackNumber: track.trackNumber,
        artist: artistName,
        title: getTrackTitle(track),
        album: track.album?.title,
    };
    return formatTemplate(opts.filenameTemplate, data) + '.' + ext;
}

/**
 * Download one track to a file. Uses getStreamUrl; only works when the API
 * returns an http(s) URL (not a DASH blob). Quality LOSSLESS often gives direct URLs.
 *
 * @param {object} api - LosslessAPI instance
 * @param {object} track - Track object (id, trackNumber, title, artist, etc.)
 * @param {string} outputPath - Full path to the output file (directory must exist)
 * @param {string} [quality='LOSSLESS']
 * @param {(msg: string) => void} [onProgress]
 * @returns {Promise<string>} - Resolved with output path on success
 */
export async function downloadTrackToFile(api, track, outputPath, quality = 'LOSSLESS', onProgress = () => {}) {
    const streamUrl = await api.getStreamUrl(track.id, quality);
    if (!streamUrl || typeof streamUrl !== 'string') {
        throw new Error('Could not get stream URL');
    }
    if (streamUrl.startsWith('blob:')) {
        throw new Error('DASH streams (blob:) are not supported in CLI. Use quality LOSSLESS or try another release.');
    }

    const res = await fetch(streamUrl, { cache: 'no-store' });
    if (!res.ok) {
        throw new Error(`Download failed: ${res.status}`);
    }

    const total = res.headers.get('Content-Length');
    const totalBytes = total ? parseInt(total, 10) : 0;
    let received = 0;

    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }

    const file = fs.createWriteStream(outputPath);
    const reader = res.body;
    if (!reader) throw new Error('No response body');

    for await (const chunk of reader) {
        file.write(chunk);
        received += chunk.length;
        if (onProgress && totalBytes) onProgress(`Downloading ${received}/${totalBytes}`);
    }
    file.end();

    return new Promise((resolve, reject) => {
        file.on('finish', () => resolve(outputPath));
        file.on('error', reject);
    });
}

/**
 * Download all tracks of an album to a directory.
 * Creates: baseDir/Artist Name/<zipFolderTemplate>/
 * Writes M3U, M3U8, CUE, NFO, JSON when enabled in options (same as app settings).
 *
 * @param {object} api - LosslessAPI instance
 * @param {object} album - Album object (id, title, artist, releaseDate)
 * @param {object[]} tracks - Array of track objects
 * @param {string} baseDir - Parent directory (e.g. ./downloads)
 * @param {string} [quality='LOSSLESS']
 * @param {(current: number, total: number, track: object) => void} [onProgress]
 * @param {number} [delayBetweenTracksMs=0] - Delay in ms between each track (helps avoid rate limits).
 * @param {object} [options] - From getDownloadOptions() (templates + M3U/CUE/NFO/JSON flags).
 */
export async function downloadAlbumToDir(api, album, tracks, baseDir, quality = 'LOSSLESS', onProgress = () => {}, delayBetweenTracksMs = 0, options = null) {
    const opts = options || getDownloadOptions();
    const artistName = album.artist?.name || album.artists?.[0]?.name || 'Unknown Artist';
    const artistFolder = sanitizeForFilename(artistName);
    const releaseDateStr = album.releaseDate || (tracks[0]?.streamStartDate ? tracks[0].streamStartDate.split('T')[0] : '');
    const year = releaseDateStr ? new Date(releaseDateStr).getFullYear() : '';
    const folderName = formatTemplate(opts.zipFolderTemplate, {
        albumTitle: album.title,
        albumArtist: artistName,
        year,
    }).trim() || sanitizeForFilename(album.title);
    const albumDir = path.join(baseDir, artistFolder, folderName);

    const sleep = (ms) => (ms > 0 ? new Promise((r) => setTimeout(r, ms)) : Promise.resolve());
    const audioExtension = getExtensionForQuality(quality);

    for (let i = 0; i < tracks.length; i++) {
        if (i > 0 && delayBetweenTracksMs > 0) {
            await sleep(delayBetweenTracksMs);
        }
        const track = tracks[i];
        const filename = buildTrackFilename(track, quality, null, opts);
        const filePath = path.join(albumDir, filename);
        await downloadTrackToFile(api, track, filePath, quality);
        if (onProgress) onProgress(i + 1, tracks.length, track);
    }

    // Generate M3U, M3U8, CUE, NFO, JSON (same as app when enabled)
    const pathResolver = (track, _filename, index) => buildTrackFilename(track, quality, null, opts);
    const albumForPlaylist = { ...album, artist: album.artist?.name || artistName };

    if (opts.generateM3U) {
        const m3uContent = generateM3U(albumForPlaylist, tracks, opts.useRelativePaths, pathResolver, audioExtension);
        fs.writeFileSync(path.join(albumDir, `${sanitizeForFilename(album.title)}.m3u`), m3uContent, 'utf8');
    }
    if (opts.generateM3U8) {
        const m3u8Content = generateM3U8(albumForPlaylist, tracks, opts.useRelativePaths, pathResolver, audioExtension);
        fs.writeFileSync(path.join(albumDir, `${sanitizeForFilename(album.title)}.m3u8`), m3u8Content, 'utf8');
    }
    if (opts.generateCUE && tracks.length > 0) {
        const firstTrackFilename = buildTrackFilename(tracks[0], quality, null, opts);
        const cueContent = generateCUE(album, tracks, firstTrackFilename);
        fs.writeFileSync(path.join(albumDir, `${sanitizeForFilename(album.title)}.cue`), cueContent, 'utf8');
    }
    if (opts.generateNFO) {
        const nfoContent = generateNFO(album, tracks, 'album');
        fs.writeFileSync(path.join(albumDir, `${sanitizeForFilename(album.title)}.nfo`), nfoContent, 'utf8');
    }
    if (opts.generateJSON) {
        const jsonContent = generateJSON(album, tracks, 'album');
        fs.writeFileSync(path.join(albumDir, `${sanitizeForFilename(album.title)}.json`), jsonContent, 'utf8');
    }

    return albumDir;
}
