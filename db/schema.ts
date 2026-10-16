import { integer, sqliteTable, text, index } from 'drizzle-orm/sqlite-core';
export const recognitionRequests = sqliteTable('recognition_requests', {
  id: text('id').primaryKey(),
  owner: text('owner').notNull(),
  started: integer('started').notNull(),
  finished: integer('finished').notNull().default(0),
}, table => [index('recognition_started_idx').on(table.started), index('recognition_owner_started_idx').on(table.owner, table.started)]);
