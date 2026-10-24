const fs = require('fs');
const path = require('path');
const {
  withAndroidManifest,
  withMainApplication,
  withDangerousMod,
} = require('expo/config-plugins');

const KOTLIN_SOURCE = `package br.com.painelprime.app

import android.app.Activity
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Bundle
import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.facebook.react.uimanager.ViewManager
import java.lang.ref.WeakReference
import java.util.UUID

object WhatsAppOtpStore {
  private const val PREFS_NAME = "painelprime_whatsapp_zero_tap"
  private const val KEY_HANDSHAKE_IDS = "handshake_ids"
  private const val KEY_PENDING_CODE = "pending_code"
  private const val KEY_PENDING_TS = "pending_ts"
  private const val MAX_HANDSHAKE_AGE_MS = 15 * 60 * 1000L

  private val WHATSAPP_PACKAGES = setOf("com.whatsapp", "com.whatsapp.w4b")

  @Volatile
  private var reactContextRef: WeakReference<ReactApplicationContext>? = null

  fun attachReactContext(context: ReactApplicationContext) {
    reactContextRef = WeakReference(context)
  }

  fun startHandshake(context: Context): String {
    val appContext = context.applicationContext
    val requestId = UUID.randomUUID().toString()
    saveHandshakeId(appContext, requestId)

    for (pkg in WHATSAPP_PACKAGES) {
      try {
        val listenIntent = Intent("com.whatsapp.otp.OTP_REQUESTED").apply {
          setPackage(pkg)
        }
        val piFlags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
          PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        } else {
          PendingIntent.FLAG_UPDATE_CURRENT
        }
        val callerPendingIntent = PendingIntent.getActivity(appContext, 0, listenIntent, piFlags)
        val extras = Bundle().apply {
          putParcelable("_ci_", callerPendingIntent)
          putString("SDK_VERSION", "1.0.0")
          putString("request_id", requestId)
        }
        listenIntent.putExtras(extras)
        appContext.sendBroadcast(listenIntent)
      } catch (_: Throwable) {
        // Ignora silenciosamente se uma variante do WhatsApp não estiver instalada
      }
    }

    return requestId
  }

  fun handleIncomingOtpIntent(context: Context, intent: Intent?): String? {
    if (intent == null || intent.action != "com.whatsapp.otp.OTP_RETRIEVED") {
      return null
    }

    val appContext = context.applicationContext
    val callerIntent: PendingIntent? = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      intent.getParcelableExtra("_ci_", PendingIntent::class.java)
    } else {
      @Suppress("DEPRECATION")
      intent.getParcelableExtra("_ci_")
    }

    val creatorPkg = callerIntent?.creatorPackage
    val incomingRequestId = intent.getStringExtra("request_id")?.trim()
    val hasValidCreator = creatorPkg != null && WHATSAPP_PACKAGES.contains(creatorPkg)
    val hasValidRequestId = !incomingRequestId.isNullOrEmpty() && isKnownHandshakeId(appContext, incomingRequestId)

    if (!hasValidCreator && !hasValidRequestId) {
      return null
    }

    val rawCode = intent.getStringExtra("code") ?: intent.getStringExtra("otp_code") ?: return null
    val digits = rawCode.filter { it.isDigit() }
    if (digits.length != 6) {
      return null
    }

    savePendingCode(appContext, digits)
    emitToJs(digits)
    return digits
  }

  fun consumePendingCode(context: Context): String? {
    val prefs = context.applicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    val code = prefs.getString(KEY_PENDING_CODE, null) ?: return null
    val ts = prefs.getLong(KEY_PENDING_TS, 0L)
    prefs.edit().remove(KEY_PENDING_CODE).remove(KEY_PENDING_TS).apply()
    if (System.currentTimeMillis() - ts > MAX_HANDSHAKE_AGE_MS) {
      return null
    }
    return code
  }

  private fun savePendingCode(context: Context, code: String) {
    context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
      .edit()
      .putString(KEY_PENDING_CODE, code)
      .putLong(KEY_PENDING_TS, System.currentTimeMillis())
      .apply()
  }

  private fun saveHandshakeId(context: Context, id: String) {
    val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    val existing = (prefs.getStringSet(KEY_HANDSHAKE_IDS, emptySet()) ?: emptySet()).toMutableList()
    existing.add(id)
    val trimmed = if (existing.size > 8) existing.takeLast(8).toSet() else existing.toSet()
    prefs.edit().putStringSet(KEY_HANDSHAKE_IDS, trimmed).apply()
  }

  private fun isKnownHandshakeId(context: Context, id: String): Boolean {
    val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    val existing = prefs.getStringSet(KEY_HANDSHAKE_IDS, emptySet()) ?: emptySet()
    return existing.contains(id)
  }

  private fun emitToJs(code: String) {
    try {
      val reactContext = reactContextRef?.get() ?: return
      if (reactContext.hasActiveReactInstance()) {
        reactContext
          .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
          .emit("WhatsAppZeroTapOtp", code)
      }
    } catch (_: Throwable) {
      // Código permanece salvo em SharedPreferences para consumo no próximo ciclo ativo
    }
  }
}

class WhatsAppOtpReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent?) {
    if (intent?.action == "com.whatsapp.otp.OTP_RETRIEVED") {
      WhatsAppOtpStore.handleIncomingOtpIntent(context, intent)
    }
  }
}

class WhatsAppOtpActivity : Activity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    WhatsAppOtpStore.handleIncomingOtpIntent(this, intent)
    try {
      val launchIntent = packageManager.getLaunchIntentForPackage(packageName)?.apply {
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP)
      }
      if (launchIntent != null) {
        startActivity(launchIntent)
      }
    } catch (_: Throwable) {
      // Ignora falha ao retomar activity principal
    } finally {
      finish()
    }
  }
}

class WhatsAppOtpModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
  init {
    WhatsAppOtpStore.attachReactContext(reactContext)
  }

  override fun initialize() {
    super.initialize()
    WhatsAppOtpStore.attachReactContext(reactApplicationContext)
  }

  override fun getName(): String = "WhatsAppZeroTap"

  @ReactMethod
  fun startHandshake(promise: Promise) {
    try {
      val requestId = WhatsAppOtpStore.startHandshake(reactApplicationContext)
      promise.resolve(requestId)
    } catch (err: Throwable) {
      promise.resolve(null)
    }
  }

  @ReactMethod
  fun consumePendingCode(promise: Promise) {
    try {
      val code = WhatsAppOtpStore.consumePendingCode(reactApplicationContext)
      promise.resolve(code)
    } catch (err: Throwable) {
      promise.resolve(null)
    }
  }

  @ReactMethod
  fun addListener(eventName: String) {
    // Requerido pelo NativeEventEmitter do React Native
  }

  @ReactMethod
  fun removeListeners(count: Int) {
    // Requerido pelo NativeEventEmitter do React Native
  }
}

class WhatsAppOtpPackage : ReactPackage {
  override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> {
    return listOf(WhatsAppOtpModule(reactContext))
  }

  override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> {
    return emptyList()
  }
}
`;

