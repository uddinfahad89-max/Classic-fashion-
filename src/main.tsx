import React, { StrictMode, ReactNode, ErrorInfo } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

class AppErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, errorMessage: error?.message || 'Unknown error' };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('AppErrorBoundary caught an error:', error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleReset = () => {
    try {
      if (typeof window !== 'undefined' && window.caches) {
        window.caches.keys().then((keys) => {
          keys.forEach((k) => window.caches.delete(k));
        });
      }
    } catch {}
    window.location.href = window.location.pathname + '?reload=' + Date.now();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-stone-100 flex flex-col items-center justify-center p-6 text-center font-sans">
          <div className="bg-white border border-stone-200 rounded-2xl shadow-lg p-6 max-w-sm w-full">
            <div className="w-14 h-14 bg-amber-100 text-amber-700 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl font-bold">
              !
            </div>
            <h2 className="text-xl font-bold text-stone-900 mb-2">Classic Fashion POS</h2>
            <p className="text-sm text-stone-600 mb-4 leading-relaxed">
              পুরনো ডিভাইসে কোনো সমস্যার কারণে অ্যাপটি লোড হতে পারেনি। নিচের বোতামে চাপ দিয়ে পুনরায় চেষ্টা করুন:
            </p>
            <div className="space-y-2">
              <button
                onClick={this.handleReload}
                className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-sm transition-colors shadow-sm"
              >
                🔄 পুনরায় লোড করুন (Reload)
              </button>
              <button
                onClick={this.handleReset}
                className="w-full py-2 px-4 bg-stone-100 hover:bg-stone-200 text-stone-700 font-medium rounded-xl text-xs transition-colors border border-stone-300"
              >
                🧹 ক্যাশ ক্লিয়ার ও রিফ্রেশ
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

const rootElement = document.getElementById('root');
if (rootElement) {
  createRoot(rootElement).render(
    <StrictMode>
      <AppErrorBoundary>
        <App />
      </AppErrorBoundary>
    </StrictMode>,
  );
}

