import { err, ok, Result } from 'neverthrow'
import { Provider } from './provider'

/**
 * An immutable, deduplicated set of `Provider`s.
 * Only one provider can exist with a given name in the set.
 *
 * @example
 * ```typescript
 * const providerSet = createProviderSet([stripeProvider, githubProvider])
 * if (providerSet.isOk()) {
 *     providerSet.value.has('stripe') // true
 * }
 * ```
 */
export type ProviderSet<P extends Provider[]> = {
    /**
     * Returns all providers in the set as an array.
     */
    all(): Provider[]
    /**
     * Returns the provider with the given name, or undefined if not found.
     */
    get(key: P[number]['name']): Provider | undefined
    /**
     * Returns true if a provider with the given name exists in the set.
     */
    has(key: P[number]['name']): boolean
}

/**
 * Error types that can occur when working with a ProviderSet.
 */
type ProviderSetError = AlreadyExistsError

/**
 * Error returned when attempting to add a provider with a name that already exists.
 */
interface AlreadyExistsError extends Error {
    name: 'AlreadExistsError'
    message: `Provider ${string} already exists in ProviderSet`
    providerName: string
}

/**
 * Creates an immutable, deduplicated set of providers.
 *
 * @param providers - An array of providers to include in the set
 * @returns Ok with a ProviderSet if all provider names are unique, Err with AlreadyExistsError otherwise
 *
 * @example
 * ```typescript
 * const result = createProviderSet([stripeProvider, githubProvider])
 * if (result.isOk()) {
 *     const ps = result.value
 *     ps.get('stripe') // returns stripeProvider
 * } else {
 *     console.error(result.error.providerName) // name of duplicate
 * }
 * ```
 */
export function createProviderSet<P extends Provider[]>(
    providers: P,
): Result<ProviderSet<P>, ProviderSetError> {
    const inner: Map<P[number]['name'], Provider> = new Map()

    for (const provider of providers) {
        if (inner.has(provider.name)) {
            return err({
                name: 'AlreadExistsError',
                message: `Provider ${provider.name} already exists in ProviderSet`,
                providerName: provider.name,
            } satisfies AlreadyExistsError)
        }
        inner.set(provider.name, provider)
    }

    return ok({
        all: () => Array.from(inner.values()),
        get: (key) => inner.get(key),
        has: (key) => inner.has(key),
    })
}
