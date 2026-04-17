import { BackendError, describeBackend } from '@hookplane/backend'
import { createTRPCClient, httpBatchLink, TRPCClient } from '@trpc/client'
import { createAuthorizedHeaders, RemoteBackendRouter } from './trpc.js'
import { ResultAsync } from 'neverthrow'

const DEFAULT_HOOKPLANE_URL = 'https://api.hookplane.com/v1/state'

export type RemoteBackendConfig = {
    token: string
    url?: string
}

type RemoteBackendState = {
    client: TRPCClient<RemoteBackendRouter>,
}

export const createRemoteBackend = describeBackend<RemoteBackendConfig, RemoteBackendState>({
    name: 'remote',
    init: async ({
        url = DEFAULT_HOOKPLANE_URL,
        token,
    }) => {
        const client = createTRPCClient<RemoteBackendRouter>({
            links: [httpBatchLink({
                url,
                headers: createAuthorizedHeaders(token)
            })]
        })
        return { client }
    },
    statefile: {
        read: ({ state: { client } }) =>
            ResultAsync.fromPromise(
                client.statefile.read.query(),
                (e) => toBackendError(e),
            ),
        write: ({ state: { client }, data: statefile }) =>
            ResultAsync.fromPromise( // This can be done shorthand, but this way is more explicit.
                client.statefile.write.mutate({ data: statefile['data'] }), 
                (e) => toBackendError(e),
            ),
        delete: ({ state: { client } }) =>
            ResultAsync.fromPromise(
                client.statefile.delete.mutate(),
                (e) => toBackendError(e),
            ),
    },
    signingSecret: {
        read: ({ state: { client }, id }) =>
            ResultAsync.fromPromise(
                client.signingSecret.read.query({ id }),
                (e) => toBackendError(e),
            ),
        write: ({ state: { client }, id, data }) =>
            ResultAsync.fromPromise(
                client.signingSecret.write.mutate({ id, data }),
                (e) => toBackendError(e),
            ),
        delete: ({ state: { client }, id }) =>
            ResultAsync.fromPromise(
                client.signingSecret.delete.mutate({ id }),
                (e) => toBackendError(e),
            ),
    },
})

function toBackendError(e: unknown): BackendError {
    return e as BackendError // TODO
}
