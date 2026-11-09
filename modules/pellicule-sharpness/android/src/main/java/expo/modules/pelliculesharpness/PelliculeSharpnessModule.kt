package expo.modules.pelliculesharpness

import android.content.ContentUris
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.provider.MediaStore
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

// Mesure de netteté d'une photo, sur une miniature en niveaux de gris
// (côté le plus long = 512 px). 4 mesures (GRAND = net, PETIT = flou) :
//   lap  = variance du Laplacien de toute l'image (la mesure d'origine, aussi renvoyée en `score`)
//   top  = idem, moyenne des 4 cases les plus nettes d'une grille 4 × 4
//          (un portrait net sur fond lisse n'est plus pénalisé par le fond)
//   lap2 / lap4 = lap de l'image réduite 2 fois / 4 fois (pour comparer détail fin et gros détail)
// Leur usage est choisi côté JS : services/blurMetrics.js + constants/blurConfig.js (BLUR_METRIC).
// Même formule que sur iOS (PelliculeSharpnessModule.swift) : si tu en
// changes une, change l'autre et monte la version dans constants/blurConfig.js.

private const val THUMB_SIDE = 512

class PelliculeSharpnessModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("PelliculeSharpness")

    // id = asset.id d'expo-media-library (= _id MediaStore sur Android).
    // Renvoie { score, lap, top, lap2, lap4, width, height } ou null si la photo n'est pas lisible.
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

    val lap = laplacianVariance(gray, w, h)
    val top = topTiles(gray, w, h)
    val (g2, w2, h2) = halve(gray, w, h)
    val lap2 = if (w2 >= 3 && h2 >= 3) laplacianVariance(g2, w2, h2) else 0.0
    val (g4, w4, h4) = halve(g2, w2, h2)
    val lap4 = if (w4 >= 3 && h4 >= 3) laplacianVariance(g4, w4, h4) else 0.0

    return mapOf(
      "score" to lap, "lap" to lap, "top" to top, "lap2" to lap2, "lap4" to lap4,
      "width" to w, "height" to h
    )
  }

  // Grille 4 × 4 : variance du Laplacien de chaque case, puis moyenne des 4 meilleures (le quart le plus net).
  private fun topTiles(g: IntArray, w: Int, h: Int): Double {
    val vals = ArrayList<Double>(16)
    for (ty in 0 until 4) {
      for (tx in 0 until 4) {
        val x0 = maxOf(1, tx * w / 4)
        val x1 = minOf(w - 1, (tx + 1) * w / 4)
        val y0 = maxOf(1, ty * h / 4)
        val y1 = minOf(h - 1, (ty + 1) * h / 4)
        if (x1 - x0 >= 2 && y1 - y0 >= 2) vals.add(lapVarRegion(g, w, x0, y0, x1, y1))
      }
    }
    if (vals.isEmpty()) return 0.0
    vals.sortDescending()
    val k = maxOf(1, vals.size / 4)
    var sum = 0.0
    for (i in 0 until k) sum += vals[i]
    return sum / k
  }

  // Image réduite de moitié (moyenne de chaque bloc de 2 × 2 pixels).
  private fun halve(g: IntArray, w: Int, h: Int): Triple<IntArray, Int, Int> {
    val nw = w / 2
    val nh = h / 2
    val out = IntArray(maxOf(0, nw * nh))
    for (y in 0 until nh) {
      val r0 = 2 * y * w
      val r1 = r0 + w
      for (x in 0 until nw) {
        val c = 2 * x
        out[y * nw + x] = (g[r0 + c] + g[r0 + c + 1] + g[r1 + c] + g[r1 + c + 1]) / 4
      }
    }
    return Triple(out, nw, nh)
  }

  // Filtre Laplacien 3x3 (voisins haut/bas/gauche/droite − 4 × centre), puis
  // variance des résultats. Une photo nette a des contours francs → grande variance.
  private fun laplacianVariance(g: IntArray, w: Int, h: Int): Double =
    lapVarRegion(g, w, 1, 1, w - 1, h - 1)

  // Même calcul limité à une zone : x de x0 à x1 (exclu), y de y0 à y1 (exclu), sans toucher les bords de l'image.
  private fun lapVarRegion(g: IntArray, w: Int, x0: Int, y0: Int, x1: Int, y1: Int): Double {
    var sum = 0L
    var sumSq = 0L
    for (y in y0 until y1) {
      val row = y * w
      for (x in x0 until x1) {
        val i = row + x
        val v = g[i - 1] + g[i + 1] + g[i - w] + g[i + w] - 4 * g[i]
        sum += v
        sumSq += v.toLong() * v
      }
    }
    val n = ((x1 - x0) * (y1 - y0)).toDouble()
    if (n < 1) return 0.0
    val mean = sum / n
    return sumSq / n - mean * mean
  }
}
