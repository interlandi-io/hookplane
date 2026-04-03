/**
 * Core provider abstraction for Hookplane.
 *
 * This module defines the Provider interface, which defines how to interact
 * with an external system for a set of events, along with types and utilities.
 *
 */
import { Result, ResultAsync } from 'neverthrow'
import {
    type BaseUrl,
    type RelativeUrl,
    type EndpointUrl,
    createBaseUrl,
    createRelativeUrl,
    createEndpointUrl,
    composeEndpointUrl,
} from './url'
import { EndpointHandle, createRealEndpointHandle } from './endpoint-handle'

/**
 * A provider defines how to interact with an external system for a set of events.
 *
 * @generic TEventType the union of event names the provider knows about -- can be just `string`
 * @generic TProviderConfig the provider's configuration object passed by a consumer containing api keys, for example.
 * @generic TEndpointConfig an endpoint's configuration object created by the Provider containing included fields, for example.
 * @generic TProviderState the internal state of a provider, holding values to be persisted across calls.
 */
interface Provider<
    TEventType extends string = string,
    TProviderConfig = unknown,
    TEndpointConfig = unknown,
    TProviderState = unknown,
> {
    /**
     * The name of the Provider.
     * Must be unique or you're gonna break something.
     */
    readonly name: string

    /**
     * The consumer-passed config object.
     * If you're going to have an API key, a version tag, or a slug, put it here.
     */
    readonly config: TProviderConfig

    /**
     * Created by the Provider during `setup`.
     */
    readonly state: TProviderState

    /**
     * The features of the provider e.g signing secret requirements.
     */
    readonly features?: ProviderFeatures

    /**
     * A mapping of each event a Provider provides to its definition.
     */
    readonly events: Record<TEventType, EventDefinition<unknown>>

    readonly __phantom?: TEndpointConfig

    /**
     * Create the Provider's state.
     * For example, you might create and validate a connection.
     * @returns the Provider's state
     */
    setup(
        providerConfig: TProviderConfig,
    ): ResultAsync<TProviderState, ProviderError>

    /**
     * Register an endpoint with the Provider.
     */
    createEndpoint(
        params: CreateEndpointParams<
            TProviderState,
            TProviderConfig,
            TEventType,
            TEndpointConfig
        >,
    ): ResultAsync<CreateEndpointReturn, ProviderError>

    /**
     * Get an Endpoint from the Provider.
     * @returns The state of the Endpoint in the shape of an `EndpointState`
     */
    readEndpoint(
        params: ReadEndpointParams<TProviderState, TProviderConfig>,
    ): ResultAsync<EndpointState<this>, ProviderError>

    /**
     * Update an Endpoint of the Provider.
     */
    updateEndpoint(
        params: UpdateEndpointParams<
            TProviderState,
            TProviderConfig,
            TEndpointConfig,
            TEventType
        >,
    ): ResultAsync<void, ProviderError>

    /**
     * Delete an Endpoint of the Provider.
     */
    deleteEndpoint(
        params: DeleteEndpointParams<TProviderState, TProviderConfig>,
    ): ResultAsync<void, ProviderError>

    /**
     * Fetch an index of of the Endpoints currently registered with the Provider.
     * @see `EndpointIndex`
     * @returns an `EndpointIndex`
     */
    indexEndpoints(
        params: IndexEndpointsParams<TProviderState, TProviderConfig>,
    ): ResultAsync<EndpointIndex<this>, ProviderError>

    /**
     * Performs any or all of the following:
     * 1) Validate the schema of an incoming request.
     * 2) Validate the cryptographic signature of an incoming request.
     * 3) Extract necessary data from the request.
     *
     * @returns a `ProcessRequestReturn` if both the schema and request
     * validation are scucessful, else an error.
     */
    processRequest?(
        params: ProcessRequestParams<TProviderState, TProviderConfig>,
    ): ResultAsync<ProcessRequestReturn<TEventType>, ProviderError>

    /**
     * Generates a mock request with a valid schema & signature for an event.
     *
     * @returns a `MockRequestReturn`
     */
    mockRequest?(
        params: MockRequestParams<TProviderState, TProviderConfig, TEventType>
    ): Result<MockRequestReturn, ProviderError>
}

