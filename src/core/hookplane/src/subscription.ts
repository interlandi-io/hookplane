import {
    EndpointHandle,
    EventDefinition,
    EventTypeOf,
    PayloadOf,
    Provider,
} from '@hookplane/core'

export type Subscription<P extends Provider, E extends keyof P['events']> = {
    incoming(request: Request): Promise<PayloadOf<P['events'][E]>>
}

export function createSubscription<
    P extends Provider,
    E extends keyof P['events'],
>(provider: P, event: E): Subscription<P, E> {
    return {
        async incoming(request) {
            // TODO: make provider.processRequest not optional
            const result = await provider.processRequest!({ 
                handle: '' as EndpointHandle, // TODO
                request,
                providerState: provider.state,
                providerConfig: provider.config,
            })
            const { data } = result._unsafeUnwrap()
            return data as PayloadOf<P['events'][E]>
        }
    }
}
