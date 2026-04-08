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
} from '@hookplane/core'
import {
    StatefileDriver,
    StatefileDriverData,
    StatefileDriverError,
} from '@hookplane/statefile-driver'
import { FindError, findHookplane } from './find-hookplane.js'
import { extract, ExtractionError } from './extract.js'

export type Orchestrator = {
    run(params: RunParams): Promise<OrchestratorState>
}

export type OrchestratorDescriptor = {
    tsconfigPath: string
    execute: ExecuteFn
    dispatch: DispatchFn
    statefileDriver: StatefileDriver
    matchingHeuristic: Heuristic
}

export type OrchestratorState =
    | OrchestratorStateNonTerminal
    | OrchestratorStateTerminal

export type OrchestratorStateNonTerminal =
    | { tag: 'ready'; tsconfigPath: string }
    | { tag: 'scanned'; rightUnknown: StateUnknown<ProviderSet> }
    | {
          tag: 'statefile-loaded'
          rightUnknown: StateUnknown<ProviderSet>
          leftStatefileData: StatefileDriverData
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
    | { tag: 'matched'; left: State<ProviderSet>; right: State<ProviderSet> }
    | { tag: 'planned'; plan: Plan<ProviderSet> }
    | { tag: 'executable'; executor: Executor<ProviderSet> }

type OrchestratorStateTerminal =
    | { tag: 'succeeded'; stepStates: Map<StepId, StepState> }
    | {
          tag: 'failed'
          error: OrchestratorError
          lastValidState: OrchestratorState
      }

export type OrchestratorError =
    | { last: 'ready'; error: FindError | ExtractionError }
    | { last: 'scanned'; error: StatefileDriverError }
    | { last: 'statefile-loaded'; error: StatefileError }
    | { last: 'statefile-parsed'; error: SyncError }
    | { last: 'synced'; error: PlanError }
    | { last: 'drift-detected'; error: void } // TODO
    | { last: 'reconciled'; error: MatchError }
    | { last: 'matched'; error: PlanError }
    | { last: 'planned'; error: ExecutorError }
    | { last: 'executable'; error: Map<StepId, StepState> }

export type RunParams = {
    from?: OrchestratorStateNonTerminal
    until?: OrchestratorStateNonTerminal['tag']
}

export function createOrchestrator(desc: OrchestratorDescriptor): Orchestrator {
    return {
        async run({ from, until }: RunParams) {
            let state: OrchestratorState = from ?? {
                tag: 'ready',
                tsconfigPath: desc.tsconfigPath,
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

// Just a sketch here
// eslint-disable-next-line
async function transition(
    state: OrchestratorStateNonTerminal,
    {
        execute,
        dispatch,
        statefileDriver,
        matchingHeuristic,
    }: OrchestratorDescriptor,
): Promise<OrchestratorState> {
    switch (state.tag) {
        case 'ready': {
            const { tsconfigPath } = state
            const instance = findHookplane(tsconfigPath)
            if (instance.isErr()) {
                return {
                    tag: 'failed',
                    error: {
                        last: 'ready',
                        error: instance.error,
                    },
                    lastValidState: state,
                }
            }
            const { exportName, filePath } = instance.value
            const rightUnknown = await extract(exportName, filePath)
            if (rightUnknown.isErr()) {
                return {
                    tag: 'failed',
                    error: {
                        last: 'ready',
                        error: rightUnknown.error,
                    },
                    lastValidState: state,
                }
            }
            return { tag: 'scanned', rightUnknown: rightUnknown.value }
        }

        case 'scanned': {
            const { rightUnknown } = state
            const leftStatefileData = await statefileDriver.read()
            if (leftStatefileData.isErr()) {
                return {
                    tag: 'failed',
                    error: {
                        last: 'scanned',
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
            }
        }

        case 'planned': {
            const { plan } = state
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
            }
        }

        case 'executable': {
            const { executor } = state
            await executor.execute()
            const stepStates = executor.getStepStates()
            const failed = stepStates
                .values()
                .some((s) => s.status !== 'success')
            return !failed
                ? {
                      tag: 'succeeded',
                      stepStates,
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
    }
}

export const stateIsTerminal = (state: OrchestratorState) =>
    state.tag === 'succeeded' || state.tag === 'failed'
