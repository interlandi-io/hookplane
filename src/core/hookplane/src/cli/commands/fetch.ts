import type { ProviderSet } from '@hookplane/core'
import { defineCommand } from 'citty'
import { getHookplane } from '../utils/index.js'
import { logger } from '../logger.js'
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
        const hookplaneResult = await getHookplane(tsconfigPath)
        if (hookplaneResult.isErr()) {
            logger.error(hookplaneResult.error.message)
            process.exit(1)
        }
        const { hookplane } = hookplaneResult.value
        if (all) {
            if ([...Object.keys(hookplane.state.providers)].length === 0) {
                logger.warn('No providers found in Hookplane instance.')
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
                if (endpoints.isErr()) {
                    logger.error(
                        `failed to fetch endpoints for ${name}: ${endpoints.error.message}`,
                    )
                    continue
                }
                displayEndpointIndex(name, endpoints.value)
            }
        } else {
            if (!providerName) {
                logger.error('No provider name given.')
                logger.info('See hp fetch --help for usage')
                process.exit(1)
            }
            const provider = hookplane.state.providers[providerName]
            if (!provider) {
                logger.error(`no provider found called ${providerName}`)
                process.exit(1)
            }
            const endpoints = await provider.indexEndpoints({
                providerConfig: provider.config,
                providerState: provider.state,
            })
            if (endpoints.isErr()) {
                logger.error(
                    `failed to fetch endpoints: ${endpoints.error.message}`,
                )
                process.exit(1)
            }
            console.log()
            displayEndpointIndex(providerName, endpoints.value)
        }
    },
})
