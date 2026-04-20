import { pgTable, integer, varchar, jsonb } from 'drizzle-orm/pg-core'

export const endpoints = pgTable('endpoints', {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    providerId: integer('provider_id').references(() => providers.id, { onDelete: 'cascade' }),
    handle: varchar().notNull(),
    url: varchar().notNull(),
    events: varchar().array().notNull(),
    config: jsonb().notNull(),
})

export const providers = pgTable('providers', {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    name: varchar().notNull(),
})

export const secrets = pgTable('providers', {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    endpointId: integer('endpoint_id').references(() => endpoints.id, { onDelete: 'cascade' }),
    secret: varchar().notNull(),
})
