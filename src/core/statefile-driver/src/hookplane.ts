import {
    State,
    createBaseUrl,
    EndpointConfigOf,
    EventTypeOf,
    ProviderSet,
    createProviderSet,
    Provider,
    createRelativeUrl,
    createOrphanEndpointHandle,
} from '@hookplane/core'

type HookplaneParams<TProviderSet extends ProviderSet> = {
    baseUrl: string
    providers: {
        [K in keyof TProviderSet]: {
            provider: TProviderSet[K]
            endpoint: string
            events: EventTypeOf<TProviderSet[K]>[]
            config: EndpointConfigOf<TProviderSet[K]>
        }
    }
}

/**
 * Constructs a runtime State from a base URL and per-provider descriptors.
 *
 * @param params - Parameters including `baseUrl` and a `providers` record where each entry supplies:
 *   `provider` (the provider instance), `endpoint` (the provider's endpoint URL), `events` (the event types to subscribe to),
 *   and `config` (the endpoint configuration).
 * @returns The assembled `State<TProviderSet>` containing:
 *   - `baseUrl`: the validated base URL,
 *   - `providers`: the typed provider set,
 *   - `providerStates`: a mapping from provider keys to a `Map` of endpoint handles to endpoint metadata objects `{ relativeUrl, events, config }`.
 */
export async function hookplane<TProviderSet extends ProviderSet>(
    params: HookplaneParams<TProviderSet>,
): Promise<State<TProviderSet>> {
    // We throw in this b/c it touches the API boundary
    const providersUnvalidated: Record<string, Provider> = {}
    const providerStates = {} as State<TProviderSet>['providerStates']

    for (const [name, v] of Object.entries(params.providers)) {
        const { provider, endpoint, events, config } =
            v as HookplaneParams<TProviderSet>['providers'][typeof name]
        providersUnvalidated[name] = provider

        const relativeUrl = createRelativeUrl(endpoint)._unsafeUnwrap()
        providerStates[name as keyof typeof providerStates] = new Map([
            [
                createOrphanEndpointHandle(), // TODO: this isn't correct because it will create new endpoints for everything
                {
                    // there needs to be a matching heuristic here
                    relativeUrl,
                    events,
                    config,
                },
            ],
        ])
    }

    const baseUrl = createBaseUrl(params.baseUrl)._unsafeUnwrap()
    const providers = createProviderSet(
        providersUnvalidated,
    )._unsafeUnwrap() as TProviderSet

    return {
        baseUrl,
        providers,
        providerStates,
    }
}
