plugins {
    alias(libs.plugins.android.application)
}

android {
    namespace = "com.example"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.aistudio.jmestoque.bqkrvz"
        minSdk = 24
        targetSdk = 34
        versionCode = 98
        versionName = "9.4.5"
    }

    signingConfigs {
        create("debugConfig") {
            storeFile = file("${rootDir}/debug.keystore")
            storePassword = "android"
            keyAlias = "androiddebugkey"
            keyPassword = "android"
        }
    }

    buildTypes {
        debug {
            // Mantém a chave local; CI sem ela usa a assinatura debug padrão.
            if (rootProject.file("debug.keystore").exists()) {
                signingConfig = signingConfigs.getByName("debugConfig")
            }
        }
        release {
            isMinifyEnabled = false
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_11
        targetCompatibility = JavaVersion.VERSION_11
    }

    buildFeatures {
        buildConfig = true
    }
}

dependencies {
    implementation("androidx.activity:activity:1.8.2")
    implementation("androidx.core:core-ktx:1.12.0")
}
