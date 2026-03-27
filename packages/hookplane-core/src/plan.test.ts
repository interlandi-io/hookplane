import { okAsync } from 'neverthrow'
import { State } from './state'
import { IndexedState } from './pull'
import {
    Provider,
    createEndpointHandle,
    createBaseUrl,
    createRelativeUrl,
} from './provider'
import { createPlan, createStepId } from './plan'

const TestProvider = (config: {
    storeUrl: string
    storeKey: string
}): Provider<
    'testEvent',
    { storeUrl: string; storeKey: string },
    object,
    object
> => ({
    name: 'Test',
    config,
    events: {
        testEvent: {},
    },
    state: {},
    setup: function () {
        return okAsync({})
    },
    createEndpoint: function () {
        throw new Error('Function not implemented.')
    },
    readEndpoint: function () {
        throw new Error('Function not implemented.')
    },
    updateEndpoint: function () {
        throw new Error('Function not implemented.')
    },
    deleteEndpoint: function () {
        throw new Error('Function not implemented.')
    },
    indexEndpoints: function () {
        throw new Error('Function not implemented.')
    },
})

// eslint-disable-next-line
const providers = { testProvider: TestProvider({ storeUrl: '', storeKey: '' }) }

const left1: IndexedState<typeof providers> = {
    baseUrl: createBaseUrl(''),
    providers: {
        testProvider: TestProvider({
            storeUrl: 'storeurl',
            storeKey: 'storekey',
        }),
    },
    providerStates: {
        testProvider: new Map([
            [
                createEndpointHandle('handle-0'),
                {
                    relativeUrl: createRelativeUrl('/'),
                    events: ['testEvent'],
                    config: {},
                },
            ],
        ]),
    },
}

