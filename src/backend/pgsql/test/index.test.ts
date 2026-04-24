import { Client } from 'pg'
import { createPgsqlBackend } from '~/index.js'
import { Backend, StateEvent } from '@hookplane/backend'
import { EndpointHandle, EndpointUrl, Provider } from '@hookplane/core'
import * as schema from '../src/db/schema.js'

const CONN_TIMEOUT = 10_000
const CONN_RETRY_DELAY = 500
const databaseUrl = process.env['DATABASE_URL']
const describeIntegration = databaseUrl ? describe : describe.skip

const itWrapped = (
    name: string,
    fn: (params: {
        backend: Backend<'event'>
        client: Client
    }) => Promise<void>,
) => {
    it(name, async () => {
        const client = new Client({ connectionString: databaseUrl })
        await client.connect()

        try {
            const backend = await createPgsqlBackend({
                databaseUrl: databaseUrl!,
                runMigrations: true,
            })

            await fn({ backend, client })
        } finally {
            await client.query('delete from providers')
            await client.query('delete from endpoints')
            await client.query('delete from secrets')

            await client.end()
        }
    })
}

const makeProvider = (name = 'mock') => ({ name }) as Provider

const makeCreateEvent = (
    provider: Provider,
    handle = 'handle-0',
    state: {
        url?: EndpointUrl
        events?: string[]
        config?: Record<string, unknown>
    } = {},
): StateEvent<typeof provider> => ({
    tag: 'endpoint.created',
    provider,
    handle: handle as EndpointHandle,
    state: {
        url: state.url ?? ('https://example.com/hooks/mock' as EndpointUrl),
        events: state.events ?? ['event'],
        config: state.config ?? {},
    },
})

