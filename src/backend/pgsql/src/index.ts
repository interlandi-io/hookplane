import {
    BackendError,
    describeBackend,
    StateEvent,
    WriteRejectedError,
    BackendOperation,
    InternalError,
    NotFoundError,
    UnknownError,
} from '@hookplane/backend'
import { drizzle } from 'drizzle-orm/node-postgres'
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
import { eq } from 'drizzle-orm'
import { err, ok, Result, ResultAsync } from 'neverthrow'

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
        commit({ state: { db }, events }) {
            const results: ResultAsync<void, BackendError>[] = events.map(
                (event) =>
                    ResultAsync.fromPromise(commitEvent(db, event), (e) =>
                        toBackendError(e, 'write'),
                    ),
            )
            return ResultAsync.combine(results).map(() => {})
        },
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

async function commitEvent(db: Database, event: StateEvent<Provider>) {
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
                while: 'write',
            } satisfies WriteRejectedError
        }
        provider = inserted
    }

    switch (event.tag) {
        case 'endpoint.created':
            await db.insert(schema.endpoints).values({
                providerId: provider.id,
                // TODO: validate handle/url and roll transaction back if invalid
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
                    while: 'write',
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
                    while: 'write',
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
            message:
                (e as { message?: string }).message ||
                'unique constraint violation',
            while: operation,
        } satisfies WriteRejectedError
    }

    const error = e as NodeJS.ErrnoException & { code?: string }

    if (error.code === PGSQL_UNIQUE_VIOLATION) {
        return {
            kind: 'BackendError',
            name: 'WriteRejectedError',
            message:
                (e as { message?: string }).message ||
                'unique constraint violation',
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
