import { describe, it, expect } from 'vitest'
import {
    InvalidEventError,
    parseStatefile,
    ProviderNotFoundError,
} from './statefile'
import { createRelativeUrl } from './url'
import { EndpointState, type Provider } from './provider'
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
        it('returns error for missing endpoints field', () => {
            const providers = createTestProviderSet([
                createMockProvider('stripe', ['payment.succeeded']),
            ])
            const result = parseStatefile({}, providers)
            expect(result.isErr()).toBe(true)
            expect(result._unsafeUnwrapErr().name).toBe('SchemaValidationError')
        })

        it('returns error for wrong type for relativeUrl', () => {
            const providers = createTestProviderSet([
                createMockProvider('stripe', ['payment.succeeded']),
            ])
            const result = parseStatefile(
                {
                    endpoints: {
                        stripe: {
                            relativeUrl: 123,
                            events: ['payment.succeeded'],
                            config: {},
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
                    endpoints: {
                        stripe: {
                            relativeUrl: '/webhook',
                            events: 'not-an-array',
                            config: {},
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
                    endpoints: {
                        stripe: {
                            relativeUrl: '/webhook',
                            events: ['payment.succeeded'],
                            config: 'not-an-object',
                        },
                    },
                },
                providers,
            )
            expect(result.isErr()).toBe(true)
            expect(result._unsafeUnwrapErr().name).toBe('SchemaValidationError')
        })

        it('returns error when endpoints is not an object', () => {
            const providers = createTestProviderSet([
                createMockProvider('stripe', ['payment.succeeded']),
            ])
            const result = parseStatefile(
                {
                    endpoints: 'not-an-object',
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
                    endpoints: {
                        unknown: {
                            relativeUrl: '/webhook',
                            events: ['payment.succeeded'],
                            config: {},
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
                    endpoints: {
                        stripe: {
                            relativeUrl: '/webhook',
                            events: ['payment.succeeded'],
                            config: {},
                        },
                        nonexistent: {
                            relativeUrl: '/webhook',
                            events: ['push'],
                            config: {},
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

    describe('InvalidRelativeUrlError', () => {
        it('returns error when relativeUrl does not start with /', () => {
            const providers = createTestProviderSet([
                createMockProvider('stripe', ['payment.succeeded']),
            ])
            const result = parseStatefile(
                {
                    endpoints: {
                        stripe: {
                            relativeUrl: 'no-slash',
                            events: ['payment.succeeded'],
                            config: {},
                        },
                    },
                },
                providers,
            )
            expect(result.isErr()).toBe(true)
            const err = result._unsafeUnwrapErr()
            expect(err.name).toBe('InvalidRelativeUrlError')
        })

        it('returns error for empty string relativeUrl', () => {
            const providers = createTestProviderSet([
                createMockProvider('stripe', ['payment.succeeded']),
            ])
            const result = parseStatefile(
                {
                    endpoints: {
                        stripe: {
                            relativeUrl: '',
                            events: ['payment.succeeded'],
                            config: {},
                        },
                    },
                },
                providers,
            )
            expect(result.isErr()).toBe(true)
            const err = result._unsafeUnwrapErr()
            expect(err.name).toBe('InvalidRelativeUrlError')
        })

        it('returns error for relativeUrl with whitespace', () => {
            const providers = createTestProviderSet([
                createMockProvider('stripe', ['payment.succeeded']),
            ])
            const result = parseStatefile(
                {
                    endpoints: {
                        stripe: {
                            relativeUrl: ' webhook',
                            events: ['payment.succeeded'],
                            config: {},
                        },
                    },
                },
                providers,
            )
            expect(result.isErr()).toBe(true)
            const err = result._unsafeUnwrapErr()
            expect(err.name).toBe('InvalidRelativeUrlError')
        })
    })

    describe('InvalidEventError', () => {
        it('returns error when event does not exist in provider', () => {
            const providers = createTestProviderSet([
                createMockProvider('stripe', ['payment.succeeded']),
            ])
            const result = parseStatefile(
                {
                    endpoints: {
                        stripe: {
                            relativeUrl: '/webhook',
                            events: ['nonexistent.event'],
                            config: {},
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
                    endpoints: {
                        stripe: {
                            relativeUrl: '/webhook',
                            events: ['payment.succeeded', 'invalid.event'],
                            config: {},
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
                    endpoints: {
                        empty: {
                            relativeUrl: '/webhook',
                            events: ['some.event'],
                            config: {},
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
            const contents = {
                endpoints: {
                    stripe: {
                        relativeUrl: '/webhook',
                        events: ['payment.succeeded'],
                        config: { foo: 'bar' },
                    },
                    github: {
                        relativeUrl: '/github',
                        events: ['push', 'pull_request'],
                        config: {},
                    },
                },
            }
            const result = parseStatefile(contents, providers)
            expect(result.isOk()).toBe(true)
            const statefile = result._unsafeUnwrap()
            expect(Object.keys(statefile.endpoints)).toEqual([
                'stripe',
                'github',
            ])
            expect(statefile.endpoints['stripe']!.relativeUrl).toBe('/webhook')
            expect(statefile.endpoints['stripe']!.events).toEqual([
                'payment.succeeded',
            ])
            expect(statefile.endpoints['github']!.events).toEqual([
                'push',
                'pull_request',
            ])
        })

        it('allows empty endpoints object', () => {
            const providers = createTestProviderSet([
                createMockProvider('stripe', ['payment.succeeded']),
            ])
            const result = parseStatefile({ endpoints: {} }, providers)
            expect(result.isOk()).toBe(true)
            expect(result._unsafeUnwrap().endpoints).toEqual({})
        })

        it('allows empty events array', () => {
            const providers = createTestProviderSet([
                createMockProvider('stripe', ['payment.succeeded']),
            ])
            const result = parseStatefile(
                {
                    endpoints: {
                        stripe: {
                            relativeUrl: '/webhook',
                            events: [],
                            config: {},
                        },
                    },
                },
                providers,
            )
            expect(result.isOk()).toBe(true)
            expect(result._unsafeUnwrap().endpoints['stripe']!.events).toEqual(
                [],
            )
        })

        it('handles multiple providers with valid statefile', () => {
            const providers = createTestProviderSet([
                createMockProvider('stripe', ['payment.succeeded']),
                createMockProvider('github', ['push']),
                createMockProvider('slack', ['message.posted']),
            ])
            const result = parseStatefile(
                {
                    endpoints: {
                        stripe: {
                            relativeUrl: '/stripe',
                            events: ['payment.succeeded'],
                            config: {},
                        },
                        github: {
                            relativeUrl: '/github',
                            events: ['push'],
                            config: {},
                        },
                        slack: {
                            relativeUrl: '/slack',
                            events: ['message.posted'],
                            config: {},
                        },
                    },
                },
                providers,
            )
            expect(result.isOk()).toBe(true)
            expect(Object.keys(result._unsafeUnwrap().endpoints)).toHaveLength(
                3,
            )
        })

        it('returns relativeUrl as RelativeUrl type', () => {
            const providers = createTestProviderSet([
                createMockProvider('stripe', ['payment.succeeded']),
            ])
            const result = parseStatefile(
                {
                    endpoints: {
                        stripe: {
                            relativeUrl: '/webhooks/stripe',
                            events: ['payment.succeeded'],
                            config: {},
                        },
                    },
                },
                providers,
            )
            expect(result.isOk()).toBe(true)
            const url = result._unsafeUnwrap().endpoints['stripe']!.relativeUrl
            expect(url).toBe('/webhooks/stripe')
        })
    })

    describe('error priority', () => {
        it('schema validation errors come first', () => {
            const providers = createTestProviderSet([
                createMockProvider('stripe', ['payment.succeeded']),
            ])
            const result = parseStatefile(
                {
                    endpoints: {
                        stripe: {
                            relativeUrl: 123,
                            events: ['payment.succeeded'],
                            config: {},
                        },
                    },
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
                    endpoints: {
                        nonexistent: {
                            relativeUrl: '/webhook',
                            events: ['nonexistent.event'],
                            config: {},
                        },
                    },
                },
                providers,
            )
            expect(result.isErr()).toBe(true)
            expect(result._unsafeUnwrapErr().name).toBe('ProviderNotFoundError')
        })

        it('invalid relative URL comes before invalid event', () => {
            const providers = createTestProviderSet([
                createMockProvider('stripe', ['payment.succeeded']),
            ])
            const result = parseStatefile(
                {
                    endpoints: {
                        stripe: {
                            relativeUrl: 'no-slash',
                            events: ['nonexistent.event'],
                            config: {},
                        },
                    },
                },
                providers,
            )
            expect(result.isErr()).toBe(true)
            expect(result._unsafeUnwrapErr().name).toBe(
                'InvalidRelativeUrlError',
            )
        })
    })
})
