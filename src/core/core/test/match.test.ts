import { describe, it, expect } from 'vitest'
import { match, relativeUrlHeuristic } from '../src/match'
import { createRealEndpointHandle } from '../src/endpoint-handle'
import type {
    EndpointState,
    Provider,
    EndpointIndex,
    EndpointHandle,
} from '../src/provider'
import type { State, StateUnknown } from '../src/state'
import { ProviderSet } from '../src/provider-set'

type TestProvider = Provider<'event1' | 'event2'>

function createEndpointState(relativeUrl: string): EndpointState<TestProvider> {
    return {
        relativeUrl: relativeUrl as EndpointState<TestProvider>['relativeUrl'],
        events: ['event1'],
        config: {},
    }
}

function createRealHandle(id: string): EndpointHandle {
    return createRealEndpointHandle(id)._unsafeUnwrap()
}

function createState<P extends ProviderSet>(
    providerStates: StateUnknown<P>['providerStates'],
    baseUrl = 'https://example.com',
    providers = {} as P,
): State<P> {
    const result: State<P> = {
        baseUrl: baseUrl as State<P>['baseUrl'],
        providers,
        providerStates: {} as State<P>['providerStates'],
    }
    let handleIdx = 0
    for (const [provider, states] of Object.entries(providerStates)) {
        const index: EndpointIndex<TestProvider> = new Map()
        for (const state of states) {
            const handle = `handle-${handleIdx++}`
            index.set(createRealHandle(handle), state)
        }
        result.providerStates[provider as keyof P] =
            index as State<P>['providerStates'][keyof P]
    }
    return result
}

function createStateUnknown<P extends ProviderSet>(
    providerStates: StateUnknown<P>['providerStates'],
    baseUrl = 'https://example.com',
    providers = {} as P,
): StateUnknown<P> {
    return {
        baseUrl: baseUrl as StateUnknown<P>['baseUrl'],
        providers,
        providerStates,
    }
}

function isOrphanHandle(handle: string): boolean {
    return handle.startsWith('___ORPHAN___')
}

