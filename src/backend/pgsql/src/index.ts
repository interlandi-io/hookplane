import { BackendError, describeBackend, StateEvent, WriteRejectedError } from '@hookplane/backend'
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import path from 'path'
import * as schema from './db/schema.js'
import { Provider } from '@hookplane/core'
import { eq } from 'drizzle-orm'
import { ResultAsync } from 'neverthrow'

export type PgsqlBackendConfig = {
    databaseUrl: string
    runMigrations: boolean
}

type PgsqlBackendState = {
    db: Database
}

type Database = ReturnType<typeof drizzle<typeof schema>>

export const createPgsqlBackend = describeBackend<PgsqlBackendConfig, PgsqlBackendState>({
    name: 'pgsql',
    init: async ({ databaseUrl, runMigrations = true }) => {
        const db = drizzle(databaseUrl, { schema })
        if (runMigrations) {
            await migrate(db, {
                migrationsFolder: path.join(__dirname, '../drizzle/')
            })
        }
        return { db }
    },
    state: {
        read: () => { throw '' },
        write: () => { throw '' },
        delete: () => { throw '' },
        events: {
            apply({ state: { db }, events }) {
                const results: ResultAsync<void, BackendError>[] = events
                    .map(event => ResultAsync.fromPromise(
                        applyEvent(db, event),
                        (e) => e as BackendError // TODO
                    ))
                return ResultAsync.combine(results).map(() => {})
            },
        }
    },
    signingSecret: {
        read: () => { throw '' },
        write: () => { throw '' },
        delete: () => { throw '' },
    },
})

async function applyEvent(db: Database, event: StateEvent<Provider>) {
    let provider = (
        await db
            .select({ id: schema.providers.id })
            .from(schema.providers)
            .where(eq(schema.providers.name, event.provider.name))
            .limit(1)
    )[0]

    if (!provider) {
        const inserted = (
            await db
                .insert(schema.providers)
                .values({ name: event.provider.name })
                .returning()
        )[0]
        if (!inserted) {
            throw {
                kind: 'BackendError',
                name: 'WriteRejectedError',
                message: `provider ${event.provider.name} could not be found or created`,
                while: 'write'
            } satisfies WriteRejectedError 
        }
        provider = inserted
    }

    switch (event.tag) {
        case 'endpoint.created':
            await db.insert(schema.endpoints).values({
                providerId: provider.id,
                handle: event.handle,
                url: event.state.url,
                events: event.state.events,
                config: event.state.config,
            })
            break

        case 'endpoint.updated':
            await db
                .update(schema.endpoints)
                .set({
                    url: event.after.url,
                    handle: event.handle,
                    events: event.after.events,
                    config: event.after.config,
                })
                .where(eq(schema.endpoints.handle, event.handle))
            break

        case 'endpoint.deleted':
            await db
                .delete(schema.endpoints)
                .where(eq(schema.endpoints.handle, event.handle))
            // If there are no events under this provider,
            // we should delete it.
            const providerEvents = await db
                .select()
                .from(schema.endpoints)
                .where(eq(schema.endpoints.providerId, provider.id))
            if (providerEvents.length === 0) {
                await db
                    .delete(schema.providers)
                    .where(eq(schema.providers.id, provider.id))
            }
            break
    }
}

function toBackendError(e: unknown) {

}
