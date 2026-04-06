import { State } from '@hookplane/core'
import { FindError, findHookplane } from './find-hookplane.js'
import { err, ok, Result } from 'neverthrow'

export type ExtractionError =
    | { name: 'FindError'; message: string; cause: FindError }
    | { name: 'ErrorInsideModule'; cause: Error }
    | { name: 'NotExportedError'; message: string; filePath: string }
    | { name: 'InvalidHookplaneInstance'; message: string; filePath: string }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function extract(
    tsconfigFilepath: string,
): Promise<Result<State<any>, ExtractionError>> {
    const instance = findHookplane(tsconfigFilepath)
    if (instance.isErr()) {
        return err({
            name: 'FindError',
            message: instance.error.message,
            cause: instance.error,
        })
    }

    let mod
    try {
        mod = await import(instance.value.filePath)
    } catch (e) {
        return err({
            name: 'ErrorInsideModule',
            cause: e instanceof Error ? e : new Error(e as string),
        })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const state = mod[instance.value.exportName] as State<any>
    if (!state) {
        return err({
            name: 'NotExportedError',
            message: 'hookplane instance found, but not exported',
            filePath: instance.value.filePath,
        })
    }

    // Dumb schema validation heuristic
    if (!state['baseUrl'] || !state['providers'] || !state['providerStates']) {
        return err({
            name: 'NotExportedError',
            message: 'hookplane instance found, but not exported',
            filePath: instance.value.filePath,
        })
    }

    return ok(state)
}
