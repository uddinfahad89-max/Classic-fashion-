import { useState, useEffect, useMemo } from 'react';
import { ThermalPrinterSettings } from '../types';

export interface TabletModeInfo {
  isTabletActive: boolean;
  isTabletDevice: boolean;
  isLandscape: boolean;
  windowWidth: number;
  windowHeight: number;
  containerClass: string;
  uiScale: 'normal' | 'large' | 'extra_large';
  scaleMultiplier: number;
  mode: 'auto' | 'always' | 'disabled';
}

/**
 * Custom Hook: Auto-detects 10" Tablets, iPads, and Large Screens
 * and provides responsive layout sizing and font scaling.
 */
export function useTabletMode(settings?: Partial<ThermalPrinterSettings>): TabletModeInfo {
  const [dimensions, setDimensions] = useState<{ width: number; height: number }>({
    width: typeof window !== 'undefined' ? window.innerWidth : 1024,
    height: typeof window !== 'undefined' ? window.innerHeight : 768,
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleResize = () => {
      setDimensions({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, []);

  const isTabletDevice = useMemo(() => {
    if (typeof navigator === 'undefined') return false;
    const ua = navigator.userAgent || '';
    // Android tablets lack "Mobile" token; iPads and explicit Tablet keywords
    const isAndroidTablet = /Android/i.test(ua) && !/Mobile/i.test(ua);
    const isIpad = /iPad|Macintosh/i.test(ua) && Boolean(navigator.maxTouchPoints && navigator.maxTouchPoints > 1);
    const isTabletKeyword = /Tablet|PlayBook|Silk/i.test(ua);
    return isAndroidTablet || isIpad || isTabletKeyword;
  }, []);

  const mode = settings?.tabletMode || 'auto';
  const uiScale = settings?.uiScale || 'normal';

  const isTabletWidth = dimensions.width >= 768;
  const isLandscape = dimensions.width > dimensions.height && dimensions.width >= 960;

  const isTabletActive = useMemo(() => {
    if (mode === 'always') return true;
    if (mode === 'disabled') return false;
    // 'auto' mode: detects if screen is >= 768px (e.g. 10" tablet in portrait or landscape)
    // or user agent is a tablet
    return isTabletWidth || isTabletDevice;
  }, [mode, isTabletWidth, isTabletDevice]);

  const scaleMultiplier = useMemo(() => {
    if (uiScale === 'extra_large') return 1.3;
    if (uiScale === 'large') return 1.15;
    return isTabletActive ? 1.1 : 1.0;
  }, [uiScale, isTabletActive]);

  const containerClass = useMemo(() => {
    if (isTabletActive) {
      // Fills the 10" tablet screen width cleanly without narrow centering
      return 'w-full max-w-5xl lg:max-w-6xl xl:max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 space-y-3 md:space-y-4';
    }
    // Default compact mobile container
    return 'max-w-2xl mx-auto px-3 py-2 sm:py-3 space-y-2';
  }, [isTabletActive]);

  return {
    isTabletActive,
    isTabletDevice,
    isLandscape,
    windowWidth: dimensions.width,
    windowHeight: dimensions.height,
    containerClass,
    uiScale,
    scaleMultiplier,
    mode,
  };
}
