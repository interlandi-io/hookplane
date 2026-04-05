import { err } from 'neverthrow'
import { createGlob } from './globber.js'
import { createRunner } from './runner.js'
import path from 'path'
import { Hookplane } from 'hookplane'

export async function scan(tsconfigPath: string) {
    const result = createGlob(tsconfigPath)
    if (result.isErr()) {
        return err(result.error)
    }

    const { hookplane, subscriptions } = result.value
    // TODO: only works if they're called the same thing
    const code = `
${hookplane.declarationNode.getSourceFile().getFullText()}
${subscriptions.map((sub) => sub.callNode.getFullText()).join('\n')}
    `

    const wd = path.dirname(hookplane.filePath)
    const runner = createRunner<{ default: Hookplane<any> }>(code, wd)
    await runner.run()
    console.log(runner.err())
    console.log(runner.mod().default)
}