describe('plan', () => {
    it('creates empty plan for identical states', () => {
        const right: State<typeof providers> = {
            baseUrl: createBaseUrl(''),
            providers: {
                testProvider: TestProvider({
                    storeUrl: 'storeurl',
                    storeKey: 'storekey',
                }),
            },
            providerStates: {
                testProvider: [
                    {
                        relativeUrl: createRelativeUrl('/'),
                        events: ['testEvent'],
                        config: {},
                    },
                ],
            },
        }

        const plan = createPlan(left1, right)
        expect(plan.providers.testProvider).toBe(left1.providers.testProvider)
        expect(plan.providerPlans.testProvider!).toHaveLength(0)
        expect(plan.getStepIds().length).toBe(0)
    })

    it('generates delete when removing endpoint', () => {
        const right: State<typeof providers> = {
            baseUrl: createBaseUrl('https://example.com'),
            providers: {
                testProvider: TestProvider({
                    storeUrl: 'storeurl',
                    storeKey: 'storekey',
                }),
            },
            providerStates: {
                testProvider: [],
            },
        }

        const plan = createPlan(left1, right)
        expect(plan.providerPlans.testProvider!).toHaveLength(1)
        expect(plan.providerPlans.testProvider!.get(createStepId(0))).toEqual({
            kind: 'delete',
            handle: 'handle-0',
        })
    })

    it('generates create when adding endpoint', () => {
        const left: IndexedState<typeof providers> = {
            baseUrl: createBaseUrl(''),
            providers: {
                testProvider: TestProvider({
                    storeUrl: 'storeurl',
                    storeKey: 'storekey',
                }),
            },
            providerStates: {
                testProvider: new Map(),
            },
        }
        const right: State<typeof providers> = {
            baseUrl: createBaseUrl(''),
            providers: {
                testProvider: TestProvider({
                    storeUrl: 'storeurl',
                    storeKey: 'storekey',
                }),
            },
            providerStates: {
                testProvider: [
                    {
                        relativeUrl: createRelativeUrl('/'),
                        events: ['testEvent'],
                        config: {},
                    },
                ],
            },
        }

        const plan = createPlan(left, right)
        expect(plan.providerPlans.testProvider!).toHaveLength(1)
        expect(plan.providerPlans.testProvider!.get(createStepId(0))).toEqual({
            kind: 'create',
            state: {
                relativeUrl: createRelativeUrl('/'),
                events: ['testEvent'],
                config: {},
            },
        })
    })

    it('generates update when changing endpoint url', () => {
        const left: IndexedState<typeof providers> = {
            baseUrl: createBaseUrl('https://example.com'),
            providers: {
                testProvider: TestProvider({
                    storeUrl: 'storeurl',
                    storeKey: 'storekey',
                }),
            },
            providerStates: {
                testProvider: new Map([
                    [
                        createEndpointHandle('handle-0'),
                        {
                            relativeUrl: createRelativeUrl('/old'),
                            events: ['testEvent'],
                            config: {},
                        },
                    ],
                ]),
            },
        }
        const right: State<typeof providers> = {
            baseUrl: createBaseUrl('https://example.com'),
            providers: {
                testProvider: TestProvider({
                    storeUrl: 'storeurl',
                    storeKey: 'storekey',
                }),
            },
            providerStates: {
                testProvider: [
                    {
                        relativeUrl: createRelativeUrl('/new'),
                        events: ['testEvent'],
                        config: {},
                    },
                ],
            },
        }

        const plan = createPlan(left, right)
        expect(plan.providerPlans.testProvider!).toHaveLength(2)
        expect(plan.providerPlans.testProvider!.get(createStepId(0))).toEqual({
            kind: 'delete',
            handle: 'handle-0',
        })
        expect(plan.providerPlans.testProvider!.get(createStepId(1))).toEqual({
            kind: 'create',
            state: {
                relativeUrl: createRelativeUrl('/new'),
                events: ['testEvent'],
                config: {},
            },
        })
    })

    it('handles multiple providers and events', () => {
        type Config = object
        const ProviderA = (config: Config) => ({
            name: 'ProviderA',
            config,
            events: {
                eventA: {},
                eventB: {},
            },
            state: {},
            setup: function () {
                return okAsync({})
            },
            createEndpoint: function () {
                throw new Error('Function not implemented.')
            },
            readEndpoint: function () {
                throw new Error('Function not implemented.')
            },
            updateEndpoint: function () {
                throw new Error('Function not implemented.')
            },
            deleteEndpoint: function () {
                throw new Error('Function not implemented.')
            },
            indexEndpoints: function () {
                throw new Error('Function not implemented.')
            },
        })

        const ProviderB = (config: Config) => ({
            name: 'ProviderB',
            config,
            events: {
                eventC: {},
            },
            state: {},
            setup: function () {
                return okAsync({})
            },
            createEndpoint: function () {
                throw new Error('Function not implemented.')
            },
            readEndpoint: function () {
                throw new Error('Function not implemented.')
            },
            updateEndpoint: function () {
                throw new Error('Function not implemented.')
            },
            deleteEndpoint: function () {
                throw new Error('Function not implemented.')
            },
            indexEndpoints: function () {
                throw new Error('Function not implemented.')
            },
        })

        const ProviderC = (config: Config) => ({
            name: 'ProviderC',
            config,
            events: {
                eventD: {},
            },
            state: {},
            setup: function () {
                return okAsync({})
            },
            createEndpoint: function () {
                throw new Error('Function not implemented.')
            },
            readEndpoint: function () {
                throw new Error('Function not implemented.')
            },
            updateEndpoint: function () {
                throw new Error('Function not implemented.')
            },
            deleteEndpoint: function () {
                throw new Error('Function not implemented.')
            },
            indexEndpoints: function () {
                throw new Error('Function not implemented.')
            },
        })

        // eslint-disable-next-line
        const multipleProviders = {
            providerA: ProviderA({ storeUrl: 'a', storeKey: 'a' }),
            providerB: ProviderB({ storeUrl: 'b', storeKey: 'b' }),
        }
        // eslint-disable-next-line
        const multipleProvidersWithC = {
            providerA: ProviderA({ storeUrl: 'a', storeKey: 'a' }),
            providerB: ProviderB({ storeUrl: 'b', storeKey: 'b' }),
            providerC: ProviderC({ storeUrl: 'c', storeKey: 'c' }),
        }

        const left: IndexedState<typeof multipleProviders> = {
            baseUrl: createBaseUrl('https://example.com'),
            providers: {
                providerA: ProviderA({ storeUrl: 'a', storeKey: 'a' }),
                providerB: ProviderB({ storeUrl: 'b', storeKey: 'b' }),
            },
            providerStates: {
                providerA: new Map([
                    [
                        createEndpointHandle('handle-0'),
                        {
                            relativeUrl: createRelativeUrl('/eventA'),
                            events: ['eventA'],
                            config: { value: 'leftA' },
                        },
                    ],
                    [
                        createEndpointHandle('handle-1'),
                        {
                            relativeUrl: createRelativeUrl('/eventB'),
                            events: ['eventB'],
                            config: { value: 'leftB' },
                        },
                    ],
                ]),
                providerB: new Map([
                    [
                        createEndpointHandle('handle-2'),
                        {
                            relativeUrl: createRelativeUrl('/eventC'),
                            events: ['eventC'],
                            config: {},
                        },
                    ],
                ]),
            },
        }

        const right: State<typeof multipleProvidersWithC> = {
            baseUrl: createBaseUrl('https://example.com'),
            providers: {
                providerA: ProviderA({ storeUrl: 'a', storeKey: 'a' }),
                providerB: ProviderB({ storeUrl: 'b', storeKey: 'b' }),
                providerC: ProviderC({ storeUrl: 'c', storeKey: 'c' }),
            },
            providerStates: {
                providerA: [
                    {
                        relativeUrl: createRelativeUrl('/eventA'),
                        events: ['eventA'],
                        config: { value: 'rightA' },
                    },
                ],
                providerB: [],
                providerC: [
                    {
                        relativeUrl: createRelativeUrl('/eventD'),
                        events: ['eventD'],
                        config: { value: 'rightD' },
                    },
                ],
            },
        }

        const plan = createPlan(left, right)

        expect(plan.providerPlans.providerA!).toHaveLength(2)
        expect(plan.providerPlans.providerB!).toHaveLength(1)
        expect(plan.providerPlans.providerC!).toHaveLength(1)
        expect(plan.getStepIds().length).toBe(4)

        const stepA0 = plan.providerPlans.providerA!.get(createStepId(0))
        const stepA1 = plan.providerPlans.providerA!.get(createStepId(1))
        const stepB0 = plan.providerPlans.providerB!.get(createStepId(2))
        const stepC0 = plan.providerPlans.providerC!.get(createStepId(3))

        expect(stepA0).toEqual({
            kind: 'update',
            handle: 'handle-0',
            state: {
                relativeUrl: createRelativeUrl('/eventA'),
                events: ['eventA'],
                config: { value: 'rightA' },
            },
        })

        expect(stepA1).toEqual({
            kind: 'delete',
            handle: 'handle-1',
        })

        expect(stepB0).toEqual({
            kind: 'delete',
            handle: 'handle-2',
        })

        expect(stepC0).toEqual({
            kind: 'create',
            state: {
                relativeUrl: createRelativeUrl('/eventD'),
                events: ['eventD'],
                config: { value: 'rightD' },
            },
        })
    })

    // TODO: this definitely should be tested more thoroughly
    it('gets step by id', () => {
        const left: IndexedState<typeof providers> = {
            baseUrl: createBaseUrl('https://example.com'),
            providers: {
                testProvider: TestProvider({
                    storeUrl: 'storeurl',
                    storeKey: 'storekey',
                }),
            },
            providerStates: {
                testProvider: new Map([
                    [
                        createEndpointHandle('handle-0'),
                        {
                            relativeUrl: createRelativeUrl('/old'),
                            events: ['testEvent'],
                            config: {},
                        },
                    ],
                ]),
            },
        }
        const right: State<typeof providers> = {
            baseUrl: createBaseUrl('https://example.com'),
            providers: {
                testProvider: TestProvider({
                    storeUrl: 'storeurl',
                    storeKey: 'storekey',
                }),
            },
            providerStates: {
                testProvider: [
                    {
                        relativeUrl: createRelativeUrl('/new'),
                        events: ['testEvent'],
                        config: {},
                    },
                ],
            },
        }

        const plan = createPlan(left, right)
        expect(plan.providerPlans.testProvider!).toHaveLength(2)

        const deleteStep = plan.getStepById(createStepId(0))
        expect(deleteStep.isOk()).toBe(true)
        expect(deleteStep._unsafeUnwrap()).toEqual({
            kind: 'delete',
            handle: 'handle-0',
        })

        const createStep = plan.getStepById(createStepId(1))
        expect(createStep.isOk()).toBe(true)
        expect(createStep._unsafeUnwrap()).toEqual({
            kind: 'create',
            state: {
                relativeUrl: createRelativeUrl('/new'),
                events: ['testEvent'],
                config: {},
            },
        })
    })
})