describeIntegration('pgsql backend', () => {
    beforeAll(async () => {
        // Wait for the db to be ready to connect, since it starts immediately before
        // this test in CI.
        const start = Date.now()
        while (true) {
            const client = new Client({ connectionString: databaseUrl })
            try {
                await client.connect()
                await client.query('select 1')
            } catch {
                await client.end()
                if (Date.now() - start > CONN_TIMEOUT) {
                    throw new Error('database connection timed out')
                }
                await new Promise((res) => setTimeout(res, CONN_RETRY_DELAY))
                continue
            }
            await client.end()
            break
        }
    })

    itWrapped(
        'initializes and runs migrations',
        async ({ backend, client }) => {
            expect(backend.name).toBe('pgsql')
            const tables = await client.query<{
                providers: string
                endpoints: string
                secrets: string
            }>(`
            select
                to_regclass('public.providers') as providers,
                to_regclass('public.endpoints') as endpoints,
                to_regclass('public.secrets') as secrets
        `)

            expect(tables.rows[0]).toEqual({
                providers: 'providers',
                endpoints: 'endpoints',
                secrets: 'secrets',
            })
        },
    )

    itWrapped('applies events', async ({ backend, client }) => {
        const providersBefore = await client.query('select * from providers')
        const endpointsBefore = await client.query('select * from endpoints')
        expect(providersBefore.rowCount).toBe(0)
        expect(endpointsBefore.rowCount).toBe(0)

        const mockProvider = { name: 'mock' } as Provider
        const create: StateEvent<typeof mockProvider> = {
            tag: 'endpoint.created',
            provider: mockProvider,
            handle: 'handle-0' as EndpointHandle,
            state: {
                url: 'https://example.com/hooks/mock' as EndpointUrl,
                events: ['event'],
                config: {},
            },
        }
        const update: StateEvent<typeof mockProvider> = {
            tag: 'endpoint.updated',
            provider: mockProvider,
            handle: 'handle-0' as EndpointHandle,
            before: {
                url: 'https://example.com/hooks/mock' as EndpointUrl,
                events: ['event'],
                config: {},
            },
            after: {
                url: 'https://example.com/hooks/mock' as EndpointUrl,
                events: ['event', 'event2'],
                config: {},
            },
        }
        const _delete: StateEvent<typeof mockProvider> = {
            tag: 'endpoint.deleted',
            provider: mockProvider,
            handle: 'handle-0' as EndpointHandle,
        }

        let result = await backend.state.commit([create])
        expect(result.isOk()).toBe(true)
        const providersAfterCreate = await client.query<
            (typeof schema)['providers']
        >('select * from providers')
        const endpointsAfterCreate = await client.query<
            (typeof schema)['endpoints']
        >('select * from endpoints')
        expect(providersAfterCreate.rowCount).toBe(1)
        expect(providersAfterCreate.rows[0]?.name).toBe('mock')
        expect(endpointsAfterCreate.rowCount).toBe(1)
        expect(endpointsAfterCreate.rows[0]?.handle).toBe('handle-0')

        result = await backend.state.commit([update])
        expect(result.isOk()).toBe(true)
        const providersAfterUpdate = await client.query<
            (typeof schema)['providers']
        >('select * from providers')
        const endpointsAfterUpdate = await client.query<
            (typeof schema)['endpoints']
        >('select * from endpoints')
        expect(providersAfterUpdate.rowCount).toBe(1)
        expect(providersAfterUpdate.rows[0]?.name).toBe('mock')
        expect(endpointsAfterUpdate.rowCount).toBe(1)
        expect(endpointsAfterUpdate.rows[0]?.handle).toBe('handle-0')
        expect(endpointsAfterUpdate.rows[0]?.events).toContainEqual('event')
        expect(endpointsAfterUpdate.rows[0]?.events).toContainEqual('event2')

        result = await backend.state.commit([_delete])
        expect(result.isOk()).toBe(true)
        const providersAfterDelete = await client.query<
            (typeof schema)['providers']
        >('select * from providers')
        const endpointsAfterDelete = await client.query<
            (typeof schema)['endpoints']
        >('select * from endpoints')
        expect(providersAfterDelete.rowCount).toBe(0)
        expect(endpointsAfterDelete.rowCount).toBe(0)
    })

    itWrapped(
        'returns WriteRejectedError on unique constraint violation',
        async ({ backend }) => {
            const mockProvider = makeProvider()
            const create = makeCreateEvent(mockProvider, 'handle-duplicate')

            const result = await backend.state.commit([create])
            expect(result.isOk()).toBe(true)

            const resultDuplicate = await backend.state.commit([create])
            expect(resultDuplicate.isErr()).toBe(true)
            const error = resultDuplicate._unsafeUnwrapErr()
            expect(error.name).toBe('WriteRejectedError')
            expect(error.while).toBe('write')
        },
    )

    itWrapped(
        'returns NotFoundError when updating non-existent endpoint',
        async ({ backend }) => {
            const mockProvider = { name: 'mock' } as Provider
            const update: StateEvent<typeof mockProvider> = {
                tag: 'endpoint.updated',
                provider: mockProvider,
                handle: 'non-existent-handle' as EndpointHandle,
                before: {
                    url: 'https://example.com/hooks/mock' as EndpointUrl,
                    events: ['event'],
                    config: {},
                },
                after: {
                    url: 'https://example.com/hooks/mock-updated' as EndpointUrl,
                    events: ['event'],
                    config: {},
                },
            }

            const result = await backend.state.commit([update])
            expect(result.isErr()).toBe(true)
            const error = result._unsafeUnwrapErr()
            expect(error.name).toBe('NotFoundError')
            expect(error.while).toBe('write')
        },
    )

    itWrapped(
        'returns NotFoundError when deleting non-existent endpoint',
        async ({ backend }) => {
            const mockProvider = { name: 'mock' } as Provider
            const _delete: StateEvent<typeof mockProvider> = {
                tag: 'endpoint.deleted',
                provider: mockProvider,
                handle: 'non-existent-handle' as EndpointHandle,
            }

            const result = await backend.state.commit([_delete])
            expect(result.isErr()).toBe(true)
            const error = result._unsafeUnwrapErr()
            expect(error.name).toBe('NotFoundError')
            expect(error.while).toBe('write')
        },
    )

    itWrapped(
        'returns UnknownError on generic postgres error',
        async ({ backend, client }) => {
            await client.query(
                'alter table endpoints add column bad_column int not null',
            )
            try {
                const mockProvider = { name: 'mock' } as Provider
                const create: StateEvent<typeof mockProvider> = {
                    tag: 'endpoint.created',
                    provider: mockProvider,
                    handle: 'handle-err' as EndpointHandle,
                    state: {
                        url: 'https://example.com/hooks/mock' as EndpointUrl,
                        events: ['event'],
                        config: {},
                    },
                }

                const result = await backend.state.commit([create])
                expect(result.isErr()).toBe(true)
                const error = result._unsafeUnwrapErr()
                expect(error.name).toBe('UnknownError')
                expect(error.while).toBe('write')
            } finally {
                await client.query(
                    'alter table endpoints drop column bad_column',
                )
            }
        },
    )

    itWrapped('reads state for a single provider', async ({ backend }) => {
        const mockProvider = makeProvider()
        const create = makeCreateEvent(mockProvider, 'handle-read-one', {
            url: 'https://example.com/hooks/read-one' as EndpointUrl,
            events: ['event', 'event2'],
            config: { enabled: true },
        })

        const commitResult = await backend.state.commit([create])
        expect(commitResult.isOk()).toBe(true)

        const result = await backend.state.read({ mock: mockProvider })
        expect(result.isOk()).toBe(true)

        const state = result._unsafeUnwrap()
        const providerState = state.providerStates['mock']
        expect(providerState).toBeDefined()
        expect(providerState.size).toBe(1)
        expect(providerState.get('handle-read-one' as EndpointHandle)).toEqual({
            url: 'https://example.com/hooks/read-one',
            events: ['event', 'event2'],
            config: { enabled: true },
        })
    })

    itWrapped(
        'reads state for multiple endpoints and providers',
        async ({ backend }) => {
            const mockProvider = makeProvider('mock')
            const secondProvider = makeProvider('second')

            const resultCommit = await backend.state.commit([
                makeCreateEvent(mockProvider, 'handle-read-a', {
                    url: 'https://example.com/hooks/a' as EndpointUrl,
                    events: ['event-a'],
                    config: { order: 1 },
                }),
                makeCreateEvent(mockProvider, 'handle-read-b', {
                    url: 'https://example.com/hooks/b' as EndpointUrl,
                    events: ['event-b'],
                    config: { order: 2 },
                }),
                makeCreateEvent(secondProvider, 'handle-read-c', {
                    url: 'https://example.com/hooks/c' as EndpointUrl,
                    events: ['event-c'],
                    config: { order: 3 },
                }),
            ])

            expect(resultCommit.isOk()).toBe(true)

            const result = await backend.state.read({
                mock: mockProvider,
                second: secondProvider,
            })
            expect(result.isOk()).toBe(true)

            const state = result._unsafeUnwrap()
            expect(state.providerStates['mock'].size).toBe(2)
            expect(state.providerStates['second'].size).toBe(1)
            expect(
                state.providerStates['mock'].get(
                    'handle-read-b' as EndpointHandle,
                ),
            ).toEqual({
                url: 'https://example.com/hooks/b',
                events: ['event-b'],
                config: { order: 2 },
            })
            expect(
                state.providerStates['second'].get(
                    'handle-read-c' as EndpointHandle,
                ),
            ).toEqual({
                url: 'https://example.com/hooks/c',
                events: ['event-c'],
                config: { order: 3 },
            })
        },
    )

    itWrapped(
        'returns ProviderNotFoundError when reading a provider that does not exist',
        async ({ backend }) => {
            const missingProvider = makeProvider('missing')

            const result = await backend.state.read({
                missing: missingProvider,
            })
            expect(result.isErr()).toBe(true)

            const error = result._unsafeUnwrapErr()
            expect(error.name).toBe('ProviderNotFoundError')
            expect(error.while).toBe('read')
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            expect((error as any).provider).toBe('missing')
        },
    )

    itWrapped(
        'returns InternalError when reading an invalid endpoint handle',
        async ({ backend, client }) => {
            const providerInsert = await client.query<{ id: number }>(
                `insert into providers (name) values ('mock') returning id`,
            )
            await client.query(
                `insert into endpoints (provider_id, handle, url, events, config)
                 values ($1, $2, $3, $4, $5)`,
                [
                    providerInsert.rows[0]!.id,
                    '',
                    'https://example.com/hooks/mock',
                    ['event'],
                    {},
                ],
            )

            const result = await backend.state.read({ mock: makeProvider() })
            expect(result.isErr()).toBe(true)

            const error = result._unsafeUnwrapErr()
            expect(error.name).toBe('InternalError')
            expect(error.while).toBe('read')
        },
    )

    itWrapped(
        'returns InternalError when reading an invalid endpoint url',
        async ({ backend, client }) => {
            const providerInsert = await client.query<{ id: number }>(
                `insert into providers (name) values ('mock') returning id`,
            )
            await client.query(
                `insert into endpoints (provider_id, handle, url, events, config)
                 values ($1, $2, $3, $4, $5)`,
                [
                    providerInsert.rows[0]!.id,
                    'handle-invalid-url',
                    'not-a-url',
                    ['event'],
                    {},
                ],
            )

            const result = await backend.state.read({ mock: makeProvider() })
            expect(result.isErr()).toBe(true)

            const error = result._unsafeUnwrapErr()
            expect(error.name).toBe('InternalError')
            expect(error.while).toBe('read')
        },
    )

    itWrapped(
        'writes and reads signing secrets',
        async ({ backend, client }) => {
            const provider = makeProvider()
            const handle = 'handle-secret-read'
            const create = makeCreateEvent(provider, handle)

            const commitResult = await backend.state.commit([create])
            expect(commitResult.isOk()).toBe(true)

            const writeResult = await backend.signingSecret.write(
                handle,
                'whsec_test_123',
            )
            expect(writeResult.isOk()).toBe(true)

            const secrets = await client.query<(typeof schema)['secrets']>(
                'select * from secrets',
            )
            expect(secrets.rowCount).toBe(1)
            expect(secrets.rows[0]?.secret).toBe('whsec_test_123')

            const readResult = await backend.signingSecret.read(handle)
            expect(readResult.isOk()).toBe(true)
            expect(readResult._unsafeUnwrap()).toBe('whsec_test_123')
        },
    )

    itWrapped(
        'updates an existing signing secret without creating a duplicate row',
        async ({ backend, client }) => {
            const provider = makeProvider()
            const handle = 'handle-secret-update'
            const create = makeCreateEvent(provider, handle)

            expect((await backend.state.commit([create])).isOk()).toBe(true)
            expect(
                (await backend.signingSecret.write(handle, 'whsec_old')).isOk(),
            ).toBe(true)
            expect(
                (await backend.signingSecret.write(handle, 'whsec_new')).isOk(),
            ).toBe(true)

            const secrets = await client.query<(typeof schema)['secrets']>(
                'select * from secrets',
            )
            expect(secrets.rowCount).toBe(1)
            expect(secrets.rows[0]?.secret).toBe('whsec_new')
        },
    )

    itWrapped('deletes a signing secret', async ({ backend, client }) => {
        const provider = makeProvider()
        const handle = 'handle-secret-delete'
        const create = makeCreateEvent(provider, handle)

        expect((await backend.state.commit([create])).isOk()).toBe(true)
        expect(
            (await backend.signingSecret.write(handle, 'whsec_delete')).isOk(),
        ).toBe(true)

        const deleteResult = await backend.signingSecret.delete(handle)
        expect(deleteResult.isOk()).toBe(true)

        const secrets = await client.query<(typeof schema)['secrets']>(
            'select * from secrets',
        )
        expect(secrets.rowCount).toBe(0)
    })

    itWrapped(
        'returns NotFoundError when reading a signing secret for a missing endpoint',
        async ({ backend }) => {
            const result = await backend.signingSecret.read('missing-endpoint')
            expect(result.isErr()).toBe(true)

            const error = result._unsafeUnwrapErr()
            expect(error.name).toBe('NotFoundError')
            expect(error.while).toBe('read')
        },
    )

    itWrapped(
        'returns NotFoundError when reading a signing secret that does not exist',
        async ({ backend }) => {
            const provider = makeProvider()
            const handle = 'handle-secret-missing'
            expect(
                (
                    await backend.state.commit([
                        makeCreateEvent(provider, handle),
                    ])
                ).isOk(),
            ).toBe(true)

            const result = await backend.signingSecret.read(handle)
            expect(result.isErr()).toBe(true)

            const error = result._unsafeUnwrapErr()
            expect(error.name).toBe('NotFoundError')
            expect(error.while).toBe('read')
        },
    )

    itWrapped(
        'returns NotFoundError when writing a signing secret for a missing endpoint',
        async ({ backend }) => {
            const result = await backend.signingSecret.write(
                'missing-endpoint',
                'whsec_missing',
            )
            expect(result.isErr()).toBe(true)

            const error = result._unsafeUnwrapErr()
            expect(error.name).toBe('NotFoundError')
            expect(error.while).toBe('write')
        },
    )

    itWrapped(
        'returns NotFoundError when deleting a signing secret for a missing endpoint',
        async ({ backend }) => {
            const result =
                await backend.signingSecret.delete('missing-endpoint')
            expect(result.isErr()).toBe(true)

            const error = result._unsafeUnwrapErr()
            expect(error.name).toBe('NotFoundError')
            expect(error.while).toBe('delete')
        },
    )
})
