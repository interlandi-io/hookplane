/**
 * Execution engine for applying a `Plan` to remote providers.
 *
 * The execution flow is:
 * 1. Create a plan with `createPlan(left, right)`
 * 2. Create an executor with `createExecutor(plan, strategy, dispatch)`
 * 3. Call `executor.execute()`
 * 4. Monitor progress with `executor.getStepStates()`
 */
import { ok, err, Result, ResultAsync } from 'neverthrow'
import { Plan, Step, StepId } from './plan'
import {
    Provider,
    composeEndpointUrl,
    BaseUrl,
    CreateEndpointReturn,
} from './provider'
import { ProviderSet } from './provider-set'

// Note: The generics were stripped from many types in this file because they aren't really used at the call sites,
// and they make including ExecuteFns and DispatchFns as properties in an Orchestrator difficult.
// Use extra care when passing Providers/ProviderSets around, since there aren't any type guards to help you.

/**
 * Handle to an executor that runs a `Plan` against remote providers.
 *
 * @example
 * ```typescript
 * const executor = createExecutor(plan, parallelExecution(), defaultDispatch(baseUrl))
 * executor.execute()
 * ```
 */
export interface Executor<P extends ProviderSet> {
    /** The plan this executor was created with. */
    getPlan(): Plan<P>

    /** Current states of all steps. Check this after execute() to see results. */
    getStepStates(): Map<StepId, StepState>

    /** Execute the plan according to the execution strategy. */
    execute(): Promise<void>
}

export type ExecutorState<P extends ProviderSet> = {
    plan: Plan<P>
    stepStates: Map<StepId, StepState>
    dispatchFn: DispatchFn
}

/**
 * The status of a step during execution.
 */
export type StepState =
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
    stepStates: Map<StepId, StepState>,
    dispatch: DispatchFn,
) => ResultAsync<void, Error>

/**
 * Dispatches a step to a provider.
 * @param provider - The provider to call
 * @param stepId - The step's unique ID
 * @param step - The step to execute (create, delete, or update)
 */
export type DispatchFn = (
    // TODO this is a huge bug.
    // Executor will just use whatever baseUrl is given, rather than the right one for the step.
    baseUrl: BaseUrl,
    provider: Provider,
    stepId: StepId,
    step: Step<Provider>,
) => ResultAsync<StepResult, DispatchError>

export type ExecutorError = EmptyPlanError

/**
 * Returned when creating an executor for an empty plan.
 */
export interface EmptyPlanError extends Error {
    name: 'EmptyPlanError'
    message: 'attempted to create Executor for an empty plan'
}

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
 * const current = await pull(baseUrl, providers)
 * if (current.isErr()) throw current.error
 *
 * // 2. Create plan to reach desired state
 * const plan = createPlan(current.value, desiredState)
 *
 * // 3. Create and run executor
 * const executor = createExecutor(
 *   plan,
 *   parallelExecution(),
 *   defaultDispatch(plan.baseUrl),
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
 * @param dispatchFn - Like `defaultDispatch(plan.baseUrl)`
 */
export function createExecutor<P extends ProviderSet>(
    plan: Plan<P>,
    executeFn: ExecuteFn,
    dispatchFn: DispatchFn,
): Result<Executor<P>, ExecutorError> {
    const stepIds = plan.getStepIds()
    if (stepIds.length == 0) {
        return err({
            name: 'EmptyPlanError',
            message: 'attempted to create Executor for an empty plan',
        } as EmptyPlanError)
    }
    const stepStates = new Map(
        stepIds.map((id) => [id, { status: 'pending' } as StepState]),
    )
    const state: ExecutorState<P> = {
        stepStates,
        plan,
        dispatchFn,
    }

    return ok({
        getPlan: () => state.plan,
        getStepStates: () => state.stepStates,
        execute: async () => {
            await executeFn(state.plan, state.stepStates, state.dispatchFn)
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
export const parallelExecution =
    <P extends ProviderSet>() =>
    (
        plan: Plan<P>,
        stepStates: Map<StepId, StepState>,
        dispatch: DispatchFn,
    ): ResultAsync<void, Error> => {
        const promises: Promise<void>[] = []

        for (const [providerKey, providerPlan] of Object.entries(
            plan.providerPlans,
        )) {
            for (const [stepId, step] of providerPlan) {
                const currentState = stepStates.get(stepId)
                // TODO: Currently, this just skips steps already in flight.
                // Maybe we want to do something with this later.
                if (
                    currentState?.status == 'inFlight' ||
                    currentState?.status == 'success'
                )
                    continue

                const provider = plan.providers[providerKey as keyof P]!
                stepStates.set(stepId, { status: 'inFlight' })

                const promise = dispatch(
                    plan.baseUrl,
                    provider,
                    stepId,
                    step as Step<P[keyof P]>,
                ).match(
                    (result) => {
                        stepStates.set(stepId, { status: 'success', result })
                    },
                    (error) => {
                        stepStates.set(stepId, { status: 'failure', error })
                    },
                )
                promises.push(promise)
            }
        }

        return ResultAsync.fromSafePromise(Promise.allSettled(promises)).map(
            () => {},
        )
    }

/**
 * Default dispatch that calls provider.createEndpoint, deleteEndpoint, or updateEndpoint.
 *
 * Composes URLs from `baseUrl + endpoint.relativeUrl`.
 *
 * @example
 * ```typescript
 * const dispatch = defaultDispatch(plan.baseUrl)
 * ```
 */
export const defaultDispatch =
    <P extends ProviderSet>() =>
    <K extends keyof P>(
        baseUrl: BaseUrl,
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
                        url: composeEndpointUrl(baseUrl, step.state),
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
                        url: composeEndpointUrl(baseUrl, step.state),
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
