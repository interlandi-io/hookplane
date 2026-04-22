import {
    BackendError,
    describeBackend,
    StateEvent,
    WriteRejectedError,
    InternalError,
    NotFoundError,
    UnknownError,
} from '@hookplane/backend'
import { drizzle, NodePgQueryResultHKT } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import path from 'path'
import * as schema from './db/schema.js'
import {
    createEndpointHandle,
    createEndpointUrl,
    EndpointIndex,
    Provider,
    ProviderSet,
    State,
} from '@hookplane/core'
import { EmptyRelations, and, eq } from 'drizzle-orm'
import { ExtractTablesWithRelations } from 'drizzle-orm/_relations'
import { err, ok, Result, ResultAsync } from 'neverthrow'
import { PgAsyncTransaction } from 'drizzle-orm/pg-core'

export type PgsqlBackendConfig = {
    databaseUrl: string
    runMigrations: boolean
}

type PgsqlBackendState = {
    db: Database
}

type Database = ReturnType<typeof drizzle<typeof schema>>
type Transaction = PgAsyncTransaction<
    NodePgQueryResultHKT,
    typeof schema,
    EmptyRelations,
    ExtractTablesWithRelations<typeof schema>
>

const PGSQL_UNIQUE_VIOLATION = '23505'
const PGSQL_FOREIGN_KEY_VIOLATION = '23503'
const PGSQL_RAISE_EXCEPTION = 'P0001'
const PGRST_NO_DATA_FOUND = 'PGRST116'

export const createPgsqlBackend = describeBackend<
    PgsqlBackendConfig,
    PgsqlBackendState,
    'event'
>({
    name: 'pgsql',
    init: async ({ databaseUrl, runMigrations = true }) => {
        const db = drizzle(databaseUrl, { schema })
        if (runMigrations) {
            await migrate(db, {
                migrationsFolder: path.join(__dirname, '../drizzle/'),
            })
        }
        return { db }
    },
    state: {
        writeMode: 'event',
        read: ({ state: { db }, providers }) =>
            ResultAsync.fromSafePromise(readState(db, providers)).andThen(
                (r) => r,
            ),
        commit: ({ state: { db }, events }) =>
            ResultAsync.fromSafePromise(
                db.transaction(async (tx): Promise<Result<void, BackendError>> => {
                    for (const event of events) {
                        const result = await commitEvent(tx, event)
                        if (result.isErr()) {
                            tx.rollback()
                            return err(result.error)
                        }
                    }
                    return ok()
                }),
            ).andThen((r) => r),
    },
    signingSecret: {
        // TODO: this should be an endpoint handle
        read: ({ state: { db }, id }) =>
            ResultAsync.fromSafePromise(readSecret(db, id)).andThen((r) => r),
        write: ({ state: { db }, id, data }) =>
            ResultAsync.fromSafePromise(writeSecret(db, id, data)).andThen(
                (r) => r,
            ),
        delete: ({ state: { db }, id }) =>
            ResultAsync.fromSafePromise(deleteSecret(db, id)).andThen((r) => r),
    },
})

// TODO: we need a better solution for "stale" providers
async function readState<P extends ProviderSet>(db: Database, providers: P) {
    const providerStates = {} as State<P>['providerStates']

    for (const providerName of Object.keys(providers)) {
        const provider = (
            await db
                .select()
                .from(schema.providers)
                .where(eq(schema.providers.name, providerName))
                .limit(1)
        )[0]
        if (!provider) {
            return err({
                kind: 'BackendError',
                name: 'ProviderNotFoundError',
                message: `no provider found for name ${providerName}`,
                provider: providerName,
                while: 'read',
            } satisfies BackendError)
        }

        const endpoints = await db
            .select()
            .from(schema.endpoints)
            .where(eq(schema.endpoints.providerId, provider.id))
        if (!endpoints) {
            return err({
                kind: 'BackendError',
                name: 'NotFoundError',
                message: `no endpoints found for provider name ${providerName}`,
                while: 'read',
            } satisfies BackendError)
        }

        const endpointIndex: EndpointIndex<Provider> = new Map()
        for (const endpoint of endpoints) {
            const handle = createEndpointHandle(endpoint.handle)
            if (handle.isErr()) {
                return err({
                    kind: 'BackendError',
                    name: 'InternalError',
                    message: 'invalid endpoint handle: ' + handle,
                    while: 'read',
                } satisfies BackendError)
            }
            const url = createEndpointUrl(endpoint.url)
            if (url.isErr()) {
                return err({
                    kind: 'BackendError',
                    name: 'InternalError',
                    message: 'invalid endpoint url: ' + url,
                    while: 'read',
                } satisfies BackendError)
            }
            endpointIndex.set(handle.value, {
                url: url.value,
                events: endpoint.events,
                config: endpoint.config,
            })
        }

        providerStates[providerName as keyof P] = endpointIndex
    }

    return ok({
        providers,
        providerStates,
    })
}

