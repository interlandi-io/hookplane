import { Project, Symbol as AstSymbol } from 'ts-morph'
import { ok, err, Result } from 'neverthrow'

const HOOKPLANE_IMPORT_NAME = 'hookplane'
const HOOKPLANE_MODULE_SPECIFIER = 'hookplane'

export type Glob = {
    hookplane: HookplaneInstance
    subscriptions: SubscriptionInstance[]
}

export type HookplaneInstance = {
    filePath: string
    exportName: string
    symbol: AstSymbol
}

export type SubscriptionInstance = {
    filePath: string
    exportName: string
}

type GlobError =
    | {
          name: 'MultipleInstancesError'
          message: `multiple hookplane instances found: ${string}`
      }
    | { name: 'NoInstancesError'; message: 'no hookplane instances found' }
    | { name: 'InvalidExportSymbolError'; message: string }

export function glob(tsConfigFilePath: string): Result<Glob, GlobError> {
    const project = new Project({
        tsConfigFilePath,
    })

    const hookplane = findHookplane(project)
    if (hookplane.isErr()) {
        return err(hookplane.error)
    }

    const subscriptions = findSubscriptions(project, hookplane.value)
    if (subscriptions.isErr()) {
        return err(subscriptions.error)
    }

    return ok({
        hookplane: hookplane.value,
        subscriptions: subscriptions.value,
    })
}

// TODO only works if hookplane is default export
function findHookplane(project: Project): Result<HookplaneInstance, GlobError> {
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
        instances.push({
            filePath: source.getFilePath(),
            exportName: 'default',
            symbol: defaultExport,
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

function findSubscriptions(
    project: Project,
    hookplane: HookplaneInstance,
): Result<SubscriptionInstance[], GlobError> {
    const symbol = hookplane.symbol.getAliasedSymbol() ?? hookplane.symbol
    const decl = symbol.getValueDeclaration()
    if (!decl) {
        return err({
            name: 'InvalidExportSymbolError',
            message: 'export symbol for hookplane had no value declaration',
        } satisfies GlobError)
    }
    // eslint-disable-next-line
    const references = project.getLanguageService().findReferencesAsNodes(decl)
    const subs: SubscriptionInstance[] = []
    // TODO
    return ok(subs)
}
