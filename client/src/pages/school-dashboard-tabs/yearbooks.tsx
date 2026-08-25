import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Search, Grid3X3, List, Settings, ShoppingCart, Lock } from "lucide-react";
import { YearbookConfigDialog } from "@/components/YearbookConfigDialog";
import type { User, School } from "@shared/schema";
import { CURRENT_YEAR, SCHOOL_YEAR_PRICE, BETA_VERSION } from "@shared/constants";
import { useCurrency } from "@/contexts/CurrencyContext";
import { useToast } from "@/hooks/use-toast";

export default function SchoolYearbooks() {
  const [, setLocation] = useLocation();
  const [user, setUser] = useState<User | null>(null);
  const [yearSearchTerm, setYearSearchTerm] = useState("");
  const [yearViewMode, setYearViewMode] = useState<'grid' | 'list'>('grid');
  const [showPurchaseOverlay, setShowPurchaseOverlay] = useState(false);
  const [selectedYearForPurchase, setSelectedYearForPurchase] = useState<string>("");
  const { convertPrice, formatPrice } = useCurrency();
  const { toast } = useToast();

  useEffect(() => {
    const userData = localStorage.getItem("user");
    if (userData) {
      setUser(JSON.parse(userData));
    }
  }, []);

  const currentYear = CURRENT_YEAR;

  const { data: priceConfig } = useQuery<{ schoolYearPrice: number; viewerYearPrice: number; badgeSlotPrice: number }>({
    queryKey: ["/api/config/prices"],
  });

  const { data: school } = useQuery<School>({
    queryKey: ["/api/schools", user?.id],
    enabled: !!user,
    queryFn: async () => {
      if (!user?.id) throw new Error("No user");
      const res = await fetch(`/api/schools/${user.id}`);
      if (!res.ok) throw new Error("Failed to fetch school");
      return res.json();
    },
  });

  const { data: purchasedYears = [], isLoading: isPurchaseDataLoading } = useQuery({
    queryKey: ["/api/year-purchases", school?.id],
    enabled: !!school,
    queryFn: async () => {
      if (!user?.id) return [];
      const res = await fetch(`/api/year-purchases/school/${school?.id}`);
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: schoolYearbooks = [] } = useQuery({
    queryKey: ["/api/yearbooks-all", school?.id],
    enabled: !!school,
    queryFn: async () => {
      if (!school?.id) return [];
      const res = await fetch(`/api/yearbooks/${school.id}/all`);
      if (!res.ok) return [];
      return res.json();
    },
  });

  const mockYears = !school || isPurchaseDataLoading ? [] : (() => {
    const schoolFoundingYear = school?.yearFounded;
    const startYear = (schoolFoundingYear && schoolFoundingYear < 1980) ? 1980 : (schoolFoundingYear || 1980);
    const endYear = currentYear;
    
    return Array.from({ length: endYear - startYear + 1 }, (_, i) => {
      const year = endYear - i;
      
      if (year < startYear || year > endYear) return null;
    
      const yearPurchase = purchasedYears.find((p: any) => p.year === year);
      const purchased = !!yearPurchase?.purchased;
      
      const yearbook = schoolYearbooks.find((yb: any) => yb.year === year);
      const isFree = yearbook?.isFree || false;
      const priceExplicitlySet = yearbook?.price != null;
      const yearbookPrice = yearbook?.price ?? (priceConfig?.schoolYearPrice ?? SCHOOL_YEAR_PRICE);
      
      let status;
      if (purchased) {
        status = year === currentYear ? "Active" : "Archived";
      } else {
        status = "Available";
      }
      
      return { 
        year: year.toString(), 
        purchased, 
        status, 
        price: yearbookPrice,
        priceExplicitlySet,
        isFree 
      };
    }).filter(Boolean);
  })();

  const filteredYears = mockYears.filter((year: any) => 
    year && year.year.includes(yearSearchTerm)
  );

  const handleBuyYear = (year: string) => {
    setSelectedYearForPurchase(year);
    setShowPurchaseOverlay(true);
  };

  const handleManageYear = (year: string) => {
    setLocation(`/yearbook-manage/${year}?school=${school?.id}`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <h2 className="text-xl sm:text-2xl font-bold text-white">Year Management</h2>
      </div>

      <div className="mb-6">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-white/60 h-4 w-4" />
          <Input
            type="text"
            placeholder="Search years"
            value={yearSearchTerm}
            onChange={(e) => setYearSearchTerm(e.target.value)}
            className="pl-10 pr-4 py-2 w-full bg-white/10 backdrop-blur-lg border border-white/20 text-white placeholder:text-white/60"
            data-testid="input-search-years"
          />
        </div>
      </div>

      <Card className="bg-white/10 backdrop-blur-lg border border-white/20">
        <CardHeader>
          <CardTitle className="flex items-center justify-between text-white">
            <span>Available Years</span>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-blue-200">{filteredYears.length} years available</span>
              <div className="flex items-center bg-white/10 backdrop-blur-lg border border-white/20 rounded-lg p-1">
                <button
                  onClick={() => setYearViewMode('grid')}
                  className={`p-1.5 rounded ${yearViewMode === 'grid' ? 'bg-white/30 shadow-sm text-blue-300' : 'text-white/70 hover:text-white'}`}
                  title="Grid View"
                  data-testid="button-grid-view"
                >
                  <Grid3X3 className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setYearViewMode('list')}
                  className={`p-1.5 rounded ${yearViewMode === 'list' ? 'bg-white/30 shadow-sm text-blue-300' : 'text-white/70 hover:text-white'}`}
                  title="List View"
                  data-testid="button-list-view"
                >
                  <List className="h-4 w-4" />
                </button>
              </div>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isPurchaseDataLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="flex items-center space-x-3">
                <Loader2 className="h-6 w-6 animate-spin text-white" />
                <span className="text-white">Loading purchase status...</span>
              </div>
            </div>
          ) : yearViewMode === 'grid' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredYears.map((year: any) => year && (
                <div key={`year-${year.year}`} className="bg-white/5 backdrop-blur border border-white/20 rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-white">{year.year}</h3>
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      year.status === "Active" 
                        ? "bg-green-100 text-green-800" 
                        : year.status === "Archived"
                        ? "bg-blue-100 text-blue-800"
                        : "bg-gray-100 text-gray-800"
                    }`}>
                      {year.status}
                    </span>
                  </div>

                  {year.purchased && (
                    <div className="text-sm text-blue-200">
                      Price: <span className="font-semibold">{year.priceExplicitlySet ? formatPrice(convertPrice(year.price)) : 'Not set'}</span>
                      {year.isFree && <span className="ml-1 text-green-400">(free)</span>}
                    </div>
                  )}

                  <div className="flex space-x-2 ">
                    {isPurchaseDataLoading ? (
                      <Button 
                        className="flex-1 text-white border-gray-400 bg-gray-600/20"
                        size="sm" 
                        variant="outline" 
                        disabled
                        data-testid={`button-loading-year-${year.year}`}
                      >
                        <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                        Loading...
                      </Button>
                    ) : year.purchased ? (
                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={() => handleManageYear(year.year)}
                        className="flex-1 text-white border-blue-400 bg-blue-600/20 hover:bg-blue-600/30 transition-colors hover:text-white"
                        data-testid={`button-manage-year-${year.year}`}
                      >
                        <Settings className="h-4 w-4 mr-1 text-white" />
                        Manage
                      </Button>
                    ) : (
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => handleBuyYear(year.year)}
                        className={`flex-1 text-white transition-colors hover:text-white ${BETA_VERSION ? 'border-purple-400 bg-purple-600/20 hover:bg-purple-600/30' : 'border-green-400 bg-green-600/20 hover:bg-green-600/30'}`}
                        data-testid={`button-buy-year-${year.year}`}
                      >
                        {BETA_VERSION ? (
                          <><Lock className="h-4 w-4 mr-1" />Unlock</>
                        ) : (
                          <><ShoppingCart className="h-4 w-4 mr-1" />Buy {formatPrice(convertPrice(year.price))}</>
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredYears.map((year: any) => year && (
                <div key={`year-${year.year}`} className="flex items-center justify-between p-4 bg-white/5 backdrop-blur border border-white/20 rounded-lg hover:bg-white/10 transition-colors">
                  <div className="flex items-center space-x-4">
                    <div className="flex-shrink-0">
                      <span className="text-xl font-bold text-white">{year.year}</span>
                    </div>
                    <div className="flex items-center space-x-3">
                      <span className={`px-2 py-1 text-xs rounded-full font-medium ${
                        year.status === "Active" 
                          ? "bg-green-100 text-green-800" 
                          : year.status === "Archived"
                          ? "bg-blue-100 text-blue-800"
                          : "bg-gray-100 text-gray-800"
                      }`}>
                        {year.status}
                      </span>
                      {year.purchased && (
                        <span className="text-sm text-blue-200">
                          {year.priceExplicitlySet ? formatPrice(convertPrice(year.price)) : 'Not set'}
                          {year.isFree && <span className="ml-1 text-green-400">(free)</span>}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex-shrink-0 ">
                    {isPurchaseDataLoading ? (
                      <Button 
                        className="flex-1 text-white border-gray-400 bg-gray-600/20"
                        size="sm" 
                        variant="outline" 
                        disabled
                        data-testid={`button-loading-year-${year.year}`}
                      >
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Loading...
                      </Button>
                    ) : year.purchased ? (
                      <Button 
                         className="flex-1 text-white border-blue-400 bg-blue-600/20 hover:bg-blue-600/30 transition-colors hover:text-white"
                        size="sm" 
                        variant="outline" 
                        onClick={() => handleManageYear(year.year)}
                        data-testid={`button-manage-year-${year.year}`}
                      >
                        <Settings className="h-4 w-4 mr-2" />
                        Manage
                      </Button>
                    ) : (
                      <Button 
                        variant="outline"
                        className={`flex-1 text-white transition-colors hover:text-white ${BETA_VERSION ? 'border-purple-400 bg-purple-600/20 hover:bg-purple-600/30' : 'border-green-400 bg-green-600/20 hover:bg-green-600/30'}`}
                        size="sm" 
                        onClick={() => handleBuyYear(year.year)}
                        data-testid={`button-buy-year-${year.year}`}
                      >
                        {BETA_VERSION ? (
                          <><Lock className="h-4 w-4 mr-2" />Unlock</>
                        ) : (
                          <><ShoppingCart className="h-4 w-4 mr-2" />Buy {formatPrice(convertPrice(year.price))}</>
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {filteredYears.length === 0 && yearSearchTerm && (
            <div className="text-center py-8">
              <p className="text-white/70">No years found matching "{yearSearchTerm}"</p>
            </div>
          )}
        </CardContent>
      </Card>

      {showPurchaseOverlay && selectedYearForPurchase && user && school && (
        <YearbookConfigDialog
          isOpen={showPurchaseOverlay}
          onClose={() => setShowPurchaseOverlay(false)}
          year={selectedYearForPurchase}
          price={mockYears.find((y: any) => y && y.year === selectedYearForPurchase)?.price || 14.99}
          schoolId={school.id}
          userId={user.id}
          isFree={mockYears.find((y: any) => y && y.year === selectedYearForPurchase)?.isFree || false}
        />
      )}
    </div>
  );
}
