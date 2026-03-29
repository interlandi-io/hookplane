import { describe, it, expect } from 'vitest'
import {
    InvalidEventError,
    parseStatefile,
    ProviderNotFoundError,
} from './statefile'
import { createRelativeUrl } from './url'
import { EndpointHandle, EndpointState, type Provider } from './provider'
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
    })

    describe('ProviderNotFoundError', () => {
        it('returns error when provider in statefile not in provider set', () => {
            const providers = createTestProviderSet([
                createMockProvider('stripe', ['payment.succeeded']),
            ])
            const result = parseStatefile(
                {
                    baseUrl: 'https://example.com',
                    providerStates: {
                        unknown: {
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
                        nonexistent: {
                            'endpoint-1': {
                                state: {
                                    relativeUrl: '/webhook',
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
    })

    describe('InvalidEventError', () => {
        it('returns error when event does not exist in provider', () => {
            const providers = createTestProviderSet([
                createMockProvider('stripe', ['payment.succeeded']),
            ])
            const result = parseStatefile(
                {
                    baseUrl: 'https://example.com',
                    providerStates: {
                        stripe: {
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
            const err = result._unsafeUnwrapErr()
            expect(err.name).toBe('InvalidEventError')
            expect((err as InvalidEventError).provider).toBe('stripe')
            expect((err as InvalidEventError).event).toBe('nonexistent.event')
        })

        it('returns error for one invalid event when others are valid', () => {
            const providers = createTestProviderSet([
                createMockProvider('stripe', [
                    'payment.succeeded',
                    'payment.failed',
                ]),
            ])
            const result = parseStatefile(
                {
                    baseUrl: 'https://example.com',
                    providerStates: {
                        stripe: {
                            'endpoint-1': {
                                state: {
                                    relativeUrl: '/webhook',
                                    events: [
                                        'payment.succeeded',
                                        'invalid.event',
                                    ],
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
            expect(err.name).toBe('InvalidEventError')
            expect((err as InvalidEventError).event).toBe('invalid.event')
        })

        it('returns error for provider with no events when statefile lists events', () => {
            const providers = createTestProviderSet([
                createMockProvider('empty', []),
            ])
            const result = parseStatefile(
                {
                    baseUrl: 'https://example.com',
                    providerStates: {
                        empty: {
                            'endpoint-1': {
                                state: {
                                    relativeUrl: '/webhook',
                                    events: ['some.event'],
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
            expect(err.name).toBe('InvalidEventError')
        })
    })

    describe('valid statefile', () => {
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
                    baseUrl: 'https://example.com',
                    providerStates: {
                        stripe: {
                            'endpoint-1': {
                                state: {
                                    relativeUrl: '/webhook',
                                    events: ['payment.succeeded'],
                                    config: { foo: 'bar' },
                                },
                            },
                        },
                        github: {
                            'endpoint-2': {
                                state: {
                                    relativeUrl: '/github',
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
            expect(statefile.data.baseUrl).toBe('https://example.com')
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
                    baseUrl: 'https://example.com',
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
                    baseUrl: 'https://example.com',
                    providerStates: {
                        stripe: {
                            'endpoint-1': {
                                state: {
                                    relativeUrl: '/webhook',
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
                    'endpoint-1'
                ]!.state.events,
            ).toEqual([])
        })

        it('allows multiple endpoints per provider', () => {
            const providers = createTestProviderSet([
                createMockProvider('stripe', ['payment.succeeded']),
            ])
            const result = parseStatefile(
                {
                    baseUrl: 'https://example.com',
                    providerStates: {
                        stripe: {
                            'endpoint-1': {
                                state: {
                                    relativeUrl: '/webhook-one',
                                    events: ['payment.succeeded'],
                                    config: {},
                                },
                            },
                            'endpoint-2': {
                                state: {
                                    relativeUrl: '/webhook-two',
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

        it('returns baseUrl as BaseUrl type', () => {
            const providers = createTestProviderSet([
                createMockProvider('stripe', ['payment.succeeded']),
            ])
            const result = parseStatefile(
                {
                    baseUrl: 'https://example.com',
                    providerStates: {
                        stripe: {
                            'endpoint-1': {
                                state: {
                                    relativeUrl: '/webhooks/stripe',
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
            const url = result._unsafeUnwrap().data.baseUrl
            expect(url).toBe('https://example.com')
        })

        it('allows optional signingSecret', () => {
            const providers = createTestProviderSet([
                createMockProvider('stripe', ['payment.succeeded']),
            ])
            const result = parseStatefile(
                {
                    baseUrl: 'https://example.com',
                    providerStates: {
                        stripe: {
                            'endpoint-1': {
                                state: {
                                    relativeUrl: '/webhook',
                                    events: ['payment.succeeded'],
                                    config: {},
                                },
                                signingSecret: 'whsec_abc123',
                            },
                        },
                    },
                },
                providers,
            )
            expect(result.isOk()).toBe(true)
            expect(
                result._unsafeUnwrap().data.providerStates['stripe']![
                    'endpoint-1'
                ]!.signingSecret,
            ).toBe('whsec_abc123')
        })

        it('allows nullish signingSecret', () => {
            const providers = createTestProviderSet([
                createMockProvider('stripe', ['payment.succeeded']),
            ])
            const result = parseStatefile(
                {
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
    })

    describe('toState', () => {
        it('returns State with correct baseUrl', () => {
            const providers = createTestProviderSet([
                createMockProvider('stripe', ['payment.succeeded']),
            ])
            const result = parseStatefile(
                {
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
            const state = result._unsafeUnwrap().toState()
            expect(state.baseUrl).toBe('https://example.com')
        })

        it('returns State with providers', () => {
            const providers = createTestProviderSet([
                createMockProvider('stripe', ['payment.succeeded']),
            ])
            const result = parseStatefile(
                {
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
            const state = result._unsafeUnwrap().toState()
            expect(state.providers).toBe(providers)
        })

        it('returns State with providerStates as Map', () => {
            const providers = createTestProviderSet([
                createMockProvider('stripe', ['payment.succeeded']),
            ])
            const result = parseStatefile(
                {
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
            const state = result._unsafeUnwrap().toState()
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
            const state = result._unsafeUnwrap().toState()
            const stripeEndpoints = state.providerStates['stripe']!

            expect(stripeEndpoints.size).toBe(2)

            const endpointA = stripeEndpoints.get(
                'endpoint-a' as EndpointHandle,
            )
            expect(endpointA?.relativeUrl).toBe('/webhook-a')
            expect(endpointA?.events).toEqual(['payment.succeeded'])
            expect(endpointA?.config).toEqual({ a: 1 })

            const endpointB = stripeEndpoints.get(
                'endpoint-b' as EndpointHandle,
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
            const state = result._unsafeUnwrap().toState()

            expect(state.providerStates['stripe']).toBeInstanceOf(Map)
            expect(state.providerStates['github']).toBeInstanceOf(Map)
            expect(state.providerStates['stripe']!.size).toBe(1)
            expect(state.providerStates['github']!.size).toBe(1)
        })

        it('handles empty providerStates', () => {
            const providers = createTestProviderSet([
                createMockProvider('stripe', ['payment.succeeded']),
            ])
            const result = parseStatefile(
                {
                    baseUrl: 'https://example.com',
                    providerStates: {},
                },
                providers,
            )
            expect(result.isOk()).toBe(true)
            const state = result._unsafeUnwrap().toState()
            expect(Object.keys(state.providerStates)).toEqual([])
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
})
