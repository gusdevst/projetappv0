package expo.modules.pellicule.labels

import android.content.ContentUris
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.provider.MediaStore
import com.google.android.gms.tasks.Tasks
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.label.ImageLabeling
import com.google.mlkit.vision.label.defaults.ImageLabelerOptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

// Étiquettes de contenu d'une photo (« Beach », « Dog », « Child »…), calculées SUR LE TÉLÉPHONE
// avec ML Kit Image Labeling (modèle embarqué). Miniature 512 px (comme le module de netteté).
// Les étiquettes sont en anglais. Même contrat que sur iOS (PelliculeLabelsModule.swift) :
// si tu changes l'un, change l'autre.

private const val THUMB_SIDE = 512
private const val MAX_LABELS = 12
private const val MIN_CONFIDENCE = 0.05f  // le tri fin se fait côté JS

class PelliculeLabelsModule : Module() {
  // Le « labeler » se crée une fois (coûteux) et se réutilise.
  private val labeler by lazy {
    ImageLabeling.getClient(ImageLabelerOptions.Builder().setConfidenceThreshold(MIN_CONFIDENCE).build())
  }

  override fun definition() = ModuleDefinition {
    Name("PelliculeLabels")

    // id = asset.id d'expo-media-library (= _id MediaStore sur Android).
    // Renvoie { labels: [{ text, confidence }], width, height } ou null si la photo n'est pas lisible.
    AsyncFunction("getLabels") { id: String ->
      classify(id)
    }
  }

  private fun classify(id: String): Map<String, Any>? {
    val context = appContext.reactContext ?: throw IllegalStateException("Contexte React indisponible")
    val assetId = id.toLongOrNull() ?: return null
    val uri = ContentUris.withAppendedId(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, assetId)
    val resolver = context.contentResolver

    // 1) Dimensions sans décoder.
    val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
    val boundsStream = resolver.openInputStream(uri) ?: return null
    boundsStream.use { BitmapFactory.decodeStream(it, null, bounds) }
    if (bounds.outWidth <= 0 || bounds.outHeight <= 0) return null

    // 2) Décodage réduit (puissance de 2), côté long >= 512 px.
    var sample = 1
    while (maxOf(bounds.outWidth, bounds.outHeight) / (sample * 2) >= THUMB_SIDE) sample *= 2
    val decodeOpts = BitmapFactory.Options().apply { inSampleSize = sample }
    val decodeStream = resolver.openInputStream(uri) ?: return null
    val decoded = decodeStream.use { BitmapFactory.decodeStream(it, null, decodeOpts) } ?: return null

    // 3) Réduction exacte : côté long = 512 px.
    val longSide = maxOf(decoded.width, decoded.height)
    val bmp: Bitmap = if (longSide > THUMB_SIDE) {
      val ratio = THUMB_SIDE.toFloat() / longSide
      val nw = maxOf(1, Math.round(decoded.width * ratio))
      val nh = maxOf(1, Math.round(decoded.height * ratio))
      Bitmap.createScaledBitmap(decoded, nw, nh, true).also { if (it !== decoded) decoded.recycle() }
    } else decoded

    val w = bmp.width
    val h = bmp.height
    return try {
      // On est déjà hors du fil principal (AsyncFunction) : on peut attendre le résultat.
      val result = Tasks.await(labeler.process(InputImage.fromBitmap(bmp, 0)))
      val labels = result
        .sortedByDescending { it.confidence }
        .take(MAX_LABELS)
        .map { mapOf("text" to it.text, "confidence" to it.confidence.toDouble()) }
      mapOf("labels" to labels, "width" to w, "height" to h)
    } finally {
      bmp.recycle()
    }
  }
}
