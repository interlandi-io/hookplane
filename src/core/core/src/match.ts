// A matcher takes in a StateUnknown and returns a State

import { err, ok, Result } from 'neverthrow'
import { EndpointIndex, EndpointState, Provider } from './provider'
import { ProviderSet } from './provider-set'
import { State, StateUnknown } from './state'
import { createOrphanEndpointHandle } from './endpoint-handle'

export type Heuristic = <P extends Provider>(
    unknown: EndpointState<P>,
    known: EndpointState<P>,
) => boolean

export type MatchError = MultipleMatchesError

export interface MultipleMatchesError {
    name: 'MultipleMatchesError'
    message: 'multiple matches found for a single endpoint state'
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    unknown: EndpointState<any>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    matched: EndpointState<any>[]
}

/**
 * Takes in a `_unknown` and attempts to match the `EndpointState`s in it
 * to the `EndpointState`s in `known` based on `heuristic`.
 *
 * Any states that are not matched are decidedly orphan.
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
                        unknown: unknownState,
                        matched: [prev, knownState],
                    } satisfies MultipleMatchesError)
                } else {
                    outputIndex.set(handle, unknownState)
                    matched = true
                }
            }

            if (!matched) {
                outputIndex.set(createOrphanEndpointHandle(), unknownState)
            }
        }

        providerStates[provider] = outputIndex
    }

    return ok({
        baseUrl: unknown.baseUrl,
        providers: unknown.providers,
        providerStates,
    })
}

export const relativeUrlHeuristic: Heuristic = (unknown, known) =>
    unknown.relativeUrl === known.relativeUrl
