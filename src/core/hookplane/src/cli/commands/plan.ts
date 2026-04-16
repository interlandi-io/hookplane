import { defineCommand } from 'citty'
import { getHookplane, states, plan } from '../utils/index.js'
import { defaultArgs } from '../common.js'
import { displayPlan } from './display.js'

export const planCommand = defineCommand({
    meta: {
        name: 'plan',
        description: 'Compute a plan, but do not execute it',
    },
    args: defaultArgs,
    run: async ({ args: { 'tsconfig-path': tsconfigPath } }) => {
        const { hookplane } = await getHookplane(tsconfigPath)
        const { prior, actual, desired } = await states(hookplane)
        const { syncPlan, targetPlan } = await plan(prior, actual, desired)
        console.log('\nSync Plan:')
        displayPlan(syncPlan, actual)
        console.log('\nTarget Plan:')
        displayPlan(targetPlan, actual)
    },
})
