import { err, ok, Result } from 'neverthrow'
import { ProviderError } from './provider.js'
import { ProviderSet } from './provider-set.js'
import { State } from './state.js'

export interface SyncError extends Error {
    name: 'SyncError'
    message: string
    source: ProviderError
}

export async function sync<P extends ProviderSet>(
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
        providers,
        providerStates,
    })
}
