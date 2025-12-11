# State Management di Bifold Wallet Core

Dokumentasi lengkap tentang arsitektur state management yang digunakan di `packages/core`.

## Ringkasan

Bifold Wallet menggunakan kombinasi beberapa pendekatan untuk mengelola state:

1. **React Context + useReducer** - State management utama (mirip Redux pattern)
2. **AsyncStorage** - Persistensi data lokal
3. **Dependency Injection (DI)** - Menggunakan `tsyringe` untuk service container
4. **React Keychain** - Penyimpanan data sensitif (PIN, wallet secrets)

---

## 1. Global State dengan Context + useReducer

### Lokasi File Utama
```
packages/core/src/contexts/
├── store.tsx           # StoreProvider & useStore hook
├── reducers/
│   ├── store.ts        # Reducer utama & DispatchAction
│   └── index.ts
└── index.ts
```

### State Interface

State global didefinisikan di `packages/core/src/types/state.ts`:

```typescript
export interface State {
  stateLoaded: boolean
  onboarding: Onboarding
  authentication: Authentication
  lockout: Lockout
  loginAttempt: LoginAttempt
  preferences: Preferences
  tours: Tours
  deepLink?: string
  migration: Migration
  versionInfo: VersionInfo
}
```

### Sub-State Breakdown

#### Onboarding State
```typescript
interface Onboarding {
  didSeePreface: boolean
  didCompleteTutorial: boolean
  didAgreeToTerms: boolean | string
  didCreatePIN: boolean
  didConsiderBiometry: boolean
  didConsiderPushNotifications: boolean
  didNameWallet: boolean
  onboardingVersion: number
  didCompleteOnboarding: boolean
}
```

#### Preferences State
```typescript
interface Preferences {
  useBiometry: boolean
  usePushNotifications: boolean
  biometryPreferencesUpdated: boolean
  developerModeEnabled: boolean
  useVerifierCapability?: boolean
  useConnectionInviterCapability?: boolean
  useDevVerifierTemplates?: boolean
  enableWalletNaming: boolean
  walletName: string
  acceptDevCredentials: boolean
  useDataRetention: boolean
  preventAutoLock: boolean
  enableShareableLink: boolean
  alternateContactNames: Record<string, string>
  autoLockTime: number
  theme?: string
  selectedMediator: string
  availableMediators: string[]
  bannerMessages: BannerMessage[]
  genericErrorMessages: boolean
}
```

#### Authentication & Security States
```typescript
interface Authentication {
  didAuthenticate: boolean
}

interface Lockout {
  displayNotification: boolean
}

interface LoginAttempt {
  lockoutDate?: number
  servedPenalty: boolean
  loginAttempts: number
}

interface Migration {
  didMigrateToAskar: boolean
}
```

#### Tours State
```typescript
interface Tours {
  seenToursPrompt: boolean
  enableTours: boolean
  seenHomeTour: boolean
  seenCredentialsTour: boolean
  seenCredentialOfferTour: boolean
  seenProofRequestTour: boolean
}
```

### StoreProvider & useStore Hook

```typescript
// packages/core/src/contexts/store.tsx

export const StoreContext = createContext<[State, Dispatch<ReducerAction<any>>]>([...])

export const StoreProvider: React.FC<StoreProviderProps> = ({ 
  children, 
  initialState, 
  reducer 
}) => {
  const _reducer = reducer ?? defaultReducer
  const _state = initialState ?? defaultState
  const [state, dispatch] = useReducer(_reducer, _state)

  return (
    <StoreContext.Provider value={[state, dispatch]}>
      {children}
    </StoreContext.Provider>
  )
}

// Hook untuk mengakses state
export const useStore = <S extends State>(): [S, Dispatch<ReducerAction<any>>] => {
  const context = useContext(StoreContext)
  return context as unknown as [S, Dispatch<ReducerAction<any>>]
}
```

### Penggunaan di Component

```typescript
import { useStore } from '../contexts/store'
import { DispatchAction } from '../contexts/reducers/store'

const MyComponent = () => {
  const [store, dispatch] = useStore()
  
  // Membaca state
  const isAuthenticated = store.authentication.didAuthenticate
  const walletName = store.preferences.walletName
  
  // Mengubah state
  const enableDeveloperMode = () => {
    dispatch({
      type: DispatchAction.ENABLE_DEVELOPER_MODE,
      payload: [true]
    })
  }
  
  return (...)
}
```

