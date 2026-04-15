import { describe, it, expect } from 'vitest'
import { match, endpointUrlHeuristic } from '../src/match.js'
import {
    createRealEndpointHandle,
    type EndpointHandle,
} from '../src/endpoint-handle.js'
import type { EndpointState, Provider, EndpointIndex } from '../src/provider.js'
import type { State, StateUnknown } from '../src/state.js'
import { ProviderSet } from '../src/provider-set.js'
import { createEndpointUrl } from '../src/url.js'

type TestProvider = Provider<'event1' | 'event2'>

function createEndpointState(url: string): EndpointState<TestProvider> {
    return {
        url: createEndpointUrl(url)._unsafeUnwrap(),
        events: ['event1'],
        config: {},
    }
}

function createRealHandle(id: string): EndpointHandle {
    return createRealEndpointHandle(id)._unsafeUnwrap()
}

function createState<P extends ProviderSet>(
    providerStates: StateUnknown<P>['providerStates'],
    providers = {} as P,
): State<P> {
    const result: State<P> = {
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
    providers = {} as P,
): StateUnknown<P> {
    return {
        providers,
        providerStates,
    }
}

function isOrphanHandle(handle: string): boolean {
    return handle.startsWith('___ORPHAN___')
}

describe('match', () => {
    describe('using endpointUrlHeuristic', () => {
        it('returns empty providerStates when unknown has no providerStates', () => {
            const unknown = createStateUnknown({})
            const known = createState({})

            const result = match(endpointUrlHeuristic, unknown, known)

            expect(result.isOk()).toBe(true)
            expect(result._unsafeUnwrap().providerStates).toEqual({})
        })

        it('marks all states as orphan when provider is new (not in known)', () => {
            const unknown = createStateUnknown({
                providerA: new Set([
                    createEndpointState('https://example.com/webhook1'),
                ]),
            })
            const known = createState({})

            const result = match(endpointUrlHeuristic, unknown, known)

            expect(result.isOk()).toBe(true)
            const states = result._unsafeUnwrap().providerStates['providerA']!
            expect(states.size).toBe(1)
            for (const handle of states.keys()) {
                expect(isOrphanHandle(handle)).toBe(true)
            }
        })

        it('matches unknown state to known state when endpointUrls match', () => {
            const unknown = createStateUnknown({
                providerA: new Set([
                    createEndpointState('https://example.com/webhook1'),
                ]),
            })
            const known = createState({
                providerA: new Set([
                    createEndpointState('https://example.com/webhook1'),
                ]),
            })

            const result = match(endpointUrlHeuristic, unknown, known)

            expect(result.isOk()).toBe(true)
            const resultStates =
                result._unsafeUnwrap().providerStates['providerA']!
            expect(resultStates.size).toBe(1)
            const entries = Array.from(resultStates.entries())
            const firstEntry = entries[0]!
            const [handle, state] = firstEntry
            expect(isOrphanHandle(handle)).toBe(false)
            expect(state.url).toBe('https://example.com/webhook1')
        })

        it('marks unknown state as orphan when no match found', () => {
            const unknown = createStateUnknown({
                providerA: new Set([
                    createEndpointState('https://example.com/webhook1'),
                ]),
            })
            const known = createState({
                providerA: new Set([
                    createEndpointState('https://example.com/webhook2'),
                ]),
            })

            const result = match(endpointUrlHeuristic, unknown, known)

            expect(result.isOk()).toBe(true)
            const states = result._unsafeUnwrap().providerStates['providerA']!
            expect(states.size).toBe(1)
            const entries = Array.from(states.entries())
            const [handle] = entries[0]!
            expect(isOrphanHandle(handle)).toBe(true)
        })

        it('handles multiple providers correctly', () => {
            const unknown = createStateUnknown({
                providerA: new Set([
                    createEndpointState('https://example.com/webhook1'),
                ]),
                providerB: new Set([
                    createEndpointState('https://example.com/webhook2'),
                ]),
            })
            const known = createState({
                providerA: new Set([
                    createEndpointState('https://example.com/webhook1'),
                ]),
            })

            const result = match(endpointUrlHeuristic, unknown, known)

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
                    createEndpointState('https://example.com/webhook1'),
                    createEndpointState('https://example.com/webhook2'),
                ]),
            })
            const known = createState({
                providerA: new Set([
                    createEndpointState('https://example.com/webhook1'),
                    createEndpointState('https://example.com/webhook2'),
                ]),
            })

            const result = match(endpointUrlHeuristic, unknown, known)

            expect(result.isOk()).toBe(true)
            const states = result._unsafeUnwrap().providerStates['providerA']!
            expect(states.size).toBe(2)
            for (const [handle, state] of states) {
                expect(isOrphanHandle(handle)).toBe(false)
                expect([
                    'https://example.com/webhook1',
                    'https://example.com/webhook2',
                ]).toContain(state.url)
            }
        })

        it('correctly handles mixed matched and orphan states', () => {
            const unknown = createStateUnknown({
                providerA: new Set([
                    createEndpointState('https://example.com/webhook1'),
                    createEndpointState('https://example.com/webhook3'),
                ]),
            })
            const known = createState({
                providerA: new Set([
                    createEndpointState('https://example.com/webhook1'),
                    createEndpointState('https://example.com/webhook2'),
                ]),
            })

            const result = match(endpointUrlHeuristic, unknown, known)

            expect(result.isOk()).toBe(true)
            const states = result._unsafeUnwrap().providerStates['providerA']!
            expect(states.size).toBe(2)

            const entries = Array.from(states.entries())
            const matchedEntries = entries.filter(([h]) => !isOrphanHandle(h))
            const orphanEntries = entries.filter(([h]) => isOrphanHandle(h))

            expect(matchedEntries.length).toBe(1)
            expect(matchedEntries[0]![1].url).toBe(
                'https://example.com/webhook1',
            )

            expect(orphanEntries.length).toBe(1)
            expect(orphanEntries[0]![1].url).toBe(
                'https://example.com/webhook3',
            )
        })

        it('preserves providers from unknown', () => {
            const unknown = createStateUnknown(
                {
                    providerA: new Set([
                        createEndpointState('https://example.com/webhook1'),
                    ]),
                },
                { providerA: {} } as unknown as { providerA: Provider },
            )
            const known = createState({
                providerA: new Set([
                    createEndpointState('https://example.com/webhook1'),
                ]),
            })

            const result = match(endpointUrlHeuristic, unknown, known)

            expect(result.isOk()).toBe(true)
            expect(result._unsafeUnwrap().providers).toBe(unknown.providers)
        })
    })
})
