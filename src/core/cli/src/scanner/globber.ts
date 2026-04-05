import { Project, Node, SyntaxKind } from 'ts-morph'
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
    declarationNode: Node
}

export type SubscriptionInstance = {
    filePath: string
    callNode: Node
}

type GlobError =
    | {
          name: 'MultipleInstancesError'
          message: `multiple hookplane instances found: ${string}`
      }
    | { name: 'NoInstancesError'; message: 'no hookplane instances found' }

export function createGlob(tsConfigFilePath: string): Result<Glob, GlobError> {
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

// TODO only works if hookplane is default export but non anonymous
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

        const decl = defaultExport.getDeclarations()[0]
        if (!decl) {
            // TODO do something better here
            console.warn(
                `${source.getFilePath()}: Did you mean to export hookplane?`,
            )
            continue
        }

        instances.push({
            filePath: source.getFilePath(),
            exportName: 'default',
            declarationNode: decl,
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
    const references = project
        .getLanguageService()
        .findReferencesAsNodes(hookplane.declarationNode)
    const subs: SubscriptionInstance[] = []
    for (const ref of references) {
        const propAcc = ref.getParentIfKind(SyntaxKind.PropertyAccessExpression)
        const call = propAcc?.getParentIfKind(SyntaxKind.CallExpression)
        const methodName = propAcc?.getChildren()[2]?.getText()
        if (propAcc && call && methodName) {
            subs.push({
                filePath: ref.getSourceFile().getFilePath(),
                callNode: call,
            })
        }
    }

    return ok(subs)
}
