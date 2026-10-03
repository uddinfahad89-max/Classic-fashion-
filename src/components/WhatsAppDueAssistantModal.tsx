import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  MessageCircle,
  Copy,
  Check,
  Search,
  X,
  Phone,
  User,
  Edit3,
  Send,
  RotateCcw,
  Sparkles,
  ShoppingBag,
  Clock,
  AlertTriangle,
  Globe,
  MapPin,
  Users,
  CheckSquare,
  Square,
  ChevronRight,
  ChevronLeft,
  FastForward,
  Download,
  CheckCircle2,
  ListOrdered,
  Filter,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Play,
  Share2,
  Layers,
  Radio,
  ExternalLink,
} from 'lucide-react';
import { CustomerDue, Language, ThermalPrinterSettings } from '../types';
import { useBackHandler } from '../utils/useBackHandler';

export const formatIndianWhatsAppPhone = (rawPhone: string): string => {
  const digits = (rawPhone || '').replace(/[^0-9]/g, '');
  if (!digits) return '';
  // Standard 10 digit Indian number: 9876543210 -> 919876543210
  if (digits.length === 10) {
    return `91${digits}`;
  }
  // 11 digit Indian number with leading 0: 09876543210 -> 919876543210
  if (digits.length === 11 && digits.startsWith('0')) {
    return `91${digits.slice(1)}`;
  }
  // 12 digit Indian number with 91: 919876543210
  if (digits.length === 12 && digits.startsWith('91')) {
    return digits;
  }
  // 13 digit starting with 091: 0919876543210 -> 919876543210
  if (digits.length === 13 && digits.startsWith('091')) {
    return digits.slice(1);
  }
  return digits;
};

export type MessageLanguage = 'bn' | 'hi' | 'hinglish' | 'en';
export type ReminderScenario = 'purchase_trip' | 'general' | 'urgent';
export type PurchaseDestination = 'delhi_kolkata' | 'delhi' | 'kolkata' | 'surat_mumbai';

interface WhatsAppDueAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  dues: CustomerDue[];
  settings: ThermalPrinterSettings;
  language?: Language;
  initialCustomer?: CustomerDue | null;
  initialMode?: 'single' | 'bulk';
}

