/**
 * Execution engine for applying a `Plan` to remote providers.
 *
 * The execution flow is:
 * 1. Create a plan with `createPlan(left, right)`
 * 2. Create an executor with `createExecutor(plan, strategy, dispatch)`
 * 3. Call `executor.execute()`
 * 4. Monitor progress with `executor.getStepStates()`
 */
import { ok, Result, ResultAsync, errAsync } from 'neverthrow'
import { Plan, Step, StepId } from './plan.js'
import { Provider, CreateEndpointReturn } from './provider.js'
import { ProviderSet } from './provider-set.js'

// Note: The generics were stripped from many types in this file because they aren't really used at the call sites,
// and they make including ExecuteFns and DispatchFns as properties difficult.
// Use extra care when passing Providers/ProviderSets around, since there aren't any type guards to help you.

/**
 * Handle to an executor that runs a `Plan` against remote providers.
 *
 * @example
 * ```typescript
 * const executor = createExecutor(plan, parallelExecution(), defaultDispatch())
 * executor.execute()
 * ```
 */
export interface Executor<P extends ProviderSet> {
    /** The plan this executor was created with. */
    getPlan(): Plan<P>

    /**
     * Execute the plan according to the execution strategy.
     * @param from - The set of events to resume execution from (optional)
     */
    execute(from?: ExecutionEventLedger): Promise<ExecutionEventLedger>
}

export type ExecutionEventLedger = ExecutionEvent[]

export type ExecutionEvent =
    | { tag: 'stepStarted'; stepId: StepId; ts: number }
    | { tag: 'stepSucceeded'; stepId: StepId; ts: number; result: StepResult }
    | { tag: 'stepFailed'; stepId: StepId; ts: number; error: DispatchError }

/**
 * The status of a step during execution.
 * @internal
 */
type DerivedStepState =
    | { status: 'pending' }
    | { status: 'inFlight' }
    | { status: 'success'; result: StepResult }
    | { status: 'failure'; error: DispatchError }

/**
 * The result of a step completed successfully.
 */
export type StepResult =
    | { kind: 'create'; value: CreateEndpointReturn }
    | { kind: 'delete' }
    | { kind: 'update' }

/**
 * Strategy for executing a plan.
 * @param plan - The plan to execute
 * @param stepStates - The initial set of step states.
 * @param dispatch - The dispatch function to use.
 */
export type ExecuteFn = (
    plan: Plan<ProviderSet>,
    toRun: Iterable<StepId>,
    emit: (event: ExecutionEvent) => void,
    dispatch: DispatchFn,
) => ResultAsync<void, Error>

/**
 * Dispatches a step to a provider.
 * @param provider - The provider to call
 * @param stepId - The step's unique ID
 * @param step - The step to execute (create, delete, or update)
 */
export type DispatchFn = (
    provider: Provider,
    stepId: StepId,
    step: Step<Provider>,
) => ResultAsync<StepResult, DispatchError>

/**
 * Called when a Step's dispatch Promise resolves (success state)
 * Importantly, this is not called in the failure case.
 *
 * @param stepId - The step's unique ID
 * @param step - The step that transitioned
 * @returns Any errors that may have occurred during execution.
 */
export type ResolutionEffect = (
    dispatchArgs: Parameters<DispatchFn>,
    result: StepResult,
) => ResultAsync<void, DispatchError>

export type ExecutorError = void

export type DispatchError =
    | InvalidStepIdError
    | CreateError
    | DeleteError
    | UpdateError

export interface InvalidStepIdError extends Error {
    name: 'InvalidStepIdError'
    message: 'invalid step id'
    stepId: StepId
}

export interface CreateError extends Error {
    name: 'CreateError'
    message: 'failed to create endpoint'
    stepId: StepId
    source: Error
}

export interface DeleteError extends Error {
    name: 'DeleteError'
    message: 'failed to delete endpoint'
    stepId: StepId
    source: Error
}

export interface UpdateError extends Error {
    name: 'UpdateError'
    message: 'failed to update endpoint'
    stepId: StepId
    source: Error
}

/**
 * Creates an executor that runs a plan against remote providers.
 *
 * @example
 * ```typescript
 * // Golden path: pull current state, create plan, execute it
 *
 * // 1. Pull current state from providers
 * const current = await sync(providers)
 * if (current.isErr()) throw current.error
 *
 * // 2. Create plan to reach desired state
 * const plan = createPlan(current.value, desiredState)
 *
 * // 3. Create and run executor
 * const executor = createExecutor(
 *   plan,
 *   parallelExecution(),
 *   defaultDispatch(),
 * )
 *
 * if (executor.isErr()) {
 *   if (executor.error.name === 'EmptyPlanError') {
 *     console.log('Already synced')
 *     return
 *   }
 *   throw executor.error
 * }
 *
 * executor.value.execute()
 *
 * // 4. Monitor results
 * for (const [id, state] of executor.value.getStepStates()) {
 *   console.log(`Step ${id}: ${state.status}`)
 *   if (state.status === 'failure') {
 *     console.error(`  Error: ${state.error.message}`)
 *   }
 * }
 * ```
 *
 * @param plan - From `createPlan(left, right)`
 * @param executeFn - Strategy like `parallelExecution()`
 * @param dispatchFn - Like `defaultDispatch()`
 */
