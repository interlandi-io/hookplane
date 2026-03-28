/**
 * Core state management utilities for Hookplane.
 *
 * This module defines the core generic types that power providers,
 * and the snapshot state used by the library.
 *
 */
import {
    type Provider,
    type EndpointState,
    type BaseUrl,
    type RelativeUrl,
    type EndpointMap,
} from './provider'
import { ProviderSet } from './provider-set'

/**
 * A snapshot of an application-wide endpoint configuration.
 */
interface State<P extends ProviderSet> {
    /** The base URL of the application/state. */
    baseUrl: BaseUrl
    /** The providers themselves. */
    providers: P
    /** A map of providers to the endpoints the know about. */
    providerStates: {
        [K in keyof P]: Map<RelativeUrl, EndpointState<P[K]>> 
    }
}

/**
 * Similar to a `State`, only it now contains `SubscriptionKeys` mapping subscriptions to a real remote resource.
 */
interface MappedState<P extends ProviderSet> {
    /** The base URL of the application/state. */
    baseUrl: BaseUrl
    /** The providers themselves. */
    providers: P
    /** A map of providers to the mapped endpoints the know about. */
    providerMaps: {
        [K in keyof P]: EndpointMap<P[K]> 
    }
}


export { type State, type MappedState }
