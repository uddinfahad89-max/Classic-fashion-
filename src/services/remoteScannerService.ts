// Real-Time WebSocket + HTTP-Fallback Client for Mobile-to-Tablet Barcode Scanning

export type RemoteScannerRole = 'tablet' | 'mobile';

export interface RemoteScanBarcodeEvent {
  roomCode: string;
  scanId: string;
  barcode: string;
  qty: number;
  scannedAt: number;
  replayed?: boolean;
}

export interface RemoteScanAckEvent {
  roomCode: string;
  scanId: string;
  matched: boolean;
  itemName?: string;
  price?: number;
  qtyInBill?: number;
  isDuplicate?: boolean;
  status?: 'added' | 'incremented' | 'needs_price' | 'duplicate_confirm' | 'error';
  error?: string;
}

export interface RemoteRoomPresence {
  roomCode: string;
  tabletCount: number;
  mobileCount: number;
}

export type RemoteConnectionState = 'disconnected' | 'connecting' | 'connected';

const TABLET_ROOM_CODE_KEY = 'pos_remote_scanner_room_v1';
const TABLET_RECEIVER_ACTIVE_KEY = 'pos_remote_scanner_active_v1';
const REMOTE_AUTO_INCREMENT_KEY = 'pos_remote_scanner_auto_inc_v1';
const DEVICE_ID_KEY = 'pos_remote_scanner_device_id_v1';

export function normalizeScannerRoomCode(raw: string): string {
  return String(raw || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 10);
}

export function generateScannerRoomCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export function getOrCreateTabletRoomCode(): string {
  try {
    const saved = normalizeScannerRoomCode(localStorage.getItem(TABLET_ROOM_CODE_KEY) || '');
    if (saved.length >= 4) return saved;
  } catch {}
  const fresh = generateScannerRoomCode();
  try {
    localStorage.setItem(TABLET_ROOM_CODE_KEY, fresh);
  } catch {}
  return fresh;
}

export function regenerateTabletRoomCode(): string {
  const fresh = generateScannerRoomCode();
  try {
    localStorage.setItem(TABLET_ROOM_CODE_KEY, fresh);
  } catch {}
  return fresh;
}

