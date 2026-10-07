import { text } from "drizzle-orm/sqlite-core";
import { sqliteTable } from "drizzle-orm/sqlite-core";

export const financeStates = sqliteTable("finance_states", {
  userId: text("user_id").primaryKey(),
  debtsJson: text("debts_json").notNull().default("[]"),
  expensesJson: text("expenses_json").notNull().default("[]"),
  updatedAt: text("updated_at").notNull(),
});
