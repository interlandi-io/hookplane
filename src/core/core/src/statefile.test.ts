import { describe, it, expect } from 'vitest'
import { fromState, parseStatefile, ProviderNotUsedError } from './statefile'
import { createBaseUrl, createRelativeUrl } from './url'
import {
    createEndpointHandle,
    EndpointHandle,
    EndpointState,
    type Provider,
} from './provider'
import { createProviderSet, type ProviderSet } from './provider-set'
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
        createEndpoint: () => okAsync(),
        readEndpoint: () => {
            return okAsync({
                relativeUrl: createRelativeUrl('/webhook')._unsafeUnwrap(),
                events: [],
                config: {},
            } satisfies EndpointState<Provider>)
        },
        updateEndpoint: () => okAsync(),
        deleteEndpoint: () => okAsync(),
        indexEndpoints: () => okAsync(new Map()),
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

        it('returns error for missing baseUrl', () => {
            const providers = createTestProviderSet([
                createMockProvider('stripe', ['payment.succeeded']),
            ])
            const result = parseStatefile(
                {
                    providerStates: {
                        stripe: {
                            'endpoint-1': {
                                state: {
                                    relativeUrl: '/webhook',
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

        it('returns error for missing providerStates', () => {
            const providers = createTestProviderSet([
                createMockProvider('stripe', ['payment.succeeded']),
            ])
            const result = parseStatefile(
                { baseUrl: 'https://example.com' },
                providers,
            )
            expect(result.isErr()).toBe(true)
            expect(result._unsafeUnwrapErr().name).toBe('SchemaValidationError')
        })

        it('returns error for wrong type for baseUrl', () => {
            const providers = createTestProviderSet([
                createMockProvider('stripe', ['payment.succeeded']),
            ])
            const result = parseStatefile(
                { baseUrl: 123, providerStates: {} },
                providers,
            )
            expect(result.isErr()).toBe(true)
            expect(result._unsafeUnwrapErr().name).toBe('SchemaValidationError')
        })

        it('returns error for wrong type for relativeUrl', () => {
            const providers = createTestProviderSet([
                createMockProvider('stripe', ['payment.succeeded']),
            ])
            const result = parseStatefile(
                {
                    version: 1,
                    baseUrl: 'https://example.com',
                    providerStates: {
                        stripe: {
                            'endpoint-1': {
                                state: {
                                    relativeUrl: 123,
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
                    baseUrl: 'https://example.com',
                    providerStates: {
                        stripe: {
                            'endpoint-1': {
                                state: {
                                    relativeUrl: '/webhook',
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
                    baseUrl: 'https://example.com',
                    providerStates: {
                        stripe: {
                            'endpoint-1': {
                                state: {
                                    relativeUrl: '/webhook',
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
                    baseUrl: 'https://example.com',
                    providerStates: 'not-an-object',
                },
                providers,
            )
            expect(result.isErr()).toBe(true)
            expect(result._unsafeUnwrapErr().name).toBe('SchemaValidationError')
        })
    })

    describe('InvalidBaseUrlError', () => {
        it('returns error for URL without protocol', () => {
            const providers = createTestProviderSet([
                createMockProvider('stripe', ['payment.succeeded']),
            ])
            const result = parseStatefile(
                {
                    version: 1,
                    baseUrl: 'example.com',
                    providerStates: {
                        stripe: {
                            'endpoint-1': {
                                state: {
                                    relativeUrl: '/webhook',
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
            expect(err.name).toBe('SchemaValidationError')
        })

        it('returns error for invalid URL', () => {
            const providers = createTestProviderSet([
                createMockProvider('stripe', ['payment.succeeded']),
            ])
            const result = parseStatefile(
                {
                    version: 1,
                    baseUrl: 'not-a-url',
                    providerStates: {
                        stripe: {
                            'endpoint-1': {
                                state: {
                                    relativeUrl: '/webhook',
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
            expect(err.name).toBe('SchemaValidationError')
        })

        it('accepts https URL', () => {
            const providers = createTestProviderSet([
                createMockProvider('stripe', ['payment.succeeded']),
            ])
            const result = parseStatefile(
                {
                    version: 1,
                    baseUrl: 'https://example.com',
                    providerStates: {
                        stripe: {
                            'endpoint-1': {
                                state: {
                                    relativeUrl: '/webhook',
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

        it('returns State with providers', () => {
            const providers = createTestProviderSet([
                createMockProvider('stripe', ['payment.succeeded']),
            ])
            const result = parseStatefile(
                {
                    version: 1,
                    baseUrl: 'https://example.com',
                    providerStates: {
                        stripe: {
                            'endpoint-1': {
                                state: {
                                    relativeUrl: '/webhook',
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
                    baseUrl: 'https://example.com',
                    providerStates: {
                        stripe: {
                            'handle-1': {
                                state: {
                                    relativeUrl: '/webhook',
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
                    baseUrl: 'https://example.com',
                    providerStates: {
                        stripe: {
                            'endpoint-a': {
                                state: {
                                    relativeUrl: '/webhook-a',
                                    events: ['payment.succeeded'],
                                    config: { a: 1 },
                                },
                            },
                            'endpoint-b': {
                                state: {
                                    relativeUrl: '/webhook-b',
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
                createEndpointHandle('endpoint-a')._unsafeUnwrap(),
            )
            expect(endpointA?.relativeUrl).toBe('/webhook-a')
            expect(endpointA?.events).toEqual(['payment.succeeded'])
            expect(endpointA?.config).toEqual({ a: 1 })

            const endpointB = stripeEndpoints.get(
                createEndpointHandle('endpoint-b')._unsafeUnwrap(),
            )
            expect(endpointB?.relativeUrl).toBe('/webhook-b')
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
                    baseUrl: 'https://example.com',
                    providerStates: {
                        stripe: {
                            'stripe-1': {
                                state: {
                                    relativeUrl: '/stripe',
                                    events: ['payment.succeeded'],
                                    config: {},
                                },
                            },
                        },
                        github: {
                            'github-1': {
                                state: {
                                    relativeUrl: '/github',
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

        it('returns ProviderNotUsedError when provider not in statefile', () => {
            const providers = createTestProviderSet([
                createMockProvider('stripe', ['payment.succeeded']),
            ])
            const result = parseStatefile(
                {
                    version: 1,
                    baseUrl: 'https://example.com',
                    providerStates: {},
                },
                providers,
            )
            expect(result.isOk()).toBe(true)
            const toStateResult = result._unsafeUnwrap().toState()
            expect(toStateResult.isErr()).toBe(true)
            expect(toStateResult._unsafeUnwrapErr().name).toBe(
                'ProviderNotUsedError',
            )
            expect(
                (toStateResult._unsafeUnwrapErr() as ProviderNotUsedError)
                    .provider,
            ).toBe('stripe')
        })

        it('returns ProviderNotUsedError when multiple providers unused', () => {
            const providers = createTestProviderSet([
                createMockProvider('stripe', ['payment.succeeded']),
                createMockProvider('github', ['push']),
                createMockProvider('slack', ['message']),
            ])
            const result = parseStatefile(
                {
                    version: 1,
                    baseUrl: 'https://example.com',
                    providerStates: {},
                },
                providers,
            )
            expect(result.isOk()).toBe(true)
            const toStateResult = result._unsafeUnwrap().toState()
            expect(toStateResult.isErr()).toBe(true)
            expect(toStateResult._unsafeUnwrapErr().name).toBe(
                'ProviderNotUsedError',
            )
        })

        it('returns ProviderNotFoundError when provider in statefile not in ProviderSet', () => {
            const providers = createTestProviderSet([
                createMockProvider('stripe', ['payment.succeeded']),
            ])
            const result = parseStatefile(
                {
                    version: 1,
                    baseUrl: 'https://example.com',
                    providerStates: {
                        stripe: {
                            'endpoint-1': {
                                state: {
                                    relativeUrl: '/webhook',
                                    events: ['payment.succeeded'],
                                    config: {},
                                },
                            },
                        },
                        github: {
                            'endpoint-2': {
                                state: {
                                    relativeUrl: '/github',
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

    describe('error priority', () => {
        it('schema validation errors come first', () => {
            const providers = createTestProviderSet([
                createMockProvider('stripe', ['payment.succeeded']),
            ])
            const result = parseStatefile(
                {
                    baseUrl: 123,
                    providerStates: {},
                },
                providers,
            )
            expect(result.isErr()).toBe(true)
            expect(result._unsafeUnwrapErr().name).toBe('SchemaValidationError')
        })

        it('provider not found comes before invalid event', () => {
            const providers = createTestProviderSet([
                createMockProvider('stripe', ['payment.succeeded']),
            ])
            const result = parseStatefile(
                {
                    version: 1,
                    baseUrl: 'https://example.com',
                    providerStates: {
                        nonexistent: {
                            'endpoint-1': {
                                state: {
                                    relativeUrl: '/webhook',
                                    events: ['nonexistent.event'],
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

    describe('fromState', () => {
        it('converts State to Statefile with correct structure', () => {
            const providers = createTestProviderSet([
                createMockProvider('stripe', ['payment.succeeded']),
            ])

            const state = {
                baseUrl: createBaseUrl('https://example.com')._unsafeUnwrap(),
                providers,
                providerStates: {
                    stripe: new Map([
                        [
                            createEndpointHandle('endpoint-1')._unsafeUnwrap(),
                            {
                                relativeUrl:
                                    createRelativeUrl(
                                        '/webhook',
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
            expect(result.data.baseUrl).toBe('https://example.com')
            expect(result.data.providerStates.stripe).toBeDefined()
            expect(
                result.data.providerStates.stripe!['endpoint-1']!.state
                    .relativeUrl,
            ).toBe('/webhook')
        })

        it('includes signingSecrets when provided', () => {
            const providers = createTestProviderSet([
                createMockProvider('stripe', ['payment.succeeded']),
            ])

            const state = {
                baseUrl: createBaseUrl('https://example.com')._unsafeUnwrap(),
                providers,
                providerStates: {
                    stripe: new Map([
                        [
                            createEndpointHandle('endpoint-1')._unsafeUnwrap(),
                            {
                                relativeUrl:
                                    createRelativeUrl(
                                        '/webhook',
                                    )._unsafeUnwrap(),
                                events: ['payment.succeeded'],
                                config: {},
                            },
                        ],
                    ]),
                },
            }

            const signingSecrets = new Map([
                [
                    'stripe',
                    new Map([
                        [
                            createEndpointHandle('endpoint-1')._unsafeUnwrap(),
                            'whsec_abc123',
                        ],
                    ]),
                ],
            ])

            const result = fromState(1, state, signingSecrets)

            expect(
                result.data.providerStates.stripe!['endpoint-1']!.signingSecret,
            ).toBe('whsec_abc123')
        })

        it('handles missing signingSecrets (undefined)', () => {
            const providers = createTestProviderSet([
                createMockProvider('stripe', ['payment.succeeded']),
            ])

            const state = {
                baseUrl: createBaseUrl('https://example.com')._unsafeUnwrap(),
                providers,
                providerStates: {
                    stripe: new Map([
                        [
                            createEndpointHandle('endpoint-1')._unsafeUnwrap(),
                            {
                                relativeUrl:
                                    createRelativeUrl(
                                        '/webhook',
                                    )._unsafeUnwrap(),
                                events: ['payment.succeeded'],
                                config: {},
                            },
                        ],
                    ]),
                },
            }

            const result = fromState(1, state)

            expect(
                result.data.providerStates.stripe!['endpoint-1']!.signingSecret,
            ).toBeUndefined()
        })

        it('handles partial signingSecrets map', () => {
            const providers = createTestProviderSet([
                createMockProvider('stripe', ['payment.succeeded']),
                createMockProvider('github', ['push']),
            ])

            const state = {
                baseUrl: createBaseUrl('https://example.com')._unsafeUnwrap(),
                providers,
                providerStates: {
                    stripe: new Map([
                        [
                            createEndpointHandle('endpoint-1')._unsafeUnwrap(),
                            {
                                relativeUrl:
                                    createRelativeUrl(
                                        '/webhook',
                                    )._unsafeUnwrap(),
                                events: ['payment.succeeded'],
                                config: {},
                            },
                        ],
                    ]),
                    github: new Map([
                        [
                            createEndpointHandle('endpoint-2')._unsafeUnwrap(),
                            {
                                relativeUrl:
                                    createRelativeUrl(
                                        '/github',
                                    )._unsafeUnwrap(),
                                events: ['push'],
                                config: {},
                            },
                        ],
                    ]),
                },
            }

            const signingSecrets = new Map([
                [
                    'stripe',
                    new Map([
                        [
                            createEndpointHandle('endpoint-1')._unsafeUnwrap(),
                            'whsec_abc123',
                        ],
                    ]),
                ],
            ])

            const result = fromState(1, state, signingSecrets)

            expect(
                result.data.providerStates.stripe!['endpoint-1']!.signingSecret,
            ).toBe('whsec_abc123')
            expect(
                result.data.providerStates.github!['endpoint-2']!.signingSecret,
            ).toBeUndefined()
        })

        it('roundtrips through parseStatefile and toState', () => {
            const providers = createTestProviderSet([
                createMockProvider('stripe', ['payment.succeeded']),
            ])

            const originalStatefile = {
                version: 1,
                baseUrl: 'https://example.com',
                providerStates: {
                    stripe: {
                        'endpoint-1': {
                            state: {
                                relativeUrl: '/webhook',
                                events: ['payment.succeeded'],
                                config: { foo: 'bar' },
                            },
                            signingSecret: 'whsec_secret',
                        },
                    },
                },
            }

            const parseResult = parseStatefile(originalStatefile, providers)
            expect(parseResult.isOk()).toBe(true)

            const state = parseResult._unsafeUnwrap().toState()._unsafeUnwrap()
            const statefile = fromState(1, state)

            expect(statefile.data.version).toBe(1)
            expect(statefile.data.baseUrl).toBe('https://example.com')
            expect(
                statefile.data.providerStates.stripe!['endpoint-1']!.state
                    .relativeUrl,
            ).toBe('/webhook')
            expect(
                statefile.data.providerStates.stripe!['endpoint-1']!.state
                    .events,
            ).toEqual(['payment.succeeded'])
        })

        it('handles multiple providers', () => {
            const providers = createTestProviderSet([
                createMockProvider('stripe', ['payment.succeeded']),
                createMockProvider('github', ['push']),
            ])

            const state = {
                baseUrl: createBaseUrl('https://example.com')._unsafeUnwrap(),
                providers,
                providerStates: {
                    stripe: new Map([
                        [
                            createEndpointHandle('endpoint-1')._unsafeUnwrap(),
                            {
                                relativeUrl:
                                    createRelativeUrl(
                                        '/stripe',
                                    )._unsafeUnwrap(),
                                events: ['payment.succeeded'],
                                config: {},
                            },
                        ],
                    ]),
                    github: new Map([
                        [
                            createEndpointHandle('endpoint-2')._unsafeUnwrap(),
                            {
                                relativeUrl:
                                    createRelativeUrl(
                                        '/github',
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
                result.data.providerStates.stripe!['endpoint-1']!.state
                    .relativeUrl,
            ).toBe('/stripe')
            expect(
                result.data.providerStates.github!['endpoint-2']!.state
                    .relativeUrl,
            ).toBe('/github')
        })

        it('handles multiple endpoints per provider', () => {
            const providers = createTestProviderSet([
                createMockProvider('stripe', [
                    'payment.succeeded',
                    'payment.failed',
                ]),
            ])

            const state = {
                baseUrl: createBaseUrl('https://example.com')._unsafeUnwrap(),
                providers,
                providerStates: {
                    stripe: new Map([
                        [
                            createEndpointHandle('endpoint-a')._unsafeUnwrap(),
                            {
                                relativeUrl:
                                    createRelativeUrl(
                                        '/webhook-a',
                                    )._unsafeUnwrap(),
                                events: ['payment.succeeded'],
                                config: { a: 1 },
                            },
                        ],
                        [
                            createEndpointHandle('endpoint-b')._unsafeUnwrap(),
                            {
                                relativeUrl:
                                    createRelativeUrl(
                                        '/webhook-b',
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
            expect(stripeEndpoints['endpoint-a']!.state.relativeUrl).toBe(
                '/webhook-a',
            )
            expect(stripeEndpoints['endpoint-b']!.state.relativeUrl).toBe(
                '/webhook-b',
            )
        })

        it('handles empty providerStates', () => {
            const providers = createTestProviderSet([
                createMockProvider('stripe', ['payment.succeeded']),
            ])

            const state = {
                baseUrl: createBaseUrl('https://example.com')._unsafeUnwrap(),
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
                baseUrl: createBaseUrl('https://example.com')._unsafeUnwrap(),
                providers,
                providerStates: {
                    stripe: new Map([
                        [
                            createEndpointHandle('endpoint-1')._unsafeUnwrap(),
                            {
                                relativeUrl:
                                    createRelativeUrl(
                                        '/webhook',
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

            expect(recoveredState.baseUrl).toBe('https://example.com')
            expect(recoveredState.providers).toBe(providers)
            expect(recoveredState.providerStates['stripe']).toBeInstanceOf(Map)
            expect(recoveredState.providerStates['stripe']!.size).toBe(1)
        })
    })
})