export const WhatsAppDueAssistantModal: React.FC<WhatsAppDueAssistantModalProps> = ({
  isOpen,
  onClose,
  dues,
  settings,
  language = 'bn',
  initialCustomer = null,
  initialMode = 'single',
}) => {
  const isBn = language === 'bn';
  const sym = settings.currencySymbol || '₹';
  const storeName = settings.storeName || (isBn ? 'আমাদের প্রতিষ্ঠান' : 'Our Store');

  // Mode switcher: Single Customer or Bulk Reminder
  const [activeMode, setActiveMode] = useState<'single' | 'bulk'>(initialMode);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>(() => {
    if (initialCustomer) return initialCustomer.id;
    const firstDue = dues.find((d) => (d.type || 'receivable') === 'receivable' && d.dueAmount > 0);
    return firstDue ? firstDue.id : dues[0]?.id || '';
  });

  // Keep selectedCustomerId in sync when initialCustomer prop changes
  useEffect(() => {
    if (initialCustomer) {
      setSelectedCustomerId(initialCustomer.id);
      setActiveMode('single');
    }
  }, [initialCustomer]);

  // Sync mode if initialMode prop changes
  useEffect(() => {
    if (initialMode) {
      setActiveMode(initialMode);
    }
  }, [initialMode]);

  // Message customization state
  const [messageLang, setMessageLang] = useState<MessageLanguage>('bn');
  const [scenario, setScenario] = useState<ReminderScenario>('purchase_trip');
  const [destination, setDestination] = useState<PurchaseDestination>('delhi_kolkata');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [customizedMessages, setCustomizedMessages] = useState<Record<string, string>>({});
  const [isEditingMessage, setIsEditingMessage] = useState(false);

  // Bulk specific editing states
  const [isEditingBulkMessage, setIsEditingBulkMessage] = useState(false);
  const [isEditingMasterTemplate, setIsEditingMasterTemplate] = useState(false);
  const [bulkMasterTemplate, setBulkMasterTemplate] = useState<string>('');
  const [showBroadcastInfo, setShowBroadcastInfo] = useState(false);

  // --- BULK REMINDER STATES ---
  const [bulkMinAmount, setBulkMinAmount] = useState<number>(0);
  const [bulkOnlyWithPhone, setBulkOnlyWithPhone] = useState<boolean>(true);
  const [bulkSelectedIds, setBulkSelectedIds] = useState<Set<string>>(new Set());
  const [bulkSentIds, setBulkSentIds] = useState<Set<string>>(new Set());
  const [bulkQueueIndex, setBulkQueueIndex] = useState<number>(0);
  const [bulkCopySuccess, setBulkCopySuccess] = useState<boolean>(false);

  // --- AUDIO VOICE STUDIO STATES ---
  const [showAudioStudio, setShowAudioStudio] = useState<boolean>(false);
  const [isPlayingTTS, setIsPlayingTTS] = useState<boolean>(false);
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [recordingSeconds, setRecordingSeconds] = useState<number>(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);

  useBackHandler('whatsAppDueAssistantModal', isOpen, () => {
    onClose();
    return true;
  }, 45);

  // Filter only receivable customers with pending due > 0
  const receivableDues = useMemo(() => {
    return dues.filter((d) => (d.type || 'receivable') === 'receivable' && d.dueAmount > 0);
  }, [dues]);

  // Bulk eligible list based on phone and min amount
  const bulkEligibleList = useMemo(() => {
    return receivableDues.filter((d) => {
      if (bulkOnlyWithPhone && !d.phone) return false;
      if (bulkMinAmount > 0 && d.dueAmount < bulkMinAmount) return false;
      return true;
    });
  }, [receivableDues, bulkOnlyWithPhone, bulkMinAmount]);

  // Initialize bulk selection when eligible list changes
  useEffect(() => {
    setBulkSelectedIds(new Set(bulkEligibleList.map((d) => d.id)));
  }, [bulkEligibleList]);

  // Bulk active queue (selected customers in sequence)
  const bulkQueue = useMemo(() => {
    return bulkEligibleList.filter((d) => bulkSelectedIds.has(d.id));
  }, [bulkEligibleList, bulkSelectedIds]);

  // Bound bulk queue index
  useEffect(() => {
    if (bulkQueueIndex >= bulkQueue.length && bulkQueue.length > 0) {
      setBulkQueueIndex(bulkQueue.length - 1);
    }
  }, [bulkQueue.length, bulkQueueIndex]);

  const currentBulkCustomer = bulkQueue[bulkQueueIndex] || null;

  const filteredList = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return receivableDues;
    return receivableDues.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.phone && c.phone.includes(q))
    );
  }, [receivableDues, searchTerm]);

  // Selected Customer in Single Mode
  const activeCustomer = useMemo(() => {
    return dues.find((d) => d.id === selectedCustomerId) || filteredList[0] || null;
  }, [dues, selectedCustomerId, filteredList]);

  // Destination labels for various languages
  const getDestinationLabel = (dest: PurchaseDestination, lang: MessageLanguage): string => {
    if (dest === 'delhi_kolkata') {
      if (lang === 'bn') return 'দিল্লি ও কলকাতা';
      if (lang === 'hi') return 'दिल्ली और कोलकाता';
      if (lang === 'hinglish') return 'Delhi aur Kolkata';
      return 'Delhi and Kolkata';
    }
    if (dest === 'delhi') {
      if (lang === 'bn') return 'দিল্লি';
      if (lang === 'hi') return 'दिल्ली';
      if (lang === 'hinglish') return 'Delhi';
      return 'Delhi';
    }
    if (dest === 'kolkata') {
      if (lang === 'bn') return 'কলকাতা';
      if (lang === 'hi') return 'कोलकाता';
      if (lang === 'hinglish') return 'Kolkata';
      return 'Kolkata';
    }
    // surat_mumbai
    if (lang === 'bn') return 'সুরাট ও মুম্বাই';
    if (lang === 'hi') return 'सूरत और मुंबई';
    if (lang === 'hinglish') return 'Surat aur Mumbai';
    return 'Surat and Mumbai';
  };

  // Generate dynamic message template based on scenario, language, and destination
  // Note: "দাদা/ভাই" has been completely removed as requested!
  const getTemplateMessage = (customer: CustomerDue, lang: MessageLanguage, scn: ReminderScenario, dest: PurchaseDestination): string => {
    const cleanAmount = `${sym}${customer.dueAmount.toFixed(2)}`;
    const destName = getDestinationLabel(dest, lang);

    // 1. PURCHASE TRIP SCENARIO (দিল্লি ও কলকাতায় মাল কিনতে যাওয়ার কারণে তাগাদা)
    if (scn === 'purchase_trip') {
      if (lang === 'bn') {
        return `আসসালামু আলাইকুম / নমস্কার ${customer.name},
আশা করি ভালো আছেন।

আমি আগামী দুই-একদিনের মধ্যে দোকানের নতুন পোশাক ও মাল কিনতে ${destName}-এ যাচ্ছি। বাজারে রওনা হওয়ার আগে পাইকারি মহাজন ও কাপড় পার্টির বড় অঙ্কের নগদ পেমেন্ট ক্লিয়ার করতে হচ্ছে।

"${storeName}"-এ আপনার বর্তমান বকেয়া হিসাব অনুযায়ী মোট পাওনা ${cleanAmount}/- টাকা।

আপনার কাছে বিশেষ অনুরোধ—আমি মাল কিনতে রওনা হওয়ার আগেই অনুগ্রহ করে আপনার সম্পূর্ণ বকেয়া টাকাটি ক্লিয়ার/পরিশোধ করে দেবেন। এতে আমার নতুন মাল তুলতে অনেক সুবিধা হবে।

আপনার সহযোগিতা একান্ত কাম্য।
ধন্যবাদ ও শুভেচ্ছা সহ,
${storeName}`;
      }

      if (lang === 'hi') {
        return `नमस्ते ${customer.name} जी,
आशा है आप सकुशल होंगे।

मैं बहुत जल्द दुकान के नए स्टॉक और माल की खरीदारी के लिए ${destName} जा रहा हूँ। खरीदारी पर निकलने से पहले मुझे होलसेल व्यापारियों को नकद भुगतान क्लियर करना जरूरी है।

"${storeName}" में आपका कुल बकाया हिसाब ${cleanAmount}/- है।

आपसे विनम्र व जरूरी निवेदन है कि मेरे ${destName} रवाना होने से पहले कृपया अपना पूरा बकाया बिल क्लियर (जमा) कर दें, ताकि नई खरीदारी में सुविधा हो।

आपके सहयोग की आशा है।
सधन्यवाद,
${storeName}`;
      }

      if (lang === 'hinglish') {
        return `Namaste ${customer.name} ji,
Aasha hai aap acche honge.

Main agle 1-2 din mein naya stock aur kapde kharidne ke liye ${destName} ja raha hoon. Market nikalne se pehle mujhe wholesale payment ke liye cash ki kaafi zaroorat hai.

"${storeName}" par aapka total pending due balance ${cleanAmount}/- hai.

Aapse request hai ki mere ${destName} nikalne se pehle kripya apna baki payment clear kar dein, taaki naya maal laane mein aasani ho.

Aapke sahyog ke liye dhanyawad.
Regard,
${storeName}`;
      }

      // English
      return `Dear ${customer.name},
Hope you are doing well.

I will shortly be traveling to ${destName} for wholesale purchases and fresh inventory. Before departing, I need to clear major upfront cash payments with wholesale suppliers.

Your current pending due balance at "${storeName}" is ${cleanAmount}.

I kindly request you to please clear your outstanding balance before my departure, so that we can smoothly purchase new stock.

Thank you for your cooperation!
Best regards,
${storeName}`;
    }

    // 2. GENERAL POLITE REMINDER
    if (scn === 'general') {
      if (lang === 'bn') {
        return `আসসালামু আলাইকুম / নমস্কার ${customer.name},
আশা করি ভালো আছেন।

আপনার সদয় অবগতির জন্য জানানো যাচ্ছে যে, "${storeName}"-এ আপনার পূর্বের বকেয়া হিসাব অনুযায়ী মোট পাওনা ${cleanAmount}/- টাকা।

আপনার সুবিধাজনক সময়ে বকেয়া অর্থটি পরিশোধ করে দেওয়ার বিনীত অনুরোধ রইল। হিসাব সংক্রান্ত কোনো তথ্যের প্রয়োজন হলে নির্দ্বিধায় যোগাযোগ করতে পারেন।

ধন্যবাদ ও শুভেচ্ছা সহ,
${storeName}`;
      }

      if (lang === 'hi') {
        return `नमस्ते ${customer.name} जी,
आशा है आप सकुशल होंगे।

यह एक विनम्र स्मरण पत्र है कि "${storeName}" में आपका पिछला बकाया हिसाब ${cleanAmount}/- शेष है।

कृपया अपनी सुविधानुसार बकाया राशि का भुगतान करने का कष्ट करें। किसी भी विवरण या जानकारी के लिए संपर्क करें।

धन्यवाद व सादर,
${storeName}`;
      }

      if (lang === 'hinglish') {
        return `Namaste ${customer.name} ji,
Aasha hai aap acche honge.

Yeh ek gentle reminder hai ki "${storeName}" par aapka pending due balance ${cleanAmount}/- hai.

Aap se anurodh hai ki apne suvidhanusar baki payment clear kar dein. Kisi bhi jankari ke liye contact karein.

Dhanyawad,
${storeName}`;
      }

      return `Hello ${customer.name},
Hope you are doing well.

This is a gentle reminder regarding your pending due balance of ${cleanAmount} at "${storeName}".

Please settle the due amount at your earliest convenience. If you have any questions, feel free to contact us.

Warm regards,
${storeName}`;
    }

    // 3. URGENT REMINDER
    if (lang === 'bn') {
      return `জরুরি বকেয়া তাগাদা:
আসসালামু আলাইকুম / নমস্কার ${customer.name},

"${storeName}"-এ আপনার বকেয়া থাকা পাওনা টাকার পরিমাণ ${cleanAmount}/-।
জরুরি প্রয়োজনে আমাদের অবিলম্বে এই টাকাটি সমন্বয় করতে হচ্ছে।

অনুগ্রহ করে দ্রুততম সময়ে আপনার বকেয়া অর্থটি পরিশোধ করার বিনীত অনুরোধ করছি।

ধন্যবাদ,
${storeName}`;
    }

    if (lang === 'hi') {
      return `अति आवश्यक रिमाइंडर:
नमस्ते ${customer.name} जी,

"${storeName}" में आपका बकाया हिसाब ${cleanAmount}/- काफी समय से लंबित है।
जरूरी भुगतान के कारण हमें तुरंत यह राशि क्लियर करनी है।

कृपया जल्द से जल्द अपना बकाया भुगतान करने का कष्ट करें।

धन्यवाद,
${storeName}`;
    }

    if (lang === 'hinglish') {
      return `Urgent Reminder:
Namaste ${customer.name} ji,

"${storeName}" par aapka pending due amount ${cleanAmount}/- kaafi samay se baki hai.
Immediate payment requirement ke karan yeh amount clear karna zaroori hai.

Kripya jaldi se jaldi apna due clear kar dein.

Dhanyawad,
${storeName}`;
    }

    return `Urgent Payment Reminder:
Dear ${customer.name},

Your pending balance of ${cleanAmount} at "${storeName}" is currently overdue.
Due to urgent settlement commitments, we kindly request you to clear this payment as soon as possible.

Thank you,
${storeName}`;
  };

  // Generate polite, respectful due reminder text
  const generatePoliteMessage = (customer: CustomerDue): string => {
    const customKey = `${customer.id}-${messageLang}-${scenario}-${destination}`;
    if (customizedMessages[customKey]) {
      return customizedMessages[customKey];
    }
    // If a bulk master template has been edited and active
    if (bulkMasterTemplate.trim()) {
      return bulkMasterTemplate
        .replace(/{name}/g, customer.name)
        .replace(/{amount}/g, `${sym}${customer.dueAmount.toFixed(2)}`)
        .replace(/{destination}/g, getDestinationLabel(destination, messageLang))
        .replace(/{storeName}/g, storeName);
    }
    return getTemplateMessage(customer, messageLang, scenario, destination);
  };

  const currentSingleMessage = activeCustomer ? generatePoliteMessage(activeCustomer) : '';
  const currentBulkMessage = currentBulkCustomer ? generatePoliteMessage(currentBulkCustomer) : '';

  // Handle direct WhatsApp launch
  const handleSendWhatsApp = (customer: CustomerDue) => {
    const message = generatePoliteMessage(customer);
    const cleanPhone = formatIndianWhatsAppPhone(customer.phone || '');
    const url = cleanPhone
      ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`
      : `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };

  // Handle Copy Message
  const handleCopyMessage = (customer: CustomerDue) => {
    const message = generatePoliteMessage(customer);
    navigator.clipboard.writeText(message);
    setCopiedId(customer.id);
    setTimeout(() => {
      setCopiedId(null);
    }, 2500);
  };

  // Reset edited message back to default template
  const handleResetToTemplate = (customer: CustomerDue) => {
    const customKey = `${customer.id}-${messageLang}-${scenario}-${destination}`;
    setCustomizedMessages((prev) => {
      const copy = { ...prev };
      delete copy[customKey];
      return copy;
    });
    setIsEditingMessage(false);
    setIsEditingBulkMessage(false);
  };

  // --- AUDIO VOICE STUDIO LOGIC ---
  const handleTogglePlayTTS = (text: string, lang: MessageLanguage) => {
    if (!('speechSynthesis' in window)) {
      alert(isBn ? 'আপনার ব্রাউজারে টেক্সট-টু-স্পিচ ভয়েস সমর্থিত নয়।' : 'Speech synthesis not supported in this browser.');
      return;
    }

    if (isPlayingTTS) {
      window.speechSynthesis.cancel();
      setIsPlayingTTS(false);
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    if (lang === 'bn') {
      utterance.lang = 'bn-IN';
    } else if (lang === 'hi' || lang === 'hinglish') {
      utterance.lang = 'hi-IN';
    } else {
      utterance.lang = 'en-US';
    }
    utterance.rate = 0.95;

    utterance.onend = () => setIsPlayingTTS(false);
    utterance.onerror = () => setIsPlayingTTS(false);

    setIsPlayingTTS(true);
    window.speechSynthesis.speak(utterance);
  };

  // Start voice microphone recording
  const handleStartRecording = async () => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        alert(isBn ? 'আপনার ব্রাউজারে মাইক্রোফোন রেকর্ডিং সাপোর্ট নেই।' : 'Microphone recording not supported.');
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const mimeType = mediaRecorder.mimeType || 'audio/mp3';
        const blob = new Blob(audioChunksRef.current, { type: mimeType });
        setAudioBlob(blob);
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingSeconds(0);

      timerRef.current = window.setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch {
      alert(
        isBn
          ? 'মাইক্রোফোন চালু করা যায়নি। অনুগ্রহ করে ব্রাউজার সেটিংসে মাইক্রোফোন পারমিশন এলাউ (Allow) করুন।'
          : 'Could not access microphone. Please grant permission.'
      );
    }
  };

  // Stop voice recording
  const handleStopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  };

  // Share Audio + Text via Web Share API
  const handleShareAudioAndText = async (customer: CustomerDue, message: string) => {
    if (!audioBlob) return;
    const cleanPhone = formatIndianWhatsAppPhone(customer.phone || '');
    const fileName = `Voice_Reminder_${customer.name.replace(/[^a-zA-Z0-9]/g, '_')}.mp3`;
    const file = new File([audioBlob], fileName, { type: audioBlob.type || 'audio/mp3' });

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          files: [file],
          text: message,
          title: `${storeName} বকেয়া তাগাদা`,
        });
        return;
      } catch {
        // Fallback below if cancelled
      }
    }

    // Direct download & open WhatsApp fallback
    if (audioUrl) {
      const a = document.createElement('a');
      a.href = audioUrl;
      a.download = fileName;
      a.click();
    }

    const url = cleanPhone
      ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`
      : `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };

  // Reset audio recording
  const handleResetAudio = () => {
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }
    setAudioBlob(null);
    setAudioUrl(null);
    setRecordingSeconds(0);
    if (isPlayingTTS) {
      window.speechSynthesis.cancel();
      setIsPlayingTTS(false);
    }
  };

  // --- BULK ACTION HANDLERS ---
  const handleBulkToggleSelect = (id: string) => {
    setBulkSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleBulkSelectAll = () => {
    setBulkSelectedIds(new Set(bulkEligibleList.map((d) => d.id)));
  };

  const handleBulkDeselectAll = () => {
    setBulkSelectedIds(new Set());
  };

  // Send current customer in bulk queue and auto-advance
  const handleBulkSendAndAdvance = (customer: CustomerDue) => {
    handleSendWhatsApp(customer);
    setBulkSentIds((prev) => new Set([...prev, customer.id]));

    // Auto advance to next customer
    if (bulkQueueIndex < bulkQueue.length - 1) {
      setBulkQueueIndex((prev) => prev + 1);
      setIsEditingBulkMessage(false);
    }
  };

  // Broadcast common message to WhatsApp (Opens WhatsApp app with generic reminder text so user can pick their Broadcast List or contacts!)
  const handleOpenWhatsAppBroadcast = () => {
    const destName = getDestinationLabel(destination, messageLang);
    let broadcastMsg = '';

    if (scenario === 'purchase_trip') {
      if (messageLang === 'bn') {
        broadcastMsg = `আসসালামু আলাইকুম / নমস্কার,
আশা করি ভালো আছেন।

আমি আগামী দুই-একদিনের মধ্যে নতুন পোশাক ও মাল কিনতে ${destName}-এ যাচ্ছি। বাজারে রওনা হওয়ার আগে পাইকারি মহাজন ও কাপড় পার্টির নগদ পেমেন্ট ক্লিয়ার করতে হচ্ছে।

"${storeName}"-এ আপনার যেসকল পূর্বের বকেয়া হিসাব রয়েছে, বিনীত অনুরোধ রইল—আমি মাল কিনতে যাওয়ার আগেই অনুগ্রহ করে আপনার সম্পূর্ণ বকেয়া টাকাটি ক্লিয়ার/পরিশোধ করে দেবেন। এতে আমার নতুন মাল তুলতে অনেক সুবিধা হবে।

ধন্যবাদ ও শুভেচ্ছা সহ,
${storeName}`;
      } else if (messageLang === 'hi') {
        broadcastMsg = `नमस्ते,
आशा है आप सकुशल होंगे।

मैं बहुत जल्द नए स्टॉक और माल की खरीदारी के लिए ${destName} जा रहा हूँ।

"${storeName}" में आपका जो भी बकाया हिसाब है, आपसे विनम्र निवेदन है कि मेरे ${destName} रवाना होने से पहले कृपया अपना बकाया बिल क्लियर कर दें।

सधन्यवाद,
${storeName}`;
      } else {
        broadcastMsg = `Dear Customer,
Hope you are well.

I am shortly traveling to ${destName} for wholesale purchases. Kindly settle your pending balance with "${storeName}" before my departure.

Thank you,
${storeName}`;
      }
    } else {
      broadcastMsg = `আসসালামু আলাইকুম / নমস্কার,
আপনার সদয় অবগতির জন্য জানানো যাচ্ছে যে, "${storeName}"-এ আপনার পূর্বের বকেয়া হিসাব রয়েছে।
সুবিধাজনক সময়ে বকেয়া অর্থটি পরিশোধ করে দেওয়ার বিনীত অনুরোধ রইল।

ধন্যবাদ,
${storeName}`;
    }

    navigator.clipboard.writeText(broadcastMsg);
    // Open WhatsApp
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(broadcastMsg)}`, '_blank');
  };

  // Copy all selected bulk messages into clipboard for broadcast tools
  const handleCopyAllBulkBroadcast = () => {
    if (bulkQueue.length === 0) return;
    const broadcastText = bulkQueue
      .map((c, i) => {
        const phone = formatIndianWhatsAppPhone(c.phone || '') || 'No Phone';
        const msg = generatePoliteMessage(c);
        return `[#${i + 1}] ${c.name} (${phone}) - Due: ${sym}${c.dueAmount.toFixed(2)}\n${msg}\n----------------------------------------`;
      })
      .join('\n\n');

    navigator.clipboard.writeText(broadcastText);
    setBulkCopySuccess(true);
    setTimeout(() => {
      setBulkCopySuccess(false);
    }, 3000);
  };

  // Export bulk reminders as CSV
  const handleDownloadBulkCSV = () => {
    if (bulkQueue.length === 0) return;
    const header = ['Customer Name', 'Phone', 'Due Amount', 'WhatsApp Link', 'Message'];
    const rows = bulkQueue.map((c) => {
      const cleanPhone = formatIndianWhatsAppPhone(c.phone || '');
      const msg = generatePoliteMessage(c).replace(/\n/g, ' ');
      const waLink = cleanPhone ? `https://wa.me/${cleanPhone}` : '';
      return [
        `"${c.name.replace(/"/g, '""')}"`,
        `"${cleanPhone}"`,
        c.dueAmount.toFixed(2),
        `"${waLink}"`,
        `"${msg.replace(/"/g, '""')}"`,
      ];
    });

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [header.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Bulk_Due_Reminders_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!isOpen) return null;

  const totalBulkDueAmount = bulkQueue.reduce((acc, c) => acc + c.dueAmount, 0);
  const bulkProgressPercent = bulkQueue.length > 0 ? Math.round((bulkSentIds.size / bulkQueue.length) * 100) : 0;

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl shadow-2xl border border-stone-200 w-full max-w-4xl overflow-hidden my-auto flex flex-col max-h-[96vh]">
        {/* Header */}
        <div className="px-4 sm:px-5 py-3 bg-emerald-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center shrink-0">
              <MessageCircle className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-black tracking-tight flex items-center gap-2">
                <span>{isBn ? '🤖 বকেয়া তাগাদা সহকারী' : 'WhatsApp Due Reminder Assistant'}</span>
                <span className="text-[10px] bg-emerald-800/80 text-emerald-200 px-2 py-0.5 rounded-full border border-emerald-700/60 font-semibold font-mono">
                  {receivableDues.length} {isBn ? 'জন বাকি' : 'Dues'}
                </span>
              </h3>
              <p className="text-[10px] sm:text-[11px] text-emerald-200/80">
                {isBn
                  ? 'দিল্লি/কলকাতায় মাল কেনার তাগাদাসহ একক ও বাল্ক হোয়াটসঅ্যাপ মেসেজ'
                  : 'Multilingual single & bulk WhatsApp reminder queues with Audio Voice & Editing'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white cursor-pointer transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Mode Switcher Banner: Single vs Bulk */}
        <div className="px-3 sm:px-5 py-2 bg-emerald-950/90 border-b border-emerald-800 flex items-center justify-between gap-2 text-xs shrink-0 flex-wrap">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setActiveMode('single')}
              className={`px-3 py-1.5 rounded-xl font-black text-xs transition-all cursor-pointer flex items-center gap-1.5 ${
                activeMode === 'single'
                  ? 'bg-white text-emerald-950 shadow-sm'
                  : 'bg-emerald-900/60 hover:bg-emerald-800 text-emerald-200'
              }`}
            >
              <User className="w-3.5 h-3.5" />
              <span>{isBn ? '👤 একক কাস্টমার' : 'Single Customer'}</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveMode('bulk')}
              className={`px-3 py-1.5 rounded-xl font-black text-xs transition-all cursor-pointer flex items-center gap-1.5 ${
                activeMode === 'bulk'
                  ? 'bg-amber-400 text-stone-950 shadow-sm'
                  : 'bg-emerald-900/60 hover:bg-emerald-800 text-emerald-200'
              }`}
            >
              <FastForward className="w-3.5 h-3.5" />
              <span>{isBn ? '🚀 বাল্ক তাগাদা কাতার' : 'Bulk Reminder Queue'}</span>
              <span className="text-[10px] bg-black/20 px-1.5 py-0.2 rounded-full font-mono font-bold">
                {bulkQueue.length}
              </span>
            </button>
          </div>

          <div className="hidden sm:flex items-center gap-1 text-[11px] text-emerald-300/80 font-medium">
            <span>{isBn ? 'মোট বকেয়া:' : 'Total Due:'}</span>
            <strong className="font-mono text-white text-xs">{sym}{receivableDues.reduce((s, c) => s + c.dueAmount, 0).toFixed(0)}</strong>
          </div>
        </div>

        {/* Global Controls: Language & Scenario Bar */}
        <div className="px-3 sm:px-5 py-2 bg-stone-100/90 border-b border-stone-200/80 space-y-1.5 shrink-0 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            {/* Language Selection */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-black text-stone-600 flex items-center gap-1">
                <Globe className="w-3.5 h-3.5 text-blue-600" />
                <span>{isBn ? 'ভাষা:' : 'Language:'}</span>
              </span>
              <div className="flex items-center gap-1 bg-white p-0.5 rounded-xl border border-stone-200">
                <button
                  type="button"
                  onClick={() => {
                    setMessageLang('bn');
                    setIsEditingMessage(false);
                    setIsEditingBulkMessage(false);
                  }}
                  className={`px-2 py-0.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    messageLang === 'bn' ? 'bg-emerald-600 text-white shadow-2xs' : 'text-stone-700 hover:bg-stone-50'
                  }`}
                >
                  🇧🇩 বাংলা
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMessageLang('hi');
                    setIsEditingMessage(false);
                    setIsEditingBulkMessage(false);
                  }}
                  className={`px-2 py-0.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    messageLang === 'hi' ? 'bg-emerald-600 text-white shadow-2xs' : 'text-stone-700 hover:bg-stone-50'
                  }`}
                >
                  🇮🇳 हिंदी
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMessageLang('hinglish');
                    setIsEditingMessage(false);
                    setIsEditingBulkMessage(false);
                  }}
                  className={`px-2 py-0.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    messageLang === 'hinglish' ? 'bg-emerald-600 text-white shadow-2xs' : 'text-stone-700 hover:bg-stone-50'
                  }`}
                >
                  🔤 Hinglish
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMessageLang('en');
                    setIsEditingMessage(false);
                    setIsEditingBulkMessage(false);
                  }}
                  className={`px-2 py-0.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    messageLang === 'en' ? 'bg-emerald-600 text-white shadow-2xs' : 'text-stone-700 hover:bg-stone-50'
                  }`}
                >
                  🇬🇧 English
                </button>
              </div>
            </div>

            {/* Scenario Selection */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-black text-stone-600 flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>{isBn ? 'ধরন:' : 'Type:'}</span>
              </span>
              <div className="flex items-center gap-1 bg-white p-0.5 rounded-xl border border-stone-200">
                <button
                  type="button"
                  onClick={() => {
                    setScenario('purchase_trip');
                    setIsEditingMessage(false);
                    setIsEditingBulkMessage(false);
                  }}
                  className={`px-2 py-0.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                    scenario === 'purchase_trip' ? 'bg-amber-500 text-white shadow-2xs' : 'text-stone-700 hover:bg-stone-50'
                  }`}
                  title={isBn ? 'দিল্লি/কলকাতায় মাল কেনার আগে তাগাদা' : 'Wholesale Purchase Trip Reminder'}
                >
                  <ShoppingBag className="w-3 h-3" />
                  <span>{isBn ? 'মাল কেনা (দিল্লি/কলকাতা)' : 'Purchase Trip'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setScenario('general');
                    setIsEditingMessage(false);
                    setIsEditingBulkMessage(false);
                  }}
                  className={`px-2 py-0.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                    scenario === 'general' ? 'bg-blue-600 text-white shadow-2xs' : 'text-stone-700 hover:bg-stone-50'
                  }`}
                >
                  <Clock className="w-3 h-3" />
                  <span>{isBn ? 'সাধারণ' : 'General'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setScenario('urgent');
                    setIsEditingMessage(false);
                    setIsEditingBulkMessage(false);
                  }}
                  className={`px-2 py-0.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                    scenario === 'urgent' ? 'bg-rose-600 text-white shadow-2xs' : 'text-stone-700 hover:bg-stone-50'
                  }`}
                >
                  <AlertTriangle className="w-3 h-3" />
                  <span>{isBn ? 'জরুরি' : 'Urgent'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Destination Selector for Purchase Trip */}
          {scenario === 'purchase_trip' && (
            <div className="flex items-center gap-1.5 text-xs pt-0.5 overflow-x-auto">
              <span className="text-[10px] font-black text-amber-900 shrink-0 flex items-center gap-1">
                <MapPin className="w-3 h-3 text-amber-600" />
                <span>{isBn ? 'গন্তব্য:' : 'Destination:'}</span>
              </span>
              <button
                type="button"
                onClick={() => {
                  setDestination('delhi_kolkata');
                  setIsEditingMessage(false);
                  setIsEditingBulkMessage(false);
                }}
                className={`px-2.5 py-0.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer shrink-0 ${
                  destination === 'delhi_kolkata'
                    ? 'bg-amber-600 text-white font-black shadow-2xs'
                    : 'bg-white hover:bg-amber-50 text-stone-700 border border-stone-200'
                }`}
              >
                ⭐ {isBn ? 'দিল্লি এবং কলকাতা' : 'Delhi & Kolkata'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setDestination('delhi');
                  setIsEditingMessage(false);
                  setIsEditingBulkMessage(false);
                }}
                className={`px-2.5 py-0.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer shrink-0 ${
                  destination === 'delhi'
                    ? 'bg-amber-600 text-white font-black shadow-2xs'
                    : 'bg-white hover:bg-amber-50 text-stone-700 border border-stone-200'
                }`}
              >
                {isBn ? 'দিল্লি' : 'Delhi'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setDestination('kolkata');
                  setIsEditingMessage(false);
                  setIsEditingBulkMessage(false);
                }}
                className={`px-2.5 py-0.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer shrink-0 ${
                  destination === 'kolkata'
                    ? 'bg-amber-600 text-white font-black shadow-2xs'
                    : 'bg-white hover:bg-amber-50 text-stone-700 border border-stone-200'
                }`}
              >
                {isBn ? 'কলকাতা' : 'Kolkata'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setDestination('surat_mumbai');
                  setIsEditingMessage(false);
                  setIsEditingBulkMessage(false);
                }}
                className={`px-2.5 py-0.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer shrink-0 ${
                  destination === 'surat_mumbai'
                    ? 'bg-amber-600 text-white font-black shadow-2xs'
                    : 'bg-white hover:bg-amber-50 text-stone-700 border border-stone-200'
                }`}
              >
                {isBn ? 'সুরাট ও মুম্বাই' : 'Surat & Mumbai'}
              </button>
            </div>
          )}
        </div>

        {/* Content Body */}
        <div className="p-3 sm:p-4 overflow-y-auto space-y-3.5 flex-1">
          {receivableDues.length === 0 ? (
            <div className="py-12 text-center space-y-3">
              <Check className="w-12 h-12 text-emerald-500 mx-auto" />
              <div className="font-extrabold text-stone-800 text-sm">
                {isBn ? 'কোনো বকেয়া বাকি নেই!' : 'No pending dues to collect!'}
              </div>
              <p className="text-xs text-stone-400 max-w-xs mx-auto">
                {isBn
                  ? 'আপনার সব কাস্টমারের হিসাব পরিশোধ রয়েছে অথবা কোনো বাকি নেই।'
                  : 'All customer balances are settled.'}
              </p>
            </div>
          ) : activeMode === 'single' ? (
            /* ================= SINGLE CUSTOMER VIEW ================= */
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
              {/* Customer Selector Sidebar */}
              <div className="md:col-span-4 space-y-2 border-b md:border-b-0 md:border-r border-stone-200 pb-3 md:pb-0 md:pr-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-black text-stone-500 uppercase tracking-wider">
                    {isBn ? 'কাস্টমার তালিকা' : 'Customer List'}
                  </span>
                  <span className="text-[10px] font-bold font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                    {receivableDues.length} {isBn ? 'জন' : 'Customers'}
                  </span>
                </div>

                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder={isBn ? 'কাস্টমার খুঁজুন...' : 'Search customer...'}
                    className="w-full bg-stone-100 pl-8 pr-3 py-1.5 rounded-xl text-xs font-semibold focus:outline-none focus:bg-white border border-stone-200"
                  />
                </div>

                <div className="max-h-56 md:max-h-96 overflow-y-auto space-y-1 divide-y divide-stone-50">
                  {filteredList.map((c, cIdx) => {
                    const isSelected = activeCustomer?.id === c.id;
                    return (
                      <button
                        key={`${c.id || 'cust'}-${cIdx}`}
                        type="button"
                        onClick={() => {
                          setSelectedCustomerId(c.id);
                          setIsEditingMessage(false);
                          handleResetAudio();
                        }}
                        className={`w-full p-2.5 rounded-2xl text-left transition-all cursor-pointer flex items-center justify-between gap-2 ${
                          isSelected
                            ? 'bg-emerald-50 text-emerald-950 border border-emerald-300 ring-1 ring-emerald-300 shadow-2xs'
                            : 'hover:bg-stone-50 text-stone-800 border border-transparent'
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="font-extrabold text-xs truncate">{c.name}</div>
                          <div className="text-[10px] font-mono text-stone-500">
                            {c.phone || (isBn ? 'ফোন নম্বর নেই' : 'No phone')}
                          </div>
                        </div>
                        <div className="font-mono font-black text-xs text-rose-600 shrink-0">
                          {sym}{c.dueAmount.toFixed(0)}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Message Generator & Direct Action Box */}
              <div className="md:col-span-8 space-y-3">
                {activeCustomer ? (
                  <>
                    {/* Active Customer Details Bar */}
                    <div className="p-3 bg-stone-50 rounded-2xl border border-stone-200 flex items-center justify-between gap-2 shadow-2xs">
                      <div className="min-w-0">
                        <span className="text-[10px] font-bold text-stone-400 block uppercase">
                          {isBn ? 'নির্বাচিত কাস্টমার' : 'Selected Customer'}
                        </span>
                        <div className="font-black text-sm text-stone-900 truncate flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-blue-600" />
                          <span>{activeCustomer.name}</span>
                        </div>
                        {activeCustomer.phone && (
                          <div className="text-[11px] font-mono text-stone-600 flex items-center gap-1 mt-0.5">
                            <Phone className="w-3 h-3 text-emerald-600" />
                            <span>{activeCustomer.phone}</span>
                            {activeCustomer.phone.length === 10 && (
                              <span className="text-[9px] bg-stone-200 text-stone-600 px-1 rounded font-sans">
                                +91 ইন্ডিয়ান
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="text-right shrink-0">
                        <span className="text-[10px] font-bold text-stone-400 block">
                          {isBn ? 'বকেয়া পাওনা' : 'Due Amount'}
                        </span>
                        <div className="text-base font-black font-mono text-rose-600">
                          {sym}{activeCustomer.dueAmount.toFixed(2)}
                        </div>
                      </div>
                    </div>

                    {/* Live Message Preview & Editor */}
                    <div className="space-y-1.5 pt-0.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-extrabold text-stone-700 flex items-center gap-1.5">
                          <MessageCircle className="w-4 h-4 text-emerald-600" />
                          <span>{isBn ? 'হোয়াটসঅ্যাপ মেসেজ ড্রাফট:' : 'WhatsApp Message Draft:'}</span>
                        </span>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleResetToTemplate(activeCustomer)}
                            className="text-[11px] font-semibold text-stone-500 hover:text-stone-800 flex items-center gap-1 cursor-pointer"
                            title={isBn ? 'স্বয়ংক্রিয় মূল ফরম্যাটে ফেরত যান' : 'Reset to template'}
                          >
                            <RotateCcw className="w-3 h-3" />
                            <span>{isBn ? 'রিসেট' : 'Reset'}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setIsEditingMessage((prev) => !prev)}
                            className="text-[11px] font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer bg-blue-50 px-2.5 py-1 rounded-xl border border-blue-200"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            <span>{isEditingMessage ? (isBn ? '✓ সম্পন্ন' : 'Done') : (isBn ? '✏️ মেসেজ এডিট করুন' : 'Edit Text')}</span>
                          </button>
                        </div>
                      </div>

                      {isEditingMessage ? (
                        <textarea
                          rows={8}
                          value={currentSingleMessage}
                          onChange={(e) => {
                            const customKey = `${activeCustomer.id}-${messageLang}-${scenario}-${destination}`;
                            setCustomizedMessages((prev) => ({
                              ...prev,
                              [customKey]: e.target.value,
                            }));
                          }}
                          className="w-full bg-white border-2 border-blue-400 rounded-2xl p-3 text-xs font-sans text-stone-900 focus:outline-none focus:ring-2 focus:ring-blue-500 leading-relaxed font-medium"
                          placeholder={isBn ? 'মেসেজ এডিট করুন...' : 'Edit reminder message...'}
                        />
                      ) : (
                        <div
                          onClick={() => setIsEditingMessage(true)}
                          className="bg-emerald-50/70 hover:bg-emerald-50 border border-emerald-200/90 rounded-2xl p-3.5 text-xs text-stone-800 whitespace-pre-line leading-relaxed font-sans shadow-2xs cursor-pointer"
                          title={isBn ? 'ক্লিক করে এডিট করুন' : 'Click to edit'}
                        >
                          {currentSingleMessage}
                        </div>
                      )}
                    </div>

                    {/* Action Buttons: Direct WhatsApp Send + Copy */}
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => handleSendWhatsApp(activeCustomer)}
                        className="w-full py-3 px-3 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white rounded-xl text-xs font-black flex items-center justify-center gap-1.5 cursor-pointer shadow-md transition-all"
                      >
                        <Send className="w-4 h-4 stroke-[2.5]" />
                        <span>{isBn ? '💬 হোয়াটসঅ্যাপে সরাসরি পাঠান' : 'Send WhatsApp Message'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleCopyMessage(activeCustomer)}
                        className={`w-full py-3 px-3 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 cursor-pointer transition-all border ${
                          copiedId === activeCustomer.id
                            ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                            : 'bg-stone-100 hover:bg-stone-200 text-stone-800 border-stone-300'
                        }`}
                      >
                        {copiedId === activeCustomer.id ? (
                          <>
                            <Check className="w-4 h-4 text-emerald-700 stroke-[3]" />
                            <span className="font-black">{isBn ? '✓ মেসেজ কপি হয়েছে!' : '✓ Copied!'}</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>{isBn ? '📋 মেসেজ কপি করুন' : 'Copy Message'}</span>
                          </>
                        )}
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="p-8 text-center text-xs text-stone-400">
                    {isBn ? 'বামপাশ থেকে একজন কাস্টমার নির্বাচন করুন।' : 'Select a customer from the left.'}
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* ================= BULK REMINDER VIEW ================= */
            <div className="space-y-3">
              {/* HOW TO SEND TO EVERYONE AT ONCE (ব্রডকাস্ট ব্যানার) */}
              <div className="p-3 bg-gradient-to-r from-emerald-50 to-teal-50 border-2 border-emerald-300 rounded-2xl space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-7 h-7 rounded-xl bg-emerald-600 text-white flex items-center justify-center text-xs">
                      📢
                    </span>
                    <div>
                      <div className="font-black text-xs text-emerald-950 flex items-center gap-1.5">
                        <span>{isBn ? 'একসাথে সবার কাছে মেসেজ পাঠাতে চান?' : 'Want to send to everyone at once?'}</span>
                      </div>
                      <div className="text-[10px] text-emerald-800 font-medium">
                        {isBn
                          ? 'হোয়াটসঅ্যাপ ব্রডকাস্ট দিয়ে ১-ক্লিকেই সকল কাস্টমারকে একসাথে মেসেজ পাঠানো যায়'
                          : 'Use WhatsApp Broadcast to message all customers simultaneously'}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowBroadcastInfo((p) => !p)}
                    className="text-[11px] font-bold text-emerald-700 hover:text-emerald-900 underline cursor-pointer"
                  >
                    {showBroadcastInfo ? (isBn ? 'সংক্ষিপ্ত ▲' : 'Less ▲') : (isBn ? 'কীভাবে করবেন? ▼' : 'How it works? ▼')}
                  </button>
                </div>

                {showBroadcastInfo && (
                  <div className="p-2.5 bg-white rounded-xl border border-emerald-200 text-[11px] text-stone-700 space-y-1.5 leading-relaxed">
                    <p className="font-bold text-emerald-900">
                      💡 {isBn ? 'হোয়াটসঅ্যাপে একসাথে সবাইকে পাঠানোর নিয়ম:' : 'How to send together on WhatsApp:'}
                    </p>
                    <ol className="list-decimal pl-4 space-y-1 text-stone-600">
                      <li>{isBn ? 'হোয়াটসঅ্যাপে গিয়ে থ্রি-ডট (⋮) মেন্যু থেকে "New Broadcast" (নতুন ব্রডকাস্ট) খুলুন।' : 'In WhatsApp, tap ⋮ Menu and select "New Broadcast".'}</li>
                      <li>{isBn ? 'আপনার বকেয়া থাকা কাস্টমারদের ব্রডকাস্ট লিস্টে সিলেক্ট করুন।' : 'Select all your pending due customers.'}</li>
                      <li>{isBn ? 'নিচের "📢 ব্রডকাস্ট মেসেজ কপি ও হোয়াটসঅ্যাপ খুলুন" বাটনে চাপ দিয়ে মেসেজটি ব্রডকাস্টে পেস্ট করে সেন্ড করুন। সবার কাছে এক মুহূর্তে পৌঁছে যাবে!' : 'Paste the copied broadcast text and send once to reach everyone!'}</li>
                    </ol>
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-2 pt-0.5">
                  <button
                    type="button"
                    onClick={handleOpenWhatsAppBroadcast}
                    className="flex-1 py-2 px-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black flex items-center justify-center gap-1.5 shadow-sm cursor-pointer transition-all active:scale-98"
                  >
                    <Radio className="w-3.5 h-3.5 text-white" />
                    <span>{isBn ? '📢 ব্রডকাস্ট মেসেজ কপি ও হোয়াটসঅ্যাপ খুলুন' : 'Open WhatsApp Broadcast'}</span>
                    <ExternalLink className="w-3 h-3 text-emerald-200" />
                  </button>

                  <button
                    type="button"
                    onClick={handleCopyAllBulkBroadcast}
                    className="py-2 px-3 bg-white hover:bg-stone-50 text-stone-800 rounded-xl text-xs font-bold border border-stone-300 flex items-center gap-1.5 cursor-pointer shadow-2xs"
                  >
                    <Copy className="w-3.5 h-3.5 text-stone-600" />
                    <span>{bulkCopySuccess ? (isBn ? '✓ কপি হয়েছে!' : 'Copied!') : (isBn ? '📋 সবার আলাদা মেসেজ কপি' : 'Copy All')}</span>
                  </button>
                </div>
              </div>

              {/* Bulk Filters & Selection Toolbar */}
              <div className="p-3 bg-stone-50 rounded-2xl border border-stone-200 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  {/* Left: Quick filters */}
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-stone-600 flex items-center gap-1">
                      <Filter className="w-3.5 h-3.5 text-stone-400" />
                      <span>{isBn ? 'ফিল্টার:' : 'Filter:'}</span>
                    </span>

                    <label className="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-xl border border-stone-200 cursor-pointer font-semibold text-stone-700">
                      <input
                        type="checkbox"
                        checked={bulkOnlyWithPhone}
                        onChange={(e) => setBulkOnlyWithPhone(e.target.checked)}
                        className="rounded text-emerald-600 focus:ring-emerald-500"
                      />
                      <span>{isBn ? 'শুধু মোবাইল নম্বর থাকা কাস্টমার' : 'Only with Phone'}</span>
                    </label>

                    <div className="flex items-center gap-1 bg-white px-2 py-0.5 rounded-xl border border-stone-200 text-[11px]">
                      <span className="text-stone-400 font-medium">{isBn ? 'ন্যূনতম বাকি:' : 'Min Due:'}</span>
                      <button
                        type="button"
                        onClick={() => setBulkMinAmount(0)}
                        className={`px-1.5 py-0.5 rounded-lg font-bold cursor-pointer ${
                          bulkMinAmount === 0 ? 'bg-emerald-600 text-white' : 'text-stone-600 hover:bg-stone-100'
                        }`}
                      >
                        {isBn ? 'সব' : 'All'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setBulkMinAmount(500)}
                        className={`px-1.5 py-0.5 rounded-lg font-bold cursor-pointer ${
                          bulkMinAmount === 500 ? 'bg-emerald-600 text-white' : 'text-stone-600 hover:bg-stone-100'
                        }`}
                      >
                        &gt; {sym}500
                      </button>
                      <button
                        type="button"
                        onClick={() => setBulkMinAmount(1000)}
                        className={`px-1.5 py-0.5 rounded-lg font-bold cursor-pointer ${
                          bulkMinAmount === 1000 ? 'bg-emerald-600 text-white' : 'text-stone-600 hover:bg-stone-100'
                        }`}
                      >
                        &gt; {sym}1000
                      </button>
                    </div>
                  </div>

                  {/* Right: Select All / Deselect */}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleBulkSelectAll}
                      className="text-[11px] font-bold text-emerald-700 hover:text-emerald-900 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-xl cursor-pointer"
                    >
                      {isBn ? '✓ সবগুলো বাছুন' : 'Select All'} ({bulkEligibleList.length})
                    </button>
                    <button
                      type="button"
                      onClick={handleBulkDeselectAll}
                      className="text-[11px] font-semibold text-stone-500 hover:text-stone-800 bg-white border border-stone-200 px-2.5 py-1 rounded-xl cursor-pointer"
                    >
                      {isBn ? 'বাতিল' : 'Deselect'}
                    </button>
                  </div>
                </div>

                {/* Queue Summary & Progress Bar */}
                <div className="pt-1 border-t border-stone-200/80 space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-black text-stone-800">
                        {isBn ? 'কাতারে নির্বাচিত:' : 'In Queue:'}{' '}
                        <strong className="text-emerald-700 font-mono text-sm">{bulkQueue.length}</strong> {isBn ? 'জন' : 'customers'}
                      </span>
                      <span className="text-stone-300">|</span>
                      <span className="font-bold text-stone-600 font-mono">
                        {isBn ? 'মোট বকেয়া:' : 'Total:'} <span className="text-rose-600 font-black">{sym}{totalBulkDueAmount.toFixed(0)}</span>
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-bold font-mono text-emerald-700">
                        {bulkSentIds.size} / {bulkQueue.length} {isBn ? 'পাঠানো হয়েছে' : 'sent'} ({bulkProgressPercent}%)
                      </span>
                    </div>
                  </div>

                  {/* Progress Line */}
                  <div className="w-full bg-stone-200 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-emerald-600 h-full transition-all duration-300"
                      style={{ width: `${bulkProgressPercent}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Guided One-by-One Queue Player with Direct Edit & Direct Send */}
              {bulkQueue.length > 0 && currentBulkCustomer ? (
                <div className="p-3.5 bg-gradient-to-br from-emerald-50 to-teal-50/50 rounded-3xl border-2 border-emerald-300 shadow-sm space-y-2.5">
                  {/* Stepper Header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-1 bg-emerald-600 text-white text-xs font-black rounded-xl font-mono">
                        {isBn ? `কাস্টমার ${bulkQueueIndex + 1} / ${bulkQueue.length}` : `Customer ${bulkQueueIndex + 1} of ${bulkQueue.length}`}
                      </span>

                      {bulkSentIds.has(currentBulkCustomer.id) ? (
                        <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[11px] font-bold rounded-full flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>{isBn ? 'পাঠানো হয়েছে' : 'Sent'}</span>
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 bg-amber-100 text-amber-800 text-[11px] font-bold rounded-full">
                          {isBn ? 'অপেক্ষমান' : 'Pending'}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        disabled={bulkQueueIndex === 0}
                        onClick={() => {
                          setBulkQueueIndex((prev) => Math.max(0, prev - 1));
                          setIsEditingBulkMessage(false);
                        }}
                        className="p-1.5 rounded-xl bg-white border border-stone-200 text-stone-700 hover:bg-stone-50 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                        title={isBn ? 'পূর্ববর্তী কাস্টমার' : 'Previous Customer'}
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        disabled={bulkQueueIndex === bulkQueue.length - 1}
                        onClick={() => {
                          setBulkQueueIndex((prev) => Math.min(bulkQueue.length - 1, prev + 1));
                          setIsEditingBulkMessage(false);
                        }}
                        className="p-1.5 rounded-xl bg-white border border-stone-200 text-stone-700 hover:bg-stone-50 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                        title={isBn ? 'পরবর্তী কাস্টমার / স্কিপ' : 'Next / Skip'}
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Customer Card */}
                  <div className="bg-white p-3 rounded-2xl border border-stone-200 flex items-center justify-between gap-3 shadow-2xs">
                    <div className="min-w-0">
                      <div className="text-sm font-black text-stone-900 truncate flex items-center gap-1.5">
                        <User className="w-4 h-4 text-emerald-600" />
                        <span>{currentBulkCustomer.name}</span>
                      </div>
                      <div className="text-xs font-mono text-stone-600 flex items-center gap-1.5 mt-0.5">
                        <Phone className="w-3.5 h-3.5 text-emerald-600" />
                        <span>{currentBulkCustomer.phone || (isBn ? 'ফোন নম্বর নেই' : 'No phone')}</span>
                        {currentBulkCustomer.phone && (
                          <span className="text-[10px] bg-stone-100 text-stone-600 px-1 rounded font-sans">
                            +91 Indian
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-[10px] text-stone-400 font-bold block uppercase">{isBn ? 'বকেয়া' : 'Due'}</span>
                      <span className="text-base sm:text-lg font-black font-mono text-rose-600">
                        {sym}{currentBulkCustomer.dueAmount.toFixed(2)}
                      </span>
                    </div>
                  </div>

                  {/* Bulk Message Box WITH VERY CLEAR INLINE EDIT BUTTON */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-extrabold text-stone-700 flex items-center gap-1.5">
                        <MessageCircle className="w-4 h-4 text-emerald-600" />
                        <span>{isBn ? 'হোয়াটসঅ্যাপ মেসেজ:' : 'WhatsApp Message:'}</span>
                      </span>

                      <div className="flex items-center gap-1.5">
                        {/* Master Template Customizer Toggle */}
                        <button
                          type="button"
                          onClick={() => {
                            if (!isEditingMasterTemplate && !bulkMasterTemplate) {
                              setBulkMasterTemplate(
                                getTemplateMessage(
                                  { ...currentBulkCustomer, name: '{name}', dueAmount: 0 },
                                  messageLang,
                                  scenario,
                                  destination
                                ).replace(/₹0\.00|0\.00/g, '{amount}')
                              );
                            }
                            setIsEditingMasterTemplate((prev) => !prev);
                          }}
                          className="text-[11px] font-bold text-teal-800 hover:text-teal-950 flex items-center gap-1 cursor-pointer bg-teal-100 hover:bg-teal-200 px-2 py-1 rounded-xl border border-teal-300 transition-all shadow-2xs"
                        >
                          <Layers className="w-3.5 h-3.5 text-teal-700" />
                          <span>{isBn ? 'সবার টেমপ্লেট এডিট' : 'Master Template'}</span>
                        </button>

                        {/* Reset Button */}
                        <button
                          type="button"
                          onClick={() => handleResetToTemplate(currentBulkCustomer)}
                          className="text-[11px] font-semibold text-stone-600 hover:text-stone-900 flex items-center gap-1 cursor-pointer bg-stone-100 hover:bg-stone-200 px-2 py-1 rounded-xl border border-stone-200"
                          title={isBn ? 'স্বয়ংক্রিয় মূল ফরম্যাটে ফেরত যান' : 'Reset to template'}
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>{isBn ? 'রিসেট' : 'Reset'}</span>
                        </button>

                        {/* Individual Edit Toggle Button - PROMINENT BLUE */}
                        <button
                          type="button"
                          onClick={() => setIsEditingBulkMessage((prev) => !prev)}
                          className={`text-[11px] font-black flex items-center gap-1 cursor-pointer px-2.5 py-1 rounded-xl transition-all shadow-2xs ${
                            isEditingBulkMessage
                              ? 'bg-blue-600 text-white ring-2 ring-blue-400'
                              : 'bg-blue-100 hover:bg-blue-200 text-blue-800 border border-blue-300'
                          }`}
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>{isEditingBulkMessage ? (isBn ? '✓ এডিট সম্পন্ন' : 'Done') : (isBn ? '✏️ মেসেজ এডিট করুন' : 'Edit Text')}</span>
                        </button>
                      </div>
                    </div>

                    {/* Master Template Editor Panel */}
                    {isEditingMasterTemplate && (
                      <div className="p-3 bg-amber-50/95 border-2 border-amber-300 rounded-2xl space-y-2 text-xs animate-in fade-in duration-100">
                        <div className="flex items-center justify-between font-bold text-amber-900">
                          <span>{isBn ? '📝 সবার জন্য কাস্টম টেমপ্লেট (Master Template):' : 'Custom Master Template for All:'}</span>
                          <span className="text-[10px] text-amber-700 font-normal">
                            ভেরিয়েবল: <code className="bg-amber-100 px-1 rounded">{'{name}'}</code> <code className="bg-amber-100 px-1 rounded">{'{amount}'}</code> <code className="bg-amber-100 px-1 rounded">{'{destination}'}</code>
                          </span>
                        </div>
                        <textarea
                          rows={6}
                          value={bulkMasterTemplate}
                          onChange={(e) => setBulkMasterTemplate(e.target.value)}
                          placeholder="আপনার পছন্দমতো পুরো মেসেজটি এখানে লিখুন..."
                          className="w-full bg-white border border-amber-300 rounded-xl p-2.5 text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-500 font-sans"
                        />
                        <div className="flex items-center justify-between">
                          <button
                            type="button"
                            onClick={() => setBulkMasterTemplate('')}
                            className="text-[11px] text-stone-500 hover:underline cursor-pointer"
                          >
                            {isBn ? 'ডিফল্ট টেমপ্লেটে ফিরে যান' : 'Clear Custom Template'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setIsEditingMasterTemplate(false)}
                            className="px-3.5 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded-xl font-bold text-xs cursor-pointer shadow-xs"
                          >
                            {isBn ? '✓ প্রযোজ্য করুন' : 'Apply to All'}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Active Customer Message: Directly Editable Textarea or Click-to-Edit Div */}
                    {isEditingBulkMessage ? (
                      <div className="space-y-1">
                        <textarea
                          rows={6}
                          value={currentBulkMessage}
                          onChange={(e) => {
                            const customKey = `${currentBulkCustomer.id}-${messageLang}-${scenario}-${destination}`;
                            setCustomizedMessages((prev) => ({
                              ...prev,
                              [customKey]: e.target.value,
                            }));
                          }}
                          className="w-full bg-white border-2 border-blue-500 rounded-2xl p-3 text-xs font-sans text-stone-900 focus:outline-none focus:ring-2 focus:ring-blue-500 leading-relaxed font-medium shadow-inner"
                          placeholder={isBn ? 'মেসেজ পরিবর্তন বা এডিট করুন...' : 'Edit reminder message for this customer...'}
                          autoFocus
                        />
                        <div className="text-right">
                          <button
                            type="button"
                            onClick={() => setIsEditingBulkMessage(false)}
                            className="px-3 py-1 bg-blue-600 text-white rounded-lg text-xs font-bold cursor-pointer"
                          >
                            {isBn ? '✓ এডিট সেভ করুন' : 'Save Edit'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div
                        onClick={() => setIsEditingBulkMessage(true)}
                        className="bg-white/95 hover:bg-white border border-stone-200 hover:border-blue-300 rounded-2xl p-3 text-xs text-stone-800 whitespace-pre-line leading-relaxed font-sans max-h-36 overflow-y-auto shadow-2xs cursor-pointer relative group"
                        title={isBn ? 'ক্লিক করে এডিট করুন' : 'Click to edit message'}
                      >
                        <div className="absolute top-2 right-2 opacity-60 group-hover:opacity-100 bg-blue-50 text-blue-700 text-[10px] font-bold px-2 py-0.5 rounded-md border border-blue-200">
                          ✏️ {isBn ? 'ক্লিক করে এডিট করুন' : 'Click to edit'}
                        </div>
                        {currentBulkMessage}
                      </div>
                    )}
                  </div>

                  {/* Audio & Voice Quick Bar for Bulk */}
                  <div className="p-2 bg-white/80 rounded-2xl border border-stone-200 flex flex-wrap items-center justify-between gap-1.5 text-xs">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleTogglePlayTTS(currentBulkMessage, messageLang)}
                        className={`px-2.5 py-1 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer transition-all ${
                          isPlayingTTS
                            ? 'bg-rose-600 text-white'
                            : 'bg-stone-100 hover:bg-stone-200 text-stone-800'
                        }`}
                      >
                        <Volume2 className="w-3.5 h-3.5 text-teal-600" />
                        <span>{isPlayingTTS ? (isBn ? 'থামান ⏹' : 'Stop') : (isBn ? '🔊 ভয়েস শুনুন' : 'Listen')}</span>
                      </button>

                      {isRecording ? (
                        <button
                          type="button"
                          onClick={handleStopRecording}
                          className="px-2.5 py-1 rounded-xl text-xs font-black bg-rose-600 text-white flex items-center gap-1 cursor-pointer animate-pulse"
                        >
                          <MicOff className="w-3.5 h-3.5" />
                          <span>{isBn ? `রেকর্ড শেষ (${recordingSeconds}s)` : `Stop (${recordingSeconds}s)`}</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={handleStartRecording}
                          className="px-2.5 py-1 rounded-xl text-xs font-bold bg-stone-100 hover:bg-stone-200 text-stone-800 flex items-center gap-1 cursor-pointer"
                        >
                          <Mic className="w-3.5 h-3.5 text-rose-600" />
                          <span>{isBn ? '🎙️ ভয়েস রেকর্ড' : 'Record Voice'}</span>
                        </button>
                      )}
                    </div>

                    {audioUrl && (
                      <button
                        type="button"
                        onClick={() => handleShareAudioAndText(currentBulkCustomer, currentBulkMessage)}
                        className="px-2.5 py-1 bg-teal-600 hover:bg-teal-500 text-white rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer shadow-xs"
                      >
                        <Share2 className="w-3 h-3" />
                        <span>{isBn ? 'অডিও + টেক্সট শেয়ার' : 'Share Audio + Text'}</span>
                      </button>
                    )}
                  </div>

                  {/* Big Primary Action: Send & Auto-Advance */}
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => handleBulkSendAndAdvance(currentBulkCustomer)}
                      className="sm:col-span-8 py-3 px-4 bg-emerald-600 hover:bg-emerald-500 active:scale-98 text-white rounded-2xl text-xs font-black flex items-center justify-center gap-2 cursor-pointer shadow-md transition-all"
                    >
                      <Send className="w-4 h-4 stroke-[2.5]" />
                      <span>
                        {isBn
                          ? '💬 হোয়াটসঅ্যাপে পাঠান ও পরবর্তী কাস্টমারে যান ▶'
                          : 'Send via WhatsApp & Advance to Next ▶'}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleCopyMessage(currentBulkCustomer)}
                      className={`sm:col-span-4 py-3 px-3 rounded-2xl text-xs font-extrabold flex items-center justify-center gap-1.5 cursor-pointer transition-all border ${
                        copiedId === currentBulkCustomer.id
                          ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                          : 'bg-white hover:bg-stone-50 text-stone-800 border-stone-300'
                      }`}
                    >
                      {copiedId === currentBulkCustomer.id ? (
                        <>
                          <Check className="w-4 h-4 text-emerald-700 stroke-[3]" />
                          <span className="font-black">{isBn ? 'কপি হয়েছে!' : 'Copied!'}</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>{isBn ? 'মেসেজ কপি' : 'Copy Message'}</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-8 text-center text-xs text-stone-400 bg-stone-50 rounded-2xl border border-stone-200">
                  {isBn
                    ? 'কোনো কাস্টমার নির্বাচিত নেই। উপরের তালিকা থেকে অন্তত একজন কাস্টমার নির্বাচন করুন।'
                    : 'No customer selected in the queue. Select customers above.'}
                </div>
              )}

              {/* Interactive Queue Grid / Checklist */}
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-black text-stone-700 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                    <ListOrdered className="w-3.5 h-3.5 text-stone-400" />
                    <span>{isBn ? 'বাল্ক কাতার তালিকা (ক্লিক করে জাম্প করুন)' : 'Bulk Queue List (Click to jump)'}</span>
                  </span>
                  <span className="text-[10px] text-stone-400 font-medium">
                    {isBn ? 'চেকবক্সে টিক দিয়ে নির্বাচন পরিবর্তন করুন' : 'Check/uncheck to customize list'}
                  </span>
                </div>

                <div className="max-h-44 overflow-y-auto divide-y divide-stone-100 bg-white rounded-2xl border border-stone-200">
                  {bulkEligibleList.map((c, idx) => {
                    const isSelected = bulkSelectedIds.has(c.id);
                    const isCurrent = currentBulkCustomer?.id === c.id;
                    const isSent = bulkSentIds.has(c.id);

                    return (
                      <div
                        key={`${c.id || 'cust'}-${idx}`}
                        className={`p-2 flex items-center justify-between gap-2 transition-colors ${
                          isCurrent
                            ? 'bg-emerald-50/80 border-l-4 border-l-emerald-600'
                            : 'hover:bg-stone-50'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <button
                            type="button"
                            onClick={() => handleBulkToggleSelect(c.id)}
                            className="cursor-pointer text-stone-400 hover:text-stone-700 shrink-0"
                          >
                            {isSelected ? (
                              <CheckSquare className="w-4 h-4 text-emerald-600" />
                            ) : (
                              <Square className="w-4 h-4 text-stone-300" />
                            )}
                          </button>

                          <div
                            onClick={() => {
                              const queueIdx = bulkQueue.findIndex((q) => q.id === c.id);
                              if (queueIdx >= 0) {
                                setBulkQueueIndex(queueIdx);
                                setIsEditingBulkMessage(false);
                              }
                            }}
                            className="cursor-pointer min-w-0"
                          >
                            <div className="font-bold text-xs text-stone-900 truncate flex items-center gap-1.5">
                              <span>{c.name}</span>
                              {isSent && (
                                <span className="text-[9px] bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded font-sans font-bold">
                                  ✓ Sent
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] font-mono text-stone-500">
                              {c.phone || (isBn ? 'ফোন নম্বর নেই' : 'No phone')}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2.5 shrink-0">
                          <span className="font-mono font-black text-xs text-rose-600">
                            {sym}{c.dueAmount.toFixed(0)}
                          </span>

                          <button
                            type="button"
                            onClick={() => {
                              handleSendWhatsApp(c);
                              setBulkSentIds((prev) => new Set([...prev, c.id]));
                            }}
                            className="p-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 cursor-pointer"
                            title={isBn ? 'হোয়াটসঅ্যাপে পাঠান' : 'Send WhatsApp'}
                          >
                            <Send className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2.5 bg-stone-50 border-t border-stone-200 flex items-center justify-between text-xs text-stone-500 shrink-0">
          <span>
            {isBn ? 'মোট বকেয়া কাস্টমার:' : 'Pending Customers:'}{' '}
            <strong className="text-stone-900 font-mono font-bold">{receivableDues.length}</strong>
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-stone-200 hover:bg-stone-300 text-stone-800 font-bold text-xs cursor-pointer transition-colors"
          >
            {isBn ? 'বন্ধ করুন' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
};