---

## 2. Dispatch Actions

Semua actions didefinisikan di `packages/core/src/contexts/reducers/store.ts`:

### Kategori Actions

```typescript
// State Actions
enum StateDispatchAction {
  STATE_DISPATCH = 'state/stateDispatch'
}

// Onboarding Actions
enum OnboardingDispatchAction {
  ONBOARDING_UPDATED = 'onboarding/onboardingStateLoaded'
  DID_SEE_PREFACE = 'onboarding/didSeePreface'
  DID_COMPLETE_TUTORIAL = 'onboarding/didCompleteTutorial'
  DID_AGREE_TO_TERMS = 'onboarding/didAgreeToTerms'
  DID_CREATE_PIN = 'onboarding/didCreatePIN'
  DID_NAME_WALLET = 'onboarding/didNameWallet'
  DID_COMPLETE_ONBOARDING = 'onboarding/didCompleteOnboarding'
  ONBOARDING_VERSION = 'onboarding/onboardingVersion'
}

// Preferences Actions
enum PreferencesDispatchAction {
  ENABLE_DEVELOPER_MODE = 'preferences/enableDeveloperMode'
  USE_BIOMETRY = 'preferences/useBiometry'
  USE_PUSH_NOTIFICATIONS = 'preferences/usePushNotifications'
  PREFERENCES_UPDATED = 'preferences/preferencesStateLoaded'
  USE_VERIFIER_CAPABILITY = 'preferences/useVerifierCapability'
  USE_CONNECTION_INVITER_CAPABILITY = 'preferences/useConnectionInviterCapability'
  USE_DEV_VERIFIER_TEMPLATES = 'preferences/useDevVerifierTemplates'
  ENABLE_WALLET_NAMING = 'preferences/enableWalletNaming'
  UPDATE_WALLET_NAME = 'preferences/updateWalletName'
  ACCEPT_DEV_CREDENTIALS = 'preferences/acceptDevCredentials'
  USE_DATA_RETENTION = 'preferences/useDataRetention'
  PREVENT_AUTO_LOCK = 'preferences/preventAutoLock'
  USE_SHAREABLE_LINK = 'preferences/useShareableLink'
  UPDATE_ALTERNATE_CONTACT_NAMES = 'preferences/updateAlternateContactNames'
  AUTO_LOCK_TIME = 'preferences/autoLockTime'
  SET_THEME = 'preferences/setTheme'
  SET_SELECTED_MEDIATOR = 'preferences/setSelectedMediator'
  ADD_AVAILABLE_MEDIATOR = 'preferences/addAvailableMediator'
  RESET_MEDIATORS = 'preferences/resetMediators'
  BANNER_MESSAGES = 'preferences/bannerMessages'
  REMOVE_BANNER_MESSAGE = 'REMOVE_BANNER_MESSAGE'
  GENERIC_ERROR_MESSAGES = 'preferences/genericErrorMessages'
}

// Tours Actions
enum ToursDispatchAction {
  TOUR_DATA_UPDATED = 'tours/tourDataUpdated'
  UPDATE_SEEN_TOUR_PROMPT = 'tours/seenTourPrompt'
  ENABLE_TOURS = 'tours/enableTours'
  UPDATE_SEEN_HOME_TOUR = 'tours/seenHomeTour'
  UPDATE_SEEN_CREDENTIALS_TOUR = 'tours/seenCredentialsTour'
  UPDATE_SEEN_CREDENTIAL_OFFER_TOUR = 'tours/seenCredentialOfferTour'
  UPDATE_SEEN_PROOF_REQUEST_TOUR = 'tours/seenProofRequestTour'
}

// Authentication Actions
enum AuthenticationDispatchAction {
  DID_AUTHENTICATE = 'authentication/didAuthenticate'
}

// Login Attempt Actions
enum LoginAttemptDispatchAction {
  ATTEMPT_UPDATED = 'loginAttempt/loginAttemptUpdated'
}

// Lockout Actions
enum LockoutDispatchAction {
  LOCKOUT_UPDATED = 'lockout/lockoutUpdated'
}

// Migration Actions
enum MigrationDispatchAction {
  DID_MIGRATE_TO_ASKAR = 'migration/didMigrateToAskar'
  MIGRATION_UPDATED = 'migration/migrationStateLoaded'
}

// Deep Link Actions
enum DeepLinkDispatchAction {
  ACTIVE_DEEP_LINK = 'deepLink/activeDeepLink'
}

// App Status Actions
enum AppStatusDispatchAction {
  SET_VERSION_INFO = 'appStatus/checkVersionUpdate'
}
```

