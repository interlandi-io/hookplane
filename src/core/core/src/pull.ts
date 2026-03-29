import { err, ok, Result } from 'neverthrow'
import { BaseUrl } from './provider'
import { ProviderSet } from './provider-set'
import { State } from './state'

async function pull<P extends ProviderSet>(
    baseUrl: BaseUrl,
    providers: P,
): Promise<Result<State<P>, Error>> {
    const providerStates = {} as State<P>['providerStates']

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

export { pull }
