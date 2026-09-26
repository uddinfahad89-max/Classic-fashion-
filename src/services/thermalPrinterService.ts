import { BillInvoice, ThermalPrinterSettings, BluetoothDeviceInfo, SavedPrinterInfo } from '../types';
import { storageService } from './storageService';

// Comprehensive list of standard Bluetooth Thermal Printer Service UUIDs
export const POS_SERVICES = [
  '000018f0-0000-1000-8000-00805f9b34fb', // Standard POS Print Service
  '0000ffe0-0000-1000-8000-00805f9b34fb', // Common HM-10 / CC2540 / POS-58 / JP-QR73 / MPT-II / Netum
  '0000ff00-0000-1000-8000-00805f9b34fb', // POS-58 / Zjiang / POS-5802 / Xprinter
  '49535343-fe7d-4ae5-8fa9-9fafd205e455', // ISSC Transparent UART
  'e7810a71-73ae-499d-8c15-faa9aef0c3f2', // Rongta / Xprinter / Goojprt
  '6e400001-b5a3-f393-e0a9-e50e24dcca9e', // Nordic UART Service (NUS)
  '0000fee7-0000-1000-8000-00805f9b34fb', // Tencent / BLE Serial
  '0000fee0-0000-1000-8000-00805f9b34fb',
  '0000fff0-0000-1000-8000-00805f9b34fb',
  '0000ae30-0000-1000-8000-00805f9b34fb', // Milestone / Zebra BLE
  '0000af30-0000-1000-8000-00805f9b34fb',
  '0000abf0-0000-1000-8000-00805f9b34fb',
  '0000e0ff-0000-1000-8000-00805f9b34fb',
  '0000ffe5-0000-1000-8000-00805f9b34fb',
  '0000ff12-0000-1000-8000-00805f9b34fb',
  '000018f1-0000-1000-8000-00805f9b34fb',
  '0000fef5-0000-1000-8000-00805f9b34fb',
  'd8c30001-9f93-4a6a-a238-d65e23631988',
  '00001101-0000-1000-8000-00805f9b34fb', // Serial Port Profile
  '00001800-0000-1000-8000-00805f9b34fb', // Generic Access
  '0000180a-0000-1000-8000-00805f9b34fb', // Device Info
];

export class ThermalPrinterService {
  private bluetoothDevice: any = null;
  private characteristic: any = null;
  private isConnected = false;
  private isConnecting = false;
  private reconnectTimer: any = null;
  private manualDisconnect = false;
  private onStatusChangeCallback: ((status: BluetoothDeviceInfo) => void) | null = null;

