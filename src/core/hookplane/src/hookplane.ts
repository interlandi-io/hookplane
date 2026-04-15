import {
    StateUnknown,
    createEndpointUrl,
    EndpointConfigOf,
    EventTypeOf,
    ProviderSet,
    createProviderSet,
    Provider,
} from '@hookplane/core'
import { Backend, createTempBackend } from '@hookplane/backend'

export type Hookplane = {
    state: StateUnknown<ProviderSet>
    backend: Backend,
}

type HookplaneParams<TProviderSet extends ProviderSet> = {
    providers: {
        [K in keyof TProviderSet]: {
            provider: TProviderSet[K]
            endpoint: string
            events: EventTypeOf<TProviderSet[K]>[]
            endpointConfig: EndpointConfigOf<TProviderSet[K]>
        }
    }
    backend?: Backend
}

/**
 * Constructs a runtime State from per-provider descriptors.
 *
 * @param params - Parameters including a `providers` record where each entry supplies:
 *   `provider` (the provider instance), `endpoint` (the provider's endpoint URL), `events` (the event types to subscribe to),
 *   and `config` (the endpoint configuration).
 */
export async function hookplane<TProviderSet extends ProviderSet>(
    params: HookplaneParams<TProviderSet>,
): Promise<Hookplane> {
    const providersUnvalidated: Record<string, Provider> = {}
    const providerStates = {} as StateUnknown<TProviderSet>['providerStates']

    for (const [name, v] of Object.entries(params.providers)) {
        const { provider, endpoint, events, endpointConfig } =
            v as HookplaneParams<TProviderSet>['providers'][typeof name]
        providersUnvalidated[name] = provider

        const endpointUrl = createEndpointUrl(endpoint)._unsafeUnwrap()
        providerStates[name as keyof typeof providerStates] = new Set([
            {
                url: endpointUrl,
                events,
                config: endpointConfig,
            },
        ])
    }

    const providers = createProviderSet(
        providersUnvalidated,
    )._unsafeUnwrap() as TProviderSet

    const backend =  params.backend ?? await createTempBackend()

    return {
        state: {
            providers,
            providerStates,
        },
        backend,
    }
}