function withWhatsAppZeroTapManifest(config) {
  return withAndroidManifest(config, (modConfig) => {
    const manifest = modConfig.modResults.manifest;

    if (!manifest.queries) {
      manifest.queries = [{}];
    }
    const queriesObj = manifest.queries[0];
    if (!queriesObj.package) {
      queriesObj.package = [];
    }
    for (const pkgName of ['com.whatsapp', 'com.whatsapp.w4b']) {
      const exists = queriesObj.package.some(
        (entry) => entry.$ && entry.$['android:name'] === pkgName,
      );
      if (!exists) {
        queriesObj.package.push({ $: { 'android:name': pkgName } });
      }
    }

    const app = manifest.application && manifest.application[0];
    if (app) {
      if (!app.receiver) {
        app.receiver = [];
      }
      const receiverExists = app.receiver.some(
        (r) => r.$ && r.$['android:name'] === '.WhatsAppOtpReceiver',
      );
      if (!receiverExists) {
        app.receiver.push({
          $: {
            'android:name': '.WhatsAppOtpReceiver',
            'android:enabled': 'true',
            'android:exported': 'true',
          },
          'intent-filter': [
            {
              action: [
                { $: { 'android:name': 'com.whatsapp.otp.OTP_RETRIEVED' } },
                { $: { 'android:name': 'com.whatsapp.otp.OTP_ERROR' } },
              ],
            },
          ],
        });
      }

      if (!app.activity) {
        app.activity = [];
      }
      const activityExists = app.activity.some(
        (a) => a.$ && a.$['android:name'] === '.WhatsAppOtpActivity',
      );
      if (!activityExists) {
        app.activity.push({
          $: {
            'android:name': '.WhatsAppOtpActivity',
            'android:enabled': 'true',
            'android:exported': 'true',
            'android:excludeFromRecents': 'true',
            'android:theme': '@android:style/Theme.NoDisplay',
          },
          'intent-filter': [
            {
              action: [
                { $: { 'android:name': 'com.whatsapp.otp.OTP_RETRIEVED' } },
              ],
            },
          ],
        });
      }
    }

    return modConfig;
  });
}

function withWhatsAppZeroTapMainApplication(config) {
  return withMainApplication(config, (modConfig) => {
    let contents = modConfig.modResults.contents;
    if (!contents.includes('WhatsAppOtpPackage')) {
      if (contents.includes('PackageList(this).packages.apply {')) {
        contents = contents.replace(
          'PackageList(this).packages.apply {',
          'PackageList(this).packages.apply {\n              add(WhatsAppOtpPackage())',
        );
      } else if (contents.includes('val packages = PackageList(this).packages')) {
        contents = contents.replace(
          'val packages = PackageList(this).packages',
          'val packages = PackageList(this).packages.toMutableList().apply { add(WhatsAppOtpPackage()) }',
        );
      }
      modConfig.modResults.contents = contents;
    }
    return modConfig;
  });
}

function withWhatsAppZeroTapSource(config) {
  return withDangerousMod(config, [
    'android',
    async (modConfig) => {
      const packagePath = path.join(
        modConfig.modRequest.platformProjectRoot,
        'app',
        'src',
        'main',
        'java',
        'br',
        'com',
        'painelprime',
        'app',
      );
      fs.mkdirSync(packagePath, { recursive: true });
      fs.writeFileSync(
        path.join(packagePath, 'WhatsAppOtpBridge.kt'),
        KOTLIN_SOURCE,
        'utf8',
      );
      return modConfig;
    },
  ]);
}

module.exports = function withWhatsAppZeroTapOtp(config) {
  config = withWhatsAppZeroTapManifest(config);
  config = withWhatsAppZeroTapMainApplication(config);
  config = withWhatsAppZeroTapSource(config);
  return config;
};
