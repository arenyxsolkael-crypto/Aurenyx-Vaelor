package org.aethervanguard.aurenyxvaelor.ui

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

private val VaelorDarkColors = darkColorScheme(
    primary = Color(0xFFA58FF8),
    onPrimary = Color(0xFF0B0A10),
    secondary = Color(0xFF35C8FF),
    onSecondary = Color(0xFF06101F),
    background = Color(0xFF0B0A10),
    onBackground = Color(0xFFF3F0FA),
    surface = Color(0xFF13111D),
    onSurface = Color(0xFFF3F0FA),
    surfaceVariant = Color(0xFF1B1829),
    onSurfaceVariant = Color(0xFFB8B1CC),
    error = Color(0xFFFF7B8B),
    onError = Color(0xFF0B0A10)
)

private val VaelorLightColors = lightColorScheme(
    primary = Color(0xFF5B3CE6),
    onPrimary = Color(0xFFFFFFFF),
    secondary = Color(0xFF0B6BCB),
    onSecondary = Color(0xFFFFFFFF),
    background = Color(0xFFF8FAFC),
    onBackground = Color(0xFF0F172A),
    surface = Color(0xFFFFFFFF),
    onSurface = Color(0xFF0F172A),
    surfaceVariant = Color(0xFFF1F5F9),
    onSurfaceVariant = Color(0xFF475569),
    error = Color(0xFFBE123C),
    onError = Color(0xFFFFFFFF)
)

@Composable
fun AurenyxVaelorTheme(
    darkTheme: Boolean = true,
    content: @Composable () -> Unit
) {
    val colorScheme = if (darkTheme) VaelorDarkColors else VaelorLightColors
    MaterialTheme(
        colorScheme = colorScheme,
        content = content
    )
}
