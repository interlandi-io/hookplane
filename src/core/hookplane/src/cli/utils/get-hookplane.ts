import { err, ok, Result } from 'neverthrow'
import { extract } from '../extract.js'
import { findHookplane } from '../find-hookplane.js'
import type { HookplaneInstance } from '../find-hookplane.js'
import { withSpinner } from '../logger.js'
import type { Hookplane } from '../../index.js'

export interface HookplaneResult {
    hookplane: Hookplane
    filePath: string
}

export async function getHookplane(
    tsconfigPath: string,
): Promise<Result<HookplaneResult, Error>> {
    const instance = await withSpinner(
        'Finding Hookplane instance',
        async () => {
            const result = findHookplane(tsconfigPath)
            return result.mapErr((e) => e as Error)
        },
    )
    if (instance.isErr()) {
        return err(new Error('failed to locate hookplane instance'))
    }
    const { exportName, filePath } = instance.value as HookplaneInstance

    const hookplane = await withSpinner(
        'Extracting Hookplane instance',
        async () => {
            const result = await extract(exportName, filePath)
            return result.mapErr((e) => e as Error)
        },
    )
    if (hookplane.isErr()) {
        return err(new Error('failed to extract hookplane instance'))
    }

    return ok({ hookplane: hookplane.value, filePath })
}
