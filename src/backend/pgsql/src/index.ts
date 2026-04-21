import { BackendError, describeBackend, StateEvent, WriteRejectedError, BackendOperation, InternalError, NotFoundError, UnknownError } from '@hookplane/backend'
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

const PGSQL_UNIQUE_VIOLATION = '23505'
const PGSQL_FOREIGN_KEY_VIOLATION = '23503'
const PGSQL_RAISE_EXCEPTION = 'P0001'
const PGRST_NO_DATA_FOUND = 'PGRST116'

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
                        (e) => toBackendError(e, 'write')
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

        case 'endpoint.updated': {
            const result = await db
                .update(schema.endpoints)
                .set({
                    url: event.after.url,
                    handle: event.handle,
                    events: event.after.events,
                    config: event.after.config,
                })
                .where(eq(schema.endpoints.handle, event.handle))
            if (result.rowCount === 0) {
                throw {
                    kind: 'BackendError',
                    name: 'NotFoundError',
                    message: `endpoint ${event.handle} not found`,
                    while: 'write'
                } satisfies NotFoundError
            }
            break
        }

        case 'endpoint.deleted': {
            const result = await db
                .delete(schema.endpoints)
                .where(eq(schema.endpoints.handle, event.handle))
            if (result.rowCount === 0) {
                throw {
                    kind: 'BackendError',
                    name: 'NotFoundError',
                    message: `endpoint ${event.handle} not found`,
                    while: 'write'
                } satisfies NotFoundError
            }
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
}

function toBackendError(e: unknown, operation: BackendOperation): BackendError {
    if ((e as { kind?: string })?.kind === 'BackendError') {
        return e as BackendError
    }

    const err = e as { cause?: unknown }
    const cause = err.cause as { code?: string } | undefined

    if (cause?.code === PGSQL_UNIQUE_VIOLATION) {
        return {
            kind: 'BackendError',
            name: 'WriteRejectedError',
            message: (e as { message?: string }).message || 'unique constraint violation',
            while: operation,
        } satisfies WriteRejectedError
    }

    const error = e as NodeJS.ErrnoException & { code?: string }

    if (error.code === PGSQL_UNIQUE_VIOLATION) {
        return {
            kind: 'BackendError',
            name: 'WriteRejectedError',
            message: (e as { message?: string }).message || 'unique constraint violation',
            while: operation,
        } satisfies WriteRejectedError
    }
    if (error.code === PGSQL_FOREIGN_KEY_VIOLATION) {
        return {
            kind: 'BackendError',
            name: 'InternalError',
            message: error.message || 'foreign key constraint violation',
            while: operation,
            cause: e,
        } satisfies InternalError
    }
    if (error.code === PGSQL_RAISE_EXCEPTION) {
        return {
            kind: 'BackendError',
            name: 'WriteRejectedError',
            message: error.message || 'write rejected',
            while: operation,
        } satisfies WriteRejectedError
    }
    if (error.code === 'ENOENT' || error.code === PGRST_NO_DATA_FOUND) {
        return {
            kind: 'BackendError',
            name: 'NotFoundError',
            message: error.message || 'record not found',
            while: operation,
        } satisfies NotFoundError
    }
    return {
        kind: 'BackendError',
        name: 'UnknownError',
        message: String(e),
        while: operation,
        cause: e,
    } satisfies UnknownError
}
