import {
    describeProvider,
    createEndpointHandle,
    createEndpointUrl,
    ProviderError,
    UnknownError,
    AuthError,
    RateLimitError,
    NetworkError,
    ServerError,
    RequestSignatureValidationError,
    InvalidResponseError,
    ProcessRequestReturn,
} from '@hookplane/provider'
import { okAsync, errAsync, ResultAsync, err, ok } from 'neverthrow'
import Stripe from 'stripe'
import { StripeEvents, type StripeEvent } from './events.js'

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

function toProviderError(e: unknown): ProviderError {
    const source = e instanceof Error ? e : new Error(String(e))

    if (source.message && typeof source === 'object' && 'type' in source) {
        const stripeError = source as {
            type: string
            message?: string
            code?: string
            requestId?: string
        }
        const stripeType = stripeError.type as string | undefined
        const stripeMessage = stripeError.message
        const stripeCode = stripeError.code
        const requestId = stripeError.requestId

        const details = [
            stripeMessage && `stripe: ${stripeMessage}`,
            stripeCode && `code: ${stripeCode}`,
            requestId && `request_id: ${requestId}`,
        ]
            .filter(Boolean)
            .join(', ')

        switch (stripeType) {
            case 'StripeAuthenticationError':
            case 'StripePermissionError':
                return {
                    name: 'AuthError',
                    message: details || 'authentication failed',
                    source,
                } as AuthError

            case 'StripeRateLimitError':
                return {
                    name: 'RateLimitError',
                    message: details || 'rate limited',
                    source,
                } as RateLimitError

            case 'StripeConnectionError':
                return {
                    name: 'NetworkError',
                    message: details || 'network request failed',
                    source,
                } as NetworkError

            case 'StripeAPIError':
                return {
                    name: 'ServerError',
                    message: details || 'server error',
                    source,
                    statusCode: 500,
                } as ServerError

            case 'StripeInvalidRequestError':
            case 'StripeCardError':
            case 'StripeIdempotencyError':
                return {
                    name: 'InvalidResponseError',
                    message: details || 'received invalid response from server',
                    source,
                } as InvalidResponseError

            default:
                break
        }
    }

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

const stripeProvider = describeProvider<
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
            const url = createEndpointUrl(pathname)
            if (url.isErr()) {
                throw {
                    name: 'InvalidResponseError',
                    message: `received invalid response from server: invalid url: ${endpointUrl}`,
                    source: url.error,
                } satisfies InvalidResponseError
            }
            return {
                url: url.value,
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
                    // TODO
                    return true
                }
                const invalidEvents = getInvalidEvents(dest.enabled_events)
                if (invalidEvents.length > 0) {
                    throw new Error(
                        `event(s) ${invalidEvents.join(', ')} are/is invalid`,
                    )
                }
                const endpointId = createEndpointHandle(dest.id)
                if (endpointId.isErr()) {
                    throw new Error(endpointId.error.message, {
                        cause: endpointId.error,
                    })
                }
                const url = createEndpointUrl(endpointUrl)
                if (url.isErr()) {
                    throw new Error(url.error.message, {
                        cause: url.error,
                    })
                }
                index.set(endpointId.value, {
                    url: url.value,
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
    normalizeEndpointConfig(config) {
        const description = config.description ? config.description : ''
        const metadata = config.metadata ? config.metadata : {}
        return {
            ...config,
            description,
            metadata,
        }
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
                    data: event.data.object,
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

export { stripeProvider }
export type {
    StripeProviderConfig,
    StripeEndpointConfig,
    StripeProviderState,
    StripeEvent,
}
