import React from 'react';
import {
  ShoppingBag,
  Users,
  BookOpen,
  Receipt,
  Truck,
} from 'lucide-react';
import { ActiveTab, Language } from '../types';

interface BottomNavProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  cartCount: number;
  invoicesCount: number;
  purchasesCount: number;
  duesCount?: number;
  language?: Language;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  activeTab,
  setActiveTab,
  cartCount,
  invoicesCount,
  purchasesCount,
  duesCount = 0,
  language = 'en',
}) => {
  const isBn = language === 'bn';

  // Strict 5-tab sequence: Billing -> Dues -> Daybook -> Invoices -> Purchases
  const navItems: {
    id: ActiveTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: number;
    badgeColor?: string;
  }[] = [
    {
      id: 'billing',
      label: isBn ? 'বিলিং' : 'Billing',
      icon: ShoppingBag,
      badge: cartCount,
      badgeColor: 'bg-blue-600 text-white',
    },
    {
      id: 'due',
      label: isBn ? 'বাকি খাতা' : 'Dues',
      icon: Users,
      badge: duesCount,
      badgeColor: 'bg-amber-600 text-white',
    },
    {
      id: 'cashbook',
      label: isBn ? 'ডেবুক' : 'Daybook',
      icon: BookOpen,
    },
    {
      id: 'invoices',
      label: isBn ? 'ইনভয়েস' : 'Invoices',
      icon: Receipt,
      badge: invoicesCount,
      badgeColor: 'bg-stone-700 text-white',
    },
    {
      id: 'purchases',
      label: isBn ? 'কেনাকাটা' : 'Purchases',
      icon: Truck,
      badge: purchasesCount,
      badgeColor: 'bg-emerald-600 text-white',
    },
  ];

  return (
    <nav
      id="fixed-bottom-bar"
      aria-label="Bottom Navigation"
      className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-stone-200/90 shadow-[0_-4px_20px_rgba(0,0,0,0.06)]"
    >
      <div className="max-w-xl mx-auto px-2 py-1.5 sm:py-2">
        <div className="grid grid-cols-5 gap-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                id={`bottom-nav-${item.id}`}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`relative flex flex-col items-center justify-center py-1.5 px-1 rounded-2xl transition-all cursor-pointer select-none ${
                  isActive
                    ? 'bg-blue-50/90 text-blue-700 font-extrabold shadow-2xs scale-[1.02]'
                    : 'text-stone-500 hover:text-stone-800 hover:bg-stone-100/70 font-medium'
                }`}
              >
                <div className="relative">
                  <Icon
                    className={`w-5 h-5 transition-transform ${
                      isActive ? 'stroke-[2.5] text-blue-600 scale-110' : 'text-stone-500'
                    }`}
                  />
                  {item.badge !== undefined && item.badge > 0 && (
                    <span
                      className={`absolute -top-1.5 -right-2.5 text-[9px] font-black px-1.5 py-0.2 rounded-full font-mono min-w-[15px] text-center leading-tight shadow-xs ${
                        item.badgeColor || 'bg-blue-600 text-white'
                      }`}
                    >
                      {item.badge > 99 ? '99+' : item.badge}
                    </span>
                  )}
                </div>
                <span
                  className={`text-[10px] sm:text-[11px] mt-1 tracking-tight leading-none ${
                    isActive ? 'text-blue-700 font-black' : 'text-stone-600'
                  }`}
                >
                  {item.label}
                </span>
                {isActive && (
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-600 mt-1"></span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
};
