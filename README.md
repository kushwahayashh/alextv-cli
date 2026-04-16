# StreamFlix CLI

Single-file CLI to:
- search movies and TV/series in Showbox
- resolve the Febbox share key
- browse folders/episodes for series
- list available qualities
- print the selected proxied stream URL

## Run

```bash
node streamflix-cli.mjs
```

## Notes

- Showbox keys and Febbox cookie are hardcoded in `streamflix-cli.mjs`.
- The proxy base is hardcoded to the current Cloudflare Worker URL.
- Supports movie and series flows (series lets you drill into folders/seasons and pick an episode).
