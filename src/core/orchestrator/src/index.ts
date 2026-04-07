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
    Statefile,
    State,
    Plan,
    Executor,
    StepId,
    StepState,
} from '@hookplane/core'
import { StatefileDriver, StatefileDriverData } from '@hookplane/statefile-driver'
import { findHookplane } from './find-hookplane.js'
import { extract } from './extract.js'

export type Orchestrator = {
    run(): void
    checkpoint(): OrchestratorState,
}

export type OrchestratorDescriptor = {
    execute: ExecuteFn
    dispatch: DispatchFn
    statefileDriver: StatefileDriver
    matchingHeuristic: Heuristic,
}

export type OrchestratorState =
    | { tag: 'ready' }
    | { tag: 'scanned'; stateUnknown: StateUnknown<ProviderSet> }
    | { tag: 'statefile-loaded'; statefileData: StatefileDriverData }
    | { tag: 'statefile-parsed'; statefile: Statefile<ProviderSet> }
    | { tag: 'synced'; local: State<ProviderSet>, synced: State<ProviderSet>, diff: Plan<ProviderSet> }
    | { tag: 'matched'; left: State<ProviderSet>; right: State<ProviderSet> }
    | { tag: 'planned'; plan: Plan<ProviderSet> }
    | { tag: 'executing'; executor: Executor<ProviderSet> }
    | { tag: 'success'; stepStates: Map<StepId, StepState> }
    | { tag: 'failed'; error: Error; lastValidState: OrchestratorState }

export function createOrchestrator() { }

// Just a sketch here
// eslint-disable-next-line
async function run({
    execute,
    dispatch,
    statefileDriver,
    matchingHeuristic,
}: OrchestratorDescriptor) {
    // Before -- State: ready 

    // State: Scanning 
    const { filePath, exportName } = findHookplane('TODO')._unsafeUnwrap()
    const stateUnknown = (await extract(exportName, filePath))._unsafeUnwrap()

    // State: Statefile retreival
    const statefileData = statefileDriver.read()

    // State: statefile parsing
    const statefile = parseStatefile(
        statefileData,
        stateUnknown.providers,
    )._unsafeUnwrap()

    // State: Sync
    const unsynced = statefile.toState()._unsafeUnwrap()
    const synced = (
        await sync(unsynced.baseUrl, unsynced.providers)
    )._unsafeUnwrap()
    const diff = createPlan(unsynced, synced)._unsafeUnwrap()

    // State: Sync reconciliation
    if (!diff.isEmpty()) {
        // reconciliation strategy
    }
    const left = synced

    // State: Matching
    const right = match(matchingHeuristic, stateUnknown, left)._unsafeUnwrap()

    // State: Planning
    const plan = createPlan(left, right)._unsafeUnwrap()

    // State: execution
    const executor = createExecutor(plan, execute, dispatch)._unsafeUnwrap()
    await executor.execute()

    // State: completed
    const result = executor.getStepStates()
}
