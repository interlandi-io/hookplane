import {
    Provider,
    ProviderFeatures,
    EventDefinition,
    ProviderError,
    RequestPayloadSchemaValidationError,
} from '@hookplane/core'
import { ResultAsync, ok, err } from 'neverthrow'
import * as z from 'zod'
import { zocker } from 'zocker'

/**
 * Creates an event definition with parse and mock methods from a Zod schema.
 */
function zodEvent<T extends z.ZodTypeAny>(
    schema: T,
): EventDefinition<z.infer<T>> {
    return {
        parse: (data: unknown) => {
            const result = schema.safeParse(data)
            if (result.success) {
                return ok(result.data)
            }
            return err({
                name: 'RequestPayloadSchemaValidationError',
                message: 'failed to validate request payload schema',
                source: result.error,
            } satisfies RequestPayloadSchemaValidationError)
        },
        mock: () => {
            const data = zocker(schema).generate() as z.infer<T>
            return data
        },
    }
}

/**
 * Creates a record of event definitions from a Zod schema record.
 */
function zodEvents<T extends Record<string, z.ZodSchema>>(
    events: T,
): {
    [K in keyof T]: EventDefinition<z.infer<T[K]>>
} {
    return Object.fromEntries(
        Object.entries(events).map(([name, schema]) => [
            name,
            zodEvent(schema),
        ]),
    ) as {
        [K in keyof T]: EventDefinition<z.infer<T[K]>>
    }
}

/**
 * Provider descriptor - defines the events and methods for a provider.
 */
type ProviderDescriptor<
    TEventType extends string,
    TProviderConfig,
    TEndpointConfig,
    TProviderState,
> = {
    readonly name: string
    readonly events: Record<TEventType, EventDefinition<unknown>>
    readonly features?: ProviderFeatures

    setup(
        providerConfig: TProviderConfig,
    ): ResultAsync<TProviderState, ProviderError>

    createEndpoint: Provider<
        TEventType,
        TProviderConfig,
        TEndpointConfig,
        TProviderState
    >['createEndpoint']

    readEndpoint: Provider<
        TEventType,
        TProviderConfig,
        TEndpointConfig,
        TProviderState
    >['readEndpoint']

    updateEndpoint: Provider<
        TEventType,
        TProviderConfig,
        TEndpointConfig,
        TProviderState
    >['updateEndpoint']

    deleteEndpoint: Provider<
        TEventType,
        TProviderConfig,
        TEndpointConfig,
        TProviderState
    >['deleteEndpoint']

    indexEndpoints: Provider<
        TEventType,
        TProviderConfig,
        TEndpointConfig,
        TProviderState
    >['indexEndpoints']

    validateRequestSignature?: Provider<
        TEventType,
        TProviderConfig,
        TEndpointConfig,
        TProviderState
    >['validateRequestSignature']
}

export type ProviderDescriptionError = ProviderFeaturesMismatchError

export interface ProviderFeaturesMismatchError extends Error {
    name: 'ProviderFeaturesMismatchError'
    message: string
}

/**
 * Creates a provider factory from a descriptor.
 *
 * @example
 * ```typescript
 * const myProvider = describeProvider({
 *   name: 'myProvider',
 *   events: zodEvents({
 *     'user.created': z.object({ id: z.string() }),
 *     'user.deleted': z.object({ id: z.string() }),
 *   }),
 *   createEndpoint: async ({ url, events, endpointConfig }) => { ... },
 *   indexEndpoints: async ({ providerConfig }) => { ... },
 *   // ... other methods
 * })
 *
 * @throws `ProviderDescriptionError`
 * @throws `ProviderFeatureMismatchError`
 *  - if `features.requiresSigningSecret` is `true`, but `validateRequestSignature` is not defined
 *
 * const provider = myProvider({ apiKey: 'xxx' })
 * ```
 */
function describeProvider<
    TEventKey extends string,
    TProviderConfig,
    TEndpointConfig,
    TProviderState,
>(
    desc: ProviderDescriptor<
        TEventKey,
        TProviderConfig,
        TEndpointConfig,
        TProviderState
    >,
): (
    config: TProviderConfig,
) => ResultAsync<
    Provider<TEventKey, TProviderConfig, TEndpointConfig, TProviderState>,
    ProviderError
> {
    const { events, ..._desc } = desc

    if (
        desc.features?.requiresSigningSecret &&
        desc.validateRequestSignature === undefined
    ) {
        // We throw instead of using neverthrow b/c this touches the public API boundary.
        throw {
            name: 'ProviderFeaturesMismatchError',
            message:
                'features.requiresSigningSecret is true, but validateRequestSignature is not defined',
        } satisfies ProviderFeaturesMismatchError
    }

    return (config: TProviderConfig) =>
        desc.setup(config).map(
            (state) =>
                ({
                    config,
                    state,
                    events,
                    ..._desc,
                }) as Provider<
                    TEventKey,
                    TProviderConfig,
                    TEndpointConfig,
                    TProviderState
                >,
        )
}

export { zodEvent, zodEvents, describeProvider }
export type { Provider, ProviderDescriptor }
export type {
    EndpointHandle,
    EndpointState,
    EndpointUrl,
    EndpointIndex,
    BaseUrl,
    RelativeUrl,
    EventDefinition,
    ProviderError,
    ValidateRequestSignatureParams,
    AuthError,
    RateLimitError,
    NetworkError,
    TimeoutError,
    NotFoundError,
    AlreadyExistsError,
    InvalidResponseError,
    ServerError,
    RequestSignatureValidationError,
    RequestPayloadSchemaValidationError,
    UnknownError,
} from '@hookplane/core'
export {
    createEndpointHandle,
    createBaseUrl,
    createRelativeUrl,
    createEndpointUrl,
    composeEndpointUrl,
} from '@hookplane/core'
