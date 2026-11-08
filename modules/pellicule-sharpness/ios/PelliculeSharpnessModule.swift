import ExpoModulesCore
import Photos
import UIKit

// Mesure de netteté d'une photo : variance du Laplacien sur une miniature
// en niveaux de gris (côté le plus long = 512 px). Score bas = photo floue.
// Même formule que sur Android (PelliculeSharpnessModule.kt) : si tu en
// changes une, change l'autre et monte la version dans constants/blurConfig.js.

private let THUMB_SIDE: CGFloat = 512

public class PelliculeSharpnessModule: Module {
  public func definition() -> ModuleDefinition {
    Name("PelliculeSharpness")

    // id = asset.id d'expo-media-library (= localIdentifier de la photo sur iOS).
    // Renvoie { score, width, height } ou nil si la photo n'est pas lisible
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

      let score = laplacianVariance(gray, w, h)
      return ["score": score, "width": w, "height": h]
    }
  }

  // Filtre Laplacien 3x3 (voisins haut/bas/gauche/droite − 4 × centre), puis
  // variance des résultats. Une photo nette a des contours francs → grande variance.
  private static func laplacianVariance(_ g: [UInt8], _ w: Int, _ h: Int) -> Double {
    var sum = 0
    var sumSq = 0
    g.withUnsafeBufferPointer { p in
      for y in 1..<(h - 1) {
        let row = y * w
        for x in 1..<(w - 1) {
          let i = row + x
          let v = Int(p[i - 1]) + Int(p[i + 1]) + Int(p[i - w]) + Int(p[i + w]) - 4 * Int(p[i])
          sum += v
          sumSq += v * v
        }
      }
    }
    let n = Double((w - 2) * (h - 2))
    let mean = Double(sum) / n
    return Double(sumSq) / n - mean * mean
  }
}
