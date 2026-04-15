/**
 * Statefile parsing and validation for Hookplane.
 *
 * A statefile represents a complete snapshot of an application's endpoint
 * configuration. It contains the state of all endpoints registered with each provider.
 */
import z, { ZodError } from 'zod'
import { createEndpointUrl, type EndpointUrl } from './url.js'
import { Result, ok, err } from 'neverthrow'
import { ProviderSet } from './provider-set.js'
import { State } from './state.js'
import { EndpointIndex, EndpointState, Provider } from './provider.js'
import { EndpointHandle, createRealEndpointHandle } from './endpoint-handle.js'

/**
 * Zod schema for endpoint URLs.
 *
 * Validates that the URL is a valid http/https URL and transforms it
 * to a branded EndpointUrl type.
 */
const EndpointUrlSchema = refineString<EndpointUrl>(
    createEndpointUrl,
    'invalid endpoint URL',
)

/**
 * Zod schema for endpoint handles.
 *
 * Validates that the handle is not empty.
 */
const EndpointHandleSchema = refineString<EndpointHandle>(
    createRealEndpointHandle,
    'invalid endpoint handle',
)

/**
 * Zod schema for endpoint state.
 *
 * Represents the configuration of a single endpoint including its
 * URL, subscribed events, and provider-specific config.
 */
const EndpointStateSchema: z.ZodType<EndpointState<Provider>> = z.object({
    url: EndpointUrlSchema,
    events: z.array(z.string()),
    config: z.record(z.string(), z.unknown()),
})

/**
 * Zod schema for an endpoint.
 */
const EndpointSchema = z.object({
    state: EndpointStateSchema,
})

/**
 * Zod schema for a provider's state.
 *
 * A record of endpoints (keyed by handle) for a single provider.
 */
const ProviderStateSchema = z.record(EndpointHandleSchema, EndpointSchema)

/**
 * Zod schema for the complete statefile.
 *
 * Structure:
 * - version: The statefile version
 * - providerStates: A record of providers, each containing endpoints keyed by handle
 */
const StatefileSchema = z.object({
    version: z.literal(1),
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
    toState(): Result<State<P>, StatefileError>
}

/**
 * Union of all possible errors that can occur when parsing a statefile.
 */
export type StatefileError =
    | SchemaValidationError
    | ProviderNotFoundError
    | ProviderNotUsedError
    | InvalidEventError

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
 * Error returned when a provider is not used in a Statefile,
 * but is included in the ProviderSet
 */
export interface ProviderNotUsedError extends Error {
    name: 'ProviderNotUsedError'
    message: `provider ${string} not used in statefile`
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
        data: parsed.data,
        toState: toState(providers, parsed.data),
    })
}

export function bootstrap(): Statefile<ProviderSet> {
    const providers: ProviderSet = {}
    const data = {
        version: 1,
        providerStates: {},
    } as const

    return {
        data,
        toState: toState(providers, data),
    }
}

/**
 * Creates a Statefile from a State object.
 *
 * This is the inverse of calling `toState()` on a parsed Statefile.
 * Used when serializing state for storage.
 *
 * @param version - The statefile version (currently only 1)
 * @param state - The State to convert
 * @returns A Statefile with the same data as the input State
 *
 * @example
 * ```typescript
 * const state = { providers, providerStates }
 * const statefile = fromState(1, state)
 * // serialize statefile.data to JSON for storage
 * ```
 */
export function fromState<P extends ProviderSet>(
    version: 1,
    state: State<P>,
): Statefile<P> {
    const providerStatesEntries = Object.entries(state.providerStates).map(
        ([providerName, endpointIndex]: [string, EndpointIndex<Provider>]) => {
            const entries = Array.from(endpointIndex.entries()).map(
                ([handle, endpointState]) => {
                    return [
                        handle,
                        {
                            state: endpointState,
                        },
                    ] as [
                        typeof handle,
                        Statefile<P>['data']['providerStates'][string][keyof Statefile<P>['data']['providerStates'][string]],
                    ]
                },
            )
            return [providerName, Object.fromEntries(entries)] as [
                string,
                Statefile<P>['data']['providerStates'][string],
            ]
        },
    )

    const providerStates = Object.fromEntries(providerStatesEntries)

    const data = {
        version,
        providerStates,
    }

    return {
        data,
        toState: toState(state.providers, data),
    }
}

const toState =
    <P extends ProviderSet>(
        providers: P,
        data: z.infer<typeof StatefileSchema>,
    ): Statefile<P>['toState'] =>
    () => {
        // validate that all providers in providers have at least one endpoint in data
        // This is not necessary.
        // const providersInData = Object.keys(data.providerStates)
        // for (const providerName of Object.keys(providers)) {
        //     if (!providersInData.includes(providerName)) {
        //         return err({
        //             name: 'ProviderNotUsedError',
        //             message: `provider ${providerName} not used in statefile`,
        //             provider: providerName,
        //         } satisfies ProviderNotUsedError)
        //     }
        // }

        const providerStatesEntries: [
            keyof P,
            State<P>['providerStates'][keyof P],
        ][] = []
        for (const [providerName, providerState] of Object.entries(
            data.providerStates,
        )) {
            // validate that all providers in data are in providers
            if (!Object.hasOwn(providers, providerName)) {
                return err({
                    name: 'ProviderNotFoundError',
                    message: `provider ${providerName} not found in provider set`,
                    provider: providerName,
                } satisfies ProviderNotFoundError)
            }

            const entries = Object.entries(providerState).map(
                ([handle, endpoint]) =>
                    [handle, endpoint.state] as [
                        typeof handle,
                        typeof endpoint.state,
                    ],
            )
            const endpointIndex = new Map(entries)
            const entry = [providerName, endpointIndex] as [
                typeof providerName,
                EndpointIndex<Provider>,
            ]
            providerStatesEntries.push(entry)
        }
        const providerStates = Object.fromEntries(
            providerStatesEntries,
        ) as State<P>['providerStates']

        return ok({
            providers,
            providerStates,
        } satisfies State<P>)
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

function refineString<T>(f: (s: string) => Result<T, unknown>, errMsg: string) {
    return z
        .string()
        .refine(
            (url) => {
                const result = f(url)
                return result.isOk() ? result.value : false
            },
            {
                error: ({ input }) =>
                    input != null
                        ? errMsg + ': ' + input?.toString()
                        : 'errMsg',
            },
        )
        .transform((url) => f(url)._unsafeUnwrap()) // validated above
}

export { ZodError } from 'zod'
