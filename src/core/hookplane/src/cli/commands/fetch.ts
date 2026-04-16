import type { ProviderSet } from '@hookplane/core'
import { defineCommand } from 'citty'
import { getHookplane } from '../utils/index.js'
import { displayEndpointIndex } from './display.js'
import { defaultArgs } from '../common.js'

export const fetchCommand = defineCommand({
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
        args: { 'tsconfig-path': tsconfigPath, provider: providerName, all },
    }) => {
        const { hookplane } = await getHookplane(tsconfigPath)
        if (all) {
            if ([...Object.keys(hookplane.state.providers)].length === 0) {
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
                console.error(`no provider found called ${providerName}`)
                process.exit(1)
            }
            const endpoints = await provider.indexEndpoints({
                providerConfig: provider.config,
                providerState: provider.state,
            })
            console.log()
            displayEndpointIndex(providerName, endpoints._unsafeUnwrap())
        }
    },
})
