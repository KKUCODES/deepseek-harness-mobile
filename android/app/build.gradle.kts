plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

val latestCompatibilityTest = providers.gradleProperty("latestCompatibilityTest").orNull == "true"
val latestOfficeLifetimeTest = providers.gradleProperty("latestOfficeLifetimeTest").orNull == "true"
val latestCordisPeerTest = providers.gradleProperty("latestCordisPeerTest").orNull == "true"
val latestNoticeLifecycleTest = providers.gradleProperty("latestNoticeLifecycleTest").orNull == "true"
val latestFinalTest = providers.gradleProperty("latestFinalTest").orNull == "true"
val officialPluginOnlyTest = providers.gradleProperty("officialPluginOnlyTest").orNull == "true"
val officialDshVersion = providers.gradleProperty("officialDshVersion").orNull ?: "0.2.1-alpha.1"
check(officialDshVersion in listOf("0.2.1-alpha.1", "0.2.1-alpha.2")) { "Unreviewed official DSH version" }
val officialAlpha2 = officialDshVersion == "0.2.1-alpha.2"
val ciBuild = providers.gradleProperty("ciBuild").orNull == "true"
check(!ciBuild || (officialPluginOnlyTest && latestCompatibilityTest && officialAlpha2)) { "CI requires official alpha.2 assets" }
check(!officialAlpha2 || (officialPluginOnlyTest && latestCompatibilityTest)) { "Alpha.2 requires the isolated official candidate" }
val latestNoticeBaselineAssets = providers.gradleProperty("latestNoticeBaselineAssets").orNull == "true"
check(!latestOfficeLifetimeTest || latestCompatibilityTest) { "Office lifetime validation requires the latest SDK" }
check(!latestCordisPeerTest || latestCompatibilityTest) { "Cordis peer validation requires the latest SDK" }
check(!latestNoticeLifecycleTest || latestCompatibilityTest) { "Notice lifecycle validation requires the latest SDK" }
check(!latestFinalTest || latestCompatibilityTest) { "Final validation requires the latest SDK" }
check(!officialPluginOnlyTest || latestCompatibilityTest) { "Official plugin validation requires the latest SDK" }
check(!latestNoticeBaselineAssets || latestCompatibilityTest) { "Notice baseline assets require the latest SDK" }
check(listOf(latestOfficeLifetimeTest, latestCordisPeerTest, latestNoticeLifecycleTest, latestFinalTest, officialPluginOnlyTest).count { it } <= 1) { "Choose only one latest test package" }
if (ciBuild) layout.buildDirectory.set(file("../../artifacts/ci/android"))
else if (latestCompatibilityTest) layout.buildDirectory.set(file(when {
    latestOfficeLifetimeTest -> "../../artifacts/latest-office-android-build"
    latestCordisPeerTest -> "../../artifacts/latest-cordis-peer-android-build"
    latestNoticeLifecycleTest -> "../../artifacts/latest-notice-android-build"
    latestFinalTest -> "../../artifacts/latest-final-android-build"
    officialPluginOnlyTest -> if (officialAlpha2) "../../artifacts/official-alpha2-android-build" else "../../artifacts/official-android-build"
    else -> "../../artifacts/latest-android-build"
}))

android {
    namespace = "dev.dshmobile.validation"
    compileSdk = 35
    defaultConfig {
        applicationId = "dev.dshmobile.validation"
        minSdk = 28
        targetSdk = 35
        versionCode = 2
        versionName = "0.1.0-ordinary"
        if (ciBuild) {
            val requestedVersion = providers.gradleProperty("ciVersionName").get()
            check(requestedVersion.matches(Regex("[0-9]+\\.[0-9]+\\.[0-9]+(?:-[A-Za-z0-9.-]+)?"))) { "Invalid CI version" }
            versionName = requestedVersion
            versionCode = providers.gradleProperty("ciVersionCode").get().toInt().also {
                check(it in 3..2100000000) { "CI versionCode must increase from the existing candidate" }
            }
        }
        buildConfigField("String", "DSH_SDK_VERSION", "\"${if (latestCompatibilityTest) officialDshVersion else "0.1.6-alpha.2"}\"")
        testInstrumentationRunner = "dev.dshmobile.validation.OrdinarySecurityInstrumentation"
    }
    buildFeatures { buildConfig = true }
    // 手机可在中英文间离线切换，语言资源必须随每份安装包交付。
    bundle { language { enableSplit = false } }
    // 独立配对验收包使用另一个 UID/存储，不能为了测未绑定入口清除用户数据。
    buildTypes.getByName("debug") {
        if (latestCompatibilityTest) applicationIdSuffix = when {
            latestOfficeLifetimeTest -> ".latestofficetest"
            latestCordisPeerTest -> ".latestcordispeer"
            latestNoticeLifecycleTest -> ".latestnoticetest"
            latestFinalTest -> ".latestfinaltest"
            officialPluginOnlyTest -> ".officialtest"
            else -> ".latesttest"
        }
        if (providers.gradleProperty("isolatedPairingTest").orNull == "true") applicationIdSuffix = ".pairingtest"
        check(!(latestCompatibilityTest && providers.gradleProperty("isolatedPairingTest").orNull == "true")) { "Choose only one isolated test package" }
    }
    // 无签名 CI 候选保持测试包 UID；签名与安装验收另行进行。
    if (ciBuild) buildTypes.getByName("release") { applicationIdSuffix = ".officialtest" }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
    sourceSets["main"].assets.srcDir(layout.buildDirectory.dir("generated/webAssets"))
}

// 同一个已验证的 Web 产物进入 APK，避免另维护一套插件加载逻辑。
val webAssets = file(when {
    ciBuild -> "../../artifacts/ci/web"
    officialPluginOnlyTest -> if (officialAlpha2) "../../artifacts/official-alpha2-mobile-dist" else "../../artifacts/official-mobile-dist"
    latestNoticeBaselineAssets -> "../../artifacts/latest-notice-baseline-web"
    latestCompatibilityTest -> "../../artifacts/latest-mobile-dist"
    else -> "../../dist"
})
val syncWebAssets by tasks.registering(Sync::class) {
    from(webAssets) { exclude("bundle-analysis.json") }
    into(layout.buildDirectory.dir("generated/webAssets/web"))
    doFirst {
        check(webAssets.resolve("index.html").exists()) { "Build the selected Web assets first" }
    }
}
tasks.named("preBuild").configure { dependsOn(syncWebAssets) }

dependencies {
    implementation("com.journeyapps:zxing-android-embedded:4.3.0")
    implementation("androidx.webkit:webkit:1.12.1")
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    implementation("com.nimbusds:nimbus-jose-jwt:9.47")
}
