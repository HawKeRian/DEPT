import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const financeStates = sqliteTable("finance_states", {
  userId: text("user_id").primaryKey(),
  debtsJson: text("debts_json").notNull().default("[]"),
  expensesJson: text("expenses_json").notNull().default("[]"),
  incomesJson: text("incomes_json").notNull().default("[]"),
  accountsJson: text("accounts_json").notNull().default("[]"),
  updatedAt: text("updated_at").notNull(),
});

export const encryptedFinanceStates = sqliteTable("encrypted_finance_states", {
  userId: text("user_id").primaryKey(),
  encryptedPayload: text("encrypted_payload").notNull(),
  wrappedKey: text("wrapped_key").notNull(),
  salt: text("salt").notNull(),
  wrapIv: text("wrap_iv").notNull(),
  dataIv: text("data_iv").notNull(),
  cryptoVersion: integer("crypto_version").notNull().default(1),
  updatedAt: text("updated_at").notNull(),
});
