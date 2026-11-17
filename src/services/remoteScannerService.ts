// Real-Time Hybrid Client (Firebase Firestore onSnapshot + WebSocket + HTTP Fallback)
// Works seamlessly across ais-dev preview, ais-pre shared URL, localhost, and mobile 4G/WiFi networks.

import {
  collection,
  doc,
  deleteField,
  onSnapshot,
  query,
  setDoc,
  where,
} from 'firebase/firestore';
import { db, auth } from '../firebase';

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

// Structured Firestore error logger (matches firebase-integration-rpc reference)
function logFirestoreScannerError(error: unknown, operationType: string, path: string) {
  const errInfo = {
    error: error instanceof Error ? error.message : String(error),
    operationType,
    path,
    authInfo: {
      userId: auth?.currentUser?.uid || null,
      email: auth?.currentUser?.email || null,
      isAnonymous: auth?.currentUser?.isAnonymous ?? null,
    },
  };
  console.warn('RemoteScanner Firestore notice:', JSON.stringify(errInfo));
}

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
  private sessionStartMs: number;
  private destroyed = false;
  private reconnectAttempts = 0;
  private reconnectTimer: number | null = null;
  private pingTimer: number | null = null;
  private pollTimer: number | null = null;
  private heartbeatTimer: number | null = null;
  private presenceCheckTimer: number | null = null;
  private lastPollSince = Date.now() - 10000;
  private outboundQueue: any[] = [];
  private deliveredScanIds = new Set<string>();
  private ackedScanIds = new Set<string>();

  // Separate presence trackers merged together so either WebSocket OR Firestore lights up "Connected"!
  private wsPresence: { tabletCount: number; mobileCount: number } = {
    tabletCount: 0,
    mobileCount: 0,
  };
  private fbPresenceData: {
    tabletActive?: boolean;
    tabletLastSeen?: number;
    mobileDevices?: Record<string, number>;
  } = {};

  private wsConnected = false;
  private fbConnected = false;
  private unsubRoomDoc: (() => void) | null = null;
  private unsubScansCol: (() => void) | null = null;

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
    this.sessionStartMs = Date.now();
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

  private recomputeConnectionState() {
    const next: RemoteConnectionState =
      this.wsConnected || this.fbConnected ? 'connected' : 'connecting';
    if (this.connectionState !== next) {
      this.connectionState = next;
      this.onStateChange?.(next);
    }
  }

  private recomputePresence() {
    const now = Date.now();
    // Allow generous 5-minute window to tolerate device clock skew between Mobile & Tablet
    const fbTabletAlive =
      Boolean(this.fbPresenceData.tabletActive) &&
      typeof this.fbPresenceData.tabletLastSeen === 'number' &&
      Math.abs(now - this.fbPresenceData.tabletLastSeen) < 5 * 60 * 1000;

    let fbMobileCount = 0;
    if (this.fbPresenceData.mobileDevices && typeof this.fbPresenceData.mobileDevices === 'object') {
      for (const ts of Object.values(this.fbPresenceData.mobileDevices)) {
        if (typeof ts === 'number' && Math.abs(now - ts) < 5 * 60 * 1000) {
          fbMobileCount++;
        }
      }
    }

    const tabletCount = Math.max(
      this.wsPresence.tabletCount,
      fbTabletAlive ? 1 : 0,
      this.role === 'tablet' ? 1 : 0
    );
    const mobileCount = Math.max(
      this.wsPresence.mobileCount,
      fbMobileCount,
      this.role === 'mobile' ? 1 : 0
    );

    this.presence = {
      roomCode: this.roomCode,
      tabletCount,
      mobileCount,
    };
    this.onPresence?.(this.presence);
  }

  public connect() {
    if (this.destroyed || !this.roomCode || this.roomCode.length < 4) return;
    this.connectionState = 'connecting';
    this.onStateChange?.('connecting');

    this.connectFirestoreChannel();
    this.connectWebSocketChannel();

    // Refresh presence expiration checks every 5s
    if (!this.presenceCheckTimer) {
      this.presenceCheckTimer = window.setInterval(() => {
        if (!this.destroyed) this.recomputePresence();
      }, 5000);
    }
  }

  // ----------------- CHANNEL 1: FIREBASE FIRESTORE REAL-TIME (CROSS-DOMAIN & NAT-PROOF) -----------------

  private getRoomDocId(): string {
    return `remote_room_${this.roomCode}`;
  }

  private writePresenceHeartbeat() {
    if (!db || this.destroyed || !this.roomCode) return;
    const roomDocId = this.getRoomDocId();
    const path = `stores/${roomDocId}`;
    const now = Date.now();

    const payload: Record<string, any> =
      this.role === 'tablet'
        ? {
            roomCode: this.roomCode,
            tabletActive: true,
            tabletLastSeen: now,
            tabletDeviceId: this.deviceId,
          }
        : {
            roomCode: this.roomCode,
            mobileLastSeen: now,
            mobileDevices: {
              [this.deviceId]: now,
            },
          };

    setDoc(doc(db, 'stores', roomDocId), payload, { merge: true })
      .then(() => {
        if (!this.destroyed) {
          this.fbConnected = true;
          this.recomputeConnectionState();
        }
      })
      .catch((err) => {
        logFirestoreScannerError(err, 'write', path);
      });
  }

  private connectFirestoreChannel() {
    if (!db || this.destroyed) return;
    const roomDocId = this.getRoomDocId();
    const roomPath = `stores/${roomDocId}`;
    const scansPath = `stores/${roomDocId}/scans`;

    // 1. Write initial presence immediately & keep refreshing every 10s
    this.writePresenceHeartbeat();
    if (!this.heartbeatTimer) {
      this.heartbeatTimer = window.setInterval(() => {
        this.writePresenceHeartbeat();
      }, 10000);
    }

    // 2. Listen to Room Presence doc in real time
    if (!this.unsubRoomDoc) {
      try {
        this.unsubRoomDoc = onSnapshot(
          doc(db, 'stores', roomDocId),
          (snap) => {
            if (this.destroyed) return;
            this.fbConnected = true;
            this.recomputeConnectionState();
            if (snap.exists()) {
              const data = snap.data() as any;
              this.fbPresenceData = {
                tabletActive: data?.tabletActive,
                tabletLastSeen: Number(data?.tabletLastSeen) || 0,
                mobileDevices: data?.mobileDevices || {},
              };
            } else {
              this.fbPresenceData = {};
            }
            this.recomputePresence();
          },
          (error) => {
            logFirestoreScannerError(error, 'get', roomPath);
          }
        );
      } catch (e) {
        logFirestoreScannerError(e, 'get', roomPath);
      }
    }

    // 3. Listen to live Scans subcollection for barcodes (Tablet) or ACKs (Mobile)
    if (!this.unsubScansCol) {
      try {
        // Subscribe to scans created around or after this session started (3m buffer for device clock skew)
        const minTimestamp = this.sessionStartMs - 180000;
        const scansQuery = query(
          collection(db, 'stores', roomDocId, 'scans'),
          where('scannedAt', '>=', minTimestamp)
        );

        this.unsubScansCol = onSnapshot(
          scansQuery,
          (snapshot) => {
            if (this.destroyed) return;
            this.fbConnected = true;
            this.recomputeConnectionState();

            for (const change of snapshot.docChanges()) {
              const data = change.doc.data() as any;
              const scanId = String(data?.scanId || change.doc.id || '');
              if (!scanId) continue;

              if (this.role === 'tablet') {
                // Tablet picks up un-acked scans added by Mobile
                if (
                  !data.acked &&
                  data.barcode &&
                  !this.deliveredScanIds.has(scanId)
                ) {
                  this.deliveredScanIds.add(scanId);
                  this.onBarcode?.({
                    roomCode: this.roomCode,
                    scanId,
                    barcode: String(data.barcode),
                    qty: Number(data.qty) || 1,
                    scannedAt: Number(data.scannedAt) || Date.now(),
                  });
                }
              } else if (this.role === 'mobile') {
                // Mobile picks up ACKs written by Tablet
                if (data.acked && !this.ackedScanIds.has(scanId)) {
                  this.ackedScanIds.add(scanId);
                  this.onAck?.({
                    roomCode: this.roomCode,
                    scanId,
                    matched: Boolean(data.matched),
                    itemName: data.itemName,
                    price: typeof data.price === 'number' ? data.price : undefined,
                    qtyInBill: typeof data.qtyInBill === 'number' ? data.qtyInBill : undefined,
                    isDuplicate: Boolean(data.isDuplicate),
                    status: data.status || 'added',
                    error: data.error,
                  });
                }
              }
            }
          },
          (error) => {
            logFirestoreScannerError(error, 'list', scansPath);
          }
        );
      } catch (e) {
        logFirestoreScannerError(e, 'list', scansPath);
      }
    }
  }

  // ----------------- CHANNEL 2: LOCAL WEBSOCKET + HTTP POLL FALLBACK -----------------

  private connectWebSocketChannel() {
    if (this.destroyed) return;
    if (
      this.ws &&
      (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }

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
        this.wsConnected = true;
        this.recomputeConnectionState();

        ws.send(
          JSON.stringify({
            type: 'join',
            roomCode: this.roomCode,
            role: this.role,
            deviceId: this.deviceId,
          })
        );

        while (this.outboundQueue.length > 0 && ws.readyState === WebSocket.OPEN) {
          const item = this.outboundQueue.shift();
          try {
            ws.send(JSON.stringify(item));
          } catch {}
        }

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
            this.wsPresence = {
              tabletCount: Number(msg.tabletCount) || 0,
              mobileCount: Number(msg.mobileCount) || 0,
            };
            this.recomputePresence();
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
            const scanId = String(msg.scanId || '');
            if (scanId && this.ackedScanIds.has(scanId)) return;
            if (scanId) this.ackedScanIds.add(scanId);
            this.onAck?.({
              roomCode: msg.roomCode || this.roomCode,
              scanId,
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
              this.wsPresence.tabletCount = msg.tabletCount;
              this.recomputePresence();
            }
            if (msg.ack) {
              const scanId = String(msg.ack.scanId || '');
              if (scanId && !this.ackedScanIds.has(scanId)) {
                this.ackedScanIds.add(scanId);
                this.onAck?.({
                  roomCode: msg.roomCode || this.roomCode,
                  ...msg.ack,
                });
              }
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
        this.wsConnected = false;
        if (!this.destroyed) {
          this.recomputeConnectionState();
          this.scheduleReconnect();
        }
      };

      ws.onerror = () => {};
    } catch {
      this.wsConnected = false;
      this.recomputeConnectionState();
      this.scheduleReconnect();
    }

    if (!this.pollTimer) {
      this.pollTimer = window.setInterval(() => {
        if (this.destroyed) return;
        if (this.ws && this.ws.readyState === WebSocket.OPEN) return;
        this.pollFallback();
      }, 3000);
    }
  }

  private async pollFallback() {
    try {
      const res = await fetch(
        `/api/remote-scan/poll?roomCode=${encodeURIComponent(this.roomCode)}&role=${this.role}&since=${this.lastPollSince}`
      );
      if (!res.ok) return;
      const json = await res.json();
      if (!json?.success) return;

      this.wsPresence = {
        tabletCount: Number(json.tabletCount) || 0,
        mobileCount: Number(json.mobileCount) || 0,
      };
      this.recomputePresence();

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
          if (a.scanId && !this.ackedScanIds.has(a.scanId)) {
            this.ackedScanIds.add(a.scanId);
            this.onAck?.({ roomCode: this.roomCode, ...a });
          }
        }
      }
      this.lastPollSince = Date.now() - 2000;
    } catch {}
  }

  private scheduleReconnect() {
    if (this.destroyed || this.reconnectTimer) return;
    const delay = Math.min(8000, 1500 * Math.pow(1.5, this.reconnectAttempts));
    this.reconnectAttempts++;
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      this.connectWebSocketChannel();
    }, delay);
  }

  public sendBarcodeScan(barcode: string, qty = 1): string {
    const clean = String(barcode || '').trim();
    const scanId = `scan-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    if (!clean) return scanId;

    const scannedAt = Date.now();
    const payload = {
      type: 'scan:barcode',
      roomCode: this.roomCode,
      scanId,
      barcode: clean,
      qty,
      scannedAt,
    };

    // 1. Write immediately to Firebase Firestore (guaranteed delivery across ais-dev <-> ais-pre!)
    if (db) {
      const roomDocId = this.getRoomDocId();
      const scanPath = `stores/${roomDocId}/scans/${scanId}`;
      setDoc(doc(db, 'stores', roomDocId, 'scans', scanId), {
        scanId,
        roomCode: this.roomCode,
        barcode: clean,
        qty,
        scannedAt,
        deviceId: this.deviceId,
        acked: false,
      }).catch((err) => {
        logFirestoreScannerError(err, 'write', scanPath);
      });
    }

    // 2. Also send via WebSocket or HTTP push for sub-50ms local relay
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify(payload));
        return scanId;
      } catch {}
    }

    fetch('/api/remote-scan/push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        roomCode: this.roomCode,
        scanId,
        barcode: clean,
        qty,
        scannedAt,
        deviceId: this.deviceId,
      }),
    }).catch(() => {});

    return scanId;
  }

  public sendScanAck(ack: Omit<RemoteScanAckEvent, 'roomCode'>) {
    // 1. Write ACK to Firestore scan document so Mobile sees it across any domain
    if (db && ack.scanId) {
      const roomDocId = this.getRoomDocId();
      const scanPath = `stores/${roomDocId}/scans/${ack.scanId}`;
      setDoc(
        doc(db, 'stores', roomDocId, 'scans', ack.scanId),
        {
          scanId: ack.scanId,
          acked: true,
          matched: Boolean(ack.matched),
          itemName: ack.itemName || '',
          price: typeof ack.price === 'number' ? ack.price : 0,
          qtyInBill: typeof ack.qtyInBill === 'number' ? ack.qtyInBill : 1,
          isDuplicate: Boolean(ack.isDuplicate),
          status: ack.status || 'added',
          error: ack.error || '',
          ackedAt: Date.now(),
        },
        { merge: true }
      ).catch((err) => {
        logFirestoreScannerError(err, 'update', scanPath);
      });
    }

    // 2. Also send via WebSocket / HTTP fallback
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

    // Best-effort mark Tablet or Mobile offline in Firestore when disconnecting
    if (db && this.roomCode) {
      try {
        const roomDocId = this.getRoomDocId();
        if (this.role === 'tablet') {
          setDoc(
            doc(db, 'stores', roomDocId),
            { tabletActive: false, tabletLastSeen: Date.now() },
            { merge: true }
          ).catch(() => {});
        } else {
          setDoc(
            doc(db, 'stores', roomDocId),
            { mobileDevices: { [this.deviceId]: deleteField() } },
            { merge: true }
          ).catch(() => {});
        }
      } catch {}
    }

    if (this.unsubRoomDoc) {
      try {
        this.unsubRoomDoc();
      } catch {}
      this.unsubRoomDoc = null;
    }
    if (this.unsubScansCol) {
      try {
        this.unsubScansCol();
      } catch {}
      this.unsubScansCol = null;
    }
    if (this.heartbeatTimer) {
      window.clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    if (this.presenceCheckTimer) {
      window.clearInterval(this.presenceCheckTimer);
      this.presenceCheckTimer = null;
    }
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
    this.wsConnected = false;
    this.fbConnected = false;
    this.connectionState = 'disconnected';
    this.onStateChange?.('disconnected');
  }
}