async function commitEvent(
    tx: Transaction,
    event: StateEvent<Provider>,
): Promise<Result<void, BackendError>> {
    try {
        let provider = (
            await tx
                .select({ id: schema.providers.id })
                .from(schema.providers)
                .where(eq(schema.providers.name, event.provider.name))
                .limit(1)
        )[0]

        if (!provider) {
            if (event.tag !== 'endpoint.created') {
                return err({
                    kind: 'BackendError',
                    name: 'NotFoundError',
                    message: `provider ${event.provider.name} not found`,
                    while: 'write',
                } satisfies NotFoundError)
            }

            const inserted = (
                await tx
                    .insert(schema.providers)
                    .values({ name: event.provider.name })
                    .returning()
            )[0]
            if (!inserted) {
                return err({
                    kind: 'BackendError',
                    name: 'WriteRejectedError',
                    message: `provider ${event.provider.name} could not be found or created`,
                    while: 'write',
                } satisfies WriteRejectedError)
            }
            provider = inserted
        }

        switch (event.tag) {
            case 'endpoint.created': {
                const handle = createEndpointHandle(event.handle)
                if (handle.isErr()) {
                    return err({
                        kind: 'BackendError',
                        name: 'InternalError',
                        message: 'invalid endpoint handle: ' + event.handle,
                        while: 'read',
                    } satisfies BackendError)
                }
                const url = createEndpointUrl(event.state.url)
                if (url.isErr()) {
                    return err({
                        kind: 'BackendError',
                        name: 'InternalError',
                        message: 'invalid endpoint url: ' + event.state.url,
                        while: 'read',
                    } satisfies BackendError)
                }

                await tx.insert(schema.endpoints).values({
                    providerId: provider.id,
                    handle: handle.value,
                    url: url.value,
                    events: event.state.events,
                    config: event.state.config,
                })
                break
            }

            case 'endpoint.updated': {
                const handle = createEndpointHandle(event.handle)
                if (handle.isErr()) {
                    return err({
                        kind: 'BackendError',
                        name: 'InternalError',
                        message: 'invalid endpoint handle: ' + event.handle,
                        while: 'read',
                    } satisfies BackendError)
                }
                const url = createEndpointUrl(event.after.url)
                if (url.isErr()) {
                    return err({
                        kind: 'BackendError',
                        name: 'InternalError',
                        message: 'invalid endpoint url: ' + event.after.url,
                        while: 'read',
                    } satisfies BackendError)
                }

                const result = await tx
                    .update(schema.endpoints)
                    .set({
                        url: url.value,
                        handle: handle.value,
                        events: event.after.events,
                        config: event.after.config,
                    })
                    .where(
                        and(
                            eq(schema.endpoints.providerId, provider.id),
                            eq(schema.endpoints.handle, event.handle),
                        ),
                    )
                if (result.rowCount === 0) {
                    return err({
                        kind: 'BackendError',
                        name: 'NotFoundError',
                        message: `endpoint ${event.handle} not found`,
                        while: 'write',
                    } satisfies NotFoundError)
                }
                break
            }

            case 'endpoint.deleted': {
                const result = await tx
                    .delete(schema.endpoints)
                    .where(
                        and(
                            eq(schema.endpoints.providerId, provider.id),
                            eq(schema.endpoints.handle, event.handle),
                        ),
                    )
                if (result.rowCount === 0) {
                    return err({
                        kind: 'BackendError',
                        name: 'NotFoundError',
                        message: `endpoint ${event.handle} not found`,
                        while: 'write',
                    } satisfies NotFoundError)
                }
                const providerEvents = await tx
                    .select()
                    .from(schema.endpoints)
                    .where(eq(schema.endpoints.providerId, provider.id))
                if (providerEvents.length === 0) {
                    await tx
                        .delete(schema.providers)
                        .where(eq(schema.providers.id, provider.id))
                }
                break
            }
        }

        return ok()
    } catch (e) {
        if ((e as { kind?: string })?.kind === 'BackendError') {
            return err(e as BackendError)
        }
        const cause = (e as { cause?: { code?: string } }).cause || undefined

        if (cause?.code === PGSQL_UNIQUE_VIOLATION) {
            return err({
                kind: 'BackendError',
                name: 'WriteRejectedError',
                message:
                    (e as { message?: string }).message ||
                    'unique constraint violation',
                while: 'write',
            } satisfies WriteRejectedError)
        }

        const error = e as NodeJS.ErrnoException & { code?: string }

        if (error.code === PGSQL_UNIQUE_VIOLATION) {
            return err({
                kind: 'BackendError',
                name: 'WriteRejectedError',
                message:
                    (e as { message?: string }).message ||
                    'unique constraint violation',
                while: 'write',
            } satisfies WriteRejectedError)
        }
        if (error.code === PGSQL_FOREIGN_KEY_VIOLATION) {
            return err({
                kind: 'BackendError',
                name: 'InternalError',
                message: error.message || 'foreign key constraint violation',
                while: 'write',
                cause: e,
            } satisfies InternalError)
        }
        if (error.code === PGSQL_RAISE_EXCEPTION) {
            return err({
                kind: 'BackendError',
                name: 'WriteRejectedError',
                message: error.message || 'write rejected',
                while: 'write',
            } satisfies WriteRejectedError)
        }
        if (error.code === 'ENOENT' || error.code === PGRST_NO_DATA_FOUND) {
            return err({
                kind: 'BackendError',
                name: 'NotFoundError',
                message: error.message || 'record not found',
                while: 'write',
            } satisfies NotFoundError)
        }
        return err({
            kind: 'BackendError',
            name: 'UnknownError',
            message: String(e),
            while: 'write',
            cause: e,
        } satisfies UnknownError)
    }
}

