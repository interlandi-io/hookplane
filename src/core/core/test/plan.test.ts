import { okAsync } from 'neverthrow'
import { State } from '~/state.js'
import { Provider, createEndpointHandle } from '~/provider.js'
import { createEndpointUrl } from '~/url.js'
import { createPlan, createStepId } from '~/plan.js'
import { createOrphanEndpointHandle } from '~/endpoint-handle.js'

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
    processRequest: function () {
        return okAsync({
            event: 'testEvent' as const,
            data: {},
        })
    },
})

// eslint-disable-next-line
const providers = { testProvider: TestProvider({ storeUrl: '', storeKey: '' }) }

const left1: State<typeof providers> = {
    providers: {
        testProvider: TestProvider({
            storeUrl: 'storeurl',
            storeKey: 'storekey',
        }),
    },
    providerStates: {
        testProvider: new Map([
            [
                createEndpointHandle('handle-0')._unsafeUnwrap(),
                {
                    url: createEndpointUrl(
                        'https://localhost/',
                    )._unsafeUnwrap(),
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
            providers: {
                testProvider: TestProvider({
                    storeUrl: 'storeurl',
                    storeKey: 'storekey',
                }),
            },
            providerStates: {
                testProvider: new Map([
                    [
                        createEndpointHandle('handle-0')._unsafeUnwrap(),
                        {
                            url: createEndpointUrl(
                                'https://localhost/',
                            )._unsafeUnwrap(),
                            events: ['testEvent'],
                            config: {},
                        },
                    ],
                ]),
            },
        }

        const result = createPlan(left1, right)
        expect(result.isOk()).toBe(true)
        const plan = result._unsafeUnwrap()
        expect(plan.providers.testProvider).toBe(left1.providers.testProvider)
        expect(plan.providerPlans.testProvider!).toHaveLength(0)
        expect(plan.getStepIds().length).toBe(0)
        expect(plan.isEmpty()).toBe(true)
    })

    it('generates delete when removing endpoint', () => {
        const right: State<typeof providers> = {
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

        const result = createPlan(left1, right)
        expect(result.isOk()).toBe(true)
        const plan = result._unsafeUnwrap()
        expect(plan.providerPlans.testProvider!).toHaveLength(1)
        expect(plan.providerPlans.testProvider!.get(createStepId(0))).toEqual({
            kind: 'delete',
            handle: 'handle-0',
        })
    })

    it('generates create when adding endpoint', () => {
        const left: State<typeof providers> = {
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
            providers: {
                testProvider: TestProvider({
                    storeUrl: 'storeurl',
                    storeKey: 'storekey',
                }),
            },
            providerStates: {
                testProvider: new Map([
                    [
                        createOrphanEndpointHandle(),
                        {
                            url: createEndpointUrl(
                                'https://localhost/',
                            )._unsafeUnwrap(),
                            events: ['testEvent'],
                            config: {},
                        },
                    ],
                ]),
            },
        }

        const result = createPlan(left, right)
        expect(result.isOk()).toBe(true)
        const plan = result._unsafeUnwrap()
        expect(plan.providerPlans.testProvider!).toHaveLength(1)
        expect(plan.providerPlans.testProvider!.get(createStepId(0))).toEqual({
            kind: 'create',
            state: {
                url: createEndpointUrl('https://localhost/')._unsafeUnwrap(),
                events: ['testEvent'],
                config: {},
            },
        })
    })

    it('generates update when changing endpoint url', () => {
        const left: State<typeof providers> = {
            providers: {
                testProvider: TestProvider({
                    storeUrl: 'storeurl',
                    storeKey: 'storekey',
                }),
            },
            providerStates: {
                testProvider: new Map([
                    [
                        createEndpointHandle('handle-0')._unsafeUnwrap(),
                        {
                            url: createEndpointUrl(
                                'https://example.com/old',
                            )._unsafeUnwrap(),
                            events: ['testEvent'],
                            config: {},
                        },
                    ],
                ]),
            },
        }
        const right: State<typeof providers> = {
            providers: {
                testProvider: TestProvider({
                    storeUrl: 'storeurl',
                    storeKey: 'storekey',
                }),
            },
            providerStates: {
                testProvider: new Map([
                    [
                        createEndpointHandle('handle-0')._unsafeUnwrap(),
                        {
                            url: createEndpointUrl(
                                'https://example.com/new',
                            )._unsafeUnwrap(),
                            events: ['testEvent'],
                            config: {},
                        },
                    ],
                ]),
            },
        }

        const result = createPlan(left, right)
        expect(result.isOk()).toBe(true)
        const plan = result._unsafeUnwrap()
        expect(plan.providerPlans.testProvider!).toHaveLength(1)
        expect(plan.providerPlans.testProvider!.get(createStepId(0))).toEqual({
            kind: 'update',
            handle: 'handle-0',
            state: {
                url: createEndpointUrl(
                    'https://example.com/new',
                )._unsafeUnwrap(),
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
            processRequest: function () {
                return okAsync({
                    event: 'eventA' as const,
                    data: {},
                })
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
            processRequest: function () {
                return okAsync({
                    event: 'eventC' as const,
                    data: {},
                })
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
            processRequest: function () {
                return okAsync({
                    event: 'eventD' as const,
                    data: {},
                })
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

        const left: State<typeof multipleProviders> = {
            providers: {
                providerA: ProviderA({ storeUrl: 'a', storeKey: 'a' }),
                providerB: ProviderB({ storeUrl: 'b', storeKey: 'b' }),
            },
            providerStates: {
                providerA: new Map([
                    [
                        createEndpointHandle('handle-0')._unsafeUnwrap(),
                        {
                            url: createEndpointUrl(
                                'https://example.com/eventA',
                            )._unsafeUnwrap(),
                            events: ['eventA'],
                            config: { value: 'leftA' },
                        },
                    ],
                ]),
                providerB: new Map([
                    [
                        createEndpointHandle('handle-2')._unsafeUnwrap(),
                        {
                            url: createEndpointUrl(
                                'https://example.com/eventC',
                            )._unsafeUnwrap(),
                            events: ['eventC'],
                            config: {},
                        },
                    ],
                ]),
            },
        }

        const right: State<typeof multipleProvidersWithC> = {
            providers: {
                providerA: ProviderA({ storeUrl: 'a', storeKey: 'a' }),
                providerB: ProviderB({ storeUrl: 'b', storeKey: 'b' }),
                providerC: ProviderC({ storeUrl: 'c', storeKey: 'c' }),
            },
            providerStates: {
                providerA: new Map([
                    [
                        createEndpointHandle('handle-0')._unsafeUnwrap(),
                        {
                            url: createEndpointUrl(
                                'https://example.com/eventA',
                            )._unsafeUnwrap(),
                            events: ['eventA'],
                            config: { value: 'rightA' },
                        },
                    ],
                ]),
                providerB: new Map(),
                providerC: new Map([
                    [
                        createOrphanEndpointHandle(),
                        {
                            url: createEndpointUrl(
                                'https://example.com/eventD',
                            )._unsafeUnwrap(),
                            events: ['eventD'],
                            config: { value: 'rightD' },
                        },
                    ],
                ]),
            },
        }

        const result = createPlan(left, right)

        expect(result.isOk()).toBe(true)
        const plan = result._unsafeUnwrap()

        expect(plan.providerPlans.providerA!).toHaveLength(1)
        expect(plan.providerPlans.providerB!).toHaveLength(1)
        expect(plan.providerPlans.providerC!).toHaveLength(1)
        expect(plan.getStepIds().length).toBe(3)

        const stepA0 = plan.providerPlans.providerA!.get(createStepId(0))
        const stepB0 = plan.providerPlans.providerB!.get(createStepId(1))
        const stepC0 = plan.providerPlans.providerC!.get(createStepId(2))

        expect(stepA0).toEqual({
            kind: 'update',
            handle: 'handle-0',
            state: {
                url: createEndpointUrl(
                    'https://example.com/eventA',
                )._unsafeUnwrap(),
                events: ['eventA'],
                config: { value: 'rightA' },
            },
        })

        expect(stepB0).toEqual({
            kind: 'delete',
            handle: 'handle-2',
        })

        expect(stepC0).toEqual({
            kind: 'create',
            state: {
                url: createEndpointUrl(
                    'https://example.com/eventD',
                )._unsafeUnwrap(),
                events: ['eventD'],
                config: { value: 'rightD' },
            },
        })
    })

    it('gets step by id', () => {
        const left: State<typeof providers> = {
            providers: {
                testProvider: TestProvider({
                    storeUrl: 'storeurl',
                    storeKey: 'storekey',
                }),
            },
            providerStates: {
                testProvider: new Map([
                    [
                        createEndpointHandle('handle-0')._unsafeUnwrap(),
                        {
                            url: createEndpointUrl(
                                'https://example.com/old',
                            )._unsafeUnwrap(),
                            events: ['testEvent'],
                            config: {},
                        },
                    ],
                ]),
            },
        }
        const right: State<typeof providers> = {
            providers: {
                testProvider: TestProvider({
                    storeUrl: 'storeurl',
                    storeKey: 'storekey',
                }),
            },
            providerStates: {
                testProvider: new Map([
                    [
                        createOrphanEndpointHandle(),
                        {
                            url: createEndpointUrl(
                                'https://example.com/new',
                            )._unsafeUnwrap(),
                            events: ['testEvent'],
                            config: {},
                        },
                    ],
                ]),
            },
        }

        const result = createPlan(left, right)
        expect(result.isOk()).toBe(true)
        const plan = result._unsafeUnwrap()
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
                url: createEndpointUrl(
                    'https://example.com/new',
                )._unsafeUnwrap(),
                events: ['testEvent'],
                config: {},
            },
        })
    })

    it('fails when left state contains orphan endpoint handle', () => {
        const left: State<typeof providers> = {
            providers: {
                testProvider: TestProvider({
                    storeUrl: 'storeurl',
                    storeKey: 'storekey',
                }),
            },
            providerStates: {
                testProvider: new Map([
                    [
                        createOrphanEndpointHandle(),
                        {
                            url: createEndpointUrl(
                                'https://localhost/',
                            )._unsafeUnwrap(),
                            events: ['testEvent'],
                            config: {},
                        },
                    ],
                ]),
            },
        }
        const right: State<typeof providers> = {
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

        const result = createPlan(left, right)
        expect(result.isErr()).toBe(true)
        expect(result._unsafeUnwrapErr().name).toBe(
            'InvalidOrphanEndpointHandleError',
        )
    })
})
