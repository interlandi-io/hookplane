import { ProviderSet } from '@hookplane/core'
import { Subscription, createSubscription } from './subscription.js'

export type Hookplane<TProviderSet extends ProviderSet> = {
    providers: TProviderSet
    subscribe<P extends keyof TProviderSet, E extends keyof TProviderSet[P]['events']>(
        provider: P,
        event: E,
    ): Subscription<TProviderSet[P], E>
}

export type HookplaneParams<TProviderSet extends ProviderSet> = {
    providers: {
        [K in keyof TProviderSet]: Promise<TProviderSet[K]>
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
        subscribe: (provider, event) => createSubscription(providers[provider], event),
    }
}
