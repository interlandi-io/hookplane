import ora from 'ora'
import { extract } from '../extract.js'
import { findHookplane } from '../find-hookplane.js'
import type { Hookplane } from '../../index.js'

export interface HookplaneResult {
    hookplane: Hookplane
    filePath: string
}

export async function getHookplane(
    tsconfigPath: string,
): Promise<HookplaneResult> {
    let spinner = ora('Finding Hookplane instance').start()
    const instance = findHookplane(tsconfigPath)
    if (instance.isErr()) {
        spinner.fail()
        console.error('failed to locate hookplane instance: ', instance.error)
        process.exit(1)
    }
    spinner.succeed()
    const { exportName, filePath } = instance.value

    spinner = ora('Extracting Hookplane instance').start()
    const hookplane = await extract(exportName, filePath)
    if (hookplane.isErr()) {
        spinner.fail()
        console.error(
            'failed to extract hookplane instance from state: ',
            hookplane.error,
        )
        process.exit(1)
    }
    spinner.succeed()

    return { hookplane: hookplane.value, filePath }
}
