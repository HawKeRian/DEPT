import { eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { financeStates } from "../../../db/schema";
import { getChatGPTUser } from "../../chatgpt-auth";

type FinancePayload = {
  debts?: unknown;
  expenses?: unknown;
  updatedAt?: unknown;
};

const unauthorized = () => Response.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });

function validRecords(value: unknown, limit: number) {
  return Array.isArray(value) && value.length <= limit && JSON.stringify(value).length <= 250_000;
}

export async function GET() {
  const user = await getChatGPTUser();
  if (!user) return unauthorized();

  const db = getDb();
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
  if (!validRecords(payload.debts, 250) || !validRecords(payload.expenses, 500)) {
    return Response.json({ error: "รูปแบบข้อมูลไม่ถูกต้องหรือมีขนาดใหญ่เกินไป" }, { status: 400 });
  }

  const clientTime = typeof payload.updatedAt === "string" ? Date.parse(payload.updatedAt) : NaN;
  const updatedAt = new Date(Number.isFinite(clientTime) ? clientTime : Date.now()).toISOString();
  const values = {
    userId: user.userId,
    debtsJson: JSON.stringify(payload.debts),
    expensesJson: JSON.stringify(payload.expenses),
    updatedAt,
  };

  const db = getDb();
  await db.insert(financeStates).values(values).onConflictDoUpdate({
    target: financeStates.userId,
    set: {
      debtsJson: values.debtsJson,
      expensesJson: values.expensesJson,
      updatedAt: values.updatedAt,
    },
  });

  return Response.json({ ok: true, updatedAt });
}
