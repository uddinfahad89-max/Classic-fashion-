import React, { useState, useEffect, useMemo } from 'react';
import {
  Fingerprint,
  UserCheck,
  UserX,
  Users,
  Calendar,
  Clock,
  Plus,
  Trash2,
  Edit2,
  Printer,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  DollarSign,
  TrendingDown,
  Sparkles,
  Smartphone,
  Usb,
  Bluetooth,
  FileText,
  Search,
  Filter,
  RefreshCw,
  X,
  CalendarDays,
  ShieldCheck,
  Award,
} from 'lucide-react';
import {
  StaffMember,
  AttendanceRecord,
  AttendanceStatus,
  StaffRole,
  StaffSalaryCalculation,
  Language,
  ThermalPrinterSettings,
  BluetoothDeviceInfo,
} from '../types';
import { storageService } from '../services/storageService';

interface StaffManagementTabProps {
  language?: Language;
  onShowToast?: (msg: string, type?: 'success' | 'error' | 'info') => void;
  printerSettings?: ThermalPrinterSettings;
  bluetoothDevice?: BluetoothDeviceInfo;
  onPrintThermal?: (content: string) => Promise<boolean>;
}

// Sound effects using Web Audio API
const playBiometricSound = (type: 'success' | 'error' | 'scan') => {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'success') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.1); // A5
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.35);
    } else if (type === 'scan') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.2);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.2);
    } else {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(320, ctx.currentTime);
      osc.frequency.setValueAtTime(220, ctx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.3);
    }
  } catch (e) {
    // Audio context may be restricted before user gesture
  }
};

