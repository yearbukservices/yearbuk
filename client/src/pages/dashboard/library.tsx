import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { BookOpen, Library, Folder, ChevronDown, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { User } from "@shared/schema";

export default function LibraryPage() {
  const [, setLocation] = useLocation();
  const [user, setUser] = useState<User | null>(null);
  const [expandedSchools, setExpandedSchools] = useState<Set<string>>(new Set());

  useEffect(() => {
    const userData = localStorage.getItem("user");
    if (userData) {
      setUser(JSON.parse(userData));
    }
  }, []);

  const { data: purchasedYearbooks = [] } = useQuery({
    queryKey: ["/api/library", user?.id],
    enabled: !!user,
    queryFn: async () => {
      if (!user?.id) return [];
      const res = await fetch(`/api/library/${user.id}`);
      if (!res.ok) throw new Error("Failed to fetch purchased yearbooks");
      return res.json();
    },
  });

  // Group purchased yearbooks by school to create school folders/shelves
  const groupedYearbooks = purchasedYearbooks.reduce((acc: any, yearbook: any) => {
    const schoolName = yearbook.school?.name || 'Unknown School';
    if (!acc[schoolName]) {
      acc[schoolName] = [];
    }
    acc[schoolName].push(yearbook);
    return acc;
  }, {});

  const schoolFolders = Object.keys(groupedYearbooks).sort();

  const toggleSchool = (schoolName: string) => {
    const newExpanded = new Set(expandedSchools);
    if (expandedSchools.has(schoolName)) {
      newExpanded.delete(schoolName);
    } else {
      newExpanded.add(schoolName);
    }
    setExpandedSchools(newExpanded);
  };

  return (
    <div className="space-y-8">
      {/* Library Header */}
      <Card className="bg-white/10 backdrop-blur-lg border border-white/20 shadow-2xl">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Library className="h-6 w-6 text-blue-600" />
              <div>
                <h3 className="text-lg font-semibold text-white">My Yearbook Library</h3>
                <p className="text-sm text-white/70">
                  {purchasedYearbooks.length} purchased yearbook{purchasedYearbooks.length !== 1 ? 's' : ''} from {schoolFolders.length} school{schoolFolders.length !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* School Folders */}
      {schoolFolders.length === 0 ? (
        <Card className="bg-white/10 backdrop-blur-lg border border-white/20 shadow-2xl">
          <CardContent className="p-8 text-center">
            <Library className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">No Yearbooks Yet</h3>
            <p className="text-white/70 mb-4">
              Start building your collection by purchasing yearbooks from schools you're interested in.
            </p>
            <Button 
              onClick={() => setLocation("/search")}
              className="bg-blue-600 hover:bg-blue-700"
              data-testid="button-browse-yearbooks"
            >
              <BookOpen className="h-4 w-4 mr-2" />
              Browse Yearbooks
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {schoolFolders.map((schoolName) => {
            const schoolYearbooks = groupedYearbooks[schoolName];
            const schoolInfo = schoolYearbooks[0]?.school;
            const isExpanded = expandedSchools.has(schoolName);
            
            return (
              <div key={schoolName} className="bg-white/10 backdrop-blur-lg border border-white/20 shadow-2xl rounded-lg p-4 md:p-6">
                {/* Folder Header - Clickable */}
                <button
                  onClick={() => toggleSchool(schoolName)}
                  className="w-full flex flex-col items-center md:flex-row md:items-start md:space-x-4 p-4 rounded-lg hover:bg-white/10 transition-colors"
                  data-testid={`button-toggle-school-${schoolName.replace(/\s+/g, '-').toLowerCase()}`}
                >
                  <div className="flex flex-col items-center md:items-start flex-1">
                    {/* School Logo or Folder Icon */}
                    <div className="relative mb-2 md:mb-0">
                      {schoolInfo?.logo ? (
                        <img 
                          src={schoolInfo.logo} 
                          alt={schoolName}
                          className="h-16 w-16 md:h-12 md:w-12 rounded-lg object-cover"
                        />
                      ) : (
                        <Folder className="h-16 w-16 md:h-12 md:w-12 text-blue-400" />
                      )}
                      <span className="absolute -bottom-2 -right-2 bg-blue-500 text-white text-xs rounded-full h-6 w-6 flex items-center justify-center font-bold">
                        {schoolYearbooks.length}
                      </span>
                    </div>
                    
                    {/* School Name and Info */}
                    <div className="text-center md:text-left md:ml-4">
                      <h3 className="font-semibold text-white text-lg">{schoolName}</h3>
                      <p className="text-sm text-white/70">
                        {schoolInfo?.city}, {schoolInfo?.country}
                      </p>
                    </div>
                  </div>

                  {/* Chevron Icon */}
                  <ChevronDown 
                    className={`h-5 w-5 text-white/70 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                  />
                </button>

                {/* Expanded Yearbooks List */}
                {isExpanded && (
                  <div className="mt-4 space-y-2 border-t border-white/20 pt-4">
                    {schoolYearbooks
                      .sort((a: any, b: any) => b.year - a.year)
                      .map((yearbook: any) => (
                        <button
                          key={`${schoolName}-${yearbook.year}`}
                          onClick={() => {
                            setLocation(`/yearbook/${schoolInfo?.id}/${yearbook.year}`);
                          }}
                          className="w-full flex items-center justify-between p-3 bg-white/5 hover:bg-white/15 rounded-md transition-colors border border-white/10 hover:border-white/20"
                          data-testid={`button-library-year-${yearbook.year}`}
                        >
                          <div className="flex items-center space-x-3">
                            <BookOpen className="h-4 w-4 text-blue-300" />
                            <span className="text-sm font-medium text-white">
                              {yearbook.year} Academic Year
                            </span>
                          </div>
                          <span className="text-xs text-white/60">
                            {new Date(yearbook.purchaseDate).toLocaleDateString()}
                          </span>
                        </button>
                      ))}
                    
                    {/* Add More Button */}
                    <Button 
                      size="sm" 
                      className="w-full mt-2 bg-blue-600 hover:bg-blue-700 text-white"
                      onClick={() => {
                        const schoolParam = schoolInfo?.id ? `?school=${schoolInfo.id}` : '';
                        setLocation(`/yearbook-finder${schoolParam}`);
                      }}
                      data-testid={`button-add-more-${schoolName.replace(/\s+/g, '-').toLowerCase()}`}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add More
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
