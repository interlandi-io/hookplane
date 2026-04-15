// A matcher takes in a StateUnknown and returns a State

import { err, ok, Result } from 'neverthrow'
import { EndpointIndex, EndpointState, Provider } from './provider.js'
import { ProviderSet } from './provider-set.js'
import { State, StateUnknown } from './state.js'
import { createOrphanEndpointHandle } from './endpoint-handle.js'

export type Heuristic = <P extends Provider>(
    unknown: EndpointState<P>,
    known: EndpointState<P>,
) => boolean

export type MatchError = MultipleMatchesError

export interface MultipleMatchesError {
    name: 'MultipleMatchesError'
    message: 'multiple matches found for a single endpoint state'
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    known: EndpointState<any>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    matched: EndpointState<any>[]
}

/**
 * Aligns endpoint states from an unknown state to a known state using a heuristic, producing a reconciled State whose endpoint handles are either mapped to matched known handles or created as orphans.
 *
 * @param heuristic - Function that returns `true` when an unknown `EndpointState` should be considered a match for a known `EndpointState`
 * @param unknown - The source state containing endpoint states to be matched
 * @param known - The reference state whose provider indexes are used to find matches
 * @returns A `Result` containing the reconciled `State` on success; an `err` with `MultipleMatchesError` when a single unknown endpoint state matches more than one known state that map to the same handle.
 */
export function match<P extends ProviderSet>(
    heuristic: Heuristic,
    unknown: StateUnknown<P>,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    known: State<any>,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Result<State<any>, MatchError> {
    const providerStates = {} as State<P>['providerStates']

    for (const e of Object.entries(unknown.providerStates)) {
        const [provider, unknownSet] = e as [
            keyof P,
            Set<EndpointState<P[keyof P]>>,
        ]
        const knownIndex = known.providerStates[provider]
        // If this provider is new, all handles are orphan
        if (!knownIndex) {
            const entries = Array.from(
                unknownSet,
                (e) => [createOrphanEndpointHandle(), e] as const,
            )
            providerStates[provider] = new Map(entries)
            continue
        }
        const outputIndex: EndpointIndex<P[keyof P]> = new Map()

        for (const unknownState of unknownSet) {
            let matched = false
            for (const [handle, knownState] of knownIndex) {
                if (!heuristic(unknownState, knownState)) {
                    continue
                }
                const prev = outputIndex.get(handle)
                // matched should be true here
                if (prev) {
                    return err({
                        name: 'MultipleMatchesError',
                        message:
                            'multiple matches found for a single endpoint state',
                        known: knownState,
                        matched: [prev, unknownState],
                    } satisfies MultipleMatchesError)
                } else {
                    outputIndex.set(handle, unknownState)
                    matched = true
                    break
                }
            }

            if (!matched) {
                outputIndex.set(createOrphanEndpointHandle(), unknownState)
            }
        }

        providerStates[provider] = outputIndex
    }

    return ok({
        providers: unknown.providers,
        providerStates,
    })
}

export const endpointUrlHeuristic: Heuristic = (unknown, known) =>
    unknown.url === known.url
