plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "dev.dshmobile.validation"
    compileSdk = 35
    defaultConfig {
        applicationId = "dev.dshmobile.validation"
        minSdk = 28
        targetSdk = 35
        versionCode = 2
        versionName = "0.1.0-ordinary"
        testInstrumentationRunner = "dev.dshmobile.validation.OrdinarySecurityInstrumentation"
    }
    buildFeatures { buildConfig = true }
    // 手机可在中英文间离线切换，语言资源必须随每份安装包交付。
    bundle { language { enableSplit = false } }
    // 独立配对验收包使用另一个 UID/存储，不能为了测未绑定入口清除用户数据。
    buildTypes.getByName("debug") {
        if (providers.gradleProperty("isolatedPairingTest").orNull == "true") applicationIdSuffix = ".pairingtest"
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
    sourceSets["main"].assets.srcDir(layout.buildDirectory.dir("generated/webAssets"))
}

// 同一个已验证的 Web 产物进入 APK，避免另维护一套插件加载逻辑。
val syncWebAssets by tasks.registering(Sync::class) {
    from("../../dist") { exclude("bundle-analysis.json") }
    into(layout.buildDirectory.dir("generated/webAssets/web"))
    doFirst {
        check(file("../../dist/index.html").exists()) { "Run npm run build:web first" }
    }
}
tasks.named("preBuild").configure { dependsOn(syncWebAssets) }

dependencies {
    implementation("com.journeyapps:zxing-android-embedded:4.3.0")
    implementation("androidx.webkit:webkit:1.12.1")
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    implementation("com.nimbusds:nimbus-jose-jwt:9.47")
}
