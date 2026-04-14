#!/usr/bin/node

import { parallelExecution, defaultDispatch, relativeUrlHeuristic } from '@hookplane/core'
import { createOrchestrator } from '@hookplane/orchestrator'
import { createLocalFileDriver } from '../../statefile-driver/dist/local.js'
import fs from 'fs/promises'
import path from 'path'
import os from 'os'

const tsconfigPath = process.argv[2]
if (!tsconfigPath) {
    console.error('no tsconfig path specified')
    process.exit(1)
}

console.log(`using tsconfig at path ${tsconfigPath}`)

const tmpdir = await fs.mkdtemp(path.join(os.tmpdir(), 'hookplane-test-'))
const tmpfile = path.join(tmpdir, 'statefile.json')
fs.writeFile(tmpfile, '')

console.log(`tmpfile created at ${tmpfile}`)

const statefileDriver = createLocalFileDriver({
    path: tmpfile,
})

const orchestrator = createOrchestrator({
    tsconfigPath,
    execute: parallelExecution(),
    dispatch: defaultDispatch(),
    statefileDriver,
    matchingHeuristic: relativeUrlHeuristic,
})

try { 
    const result = await orchestrator.run({  })
    console.log('Result: ')
    console.log(result)
} finally {
    fs.unlink(tmpfile)
    console.log(`tmpfile deleted at ${tmpfile}`)
}
