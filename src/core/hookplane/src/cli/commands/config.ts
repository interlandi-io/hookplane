import { defineCommand } from 'citty'
import { Table } from 'voici.js'
import { getHookplane } from '../utils/index.js'
import { defaultArgs } from '../common.js'

export const configCommand = defineCommand({
    meta: {
        name: 'config',
        description: 'Get the current Hookplane config',
    },
    args: defaultArgs,
    run: async ({ args: { 'tsconfig-path': tsconfigPath } }) => {
        const { hookplane, filePath: hookplanePath } =
            await getHookplane(tsconfigPath)
        const data = [
            {
                Name: 'TSConfig Path',
                Value: tsconfigPath,
                Description: 'Path to tsconfig.json',
            },
            {
                Name: 'Hookplane Path',
                Value: hookplanePath,
                Description: 'Located Hookplane file',
            },
            {
                Name: 'Backend',
                Value: hookplane.backend.name,
                Description: 'Hookplane backend',
            },
        ]
        console.log()
        new Table(data).print()
    },
})
