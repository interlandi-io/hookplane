import { errAsync, okAsync } from 'neverthrow'
import { sync } from '~/sync.js'
import {
    createEndpointHandle,
    EndpointIndex,
    EndpointState,
    Provider,
    NotFoundError,
} from '~/provider.js'
import { createEndpointUrl } from '~/url.js'
import type { EndpointHandle } from '~/endpoint-handle.js'

const endpoints: EndpointIndex<typeof MockProvider> = new Map()
let handleCounter = 0
const MockProvider: Provider<
    'testEvent',
    Record<string, unknown>,
    Record<string, unknown>,
    Record<string, unknown>
> = {
    name: 'Mock',
    events: {
        testEvent: {},
    },
    config: {},
    state: {} as Record<string, unknown>,
    setup() {
        return okAsync({})
    },
    createEndpoint({ url, events, endpointConfig }) {
        const handle = createEndpointHandle(
            `handle-${handleCounter++}`,
        )._unsafeUnwrap()
        endpoints.set(handle, {
            url,
            events,
            config: endpointConfig,
        })
        return okAsync({
            handle,
        })
    },
    readEndpoint() {
        throw ''
    },
    deleteEndpoint({ handle }) {
        endpoints.delete(handle)
        return okAsync()
    },
    updateEndpoint({ url, handle, events, endpointConfig }) {
        const endpoint = endpoints.get(handle)
        if (endpoint) {
            endpoints.set(handle, {
                url,
                events,
                config: endpointConfig,
            })
            return okAsync()
        } else {
            return errAsync({
                name: 'NotFoundError',
                message: 'resource not found',
                source: new Error(),
            } as NotFoundError)
        }
    },
    indexEndpoints() {
        return okAsync(endpoints)
    },
    processRequest() {
        return okAsync({
            event: 'testEvent' as const,
            data: {},
        })
    },
}

const providers = {
    MockProvider,
}

describe('sync', () => {
    beforeEach(() => {
        endpoints.clear()
        handleCounter = 0
    })

    it('pulls endpoints correctly', async () => {
        MockProvider.createEndpoint({
            url: createEndpointUrl(
                'https://example.com/webhook',
            )._unsafeUnwrap(),
            events: ['testEvent'],
            providerState: MockProvider.state,
            providerConfig: MockProvider.config,
            endpointConfig: {},
        })
        const state = await sync(providers)

        expect(state.isOk()).toBe(true)
        expect(state._unsafeUnwrap().providerStates['MockProvider']).toEqual(
            new Map([
                [
                    'handle-0' as EndpointHandle,
                    {
                        url: createEndpointUrl(
                            'https://example.com/webhook',
                        )._unsafeUnwrap(),
                        events: ['testEvent'] as ['testEvent'],
                        config: {},
                    } as EndpointState<typeof MockProvider>,
                ],
            ]),
        )
    })

    it('throws an error when the provider fails to index endpoints', async () => {
        const errorProvider: Provider<'testEvent', object, object, object> = {
            name: 'ErrorProvider',
            events: {
                testEvent: {},
            },
            config: {},
            state: {},
            setup() {
                return okAsync({})
            },
            createEndpoint() {
                throw new Error('not implemented')
            },
            readEndpoint() {
                throw new Error('not implemented')
            },
            deleteEndpoint() {
                throw new Error('not implemented')
            },
            updateEndpoint() {
                throw new Error('not implemented')
            },
            indexEndpoints() {
                return errAsync({
                    name: 'UnknownError' as const,
                    message: `an error occurred: index failed`,
                    source: new Error('index failed'),
                })
            },
            processRequest() {
                return okAsync({
                    event: 'testEvent' as const,
                    data: {},
                })
            },
        }

        const errorProviders = { ErrorProvider: errorProvider }
        const result = await sync(errorProviders)

        expect(result.isErr()).toBe(true)
        const error = result._unsafeUnwrapErr()
        expect(error.name).toBe('SyncError')
        expect(error.message.includes(
            'failed to index endpoints for provider ErrorProvider',
        )).toBe(true)
    })
})
