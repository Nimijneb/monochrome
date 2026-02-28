# Monochrome CLI

Command-line app for searching artists and downloading albums (same API as the Monochrome web app). The **`cli/` folder is standalone**: no need for the rest of the monochrome repo.

**Folder structure** (everything you need is inside `cli/`):

- `index.js` – entry point
- `download-node.js`, `download-settings.js`, `settings-node.js` – download and API config
- `lib/` – API client, cache, playlist generators, and stubs (no dependency on parent app)
- `package.json` – optional (`npm run start` when run from inside `cli/`)

## Flow

1. **Search** – You provide an artist name (as an argument or when prompted).
2. **List** – The CLI fetches that artist and prints a numbered list of all releases (albums, EPs, singles).
3. **Download** – You choose what to download:
   - `all` – every release in the list
   - Numbers: `1,3,5` or `1-4` (ranges supported)

Files are saved under `./downloads` (or `MONOCHROME_DOWNLOAD_DIR`) in an **artist → album** structure: `Artist Name/Album Title - Artist Name/`, with tracks named `01 - Artist - Title.flac`.

## Usage

**From the monochrome repo root** (if you have the full repo):

```bash
npm run cli
# or
node cli/index.js "Artist Name"
```

**From inside the `cli/` folder:**

```bash
node index.js
# or
node index.js "Artist Name"
```

When asked **Download:** you can enter:

- `all` (or `a`) – download every listed release
- `1,3,5` – download releases 1, 3, and 5
- `1-4` – download releases 1 through 4
- `skip` or leave empty – don’t download anything

## Environment

| Variable | Description |
|----------|-------------|
| `MONOCHROME_API_URL` | Single API base URL (e.g. `https://api.monochrome.tf`). If set, this is used for both API and streaming. |
| `MONOCHROME_DOWNLOAD_DIR` | Directory for downloads (default: `./downloads`). |
| `MONOCHROME_QUALITY` | Stream quality: `LOSSLESS`, `HI_RES_LOSSLESS`, `HIGH`, `LOW` (default: `LOSSLESS`). |
| `MONOCHROME_DELAY_MS` | Delay in ms **between albums** (default: 0). Use e.g. `2000` to throttle and reduce rate limits. |
| `MONOCHROME_TRACK_DELAY_MS` | Delay in ms **between tracks** within an album (default: 0). Use e.g. `500` if you still hit limits. |

**Download settings** (same as the app’s Settings → Download; all optional):

| Variable | Description | Default (matches app) |
|----------|-------------|------------------------|
| `MONOCHROME_FILENAME_TEMPLATE` | Track filename. Placeholders: `{trackNumber}`, `{artist}`, `{title}`, `{album}` | `{trackNumber} - {artist} - {title}` |
| `MONOCHROME_ZIP_FOLDER_TEMPLATE` | Album folder name. Placeholders: `{albumTitle}`, `{albumArtist}`, `{year}` | `{albumTitle} - {albumArtist}` |
| `MONOCHROME_M3U` | Include .m3u playlist files | `true` |
| `MONOCHROME_M3U8` | Include .m3u8 playlist files | `true` |
| `MONOCHROME_CUE` | Include .cue sheets | `true` |
| `MONOCHROME_NFO` | Include .nfo for media centers | `true` |
| `MONOCHROME_JSON` | Include .json metadata | `true` |
| `MONOCHROME_RELATIVE_PATHS` | Use relative paths in playlists | `true` |
| `MONOCHROME_DOWNLOAD_LYRICS` | Include .lrc lyrics (CLI: not implemented yet) | `true` |
| `MONOCHROME_ROMAJI_LYRICS` | Romaji for Japanese lyrics (CLI: not implemented yet) | `true` |

## Requirements

- **Node 18+** (for `fetch` and ES modules).
- Download uses direct stream URLs only. If the API returns a DASH (blob) URL, the CLI will report that and skip that track; using quality `LOSSLESS` often yields direct URLs.

## Example

```text
$ npm run cli "Radiohead"

Searching for "Radiohead"...

Fetching releases for Radiohead...

Releases (Albums, EPs, Singles):
  1. [Album] The Bends (1995)
  2. [Album] OK Computer (1997)
  3. [Album] Kid A (2000)
  ...

Download: all, or numbers e.g. 1,3,5 or 1-4 [skip]: 1-3

Saving to ./downloads (quality: LOSSLESS). Albums go under Artist Name/Album Title - Artist Name/
...
```
