import {
  pgTable, uuid, varchar, text, integer, bigint, boolean, timestamp, numeric,
  index, uniqueIndex, pgEnum,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: varchar("email", { length: 254 }).notNull(),
  name: varchar("name", { length: 80 }).notNull(),
  passwordHash: text("password_hash"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex("users_email_unique").on(t.email),
]);

export const wallets = pgTable("wallets", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  address: varchar("address", { length: 42 }).notNull(),
  chainId: integer("chain_id").notNull(),
  label: varchar("label", { length: 40 }),
  isPrimary: boolean("is_primary").notNull().default(false),
  verifiedAt: timestamp("verified_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex("wallets_address_chain_unique").on(t.address, t.chainId),
  index("wallets_user_idx").on(t.userId),
]);

export const transactionStatus = pgEnum("transaction_status", ["pending", "confirmed", "failed"]);

export const transactions = pgTable("transactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  walletId: uuid("wallet_id").notNull().references(() => wallets.id, { onDelete: "cascade" }),
  hash: varchar("hash", { length: 66 }).notNull(),
  chainId: integer("chain_id").notNull(),
  fromAddress: varchar("from_address", { length: 42 }).notNull(),
  toAddress: varchar("to_address", { length: 42 }),
  tokenAddress: varchar("token_address", { length: 42 }),
  value: numeric("value", { precision: 78, scale: 0 }).notNull().default("0"),
  status: transactionStatus("status").notNull().default("pending"),
  blockNumber: bigint("block_number", { mode: "bigint" }),
  confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex("transactions_hash_chain_unique").on(t.hash, t.chainId),
  index("transactions_wallet_idx").on(t.walletId),
  index("transactions_chain_block_idx").on(t.chainId, t.blockNumber),
]);

export type User = typeof users.$inferSelect;
export type Wallet = typeof wallets.$inferSelect;
export type Transaction = typeof transactions.$inferSelect;
