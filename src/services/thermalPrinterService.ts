import { BillInvoice, ThermalPrinterSettings, BluetoothDeviceInfo } from '../types';
import { storageService } from './storageService';

// Comprehensive list of standard Bluetooth Thermal Printer Service UUIDs
export const POS_SERVICES = [
  '000018f0-0000-1000-8000-00805f9b34fb', // Standard POS Print Service
  '0000ffe0-0000-1000-8000-00805f9b34fb', // Common HM-10 / Serial BLE
  '0000ff00-0000-1000-8000-00805f9b34fb', // POS-58 / JP-QR73 / Zjiang / MPT-II
  '49535343-fe7d-4ae5-8fa9-9fafd205e455', // ISSC Transparent UART
  'e7810a71-73ae-499d-8c15-faa9aef0c3f2', // Rongta / Xprinter / Goojprt
  '6e400001-b5a3-f393-e0a9-e50e24dcca9e', // Nordic UART Service (NUS)
  '0000ae30-0000-1000-8000-00805f9b34fb', // Milestone / Zebra BLE
  '0000fee7-0000-1000-8000-00805f9b34fb', // Tencent / BLE Serial
  '000018f1-0000-1000-8000-00805f9b34fb',
  '0000af30-0000-1000-8000-00805f9b34fb',
  'd8c30001-9f93-4a6a-a238-d65e23631988',
  '0000fff0-0000-1000-8000-00805f9b34fb',
  '0000fee0-0000-1000-8000-00805f9b34fb',
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

  setStatusListener(callback: (status: BluetoothDeviceInfo) => void) {
    this.onStatusChangeCallback = callback;
    this.notifyStatus();
  }

  private notifyStatus() {
    if (this.onStatusChangeCallback) {
      const saved = storageService.getSavedPrinter();
      this.onStatusChangeCallback({
        connected: this.isConnected,
        isConnecting: this.isConnecting,
        deviceName:
          this.bluetoothDevice?.name ||
          (this.isConnected ? (saved?.name || 'Thermal POS Printer') : undefined),
        deviceId: this.bluetoothDevice?.id || saved?.id,
        savedPrinter: saved,
      });
    }
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
      let services: any[] = [];
      try {
        services = await server.getPrimaryServices();
      } catch (e) {
        console.warn('Could not list all services at once, will query known thermal services:', e);
      }

      // If services list is empty, query known POS services individually
      if (!services || services.length === 0) {
        for (const uuid of POS_SERVICES) {
          try {
            const s = await server.getPrimaryService(uuid);
            if (s) services.push(s);
          } catch {
            // Service not present
          }
        }
      }

      // Look for characteristic with writeWithoutResponse or write properties
      for (const service of services) {
        try {
          const characteristics = await service.getCharacteristics();
          for (const char of characteristics) {
            const props = char.properties;
            if (props?.writeWithoutResponse || props?.write) {
              this.characteristic = char;
              console.log(
                'Found writable BLE characteristic:',
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
          console.warn('Could not query characteristics for service:', service.uuid, e);
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
      }

      this.bluetoothDevice = device;
      this.isConnected = true;
      this.isConnecting = false;

      const deviceName = device.name || 'Bluetooth Thermal Printer';

      // Remember paired printer in local storage
      storageService.saveSavedPrinter({
        id: device.id,
        name: deviceName,
        savedAt: Date.now(),
      });

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

    // Items
    bill.items.forEach((item) => {
      const sym = settings.currencySymbol;
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
    const sym = settings.currencySymbol;
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
    lines.push(padCenter(settings.footerNote));
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
        commands.push(charCode < 128 ? charCode : 0x3f);
      }
    };

    const receiptText = this.generateReceiptText(bill, settings);
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
    // 1. Check if Bluetooth is connected
    if (!this.isConnected || !this.characteristic) {
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

      for (let i = 0; i < data.length; i += CHUNK_SIZE) {
        const chunk = data.slice(i, i + CHUNK_SIZE);
        if (canWriteWithoutResponse) {
          await this.characteristic.writeValueWithoutResponse(chunk);
        } else if (typeof this.characteristic.writeValue === 'function') {
          await this.characteristic.writeValue(chunk);
        } else if (typeof this.characteristic.writeValueWithResponse === 'function') {
          await this.characteristic.writeValueWithResponse(chunk);
        }
        // Small 15ms buffer drainage delay between BLE packets to prevent thermal printer buffer overrun
        await new Promise((r) => setTimeout(r, 15));
      }

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
        commands.push(charCode < 128 ? charCode : 0x3f);
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

