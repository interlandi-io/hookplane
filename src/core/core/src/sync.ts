import { err, ok, Result } from 'neverthrow'
import { BaseUrl, ProviderError } from './provider'
import { ProviderSet } from './provider-set'
import { State } from './state'

export interface SyncError extends Error {
    name: 'SyncError'
    message: string
    source: ProviderError
}

export async function sync<P extends ProviderSet>(
    baseUrl: BaseUrl,
    providers: P,
): Promise<Result<State<P>, SyncError>> {
    const providerStates = {} as State<P>['providerStates']

    for (const [providerKey, provider] of Object.entries(providers)) {
        const endpointIndex = await provider.indexEndpoints({
            providerConfig: provider.config,
            providerState: provider.state,
        })
        if (endpointIndex.isErr()) {
            return err({
                name: 'SyncError',
                message: `failed to index endpoints for provider ${provider.name}`,
                source: endpointIndex.error,
            } satisfies SyncError)
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
