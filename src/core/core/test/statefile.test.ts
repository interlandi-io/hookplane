import { describe, it, expect } from 'vitest'
import {
    bootstrap,
    fromState,
    parseStatefile,
    ProviderNotFoundError,
} from '~/statefile.js'
import { createEndpointUrl } from '~/url.js'
import { createRealEndpointHandle } from '~/endpoint-handle.js'
import type { EndpointHandle } from '~/endpoint-handle.js'
import type { EndpointState, Provider } from '~/provider.js'
import { createProviderSet, type ProviderSet } from '~/provider-set.js'
import { okAsync } from 'neverthrow'

function createMockProvider(name: string, events: string[]): Provider {
    const eventDefs: Record<string, { parse?: (data: unknown) => unknown }> = {}
    for (const event of events) {
        eventDefs[event] = {}
    }

    return {
        name,
        config: {},
        state: {},
        events: eventDefs as Provider['events'],
        setup: () => okAsync({}),
        createEndpoint: () => {
            throw new Error('Function not implemented.')
        },
        readEndpoint: () => {
            return okAsync({
                url: createEndpointUrl(
                    'https://example.com/webhook',
                )._unsafeUnwrap(),
                events: [],
                config: {},
            } satisfies EndpointState<Provider>)
        },
        updateEndpoint: () => okAsync(),
        deleteEndpoint: () => okAsync(),
        indexEndpoints: () => okAsync(new Map()),
        processRequest: () =>
            okAsync({
                event: events[0] as 'payment.succeeded' | 'push',
                data: {},
            }),
    }
}

function createTestProviderSet(providers: Provider[]): ProviderSet {
    const set: Record<string, Provider> = {}
    for (const p of providers) {
        set[p.name] = p
    }
    const result = createProviderSet(set)
    if (result.isErr()) {
        throw new Error(`Failed to create provider set: ${result.error}`)
    }
    return result.value
}

