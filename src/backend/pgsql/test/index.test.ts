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
    fn: (params: { backend: Backend<'event'>; client: Client }) => Promise<void>,
) => {
    it(name, async () => {
        const client = new Client({ connectionString: databaseUrl })
        await client.connect()

        try {
            const backend = await createPgsqlBackend({
                databaseUrl: databaseUrl!,
                runMigrations: true,
            })()

            await fn({ backend, client })
        } finally {
            await client.query('delete from providers')
            await client.query('delete from endpoints')
            await client.query('delete from secrets')

            await client.end()
        }
    })
}

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
            const mockProvider = { name: 'mock' } as Provider
            const create: StateEvent<typeof mockProvider> = {
                tag: 'endpoint.created',
                provider: mockProvider,
                handle: 'handle-duplicate' as EndpointHandle,
                state: {
                    url: 'https://example.com/hooks/mock' as EndpointUrl,
                    events: ['event'],
                    config: {},
                },
            }

            const result = await backend.state.commit([create])
            expect(result.isOk()).toBe(true)

            const resultDuplicate = await backend.state.commit([create])
            expect(resultDuplicate.isErr()).toBe(true)
            const error = resultDuplicate._unsafeUnwrapErr()
            expect(error.name).toBe('WriteRejectedError')
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
            } finally {
                await client.query(
                    'alter table endpoints drop column bad_column',
                )
            }
        },
    )
})
