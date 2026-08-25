import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Search, Settings } from "lucide-react";
import type { User, School, Memory } from "@shared/schema";
import { CURRENT_YEAR } from "@shared/constants";

export default function SchoolMemories() {
  const [, setLocation] = useLocation();
  const [user, setUser] = useState<User | null>(null);
  const [yearSearchTerm, setYearSearchTerm] = useState("");

  useEffect(() => {
    const userData = localStorage.getItem("user");
    if (userData) {
      setUser(JSON.parse(userData));
    }
  }, []);

  const currentYear = CURRENT_YEAR;

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

  const { data: pendingMemories = [] } = useQuery<Memory[]>({
    queryKey: ["/api/memories/pending", school?.id],
    enabled: !!school?.id,
    queryFn: async () => {
      if (!school?.id) return [];
      const res = await fetch(`/api/memories/school/${school.id}/pending`, {
        headers: {
          'Authorization': `Bearer ${user?.id}`
        }
      });
      if (!res.ok) throw new Error("Failed to fetch pending memories");
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

  const mockYears = !school || isPurchaseDataLoading ? [] : (() => {
    const schoolFoundingYear = school?.yearFounded;
    const startYear = (schoolFoundingYear && schoolFoundingYear < 1980) ? 1980 : (schoolFoundingYear || 1980);
    const endYear = currentYear;
    
    return Array.from({ length: endYear - startYear + 1 }, (_, i) => {
      const year = endYear - i;
      
      if (year < startYear || year > endYear) return null;
      
      return { 
        year: year.toString()
      };
    }).filter(Boolean);
  })();

  const filteredYears = mockYears.filter((year: any) => 
    year && year.year.includes(yearSearchTerm)
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <h2 className="text-xl sm:text-2xl font-bold text-white">Photos & Memories</h2>
        {pendingMemories.length > 0 && (
          <div className="bg-orange-500/20 text-orange-200 px-3 py-1 rounded-full text-sm">
            {pendingMemories.length} pending approval
          </div>
        )}
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
            <span className="text-sm font-normal text-blue-200">Storage for all years</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isPurchaseDataLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="flex items-center space-x-3">
                <Loader2 className="h-6 w-6 animate-spin text-white" />
                <span className="text-white">Loading years...</span>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredYears.map((year: any) => {
              if (!year) return null;
              return (
              <div key={year.year || 'unknown'} className="flex items-center justify-between p-4 bg-white/5 backdrop-blur border border-white/20 rounded-lg hover:bg-white/10">
                <div className="flex-1">
                  <div className="flex items-center space-x-3">
                    <div className="flex flex-col">
                      <h3 className="text-lg font-medium text-white">Year {year.year || 'Unknown'}</h3>
                      <p className="text-sm text-blue-200">
                        Photos & memories
                      </p>
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="text-right">
                    
                    <p className="text-xs text-blue-200">Storage</p>
                  </div>
                  <div className="relative">
                    <Button 
                      variant="outline"
                      onClick={() => setLocation(`/photos-memories-manage?year=${year.year || 'unknown'}&school=${school?.id}`)}
                      data-testid={`button-manage-memories-${year.year || 'unknown'}`} className="text-sm text-white border-white bg-black/20 hover:bg-blue-300/20 transition-colors hover:text-blue-600 border-white/20"
                    >
                      <Settings className="h-4 w-4 mr-1 text-white-100" />
                      
                      Manage
                    </Button>
                    {(() => {
                      const yearPendingCount = pendingMemories.filter(memory => memory.year?.toString() === year.year?.toString()).length;
                      return yearPendingCount > 0 ? (
                        <span 
                          className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center shadow-lg ring-2 ring-red-200 dark:ring-red-800 transition-all duration-200 ease-out"
                          data-testid={`notification-badge-pending-memories-year-${year.year}`}
                        >
                          {yearPendingCount}
                        </span>
                      ) : null;
                    })()}
                  </div>
                </div>
              </div>
              )
            }).filter(Boolean)}
            </div>
          )}

          {filteredYears.length === 0 && yearSearchTerm && (
            <div className="text-center py-8">
              <p className="text-white/70">No years found matching "{yearSearchTerm}"</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
