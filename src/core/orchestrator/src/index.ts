import {
    ExecuteFn,
    DispatchFn,
    parseStatefile,
    sync,
    createPlan,
    match,
    Heuristic,
    createExecutor,
    StateUnknown,
    ProviderSet,
    State,
    Plan,
    Executor,
    StepId,
    StepState,
    StatefileError,
    SyncError,
    PlanError,
    MatchError,
    ExecutorError,
    bootstrap,
    fromState,
} from '@hookplane/core'
import {
    Backend,
    StatefileData,
    BackendError,
} from '@hookplane/backend'

export type Orchestrator = {
    run(params: RunParams): Promise<OrchestratorState>
}

export type OrchestratorDescriptor = {
    rightState: StateUnknown<ProviderSet>
    execute: ExecuteFn
    dispatch: DispatchFn
    backend: Backend
    matchingHeuristic: Heuristic
}

export type OrchestratorState =
    | OrchestratorStateNonTerminal
    | OrchestratorStateTerminal

export type OrchestratorStateNonTerminal =
    | {
          tag: 'ready'
          rightState: StateUnknown<ProviderSet>
          shouldBootstrap: boolean
      }
    | {
          tag: 'initialized'
          rightUnknown: StateUnknown<ProviderSet>
          shouldBootstrap: boolean
      }
    | {
          tag: 'statefile-loaded'
          rightUnknown: StateUnknown<ProviderSet>
          leftStatefileData: StatefileData
      }
    | {
          tag: 'statefile-parsed'
          leftPrior: State<ProviderSet>
          rightUnknown: StateUnknown<ProviderSet>
          // We could extract signing secrets here,
          // but that's for future releases.
      }
    | {
          tag: 'synced'
          leftPrior: State<ProviderSet>
          leftActual: State<ProviderSet>
          rightUnknown: StateUnknown<ProviderSet>
      }
    | {
          tag: 'drift-detected'
          leftActual: State<ProviderSet>
          plan: Plan<ProviderSet>
          rightUnknown: StateUnknown<ProviderSet>
      }
    | {
          tag: 'reconciled'
          left: State<ProviderSet>
          rightUnknown: StateUnknown<ProviderSet>
      }
    | {
          tag: 'matched'
          left: State<ProviderSet>
          right: State<ProviderSet>
      }
    | {
          tag: 'planned'
          plan: Plan<ProviderSet>
          right: State<ProviderSet>
      }
    | {
          tag: 'executable'
          executor: Executor<ProviderSet>
          right: State<ProviderSet>
      }
    | { tag: 'executed'; right: State<ProviderSet> }

type OrchestratorStateTerminal =
    | { tag: 'succeeded' }
    | {
          tag: 'failed'
          error: OrchestratorError
          lastValidState: OrchestratorState
      }

export type OrchestratorError =
    | { last: 'ready' }
    | { last: 'initialized'; error: BackendError }
    | { last: 'statefile-loaded'; error: StatefileError }
    | { last: 'statefile-parsed'; error: SyncError }
    | { last: 'synced'; error: PlanError }
    | { last: 'drift-detected'; error: void } // TODO
    | { last: 'reconciled'; error: MatchError }
    | { last: 'matched'; error: PlanError }
    | { last: 'planned'; error: ExecutorError }
    | { last: 'executable'; error: Map<StepId, StepState> }
    | { last: 'executed'; error: BackendError }

export type RunParams = {
    from?: OrchestratorStateNonTerminal
    until?: OrchestratorStateNonTerminal['tag']
    shouldBootstrap?: boolean
}

export function createOrchestrator(desc: OrchestratorDescriptor): Orchestrator {
    return {
        async run({ from, until, shouldBootstrap = false }: RunParams) {
            let state: OrchestratorState = from ?? {
                tag: 'ready',
                rightState: desc.rightState,
                shouldBootstrap,
            }
            while (
                until
                    ? !stateIsTerminal(state) && state.tag !== until
                    : !stateIsTerminal(state)
            ) {
                state = await transition(
                    state as OrchestratorStateNonTerminal,
                    desc,
                )
            }
            return state
        },
    }
}

