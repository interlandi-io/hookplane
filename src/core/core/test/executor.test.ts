import { errAsync, okAsync } from 'neverthrow'
import { createExecutor, parallelExecution, defaultDispatch } from '~/executor'
import { err, ok } from 'neverthrow'
import {
    Provider,
    createEndpointHandle,
    createBaseUrl,
    createRelativeUrl,
    NotFoundError,
    type EndpointHandle,
    type RelativeUrl,
} from '~/provider'
import { Plan, StepId, createStepId } from '~/plan'

interface EndpointRecord {
    url: string
    events: string[]
    config: Record<string, unknown>
}

const endpoints: Map<string, EndpointRecord> = new Map()
let handleCounter = 0

const MockProvider: Provider<
    'testEvent',
    Record<string, unknown>,
    Record<string, unknown>,
    Record<string, unknown>
> = {
    name: 'mockProvider',
    config: {},
    state: {},
    events: {
        testEvent: {},
    },
    setup() {
        return okAsync({})
    },
    createEndpoint({ url, events, endpointConfig }) {
        const handle = createEndpointHandle(
            `handle-${handleCounter++}`,
        )._unsafeUnwrap()
        endpoints.set(handle, { url, events, config: endpointConfig })
        return okAsync({
            handle,
        })
    },
    readEndpoint({ handle }) {
        const endpoint = endpoints.get(handle)
        if (endpoint) {
            const relativeUrl = createRelativeUrl(
                new URL(endpoint.url).pathname,
            )._unsafeUnwrap()
            return okAsync({
                relativeUrl,
                events: endpoint.events as ['testEvent'],
                config: endpoint.config,
            })
        } else {
            return errAsync({
                name: 'NotFoundError',
                message: 'resource not found',
                source: new Error('Endpoint not found'),
            } as NotFoundError)
        }
    },
    updateEndpoint({ handle, url, events, endpointConfig }) {
        const existing = endpoints.get(handle)
        if (existing) {
            endpoints.set(handle, { url, events, config: endpointConfig })
            return okAsync()
        } else {
            return errAsync({
                name: 'NotFoundError',
                message: 'resource not found',
                source: new Error('Endpoint not found'),
            } as NotFoundError)
        }
    },
    deleteEndpoint({ handle }) {
        endpoints.delete(handle)
        return okAsync()
    },
    indexEndpoints() {
        const index = new Map<
            EndpointHandle,
            {
                relativeUrl: RelativeUrl
                events: ['testEvent']
                config: Record<string, unknown>
            }
        >()
        for (const [handle, endpoint] of endpoints) {
            index.set(createEndpointHandle(handle)._unsafeUnwrap(), {
                relativeUrl: createRelativeUrl('/')._unsafeUnwrap(),
                events: endpoint.events as ['testEvent'],
                config: endpoint.config,
            })
        }
        return okAsync(index)
    },
    processRequest() {
        return okAsync({
            event: 'testEvent' as const,
            data: {},
        })
    },
}

