// Real Web Bluetooth BLE Barcode Scanner Service
// Connects to Bluetooth Low Energy (BLE) barcode scanners exposing GATT UART / Serial / Custom Notify characteristics.
// Note: Standard Bluetooth HID (keyboard-emulation) scanners pair at OS level and are handled automatically by the global HID keyboard listener in BillingTab.

export interface BluetoothScannerStatus {
  supported: boolean;
  connected: boolean;
  isConnecting: boolean;
  deviceName: string | null;
  lastBarcode: string | null;
  error: string | null;
}

const BLE_SCANNER_SERVICES = [
  '0000ffe0-0000-1000-8000-00805f9b34fb', // Common BLE Scanner / HM-10 / Netum / Eyoyo / CC2540
  '6e400001-b5a3-f393-e0a9-e50e24dcca9e', // Nordic UART Service (NUS)
  '49535343-fe7d-4ae5-8fa9-9fafd205e455', // ISSC Transparent UART
  '0000fff0-0000-1000-8000-00805f9b34fb', // Common Chinese BLE Scanner / Serial Service
  '0000ff00-0000-1000-8000-00805f9b34fb',
  '000018f0-0000-1000-8000-00805f9b34fb',
  'e7810a71-73ae-499d-8c15-faa9aef0c3f2',
  '0000fee7-0000-1000-8000-00805f9b34fb',
  '0000fee0-0000-1000-8000-00805f9b34fb',
  '0000ae30-0000-1000-8000-00805f9b34fb',
  '0000af30-0000-1000-8000-00805f9b34fb',
  '0000abf0-0000-1000-8000-00805f9b34fb',
  '0000e0ff-0000-1000-8000-00805f9b34fb',
  '0000ffe5-0000-1000-8000-00805f9b34fb',
  '0000ff12-0000-1000-8000-00805f9b34fb',
  '00001812-0000-1000-8000-00805f9b34fb', // HID over GATT (for scanners that allow GATT access)
  '0000180a-0000-1000-8000-00805f9b34fb', // Device Information
];

type StatusListener = (status: BluetoothScannerStatus) => void;
type BarcodeListener = (barcode: string) => void;

class BluetoothScannerService {
  private device: any = null;
  private server: any = null;
  private subscribedChars: any[] = [];
  private statusListeners = new Set<StatusListener>();
  private barcodeListeners = new Set<BarcodeListener>();
  private decoder = new TextDecoder('utf-8');
  private buffer = '';
  private flushTimer: number | null = null;
  private boundCharHandler: ((e: Event) => void) | null = null;
  private boundDisconnectHandler: (() => void) | null = null;

  private status: BluetoothScannerStatus = {
    supported: this.isSupported(),
    connected: false,
    isConnecting: false,
    deviceName: null,
    lastBarcode: null,
    error: null,
  };

  isSupported(): boolean {
    return (
      typeof navigator !== 'undefined' &&
      typeof (navigator as any).bluetooth !== 'undefined' &&
      typeof (navigator as any).bluetooth.requestDevice === 'function'
    );
  }

  getStatus(): BluetoothScannerStatus {
    return { ...this.status, supported: this.isSupported() };
  }

  subscribeStatus(listener: StatusListener): () => void {
    this.statusListeners.add(listener);
    listener(this.getStatus());
    return () => {
      this.statusListeners.delete(listener);
    };
  }

  subscribeBarcodes(listener: BarcodeListener): () => void {
    this.barcodeListeners.add(listener);
    return () => {
      this.barcodeListeners.delete(listener);
    };
  }

  private updateStatus(patch: Partial<BluetoothScannerStatus>) {
    this.status = { ...this.status, ...patch, supported: this.isSupported() };
    const snapshot = this.getStatus();
    this.statusListeners.forEach((cb) => {
      try {
        cb(snapshot);
      } catch {}
    });
  }

  private emitBarcode(raw: string) {
    // Strip ASCII control chars except visible characters
    const clean = raw.replace(/[\x00-\x1F\x7F]/g, '').trim();
    if (!clean) return;
    this.updateStatus({ lastBarcode: clean });
    this.barcodeListeners.forEach((cb) => {
      try {
        cb(clean);
      } catch {}
    });
  }

  private handleIncomingChunk(chunk: string) {
    if (!chunk) return;
    this.buffer += chunk;

    if (this.flushTimer !== null) {
      window.clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }

    // If scanner sends CR/LF terminators, flush complete lines immediately
    if (/[\r\n]/.test(this.buffer)) {
      const parts = this.buffer.split(/[\r\n]+/);
      this.buffer = parts.pop() || '';
      for (const part of parts) {
        if (part.trim()) {
          this.emitBarcode(part);
        }
      }
    }

    // Fallback idle flush for BLE scanners that omit trailing newline
    if (this.buffer.trim().length > 0) {
      this.flushTimer = window.setTimeout(() => {
        const leftover = this.buffer;
        this.buffer = '';
        this.flushTimer = null;
        if (leftover.trim().length >= 2) {
          this.emitBarcode(leftover);
        }
      }, 130);
    }
  }

