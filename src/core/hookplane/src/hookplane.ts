import { ProviderSet } from '@hookplane/core'
import { Subscription, createSubscription } from './subscription'

export type Hookplane<TProviderSet extends ProviderSet> = {
    providers: TProviderSet
    subscribe<P extends keyof TProviderSet, E extends keyof TProviderSet[P]['events']>(
        provider: P,
        event: E,
    ): Subscription<TProviderSet[P], E>
}

export type HookplaneParams<TProviderSet extends ProviderSet> = {
    providers: TProviderSet
}

export function hookplane<TProviderSet extends ProviderSet>(
    params: HookplaneParams<TProviderSet>,
): Hookplane<TProviderSet> {
    return {
        ...params,
        subscribe: (provider, event) => createSubscription(provider, event),
    }
}
