import { err, ok, Result } from 'neverthrow'
import {
    createExecutor,
    defaultDispatch,
    parallelExecution,
    Plan,
    ProviderSet,
} from '@hookplane/core'

export async function execute(
    plan: Plan<ProviderSet>,
): Promise<Result<void, Error>> {
    const executor = createExecutor(
        plan,
        parallelExecution(),
        defaultDispatch(),
    )
    if (executor.isErr()) {
        return err(new Error('Failed to create plan executor'))
    }
    const events = await executor.value.execute()
    console.dir(events)
    return ok(undefined)
}
