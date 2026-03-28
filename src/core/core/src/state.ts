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
        [K in keyof P]: EndpointState<P[K]>[]
    }
}

type ProviderState<P extends Provider> = Record<RelativeUrl, EndpointState<P>>

export { type State, type ProviderState }
