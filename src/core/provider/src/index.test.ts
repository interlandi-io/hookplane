import z from 'zod'
import { okAsync, ResultAsync } from 'neverthrow'
import { createRelativeUrl, describeProvider, zodEvents } from '.'

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
        return okAsync()
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
})

describe('provider', () => {
    it('mocks', async () => {
        const provider = await Provider({ slug: '', apiKey: '' })
        expect(provider.isOk()).toBe(true)

        const event = provider._unsafeUnwrap()!.events['checkout.started']
        expect(event).toBeDefined()

        expect(event.mock).toBeDefined()
        expect(event.parse).toBeDefined()

        const data = event.mock!()
        const valid = event.parse!(data)
        expect(valid.isOk()).toBe(true)
    })
})
