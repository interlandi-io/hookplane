export type ScanParams = {
    roots: string[]
    include?: string[]
    exclude?: string[]
}

export type SubscriptionUsage = {
    relativeUrl: string
    provider: string
    event: string
    line: number
}

export type HookplaneInstance = {
    id: string
    file: string
    line: number
    providers: string[]
    subscriptions: SubscriptionUsage[]
}

export type ProviderUsage = {
    name: string
    importedFrom: string
    usedIn: string[]
}

export type AnalyzerResults = {
    instances: HookplaneInstance[]
    providerUsage: ProviderUsage[]
    errors: string[]
}
