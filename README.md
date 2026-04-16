# AlexTV CLI

A single-file Node.js CLI tool to search and stream movies & TV series from ShowBox/FebBox.

## Prerequisites

- [Node.js](https://nodejs.org/) (v18 or later recommended)
- npm (comes with Node.js)

## Installation

```bash
npm install
```

## Usage

### Interactive mode

```bash
node alextv-cli.mjs
```

### Non-interactive mode (CLI flags)

```bash
node alextv-cli.mjs --type movie --title "Inception" --pick 1 --quality 1
node alextv-cli.mjs -t series -q "Breaking Bad" -p 1 -s 1 -e 3 -k 1
node alextv-cli.mjs -t movie -q "Interstellar" --json   # JSON output for scripts/agents
```

| Flag | Short | Description |
|------|-------|-------------|
| `--type` | `-t` | `movie` or `series` |
| `--title` | `-q` | Search title |
| `--pick` | `-p` | Result number (default: 1) |
| `--season` | `-s` | Season number, series only (default: 1) |
| `--episode` | `-e` | Episode number, series only (default: 1) |
| `--quality` | `-k` | Quality option number (default: 1) |
| `--json` | `-j` | Output as JSON for programmatic use |
| `--help` | `-h` | Show help |

### Interactive step-by-step

1. **Choose mode** — Select `1` for Movie or `2` for Series.
2. **Enter a title** — Type the name of the movie or series you're looking for.
3. **Pick a result** — A numbered list of matches will appear; enter the number of your choice.
4. **Series only — Pick a season** — Browse the available seasons and enter the season number.
5. **Series only — Pick an episode** — Browse the episodes in that season and pick one.
6. **Pick quality** — Choose from the available stream qualities (e.g., 720p, 1080p).
7. **Get the URL** — The final proxied stream URL is printed to your terminal. Paste it into any video player (e.g., VLC, mpv).

### Example (Movie)

```
StreamFlix CLI
Search for (1) Movie or (2) Series? [1/2]: 1
Movie title: Inception
1. Inception (2010) [id:123]
Pick result #: 1
Share key: abc123
1. 1080p 2.1GB Fast
2. 720p 1.1GB Fast
Pick quality #: 1

Selected URL:
https://proxy.example.com/...
```

### Example (Series)

```
StreamFlix CLI
Search for (1) Movie or (2) Series? [1/2]: 2
Series title: Breaking Bad
1. Breaking Bad (2008) [id:456]
Pick result #: 1
Share key: def789
1. Season 1
2. Season 2
Pick season #: 1
1. S01E01.mp4
2. S01E02.mp4
Pick episode #: 1
1. 1080p 800MB Fast
2. 720p 400MB Fast
Pick quality #: 1

Selected URL:
https://proxy.example.com/...
```

## Notes

- ShowBox API keys and FebBox cookie are hardcoded in `alextv-cli.mjs`.
- The proxy base points to a Cloudflare Worker URL (also hardcoded).
- Supported video formats: `.mp4`, `.mkv`, `.avi`, `.m3u8`.
