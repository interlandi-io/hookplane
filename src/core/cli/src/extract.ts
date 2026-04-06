import { State } from '@hookplane/core'
import { err, ok, Result } from 'neverthrow'
import { createJiti } from 'jiti'

export type ExtractionError =
    | { name: 'ModuleError'; cause: Error }
    | { name: 'NotExportedError'; message: string; filePath: string }
    | { name: 'InvalidHookplaneInstance'; message: string; filePath: string }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function extract(
    exportName: string,
    moduleSpecifier: string,
): Promise<Result<State<any>, ExtractionError>> {
    const jiti = createJiti(import.meta.url)
    const mod = await jiti.import(moduleSpecifier)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const state = (mod as any)?.[exportName] as State<any>
    if (!state) {
        return err({
            name: 'NotExportedError',
            message: 'hookplane instance found, but not exported',
            filePath: moduleSpecifier,
        })
    }

    // Dumb schema validation heuristic
    if (!state['baseUrl'] || !state['providers'] || !state['providerStates']) {
        return err({
            name: 'InvalidHookplaneInstance',
            message: 'invalid hookplane instance',
            filePath: moduleSpecifier,
        })
    }

    return ok(state)
}
