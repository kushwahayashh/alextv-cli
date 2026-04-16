#!/usr/bin/env node
import CryptoJS from 'crypto-js';
import { customAlphabet } from 'nanoid';
import fetch from 'node-fetch';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

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

const rl = readline.createInterface({ input, output });

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

  const response = await fetch(SHOWBOX.baseUrl, {
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
  const data = await showboxRequest('Search5', { type, keyword: title, page: '1', pagelimit: '10' });
  return data.data || [];
}

async function getShareKey(id, type = 1) {
  const shareLinkUrl = `https://www.showbox.media/index/share_link?id=${id}&type=${type}`;
  const proxyUrl = `https://lunaissohot.lunastar0003.workers.dev/?destination=${encodeURIComponent(shareLinkUrl)}`;
  const response = await fetch(proxyUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    },
  });
  const text = await response.text();
  if (!text.trim().startsWith('{')) return null;
  const data = JSON.parse(text);
  const link = data?.data?.link || '';
  return link ? link.split('/').pop() : null;
}

async function febboxJson(url) {
  const res = await fetch(url, {
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
  const url = `${FEBBOX.baseUrl}/file/file_share_list?share_key=${shareKey}&pwd=&parent_id=${parentId}&is_html=0`;
  const data = await febboxJson(url);
  return data.data?.file_list || [];
}

async function getLinks(shareKey, fid) {
  const url = `${FEBBOX.baseUrl}/console/video_quality_list?fid=${fid}`;
  const data = await febboxJson(url);
  const html = data.html || '';
  const matches = [...html.matchAll(/<div[^>]*class="file_quality"[^>]*data-url="([^"]+)"[^>]*data-quality="([^"]+)"[^>]*>([\s\S]*?)<\/div>/g)];
  return matches.map(([, url, quality, chunk]) => {
    const name = (chunk.match(/<div class="name">([^<]+)<\/div>/)?.[1] || quality).trim();
    const speed = (chunk.match(/<div class="speed"><span>([^<]+)<\/span>/)?.[1] || '').trim();
    const size = (chunk.match(/<div class="size">([^<]+)<\/div>/)?.[1] || '').trim();
    return { url, quality, name, speed, size };
  });
}

function proxyUrl(url) {
  return `${FEBBOX.proxyBase}${encodeURIComponent(url)}`;
}

function pickFile(files) {
  return files.find((f) => f.is_dir === 0 && /\.(mp4|mkv|avi|m3u8)$/i.test(f.file_name)) || null;
}

async function main() {
  console.log('StreamFlix CLI');
  const modeInput = await rl.question('Search for (1) Movie or (2) Series? [1/2]: ');
  const isSeries = modeInput.trim() === '2';
  const searchType = isSeries ? 'tv' : 'movie';

  const title = await rl.question(`${isSeries ? 'Series' : 'Movie'} title: `);
  const results = await search(title.trim(), searchType);

  if (!results.length) {
    console.log('No results found.');
    rl.close();
    return;
  }

  results.forEach((item, i) => console.log(`${i + 1}. ${item.title} (${item.year || 'n/a'}) [id:${item.id}]`));
  const choice = Number(await rl.question('Pick result #: '));
  const picked = results[choice - 1] || results[0];
  const shareKey = await getShareKey(picked.id, isSeries ? 2 : 1);

  if (!shareKey) {
    console.log('No share key found.');
    rl.close();
    return;
  }

  console.log(`Share key: ${shareKey}`);
  let files = await getFiles(shareKey, 0);

  if (isSeries) {
    const seasons = files.filter((f) => f.is_dir === 1);
    if (!seasons.length) {
      console.log('No seasons found.');
      rl.close();
      return;
    }

    seasons.forEach((s, i) => console.log(`${i + 1}. ${s.file_name}`));
    const sChoice = Number(await rl.question('Pick season #: '));
    const season = seasons[sChoice - 1] || seasons[0];

    files = await getFiles(shareKey, season.fid);
    const episodes = files.filter((f) => f.is_dir === 0 && /\.(mp4|mkv|avi|m3u8)$/i.test(f.file_name));
    if (!episodes.length) {
      console.log('No episodes found.');
      rl.close();
      return;
    }

    episodes.forEach((e, i) => console.log(`${i + 1}. ${e.file_name}`));
    const eChoice = Number(await rl.question('Pick episode #: '));
    files = [episodes[eChoice - 1] || episodes[0]];
  }

  const target = pickFile(files);

  if (!target) {
    console.log('No video file found.');
    rl.close();
    return;
  }

  const links = await getLinks(shareKey, target.fid);
  if (!links.length) {
    console.log('No quality links found.');
    rl.close();
    return;
  }

  links.forEach((q, i) => console.log(`${i + 1}. ${q.quality} ${q.size || ''} ${q.speed || ''}`.trim()));
  const qChoice = Number(await rl.question('Pick quality #: '));
  const selected = links[qChoice - 1] || links[0];
  const finalUrl = proxyUrl(selected.url);

  console.log('\nSelected URL:');
  console.log(finalUrl);
  rl.close();
}

main().catch((err) => {
  console.error('CLI failed:', err.message);
  rl.close();
  process.exitCode = 1;
});