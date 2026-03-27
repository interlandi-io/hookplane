import {
    describeProvider,
    zodEvents,
    createEndpointHandle,
    createRelativeUrl,
    ProviderError,
    UnknownError,
    RequestSignatureValidationError,
} from '@hookplane/provider'
import { okAsync, errAsync, ResultAsync } from 'neverthrow'
import Stripe from 'stripe'
import { StripeEvents, type StripeEvent } from './events'

type StripeProviderConfig = {
    apiKey: string
    config?: Stripe.StripeConfig
    webhookSecret: string
}

type StripeEndpointConfig = {
    name: string
    description?: string
    metadata?: Stripe.MetadataParam
    eventPayload: 'thin' | 'snapshot'
}

type StripeProviderState = {
    stripe: Stripe
    webhookSecret: string
}

// TODO: map these to the actual Provider error types
function toProviderError(e: unknown): ProviderError {
    const source = e instanceof Error ? e : new Error(String(e))
    return {
        name: 'UnknownError',
        message: `an error occurred: ${source.message}`,
        source,
    } as UnknownError
}

function toSignatureError(
    message: string,
    source: Error,
    handle: string,
): ProviderError {
    return {
        name: 'RequestSignatureValidationError',
        message: `failed to validate request signature: ${message}`,
        source,
        endpointHandle: createEndpointHandle(handle),
    } as RequestSignatureValidationError
}

const createStripeProvider = describeProvider<
    StripeEvent,
    StripeProviderConfig,
    StripeEndpointConfig,
    StripeProviderState
>({
    name: 'stripe',
    events: zodEvents(StripeEvents),
    setup: ({ apiKey, config, webhookSecret }) => {
        const stripe = new Stripe(apiKey, config)
        return okAsync({ stripe, webhookSecret })
    },
    createEndpoint: ({
        url,
        events,
        endpointConfig,
        providerState: { stripe },
    }) => {
        const p = stripe.v2.core.eventDestinations.create({
            name: endpointConfig.name,
            description: endpointConfig.description,
            metadata: endpointConfig.metadata,
            type: 'webhook_endpoint',
            event_payload: endpointConfig.eventPayload as 'thin' | 'snapshot',
            enabled_events: events,
            webhook_endpoint: {
                url,
            },
        })
        return ResultAsync.fromPromise(p, toProviderError).map(() => {})
    },
    readEndpoint: ({ handle, providerState: { stripe } }) => {
        const p = stripe.v2.core.eventDestinations.retrieve(handle, {
            include: ['webhook_endpoint.url'],
        })
        return ResultAsync.fromPromise(p, toProviderError).map((res) => {
            const endpointUrl = res.webhook_endpoint?.url
            if (!endpointUrl) {
                throw new Error('no endpoint url given')
            }
            const invalidEvents = getInvalidEvents(res.enabled_events)
            if (invalidEvents.length > 0) {
                throw new Error(
                    `event(s) ${invalidEvents.join(', ')} are/is invalid`,
                )
            }
            const pathname = new URL(endpointUrl).pathname
            return {
                relativeUrl: createRelativeUrl(pathname),
                events: res.enabled_events as StripeEvent[],
                config: {
                    name: res.name,
                    description: res.description,
                    metadata: res.metadata ?? undefined,
                    eventPayload: res.event_payload as 'thin' | 'snapshot',
                },
            }
        })
    },
    updateEndpoint: ({
        handle,
        url,
        events,
        providerState: { stripe },
        endpointConfig,
    }) => {
        const p = stripe.v2.core.eventDestinations.update(handle, {
            name: endpointConfig.name,
            description: endpointConfig.description,
            metadata: endpointConfig.metadata,
            enabled_events: events,
            webhook_endpoint: {
                url,
            },
        })
        return ResultAsync.fromPromise(p, toProviderError).map(() => {})
    },
    deleteEndpoint: ({ handle, providerState: { stripe } }) => {
        const p = stripe.v2.core.eventDestinations.del(handle)
        return ResultAsync.fromPromise(p, toProviderError).map(() => {})
    },
    indexEndpoints: ({ providerState: { stripe } }) => {
        const index = new Map()
        const p = stripe.v2.core.eventDestinations.list({
            include: ['webhook_endpoint.url'],
        })
        return ResultAsync.fromPromise(
            p.autoPagingEach((dest) => {
                const endpointUrl = dest.webhook_endpoint?.url
                if (!endpointUrl) {
                    return true
                }
                const invalidEvents = getInvalidEvents(dest.enabled_events)
                if (invalidEvents.length > 0) {
                    throw new Error(
                        `event(s) ${invalidEvents.join(', ')} are/is invalid`,
                    )
                }
                const pathname = new URL(endpointUrl).pathname
                index.set(createEndpointHandle(dest.id), {
                    relativeUrl: createRelativeUrl(pathname),
                    events: dest.enabled_events as StripeEvent[],
                    config: {
                        name: dest.name,
                        description: dest.description,
                        metadata: dest.metadata ?? undefined,
                        eventPayload: dest.event_payload as 'thin' | 'snapshot',
                    },
                })
                return true
            }),
            toProviderError,
        ).map(() => index)
    },
    validateRequestSignature: ({
        body,
        headers,
        handle,
        providerState: { stripe, webhookSecret },
    }) => {
        const signature = headers['stripe-signature']
        if (!signature) {
            return errAsync(
                toSignatureError(
                    'missing stripe signature header',
                    new Error('missing stripe signature header'),
                    handle,
                ),
            )
        }

        try {
            stripe.webhooks.constructEvent(body, signature, webhookSecret)
            return okAsync(undefined)
        } catch (e) {
            const error = e instanceof Error ? e : new Error(String(e))
            return errAsync(
                toSignatureError('invalid stripe signature', error, handle),
            )
        }
    },
})

function getInvalidEvents(events: string[]): string[] {
    const invalid: string[] = []
    for (const event of events) {
        if (!Object.keys(StripeEvents).includes(event)) {
            invalid.push(event)
        }
    }
    return invalid
}

export { createStripeProvider }
export type {
    StripeProviderConfig,
    StripeEndpointConfig,
    StripeProviderState,
    StripeEvent,
}
