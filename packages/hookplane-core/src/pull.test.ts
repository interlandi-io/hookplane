import { errAsync } from 'neverthrow'
import { pull } from './pull'
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
} from './provider'

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
        const handle = createEndpointHandle(`handle-${handleCounter++}`)
        const relativeUrl = createRelativeUrl(new URL(url).pathname)
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
            const relativeUrl = createRelativeUrl(new URL(url).pathname)
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

describe('pull', () => {
    beforeEach(() => {
        endpoints.clear()
        handleCounter = 0
    })

    it('pulls subs correctly', async () => {
        const baseUrl = createBaseUrl('https://example.com')
        MockProvider.createEndpoint({
            url: createEndpointUrl(baseUrl, createRelativeUrl('/webhook')),
            events: ['testEvent'],
            providerState: MockProvider.state,
            providerConfig: MockProvider.config,
            endpointConfig: {},
        })
        const state = await pull(baseUrl, providers)

        expect(state.isOk()).toBe(true)
        expect(state._unsafeUnwrap().providerStates['MockProvider']).toEqual(
            new Map([
                [
                    'handle-0' as ReturnType<typeof createEndpointHandle>,
                    {
                        relativeUrl: createRelativeUrl('/webhook'),
                        events: ['testEvent'] as ['testEvent'],
                        config: {},
                    } as EndpointState<typeof MockProvider>,
                ],
            ]),
        )
    })
})