describe('parseStatefile', () => {
    describe('SchemaValidationError', () => {
        it('returns error for empty object', () => {
            const providers = createTestProviderSet([
                createMockProvider('stripe', ['payment.succeeded']),
            ])
            const result = parseStatefile({}, providers)
            expect(result.isErr()).toBe(true)
            expect(result._unsafeUnwrapErr().name).toBe('SchemaValidationError')
        })

        it('returns error for missing providerStates', () => {
            const providers = createTestProviderSet([
                createMockProvider('stripe', ['payment.succeeded']),
            ])
            const result = parseStatefile({ version: 1 }, providers)
            expect(result.isErr()).toBe(true)
            expect(result._unsafeUnwrapErr().name).toBe('SchemaValidationError')
        })

        it('returns error for wrong type for url', () => {
            const providers = createTestProviderSet([
                createMockProvider('stripe', ['payment.succeeded']),
            ])
            const result = parseStatefile(
                {
                    version: 1,
                    providerStates: {
                        stripe: {
                            'endpoint-1': {
                                state: {
                                    url: 123,
                                    events: ['payment.succeeded'],
                                    config: {},
                                },
                            },
                        },
                    },
                },
                providers,
            )
            expect(result.isErr()).toBe(true)
            expect(result._unsafeUnwrapErr().name).toBe('SchemaValidationError')
        })

        it('returns error for wrong type for events', () => {
            const providers = createTestProviderSet([
                createMockProvider('stripe', ['payment.succeeded']),
            ])
            const result = parseStatefile(
                {
                    version: 1,
                    providerStates: {
                        stripe: {
                            'endpoint-1': {
                                state: {
                                    url: 'https://example.com/webhook',
                                    events: 'not-an-array',
                                    config: {},
                                },
                            },
                        },
                    },
                },
                providers,
            )
            expect(result.isErr()).toBe(true)
            expect(result._unsafeUnwrapErr().name).toBe('SchemaValidationError')
        })

        it('returns error for wrong type for config', () => {
            const providers = createTestProviderSet([
                createMockProvider('stripe', ['payment.succeeded']),
            ])
            const result = parseStatefile(
                {
                    version: 1,
                    providerStates: {
                        stripe: {
                            'endpoint-1': {
                                state: {
                                    url: 'https://example.com/webhook',
                                    events: ['payment.succeeded'],
                                    config: 'not-an-object',
                                },
                            },
                        },
                    },
                },
                providers,
            )
            expect(result.isErr()).toBe(true)
            expect(result._unsafeUnwrapErr().name).toBe('SchemaValidationError')
        })

        it('returns error when providerStates is not an object', () => {
            const providers = createTestProviderSet([
                createMockProvider('stripe', ['payment.succeeded']),
            ])
            const result = parseStatefile(
                {
                    version: 1,
                    providerStates: 'not-an-object',
                },
                providers,
            )
            expect(result.isErr()).toBe(true)
            expect(result._unsafeUnwrapErr().name).toBe('SchemaValidationError')
        })
    })

    describe('ProviderNotFoundError', () => {
        it('returns error when provider in statefile not in provider set', () => {
            const providers = createTestProviderSet([
                createMockProvider('stripe', ['payment.succeeded']),
            ])
            const result = parseStatefile(
                {
                    version: 1,
                    providerStates: {
                        unknown: {
                            'endpoint-1': {
                                state: {
                                    url: 'https://example.com/webhook',
                                    events: ['payment.succeeded'],
                                    config: {},
                                },
                            },
                        },
                    },
                },
                providers,
            )
            expect(result.isErr()).toBe(true)
            const err = result._unsafeUnwrapErr()
            expect(err.name).toBe('ProviderNotFoundError')
            expect((err as ProviderNotFoundError).provider).toBe('unknown')
        })

        it('returns error when one of multiple providers is not found', () => {
            const providers = createTestProviderSet([
                createMockProvider('stripe', ['payment.succeeded']),
                createMockProvider('github', ['push']),
            ])
            const result = parseStatefile(
                {
                    version: 1,
                    providerStates: {
                        stripe: {
                            'endpoint-1': {
                                state: {
                                    url: 'https://example.com/webhook',
                                    events: ['payment.succeeded'],
                                    config: {},
                                },
                            },
                        },
                        nonexistent: {
                            'endpoint-1': {
                                state: {
                                    url: 'https://example.com/webhook',
                                    events: ['push'],
                                    config: {},
                                },
                            },
                        },
                    },
                },
                providers,
            )
            expect(result.isErr()).toBe(true)
            const err = result._unsafeUnwrapErr()
            expect(err.name).toBe('ProviderNotFoundError')
            expect((err as ProviderNotFoundError).provider).toBe('nonexistent')
        })

        it('returns ProviderNotFoundError when provider in statefile not in ProviderSet', () => {
            const providers = createTestProviderSet([
                createMockProvider('stripe', ['payment.succeeded']),
            ])
            const result = parseStatefile(
                {
                    version: 1,
                    providerStates: {
                        stripe: {
                            'endpoint-1': {
                                state: {
                                    url: 'https://example.com/webhook',
                                    events: ['payment.succeeded'],
                                    config: {},
                                },
                            },
                        },
                        github: {
                            'endpoint-2': {
                                state: {
                                    url: 'https://example.com/github',
                                    events: ['push'],
                                    config: {},
                                },
                            },
                        },
                    },
                },
                providers,
            )
            expect(result.isErr()).toBe(true)
            expect(result._unsafeUnwrapErr().name).toBe('ProviderNotFoundError')
        })
    })

    describe('valid statefile', () => {
        it('accepts https URL', () => {
            const providers = createTestProviderSet([
                createMockProvider('stripe', ['payment.succeeded']),
            ])
            const result = parseStatefile(
                {
                    version: 1,
                    providerStates: {
                        stripe: {
                            'endpoint-1': {
                                state: {
                                    url: 'https://example.com/webhook',
                                    events: ['payment.succeeded'],
                                    config: {},
                                },
                            },
                        },
                    },
                },
                providers,
            )
            expect(result.isOk()).toBe(true)
        })

        it('returns ok with valid statefile', () => {
            const providers = createTestProviderSet([
                createMockProvider('stripe', [
                    'payment.succeeded',
                    'payment.failed',
                ]),
                createMockProvider('github', ['push', 'pull_request']),
            ])
            const result = parseStatefile(
                {
                    version: 1,
                    providerStates: {
                        stripe: {
                            'endpoint-1': {
                                state: {
                                    url: 'https://example.com/webhook',
                                    events: ['payment.succeeded'],
                                    config: { foo: 'bar' },
                                },
                            },
                        },
                        github: {
                            'endpoint-2': {
                                state: {
                                    url: 'https://example.com/github',
                                    events: ['push', 'pull_request'],
                                    config: {},
                                },
                            },
                        },
                    },
                },
                providers,
            )
            expect(result.isOk()).toBe(true)
            const statefile = result._unsafeUnwrap()
            expect(Object.keys(statefile.data.providerStates)).toEqual([
                'stripe',
                'github',
            ])
        })

        it('allows empty providerStates object', () => {
            const providers = createTestProviderSet([
                createMockProvider('stripe', ['payment.succeeded']),
            ])
            const result = parseStatefile(
                {
                    version: 1,
                    providerStates: {},
                },
                providers,
            )
            expect(result.isOk()).toBe(true)
            expect(result._unsafeUnwrap().data.providerStates).toEqual({})
        })

        it('allows empty events array', () => {
            const providers = createTestProviderSet([
                createMockProvider('stripe', ['payment.succeeded']),
            ])
            const result = parseStatefile(
                {
                    version: 1,
                    providerStates: {
                        stripe: {
                            'endpoint-1': {
                                state: {
                                    url: 'https://example.com/webhook',
                                    events: [],
                                    config: {},
                                },
                            },
                        },
                    },
                },
                providers,
            )
            expect(result.isOk()).toBe(true)
            expect(
                result._unsafeUnwrap().data.providerStates['stripe']![
                    createRealEndpointHandle('endpoint-1')._unsafeUnwrap()
                ]!.state.events,
            ).toEqual([])
        })

        it('allows multiple endpoints per provider', () => {
            const providers = createTestProviderSet([
                createMockProvider('stripe', ['payment.succeeded']),
            ])
            const result = parseStatefile(
                {
                    version: 1,
                    providerStates: {
                        stripe: {
                            'endpoint-1': {
                                state: {
                                    url: 'https://example.com/webhook-one',
                                    events: ['payment.succeeded'],
                                    config: {},
                                },
                            },
                            'endpoint-2': {
                                state: {
                                    url: 'https://example.com/webhook-two',
                                    events: ['payment.succeeded'],
                                    config: {},
                                },
                            },
                        },
                    },
                },
                providers,
            )
            expect(result.isOk()).toBe(true)
            const endpoints =
                result._unsafeUnwrap().data.providerStates['stripe']
            expect(Object.keys(endpoints!)).toHaveLength(2)
        })

        it('returns url as EndpointUrl type', () => {
            const providers = createTestProviderSet([
                createMockProvider('stripe', ['payment.succeeded']),
            ])
            const result = parseStatefile(
                {
                    version: 1,
                    providerStates: {
                        stripe: {
                            'endpoint-1': {
                                state: {
                                    url: 'https://example.com/webhooks/stripe',
                                    events: ['payment.succeeded'],
                                    config: {},
                                },
                            },
                        },
                    },
                },
                providers,
            )
            expect(result.isOk()).toBe(true)
            const url =
                result._unsafeUnwrap().data.providerStates['stripe']![
                    createRealEndpointHandle('endpoint-1')._unsafeUnwrap()
                ]!.state.url
            expect(url).toBe('https://example.com/webhooks/stripe')
        })
    })

    describe('bootstrap', () => {
        it('bootstraps', () => {
            const statefile = bootstrap()
            expect(
                Array.from(Object.keys(statefile.data.providerStates)),
            ).toHaveLength(0)
            expect(statefile.toState().isOk()).toBe(true)
        })
    })

    describe('toState', () => {
        it('returns State with providers', () => {
            const providers = createTestProviderSet([
                createMockProvider('stripe', ['payment.succeeded']),
            ])
            const result = parseStatefile(
                {
                    version: 1,
                    providerStates: {
                        stripe: {
                            'endpoint-1': {
                                state: {
                                    url: 'https://example.com/webhook',
                                    events: ['payment.succeeded'],
                                    config: {},
                                },
                            },
                        },
                    },
                },
                providers,
            )
            expect(result.isOk()).toBe(true)
            const state = result._unsafeUnwrap().toState()._unsafeUnwrap()
            expect(state.providers).toBe(providers)
        })

        it('returns State with providerStates as Map', () => {
            const providers = createTestProviderSet([
                createMockProvider('stripe', ['payment.succeeded']),
            ])
            const result = parseStatefile(
                {
                    version: 1,
                    providerStates: {
                        stripe: {
                            'handle-1': {
                                state: {
                                    url: 'https://example.com/webhook',
                                    events: ['payment.succeeded'],
                                    config: {},
                                },
                            },
                        },
                    },
                },
                providers,
            )
            expect(result.isOk()).toBe(true)
            const state = result._unsafeUnwrap().toState()._unsafeUnwrap()
            const stripeEndpoints = state.providerStates['stripe']!
            expect(stripeEndpoints).toBeInstanceOf(Map)
            expect(stripeEndpoints.has('handle-1' as EndpointHandle)).toBe(true)
        })

        it('converts multiple endpoints to Map entries', () => {
            const providers = createTestProviderSet([
                createMockProvider('stripe', [
                    'payment.succeeded',
                    'payment.failed',
                ]),
            ])
            const result = parseStatefile(
                {
                    version: 1,
                    providerStates: {
                        stripe: {
                            'endpoint-a': {
                                state: {
                                    url: 'https://example.com/webhook-a',
                                    events: ['payment.succeeded'],
                                    config: { a: 1 },
                                },
                            },
                            'endpoint-b': {
                                state: {
                                    url: 'https://example.com/webhook-b',
                                    events: ['payment.failed'],
                                    config: { b: 2 },
                                },
                            },
                        },
                    },
                },
                providers,
            )
            expect(result.isOk()).toBe(true)
            const state = result._unsafeUnwrap().toState()._unsafeUnwrap()
            const stripeEndpoints = state.providerStates['stripe']!

            expect(stripeEndpoints.size).toBe(2)

            const endpointA = stripeEndpoints.get(
                createRealEndpointHandle('endpoint-a')._unsafeUnwrap(),
            )
            expect(endpointA?.url).toBe('https://example.com/webhook-a')
            expect(endpointA?.events).toEqual(['payment.succeeded'])
            expect(endpointA?.config).toEqual({ a: 1 })

            const endpointB = stripeEndpoints.get(
                createRealEndpointHandle('endpoint-b')._unsafeUnwrap(),
            )
            expect(endpointB?.url).toBe('https://example.com/webhook-b')
            expect(endpointB?.events).toEqual(['payment.failed'])
            expect(endpointB?.config).toEqual({ b: 2 })
        })

        it('handles multiple providers with endpoints', () => {
            const providers = createTestProviderSet([
                createMockProvider('stripe', ['payment.succeeded']),
                createMockProvider('github', ['push']),
            ])
            const result = parseStatefile(
                {
                    version: 1,
                    providerStates: {
                        stripe: {
                            'stripe-1': {
                                state: {
                                    url: 'https://example.com/stripe',
                                    events: ['payment.succeeded'],
                                    config: {},
                                },
                            },
                        },
                        github: {
                            'github-1': {
                                state: {
                                    url: 'https://example.com/github',
                                    events: ['push'],
                                    config: {},
                                },
                            },
                        },
                    },
                },
                providers,
            )
            expect(result.isOk()).toBe(true)
            const state = result._unsafeUnwrap().toState()._unsafeUnwrap()

            expect(state.providerStates['stripe']).toBeInstanceOf(Map)
            expect(state.providerStates['github']).toBeInstanceOf(Map)
            expect(state.providerStates['stripe']!.size).toBe(1)
            expect(state.providerStates['github']!.size).toBe(1)
        })
    })

    describe('fromState', () => {
        it('converts State to Statefile with correct structure', () => {
            const providers = createTestProviderSet([
                createMockProvider('stripe', ['payment.succeeded']),
            ])

            const state = {
                providers,
                providerStates: {
                    stripe: new Map([
                        [
                            createRealEndpointHandle(
                                'endpoint-1',
                            )._unsafeUnwrap(),
                            {
                                url: createEndpointUrl(
                                    'https://example.com/webhook',
                                )._unsafeUnwrap(),
                                events: ['payment.succeeded'],
                                config: {},
                            },
                        ],
                    ]),
                },
            }

            const result = fromState(1, state)

            expect(result.data.version).toBe(1)
            expect(result.data.providerStates.stripe).toBeDefined()
            expect(
                result.data.providerStates.stripe![
                    createRealEndpointHandle('endpoint-1')._unsafeUnwrap()
                ]!.state.url,
            ).toBe('https://example.com/webhook')
        })

        it('roundtrips through parseStatefile and toState', () => {
            const providers = createTestProviderSet([
                createMockProvider('stripe', ['payment.succeeded']),
            ])

            const originalStatefile = {
                version: 1,
                providerStates: {
                    stripe: {
                        'endpoint-1': {
                            state: {
                                url: 'https://example.com/webhook',
                                events: ['payment.succeeded'],
                                config: { foo: 'bar' },
                            },
                        },
                    },
                },
            }

            const parseResult = parseStatefile(originalStatefile, providers)
            expect(parseResult.isOk()).toBe(true)

            const state = parseResult._unsafeUnwrap().toState()._unsafeUnwrap()
            const statefile = fromState(1, state)

            expect(statefile.data.version).toBe(1)
            expect(
                statefile.data.providerStates.stripe![
                    createRealEndpointHandle('endpoint-1')._unsafeUnwrap()
                ]!.state.url,
            ).toBe('https://example.com/webhook')
            expect(
                statefile.data.providerStates.stripe![
                    createRealEndpointHandle('endpoint-1')._unsafeUnwrap()
                ]!.state.events,
            ).toEqual(['payment.succeeded'])
        })

        it('handles multiple providers', () => {
            const providers = createTestProviderSet([
                createMockProvider('stripe', ['payment.succeeded']),
                createMockProvider('github', ['push']),
            ])

            const state = {
                providers,
                providerStates: {
                    stripe: new Map([
                        [
                            createRealEndpointHandle(
                                'endpoint-1',
                            )._unsafeUnwrap(),
                            {
                                url: createEndpointUrl(
                                    'https://example.com/stripe',
                                )._unsafeUnwrap(),
                                events: ['payment.succeeded'],
                                config: {},
                            },
                        ],
                    ]),
                    github: new Map([
                        [
                            createRealEndpointHandle(
                                'endpoint-2',
                            )._unsafeUnwrap(),
                            {
                                url: createEndpointUrl(
                                    'https://example.com/github',
                                )._unsafeUnwrap(),
                                events: ['push'],
                                config: {},
                            },
                        ],
                    ]),
                },
            }

            const result = fromState(1, state)

            expect(Object.keys(result.data.providerStates)).toEqual([
                'stripe',
                'github',
            ])
            expect(
                result.data.providerStates.stripe![
                    createRealEndpointHandle('endpoint-1')._unsafeUnwrap()
                ]!.state.url,
            ).toBe('https://example.com/stripe')
            expect(
                result.data.providerStates.github![
                    createRealEndpointHandle('endpoint-2')._unsafeUnwrap()
                ]!.state.url,
            ).toBe('https://example.com/github')
        })

        it('handles multiple endpoints per provider', () => {
            const providers = createTestProviderSet([
                createMockProvider('stripe', [
                    'payment.succeeded',
                    'payment.failed',
                ]),
            ])

            const state = {
                providers,
                providerStates: {
                    stripe: new Map([
                        [
                            createRealEndpointHandle(
                                'endpoint-a',
                            )._unsafeUnwrap(),
                            {
                                url: createEndpointUrl(
                                    'https://example.com/webhook-a',
                                )._unsafeUnwrap(),
                                events: ['payment.succeeded'],
                                config: { a: 1 },
                            },
                        ],
                        [
                            createRealEndpointHandle(
                                'endpoint-b',
                            )._unsafeUnwrap(),
                            {
                                url: createEndpointUrl(
                                    'https://example.com/webhook-b',
                                )._unsafeUnwrap(),
                                events: ['payment.failed'],
                                config: { b: 2 },
                            },
                        ],
                    ]),
                },
            }

            const result = fromState(1, state)

            const stripeEndpoints = result.data.providerStates.stripe!
            expect(Object.keys(stripeEndpoints)).toEqual([
                'endpoint-a',
                'endpoint-b',
            ])
            expect(
                stripeEndpoints[
                    createRealEndpointHandle('endpoint-a')._unsafeUnwrap()
                ]!.state.url,
            ).toBe('https://example.com/webhook-a')
            expect(
                stripeEndpoints[
                    createRealEndpointHandle('endpoint-b')._unsafeUnwrap()
                ]!.state.url,
            ).toBe('https://example.com/webhook-b')
        })

        it('handles empty providerStates', () => {
            const providers = createTestProviderSet([
                createMockProvider('stripe', ['payment.succeeded']),
            ])

            const state = {
                providers,
                providerStates: {},
            }

            const result = fromState(1, state)

            expect(result.data.providerStates).toEqual({})
        })

        it('toState method on result works correctly', () => {
            const providers = createTestProviderSet([
                createMockProvider('stripe', ['payment.succeeded']),
            ])

            const state = {
                providers,
                providerStates: {
                    stripe: new Map([
                        [
                            createRealEndpointHandle(
                                'endpoint-1',
                            )._unsafeUnwrap(),
                            {
                                url: createEndpointUrl(
                                    'https://example.com/webhook',
                                )._unsafeUnwrap(),
                                events: ['payment.succeeded'],
                                config: {},
                            },
                        ],
                    ]),
                },
            }

            const result = fromState(1, state)
            const recoveredState = result.toState()._unsafeUnwrap()

            expect(recoveredState.providers).toBe(providers)
            expect(recoveredState.providerStates['stripe']).toBeInstanceOf(Map)
            expect(recoveredState.providerStates['stripe']!.size).toBe(1)
        })
    })
})
