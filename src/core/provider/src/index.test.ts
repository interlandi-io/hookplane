import z from 'zod'
import { errAsync, ok, okAsync, ResultAsync } from 'neverthrow'
import {
    createEndpointHandle,
    createRelativeUrl,
    describeProvider,
    EndpointHandle,
    EndpointUrl,
    ProviderError,
} from './index.js'
import { zodEvents } from './zod.js'

type ProviderEvent =
    | 'checkout.started'
    | 'checkout.completed'
    | 'checkout.abandoned'

type ProviderParams = {
    slug: string
    apiKey: string
}

type EventParams = {
    fields: string[]
}

type ProviderState = object

const Provider = describeProvider<
    ProviderEvent,
    ProviderParams,
    EventParams,
    ProviderState
>({
    name: 'Provider',
    events: zodEvents({
        'checkout.started': z.object({ userId: z.string() }),
        'checkout.completed': z.object({ userId: z.string() }),
        'checkout.abandoned': z.object({ userId: z.string() }),
    }),
    setup: () => okAsync({}),
    createEndpoint: () => {
        return okAsync({
            handle: createEndpointHandle('handle-0')._unsafeUnwrap(),
        })
    },
    readEndpoint: () => {
        return okAsync({
            relativeUrl: createRelativeUrl('/hooks')._unsafeUnwrap(),
            events: [],
            config: {
                fields: [],
            },
        })
    },
    updateEndpoint: () => {
        return okAsync()
    },
    deleteEndpoint: () => {
        return okAsync()
    },
    indexEndpoints: () => {
        return ResultAsync.fromSafePromise(Promise.resolve(new Map()))
    },
    processRequest: ({ request: req }) => {
        const event = req.headers.get('event_type')
        return event
            ? okAsync({
                  event: event as ProviderEvent,
                  data: {},
              })
            : errAsync({} as ProviderError)
    },
    mockRequest: ({ url, event }) => {
        const request = new Request(url, {
            headers: {
                event_type: event,
            },
        })
        return ok({
            request,
        })
    },
})

describe('provider', () => {
    it('mocks', async () => {
        const provider = await Provider({ slug: '', apiKey: '' })

        expect(provider.processRequest).toBeDefined()
        expect(provider.mockRequest).toBeDefined()

        const valid = provider.mockRequest!({
            url: 'https://example.com/hooks' as EndpointUrl,
            event: 'checkout.abandoned',
            providerState: provider.state,
            providerConfig: provider.config,
        })._unsafeUnwrap().request
        const processed = await provider.processRequest!({
            request: valid,
            handle: '' as EndpointHandle,
            providerState: provider.state,
            providerConfig: provider.config,
        })
        expect(processed.isOk()).toBe(true)
        expect(processed._unsafeUnwrap().event).toEqual('checkout.abandoned')
    })

    // TODO: this feature doesn't exist yet.
    it.skip('throws when `features.requiresSigningSecret` is `true`, but `processRequest` is not defined', () => {
        const f = () => {
            describeProvider<
                ProviderEvent,
                ProviderParams,
                EventParams,
                ProviderState
            >({
                name: 'Provider',
                features: {
                    requiresSigningSecret: true,
                },
                events: zodEvents({
                    'checkout.started': z.object({ userId: z.string() }),
                    'checkout.completed': z.object({ userId: z.string() }),
                    'checkout.abandoned': z.object({ userId: z.string() }),
                }),
                setup: () => okAsync({}),
                createEndpoint: () => {
                    throw 'unimplemented'
                },
                readEndpoint: () => {
                    throw 'unimplemented'
                },
                updateEndpoint: () => {
                    throw 'unimplemented'
                },
                deleteEndpoint: () => {
                    throw 'unimplemented'
                },
                indexEndpoints: () => {
                    throw 'unimplemented'
                },
                processRequest: () => {
                    throw 'unimplemented'
                },
            })
        }
        expect(f).toThrow({
            name: 'ProviderFeaturesMismatchError',
            message:
                'features.requiresSigningSecret is true, but processRequest is not defined',
        })
    })
})
