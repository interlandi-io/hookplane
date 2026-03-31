import { errAsync } from 'neverthrow'
import { sync } from '~/sync'
import { okAsync } from 'neverthrow'
import {
    createBaseUrl,
    createEndpointHandle,
    createEndpointUrl,
    createRelativeUrl,
    EndpointIndex,
    EndpointState,
    Provider,
    NotFoundError,
    type EndpointHandle,
} from '~/provider'

const endpoints: EndpointIndex<typeof MockProvider> = new Map()
let handleCounter = 0
const MockProvider: Provider<'testEvent', object, object, object> = {
    name: 'Mock',
    events: {
        testEvent: {},
    },
    config: {},
    state: {},
    setup() {
        return okAsync({})
    },
    createEndpoint({ url, events, endpointConfig }) {
        const handle = createEndpointHandle(
            `handle-${handleCounter++}`,
        )._unsafeUnwrap()
        const relativeUrl = createRelativeUrl(
            new URL(url).pathname,
        )._unsafeUnwrap()
        endpoints.set(handle, {
            relativeUrl,
            events,
            config: endpointConfig,
        })
        return okAsync()
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
            const relativeUrl = createRelativeUrl(
                new URL(url).pathname,
            )._unsafeUnwrap()
            endpoints.set(handle, {
                relativeUrl,
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
        const baseUrl = createBaseUrl('https://example.com')._unsafeUnwrap()
        MockProvider.createEndpoint({
            url: createEndpointUrl(
                baseUrl,
                createRelativeUrl('/webhook')._unsafeUnwrap(),
            )._unsafeUnwrap(),
            events: ['testEvent'],
            providerState: MockProvider.state,
            providerConfig: MockProvider.config,
            endpointConfig: {},
        })
        const state = await sync(baseUrl, providers)

        expect(state.isOk()).toBe(true)
        expect(state._unsafeUnwrap().providerStates['MockProvider']).toEqual(
            new Map([
                [
                    'handle-0' as EndpointHandle,
                    {
                        relativeUrl:
                            createRelativeUrl('/webhook')._unsafeUnwrap(),
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
        }

        const errorProviders = { ErrorProvider: errorProvider }
        const baseUrl = createBaseUrl('https://example.com')._unsafeUnwrap()
        const result = await sync(baseUrl, errorProviders)

        expect(result.isErr()).toBe(true)
        const error = result._unsafeUnwrapErr()
        expect(error.name).toBe('SyncError')
        expect(error.message).toBe(
            'failed to index endpoints for provider ErrorProvider',
        )
    })
})
