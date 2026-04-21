import {
    describeBackend,
    type BackendError,
    NotFoundError,
    PermissionDeniedError,
    WriteRejectedError,
    InternalError,
    ProviderNotFoundError,
    UnknownError,
    BackendOperation,
} from './backend.js'
import {
    parseStatefile,
    fromState,
    StatefileError,
    type ProviderNotFoundError as StatefileProviderNotFoundError,
} from '@hookplane/core'
import { ResultAsync } from 'neverthrow'
import { readFile, writeFile, unlink } from 'node:fs/promises'
import { z } from 'zod'

export type LocalBackendConfig = {
    statefilePath: string
    signingSecretPath: string
}

const SigningSecretFileSchema = z.object({
    data: z.record(z.string(), z.string()),
})

function toBackendError(
    e: unknown,
    operation: BackendOperation,
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
    if (e instanceof SyntaxError) {
        return {
            kind: 'BackendError',
            name: 'InternalError',
            message: `invalid JSON: ${e.message}`,
            while: operation,
            cause: e,
        } satisfies InternalError
    }
    return {
        kind: 'BackendError',
        name: 'UnknownError',
        message: String(e),
        while: operation,
        cause: e,
    } satisfies UnknownError
}

function statefileErrorToBackendError(error: StatefileError): BackendError {
    if (error.name === 'ProviderNotFoundError') {
        return {
            kind: 'BackendError',
            name: 'ProviderNotFoundError',
            message: error.message,
            while: 'read',
            provider: (error as StatefileProviderNotFoundError).provider,
        } satisfies ProviderNotFoundError
    }
    return {
        kind: 'BackendError',
        name: 'InternalError',
        message: error.message,
        while: 'read',
        cause: error,
    } satisfies InternalError
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

async function openSigningSecretFile(
    config: LocalBackendConfig,
): Promise<z.infer<typeof SigningSecretFileSchema>> {
    const contents = await readFile(config.signingSecretPath, 'utf-8')
    const secrets = SigningSecretFileSchema.safeParse(JSON.parse(contents))
    if (!secrets.success) {
        throw {
            kind: 'BackendError',
            name: 'UnknownError',
            message: 'failed to parse signing secrets file',
            while: 'read',
        } satisfies BackendError
    }

    return secrets.data
}

async function readSigningSecret(
    config: LocalBackendConfig,
    id: string,
): Promise<string> {
    const secrets = await openSigningSecretFile(config)
    const secret = secrets.data[id]
    if (!secret) {
        throw {
            kind: 'BackendError',
            name: 'NotFoundError',
            message: `sigining secret with id ${id} not found`,
            while: 'read',
        } satisfies BackendError
    }

    return secret
}

async function writeSigningSecret(
    config: LocalBackendConfig,
    id: string,
    data: string,
): Promise<void> {
    let secrets: z.infer<typeof SigningSecretFileSchema>
    try {
        secrets = await openSigningSecretFile(config)
    } catch (e) {
        const error = e as NodeJS.ErrnoException
        if (error.code === 'ENOENT') {
            secrets = { data: {} }
        } else {
            throw e
        }
    }
    secrets.data[id] = data
    await writeFile(
        config.signingSecretPath,
        JSON.stringify(secrets, null, 2),
        'utf-8',
    )
}

async function deleteSigningSecret(
    config: LocalBackendConfig,
    id: string,
): Promise<void> {
    const secrets = await openSigningSecretFile(config)
    delete secrets.data[id]
    await writeFile(
        config.signingSecretPath,
        JSON.stringify(secrets, null, 2),
        'utf-8',
    )
}

export const createLocalBackend = describeBackend<LocalBackendConfig, void, 'snapshot'>({
    name: 'local-file',
    state: {
        writeMode: 'snapshot',
        read: ({ config, providers }) =>
            ResultAsync.fromPromise(
                (async () => {
                    const contents = await readFile(
                        config.statefilePath,
                        'utf-8',
                    )
                    const parsed = JSON.parse(contents)
                    const statefileResult = parseStatefile(parsed, providers)
                    if (statefileResult.isErr()) {
                        throw statefileErrorToBackendError(
                            statefileResult.error,
                        )
                    }
                    const stateResult = statefileResult.value.toState()
                    if (stateResult.isErr()) {
                        throw statefileErrorToBackendError(stateResult.error)
                    }
                    return stateResult.value
                })(),
                (e) => toBackendError(e, 'read', config.statefilePath),
            ),
        write: ({ config, data }) =>
            ResultAsync.fromPromise(
                (async () => {
                    const statefile = fromState(1, data)
                    await writeFile(
                        config.statefilePath,
                        JSON.stringify(statefile.data, null, 2),
                        'utf-8',
                    )
                })(),
                (e) => toBackendError(e, 'write', config.statefilePath),
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
    },
})
