import {
    describeProvider,
    zodEvents,
    createEndpointHandle,
    createRelativeUrl,
    ProviderError,
} from '@hookplane/provider'
import { okAsync, ResultAsync } from 'neverthrow'
import * as z from 'zod'
import { BooqableEvent, createBooqableClient } from '@interlandi-io/booqable'

type BooqableProviderParams = {
    storeUrl: string
    storeKey: string
}

type BooqableEndpointConfig = { receiverUrl: string }

type BooqableProviderState = Record<string, unknown>

function toProviderError(e: unknown): ProviderError {
    const source = e instanceof Error ? e : new Error(String(e))
    return {
        name: 'UnknownError',
        message: source.message,
        source,
    } as ProviderError
}

const BooqableEvents = {
    'app.configured': z.any(),
    'app.installed': z.any(),
    'app.plan_changed': z.any(),
    'app.uninstalled': z.any(),
    'bundle.archived': z.any(),
    'bundle.created': z.any(),
    'bundle.updated': z.any(),
    'bundle_item.archived': z.any(),
    'bundle_item.created': z.any(),
    'bundle_item.updated': z.any(),
    'cart.completed_checkout': z.any(),
    'company.destroyed': z.any(),
    'contract.archived': z.any(),
    'contract.confirmed': z.any(),
    'contract.created': z.any(),
    'contract.signed': z.any(),
    'contract.updated': z.any(),
    'customer.archived': z.any(),
    'customer.created': z.any(),
    'customer.updated': z.any(),
    'invoice.archived': z.any(),
    'invoice.created': z.any(),
    'invoice.finalized': z.any(),
    'invoice.revised': z.any(),
    'invoice.updated': z.any(),
    'order.archived': z.any(),
    'order.canceled': z.any(),
    'order.reserved': z.any(),
    'order.saved_as_concept': z.any(),
    'order.saved_as_draft': z.any(),
    'order.started': z.any(),
    'order.stopped': z.any(),
    'order.updated': z.any(),
    'payment.completed': z.any(),
    'product.created': z.any(),
    'product_group.archived': z.any(),
    'product_group.created': z.any(),
    'product_group.updated': z.any(),
    'quote.archived': z.any(),
    'quote.confirmed': z.any(),
    'quote.created': z.any(),
    'quote.signed': z.any(),
    'quote.updated': z.any(),
} as const

const createBooqableProvider = describeProvider<
    BooqableEvent,
    BooqableProviderParams,
    BooqableEndpointConfig,
    BooqableProviderState
>({
    name: 'booqable',
    events: zodEvents(BooqableEvents),
    setup: () => okAsync({}),
    createEndpoint: ({ url, events, providerConfig }) => {
        const client = createBooqableClient(
            providerConfig.storeUrl,
            providerConfig.storeKey,
        )
        const promises = events.map((event: BooqableEvent) =>
            client.webhookEndpoints.subscribe(url, event),
        )
        return ResultAsync.fromPromise(
            Promise.all(promises).then(() => {
                return createEndpointHandle('endpoint-' + Date.now())
            }),
            toProviderError,
        ).map(() => {})
    },
    readEndpoint: () => {
        return okAsync({
            relativeUrl: createRelativeUrl('/'),
            events: [] as BooqableEvent[],
            config: { receiverUrl: '' },
        })
    },
    updateEndpoint: ({ handle, url, events, providerConfig }) => {
        const client = createBooqableClient(
            providerConfig.storeUrl,
            providerConfig.storeKey,
        )
        return ResultAsync.fromPromise(
            client.webhookEndpoints.update(
                handle,
                url,
                events[0] as BooqableEvent,
            ),
            toProviderError,
        ).map(() => {})
    },
    deleteEndpoint: ({ handle, providerConfig }) => {
        const client = createBooqableClient(
            providerConfig.storeUrl,
            providerConfig.storeKey,
        )
        return ResultAsync.fromPromise(
            client.webhookEndpoints.unsubscribe(handle),
            toProviderError,
        ).map(() => {})
    },
    indexEndpoints: () => {
        throw 'TODO'
    },
})

export { createBooqableProvider }
export type {
    BooqableProviderParams,
    BooqableEndpointConfig,
    BooqableProviderState,
    BooqableEvent,
}
