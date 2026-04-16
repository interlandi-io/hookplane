#!/usr/bin/node

import type { Provider, ProviderSet } from '@hookplane/core'
import { State, Plan, StepId, Step, EndpointIndex } from '@hookplane/core'
import { defineCommand, runMain } from 'citty'
import { styleText } from 'util'
import { getHookplane, states, plan, execute } from './utils/index.js'
import { Table } from 'voici.js'

const defaultArgs = {
    'tsconfig-path': {
        name: 'tsconfig-path',
        type: 'string',
        description: 'Path to tsconfig.json',
        default: './tsconfig.json',
    },
} as const

const main = defineCommand({
    meta: { name: 'hp', version: '0.1.0', description: 'Hookplane CLI' },
    subCommands: {
        plan: defineCommand({
            meta: {
                name: 'plan',
                description: 'Compute a plan, but do not execute it',
            },
            args: defaultArgs,
            run: async ({ args: { 'tsconfig-path': tsconfigPath } }) => {
                const { hookplane } = await getHookplane(tsconfigPath)
                const { prior, actual, desired } = await states(hookplane)
                const { syncPlan, targetPlan } = await plan(
                    prior,
                    actual,
                    desired,
                )
                console.log('\nSync Plan:')
                displayPlan(syncPlan, actual)
                console.log('\nTarget Plan:')
                displayPlan(targetPlan, actual)
            },
        }),
        config: defineCommand({
            meta: {
                name: 'config',
                description: 'Get the current Hookplane config',
            },
            args: defaultArgs,
            run: async ({ args: { 'tsconfig-path': tsconfigPath } }) => {
                const { hookplane, filePath: hookplanePath } =
                    await getHookplane(tsconfigPath)
                const data = [
                    {
                        Name: 'TSConfig Path',
                        Value: tsconfigPath,
                        Description: 'Path to tsconfig.json',
                    },
                    {
                        Name: 'Hookplane Path',
                        Value: hookplanePath,
                        Description: 'Located Hookplane file',
                    },
                    {
                        Name: 'Backend',
                        Value: hookplane.backend.name,
                        Description: 'Hookplane backend',
                    },
                ]
                console.log()
                new Table(data).print()
            },
        }),
        fetch: defineCommand({
            meta: {
                name: 'fetch',
                description:
                    'Get a list of the currently provisioned endpoints for a provider',
            },
            args: {
                ...defaultArgs,
                provider: {
                    name: 'provider',
                    type: 'positional',
                    description: 'The provider to fetch the endpoints from',
                    required: false,
                },
                all: {
                    name: 'all',
                    type: 'boolean',
                    description: 'Fetch all providers',
                    default: false,
                },
            },
            run: async ({
                args: {
                    'tsconfig-path': tsconfigPath,
                    provider: providerName,
                    all,
                },
            }) => {
                const { hookplane } = await getHookplane(tsconfigPath)
                if (all) {
                    if (
                        [...Object.keys(hookplane.state.providers)].length === 0
                    ) {
                        console.log('No providers found in Hookplane instance.')
                        return
                    }
                    for (const [name, provider] of Object.entries(
                        hookplane.state.providers,
                    ) as [string, ProviderSet[keyof ProviderSet]][]) {
                        console.log()
                        const endpoints = await provider.indexEndpoints({
                            providerConfig: provider.config,
                            providerState: provider.state,
                        })
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
                        console.error(
                            `no provider found called ${providerName}`,
                        )
                        process.exit(1)
                    }
                    const endpoints = await provider.indexEndpoints({
                        providerConfig: provider.config,
                        providerState: provider.state,
                    })
                    console.log()
                    displayEndpointIndex(
                        providerName,
                        endpoints._unsafeUnwrap(),
                    )
                }
            },
        }),
        push: defineCommand({
            meta: {
                name: 'push',
                description: 'Push your Hookplane config to providers',
            },
            args: {
                ...defaultArgs,
                'dry-run': {
                    name: 'dry-run',
                    type: 'boolean',
                    description: 'Equilvalent to hp plan',
                    default: false,
                },
            },
            run: async ({
                args: { 'tsconfig-path': tsconfigPath, 'dry-run': dryRun },
            }) => {
                const { hookplane } = await getHookplane(tsconfigPath)
                const { prior, actual, desired } = await states(hookplane)
                const { syncPlan, targetPlan } = await plan(
                    prior,
                    actual,
                    desired,
                )
                if (!syncPlan.isEmpty()) {
                    console.warn(styleText('yellow', 'Drift detected'))
                    console.error('Unable to continue')
                    // TODO
                    return
                }
                await execute(targetPlan)
            },
        }),
    },
})

runMain(main)

function displayPlan(plan: Plan<ProviderSet>, actual: State<ProviderSet>) {
    for (const e of Object.entries(plan.providerPlans)) {
        const [providerName, providerPlan] = e as [
            string,
            Map<StepId, Step<Provider>>,
        ]
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
                    url =
                        actual.providerStates[providerName]?.get(step.handle)
                            ?.url || ''
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
    index: EndpointIndex<Provider>,
) {
    if (index.size === 0) {
        console.log(
            `No endpoints provisioned for ${styleText('blue', providerName)}`,
        )
        return
    }
}
