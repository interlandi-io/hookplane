import { createPlan, Plan, ProviderSet, State } from '@hookplane/core'

export interface PlanOutput {
    syncPlan: Plan<ProviderSet>
    targetPlan: Plan<ProviderSet>
}

export async function plan(
    prior: State<ProviderSet>,
    actual: State<ProviderSet>,
    desired: State<ProviderSet>,
): Promise<PlanOutput> {
    const syncPlan = createPlan(prior, actual)._unsafeUnwrap()
    const targetPlan = createPlan(actual, desired)._unsafeUnwrap()

    return { syncPlan, targetPlan }
}
