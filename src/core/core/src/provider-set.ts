import { err, ok, Result } from 'neverthrow'
import { Provider } from './provider'

/**
 * A deduplicated Record<string, Provider> that ensures unique provider names.
 *
 * @example
 * ```typescript
 * const result = createProviderSet([stripeProvider, githubProvider])
 * if (result.isOk()) {
 *     result.value['stripe'] // stripeProvider
 * }
 * ```
 */
export interface ProviderSet {
    /**
     * Access providers by name.
     */
    [key: string]: Provider
}

/**
 * Error types that can occur when working with a ProviderSet.
 */
type ProviderSetError = AlreadyExistsError | KeyNameMismatchError

/**
 * Error returned when attempting to add a provider with a name that already exists.
 */
interface AlreadyExistsError extends Error {
    name: 'AlreadyExistsError'
    message: `Provider ${string} already exists in ProviderSet`
    providerName: string
}

/**
 * Error returned when a provider's name does not match its key in the set.
 */
interface KeyNameMismatchError extends Error {
    name: 'KeyNameMismatchError'
    message: `Provider key "${string}" does not match provider name "${string}"`
    key: string
    providerName: string
}

/**
 * Creates a ProviderSet from an array of providers.
 *
 * Validates that all provider names are unique.
 *
 * @param providers - An array of providers to include in the set
 * @returns Ok with a ProviderSet if validation passes, Err with AlreadyExistsError otherwise
 *
 * @example
 * ```typescript
 * const result = createProviderSet([stripeProvider, githubProvider])
 * if (result.isOk()) {
 *     result.value['stripe'] // stripeProvider
 * } else {
 *     console.error(result.error.providerName) // name of duplicate
 * }
 * ```
 */
export function createProviderSet(
    providers: Provider[],
): Result<ProviderSet, ProviderSetError> {
    const inner: Map<string, Provider> = new Map()

    for (const provider of providers) {
        if (inner.has(provider.name)) {
            return err({
                name: 'AlreadyExistsError',
                message: `Provider ${provider.name} already exists in ProviderSet`,
                providerName: provider.name,
            } satisfies AlreadyExistsError)
        }
        inner.set(provider.name, provider)
    }

    const record = Object.fromEntries(inner) as Record<string, Provider>

    return ok({
        ...record,
    })
}