  constructor() {
    // Listen for tab focus/visibility to maintain connection
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && !this.isConnected && !this.manualDisconnect) {
          const saved = storageService.getSavedPrinter();
          if (saved) {
            this.autoReconnect().catch(() => {});
          }
        }
      });
    }
  }

  private statusListeners: Array<(status: BluetoothDeviceInfo) => void> = [];

  setStatusListener(callback: (status: BluetoothDeviceInfo) => void) {
    this.onStatusChangeCallback = callback;
    this.notifyStatus();
  }

  addStatusListener(callback: (status: BluetoothDeviceInfo) => void): () => void {
    this.statusListeners.push(callback);
    this.notifyStatus();
    return () => {
      this.statusListeners = this.statusListeners.filter((cb) => cb !== callback);
    };
  }

  private notifyStatus() {
    const saved = storageService.getSavedPrinter();
    const info: BluetoothDeviceInfo = {
      connected: this.isConnected,
      isConnecting: this.isConnecting,
      deviceName:
        this.bluetoothDevice?.name ||
        (this.isConnected ? (saved?.name || 'Thermal POS Printer') : undefined),
      deviceId: this.bluetoothDevice?.id || saved?.id,
      savedPrinter: saved,
    };

    if (this.onStatusChangeCallback) {
      this.onStatusChangeCallback(info);
    }
    this.statusListeners.forEach((cb) => {
      try {
        cb(info);
      } catch (err) {
        console.error('Error in statusListener:', err);
      }
    });
  }

  isBluetoothSupported(): boolean {
    return (
      typeof navigator !== 'undefined' &&
      'bluetooth' in navigator &&
      typeof (navigator as any).bluetooth?.requestDevice === 'function'
    );
  }

  getIsConnected(): boolean {
    return this.isConnected && !!this.characteristic;
  }

  getIsConnecting(): boolean {
    return this.isConnecting;
  }

  hasWritableCharacteristic(): boolean {
    return !!this.characteristic;
  }

  getDeviceName(): string | undefined {
    return this.bluetoothDevice?.name || storageService.getSavedPrinter()?.name;
  }

  private attachDeviceListeners(device: any) {
    if (!device) return;
    device.removeEventListener?.('gattserverdisconnected', this.handleGattDisconnected);
    device.addEventListener('gattserverdisconnected', this.handleGattDisconnected);
  }

  private handleGattDisconnected = () => {
    console.log('Bluetooth GATT disconnected');
    this.isConnected = false;
    this.characteristic = null;
    this.notifyStatus();

    // If not manually disconnected, attempt silent background reconnect after 2 seconds
    if (!this.manualDisconnect) {
      if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
      this.reconnectTimer = setTimeout(() => {
        this.autoReconnect().catch(() => {});
      }, 2000);
    }
  };

  private async setupCharacteristics(server: any): Promise<boolean> {
    try {
      this.characteristic = null;
      let services: any[] = [];

      // 1. Try listing all primary services advertised by GATT server
      try {
        services = await server.getPrimaryServices();
      } catch (e) {
        console.warn('Could not list all services at once, will query known POS services:', e);
      }

      // First pass: inspect already discovered services
      if (services && services.length > 0) {
        for (const service of services) {
          try {
            const characteristics = await service.getCharacteristics();
            for (const char of characteristics) {
              const props = char.properties;
              if (props?.writeWithoutResponse || props?.write) {
                this.characteristic = char;
                console.log(
                  'Found writable BLE characteristic in discovered service:',
                  service.uuid,
                  char.uuid,
                  'writeWithoutResponse:',
                  !!props?.writeWithoutResponse,
                  'write:',
                  !!props?.write
                );
                return true;
              }
            }
          } catch (e) {
            // Service characteristic query error, continue to next
          }
        }
      }

      // Second pass: specifically query each known POS UUID
      for (const uuid of POS_SERVICES) {
        try {
          const service = await server.getPrimaryService(uuid);
          if (!service) continue;
          const characteristics = await service.getCharacteristics();
          for (const char of characteristics) {
            const props = char.properties;
            if (props?.writeWithoutResponse || props?.write) {
              this.characteristic = char;
              console.log(
                'Found writable BLE characteristic via targeted POS UUID:',
                uuid,
                char.uuid,
                'writeWithoutResponse:',
                !!props?.writeWithoutResponse,
                'write:',
                !!props?.write
              );
              return true;
            }
          }
        } catch {
          // Service not present on this device
        }
      }

      return false;
    } catch (e) {
      console.warn('GATT setupCharacteristics failed:', e);
      return false;
    }
  }

  // Silent background auto-reconnect to remembered printer without user prompt
  async autoReconnect(): Promise<boolean> {
    if (this.isConnected && this.characteristic) {
      return true;
    }

    if (this.isConnecting) return false;

    const saved = storageService.getSavedPrinter();
    if (!saved) return false;

    this.manualDisconnect = false;
    this.isConnecting = true;
    this.notifyStatus();

    try {
      // 1. If we already hold the device reference in memory:
      if (this.bluetoothDevice && this.bluetoothDevice.gatt) {
        this.attachDeviceListeners(this.bluetoothDevice);
        const server = await this.bluetoothDevice.gatt.connect();
        const found = await this.setupCharacteristics(server);
        if (found) {
          this.isConnected = true;
          this.isConnecting = false;
          this.notifyStatus();
          return true;
        }
      }

      // 2. If Web Bluetooth getDevices is supported (Chrome 85+):
      if (this.isBluetoothSupported() && (navigator as any).bluetooth?.getDevices) {
        const devices = await (navigator as any).bluetooth.getDevices();
        if (devices && devices.length > 0) {
          const target = devices.find((d: any) => d.id === saved.id) || devices[0];
          if (target && target.gatt) {
            this.bluetoothDevice = target;
            this.attachDeviceListeners(target);
            const server = await target.gatt.connect();
            const found = await this.setupCharacteristics(server);
            if (found) {
              this.isConnected = true;
              this.isConnecting = false;
              this.notifyStatus();
              return true;
            }
          }
        }
      }

      this.isConnecting = false;
      this.notifyStatus();
      return false;
    } catch (err) {
      console.warn('Silent auto-reconnect attempt failed:', err);
      this.isConnected = false;
      this.characteristic = null;
      this.isConnecting = false;
      this.notifyStatus();
      return false;
    }
  }

  // Direct Web Bluetooth Connection (invoked directly from user gesture / Connect button)
  async connectBluetooth(): Promise<{ success: boolean; message: string; deviceName?: string; isUnsupported?: boolean }> {
    this.manualDisconnect = false;

    if (!this.isBluetoothSupported()) {
      return {
        success: false,
        isUnsupported: true,
        message:
          'Web Bluetooth is not supported on this browser. Please use Google Chrome or Microsoft Edge on Windows, Mac, Android, or ChromeOS.',
      };
    }

    this.isConnecting = true;
    this.notifyStatus();

    try {
      // Direct call to navigator.bluetooth.requestDevice within the user gesture tick
      const device = await (navigator as any).bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: POS_SERVICES,
      });

      if (!device) {
        this.isConnecting = false;
        this.notifyStatus();
        return { success: false, message: 'No device selected' };
      }

      this.attachDeviceListeners(device);

      console.log('Connecting to GATT server on:', device.name || device.id);
      const server = await device.gatt.connect();
      const foundChar = await this.setupCharacteristics(server);

      if (!foundChar) {
        console.warn('Connected to device, but no writable POS characteristic was found.');
        this.isConnected = false;
        this.characteristic = null;
        this.isConnecting = false;
        this.notifyStatus();
        return {
          success: false,
          deviceName: device.name,
          message: `Connected to "${device.name || 'Device'}", but no writable POS print channel was found. Please ensure your Bluetooth Thermal POS printer is on and in pairing mode.`,
        };
      }

      this.bluetoothDevice = device;
      this.isConnected = true;
      this.isConnecting = false;

      const deviceName = device.name || 'Bluetooth Thermal Printer';
      const macAddress =
        device.id && device.id.length >= 12
          ? (device.id.includes(':')
              ? device.id
              : (device.id.replace(/[^a-fA-F0-9]/g, '').slice(0, 12).match(/.{1,2}/g)?.join(':').toUpperCase() || 'E0:6E:41:12:1B:0D'))
          : 'E0:6E:41:12:1B:0D';

      // Remember paired printer in local storage
      const printerInfo = {
        id: device.id || `dev-${Date.now()}`,
        name: deviceName,
        macAddress,
        type: 'bluetooth' as const,
        savedAt: Date.now(),
      };
      storageService.saveSavedPrinter(printerInfo);

      this.notifyStatus();

      return {
        success: true,
        deviceName,
        message: `Connected to ${deviceName}! Ready for direct silent printing.`,
      };
    } catch (error: any) {
      this.isConnecting = false;
      this.notifyStatus();

      if (error?.name === 'NotFoundError' || error?.message?.includes('cancelled')) {
        return {
          success: false,
          message: 'Bluetooth pairing cancelled.',
        };
      }

      if (error?.name === 'SecurityError') {
        return {
          success: false,
          isUnsupported: true,
          message:
            'Bluetooth access was restricted. If this app is in an iframe preview, please open it in a new tab to pair directly.',
        };
      }

      console.error('Bluetooth connection error:', error);
      return {
        success: false,
        message: error?.message || 'Failed to connect to Bluetooth printer.',
      };
    }
  }

  // Alias for connectBluetooth
  async connect(): Promise<{ success: boolean; message: string; deviceName?: string; isUnsupported?: boolean }> {
    return this.connectBluetooth();
  }

  // Connect directly to a specific paired printer from the Vyapar list
  async connectToPairedPrinter(
    printer: SavedPrinterInfo
  ): Promise<{ success: boolean; message: string; deviceName?: string }> {
    this.manualDisconnect = false;
    this.isConnecting = true;
    this.notifyStatus();

    // Set as target printer in storage
    storageService.saveSavedPrinter(printer);

    try {
      // 1. Check if device is already active in memory
      if (
        this.bluetoothDevice &&
        (this.bluetoothDevice.id === printer.id || this.bluetoothDevice.name === printer.name)
      ) {
        if (this.bluetoothDevice.gatt) {
          this.attachDeviceListeners(this.bluetoothDevice);
          const server = await this.bluetoothDevice.gatt.connect();
          const found = await this.setupCharacteristics(server);
          if (found) {
            this.isConnected = true;
            this.isConnecting = false;
            this.notifyStatus();
            return {
              success: true,
              deviceName: printer.name,
              message: `Connected to ${printer.name}!`,
            };
          }
        }
      }

      // 2. Check getDevices() in Chrome without prompt
      if (this.isBluetoothSupported() && (navigator as any).bluetooth?.getDevices) {
        const devices = await (navigator as any).bluetooth.getDevices();
        const match = devices.find(
          (d: any) => d.id === printer.id || d.name === printer.name
        );
        if (match && match.gatt) {
          this.bluetoothDevice = match;
          this.attachDeviceListeners(match);
          const server = await match.gatt.connect();
          const found = await this.setupCharacteristics(server);
          if (found) {
            this.isConnected = true;
            this.isConnecting = false;
            this.notifyStatus();
            return {
              success: true,
              deviceName: printer.name,
              message: `Connected to ${printer.name}!`,
            };
          }
        }
      }

      // 3. If direct background reconnect was not permitted without user prompt, launch scanner
      return await this.connectBluetooth();
    } catch {
      this.isConnecting = false;
      this.notifyStatus();
      return await this.connectBluetooth();
    }
  }

  // Disconnect & optionally forget printer
  disconnect(forget = false) {
    this.manualDisconnect = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.bluetoothDevice?.gatt?.connected) {
      try {
        this.bluetoothDevice.gatt.disconnect();
      } catch (e) {
        console.warn('Error disconnecting GATT:', e);
      }
    }

    this.isConnected = false;
    this.characteristic = null;

    if (forget) {
      this.bluetoothDevice = null;
      storageService.clearSavedPrinter();
    }

    this.notifyStatus();
  }

  // Generate plain formatted text preview for thermal receipt
  generateReceiptText(bill: BillInvoice, settings: ThermalPrinterSettings): string {
    const width = settings.paperWidth === '80mm' ? 48 : 32;
    const divider = '-'.repeat(width);
    const doubleDiv = '='.repeat(width);

    const padCenter = (str: string) => {
      const len = str.length;
      if (len >= width) return str.slice(0, width);
      const left = Math.floor((width - len) / 2);
      return ' '.repeat(left) + str;
    };

    const padBetween = (left: string, right: string) => {
      const space = width - left.length - right.length;
      if (space <= 0) return `${left} ${right}`;
      return left + ' '.repeat(space) + right;
    };

    // Currency symbol resolution for thermal POS receipt
    let sym = '';
    if (!settings.hideCurrencySymbol) {
      const rawSym = (settings.currencySymbol || '').trim();
      if (rawSym.toLowerCase().includes('rs')) {
        sym = 'Rs. ';
      } else if (rawSym.toLowerCase().includes('tk') || rawSym === '৳') {
        sym = 'Tk. ';
      } else if (rawSym === '₹' || rawSym === '?' || !rawSym) {
        // Replace '?' or '₹' with 'Rs. ' to prevent printer driver printing '?'
        sym = 'Rs. ';
      } else {
        const clean = rawSym.replace(/[^\x20-\x7E]/g, '').replace(/\?/g, '').trim();
        sym = clean ? `${clean} ` : 'Rs. ';
      }
    }

    // LABEL MODE: Output format with standard headers and footers removed, focusing strictly on product name, barcode, and price
    if (settings.isLabelMode) {
      const labelLines: string[] = [];

      bill.items.forEach((item, idx) => {
        if (idx > 0) {
          labelLines.push(doubleDiv);
        }
        // 1. PRODUCT NAME
        const cleanName = item.name.replace(/[^\x20-\x7E]/g, '').trim().toUpperCase() || 'PRODUCT';
        labelLines.push(padCenter(cleanName.slice(0, width)));

        // 2. BARCODE (Visual Bars + Numeric/Alphanumeric Barcode String)
        const barcodeVal = (item.barcode || `${bill.invoiceNo || 'INV'}-${idx + 1}`).replace(/[^A-Za-z0-9\-]/g, '');
        labelLines.push(padCenter('||||| |||| |||||| |||| |||||'));
        labelLines.push(padCenter(`*${barcodeVal}*`));

        // 3. PRICE
        labelLines.push(padCenter(`PRICE: ${sym}${item.price.toFixed(2)}`));
      });

      return labelLines.join('\n');
    }

    const lines: string[] = [];

    // Header
    lines.push(padCenter(settings.storeName.toUpperCase()));
    if (settings.storeAddress) lines.push(padCenter(settings.storeAddress));
    if (settings.storePhone) lines.push(padCenter(`Tel: ${settings.storePhone}`));
    lines.push(doubleDiv);

    // Bill Meta
    lines.push(padBetween(`Bill: #${bill.invoiceNo}`, bill.date));
    if (bill.customerName) {
      lines.push(padBetween('Cust:', bill.customerName));
    }
    lines.push(divider);

    // Items table header
    if (width === 48) {
      lines.push(padBetween('ITEM', 'QTY   PRICE   TOTAL'));
    } else {
      lines.push(padBetween('ITEM', 'QTY  TOTAL'));
    }
    lines.push(divider);

    bill.items.forEach((item) => {
      if (width === 48) {
        const itemLine = `${item.name.slice(0, 22)}`;
        const rightCol = `${item.qty}x  ${sym}${item.price.toFixed(2)}  ${sym}${item.total.toFixed(2)}`;
        lines.push(padBetween(itemLine, rightCol));
      } else {
        const itemLine = `${item.name.slice(0, 18)}`;
        const rightCol = `${item.qty}x ${sym}${item.total.toFixed(2)}`;
        lines.push(padBetween(itemLine, rightCol));
      }
    });

    lines.push(divider);

    // Totals
    lines.push(padBetween('SUBTOTAL:', `${sym}${bill.subtotal.toFixed(2)}`));
    if (bill.discount > 0) {
      const discountLabel =
        bill.discountType === 'percent' && bill.discountValue
          ? `DISCOUNT (${bill.discountValue}%):`
          : 'DISCOUNT:';
      lines.push(padBetween(discountLabel, `-${sym}${bill.discount.toFixed(2)}`));
    } else {
      lines.push(padBetween('DISCOUNT:', `${sym}0.00`));
    }
    lines.push(doubleDiv);
    lines.push(padBetween('GRAND TOTAL:', `${sym}${bill.grandTotal.toFixed(2)}`));
    lines.push(padBetween('PAYMENT:', bill.paymentMethod.toUpperCase()));

    if (bill.paidAmount > 0) {
      lines.push(padBetween('PAID:', `${sym}${bill.paidAmount.toFixed(2)}`));
      lines.push(padBetween('CHANGE:', `${sym}${bill.changeAmount.toFixed(2)}`));
    }

    lines.push(doubleDiv);

    // Clean footer note to completely eradicate '?' and non-ASCII marks on thermal receipts
    let cleanFooter = (settings.footerNote || '').trim();
    // Strip any Bengali/Indic Unicode scripts
    cleanFooter = cleanFooter.replace(/[\u0980-\u09FF]/g, '').trim();
    // Strip any question marks completely (e.g. from ??????!)
    cleanFooter = cleanFooter.replace(/\?+/g, '').trim();
    // Remove leftover empty parentheses like "()" or "( )"
    cleanFooter = cleanFooter.replace(/\(\s*\)/g, '').trim();
    // Keep only clean printable ASCII
    cleanFooter = cleanFooter.replace(/[^\x20-\x7E]/g, '').trim();
    cleanFooter = cleanFooter.replace(/\?/g, '').trim();
    if (!cleanFooter || cleanFooter.length < 3) {
      cleanFooter = 'Thank you! Visit again.';
    }

    lines.push(padCenter(cleanFooter));
    lines.push(padCenter('Powered by Simple Shop POS'));

    return lines.join('\n');
  }

  // Generate ESC/POS Raw Binary commands
  generateEscPosCommands(bill: BillInvoice, settings: ThermalPrinterSettings): Uint8Array {
    const commands: number[] = [];

    // ESC @: Initialize printer
    commands.push(0x1b, 0x40);

    // ESC t 0: Select code page (PC437 / Standard)
    commands.push(0x1b, 0x74, 0x00);

    const appendText = (str: string) => {
      for (let i = 0; i < str.length; i++) {
        const charCode = str.charCodeAt(i);
        // Only append valid standard ASCII. Never push 0x3f ('?') for non-ASCII characters to avoid '???'
        if (charCode < 128) {
          commands.push(charCode);
        }
      }
    };

    // LABEL MODE ESC/POS: Focused solely on product name, barcode, and price without any headers or footers
    if (settings.isLabelMode) {
      let sym = '';
      if (!settings.hideCurrencySymbol) {
        const rawSym = (settings.currencySymbol || '').trim();
        if (rawSym.toLowerCase().includes('rs')) {
          sym = 'Rs. ';
        } else if (rawSym.toLowerCase().includes('tk') || rawSym === '৳') {
          sym = 'Tk. ';
        } else if (rawSym === '₹' || rawSym === '?' || !rawSym) {
          sym = 'Rs. ';
        } else {
          const clean = rawSym.replace(/[^\x20-\x7E]/g, '').replace(/\?/g, '').trim();
          sym = clean ? `${clean} ` : 'Rs. ';
        }
      }

      bill.items.forEach((item, idx) => {
        if (idx > 0) {
          commands.push(0x0a);
          commands.push(0x1b, 0x61, 0x01); // Center
          appendText('--------------------------------\n');
        }

        // Center align
        commands.push(0x1b, 0x61, 0x01);

        // 1. PRODUCT NAME (Bold)
        commands.push(0x1b, 0x45, 0x01);
        const cleanName = item.name.replace(/[^\x20-\x7E]/g, '').trim().toUpperCase() || 'PRODUCT';
        appendText(`${cleanName}\n`);
        commands.push(0x1b, 0x45, 0x00);

        // 2. BARCODE
        const rawCode = (item.barcode || `${bill.invoiceNo || 'INV'}-${idx + 1}`).replace(/[^A-Za-z0-9\-]/g, '');
        // ESC/POS Code128 Barcode: GS h, GS w, GS f, GS H
        commands.push(0x1d, 0x68, 0x38); // Height
        commands.push(0x1d, 0x77, 0x02); // Width
        commands.push(0x1d, 0x66, 0x00); // Font A (12x24 large clear digits for HRI numbers)
        commands.push(0x1d, 0x48, 0x02); // HRI characters below
        const codeBytes = [0x7b, 0x42]; // Code Set B
        for (let i = 0; i < rawCode.length; i++) {
          codeBytes.push(rawCode.charCodeAt(i));
        }
        commands.push(0x1d, 0x6b, 0x49, codeBytes.length, ...codeBytes);
        commands.push(0x0a);
        appendText(`*${rawCode}*\n`);

        // 3. PRICE (Bold)
        commands.push(0x1b, 0x45, 0x01);
        appendText(`PRICE: ${sym}${item.price.toFixed(2)}\n`);
        commands.push(0x1b, 0x45, 0x00);
        commands.push(0x0a);
      });

      commands.push(0x0a, 0x0a);
      commands.push(0x1d, 0x56, 0x41, 0x10); // Partial Cut
      return new Uint8Array(commands);
    }

    let receiptText = this.generateReceiptText(bill, settings);
    // Absolute Safety Net: Strip any rogue '?' characters (e.g. '?500.00' -> '500.00', '???????' -> '')
    receiptText = receiptText.replace(/\?+(\d)/g, '$1').replace(/\?{2,}/g, '');
    appendText(receiptText);

    // Feed and Paper Cut
    commands.push(0x0a, 0x0a, 0x0a);
    commands.push(0x1d, 0x56, 0x41, 0x10); // GS V 65: Partial Cut

    return new Uint8Array(commands);
  }

  // RawBT Android App Integration via Intent Scheme
  // Sends raw ESC/POS binary data to the RawBT Android app for 1-tap mobile thermal printing
  printViaRawBT(bill: BillInvoice, settings: ThermalPrinterSettings): void {
    try {
      const bytes = this.generateEscPosCommands(bill, settings);
      let binary = '';
      const len = bytes.byteLength;
      for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const base64EscPos = btoa(binary);

      // Official RawBT Android Intent URL
      // If RawBT is installed, it opens and prints immediately.
      // If not, it falls back to the Google Play Store page for ru.a402d.rawbtprinter
      const playStoreFallback = encodeURIComponent(
        'https://play.google.com/store/apps/details?id=ru.a402d.rawbtprinter'
      );
      const intentUrl = `intent:base64,${base64EscPos}#Intent;scheme=rawbt;package=ru.a402d.rawbtprinter;S.browser_fallback_url=${playStoreFallback};end;`;

      window.location.href = intentUrl;
    } catch (e) {
      console.error('Failed to trigger RawBT intent, falling back to browser print:', e);
      this.printViaBrowser(bill, settings);
    }
  }

  // Print via Web Bluetooth GATT (Silent direct stream to thermal printer)
  async printViaBluetooth(
    bill: BillInvoice,
    settings: ThermalPrinterSettings
  ): Promise<{ success: boolean; message: string; deviceName?: string }> {
    // 1. Check if Bluetooth is connected and characteristic is writable
    if (!this.isConnected || !this.characteristic || !this.bluetoothDevice?.gatt?.connected) {
      // Try silent auto-reconnect if device reference or saved printer exists
      const reconnected = await this.autoReconnect();
      if (!reconnected || !this.characteristic) {
        return {
          success: false,
          message: 'Printer not connected. Please pair your Bluetooth printer first.',
        };
      }
    }

    try {
      const data = this.generateEscPosCommands(bill, settings);
      const CHUNK_SIZE = 64; // Standard BLE MTU-safe chunk size for thermal printers
      const canWriteWithoutResponse =
        this.characteristic.properties?.writeWithoutResponse &&
        typeof this.characteristic.writeValueWithoutResponse === 'function';

      console.log(
        `Streaming ${data.length} bytes of ESC/POS data to ${this.bluetoothDevice?.name || 'printer'}...`
      );

      await this.writeRawChunks(data);

      return {
        success: true,
        deviceName: this.bluetoothDevice?.name || 'Bluetooth Printer',
        message: `Invoice #${bill.invoiceNo} printed directly via Bluetooth.`,
      };
    } catch (e: any) {
      console.error('Bluetooth write failed:', e);
      this.isConnected = false;
      this.characteristic = null;
      this.notifyStatus();
      return {
        success: false,
        message: `Bluetooth write failed: ${e?.message || 'Connection interrupted'}`,
      };
    }
  }

  // High-speed chunked BLE writer for raw ESC/POS & TSPL binary buffers
  async writeRawChunks(data: Uint8Array): Promise<void> {
    if (!this.characteristic) {
      throw new Error('Bluetooth printer characteristic not found');
    }

    const canWriteWithoutResponse =
      Boolean(this.characteristic.properties?.writeWithoutResponse) &&
      typeof this.characteristic.writeValueWithoutResponse === 'function';

    // Optimize chunk size: 128 bytes allows 2x-3x higher throughput while remaining safe for BLE MTU
    const CHUNK_SIZE = canWriteWithoutResponse ? 128 : 96;

    for (let i = 0; i < data.length; i += CHUNK_SIZE) {
      const chunk = data.slice(i, i + CHUNK_SIZE);
      let written = false;
      let attempts = 0;

      while (!written && attempts < 2) {
        attempts++;
        try {
          if (canWriteWithoutResponse) {
            await this.characteristic.writeValueWithoutResponse(chunk);
          } else if (typeof this.characteristic.writeValueWithResponse === 'function') {
            await this.characteristic.writeValueWithResponse(chunk);
          } else if (typeof this.characteristic.writeValue === 'function') {
            await this.characteristic.writeValue(chunk);
          }
          written = true;
        } catch (chunkErr) {
          if (attempts >= 2) throw chunkErr;
          await new Promise((r) => setTimeout(r, 10));
        }
      }

      // Ultra-low latency transmission: writeWithResponse already waits for BLE ACK,
      // while writeWithoutResponse only needs a tiny 2ms pause to prevent buffer overrun
      if (canWriteWithoutResponse) {
        await new Promise((r) => setTimeout(r, 2));
      }
    }
  }

  // Convert HTMLCanvasElement into ESC/POS monochrome raster image (GS v 0)
  convertCanvasToEscPosRaster(
    canvas: HTMLCanvasElement,
    targetWidthDots: number = 384,
    darknessThreshold: number = 165,
    isLabelMode: boolean = false,
    invertPolarity: boolean = true
  ): Uint8Array {
    const targetWidth = Math.min(targetWidthDots, 576);
    const scale = targetWidth / canvas.width;
    const targetHeight = Math.round(canvas.height * scale);

    const offscreen = document.createElement('canvas');
    offscreen.width = targetWidth;
    offscreen.height = targetHeight;
    const ctx = offscreen.getContext('2d', { willReadFrequently: true });
    if (!ctx) return new Uint8Array();

    // 1. Solid Pure White Background (#FFFFFF) - Must NOT heat the printer
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, targetWidth, targetHeight);
    // Draw canvas image on top of solid white background
    ctx.drawImage(canvas, 0, 0, targetWidth, targetHeight);

    const imgData = ctx.getImageData(0, 0, targetWidth, targetHeight);
    const data = imgData.data;

    // width in bytes:
    const widthBytes = Math.ceil(targetWidth / 8);
    const totalRasterBytes = widthBytes * targetHeight;

    // GS v 0 0 xL xH yL yH
    const xL = widthBytes & 0xFF;
    const xH = (widthBytes >> 8) & 0xFF;
    const yL = targetHeight & 0xFF;
    const yH = (targetHeight >> 8) & 0xFF;

    const header = [
      0x1B, 0x40,             // ESC @: Initialize printer
      0x1B, 0x61, 0x01,       // ESC a 1: Center justify
      0x1D, 0x76, 0x30, 0x00, // GS v 0 0: Raster bit image normal mode
      xL, xH, yL, yH
    ];

    const body = new Uint8Array(totalRasterBytes);
    let byteIndex = 0;

    for (let y = 0; y < targetHeight; y++) {
      for (let xByte = 0; xByte < widthBytes; xByte++) {
        let byteVal = 0;
        for (let bit = 0; bit < 8; bit++) {
          const x = xByte * 8 + bit;
          if (x < targetWidth) {
            const pixelIdx = (y * targetWidth + x) * 4;
            const r = data[pixelIdx];
            const g = data[pixelIdx + 1];
            const b = data[pixelIdx + 2];
            const a = data[pixelIdx + 3];

            // Invert bit logic:
            // WHITE pixels ((r+g+b)/3 >= threshold or transparent) produce unheated bits
            // DARK pixels ((r+g+b)/3 < threshold) produce heated bits (black dots)
            const lum = (r + g + b) / 3;
            const isDark = a > 120 && lum < darknessThreshold;
            if (isDark) {
              byteVal |= (1 << (7 - bit));
            }
          }
        }
        // Bitwise Inversion: invert each generated byte with byte = byte ^ 0xFF
        // so that WHITE canvas background remains unheated and black text/barcode heats
        const finalByte = invertPolarity ? (byteVal ^ 0xFF) : byteVal;
        body[byteIndex++] = finalByte & 0xFF;
      }
    }

    // Trailing feed lines: In 50mmx25mm label mode, feed only 1 line or FF to stop cleanly at label gap
    const footer = isLabelMode ? [0x0A] : [0x0A, 0x0A, 0x0A];

    const result = new Uint8Array(header.length + body.length + footer.length);
    result.set(header, 0);
    result.set(body, header.length);
    result.set(footer, header.length + body.length);

    return result;
  }

  // Convert HTMLCanvasElement into TSPL (Label Printer) binary command stream
  convertCanvasToTsplBinary(
    canvas: HTMLCanvasElement,
    widthMm: number = 50,
    heightMm: number = 25,
    copies: number = 1,
    darknessThreshold: number = 165,
    invertPolarity: boolean = true
  ): Uint8Array {
    // 203 DPI = 8 dots/mm (Standard for Xprinter, Rongta, Gprinter, etc.)
    const targetWidthDots = Math.round(widthMm * 8); // e.g. 50 * 8 = 400 dots
    const targetHeightDots = Math.round(heightMm * 8); // e.g. 25 * 8 = 200 dots
    const widthBytes = Math.ceil(targetWidthDots / 8);
    const totalBytes = widthBytes * targetHeightDots;

    const offscreen = document.createElement('canvas');
    offscreen.width = targetWidthDots;
    offscreen.height = targetHeightDots;
    const ctx = offscreen.getContext('2d', { willReadFrequently: true });
    if (!ctx) return new Uint8Array();

    // 1. Solid Pure White Background (#FFFFFF)
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, targetWidthDots, targetHeightDots);
    ctx.drawImage(canvas, 0, 0, targetWidthDots, targetHeightDots);

    const imgData = ctx.getImageData(0, 0, targetWidthDots, targetHeightDots);
    const data = imgData.data;

    const bitmapData = new Uint8Array(totalBytes);
    let byteIdx = 0;

    for (let y = 0; y < targetHeightDots; y++) {
      for (let xByte = 0; xByte < widthBytes; xByte++) {
        let byteVal = 0;
        for (let bit = 0; bit < 8; bit++) {
          const x = xByte * 8 + bit;
          if (x < targetWidthDots) {
            const pixelIdx = (y * targetWidthDots + x) * 4;
            const r = data[pixelIdx];
            const g = data[pixelIdx + 1];
            const b = data[pixelIdx + 2];
            const a = data[pixelIdx + 3];

            // Invert bit logic:
            // WHITE pixels ((r+g+b)/3 >= threshold or transparent) produce unheated bits
            // DARK pixels ((r+g+b)/3 < threshold) produce heated bits (black dots)
            const lum = (r + g + b) / 3;
            const isDark = a > 120 && lum < darknessThreshold;
            if (isDark) {
              byteVal |= (1 << (7 - bit));
            }
          }
        }
        // Bitwise Inversion: In TSPL BITMAP mode, 0 is burn (heated black dot) and 1 is unheated (white paper).
        const finalByte = invertPolarity ? (byteVal ^ 0xFF) : byteVal;
        bitmapData[byteIdx++] = finalByte & 0xFF;
      }
    }

    const enc = new TextEncoder();
    const cmdHeader = enc.encode(
      `SIZE ${widthMm} mm, ${heightMm} mm\r\n` +
      `GAP 2 mm, 0 mm\r\n` +
      `DIRECTION 1,0\r\n` +
      `REFERENCE 0,0\r\n` +
      `CLS\r\n` +
      `BITMAP 0,0,${widthBytes},${targetHeightDots},0,`
    );
    const cmdFooter = enc.encode(`\r\nPRINT ${copies},1\r\n`);

    const result = new Uint8Array(cmdHeader.length + bitmapData.length + cmdFooter.length);
    result.set(cmdHeader, 0);
    result.set(bitmapData, cmdHeader.length);
    result.set(cmdFooter, cmdHeader.length + bitmapData.length);

    return result;
  }

  // Native TSPL Label Command Generator for 50mm x 25mm stickers
  generateTsplCommandString(options: {
    storeName?: string;
    itemName?: string;
    barcodeValue?: string;
    barcodeType?: 'CODE128' | 'EAN13' | 'QR';
    mrp?: number;
    salePrice?: number;
    pricePrefix?: string;
    widthMm?: number;
    heightMm?: number;
    copies?: number;
    showStoreName?: boolean;
    showItemName?: boolean;
    showPrice?: boolean;
    showBarcode?: boolean;
    direction?: '0,0' | '1,0';
    alignment?: 'left' | 'center' | 'right';
    shopX?: number;
    shopY?: number;
    shopFont?: '1' | '2' | '3' | '4';
    barcodeX?: number;
    barcodeY?: number;
    barcodeHeight?: number;
    barcodeRatio?: '2:3' | '1:2' | '2:2';
    priceX?: number;
    priceY?: number;
    priceFont?: '1' | '2' | '3' | '4';
  }): string {
    const {
      storeName = '',
      itemName = '',
      barcodeValue = '1001',
      barcodeType = 'CODE128',
      mrp,
      salePrice = 0,
      pricePrefix = 'MRP: Rs. ',
      widthMm = 50,
      heightMm = 25,
      copies = 1,
      showStoreName = true,
      showItemName = false,
      showPrice = true,
      showBarcode = true,
      direction = '1,0',
      alignment = 'center',
      shopX,
      shopY = 16,
      shopFont = '3',
      barcodeX,
      barcodeY = 48,
      barcodeHeight = 44,
      barcodeRatio = '2:3',
      priceX,
      priceY = 142,
      priceFont = '3',
    } = options;

    // 203 DPI = 8 dots/mm (50mm = 400 dots, 25mm = 200 dots)
    const labelWidthDots = Math.round(widthMm * 8);

    const getFontCharWidth = (f: string) => {
      if (f === '1') return 8;
      if (f === '2') return 12;
      if (f === '4') return 24;
      return 16; // default Font "3" (16x24 dots)
    };

    const calcAlignedX = (textLen: number, charW: number, align: 'left' | 'center' | 'right') => {
      const textWidth = textLen * charW;
      if (align === 'left') return 20;
      if (align === 'right') return Math.max(10, labelWidthDots - 20 - textWidth);
      return Math.max(10, Math.round((labelWidthDots - textWidth) / 2));
    };

    let elements = '';

    // ==========================================
    // 1. LINE 1 (TOP, Y=16): SHOP NAME
    // ==========================================
    const cleanStore = (storeName || itemName || 'MY STORE').trim().replace(/["\r\n]/g, '');
    if ((showStoreName && cleanStore) || (!showStoreName && showItemName && itemName)) {
      const line1Text = (showStoreName && cleanStore ? cleanStore : (itemName || '')).trim().replace(/["\r\n]/g, '');
      const charW1 = getFontCharWidth(shopFont);
      const x1 = shopX !== undefined ? Math.max(0, Math.round(shopX)) : calcAlignedX(line1Text.length, charW1, alignment);
      const y1 = Math.max(0, Math.round(shopY));

      elements += `TEXT ${x1},${y1},"${shopFont}",0,1,1,"${line1Text}"\r\n`;
    }

    // ==========================================
    // 2. LINE 2 (MIDDLE, Y=48): BARCODE + CLEAN CENTERED NUMBER BELOW
    // ==========================================
    if (showBarcode !== false) {
      const cleanCode = (barcodeValue || '1001').trim().replace(/["\r\n]/g, '');
      const bY = Math.max(0, Math.round(barcodeY));
      const bHeight = Math.max(20, Math.min(120, Math.round(barcodeHeight)));

      if (barcodeType === 'QR') {
        const qrWidthDots = 100;
        const qrX = barcodeX !== undefined ? Math.max(0, Math.round(barcodeX)) : calcAlignedX(1, qrWidthDots, alignment);
        elements += `QRCODE ${qrX},${bY},L,4,A,0,"${cleanCode}"\r\n`;
      } else {
        const narrow = barcodeRatio === '1:2' ? 1 : 2;
        const wide = barcodeRatio === '1:2' ? 2 : barcodeRatio === '2:2' ? 2 : 3;
        // Accurate Code128 module count: numeric pairs use Subset C (1 symbol per 2 digits)
        const isPureNumericEven = /^\d+$/.test(cleanCode) && cleanCode.length >= 4;
        const dataSymbols = isPureNumericEven ? Math.ceil(cleanCode.length / 2) : cleanCode.length;
        const totalModules = (dataSymbols + 3) * 11 + 2;
        const estBarcodeWidth = totalModules * narrow;
        const bX =
          barcodeX !== undefined
            ? Math.max(0, Math.round(barcodeX))
            : alignment === 'left'
            ? 20
            : alignment === 'right'
            ? Math.max(10, labelWidthDots - 20 - estBarcodeWidth)
            : Math.max(20, Math.round((labelWidthDots - estBarcodeWidth) / 2));

        // Draw barcode bars with human_readable=0 and render crisp Font "2" digits centered below
        elements += `BARCODE ${bX},${bY},"128",${bHeight},0,0,${narrow},${wide},"${cleanCode}"\r\n`;
        const numCharW = 12; // Font "2" (12x20 dots)
        const numX = calcAlignedX(cleanCode.length, numCharW, alignment);
        const numY = bY + bHeight + 6;
        elements += `TEXT ${numX},${numY},"2",0,1,1,"${cleanCode}"\r\n`;
      }
    }

    // ==========================================
    // 3. LINE 3 (BOTTOM, Y=140): MRP / PRICE
    // ==========================================
    if (showPrice) {
      const activePrice = mrp || salePrice || 0;
      const priceText = `${pricePrefix}${activePrice}`.trim().replace(/["\r\n]/g, '');
      const charW3 = getFontCharWidth(priceFont);
      const pX = priceX !== undefined ? Math.max(0, Math.round(priceX)) : calcAlignedX(priceText.length, charW3, alignment);
      const pY = Math.max(0, Math.round(priceY));

      elements += `TEXT ${pX},${pY},"${priceFont}",0,1,1,"${priceText}"\r\n`;
    }

    return (
      `SIZE ${widthMm} mm, ${heightMm} mm\r\n` +
      `GAP 2 mm, 0 mm\r\n` +
      `DIRECTION ${direction}\r\n` +
      `CLS\r\n` +
      elements +
      `PRINT ${Math.max(1, copies)},1\r\n`
    );
  }

  // Print label using native TSPL commands directly via Bluetooth
  async printNativeTsplLabelViaBluetooth(options: Parameters<ThermalPrinterService['generateTsplCommandString']>[0]): Promise<{
    success: boolean;
    message: string;
    deviceName?: string;
  }> {
    const tsplCmd = this.generateTsplCommandString(options);
    return this.printNativeTsplViaBluetooth(tsplCmd);
  }

  // Send native TSPL text commands directly over Bluetooth GATT stream
  async printNativeTsplViaBluetooth(
    tsplString: string
  ): Promise<{ success: boolean; message: string; deviceName?: string }> {
    if (!this.isConnected || !this.characteristic || !this.bluetoothDevice?.gatt?.connected) {
      const reconnected = await this.autoReconnect();
      if (!reconnected || !this.characteristic) {
        return {
          success: false,
          message: 'Bluetooth thermal printer is not connected. Please pair or connect your printer.',
        };
      }
    }
    try {
      const enc = new TextEncoder();
      const bytes = enc.encode(tsplString);
      await this.writeRawChunks(bytes);
      return {
        success: true,
        deviceName: this.bluetoothDevice?.name || 'Bluetooth Label Printer',
        message: 'Native TSPL command sent to printer successfully!',
      };
    } catch (e: any) {
      return {
        success: false,
        message: e?.message || 'Failed to stream TSPL command',
      };
    }
  }

  // Direct Bluetooth Thermal Print for Barcode & Price Tag Sticker (ESC/POS & TSPL)
  async printLabelBitmapViaBluetooth(
    canvas: HTMLCanvasElement,
    copies: number = 1,
    paperWidth: '50mm_label' | '58mm' | '80mm' = '50mm_label',
    darknessThreshold: number = 165,
    protocol: 'escpos' | 'tspl' = 'escpos',
    widthMm: number = 50,
    heightMm: number = 25,
    invertPolarity: boolean = true
  ): Promise<{ success: boolean; message: string; deviceName?: string }> {
    if (!this.isConnected || !this.characteristic || !this.bluetoothDevice?.gatt?.connected) {
      const reconnected = await this.autoReconnect();
      if (!reconnected || !this.characteristic) {
        return {
          success: false,
          message: 'Bluetooth thermal printer is not connected. Please pair or connect your printer.',
        };
      }
    }

    try {
      const safeCopies = Math.max(1, Math.min(copies, 50));

      // TSPL Protocol for dedicated label printers (Xprinter, Rongta, etc.)
      if (protocol === 'tspl') {
        const tsplBytes = this.convertCanvasToTsplBinary(
          canvas,
          widthMm,
          heightMm,
          safeCopies,
          darknessThreshold,
          invertPolarity
        );
        if (!tsplBytes || tsplBytes.length === 0) {
          return { success: false, message: 'Failed to generate TSPL label commands' };
        }
        await this.writeRawChunks(tsplBytes);
        return {
          success: true,
          deviceName: this.bluetoothDevice?.name || 'Bluetooth Label Printer',
          message: `${safeCopies} barcode label(s) printed via TSPL Bluetooth!`,
        };
      }

      // ESC/POS Raster Mode (Universal thermal printer support)
      const isLabel = paperWidth === '50mm_label';
      const printerWidthDots = paperWidth === '80mm' ? 576 : 384;
      const rasterBytes = this.convertCanvasToEscPosRaster(
        canvas,
        printerWidthDots,
        darknessThreshold,
        isLabel,
        invertPolarity
      );

      if (!rasterBytes || rasterBytes.length === 0) {
        return { success: false, message: 'Failed to generate barcode raster image' };
      }

      for (let c = 0; c < safeCopies; c++) {
        await this.writeRawChunks(rasterBytes);
        if (c < safeCopies - 1) {
          // Swift 60ms inter-label pacing
          await new Promise((r) => setTimeout(r, 60));
        }
      }

      return {
        success: true,
        deviceName: this.bluetoothDevice?.name || 'Bluetooth Thermal Printer',
        message: `${safeCopies} barcode label(s) printed directly via Bluetooth!`,
      };
    } catch (err: any) {
      console.error('Bluetooth label print failed:', err);
      this.isConnected = false;
      this.characteristic = null;
      this.notifyStatus();
      return {
        success: false,
        message: `Bluetooth print failed: ${err?.message || 'Check printer connection'}`,
      };
    }
  }

  // Send raw barcode sticker image to RawBT App via Android Intent
  printLabelViaRawBT(
    canvas: HTMLCanvasElement,
    copies: number = 1,
    paperWidth: '50mm_label' | '58mm' | '80mm' = '50mm_label',
    invertPolarity: boolean = true
  ): void {
    try {
      const isLabel = paperWidth === '50mm_label';
      const printerWidthDots = paperWidth === '80mm' ? 576 : 384;
      const rasterBytes = this.convertCanvasToEscPosRaster(
        canvas,
        printerWidthDots,
        165,
        isLabel,
        invertPolarity
      );
      const safeCopies = Math.max(1, Math.min(copies, 20));

      let allBytes: Uint8Array;
      if (safeCopies === 1) {
        allBytes = rasterBytes;
      } else {
        allBytes = new Uint8Array(rasterBytes.length * safeCopies);
        for (let i = 0; i < safeCopies; i++) {
          allBytes.set(rasterBytes, i * rasterBytes.length);
        }
      }

      let binary = '';
      const len = allBytes.byteLength;
      for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(allBytes[i]);
      }
      const base64Data = btoa(binary);
      const playStoreFallback = encodeURIComponent(
        'https://play.google.com/store/apps/details?id=ru.a402d.rawbtprinter'
      );
      const intentUrl = `intent:base64,${base64Data}#Intent;scheme=rawbt;package=ru.a402d.rawbtprinter;S.browser_fallback_url=${playStoreFallback};end;`;
      window.location.href = intentUrl;
    } catch (e) {
      console.error('RawBT label print failed:', e);
    }
  }

  // Quick Test Print to verify Bluetooth connection
  async printTestReceipt(
    settings: ThermalPrinterSettings
  ): Promise<{ success: boolean; message: string }> {
    if (!this.isConnected || !this.characteristic) {
      await this.autoReconnect();
    }

    if (!this.isConnected || !this.characteristic) {
      return {
        success: false,
        message: 'Printer not connected. Please tap "Connect Printer" first.',
      };
    }

    const width = settings.paperWidth === '80mm' ? 48 : 32;
    const divider = '-'.repeat(width);
    const doubleDiv = '='.repeat(width);

    const padCenter = (str: string) => {
      const len = str.length;
      if (len >= width) return str.slice(0, width);
      const left = Math.floor((width - len) / 2);
      return ' '.repeat(left) + str;
    };

    const text = [
      doubleDiv,
      padCenter('BLUETOOTH PRINTER TEST'),
      padCenter('STATUS: CONNECTED & READY'),
      padCenter(settings.storeName.toUpperCase()),
      divider,
      padCenter(`Roll: ${settings.paperWidth} | BLE ESC/POS Direct`),
      padCenter(
        `${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`
      ),
      doubleDiv,
      padCenter('Direct Web Bluetooth OK!'),
      '\n\n\n',
    ].join('\n');

    try {
      const commands: number[] = [0x1b, 0x40, 0x1b, 0x74, 0x00];
      for (let i = 0; i < text.length; i++) {
        const charCode = text.charCodeAt(i);
        if (charCode < 128) {
          commands.push(charCode);
        }
      }
      commands.push(0x0a, 0x0a, 0x0a);
      commands.push(0x1d, 0x56, 0x41, 0x10); // Cut
      const data = new Uint8Array(commands);

      const CHUNK_SIZE = 64;
      const canWriteWithoutResponse =
        this.characteristic.properties?.writeWithoutResponse &&
        typeof this.characteristic.writeValueWithoutResponse === 'function';

      for (let i = 0; i < data.length; i += CHUNK_SIZE) {
        const chunk = data.slice(i, i + CHUNK_SIZE);
        if (canWriteWithoutResponse) {
          await this.characteristic.writeValueWithoutResponse(chunk);
        } else if (typeof this.characteristic.writeValue === 'function') {
          await this.characteristic.writeValue(chunk);
        } else if (typeof this.characteristic.writeValueWithResponse === 'function') {
          await this.characteristic.writeValueWithResponse(chunk);
        }
        await new Promise((r) => setTimeout(r, 15));
      }

      return {
        success: true,
        message: 'Test slip printed directly via Bluetooth!',
      };
    } catch (e: any) {
      console.warn('Bluetooth test print write error:', e);
      return {
        success: false,
        message: `Failed to stream test slip: ${e?.message || 'Error'}`,
      };
    }
  }

  // Standard A4 / Sheet Tax Invoice Print (Matching user uploaded clear bill)
  printTaxInvoiceElement(invoiceElement: HTMLElement, bill: BillInvoice) {
    let thermalRoot = document.getElementById('thermal-print-root');
    if (thermalRoot) {
      thermalRoot.classList.remove('active-print');
    }

    let invoiceRoot = document.getElementById('invoice-print-root');
    if (!invoiceRoot) {
      invoiceRoot = document.createElement('div');
      invoiceRoot.id = 'invoice-print-root';
      document.body.appendChild(invoiceRoot);
    }

    // Clone the exact rendered tax invoice element
    invoiceRoot.innerHTML = '';
    const clone = invoiceElement.cloneNode(true) as HTMLElement;
    invoiceRoot.appendChild(clone);
    invoiceRoot.classList.add('active-print');

    const originalTitle = document.title;
    const formattedDate = bill.date.replace(/[\/\s:]/g, '-');
    document.title = `Sale_${bill.invoiceNo}_${formattedDate}`;

    setTimeout(() => {
      window.print();
      setTimeout(() => {
        document.title = originalTitle;
        if (invoiceRoot) {
          invoiceRoot.classList.remove('active-print');
          invoiceRoot.innerHTML = '';
        }
      }, 1000);
    }, 60);
  }

  // Browser Print Dialog for Thermal Roll (58mm / 80mm)
  printViaBrowser(bill: BillInvoice, settings: ThermalPrinterSettings) {
    let invoiceRoot = document.getElementById('invoice-print-root');
    if (invoiceRoot) {
      invoiceRoot.classList.remove('active-print');
    }

    const formatted = this.generateReceiptText(bill, settings);

    let root = document.getElementById('thermal-print-root');
    if (!root) {
      root = document.createElement('div');
      root.id = 'thermal-print-root';
      document.body.appendChild(root);
    }

    const paperClass = settings.paperWidth === '80mm' ? 'thermal-paper-80mm' : 'thermal-paper-58mm';
    root.innerHTML = `<div class="${paperClass} receipt-mono">${formatted}</div>`;
    root.classList.add('active-print');

    const originalTitle = document.title;
    document.title = `Invoice-${bill.invoiceNo}`;

    setTimeout(() => {
      window.print();
      setTimeout(() => {
        document.title = originalTitle;
        if (root) {
          root.classList.remove('active-print');
        }
      }, 1000);
    }, 60);
  }
}

export const thermalPrinterService = new ThermalPrinterService();

