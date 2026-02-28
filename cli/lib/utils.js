/**
 * Minimal utils for CLI lib (api + playlist-generator). No storage/UI deps.
 */

export const RATE_LIMIT_ERROR_MESSAGE = 'Too Many Requests. Please wait a moment and try again.';

export const QUALITY_PRIORITY = ['HI_RES_LOSSLESS', 'LOSSLESS', 'HIGH', 'LOW'];

export const QUALITY_TOKENS = {
    HI_RES_LOSSLESS: ['HI_RES_LOSSLESS', 'HIRES_LOSSLESS', 'HIRESLOSSLESS', 'HIFI_PLUS', 'HI_RES_FLAC', 'HI_RES', 'HIRES', 'MASTER', 'MASTER_QUALITY', 'MQA'],
    LOSSLESS: ['LOSSLESS', 'HIFI'],
    HIGH: ['HIGH', 'HIGH_QUALITY'],
    LOW: ['LOW', 'LOW_QUALITY'],
};

export const sanitizeForFilename = (value) => {
    if (!value) return 'Unknown';
    return String(value)
        .replace(/[\\/:*?"<>|]/g, '_')
        .replace(/\s+/g, ' ')
        .trim() || 'Unknown';
};

export const getExtensionFromBlob = async (blob) => {
    const buffer = await blob.slice(0, 12).arrayBuffer();
    const view = new DataView(buffer);
    if (view.byteLength >= 4 && view.getUint8(0) === 0x66 && view.getUint8(1) === 0x4c && view.getUint8(2) === 0x61 && view.getUint8(3) === 0x43) {
        return 'flac';
    }
    if (view.byteLength >= 8 && view.getUint8(4) === 0x66 && view.getUint8(5) === 0x74 && view.getUint8(6) === 0x79 && view.getUint8(7) === 0x70) {
        return 'm4a';
    }
    const mime = blob.type;
    if (mime === 'audio/flac') return 'flac';
    if (mime === 'audio/mp4' || mime === 'audio/x-m4a') return 'm4a';
    return 'flac';
};

const sanitizeToken = (value) => {
    if (!value) return '';
    return String(value).trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_');
};

export const normalizeQualityToken = (value) => {
    if (!value) return null;
    const token = sanitizeToken(value);
    for (const [quality, aliases] of Object.entries(QUALITY_TOKENS)) {
        if (aliases.includes(token)) return quality;
    }
    return null;
};

export const deriveQualityFromTags = (rawTags) => {
    if (!Array.isArray(rawTags)) return null;
    const candidates = [];
    for (const tag of rawTags) {
        if (typeof tag !== 'string') continue;
        const normalized = normalizeQualityToken(tag);
        if (normalized && !candidates.includes(normalized)) candidates.push(normalized);
    }
    return pickBestQuality(candidates);
};

export const pickBestQuality = (candidates) => {
    let best = null;
    let bestRank = Infinity;
    for (const candidate of candidates) {
        if (!candidate) continue;
        const rank = QUALITY_PRIORITY.indexOf(candidate);
        const currentRank = rank === -1 ? Infinity : rank;
        if (currentRank < bestRank) {
            best = candidate;
            bestRank = currentRank;
        }
    }
    return best;
};

export const deriveTrackQuality = (track) => {
    if (!track) return null;
    const candidates = [
        deriveQualityFromTags(track.mediaMetadata?.tags),
        deriveQualityFromTags(track.album?.mediaMetadata?.tags),
        normalizeQualityToken(track.audioQuality),
    ];
    return pickBestQuality(candidates);
};

export const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const isTrackUnavailable = (track) => {
    if (!track) return true;
    if (track.isLocal) return false;
    return track.allowStreaming === false || track.streamReady === false || track.title === 'Unavailable';
};

export const getTrackTitle = (track, { fallback = 'Unknown Title' } = {}) => {
    if (!track?.title) return fallback;
    return track.version ? `${track.title} (${track.version})` : track.title;
};

export const getTrackArtists = (track = {}, { fallback = 'Unknown Artist' } = {}) => {
    if (track?.artists?.length) {
        return track.artists.map((a) => a?.name).join(', ');
    }
    return fallback;
};

export const formatTemplate = (template, data) => {
    let result = template;
    result = result.replace(/\{trackNumber\}/g, data.trackNumber != null ? String(data.trackNumber).padStart(2, '0') : '00');
    result = result.replace(/\{artist\}/g, sanitizeForFilename(data.artist || 'Unknown Artist'));
    result = result.replace(/\{title\}/g, sanitizeForFilename(data.title || 'Unknown Title'));
    result = result.replace(/\{album\}/g, sanitizeForFilename(data.album || 'Unknown Album'));
    result = result.replace(/\{albumArtist\}/g, sanitizeForFilename(data.albumArtist || 'Unknown Artist'));
    result = result.replace(/\{albumTitle\}/g, sanitizeForFilename(data.albumTitle || 'Unknown Album'));
    result = result.replace(/\{year\}/g, data.year != null && data.year !== '' ? String(data.year) : 'Unknown');
    return result;
};
