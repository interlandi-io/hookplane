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
export type ProviderSet = Record<string, Provider>

/**
 * Error types that can occur when working with a ProviderSet.
 */
export type ProviderSetError = KeyNameMismatchError

/**
 * Error returned when a provider's name does not match its key in the set.
 */
export interface KeyNameMismatchError extends Error {
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
 * const result = createProviderSet({
 *     stripe: StripeProvider({ ... })
 * })
 * if (result.isOk()) {
 *     result.value['stripe'] // stripeProvider
 * } else {
 *     console.error(result.error.providerName) // name of duplicate
 * }
 * ```
 */
export function createProviderSet(
    providers: Record<string, Provider>,
): Result<ProviderSet, ProviderSetError> {
    for (const [key, provider] of Object.entries(providers)) {
        if (provider.name != key) {
            return err({
                name: 'KeyNameMismatchError',
                message: `Provider key "${key}" does not match provider name "${provider.name}"`,
                key,
                providerName: provider.name,
            } satisfies KeyNameMismatchError)
        }
    }

    return ok(providers)
}
