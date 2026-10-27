# AURENYX VAELOR — Google Play Internal Testing & Android Build Guide

> **Official Founding Attribution:**  
> *“AURENYX VAELOR — Founded by The Aether Vanguard, founded by Arenyx Sol Kael.”*  
> **Application ID:** `org.aethervanguard.aurenyxvaelor` • **Version:** `0.1.0` (`versionCode = 1`) • **Target SDK:** `35` (Android 15)

---

## 1. Honest Publication & Verification Status

- **What has been built and verified in this workspace:**
  - Native Kotlin + Jetpack Compose Android project under `/android` (`minSdk = 26`, `targetSdk = 35`, `compileSdk = 35`).
  - Zero hardcoded API keys or server secrets in Kotlin source, XML resources, assets, `BuildConfig`, or compiled APK.
  - Dual gateway architecture:
    1. **Secure Backend Orchestration (`VaelorBackendClient`)**: Calls your HTTPS Express/Cloud Run backend (`/api/chat`, `/api/health`, `/api/session/purge`) with input validation, server-side sliding-window rate limits, tool permission allowlists, and sanitized error payloads.
    2. **Firebase AI Logic + Play Integrity App Check (`FirebaseAiLogicGateway`)**: Ready for direct client Gemini calls once you attach your own Firebase project (`google-services.json`) and enable Play Integrity App Check. When `google-services.json` is absent, the app **truthfully reports Firebase AI Logic as Unavailable** rather than faking responses.
  - Private on-device chat storage (`filesDir/private_conversations/vaelor_private_store_v1.json`) with `android:allowBackup="false"`, Android 12+ `data_extraction_rules.xml` cloud-backup exclusions, per-thread deletion, and a **Delete All Private History** confirmation dialog.
  - Embedded offline **AURENYX TRUSTGRID** provisional risk scorer (`TG-PROVISIONAL-0.1`) and zero-`eval` safe calculator.
- **What has NOT been done automatically (requires your manual owner credentials):**
  - **Not published to Google Play:** Submitting an `.aab` to Google Play Internal Testing requires a personal or organization **Google Play Console** account (Google charges a one-time $25 developer registration fee outside software tooling) and your private upload keystore.

---

## 2. Building From an Android Phone (Zero-Desktop GitHub Actions Workflow)

If your primary device is an Android phone:
1. Download the Android source archive directly from `/android` inside the web app (`/api/android/source-bundle.tar.gz`) or push this repository to a free GitHub repository.
2. Open the **Actions** tab on GitHub Mobile and run **Aurenyx Vaelor Android CI** (`.github/workflows/android-ci.yml`).
3. Download `aurenyx-vaelor-debug-apk` to install and test directly on your Android phone, or configure signing secrets (Section 4) to produce a signed `app-release.aab` for Google Play Internal Testing.

---

## 3. Optional: Enabling Direct Firebase AI Logic + App Check

To activate the direct Firebase AI Logic mode without exposing an API key:
1. Open the [Firebase Console](https://console.firebase.google.com/) (Spark ₹0 free tier supported for App Check + supported Gemini free quotas) and create a project.
2. Register an Android app with package name `org.aethervanguard.aurenyxvaelor` and add your upload/debug SHA-256 certificate fingerprint.
3. Download `google-services.json` and place it at `android/app/google-services.json` (gitignored so project identifiers stay private).
4. In Firebase Console → **App Check**, register your Android app with **Play Integrity** and enforce App Check for **Firebase AI Logic**.
5. In Firebase Console → **AI Logic**, enable the **Gemini Developer API** backend. `android/app/build.gradle.kts` automatically detects `google-services.json` and activates `com.google.gms.google-services`.

---

## 4. Generating Your Upload Keystore & Signed `.aab`

Never commit `.jks` or `keystore.properties` to Git.

```bash
keytool -genkeypair -v \
  -keystore vaelor-upload-key.jks \
  -keyalg RSA -keysize 2048 -validity 10000 \
  -alias vaelor-upload
```

Copy `android/keystore.properties.example` to `android/keystore.properties`:

```properties
storeFile=/absolute/path/to/vaelor-upload-key.jks
storePassword=YOUR_STORE_PASSWORD
keyAlias=vaelor-upload
keyPassword=YOUR_KEY_PASSWORD
```

Then build the signed Android App Bundle (`.aab`) with R8 minification and resource shrinking enabled:

```bash
cd android
gradle bundleRelease \
  -PVAELOR_BACKEND_URL="https://your-production-backend.run.app"
```

Output path: `android/app/build/outputs/bundle/release/app-release.aab`.

---

## 5. Remaining Manual Steps in Google Play Console (Internal Testing)

1. **Create App:** Sign in to Google Play Console → **Create app** → App name: `AURENYX VAELOR`, Default language: `English`, App or game: `App`, Free or paid: `Free`.
2. **Play App Signing:** Navigate to **Test and release → Testing → Internal testing → Create new release** and accept **Play App Signing**.
3. **Upload Bundle:** Upload `app-release.aab`, set release name `0.1.0 (1)`, and paste honest release notes noting Version 0.1 capabilities and provisional TrustGrid risk scoring.
4. **App Content Declarations:**
   - **Privacy Policy:** Host your customized `/privacy` policy URL (review the starter template on `/privacy` before publishing).
   - **Data Safety Form:**
     - *Chat prompts*: Sent over TLS (`HTTPS`) to your backend / Firebase AI Logic ephemerally to generate responses; not sold or shared with third-party advertisers.
     - *Chat history*: Stored locally on-device only; users can delete individual threads or wipe all history inside **Privacy → Delete All Private History**.
   - **App Access:** No login wall required for core testing; provide reviewer instructions if your backend uses custom rate limits.
   - **Content Rating & Target Audience:** Complete the IARC questionnaire (Utility / Productivity AI assistant; target audience 18+ or 13+ per your policy).
   - **Government / Financial / Health Disclosures:** Confirm the app does not provide regulated medical, legal, or financial execution.
5. **Add Internal Testers:** Create an email list of up to 100 internal testers, save, click **Review release → Start rollout to Internal testing**, and share the Play Store opt-in link with your testers.
