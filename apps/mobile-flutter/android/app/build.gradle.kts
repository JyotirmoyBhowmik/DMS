plugins {
    id("com.android.application")
    id("kotlin-android")
    // The Flutter Gradle Plugin must be applied after the Android and Kotlin Gradle plugins.
    id("dev.flutter.flutter-gradle-plugin")
}

android {
    // DMS SFA domain namespace
    namespace = "com.dms.sfa"
    compileSdk = flutter.compileSdkVersion
    ndkVersion = flutter.ndkVersion

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
        // Support modern Java features across older Android devices
        isCoreLibraryDesugaringEnabled = true
    }

    defaultConfig {
        // Unique DMS SFA Application ID for Google Play Console deployment
        applicationId = "com.dms.sfa"
        
        // Min SDK 21 required for background tracking, Bluetooth printing & offline DBs
        minSdk = 21
        targetSdk = flutter.targetSdkVersion
        versionCode = flutter.versionCode
        versionName = flutter.versionName

        // Prevents 64k method limit issues common in DMS apps (Maps, Barcode, Sync, DBs)
        multiDexEnabled = true
    }

    // Build flavors for environment isolated testing
    flavorDimensions.add("environment")
    productFlavors {
        create("dev") {
            dimension = "environment"
            applicationIdSuffix = ".dev"
            resValue("string", "app_name", "ZemY Dev")
        }
        create("staging") {
            dimension = "environment"
            applicationIdSuffix = ".staging"
            resValue("string", "app_name", "ZemY Staging")
        }
        create("prod") {
            dimension = "environment"
            resValue("string", "app_name", "ZemY SFA")
        }
    }

    buildTypes {
        release {
            // Obfuscates code to protect business logic, local databases, and API keys
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
            
            // TODO: Replace with production signing config before releasing to Play Store
            signingConfig = signingConfigs.getByName("debug")
        }
        debug {
            applicationIdSuffix = ".debug"
        }
    }
}

kotlin {
    compilerOptions {
        jvmTarget = org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17
    }
}

flutter {
    source = "../.."
}

dependencies {
    coreLibraryDesugaring("com.android.tools:desugar_jdk_libs:2.0.4")
}