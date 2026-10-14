plugins {
    id("com.android.application")
}

android {
    namespace = "com.moviehub.local.tv"
    compileSdk = 36

    defaultConfig {
        applicationId = "com.moviehub.local.tv"
        minSdk = 23
        targetSdk = 28
        versionCode = 1
        versionName = "1.0.0"
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}