async function readSecret(
    db: Database,
    id: string,
): Promise<Result<string, BackendError>> {
    const endpoint = (
        await db
            .select()
            .from(schema.endpoints)
            .where(eq(schema.endpoints.handle, id))
            .limit(1)
    )[0]
    if (!endpoint) {
        return err({
            kind: 'BackendError',
            name: 'NotFoundError',
            message: `no endpoint found for endpoint handle ${id}`,
            while: 'read',
        } satisfies BackendError)
    }
    const secret = (
        await db
            .select()
            .from(schema.secrets)
            .where(eq(schema.secrets.endpointId, endpoint.id))
            .limit(1)
    )[0]
    if (!secret) {
        return err({
            kind: 'BackendError',
            name: 'NotFoundError',
            message: `no secret found for endpoint handle ${id}`,
            while: 'read',
        } satisfies BackendError)
    }

    return ok(secret.secret)
}

async function writeSecret(
    db: Database,
    id: string,
    secret: string,
): Promise<Result<void, BackendError>> {
    const endpoint = (
        await db
            .select()
            .from(schema.endpoints)
            .where(eq(schema.endpoints.handle, id))
            .limit(1)
    )[0]
    if (!endpoint) {
        return err({
            kind: 'BackendError',
            name: 'NotFoundError',
            message: `no endpoint found for endpoint handle ${id}`,
            while: 'write',
        } satisfies BackendError)
    }

    const existing = (
        await db
            .select()
            .from(schema.secrets)
            .where(eq(schema.secrets.endpointId, endpoint.id))
            .limit(1)
    )[0]

    if (existing) {
        await db
            .update(schema.secrets)
            .set({ secret })
            .where(eq(schema.secrets.endpointId, endpoint.id))
    } else {
        await db
            .insert(schema.secrets)
            .values({ endpointId: endpoint.id, secret })
    }

    return ok()
}

async function deleteSecret(
    db: Database,
    id: string,
): Promise<Result<void, BackendError>> {
    const endpoint = (
        await db
            .select()
            .from(schema.endpoints)
            .where(eq(schema.endpoints.handle, id))
            .limit(1)
    )[0]
    if (!endpoint) {
        return err({
            kind: 'BackendError',
            name: 'NotFoundError',
            message: `no endpoint found for endpoint handle ${id}`,
            while: 'delete',
        } satisfies BackendError)
    }

    await db
        .delete(schema.secrets)
        .where(eq(schema.secrets.endpointId, endpoint.id))

    return ok()
}
