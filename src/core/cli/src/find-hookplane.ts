import { Project } from 'ts-morph'
import path from 'path'
import { ok, err, Result } from 'neverthrow'

const HOOKPLANE_IMPORT_NAME = 'hookplane'
const HOOKPLANE_MODULE_SPECIFIER = 'hookplane'

export type HookplaneInstance = {
    filePath: string
    exportName: string
}

export type FindError =
    | { name: 'TSProjectError'; message: string; cause?: Error }
    | {
          name: 'MultipleInstancesError'
          message: `multiple hookplane instances found: ${string}`
      }
    | { name: 'NoInstancesError'; message: 'no hookplane instances found' }

// TODO only works if hookplane is default export but non anonymous
export function findHookplane(
    tsConfigFilePath: string,
): Result<HookplaneInstance, FindError> {
    let project
    try {
        project = new Project({
            tsConfigFilePath,
        })
    } catch (e) {
        return err({
            name: 'TSProjectError',
            message:
                e instanceof Error
                    ? e.message
                    : 'could not instantiate TS project',
            cause: e instanceof Error ? e : undefined,
        })
    }

    const instances: HookplaneInstance[] = []
    const sources = project.getSourceFiles()
    for (const source of sources) {
        const _import = source.getImportDeclaration(HOOKPLANE_MODULE_SPECIFIER)
        const hookplaneImport = _import
            ?.getNamedImports()
            .find((s) => s.getName() === HOOKPLANE_IMPORT_NAME)
        if (!hookplaneImport) {
            continue
        }
        const defaultExport = source.getDefaultExportSymbol()
        if (!defaultExport) {
            continue
        }

        const filePath = path.resolve(source.getFilePath())

        instances.push({
            filePath,
            exportName: 'default',
        })
    }

    if (instances.length > 1) {
        const formatted = instances
            .map((u) => `${u.filePath}::exports[${u.exportName}]`)
            .join('\n')
        return err({
            name: 'MultipleInstancesError',
            message: `multiple hookplane instances found: ${'\n' + formatted}`,
        })
    } else if (instances.length === 0) {
        return err({
            name: 'NoInstancesError',
            message: 'no hookplane instances found',
        })
    }

    return ok(instances[0]!)
}
