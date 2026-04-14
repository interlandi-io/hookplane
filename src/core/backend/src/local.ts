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

export type LocalFileDriverConfig = {
    path: string
}

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
    config: LocalFileDriverConfig,
): Promise<StatefileData> {
    const contents = await readFile(config.path, 'utf-8')
    return JSON.parse(contents)
}

async function writeStatefile<P extends ProviderSet>(
    config: LocalFileDriverConfig,
    data: Statefile<P>,
): Promise<void> {
    await writeFile(config.path, JSON.stringify(data.data, null, 2), 'utf-8')
}

async function deleteStatefile(config: LocalFileDriverConfig): Promise<void> {
    try {
        await unlink(config.path)
    } catch (e) {
        const error = e as NodeJS.ErrnoException
        if (error.code !== 'ENOENT') {
            throw e
        }
    }
}

export const createLocalFileDriver =
    describeBackend<LocalFileDriverConfig>({
        name: 'local-file',
        read: ({ config }) =>
            ResultAsync.fromPromise(readStatefile(config), (e) =>
                toBackendError(e, 'read', config.path),
            ),
        write: ({ config, data }) =>
            ResultAsync.fromPromise(writeStatefile(config, data), (e) =>
                toBackendError(e, 'write', config.path),
            ),
        delete: ({ config }) =>
            ResultAsync.fromPromise(deleteStatefile(config), (e) =>
                toBackendError(e, 'delete', config.path),
            ),
    })
