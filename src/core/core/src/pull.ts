import { err, ok, Result } from 'neverthrow'
import { BaseUrl } from './provider'
import { MappedState } from './state'
import { ProviderSet } from './provider-set'

export async function pull<P extends ProviderSet>(
    baseUrl: BaseUrl,
    providers: P,
): Promise<Result<MappedState<P>, Error>> {
    const providerMaps = {} as MappedState<P>['providerMaps']

    for (const [providerKey, provider] of Object.entries(providers)) {
        const endpointMap = await provider.mapEndpoints({
            providerConfig: provider.config,
            providerState: provider.state,
        })
        if (endpointMap.isErr()) {
            return err(
                Object.assign(
                    new Error(
                        `failed to index endpoints for provider "${providerKey}"`,
                    ),
                    { cause: endpointMap.error },
                ),
            )
        }
        providerMaps[providerKey as keyof typeof providerMaps] =
            endpointMap.value
    }

    return ok({
        baseUrl,
        providers,
        providerMaps,
    })
}