describe('match', () => {
    describe('using relativeUrlHeuristic', () => {
        it('returns empty providerStates when unknown has no providerStates', () => {
            const unknown = createStateUnknown({})
            const known = createState({})

            const result = match(relativeUrlHeuristic, unknown, known)

            expect(result.isOk()).toBe(true)
            expect(result._unsafeUnwrap().providerStates).toEqual({})
        })

        it('marks all states as orphan when provider is new (not in known)', () => {
            const unknown = createStateUnknown({
                providerA: new Set([createEndpointState('/webhook1')]),
            })
            const known = createState({})

            const result = match(relativeUrlHeuristic, unknown, known)

            expect(result.isOk()).toBe(true)
            const states = result._unsafeUnwrap().providerStates['providerA']!
            expect(states.size).toBe(1)
            for (const handle of states.keys()) {
                expect(isOrphanHandle(handle)).toBe(true)
            }
        })

        it('matches unknown state to known state when relativeUrls match', () => {
            const unknown = createStateUnknown({
                providerA: new Set([createEndpointState('/webhook1')]),
            })
            const known = createState({
                providerA: new Set([createEndpointState('/webhook1')]),
            })

            const result = match(relativeUrlHeuristic, unknown, known)

            expect(result.isOk()).toBe(true)
            const resultStates =
                result._unsafeUnwrap().providerStates['providerA']!
            expect(resultStates.size).toBe(1)
            const entries = Array.from(resultStates.entries())
            const firstEntry = entries[0]!
            const [handle, state] = firstEntry
            expect(isOrphanHandle(handle)).toBe(false)
            expect(state.relativeUrl).toBe('/webhook1')
        })

        it('marks unknown state as orphan when no match found', () => {
            const unknown = createStateUnknown({
                providerA: new Set([createEndpointState('/webhook1')]),
            })
            const known = createState({
                providerA: new Set([createEndpointState('/webhook2')]),
            })

            const result = match(relativeUrlHeuristic, unknown, known)

            expect(result.isOk()).toBe(true)
            const states = result._unsafeUnwrap().providerStates['providerA']!
            expect(states.size).toBe(1)
            const entries = Array.from(states.entries())
            const [handle] = entries[0]!
            expect(isOrphanHandle(handle)).toBe(true)
        })

        it('handles multiple providers correctly', () => {
            const unknown = createStateUnknown({
                providerA: new Set([createEndpointState('/webhook1')]),
                providerB: new Set([createEndpointState('/webhook2')]),
            })
            const known = createState({
                providerA: new Set([createEndpointState('/webhook1')]),
            })

            const result = match(relativeUrlHeuristic, unknown, known)

            expect(result.isOk()).toBe(true)
            const providerA =
                result._unsafeUnwrap().providerStates['providerA']!
            const providerB =
                result._unsafeUnwrap().providerStates['providerB']!

            expect(providerA.size).toBe(1)
            expect(providerB.size).toBe(1)

            const providerAEntries = Array.from(providerA.entries())
            const handleA = providerAEntries[0]![0]
            expect(isOrphanHandle(handleA)).toBe(false)

            const providerBEntries = Array.from(providerB.entries())
            const handleB = providerBEntries[0]![0]
            expect(isOrphanHandle(handleB)).toBe(true)
        })

        it('matches multiple unknown states to multiple known states', () => {
            const unknown = createStateUnknown({
                providerA: new Set([
                    createEndpointState('/webhook1'),
                    createEndpointState('/webhook2'),
                ]),
            })
            const known = createState({
                providerA: new Set([
                    createEndpointState('/webhook1'),
                    createEndpointState('/webhook2'),
                ]),
            })

            const result = match(relativeUrlHeuristic, unknown, known)

            expect(result.isOk()).toBe(true)
            const states = result._unsafeUnwrap().providerStates['providerA']!
            expect(states.size).toBe(2)
            for (const [handle, state] of states) {
                expect(isOrphanHandle(handle)).toBe(false)
                expect(['/webhook1', '/webhook2']).toContain(state.relativeUrl)
            }
        })

        it('correctly handles mixed matched and orphan states', () => {
            const unknown = createStateUnknown({
                providerA: new Set([
                    createEndpointState('/webhook1'),
                    createEndpointState('/webhook3'),
                ]),
            })
            const known = createState({
                providerA: new Set([
                    createEndpointState('/webhook1'),
                    createEndpointState('/webhook2'),
                ]),
            })

            const result = match(relativeUrlHeuristic, unknown, known)

            expect(result.isOk()).toBe(true)
            const states = result._unsafeUnwrap().providerStates['providerA']!
            expect(states.size).toBe(2)

            const matchedStates = Array.from(states.entries()).filter(
                ([h]) => !isOrphanHandle(h),
            )
            const orphanStates = Array.from(states.entries()).filter(([h]) =>
                isOrphanHandle(h),
            )

            expect(matchedStates.length).toBe(1)
            expect(matchedStates[0]![1].relativeUrl).toBe('/webhook1')

            expect(orphanStates.length).toBe(1)
            expect(orphanStates[0]![1].relativeUrl).toBe('/webhook3')
        })

        it('preserves baseUrl and providers from unknown', () => {
            const unknown = createStateUnknown(
                { providerA: new Set([createEndpointState('/webhook1')]) },
                'https://unknown.com',
                { providerA: {} } as unknown as { providerA: Provider },
            )
            const known = createState(
                { providerA: new Set([createEndpointState('/webhook1')]) },
                'https://known.com',
            )

            const result = match(relativeUrlHeuristic, unknown, known)

            expect(result.isOk()).toBe(true)
            expect(result._unsafeUnwrap().baseUrl).toBe('https://unknown.com')
        })
    })
})
