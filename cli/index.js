#!/usr/bin/env node
/**
 * Monochrome CLI: search for an artist, list albums/EPs/singles, then download by number.
 * Uses the same API as the Monochrome web app.
 *
 * Usage:
 *   node cli/index.js [artist name]
 *   node cli/index.js search "Artist Name"
 *
 * Then follow prompts: pick artist (if multiple), then choose download (all, or 1,3,5 or 1-4).
 */

// Must mock before importing any monochrome js (storage uses localStorage)
if (typeof globalThis.localStorage === 'undefined') {
    globalThis.localStorage = {
        getItem: () => null,
        setItem: () => {},
        removeItem: () => {},
    };
}

// Transient status line: API retry messages overwrite this line so they don't pile up in history.
const STATUS_LINE_WIDTH = 100;
const TRANSIENT_WARN_PATTERN = /Server error|Network error|Rate limit|Auth failed|Trying next instance/;
const originalConsoleWarn = console.warn;
console.warn = (...args) => {
    const msg = args.map((a) => (typeof a === 'string' ? a : String(a))).join(' ');
    if (TRANSIENT_WARN_PATTERN.test(msg)) {
        const line = msg.slice(0, STATUS_LINE_WIDTH).padEnd(STATUS_LINE_WIDTH);
        process.stderr.write(`\r${line}\r`);
    } else {
        originalConsoleWarn.apply(console, args);
    }
};

function clearStatusLine() {
    process.stderr.write(`\r${' '.repeat(STATUS_LINE_WIDTH)}\r`);
}

import readline from 'readline';
import path from 'path';
import fs from 'fs';
import { LosslessAPI } from './lib/api.js';
import { nodeApiSettings } from './settings-node.js';
import { downloadAlbumToDir, buildTrackFilename } from './download-node.js';
import { getDownloadOptions } from './download-settings.js';

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

function ask(question) {
    return new Promise((resolve) => {
        rl.question(question, (answer) => resolve((answer || '').trim()));
    });
}

function parseSelection(input, maxN) {
    const s = (input || '').trim().toLowerCase();
    if (s === 'all' || s === 'a') {
        return Array.from({ length: maxN }, (_, i) => i + 1);
    }
    const out = new Set();
    for (const part of s.split(/[\s,]+/)) {
        if (!part) continue;
        const dash = part.indexOf('-');
        if (dash !== -1) {
            const a = parseInt(part.slice(0, dash), 10);
            const b = parseInt(part.slice(dash + 1), 10);
            if (Number.isFinite(a) && Number.isFinite(b)) {
                const lo = Math.min(a, b);
                const hi = Math.max(a, b);
                for (let i = lo; i <= hi; i++) if (i >= 1 && i <= maxN) out.add(i);
            }
        } else {
            const n = parseInt(part, 10);
            if (Number.isFinite(n) && n >= 1 && n <= maxN) out.add(n);
        }
    }
    return [...out].sort((a, b) => a - b);
}

function releaseTypeLabel(release) {
    const t = (release.type || '').toUpperCase();
    if (t === 'SINGLE') return 'Single';
    if (t === 'EP') return 'EP';
    return 'Album';
}

