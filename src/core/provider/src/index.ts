import {
    Provider,
    ProviderFeatures,
    EventDefinition,
    ProviderError,
} from '@hookplane/core'
import { ResultAsync } from 'neverthrow'

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

    processRequest?: Provider<
        TEventType,
        TProviderConfig,
        TEndpointConfig,
        TProviderState
    >['processRequest']

    mockRequest?: Provider<
        TEventType,
        TProviderConfig,
        TEndpointConfig,
        TProviderState
    >['mockRequest']
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
        desc.processRequest === undefined
    ) {
        // We throw instead of using neverthrow b/c this touches the public API boundary.
        throw {
            name: 'ProviderFeaturesMismatchError',
            message:
                'features.requiresSigningSecret is true, but processRequest is not defined',
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

export { describeProvider }
export type { Provider, ProviderDescriptor }
export type {
    EndpointHandle,
    EndpointState,
    EndpointUrl,
    EndpointIndex,
    PayloadOf,
    BaseUrl,
    RelativeUrl,
    EventDefinition,
    ProviderError,
    ProcessRequestParams,
    ProcessRequestReturn,
    MockRequestParams,
    MockRequestReturn,
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
