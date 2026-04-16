import {
    createExecutor,
    defaultDispatch,
    parallelExecution,
    Plan,
    ProviderSet,
} from '@hookplane/core'

export async function execute(plan: Plan<ProviderSet>) {
    const executor = createExecutor(
        plan,
        parallelExecution(),
        defaultDispatch(),
    )
    if (executor.isErr()) {
        console.error('Failed to create plan executor')
        process.exit(1)
    }
    const events = await executor.value.execute()
    console.dir(events)
}
