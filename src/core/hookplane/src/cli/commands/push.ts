import { defineCommand } from 'citty'
import { styleText } from 'util'
import { getHookplane, states, plan, execute } from '../utils/index.js'
import { defaultArgs } from '../common.js'

export const pushCommand = defineCommand({
    meta: {
        name: 'push',
        description: 'Push your Hookplane config to providers',
    },
    args: {
        ...defaultArgs,
        'dry-run': {
            name: 'dry-run',
            type: 'boolean',
            description: 'Equilvalent to hp plan',
            default: false,
        },
    },
    run: async ({
        args: { 'tsconfig-path': tsconfigPath, 'dry-run': dryRun },
    }) => {
        const { hookplane } = await getHookplane(tsconfigPath)
        const { prior, actual, desired } = await states(hookplane)
        const { syncPlan, targetPlan } = await plan(prior, actual, desired)
        if (!syncPlan.isEmpty()) {
            console.warn(styleText('yellow', 'Drift detected'))
            console.error('Unable to continue')
            return
        }
        await execute(targetPlan)
    },
})
