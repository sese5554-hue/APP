import "dotenv/config";
import { z } from "zod";
export const config = z
  .object({
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    HOST: z.string().default("127.0.0.1"),
    PORT: z.coerce.number().int().positive().default(3001),
    SERVE_WEB: z.enum(["true", "false"]).default("false"),
    APP_ORIGIN: z.url().default("http://127.0.0.1:5173"),
    DB_HOST: z.string().default("127.0.0.1"),
    DB_PORT: z.coerce.number().default(3307),
    DB_NAME: z
      .string()
      .regex(/^[a-zA-Z0-9_]+$/)
      .default("geuncha"),
    DB_USER: z.string().default("geuncha"),
    DB_PASSWORD: z.string().min(1),
    PROVIDER_MODE: z
      .enum(["development", "unconfigured"])
      .default("unconfigured"),
    SESSION_DAYS: z.coerce.number().min(1).max(30).default(7),
    UPLOAD_DIR: z.string().default(".runtime/uploads"),
  })
  .parse(process.env);
if (config.NODE_ENV === "production" && config.PROVIDER_MODE === "development")
  throw new Error(
    "운영 환경에서는 개발용 인증·결제 공급자를 사용할 수 없습니다.",
  );
