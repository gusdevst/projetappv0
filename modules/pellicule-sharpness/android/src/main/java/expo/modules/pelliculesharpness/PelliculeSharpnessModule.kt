package expo.modules.pelliculesharpness

import android.content.ContentUris
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.provider.MediaStore
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

// Mesure de netteté d'une photo : variance du Laplacien sur une miniature
// en niveaux de gris (côté le plus long = 512 px). Score bas = photo floue.
// Même formule que sur iOS (PelliculeSharpnessModule.swift) : si tu en
// changes une, change l'autre et monte la version dans constants/blurConfig.js.

private const val THUMB_SIDE = 512

class PelliculeSharpnessModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("PelliculeSharpness")

    // id = asset.id d'expo-media-library (= _id MediaStore sur Android).
    // Renvoie { score, width, height } ou null si la photo n'est pas lisible.
    AsyncFunction("getSharpness") { id: String ->
      measure(id)
    }
  }

  private fun measure(id: String): Map<String, Any>? {
    val context = appContext.reactContext ?: throw IllegalStateException("Contexte React indisponible")
    val assetId = id.toLongOrNull() ?: return null
    val uri = ContentUris.withAppendedId(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, assetId)
    val resolver = context.contentResolver

    // 1) Dimensions de la photo, sans la décoder.
    val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
    val boundsStream = resolver.openInputStream(uri) ?: return null
    boundsStream.use { BitmapFactory.decodeStream(it, null, bounds) }
    if (bounds.outWidth <= 0 || bounds.outHeight <= 0) return null

    // 2) Décodage réduit (puissance de 2) : le côté long reste >= 512 px.
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
    if (w < 3 || h < 3) { bmp.recycle(); return null }

    // 4) Niveaux de gris (même pondération qu'iOS).
    val pixels = IntArray(w * h)
    bmp.getPixels(pixels, 0, w, 0, 0, w, h)
    bmp.recycle()
    val gray = IntArray(w * h)
    for (i in pixels.indices) {
      val p = pixels[i]
      val r = (p shr 16) and 0xFF
      val g = (p shr 8) and 0xFF
      val b = p and 0xFF
      gray[i] = (299 * r + 587 * g + 114 * b) / 1000
    }

    return mapOf("score" to laplacianVariance(gray, w, h), "width" to w, "height" to h)
  }

  // Filtre Laplacien 3x3 (voisins haut/bas/gauche/droite − 4 × centre), puis
  // variance des résultats. Une photo nette a des contours francs → grande variance.
  private fun laplacianVariance(g: IntArray, w: Int, h: Int): Double {
    var sum = 0L
    var sumSq = 0L
    for (y in 1 until h - 1) {
      val row = y * w
      for (x in 1 until w - 1) {
        val i = row + x
        val v = g[i - 1] + g[i + 1] + g[i - w] + g[i + w] - 4 * g[i]
        sum += v
        sumSq += v.toLong() * v
      }
    }
    val n = ((w - 2) * (h - 2)).toDouble()
    val mean = sum / n
    return sumSq / n - mean * mean
  }
}
