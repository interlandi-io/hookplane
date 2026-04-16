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
    EndpointIndex,
} from '@hookplane/core'
import { extract } from './extract.js'
import { Backend } from '@hookplane/backend'
import { defineCommand, runMain } from 'citty'
import { styleText } from 'util'
import { Hookplane } from './hookplane.js'
import { findHookplane } from './find-hookplane.js'
import { Table } from 'voici.js'
import ora from 'ora'

const defaultArgs = {
    'tsconfig-path': {
        name: 'tsconfig-path',
        type: 'string',
        description: 'Path to tsconfig.json',
        default: './tsconfig.json' ,
    },
} as const

const main = defineCommand({
    meta: { name: 'hookplane', version: '0.1.0' },
    subCommands: {
        'plan': defineCommand({
            meta: {
                name: 'plan',
                description: 'Compute a plan, but do not execute it'
            },
            args: defaultArgs,
            run: async ({ args: { 'tsconfig-path': tsconfigPath } }) => {
                const { hookplane } = await getHookplane(tsconfigPath)
                const { prior, actual, desired } = await states(hookplane)
                const { syncPlan, targetPlan } = await plan(prior, actual, desired)
                console.log('\nSync Plan:')
                displayPlan(syncPlan, actual)
                console.log('\nTarget Plan:')
                displayPlan(targetPlan, actual)
            }
        }),
        'config': defineCommand({
            meta: {
                name: 'config',
                description: 'Get the current Hookplane config'
            },
            args: defaultArgs,
            run: async ({ args: { 'tsconfig-path': tsconfigPath } }) => {
                const { hookplane, filePath: hookplanePath } = await getHookplane(tsconfigPath)
                const data = [
                    { Name: 'TSConfig Path', Value: tsconfigPath, Description: 'Path to tsconfig.json' },
                    { Name: 'Hookplane Path', Value: hookplanePath, Description: 'Located Hookplane file' },
                    { Name: 'Backend', Value: hookplane.backend.name, Description: 'Hookplane backend' },
                ]
                console.log()
                new Table(data).print()
            }
        }),
        'fetch': defineCommand({
             meta: {
                name: 'fetch',
                description: 'Get a list of the currently provisioned endpoints for a provider',
            },
            args: {
                ...defaultArgs,
                'provider': {
                    name: 'provider',
                    type: 'positional',
                    description: 'The provider to fetch the endpoints from',
                    required: false,
                },
                'all': {
                    name: 'all',
                    type: 'boolean',
                    description: 'Fetch all providers',
                    default: false,
                },
            },
            run: async ({ args: { 'tsconfig-path': tsconfigPath, provider: providerName, all } }) => {
                const { hookplane } = await getHookplane(tsconfigPath)
                if (all) {
                    if ([...Object.keys(hookplane.state.providers)].length === 0) { 
                        console.log('No providers found in Hookplane instance.') 
                        return
                    }
                    for (const [name, provider] of Object.entries(hookplane.state.providers)) {
                        console.log()
                        const endpoints = await provider.indexEndpoints({ providerConfig: provider.config, providerState: provider.state })
                        displayEndpointIndex(name, endpoints._unsafeUnwrap())
                    }
                } else {
                    if (!providerName) {
                        console.error('No provider name given.')
                        console.log('See hp fetch --help for usage')
                        process.exit(1)
                    }
                    const provider = hookplane.state.providers[providerName]
                    if (!provider) {
                        console.error(`no provider found called ${providerName}`)
                        process.exit(1)
                    }
                    const endpoints = await provider.indexEndpoints({ providerConfig: provider.config, providerState: provider.state })
                    console.log()
                    displayEndpointIndex(providerName, endpoints._unsafeUnwrap())
                }
            }
        }),
    }}) 

runMain(main)

async function getHookplane(tsconfigPath: string) {
    let spinner = ora('Finding Hookplane instance').start()
    const instance = findHookplane(tsconfigPath)
    if (instance.isErr()) {
        spinner.fail()
        console.error('failed to locate hookplane instance: ', instance.error)
        process.exit(1)
    }
    spinner.succeed()
    const { exportName, filePath } = instance.value

    // console.log(`found hookplane instance at ${filePath}`)

    spinner = ora('Extracting Hookplane instance').start()
    const hookplane = await extract(exportName, filePath)
    if (hookplane.isErr()) {
        spinner.fail()
        console.error(
            'failed to extract hookplane instance from state: ',
            hookplane.error,
        )
        process.exit(1)
    }
    spinner.succeed()

    return { hookplane: hookplane.value, filePath }
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

function displayEndpointIndex(
    providerName: string,
    index: EndpointIndex<Provider>
) {
    if (index.size === 0) {
        console.log(`No endpoints provisioned for ${styleText('blue', providerName)}`)
        return
    }
}

