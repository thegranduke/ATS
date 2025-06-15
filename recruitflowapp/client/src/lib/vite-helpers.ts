/**
 * Utilities for handling Vite-specific functionality
 */

/**
 * Attempts to disable the Vite runtime error overlay
 */
export function disableRuntimeErrorOverlay(): void {
  // Try to find and manually close any existing error overlays
  const closeExistingOverlays = () => {
    // Find error overlay elements in the DOM
    const errorOverlays = document.querySelectorAll('[data-plugin-runtime-error-plugin]');
    
    if (errorOverlays.length > 0) {
      // Click outside or press Esc key to dismiss
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      
      // Alternatively we could try to click a close button if it exists
      const closeButtons = document.querySelectorAll('[data-plugin-runtime-error-plugin] button');
      closeButtons.forEach(button => {
        try {
          (button as HTMLButtonElement).click();
        } catch (e) {
          // Ignore any errors
        }
      });
    }
  };
  
  // Try to disable overlay via configuration if possible
  try {
    // @ts-ignore - Accessing Vite's internal configuration
    if (window.__vite_plugin_react_preamble_installed__) {
      // Attempt to modify Vite's runtime configuration to disable error overlays
      // This may not work in all versions of Vite, but it's worth trying
      // @ts-ignore
      const viteConfig = window.__vite__ || {};
      if (viteConfig.config) {
        // @ts-ignore
        viteConfig.config.server = viteConfig.config.server || {};
        // @ts-ignore
        viteConfig.config.server.hmr = viteConfig.config.server.hmr || {};
        // @ts-ignore
        viteConfig.config.server.hmr.overlay = false;
      }
    }
  } catch (err) {
    console.log('Could not disable Vite error overlay via configuration');
  }
  
  // Close any existing overlays
  closeExistingOverlays();
  
  // Add a window-level error handler to prevent future errors
  // from triggering the overlay
  window.addEventListener('error', (event) => {
    // Check if this is a React runtime error that would trigger the overlay
    if (event.message && event.message.includes('runtime-error')) {
      // Prevent default error handling
      event.preventDefault();
      event.stopPropagation();
      
      // Log the error to console instead
      console.error('React runtime error (overlay disabled):', event.error);
      
      // Close any overlays that might have appeared
      setTimeout(closeExistingOverlays, 0);
      
      return false;
    }
    
    // Let other errors process normally
    return true;
  }, true);
}