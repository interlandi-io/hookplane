/**
 * Statefile parsing and validation for Hookplane.
 *
 * A statefile represents a complete snapshot of an application's endpoint
 * configuration. It contains a base URL and the state of all endpoints
 * registered with each provider.
 */
import z, { ZodError } from 'zod'
import {
    createBaseUrl,
    createRelativeUrl,
    InvalidBaseUrlError,
    InvalidRelativeUrlError,
} from './url'
import { Result, ok, err } from 'neverthrow'
import { ProviderSet } from './provider-set'
import { State } from './state'
import { EndpointIndex, EndpointState, Provider } from './provider'

/**
 * Zod schema for base URLs.
 *
 * Validates that the URL is a valid http/https URL and transforms it
 * to a branded BaseUrl type.
 */
const BaseUrlSchema = z
    .string()
    .refine(
        (url) => {
            const result = createBaseUrl(url)
            return result.isOk() ? result.value : false
        },
        {
            error: ({ input }) =>
                'invalid base url' + input?.toString
                    ? `: ${input?.toString()}`
                    : '',
        },
    )
    .transform((url) => createBaseUrl(url)._unsafeUnwrap()) // validated above

/**
 * Zod schema for relative URLs.
 *
 * Validates that the URL starts with "/" and transforms it to a
 * branded RelativeUrl type.
 */
const RelativeUrlSchema = z
    .string()
    .refine(
        (url) => {
            const result = createRelativeUrl(url)
            return result.isOk() ? result.value : false
        },
        {
            error: ({ input }) =>
                'invalid relative url' + input?.toString
                    ? `: ${input?.toString()}`
                    : '',
        },
    )
    .transform((url) => createRelativeUrl(url)._unsafeUnwrap()) // validated above

/**
 * Zod schema for endpoint state.
 *
 * Represents the configuration of a single endpoint including its
 * relative URL, subscribed events, and provider-specific config.
 */
const EndpointStateSchema: z.ZodType<EndpointState<Provider>> = z.object({
    relativeUrl: RelativeUrlSchema,
    events: z.array(z.string()),
    config: z.record(z.string(), z.unknown()),
})

/**
 * Zod schema for an endpoint including optional signing secret.
 *
 * The signing secret is used to validate webhook signatures from the provider.
 */
const EndpointSchema = z.object({
    state: EndpointStateSchema,
    signingSecret: z.string().nullish(),
})

/**
 * Zod schema for a provider's state.
 *
 * A record of endpoints (keyed by handle) for a single provider.
 */
const ProviderStateSchema = z.record(z.string(), EndpointSchema)

/**
 * Zod schema for the complete statefile.
 *
 * Structure:
 * - version: The statefile version.
 * - baseUrl: The application's base URL
 * - providerStates: A record of providers, each containing endpoints keyed by handle
 */
const StatefileSchema = z.object({
    version: z.literal(1),
    baseUrl: BaseUrlSchema,
    providerStates: z.record(z.string(), ProviderStateSchema),
})

/**
 * A parsed and validated statefile.
 *
 * @typeParam P - The ProviderSet type containing all providers
 *
 * @example
 * ```typescript
 * const result = parseStatefile(contents, providers)
 * if (result.isOk()) {
 *     const state = result.value.toState()
 *     // use state...
 * }
 * ```
 */
export type Statefile<P extends ProviderSet> = {
    /** The raw parsed data from the statefile */
    data: z.infer<typeof StatefileSchema>
    /** Converts the statefile to a State object for use in the application */
    toState(): State<P>
}

/**
 * Union of all possible errors that can occur when parsing a statefile.
 */
export type StatefileError =
    | SchemaValidationError
    | ProviderNotFoundError
    | InvalidEventError
    | InvalidBaseUrlError
    | InvalidRelativeUrlError

/**
 * Error returned when the statefile JSON does not match the expected schema.
 */
export interface SchemaValidationError extends Error {
    name: 'SchemaValidationError'
    message: 'statefile does not fit schema'
    source: ZodError
}

/**
 * Error returned when a provider referenced in the statefile is not present
 * in the ProviderSet.
 */
export interface ProviderNotFoundError extends Error {
    name: 'ProviderNotFoundError'
    message: `provider ${string} not found in provider set`
    provider: string
}

/**
 * Error returned when an event referenced in an endpoint's configuration
 * is not defined in the provider's events.
 */
export interface InvalidEventError extends Error {
    name: 'InvalidEventError'
    message: `provider ${string} has no event ${string}`
    provider: string
    event: string
}

/**
 * Parses and validates a statefile.
 *
 * Validates the statefile structure, checks that all referenced providers
 * exist in the ProviderSet, and ensures all events are valid for each provider.
 *
 * @param contents - The parsed JSON object from a statefile
 * @param providers - The ProviderSet to validate against
 * @returns Ok with a Statefile object if validation passes, Err with a StatefileError otherwise
 *
 * @example
 * ```typescript
 * const result = parseStatefile(jsonContent, providers)
 * if (result.isOk()) {
 *     const state = result.value.toState()
 *     // use state...
 * }
 * ```
 */
export function parseStatefile<P extends ProviderSet>(
    contents: object,
    providers: P,
): Result<Statefile<P>, StatefileError> {
    const parsed = StatefileSchema.safeParse(contents)
    if (!parsed.success) {
        return err({
            name: 'SchemaValidationError',
            message: 'statefile does not fit schema',
            source: parsed.error,
        } satisfies SchemaValidationError)
    }

    for (const [providerName, providerState] of Object.entries(
        parsed.data.providerStates,
    )) {
        if (!validateProviderName(providerName, providers)) {
            return err({
                name: 'ProviderNotFoundError',
                message: `provider ${providerName} not found in provider set`,
                provider: providerName,
            } satisfies ProviderNotFoundError)
        }
        const provider = providers[providerName]!

        // TODO validate handles with provider.indexEndpoints
        for (const [, endpoint] of Object.entries(providerState)) {
            for (const eventName of endpoint.state.events) {
                if (!validateEvent(eventName, provider)) {
                    return err({
                        name: 'InvalidEventError',
                        message: `provider ${providerName} has no event ${eventName}`,
                        provider: providerName,
                        event: eventName,
                    } satisfies InvalidEventError)
                }
            }
        }
        // TODO: validate configs using a provider.validateEndpointConfig
    }

    return ok({
        baseUrl: parsed.data.baseUrl,
        data: parsed.data,
        toState() {
            const providerStatesEntries = Object.entries(
                parsed.data.providerStates,
            ).map(([providerName, providerState]) => {
                const entries = Object.entries(providerState).map(
                    ([handle, endpoint]) =>
                        [handle, endpoint.state] as [
                            typeof handle,
                            typeof endpoint.state,
                        ],
                )
                const endpointIndex = new Map(entries)
                return [providerName, endpointIndex] as [
                    typeof providerName,
                    EndpointIndex<Provider>,
                ]
            })
            const providerStates = Object.fromEntries(
                providerStatesEntries,
            ) as State<P>['providerStates']

            return {
                baseUrl: parsed.data.baseUrl,
                providers,
                providerStates,
            } satisfies State<P>
        },
    })
}

function validateProviderName(name: string, providers: ProviderSet): boolean {
    if (!Object.hasOwn(providers, name)) {
        return false
    }
    return true
}

function validateEvent(name: string, provider: Provider): boolean {
    if (!Object.hasOwn(provider.events, name)) {
        return false
    }
    return true
}

export { ZodError } from 'zod'
