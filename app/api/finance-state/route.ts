import { eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { encryptedFinanceStates, financeStates } from "../../../db/schema";
import { getChatGPTUser } from "../../chatgpt-auth";

type FinancePayload = {
  encrypted?: {
    encryptedPayload?: unknown;
    wrappedKey?: unknown;
    salt?: unknown;
    wrapIv?: unknown;
    dataIv?: unknown;
    cryptoVersion?: unknown;
    updatedAt?: unknown;
  };
};

const unauthorized = () => Response.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });

export async function GET() {
  const user = await getChatGPTUser();
  if (!user) return unauthorized();

  const db = getDb();
  const encrypted = await db.query.encryptedFinanceStates.findFirst({
    where: eq(encryptedFinanceStates.userId, user.userId),
  });

  if (encrypted) {
    return Response.json({
      encrypted: {
        encryptedPayload: encrypted.encryptedPayload,
        wrappedKey: encrypted.wrappedKey,
        salt: encrypted.salt,
        wrapIv: encrypted.wrapIv,
        dataIv: encrypted.dataIv,
        cryptoVersion: encrypted.cryptoVersion,
        updatedAt: encrypted.updatedAt,
      },
      state: null,
    });
  }

  const row = await db.query.financeStates.findFirst({
    where: eq(financeStates.userId, user.userId),
  });

  if (!row) return Response.json({ state: null });

  return Response.json({
    state: {
      debts: JSON.parse(row.debtsJson),
      expenses: JSON.parse(row.expensesJson),
      updatedAt: row.updatedAt,
    },
  });
}

export async function PUT(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return unauthorized();

  const payload = (await request.json()) as FinancePayload;
  if (payload.encrypted) {
    const envelope = payload.encrypted;
    const fields = [envelope.encryptedPayload, envelope.wrappedKey, envelope.salt, envelope.wrapIv, envelope.dataIv, envelope.updatedAt];
    if (!fields.every((value) => typeof value === "string" && value.length > 0 && value.length <= 500_000) || envelope.cryptoVersion !== 1) {
      return Response.json({ error: "รูปแบบข้อมูลเข้ารหัสไม่ถูกต้อง" }, { status: 400 });
    }

    const updatedAt = new Date(Date.parse(envelope.updatedAt as string) || Date.now()).toISOString();
    const values = {
      userId: user.userId,
      encryptedPayload: envelope.encryptedPayload as string,
      wrappedKey: envelope.wrappedKey as string,
      salt: envelope.salt as string,
      wrapIv: envelope.wrapIv as string,
      dataIv: envelope.dataIv as string,
      cryptoVersion: 1,
      updatedAt,
    };

    const db = getDb();
    await db.batch([
      db.insert(encryptedFinanceStates).values(values).onConflictDoUpdate({
        target: encryptedFinanceStates.userId,
        set: {
          encryptedPayload: values.encryptedPayload,
          wrappedKey: values.wrappedKey,
          salt: values.salt,
          wrapIv: values.wrapIv,
          dataIv: values.dataIv,
          cryptoVersion: values.cryptoVersion,
          updatedAt,
        },
      }),
      db.delete(financeStates).where(eq(financeStates.userId, user.userId)),
    ]);

    return Response.json({ ok: true, updatedAt, encrypted: true });
  }

  return Response.json({ error: "ต้องเข้ารหัสข้อมูลแบบ E2EE ก่อนบันทึก" }, { status: 400 });
}