  async connect(): Promise<{ success: boolean; error?: string }> {
    if (!this.isSupported()) {
      const msg =
        'এই ব্রাউজারে Web Bluetooth সাপোর্ট নেই (Android Chrome ব্যবহার করুন অথবা Scanner কে Bluetooth HID Keyboard হিসেবে পেয়ার করুন)।';
      this.updateStatus({ error: msg, isConnecting: false });
      return { success: false, error: msg };
    }

    this.updateStatus({ isConnecting: true, error: null });

    try {
      const navBluetooth = (navigator as any).bluetooth;
      const device = await navBluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: BLE_SCANNER_SERVICES,
      });

      if (!device || !device.gatt) {
        throw new Error('কোনো Bluetooth BLE স্ক্যানার পাওয়া যায়নি।');
      }

      // Clean up any prior connection cleanly
      await this.disconnectInternal();

      this.device = device;
      this.boundDisconnectHandler = () => {
        this.cleanupCharacteristics();
        this.updateStatus({
          connected: false,
          isConnecting: false,
          deviceName: null,
        });
      };
      device.addEventListener('gattserverdisconnected', this.boundDisconnectHandler);

      const server = await device.gatt.connect();
      this.server = server;

      const services = await server.getPrimaryServices();
      const notifyChars: any[] = [];

      for (const service of services) {
        try {
          const chars = await service.getCharacteristics();
          for (const char of chars) {
            if (char?.properties?.notify || char?.properties?.indicate) {
              notifyChars.push(char);
            }
          }
        } catch {
          // Some protected OS services (like standard HID) throw SecurityError; skip gracefully
        }
      }

      if (notifyChars.length === 0) {
        try {
          server.disconnect();
        } catch {}
        const msg =
          'এই ডিভাইসটি সম্ভবত Bluetooth HID (Keyboard) মোডে আছে — আলাদা BLE কানেকশন ছাড়াই সরাসরি স্ক্যান করলে বিলে যোগ হবে!';
        this.updateStatus({
          connected: false,
          isConnecting: false,
          deviceName: null,
          error: msg,
        });
        return { success: false, error: msg };
      }

      this.boundCharHandler = (event: Event) => {
        const target = event.target as any;
        const value: DataView | undefined = target?.value;
        if (!value) return;
        const text = this.decoder.decode(value.buffer);
        this.handleIncomingChunk(text);
      };

      let activeSubs = 0;
      for (const char of notifyChars) {
        try {
          await char.startNotifications();
          char.addEventListener('characteristicvaluechanged', this.boundCharHandler);
          this.subscribedChars.push(char);
          activeSubs++;
        } catch {}
      }

      if (activeSubs === 0) {
        throw new Error('স্ক্যানার থেকে ডাটা রিসিভ চালু করা যায়নি।');
      }

      this.updateStatus({
        connected: true,
        isConnecting: false,
        deviceName: device.name || 'Bluetooth BLE Scanner',
        error: null,
      });

      return { success: true };
    } catch (err: any) {
      const rawMsg = err?.message || String(err || '');
      const isCancelled =
        err?.name === 'NotFoundError' || /cancel/i.test(rawMsg);
      const friendlyMsg = isCancelled
        ? null
        : rawMsg || 'Bluetooth স্ক্যানার কানেক্ট করা যায়নি।';
      this.updateStatus({
        connected: false,
        isConnecting: false,
        error: friendlyMsg,
      });
      return { success: false, error: friendlyMsg || undefined };
    }
  }

  private cleanupCharacteristics() {
    if (this.flushTimer !== null) {
      window.clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    this.buffer = '';
    for (const char of this.subscribedChars) {
      try {
        if (this.boundCharHandler) {
          char.removeEventListener('characteristicvaluechanged', this.boundCharHandler);
        }
        char.stopNotifications?.().catch?.(() => {});
      } catch {}
    }
    this.subscribedChars = [];
    this.boundCharHandler = null;
  }

  private async disconnectInternal() {
    this.cleanupCharacteristics();
    if (this.device && this.boundDisconnectHandler) {
      try {
        this.device.removeEventListener('gattserverdisconnected', this.boundDisconnectHandler);
      } catch {}
    }
    this.boundDisconnectHandler = null;
    if (this.server?.connected) {
      try {
        this.server.disconnect();
      } catch {}
    }
    this.server = null;
    this.device = null;
  }

  async disconnect() {
    await this.disconnectInternal();
    this.updateStatus({
      connected: false,
      isConnecting: false,
      deviceName: null,
      error: null,
    });
  }
}

export const bluetoothScannerService = new BluetoothScannerService();
