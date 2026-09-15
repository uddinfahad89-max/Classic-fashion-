import { useState, useEffect } from 'react';
import { NetworkStatusInfo } from '../types';

export function useNetworkStatus(): NetworkStatusInfo {
  const getStatus = (): NetworkStatusInfo => {
    const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

    // Check Network Information API
    const nav = typeof navigator !== 'undefined' ? (navigator as any) : null;
    const conn = nav?.connection || nav?.mozConnection || nav?.webkitConnection;

    const rawType = conn?.effectiveType || '';
    const saveData = Boolean(conn?.saveData);
    const downlink = typeof conn?.downlink === 'number' ? conn.downlink : undefined;
    const rtt = typeof conn?.rtt === 'number' ? conn.rtt : undefined;

    let effectiveType: NetworkStatusInfo['effectiveType'] = '4g';
    if (!isOnline) {
      effectiveType = 'offline';
    } else if (rawType === 'slow-2g' || rawType === '2g') {
      effectiveType = '2g';
    } else if (rawType === '3g') {
      effectiveType = '3g';
    } else if (rawType === '4g') {
      effectiveType = '4g';
    }

    const isLowBandwidth = !isOnline || effectiveType === '2g' || rawType === 'slow-2g' || saveData;

    return {
      isOnline,
      effectiveType,
      saveData,
      isLowBandwidth,
      downlink,
      rtt,
    };
  };

  const [status, setStatus] = useState<NetworkStatusInfo>(getStatus);

  useEffect(() => {
    const update = () => setStatus(getStatus());

    window.addEventListener('online', update);
    window.addEventListener('offline', update);

    const nav = typeof navigator !== 'undefined' ? (navigator as any) : null;
    const conn = nav?.connection || nav?.mozConnection || nav?.webkitConnection;
    if (conn) {
      conn.addEventListener('change', update);
    }

    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
      if (conn) {
        conn.removeEventListener('change', update);
      }
    };
  }, []);

  return status;
}
