import { Router } from "express";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import {
  pool,
  one,
  rows,
  transaction,
  dateSql,
  json,
} from "../../database/db.js";
import { publicUser, requireUser } from "../../middleware/auth.js";
import { ensure } from "../../lib/errors.js";
import { provider } from "../../providers/index.js";
import { ownUpload } from "./uploads.js";
export const accountRoutes = Router();
accountRoutes.get("/me/profile", async (req, res) => {
  const user = requireUser(req);
  res.json({ data: await publicUser(user.id) });
});
accountRoutes.patch("/me/profile", async (req, res) => {
  const user = requireUser(req),
    data = z
      .object({
        nickname: z.string().trim().min(1).max(40),
        email: z.union([z.email(), z.literal("")]),
        avatarUploadId: z.uuid().optional(),
      })
      .parse(req.body);
  if (data.avatarUploadId)
    await ownUpload(pool, data.avatarUploadId, user.id, "profile");
  await pool.query(
    "UPDATE users SET nickname=?,email=?,avatar_id=COALESCE(?,avatar_id) WHERE id=?",
    [data.nickname, data.email || null, data.avatarUploadId ?? null, user.id],
  );
  res.json({ data: await publicUser(user.id) });
});
accountRoutes.post("/me/phone-change", async (req, res) => {
  const user = requireUser(req),
    id = z.uuid().parse(req.body.challengeId);
  await transaction(async (db) => {
    const challenge = await one(
      db,
      "SELECT * FROM auth_challenges WHERE id=? AND verified=TRUE AND consumed=FALSE AND expires_at>UTC_TIMESTAMP(3) FOR UPDATE",
      [id],
    );
    ensure(challenge, 400, "PHONE_REQUIRED", "새 휴대폰 번호를 인증해 주세요.");
    await db.query("UPDATE users SET phone=? WHERE id=?", [
      challenge.phone,
      user.id,
    ]);
    await db.query("UPDATE auth_challenges SET consumed=TRUE WHERE id=?", [id]);
  });
  res.json({ data: await publicUser(user.id) });
});
accountRoutes.get("/me/license", async (req, res) => {
  const user = requireUser(req),
    license = await one(
      pool,
      "SELECT status,mode,metadata_json,expires_at FROM user_verifications WHERE user_id=? AND kind='license'",
      [user.id],
    );
  res.json({
    data: license
      ? {
          ...json(license.metadataJson, {}),
          status:
            Date.parse(license.expiresAt.replace(" ", "T") + "Z") > Date.now()
              ? license.status
              : "expired",
          mode: license.mode,
          expiresAt: license.expiresAt,
        }
      : null,
  });
});
accountRoutes.post("/me/payment-method-setup", async (req, res) => {
  const user = requireUser(req);
  await provider.verify("payment-setup");
  const id = randomUUID();
  await pool.query(
    "INSERT INTO payment_setups(id,user_id,expires_at) VALUES (?,?,?)",
    [id, user.id, dateSql(new Date(Date.now() + 300000))],
  );
  res.status(201).json({ data: { id, mode: provider.mode } });
});
accountRoutes.post("/me/payment-methods", async (req, res) => {
  const user = requireUser(req),
    data = z
      .object({
        setupId: z.uuid(),
        isDefault: z.boolean(),
        lastFour: z
          .string()
          .regex(/^\d{4}$/)
          .default("1234"),
      })
      .strict()
      .parse(req.body),
    id = randomUUID();
  await transaction(async (db) => {
    await db.query("SELECT id FROM users WHERE id=? FOR UPDATE", [user.id]);
    const setup = await one(
      db,
      "SELECT * FROM payment_setups WHERE id=? AND user_id=? AND consumed=FALSE AND expires_at>UTC_TIMESTAMP(3) FOR UPDATE",
      [data.setupId, user.id],
    );
    ensure(
      setup,
      400,
      "INVALID_SETUP",
      "결제수단 등록 세션을 다시 시작해 주세요.",
    );
    const hasDefault = await one(
      db,
      "SELECT id FROM payment_methods WHERE user_id=? AND is_default=TRUE AND status='active'",
      [user.id],
    );
    const isDefault = data.isDefault || !hasDefault;
    if (isDefault)
      await db.query(
        "UPDATE payment_methods SET is_default=FALSE WHERE user_id=?",
        [user.id],
      );
    await db.query(
      "INSERT INTO payment_methods(id,user_id,provider,vault_ref,brand,last_four,is_default) VALUES (?,?,?,?,?,?,?)",
      [
        id,
        user.id,
        provider.mode,
        "dev-" + setup.id,
        "개발 테스트 카드",
        data.lastFour,
        isDefault,
      ],
    );
    await db.query("UPDATE payment_setups SET consumed=TRUE WHERE id=?", [
      setup.id,
    ]);
  });
  res.status(201).json({ data: { id, mode: provider.mode } });
});
accountRoutes.patch("/me/payment-methods/:id", async (req, res) => {
  const user = requireUser(req),
    id = z.uuid().parse(req.params.id);
  z.object({ isDefault: z.literal(true) }).parse(req.body);
  await transaction(async (db) => {
    await db.query("SELECT id FROM users WHERE id=? FOR UPDATE", [user.id]);
    ensure(
      await one(
        db,
        "SELECT id FROM payment_methods WHERE id=? AND user_id=? AND status='active'",
        [id, user.id],
      ),
      404,
      "METHOD_NOT_FOUND",
      "결제수단을 찾을 수 없습니다.",
    );
    await db.query(
      "UPDATE payment_methods SET is_default=FALSE WHERE user_id=?",
      [user.id],
    );
    await db.query("UPDATE payment_methods SET is_default=TRUE WHERE id=?", [
      id,
    ]);
  });
  res.json({ data: { ok: true } });
});
accountRoutes.delete("/me/payment-methods/:id", async (req, res) => {
  const user = requireUser(req),
    id = z.uuid().parse(req.params.id);
  await transaction(async (db) => {
    await db.query("SELECT id FROM users WHERE id=? FOR UPDATE", [user.id]);
    ensure(
      await one(
        db,
        "SELECT id FROM payment_methods WHERE id=? AND user_id=? AND status='active'",
        [id, user.id],
      ),
      404,
      "METHOD_NOT_FOUND",
      "결제수단을 찾을 수 없습니다.",
    );
    ensure(
      !(await one(
        db,
        "SELECT id FROM bookings WHERE payment_method_id=? AND status IN ('REQUESTED','APPROVED','CONFIRMED','IN_USE','RETURNED','SETTLEMENT_PENDING')",
        [id],
      )),
      409,
      "METHOD_IN_USE",
      "이용 중인 예약의 결제수단은 삭제할 수 없습니다.",
    );
    await db.query(
      "UPDATE payment_methods SET status='deleted',is_default=FALSE WHERE id=?",
      [id],
    );
    const replacement = await one(
      db,
      "SELECT id FROM payment_methods WHERE user_id=? AND status='active' ORDER BY is_default DESC,created_at LIMIT 1",
      [user.id],
    );
    if (replacement)
      await db.query("UPDATE payment_methods SET is_default=TRUE WHERE id=?", [
        replacement.id,
      ]);
  });
  res.json({ data: { ok: true } });
});
const settingsSchema = z.object({
  booking: z.boolean(),
  chat: z.boolean(),
  settlement: z.boolean(),
  benefit: z.boolean(),
});
accountRoutes.get("/me/notification-settings", async (req, res) => {
  const user = requireUser(req),
    list = await rows(
      pool,
      "SELECT category,enabled FROM notification_settings WHERE user_id=?",
      [user.id],
    );
  res.json({
    data: {
      booking: true,
      chat: true,
      settlement: true,
      benefit: false,
      ...Object.fromEntries(list.map((r) => [r.category, Boolean(r.enabled)])),
    },
  });
});
accountRoutes.put("/me/notification-settings", async (req, res) => {
  const user = requireUser(req),
    settings = settingsSchema.parse(req.body);
  await transaction(async (db) => {
    for (const [key, value] of Object.entries(settings))
      await db.query(
        "INSERT INTO notification_settings(user_id,category,enabled) VALUES (?,?,?) ON DUPLICATE KEY UPDATE enabled=VALUES(enabled)",
        [user.id, key, value],
      );
    await db.query(
      "INSERT INTO consent_records(id,user_id,version,choices_json) VALUES (?,?,?,?)",
      [
        randomUUID(),
        user.id,
        "marketing-settings-1",
        JSON.stringify({ marketingApp: settings.benefit }),
      ],
    );
  });
  res.json({ data: settings });
});
const faqs = [
  {
    id: "cancel",
    question: "예약은 어떻게 취소하나요?",
    answer:
      "예약 상세에서 취소할 수 있습니다. 현재 개발 정책은 인수 전 전액 환불이며, 이용 시작 후 자동 취소는 지원하지 않습니다. 실제 운영 정책은 출시 전 확정합니다.",
  },
  {
    id: "license",
    question: "면허 인증은 어디서 하나요?",
    answer:
      "마이페이지의 운전면허 관리에서 입력·변경합니다. 현재는 개발 인증이며 실제 진위 확인은 공급자 연동이 필요합니다.",
  },
  {
    id: "distance",
    question: "주행거리와 통행료는 어떻게 정산되나요?",
    answer:
      "인수·반납 계기판 차이에서 포함 거리를 제외하고 초과 요금을 계산합니다. 통행료는 검증된 외부 증빙 연동 전까지 자동 청구하지 않습니다.",
  },
  {
    id: "vehicle",
    question: "차량 등록과 사진은 어떻게 수정하나요?",
    answer:
      "호스트 홈의 차량 관리에서 수정할 수 있습니다. 이미 확정된 예약의 요금은 변경되지 않습니다.",
  },
];
accountRoutes.get("/support/faqs", (req, res) => {
  const query = z.string().max(100).default("").parse(req.query.q);
  res.json({
    data: faqs.filter(
      (f) => f.question.includes(query) || f.answer.includes(query),
    ),
  });
});
accountRoutes.post("/support/inquiries", async (req, res) => {
  const user = requireUser(req),
    data = z
      .object({
        idempotencyKey: z.uuid(),
        category: z.enum(["예약", "결제", "차량", "기타"]),
        title: z.string().trim().min(1).max(100),
        content: z.string().trim().min(1).max(5000),
        uploadIds: z.array(z.uuid()).max(3),
      })
      .parse(req.body);
  await transaction(async (db) => {
    const existing = await one(
      db,
      "SELECT user_id,title,content FROM inquiries WHERE id=? FOR UPDATE",
      [data.idempotencyKey],
    );
    if (existing) {
      ensure(
        existing.userId === user.id &&
          existing.title === data.title &&
          existing.content === data.content,
        409,
        "KEY_REUSED",
        "재시도 키를 확인해 주세요.",
      );
      return;
    }
    for (const id of data.uploadIds)
      await ownUpload(db, id, user.id, "inquiry");
    await db.query(
      "INSERT INTO inquiries(id,user_id,category,title,content) VALUES (?,?,?,?,?)",
      [data.idempotencyKey, user.id, data.category, data.title, data.content],
    );
    for (const id of data.uploadIds)
      await db.query(
        "INSERT INTO inquiry_attachments(inquiry_id,upload_id) VALUES (?,?)",
        [data.idempotencyKey, id],
      );
  });
  res.status(201).json({
    data: {
      id: data.idempotencyKey,
      status: "received",
      emailStatus: "unconfigured",
    },
  });
});
accountRoutes.get("/me/inquiries", async (req, res) => {
  const user = requireUser(req);
  res.json({
    data: await rows(
      pool,
      "SELECT id,category,title,content,status,created_at FROM inquiries WHERE user_id=? ORDER BY created_at DESC LIMIT 30",
      [user.id],
    ),
  });
});
