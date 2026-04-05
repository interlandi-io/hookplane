import { EndpointConfigOf, EventTypeOf, ProviderSet } from '@hookplane/core'

export type Hookplane<TProviderSet extends ProviderSet> = {
    providers: TProviderSet
}

type HookplaneParams<TProviderSet extends ProviderSet> = {
    providers: {
        [K in keyof TProviderSet]: {
            provider: TProviderSet[K]
            endpoint: string
            events: EventTypeOf<TProviderSet[K]>[]
            config: EndpointConfigOf<TProviderSet[K]>
        }
    }
}

export async function hookplane<TProviderSet extends ProviderSet>(
    params: HookplaneParams<TProviderSet>,
): Promise<Hookplane<TProviderSet>> {
    const providers = {} as TProviderSet
    for (const [name, provider] of Object.entries(params.providers)) {
        providers[name as keyof TProviderSet] = await provider
    }

    return {
        providers,
    }
}
