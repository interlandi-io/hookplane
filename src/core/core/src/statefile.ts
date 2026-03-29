import z, { ZodError } from 'zod'
import { createRelativeUrl, InvalidRelativeUrlError } from './url'
import { Result, ok, err } from 'neverthrow'
import { ProviderSet } from './provider-set'

const EndpointStateSchema = z.object({
    relativeUrl: z.string(),
    events: z.array(z.string()),
    config: z.record(z.string(), z.unknown()),
})

const StatefileSchema = z.object({
    endpoints: z.record(z.string(), EndpointStateSchema),
})

export type Statefile = z.infer<typeof StatefileSchema>

export type StatefileError =
    | SchemaValidationError
    | ProviderNotFoundError
    | InvalidEventError
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

// TODO: obviously, we need to collapse these steps
export function parseStatefile(
    contents: object,
    providers: ProviderSet,
): Result<Statefile, StatefileError> {
    const parsed = StatefileSchema.safeParse(contents)
    if (!parsed.success) {
        return err({
            name: 'SchemaValidationError',
            message: 'statefile does not fit schema',
            source: parsed.error,
        } satisfies SchemaValidationError)
    }

    const providerNames = Object.keys(parsed.data.endpoints)
    for (const name of providerNames) {
        if (!Object.hasOwn(providers, name)) {
            return err({
                name: 'ProviderNotFoundError',
                message: `provider ${name} not found in provider set`,
                provider: name,
            } satisfies ProviderNotFoundError)
        }
    }

    const relativeUrls = Object.values(parsed.data.endpoints).map(
        (endpoint) => endpoint.relativeUrl,
    )
    for (const url of relativeUrls) {
        const result = createRelativeUrl(url)
        if (result.isErr()) {
            return err({
                name: 'InvalidRelativeUrlError',
                message: `relative URL must start with "/": ${url}`,
            } satisfies InvalidRelativeUrlError)
        }
    }

    for (const [providerName, endpoint] of Object.entries(
        parsed.data.endpoints,
    )) {
        const provider = providers[providerName]!
        for (const eventName of endpoint.events) {
            if (!Object.hasOwn(provider.events, eventName)) {
                return err({
                    name: 'InvalidEventError',
                    message: `provider ${providerName} has no event ${eventName}`,
                    provider: providerName,
                    event: eventName,
                } satisfies InvalidEventError)
            }
        }
        // TODO: validate configs using a provider.validateEndpointConfig
    }

    return ok(parsed.data)
}

export { ZodError } from 'zod'
export type { InvalidRelativeUrlError } from './url'
