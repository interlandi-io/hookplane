import { defineCommand } from 'citty'
import { getHookplane, states, plan } from '../utils/index.js'
import { logger } from '../logger.js'
import { defaultArgs } from '../common.js'
import { displayPlan } from './display.js'

export const planCommand = defineCommand({
    meta: {
        name: 'plan',
        description: 'Compute a plan, but do not execute it',
    },
    args: defaultArgs,
    run: async ({ args: { 'tsconfig-path': tsconfigPath } }) => {
        const hookplaneResult = await getHookplane(tsconfigPath)
        if (hookplaneResult.isErr()) {
            logger.error(hookplaneResult.error.message)
            process.exit(1)
        }
        const { hookplane } = hookplaneResult.value

        const statesResult = await states(hookplane)
        if (statesResult.isErr()) {
            logger.error(statesResult.error.message)
            process.exit(1)
        }
        const { prior, actual, desired } = statesResult.value

        const planResult = await plan(prior, actual, desired)
        if (planResult.isErr()) {
            logger.error(planResult.error.message)
            process.exit(1)
        }
        const { syncPlan, targetPlan } = planResult.value

        console.log('\nSync Plan:')
        displayPlan(syncPlan, actual)
        console.log('\nTarget Plan:')
        displayPlan(targetPlan, actual)
    },
})
