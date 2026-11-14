import assert from 'node:assert/strict';
import { access, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const docs = path.join(root, 'docs');
const manifest = JSON.parse(await readFile(path.join(docs, 'screen-manifest.json'), 'utf8'));
assert.equal(manifest.length, 52, 'Must contain 52 screens');
assert.deepEqual(manifest.map(page => page.number), Array.from({ length: 52 }, (_, i) => i), 'Screen order or coverage is invalid');
assert.equal(new Set(manifest.map(page => page.document)).size, 52, 'Duplicate page documents');
const originals = (await readdir(root)).filter(name => /^\d{2}-.*\.svg$/.test(name));
assert.deepEqual([...manifest.map(page => page.source)].sort(), originals.sort(), 'Source SVG coverage mismatch');

const memberships = {
  auth: { file: 'README_회원가입_로그인.txt', numbers: Array.from({ length: 8 }, (_, i) => i) },
  guest: { file: 'README_게스트.txt', numbers: [...Array.from({ length: 11 }, (_, i) => i + 8), 45, 48] },
  shared: { file: 'README_공용.txt', numbers: [...Array.from({ length: 6 }, (_, i) => i + 19), ...Array.from({ length: 8 }, (_, i) => i + 37), 46] },
  host: { file: 'README_호스트.txt', numbers: [...Array.from({ length: 12 }, (_, i) => i + 25), 47, 49, 50, 51] },
};

for (const [group, expected] of Object.entries(memberships)) {
  assert.deepEqual(manifest.filter(page => page.group === group).map(page => page.number), expected.numbers, `Wrong membership: ${group}`);
  const text = await readFile(path.join(docs, expected.file), 'utf8');
  assert.ok(text.includes('앱 소스 미구현'), `Missing honest status: ${expected.file}`);
  for (const page of manifest.filter(p => p.group === group)) {
    assert.ok(text.includes(page.document), `Missing category link: ${page.id}`);
  }
}

const requiredSections = ['1. 목적 및 범위', '2. 프론트엔드 요구사항', '3. 백엔드 및 API 계약', '4. MariaDB 및 권한', '5. 완료 조건과 검증', '6. 순차 구현용 프롬프트', '7. 구현 기록', '8. SVG에서 추출한 화면 문구'];
for (const page of manifest) {
  const document = await readFile(path.join(docs, page.document), 'utf8');
  for (const section of requiredSections) assert.ok(document.includes(section), `Missing ${section}: ${page.id}`);
  assert.ok(document.includes('앱 기능 미구현'), `Missing honest status: ${page.id}`);
  assert.ok(document.includes(page.source), `Missing source: ${page.id}`);
  for (const number of page.related) assert.ok(Number.isInteger(number) && number >= 0 && number <= 51, `Invalid related screen: ${page.id}`);
  await access(path.join(root, page.source));
  // Each generated TXT is plain text, so validate every local file reference it prints.
  const referenced = [...document.matchAll(/(?:\.\.\/)+(?:[\p{L}\p{N}_.\/-]+\.(?:txt|svg))/gu)].map(m => m[0]);
  for (const ref of referenced) await access(path.resolve(path.dirname(path.join(docs, page.document)), ref));
}
assert.equal((await readdir(path.join(docs, 'pages'))).filter(f => f.endsWith('.txt')).length, 52);

const readme = await readFile(path.join(root, 'README.md'), 'utf8');
for (const link of readme.matchAll(/\]\(([^)]+)\)/g)) {
  const target = decodeURIComponent(link[1].replace(/\\/g, ''));
  if (/^(?:https?:|#)/.test(target)) continue;
  await access(path.resolve(root, target));
}
for (const filename of ['00_전체_구현_프롬프트.txt', '01_PRD.txt', '02_구현순서.txt', '03_MariaDB_설계.txt', '04_SOLID_KISS_YAGNI.txt', '05_최초실행_명세.txt', '06_사용도구.txt', '07_구현기록.txt']) await access(path.join(docs, filename));
await access(path.join(root, '문서검증.cmd'));
console.log('PASS: 52 screens, exact SVG coverage, 4 category assignments, 8 required sections per screen, related screen IDs, local references, README links, and shared documents.');