---

## 3. Persistensi Data

### AsyncStorage (PersistentStorage)

Lokasi: `packages/core/src/services/storage.ts`

```typescript
export class PersistentStorage<T> {
  // Fetch value dari storage
  public static fetchValueForKey = async <T>(key: string): Promise<T | undefined>
  
  // Store value ke storage
  public static storeValueForKey = async <T>(key: string, value: T): Promise<void>
  
  // Remove value dari storage
  public static removeValueForKey = async (key: string): Promise<void>
}
```

### LocalStorage Keys

```typescript
// packages/core/src/constants.ts
export enum LocalStorageKeys {
  Onboarding = 'OnboardingState'
  RevokedCredentials = 'RevokedCredentials'
  RevokedCredentialsMessageDismissed = 'RevokedCredentialsMessageDismissed'
  Preferences = 'PreferencesState'
  Migration = 'MigrationState'
  Tours = 'ToursState'
  HistorySettingsOption = 'historySettingsOption'
  Language = 'language'
}
```

### Auto-Persist dalam Reducer

Reducer secara otomatis menyimpan perubahan state ke AsyncStorage:

```typescript
case PreferencesDispatchAction.USE_BIOMETRY: {
  const choice = (action?.payload ?? []).pop() ?? false
  const preferences = { ...state.preferences, useBiometry: choice }
  const onboarding = { ...state.onboarding, didConsiderBiometry: true }
  
  // Auto-persist ke AsyncStorage
  PersistentStorage.storeValueForKey(LocalStorageKeys.Onboarding, onboarding)
  PersistentStorage.storeValueForKey(LocalStorageKeys.Preferences, preferences)
  
  return { ...state, onboarding, preferences }
}
```

### Load State saat App Start

State di-load dari storage saat aplikasi dimulai melalui `LOAD_STATE` token:

```typescript
// packages/core/src/container-impl.ts
this._container.registerInstance(TOKENS.LOAD_STATE, async (dispatch) => {
  // Load dari AsyncStorage
  await Promise.all([
    loadLoginAttempt().then((data) => { loginAttempt = data }),
    loadState<PreferencesState>(LocalStorageKeys.Preferences, (val) => preferences = val),
    loadState<MigrationState>(LocalStorageKeys.Migration, (val) => migration = val),
    loadState<ToursState>(LocalStorageKeys.Tours, (val) => tours = val),
    loadState<StoreOnboardingState>(LocalStorageKeys.Onboarding, (val) => onboarding = val),
  ])
  
  // Dispatch ke store
  dispatch({ type: DispatchAction.STATE_DISPATCH, payload: [state] })
})
```

---

## 4. Context Providers Lainnya

### AuthContext

Lokasi: `packages/core/src/contexts/auth.tsx`

Mengelola autentikasi wallet dan PIN:

```typescript
export interface AuthContext {
  lockOutUser: (reason: LockoutReason) => void
  checkWalletPIN: (PIN: string) => Promise<boolean>
  getWalletSecret: () => Promise<WalletSecret | undefined>
  walletSecret?: WalletSecret
  removeSavedWalletSecret: () => void
  disableBiometrics: () => Promise<void>
  setPIN: (PIN: string) => Promise<void>
  commitWalletToKeychain: (useBiometry: boolean) => Promise<boolean>
  isBiometricsActive: () => Promise<boolean>
  verifyPIN: (PIN: string) => Promise<boolean>
  rekeyWallet: (agent: Agent, oldPin: string, newPin: string, useBiometry?: boolean) => Promise<boolean>
}

// Penggunaan
const { checkWalletPIN, lockOutUser } = useAuth()
```

### NetworkContext

Lokasi: `packages/core/src/contexts/network.tsx`

Mengelola status koneksi jaringan:

