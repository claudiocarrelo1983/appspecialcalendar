Pod::Spec.new do |s|
  s.name = 'CompanyHealth'
  s.version = '1.0.0'
  s.summary = 'HealthKit workouts and Live Activity support for the company mobile app'
  s.description = s.summary
  s.license = { :type => 'UNLICENSED' }
  s.author = 'Mobile App'
  s.homepage = 'https://github.com/claudiocarrelo1983/appspecialcalendar'
  s.platform = :ios, '16.4'
  s.source = { :git => 'https://github.com/claudiocarrelo1983/appspecialcalendar.git' }
  s.static_framework = true
  s.swift_version = '5.9'
  s.source_files = '**/*.swift'
  s.frameworks = 'HealthKit', 'ActivityKit'
  s.dependency 'ExpoModulesCore'
end
