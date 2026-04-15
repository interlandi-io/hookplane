import {
    defaultDispatch,
    parallelExecution,
    ProviderSet,
    endpointUrlHeuristic,
    StateUnknown,
} from '@hookplane/core'
import { stripeProvider } from '@hookplane/stripe'
import { createOrchestrator } from './index.js'
import { createLocalBackend } from '@hookplane/backend'
import path from 'path'
import fs from 'fs/promises'
import os from 'os'

describe('orchestrator', () => {
    let tmpDir: string
    let statefilePath: string
    let signingSecretPath: string

    beforeAll(async () => {
        tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'orchestrator-test-'))
        statefilePath = path.join(tmpDir, Date.now().toString() + '.statefile')
        signingSecretPath = path.join(
            tmpDir,
            Date.now().toString() + '.secrets',
        )
        fs.writeFile(statefilePath, '')
    })

    afterAll(async () => {
        await fs.rm(tmpDir, { recursive: true, force: true })
    })

    it.skip('runs', async () => {
        const rightState: StateUnknown<ProviderSet> = {
            providers: {
                stripe: await stripeProvider({
                    apiKey: process.env['STRIPE_API_KEY']!,
                }),
            },
            providerStates: {
                stripe: new Set([
                    {
                        url: 'https://example.com/hooks/stripe',
                        events: ['checkout.session.completed'],
                        config: {
                            name: 'my_endpoint',
                            eventPayload: 'snapshot',
                        },
                    },
                ]),
            },
        }

        const backend = await createLocalBackend({
            statefilePath,
            signingSecretPath,
        })
        const orchestrator = createOrchestrator({
            rightState,
            execute: parallelExecution(),
            dispatch: defaultDispatch(),
            backend,
            matchingHeuristic: endpointUrlHeuristic,
        })
        const state = await orchestrator.run({
            shouldBootstrap: true,
        })
        console.log(state)
        if (state.tag === 'failed' && state.error.last === 'executable') {
            const err = state.error.error
            for (const [, stepState] of err) {
                if (stepState.status === 'failure') {
                    console.log(stepState.error)
                }
            }
        }
    }, 10_000)
})