```typescript
export interface NetworkContext {
  silentAssertConnectedNetwork: () => boolean | null
  assertNetworkConnected: () => boolean
  displayNetInfoModal: () => void
  hideNetInfoModal: () => void
  assertInternetReachable: () => boolean | null
}

// Penggunaan
const { assertNetworkConnected } = useNetwork()
```

### ActivityContext

Lokasi: `packages/core/src/contexts/activity.tsx`

Mengelola auto-lock dan user activity:

```typescript
export interface ActivityContext {
  appStateStatus: AppStateStatus
}

// Auto-lock times
export const AutoLockTime = {
  OneMinute: 1,
  ThreeMinutes: 3,
  FiveMinutes: 5,
  Never: 0,
} as const

// Penggunaan
const { appStateStatus } = useActivity()
```

### ThemeContext

Lokasi: `packages/core/src/contexts/theme.tsx`

Mengelola tema aplikasi:

```typescript
export interface IThemeContext extends ITheme {
  setTheme: (themeName: string) => void
}

// Penggunaan
const { ColorPallet, TextTheme, setTheme } = useTheme()
```

### TourContext

Lokasi: `packages/core/src/contexts/tour/`

Mengelola guided tours dalam aplikasi:

```typescript
export interface Tour {
  currentTour: TourID
  currentStep?: number
  changeSpot: (spot: LayoutRectangle) => void
  next: () => void
  previous: () => void
  start: (tourId: TourID) => void
  stop: () => void
}

// Penggunaan
const { start, next, stop } = useTour()
```

---

## 5. Dependency Injection Container

### Container API

Lokasi: `packages/core/src/container-api.ts`

Menggunakan `tsyringe` untuk dependency injection:

```typescript
export interface Container {
  init(): Container
  resolve<K extends keyof TokenMapping>(token: K): TokenMapping[K]
  resolveAll<K extends keyof TokenMapping, T extends K[]>(tokens: [...T]): { [I in keyof T]: TokenMapping[T[I]] }
  get container(): DependencyContainer
}

// Hooks untuk mengakses container
export const useContainer = () => useContext(ContainerContext)
export const useServices = <K extends keyof TokenMapping, T extends K[]>(tokens: [...T]) => {
  return useContainer().resolveAll(tokens)
}
```

### Token Categories

```typescript
// Screen tokens
export const SCREEN_TOKENS = {
  SCREEN_PREFACE: 'screen.preface',
  SCREEN_TERMS: 'screen.terms',
  SCREEN_ONBOARDING: 'screen.onboarding',
  SCREEN_SPLASH: 'screen.splash',
  // ...
}

// Component tokens
export const COMPONENT_TOKENS = {
  COMPONENT_HOME_HEADER: 'component.home.header',
  COMPONENT_HOME_FOOTER: 'component.home.footer',
  COMPONENT_RECORD: 'component.record',
  // ...
}

// Utility tokens
export const UTILITY_TOKENS = {
  UTIL_LOGGER: 'utility.logger',
  UTIL_OCA_RESOLVER: 'utility.oca-resolver',
  UTIL_LEDGERS: 'utility.ledgers',
  // ...
}

// Config tokens
export const CONFIG_TOKENS = {
  CONFIG: 'config',
  INLINE_ERRORS: 'errors.inline',
  ONBOARDING: 'utility.onboarding',
}
```

### Penggunaan DI Container

```typescript
import { TOKENS, useServices } from '../container-api'

const MyComponent = () => {
  const [logger, config] = useServices([TOKENS.UTIL_LOGGER, TOKENS.CONFIG])
  
  logger.info('Component mounted')
  
  if (config.enableTours) {
    // ...
  }
}
```

---

## 6. Reducer Composition

Bifold mendukung penggabungan reducer untuk extensibility:

```typescript
// packages/core/src/contexts/store.tsx
export const mergeReducers = (a: Reducer, b: Reducer): Reducer => {
  return <S extends State>(state: S, action: ReducerAction<any>): S => {
    return a(b(state, action), action)
  }
}
```

### Penggunaan Custom Reducer

```typescript
import { StoreProvider, mergeReducers, defaultReducer } from '@bifold/core'

const customReducer = (state, action) => {
  switch (action.type) {
    case 'CUSTOM_ACTION':
      return { ...state, customField: action.payload }
    default:
      return state
  }
}

const combinedReducer = mergeReducers(defaultReducer, customReducer)

const App = () => (
  <StoreProvider reducer={combinedReducer}>
    <MainApp />
  </StoreProvider>
)
```

