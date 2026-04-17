#!/usr/bin/env node
import CryptoJS from 'crypto-js';
import { customAlphabet } from 'nanoid';
import fetch from 'node-fetch';
import { load as cheerioLoad } from 'cheerio';
import { readFileSync } from 'node:fs';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { parseArgs } from 'node:util';

const SHOWBOX = {
  baseUrl: 'https://mbpapi.shegu.net/api/api_client/index/',
  appKey: 'moviebox',
  iv: 'wEiphTn!',
  key: '123d6cedf626dy54233aa1w6',
  defaults: {
    childmode: '0',
    app_version: '11.5',
    appid: '27',
    lang: 'en',
    platform: 'android',
    channel: 'Website',
    version: '129',
    medium: 'Website',
  },
};

const FEBBOX = {
  baseUrl: 'https://www.febbox.com',
  cookie:
    'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpYXQiOjE3NjQ1MTY4NDMsIm5iZiI6MTc2NDUxNjg0MywiZXhwIjoxNzk1NjIwODYzLCJkYXRhIjp7InVpZCI6NzI0NzgyLCJ0b2tlbiI6IjI5OTUxZGJjNWFmMTU3YjgxZThmZDJmNjdhMmExOGQxIn19.ng_N3QTSTcGXFJnY6IWptmi3JMULvuOlWe9zB8G-5xQ',
  proxyBase: 'https://lunaissohot.lunastar0003.workers.dev/?destination=',
};

const nanoid = customAlphabet('1234567890abcdef', 32);
const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url)));

const FETCH_TIMEOUT = 15_000;
const RETRY_COUNT = 3;
const RETRY_DELAY = 1_000;
const GO_BACK = Symbol('GO_BACK');

const { values: args } = parseArgs({
  options: {
    type:    { type: 'string', short: 't' },
    title:   { type: 'string', short: 'q' },
    pick:    { type: 'string', short: 'p' },
    season:  { type: 'string', short: 's' },
    episode: { type: 'string', short: 'e' },
    quality: { type: 'string', short: 'k' },
    json:    { type: 'boolean', short: 'j', default: false },
    version: { type: 'boolean', short: 'v', default: false },
    help:    { type: 'boolean', short: 'h', default: false },
  },
  strict: false,
});

if (args.version) {
  console.log(`alextv-cli v${pkg.version}`);
  process.exit(0);
}

if (args.help) {
  console.log(`AlexTV CLI

Usage: node alextv-cli.mjs [options]

Options:
  -t, --type <movie|series>  Content type (default: interactive)
  -q, --title <string>       Search title
  -p, --pick <number>        Result number to pick
  -s, --season <number>      Season number (series only)
  -e, --episode <number>     Episode number (series only)
  -k, --quality <number>     Quality option number
  -j, --json                 Output result as JSON (for programmatic use)
  -v, --version              Show version
  -h, --help                 Show this help message

Examples:
  node alextv-cli.mjs --type movie --title "Inception" --pick 1 --quality 1
  node alextv-cli.mjs -t series -q "Breaking Bad" -p 1 -s 1 -e 3 -k 1 --json
  node alextv-cli.mjs  (interactive mode)`);
  process.exit(0);
}

const interactive = !args.title;
const rl = interactive ? readline.createInterface({ input, output }) : null;

async function ask(prompt, argValue) {
  if (argValue !== undefined) return argValue;
  if (!rl) throw new Error(`Missing required argument for non-interactive mode: ${prompt.trim()}`);
  return rl.question(prompt);
}

function parseChoice(raw, max, label) {
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1 || n > max) {
    throw new Error(`Invalid ${label} choice: "${raw}". Enter a number between 1 and ${max}.`);
  }
  return n - 1;
}

