/**
 * Core state management utilities for Hookplane.
 *
 * This module defines the core generic types that power providers,
 * and the snapshot state used by the library.
 *
 */
import { type EndpointState, type EndpointIndex } from './provider.js'
import { ProviderSet } from './provider-set.js'

/**
 * A snapshot of an application-wide endpoint configuration.
 */
interface State<P extends ProviderSet> {
    /** The providers themselves. */
    providers: P
    /** A map of providers to the endpoints the know about. */
    providerStates: {
        [K in keyof P]: EndpointIndex<P[K]>
    }
}

/**
 * A snapshot of an application-wide endpoint configuration discovered from an external source,
 * where endpoint states are not yet mapped to known handles.
 */
interface StateUnknown<P extends ProviderSet> {
    /** The providers themselves. */
    providers: P
    /** A map of providers to the endpoints the know about. */
    providerStates: {
        [K in keyof P]: Set<EndpointState<P[K]>>
    }
}

export { type State, type StateUnknown }
