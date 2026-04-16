import type { Provider, ProviderSet } from '@hookplane/core'
import { State, Plan, StepId, Step, EndpointIndex } from '@hookplane/core'
import { styleText } from 'util'
import { logger } from '../logger.js'

export function displayPlan(
    plan: Plan<ProviderSet>,
    actual: State<ProviderSet>,
) {
    for (const e of Object.entries(plan.providerPlans)) {
        const [providerName, providerPlan] = e as [
            string,
            Map<StepId, Step<Provider>>,
        ]
        console.log(styleText(['bold', 'blue'], providerName))
        const steps: string[] = []
        for (const step of providerPlan.values()) {
            let kind: string
            let url: string
            switch (step.kind) {
                case 'create':
                    kind = styleText('green', 'Create')
                    url = step.state.url
                    break
                case 'delete':
                    kind = styleText('red', 'Delete')
                    url =
                        actual.providerStates[providerName]?.get(step.handle)
                            ?.url || ''
                    break
                case 'update':
                    kind = styleText('yellow', 'Update')
                    url = step.state.url
                    break
            }
            steps.push(`    ${kind} ${styleText(['blue', 'underline'], url)}`)
        }
        console.log(steps.join('\n'))
    }
}

export function displayEndpointIndex(
    providerName: string,
    index: EndpointIndex<Provider>,
) {
    if (index.size === 0) {
        logger.warn(
            `No endpoints provisioned for ${styleText('blue', providerName)}`,
        )
        return
    }
}
