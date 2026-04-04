import { ProviderSet } from '@hookplane/core'

export type Hookplane = {
    providers: ProviderSet
}

export type HookplaneParams = {
    providers: ProviderSet
}

export function hookplane(params: HookplaneParams): Hookplane {
    return { ...params }
}
