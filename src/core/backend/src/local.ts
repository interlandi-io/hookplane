import {
    describeBackend,
    type StatefileOperation,
    type BackendError,
    type StatefileData,
    NotFoundError,
    PermissionDeniedError,
    WriteRejectedError,
    UnknownError,
} from './backend.js'
import { Statefile, ProviderSet } from '@hookplane/core'
import { ResultAsync } from 'neverthrow'
import { readFile, writeFile, unlink } from 'node:fs/promises'
import { z } from 'zod'

export type LocalBackendConfig = {
    statefilePath: string
    signingSecretPath: string
    bootstrapSigningSecrets?: boolean
}

const SigningSecretFileSchema = z.object({
    data: z.record(z.string(), z.string())
})

function toBackendError(
    e: unknown,
    operation: StatefileOperation,
    path: string,
): BackendError {
    const error = e as NodeJS.ErrnoException & { kind?: string }
    if (error.kind && error.kind === 'BackendError') {
        return error as BackendError 
    }
    if (error.code === 'ENOENT') {
        return {
            kind: 'BackendError',
            name: 'NotFoundError',
            message: `file not found: ${path}`,
            while: operation,
        } satisfies NotFoundError
    }
    if (error.code === 'EACCES' || error.code === 'EPERM') {
        return {
            kind: 'BackendError',
            name: 'PermissionDeniedError',
            message: `permission denied: ${path}`,
            while: operation,
        } satisfies PermissionDeniedError
    }
    if (error.code === 'ENOSPC') {
        return {
            kind: 'BackendError',
            name: 'WriteRejectedError',
            message: 'disk full',
            while: operation,
        } satisfies WriteRejectedError
    }
    return {
        kind: 'BackendError',
        name: 'UnknownError',
        message: String(e),
        while: operation,
        cause: e,
    } satisfies UnknownError
}

async function readStatefile(
    config: LocalBackendConfig,
): Promise<StatefileData> {
    const contents = await readFile(config.statefilePath, 'utf-8')
    return JSON.parse(contents)
}

async function writeStatefile<P extends ProviderSet>(
    config: LocalBackendConfig,
    data: Statefile<P>,
): Promise<void> {
    await writeFile(config.statefilePath, JSON.stringify(data.data, null, 2), 'utf-8')
}

async function deleteStatefile(config: LocalBackendConfig): Promise<void> {
    try {
        await unlink(config.statefilePath)
    } catch (e) {
        const error = e as NodeJS.ErrnoException
        if (error.code !== 'ENOENT') {
            throw e
        }
    }
}

async function openSigningSecretFile(config: LocalBackendConfig): Promise<z.infer<typeof SigningSecretFileSchema>> {
    const contents = await readFile(config.signingSecretPath, 'utf-8')
    const secrets = SigningSecretFileSchema.safeParse(contents)
    if (!secrets.success) {
        throw {
            kind: 'BackendError',
            name: 'UnknownError',
            message: 'failed to parse signing secrets file',
            while: 'read'
        } satisfies BackendError
    }

    return secrets.data
}

async function readSigningSecret(config: LocalBackendConfig, id: string): Promise<string> {
    const secrets = await openSigningSecretFile(config)
    const secret = secrets.data[id]
    if (!secret) {
        throw {
            kind: 'BackendError',
            name: 'NotFoundError',
            message: `sigining secret with id ${id} not found`,
            while: 'read'
        } satisfies BackendError
    }

    return secret
}

async function writeSigningSecret(config: LocalBackendConfig, id: string, data: string): Promise<void> {
    const secrets = await openSigningSecretFile(config)
    secrets.data[id] = data
    await writeFile(config.signingSecretPath, JSON.stringify(secrets, null, 2), 'utf-8')
}

async function deleteSigningSecret(config: LocalBackendConfig, id: string): Promise<void> {
    const secrets = await openSigningSecretFile(config)
    delete secrets.data[id]
    await writeFile(config.signingSecretPath, JSON.stringify(secrets, null, 2), 'utf-8')
}

export const createLocalBackend =
    describeBackend<LocalBackendConfig, void>({
        name: 'local-file',
        init: async () => {},
        statefile: {
            read: ({ config }) =>
                ResultAsync.fromPromise(readStatefile(config), (e) =>
                    toBackendError(e, 'read', config.statefilePath),
                ),
            write: ({ config, data }) =>
                ResultAsync.fromPromise(writeStatefile(config, data), (e) =>
                    toBackendError(e, 'write', config.statefilePath),
                ),
            delete: ({ config }) =>
                ResultAsync.fromPromise(deleteStatefile(config), (e) =>
                    toBackendError(e, 'delete', config.statefilePath),
                ),
        },
        signingSecret: {
            read: ({ config, id }) =>
                ResultAsync.fromPromise(readSigningSecret(config, id), (e) =>
                    toBackendError(e, 'read', config.signingSecretPath),
                ),
            write: ({ config, id, data }) =>
                ResultAsync.fromPromise(writeSigningSecret(config, id, data), (e) =>
                    toBackendError(e, 'write', config.signingSecretPath),
                ),
            delete: ({ config, id }) =>
                ResultAsync.fromPromise(deleteSigningSecret(config, id), (e) =>
                    toBackendError(e, 'delete', config.signingSecretPath),
                ),
        }
    })
