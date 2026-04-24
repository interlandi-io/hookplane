import { defineCommand } from "citty"
import { defaultArgs } from "../common.js"
import { logger } from "../logger.js"
import { getHookplane } from "../utils/get-hookplane.js"

export const bootstrapCommand = defineCommand({
    meta: {
        name: 'config',
        description: 'Get the current Hookplane config',
    },
    args: defaultArgs,
    run: async ({ args: { 'tsconfig-path': tsconfigPath } }) => {
        const hookplaneResult = await getHookplane(tsconfigPath)
        if (hookplaneResult.isErr()) {
            logger.error(hookplaneResult.error.message)
            process.exit(1)
        }
        const { hookplane } = hookplaneResult.value
        if (hookplane.backend.state){}
    },
})
