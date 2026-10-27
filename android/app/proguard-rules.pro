# Keep kotlinx.serialization generated serializers for API and private local store models
-keepattributes *Annotation*, InnerClasses
-dontnote kotlinx.serialization.AnnotationsKt
-keepclassmembers class kotlinx.serialization.json.** {
    *** Companion;
}
-keepclasseswithmembers class kotlinx.serialization.json.** {
    kotlinx.serialization.KSerializer serializer(...);
}
-keep,includedescriptorclasses class org.aethervanguard.aurenyxvaelor.**$$serializer { *; }
-keepclassmembers class org.aethervanguard.aurenyxvaelor.** {
    *** Companion;
}
-keepclasseswithmembers class org.aethervanguard.aurenyxvaelor.** {
    kotlinx.serialization.KSerializer serializer(...);
}

# OkHttp & TLS platform warnings
-dontwarn org.conscrypt.**
-dontwarn org.bouncycastle.**
-dontwarn org.openjsse.**