async function transition(
    state: OrchestratorStateNonTerminal,
    {
        execute,
        dispatch,
        backend,
        matchingHeuristic,
    }: OrchestratorDescriptor,
): Promise<OrchestratorState> {
    switch (state.tag) {
        case 'ready': {
            const { rightState, shouldBootstrap } = state

            return {
                tag: 'initialized',
                rightUnknown: rightState,
                shouldBootstrap,
            }
        }

        case 'initialized': {
            const { rightUnknown, shouldBootstrap } = state
            if (shouldBootstrap) {
                const bootstrapped = bootstrap(rightUnknown.baseUrl)
                const result = await backend.writeStatefile(bootstrapped)
                if (result.isErr()) {
                    {
                        return {
                            tag: 'failed',
                            error: {
                                last: 'initialized',
                                error: result.error,
                            },
                            lastValidState: state,
                        }
                    }
                }
            }
            const leftStatefileData = await backend.readStatefile()
            if (leftStatefileData.isErr()) {
                return {
                    tag: 'failed',
                    error: {
                        last: 'initialized',
                        error: leftStatefileData.error,
                    },
                    lastValidState: state,
                }
            }
            return {
                tag: 'statefile-loaded',
                rightUnknown,
                leftStatefileData: leftStatefileData.value,
            }
        }

        case 'statefile-loaded': {
            const { leftStatefileData, rightUnknown } = state
            const leftStatefile = parseStatefile(
                leftStatefileData,
                rightUnknown.providers,
            )
            if (leftStatefile.isErr()) {
                return {
                    tag: 'failed',
                    error: {
                        last: 'statefile-loaded',
                        error: leftStatefile.error,
                    },
                    lastValidState: state,
                }
            }
            const leftPrior = leftStatefile.value.toState()
            if (leftPrior.isErr()) {
                return {
                    tag: 'failed',
                    error: {
                        last: 'statefile-loaded',
                        error: leftPrior.error,
                    },
                    lastValidState: state,
                }
            }
            return {
                tag: 'statefile-parsed',
                leftPrior: leftPrior.value,
                rightUnknown,
            }
        }

        case 'statefile-parsed': {
            const { leftPrior, rightUnknown } = state
            const leftActual = await sync(
                leftPrior.baseUrl,
                leftPrior.providers,
            )
            if (leftActual.isErr()) {
                return {
                    tag: 'failed',
                    error: {
                        last: 'statefile-parsed',
                        error: leftActual.error,
                    },
                    lastValidState: state,
                }
            }
            return {
                tag: 'synced',
                leftPrior,
                leftActual: leftActual.value,
                rightUnknown,
            }
        }

        case 'synced': {
            const { leftPrior, leftActual, rightUnknown } = state
            const plan = createPlan(leftPrior, leftActual)
            if (plan.isErr()) {
                return {
                    tag: 'failed',
                    error: {
                        last: 'synced',
                        error: plan.error,
                    },
                    lastValidState: state,
                }
            }
            return {
                tag: 'drift-detected',
                leftActual,
                plan: plan.value,
                rightUnknown,
            }
        }

        case 'drift-detected': {
            const { leftActual, rightUnknown } = state
            // TODO: reconcile
            return {
                tag: 'reconciled',
                left: leftActual,
                rightUnknown,
            }
        }

        case 'reconciled': {
            const { left, rightUnknown } = state
            const right = match(matchingHeuristic, rightUnknown, left)
            if (right.isErr()) {
                return {
                    tag: 'failed',
                    error: {
                        last: 'reconciled',
                        error: right.error,
                    },
                    lastValidState: state,
                }
            }
            return {
                tag: 'matched',
                left,
                right: right.value,
            }
        }

        case 'matched': {
            const { left, right } = state
            const plan = createPlan(left, right)
            if (plan.isErr()) {
                return {
                    tag: 'failed',
                    error: {
                        last: 'matched',
                        error: plan.error,
                    },
                    lastValidState: state,
                }
            }
            return {
                tag: 'planned',
                plan: plan.value,
                right,
            }
        }

        case 'planned': {
            const { plan, right } = state
            const executor = createExecutor(plan, execute, dispatch)
            if (executor.isErr()) {
                return {
                    tag: 'failed',
                    error: {
                        last: 'planned',
                        error: executor.error,
                    },
                    lastValidState: state,
                }
            }
            return {
                tag: 'executable',
                executor: executor.value,
                right,
            }
        }

        case 'executable': {
            const { executor, right } = state
            await executor.execute()
            const stepStates = executor.getStepStates()
            const failed = stepStates
                .values()
                .some((s) => s.status !== 'success')
            return !failed
                ? {
                      tag: 'executed',
                      right,
                  }
                : {
                      tag: 'failed',
                      error: {
                          last: 'executable',
                          error: stepStates,
                      },
                      lastValidState: state,
                  }
        }

        case 'executed': {
            const { right } = state
            const statefile = fromState(1, right)
            const result = await backend.writeStatefile(statefile)
            if (result.isErr()) {
                return {
                    tag: 'failed',
                    error: {
                        last: 'executed',
                        error: result.error,
                    },
                    lastValidState: state,
                }
            }
            return { tag: 'succeeded' }
        }
    }
}

export const stateIsTerminal = (state: OrchestratorState) =>
    state.tag === 'succeeded' || state.tag === 'failed'