describe('executor', () => {
    beforeEach(() => {
        endpoints.clear()
        handleCounter = 0
    })

    it('should handle creates correctly', async () => {
        const providers = { MockProvider }
        const providerPlans = {
            MockProvider: new Map([
                [
                    createStepId(0),
                    {
                        kind: 'create' as const,
                        state: {
                            relativeUrl:
                                createRelativeUrl('/webhook')._unsafeUnwrap(),
                            events: ['testEvent'] as ['testEvent'],
                            config: { secret: 'abc' },
                        },
                    },
                ],
                [
                    createStepId(1),
                    {
                        kind: 'create' as const,
                        state: {
                            relativeUrl:
                                createRelativeUrl('/api')._unsafeUnwrap(),
                            events: ['testEvent'] as ['testEvent'],
                            config: { apiKey: 'xyz' },
                        },
                    },
                ],
            ]),
        }
        const plan: Plan<typeof providers> = {
            baseUrl: createBaseUrl('https://example.com')._unsafeUnwrap(),
            providers,
            providerPlans: providerPlans as Plan<
                typeof providers
            >['providerPlans'],
            getStepById(id) {
                for (const pp of Object.values(providerPlans)) {
                    const step = pp.get(id)
                    if (step) return ok(step)
                }
                return err(new Error('not found'))
            },
            getStepIds() {
                const ids: StepId[] = []
                for (const pp of Object.values(providerPlans)) {
                    ids.push(...pp.keys())
                }
                return ids
            },
            isEmpty() {
                throw 'unimplemented'
            },
        }

        const executor = createExecutor(
            plan,
            parallelExecution(),
            defaultDispatch(),
        )
        expect(executor.isOk()).toBe(true)

        executor._unsafeUnwrap().execute()
        expect(endpoints.size).toBe(2)
        const handles = Array.from(endpoints.keys())
        expect(handles).toContain('handle-0')
        expect(handles).toContain('handle-1')
    })

    it('should handle deletes correctly', async () => {
        endpoints.set('handle-0', {
            url: 'https://example.com/webhook',
            events: ['testEvent'],
            config: {},
        })
        endpoints.set('handle-1', {
            url: 'https://example.com/api',
            events: ['testEvent'],
            config: {},
        })

        const providers = { MockProvider }
        const providerPlans = {
            MockProvider: new Map([
                [
                    createStepId(0),
                    {
                        kind: 'delete' as const,
                        handle: createEndpointHandle(
                            'handle-0',
                        )._unsafeUnwrap(),
                    },
                ],
                [
                    createStepId(1),
                    {
                        kind: 'delete' as const,
                        handle: createEndpointHandle(
                            'handle-1',
                        )._unsafeUnwrap(),
                    },
                ],
            ]),
        }
        const plan: Plan<typeof providers> = {
            baseUrl: createBaseUrl('https://example.com')._unsafeUnwrap(),
            providers,
            providerPlans: providerPlans as Plan<
                typeof providers
            >['providerPlans'],
            getStepById(id) {
                for (const pp of Object.values(providerPlans)) {
                    const step = pp.get(id)
                    if (step) return ok(step)
                }
                return err(new Error('not found'))
            },
            getStepIds() {
                const ids: StepId[] = []
                for (const pp of Object.values(providerPlans)) {
                    ids.push(...pp.keys())
                }
                return ids
            },
            isEmpty() {
                throw 'unimplemented'
            },
        }

        const executor = createExecutor(
            plan,
            parallelExecution(),
            defaultDispatch(),
        )
        expect(executor.isOk()).toBe(true)

        executor._unsafeUnwrap().execute()
        expect(endpoints.size).toBe(0)
    })

    it('should handle updates correctly', async () => {
        endpoints.set('handle-0', {
            url: 'https://example.com/webhook',
            events: ['testEvent'],
            config: { oldConfig: true },
        })

        const providers = { MockProvider }
        const providerPlans = {
            MockProvider: new Map([
                [
                    createStepId(0),
                    {
                        kind: 'update' as const,
                        handle: createEndpointHandle(
                            'handle-0',
                        )._unsafeUnwrap(),
                        state: {
                            relativeUrl:
                                createRelativeUrl('/webhook')._unsafeUnwrap(),
                            events: ['testEvent'] as ['testEvent'],
                            config: { newConfig: true },
                        },
                    },
                ],
            ]),
        }
        const plan: Plan<typeof providers> = {
            baseUrl: createBaseUrl('https://example.com')._unsafeUnwrap(),
            providers,
            providerPlans: providerPlans as Plan<
                typeof providers
            >['providerPlans'],
            getStepById(id) {
                for (const pp of Object.values(providerPlans)) {
                    const step = pp.get(id)
                    if (step) return ok(step)
                }
                return err(new Error('not found'))
            },
            getStepIds() {
                const ids: StepId[] = []
                for (const pp of Object.values(providerPlans)) {
                    ids.push(...pp.keys())
                }
                return ids
            },
            isEmpty() {
                throw 'unimplemented'
            },
        }

        const executor = createExecutor(
            plan,
            parallelExecution(),
            defaultDispatch(),
        )
        expect(executor.isOk()).toBe(true)

        executor._unsafeUnwrap().execute()
        expect(endpoints.size).toBe(1)
        const endpoint = endpoints.get('handle-0')
        expect(endpoint?.config).toEqual({ newConfig: true })
    })

    it('should return error for empty plan', () => {
        const providers = { MockProvider }
        const plan: Plan<typeof providers> = {
            baseUrl: createBaseUrl('https://example.com')._unsafeUnwrap(),
            providers,
            providerPlans: {
                MockProvider: new Map(),
            },
            getStepById() {
                return err(new Error('not found'))
            },
            getStepIds() {
                return []
            },
            isEmpty() {
                throw 'unimplemented'
            },
        }

        const executor = createExecutor(
            plan,
            parallelExecution(),
            defaultDispatch(),
        )
        expect(executor.isErr()).toBe(true)
        expect(executor._unsafeUnwrapErr().name).toBe('EmptyPlanError')
    })
})
