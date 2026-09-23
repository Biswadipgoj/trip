# TripMate Android rebuild — RESUME FILE

_Last updated: 2026-09-23. Written mid-task so work can continue after a logout._
**To continue: say "resume" — Claude reads this file and carries on from "Next steps".**

---

## 1. The request (verbatim)

> please build the android app with relevant image proper icon and inter face ui design same as web
> just make sure everything look fine and smooth and more animation in app and use supabse to update
> bill image upi ss please build more robustly

Interpretation (confirmed by the audit below):
1. Proper TripMate launcher icon / splash / in-app logo (the app still shipped Expo's default "A" icon).
2. UI that matches the **web** design (warm cream + violet/fuchsia glass look, Inter + Space Grotesk).
3. Smooth, richer animations.
4. **Supabase Storage uploads for bill/receipt photos and UPI payment screenshots.**
5. Robustness (offline, retries, correct money maths, crash-safety).

---

## 2. Audit findings (why a rewrite)

- `mobile/assets/images/*` were Expo template images (blue "A"), splash was blank white. ✅ fixed.
- Mobile theme was slate/indigo, not the web palette.
- **Money logic diverged from web**: mobile `applyConfirmedTransfers` was the old naive version (no couple/sponsor
  entities); `calculateSettlements` had a different signature/impl, and the old store even called it with the
  wrong argument order; groups/sponsorships/UPI edits were never pushed to Supabase; `syncRemoteTrip` wiped
  unsynced local data; equal-split expenses were pushed with **no participants** via an RPC that also generated
  a different server id.
- **No Supabase env vars in mobile builds** (no `mobile/.env`, nothing in eas.json) → shipped APKs had cloud sync OFF.
- Share link used made-up domain `https://tripmate.app/join?c=…` (web route is `/join-trip?invite=` / `?code=`).
- QR code used `QRCode.toDataURL` (needs a browser canvas → never worked in RN). Use `QRCode.create()` matrix + react-native-svg.
- RN `SafeAreaView` (no-op on Android) and a tab bar with fixed height & no bottom inset (broken under edge-to-edge).
- Unused native deps (notifications, background-task, task-manager, @expo/ui, glass-effect…) — removed.
- **Root `tsconfig.json` includes `mobile/**/*.ts`** (exclude only node_modules). Locally tsc passes (0 errors) because
  `mobile/node_modules` exists, but on Vercel only root deps are installed → `next build` type-check would fail on
  `react-native` imports. **TODO: add `"mobile"` to root tsconfig `exclude`.**

---

## 3. Environment facts (verified — don't re-research)

- Expo **SDK 57**, React Native **0.86.3**, Reanimated **4.5.1** + react-native-worklets **0.10.1**
  (use `scheduleOnRN(fn, ...args)` from `react-native-worklets`; `runOnJS` is deprecated), expo-router **57.0.22**,
  TypeScript 6, New Architecture only.
- React Navigation is **vendored inside expo-router** (`expo-router/build/react-navigation/*`); bottom-tabs options
  include `animation: 'none'|'fade'|'shift'`, `sceneStyle`, `lazy`, `freezeOnBlur`, custom `tabBar` (type via
  `Parameters<NonNullable<React.ComponentProps<typeof Tabs>['tabBar']>>[0]`).
- RN style `boxShadow` (string, e.g. `'0 8px 32px rgba(108,62,200,0.14)'`) is supported → web-like soft shadows.
- **No Java/Android SDK on this machine** → Android binaries only via **EAS** (`npx eas-cli@latest build -p android
  --profile preview`). EAS is logged in as `biswodip` (owner). **Ask the user before running any EAS build.**
- Python 3.13 + Pillow + numpy + `potracer` available; `sharp` 0.34.5 in the ROOT `node_modules`.
- APIs verified from SDK 57 docs / installed `.d.ts`:
  - `expo-image-picker`: `launchCameraAsync` / `launchImageLibraryAsync({ mediaTypes: ['images'], quality, allowsEditing, exif })`,
    `requestCameraPermissionsAsync()`, `getPendingResultAsync()` (Android activity-kill recovery). Plugin options:
    `photosPermission`, `cameraPermission`, `microphonePermission: false` (blocks RECORD_AUDIO).
  - `expo-image-manipulator`: `ImageManipulator.manipulate(uri).resize({ width|null, height|null })` →
    `await ctx.renderAsync()` → `ImageRef.saveAsync({ compress, format: SaveFormat.JPEG })` → `{ uri, width, height }`.
    (`manipulateAsync` is deprecated.)
  - `expo-file-system`: `import { File, Directory, Paths } from 'expo-file-system'`; `new File(uri)`,
    `new File(dir, name)`; `file.move()/copy()` are **async**; `delete()`, `create()` sync; `exists`;
    `size: number|null`; `arrayBuffer(): Promise<ArrayBuffer>`; `new Directory(Paths.document, 'x').create({ intermediates, idempotent })`.
  - Supabase on RN: uploads must use **ArrayBuffer** (Blob/FormData don't work); must import
    `react-native-url-polyfill/auto`; Storage upload needs INSERT policy only; `remove()` needs SELECT + DELETE.
  - `expo-splash-screen` Android: image composited at `imageWidth` dp onto a **288dp** canvas; Android 12+ shows a
    192dp circle → use `imageWidth: 288` with our splash tile (fits inside the circle).
  - `react-native-keyboard-controller` 1.21.9: `KeyboardProvider` props `statusBarTranslucent`,
    `navigationBarTranslucent`, `preserveEdgeToEdge` (set all true — edge-to-edge is forced); `KeyboardAwareScrollView`
    (`bottomOffset`, `extraKeyboardSpace`, `mode`). **Not in Expo Go** → fall back to ScrollView/KeyboardAvoidingView
    when `Constants.executionEnvironment === 'storeClient'` (lazy `require` in try/catch).
  - Fonts: `@expo-google-fonts/inter` (use 400Regular…800ExtraBold) + `@expo-google-fonts/space-grotesk`
    (500/600/700) via `useFonts`; family names like `Inter_600SemiBold`; don't combine custom fonts with `fontWeight`.
- **Harness hooks in this repo**:
  - GateGuard blocks the **first Write/Edit of every file** and destructive Bash → it always blocks the first attempt;
    then state facts (importers/callers, API, data schema, user's verbatim instruction) and retry.
  - The auto-mode classifier **denied `rm -rf` of source files**. Strategy adopted: **never delete — overwrite files
    in place** (Read a few lines first, then Write), reusing existing filenames (mapping in §6).

---

## 4. Design tokens (web → mobile)

Web tailwind remaps `white` to ink, so `text-white/60` = ink at 60%, `border-white/10` = ink at 10%, `bg-white/5` = ink 5%.

| Token | Value |
|---|---|
| surface0 (screen bg) | `#FDF9F2` (hsl 42 70% 97%) · surface1 `#F9F3E7` · surface2 `#F4EDDD` · surface3 `#ECE3D0` |
| ink (text) | `#2A1F3D` (hsl 262 32% 18%) — use rgba(42,31,61,α) for /60, /65, /50, /40, /10, /5 |
| brand 50/100/200/300/400/500/600/700 | `#F5F0FF #ECE1FE #DCC9FD #C09FF9 #9B68F3 #7C3BED #6620DF #5720B6` |
| fuchsia (brand gradient end) | `#E935CB` · btn-brand = `#7C3BED → #E935CB` |
| accent 400/500/600 | `#22C3A3 #16A286 #0F856D` · emerald 400/500 `#1DA578 #148A63` |
| red-400/500 | `#F87171 #EF4444` · amber 400/500/600/700 `#FBBF24 #F59E0B #D97706 #B45309` |
| Stat gradients | indigo-purple `#453CEC→#AC37E6` · orange-pink `#F97924→#F23681` · blue-cyan `#1E71F6→#07C2E4` · emerald-teal `#1FAD6B→#15ACAC` · violet-fuchsia `#7C3BED→#E935CB` |
| Progress bars | settlement `#7C3BED→#17AB8D` · budget ok `#1FAD6B→#15ACAC` · over `#F97924→#F22C54` · warn `#F9A410→#F97924` |
| Liquid backdrop layer A (24s drift) | ellipses: `#9F69FC`@.62 (12%,18%) · `#5DD3FD`@.58 (88%,12%) · `#FB6AC6`@.56 (82%,86%) · `#FF9966`@.50 (14%,84%) · `#E089FA`@.46 (50%,52%) · `#6065FB`@.42 (38%,24%) · `#FFCB70`@.38 (64%,30%) — radial, transparent at 60% |
| Liquid backdrop layer B (30s drift) | `#FC7DE7`@.42 (30%,70%) · `#73B8FC`@.40 (72%,64%) · `#FF8370`@.38 (24%,36%) |
| Glass card | gradient `rgba(255,255,255,.88) → rgba(247,242,255,.78) → rgba(240,248,255,.80)`, border ink/10, radius 16, shadow `0 8px 32px rgba(108,62,200,0.12)` |
| Fonts | body Inter; headings/numbers Space Grotesk; codes/UPI ids `monospace` |
| Avatar colours | web hsl strings (`AVATAR_COLORS` in utils) — use `withAlpha()` from lib/color.ts |

Web screens to mirror (source in `src/app/**/page.tsx`): landing, create-trip (details→PIN→success), join-trip
(find→details→PIN→success, invite/code/d params), login (local then cloud), dashboard, members, expenses (+ modal with
Stay/rooms mode, multi-payer, equal/custom split), payments, report. Web nav = 5 tabs: Dashboard, Members, Expenses,
Payments, Report + mobile top bar (logo, trip name, "me · CODE", red Logout) + BrandFooter
("Mastermind Behind The Code: Biswodip Goj", tap → nameplate overlay).

---

## 5. DONE so far (all on disk, NOT committed)

1. **Icons** — `mobile/scripts/trace-logo.py` (traces `public/logo.png` → `mobile/assets/brand/tripmate-glyph.json`)
   and `mobile/scripts/generate-icons.mjs` (renders with root `sharp`) → `mobile/assets/images/`:
   `icon.png`, `adaptive-foreground.png`, `adaptive-background.png`, `adaptive-monochrome.png`, `favicon.png`,
   `splash-icon.png` (tile fits Android 12 circle), `logo.png` (web logo tile, transparent corners, 436px — in-app logo).
   Old Expo template images removed. Previews looked right in circle/squircle/rounded masks.
2. **Deps** (`mobile/package.json`): removed `@expo/ui expo-background-task expo-task-manager expo-notifications
   expo-glass-effect expo-device expo-symbols date-fns`; added `expo-image-picker expo-image-manipulator
   expo-file-system expo-network react-native-url-polyfill react-native-keyboard-controller`.
   (Still TODO: `npx expo install expo-print expo-sharing` for "Export PDF"; move `@types/qrcode` to devDependencies;
   remove `"expo-background-task"` from app.json plugins — it's still listed.)
3. **New core code** in `mobile/src` (complete, written):
   - `types/index.ts` — web mirror + `Attachment` (kind `bill|payment_proof`, upload `pending|uploading|uploaded|failed`,
     localUri, storagePath, attempts, nextAttemptAt) + `OutboxEntry/OutboxOp` (delete, memberUpi, closeTrip, removeMedia).
   - `lib/utils.ts` — **exact web parity** money logic (web `calculateSettlements(balances, members, groups, sponsorships)`),
     pure-JS base64/UTF-8 invite tokens (web-compatible), cached Intl + fallbacks, `getCategoryGradientColors`,
     `extractJoinInput`, `buildUpiLink` (%20 + raw @), `isValidUpiId`, `formatDayShort`, `formatRelativeTime`, `CATEGORIES`, `sameAmount`.
   - `lib/color.ts` — `parseColor`, `withAlpha`, `toHex`.
   - `lib/config.ts` — `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `WEB_URL` (EXPO_PUBLIC_*), `MEDIA_BUCKET='trip-media'`, `APP_SCHEME`.
   - `lib/supabase.ts` — url polyfill, fetch timeout (25s / 90s binary), guarded createClient; exports `supabase`, `isSupabaseConfigured`.
   - `lib/synclog.ts` — `useSyncStatus` (remoteConfigured, syncing, online, lastSyncAt, lastSyncOk, lastError,
     mediaReady, events, log, markSync, set) + `logSync`.
   - `lib/remote.ts` — web port; push fns return booleans; atomic RPCs `tm_push_expense / tm_push_hotel_expense /
     tm_push_settlement_group` with auto-fallback (PGRST202); heal fns `remoteHealExpenseParticipants`,
     `remoteHealHotelRooms`; media: `MediaError(kind 'setup'|'transient')`, `mediaPublicUrl`, `remoteUploadMedia`
     (409 = success), `remoteInsertAttachment` (23505 = success), `remoteDeleteAttachment`, `remoteRemoveMedia`;
     `TripBundle.attachments: Attachment[]|null` + `mediaTableMissing`.
   - `lib/store.ts` — web port (same actions, same `generateSettlements`, monotonic merge) + outbox (`enqueue`,
     `flushOutbox`, max 25 online attempts, per-trip ordering), overlays in `mergeRemoteTrip` (pending deletes / UPI /
     close), incomplete-row protection + healing in `pushTripToRemote` (also re-pushes offline "paid" marks),
     attachments (`addAttachment`, `updateAttachment`, `removeAttachment`), cascade on expense/hotel delete,
     `setLocalFileCleaner()` injection, persist key `tripmate_mobile_storage` **v4** with `migratePersisted` (v0 → v4)
     and 'uploading'→'pending' fix on rehydrate, `logout()`.
   - `lib/media.ts` — `pickImage(source)` (camera permission, compress ≤1600px JPEG 0.72, move into
     `<documents>/tripmate-media/<uuid>.jpg`), `prepareImage`, `MediaPermissionError`, `openAppSettings`,
     `savePickContext`/`takePendingPick` (AsyncStorage `tripmate_pending_pick`), `deleteLocalFiles`, `localFileExists`.

**Current state:** the OLD screens/components in `mobile/src/app` and `mobile/src/components` still exist and
reference the old APIs → **the mobile app does not compile until the remaining steps are done.**

---

## 6. NEXT STEPS (do in order)

**Progress (session 2, 2026-09-23):** ✅ A `lib/uploads.ts` · ✅ B `lib/sync.ts` (+ `startNetworkMonitor`) ·
✅ C `lib/hooks.ts` (`useTripData`, `proofsFor`, `routeKey`, `Due`) · ✅ D theme (`C`, `G`, `ink()`, `violet()`,
`shadow`, `F`, `TYPE`, `space`, `radius`) · ✅ `lib/toast.ts` · ✅ `expo-print` + `expo-sharing` installed.
Fonts: import per-weight subpaths (`@expo-google-fonts/inter/400Regular`) — the package root bundles all 18 weights.
✅ E components (tsc-clean): ui/{Text(T,GradientText),Screen(Screen,LiquidBackground),GlassCard,Button(IconType),Field,
Avatar,MemberAvatarStack(AvatarStack),CategoryChip(SelectPill,Checkbox,Chip),BottomSheet(Sheet,Overlay),DonutChart(DonutChart,
BarChart,HBarChart,shortMoney),AnimatedHeader(TripTopBar+SyncSheet),StatCard(StatCard,Sheen),QRCode,Toast(ToastHost),
BrandFooter,KeyboardScroll(KeyboardScroll,KeyboardRoot),Logo,PageHeader} · animated/{SpringPressable(PressScale,tick),
FadeInView(FadeIn,Collapsible,SMOOTH_LAYOUT,EASE_OUT,stagger),SlotCounter(CountUp),PulseBadge(StatusBadge),
ConfettiBlast(Confetti shot=n),ProgressRing(ProgressRing,ProgressBar),FloatingActionButton(FAB),ShimmerLoader(Skeleton,
CardSkeleton),AnimatedEmptyState(EmptyState),SwipeCard(SwipeToDelete),AnimatedTabBar(TabBar)} ·
attachments/{AttachmentPicker,AttachmentStrip(+DraftStrip)} · lib/dialogs.ts(confirmAction).
Gotchas: no `StyleSheet.absoluteFillObject` in RN 0.86 (use absoluteFill); entering anims needing extra transforms → `Keyframe`;
CSS `transitionProperty` arrays must not be readonly; web direction 'up' = Reanimated `FadeInDown`.
F progress: ✅ app/_layout (fonts per-weight, hydration+3s timeout, ErrorBoundary, ToastHost, KeyboardRoot) ·
✅ (tabs)/_layout (LiquidBackground + TripTopBar + TabBar badges, animation 'shift') · ✅ index · ✅ create-trip · ✅ join-trip ·
✅ login · ✅ (tabs)/dashboard · ✅ (tabs)/members · ✅ +not-found/add-hotel/report redirects · lib/nav.ts (enterTrip/leaveTrip) ·
PageHeader.tsx also exports PageScroll (refresh + BrandFooter), BackLink, SuccessCheck · utils: createTripShareMessage.
✅ F all screens (expenses, settlements, analytics+PDF, add-expense, payment-modal, viewer) — mobile `tsc` clean.
✅ G app.json 4.0.0/400 + icons/splash/image-picker plugin, .env.example, .gitignore .env, package.json (4.0.0,
scripts typecheck/test/icons, @types/qrcode→dev), root tsconfig excludes "mobile", mobile tsconfig excludes tests.
✅ H supabase/migrations/20260923_mobile_media.sql (+ pointer comment in schema.sql).
✅ I tests: mobile/vitest.config.mts, __tests__/parity.test.ts (400 seeds web↔mobile), __tests__/store.test.ts,
src/lib/utils.test.ts rewritten → `npx vitest run --config mobile/vitest.config.mts` = 27 passed.
✅ J so far: mobile tsc clean · root tsc clean (mobile excluded) · web `npm test` 46 passed · `expo export --platform android`
bundles OK (7.4 MB hbc) · expo-doctor 20/21 → async-storage kept on v3 on purpose (prev release stored data with v3's Room DB;
added to package.json expo.install.exclude) + react-native-svg pinned 15.15.4. app.json web.output → "single" (static SSR
crashed on AsyncStorage `window`). Landing logo: Keyframe entering got `position:absolute` on web → replaced with
shared-value spring (PoppingLogo). ✅ K mobile/README.md rewritten.
✅ Web visual QA done (landing, dashboard, payments, expenses+expanded card, report+charts, add-expense, settle screen).
QA fixes: Reanimated web gives `position:absolute` to entering anims using `Keyframe` or `.withInitialValues` → replaced
with `useRiseIn()` (shared values, in FadeInView.tsx) in StatCard, Overlay PopCard, Collapsible; landing logo spring;
donut `origin` → `transform` string; removed nested pressables (due card, unit row).
STATUS: CODE COMPLETE (uncommitted). Remaining = user actions: run supabase/migrations/20260923_mobile_media.sql, set
EXPO_PUBLIC_* in EAS (preview/production), approve `npx eas-cli@latest build -p android --profile preview`.

## 7. SESSION 3 — user: "no offline onlly supabase and makes more premium" (2026-09-23)
Facts: EAS logged in (owner biswodip); EAS env already has EXPO_PUBLIC_SUPABASE_URL + _ANON_KEY for preview AND
production (no EXPO_PUBLIC_WEB_URL). Secret guard blocks reading any .env file — never try.
PLAN (cloud-required, server-confirmed writes; local store = read cache only):
 1. config.ts `ALLOW_LOCAL_PREVIEW` (EXPO_PUBLIC_ALLOW_LOCAL_PREVIEW=1, QA only). Root layout: no Supabase → CloudSetupRequired screen.
 2. store.ts apply* methods (applyTrip/Member/Expense/Hotel/Group/Removal/SettlementStatus/MemberUpi/TripClosed) that
    update the cache WITHOUT pushing and mark synced[id]; existing actions kept (tests).
 3. new lib/cloud.ts: CloudError('offline'|'config'|'server') + cloudCreateTrip/AddExpense/AddHotel/DeleteExpense/
    DeleteHotel/SetSettlementStatus/AddMember/UpdateUpi/AddGroup/RemoveGroup/CloseTrip/RemoveAttachment — await remote,
    then apply. Preview mode falls back to old local actions.
 4. Screens use cloud.* with busy states + error toasts; login cloud-first; remove "saved on this phone" copy.
 5. Premium: floating glass TabBar w/ gradient pill; dashboard hero (greeting + net pill); "Live" sync chip;
    Button brand sheen; SuccessBurst overlay after save/confirm; offline banner in tabs layout.
PROGRESS: ✅ config ALLOW_LOCAL_PREVIEW · ✅ store apply* (interface+impl) · ✅ lib/cloud.ts (CloudError, withCloud,
cloudMessage, cloudCreateTrip/CloseTrip/AddMember/UpdateUpi/AddExpense/AddHotel/DeleteItem(kind,id)/AddGroup/RemoveGroup/
SetPaymentStatus/RemoveAttachment) · ✅ create-trip (await cloudCreateTrip, saving state) · ✅ login cloud-first ·
✅ dashboard (cloudCloseTrip, cloudUpdateUpi) · ✅ members (cloudAddMember/AddGroup/RemoveGroup/UpdateUpi, busy states).
UPDATE 23:45 — a parallel session (during my usage-limit pause) added lib/i18n.ts (20 languages, store.language/
setLanguage), components/ui/LanguagePicker.tsx, constants/travelImages.ts (remote hero photo), CloudSetupRequired in
_layout, and converted add-expense/payment-modal/viewer/settlements to cloud.*. I fixed the resulting tsc errors
(duplicate import, missing isRemoteEnabled, bad text variant). ALL screens now use cloud.* (no direct store writes).
Remaining: premium (floating gradient TabBar, offline banner, Live chip, Button sheen), copy cleanup, verify+QA.
✅ 23:48 DONE: floating glass TabBar + violet→fuchsia gradient pill (white active icon/label) · "Live" chip w/ pulsing
dot in TripTopBar when synced · OfflineBanner in (tabs)/_layout · Sheen on brand Buttons · "on this phone" copy
removed · tsc clean · 27 mobile tests pass · expo export android OK (3908 modules, 7.5 MB).
STATUS: cloud-only + premium pass COMPLETE (uncommitted). Waiting on user: run SQL migration; OK to run
`npx eas-cli@latest build -p android --profile preview` (EAS env already has SUPABASE_URL/ANON_KEY; WEB_URL optional).
OLD TODO (mostly done): expenses.tsx deleteNow→cloudDeleteItem · settlements.tsx confirm→cloudSetPaymentStatus · payment-modal (markPaid/
confirm/addProof→cloudSetPaymentStatus) · add-expense (cloudAddExpense/cloudAddHotel, then attach bills) · viewer delete→
cloudRemoveAttachment · root layout CloudSetupRequired · offline copy cleanup (sync.ts msg, SyncDetails offline text,
add-expense bills tip, README) · premium items (§7.5) · tsc + tests + expo export + web QA (use
EXPO_PUBLIC_ALLOW_LOCAL_PREVIEW=1 when starting web preview).
STYLE NOTE: don't append placeholder exports/`void x` to silence unused imports — just remove the import.

### A. `mobile/src/lib/uploads.ts` (new)
- At module load: `setLocalFileCleaner(deleteLocalFiles)`. Import this module once in the root `_layout.tsx`.
- `processUploads()` single-flight; skip when offline; for each attachment `pending|failed` with `nextAttemptAt <= now`:
  - bill: parent (expenseId/hotelExpenseId) must exist locally (else `removeAttachment`) and `synced[parentId]`
    (else wait for next sync); proof: `synced[fromMemberId] && synced[toMemberId]`.
  - missing local file → `failed`, 'Image file is missing on this device', never retry.
  - set `uploading`; path `${tripId}/${kind==='bill'?'bills':'payments'}/${id}.jpg`; `new File(localUri).arrayBuffer()`
    → `remoteUploadMedia` → `updateAttachment({storagePath})` → `remoteInsertAttachment` → `uploaded`;
    `useSyncStatus.set({mediaReady:true})`.
  - error: attempts+1, `failed`, backoff `min(10min, 5s·2^attempts)`; MediaError 'setup' → mediaReady false, 30-min backoff,
    message "Cloud storage for images isn't set up yet".
- `attachImage(image, target, uploadedBy)` → `addAttachment` + `processUploads()`; `retryUpload(id)`;
  `attachmentUri(a)` = localUri if file exists else `mediaPublicUrl(storagePath)`.
- `recoverPendingPick()` at startup: payment_proof → attach to that settlement (toast); bill → keep in
  `consumeRecoveredBill()` for add-expense to prefill.

### B. `mobile/src/lib/sync.ts` (new)
- `syncTrip(tripId)` single-flight (queue one follow-up): set syncing → `flushOutbox(tripId)` →
  `remoteFetchTripBundle` → `mergeRemoteTrip` (set `mediaReady=false` if `bundle.mediaTableMissing`) →
  `pushTripToRemote(tripId, bundle)` → `markSync` → `processUploads()`.
- `useTripSync(tripId)`: sync on mount; 15s interval while foreground; `AppState` active → start / background → stop;
  `expo-network` `addNetworkStateListener` → update `online`, resync on reconnect (debounced 700ms);
  realtime: `supabase.channel('trip:'+id)` `postgres_changes` on expenses, hotel_expenses, settlements, members,
  settlement_groups, sponsorships (filter `trip_id=eq.<id>`) + trips (`id=eq.<id>`); **attachments on a separate
  channel** (table may not exist). Cleanup with `supabase.removeChannel`.

### C. `mobile/src/lib/hooks.ts` (new)
`useTripData(tripId)` → memoized: trip, members, expenses (desc), hotelExpenses (desc), settlements, groups,
sponsorships, attachments, balances (`calculateNetBalances`), routes (`calculateSettlements(balances, members,
groups, sponsorships)`), memberMap, totalSpent, me, isAdmin. Use raw store arrays + useMemo (no selector that
returns new arrays → avoids zustand v5 infinite loops).

### D. Theme — overwrite (already Read): `theme/colors.ts` (tokens §4 as `C`, gradients `G`, shadows),
`theme/typography.ts` (font family map + variants), `theme/spacing.ts`.

### E. Components — overwrite existing files with new implementations (Read ~10 lines first):
| existing file | becomes |
|---|---|
| `components/ui/GlassCard.tsx` | GlassCard + pressable variant |
| `components/ui/Avatar.tsx` | Avatar (xs24 sm32 md40 lg56 xl80, ring, coloured glow, pop-in) |
| `components/ui/MemberAvatarStack.tsx` | AvatarStack |
| `components/ui/CategoryChip.tsx` | Chip / SelectPill (selected = brand600/30 bg + brand500/50 border) |
| `components/ui/BottomSheet.tsx` | Sheet (Modal + spring slide + drag-to-dismiss + backdrop) |
| `components/ui/DonutChart.tsx` | DonutChart + BarChart + HBar (animated SVG / widths) |
| `components/ui/AnimatedHeader.tsx` | TripTopBar (logo, trip name, me·code, sync icon, Logout) |
| `components/animated/AnimatedTabBar.tsx` | 5-item tab bar, sliding pill, safe-area bottom, haptics |
| `components/animated/SpringPressable.tsx` | PressScale (spring 0.96 + haptic) |
| `components/animated/FadeInView.tsx` | FadeIn (Reanimated entering, capped stagger) + Collapsible |
| `components/animated/SlotCounter.tsx` | CountUp (JS rAF, Indian grouping, ease-out cubic) |
| `components/animated/PulseBadge.tsx` | StatusBadge (active/closed/pending/paid/confirmed, pulsing dot) |
| `components/animated/ConfettiBlast.tsx` | Confetti (burst + celebration) |
| `components/animated/ProgressRing.tsx` | ProgressRing + ProgressBar (animated) |
| `components/animated/FloatingActionButton.tsx` | FAB (violet→fuchsia, sheen, pop-in) |
| `components/animated/ShimmerLoader.tsx` | Skeleton shimmer |
| `components/animated/AnimatedEmptyState.tsx` | EmptyState |
| `components/animated/SwipeCard.tsx` | SwipeToDelete (gesture-handler pan, reveal delete) |
New files: `components/ui/Screen.tsx` (LiquidBackground via react-native-svg ellipses + Reanimated drift, pause when
unfocused / reduced motion; Screen wrapper), `components/ui/Text.tsx` (T + GradientText via masked-view),
`components/ui/Button.tsx`, `components/ui/Field.tsx` (glass input, focus ring, error), `components/ui/StatCard.tsx`
(gradient + sheen sweep + CountUp), `components/ui/QRCode.tsx` (`QRCode.create` → SVG path), `components/ui/Toast.tsx`,
`components/ui/BrandFooter.tsx`, `components/ui/KeyboardScroll.tsx` (keyboard-controller with Expo Go fallback),
`components/attachments/AttachmentPicker.tsx` (Camera / Gallery buttons, permission alert → Settings),
`components/attachments/AttachmentStrip.tsx` (thumbnails with pending/uploading/failed/uploaded states, retry, remove,
tap → viewer).

### F. Screens — overwrite existing route files (routes can't be deleted):
- `app/_layout.tsx`: import `../lib/uploads`; `SplashScreen.preventAutoHideAsync()` at module scope; `useFonts`;
  wait for store `hydrated` (3s safety timeout); `GestureHandlerRootView` + `SafeAreaProvider` + `KeyboardProvider`
  (guarded) + Toast host; Stack with modals (add-expense, add-hotel, payment-modal, viewer = fade transparent);
  export `ErrorBoundary`; run `recoverPendingPick()` after hydration.
- `app/index.tsx`: web landing (logo pop+float, gradient "TripMate", pill, "Split trips, not friendships",
  3 CTAs, 3 feature cards) + "Your trips on this device" (→ login prefilled) + BrandFooter; redirect to dashboard if session.
- `app/create-trip.tsx`, `app/join-trip.tsx`, `app/login.tsx`: exact web flows (see src/app/*/page.tsx),
  share via RN `Share.share` + copy (expo-clipboard); invite link `createInviteLink(trip, WEB_URL)` when WEB_URL set,
  else share code; join handles `invite` / `code` / `d` params + pasted links (`extractJoinInput`); cloud-off amber warning.
- `app/add-expense.tsx`: web modal form (title, amount, 3-col categories, subcategory chips, Stay mode with rooms &
  occupants, paid-by single/multi, participants all/none, split equal/custom with live totals, notes) **+ Bill photos**
  (AttachmentPicker; drafts linked after save via `attachImage`); param `category=stay` preselects Stay.
- `app/add-hotel.tsx` → `<Redirect href={{ pathname: '/add-expense', params: { category: 'stay' } }} />`.
- `app/payment-modal.tsx` → focused "Settle payment" screen for a settlement id: amount, from→to, recipient UPI,
  "Pay via UPI app" (`Linking.openURL(buildUpiLink(...))` in try/catch; no canOpenURL), QR (SVG), **upload UPI
  screenshot** (camera/gallery) → mark Paid; receiver/any member "Confirm received" showing the proof; on return from
  the UPI app (AppState active) prompt to upload screenshot.
- `app/report.tsx` (root) → `<Redirect href="/analytics" />`.
- `app/(tabs)/_layout.tsx`: session guard (Redirect `/login`), `useTripSync`, TripTopBar, `Tabs` with custom tab bar,
  `animation: 'shift'`, transparent `sceneStyle`, shared LiquidBackground; tabs in web order:
  dashboard, members, expenses, settlements (label "Payments"), analytics (label "Report").
- `app/(tabs)/dashboard.tsx`, `members.tsx`, `expenses.tsx`: web parity (see web pages) + pull-to-refresh;
  expenses cards show bill thumbnails + "Add bill"; swipe-to-delete; FAB → add-expense. Dashboard: UPI-ID nudge.
- `app/(tabs)/settlements.tsx` = web Payments page + "Pay/Settle" → payment-modal, proof thumbnails, history.
- New `app/(tabs)/analytics.tsx` = web Report page (KPIs, budget, insights, donut, daily bars, allocation, member
  contribution, ranking, member analytics rings, timeline, settlement summary) + Export PDF (expo-print + expo-sharing).
- New `app/viewer.tsx` (attachment viewer: pinch/double-tap zoom, pan, swipe-down close, upload status/retry, delete).
- New `app/+not-found.tsx` → redirect home.

### G. Config
- `mobile/app.json`: version **4.0.0**, android `versionCode: 400`, ios buildNumber "4.0.0",
  `backgroundColor: "#FDF9F2"`, `icon: ./assets/images/icon.png`, android.adaptiveIcon
  `{ foregroundImage: adaptive-foreground.png, backgroundImage: adaptive-background.png, monochromeImage:
  adaptive-monochrome.png, backgroundColor: "#F2567C" }`, splash plugin `{ backgroundColor: "#FDF9F2",
  image: ./assets/images/splash-icon.png, imageWidth: 288 }`, add `expo-image-picker` plugin (permission strings,
  `microphonePermission: false`), **remove `expo-background-task`**, keep owner / projectId / updates / runtimeVersion
  (appVersion policy → the version bump prevents OTA updates reaching old binaries without the new native modules).
- `mobile/.env.example` with `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_WEB_URL`;
  document `eas env:create` for preview/production.
- `mobile/tsconfig.json`: exclude `__tests__`, `**/*.test.ts`, `vitest.config.mts`.
- Root `tsconfig.json`: add `"mobile"` to `exclude`.

### H. Supabase migration — `supabase/migrations/20260923_mobile_media.sql` (+ append to `supabase/schema.sql`)
- Bucket `trip-media`: public, 5 MB, `image/jpeg,image/png,image/webp` (`INSERT … ON CONFLICT (id) DO UPDATE`).
- `storage.objects` policies (idempotent via `pg_policies` checks): INSERT for anon/authenticated when
  `bucket_id='trip-media'` AND first folder is an existing `trips.id` AND name matches
  `^<uuid>/(bills|payments)/<uuid>\.(jpg|jpeg|png|webp)$`; SELECT + DELETE only for **orphaned** objects
  (`NOT EXISTS (SELECT 1 FROM public.attachments a WHERE a.storage_path = name)`).
- Table `attachments` (see §5 types / remote.ts insert), FKs: trip CASCADE, expense CASCADE, hotel_expense CASCADE,
  members CASCADE / uploaded_by SET NULL; CHECK target per kind; indexes; RLS allow_all for anon (matches schema);
  add to `supabase_realtime` publication (ignore duplicate).
- Functions (SECURITY INVOKER, idempotent `ON CONFLICT DO NOTHING`, GRANT EXECUTE to anon, authenticated):
  `tm_push_expense(p_expense jsonb, p_participants jsonb)`, `tm_push_hotel_expense(p_hotel jsonb, p_rooms jsonb)`
  (loop rooms; non-UUID room id → uuid_generate_v4()), `tm_push_settlement_group(p_group jsonb, p_member_ids jsonb)`.

### I. Tests (run with ROOT vitest)
- `mobile/vitest.config.mts` (node env, include `mobile/__tests__/**/*.test.ts`, alias/mocks).
- `mobile/__tests__/parity.test.ts`: randomized scenarios → web `src/lib/utils` vs mobile `mobile/src/lib/utils`
  identical balances/settlements/applyConfirmedTransfers; invite tokens web↔mobile round-trip (incl. emoji names).
- `mobile/__tests__/store.test.ts`: `vi.mock` AsyncStorage + `../src/lib/remote`; create trip, expenses,
  confirm cascade, merge (pending delete not resurrected, UPI edit not reverted, incomplete remote expense keeps local
  participants), v0→v4 migration, attachment cascade on delete.
- Command: `npx vitest run --config mobile/vitest.config.mts` (from repo root). Also keep `npm test` (web) green.

### J. Verification
`cd mobile && npx tsc --noEmit` · root `npx tsc --noEmit` · `npx expo-doctor` · `npx expo export --platform android`
(bundles; catches import errors) · visual QA: `npx expo start --web` + Chrome DevTools MCP screenshots of every screen.

### K. Docs + handoff
Update `mobile/README.md` (env vars, EAS env, migration, build). Final report to the user: what changed, how to set
Supabase vars (user must supply URL + anon key — the web's Vercel env values), run the SQL migration, and **ask before
`eas build -p android --profile preview`**.
