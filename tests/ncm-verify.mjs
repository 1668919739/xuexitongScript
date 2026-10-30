// NCM 解密实现验证：从 v3_optimized.js 抽取真实源码执行，不复制粘贴算法。
// 用法：
//   node tests/ncm-verify.mjs              自建样本，做 round-trip
//   node tests/ncm-verify.mjs song.ncm     用真实样本解密并检查文件头
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const src = fs.readFileSync(path.join(ROOT, 'v3_optimized.js'), 'utf8').replace(/\r\n/g, '\n');

const start = src.indexOf('const ENCRYPTED_MSG');
const ncmAt = src.indexOf('async function ncmDecrypt');
const closeAt = src.indexOf('\n    }\n', ncmAt);
if (start < 0 || ncmAt < 0 || closeAt < 0) throw new Error('无法从源码中定位解密模块');

const slice = src.slice(start, closeAt + '\n    }\n'.length);
const factory = new Function(`${slice}\nreturn { ncmDecrypt, sniffAudioExt, ncmKeyStream, aesEcbDecrypt };`);
const lib = factory();

const u32 = (n) => { const b = Buffer.alloc(4); b.writeUInt32LE(n >>> 0); return b; };
const CORE = Buffer.from('687A4852416D736F356B496E62617857', 'hex');
const META = Buffer.from('2331346C6A6B5F215C5D2630553C2728', 'hex');

function aesEcbEncrypt(key, plain) {
  const c = crypto.createCipheriv('aes-128-ecb', key, null);
  return Buffer.concat([c.update(plain), c.final()]);
}

// 按 NCM 规范构造一个测试文件（音频用已知字节，便于逐字节比对）
function buildNcm(rc4Key, audio, metaObj) {
  const parts = [];
  parts.push(Buffer.from('CTENFDAM', 'ascii'), Buffer.from([0x01, 0x70]));
  // 规范：前 17 字节 "neteasecloudmusic" 是明文前缀，只有后面的 RC4 密钥被 AES-128-ECB 加密
  const encKey = aesEcbEncrypt(CORE, rc4Key);
  const plainKey = Buffer.concat([Buffer.from('neteasecloudmusic', 'ascii'), encKey]);
  const box = Buffer.from(plainKey.map((b) => b ^ 0x64));
  parts.push(u32(box.length), box);
  if (metaObj) {
    const metaJson = Buffer.from(JSON.stringify(metaObj), 'utf8');
    const encMeta = aesEcbEncrypt(META, metaJson);
    const b64 = Buffer.from(encMeta.toString('base64'), 'ascii');
    const raw = Buffer.concat([Buffer.from("163 key(Don't modify):", 'ascii'), b64]);
    parts.push(u32(raw.length), Buffer.from(raw.map((b) => b ^ 0x63)));
  } else {
    parts.push(u32(0));
  }
  parts.push(u32(0), Buffer.from([0x00]), u32(0));
  // 音频：用同一 256 字节密钥流逐字节异或（每 0x8000 重置）
  const ks = lib.ncmKeyStream(rc4Key);
  const enc = Buffer.from(audio);
  for (let off = 0; off < enc.length; off += 0x8000) {
    const n = Math.min(0x8000, enc.length - off);
    for (let k = 0; k < n; k++) enc[off + k] ^= ks[k];
  }
  parts.push(enc);
  return Buffer.concat(parts);
}

// 自带 AES-128-ECB 实现与 Node/OpenSSL 对拍（多组随机向量，含 PKCS7 填充）
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
  // 造一段“像 FLAC”的数据：fLaC 头 + 随机体，跨过 0x8000 边界以便测分块
  const body = Buffer.concat([Buffer.from('fLaC', 'ascii'), crypto.randomBytes(0x8000 * 2 + 1234)]);
  const meta = { musicName: '测试曲目', artist: '测试歌手', album: '测试专辑' };
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
  if (!out.meta || out.meta.artist !== meta.artist) process.exitCode = 1;
}

async function realFile(p) {
  const buf = fs.readFileSync(p);
  const out = await lib.ncmDecrypt(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
  console.log('文件        :', p);
  console.log('解密后格式  :', out.ext);
  console.log('解密后大小  :', out.buf.byteLength);
  console.log('元数据      :', JSON.stringify(out.meta));
  const u = new Uint8Array(out.buf, 0, 16);
  console.log('前 16 字节  :', Buffer.from(u).toString('hex'), '|', Buffer.from(u).toString('ascii').replace(/[^\x20-\x7e]/g, '.'));
}

const target = process.argv[2];
if (target) await realFile(target);
else { aesCheck(); await roundTrip(); }
