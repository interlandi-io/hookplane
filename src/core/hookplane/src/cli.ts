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
} from '@hookplane/core'
import { extract } from './extract.js'
import { findHookplane } from './find-hookplane.js'
import { Backend, createLocalBackend } from '@hookplane/backend'
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
await fs.writeFile(statefilePath, '')
await fs.writeFile(signingSecretPath, '')

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

console.log(
    'extracted hookplane instance with the following providers:\n' + 
    Object.keys(hookplane.value.state.providers)
        .map((p) => ` - ${p}`)
        .join('\n')
)

const backend = await createLocalBackend({
    statefilePath,
    signingSecretPath,
})
const bootstrapContent = bootstrap()
await backend.statefile.write(bootstrapContent).then(r => r._unsafeUnwrap())

const desiredUnknown = hookplane.value.state

const prior = await getPrior(backend, desiredUnknown.providers)
const actual = await getActual(desiredUnknown.providers)
const desired = match(endpointUrlHeuristic, desiredUnknown, actual)._unsafeUnwrap()

const syncPlan = createPlan(prior, actual)
const targetPlan = createPlan(actual, desired)

console.log(syncPlan)
console.log(targetPlan)


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

await fs.unlink(statefilePath)
await fs.unlink(signingSecretPath)
