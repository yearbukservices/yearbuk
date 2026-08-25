import { createContext, useContext, useState, useEffect } from 'react';
import { getUSDToNGNRate } from '@/lib/utils';

export type Currency = 'USD' | 'NGN';

interface CurrencyContextType {
  userCurrency: Currency;
  exchangeRate: number;
  setUserCurrency: (currency: Currency) => void;
  convertPrice: (usdAmount: number) => number;
  formatPrice: (amount: number, currency?: Currency) => string;
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const [userCurrency, setUserCurrency] = useState<Currency>('USD'); // Default to USD
  const [exchangeRate, setExchangeRate] = useState<number>(1650); // Default fallback rate
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // Fetch exchange rate when component mounts or when needed for NGN display
  useEffect(() => {
    getUSDToNGNRate().then(rate => {
      setExchangeRate(rate);
    });
  }, []);

  // Load user from localStorage and update when it changes
  useEffect(() => {
    const loadUser = () => {
      try {
        const storedUser = localStorage.getItem("user");
        if (storedUser) {
          const parsedUser = JSON.parse(storedUser);
          if (parsedUser?.id) {
            setCurrentUserId(parsedUser.id);
          } else {
            setCurrentUserId(null);
            setUserCurrency('USD'); // Reset to default when no user
          }
        } else {
          setCurrentUserId(null);
          setUserCurrency('USD'); // Reset to default when no user
        }
      } catch (error) {
        console.error("Error parsing user data in CurrencyContext:", error);
        setCurrentUserId(null);
        setUserCurrency('USD');
      }
    };

    // Load user on mount
    loadUser();

    // Listen for storage changes (when user logs in/out in another tab or via localStorage updates)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "user") {
        loadUser();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    
    // Also listen for custom events for same-tab updates
    const handleUserChange = () => loadUser();
    window.addEventListener('userChanged', handleUserChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('userChanged', handleUserChange);
    };
  }, []);

  // Load user's currency preference from localStorage when user changes
  useEffect(() => {
    if (!currentUserId) {
      setUserCurrency('USD'); // Reset to default when no user
      return;
    }
    
    const storageKey = `preferredCurrency_${currentUserId}`;
    const savedCurrency = localStorage.getItem(storageKey) as Currency;
    if (savedCurrency && (savedCurrency === 'USD' || savedCurrency === 'NGN')) {
      setUserCurrency(savedCurrency);
    } else {
      setUserCurrency('USD'); // Default for new users
    }
  }, [currentUserId]);

  const handleSetUserCurrency = (currency: Currency) => {
    setUserCurrency(currency);
    if (currentUserId) {
      const storageKey = `preferredCurrency_${currentUserId}`;
      localStorage.setItem(storageKey, currency);
    }
  };

  const convertPrice = (usdAmount: number): number => {
    // Base currency is USD, convert to NGN for display if needed
    if (userCurrency === 'NGN') {
      return usdAmount * exchangeRate;
    }
    return usdAmount; // Return USD amount as-is
  };

  const formatPrice = (amount: number, currency?: Currency): string => {
    const targetCurrency = currency || userCurrency;
    const numAmount = typeof amount === 'number' ? amount : parseFloat(String(amount)) || 0;
    
    if (targetCurrency === 'NGN') {
      return `₦${numAmount.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    return `$${numAmount.toFixed(2)}`;
  };

  return (
    <CurrencyContext.Provider
      value={{
        userCurrency,
        exchangeRate,
        setUserCurrency: handleSetUserCurrency,
        convertPrice,
        formatPrice,
      }}
    >
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  const context = useContext(CurrencyContext);
  if (context === undefined) {
    throw new Error('useCurrency must be used within a CurrencyProvider');
  }
  return context;
}