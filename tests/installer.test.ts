import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import {
  containedPath,
  validateBundleFiles,
  sha256,
} from "../scripts/installer-utils.mjs";
test("설치 패키지는 실행 파일만 허용하고 현재 비밀번호/DB/사진을 제외한다", () => {
  validateBundleFiles([
    ".env.example",
    "dist/api/apps/api/src/server.js",
    "runtime/node.exe",
    ".runtime/mariadb-11.4.5-winx64/bin/mariadbd.exe",
  ]);
  for (const file of [
    ".env",
    ".env.local",
    ".git/config",
    ".aws/credentials",
    ".runtime/mariadb-data/ibdata1",
    ".runtime/uploads/photo.png",
    "../private.txt",
  ])
    assert.throws(() => validateBundleFiles([file]));
});
test("설치 빌드 경로는 작업 폴더 안에서만 생성한다", () => {
  const root = path.resolve("installer-fixture");
  assert.equal(
    containedPath(root, path.join(root, "payload")),
    path.join(root, "payload"),
  );
  assert.throws(() => containedPath(root, root));
  assert.throws(() => containedPath(root, path.join(root, "..", "outside")));
});
test("설치 런타임 해시 검증은 SHA256을 사용한다", () =>
  assert.equal(
    sha256(Buffer.from("abc")),
    "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
  ));
