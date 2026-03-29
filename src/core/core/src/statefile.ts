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

const EndpointStateSchema: z.ZodType<EndpointState<Provider>> = z.object({
    relativeUrl: RelativeUrlSchema,
    events: z.array(z.string()),
    config: z.record(z.string(), z.unknown()),
})

const EndpointSchema = z.object({
    state: EndpointStateSchema,
    signingSecret: z.string().nullish(),
})

const ProviderStateSchema = z.record(z.string(), EndpointSchema)

const StatefileSchema = z.object({
    baseUrl: BaseUrlSchema,
    providerStates: z.record(z.string(), ProviderStateSchema),
})

export type Statefile<P extends ProviderSet> = {
    data: z.infer<typeof StatefileSchema>
    toState(): State<P>
}

export type StatefileError =
    | SchemaValidationError
    | ProviderNotFoundError
    | InvalidEventError
    | InvalidBaseUrlError
    | InvalidRelativeUrlError

export interface SchemaValidationError extends Error {
    name: 'SchemaValidationError'
    message: 'statefile does not fit schema'
    source: ZodError
}

export interface ProviderNotFoundError extends Error {
    name: 'ProviderNotFoundError'
    message: `provider ${string} not found in provider set`
    provider: string
}

export interface InvalidEventError extends Error {
    name: 'InvalidEventError'
    message: `provider ${string} has no event ${string}`
    provider: string
    event: string
}

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
export type { InvalidRelativeUrlError } from './url'
