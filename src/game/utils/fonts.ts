/**
 * Font utility for consistent font usage across the game with iOS compatibility
 */

export const FONT_FAMILY = "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Helvetica Neue', Arial, sans-serif";

/**
 * Check if Poppins font is loaded and available
 */
export const isPoppinsLoaded = (): boolean => {
    if (typeof document === 'undefined') return false;
    
    // Create a test element to check if font is loaded
    const testElement = document.createElement('div');
    testElement.style.fontFamily = 'Poppins';
    testElement.style.position = 'absolute';
    testElement.style.left = '-9999px';
    testElement.style.fontSize = '16px';
    testElement.innerHTML = 'Test';
    
    document.body.appendChild(testElement);
    const width = testElement.offsetWidth;
    document.body.removeChild(testElement);
    
    // Create another test with fallback font
    const fallbackElement = document.createElement('div');
    fallbackElement.style.fontFamily = 'Arial';
    fallbackElement.style.position = 'absolute';
    fallbackElement.style.left = '-9999px';
    fallbackElement.style.fontSize = '16px';
    fallbackElement.innerHTML = 'Test';
    
    document.body.appendChild(fallbackElement);
    const fallbackWidth = fallbackElement.offsetWidth;
    document.body.removeChild(fallbackElement);
    
    // If widths are different, Poppins is likely loaded
    return width !== fallbackWidth;
};

/**
 * Get the appropriate font family string with fallbacks
 */
export const getFontFamily = (): string => {
    return FONT_FAMILY;
};

/**
 * Log font loading status for debugging
 */
export const logFontStatus = (): void => {
    const loaded = isPoppinsLoaded();
    console.log(`Poppins font ${loaded ? 'is' : 'is not'} loaded`);
}; 