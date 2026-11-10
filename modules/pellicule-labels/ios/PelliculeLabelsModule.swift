import ExpoModulesCore
import Photos
import UIKit
import Vision

// Étiquettes de contenu d'une photo (« beach », « dog », « child »…), calculées SUR LE TÉLÉPHONE
// avec Vision (VNClassifyImageRequest) : modèle fourni par iOS, rien n'est envoyé, rien n'est téléchargé.
// Miniature 512 px (comme le module de netteté). Les étiquettes sont en anglais.
// Même contrat que sur Android (PelliculeLabelsModule.kt, ML Kit) : si tu changes l'un, change l'autre.

private let THUMB_SIDE: CGFloat = 512
private let MAX_LABELS = 12       // nombre d'étiquettes renvoyées au plus
private let MIN_CONFIDENCE: Float = 0.05  // en dessous, on ne renvoie pas (le tri fin se fait côté JS)

public class PelliculeLabelsModule: Module {
  public func definition() -> ModuleDefinition {
    Name("PelliculeLabels")

    // id = asset.id d'expo-media-library (= localIdentifier sur iOS).
    // Renvoie { labels: [{ text, confidence }], width, height } ou nil si la photo n'est pas lisible
    // (absente, ou seulement sur iCloud : on ne la télécharge jamais).
    AsyncFunction("getLabels") { (id: String) -> [String: Any]? in
      return PelliculeLabelsModule.classify(id: id)
    }
  }

  private static func classify(id: String) -> [String: Any]? {
    return autoreleasepool { () -> [String: Any]? in
      guard let asset = PHAsset.fetchAssets(withLocalIdentifiers: [id], options: nil).firstObject else {
        return nil
      }

      let options = PHImageRequestOptions()
      options.isSynchronous = true
      options.isNetworkAccessAllowed = false
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

      let request = VNClassifyImageRequest()
      #if targetEnvironment(simulator)
      // Le simulateur n'a pas de puce neuronale : calcul sur le processeur.
      request.usesCPUOnly = true
      #endif

      let handler = VNImageRequestHandler(cgImage: cg, options: [:])
      do {
        try handler.perform([request])
      } catch {
        return nil
      }

      let observations = (request.results ?? [])
        .filter { $0.confidence >= MIN_CONFIDENCE }
        .sorted { $0.confidence > $1.confidence }
        .prefix(MAX_LABELS)

      let labels: [[String: Any]] = observations.map {
        ["text": $0.identifier, "confidence": Double($0.confidence)]
      }
      return ["labels": labels, "width": cg.width, "height": cg.height]
    }
  }
}
