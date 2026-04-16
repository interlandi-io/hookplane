#!/usr/bin/node

import { defineCommand, runMain } from 'citty'
import {
    planCommand,
    configCommand,
    fetchCommand,
    pushCommand,
} from './commands/index.js'

const main = defineCommand({
    meta: { name: 'hp', version: '0.1.0', description: 'Hookplane CLI' },
    subCommands: {
        plan: planCommand,
        config: configCommand,
        fetch: fetchCommand,
        push: pushCommand,
    },
})

runMain(main)
