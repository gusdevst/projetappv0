Pod::Spec.new do |s|
  s.name           = 'PelliculeSharpness'
  s.version        = '1.0.0'
  s.summary        = 'Mesure de netteté (variance du Laplacien) des photos de Pellicule'
  s.description    = 'Module local : lit une miniature de la photo et renvoie un score de netteté.'
  s.license        = 'MIT'
  s.author         = 'Pellicule'
  s.homepage       = 'https://github.com/gusdevst/projetappv0'
  s.platforms      = { :ios => '15.1' }
  s.source         = { git: '' }
  s.static_framework = true
  s.frameworks     = 'Photos'

  s.dependency 'ExpoModulesCore'

  # Swift/Objective-C compatibility
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES'
  }

  s.source_files = "**/*.{h,m,swift}"
end
