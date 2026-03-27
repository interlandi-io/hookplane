import { err, ok, Result } from 'neverthrow'
import { Provider, EndpointIndex, BaseUrl } from './provider'

/**
 * Similar to a `State`, only it now contains `SubscriptionKeys` mapping subscriptions to a real remote resource.
 */
interface IndexedState<P extends Record<string, Provider>> {
    /** The base URL of the application/state. */
    baseUrl: BaseUrl
    /** The providers themselves. */
    providers: P
    /** A map of providers to the endpoints the know about. */
    providerStates: {
        [K in keyof P]: EndpointIndex<P[K]>
    }
}

async function pull<P extends Record<string, Provider>>(
    baseUrl: BaseUrl,
    providers: P,
): Promise<Result<IndexedState<P>, Error>> {
    const providerStates = {} as IndexedState<P>['providerStates']

    for (const [providerKey, provider] of Object.entries(providers)) {
        const endpointIndex = await provider.indexEndpoints({
            providerConfig: provider.config,
            providerState: provider.state,
        })
        if (endpointIndex.isErr()) {
            return err(
                Object.assign(
                    new Error(
                        `failed to index endpoints for provider "${providerKey}"`,
                    ),
                    { cause: endpointIndex.error },
                ),
            )
        }
        providerStates[providerKey as keyof typeof providerStates] =
            endpointIndex.value
    }

    return ok({
        baseUrl,
        providers,
        providerStates,
    })
}

export { type IndexedState, pull }
