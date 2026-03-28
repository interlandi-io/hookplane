import { okAsync } from 'neverthrow'
import { describe, it, expect } from 'vitest'
import { createProviderSet, type ProviderSet } from './provider-set'
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
    mapEndpoints: () => okAsync(new Map()),
})

const mockProvider = TestProvider('test-provider')
const anotherProvider = TestProvider('another-provider')

describe('ProviderSet', () => {
    describe('createProviderSet', () => {
        it('returns ok with a ProviderSet when given valid providers', () => {
            const result = createProviderSet([mockProvider, anotherProvider])

            expect(result.isOk()).toBe(true)
            const providerSet = result._unsafeUnwrap()
            expect(providerSet['test-provider']).toEqual(mockProvider)
            expect(providerSet['another-provider']).toEqual(anotherProvider)
        })

        it('returns an error when duplicate provider names exist', () => {
            const duplicateProvider = TestProvider('test-provider')
            const result = createProviderSet([mockProvider, duplicateProvider])

            expect(result.isErr()).toBe(true)
            const error = result._unsafeUnwrapErr()
            expect(error.name).toBe('AlreadyExistsError')
            expect(error.providerName).toBe('test-provider')
        })

        it('returns an error on first duplicate encountered', () => {
            const providers = [
                TestProvider('first'),
                TestProvider('second'),
                TestProvider('first'),
            ]
            const result = createProviderSet(providers)

            expect(result.isErr()).toBe(true)
            const error = result._unsafeUnwrapErr()
            expect(error.providerName).toBe('first')
        })

        it('returns an empty object for an empty array', () => {
            const result = createProviderSet([])

            expect(result.isOk()).toBe(true)
            const providerSet = result._unsafeUnwrap()
            expect(Object.keys(providerSet)).toEqual([])
        })

        it('is a valid Record with provider name as key', () => {
            const providerSet = createProviderSet([
                mockProvider,
                anotherProvider,
            ])._unsafeUnwrap()

            expect(providerSet['test-provider']).toEqual(mockProvider)
            expect(providerSet['another-provider']).toEqual(anotherProvider)
        })
    })

    describe('Record access', () => {
        let providerSet: ProviderSet

        beforeEach(() => {
            providerSet = createProviderSet([
                mockProvider,
                anotherProvider,
            ])._unsafeUnwrap()
        })

        it('returns the provider when it exists', () => {
            expect(providerSet['test-provider']).toEqual(mockProvider)
            expect(providerSet['another-provider']).toEqual(anotherProvider)
        })

        it('returns undefined when provider does not exist', () => {
            expect(providerSet['non-existent']).toBeUndefined()
        })
    })

    describe('immutability', () => {
        it('does not mutate the original array when creating ProviderSet', () => {
            const providers = [TestProvider('unique')]
            createProviderSet(providers)

            expect(providers).toHaveLength(1)
            expect(providers[0]!.name).toBe('unique')
        })
    })
})
