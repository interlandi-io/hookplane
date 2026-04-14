import {
    BaseUrl,
    defaultDispatch,
    parallelExecution,
    ProviderSet,
    RelativeUrl,
    relativeUrlHeuristic,
    StateUnknown,
} from '@hookplane/core'
import { stripeProvider } from '@hookplane/stripe'
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
        const rightState: StateUnknown<ProviderSet> = {
            baseUrl: 'https://example.com' as BaseUrl,
            providers: {
                stripe: await stripeProvider({
                    apiKey: process.env['STRIPE_API_KEY']!,
                })
            },
            providerStates: {
                stripe: new Set([{
                    relativeUrl: '/hooks/stripe' as RelativeUrl,
                    events: ['checkout.session.completed'],
                    config: {  }
                }])
            } 
        }

        const statefileDriver = createLocalFileDriver({ path: statefilePath })
        const orchestrator = createOrchestrator({
            rightState,
            execute: parallelExecution(),
            dispatch: defaultDispatch(),
            statefileDriver,
            matchingHeuristic: relativeUrlHeuristic,
        })
        const state = await orchestrator.run({
            shouldBootstrap: true,
        })
        console.log(state)
    }, 10_000)
})
