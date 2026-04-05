import { promises as fs } from 'node:fs'
import { relative, join } from 'node:path'
import picomatch from 'picomatch'

export type GlobParams = {
    roots: string[]
    include?: string[]
    exclude?: string[]
}

async function isDirectory(path: string): Promise<boolean> {
    try {
        const stat = await fs.stat(path)
        return stat.isDirectory()
    } catch {
        return false
    }
}

async function* walkDirectory(dir: string): AsyncGenerator<string> {
    const entries = await fs.readdir(dir, { withFileTypes: true })
    for (const entry of entries) {
        const fullPath = join(dir, entry.name)
        if (entry.isDirectory()) {
            yield* walkDirectory(fullPath)
        } else {
            yield fullPath
        }
    }
}

export async function glob(params: GlobParams): Promise<string[]> {
    const {
        roots,
        include = ['**/*.ts', '**/*.tsx'],
        exclude = [
            '**/node_modules/**',
            '**/dist/**',
            '**/build/**',
            '**/*.d.ts',
            '**/*.test.ts',
        ],
    } = params

    const includeMatcher = picomatch(include, { dot: true })
    const excludeMatcher = picomatch(exclude, { dot: true })

    const files: string[] = []

    for (const root of roots) {
        if (!(await isDirectory(root))) {
            continue
        }

        for await (const file of walkDirectory(root)) {
            const relPath = relative(process.cwd(), file)
            if (includeMatcher(relPath) && !excludeMatcher(relPath)) {
                files.push(file)
            }
        }
    }

    return files.sort()
}
