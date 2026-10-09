import React, { useState, useEffect, useRef } from 'react';
import {
  BillItem,
  BillInvoice,
  CashEntry,
  CustomerDue,
  DueType,
  ThermalPrinterSettings,
  BluetoothDeviceInfo,
  CashEntryType,
  ActiveTab,
  PaperWidth,
  UserProfile,
  Language,
  PurchaseTrip,
  PurchaseExpenseItem,
  ProductStockItem,
} from './types';
import { storageService, AccountVaultData } from './services/storageService';
import { thermalPrinterService } from './services/thermalPrinterService';
import { otpService } from './services/otpService';
import { Header, SortOption } from './components/Header';
import { BottomNav } from './components/BottomNav';
import { BillingTab } from './components/BillingTab';
import { InvoicesTab } from './components/InvoicesTab';
import { CashbookTab } from './components/CashbookTab';
import { CustomerDueTab } from './components/CustomerDueTab';
import { PurchaseTripTab } from './components/PurchaseTripTab';
import { BarcodeTagStudioTab } from './components/BarcodeTagStudioTab';
import { ProductStockModal } from './components/ProductStockModal';
import { PrintReceiptModal } from './components/PrintReceiptModal';
import { EditInvoiceModal } from './components/EditInvoiceModal';
import { SettingsModal } from './components/SettingsModal';
import { LoginModal } from './components/LoginModal';
import { AppLockScreen } from './components/AppLockScreen';
import { OnboardingModal } from './components/OnboardingModal';
import { ResetPasswordModal } from './components/ResetPasswordModal';
import { CalculatorModal } from './components/CalculatorModal';
import { DataSaverModal } from './components/DataSaverModal';
import { BluetoothHelpModal } from './components/BluetoothHelpModal';
import { ExitConfirmModal } from './components/ExitConfirmModal';
import { BackExitPill } from './components/BackExitPill';
import { useNetworkStatus } from './utils/useNetworkStatus';
import { backHandler } from './utils/backHandler';
import { useBackHandler } from './utils/useBackHandler';
import { supabaseService } from './services/supabaseService';
import { supabase, isSupabaseConfigured } from './supabaseClient.js';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('billing');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOption, setSortOption] = useState<SortOption>('date-desc');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [bills, setBills] = useState<BillInvoice[]>([]);
  const [billItems, setBillItems] = useState<BillItem[]>(() => {
    try {
      const savedDraft = localStorage.getItem('simple_pos_billing_cart_draft_v1');
      if (savedDraft) {
        const parsed = JSON.parse(savedDraft);
        if (Array.isArray(parsed?.billItems)) {
          return parsed.billItems;
        }
      }
    } catch {
      // ignore parse errors
    }
    return [];
  });
  const [cashEntries, setCashEntries] = useState<CashEntry[]>([]);
  const [customerDues, setCustomerDues] = useState<CustomerDue[]>([]);
  const [settings, setSettings] = useState<ThermalPrinterSettings>(storageService.getSettings());
  const [userProfile, setUserProfile] = useState<UserProfile>(storageService.getUserProfile());
  const [language, setLanguage] = useState<Language>(storageService.getLanguage());
  const [purchaseTrips, setPurchaseTrips] = useState<PurchaseTrip[]>([]);
  const [products, setProducts] = useState<ProductStockItem[]>(() => storageService.getProducts());
  const [barcodeTargetProduct, setBarcodeTargetProduct] = useState<ProductStockItem | null>(null);
  const [isProductStockOpen, setIsProductStockOpen] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isResetPasswordOpen, setIsResetPasswordOpen] = useState(false);
  const [resetPasswordMode, setResetPasswordMode] = useState<'request_link' | 'update_password'>('request_link');
  const [resetPasswordEmail, setResetPasswordEmail] = useState('');
  const [isAppLocked, setIsAppLocked] = useState(false);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
  const [isCalculatorOpen, setIsCalculatorOpen] = useState(false);
  const [isDataSaverOpen, setIsDataSaverOpen] = useState(false);
  const [isBluetoothHelpOpen, setIsBluetoothHelpOpen] = useState(false);
  const [receiptBill, setReceiptBill] = useState<BillInvoice | null>(null);
  const [receiptInitialTotalOnly, setReceiptInitialTotalOnly] = useState<boolean>(false);
  const [autoPrintReceipt, setAutoPrintReceipt] = useState(false);
  const [editingBill, setEditingBill] = useState<BillInvoice | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isPrintingBill, setIsPrintingBill] = useState(false);
  const [isExitConfirmOpen, setIsExitConfirmOpen] = useState(false);
  const [isExitPillVisible, setIsExitPillVisible] = useState(false);

  const networkStatus = useNetworkStatus();
  const [toast, setToast] = useState<{
    id: string;
    message: string;
    type: 'success' | 'info' | 'error';
    bill?: BillInvoice;
  } | null>(null);

  const [bluetoothStatus, setBluetoothStatus] = useState<BluetoothDeviceInfo>({
    connected: false,
  });

  const showToast = (
    message: string,
    type: 'success' | 'info' | 'error' = 'success',
    bill?: BillInvoice
  ) => {
    setToast({ id: 'toast-' + Date.now(), message, type, bill });
    setTimeout(() => {
      setToast((prev) => (prev?.message === message ? null : prev));
    }, 4000);
  };

  // Initial load
  useEffect(() => {
    const prof = storageService.getUserProfile();
    const currentSettings = storageService.getSettings();
    setLanguage(storageService.getLanguage());

    // Clean blank state on new device / unauthenticated session -> Auto-connect to primary server account
    if (!prof.isLoggedIn) {
      fetch('/api/accounts/primary')
        .then((r) => r.json())
        .then((json) => {
          if (json?.success && json.vault) {
            const v = json.vault;
            storageService.applyServerVaultSilently(v);
            const restoredProfile: UserProfile = {
              email: v.email || 'uddinfahad89@gmail.com',
              name: v.name || 'Fahad uddin',
              phone: v.phone || '',
              role: v.role || 'Owner',
              pin: v.pin || '1234',
              password: v.password || '123456',
              isLoggedIn: true,
              isAppLockEnabled: Boolean(v.isAppLockEnabled),
              loginTime: Date.now(),
              loginMethod: 'email_password',
              otpVerified: true,
            };
            storageService.saveUserProfile(restoredProfile);
            localStorage.setItem('thermal_pos_onboarding_completed', 'true');
            setUserProfile(restoredProfile);
            setBills(Array.isArray(v.bills) ? v.bills : []);
            setProducts(Array.isArray(v.products) ? v.products : []);
            setCashEntries(Array.isArray(v.cashEntries) ? v.cashEntries : []);
            setCustomerDues(Array.isArray(v.customerDues) ? v.customerDues : []);
            setPurchaseTrips(Array.isArray(v.purchaseTrips) ? v.purchaseTrips : []);
            if (v.settings) setSettings(v.settings);
            setIsOnboardingOpen(false);
            storageService.setLocalLastActive(Number(v.lastActive) || Date.now());
          } else {
            setBills([]);
            setCashEntries([]);
            setCustomerDues([]);
            setPurchaseTrips([]);
            setSettings(currentSettings);
            setUserProfile(prof);
            setIsOnboardingOpen(true);
          }
        })
        .catch(() => {
          setBills([]);
          setCashEntries([]);
          setCustomerDues([]);
          setPurchaseTrips([]);
          setSettings(currentSettings);
          setUserProfile(prof);
          setIsOnboardingOpen(true);
        });
    } else {
      const loadedBills = storageService.getBills();
      setBills(loadedBills);
      setCashEntries(storageService.getCashEntries());
      setCustomerDues(storageService.getCustomerDues());
      setPurchaseTrips(storageService.getPurchaseTrips());
      setProducts(storageService.getProducts());
      setSettings(storageService.getSettings());
      setUserProfile(prof);
    }

    // Boot-time authoritative sync from server vault for multi-device consistency
    const bootSyncId = prof.email || prof.phone || 'uddinfahad89@gmail.com';
    if (bootSyncId) {
      const norm = storageService.normalizeIdentifier(bootSyncId);
      fetch(`/api/vault/${encodeURIComponent(norm)}`)
        .then((r) => r.json())
        .then((json) => {
          if (json?.success && json.vault) {
            const serverVault = json.vault;
            const sBills = Array.isArray(serverVault.bills) ? serverVault.bills : [];
            const sProds = Array.isArray(serverVault.products) ? serverVault.products : [];
            if (sBills.length > 0 || sProds.length > 0 || serverVault.settings?.storeName) {
              storageService.applyServerVaultSilently(serverVault);
              setBills(sBills);
              setProducts(sProds);
              if (Array.isArray(serverVault.cashEntries)) setCashEntries(serverVault.cashEntries);
              if (Array.isArray(serverVault.customerDues)) setCustomerDues(serverVault.customerDues);
              if (Array.isArray(serverVault.purchaseTrips)) setPurchaseTrips(serverVault.purchaseTrips);
              if (serverVault.settings) setSettings(serverVault.settings);
              storageService.setLocalLastActive(Number(serverVault.lastActive) || Date.now());
            }
          }
        })
        .catch(() => {});
    }

    // Multi-device real-time sync: poll and refresh on tab focus so all devices stay identical
    const syncLiveVault = async () => {
      const currentProf = storageService.getUserProfile();
      const syncId = currentProf.email || currentProf.phone || 'uddinfahad89@gmail.com';
      if (!syncId) return;

      try {
        const norm = storageService.normalizeIdentifier(syncId);
        const res = await fetch(`/api/vault/${encodeURIComponent(norm)}`);
        if (res.ok) {
          const json = await res.json();
          if (json.success && json.vault) {
            const serverVault = json.vault;
            const currentBills = storageService.getBills();
            const currentProducts = storageService.getProducts();
            const currentCash = storageService.getCashEntries();
            const currentDues = storageService.getCustomerDues();

            const serverBills = Array.isArray(serverVault.bills) ? serverVault.bills : [];
            const serverProducts = Array.isArray(serverVault.products) ? serverVault.products : [];
            const serverCash = Array.isArray(serverVault.cashEntries) ? serverVault.cashEntries : [];
            const serverDues = Array.isArray(serverVault.customerDues) ? serverVault.customerDues : [];
            const serverTrips = Array.isArray(serverVault.purchaseTrips) ? serverVault.purchaseTrips : [];

            // Detect any updates from other devices across bills, products, dues, and cash
            const localActive = storageService.getLocalLastActive();
            const serverActive = Number(serverVault.lastActive) || 0;
            const billsDiffer =
              serverBills.length !== currentBills.length ||
              (serverBills.length > 0 &&
                currentBills.length > 0 &&
                (serverBills[0].id !== currentBills[0].id || serverBills[0].invoiceNo !== currentBills[0].invoiceNo));
            const prodsDiffer = serverProducts.length !== currentProducts.length;
            const duesDiffer = serverDues.length !== currentDues.length;
            const cashDiffer = serverCash.length !== currentCash.length;

            if (serverActive > localActive || billsDiffer || prodsDiffer || duesDiffer || cashDiffer) {
              storageService.applyServerVaultSilently(serverVault);
              setBills(serverBills);
              setProducts(serverProducts);
              setCashEntries(serverCash);
              setCustomerDues(serverDues);
              setPurchaseTrips(serverTrips);
              if (serverVault.settings) {
                setSettings(serverVault.settings);
              }
              storageService.setLocalLastActive(serverActive);
            }
          }
        }
      } catch {}
    };

    const onFocusSync = () => {
      syncLiveVault();
    };
    window.addEventListener('focus', onFocusSync);
    document.addEventListener('visibilitychange', onFocusSync);
    const liveSyncInterval = setInterval(syncLiveVault, 2500);

    thermalPrinterService.setStatusListener((status) => {
      setBluetoothStatus(status);
    });

    // Auto-reconnect to saved printer in background on initial boot
    const saved = storageService.getSavedPrinter();
    if (saved) {
      thermalPrinterService.autoReconnect().catch((err) => {
        console.log('Background auto-reconnect notice:', err);
      });
    }

    // Check if user arrived via Supabase Password Reset Email Link
    const checkPasswordResetLink = () => {
      try {
        const hash = window.location.hash || '';
        const search = window.location.search || '';
        const pathname = window.location.pathname || '';

        const hasRecoveryHash = hash.includes('type=recovery') || hash.includes('access_token=');
        const hasRecoveryQuery = search.includes('type=recovery');
        const isResetUrl = pathname.includes('reset-password');

        if (hasRecoveryHash || hasRecoveryQuery || isResetUrl) {
          setIsResetPasswordOpen(true);
          setResetPasswordMode('update_password');
          setIsLoginModalOpen(false);
          setIsOnboardingOpen(false);
        }
      } catch (err) {
        console.warn('Reset URL check error:', err);
      }
    };
    checkPasswordResetLink();

    // Supabase auth state change listener for PASSWORD_RECOVERY
    const { data: authSub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setIsResetPasswordOpen(true);
        setResetPasswordMode('update_password');
        setIsLoginModalOpen(false);
        setIsOnboardingOpen(false);
      }
    });

    // Initialize native Android & browser back button handler
    backHandler.init();

    return () => {
      authSub?.subscription?.unsubscribe();
    };
  }, []);

  // Priority 60: If exit confirmation dialog is open, pressing Back again immediately exits
  useBackHandler(
    'appExitConfirm',
    isExitConfirmOpen,
    () => {
      backHandler.forceExit();
      return true;
    },
    60
  );

  // Priority 50: App-level overlays & modals
  useBackHandler('appEditingBill', Boolean(editingBill), () => {
    setEditingBill(null);
    return true;
  }, 50);

  useBackHandler('appReceiptBill', Boolean(receiptBill), () => {
    setReceiptBill(null);
    return true;
  }, 50);

  useBackHandler('appSettings', isSettingsOpen, () => {
    setIsSettingsOpen(false);
    return true;
  }, 50);

  useBackHandler('appCalculator', isCalculatorOpen, () => {
    setIsCalculatorOpen(false);
    return true;
  }, 50);

  useBackHandler('appDataSaver', isDataSaverOpen, () => {
    setIsDataSaverOpen(false);
    return true;
  }, 50);

  useBackHandler('appBluetoothHelp', isBluetoothHelpOpen, () => {
    setIsBluetoothHelpOpen(false);
    return true;
  }, 50);

  useBackHandler('appLogin', isLoginModalOpen, () => {
    setIsLoginModalOpen(false);
    return true;
  }, 50);

  useBackHandler('appResetPassword', isResetPasswordOpen, () => {
    setIsResetPasswordOpen(false);
    return true;
  }, 50);

  useBackHandler('appOnboarding', isOnboardingOpen, () => {
    setIsOnboardingOpen(false);
    return true;
  }, 50);

  // Priority 10: Root screen Khatabook-style Back Exit handling (active on ANY main tab when no modal is open)
  useBackHandler(
    'appRootBackExit',
    !isExitConfirmOpen,
    () => {
      if (isExitPillVisible) {
        // User pressed Back AGAIN within 3.5 seconds while pill is visible!
        // Hide the pill and open the confirmation dialog ("একবার জিজ্ঞাসা করে নে")
        setIsExitPillVisible(false);
        setIsExitConfirmOpen(true);
      } else {
        // First Back press: show Khatabook-style floating pill prompt!
        setIsExitPillVisible(true);
        try {
          if (typeof navigator !== 'undefined' && navigator.vibrate) {
            navigator.vibrate(40);
          }
        } catch {}
      }
      return true;
    },
    10
  );

  const handleSaveOnboarding = async (data: {
    storeName: string;
    storePhone?: string;
    storeAddress?: string;
    ownerEmail: string;
    ownerName?: string;
    password: string;
  }) => {
    const cleanEmail = data.ownerEmail.trim().toLowerCase();
    const cleanPass = data.password.trim();
    const cleanStore = data.storeName.trim() || 'My Store';
    const cleanName = data.ownerName?.trim() || cleanEmail.split('@')[0] || 'Store Owner';

    // Prevent duplicate signup with same email
    const alreadyRegistered = await storageService.isEmailRegistered(cleanEmail);
    if (alreadyRegistered) {
      showToast(
        language === 'bn'
          ? 'এই ইমেল দিয়ে ইতোমধ্যে অ্যাকাউন্ট তৈরি করা আছে! দয়া করে লগইন করুন।'
          : 'An account already exists with this email! Please log in.',
        'error'
      );
      setIsOnboardingOpen(true);
      return;
    }

    const updated: ThermalPrinterSettings = {
      ...settings,
      storeName: cleanStore,
      storePhone: data.storePhone || settings.storePhone || '',
      storeAddress: data.storeAddress || settings.storeAddress || '',
    };
    storageService.saveSettings(updated);
    setSettings(updated);

    if (cleanEmail) {
      const loggedIn = storageService.loginUser(
        cleanEmail,
        cleanName,
        '1234',
        'Owner',
        data.storePhone || '',
        'email_password',
        true,
        cleanPass
      );
      setUserProfile(loggedIn);

      // Create new clean isolated vault and await server sync
      const freshVault: AccountVaultData = {
        identifier: cleanEmail,
        email: cleanEmail,
        phone: data.storePhone || '',
        name: cleanName,
        role: 'Owner',
        pin: '1234',
        password: cleanPass,
        isAppLockEnabled: false,
        settings: updated,
        bills: [],
        cashEntries: [],
        customerDues: [],
        purchaseTrips: [],
        products: storageService.getProducts(),
        lastActive: Date.now(),
      };
      await storageService.saveToAccountVaultAsync(freshVault);

      setBills([]);
      setCashEntries([]);
      setCustomerDues([]);
      setPurchaseTrips([]);

      // Also sync profile to Supabase if session exists
      const activeUserId = await supabaseService.getActiveUserId();
      if (activeUserId) {
        await supabaseService.syncProfile(updated, loggedIn, activeUserId);
      }
    } else {
      setBills([]);
      setCashEntries([]);
      setCustomerDues([]);
      setPurchaseTrips([]);
    }

    localStorage.setItem('thermal_pos_onboarding_completed', 'true');
    setIsOnboardingOpen(false);
    showToast(
      language === 'bn'
        ? `দোকান ও অ্যাকাউন্ট সেটআপ সম্পন্ন: ${cleanStore}`
        : `Shop & account setup completed: ${cleanStore}`,
      'success'
    );
  };

  const handleLoginExisting = async (
    email: string,
    password: string,
    _method: string = 'email_password'
  ): Promise<{ success: boolean; error?: string }> => {
    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password.trim();

    // 1. Email validation
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return {
        success: false,
        error:
          language === 'bn'
            ? 'সঠিক ইমেল ঠিকানা লিখুন (যেমন: name@example.com)'
            : 'Please enter a valid email address (e.g. name@example.com)',
      };
    }

    // 2. Password validation (min 6 characters)
    if (!cleanPassword || cleanPassword.length < 6) {
      return {
        success: false,
        error:
          language === 'bn'
            ? 'পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে'
            : 'Password must be at least 6 characters',
      };
    }

    // 3. Primary: Server Authoritative Authentication & Cloud Vault Restore
    // Works across all devices, browsers, and after clearing browser storage/cookies
    const serverAuth = await storageService.authenticateWithServerAsync(cleanEmail, cleanPassword);
    if (serverAuth.success && serverAuth.vault) {
      const v = serverAuth.vault;
      const loadedBills = Array.isArray(v.bills) ? v.bills : storageService.getBills();
      const loadedProducts = Array.isArray(v.products) ? v.products : storageService.getProducts();
      const loadedCash = Array.isArray(v.cashEntries) ? v.cashEntries : storageService.getCashEntries();
      const loadedDues = Array.isArray(v.customerDues) ? v.customerDues : storageService.getCustomerDues();
      const loadedTrips = Array.isArray(v.purchaseTrips) ? v.purchaseTrips : storageService.getPurchaseTrips();
      const loadedSettings = v.settings || storageService.getSettings();
      const loadedProfile = storageService.getUserProfile();

      setBills(loadedBills);
      setProducts(loadedProducts);
      setCashEntries(loadedCash);
      setCustomerDues(loadedDues);
      setPurchaseTrips(loadedTrips);
      setSettings(loadedSettings);
      setUserProfile(loadedProfile);
      localStorage.setItem('thermal_pos_onboarding_completed', 'true');
      setIsOnboardingOpen(false);

      // Attempt background Supabase login if configured
      if (isSupabaseConfigured()) {
        supabaseService.signIn(cleanEmail, cleanPassword).catch(() => {});
      }

      showToast(
        language === 'bn'
          ? `স্বাগতম! আপনার অ্যাকাউন্ট সফলভাবে লগইন হয়েছে (${loadedBills.length}টি ইনভয়েস)।`
          : `Welcome back! Account logged in successfully (${loadedBills.length} invoices).`,
        'success'
      );
      return { success: true };
    }

    // 4. Secondary fallback: Supabase Cloud Auth SignIn (for cloud-only users)
    if (isSupabaseConfigured()) {
      const sbRes = await supabaseService.signIn(cleanEmail, cleanPassword);
      if (sbRes.success && sbRes.restored) {
        setBills(sbRes.restored.bills);
        setCashEntries(sbRes.restored.cashEntries);
        setCustomerDues(sbRes.restored.customerDues);
        setPurchaseTrips(sbRes.restored.purchaseTrips);
        setProducts(sbRes.restored.products);
        setSettings(sbRes.restored.settings);
        setUserProfile(sbRes.restored.userProfile);

        storageService.saveSettings(sbRes.restored.settings);
        storageService.saveUserProfile(sbRes.restored.userProfile);
        storageService.saveBills(sbRes.restored.bills);
        storageService.saveProducts(sbRes.restored.products);
        storageService.saveCustomerDues(sbRes.restored.customerDues);
        storageService.saveCashEntries(sbRes.restored.cashEntries);
        storageService.savePurchaseTrips(sbRes.restored.purchaseTrips);
        await storageService.saveToAccountVaultAsync({
          identifier: cleanEmail,
          email: cleanEmail,
          name: sbRes.restored.userProfile.name,
          phone: sbRes.restored.userProfile.phone || '',
          role: sbRes.restored.userProfile.role || 'Owner',
          pin: sbRes.restored.userProfile.pin || '1234',
          password: cleanPassword,
          isAppLockEnabled: false,
          settings: sbRes.restored.settings,
          bills: sbRes.restored.bills,
          cashEntries: sbRes.restored.cashEntries,
          customerDues: sbRes.restored.customerDues,
          purchaseTrips: sbRes.restored.purchaseTrips,
          products: sbRes.restored.products,
          lastActive: Date.now(),
        });

        localStorage.setItem('thermal_pos_onboarding_completed', 'true');
        setIsOnboardingOpen(false);
        showToast(
          language === 'bn'
            ? `স্বাগতম! আপনার ক্লাউড ডেটা সফলভাবে রিস্টোর হয়েছে।`
            : `Welcome back! Restored data from cloud successfully.`,
          'success'
        );
        return { success: true };
      } else if (sbRes.error) {
        if (sbRes.error.toLowerCase().includes('email not confirmed')) {
          return {
            success: false,
            error:
              language === 'bn'
                ? 'ইমেল ভেরিফিকেশন সম্পন্ন হয়নি অথবা পাসওয়ার্ড সঠিক নয়।'
                : 'Email is not confirmed or password is incorrect.',
          };
        }
      }
    }

    if (serverAuth.error && serverAuth.error.includes('পাসওয়ার্ড')) {
      return {
        success: false,
        error:
          language === 'bn'
            ? 'পাসওয়ার্ড সঠিক নয়! সঠিক পাসওয়ার্ড লিখুন।'
            : 'Incorrect password! Please check and try again.',
      };
    }

    return {
      success: false,
      error:
        language === 'bn'
          ? 'এই ইমেল দিয়ে কোনো অ্যাকাউন্ট পাওয়া যায়নি অথবা পাসওয়ার্ড সঠিক নয়।'
          : 'No account found with this email or password is incorrect.',
    };
  };

  // Connect Bluetooth Thermal Printer
  const handleConnectBluetooth = async () => {
    const res = await thermalPrinterService.connectBluetooth();
    if (res.success) {
      showToast(`Connected to ${res.deviceName || 'Thermal Printer'}! Silent print ready.`, 'success');
    } else if (res.isUnsupported) {
      setIsBluetoothHelpOpen(true);
      showToast(
        language === 'bn'
          ? 'ব্রাউজারে সরাসরি ব্লুটুথ সাপোর্ট করেনি — সমাধান গাইড দেখুন'
          : res.message,
        'info'
      );
    } else if (res.message && !res.message.includes('cancelled')) {
      showToast(res.message, 'info');
    }
  };

  const handleDisconnectBluetooth = (forget = false) => {
    thermalPrinterService.disconnect(forget);
    showToast(forget ? 'Printer disconnected and unpaired' : 'Printer disconnected', 'info');
  };

  const handleTestPrint = async () => {
    const res = await thermalPrinterService.printTestReceipt(settings);
    showToast(res.message, res.success ? 'success' : 'info');
  };

  // Authentication & Security Handlers
  const handleLoginUser = async (
    email: string,
    name?: string,
    pin?: string,
    role?: 'Owner' | 'Manager' | 'Cashier',
    phone?: string,
    isAppLockEnabled?: boolean,
    loginMethod?: 'email_pin' | 'otp' | 'email_password' | 'app_pin',
    _otpCode?: string,
    password?: string
  ): Promise<boolean> => {
    const cleanEmail = email.trim().toLowerCase();
    const cleanPass = password?.trim();

    // If password provided, use standard Email+Password login & restore flow
    if (cleanPass && cleanEmail) {
      const res = await handleLoginExisting(cleanEmail, cleanPass, 'email_password');
      return res.success;
    }

    // Fallback: local vault lookup
    if (cleanEmail) {
      await storageService.restoreFromAccountVaultAsync(cleanEmail);
    }

    const updated = storageService.loginUser(
      cleanEmail,
      name,
      pin || '1234',
      role,
      phone,
      'email_password',
      true,
      cleanPass
    );

    if (isAppLockEnabled !== undefined) {
      storageService.updateUserSecurity({ isAppLockEnabled });
      updated.isAppLockEnabled = isAppLockEnabled;
    }
    setUserProfile(updated);

    const restoredBills = storageService.getBills();
    const restoredCash = storageService.getCashEntries();
    const restoredDues = storageService.getCustomerDues();
    const restoredPurchases = storageService.getPurchaseTrips();
    const restoredSettings = storageService.getSettings();

    setBills(restoredBills);
    setCashEntries(restoredCash);
    setCustomerDues(restoredDues);
    setPurchaseTrips(restoredPurchases);
    setProducts(storageService.getProducts());
    setSettings(restoredSettings);
    setIsOnboardingOpen(false);

    const welcomeMsg =
      language === 'bn'
        ? `স্বাগতম, ${updated.name}! আপনার সংরক্ষিত অ্যাকাউন্ট সক্রিয় হয়েছে।`
        : language === 'hi'
        ? `स्वागत है, ${updated.name}! आपका खाता सक्रिय हो गया है।`
        : `Welcome, ${updated.name}! Your account is now active.`;
    showToast(welcomeMsg, 'success');
    return true;
  };

  const handleUpdateSecurity = (updates: Partial<UserProfile>) => {
    const updated = storageService.updateUserSecurity(updates);
    setUserProfile(updated);
    showToast(
      language === 'bn'
        ? 'নিরাপত্তা সেটিংস আপডেট করা হয়েছে'
        : 'Security settings updated',
      'success'
    );
  };

  const handleLockApp = () => {
    setIsAppLocked(true);
    showToast(
      language === 'bn' ? 'অ্যাপ ভল্ট লক করা হয়েছে' : 'App vault has been locked',
      'info'
    );
  };

  const handleUnlockApp = () => {
    setIsAppLocked(false);
    showToast(
      language === 'bn' ? 'ভল্ট সফলভাবে আনলক হয়েছে' : 'Vault successfully unlocked',
      'success'
    );
  };

  const handleResetPin = (newPin: string) => {
    const updated = storageService.updateUserSecurity({ pin: newPin });
    setUserProfile(updated);
    showToast(
      language === 'bn' ? 'নতুন পিন সেট করা হয়েছে' : 'New PIN has been saved',
      'success'
    );
  };

  const handleLogoutUser = () => {
    supabaseService.signOut();
    const updated = storageService.logoutUser();
    setUserProfile(updated);
    setBills([]);
    setCashEntries([]);
    setCustomerDues([]);
    setPurchaseTrips([]);
    setSettings(storageService.getSettings());
    setIsOnboardingOpen(true);
    showToast(language === 'bn' ? 'লগআউট সফল হয়েছে' : 'Logged out successfully', 'info');
  };

  const handleRegisterUser = async (data: {
    name: string;
    phone?: string;
    email: string;
    storeName?: string;
    pin?: string;
    password: string;
    role?: 'Owner' | 'Manager' | 'Cashier';
  }): Promise<boolean> => {
    const cleanEmail = data.email.trim().toLowerCase();
    const cleanPass = data.password.trim();
    const cleanStore = data.storeName?.trim() || 'My Store';
    const cleanName = data.name.trim() || cleanEmail.split('@')[0];

    // Prevent duplicate signup with same email
    const already = await storageService.isEmailRegistered(cleanEmail);
    if (already) {
      showToast(
        language === 'bn'
          ? 'এই ইমেল দিয়ে ইতোমধ্যে অ্যাকাউন্ট খোলা আছে! লগইন করুন।'
          : 'An account with this email already exists! Please log in.',
        'error'
      );
      return false;
    }

    if (isSupabaseConfigured()) {
      const sbResult = await supabaseService.signUp(cleanEmail, cleanPass, {
        storeName: cleanStore,
        phone: data.phone || '',
        name: cleanName,
      });
      if (!sbResult.success && sbResult.error) {
        showToast(sbResult.error, 'error');
        return false;
      }
    }

    const newProfile = storageService.registerNewUser({
      ...data,
      email: cleanEmail,
      storeName: cleanStore,
      name: cleanName,
      phone: data.phone || '',
      password: cleanPass,
    });
    setUserProfile(newProfile);

    // Persist new vault to server disk immediately
    const freshVault: AccountVaultData = {
      identifier: cleanEmail,
      email: cleanEmail,
      phone: data.phone || '',
      name: cleanName,
      role: data.role || 'Owner',
      pin: data.pin || '1234',
      password: cleanPass,
      isAppLockEnabled: false,
      settings: storageService.getSettings(),
      bills: [],
      cashEntries: [],
      customerDues: [],
      purchaseTrips: [],
      products: storageService.getProducts(),
      lastActive: Date.now(),
    };
    await storageService.saveToAccountVaultAsync(freshVault);

    // Refresh isolated states for the newly registered account
    setBills([]);
    setCashEntries([]);
    setCustomerDues([]);
    setPurchaseTrips([]);
    setSettings(storageService.getSettings());
    localStorage.setItem('thermal_pos_onboarding_completed', 'true');
    setIsOnboardingOpen(false);

    const welcomeMsg =
      language === 'bn'
        ? `অভিনন্দন ${newProfile.name}! "${cleanStore}" এর অ্যাকাউন্ট তৈরি সম্পন্ন হয়েছে।`
        : `Congratulations ${newProfile.name}! Account created for "${cleanStore}".`;
    showToast(welcomeMsg, 'success');
    return true;
  };

  // 1. BILLING HANDLERS
  const handlePrintBill = async (
    bill: BillInvoice,
    mode: 'save' | 'print' = 'print',
    isTotalOnlySlip?: boolean
  ) => {
    // 1. Save bill in history & deduct/sync product stock
    storageService.saveBill(bill);
    storageService.deductStockForBill(bill.items);
    setBills(storageService.getBills());
    setProducts(storageService.getProducts());
    setSettings(storageService.getSettings());

    const effectiveTotalOnly =
      isTotalOnlySlip !== undefined ? isTotalOnlySlip : Boolean(settings.isTotalOnlySlip);
    setReceiptInitialTotalOnly(effectiveTotalOnly);

    // Sync to Supabase cloud in background
    supabaseService.getActiveUserId().then((userId) => {
      if (userId) {
        supabaseService.syncInvoice(bill, userId);
      }
    });

    // 2. If paid via Cash or UPI, automatically record as Income in Cashbook
    if (bill.paymentMethod === 'cash' || bill.paymentMethod === 'upi' || bill.paymentMethod === 'card') {
      storageService.addCashEntry(
        'Income',
        bill.grandTotal,
        `POS ${bill.paymentMethod.toUpperCase()} Sale #${bill.invoiceNo}`
      );
      setCashEntries(storageService.getCashEntries());
    } else if (bill.paymentMethod === 'due') {
      const dueAmt =
        bill.balance !== undefined
          ? bill.balance
          : Math.max(0, bill.grandTotal - (bill.paidAmount || 0));
      const partyName = (bill.customerName || '').trim() || `Invoice #${bill.invoiceNo}`;
      if (dueAmt > 0) {
        storageService.addOrUpdateCustomerDue(
          partyName,
          dueAmt,
          bill.customerPhone || '',
          `Credit bill #${bill.invoiceNo}`
        );
        setCustomerDues(storageService.getCustomerDues());
      }
      if (bill.paidAmount && bill.paidAmount > 0) {
        storageService.addCashEntry(
          'Income',
          bill.paidAmount,
          `Advance on Sale #${bill.invoiceNo}`
        );
        setCashEntries(storageService.getCashEntries());
      }
    }

    // 3. Clear current bill & auto-saved cart draft
    setBillItems([]);
    try {
      localStorage.removeItem('simple_pos_billing_cart_draft_v1');
    } catch {}

    // 4A. If mode is 'save', only save the bill and show confirmation toast
    if (mode === 'save') {
      setAutoPrintReceipt(false);
      showToast(
        language === 'bn'
          ? `✓ বিল #${bill.invoiceNo} সফলভাবে সেভ হয়েছে!`
          : `✓ Bill #${bill.invoiceNo} saved successfully!`,
        'success',
        bill
      );
      return;
    }

    // 4B. If mode is 'print', open receipt modal with Thermal Printer options & trigger Bluetooth Thermal Printer
    setAutoPrintReceipt(false);
    setReceiptBill(bill);

    if (thermalPrinterService.getIsConnected()) {
      setIsPrintingBill(true);
      const printResult = await thermalPrinterService.printViaBluetooth(bill, {
        ...settings,
        isTotalOnlySlip: effectiveTotalOnly,
      });
      setIsPrintingBill(false);

      if (printResult.success) {
        showToast(
          language === 'bn'
            ? `✓ বিল #${bill.invoiceNo} থার্মাল প্রিন্টারে প্রিন্ট হয়েছে!`
            : `✓ Bill #${bill.invoiceNo} printed via ${bluetoothStatus.deviceName || 'Thermal Printer'}!`,
          'success',
          bill
        );
      } else {
        showToast(`Bluetooth print failed: ${printResult.message}`, 'error', bill);
      }
    } else if (thermalPrinterService.isBluetoothSupported()) {
      setIsPrintingBill(true);
      const connectRes = await thermalPrinterService.connectBluetooth();
      if (connectRes.success && thermalPrinterService.getIsConnected()) {
        const printResult = await thermalPrinterService.printViaBluetooth(bill, settings);
        setIsPrintingBill(false);
        if (printResult.success) {
          showToast(
            language === 'bn'
              ? `✓ বিল #${bill.invoiceNo} থার্মাল প্রিন্টারে প্রিন্ট হয়েছে!`
              : `✓ Bill #${bill.invoiceNo} printed via ${connectRes.deviceName || 'Thermal Printer'}!`,
            'success',
            bill
          );
        } else {
          showToast(`Bluetooth print failed: ${printResult.message}`, 'error', bill);
        }
      } else {
        setIsPrintingBill(false);
      }
    }
  };

  const handleDeleteBill = (id: string) => {
    storageService.deleteBill(id);
    const updatedBills = storageService.getBills();
    setBills(updatedBills);
    setSettings(storageService.getSettings());

    // Sync deletion to Supabase cloud
    supabaseService.getActiveUserId().then((userId) => {
      if (userId) {
        supabaseService.deleteInvoice(id, userId);
      }
    });

    if (receiptBill && (receiptBill.id === id || receiptBill.invoiceNo === id)) {
      setReceiptBill(null);
    }
    if (editingBill && (editingBill.id === id || editingBill.invoiceNo === id)) {
      setEditingBill(null);
    }
    showToast(
      language === 'bn'
        ? 'ইনভয়েস সফলভাবে ডিলিট করা হয়েছে'
        : 'Invoice deleted successfully',
      'info'
    );
  };

  const handleUpdateBill = (updatedBill: BillInvoice) => {
    const prevBill =
      bills.find((b) => b.id === updatedBill.id) || storageService.getBillById(updatedBill.id);

    const prevDue = prevBill
      ? prevBill.balance !== undefined
        ? prevBill.balance
        : prevBill.paymentMethod === 'due'
        ? Math.max(0, prevBill.grandTotal - (prevBill.paidAmount || 0))
        : 0
      : 0;

    const newDue =
      updatedBill.balance !== undefined
        ? updatedBill.balance
        : updatedBill.paymentMethod === 'due'
        ? Math.max(0, updatedBill.grandTotal - (updatedBill.paidAmount || 0))
        : 0;

    storageService.saveBill(updatedBill);
    const freshBills = storageService.getBills();
    setBills(freshBills);

    // Sync due changes to Customer Due Ledger (বাকি খাতা)
    const partyName =
      (updatedBill.customerName || prevBill?.customerName || '').trim() ||
      `Invoice #${updatedBill.invoiceNo}`;
    if (newDue > prevDue) {
      const addedDue = Math.round((newDue - prevDue) * 100) / 100;
      storageService.addOrUpdateCustomerDue(
        partyName,
        addedDue,
        updatedBill.customerPhone || prevBill?.customerPhone || '',
        `Edited Bill #${updatedBill.invoiceNo} (Due)`
      );
      setCustomerDues(storageService.getCustomerDues());
    } else if (newDue < prevDue) {
      const reducedDue = Math.round((prevDue - newDue) * 100) / 100;
      const existingCustomer = storageService
        .getCustomerDues()
        .find((d) => d.name.trim().toLowerCase() === partyName.toLowerCase());
      if (existingCustomer) {
        storageService.recordCustomerPayment(
          existingCustomer.id,
          reducedDue,
          `Edited Bill #${updatedBill.invoiceNo} (Paid)`
        );
        setCustomerDues(storageService.getCustomerDues());
      }
    }

    // Sync update to Supabase cloud
    supabaseService.getActiveUserId().then((userId) => {
      if (userId) {
        supabaseService.syncInvoice(updatedBill, userId);
      }
    });

    // Show the updated receipt immediately so user sees the updated Due / Paid status
    setReceiptBill(updatedBill);

    showToast(
      updatedBill.paymentMethod === 'due' && newDue > 0
        ? language === 'bn'
          ? `বিল #${updatedBill.invoiceNo} বাকি (Due: ${settings.currencySymbol}${newDue.toFixed(2)}) হিসেবে সেভ হয়েছে`
          : `Bill #${updatedBill.invoiceNo} updated as Due (${settings.currencySymbol}${newDue.toFixed(2)})`
        : language === 'bn'
        ? 'বিল সফলভাবে আপডেট হয়েছে'
        : 'Bill updated successfully',
      'success'
    );
  };

  const handleClearBill = () => {
    setBillItems([]);
    try {
      localStorage.removeItem('simple_pos_billing_cart_draft_v1');
    } catch {}
  };

  // 2. CASHBOOK HANDLERS
  const handleAddCashEntry = (type: CashEntryType, amount: number, note: string) => {
    storageService.addCashEntry(type, amount, note);
    const updated = storageService.getCashEntries();
    setCashEntries(updated);

    // Sync to Supabase
    supabaseService.getActiveUserId().then((userId) => {
      if (userId && updated[0]) {
        supabaseService.syncCashEntry(updated[0], userId);
      }
    });
  };

  const handleDeleteCashEntry = (id: string) => {
    storageService.deleteCashEntry(id);
    setCashEntries(storageService.getCashEntries());

    // Sync deletion to Supabase
    supabaseService.getActiveUserId().then((userId) => {
      if (userId) {
        supabaseService.deleteCashEntry(id, userId);
      }
    });
  };

  // 3. CUSTOMER DUE & PAYABLE HANDLERS
  const handleAddOrUpdateDue = (
    name: string,
    amount: number,
    phone?: string,
    note?: string,
    type: DueType = 'receivable'
  ) => {
    storageService.addOrUpdateCustomerDue(name, amount, phone || '', note || '', type);
    const updatedDues = storageService.getCustomerDues();
    setCustomerDues(updatedDues);

    // Sync to Supabase
    supabaseService.getActiveUserId().then((userId) => {
      if (userId) {
        const found = updatedDues.find((d) => d.name === name);
        if (found) {
          supabaseService.syncCustomerDue(found, userId);
        }
      }
    });

    if (type === 'payable') {
      showToast(`কাস্টমার পাওনাদার হিসেবে ${settings.currencySymbol}${amount.toFixed(2)} যুক্ত করা হয়েছে`, 'info');
    } else {
      showToast(`বাকি হিসেবে ${settings.currencySymbol}${amount.toFixed(2)} যুক্ত করা হয়েছে`, 'info');
    }
  };

  const handleBatchImportDues = (
    rows: Array<{
      name: string;
      amount: number;
      phone?: string;
      note?: string;
      type?: DueType;
    }>
  ) => {
    const updatedDues = storageService.batchAddOrUpdateCustomerDues(rows);
    setCustomerDues(updatedDues);

    // Sync to Supabase
    supabaseService.getActiveUserId().then((userId) => {
      if (userId) {
        for (const due of updatedDues) {
          supabaseService.syncCustomerDue(due, userId);
        }
      }
    });

    showToast(
      language === 'bn'
        ? `সফলভাবে ${rows.length} জন কাস্টমারের বকেয়া তথ্য সেভ হয়েছে!`
        : `Successfully imported ${rows.length} customer dues!`,
      'info'
    );
  };

  const handleRecordCustomerPayment = (id: string, amount: number, note?: string) => {
    const target = customerDues.find((d) => d.id === id);
    const isPayable = target?.type === 'payable';

    storageService.recordCustomerPayment(id, amount, note || '');
    const updatedDues = storageService.getCustomerDues();
    setCustomerDues(updatedDues);

    // Sync updated due to Supabase
    supabaseService.getActiveUserId().then((userId) => {
      if (userId) {
        const updatedTarget = updatedDues.find((d) => d.id === id);
        if (updatedTarget) {
          supabaseService.syncCustomerDue(updatedTarget, userId);
        }
      }
    });

    // Cashbook sync:
    // If receiving money for due -> Cashbook Income
    // If paying creditor customer back -> Cashbook Expense
    if (isPayable) {
      storageService.addCashEntry(
        'Expense',
        amount,
        `পাওনাদারকে পরিশোধ: ${target?.name || 'Customer'} - ${note || 'Settlement'}`
      );
      showToast(`পাওনাদারকে ${settings.currencySymbol}${amount.toFixed(2)} পরিশোধ রেকর্ড করা হয়েছে`, 'success');
    } else {
      storageService.addCashEntry(
        'Income',
        amount,
        `বাকি আদায় জমা: ${target?.name || 'Customer'} - ${note || 'Due payment'}`
      );
      showToast(`বাকি আদায় ${settings.currencySymbol}${amount.toFixed(2)} ক্যাশবুকে জমা হয়েছে`, 'success');
    }
    const freshCash = storageService.getCashEntries();
    setCashEntries(freshCash);
    supabaseService.getActiveUserId().then((userId) => {
      if (userId && freshCash[0]) {
        supabaseService.syncCashEntry(freshCash[0], userId);
      }
    });
  };

  const handleDeleteCustomerDue = (id: string) => {
    storageService.deleteCustomerDue(id);
    setCustomerDues(storageService.getCustomerDues());

    // Sync deletion to Supabase
    supabaseService.getActiveUserId().then((userId) => {
      if (userId) {
        supabaseService.deleteCustomerDue(id, userId);
      }
    });
  };

  const handleUpdateCustomerDue = (
    id: string,
    updates: {
      name?: string;
      phone?: string;
      dueAmount?: number;
      type?: DueType;
    }
  ) => {
    const updated = storageService.updateCustomerDueDetails(id, updates);
    const updatedDues = storageService.getCustomerDues();
    setCustomerDues(updatedDues);

    if (updated) {
      supabaseService.getActiveUserId().then((userId) => {
        if (userId) {
          supabaseService.syncCustomerDue(updated, userId);
        }
      });
      showToast(
        language === 'bn'
          ? 'কাস্টমারের তথ্য সফলভাবে আপডেট হয়েছে'
          : 'Customer details updated successfully',
        'info'
      );
    }
  };

  // 4. LANGUAGE SELECT & TOGGLE HANDLER
  const handleSelectLanguage = (nextLang: Language) => {
    storageService.setLanguage(nextLang);
    setLanguage(nextLang);
    const msg =
      nextLang === 'bn'
        ? 'বাংলা ভাষা সক্রিয় করা হয়েছে'
        : nextLang === 'hi'
        ? 'हिन्दी भाषा सक्रिय की गई है'
        : 'Switched to English language';
    showToast(msg, 'info');
  };

  const handleToggleLanguage = () => {
    const nextLang: Language = language === 'bn' ? 'en' : language === 'en' ? 'hi' : 'bn';
    handleSelectLanguage(nextLang);
  };

  // 5. STOCK PURCHASE / SHOPPING TRIP HANDLERS
  const handleCreatePurchaseTrip = (
    title: string,
    initialCash: number,
    marketLocation?: string,
    note?: string
  ) => {
    const newTrip = storageService.createPurchaseTrip(title, initialCash, marketLocation, note);
    setPurchaseTrips(storageService.getPurchaseTrips());
    showToast(
      language === 'bn'
        ? `নতুন বাজার ট্রিপ "${newTrip.title}" যুক্ত হয়েছে। সাথে নেওয়া ক্যাশ: ${settings.currencySymbol}${initialCash}`
        : `Shopping trip "${newTrip.title}" started. Cash taken: ${settings.currencySymbol}${initialCash}`,
      'success'
    );
  };

  const handleAddTripExpense = (
    tripId: string,
    expense: Omit<PurchaseExpenseItem, 'id' | 'timestamp' | 'dateFormatted'>
  ) => {
    const updated = storageService.addExpenseToTrip(tripId, expense);
    if (updated) {
      setPurchaseTrips(storageService.getPurchaseTrips());
      showToast(
        language === 'bn'
          ? `খরচ যোগ হয়েছে: ${expense.title} (${settings.currencySymbol}${expense.amount})`
          : `Expense recorded: ${expense.title} (${settings.currencySymbol}${expense.amount})`,
        'success'
      );
    }
  };

  const handleDeleteTripExpense = (tripId: string, expenseId: string) => {
    storageService.deleteExpenseFromTrip(tripId, expenseId);
    setPurchaseTrips(storageService.getPurchaseTrips());
    showToast(
      language === 'bn' ? 'খরচের বিবরণ মুছে ফেলা হয়েছে' : 'Expense item removed',
      'info'
    );
  };

  const handleUpdateTripStatus = (tripId: string, status: 'active' | 'completed') => {
    storageService.updateTripStatus(tripId, status);
    setPurchaseTrips(storageService.getPurchaseTrips());
    showToast(
      status === 'completed'
        ? (language === 'bn' ? 'কেনাকাটা সম্পন্ন হিসেবে চিহ্নিত করা হয়েছে' : 'Trip completed')
        : (language === 'bn' ? 'ট্রিপ পুনরায় সক্রিয় করা হয়েছে' : 'Trip reopened'),
      'info'
    );
  };

  const handleDeletePurchaseTrip = (tripId: string) => {
    storageService.deletePurchaseTrip(tripId);
    setPurchaseTrips(storageService.getPurchaseTrips());
    showToast(
      language === 'bn' ? 'কেনাকাটার ট্রিপ মুছে ফেলা হয়েছে' : 'Trip record deleted',
      'info'
    );
  };

  const handleUpdatePurchaseTrip = (
    tripId: string,
    updates: {
      title?: string;
      initialCash?: number;
      marketLocation?: string;
      note?: string;
    }
  ) => {
    const updated = storageService.updatePurchaseTrip(tripId, updates);
    if (updated) {
      setPurchaseTrips(storageService.getPurchaseTrips());
      showToast(
        language === 'bn'
          ? `ট্রিপ ও ক্যাশ টাকা সফলভাবে সংশোধন করা হয়েছে (${settings.currencySymbol}${updated.initialCash})`
          : `Trip & cash updated successfully (${settings.currencySymbol}${updated.initialCash})`,
        'success'
      );
    }
  };

  const handleAddCashToTrip = (tripId: string, additionalCash: number) => {
    const updated = storageService.addCashToTrip(tripId, additionalCash);
    if (updated) {
      setPurchaseTrips(storageService.getPurchaseTrips());
      showToast(
        language === 'bn'
          ? `ক্যাশে আরো ${settings.currencySymbol}${additionalCash} যোগ হয়েছে! বর্তমান মোট ক্যাশ: ${settings.currencySymbol}${updated.initialCash}`
          : `Added ${settings.currencySymbol}${additionalCash} cash! Total cash: ${settings.currencySymbol}${updated.initialCash}`,
        'success'
      );
    }
  };

  const handleSyncTripToCashbook = (trip: PurchaseTrip) => {
    if (trip.totalSpent <= 0) {
      showToast(
        language === 'bn'
          ? 'কোনো খরচ না থাকায় ক্যাশবুকে যোগ করার প্রয়োজন নেই'
          : 'No expenses to sync',
        'info'
      );
      return;
    }
    const entry = storageService.addCashEntry(
      'Expense',
      trip.totalSpent,
      `দোকানের মাল কেনা: ${trip.title}${trip.marketLocation ? ` (${trip.marketLocation})` : ''} [সাথে নেওয়া: ${settings.currencySymbol}${trip.initialCash}, অবশিষ্ট: ${settings.currencySymbol}${trip.remainingCash}]`
    );
    storageService.setTripSyncedCashEntry(trip.id, entry.id);
    setCashEntries(storageService.getCashEntries());
    setPurchaseTrips(storageService.getPurchaseTrips());
    showToast(
      language === 'bn'
        ? `ক্যাশবুকে ${settings.currencySymbol}${trip.totalSpent.toFixed(2)} খরচ হিসেবে যোগ করা হয়েছে!`
        : `Recorded ${settings.currencySymbol}${trip.totalSpent.toFixed(2)} as Cashbook Expense!`,
      'success'
    );
  };

  // Settings Handlers
  const handleSaveSettings = (newSettings: ThermalPrinterSettings) => {
    storageService.saveSettings(newSettings);
    setSettings(newSettings);
  };

  const handleUpdatePaperWidth = (paperWidth: PaperWidth) => {
    const updated = { ...settings, paperWidth };
    storageService.saveSettings(updated);
    setSettings(updated);
  };

  const handleToggleLabelMode = (isLabelMode: boolean) => {
    const updated = { ...settings, isLabelMode };
    storageService.saveSettings(updated);
    setSettings(updated);
  };

  const handleToggleTotalOnlySlip = (isTotalOnlySlip: boolean) => {
    const updated = { ...settings, isTotalOnlySlip };
    storageService.saveSettings(updated);
    setSettings(updated);
  };

  // Product Stock Handlers
  const handleSaveProductStock = (data: {
    id?: string;
    name: string;
    price: number;
    purchasePrice?: number;
    stock?: number;
    addStockDelta?: number;
    unit?: string;
    category?: string;
    barcode?: string;
  }) => {
    const saved = storageService.addOrUpdateProduct(data);
    setProducts(storageService.getProducts());
    showToast(
      language === 'bn'
        ? `"${saved.name}" স্টকে সেভ হয়েছে (দর: ${settings.currencySymbol}${saved.price}, স্টক: ${saved.stock})`
        : `"${saved.name}" saved to stock (Price: ${settings.currencySymbol}${saved.price}, Stock: ${saved.stock})`,
      'success'
    );
  };

  const handleAdjustProductStock = (productId: string, delta: number) => {
    const updated = storageService.adjustProductStock(productId, delta);
    setProducts(storageService.getProducts());
    if (updated) {
      showToast(
        language === 'bn'
          ? `"${updated.name}" এর বর্তমান স্টক: ${updated.stock}`
          : `"${updated.name}" stock updated to ${updated.stock}`,
        'info'
      );
    }
  };

  const handleDeleteProductStock = (productId: string) => {
    storageService.deleteProduct(productId);
    setProducts(storageService.getProducts());

    // Sync product deletion to Supabase cloud if connected
    supabaseService.getActiveUserId().then((userId) => {
      supabaseService.deleteProduct(productId, userId || undefined);
    });

    showToast(
      language === 'bn' ? 'প্রোডাক্ট তালিকা থেকে মুছে ফেলা হয়েছে' : 'Product removed from stock',
      'info'
    );
  };

  const handleManualSync = async () => {
    const prof = storageService.getUserProfile();
    const syncId = prof.email || prof.phone;
    if (!syncId) return;
    try {
      showToast(
        language === 'bn'
          ? 'ক্লাউড থেকে ডেটা সিঙ্ক করা হচ্ছে...'
          : 'Syncing shop data across devices...',
        'info'
      );
      // 1. Upload current local data to server
      storageService.syncActiveAccountVault();

      // 2. Fetch latest merged canonical vault from server
      const norm = storageService.normalizeIdentifier(syncId);
      const res = await fetch(`/api/vault/${encodeURIComponent(norm)}`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.vault) {
          const serverVault = json.vault;
          storageService.applyServerVaultSilently(serverVault);
          setBills(serverVault.bills || []);
          setProducts(serverVault.products || []);
          if (Array.isArray(serverVault.cashEntries)) setCashEntries(serverVault.cashEntries);
          if (Array.isArray(serverVault.customerDues)) setCustomerDues(serverVault.customerDues);
          if (Array.isArray(serverVault.purchaseTrips)) setPurchaseTrips(serverVault.purchaseTrips);
          if (serverVault.settings) setSettings(serverVault.settings);
          showToast(
            language === 'bn'
              ? `সিঙ্ক সফল! (${serverVault.bills?.length || 0}টি ইনভয়েস, ${serverVault.products?.length || 0}টি প্রোডাক্ট)`
              : `Synced! (${serverVault.bills?.length || 0} Invoices, ${serverVault.products?.length || 0} Products)`,
            'success'
          );
        }
      }
    } catch {
      showToast(
        language === 'bn'
          ? 'সিঙ্ক ব্যর্থ হয়েছে। ইন্টারনেট সংযোগ চেক করুন।'
          : 'Sync failed. Please check internet connection.',
        'error'
      );
    }
  };

  return (
    <div className="min-h-screen bg-stone-100/70 text-stone-900 flex flex-col font-sans">
      {/* Google Sheets / Workspace Top Header & Sub-header */}
      <Header
        settings={settings}
        bluetoothStatus={bluetoothStatus}
        onConnectBluetooth={handleConnectBluetooth}
        onDisconnectBluetooth={handleDisconnectBluetooth}
        onTestPrint={handleTestPrint}
        onOpenSettings={() => setIsSettingsOpen(true)}
        userProfile={userProfile}
        onOpenLogin={() => setIsLoginModalOpen(true)}
        language={language}
        onToggleLanguage={handleToggleLanguage}
        onSelectLanguage={handleSelectLanguage}
        onOpenCalculator={() => setIsCalculatorOpen(true)}
        onLockApp={handleLockApp}
        onManualSync={handleManualSync}
        activeTab={activeTab}
        onSelectTab={(tab) => {
          if (tab === 'billing') {
            setProducts(storageService.getProducts());
          }
          setActiveTab(tab);
        }}
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        sortOption={sortOption}
        onSortChange={setSortOption}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        totalInvoicesCount={bills.length}
        totalProductsCount={products.length}
        onOpenProductStock={() => setIsProductStockOpen(true)}
        networkStatus={networkStatus}
        onOpenDataSaver={() => setIsDataSaverOpen(true)}
        onOpenBluetoothHelp={() => setIsBluetoothHelpOpen(true)}
      />

      {/* Main Workspace */}
      <main className="flex-1 pb-28 sm:pb-32">
        {activeTab === 'billing' && (
          <BillingTab
            billItems={billItems}
            setBillItems={setBillItems}
            settings={settings}
            bluetoothStatus={bluetoothStatus}
            isPrinting={isPrintingBill}
            onPrintBill={handlePrintBill}
            onClearBill={handleClearBill}
            language={language}
            onOpenCalculator={() => setIsCalculatorOpen(true)}
            products={products}
            onOpenProductStock={() => setIsProductStockOpen(true)}
            totalInvoicesCount={bills.length}
            onQuickSaveProduct={(data) => {
              storageService.addOrUpdateProduct(data);
              setProducts(storageService.getProducts());
            }}
          />
        )}

        {activeTab === 'invoices' && (
          <InvoicesTab
            bills={bills}
            settings={settings}
            language={language}
            onViewReceipt={(bill) => setReceiptBill(bill)}
            onDeleteBill={handleDeleteBill}
            onUpdateBill={handleUpdateBill}
            onEditBill={(bill) => setEditingBill(bill)}
            onLoadIntoBilling={(bill) => {
              setBillItems(bill.items);
              setActiveTab('billing');
              showToast(
                language === 'bn'
                  ? 'আইটেমগুলো বিলিং কাউন্টারে লোড করা হয়েছে'
                  : 'Items loaded into billing counter',
                'info'
              );
            }}
            externalSearchTerm={searchTerm}
            viewMode={viewMode}
            sortOption={sortOption}
            onNavigateToBilling={() => setActiveTab('billing')}
          />
        )}

        {activeTab === 'cashbook' && (
          <CashbookTab
            entries={cashEntries}
            bills={bills}
            settings={settings}
            language={language}
            onAddEntry={handleAddCashEntry}
            onDeleteEntry={handleDeleteCashEntry}
          />
        )}

        {activeTab === 'due' && (
          <CustomerDueTab
            dues={customerDues}
            settings={settings}
            language={language}
            onAddOrUpdateDue={handleAddOrUpdateDue}
            onRecordPayment={handleRecordCustomerPayment}
            onDeleteDue={handleDeleteCustomerDue}
            onPrintDueSlip={(bill) => setReceiptBill(bill)}
            onBatchImportDues={handleBatchImportDues}
            onUpdateCustomerDue={handleUpdateCustomerDue}
          />
        )}

        {activeTab === 'purchases' && (
          <PurchaseTripTab
            trips={purchaseTrips}
            settings={settings}
            language={language}
            onOpenCalculator={() => setIsCalculatorOpen(true)}
            onCreateTrip={handleCreatePurchaseTrip}
            onUpdateTrip={handleUpdatePurchaseTrip}
            onAddCashToTrip={handleAddCashToTrip}
            onAddExpense={handleAddTripExpense}
            onDeleteExpense={handleDeleteTripExpense}
            onUpdateTripStatus={handleUpdateTripStatus}
            onDeleteTrip={handleDeletePurchaseTrip}
            onSyncTripToCashbook={handleSyncTripToCashbook}
            onPrintTripSlip={(bill) => setReceiptBill(bill)}
          />
        )}

        {activeTab === 'barcode' && (
          <BarcodeTagStudioTab
            settings={settings}
            language={language}
            bills={bills}
            products={products}
            selectedProduct={barcodeTargetProduct}
            onSaveProduct={(savedProd) => {
              const fresh = storageService.getProducts();
              setProducts(fresh);
              if (savedProd) {
                setBarcodeTargetProduct(savedProd);
              }
            }}
            onShowToast={showToast}
          />
        )}
      </main>

      {/* Fixed Bottom Navigation Bar (Vyapar style - Tabs only) */}
      <BottomNav
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        cartCount={billItems.length}
        invoicesCount={bills.length}
        purchasesCount={purchaseTrips.filter((t) => t.status === 'active').length}
        duesCount={customerDues.filter((c) => c.totalDue > 0).length}
        language={language}
      />

      {/* User Login & Profile Modal */}
      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        userProfile={userProfile}
        settings={settings}
        onSaveSettings={handleSaveSettings}
        onLogin={handleLoginUser}
        onRegister={handleRegisterUser}
        onLogout={handleLogoutUser}
        onUpdateSecurity={handleUpdateSecurity}
        onLockApp={handleLockApp}
        language={language}
        onSelectLanguage={handleSelectLanguage}
        onOpenForgotPassword={(email) => {
          setResetPasswordEmail(email || '');
          setResetPasswordMode('request_link');
          setIsResetPasswordOpen(true);
        }}
      />

      {/* App Lock Screen (4-Digit PIN Security Vault) */}
      <AppLockScreen
        isLocked={isAppLocked}
        onUnlock={handleUnlockApp}
        userProfile={userProfile}
        settings={settings}
        language={language}
        onResetPin={handleResetPin}
      />

      {/* Thermal Receipt Print & Preview Dialog */}
      {receiptBill && (
        <PrintReceiptModal
          bill={receiptBill}
          onClose={() => {
            setAutoPrintReceipt(false);
            setReceiptBill(null);
          }}
          settings={settings}
          bluetoothStatus={bluetoothStatus}
          onConnectBluetooth={handleConnectBluetooth}
          onUpdatePaperWidth={handleUpdatePaperWidth}
          onToggleLabelMode={handleToggleLabelMode}
          onToggleTotalOnlySlip={handleToggleTotalOnlySlip}
          initialTotalOnlySlip={receiptInitialTotalOnly}
          onEditBill={(bill) => {
            setAutoPrintReceipt(false);
            setReceiptBill(null);
            setEditingBill(bill);
          }}
          onDeleteBill={(id) => {
            setAutoPrintReceipt(false);
            handleDeleteBill(id);
            setReceiptBill(null);
          }}
          language={language}
          autoPrint={autoPrintReceipt}
          onAutoPrintComplete={() => setAutoPrintReceipt(false)}
        />
      )}

      {/* Global Edit Invoice Modal */}
      {editingBill && (
        <EditInvoiceModal
          bill={editingBill}
          isOpen={Boolean(editingBill)}
          settings={settings}
          language={language}
          onClose={() => setEditingBill(null)}
          onSave={(updated) => {
            handleUpdateBill(updated);
            setEditingBill(null);
          }}
          onDelete={(id) => {
            handleDeleteBill(id);
            setEditingBill(null);
          }}
          onLoadInBilling={(bill) => {
            setBillItems(bill.items);
            setActiveTab('billing');
            setEditingBill(null);
            showToast(
              language === 'bn'
                ? 'আইটেমগুলো বিলিং কাউন্টারে লোড করা হয়েছে'
                : 'Items loaded into billing counter',
              'info'
            );
          }}
        />
      )}

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onSaveSettings={handleSaveSettings}
        bluetoothStatus={bluetoothStatus}
        onConnectBluetooth={handleConnectBluetooth}
        onDisconnectBluetooth={handleDisconnectBluetooth}
        onTestPrint={handleTestPrint}
        onOpenBluetoothHelp={() => setIsBluetoothHelpOpen(true)}
        language={language}
        onDataRestored={() => {
          setBills(storageService.getBills());
          setCashEntries(storageService.getCashEntries());
          setCustomerDues(storageService.getCustomerDues());
          setProducts(storageService.getProducts());
          setSettings(storageService.getSettings());
          showToast(language === 'bn' ? 'ডাটা ব্যাকআপ সফলভাবে রিস্টোর হয়েছে!' : 'Data backup restored successfully!');
        }}
      />

      {/* Product Stock Manager Modal */}
      <ProductStockModal
        isOpen={isProductStockOpen}
        onClose={() => setIsProductStockOpen(false)}
        products={products}
        onSaveProduct={handleSaveProductStock}
        onAdjustStock={handleAdjustProductStock}
        onDeleteProduct={handleDeleteProductStock}
        onSelectForBill={(prod, qty = 1) => {
          const newItem: BillItem = {
            id: 'item-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
            name: prod.name,
            price: prod.price,
            qty,
            total: prod.price * qty,
            barcode: prod.barcode,
            productId: prod.id,
          };
          setBillItems((prev) => [...prev, newItem]);
          setActiveTab('billing');
          showToast(
            language === 'bn'
              ? `"${prod.name}" বিলে যোগ করা হয়েছে`
              : `"${prod.name}" added to bill`,
            'success'
          );
        }}
        onOpenBarcodeStudio={(prod) => {
          setBarcodeTargetProduct(prod);
          setActiveTab('barcode');
          showToast(
            language === 'bn'
              ? `"${prod.name}" (${prod.barcode}) বারকোড প্রিন্টের জন্য প্রস্তুত!`
              : `"${prod.name}" (${prod.barcode}) loaded in Barcode Studio!`,
            'info'
          );
        }}
        settings={settings}
        language={language}
      />

      {/* Bluetooth Setup & Troubleshooting Guide Modal */}
      <BluetoothHelpModal
        isOpen={isBluetoothHelpOpen}
        onClose={() => setIsBluetoothHelpOpen(false)}
        language={language}
        onSystemPrintFallback={() => {
          window.print();
        }}
      />

      {/* First-Time Onboarding & Multi-User Cloud Modal */}
      <OnboardingModal
        isOpen={isOnboardingOpen}
        onSave={handleSaveOnboarding}
        onLoginExisting={handleLoginExisting}
        language={language}
        onSelectLanguage={handleSelectLanguage}
        onOpenForgotPassword={(email) => {
          setResetPasswordEmail(email || '');
          setResetPasswordMode('request_link');
          setIsResetPasswordOpen(true);
        }}
      />

      {/* Supabase Password Reset Modal (Request link & Update password view) */}
      <ResetPasswordModal
        isOpen={isResetPasswordOpen}
        onClose={() => setIsResetPasswordOpen(false)}
        language={language}
        initialMode={resetPasswordMode}
        prefilledEmail={resetPasswordEmail}
        onSuccess={(msg) => {
          if (resetPasswordMode === 'update_password') {
            try {
              const cleanPath = window.location.pathname.replace('/reset-password', '') || '/';
              window.history.replaceState(null, document.title, cleanPath);
            } catch (e) {
              console.warn('URL clean notice:', e);
            }
            setIsResetPasswordOpen(false);
            setIsLoginModalOpen(true);
            showToast(
              msg ||
                (language === 'bn'
                  ? 'পাসওয়ার্ড সফলভাবে পরিবর্তন করা হয়েছে! নতুন পাসওয়ার্ড দিয়ে লগইন করুন।'
                  : 'Password updated successfully! Please log in with your new password.'),
              'success'
            );
          } else {
            showToast(msg, 'success');
          }
        }}
      />

      {/* POS & Wholesale Quick Calculator Modal */}
      <CalculatorModal
        isOpen={isCalculatorOpen}
        onClose={() => setIsCalculatorOpen(false)}
        settings={settings}
        language={language}
      />

      {/* Ultra Low-Data & Offline Engine Modal */}
      <DataSaverModal
        isOpen={isDataSaverOpen}
        onClose={() => setIsDataSaverOpen(false)}
        networkStatus={networkStatus}
        settings={settings}
        onUpdateSettings={handleSaveSettings}
        language={language}
        onShowToast={showToast}
      />

      {/* Khatabook / Vyapar style Floating Back Exit Pill */}
      <BackExitPill
        isVisible={isExitPillVisible}
        onDismiss={() => setIsExitPillVisible(false)}
        onOpenConfirm={() => {
          setIsExitPillVisible(false);
          setIsExitConfirmOpen(true);
        }}
        language={language}
        durationMs={3500}
      />

      {/* Native Mobile Exit Confirmation Bottom Sheet / Modal */}
      <ExitConfirmModal
        isOpen={isExitConfirmOpen}
        onClose={() => setIsExitConfirmOpen(false)}
        onConfirmExit={() => backHandler.forceExit()}
        language={language}
      />

      {/* Instant Notification Toast (Positioned above bottom nav bar) */}
      {toast && (
        <div
          id="ble-toast"
          className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 max-w-md w-[92%] sm:w-auto bg-stone-900 text-white px-4 py-3 rounded-2xl shadow-2xl border border-stone-700 flex items-center justify-between gap-3 animate-in fade-in slide-in-from-bottom-4 duration-200"
        >
          <div className="flex items-center gap-2.5">
            {toast.type === 'success' ? (
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 shrink-0 animate-pulse"></span>
            ) : toast.type === 'error' ? (
              <span className="h-2.5 w-2.5 rounded-full bg-rose-400 shrink-0"></span>
            ) : (
              <span className="h-2.5 w-2.5 rounded-full bg-blue-400 shrink-0"></span>
            )}
            <span className="text-xs sm:text-sm font-medium">{toast.message}</span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {toast.bill && (
              <button
                onClick={() => {
                  setReceiptBill(toast.bill!);
                  setToast(null);
                }}
                className="px-2.5 py-1 bg-white/15 hover:bg-white/25 rounded-lg text-xs font-bold text-white transition-colors cursor-pointer"
              >
                View Slip
              </button>
            )}
            <button
              onClick={() => setToast(null)}
              className="text-stone-400 hover:text-white text-xs font-bold px-1.5 py-0.5 rounded cursor-pointer"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
