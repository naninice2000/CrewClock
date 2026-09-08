/**
 * SheetPunch / CrewClock - Geolocation Capture
 */
window.CrewClock = window.CrewClock || {};

(function (exports) {
  'use strict';

  function checkLocationCapability() {
    const el = exports.dom?.el || window.el || {};
    if ('geolocation' in navigator) {
      if (el.locationPillText) el.locationPillText.textContent = 'GPS Location Ready';
      if (el.locationPill) el.locationPill.className = 'mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-emerald-100/80 text-emerald-800 border border-emerald-200';
    } else {
      if (el.locationPillText) el.locationPillText.textContent = 'Location Unsupported';
      if (el.locationPill) el.locationPill.className = 'mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-rose-100 text-rose-800 border border-rose-200';
    }
  }

  function getDeviceLocation(timeoutMs = 15000) {
    const showLoading = exports.dom?.showLoading || window.showLoading || function () {};
    const hideLoading = exports.dom?.hideLoading || window.hideLoading || function () {};

    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        return reject(new Error('Geolocation is not supported by your device browser.'));
      }

      showLoading('Acquiring GPS Location', 'Capturing device coordinates for attendance verification...');

      let finished = false;
      const watchdog = setTimeout(() => {
        if (!finished) {
          finished = true;
          hideLoading();
          reject(new Error('GPS location request timed out.'));
        }
      }, timeoutMs + 500);

      navigator.geolocation.getCurrentPosition(
        (position) => {
          if (finished) return;
          finished = true;
          clearTimeout(watchdog);
          hideLoading();
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            timestamp: position.timestamp
          });
        },
        (error) => {
          if (finished) return;
          finished = true;
          clearTimeout(watchdog);
          hideLoading();
          let msg = 'Could not access device location.';
          if (error.code === error.PERMISSION_DENIED) {
            msg = 'Location permission was denied. Please allow location access in your device/browser settings.';
          } else if (error.code === error.POSITION_UNAVAILABLE) {
            msg = 'GPS location information is currently unavailable.';
          } else if (error.code === error.TIMEOUT) {
            msg = 'GPS location request timed out. Please try again.';
          }
          reject(new Error(msg));
        },
        {
          enableHighAccuracy: true,
          timeout: timeoutMs,
          maximumAge: 0
        }
      );
    });
  }

  // Resilient location acquisition with fallback to active shift coordinates
  async function getLocationWithFallback(activeShift, timeoutMs = 8000) {
    try {
      return await getDeviceLocation(timeoutMs);
    } catch (locErr) {
      console.warn('GPS acquisition warning, using fallback shift coordinates:', locErr);
      return {
        latitude: parseFloat(activeShift?.latitude) || 0,
        longitude: parseFloat(activeShift?.longitude) || 0,
        accuracy: activeShift?.accuracy ? Number(activeShift.accuracy) : 999,
        timestamp: Date.now(),
        isFallback: true
      };
    }
  }

  // Exports
  exports.checkLocationCapability = checkLocationCapability;
  exports.getDeviceLocation = getDeviceLocation;
  exports.getLocationWithFallback = getLocationWithFallback;

  // Global fallbacks
  window.checkLocationCapability = checkLocationCapability;
  window.getDeviceLocation = getDeviceLocation;

})(window.CrewClock);
