#!/usr/bin/node

import {
    endpointUrlHeuristic,
    State,
    ProviderSet,
    parseStatefile,
    sync,
    createPlan,
    match,
    bootstrap,
    Plan,
    StepId,
    Step,
    Provider,
} from '@hookplane/core'
import { extract } from './extract.js'
import { Backend } from '@hookplane/backend'
import { defineCommand, runMain } from 'citty'
import { styleText } from 'util'
import { Hookplane } from './hookplane.js'
import { findHookplane } from './find-hookplane.js'

const main = defineCommand({
    meta: { name: 'hookplane', version: '0.1.0' },
    subCommands: {
        'plan': defineCommand({
            meta: {
                name: 'plan',
                description: 'Compute a plan, but do not execute it'
            },
            args: {
                'tsconfig-path': {
                    name: 'tsconfig-path',
                    type: 'string',
                    description: 'Path to tsconfig.json',
                    default: './tsconfig.json' ,
                },
            },
            run: async ({ args: { 'tsconfig-path': tsconfigPath } }) => {
                const hookplane = await getHookplane(tsconfigPath)
                const { prior, actual, desired } = await states(hookplane)
                const { syncPlan, targetPlan } = await plan(prior, actual, desired)
                console.log('\nSync Plan:')
                displayPlan(syncPlan, actual)
                console.log('\nTarget Plan:')
                displayPlan(targetPlan, actual)
            }
        })
    }}) 

runMain(main)

async function getHookplane(tsconfigPath: string) {
    const instance = findHookplane(tsconfigPath)
    if (instance.isErr()) {
        console.error('failed to locate hookplane instance: ', instance.error)
        process.exit(1)
    }
    const { exportName, filePath } = instance.value

    // console.log(`found hookplane instance at ${filePath}`)

    const hookplane = await extract(exportName, filePath)
    if (hookplane.isErr()) {
        console.error(
            'failed to extract hookplane instance from state: ',
            hookplane.error,
        )
        process.exit(1)
    }

    return hookplane.value
}

async function states(hookplane: Hookplane) {
    const backend = hookplane.backend
    const bootstrapContent = bootstrap()
    await backend.statefile.write(bootstrapContent).then(r => r._unsafeUnwrap())

    const desiredUnknown = hookplane.state

    const prior = await getPrior(backend, desiredUnknown.providers)
    const actual = await getActual(desiredUnknown.providers)
    const desired = match(endpointUrlHeuristic, desiredUnknown, actual)._unsafeUnwrap()

    return { prior, actual, desired }
}

async function plan(
    prior: State<ProviderSet>,
    actual: State<ProviderSet>,
    desired: State<ProviderSet>,
) {
    // console.log(
    //     'extracted hookplane instance with the following providers:\n' + 
    //     Object.keys(hookplane.state.providers)
    //         .map((p) => ` - ${p}`)
    //         .join('\n')
    // )
    const syncPlan = createPlan(prior, actual)._unsafeUnwrap()
    const targetPlan = createPlan(actual, desired)._unsafeUnwrap()

    return { syncPlan, targetPlan }
}

async function getPrior<P extends ProviderSet>(backend: Backend, providers: P): Promise<State<P>> {
    const data = await backend.statefile.read()
    if (data.isErr()) {
        console.error('failed to read state file from backend: ', data.error.message)
        process.exit(1)
    }
    const statefile = parseStatefile(data.value, providers)
    if (statefile.isErr()) {
        console.error('failed to parse statefile from backend: ', statefile.error.message)
        process.exit(1)
    }
    const prior = statefile.value.toState()
    if (prior.isErr()) {
        console.error('failed to deserialize statefile from backend: ', prior.error.message)
        process.exit(1)
    }

    return prior.value
}

async function getActual<P extends ProviderSet>(providers: P): Promise<State<P>> {
    const actual = await sync(providers)
    if (actual.isErr()) {
        console.error(actual.error.message)
        process.exit(1)
    }
    return actual.value
}

function displayPlan(plan: Plan<ProviderSet>, actual: State<ProviderSet>) {
    for (const e of Object.entries(plan.providerPlans)) {
        const [providerName, providerPlan] = e as [string, Map<StepId, Step<Provider>>]
        console.log(styleText(['bold', 'blue'], providerName))
        const steps: string[] = []
        for (const step of providerPlan.values()) {
            let kind: string
            let url: string
            switch (step.kind) {
                case 'create':
                    kind = styleText('green', 'Create')
                    url = step.state.url
                    break
                case 'delete':
                    kind = styleText('red', 'Delete')
                    url = actual.providerStates[providerName]?.get(step.handle)?.url || ''
                    break
                case 'update':
                    kind = styleText('yellow', 'Update')
                    url = step.state.url
                    break
            } 
            steps.push(`    ${kind} ${styleText(['blue', 'underline'], url)}`)
        }
        console.log(steps.join('\n'))
    }
}
