#!/usr/bin/node

import { defineCommand, runMain } from 'citty'
import {
    planCommand,
    configCommand,
    fetchCommand,
    pushCommand,
} from './commands/index.js'
import { initLogger } from './logger.js'
import { loadEnv } from './utils/index.js'
import { bootstrapCommand } from './commands/bootstrap.js'

const main = defineCommand({
    meta: { name: 'hp', version: '0.1.0', description: 'Hookplane CLI' },
    args: {
        verbose: {
            name: 'verbose',
            type: 'boolean',
            description: 'Enable debug log level',
            default: false,
        },
        'env-file': {
            name: 'env-file',
            type: 'string',
            description: 'Path to .env file',
            required: false,
        },
    },
    subCommands: {
        plan: planCommand,
        config: configCommand,
        bootstrap: bootstrapCommand,
        fetch: fetchCommand,
        push: pushCommand,
    },
    setup: async ({ args }) => {
        initLogger({ debug: args.verbose })
        loadEnv(args['env-file'])
    },
})

runMain(main)
