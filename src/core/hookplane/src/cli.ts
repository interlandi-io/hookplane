#!/usr/bin/node

import {
    parallelExecution,
    defaultDispatch,
    relativeUrlHeuristic,
} from '@hookplane/core'
import { extract } from './extract.js'
import { findHookplane } from './find-hookplane.js'
import { createOrchestrator } from '@hookplane/orchestrator'
import { createLocalBackend } from '@hookplane/backend'
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
const statefilePath = path.join(tmpdir, 'statefile.json')
const signingSecretPath = path.join(tmpdir, 'secrets.json')
fs.writeFile(statefilePath, '')
fs.writeFile(signingSecretPath, '')

console.log(`statefile created at ${statefilePath}`)
console.log(`signing secrets file created at ${statefilePath}`)

const instance = findHookplane(tsconfigPath)
if (instance.isErr()) {
    console.error('failed to locate hookplane instance: ', instance.error)
    process.exit(1)
}
const { exportName, filePath } = instance.value

console.log(`found hookplane instance at ${filePath}`)

const hookplane = await extract(exportName, filePath)
if (hookplane.isErr()) {
    console.error(
        'failed to extract hookplane instance from state: ',
        hookplane.error,
    )
    process.exit(1)
}

const { state: rightState } = hookplane.value

console.log(
    `extracted hookplane instance with providers ${rightState.providers}`,
)

const backend = await createLocalBackend({
    statefilePath,
    signingSecretPath,
})

const orchestrator = createOrchestrator({
    rightState,
    execute: parallelExecution(),
    dispatch: defaultDispatch(),
    backend,
    matchingHeuristic: relativeUrlHeuristic,
})

try {
    const result = await orchestrator.run({
        shouldBootstrap: true,
    })
    console.log('Result: ')
    console.log(result)
} finally {
    fs.unlink(statefilePath)
    fs.unlink(signingSecretPath)
    console.log(`tmpfile deleted at ${statefilePath}`)
}