async function fetchWithTimeout(url, options = {}, timeout = FETCH_TIMEOUT) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function retryFetch(url, options = {}, retries = RETRY_COUNT) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fetchWithTimeout(url, options);
    } catch (err) {
      if (attempt === retries) throw err;
      const delay = RETRY_DELAY * attempt;
      console.error(`Request failed (attempt ${attempt}/${retries}), retrying in ${delay}ms… ${err.message}`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
}

function loadingStart(msg) {
  if (!interactive) return { stop: () => {} };
  const frames = ['⠋','⠙','⠹','⠸','⠼','⠴','⠦','⠧','⠇','⠏'];
  let i = 0;
  const interval = setInterval(() => {
    process.stdout.write(`\r${frames[i = (i + 1) % frames.length]} ${msg}`);
  }, 80);
  return {
    stop: () => {
      clearInterval(interval);
      process.stdout.write('\r' + ' '.repeat(msg.length + 4) + '\r');
    },
  };
}

async function askPick(prompt, max, label, argValue) {
  if (argValue !== undefined) return parseChoice(argValue, max, label);
  if (!rl) throw new Error(`Missing required argument for non-interactive mode: ${prompt.trim()}`);
  while (true) {
    const raw = (await rl.question(prompt)).trim();
    if (raw.toLowerCase() === 'b') return GO_BACK;
    try {
      return parseChoice(raw, max, label);
    } catch (err) {
      console.error(err.message);
    }
  }
}

function encrypt(data) {
  return CryptoJS.TripleDES.encrypt(
    data,
    CryptoJS.enc.Utf8.parse(SHOWBOX.key),
    { iv: CryptoJS.enc.Utf8.parse(SHOWBOX.iv) }
  ).toString();
}

function verify(encryptedData) {
  return CryptoJS.MD5(CryptoJS.MD5(SHOWBOX.appKey).toString() + SHOWBOX.key + encryptedData).toString();
}

function expiry() {
  return Math.floor(Date.now() / 1000 + 60 * 60 * 12).toString();
}

async function showboxRequest(module, params = {}) {
  const requestData = { ...SHOWBOX.defaults, expired_date: expiry(), module, ...params };
  const encryptedData = encrypt(JSON.stringify(requestData));
  const body = JSON.stringify({
    app_key: CryptoJS.MD5(SHOWBOX.appKey).toString(),
    verify: verify(encryptedData),
    encrypt_data: encryptedData,
  });

  const formData = new URLSearchParams({
    data: Buffer.from(body).toString('base64'),
    appid: SHOWBOX.defaults.appid,
    platform: SHOWBOX.defaults.platform,
    version: SHOWBOX.defaults.version,
    medium: SHOWBOX.defaults.medium,
    token: nanoid(32),
  });

  const response = await retryFetch(SHOWBOX.baseUrl, {
    method: 'POST',
    headers: {
      Platform: SHOWBOX.defaults.platform,
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'okhttp/3.2.0',
    },
    body: formData.toString(),
  });

  return response.json();
}

async function search(title, type = 'movie') {
  const spinner = loadingStart('Searching');
  try {
    const data = await showboxRequest('Search5', { type, keyword: title, page: '1', pagelimit: '10' });
    return data.data || [];
  } finally {
    spinner.stop();
  }
}

async function getShareKey(id, type = 1) {
  const shareLinkUrl = `https://www.showbox.media/index/share_link?id=${id}&type=${type}`;
  const proxyUrl = `https://lunaissohot.lunastar0003.workers.dev/?destination=${encodeURIComponent(shareLinkUrl)}`;
  const spinner = loadingStart('Fetching share key');
  try {
    const response = await retryFetch(proxyUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });
    const text = await response.text();
    if (!text.trim().startsWith('{')) {
      console.error(`getShareKey: non-JSON response (status ${response.status}), first 120 chars: ${text.slice(0, 120)}`);
      return null;
    }
    const data = JSON.parse(text);
    const link = data?.data?.link || '';
    if (!link) console.error(`getShareKey: no link in response, keys: ${Object.keys(data?.data || {}).join(', ')}`);
    return link ? link.split('/').pop() : null;
  } finally {
    spinner.stop();
  }
}