async function main() {
    let artistQuery = process.argv.slice(2).join(' ').trim();
    if (process.argv[2] === 'search' && process.argv[3] !== undefined) {
        artistQuery = process.argv.slice(3).join(' ').trim();
    }

    const api = new LosslessAPI(nodeApiSettings);

    if (!artistQuery) {
        artistQuery = await ask('Artist name? ');
        if (!artistQuery) {
            console.log('No artist name given. Exiting.');
            rl.close();
            process.exit(0);
        }
    }

    console.log(`Searching for "${artistQuery}"...`);
    let searchResult;
    try {
        searchResult = await api.searchArtists(artistQuery);
    } catch (e) {
        console.error('Search failed:', e.message);
        rl.close();
        process.exit(1);
    }

    const artists = searchResult?.items || [];
    if (artists.length === 0) {
        console.log('No artists found.');
        rl.close();
        process.exit(0);
    }

    let artist = artists[0];
    if (artists.length > 1) {
        console.log('\nArtists found:');
        artists.forEach((a, i) => console.log(`  ${i + 1}. ${a.name}`));
        if (process.stdin.isTTY) {
            const pick = await ask(`Pick artist (1-${artists.length}) [1]: `);
            const idx = pick ? parseInt(pick, 10) : 1;
            if (Number.isFinite(idx) && idx >= 1 && idx <= artists.length) {
                artist = artists[idx - 1];
            }
        } else {
            artist = artists[0];
        }
    }

    console.log(`\nFetching releases for ${artist.name}...`);
    let artistData;
    try {
        artistData = await api.getArtist(artist.id);
    } catch (e) {
        console.error('Failed to load artist:', e.message);
        rl.close();
        process.exit(1);
    }

    const albums = artistData.albums || [];
    const eps = artistData.eps || [];
    const allReleases = [...albums, ...eps].filter(Boolean);
    if (allReleases.length === 0) {
        console.log('No albums or EPs found for this artist.');
        rl.close();
        process.exit(0);
    }

    console.log('\nReleases (Albums, EPs, Singles):');
    allReleases.forEach((r, i) => {
        const type = releaseTypeLabel(r);
        const year = r.releaseDate ? new Date(r.releaseDate).getFullYear() : '';
        const yearStr = year ? ` (${year})` : '';
        console.log(`  ${i + 1}. [${type}] ${r.title}${yearStr}`);
    });

    if (!process.stdin.isTTY) {
        console.log('\nSkipping download (non-interactive).');
        rl.close();
        process.exit(0);
    }

    const downloadChoice = await ask('\nDownload: all, or numbers e.g. 1,3,5 or 1-4 [skip]: ');
    if (!downloadChoice || downloadChoice.toLowerCase() === 'skip') {
        console.log('Skipping download.');
        rl.close();
        process.exit(0);
    }

    const indices = parseSelection(downloadChoice, allReleases.length);
    if (indices.length === 0) {
        console.log('No valid selection.');
        rl.close();
        process.exit(0);
    }

    const outputDir = process.env.MONOCHROME_DOWNLOAD_DIR || path.join(process.cwd(), 'downloads');
    const quality = process.env.MONOCHROME_QUALITY || 'LOSSLESS';
    const delayBetweenAlbumsMs = parseInt(process.env.MONOCHROME_DELAY_MS || '0', 10) || 0;
    const delayBetweenTracksMs = parseInt(process.env.MONOCHROME_TRACK_DELAY_MS || '0', 10) || 0;
    const downloadOptions = getDownloadOptions();

    const sleep = (ms) => (ms > 0 ? new Promise((r) => setTimeout(r, ms)) : Promise.resolve());

    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }
    console.log(`\nSaving to ${outputDir} (quality: ${quality})\n`);

    for (const idx of indices) {
        if (idx > 1 && delayBetweenAlbumsMs > 0) {
            await sleep(delayBetweenAlbumsMs);
        }
        const release = allReleases[idx - 1];
        clearStatusLine();
        console.log(`[${idx}/${indices.length}] ${release.title}...`);
        try {
            const { album, tracks } = await api.getAlbum(release.id);
            if (!tracks || tracks.length === 0) {
                clearStatusLine();
                console.log('  No tracks, skipping.');
                continue;
            }
            await downloadAlbumToDir(
                api,
                album,
                tracks,
                outputDir,
                quality,
                (current, total, track) => {
                    clearStatusLine();
                    console.log(`    ${current}/${total} ${buildTrackFilename(track, quality, null, downloadOptions)}`);
                },
                delayBetweenTracksMs,
                downloadOptions
            );
            clearStatusLine();
            console.log(`  Done: ${album.title}`);
        } catch (e) {
            clearStatusLine();
            console.error(`  Error: ${e.message}`);
        }
    }

    clearStatusLine();
    console.log('\nFinished.');
    rl.close();
    process.exit(0);
}

main().catch((err) => {
    console.error(err);
    rl.close();
    process.exit(1);
});
