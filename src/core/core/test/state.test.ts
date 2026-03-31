// import { Provider } from './state'
// import { okAsync } from 'neverthrow'

// type TestProviderParams = Record<string, unknown>
// type TestProviderSubscription = object
// const TestProvider = (
//     params: TestProviderParams,
// ): Provider<
//     'testEvent',
//     TestProviderParams,
//     {
//         receiverUrl: string
//     },
//     TestProviderSubscription
// > => ({
//     name: 'Test',
//     params,
//     events: {
//         testEvent: {},
//     },
//     subscribe: (event, _, eventParams) => {
//         return okAsync({
//             event,
//             eventParams,
//         })
//     },
//     unsubscribe: () => {
//         return okAsync()
//     },
//     update: () => {
//         return okAsync()
//     },
//     listSubscriptions: () => {
//         return okAsync({})
//     },
//     getSubscription: () => {
//         return okAsync({})
//     },
//     convertSubscription: () => {
//         return {
//             event: 'testEvent',
//             eventParams: {
//                 receiverUrl: '',
//             },
//         }
//     },
// })

describe('state', () => {
    it.skip('constructs', () => {
        // const source = describeState({
        //     providers: {
        //         testProvider: TestProvider({
        //             storeUrl: 'storeurl',
        //             storeKey: 'storekey',
        //         }),
        //     },
        //     subscriptions: {
        //         testProvider: {
        //             testEvent: {
        //                 receiverUrl: 'url',
        //             },
        //         },
        //     },
        // })
        // const target: State<{
        //     testProvider: ReturnType<typeof TestProvider>
        // }> = {
        //     providers: {
        //         testProvider: TestProvider({
        //             storeUrl: 'storeurl',
        //             storeKey: 'storekey',
        //         }),
        //     },
        //     providerStates: {
        //         testProvider: {
        //             testEvent: {
        //                 receiverUrl: 'url',
        //             },
        //         },
        //     },
        // }
        // // You can't compare providers b/c Typescript :)
        // expect(source.providerStates).toEqual(target.providerStates)
    })
})