---

## 7. Diagram Arsitektur

```
┌─────────────────────────────────────────────────────────────────┐
│                         App Component                            │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                   ContainerProvider                      │    │
│  │  (DI Container - tsyringe)                              │    │
│  │  ┌─────────────────────────────────────────────────┐    │    │
│  │  │                 StoreProvider                    │    │    │
│  │  │  (Global State - useReducer)                    │    │    │
│  │  │  ┌─────────────────────────────────────────┐    │    │    │
│  │  │  │              AuthProvider                │    │    │    │
│  │  │  │  (Authentication Context)               │    │    │    │
│  │  │  │  ┌─────────────────────────────────┐    │    │    │    │
│  │  │  │  │         NetworkProvider          │    │    │    │    │
│  │  │  │  │  (Network Status Context)       │    │    │    │    │
│  │  │  │  │  ┌─────────────────────────┐    │    │    │    │    │
│  │  │  │  │  │     ThemeProvider        │    │    │    │    │    │
│  │  │  │  │  │  ┌─────────────────┐    │    │    │    │    │    │
│  │  │  │  │  │  │  ActivityProvider│    │    │    │    │    │    │
│  │  │  │  │  │  │  ┌───────────┐  │    │    │    │    │    │    │
│  │  │  │  │  │  │  │TourProvider│  │    │    │    │    │    │    │
│  │  │  │  │  │  │  │  [App]    │  │    │    │    │    │    │    │
│  │  │  │  │  │  │  └───────────┘  │    │    │    │    │    │    │
│  │  │  │  │  │  └─────────────────┘    │    │    │    │    │    │
│  │  │  │  │  └─────────────────────────┘    │    │    │    │    │
│  │  │  │  └─────────────────────────────────┘    │    │    │    │
│  │  │  └─────────────────────────────────────────┘    │    │    │
│  │  └─────────────────────────────────────────────────┘    │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘

                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Persistence Layer                           │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────────┐    ┌──────────────────┐                   │
│  │   AsyncStorage    │    │  React Keychain  │                   │
│  │  (Preferences,    │    │  (PIN, Wallet    │                   │
│  │   Onboarding,     │    │   Secrets,       │                   │
│  │   Tours, etc.)    │    │   Login Attempts)│                   │
│  └──────────────────┘    └──────────────────┘                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 8. Best Practices

### Mengakses State
```typescript
// ✅ Gunakan useStore hook
const [store, dispatch] = useStore()

// ✅ Destructure hanya yang dibutuhkan
const { preferences, authentication } = store
```

### Dispatch Actions
```typescript
// ✅ Gunakan DispatchAction enum
dispatch({
  type: DispatchAction.USE_BIOMETRY,
  payload: [true]
})

// ❌ Hindari string literal
dispatch({
  type: 'preferences/useBiometry',  // Tidak type-safe
  payload: [true]
})
```

### Menggunakan Services
```typescript
// ✅ Gunakan useServices untuk multiple dependencies
const [logger, config, resolver] = useServices([
  TOKENS.UTIL_LOGGER,
  TOKENS.CONFIG,
  TOKENS.UTIL_OCA_RESOLVER
])

// ✅ Atau useContainer untuk single resolve
const container = useContainer()
const logger = container.resolve(TOKENS.UTIL_LOGGER)
```

---

## 9. Referensi File

| File | Deskripsi |
|------|-----------|
| `src/contexts/store.tsx` | StoreProvider dan useStore hook |
| `src/contexts/reducers/store.ts` | Reducer utama dan DispatchAction |
| `src/contexts/auth.tsx` | AuthProvider untuk autentikasi |
| `src/contexts/network.tsx` | NetworkProvider untuk status jaringan |
| `src/contexts/activity.tsx` | ActivityProvider untuk auto-lock |
| `src/contexts/theme.tsx` | ThemeProvider untuk tema |
| `src/contexts/tour/` | TourProvider untuk guided tours |
| `src/container-api.ts` | DI Container interface dan tokens |
| `src/container-impl.ts` | DI Container implementation |
| `src/services/storage.ts` | PersistentStorage class |
| `src/types/state.ts` | State type definitions |
| `src/constants.ts` | LocalStorageKeys dan constants |