async function febboxJson(url) {
  const res = await retryFetch(url, {
    headers: {
      cookie: `ui=${FEBBOX.cookie}`,
      referer: FEBBOX.baseUrl,
      'x-requested-with': 'XMLHttpRequest',
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    },
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

async function getFiles(shareKey, parentId = 0) {
  const spinner = loadingStart('Loading files');
  try {
    const url = `${FEBBOX.baseUrl}/file/file_share_list?share_key=${shareKey}&pwd=&parent_id=${parentId}&is_html=0`;
    const data = await febboxJson(url);
    return data.data?.file_list || [];
  } finally {
    spinner.stop();
  }
}

async function getLinks(fid) {
  const spinner = loadingStart('Fetching quality links');
  try {
    const url = `${FEBBOX.baseUrl}/console/video_quality_list?fid=${fid}`;
    const data = await febboxJson(url);
    const html = data.html || '';
    const $ = cheerioLoad(html);
    const links = [];
    $('.file_quality').each((_, el) => {
      const $el = $(el);
      const url = $el.attr('data-url');
      const ext = (url?.match(/\.(mp4|mkv|avi|m3u8)/i)?.[1] || 'm3u8').toLowerCase();
      links.push({
        url,
        quality: $el.attr('data-quality'),
        speed: $el.find('.speed span').text().trim(),
        size: $el.find('.size').text().trim(),
        ext,
      });
    });
    return links;
  } finally {
    spinner.stop();
  }
}

function proxyUrl(url) {
  return `${FEBBOX.proxyBase}${encodeURIComponent(url)}`;
}

function videoFiles(files) {
  return files.filter((f) => f.is_dir === 0 && /\.(mp4|mkv|avi|m3u8)$/i.test(f.file_name));
}

async function main() {
  console.log('AlexTV CLI');
  if (interactive) console.log("Type 'b' at any pick prompt to go back to search.\n");

  try {
    const typeMap = { movie: '1', series: '2', tv: '2' };
    const modeArg = args.type ? (typeMap[args.type.toLowerCase()] || args.type) : undefined;
    const modeInput = (await ask('Search for (1) Movie or (2) Series? [1/2]: ', modeArg)).trim();
    if (!['1', '2'].includes(modeInput)) {
      throw new Error(`Invalid type choice: "${modeInput}". Enter 1 for Movie or 2 for Series.`);
    }
    const isSeries = modeInput === '2';
    const searchType = isSeries ? 'tv' : 'movie';

    search: while (true) {
      const title = await ask(`${isSeries ? 'Series' : 'Movie'} title: `, args.title);
      const results = await search(title.trim(), searchType);

      if (!results.length) {
        console.log('No results found.');
        if (interactive) { continue search; }
        return;
      }

      results.forEach((item, i) => console.log(`${i + 1}. ${item.title} (${item.year || 'n/a'}) [id:${item.id}]`));
      const choiceIndex = await askPick('Pick result #: ', results.length, 'result', args.pick);
      if (choiceIndex === GO_BACK) { continue search; }
      const picked = results[choiceIndex];
      const shareKey = await getShareKey(picked.id, isSeries ? 2 : 1);

      if (!shareKey) {
        console.log('No share key found.');
        if (interactive) { continue search; }
        return;
      }

      console.log(`Share key: ${shareKey}`);
      let files = await getFiles(shareKey, 0);
      let target;

      if (isSeries) {
        const seasons = files.filter((f) => f.is_dir === 1);
        if (!seasons.length) {
          console.log('No seasons found.');
          if (interactive) { continue search; }
          return;
        }

        let season, episodes;
        seasonPick: while (true) {
          seasons.forEach((s, i) => console.log(`${i + 1}. ${s.file_name}`));
          const seasonIndex = await askPick('Pick season #: ', seasons.length, 'season', args.season);
          if (seasonIndex === GO_BACK) { continue search; }
          season = seasons[seasonIndex];

          files = await getFiles(shareKey, season.fid);
          episodes = videoFiles(files);
          if (!episodes.length) {
            console.log('No episodes found in this season.');
            if (interactive) { continue seasonPick; }
            return;
          }
          break seasonPick;
        }

        episodes.forEach((e, i) => console.log(`${i + 1}. ${e.file_name}`));
        const episodeIndex = await askPick('Pick episode #: ', episodes.length, 'episode', args.episode);
        if (episodeIndex === GO_BACK) { continue search; }
        target = episodes[episodeIndex];
      } else {
        const vids = videoFiles(files);
        if (!vids.length) {
          console.log('No video file found.');
          if (interactive) { continue search; }
          return;
        }

        if (vids.length === 1) {
          target = vids[0];
        } else {
          vids.forEach((v, i) => console.log(`${i + 1}. ${v.file_name}`));
          const fileIndex = await askPick('Pick file #: ', vids.length, 'file');
          if (fileIndex === GO_BACK) { continue search; }
          target = vids[fileIndex];
        }
      }

      const links = await getLinks(target.fid);
      if (!links.length) {
        console.log('No quality links found.');
        if (interactive) { continue search; }
        return;
      }

      links.forEach((q, i) => {
        const tag = q.ext === 'm3u8' ? 'HLS stream' : 'direct file download';
        console.log(`${i + 1}. ${q.quality} ${q.size || ''} ${q.speed || ''} [${q.ext}] ← ${tag}`.trim());
      });
      const qualityIndex = await askPick('Pick quality #: ', links.length, 'quality', args.quality);
      if (qualityIndex === GO_BACK) { continue search; }
      const selected = links[qualityIndex];
      const finalUrl = proxyUrl(selected.url);

      if (args.json) {
        console.log(JSON.stringify({ title: picked.title, year: picked.year, quality: selected.quality, size: selected.size, ext: selected.ext, url: finalUrl }));
      } else {
        console.log('\nSelected URL:');
        console.log(finalUrl);
      }
      break search;
    }
  } finally {
    rl?.close();
  }
}

main().catch((err) => {
  console.error('CLI failed:', err.message);
  process.exitCode = 1;
});