/**
 * Params passed to an Endpoint CRUD/I(ndex) operation
 */
type EndpointOperationParams<TProviderState, TProviderConfig> = {
    /**
     * The `ProviderState` of the `Provider`
     */
    providerState: TProviderState

    /**
     * The `ProviderConfig` of the `Provider`
     */
    providerConfig: TProviderConfig
}

type ProviderFeatures = {
    requiresSigningSecret?: boolean
}

type CreateEndpointParams<S, C, TEventType, TEndpointConfig> =
    EndpointOperationParams<S, C> & {
        /**
         * The url to send events to.
         */
        url: EndpointUrl

        /**
         * The events to the endpoint will receive.
         */
        events: TEventType[]

        /**
         * The `EndpointConfig` of the `Endpoint`
         */
        endpointConfig: TEndpointConfig
    }

type ReadEndpointParams<S, C> = EndpointOperationParams<S, C> & {
    /**
     * @see `EndpointHandle`
     */
    handle: EndpointHandle
}

type UpdateEndpointParams<S, C, TEndpointConfig, TEventType> =
    EndpointOperationParams<S, C> & {
        /**
         * @see `EndpointHandle`
         */
        handle: EndpointHandle

        /**
         * The url to send events to.
         */
        url: EndpointUrl

        /**
         * The events the endpoint will receive.
         */
        events: TEventType[]

        /**
         * The `EndpointConfig` of the `Endpoint`
         */
        endpointConfig: TEndpointConfig
    }

type DeleteEndpointParams<S, C> = EndpointOperationParams<S, C> & {
    /**
     * @see `EndpointHandle`
     */
    handle: EndpointHandle
}

type IndexEndpointsParams<S, C> = EndpointOperationParams<S, C>

type ProcessRequestParams<S, C> = EndpointOperationParams<S, C> & {
    /**
     * @see `EndpointHandle`
     */
    handle: EndpointHandle

    /**
     * The raw request.
     */
    request: Request 

    /**
     * The signing secret for this endpoint.
     * Will be defined if `provider.features.requiresSigningSecret` is true.
     */
    signingSecret?: string
}

type MockRequestParams<S, C, TEventType> = EndpointOperationParams<S, C> & {
    /**
     * The event to mock.
     */
    event: TEventType

    /**
     * The event to mock.
     */
    url: EndpointUrl

    /**
     * The signing secret for this endpoint.
     * Will be defined if `provider.features.requiresSigningSecret` is true.
     */
    signingSecret?: string
}

type CreateEndpointReturn = {
    /**
     * @see EndpointHandle
     */
    handle: EndpointHandle

    /**
     * The signing secret for the created endpoint.
     * Must be present if `Provider.features.requiresSigningSecret` is `true`
     */
    signingSecret?: string
}

type ProcessRequestReturn<TEventType> = {
    /**
     * The event type of the incoming request.
     */
    event: TEventType 

    /**
     * The validated data of the incoming request.
     */
    data: unknown
}

type MockRequestReturn = {
    request: Request
}


type ProviderError =
    | AuthError
    | RateLimitError
    | NetworkError
    | TimeoutError
    | NotFoundError
    | AlreadyExistsError
    | InvalidResponseError
    | ServerError
    | RequestSignatureValidationError
    | RequestPayloadSchemaValidationError
    | UnknownError

interface AuthError extends Error {
    name: 'AuthError'
    message: `authentication failed${'' | `: ${string}`}`
    source?: Error
}

interface RateLimitError extends Error {
    name: 'RateLimitError'
    message: `rate limited${'' | `: ${string}`}`
    source?: Error
    retryAfter?: number
}

interface NetworkError extends Error {
    name: 'NetworkError'
    message: `network request failed${'' | `: ${string}`}`
    source?: Error
}

