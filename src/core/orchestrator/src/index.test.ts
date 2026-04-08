import {
    BaseUrl,
    bootstrap,
    defaultDispatch,
    parallelExecution,
    relativeUrlHeuristic,
} from '@hookplane/core'
import { createOrchestrator } from './index.js'
import { createLocalFileDriver } from '@hookplane/statefile-driver'
import path from 'path'
import fs from 'fs/promises'
import os from 'os'

describe('orchestrator', () => {
    let tmpDir: string
    let statefilePath: string

    beforeAll(async () => {
        tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'orchestrator-test-'))
        statefilePath = path.join(tmpDir, Date.now().toString() + '.statefile')
        fs.writeFile(statefilePath, '')
    })

    afterAll(async () => {
        await fs.rm(tmpDir, { recursive: true, force: true })
    })

    it('runs', async () => {
        const statefileDriver = createLocalFileDriver({ path: statefilePath })
        const statefile = bootstrap('https://example.com' as BaseUrl)
        const result = await statefileDriver.write(statefile)
        if (result.isErr()) {
            throw result.error
        }

        const orchestrator = createOrchestrator({
            tsconfigPath: path.resolve(__dirname, '../test-proj/tsconfig.json'),
            execute: parallelExecution(),
            dispatch: defaultDispatch(),
            statefileDriver,
            matchingHeuristic: relativeUrlHeuristic,
        })
        console.log(await orchestrator.run({ until: 'statefile-parsed' }))
    })
})
