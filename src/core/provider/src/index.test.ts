import z from 'zod'
import { errAsync, ok, okAsync, ResultAsync } from 'neverthrow'
import {
    createEndpointHandle,
    createRelativeUrl,
    describeProvider,
    EndpointHandle,
    EndpointUrl,
    ProviderError,
} from '.'
import {
    zodEvents
} from './zod'

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
        return event ? okAsync({
            event: event as ProviderEvent,
            data: {},
        }) : errAsync({} as ProviderError)
    },
    mockRequest: ({ url, event }) => {
        const request = new Request(url, {
            headers: {
                'event_type': event,
            }
        })
        return ok({
            request
        })
    },
})

describe('provider', () => {
    it('mocks', async () => {
        const result = await Provider({ slug: '', apiKey: '' })
        expect(result.isOk()).toBe(true)
        const provider = result._unsafeUnwrap()

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

    it('throws when `features.requiresSigningSecret` is `true`, but `processRequest` is not defined', () => {
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
                    return okAsync({
                        handle: createEndpointHandle(
                            'handle-0',
                        )._unsafeUnwrap(),
                    })
                },
                readEndpoint: () => {
                    return okAsync({
                        relativeUrl:
                            createRelativeUrl('/hooks')._unsafeUnwrap(),
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
                    return ResultAsync.fromSafePromise(
                        Promise.resolve(new Map()),
                    )
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
