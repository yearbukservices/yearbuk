import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search as SearchIcon, MapPin, Calendar, GraduationCap, Globe, ArrowLeft } from "lucide-react";
import type { School } from "@shared/schema";

export default function Search() {
  const [, setLocation] = useLocation();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCountry, setSelectedCountry] = useState<string>("all");
  const [selectedYear, setSelectedYear] = useState<string>("all");

  const { data: schools = [], isLoading } = useQuery<School[]>({
    queryKey: ['/api/schools/approved'],
  });

  const countries = useMemo(() => {
    const uniqueCountries = Array.from(new Set(schools.map(s => s.country).filter(Boolean)));
    return uniqueCountries.sort();
  }, [schools]);

  const foundingYears = useMemo(() => {
    const uniqueYears = Array.from(new Set(schools.map(s => s.yearFounded).filter(Boolean)));
    return uniqueYears.sort((a, b) => b - a);
  }, [schools]);

  const filteredSchools = useMemo(() => {
    let results = schools;

    if (selectedCountry !== "all") {
      results = results.filter(school => school.country === selectedCountry);
    }

    if (selectedYear !== "all") {
      results = results.filter(school => school.yearFounded === parseInt(selectedYear));
    }

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      results = results.filter(school => 
        school.name.toLowerCase().includes(term) ||
        school.username.toLowerCase().includes(term) ||
        school.city?.toLowerCase().includes(term) ||
        school.state?.toLowerCase().includes(term)
      );
    }

    return results;
  }, [schools, searchTerm, selectedCountry, selectedYear]);

  const handleSchoolClick = (school: School) => {
    setLocation(`/${school.username}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <div className="container mx-auto px-4 py-4 sm:py-8 max-w-6xl">
        <div className="mb-6 sm:mb-8">
          <Button
            variant="ghost"
            onClick={() => setLocation('/viewer-dashboard')}
            className="mb-4 text-sm"
            data-testid="button-back"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">Back to Dashboard</span>
            <span className="sm:hidden">Back</span>
          </Button>
          
          <div className="text-center mb-6 sm:mb-8">
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-2 sm:mb-3">Search Schools</h1>
            <p className="text-muted-foreground text-sm sm:text-base md:text-lg">
              Discover yearbooks, memories, and connect with alumni from schools worldwide
            </p>
          </div>
        </div>

        <Card className="p-4 sm:p-6 mb-4 sm:mb-6">
          <div className="space-y-4">
            <div className="relative">
              <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4 sm:w-5 sm:h-5" />
              <Input
                placeholder="Search by school name, username, city, or state..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 sm:pl-12 h-12 sm:h-14 text-base sm:text-lg"
                data-testid="input-search"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Country</label>
                <div className="relative">
                  <Globe className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4 z-10 pointer-events-none" />
                  <Select value={selectedCountry} onValueChange={setSelectedCountry}>
                    <SelectTrigger className="pl-10" data-testid="select-country">
                      <SelectValue placeholder="All Countries" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Countries</SelectItem>
                      {countries.map((country) => (
                        <SelectItem key={country} value={country}>
                          {country}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Founded Year</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4 z-10 pointer-events-none" />
                  <Select value={selectedYear} onValueChange={setSelectedYear}>
                    <SelectTrigger className="pl-10" data-testid="select-year">
                      <SelectValue placeholder="All Years" />
                    </SelectTrigger>
                    <SelectContent className="max-h-60">
                      <SelectItem value="all">All Years</SelectItem>
                      {foundingYears.map((year) => (
                        <SelectItem key={year} value={year.toString()}>
                          {year}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </div>
        </Card>

        <div className="mb-4">
          <p className="text-sm text-muted-foreground">
            {filteredSchools.length} {filteredSchools.length === 1 ? 'school' : 'schools'} found
          </p>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Card key={i} className="h-48 animate-pulse" />
            ))}
          </div>
        ) : filteredSchools.length === 0 ? (
          <Card className="p-8 sm:p-12 text-center">
            <SearchIcon className="w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h3 className="text-lg sm:text-xl font-semibold mb-2">No schools found</h3>
            <p className="text-sm sm:text-base text-muted-foreground">
              {searchTerm ? `No results for "${searchTerm}"` : 'Try adjusting your search filters'}
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {filteredSchools.map((school) => (
              <Card
                key={school.id}
                className="overflow-hidden hover:shadow-xl transition-all cursor-pointer group"
                onClick={() => handleSchoolClick(school)}
                data-testid={`card-school-${school.id}`}
              >
                <CardContent className="p-0">
                  <div className="relative h-32 bg-gradient-to-r from-blue-600 to-purple-600">
                    {school.coverPhoto ? (
                      <img
                        src={school.coverPhoto}
                        alt={`${school.name} cover`}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <GraduationCap className="w-12 h-12 text-white opacity-50" />
                      </div>
                    )}
                  </div>
                  
                  <div className="p-4">
                    <div className="flex items-start gap-3 mb-3">
                      {school.logo ? (
                        <img
                          src={school.logo}
                          alt={`${school.name} logo`}
                          className="w-16 h-16 rounded-lg object-cover border-2 border-white shadow-md -mt-8 relative z-10"
                          data-testid={`img-logo-${school.id}`}
                        />
                      ) : (
                        <div className="w-16 h-16 rounded-lg bg-gray-200 dark:bg-gray-700 flex items-center justify-center -mt-8 relative z-10 border-2 border-white shadow-md">
                          <GraduationCap className="w-8 h-8 text-gray-400" />
                        </div>
                      )}
                    </div>

                    <h3 className="font-bold text-lg mb-1 group-hover:text-blue-600 transition-colors" data-testid={`text-name-${school.id}`}>
                      {school.name}
                    </h3>
                    
                    {school.motto && (
                      <p className="text-sm text-muted-foreground italic mb-3 line-clamp-2" data-testid={`text-motto-${school.id}`}>
                        "{school.motto}"
                      </p>
                    )}

                    <div className="space-y-2 text-sm text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4" />
                        <span>{school.city}, {school.country}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        <Badge variant="secondary" className="text-xs">
                          Est. {school.yearFounded}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
