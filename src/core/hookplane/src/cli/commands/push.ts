import { defineCommand } from 'citty'
import { getHookplane, states, plan, execute } from '../utils/index.js'
import { logger } from '../logger.js'
import { defaultArgs } from '../common.js'

export const pushCommand = defineCommand({
    meta: {
        name: 'push',
        description: 'Push your Hookplane config to providers',
    },
    args: {
        ...defaultArgs,
        // 'dry-run': {
        //     name: 'dry-run',
        //     type: 'boolean',
        //     description: 'Equilvalent to hp plan',
        //     default: false,
        // },
    },
    run: async ({
        args: { 'tsconfig-path': tsconfigPath },
    }) => {
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

        if (!syncPlan.isEmpty()) {
            logger.warn('Drift detected')
            logger.error('Unable to continue')
            return
        }

        const executeResult = await execute(targetPlan)
        if (executeResult.isErr()) {
            logger.error(executeResult.error.message)
            process.exit(1)
        }
    },
})
