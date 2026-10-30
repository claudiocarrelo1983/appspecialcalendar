Pod::Spec.new do |s|
  s.name = 'SpecialCalendarHealth'
  s.version = '1.0.0'
  s.summary = 'Read-only HealthKit access for Special Calendar'
  s.description = s.summary
  s.license = { :type => 'UNLICENSED' }
  s.author = 'Special Calendar'
  s.homepage = 'https://specialcalendar.com'
  s.platform = :ios, '16.4'
  s.source = { :git => 'https://specialcalendar.com' }
  s.static_framework = true
  s.swift_version = '5.9'
  s.source_files = '**/*.swift'
  s.frameworks = 'HealthKit'
  s.dependency 'ExpoModulesCore'
end