export function getSavedTabletReceiverActive(): boolean {
  try {
    return localStorage.getItem(TABLET_RECEIVER_ACTIVE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function saveTabletReceiverActive(active: boolean): void {
  try {
    localStorage.setItem(TABLET_RECEIVER_ACTIVE_KEY, active ? 'true' : 'false');
  } catch {}
}

export function getRemoteAutoIncrementPref(): boolean {
  try {
    const raw = localStorage.getItem(REMOTE_AUTO_INCREMENT_KEY);
    return raw === null ? true : raw === 'true';
  } catch {
    return true;
  }
}

export function saveRemoteAutoIncrementPref(enabled: boolean): void {
  try {
    localStorage.setItem(REMOTE_AUTO_INCREMENT_KEY, enabled ? 'true' : 'false');
  } catch {}
}

export function getOrCreateDeviceId(): string {
  try {
    const existing = localStorage.getItem(DEVICE_ID_KEY);
    if (existing) return existing;
    const fresh = 'dev-' + Math.random().toString(36).slice(2, 10);
    localStorage.setItem(DEVICE_ID_KEY, fresh);
    return fresh;
  } catch {
    return 'dev-' + Math.random().toString(36).slice(2, 10);
  }
}

export function buildMobileScannerShareUrl(roomCode: string): string {
  if (typeof window === 'undefined') return '';
  const url = new URL(window.location.href);
  url.search = '';
  url.hash = '';
  url.searchParams.set('scanRoom', normalizeScannerRoomCode(roomCode));
  return url.toString();
}

export class RemoteScannerConnection {
  private ws: WebSocket | null = null;
  private role: RemoteScannerRole;
  private roomCode: string;
  private deviceId: string;
  private destroyed = false;
  private reconnectAttempts = 0;
  private reconnectTimer: number | null = null;
  private pingTimer: number | null = null;
  private pollTimer: number | null = null;
  private lastPollSince = Date.now() - 10000;
  private outboundQueue: any[] = [];
  private deliveredScanIds = new Set<string>();

  public connectionState: RemoteConnectionState = 'disconnected';
  public presence: RemoteRoomPresence;

  private onStateChange?: (state: RemoteConnectionState) => void;
  private onPresence?: (presence: RemoteRoomPresence) => void;
  private onBarcode?: (ev: RemoteScanBarcodeEvent) => void;
  private onAck?: (ack: RemoteScanAckEvent) => void;

  constructor(opts: {
    roomCode: string;
    role: RemoteScannerRole;
    onStateChange?: (state: RemoteConnectionState) => void;
    onPresence?: (presence: RemoteRoomPresence) => void;
    onBarcode?: (ev: RemoteScanBarcodeEvent) => void;
    onAck?: (ack: RemoteScanAckEvent) => void;
  }) {
    this.roomCode = normalizeScannerRoomCode(opts.roomCode);
    this.role = opts.role;
    this.deviceId = getOrCreateDeviceId();
    this.presence = {
      roomCode: this.roomCode,
      tabletCount: opts.role === 'tablet' ? 1 : 0,
      mobileCount: opts.role === 'mobile' ? 1 : 0,
    };
    this.onStateChange = opts.onStateChange;
    this.onPresence = opts.onPresence;
    this.onBarcode = opts.onBarcode;
    this.onAck = opts.onAck;
  }

  private setState(state: RemoteConnectionState) {
    this.connectionState = state;
    this.onStateChange?.(state);
  }

  public connect() {
    if (this.destroyed || !this.roomCode || this.roomCode.length < 4) return;
    if (
      this.ws &&
      (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }

    this.setState('connecting');

    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws/scanner`;
      const ws = new WebSocket(wsUrl);
      this.ws = ws;

      ws.onopen = () => {
        if (this.destroyed) {
          ws.close();
          return;
        }
        this.reconnectAttempts = 0;
        this.setState('connected');

        ws.send(
          JSON.stringify({
            type: 'join',
            roomCode: this.roomCode,
            role: this.role,
            deviceId: this.deviceId,
          })
        );

        // Flush any queued messages sent while offline/connecting
        while (this.outboundQueue.length > 0 && ws.readyState === WebSocket.OPEN) {
          const item = this.outboundQueue.shift();
          try {
            ws.send(JSON.stringify(item));
          } catch {}
        }

        // Start 18s keepalive ping
        if (this.pingTimer) window.clearInterval(this.pingTimer);
        this.pingTimer = window.setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            try {
              ws.send(JSON.stringify({ type: 'ping', ts: Date.now() }));
            } catch {}
          }
        }, 18000);
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(String(event.data || '{}'));
          if (!msg || typeof msg !== 'object') return;

          if (msg.type === 'room:joined' || msg.type === 'room:presence') {
            this.presence = {
              roomCode: msg.roomCode || this.roomCode,
              tabletCount: Number(msg.tabletCount) || 0,
              mobileCount: Number(msg.mobileCount) || 0,
            };
            this.onPresence?.(this.presence);
          } else if (msg.type === 'scan:barcode') {
            const scanId = String(msg.scanId || '');
            if (scanId && this.deliveredScanIds.has(scanId)) return;
            if (scanId) this.deliveredScanIds.add(scanId);
            this.onBarcode?.({
              roomCode: msg.roomCode || this.roomCode,
              scanId,
              barcode: String(msg.barcode || ''),
              qty: Number(msg.qty) || 1,
              scannedAt: Number(msg.scannedAt) || Date.now(),
              replayed: Boolean(msg.replayed),
            });
          } else if (msg.type === 'scan:ack') {
            this.onAck?.({
              roomCode: msg.roomCode || this.roomCode,
              scanId: String(msg.scanId || ''),
              matched: Boolean(msg.matched),
              itemName: msg.itemName,
              price: msg.price,
              qtyInBill: msg.qtyInBill,
              isDuplicate: Boolean(msg.isDuplicate),
              status: msg.status,
              error: msg.error,
            });
          } else if (msg.type === 'scan:relayed') {
            if (typeof msg.tabletCount === 'number') {
              this.presence = {
                ...this.presence,
                tabletCount: msg.tabletCount,
              };
              this.onPresence?.(this.presence);
            }
            if (msg.ack) {
              this.onAck?.({
                roomCode: msg.roomCode || this.roomCode,
                ...msg.ack,
              });
            }
          }
        } catch {}
      };

      ws.onclose = () => {
        if (this.pingTimer) {
          window.clearInterval(this.pingTimer);
          this.pingTimer = null;
        }
        this.ws = null;
        if (!this.destroyed) {
          this.setState('disconnected');
          this.scheduleReconnect();
        }
      };

      ws.onerror = () => {
        // onclose handles reconnect
      };
    } catch {
      this.setState('disconnected');
      this.scheduleReconnect();
    }

    // Light 3s HTTP fallback poll only when WS isn't OPEN (keeps reliability 100% under strict proxies)
    if (this.pollTimer) window.clearInterval(this.pollTimer);
    this.pollTimer = window.setInterval(() => {
      if (this.destroyed) return;
      if (this.ws && this.ws.readyState === WebSocket.OPEN) return;
      this.pollFallback();
    }, 3000);
  }

  private async pollFallback() {
    try {
      const res = await fetch(
        `/api/remote-scan/poll?roomCode=${encodeURIComponent(this.roomCode)}&role=${this.role}&since=${this.lastPollSince}`
      );
      if (!res.ok) return;
      const json = await res.json();
      if (!json?.success) return;

      this.presence = {
        roomCode: this.roomCode,
        tabletCount: Number(json.tabletCount) || 0,
        mobileCount: Number(json.mobileCount) || 0,
      };
      this.onPresence?.(this.presence);

      if (this.role === 'tablet' && Array.isArray(json.scans)) {
        for (const s of json.scans) {
          if (s.scanId && !this.deliveredScanIds.has(s.scanId)) {
            this.deliveredScanIds.add(s.scanId);
            this.onBarcode?.({
              roomCode: this.roomCode,
              scanId: s.scanId,
              barcode: s.barcode,
              qty: s.qty || 1,
              scannedAt: s.scannedAt || Date.now(),
            });
          }
        }
      } else if (this.role === 'mobile' && Array.isArray(json.acks)) {
        for (const a of json.acks) {
          this.onAck?.({ roomCode: this.roomCode, ...a });
        }
      }
      this.lastPollSince = Date.now() - 2000;
    } catch {}
  }

  private scheduleReconnect() {
    if (this.destroyed || this.reconnectTimer) return;
    const delay = Math.min(8000, 1000 * Math.pow(1.6, this.reconnectAttempts));
    this.reconnectAttempts++;
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  public sendBarcodeScan(barcode: string, qty = 1): string {
    const clean = String(barcode || '').trim();
    const scanId = `scan-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    if (!clean) return scanId;

    const payload = {
      type: 'scan:barcode',
      roomCode: this.roomCode,
      scanId,
      barcode: clean,
      qty,
      scannedAt: Date.now(),
    };

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify(payload));
        return scanId;
      } catch {}
    }

    // Queue for WS reconnect AND immediately try HTTP push fallback
    this.outboundQueue.push(payload);
    fetch('/api/remote-scan/push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        roomCode: this.roomCode,
        scanId,
        barcode: clean,
        qty,
        scannedAt: payload.scannedAt,
        deviceId: this.deviceId,
      }),
    })
      .then((r) => r.json())
      .then((json) => {
        if (json?.success && typeof json.tabletCount === 'number') {
          this.presence = { ...this.presence, tabletCount: json.tabletCount };
          this.onPresence?.(this.presence);
        }
      })
      .catch(() => {});

    return scanId;
  }

  public sendScanAck(ack: Omit<RemoteScanAckEvent, 'roomCode'>) {
    const payload = {
      type: 'scan:ack',
      roomCode: this.roomCode,
      ...ack,
    };
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify(payload));
        return;
      } catch {}
    }
    fetch('/api/remote-scan/ack', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomCode: this.roomCode, ...ack }),
    }).catch(() => {});
  }

  public destroy() {
    this.destroyed = true;
    if (this.reconnectTimer) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.pingTimer) {
      window.clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
    if (this.pollTimer) {
      window.clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    if (this.ws) {
      try {
        this.ws.close();
      } catch {}
      this.ws = null;
    }
    this.setState('disconnected');
  }
}
