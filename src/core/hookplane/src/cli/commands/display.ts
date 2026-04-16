import type { Provider, ProviderSet } from '@hookplane/core'
import { State, Plan, StepId, Step, EndpointIndex } from '@hookplane/core'
import { styleText } from 'util'
import { logger } from '../logger.js'

export function displayPlan(
    plan: Plan<ProviderSet>,
    actual: State<ProviderSet>,
) {
    if (plan.isEmpty()) {
        console.log(styleText(['cyan', 'bold'], '(empty)'))
        return
    }

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
            let other: string = ''
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
                case 'update': {
                    kind = styleText('yellow', 'Update')
                    url = step.state.url
                    const indent = new Array(8).fill(' ').join('')
                    const config =
                        indent +
                        JSON.stringify(step.state.config, null, 4).replaceAll(
                            '\n',
                            '\n' + indent,
                        )
                    other = ` (${step.state.events.join(', ')})\n${config}`
                    break
                }
            }
            steps.push(
                `    ${kind} ${styleText(['blue', 'underline'], url)}${other}`,
            )
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
