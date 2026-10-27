import java.util.Properties

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
    id("org.jetbrains.kotlin.plugin.serialization")
}

// Activate Google Services resource injection automatically when google-services.json is provided locally/CI
if (file("google-services.json").exists()) {
    apply(plugin = "com.google.gms.google-services")
}

val keystorePropsFile = rootProject.file("keystore.properties")
val keystoreProps = Properties().apply {
    if (keystorePropsFile.exists()) {
        keystorePropsFile.inputStream().use { load(it) }
    }
}

val configuredBackendUrl = (project.findProperty("VAELOR_BACKEND_URL") as String?)
    ?.trim()
    ?.takeIf { it.isNotEmpty() }
    ?: "https://ais-pre-m7wmxkzqqgbzkjzyfeea4s-887106166292.asia-southeast1.run.app"

android {
    namespace = "org.aethervanguard.aurenyxvaelor"
    compileSdk = 35

    defaultConfig {
        applicationId = "org.aethervanguard.aurenyxvaelor"
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = "0.1.0"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
        vectorDrawables {
            useSupportLibrary = true
        }

        // Public HTTPS orchestration endpoint only — NEVER inject GEMINI_API_KEY into BuildConfig!
        buildConfigField("String", "DEFAULT_BACKEND_URL", "\"$configuredBackendUrl\"")
    }

    signingConfigs {
        create("releaseUpload") {
            val storePath = keystoreProps.getProperty("storeFile")
                ?: System.getenv("VAELOR_UPLOAD_STORE_FILE")
            if (!storePath.isNullOrBlank()) {
                storeFile = file(storePath)
                storePassword = keystoreProps.getProperty("storePassword")
                    ?: System.getenv("VAELOR_UPLOAD_STORE_PASSWORD")
                keyAlias = keystoreProps.getProperty("keyAlias")
                    ?: System.getenv("VAELOR_UPLOAD_KEY_ALIAS")
                keyPassword = keystoreProps.getProperty("keyPassword")
                    ?: System.getenv("VAELOR_UPLOAD_KEY_PASSWORD")
            }
        }
    }

    buildTypes {
        debug {
            isMinifyEnabled = false
            buildConfigField("Boolean", "ALLOW_DEBUG_EMULATOR_HTTP", "true")
        }
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            buildConfigField("Boolean", "ALLOW_DEBUG_EMULATOR_HTTP", "false")
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
            val uploadConfig = signingConfigs.findByName("releaseUpload")
            if (uploadConfig?.storeFile != null) {
                signingConfig = uploadConfig
            }
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }

    packaging {
        resources {
            excludes += "/META-INF/{AL2.0,LGPL2.1}"
        }
    }
}

dependencies {
    val composeBom = platform("androidx.compose:compose-bom:2024.10.01")
    implementation(composeBom)
    debugImplementation(composeBom)

    implementation("androidx.core:core-ktx:1.15.0")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.8.7")
    implementation("androidx.lifecycle:lifecycle-runtime-compose:2.8.7")
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.8.7")
    implementation("androidx.activity:activity-compose:1.9.3")

    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-graphics")
    implementation("androidx.compose.ui:ui-tooling-preview")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.material:material-icons-extended")
    debugImplementation("androidx.compose.ui:ui-tooling")

    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.9.0")
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.7.3")
    implementation("com.squareup.okhttp3:okhttp:4.12.0")

    // Firebase AI Logic + Firebase App Check (Play Integrity in release, Debug provider in debug only)
    implementation(platform("com.google.firebase:firebase-bom:33.16.0"))
    implementation("com.google.firebase:firebase-ai")
    implementation("com.google.firebase:firebase-appcheck-playintegrity")
    debugImplementation("com.google.firebase:firebase-appcheck-debug")

    testImplementation("junit:junit:4.13.2")
    testImplementation("org.jetbrains.kotlinx:kotlinx-coroutines-test:1.9.0")
    testImplementation("com.squareup.okhttp3:mockwebserver:4.12.0")
}