interface TimeoutError extends Error {
    name: 'TimeoutError'
    message: `request timed out${'' | `: ${string}`}`
    source: Error
}

interface NotFoundError extends Error {
    name: 'NotFoundError'
    message: `resource not found${'' | `: ${string}`}`
    source?: Error
}

interface AlreadyExistsError extends Error {
    name: 'AlreadyExistsError'
    message: `resource already exists${'' | `: ${string}`}`
    source: Error
}

interface InvalidResponseError extends Error {
    name: 'InvalidResponseError'
    message: `received invalid response from server${'' | `: ${string}`}`
    source?: Error
}

interface ServerError extends Error {
    name: 'ServerError'
    message: `server error${'' | `: ${string}`}`
    source?: Error
    statusCode: number
}

interface RequestSignatureValidationError extends Error {
    name: 'RequestSignatureValidationError'
    message: `failed to validate request signature${'' | `: ${string}`}`
    source?: Error
}

interface RequestPayloadSchemaValidationError extends Error {
    name: 'RequestPayloadSchemaValidationError'
    message: `failed to validate request payload schema${'' | `: ${string}`}`
    source?: Error
}

interface UnknownError extends Error {
    name: 'UnknownError'
    message: `an error occurred: ${string}`
    source?: Error
}

type EndpointState<P extends Provider> = {
    relativeUrl: RelativeUrl
    events: EventTypeOf<P>[]
    config: EndpointConfigOf<P>
}

/**
 * Used to map local Endpoint representations to Endpoints actually registered with a provider.
 * @see EndpointHandle
 */
type EndpointIndex<P extends Provider> = Map<EndpointHandle, EndpointState<P>>

/**
 * Defines an event of a `Provider`.
 * @generic T Event payload type
 */
type EventDefinition<T> = {
    __phantom?: T,
}

/**
 * Type that maps a State<P> to its provider keys.
 */
type ProviderKeyOf<S> = S extends { providers: infer P } ? keyof P : never

/**
 * Derive the TEventType type for a Provider.
 */
type EventTypeOf<P extends Provider> = P extends Provider<infer T> ? T : never

/**
 * Derive the TProviderConfig type for a Provider.
 */
type ProviderConfigOf<P extends Provider> =
    P extends Provider<string, infer T> ? T : never

/**
 * Derive the TEndpointConfig type for a Provider.
 */
type EndpointConfigOf<P extends Provider> =
    P extends Provider<string, unknown, infer T> ? T : never

/**
 * Derive the TProviderState type for a Provider.
 */
type ProviderStateOf<P extends Provider> =
    P extends Provider<string, unknown, unknown, infer T> ? T : never

/**
 * Derive the Payload type of an Event Definition.
 */
type PayloadOf<E> = E extends EventDefinition<infer T> ? T : never

export {
    type Provider,
    type ProviderFeatures,
    type EndpointState,
    type BaseUrl,
    type RelativeUrl,
    type EndpointUrl,
    type CreateEndpointParams,
    type ReadEndpointParams,
    type UpdateEndpointParams,
    type DeleteEndpointParams,
    type IndexEndpointsParams,
    type ProcessRequestParams,
    type MockRequestParams,
    type CreateEndpointReturn,
    type ProcessRequestReturn,
    type MockRequestReturn,
    type EndpointHandle,
    type EndpointIndex,
    type EventDefinition,
    type ProviderKeyOf,
    type EventTypeOf,
    type ProviderConfigOf,
    type EndpointConfigOf,
    type ProviderStateOf,
    type PayloadOf,
    type ProviderError,
    type AuthError,
    type RateLimitError,
    type NetworkError,
    type TimeoutError,
    type NotFoundError,
    type AlreadyExistsError,
    type InvalidResponseError,
    type ServerError,
    type RequestSignatureValidationError,
    type RequestPayloadSchemaValidationError,
    type UnknownError,
    createRealEndpointHandle as createEndpointHandle,
    createBaseUrl,
    createRelativeUrl,
    createEndpointUrl,
    composeEndpointUrl,
}
