package expo.modules.specialcalendarhealth

import android.app.Activity
import android.app.AlertDialog
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Bundle

class HealthPermissionsActivity : Activity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    val portuguese = resources.configuration.locales.get(0).language == "pt"
    AlertDialog.Builder(this)
      .setTitle(if (portuguese) "Dados de saúde" else "Health data")
      .setMessage(if (portuguese) "A Special Calendar lê os treinos e totais diários de passos que autorizar. A sincronização envia estes registos para a sua conta na empresa selecionada. Pode revogar o acesso nas definições do Health Connect." else "Special Calendar reads only workouts and daily step totals you authorise. Sync sends these records to your account in the selected company. You can revoke access in Health Connect settings.")
      .setPositiveButton(if (portuguese) "Política de privacidade" else "Privacy policy") { _, _ ->
        val metadata = packageManager.getApplicationInfo(packageName, PackageManager.GET_META_DATA).metaData
        val url = metadata?.getString("sc_health_privacy_url")
        if (url != null && Uri.parse(url).scheme == "https") startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
        finish()
      }
      .setNegativeButton(if (portuguese) "Fechar" else "Close") { _, _ -> finish() }
      .setOnCancelListener { finish() }.show()
  }
}
