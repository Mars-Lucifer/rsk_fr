import { useCallback, useEffect, useState } from 'react';

export interface DeviceSpecs {
  ram: number;
  cpus: number;
  os: string;
  browser: string;
  isChrome: boolean;
  isValid: boolean;
  errors: string[];
}

export const useDeviceCheck = () => {
  const [specs, setSpecs] = useState<DeviceSpecs | null>(null);

  const checkDevice = useCallback(() => {
    const ram = (navigator as any).deviceMemory || 0;
    const cpus = navigator.hardwareConcurrency || 0;
    const ua = navigator.userAgent;
    
    let os = 'Unknown';
    if (ua.indexOf('Win') !== -1) {
      os = 'Windows';
      if (ua.indexOf('Windows NT 10.0') !== -1) os = 'Windows 10/11';
      if (ua.indexOf('Windows NT 6.3') !== -1) os = 'Windows 8.1';
      if (ua.indexOf('Windows NT 6.2') !== -1) os = 'Windows 8';
      if (ua.indexOf('Windows NT 6.1') !== -1) os = 'Windows 7';
    }
    if (ua.indexOf('Mac') !== -1) os = 'macOS';
    if (ua.indexOf('Linux') !== -1) os = 'Linux';
    if (ua.indexOf('Android') !== -1) os = 'Android';
    if (ua.indexOf('like Mac') !== -1) os = 'iOS';

    const isChrome = /Chrome/.test(ua) && /Google Inc/.test(navigator.vendor);
    const browser = isChrome ? 'Chrome' : 'Other';

    const errors: string[] = [];
    if (ram < 8) errors.push('Недостаточно оперативной памяти (нужно минимум 8 ГБ)');
    if (os !== 'Windows 10/11' && os !== 'macOS') errors.push('Требуется ОС Windows 10/11 или macOS');
    if (!isChrome) errors.push('Пожалуйста, используйте браузер Google Chrome');

    const result: DeviceSpecs = {
      ram,
      cpus,
      os,
      browser,
      isChrome,
      isValid: errors.length === 0,
      errors
    };

    setSpecs(result);
    return result;
  }, []);

  return { specs, checkDevice };
};
