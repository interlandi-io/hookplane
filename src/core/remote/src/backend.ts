import {
    type BackendError,
    InternalError,
    type NotFoundError,
    type PermissionDeniedError,
    type ServerError,
    type UnknownError,
    type WriteRejectedError,
    type ProviderNotFoundError,
    describeBackend,
} from '@hookplane/backend'
import { createTRPCClient, httpBatchLink, TRPCClient } from '@trpc/client'
import { createAuthorizedHeaders, RemoteBackendRouter } from './trpc.js'
import { ResultAsync } from 'neverthrow'
import {
    fromState,
    parseStatefile,
    type StatefileError,
    ProviderNotFoundError as ProviderNotFoundStatefileError,
} from '@hookplane/core'

const DEFAULT_HOOKPLANE_URL = 'https://api.hookplane.com/v1/state'

export type RemoteBackendConfig = {
    token: string
    url?: string
}

type RemoteBackendState = {
    client: TRPCClient<RemoteBackendRouter>
}

export const createRemoteBackend = describeBackend<
    RemoteBackendConfig,
    RemoteBackendState
>({
    name: 'remote',
    init: async ({ url = DEFAULT_HOOKPLANE_URL, token }) => {
        const client = createTRPCClient<RemoteBackendRouter>({
            links: [
                httpBatchLink({
                    url,
                    headers: createAuthorizedHeaders(token),
                }),
            ],
        })
        return { client }
    },
    state: {
        read: ({ state: { client }, providers }) =>
            ResultAsync.fromPromise(
                (async () => {
                    const data = await client.statefile.read.query()
                    return parseStatefile(data, providers)
                        .map((s) => s.toState())
                        .andThen((r) => r)
                        .mapErr(statefileErrorToBackendError)
                })(),
                (e) => toBackendError(e, 'read'),
            ).andThen((r) => r),

        write: ({ state: { client }, data }) =>
            ResultAsync.fromPromise(
                // This could be done shorthand like ....mutate(statefile),
                // but this is more explicit.
                (async () => {
                    const statefile = fromState(1, data)
                    await client.statefile.write.mutate({
                        data: statefile.data,
                    })
                })(),
                (e) => toBackendError(e, 'write'),
            ),

        delete: ({ state: { client } }) =>
            ResultAsync.fromPromise(client.statefile.delete.mutate(), (e) =>
                toBackendError(e, 'delete'),
            ),
    },

    signingSecret: {
        read: ({ state: { client }, id }) =>
            ResultAsync.fromPromise(
                client.signingSecret.read.query({ id }),
                (e) => toBackendError(e, 'read'),
            ),

        write: ({ state: { client }, id, data }) =>
            ResultAsync.fromPromise(
                client.signingSecret.write.mutate({ id, data }),
                (e) => toBackendError(e, 'write'),
            ),

        delete: ({ state: { client }, id }) =>
            ResultAsync.fromPromise(
                client.signingSecret.delete.mutate({ id }),
                (e) => toBackendError(e, 'delete'),
            ),
    },
})

function toBackendError(
    e: unknown,
    operation: 'read' | 'write' | 'delete',
): BackendError {
    const error = e as {
        kind?: string
        code?: string
        message?: string
        cause?: unknown
        data?: { code?: string; httpStatus?: number }
    }

    const code = error.code ?? error.data?.code

    if (error.kind && error.kind === 'BackendError') {
        return error as BackendError
    }

    if (code) {
        if (code === 'UNAUTHORIZED' || code === 'FORBIDDEN') {
            const cause = error.cause
            return {
                kind: 'BackendError',
                name: 'PermissionDeniedError',
                message: error.message ?? 'unauthorized',
                while: operation,
                ...(cause !== undefined && { cause }),
            } satisfies PermissionDeniedError
        }
        if (code === 'NOT_FOUND') {
            const cause = error.cause
            return {
                kind: 'BackendError',
                name: 'NotFoundError',
                message: error.message ?? 'resource not found',
                while: operation,
                ...(cause !== undefined && { cause }),
            } satisfies NotFoundError
        }
        if (code === 'BAD_REQUEST' && operation === 'write') {
            const cause = error.cause
            return {
                kind: 'BackendError',
                name: 'WriteRejectedError',
                message: error.message ?? 'bad request',
                while: operation,
                ...(cause !== undefined && { cause }),
            } satisfies WriteRejectedError
        }
        if (code === 'INTERNAL_SERVER_ERROR') {
            const cause = error.cause
            return {
                kind: 'BackendError',
                name: 'ServerError',
                message: error.message ?? 'internal server error',
                statusCode: error.data?.httpStatus,
                while: operation,
                ...(cause !== undefined && { cause }),
            } satisfies ServerError
        }
    }

    return {
        kind: 'BackendError',
        name: 'UnknownError',
        message: String(e),
        while: operation,
    } satisfies UnknownError
}

// TODO: this should be very strictly tested
function statefileErrorToBackendError(error: StatefileError): BackendError {
    if (error.name === 'ProviderNotFoundError') {
        return {
            kind: 'BackendError',
            name: 'ProviderNotFoundError',
            message: error.message,
            while: 'read',
            provider: (error as ProviderNotFoundStatefileError).provider,
        } satisfies ProviderNotFoundError
    }
    return {
        kind: 'BackendError',
        name: 'InternalError',
        message: error.message,
        while: 'read',
        cause: error,
    } satisfies InternalError
}
