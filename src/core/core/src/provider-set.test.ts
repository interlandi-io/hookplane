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
            relativeUrl: createRelativeUrl('/'),
            events: [],
            config: {},
        }),
    updateEndpoint: () => okAsync(undefined),
    deleteEndpoint: () => okAsync(undefined),
    indexEndpoints: () => okAsync(new Map()),
})

const mockProvider = TestProvider('test-provider')
const anotherProvider = TestProvider('another-provider')

describe('ProviderSet', () => {
    describe('createProviderSet', () => {
        it('returns ok with a ProviderSet when given valid providers', () => {
            const result = createProviderSet([mockProvider, anotherProvider])

            expect(result.isOk()).toBe(true)
            const providerSet = result._unsafeUnwrap()
            expect(providerSet).toHaveProperty('all')
            expect(providerSet).toHaveProperty('get')
            expect(providerSet).toHaveProperty('has')
        })

        it('returns an error when duplicate provider names exist', () => {
            const duplicateProvider = TestProvider('test-provider')
            const result = createProviderSet([mockProvider, duplicateProvider])

            expect(result.isErr()).toBe(true)
            const error = result._unsafeUnwrapErr()
            expect(error.name).toBe('AlreadExistsError')
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

        it('returns an empty ProviderSet for an empty array', () => {
            const result = createProviderSet([])

            expect(result.isOk()).toBe(true)
            const providerSet = result._unsafeUnwrap()
            expect(providerSet.all()).toEqual([])
        })
    })

    describe('ProviderSet methods', () => {
        let providerSet: ProviderSet<
            [typeof mockProvider, typeof anotherProvider]
        >

        beforeEach(() => {
            providerSet = createProviderSet([
                mockProvider,
                anotherProvider,
            ])._unsafeUnwrap()
        })

        describe('all', () => {
            it('returns all providers as an array', () => {
                const all = providerSet.all()

                expect(all).toHaveLength(2)
                expect(all).toContainEqual(mockProvider)
                expect(all).toContainEqual(anotherProvider)
            })
        })

        describe('get', () => {
            it('returns the provider when it exists', () => {
                const provider = providerSet.get('test-provider')

                expect(provider).toEqual(mockProvider)
            })

            it('returns undefined when provider does not exist', () => {
                const provider = providerSet.get('non-existent')

                expect(provider).toBeUndefined()
            })
        })

        describe('has', () => {
            it('returns true when provider exists', () => {
                expect(providerSet.has('test-provider')).toBe(true)
                expect(providerSet.has('another-provider')).toBe(true)
            })

            it('returns false when provider does not exist', () => {
                expect(providerSet.has('non-existent')).toBe(false)
            })
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
