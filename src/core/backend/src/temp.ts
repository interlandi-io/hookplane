import fs from 'fs/promises'
import { rmSync } from 'fs'
import path from 'path'
import os from 'os'
import { createLocalBackend } from './local.js'

export async function createTempBackend() {
    const tmpdir = await fs.mkdtemp(path.join(os.tmpdir(), 'hookplane-test-'))
    const statefilePath = path.join(tmpdir, 'statefile.json')
    const signingSecretPath = path.join(tmpdir, 'secrets.json')
    await fs.writeFile(statefilePath, '')
    await fs.writeFile(signingSecretPath, '')

    const teardown = async () => {
        rmSync(tmpdir, {
            recursive: true,
            force: true,
        })
    }

    process.on('SIGINT', teardown)
    process.on('SIGTERM', teardown)
    process.on('beforeExit', teardown)

    const backend = await createLocalBackend({
        statefilePath,
        signingSecretPath,
    })

    return backend
}