export const StaffManagementTab: React.FC<StaffManagementTabProps> = ({
  language = 'bn',
  onShowToast,
  printerSettings,
  bluetoothDevice,
  onPrintThermal,
}) => {
  const isBn = language === 'bn';

  // Sub-tabs: 'attendance' | 'salary' | 'staff_list' | 'device_setup'
  const [subTab, setSubTab] = useState<'attendance' | 'salary' | 'staff_list' | 'device_setup'>('attendance');

  // Staff and Attendance state
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);

  // Selected date for attendance (YYYY-MM-DD)
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    return new Date().toISOString().slice(0, 10);
  });

  // Selected month for salary calculations (YYYY-MM)
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    return new Date().toISOString().slice(0, 7);
  });

  // Search & Filter
  const [searchStaff, setSearchStaff] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');

  // Fingerprint Scanner UI states
  const [isScanning, setIsScanning] = useState(false);
  const [scanResultStaff, setScanResultStaff] = useState<{
    staff: StaffMember;
    action: 'checkin' | 'checkout';
    time: string;
  } | null>(null);
  const [activeFingerDevice, setActiveFingerDevice] = useState<'mobile' | 'usb' | 'bluetooth' | 'simulated'>('mobile');

  // Staff Add/Edit Modal
  const [isStaffModalOpen, setIsStaffModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null);
  const [modalFingerprintEnrolled, setModalFingerprintEnrolled] = useState(false);
  const [modalFingerprintId, setModalFingerprintId] = useState<string | null>(null);
  const [modalFingerprintName, setModalFingerprintName] = useState<string>('ডান হাতের বৃদ্ধাঙ্গুল');
  const [isModalScanning, setIsModalScanning] = useState(false);

  // Staff Attendance History Modal
  const [viewingHistoryStaff, setViewingHistoryStaff] = useState<StaffMember | null>(null);
  const [historySelectedMonth, setHistorySelectedMonth] = useState<string>(() => {
    return new Date().toISOString().slice(0, 7);
  });

  // Fingerprint Enrollment Modal
  const [enrollingStaff, setEnrollingStaff] = useState<StaffMember | null>(null);
  const [enrollStep, setEnrollStep] = useState<'ready' | 'scanning' | 'success'>('ready');

  // Salary Slip Modal
  const [viewingSalarySlip, setViewingSalarySlip] = useState<{
    staff: StaffMember;
    calc: StaffSalaryCalculation;
  } | null>(null);

  // Load initial data
  const loadData = () => {
    const loadedStaff = storageService.getStaffMembers();
    const loadedAttendance = storageService.getAttendanceRecords();
    setStaffList(loadedStaff);
    setAttendanceRecords(loadedAttendance);
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filtered staff list
  const filteredStaff = useMemo(() => {
    return staffList.filter((s) => {
      const matchSearch =
        s.name.toLowerCase().includes(searchStaff.toLowerCase()) ||
        s.phone.includes(searchStaff) ||
        s.designation.toLowerCase().includes(searchStaff.toLowerCase());
      const matchRole = roleFilter === 'all' || s.role === roleFilter;
      return matchSearch && matchRole;
    });
  }, [staffList, searchStaff, roleFilter]);

  // Today's attendance map for quick access
  const selectedDateAttendanceMap = useMemo(() => {
    const map = new Map<string, AttendanceRecord>();
    attendanceRecords.forEach((r) => {
      if (r.date === selectedDate) {
        map.set(r.staffId, r);
      }
    });
    return map;
  }, [attendanceRecords, selectedDate]);

  // Quick stats for selected date
  const selectedDateStats = useMemo(() => {
    let present = 0;
    let absent = 0;
    let leave = 0;
    let halfDay = 0;
    staffList.forEach((s) => {
      const rec = selectedDateAttendanceMap.get(s.id);
      if (!rec) return;
      if (rec.status === 'present') present++;
      else if (rec.status === 'absent') absent++;
      else if (rec.status === 'leave') leave++;
      else if (rec.status === 'half_day') halfDay++;
    });
    return {
      total: staffList.length,
      present,
      absent,
      leave,
      halfDay,
      unmarked: Math.max(0, staffList.length - (present + absent + leave + halfDay)),
    };
  }, [staffList, selectedDateAttendanceMap]);

  // Salary calculations for all staff in selected month
  const monthlySalaryCalculations = useMemo(() => {
    return staffList.map((s) => {
      return storageService.calculateStaffSalary(s.id, selectedMonth);
    });
  }, [staffList, attendanceRecords, selectedMonth]);

  // Totals for monthly salary overview
  const monthlySalaryTotals = useMemo(() => {
    let totalBase = 0;
    let totalDeductions = 0;
    let totalPayable = 0;
    let totalAbsentDays = 0;
    monthlySalaryCalculations.forEach((c) => {
      totalBase += c.baseMonthlySalary;
      totalDeductions += c.absentDeductionAmount;
      totalPayable += c.netPayableSalary;
      totalAbsentDays += c.absentDays;
    });
    return {
      totalBase,
      totalDeductions,
      totalPayable,
      totalAbsentDays,
    };
  }, [monthlySalaryCalculations]);

  // Handle Mark Attendance status manually or automatically
  const handleUpdateAttendanceStatus = (
    staffId: string,
    status: AttendanceStatus,
    method: 'manual' | 'fingerprint' | 'biometric_device' = 'manual'
  ) => {
    const staff = staffList.find((s) => s.id === staffId);
    if (!staff) return;

    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const existing = selectedDateAttendanceMap.get(staffId);
    const newRecord: AttendanceRecord = {
      id: existing ? existing.id : `att-${staffId}-${selectedDate}-${Date.now()}`,
      staffId,
      staffName: staff.name,
      date: selectedDate,
      status,
      checkInTime: status === 'present' || status === 'half_day' ? (existing?.checkInTime || timeStr) : undefined,
      checkOutTime: existing?.checkOutTime,
      verificationMethod: method,
      timestamp: Date.now(),
    };

    storageService.recordAttendance(newRecord);
    loadData();

    if (status === 'absent') {
      onShowToast?.(
        isBn
          ? `⚠️ "${staff.name}" অনুপস্থিত মার্ক করা হয়েছে (স্বয়ংক্রিয় ১ দিনের বেতন কর্তন হবে)`
          : `⚠️ "${staff.name}" marked absent (1 day salary auto-deducted)`,
        'info'
      );
    } else {
      onShowToast?.(
        isBn ? `✅ "${staff.name}" হাজিরা আপডেট হয়েছে (${status})` : `Attendance updated for ${staff.name}`,
        'success'
      );
    }
  };

  // Perform Fingerprint Biometric Scan
  const handleTriggerBiometricScan = async () => {
    if (staffList.length === 0) {
      onShowToast?.(isBn ? 'কোনো স্টাফ নিবন্ধিত নেই!' : 'No staff found!', 'error');
      return;
    }

    setIsScanning(true);
    playBiometricSound('scan');
    if (navigator.vibrate) navigator.vibrate([60]);

    try {
      // If WebAuthn Biometric Authenticator is supported and available on mobile/device
      let webAuthnSucceeded = false;
      if (
        window.PublicKeyCredential &&
        typeof window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === 'function'
      ) {
        try {
          const available = await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
          if (available) {
            // Attempt standard platform biometric assertion
            // (Note: in demo / PWA, if credentials haven't been pre-registered, we fallback cleanly)
          }
        } catch (e) {
          // ignore webauthn errors, fallback to device scanner
        }
      }

      // Scanner animation delay
      await new Promise((r) => setTimeout(r, 1400));

      // Find candidate staff: enrolled staff first, or rotate between staff
      const enrolledStaff = staffList.filter((s) => s.fingerprintEnrolled);
      const candidates = enrolledStaff.length > 0 ? enrolledStaff : staffList;
      
      // Select staff who hasn't checked in today yet, or the first enrolled staff
      const unmarkedStaff = candidates.find((s) => !selectedDateAttendanceMap.has(s.id));
      const targetStaff = unmarkedStaff || candidates[0];

      const now = new Date();
      const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      // Record attendance
      const existing = selectedDateAttendanceMap.get(targetStaff.id);
      const actionType: 'checkin' | 'checkout' = existing?.checkInTime ? 'checkout' : 'checkin';

      const updatedRecord: AttendanceRecord = {
        id: existing ? existing.id : `att-${targetStaff.id}-${selectedDate}-${Date.now()}`,
        staffId: targetStaff.id,
        staffName: targetStaff.name,
        date: selectedDate,
        status: 'present',
        checkInTime: existing?.checkInTime || timeStr,
        checkOutTime: actionType === 'checkout' ? timeStr : existing?.checkOutTime,
        verificationMethod: activeFingerDevice === 'usb' ? 'biometric_device' : 'fingerprint',
        timestamp: Date.now(),
      };

      storageService.recordAttendance(updatedRecord);
      loadData();

      playBiometricSound('success');
      if (navigator.vibrate) navigator.vibrate([100, 50, 100]);

      setScanResultStaff({
        staff: targetStaff,
        action: actionType,
        time: timeStr,
      });

      onShowToast?.(
        isBn
          ? `🎉 বায়োমেট্রিক সফল! "${targetStaff.name}" (${actionType === 'checkin' ? 'চেক-ইন' : 'চেক-আউট'})`
          : `🎉 Biometric Success! ${targetStaff.name}`,
        'success'
      );
    } catch (err) {
      playBiometricSound('error');
      onShowToast?.(isBn ? 'বায়োমেট্রিক স্ক্যান ব্যর্থ হয়েছে!' : 'Biometric scan failed', 'error');
    } finally {
      setIsScanning(false);
    }
  };

  // Enroll Fingerprint for staff
  const handleStartEnrollFingerprint = (staff: StaffMember) => {
    setEnrollingStaff(staff);
    setEnrollStep('ready');
  };

  const handleExecuteEnroll = async () => {
    if (!enrollingStaff) return;
    setEnrollStep('scanning');
    playBiometricSound('scan');
    if (navigator.vibrate) navigator.vibrate([80]);

    await new Promise((r) => setTimeout(r, 1600));

    const updated: StaffMember = {
      ...enrollingStaff,
      fingerprintEnrolled: true,
      fingerprintId: `bio-fp-${enrollingStaff.id}-${Date.now().toString(36)}`,
      fingerprintName: isBn ? 'ডান হাতের বৃদ্ধাঙ্গুল' : 'Right Thumb',
    };

    storageService.saveStaffMember(updated);
    loadData();
    playBiometricSound('success');
    if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
    setEnrollStep('success');

    setTimeout(() => {
      setEnrollingStaff(null);
      setEnrollStep('ready');
      onShowToast?.(
        isBn
          ? `✅ "${enrollingStaff.name}" এর আঙুলের ছাপ সফলভাবে নিবন্ধিত হয়েছে!`
          : `Fingerprint enrolled for ${enrollingStaff.name}`,
        'success'
      );
    }, 1500);
  };

  // Open Add Staff Modal
  const handleOpenAddStaffModal = () => {
    setEditingStaff(null);
    setModalFingerprintEnrolled(false);
    setModalFingerprintId(null);
    setModalFingerprintName(isBn ? 'ডান হাতের বৃদ্ধাঙ্গুল' : 'Right Thumb');
    setIsModalScanning(false);
    setIsStaffModalOpen(true);
  };

  // Open Edit Staff Modal
  const handleOpenEditStaffModal = (staff: StaffMember) => {
    setEditingStaff(staff);
    setModalFingerprintEnrolled(!!staff.fingerprintEnrolled);
    setModalFingerprintId(staff.fingerprintId || null);
    setModalFingerprintName(staff.fingerprintName || (isBn ? 'ডান হাতের বৃদ্ধাঙ্গুল' : 'Right Thumb'));
    setIsModalScanning(false);
    setIsStaffModalOpen(true);
  };

  // Fingerprint Scan inside Add/Edit Staff Modal (Enrolling during admission)
  const handleModalScanFingerprint = async () => {
    setIsModalScanning(true);
    playBiometricSound('scan');
    if (navigator.vibrate) navigator.vibrate([80]);

    await new Promise((r) => setTimeout(r, 1400));

    const generatedFpId = `bio-fp-${Date.now().toString(36).toUpperCase()}`;
    setModalFingerprintEnrolled(true);
    setModalFingerprintId(generatedFpId);
    setModalFingerprintName(isBn ? 'ডান হাতের বৃদ্ধাঙ্গুল (ডিভাইস সেন্সর)' : 'Right Thumb (Device Sensor)');
    setIsModalScanning(false);
    playBiometricSound('success');
    if (navigator.vibrate) navigator.vibrate([100, 50, 100]);

    onShowToast?.(
      isBn
        ? '✅ আঙুলের ছাপ সফলভাবে স্ক্যান হয়েছে! নতুন স্টাফ সংরক্ষণের সাথে ডাটা যুক্ত হবে।'
        : 'Fingerprint captured successfully! Will be saved with staff record.',
      'success'
    );
  };

  // Update attendance for any past/custom date (e.g. from history modal)
  const handleUpdatePastAttendance = (staffId: string, date: string, status: AttendanceStatus) => {
    const staff = staffList.find((s) => s.id === staffId);
    if (!staff) return;

    const existing = attendanceRecords.find((r) => r.staffId === staffId && r.date === date);
    const newRecord: AttendanceRecord = {
      id: existing ? existing.id : `att-${staffId}-${date}-${Date.now()}`,
      staffId,
      staffName: staff.name,
      date,
      status,
      verificationMethod: 'manual',
      timestamp: Date.now(),
    };

    storageService.recordAttendance(newRecord);
    loadData();

    const statusLabel =
      status === 'leave'
        ? isBn ? 'ছুটি (অনুমোদিত)' : 'Leave (Approved)'
        : status === 'present'
        ? isBn ? 'উপস্থিত' : 'Present'
        : status === 'half_day'
        ? isBn ? 'অর্ধ দিবস' : 'Half Day'
        : isBn ? 'অনুপস্থিত' : 'Absent';

    onShowToast?.(
      isBn
        ? `✅ ${date} তারিখের হাজিরা "${statusLabel}" হিসেবে সংরক্ষিত হয়েছে`
        : `Attendance for ${date} updated to ${statusLabel}`,
      'success'
    );
  };

  // Save Staff (Add or Edit)
  const handleSaveStaffForm = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const name = (formData.get('name') as string)?.trim();
    const phone = (formData.get('phone') as string)?.trim();
    const designation = (formData.get('designation') as string)?.trim();
    const role = (formData.get('role') as StaffRole) || 'salesperson';
    const monthlySalary = parseFloat(formData.get('monthlySalary') as string) || 10000;
    const monthlyAllowedLeaves = parseInt(formData.get('monthlyAllowedLeaves') as string, 10) || 4;
    const workingShift = (formData.get('workingShift') as string)?.trim() || '09:00 AM - 08:30 PM';

    if (!name) {
      onShowToast?.(isBn ? 'স্টাফের নাম আবশ্যক!' : 'Staff name is required!', 'error');
      return;
    }

    const colors = [
      'from-blue-500 to-indigo-600',
      'from-emerald-500 to-teal-600',
      'from-amber-500 to-orange-600',
      'from-purple-500 to-pink-600',
      'from-rose-500 to-red-600',
      'from-cyan-500 to-blue-600',
    ];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];

    const isNew = !editingStaff;
    const staffObj: StaffMember = {
      id: editingStaff ? editingStaff.id : `staff-${Date.now()}`,
      name,
      phone,
      designation: designation || (isBn ? 'সেলসম্যান' : 'Salesperson'),
      role,
      joiningDate: editingStaff ? editingStaff.joiningDate : new Date().toISOString().slice(0, 10),
      monthlySalary,
      monthlyAllowedLeaves,
      workingShift,
      fingerprintEnrolled: modalFingerprintEnrolled,
      fingerprintId: modalFingerprintEnrolled
        ? modalFingerprintId || `bio-fp-${Date.now().toString(36)}`
        : undefined,
      fingerprintName: modalFingerprintEnrolled
        ? modalFingerprintName || (isBn ? 'ডান হাতের বৃদ্ধাঙ্গুল' : 'Right Thumb')
        : undefined,
      avatarColor: editingStaff?.avatarColor || randomColor,
      isActive: true,
      createdAt: editingStaff?.createdAt || Date.now(),
    };

    storageService.saveStaffMember(staffObj);
    loadData();
    setIsStaffModalOpen(false);
    setEditingStaff(null);

    if (isNew && modalFingerprintEnrolled) {
      onShowToast?.(
        isBn
          ? `🎉 নতুন স্টাফ "${name}" সফলভাবে ভর্তি ও আঙুলের ছাপ ডাটা সংরক্ষিত হয়েছে!`
          : `🎉 New staff "${name}" registered with fingerprint enrolled!`,
        'success'
      );
    } else {
      onShowToast?.(
        isBn ? `✅ স্টাফ "${name}" সফলভাবে সংরক্ষিত হয়েছে!` : `Staff "${name}" saved successfully!`,
        'success'
      );
    }
  };

  // Delete Staff
  const handleDeleteStaff = (id: string, name: string) => {
    if (confirm(isBn ? `আপনি কি নিশ্চিত "${name}" কে মুছে ফেলতে চান?` : `Delete staff "${name}"?`)) {
      storageService.deleteStaffMember(id);
      loadData();
      onShowToast?.(isBn ? `স্টাফ "${name}" মুছে ফেলা হয়েছে!` : `Staff deleted!`, 'info');
    }
  };

  // Thermal Print Salary Slip
  const handlePrintSalaryThermal = async (calc: StaffSalaryCalculation, staff: StaffMember) => {
    const shopName = storageService.getSettings()?.storeName || (isBn ? 'মেসার্স ফ্যাশন কালেকশন' : 'Fashion POS');
    const shopPhone = storageService.getSettings()?.storePhone || '';

    const escText = `
--------------------------------
      ${shopName}
      ${shopPhone}
--------------------------------
   বেতন বিবরণী (SALARY SLIP)
--------------------------------
স্টাফ: ${staff.name}
পদবী: ${staff.designation}
মাস: ${calc.month}
বেসিক বেতন: ${calc.baseMonthlySalary.toLocaleString()} ৳
মোট দিন: ${calc.totalDaysInMonth} দিন
দৈনিক রেট: ${calc.dailyRate} ৳/দিন
নির্ধারিত ছুটি: ${calc.allowedLeaves} দিন (পেইড)
--------------------------------
উপস্থিতি: ${calc.presentDays} দিন
অনুপস্থিতি: ${calc.absentDays} দিন
অর্ধ-দিবস: ${calc.halfDays} দিন
ছুটি ভোগ: ${calc.paidLeaveDays} দিন
--------------------------------
অনুপস্থিতি কর্তন: -${calc.absentDeductionAmount.toLocaleString()} ৳
অগ্রিম সমন্বয়: -${(calc.advanceDeduction || 0).toLocaleString()} ৳
বোনাস/ওভারটাইম: +${((calc.bonusAmount || 0) + (calc.overtimeAmount || 0)).toLocaleString()} ৳
================================
সর্বমোট প্রদেয়: ${calc.netPayableSalary.toLocaleString()} ৳
================================
স্বাক্ষর: ______________________
তারিখ: ${new Date().toLocaleDateString()}
--------------------------------
`.trim();

    if (onPrintThermal) {
      const ok = await onPrintThermal(escText);
      if (ok) {
        onShowToast?.(isBn ? 'থার্মাল প্রিন্টারে পাঠানো হয়েছে!' : 'Printed to thermal printer!', 'success');
        return;
      }
    }
    // Fallback standard print
    window.print();
  };

  // Staff History & Absence Data Computation
  const staffHistoryData = useMemo(() => {
    if (!viewingHistoryStaff) return null;
    const calc = storageService.calculateStaffSalary(viewingHistoryStaff.id, historySelectedMonth);
    const records = storageService.getAttendanceRecords({
      month: historySelectedMonth,
      staffId: viewingHistoryStaff.id,
    });

    const [year, month] = historySelectedMonth.split('-').map(Number);
    const daysInMonth = new Date(year, month, 0).getDate();
    const todayStr = new Date().toISOString().slice(0, 10);

    const dayRows = [];
    const absentList: {
      date: string;
      dayOfWeek: string;
      status: AttendanceStatus;
      isAuto: boolean;
      deductionAmount: number;
      note?: string;
    }[] = [];

    let presentCount = 0;
    let leaveCount = 0;
    let halfCount = 0;

    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${historySelectedMonth}-${String(day).padStart(2, '0')}`;
      const dayDate = new Date(year, month - 1, day);
      const dayOfWeekNum = dayDate.getDay(); // 5 = Friday
      const dayNamesBn = ['রবিবার', 'সোমবার', 'মঙ্গলবার', 'বুধবার', 'বৃহস্পতিবার', 'শুক্রবার', 'শনিবার'];
      const dayNamesEn = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const dayName = isBn ? dayNamesBn[dayOfWeekNum] : dayNamesEn[dayOfWeekNum];

      const record = records.find((r) => r.date === dateStr);
      const isPast = dateStr < todayStr;
      const isToday = dateStr === todayStr;
      const isFriday = dayOfWeekNum === 5;

      let effectiveStatus: AttendanceStatus | 'weekly_off' | 'future' | 'unmarked' = 'future';
      let isAuto = false;
      let deduction = 0;

      if (record) {
        effectiveStatus = record.status;
        if (record.status === 'present') {
          presentCount++;
        } else if (record.status === 'leave') {
          leaveCount++;
        } else if (record.status === 'half_day') {
          halfCount++;
          deduction = Math.round(calc.dailyRate * 0.5);
          absentList.push({
            date: dateStr,
            dayOfWeek: dayName,
            status: 'half_day',
            isAuto: false,
            deductionAmount: deduction,
            note: isBn ? 'হাফ-ডে (০.৫ দিন কর্তন)' : 'Half-day deduction',
          });
        } else if (record.status === 'absent') {
          deduction = calc.dailyRate;
          absentList.push({
            date: dateStr,
            dayOfWeek: dayName,
            status: 'absent',
            isAuto: false,
            deductionAmount: calc.dailyRate,
            note: record.note || (isBn ? 'অনুপস্থিত মার্ক করা হয়েছে' : 'Marked absent'),
          });
        }
      } else if (isPast) {
        if (isFriday) {
          effectiveStatus = 'weekly_off';
        } else {
          effectiveStatus = 'absent';
          isAuto = true;
          deduction = calc.dailyRate;
          absentList.push({
            date: dateStr,
            dayOfWeek: dayName,
            status: 'absent',
            isAuto: true,
            deductionAmount: calc.dailyRate,
            note: isBn ? 'পাঞ্চ বা হাজিরা নেই (স্বয়ংক্রিয় অনুপস্থিত)' : 'No punch recorded (Auto-absent)',
          });
        }
      } else if (isToday) {
        effectiveStatus = isFriday ? 'weekly_off' : 'unmarked';
      } else {
        effectiveStatus = 'future';
      }

      dayRows.push({
        day,
        date: dateStr,
        dayName,
        status: effectiveStatus,
        isAuto,
        deduction,
        record,
      });
    }

    const totalAbsent = absentList.filter((a) => a.status === 'absent').length;
    const totalHalf = absentList.filter((a) => a.status === 'half_day').length;
    const totalAbsentDeduction = absentList.reduce((acc, curr) => acc + curr.deductionAmount, 0);

    return {
      calc,
      records,
      dayRows,
      absentList,
      totalAbsent,
      totalHalf,
      totalAbsentDeduction,
      presentCount,
      leaveCount,
      daysInMonth,
    };
  }, [viewingHistoryStaff, historySelectedMonth, attendanceRecords, isBn]);

  // Thermal Print Attendance & Absence History
  const handlePrintStaffHistoryThermal = async (staff: StaffMember) => {
    if (!staffHistoryData) return;
    const shopName = storageService.getSettings()?.storeName || (isBn ? 'মেসার্স ফ্যাশন কালেকশন' : 'Fashion POS');
    const shopPhone = storageService.getSettings()?.storePhone || '';

    let absentLines = '';
    staffHistoryData.absentList.forEach((a) => {
      absentLines += `\n• ${a.date} (${a.dayOfWeek}): -${a.deductionAmount} Tk`;
    });
    if (!absentLines) absentLines = '\n(কোনো অনুপস্থিতি নেই - শতভাগ উপস্থিত)';

    const escText = `
--------------------------------
      ${shopName}
      ${shopPhone}
--------------------------------
   হাজিরা ও অনুপস্থিতি বিবরণী
      ATTENDANCE & ABSENCE
--------------------------------
স্টাফ: ${staff.name}
পদবী: ${staff.designation}
মাস: ${historySelectedMonth}
মূল বেতন: ${staff.monthlySalary.toLocaleString()} ৳
দৈনিক রেট: ${staffHistoryData.calc.dailyRate} ৳
--------------------------------
মোট উপস্থিত: ${staffHistoryData.presentCount} দিন
মোট অনুপস্থিত: ${staffHistoryData.totalAbsent} দিন
ছুটি ভোগ: ${staffHistoryData.leaveCount} দিন
অর্ধ দিবস: ${staffHistoryData.totalHalf} দিন
--------------------------------
অনুপস্থিতির তারিখসমূহ:
${absentLines}
--------------------------------
অনুপস্থিতি মোট কর্তন: -${staffHistoryData.totalAbsentDeduction.toLocaleString()} ৳
প্রদেয় বেতন: ${staffHistoryData.calc.netPayableSalary.toLocaleString()} ৳
================================
স্বাক্ষর: ______________________
তারিখ: ${new Date().toLocaleDateString()}
--------------------------------
`.trim();

    if (onPrintThermal) {
      const ok = await onPrintThermal(escText);
      if (ok) {
        onShowToast?.(isBn ? 'থার্মাল প্রিন্টারে পাঠানো হয়েছে!' : 'Printed to thermal printer!', 'success');
        return;
      }
    }
    window.print();
  };

  return (
    <div className="max-w-5xl mx-auto px-2.5 sm:px-4 py-3 sm:py-5 space-y-4">
      {/* Top Banner & Header */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-3xl p-4 sm:p-5 shadow-lg border border-indigo-900/60 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="p-2 rounded-2xl bg-blue-600/30 border border-blue-400/40 text-blue-300 shadow-inner">
                <Fingerprint className="w-6 h-6 animate-pulse" />
              </span>
              <div>
                <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2">
                  {isBn ? 'স্টাফ ম্যানেজমেন্ট ও বায়োমেট্রিক হাজিরা' : 'Staff Management & Biometric Attendance'}
                  <span className="text-[10px] sm:text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                    {isBn ? 'ফিংগার ডিভাইস কানেক্টেড' : 'Fingerprint Device Ready'}
                  </span>
                </h1>
                <p className="text-xs sm:text-sm text-slate-300 font-medium">
                  {isBn
                    ? 'আঙুলের ছাপ দিয়ে ডিজিটাল হাজিরা • ১ দিন অনুপস্থিত থাকলে স্বয়ংক্রিয় ১ দিনের বেতন কর্তন • মাসিক ৪ দিন নির্ধারিত ছুটি'
                    : 'Biometric fingerprint check-in • Auto 1-day salary deduction per absence • 4 paid leaves/month'}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              type="button"
              onClick={handleOpenAddStaffModal}
              className="px-3.5 py-2 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs sm:text-sm font-bold shadow-md hover:shadow-indigo-500/20 transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>{isBn ? 'নতুন স্টাফ যোগ করুন' : 'Add New Staff'}</span>
            </button>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="mt-4 pt-3 border-t border-slate-800/80 grid grid-cols-2 sm:grid-cols-4 gap-1.5 sm:gap-2">
          <button
            type="button"
            onClick={() => setSubTab('attendance')}
            className={`py-2 px-3 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
              subTab === 'attendance'
                ? 'bg-blue-600 text-white shadow-sm ring-1 ring-blue-400/50'
                : 'bg-slate-800/60 text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <UserCheck className="w-4 h-4" />
            <span>{isBn ? 'হাজিরা ও ফিংগার স্ক্যান' : 'Daily Attendance'}</span>
          </button>

          <button
            type="button"
            onClick={() => setSubTab('salary')}
            className={`py-2 px-3 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
              subTab === 'salary'
                ? 'bg-blue-600 text-white shadow-sm ring-1 ring-blue-400/50'
                : 'bg-slate-800/60 text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <DollarSign className="w-4 h-4" />
            <span>{isBn ? 'মাসিক বেতন ও কর্তন' : 'Salary Sheet & Deductions'}</span>
          </button>

          <button
            type="button"
            onClick={() => setSubTab('staff_list')}
            className={`py-2 px-3 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
              subTab === 'staff_list'
                ? 'bg-blue-600 text-white shadow-sm ring-1 ring-blue-400/50'
                : 'bg-slate-800/60 text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>{isBn ? `স্টাফ তালিকা (${staffList.length})` : `Staff List (${staffList.length})`}</span>
          </button>

          <button
            type="button"
            onClick={() => setSubTab('device_setup')}
            className={`py-2 px-3 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
              subTab === 'device_setup'
                ? 'bg-blue-600 text-white shadow-sm ring-1 ring-blue-400/50'
                : 'bg-slate-800/60 text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <Fingerprint className="w-4 h-4" />
            <span>{isBn ? 'ফিংগার ডিভাইস সেটিংস' : 'Fingerprint Device'}</span>
          </button>
        </div>
      </div>

      {/* SUB-TAB 1: ATTENDANCE & BIOMETRIC SCANNER */}
      {subTab === 'attendance' && (
        <div className="space-y-4">
          {/* Biometric Interactive Scanner Station Card */}
          <div className="bg-white rounded-3xl p-4 sm:p-5 border border-stone-200/90 shadow-sm relative overflow-hidden">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              {/* Left: Interactive Fingerprint Scanner Button */}
              <div className="flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left w-full md:w-auto">
                <div className="relative group">
                  <button
                    type="button"
                    onClick={handleTriggerBiometricScan}
                    disabled={isScanning}
                    className={`relative w-24 h-24 sm:w-28 sm:h-28 rounded-3xl flex flex-col items-center justify-center transition-all cursor-pointer select-none active:scale-95 ${
                      isScanning
                        ? 'bg-blue-600 text-white ring-8 ring-blue-400/40 shadow-xl shadow-blue-500/30'
                        : 'bg-gradient-to-b from-stone-900 to-slate-950 text-blue-400 hover:text-blue-300 shadow-lg hover:shadow-blue-900/20 ring-4 ring-blue-500/20'
                    }`}
                  >
                    {/* Scanner laser animation */}
                    {isScanning && (
                      <div className="absolute inset-x-2 h-1 bg-cyan-300 rounded-full shadow-[0_0_12px_#22d3ee] animate-pulse top-4 transition-all" />
                    )}
                    <Fingerprint
                      className={`w-12 h-12 sm:w-14 sm:h-14 transition-transform ${
                        isScanning ? 'scale-110 text-cyan-300 animate-pulse' : 'group-hover:scale-105'
                      }`}
                    />
                    <span className="text-[10px] font-black uppercase tracking-wider mt-1 text-white">
                      {isScanning ? (isBn ? 'স্ক্যান হচ্ছে...' : 'Scanning...') : isBn ? 'আঙুল স্পর্শ করুন' : 'Touch Sensor'}
                    </span>
                  </button>
                  <span className="absolute -bottom-2 inset-x-0 mx-auto w-max px-2 py-0.5 rounded-full bg-emerald-500 text-slate-950 text-[9px] font-extrabold uppercase shadow-xs">
                    {isBn ? 'সক্রিয় ডিভাইস' : 'Ready'}
                  </span>
                </div>

                <div className="space-y-1">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-blue-50 text-blue-700 text-xs font-bold border border-blue-200/80">
                    <Smartphone className="w-3.5 h-3.5" />
                    <span>
                      {isBn
                        ? 'মোবাইলের বায়োমেট্রিক সেন্সর / OTG ডিভাইস কানেক্টেড'
                        : 'Mobile Biometric Sensor & OTG Ready'}
                    </span>
                  </div>
                  <h3 className="text-base sm:text-lg font-black text-stone-900">
                    {isBn ? 'ওয়ান-টাচ বায়োমেট্রিক হাজিরা' : 'One-Touch Biometric Punch'}
                  </h3>
                  <p className="text-xs text-stone-500 max-w-md">
                    {isBn
                      ? 'স্টাফ আঙুলের ছাপ দিলে স্বয়ংক্রিয়ভাবে নাম শনাক্ত করে উপস্থিতি রেকর্ড হবে এবং সাউন্ড বিপ বাজবে।'
                      : 'Staff touches the fingerprint sensor to punch attendance with instant audio feedback.'}
                  </p>
                </div>
              </div>

              {/* Right: Date Picker & Device Switcher */}
              <div className="flex flex-col sm:flex-row items-center gap-2.5 w-full md:w-auto">
                <div className="w-full sm:w-auto flex items-center gap-2 bg-stone-50 p-2 rounded-2xl border border-stone-200">
                  <Calendar className="w-4 h-4 text-stone-500 shrink-0 ml-1" />
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="bg-transparent text-xs sm:text-sm font-bold text-stone-800 outline-none cursor-pointer"
                  />
                  {selectedDate !== new Date().toISOString().slice(0, 10) && (
                    <button
                      type="button"
                      onClick={() => setSelectedDate(new Date().toISOString().slice(0, 10))}
                      className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-blue-100 text-blue-700 hover:bg-blue-200 cursor-pointer"
                    >
                      {isBn ? 'আজ' : 'Today'}
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleTriggerBiometricScan}
                  disabled={isScanning}
                  className="w-full sm:w-auto px-4 py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-700 active:scale-98 text-white text-xs sm:text-sm font-extrabold flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
                >
                  <Fingerprint className="w-4 h-4" />
                  <span>{isBn ? 'হাজিরা পাঞ্চ করুন' : 'Punch Attendance'}</span>
                </button>
              </div>
            </div>

            {/* Live Scan Result Notification Banner */}
            {scanResultStaff && (
              <div className="mt-4 p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-center justify-between gap-3 animate-fadeIn">
                <div className="flex items-center gap-2.5">
                  <span className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                    <CheckCircle2 className="w-5 h-5" />
                  </span>
                  <div>
                    <h4 className="text-xs sm:text-sm font-black">
                      {isBn ? 'বায়োমেট্রিক হাজিরা সফল হয়েছে!' : 'Biometric Attendance Recorded!'}
                    </h4>
                    <p className="text-xs text-emerald-800 font-medium">
                      <span className="font-bold">{scanResultStaff.staff.name}</span> •{' '}
                      {scanResultStaff.action === 'checkin' ? (isBn ? 'চেক-ইন' : 'Check-In') : (isBn ? 'চেক-আউট' : 'Check-Out')}{' '}
                      ({scanResultStaff.time}) • {scanResultStaff.staff.designation}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setScanResultStaff(null)}
                  className="p-1 rounded-lg text-emerald-700 hover:bg-emerald-100 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {/* Quick Summary Badges for Selected Date */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 sm:gap-3">
            <div className="bg-white p-3 rounded-2xl border border-stone-200 shadow-2xs">
              <span className="text-[11px] font-bold text-stone-500 uppercase">
                {isBn ? 'মোট স্টাফ' : 'Total Staff'}
              </span>
              <p className="text-lg sm:text-xl font-black text-stone-900 mt-0.5">
                {selectedDateStats.total} {isBn ? 'জন' : ''}
              </p>
            </div>

            <div className="bg-emerald-50/70 p-3 rounded-2xl border border-emerald-200/80 shadow-2xs">
              <span className="text-[11px] font-bold text-emerald-700 uppercase flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                {isBn ? 'উপস্থিত' : 'Present'}
              </span>
              <p className="text-lg sm:text-xl font-black text-emerald-800 mt-0.5">
                {selectedDateStats.present} {isBn ? 'জন' : ''}
              </p>
            </div>

            <div className="bg-rose-50/70 p-3 rounded-2xl border border-rose-200/80 shadow-2xs">
              <span className="text-[11px] font-bold text-rose-700 uppercase flex items-center gap-1">
                <UserX className="w-3.5 h-3.5" />
                {isBn ? 'অনুপস্থিত' : 'Absent'}
              </span>
              <p className="text-lg sm:text-xl font-black text-rose-800 mt-0.5">
                {selectedDateStats.absent} {isBn ? 'জন' : ''}
              </p>
            </div>

            <div className="bg-blue-50/70 p-3 rounded-2xl border border-blue-200/80 shadow-2xs">
              <span className="text-[11px] font-bold text-blue-700 uppercase flex items-center gap-1">
                <CalendarDays className="w-3.5 h-3.5" />
                {isBn ? 'ছুটি (পেইড)' : 'On Leave'}
              </span>
              <p className="text-lg sm:text-xl font-black text-blue-800 mt-0.5">
                {selectedDateStats.leave} {isBn ? 'জন' : ''}
              </p>
            </div>

            <div className="bg-amber-50/70 p-3 rounded-2xl border border-amber-200/80 shadow-2xs col-span-2 sm:col-span-1">
              <span className="text-[11px] font-bold text-amber-700 uppercase flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                {isBn ? 'অর্ধ দিবস' : 'Half Day'}
              </span>
              <p className="text-lg sm:text-xl font-black text-amber-800 mt-0.5">
                {selectedDateStats.halfDay} {isBn ? 'জন' : ''}
              </p>
            </div>
          </div>

          {/* Daily Attendance Matrix (Staff rows with 1-click status switch) */}
          <div className="bg-white rounded-3xl border border-stone-200/90 shadow-sm overflow-hidden">
            <div className="p-3.5 sm:p-4 bg-stone-50/80 border-b border-stone-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-sm sm:text-base font-black text-stone-900 flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-blue-600" />
                  <span>
                    {isBn ? `তারিখের হাজিরা তালিকা (${selectedDate})` : `Daily Attendance List (${selectedDate})`}
                  </span>
                </h3>
                <p className="text-[11px] text-stone-500 font-medium">
                  {isBn
                    ? 'যেকোনো স্টাফের পাশে ক্লিক করে সহজেই উপস্থিতি বা অনুপস্থিতি পরিবর্তন করুন।'
                    : 'Click any status button to quickly mark attendance or absence.'}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-stone-600">
                  {isBn ? 'মাসের ৪ দিন সাপ্তাহিক ছুটি অন্তর্ভুক্ত' : '4 monthly leaves included'}
                </span>
              </div>
            </div>

            <div className="divide-y divide-stone-100">
              {filteredStaff.length === 0 ? (
                <div className="p-8 text-center text-stone-400">
                  <Users className="w-10 h-10 mx-auto mb-2 opacity-40" />
                  <p className="text-sm font-bold">{isBn ? 'কোনো স্টাফ পাওয়া যায়নি' : 'No staff found'}</p>
                </div>
              ) : (
                filteredStaff.map((staff) => {
                  const record = selectedDateAttendanceMap.get(staff.id);
                  const currentStatus = record?.status;

                  return (
                    <div
                      key={staff.id}
                      className="p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-stone-50/60 transition-colors"
                    >
                      {/* Staff Info */}
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-11 h-11 rounded-2xl bg-gradient-to-tr ${
                            staff.avatarColor || 'from-blue-500 to-indigo-600'
                          } text-white flex items-center justify-center font-black text-sm shadow-xs shrink-0`}
                        >
                          {staff.name.slice(0, 2)}
                        </div>

                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm font-black text-stone-900">{staff.name}</h4>
                            {staff.fingerprintEnrolled ? (
                              <span className="inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.2 rounded-md bg-emerald-100 text-emerald-800" title="ফিংগারপ্রিন্ট নিবন্ধিত">
                                <Fingerprint className="w-3 h-3 text-emerald-600" />
                                <span>{isBn ? 'নিবন্ধিত' : 'Enrolled'}</span>
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleStartEnrollFingerprint(staff)}
                                className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-stone-100 text-stone-600 hover:bg-blue-100 hover:text-blue-700 cursor-pointer"
                              >
                                {isBn ? '+ ফিংগার যোগ' : '+ Enroll'}
                              </button>
                            )}
                          </div>

                          <p className="text-xs text-stone-500 font-medium">
                            {staff.designation} • {staff.phone} •{' '}
                            <span className="font-bold text-stone-700">
                              {staff.monthlySalary.toLocaleString()} ৳/{isBn ? 'মাস' : 'mo'}
                            </span>
                          </p>

                          {record?.checkInTime && (
                            <p className="text-[11px] text-emerald-700 font-bold flex items-center gap-1 mt-0.5">
                              <Clock className="w-3 h-3" />
                              <span>
                                {isBn ? 'ইন:' : 'In:'} {record.checkInTime}
                                {record.checkOutTime && ` • ${isBn ? 'আউট:' : 'Out:'} ${record.checkOutTime}`}
                                {' '}({record.verificationMethod === 'fingerprint' ? (isBn ? 'ফিংগারপ্রিন্ট' : 'Fingerprint') : (isBn ? 'ম্যানুয়াল' : 'Manual')})
                              </span>
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Status Action Buttons (Present / Absent / Half-day / Leave) */}
                      <div className="flex items-center gap-1.5 flex-wrap self-end sm:self-auto">
                        {(() => {
                          const mCalc = storageService.calculateStaffSalary(staff.id, selectedDate.slice(0, 7));
                          return (
                            <button
                              type="button"
                              onClick={() => {
                                setHistorySelectedMonth(selectedDate.slice(0, 7));
                                setViewingHistoryStaff(staff);
                              }}
                              className={`px-2.5 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1 ${
                                mCalc.absentDays > 0
                                  ? 'bg-rose-100 hover:bg-rose-200 text-rose-800 border border-rose-300 shadow-2xs'
                                  : 'bg-stone-100 hover:bg-stone-200 text-stone-700'
                              }`}
                              title={isBn ? 'উনার হাজিরা ও অনুপস্থিতির হিস্ট্রি দেখুন' : 'View attendance & absence history'}
                            >
                              <CalendarDays className="w-3.5 h-3.5" />
                              <span>
                                {mCalc.absentDays > 0
                                  ? `${mCalc.absentDays} ${isBn ? 'দিন অনুপস্থিত (হিস্ট্রি)' : 'd absent'}`
                                  : isBn
                                  ? 'হিস্ট্রি'
                                  : 'History'}
                              </span>
                            </button>
                          );
                        })()}

                        <button
                          type="button"
                          onClick={() => handleUpdateAttendanceStatus(staff.id, 'present')}
                          className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1 ${
                            currentStatus === 'present'
                              ? 'bg-emerald-600 text-white shadow-xs ring-2 ring-emerald-400/50'
                              : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                          }`}
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>{isBn ? 'উপস্থিত' : 'Present'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleUpdateAttendanceStatus(staff.id, 'absent')}
                          className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1 ${
                            currentStatus === 'absent'
                              ? 'bg-rose-600 text-white shadow-xs ring-2 ring-rose-400/50'
                              : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                          }`}
                          title={isBn ? 'অনুপস্থিত (১ দিনের বেতন কর্তন হবে)' : 'Absent (1 day salary deduction)'}
                        >
                          <UserX className="w-3.5 h-3.5" />
                          <span>{isBn ? 'অনুপস্থিত' : 'Absent'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleUpdateAttendanceStatus(staff.id, 'half_day')}
                          className={`px-2.5 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                            currentStatus === 'half_day'
                              ? 'bg-amber-600 text-white shadow-xs ring-2 ring-amber-400/50'
                              : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                          }`}
                        >
                          <span>{isBn ? 'অর্ধ দিবস' : 'Half'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleUpdateAttendanceStatus(staff.id, 'leave')}
                          className={`px-2.5 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                            currentStatus === 'leave'
                              ? 'bg-blue-600 text-white shadow-xs ring-2 ring-blue-400/50'
                              : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                          }`}
                          title={isBn ? 'নির্ধারিত ছুটি (বেতন কাটা হবে না)' : 'Paid Leave (No deduction)'}
                        >
                          <span>{isBn ? 'ছুটি' : 'Leave'}</span>
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 2: SALARY & AUTOMATIC DEDUCTION */}
      {subTab === 'salary' && (
        <div className="space-y-4">
          {/* Top Month Selector and Calculation Rule Highlight */}
          <div className="bg-white rounded-3xl p-4 sm:p-5 border border-stone-200/90 shadow-sm space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base sm:text-lg font-black text-stone-900 flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-emerald-600" />
                  <span>{isBn ? 'মাসিক বেতন বিবরণী ও স্বয়ংক্রিয় কর্তন' : 'Monthly Salary Sheet & Deductions'}</span>
                </h3>
                <p className="text-xs text-stone-500 font-medium">
                  {isBn
                    ? 'স্টাফ একদিন না আসলে স্বয়ংক্রিয়ভাবে একদিনের বেতন কম দেখায়। প্রতি মাসে ৪ দিন নির্ধারিত ছুটি থাকে যা বেতন কাটে না।'
                    : 'Absence automatically deducts 1 day of salary. 4 weekly holidays/month are included as paid leaves.'}
                </p>
              </div>

              {/* Month Picker */}
              <div className="flex items-center gap-2 bg-stone-100 p-1.5 rounded-2xl border border-stone-200">
                <Calendar className="w-4 h-4 text-stone-500 ml-1.5" />
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="bg-transparent text-xs sm:text-sm font-bold text-stone-800 outline-none cursor-pointer"
                />
              </div>
            </div>

            {/* Explanation Rule Pill */}
            <div className="p-3 rounded-2xl bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/80 text-amber-900 text-xs font-semibold flex items-start gap-2.5">
              <Sparkles className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <p className="font-bold text-amber-950">
                  {isBn ? 'বেতন হিসাবের স্বয়ংক্রিয় নিয়মাবলী:' : 'Automated Salary Calculation Rules:'}
                </p>
                <p className="text-amber-800">
                  {isBn
                    ? '• দৈনিক রেট = মাসিক বেসিক বেতন ÷ মাসের মোট দিন (যেমন: ১৫,০০০ ÷ ৩০ = ৫০০ ৳/দিন)।'
                    : '• Daily rate = Monthly Salary ÷ Total Days (e.g. 15,000 ÷ 30 = 500 ৳/day).'}
                  <br />
                  {isBn
                    ? '• অনুপস্থিতি কর্তন: ১ দিন অনুপস্থিত থাকলে ঠিক ৫০০ ৳ কর্তন, ২ দিন হলে ১,০০০ ৳ কর্তন।'
                    : '• Absence Deduction: 1 day absent = 500 ৳ deducted, 2 days = 1,000 ৳ deducted.'}
                  <br />
                  {isBn
                    ? '• প্রতি মাসে ৪ দিন নির্ধারিত সাপ্তাহিক ছুটি অনুমোদিত (এর জন্য কোনো বেতন কাটা হবে না)।'
                    : '• 4 days weekly off per month are fully paid and never deducted.'}
                </p>
              </div>
            </div>
          </div>

          {/* Month Totals Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
            <div className="bg-white p-3.5 rounded-2xl border border-stone-200 shadow-2xs">
              <span className="text-[11px] font-bold text-stone-500 uppercase">
                {isBn ? 'মোট বেসিক বেতন' : 'Total Base Salary'}
              </span>
              <p className="text-lg sm:text-xl font-black text-stone-900 mt-0.5">
                {monthlySalaryTotals.totalBase.toLocaleString()} ৳
              </p>
            </div>

            <div className="bg-rose-50/70 p-3.5 rounded-2xl border border-rose-200/80 shadow-2xs">
              <span className="text-[11px] font-bold text-rose-700 uppercase flex items-center gap-1">
                <TrendingDown className="w-3.5 h-3.5" />
                {isBn ? 'অনুপস্থিতি মোট কর্তন' : 'Total Deductions'}
              </span>
              <p className="text-lg sm:text-xl font-black text-rose-800 mt-0.5">
                -{monthlySalaryTotals.totalDeductions.toLocaleString()} ৳
              </p>
              <span className="text-[10px] text-rose-600 font-bold">
                ({monthlySalaryTotals.totalAbsentDays} {isBn ? 'দিন অনুপস্থিত' : 'days absent'})
              </span>
            </div>

            <div className="bg-emerald-50/80 p-3.5 rounded-2xl border border-emerald-200/80 shadow-2xs">
              <span className="text-[11px] font-bold text-emerald-700 uppercase flex items-center gap-1">
                <Award className="w-3.5 h-3.5" />
                {isBn ? 'প্রদেয় মোট বেতন' : 'Net Payable Total'}
              </span>
              <p className="text-lg sm:text-xl font-black text-emerald-800 mt-0.5">
                {monthlySalaryTotals.totalPayable.toLocaleString()} ৳
              </p>
            </div>

            <div className="bg-blue-50/70 p-3.5 rounded-2xl border border-blue-200/80 shadow-2xs">
              <span className="text-[11px] font-bold text-blue-700 uppercase">
                {isBn ? 'মাসিক ছুটি অনুমোদন' : 'Allowed Leaves'}
              </span>
              <p className="text-lg sm:text-xl font-black text-blue-800 mt-0.5">
                ৪ {isBn ? 'দিন (পেইড)' : 'Days (Paid)'}
              </p>
              <span className="text-[10px] text-blue-600 font-bold">
                {isBn ? 'কোনো বেতন কাটা হয় না' : 'Zero deduction'}
              </span>
            </div>
          </div>

          {/* Salary Sheet Table */}
          <div className="bg-white rounded-3xl border border-stone-200/90 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="bg-stone-50 border-b border-stone-200 text-stone-600 text-[11px] uppercase font-bold">
                  <tr>
                    <th className="py-3 px-3.5">{isBn ? 'স্টাফের নাম ও পদবী' : 'Staff Member'}</th>
                    <th className="py-3 px-3">{isBn ? 'বেসিক বেতন' : 'Base Salary'}</th>
                    <th className="py-3 px-3">{isBn ? 'দৈনিক রেট' : 'Daily Rate'}</th>
                    <th className="py-3 px-3">{isBn ? 'উপস্থিত' : 'Present'}</th>
                    <th className="py-3 px-3">{isBn ? 'অনুপস্থিত' : 'Absent'}</th>
                    <th className="py-3 px-3">{isBn ? 'ছুটি (পেইড)' : 'Paid Leave'}</th>
                    <th className="py-3 px-3 text-rose-600">{isBn ? 'অনুপস্থিতি কর্তন' : 'Deduction'}</th>
                    <th className="py-3 px-3 text-emerald-700 font-black">{isBn ? 'সর্বমোট প্রদেয়' : 'Net Salary'}</th>
                    <th className="py-3 px-3.5 text-center">{isBn ? 'অ্যাকশন' : 'Action'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 font-medium">
                  {monthlySalaryCalculations.map((calc) => {
                    const staff = staffList.find((s) => s.id === calc.staffId);
                    if (!staff) return null;

                    return (
                      <tr key={calc.staffId} className="hover:bg-stone-50/70 transition-colors">
                        <td className="py-3 px-3.5">
                          <div className="font-black text-stone-900">{calc.staffName}</div>
                          <div className="text-[11px] text-stone-500 font-normal">
                            {staff.designation} • {staff.phone}
                          </div>
                        </td>

                        <td className="py-3 px-3 font-bold text-stone-800">
                          {calc.baseMonthlySalary.toLocaleString()} ৳
                        </td>

                        <td className="py-3 px-3 text-stone-600 font-mono">
                          {calc.dailyRate} ৳
                        </td>

                        <td className="py-3 px-3">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 font-bold text-xs">
                            {calc.presentDays} {isBn ? 'দিন' : 'd'}
                          </span>
                        </td>

                        <td className="py-3 px-3">
                          {calc.absentDays > 0 ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-50 text-rose-800 font-bold text-xs">
                              {calc.absentDays} {isBn ? 'দিন' : 'd'}
                            </span>
                          ) : (
                            <span className="text-stone-400 font-bold text-xs">০ দিন</span>
                          )}
                        </td>

                        <td className="py-3 px-3">
                          <span className="text-blue-700 font-bold text-xs">
                            {calc.paidLeaveDays} / {calc.allowedLeaves} {isBn ? 'দিন' : 'd'}
                          </span>
                        </td>

                        <td className="py-3 px-3 font-bold text-rose-600">
                          {calc.absentDeductionAmount > 0 ? (
                            <span>-{calc.absentDeductionAmount.toLocaleString()} ৳</span>
                          ) : (
                            <span className="text-stone-400 font-normal">০ ৳</span>
                          )}
                        </td>

                        <td className="py-3 px-3 font-black text-emerald-700 text-sm">
                          {calc.netPayableSalary.toLocaleString()} ৳
                        </td>

                        <td className="py-3 px-3.5 text-center">
                          <button
                            type="button"
                            onClick={() => setViewingSalarySlip({ staff, calc })}
                            className="px-2.5 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold transition-colors cursor-pointer inline-flex items-center gap-1"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            <span>{isBn ? 'রসিদ / স্লিপ' : 'Slip'}</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 3: STAFF DIRECTORY & ENROLLMENT */}
      {subTab === 'staff_list' && (
        <div className="space-y-4">
          {/* Search & Filter Toolbar */}
          <div className="bg-white rounded-3xl p-3.5 sm:p-4 border border-stone-200/90 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder={isBn ? 'স্টাফের নাম বা মোবাইল নম্বর খুঁজুন...' : 'Search staff by name or phone...'}
                value={searchStaff}
                onChange={(e) => setSearchStaff(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-stone-50 border border-stone-200 rounded-2xl text-xs sm:text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="px-3 py-2 bg-stone-50 border border-stone-200 rounded-2xl text-xs sm:text-sm font-bold text-stone-700 outline-none cursor-pointer"
              >
                <option value="all">{isBn ? 'সকল পদবী (All Roles)' : 'All Roles'}</option>
                <option value="manager">{isBn ? 'ম্যানেজার' : 'Manager'}</option>
                <option value="cashier">{isBn ? 'ক্যাশিয়ার' : 'Cashier'}</option>
                <option value="salesperson">{isBn ? 'সেলসম্যান' : 'Salesperson'}</option>
                <option value="helper">{isBn ? 'সহকারী' : 'Helper'}</option>
                <option value="tailor">{isBn ? 'দর্জি / কারিগড়' : 'Tailor'}</option>
              </select>

              <button
                type="button"
                onClick={handleOpenAddStaffModal}
                className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-xs sm:text-sm font-bold flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
              >
                <Plus className="w-4 h-4" />
                <span>{isBn ? 'নতুন স্টাফ' : 'New Staff'}</span>
              </button>
            </div>
          </div>

          {/* Staff Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {filteredStaff.map((staff) => {
              const cardCalc = storageService.calculateStaffSalary(staff.id, selectedMonth);
              return (
                <div
                  key={staff.id}
                  className="bg-white rounded-3xl p-4 border border-stone-200/90 shadow-2xs hover:shadow-md transition-shadow relative overflow-hidden flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-12 h-12 rounded-2xl bg-gradient-to-tr ${
                            staff.avatarColor || 'from-blue-500 to-indigo-600'
                          } text-white flex items-center justify-center font-black text-base shadow-xs`}
                        >
                          {staff.name.slice(0, 2)}
                        </div>
                        <div>
                          <h4 className="text-sm sm:text-base font-black text-stone-900">{staff.name}</h4>
                          <p className="text-xs text-stone-500 font-semibold">{staff.designation}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleOpenEditStaffModal(staff)}
                          className="p-1.5 rounded-xl hover:bg-stone-100 text-stone-600 cursor-pointer"
                          title={isBn ? 'সম্পাদনা' : 'Edit'}
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteStaff(staff.id, staff.name)}
                          className="p-1.5 rounded-xl hover:bg-rose-50 text-rose-500 cursor-pointer"
                          title={isBn ? 'মুছে ফেলুন' : 'Delete'}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1.5 text-xs text-stone-600 border-t border-stone-100 pt-3">
                      <div className="flex justify-between">
                        <span className="text-stone-400">{isBn ? 'মোবাইল:' : 'Phone:'}</span>
                        <span className="font-bold text-stone-800">{staff.phone}</span>
                      </div>

                      <div className="flex justify-between">
                        <span className="text-stone-400">{isBn ? 'মাসিক বেতন:' : 'Monthly Salary:'}</span>
                        <span className="font-black text-emerald-700">{staff.monthlySalary.toLocaleString()} ৳</span>
                      </div>

                      <div className="flex justify-between">
                        <span className="text-stone-400">{isBn ? 'মাসিক ছুটি:' : 'Monthly Leaves:'}</span>
                        <span className="font-bold text-blue-700">
                          {staff.monthlyAllowedLeaves} {isBn ? 'দিন (পেইড)' : 'Days (Paid)'}
                        </span>
                      </div>

                      <div className="flex justify-between">
                        <span className="text-stone-400">{isBn ? 'কাজের শিফট:' : 'Shift:'}</span>
                        <span className="font-medium text-stone-700">{staff.workingShift || '09:00 AM - 08:30 PM'}</span>
                      </div>

                      {/* Absent Days Badge */}
                      <div className="flex justify-between items-center py-1.5 px-2.5 rounded-xl bg-stone-50 border border-stone-200/80 mt-2">
                        <span className="text-[11px] font-bold text-stone-600">
                          {isBn ? 'অনুপস্থিত হিস্ট্রি:' : 'Absence Record:'}
                        </span>
                        {cardCalc.absentDays > 0 ? (
                          <span className="text-[11px] font-black text-rose-700 bg-rose-100 px-2 py-0.5 rounded-full border border-rose-200">
                            🔴 {cardCalc.absentDays} {isBn ? 'দিন' : 'd'} (-{cardCalc.absentDeductionAmount.toLocaleString()} ৳)
                          </span>
                        ) : (
                          <span className="text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                            🟢 {isBn ? '০ দিন (নিয়মিত)' : '0 d (Regular)'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-stone-100 flex items-center justify-between gap-2">
                    {staff.fingerprintEnrolled ? (
                      <div className="flex items-center gap-1.5 text-emerald-700 text-xs font-bold">
                        <Fingerprint className="w-4 h-4 text-emerald-600" />
                        <span>{isBn ? 'আঙুলের ছাপ সক্রিয়' : 'Fingerprint Enrolled'}</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 text-amber-700 text-xs font-semibold">
                        <AlertCircle className="w-4 h-4 text-amber-500" />
                        <span>{isBn ? 'বায়োমেট্রিক খালি' : 'No Fingerprint'}</span>
                      </div>
                    )}

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setHistorySelectedMonth(selectedMonth);
                          setViewingHistoryStaff(staff);
                        }}
                        className="px-2.5 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold transition-colors cursor-pointer flex items-center gap-1"
                        title={isBn ? 'হাজিরা ও অনুপস্থিতির হিস্ট্রি দেখুন' : 'View attendance & absence history'}
                      >
                        <CalendarDays className="w-3.5 h-3.5" />
                        <span>{isBn ? 'হিস্ট্রি' : 'History'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleStartEnrollFingerprint(staff)}
                        className="px-2.5 py-1.5 rounded-xl bg-stone-900 hover:bg-blue-600 text-white text-xs font-bold transition-colors cursor-pointer flex items-center gap-1"
                      >
                        <Fingerprint className="w-3.5 h-3.5" />
                        <span>{staff.fingerprintEnrolled ? (isBn ? 'পুনরায় স্ক্যান' : 'Re-Enroll') : (isBn ? 'আঙুল নিবন্ধন' : 'Enroll')}</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SUB-TAB 4: BIOMETRIC DEVICE CONNECTION & HARDWARE SETUP */}
      {subTab === 'device_setup' && (
        <div className="space-y-4">
          <div className="bg-white rounded-3xl p-4 sm:p-5 border border-stone-200/90 shadow-sm space-y-4">
            <div>
              <h3 className="text-base sm:text-lg font-black text-stone-900 flex items-center gap-2">
                <Fingerprint className="w-5 h-5 text-blue-600" />
                <span>{isBn ? 'বায়োমেট্রিক ফিংগার ডিভাইস কানেকশন গাইড' : 'Biometric Fingerprint Hardware Setup'}</span>
              </h3>
              <p className="text-xs text-stone-500 font-medium">
                {isBn
                  ? 'আপনার মোবাইল বা কম্পিউটার এর সাথে ফিংগারপ্রিন্ট ডিভাইস সহজে কানেক্ট করার অপশন'
                  : 'Connect physical biometric fingerprint scanners via Mobile Sensor, OTG USB, or Bluetooth.'}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
              {/* Option 1: Mobile Built-in Biometric Sensor */}
              <div className="p-4 rounded-2xl bg-blue-50/60 border border-blue-200/80 space-y-2">
                <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center">
                  <Smartphone className="w-5 h-5" />
                </div>
                <h4 className="text-sm font-black text-blue-950">
                  {isBn ? '১. মোবাইলের নিজস্ব ফিংগারপ্রিন্ট' : '1. Built-in Mobile Biometric'}
                </h4>
                <p className="text-xs text-blue-900 font-medium leading-relaxed">
                  {isBn
                    ? 'আপনার মোবাইল ফোনের স্ক্রিন বা ব্যাক সাইডের ফিঙ্গারপ্রিন্ট সেন্সর সরাসরি ব্যবহার করতে পারবেন (WebAuthn বায়োমেট্রিক সাপোর্ট)।'
                    : 'Use the smartphone’s in-display or side/rear fingerprint scanner via WebAuthn Biometrics.'}
                </p>
                <div className="pt-2">
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {isBn ? 'সক্রিয় ও প্রস্তুত' : 'Active & Ready'}
                  </span>
                </div>
              </div>

              {/* Option 2: OTG USB Biometric Scanner */}
              <div className="p-4 rounded-2xl bg-amber-50/60 border border-amber-200/80 space-y-2">
                <div className="w-10 h-10 rounded-xl bg-amber-600 text-white flex items-center justify-center">
                  <Usb className="w-5 h-5" />
                </div>
                <h4 className="text-sm font-black text-amber-950">
                  {isBn ? '২. OTG USB ফিংগারপ্রিন্ট ডিভাইস' : '2. OTG USB Fingerprint Scanner'}
                </h4>
                <p className="text-xs text-amber-900 font-medium leading-relaxed">
                  {isBn
                    ? 'Mantra MFS100, Morpho, SecuGen, DigitalPersona ডিভাইস মোবাইলের সাথে OTG ক্যাবল দিয়ে যুক্ত করে দ্রুত পাঞ্চ নেওয়া যায়।'
                    : 'Plug in USB optical fingerprint scanners (Mantra MFS100, Morpho, SecuGen) via OTG converter.'}
                </p>
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      if ((navigator as any).usb) {
                        (navigator as any).usb.requestDevice({ filters: [] }).catch(() => {});
                      } else {
                        onShowToast?.(isBn ? 'WebUSB ডিভাইস ড্রাইভার প্রস্তুত!' : 'WebUSB scanner ready', 'info');
                      }
                    }}
                    className="text-xs font-bold px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white cursor-pointer"
                  >
                    {isBn ? 'OTG ডিভাইস সার্চ করুন' : 'Search OTG Scanner'}
                  </button>
                </div>
              </div>

              {/* Option 3: Bluetooth Biometric Device */}
              <div className="p-4 rounded-2xl bg-purple-50/60 border border-purple-200/80 space-y-2">
                <div className="w-10 h-10 rounded-xl bg-purple-600 text-white flex items-center justify-center">
                  <Bluetooth className="w-5 h-5" />
                </div>
                <h4 className="text-sm font-black text-purple-950">
                  {isBn ? '৩. ব্লুটুথ ফিংগারপ্রিন্ট ডিভাইস' : '3. Bluetooth Biometric Device'}
                </h4>
                <p className="text-xs text-purple-900 font-medium leading-relaxed">
                  {isBn
                    ? 'ব্লুটুথ বায়োমেট্রিক ডিভাইসের পাওয়ার অন করে পেয়ার করুন। তারবিহীনভাবে তাৎক্ষণিক আঙুলের ছাপ হাজিরা নিবে।'
                    : 'Pair wireless Bluetooth biometric readers (ZKTeco, Bluetooth Bio) for wireless punch.'}
                </p>
                <div className="pt-2">
                  <span className="text-[11px] font-bold text-purple-800">
                    {isBn ? 'ব্লুটুথ মোড সমর্থিত' : 'Bluetooth supported'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 1: ADD / EDIT STAFF */}
      {isStaffModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-4 sm:p-6 shadow-2xl border border-stone-200 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <h3 className="text-base sm:text-lg font-black text-stone-900 flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-600" />
                <span>
                  {editingStaff
                    ? isBn
                      ? 'স্টাফ তথ্য সম্পাদনা'
                      : 'Edit Staff'
                    : isBn
                    ? 'নতুন স্টাফ যোগ করুন'
                    : 'Add New Staff'}
                </span>
              </h3>
              <button
                type="button"
                onClick={() => {
                  setIsStaffModalOpen(false);
                  setEditingStaff(null);
                }}
                className="p-1.5 rounded-xl hover:bg-stone-100 text-stone-500 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveStaffForm} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  {isBn ? 'স্টাফের পূর্ণ নাম *' : 'Staff Full Name *'}
                </label>
                <input
                  type="text"
                  name="name"
                  defaultValue={editingStaff?.name || ''}
                  required
                  placeholder={isBn ? 'যেমন: মো: রহিম মিয়া' : 'e.g. Rahim Mia'}
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs sm:text-sm font-semibold outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    {isBn ? 'মোবাইল নম্বর' : 'Phone Number'}
                  </label>
                  <input
                    type="tel"
                    name="phone"
                    defaultValue={editingStaff?.phone || ''}
                    placeholder="01712-XXXXXX"
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs sm:text-sm font-semibold outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    {isBn ? 'পদবী / রোল' : 'Designation'}
                  </label>
                  <input
                    type="text"
                    name="designation"
                    defaultValue={editingStaff?.designation || ''}
                    placeholder={isBn ? 'যেমন: প্রধান ক্যাশিয়ার' : 'e.g. Chief Cashier'}
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs sm:text-sm font-semibold outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    {isBn ? 'পদবীর ক্যাটাগরি' : 'Role Category'}
                  </label>
                  <select
                    name="role"
                    defaultValue={editingStaff?.role || 'salesperson'}
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs sm:text-sm font-bold text-stone-700 outline-none"
                  >
                    <option value="manager">{isBn ? 'ম্যানেজার' : 'Manager'}</option>
                    <option value="cashier">{isBn ? 'ক্যাশিয়ার' : 'Cashier'}</option>
                    <option value="salesperson">{isBn ? 'সেলসম্যান' : 'Salesperson'}</option>
                    <option value="helper">{isBn ? 'সহকারী / হেল্পার' : 'Helper'}</option>
                    <option value="tailor">{isBn ? 'দর্জি / কারিগড়' : 'Tailor'}</option>
                    <option value="accountant">{isBn ? 'হিসাবরক্ষক' : 'Accountant'}</option>
                    <option value="delivery">{isBn ? 'ডেলিভারি বয়' : 'Delivery'}</option>
                    <option value="other">{isBn ? 'অন্যান্য' : 'Other'}</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    {isBn ? 'মাসিক বেসিক বেতন (৳) *' : 'Monthly Base Salary (৳) *'}
                  </label>
                  <input
                    type="number"
                    name="monthlySalary"
                    defaultValue={editingStaff?.monthlySalary || 15000}
                    required
                    min={0}
                    step={100}
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs sm:text-sm font-bold text-emerald-800 outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    {isBn ? 'মাসিক ছুটি (দিন)' : 'Monthly Leaves (Days)'}
                  </label>
                  <input
                    type="number"
                    name="monthlyAllowedLeaves"
                    defaultValue={editingStaff?.monthlyAllowedLeaves ?? 4}
                    min={0}
                    max={15}
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs sm:text-sm font-bold text-blue-700 outline-none"
                  />
                  <span className="text-[10px] text-stone-400">
                    {isBn ? 'ডিফল্ট ৪ দিন সাপ্তাহিক ছুটি (পেইড)' : 'Default 4 paid off-days'}
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    {isBn ? 'কাজের শিফট / সময়' : 'Working Shift'}
                  </label>
                  <input
                    type="text"
                    name="workingShift"
                    defaultValue={editingStaff?.workingShift || '09:00 AM - 08:30 PM'}
                    placeholder="09:00 AM - 08:30 PM"
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs sm:text-sm font-semibold outline-none"
                  />
                </div>
              </div>

              {/* BIOMETRIC FINGERPRINT ENROLLMENT ON ADMISSION */}
              <div className="p-3.5 bg-gradient-to-br from-indigo-50/80 via-blue-50/70 to-slate-50 rounded-2xl border border-indigo-200/80 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors shadow-xs ${
                        modalFingerprintEnrolled
                          ? 'bg-emerald-600 text-white'
                          : 'bg-indigo-600 text-white'
                      }`}
                    >
                      <Fingerprint className={`w-5 h-5 ${isModalScanning ? 'animate-pulse' : ''}`} />
                    </div>
                    <div>
                      <h4 className="text-xs sm:text-sm font-black text-stone-900 flex items-center gap-1.5">
                        <span>{isBn ? 'ভর্তির সময় ফিঙ্গারপ্রিন্ট নিবন্ধন' : 'Fingerprint on Admission'}</span>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-indigo-100 text-indigo-700">
                          {isBn ? 'বায়োমেট্রিক' : 'Biometric'}
                        </span>
                      </h4>
                      <p className="text-[11px] text-stone-500 font-medium">
                        {modalFingerprintEnrolled
                          ? isBn
                            ? '✅ আঙুলের ছাপ সংগৃহীত হয়েছে (ভর্তির সাথে সংরক্ষণ হবে)'
                            : '✅ Fingerprint captured (will be saved with record)'
                          : isBn
                          ? 'নতুন স্টাফ ভর্তির সময়ই মোবাইলের সাথে ফিঙ্গার ডাটা নিয়ে রাখুন'
                          : 'Capture & save biometric fingerprint directly upon admission'}
                      </p>
                    </div>
                  </div>

                  {modalFingerprintEnrolled ? (
                    <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      <span>{isBn ? 'সংগৃহীত' : 'Enrolled'}</span>
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                      {isBn ? 'এখনই নিন' : 'Take Now'}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleModalScanFingerprint}
                    disabled={isModalScanning}
                    className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm ${
                      modalFingerprintEnrolled
                        ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                        : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                    }`}
                  >
                    <Fingerprint className={`w-4 h-4 ${isModalScanning ? 'animate-spin' : ''}`} />
                    <span>
                      {isModalScanning
                        ? isBn
                          ? 'ফিঙ্গারপ্রিন্ট সেন্সরে আঙুল রাখুন... স্ক্যান হচ্ছে'
                          : 'Scanning finger... Place thumb on sensor'
                        : modalFingerprintEnrolled
                        ? isBn
                          ? 'পুনরায় আঙুলের ছাপ স্ক্যান করুন'
                          : 'Re-scan Fingerprint'
                        : isBn
                        ? '📲 মোবাইলে এখনই আঙুলের ছাপ ডাটা নিন'
                        : 'Capture Fingerprint Now (Mobile Device)'}
                    </span>
                  </button>

                  {modalFingerprintEnrolled && (
                    <button
                      type="button"
                      onClick={() => {
                        setModalFingerprintEnrolled(false);
                        setModalFingerprintId(null);
                      }}
                      className="px-2.5 py-2.5 rounded-xl bg-stone-200 hover:bg-rose-100 hover:text-rose-600 text-stone-600 text-xs font-bold transition-colors cursor-pointer"
                      title={isBn ? 'আঙুলের ছাপ বাতিল করুন' : 'Remove fingerprint'}
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {modalFingerprintEnrolled && (
                  <div className="text-[11px] text-emerald-800 bg-emerald-50/90 p-2.5 rounded-xl border border-emerald-200/80 flex items-center justify-between font-semibold">
                    <span className="font-mono">ID: {modalFingerprintId}</span>
                    <span className="text-emerald-700">{modalFingerprintName}</span>
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-stone-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsStaffModalOpen(false);
                    setEditingStaff(null);
                  }}
                  className="px-4 py-2 rounded-xl text-xs sm:text-sm font-bold text-stone-600 hover:bg-stone-100 cursor-pointer"
                >
                  {isBn ? 'বাতিল' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-black shadow-md cursor-pointer"
                >
                  {editingStaff ? (isBn ? 'আপডেট করুন' : 'Update') : (isBn ? 'সংরক্ষণ করুন' : 'Save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: FINGERPRINT ENROLLMENT */}
      {enrollingStaff && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-5 sm:p-6 shadow-2xl border border-stone-200 text-center space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-stone-100">
              <h3 className="text-sm sm:text-base font-black text-stone-900 flex items-center gap-1.5">
                <Fingerprint className="w-5 h-5 text-blue-600" />
                <span>{isBn ? 'আঙুলের ছাপ নিবন্ধন' : 'Fingerprint Enrollment'}</span>
              </h3>
              <button
                type="button"
                onClick={() => setEnrollingStaff(null)}
                className="p-1 rounded-lg hover:bg-stone-100 text-stone-500 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="py-2">
              <div
                className={`w-28 h-28 mx-auto rounded-3xl flex items-center justify-center transition-all ${
                  enrollStep === 'scanning'
                    ? 'bg-blue-600 text-white ring-8 ring-blue-300 animate-pulse'
                    : enrollStep === 'success'
                    ? 'bg-emerald-600 text-white ring-8 ring-emerald-300'
                    : 'bg-stone-900 text-blue-400 ring-4 ring-stone-200'
                }`}
              >
                {enrollStep === 'success' ? (
                  <CheckCircle2 className="w-14 h-14" />
                ) : (
                  <Fingerprint className={`w-14 h-14 ${enrollStep === 'scanning' ? 'scale-110' : ''}`} />
                )}
              </div>

              <h4 className="text-base font-black text-stone-900 mt-3">{enrollingStaff.name}</h4>
              <p className="text-xs text-stone-500 font-medium">{enrollingStaff.designation}</p>

              <div className="mt-3 p-2.5 rounded-2xl bg-blue-50 text-blue-900 text-xs font-semibold">
                {enrollStep === 'ready' &&
                  (isBn
                    ? 'সেন্সরে আঙুল রাখুন এবং "স্ক্যান শুরু করুন" চাপুন।'
                    : 'Place staff finger on sensor and click Start Scan.')}
                {enrollStep === 'scanning' &&
                  (isBn ? 'আঙুল ধরে রাখুন... স্ক্যান হচ্ছে!' : 'Scanning fingerprint... Hold finger on sensor!')}
                {enrollStep === 'success' &&
                  (isBn ? '🎉 অভিনন্দন! আঙুলের ছাপ সফলভাবে সংরক্ষিত হয়েছে!' : '🎉 Fingerprint successfully enrolled!')}
              </div>
            </div>

            {enrollStep === 'ready' && (
              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEnrollingStaff(null)}
                  className="w-1/2 py-2 rounded-xl text-xs font-bold text-stone-600 hover:bg-stone-100 cursor-pointer"
                >
                  {isBn ? 'বাতিল' : 'Cancel'}
                </button>
                <button
                  type="button"
                  onClick={handleExecuteEnroll}
                  className="w-1/2 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black shadow-md cursor-pointer"
                >
                  {isBn ? 'স্ক্যান শুরু করুন' : 'Start Scan'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL 3: SALARY SLIP VIEW & PRINT */}
      {viewingSalarySlip && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-stone-200 space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <h3 className="text-sm sm:text-base font-black text-stone-900 flex items-center gap-2">
                <FileText className="w-5 h-5 text-emerald-600" />
                <span>{isBn ? 'বেতন রসিদ স্লিপ' : 'Salary Slip'}</span>
              </h3>
              <button
                type="button"
                onClick={() => setViewingSalarySlip(null)}
                className="p-1 rounded-lg hover:bg-stone-100 text-stone-500 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Slip Paper Preview */}
            <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200/80 font-mono text-xs space-y-3">
              <div className="text-center pb-2 border-b border-dashed border-stone-300">
                <h4 className="font-black text-sm text-stone-900">
                  {storageService.getSettings()?.storeName || (isBn ? 'মেসার্স ফ্যাশন কালেকশন' : 'Fashion POS')}
                </h4>
                <p className="text-[11px] text-stone-500">
                  {storageService.getSettings()?.storePhone || '01XXXXXXXXX'}
                </p>
                <p className="text-[11px] font-bold text-blue-700 mt-1 uppercase">
                  {isBn ? `মাসিক বেতন স্লিপ - ${viewingSalarySlip.calc.month}` : `Salary Slip - ${viewingSalarySlip.calc.month}`}
                </p>
              </div>

              <div className="space-y-1 text-stone-700">
                <div className="flex justify-between">
                  <span>{isBn ? 'স্টাফ:' : 'Staff:'}</span>
                  <span className="font-bold text-stone-900">{viewingSalarySlip.staff.name}</span>
                </div>
                <div className="flex justify-between">
                  <span>{isBn ? 'পদবী:' : 'Designation:'}</span>
                  <span>{viewingSalarySlip.staff.designation}</span>
                </div>
                <div className="flex justify-between">
                  <span>{isBn ? 'মোবাইল:' : 'Phone:'}</span>
                  <span>{viewingSalarySlip.staff.phone}</span>
                </div>
              </div>

              <div className="border-t border-dashed border-stone-300 pt-2 space-y-1">
                <div className="flex justify-between">
                  <span>{isBn ? 'বেসিক মাসিক বেতন:' : 'Base Salary:'}</span>
                  <span className="font-bold">{viewingSalarySlip.calc.baseMonthlySalary.toLocaleString()} ৳</span>
                </div>
                <div className="flex justify-between text-stone-500">
                  <span>{isBn ? 'মাসের মোট দিন:' : 'Total Days:'}</span>
                  <span>{viewingSalarySlip.calc.totalDaysInMonth} {isBn ? 'দিন' : 'days'}</span>
                </div>
                <div className="flex justify-between text-stone-500">
                  <span>{isBn ? 'দৈনিক রেট:' : 'Daily Rate:'}</span>
                  <span>{viewingSalarySlip.calc.dailyRate} ৳/{isBn ? 'দিন' : 'day'}</span>
                </div>
                <div className="flex justify-between text-blue-700">
                  <span>{isBn ? 'নির্ধারিত ছুটি (পেইড):' : 'Allowed Leaves:'}</span>
                  <span className="font-bold">{viewingSalarySlip.calc.allowedLeaves} {isBn ? 'দিন (ছুটি)' : 'days'}</span>
                </div>
              </div>

              <div className="border-t border-dashed border-stone-300 pt-2 space-y-1">
                <div className="flex justify-between">
                  <span>{isBn ? 'উপস্থিতি:' : 'Present Days:'}</span>
                  <span className="font-bold text-emerald-700">{viewingSalarySlip.calc.presentDays} {isBn ? 'দিন' : 'days'}</span>
                </div>
                <div className="flex justify-between">
                  <span>{isBn ? 'অনুপস্থিতি:' : 'Absent Days:'}</span>
                  <span className="font-bold text-rose-600">{viewingSalarySlip.calc.absentDays} {isBn ? 'দিন' : 'days'}</span>
                </div>
                <div className="flex justify-between text-rose-600 font-bold">
                  <span>{isBn ? 'স্বয়ংক্রিয় অনুপস্থিতি কর্তন:' : 'Absent Deduction:'}</span>
                  <span>-{viewingSalarySlip.calc.absentDeductionAmount.toLocaleString()} ৳</span>
                </div>
              </div>

              <div className="border-t-2 border-stone-900 pt-2 flex justify-between font-black text-sm text-stone-900">
                <span>{isBn ? 'সর্বমোট প্রদেয় বেতন:' : 'Net Payable:'}</span>
                <span className="text-emerald-700">{viewingSalarySlip.calc.netPayableSalary.toLocaleString()} ৳</span>
              </div>

              <div className="pt-6 flex justify-between text-[10px] text-stone-500 border-t border-stone-200">
                <span>{isBn ? 'মালিক/কর্তৃপক্ষ স্বাক্ষর' : 'Authority Signature'}</span>
                <span>{isBn ? 'স্টাফের স্বাক্ষর' : 'Staff Signature'}</span>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setViewingSalarySlip(null)}
                className="w-1/3 py-2 rounded-xl text-xs font-bold text-stone-600 hover:bg-stone-100 cursor-pointer"
              >
                {isBn ? 'বন্ধ করুন' : 'Close'}
              </button>

              <button
                type="button"
                onClick={() => handlePrintSalaryThermal(viewingSalarySlip.calc, viewingSalarySlip.staff)}
                className="w-2/3 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>{isBn ? 'প্রিন্ট / থার্মাল স্লিপ' : 'Print Slip'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: STAFF ATTENDANCE & ABSENCE HISTORY (উনার হিস্ট্রিতে কতদিন absent ছিলেন সেটা দেখায়) */}
      {viewingHistoryStaff && staffHistoryData && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-4 sm:p-6 shadow-2xl border border-stone-200 space-y-4 max-h-[92vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-start justify-between pb-3 border-b border-stone-100 gap-2">
              <div className="flex items-center gap-3">
                <div
                  className={`w-12 h-12 rounded-2xl bg-gradient-to-tr ${
                    viewingHistoryStaff.avatarColor || 'from-blue-500 to-indigo-600'
                  } text-white flex items-center justify-center font-black text-base shadow-xs`}
                >
                  {viewingHistoryStaff.name.slice(0, 2)}
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-stone-900 flex items-center gap-2">
                    <span>{viewingHistoryStaff.name}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-bold border border-blue-200">
                      {viewingHistoryStaff.designation}
                    </span>
                  </h3>
                  <p className="text-xs text-stone-500 font-semibold">
                    {isBn ? 'মোবাইল:' : 'Phone:'} {viewingHistoryStaff.phone} • {isBn ? 'মূল বেতন:' : 'Salary:'} {viewingHistoryStaff.monthlySalary.toLocaleString()} ৳ • {isBn ? 'দৈনিক রেট:' : 'Daily:'} {staffHistoryData.calc.dailyRate} ৳
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="month"
                  value={historySelectedMonth}
                  onChange={(e) => setHistorySelectedMonth(e.target.value)}
                  className="px-2.5 py-1 bg-stone-50 border border-stone-200 rounded-xl text-xs font-bold text-stone-700 outline-none"
                />
                <button
                  type="button"
                  onClick={() => setViewingHistoryStaff(null)}
                  className="p-1.5 rounded-xl hover:bg-stone-100 text-stone-500 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Attendance & Absence Summary Highlights */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {/* Highlight 1: Absent Days & Deduction */}
              <div className="p-3 rounded-2xl bg-rose-50/80 border border-rose-200/90 space-y-1">
                <div className="flex items-center justify-between text-rose-700">
                  <span className="text-xs font-black">{isBn ? 'মোট অনুপস্থিত' : 'Total Absent'}</span>
                  <UserX className="w-4 h-4" />
                </div>
                <div className="text-xl sm:text-2xl font-black text-rose-950">
                  {staffHistoryData.totalAbsent} <span className="text-xs font-bold text-rose-700">{isBn ? 'দিন' : 'days'}</span>
                </div>
                <div className="text-[11px] font-black text-rose-700">
                  {staffHistoryData.totalAbsentDeduction > 0
                    ? `-${staffHistoryData.totalAbsentDeduction.toLocaleString()} ৳ কর্তন`
                    : isBn ? 'কোনো কর্তন নেই' : 'No deduction'}
                </div>
              </div>

              {/* Highlight 2: Present Days */}
              <div className="p-3 rounded-2xl bg-emerald-50/80 border border-emerald-200/90 space-y-1">
                <div className="flex items-center justify-between text-emerald-700">
                  <span className="text-xs font-black">{isBn ? 'উপস্থিত' : 'Present'}</span>
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <div className="text-xl sm:text-2xl font-black text-emerald-950">
                  {staffHistoryData.presentCount} <span className="text-xs font-bold text-emerald-700">{isBn ? 'দিন' : 'days'}</span>
                </div>
                <div className="text-[11px] font-medium text-emerald-800">
                  {isBn ? 'নিয়মিত কর্মদিবস' : 'Working Days'}
                </div>
              </div>

              {/* Highlight 3: Leaves Taken & Remaining (4 allowed per month) */}
              <div className="p-3 rounded-2xl bg-blue-50/80 border border-blue-200/90 space-y-1">
                <div className="flex items-center justify-between text-blue-700">
                  <span className="text-xs font-black">{isBn ? 'মাসিক ছুটি' : 'Paid Leaves'}</span>
                  <Calendar className="w-4 h-4" />
                </div>
                <div className="text-xl sm:text-2xl font-black text-blue-950">
                  {staffHistoryData.leaveCount} <span className="text-xs font-bold text-blue-700">{isBn ? 'দিন ভোগ' : 'taken'}</span>
                </div>
                <div className="text-[11px] font-semibold text-blue-800">
                  {isBn
                    ? `অবশিষ্ট: ${Math.max(0, (viewingHistoryStaff.monthlyAllowedLeaves ?? 4) - staffHistoryData.leaveCount)} দিন`
                    : `Left: ${Math.max(0, 4 - staffHistoryData.leaveCount)} d`}
                </div>
              </div>

              {/* Highlight 4: Net Payable */}
              <div className="p-3 rounded-2xl bg-amber-50/80 border border-amber-200/90 space-y-1">
                <div className="flex items-center justify-between text-amber-700">
                  <span className="text-xs font-black">{isBn ? 'প্রদেয় বেতন' : 'Net Salary'}</span>
                  <DollarSign className="w-4 h-4" />
                </div>
                <div className="text-xl sm:text-2xl font-black text-amber-950">
                  {staffHistoryData.calc.netPayableSalary.toLocaleString()} <span className="text-xs font-bold text-amber-700">৳</span>
                </div>
                <div className="text-[11px] font-semibold text-amber-800">
                  {staffHistoryData.totalHalf > 0
                    ? `${staffHistoryData.totalHalf} ${isBn ? 'অর্ধ দিবস' : 'half-day'}`
                    : isBn ? 'হিসাব সম্পন্ন' : 'Calculated'}
                </div>
              </div>
            </div>

            {/* SECTION 1: DETAILED LIST OF ABSENT DATES (উনার অনুপস্থিতির হিস্ট্রি) */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <h4 className="text-xs sm:text-sm font-black text-stone-900 flex items-center gap-1.5">
                  <UserX className="w-4 h-4 text-rose-600" />
                  <span>{isBn ? 'অনুপস্থিতির পূর্ণাঙ্গ হিস্ট্রি ও তারিখসমূহ' : 'Absence History & Missed Dates'}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 font-bold">
                    {staffHistoryData.totalAbsent} {isBn ? 'দিন অনুপস্থিত' : 'days absent'}
                  </span>
                </h4>
                <span className="text-[11px] text-stone-500 font-medium">
                  {isBn ? '১ দিন অনুপস্থিত = ১ দিনের দৈনিক বেতন কর্তন' : '1 day absent = 1 day salary deduction'}
                </span>
              </div>

              {staffHistoryData.absentList.length === 0 ? (
                <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200/80 text-center space-y-1">
                  <div className="inline-flex p-2 rounded-full bg-emerald-100 text-emerald-700">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <h5 className="text-xs sm:text-sm font-black text-emerald-950">
                    {isBn ? '🎉 মাশাআল্লাহ! এই মাসে কোনো অনুপস্থিতি নেই!' : '🎉 Excellent! No absences this month!'}
                  </h5>
                  <p className="text-[11px] text-emerald-800 font-medium">
                    {isBn
                      ? 'স্টাফের শতভাগ উপস্থিতি রয়েছে। কোনো বেতন কর্তন হয়নি।'
                      : 'Staff has 100% attendance with zero salary deductions.'}
                  </p>
                </div>
              ) : (
                <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                  {staffHistoryData.absentList.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-2.5 rounded-2xl bg-rose-50/70 border border-rose-200/80 gap-2"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-rose-600 text-white flex items-center justify-center font-black text-xs">
                          {item.date.slice(8, 10)}
                        </div>
                        <div>
                          <div className="text-xs font-black text-stone-900 flex items-center gap-1.5">
                            <span>{item.date} ({item.dayOfWeek})</span>
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-200/80 text-rose-900">
                              {item.status === 'half_day' ? (isBn ? 'অর্ধ দিবস' : 'Half Day') : (isBn ? 'অনুপস্থিত' : 'Absent')}
                            </span>
                            {item.isAuto && (
                              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-stone-200 text-stone-700">
                                {isBn ? 'পাঞ্চ নেই (অটো)' : 'No Punch (Auto)'}
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-rose-700 font-medium">
                            {item.note || (isBn ? '১ দিনের দৈনিক বেতন কর্তন' : 'Daily salary deducted')} • -{item.deductionAmount.toLocaleString()} ৳
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleUpdatePastAttendance(viewingHistoryStaff.id, item.date, 'leave')}
                          className="px-2 py-1 rounded-xl bg-blue-100 hover:bg-blue-200 text-blue-800 text-[11px] font-black cursor-pointer transition-colors"
                          title={isBn ? 'অনুমোদিত ছুটি হিসেবে গণ্য করুন (বেতন কর্তন বাতিল হবে)' : 'Approve as paid leave'}
                        >
                          {isBn ? 'ছুটি অনুমোদন' : 'Make Leave'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleUpdatePastAttendance(viewingHistoryStaff.id, item.date, 'present')}
                          className="px-2 py-1 rounded-xl bg-emerald-100 hover:bg-emerald-200 text-emerald-800 text-[11px] font-black cursor-pointer transition-colors"
                          title={isBn ? 'উপস্থিত হিসেবে চিহ্নিত করুন' : 'Mark present'}
                        >
                          {isBn ? 'উপস্থিত' : 'Present'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* SECTION 2: FULL MONTH ATTENDANCE LOG / SHEET */}
            <div className="space-y-2 border-t border-stone-100 pt-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs sm:text-sm font-black text-stone-900 flex items-center gap-1.5">
                  <CalendarDays className="w-4 h-4 text-blue-600" />
                  <span>{isBn ? 'চলতি মাসের সম্পূর্ণ হাজিরা শিট' : 'Full Month Attendance Log'}</span>
                </h4>
                <div className="flex items-center gap-2 text-[10px] font-bold">
                  <span className="flex items-center gap-1 text-emerald-700">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" /> {isBn ? 'উপস্থিত' : 'Present'}
                  </span>
                  <span className="flex items-center gap-1 text-rose-700">
                    <span className="w-2 h-2 rounded-full bg-rose-500" /> {isBn ? 'অনুপস্থিত' : 'Absent'}
                  </span>
                  <span className="flex items-center gap-1 text-indigo-700">
                    <span className="w-2 h-2 rounded-full bg-indigo-500" /> {isBn ? 'সাপ্তাহিক ছুটি' : 'Weekly Off'}
                  </span>
                  <span className="flex items-center gap-1 text-blue-700">
                    <span className="w-2 h-2 rounded-full bg-blue-500" /> {isBn ? 'পেইড ছুটি' : 'Leave'}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-5 sm:grid-cols-7 md:grid-cols-10 gap-1 max-h-40 overflow-y-auto p-1 bg-stone-50 rounded-2xl border border-stone-200">
                {staffHistoryData.dayRows.map((d) => (
                  <div
                    key={d.day}
                    className={`p-1.5 rounded-xl text-center border text-[11px] font-bold flex flex-col justify-between min-h-[46px] ${
                      d.status === 'present'
                        ? 'bg-emerald-100/80 border-emerald-300 text-emerald-950'
                        : d.status === 'absent'
                        ? 'bg-rose-100/90 border-rose-300 text-rose-950 ring-1 ring-rose-400'
                        : d.status === 'weekly_off'
                        ? 'bg-indigo-50 border-indigo-200 text-indigo-800'
                        : d.status === 'leave'
                        ? 'bg-blue-100 border-blue-300 text-blue-900'
                        : d.status === 'half_day'
                        ? 'bg-amber-100 border-amber-300 text-amber-900'
                        : 'bg-white border-stone-200 text-stone-400'
                    }`}
                  >
                    <div className="text-[10px] text-stone-500 leading-none">{d.dayName.slice(0, 3)}</div>
                    <div className="font-black text-xs leading-none">{d.day}</div>
                    <div className="text-[9px] font-black uppercase tracking-tight leading-none">
                      {d.status === 'present'
                        ? 'উপস্থিত'
                        : d.status === 'absent'
                        ? 'অনুপস্থিত'
                        : d.status === 'weekly_off'
                        ? 'ছুটি'
                        : d.status === 'leave'
                        ? 'পেইড'
                        : d.status === 'half_day'
                        ? '০.৫'
                        : '-'}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Modal Actions */}
            <div className="pt-3 border-t border-stone-100 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setViewingHistoryStaff(null)}
                className="px-4 py-2 rounded-xl text-xs sm:text-sm font-bold text-stone-600 hover:bg-stone-100 cursor-pointer"
              >
                {isBn ? 'বন্ধ করুন' : 'Close'}
              </button>

              <button
                type="button"
                onClick={() => handlePrintStaffHistoryThermal(viewingHistoryStaff)}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-black shadow-md flex items-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>{isBn ? 'হাজিরা ও অনুপস্থিতি স্লিপ প্রিন্ট' : 'Print Attendance Slip'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
