import {
    describeProvider,
    createEndpointHandle,
    createRelativeUrl,
    ProviderError,
    UnknownError,
    RequestSignatureValidationError,
    InvalidResponseError,
    ProcessRequestReturn,
} from '@hookplane/provider'
import { okAsync, errAsync, ResultAsync, err, ok } from 'neverthrow'
import Stripe from 'stripe'
import { StripeEvents, type StripeEvent } from './events'

type StripeProviderConfig = {
    apiKey: string
    config?: Stripe.StripeConfig
}

type StripeEndpointConfig = {
    name: string
    description?: string
    metadata?: Stripe.MetadataParam
    eventPayload: 'thin' | 'snapshot'
}

type StripeProviderState = {
    stripe: Stripe
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
    events: StripeEvents,
    features: {
        requiresSigningSecret: true,
    },
    setup: ({ apiKey, config }) => {
        const stripe = new Stripe(apiKey, config)
        return okAsync({ stripe })
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
            include: ['webhook_endpoint.signing_secret'],
            webhook_endpoint: {
                url,
            },
        })
        return ResultAsync.fromPromise(p, toProviderError).andThen((dest) => {
            if (!dest.webhook_endpoint?.signing_secret) {
                return err({
                    name: 'InvalidResponseError',
                    message:
                        'received invalid response from server: no signing secret in response',
                } satisfies InvalidResponseError)
            }
            const handle = createEndpointHandle(dest.id)
            if (handle.isErr()) {
                return err({
                    name: 'InvalidResponseError',
                    message: `received invalid response from server: invalid destination id: ${dest.id}`,
                } satisfies InvalidResponseError)
            }
            return ok({
                handle: handle.value,
                signingSecret: dest.webhook_endpoint.signing_secret,
            })
        })
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
            const relativeUrl = createRelativeUrl(pathname)
            if (relativeUrl.isErr()) {
                throw {
                    name: 'InvalidResponseError',
                    message: `received invalid response from server: invalid url: ${endpointUrl}`,
                    source: relativeUrl.error,
                } satisfies InvalidResponseError
            }
            return {
                relativeUrl: relativeUrl.value,
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
                const endpointId = createEndpointHandle(dest.id)._unsafeUnwrap() // Throw b/c in fromPromise
                const relativeUrl = createRelativeUrl(pathname)._unsafeUnwrap() // Throw b/c in fromPromise
                index.set(endpointId, {
                    relativeUrl,
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
    processRequest: ({
        request,
        handle,
        signingSecret,
        providerState: { stripe },
    }) => {
        const signature = request.headers.get('stripe-signature')
        if (!signature) {
            return errAsync(
                toSignatureError(
                    'missing stripe signature header',
                    new Error('missing stripe signature header'),
                    handle,
                ),
            )
        }

        return ResultAsync.fromPromise(
            (async () => {
                const body = await request.text()
                const event = stripe.webhooks.constructEvent(
                    body,
                    signature,
                    signingSecret!,
                )
                return {
                    event: event.type,
                    data: event.object,
                } satisfies ProcessRequestReturn<StripeEvent>
            })(),
            (e) => {
                const error = e instanceof Error ? e : new Error(String(e))
                return toSignatureError(
                    'invalid stripe signature',
                    error,
                    handle,
                )
            },
        )
    },
})

function getInvalidEvents(events: string[]): string[] {
    const invalid: string[] = []
    for (const event of events) {
        if (!Object.keys(StripeEvents).includes(event)) {
            invalid.push(event)
        }
    }
    return []
}

export { createStripeProvider }
export type {
    StripeProviderConfig,
    StripeEndpointConfig,
    StripeProviderState,
    StripeEvent,
}
