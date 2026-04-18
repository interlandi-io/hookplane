import { err, ok, Result } from 'neverthrow'
import { createPlan, Plan, ProviderSet, State } from '@hookplane/core'

export interface PlanOutput {
    syncPlan: Plan<ProviderSet>
    targetPlan: Plan<ProviderSet>
}

export async function plan(
    prior: State<ProviderSet>,
    actual: State<ProviderSet>,
    desired: State<ProviderSet>,
): Promise<Result<PlanOutput, Error>> {
    const syncPlanResult = createPlan(prior, actual, {
        createNonOrphanHandles: true, 
    })
    if (syncPlanResult.isErr()) {
        return err(new Error(syncPlanResult.error.message))
    }

    const targetPlanResult = createPlan(actual, desired)
    if (targetPlanResult.isErr()) {
        return err(new Error(targetPlanResult.error.message))
    }

    return ok({
        syncPlan: syncPlanResult.value,
        targetPlan: targetPlanResult.value,
    })
}
