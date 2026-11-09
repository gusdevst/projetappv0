import ExpoModulesCore
import Photos
import UIKit

// Mesure de netteté d'une photo, sur une miniature en niveaux de gris
// (côté le plus long = 512 px). 4 mesures (GRAND = net, PETIT = flou) :
//   lap  = variance du Laplacien de toute l'image (la mesure d'origine, aussi renvoyée en `score`)
//   top  = idem, moyenne des 4 cases les plus nettes d'une grille 4 × 4
//          (un portrait net sur fond lisse n'est plus pénalisé par le fond)
//   lap2 / lap4 = lap de l'image réduite 2 fois / 4 fois (pour comparer détail fin et gros détail)
// Leur usage est choisi côté JS : services/blurMetrics.js + constants/blurConfig.js (BLUR_METRIC).
// Même formule que sur Android (PelliculeSharpnessModule.kt) : si tu en
// changes une, change l'autre et monte la version dans constants/blurConfig.js.

private let THUMB_SIDE: CGFloat = 512

public class PelliculeSharpnessModule: Module {
  public func definition() -> ModuleDefinition {
    Name("PelliculeSharpness")

    // id = asset.id d'expo-media-library (= localIdentifier de la photo sur iOS).
    // Renvoie { score, lap, top, lap2, lap4, width, height } ou nil si la photo n'est pas lisible
    // (absente, ou seulement sur iCloud : on ne la télécharge jamais).
    AsyncFunction("getSharpness") { (id: String) -> [String: Any]? in
      return PelliculeSharpnessModule.measure(id: id)
    }
  }

  private static func measure(id: String) -> [String: Any]? {
    return autoreleasepool { () -> [String: Any]? in
      guard let asset = PHAsset.fetchAssets(withLocalIdentifiers: [id], options: nil).firstObject else {
        return nil
      }

      let options = PHImageRequestOptions()
      options.isSynchronous = true            // on est déjà hors du fil principal
      options.isNetworkAccessAllowed = false  // pas de téléchargement iCloud
      options.deliveryMode = .highQualityFormat
      options.resizeMode = .exact

      var cgImage: CGImage?
      PHImageManager.default().requestImage(
        for: asset,
        targetSize: CGSize(width: THUMB_SIDE, height: THUMB_SIDE),
        contentMode: .aspectFit,
        options: options
      ) { image, _ in
        cgImage = image?.cgImage
      }

      guard let cg = cgImage else { return nil }
      let w = cg.width
      let h = cg.height
      if w < 3 || h < 3 { return nil }

      // Dessine la miniature dans un tampon en niveaux de gris (1 octet / pixel).
      var gray = [UInt8](repeating: 0, count: w * h)
      let drawn: Bool = gray.withUnsafeMutableBytes { buf in
        guard let ctx = CGContext(
          data: buf.baseAddress,
          width: w,
          height: h,
          bitsPerComponent: 8,
          bytesPerRow: w,
          space: CGColorSpaceCreateDeviceGray(),
          bitmapInfo: CGImageAlphaInfo.none.rawValue
        ) else { return false }
        ctx.interpolationQuality = .high
        ctx.draw(cg, in: CGRect(x: 0, y: 0, width: w, height: h))
        return true
      }
      if !drawn { return nil }

      let g = gray.map { Int($0) }
      let lap = laplacianVariance(g, w, h)
      let top = topTiles(g, w, h)
      let (g2, w2, h2) = halve(g, w, h)
      let lap2 = (w2 >= 3 && h2 >= 3) ? laplacianVariance(g2, w2, h2) : 0
      let (g4, w4, h4) = halve(g2, w2, h2)
      let lap4 = (w4 >= 3 && h4 >= 3) ? laplacianVariance(g4, w4, h4) : 0
      return [
        "score": lap, "lap": lap, "top": top, "lap2": lap2, "lap4": lap4,
        "width": w, "height": h,
      ]
    }
  }

  // Filtre Laplacien 3x3 (voisins haut/bas/gauche/droite − 4 × centre), puis
  // variance des résultats. Une photo nette a des contours francs → grande variance.
  private static func laplacianVariance(_ g: [Int], _ w: Int, _ h: Int) -> Double {
    return lapVarRegion(g, w, 1, 1, w - 1, h - 1)
  }

  // Même calcul limité à une zone : x de x0 à x1 (exclu), y de y0 à y1 (exclu), sans toucher les bords de l'image.
  private static func lapVarRegion(_ g: [Int], _ w: Int, _ x0: Int, _ y0: Int, _ x1: Int, _ y1: Int) -> Double {
    if x1 <= x0 || y1 <= y0 { return 0 }
    var sum = 0
    var sumSq = 0
    g.withUnsafeBufferPointer { p in
      for y in y0..<y1 {
        let row = y * w
        for x in x0..<x1 {
          let i = row + x
          let v = p[i - 1] + p[i + 1] + p[i - w] + p[i + w] - 4 * p[i]
          sum += v
          sumSq += v * v
        }
      }
    }
    let n = Double((x1 - x0) * (y1 - y0))
    let mean = Double(sum) / n
    return Double(sumSq) / n - mean * mean
  }

  // Grille 4 × 4 : variance du Laplacien de chaque case, puis moyenne des 4 meilleures (le quart le plus net).
  private static func topTiles(_ g: [Int], _ w: Int, _ h: Int) -> Double {
    var vals: [Double] = []
    for ty in 0..<4 {
      for tx in 0..<4 {
        let x0 = max(1, tx * w / 4)
        let x1 = min(w - 1, (tx + 1) * w / 4)
        let y0 = max(1, ty * h / 4)
        let y1 = min(h - 1, (ty + 1) * h / 4)
        if x1 - x0 >= 2 && y1 - y0 >= 2 { vals.append(lapVarRegion(g, w, x0, y0, x1, y1)) }
      }
    }
    if vals.isEmpty { return 0 }
    vals.sort(by: >)
    let k = max(1, vals.count / 4)
    return vals.prefix(k).reduce(0, +) / Double(k)
  }

  // Image réduite de moitié (moyenne de chaque bloc de 2 × 2 pixels).
  private static func halve(_ g: [Int], _ w: Int, _ h: Int) -> ([Int], Int, Int) {
    let nw = w / 2
    let nh = h / 2
    if nw < 1 || nh < 1 { return ([], max(0, nw), max(0, nh)) }
    var out = [Int](repeating: 0, count: nw * nh)
    for y in 0..<nh {
      let r0 = 2 * y * w
      let r1 = r0 + w
      for x in 0..<nw {
        let c = 2 * x
        out[y * nw + x] = (g[r0 + c] + g[r0 + c + 1] + g[r1 + c] + g[r1 + c + 1]) / 4
      }
    }
    return (out, nw, nh)
  }
}
