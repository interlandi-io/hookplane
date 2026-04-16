import { err, ok, Result } from 'neverthrow'
import { createJiti } from 'jiti'
import { Hookplane } from '../hookplane.js'
import z from 'zod'

const HookplaneSchemaApprox: z.ZodType<Hookplane> = z.object({
    state: z.object({
        providers: z.object(),
        providerStates: z.object(),
    }),
    backend: z.any(),
})

export type ExtractionError =
    | { name: 'ModuleError'; cause: Error }
    | { name: 'NotExportedError'; message: string; filePath: string }
    | { name: 'InvalidHookplaneInstance'; message: string; filePath: string }

/**
 * Extracts a Hookplane `State` export from the specified module and verifies it has minimal expected fields.
 *
 * @param exportName - The exported identifier to read from the module.
 * @param moduleSpecifier - The module path or specifier to import.
 * @returns A `Result` containing the extracted `State` on success, or an `ExtractionError` describing why extraction failed (missing export or missing required fields `providers` or `providerStates`).
 */
export async function extract(
    exportName: string,
    moduleSpecifier: string,
): Promise<Result<Hookplane, ExtractionError>> {
    const jiti = createJiti(import.meta.url)

    let mod
    try {
        mod = await jiti.import(moduleSpecifier)
    } catch (e) {
        return err({
            name: 'ModuleError',
            cause: e instanceof Error ? e : new Error(JSON.stringify(e)),
        })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const hookplane = (mod as any)?.[exportName] as Hookplane
    if (!hookplane) {
        return err({
            name: 'NotExportedError',
            message: 'hookplane instance found, but not exported',
            filePath: moduleSpecifier,
        })
    }

    const result = HookplaneSchemaApprox.safeParse(hookplane)
    if (!result.success) {
        return err({
            name: 'InvalidHookplaneInstance',
            message: 'invalid hookplane instance: ' + result.error.message,
            source: result.error,
            filePath: moduleSpecifier,
        })
    }

    return ok(hookplane)
}
