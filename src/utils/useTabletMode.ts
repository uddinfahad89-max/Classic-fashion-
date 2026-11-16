import { useState, useEffect, useMemo } from 'react';
import { ThermalPrinterSettings } from '../types';

export interface TabletModeInfo {
  isTabletActive: boolean;
  isTabletDevice: boolean;
  isLandscape: boolean;
  isForceRotated: boolean;
  windowWidth: number;
  windowHeight: number;
  containerClass: string;
  uiScale: 'normal' | 'large' | 'extra_large';
  scaleMultiplier: number;
  mode: 'auto' | 'always' | 'disabled';
}

/**
 * Custom Hook: Auto-detects 10" Tablets, iPads, and Large Screens
 * and accounts for CSS 90° Force-Landscape rotation when OS/WebAPK stays portrait.
 */
export function useTabletMode(settings?: Partial<ThermalPrinterSettings>): TabletModeInfo {
  const [dimensions, setDimensions] = useState<{ width: number; height: number }>({
    width: typeof window !== 'undefined' ? window.innerWidth : 1024,
    height: typeof window !== 'undefined' ? window.innerHeight : 768,
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    let timer: ReturnType<typeof setTimeout> | null = null;

    const handleResize = () => {
      setDimensions({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    const handleOrientationChange = () => {
      handleResize();
      if (timer) clearTimeout(timer);
      timer = setTimeout(handleResize, 120);
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleOrientationChange);
    const screenOrientation = (window.screen as any)?.orientation;
    screenOrientation?.addEventListener?.('change', handleOrientationChange);

    return () => {
      if (timer) clearTimeout(timer);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleOrientationChange);
      screenOrientation?.removeEventListener?.('change', handleOrientationChange);
    };
  }, []);

  const isTabletDevice = useMemo(() => {
    if (typeof navigator === 'undefined') return false;
    const ua = navigator.userAgent || '';
    const isAndroidTablet = /Android/i.test(ua) && !/Mobile/i.test(ua);
    const isIpad =
      /iPad|Macintosh/i.test(ua) &&
      Boolean(navigator.maxTouchPoints && navigator.maxTouchPoints > 1);
    const isTabletKeyword = /Tablet|PlayBook|Silk/i.test(ua);
    return isAndroidTablet || isIpad || isTabletKeyword;
  }, []);

  const mode = settings?.tabletMode || 'auto';
  const uiScale = settings?.uiScale || 'normal';

  const isForceRotated =
    settings?.screenOrientation === 'landscape' &&
    dimensions.height > dimensions.width;

  const effectiveWidth = isForceRotated ? dimensions.height : dimensions.width;
  const effectiveHeight = isForceRotated ? dimensions.width : dimensions.height;

  const isTabletWidth = effectiveWidth >= 768;
  const isLandscape = effectiveWidth > effectiveHeight;

  const isTabletActive = useMemo(() => {
    if (mode === 'always') return true;
    if (mode === 'disabled') return false;
    return isTabletWidth || isTabletDevice || isForceRotated;
  }, [mode, isTabletWidth, isTabletDevice, isForceRotated]);

  const scaleMultiplier = useMemo(() => {
    if (uiScale === 'extra_large') return 1.3;
    if (uiScale === 'large') return 1.15;
    return isTabletActive ? 1.1 : 1.0;
  }, [uiScale, isTabletActive]);

  const containerClass = useMemo(() => {
    if (isTabletActive) {
      return 'w-full max-w-5xl lg:max-w-6xl xl:max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 space-y-3 md:space-y-4';
    }
    return 'max-w-2xl mx-auto px-3 py-2 sm:py-3 space-y-2';
  }, [isTabletActive]);

  return {
    isTabletActive,
    isTabletDevice,
    isLandscape,
    isForceRotated,
    windowWidth: effectiveWidth,
    windowHeight: effectiveHeight,
    containerClass,
    uiScale,
    scaleMultiplier,
    mode,
  };
}
