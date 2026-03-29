import { okAsync } from 'neverthrow'
import { describe, it, expect } from 'vitest'
import { createProviderSet } from './provider-set'
import { createRelativeUrl, Provider } from './provider'

const TestProvider = (
    name: string,
): Provider<string, { apiKey?: string; token?: string }, object, object> => ({
    name,
    config: {},
    events: {},
    state: {},
    setup: () => okAsync({}),
    createEndpoint: () => okAsync(undefined),
    readEndpoint: () =>
        okAsync({
            relativeUrl: createRelativeUrl('/')._unsafeUnwrap(),
            events: [],
            config: {},
        }),
    updateEndpoint: () => okAsync(undefined),
    deleteEndpoint: () => okAsync(undefined),
    indexEndpoints: () => okAsync(new Map()),
})

const mock = TestProvider('mock')
const another = TestProvider('another')

describe('ProviderSet', () => {
    describe('createProviderSet', () => {
        it('returns ok with a ProviderSet when given valid providers', () => {
            const result = createProviderSet({
                mock,
                another,
            })

            expect(result.isOk()).toBe(true)
            const providerSet = result._unsafeUnwrap()
            expect(providerSet['mock']).toEqual(mock)
            expect(providerSet['another']).toEqual(another)
        })

        it('returns an error when a key does not match the name of the provider', () => {
            const result = createProviderSet({
                notMock: mock,
                another,
            })

            expect(result.isOk()).toBe(false)
            expect(result._unsafeUnwrapErr().name).toBe('KeyNameMismatchError')
        })
    })
})