export function createExecutor<P extends ProviderSet>(
    plan: Plan<P>,
    executeFn: ExecuteFn,
    dispatchFn: DispatchFn,
): Result<Executor<P>, ExecutorError> {
    return ok({
        getPlan: () => plan,
        execute: async (from?: ExecutionEventLedger) => {
            const ledger = from || []
            const derivedState = reduceEventLedger(plan, ledger)
            const toRun = [...derivedState.entries()]
                .filter(([, state]) => state.status === 'pending') // TODO retry policy here
                .map(([id]) => id)
            await executeFn(
                plan,
                toRun,
                (event) => ledger.push(event),
                dispatchFn,
            )
            return ledger
        },
    })
}

/**
 * Executes all steps in parallel.
 *
 * @example
 * ```typescript
 * const executor = createExecutor(plan, parallelExecution(), dispatch)
 * ```
 */
export const parallelExecution: () => ExecuteFn =
    () =>
    (plan, toRun, emit, dispatch): ResultAsync<void, Error> => {
        const promises: Promise<void>[] = []

        for (const stepId of toRun) {
            const step = plan.getStepById(stepId)
            if (step.isErr()) {
                return errAsync({
                    name: 'InvalidStepIdError',
                    message: 'invalid step id',
                    stepId,
                    cause: step.error,
                })
            }

            const provider = plan.getStepProviderByStepId(stepId)
            if (provider.isErr()) {
                return errAsync(provider.error)
            }

            emit({ tag: 'stepStarted', stepId, ts: Date.now() })
            const promise = dispatch(provider.value, stepId, step.value).match(
                (result) => {
                    emit({
                        tag: 'stepSucceeded',
                        stepId,
                        ts: Date.now(),
                        result,
                    })
                },
                (error) => {
                    emit({
                        tag: 'stepFailed',
                        stepId,
                        ts: Date.now(),
                        error,
                    })
                },
            )
            promises.push(promise)
        }

        return ResultAsync.fromSafePromise(Promise.allSettled(promises)).map(
            () => {},
        )
    }

/**
 * Default dispatch that calls provider.createEndpoint, deleteEndpoint, or updateEndpoint.
 *
 * @example
 * ```typescript
 * const dispatch = defaultDispatch()
 * ```
 */
export const defaultDispatch =
    <P extends ProviderSet>() =>
    <K extends keyof P>(
        provider: P[K],
        stepId: StepId,
        step: Step<P[K]>,
    ): ResultAsync<StepResult, DispatchError> => {
        switch (step.kind) {
            case 'create':
                return provider
                    .createEndpoint({
                        providerState: provider.state,
                        providerConfig: provider.config,
                        url: step.state.url,
                        events: step.state.events,
                        endpointConfig: step.state.config,
                    })
                    .map(
                        (ret) =>
                            ({
                                kind: 'create',
                                value: ret,
                            }) satisfies StepResult,
                    )
                    .mapErr(
                        (error) =>
                            ({
                                name: 'CreateError',
                                message: 'failed to create endpoint',
                                stepId,
                                source: error,
                            }) as CreateError,
                    )

            case 'delete':
                return provider
                    .deleteEndpoint({
                        providerState: provider.state,
                        providerConfig: provider.config,
                        handle: step.handle,
                    })
                    .map(() => ({ kind: 'delete' }) satisfies StepResult)
                    .mapErr(
                        (error) =>
                            ({
                                name: 'DeleteError',
                                message: 'failed to delete endpoint',
                                stepId,
                                source: error,
                            }) as DeleteError,
                    )

            case 'update':
                return provider
                    .updateEndpoint({
                        providerState: provider.state,
                        providerConfig: provider.config,
                        handle: step.handle,
                        url: step.state.url,
                        events: step.state.events,
                        endpointConfig: step.state.config,
                    })
                    .map(() => ({ kind: 'update' }) satisfies StepResult)
                    .mapErr(
                        (error) =>
                            ({
                                name: 'UpdateError',
                                message: 'failed to update endpoint',
                                stepId,
                                source: error,
                            }) as UpdateError,
                    )
        }
    }

/** @see ResolutionEffect */
export const withResolutionEffect =
    (dispatch: DispatchFn, effect: ResolutionEffect): DispatchFn =>
    (...args) =>
        dispatch(...args).andThrough((result) => effect([...args], result))

function reduceEventLedger(
    plan: Plan<ProviderSet>,
    ledger: ExecutionEventLedger,
): Map<StepId, DerivedStepState> {
    const stepIds = plan.getStepIds()
    const sorted = ledger.toSorted((a, b) => a.ts - b.ts)
    const derived: Map<StepId, DerivedStepState> = new Map(
        stepIds.map((id) => [id, { status: 'pending' }]),
    )

    for (const event of sorted) {
        switch (event.tag) {
            case 'stepStarted':
                derived.set(event.stepId, { status: 'inFlight' })
                break
            case 'stepSucceeded':
                derived.set(event.stepId, {
                    status: 'success',
                    result: event.result,
                })
                break
            case 'stepFailed':
                derived.set(event.stepId, {
                    status: 'failure',
                    error: event.error,
                })
                break
        }
    }

    return derived
}
