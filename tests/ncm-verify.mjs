// NCM 解密验证：从 v3_optimized.js 抽取真实源码执行（不复制算法），
// 用 taurusxin/ncmdump 的算法构造样本做 round-trip，并支持真实文件。
//   node tests/ncm-verify.mjs                自建样本 round-trip + AES 对拍
//   node tests/ncm-verify.mjs song.ncm       用真实样本解密并检查文件头
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const src = fs.readFileSync(path.join(ROOT, 'v3_optimized.js'), 'utf8').replace(/\r\n/g, '\n');

const start = src.indexOf('const ENCRYPTED_MSG');
const at = src.indexOf('async function ncmDecrypt');
const close = src.indexOf('\n    }\n', at);
if (start < 0 || at < 0 || close < 0) throw new Error('无法从源码中定位解密模块');

const slice = src.slice(start, close + '\n    }\n'.length);
const factory = new Function(`${slice}\nreturn { ncmDecrypt, sniffAudioExt, ncmKeyBox, aesEcbDecrypt };`);
const lib = factory();

const u32 = (n) => { const b = Buffer.alloc(4); b.writeUInt32LE(n >>> 0); return b; };
const CORE = Buffer.from('687A4852416D736F356B496E62617857', 'hex');
const META = Buffer.from('2331346C6A6B5F215C5D2630553C2728', 'hex');

function aesEcbEncrypt(key, plain) {
  const c = crypto.createCipheriv('aes-128-ecb', key, null);
  return Buffer.concat([c.update(plain), c.final()]);
}

// 按 ncmdump 的实现构造密钥流（KSA + 静态查表，无 PRGA 交换）
function ncmdumpKeyStream(key) {
  const box = new Uint8Array(256);
  for (let i = 0; i < 256; i++) box[i] = i;
  let last = 0, off = 0;
  for (let i = 0; i < 256; i++) {
    const swap = box[i];
    const c = (swap + last + key[off]) & 0xFF;
    off = off + 1 >= key.length ? 0 : off + 1;
    box[i] = box[c];
    box[c] = swap;
    last = c;
  }
  const ks = new Uint8Array(256);
  for (let j = 0; j < 256; j++) ks[j] = box[(box[j] + box[(box[j] + j) & 0xFF]) & 0xFF];
  return ks;
}

// NCM：密钥段整段 AES 加密（含 "neteasecloudmusic" 前缀），音频用 256 字节周期的查表流异或
function buildNcm(rc4Key, audio, metaObj) {
  const parts = [];
  parts.push(Buffer.from('CTENFDAM', 'ascii'), Buffer.from([0x01, 0x70]));

  const plainKey = Buffer.concat([Buffer.from('neteasecloudmusic', 'ascii'), rc4Key]);
  const encKey = aesEcbEncrypt(CORE, plainKey);
  const box = Buffer.from(encKey.map((b) => b ^ 0x64));
  parts.push(u32(box.length), box);

  if (metaObj) {
    const encMeta = aesEcbEncrypt(META, Buffer.from('music:' + JSON.stringify(metaObj), 'utf8'));
    const raw = Buffer.concat([Buffer.from("163 key(Don't modify):", 'ascii'), Buffer.from(encMeta.toString('base64'), 'ascii')]);
    parts.push(u32(raw.length), Buffer.from(raw.map((b) => b ^ 0x63)));
  } else {
    parts.push(u32(0));
  }

  // crc(4) + 版本(1) + cover_frame_len(4) + img_len(4) + 封面(0)
  parts.push(u32(0), Buffer.from([0x00]), u32(0), u32(0));

  const ks = ncmdumpKeyStream(rc4Key);
  const enc = Buffer.from(audio);
  for (let blk = 0; blk < enc.length; blk += 0x8000) {
    const n = Math.min(0x8000, enc.length - blk);
    for (let i = 0; i < n; i++) enc[blk + i] ^= ks[(i + 1) & 0xFF];
  }
  parts.push(enc);
  return Buffer.concat(parts);
}

function aesCheck(rounds = 32) {
  let bad = 0;
  for (let i = 0; i < rounds; i++) {
    const key = crypto.randomBytes(16);
    const plain = crypto.randomBytes(16 * (1 + (i % 4)));
    const padLen = 16 - (plain.length % 16);
    const padded = Buffer.concat([plain, Buffer.alloc(padLen, padLen)]);
    const c = crypto.createCipheriv('aes-128-ecb', key, null);
    c.setAutoPadding(false);
    const ct = Buffer.concat([c.update(padded), c.final()]);
    const got = Buffer.from(lib.aesEcbDecrypt(key, ct));
    if (Buffer.compare(got, plain) !== 0) bad++;
  }
  console.log(`AES-128-ECB 对拍(Node/OpenSSL) : ${rounds - bad}/${rounds} 通过`);
  if (bad) process.exitCode = 1;
}

async function roundTrip() {
  const rc4Key = crypto.randomBytes(16);
  const body = Buffer.concat([Buffer.from('fLaC', 'ascii'), crypto.randomBytes(0x8000 * 2 + 1234)]);
  const meta = { musicName: '测试曲目', artist: [['测试歌手', '123']], album: '测试专辑' };
  const file = buildNcm(rc4Key, body, meta);

  const out = await lib.ncmDecrypt(file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength));
  const got = Buffer.from(out.buf);
  const same = Buffer.compare(got, body) === 0;
  console.log('round-trip 音频字节一致 :', same, `(${got.length} bytes)`);
  console.log('嗅探格式               :', out.ext);
  console.log('元数据解析             :', JSON.stringify(out.meta));
  console.log('标题拼接               :', out.title);
  if (!same) process.exitCode = 1;
  if (out.ext !== 'flac') process.exitCode = 1;
  if (!out.meta || out.meta.musicName !== meta.musicName) process.exitCode = 1;
  if (out.title !== '测试曲目 - 测试歌手') process.exitCode = 1;
}

async function realFile(p) {
  const buf = fs.readFileSync(p);
  const out = await lib.ncmDecrypt(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
  console.log('文件        :', path.basename(p));
  console.log('解密后格式  :', out.ext);
  console.log('解密后大小  :', out.buf.byteLength);
  console.log('元数据      :', out.title);
  const u = new Uint8Array(out.buf, 0, 16);
  console.log('前 16 字节  :', Buffer.from(u).toString('hex'), '|', Buffer.from(u).toString('ascii').replace(/[^\x20-\x7e]/g, '.'));
}

const target = process.argv[2];
if (target) await realFile(target);
else { aesCheck(); await roundTrip(); }
