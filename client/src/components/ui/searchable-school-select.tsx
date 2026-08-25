import React, { useState, useRef, useEffect } from 'react';
import { Search, Check, Filter } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getFlagByCountryName } from '@/lib/countries';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface School {
  id: string;
  name: string;
  country?: string;
  yearFounded?: number;
}

interface SearchableSchoolSelectProps {
  schools: School[];
  value?: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function SearchableSchoolSelect({
  schools,
  value,
  onValueChange,
  placeholder = "Search for a school...",
  className
}: SearchableSchoolSelectProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState<string>('all');
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const uniqueCountries = Array.from(new Set(schools.map(s => s.country).filter(Boolean))).sort();

  const filteredSchools = schools.filter(school => {
    const matchesSearch = school.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCountry = selectedCountry === 'all' || school.country === selectedCountry;
    return matchesSearch && matchesCountry;
  });

  const getSchoolFlag = (school: School) => {
    return school.country ? getFlagByCountryName(school.country) : "🏴";
  };

  const showDropdown = isOpen && searchTerm.length > 0;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev =>
          prev < filteredSchools.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev =>
          prev > 0 ? prev - 1 : filteredSchools.length - 1
        );
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightedIndex >= 0 && filteredSchools[highlightedIndex]) {
          const school = filteredSchools[highlightedIndex];
          onValueChange(school.id);
          setSearchTerm(school.name);
          setIsOpen(false);
          setHighlightedIndex(-1);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        setHighlightedIndex(-1);
        break;
    }
  };

  const handleSchoolSelect = (schoolId: string) => {
    const selected = schools.find(s => s.id === schoolId);
    onValueChange(schoolId);
    setSearchTerm(selected ? selected.name : '');
    setIsOpen(false);
    setHighlightedIndex(-1);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    setIsOpen(true);
    setHighlightedIndex(-1);
  };

  useEffect(() => {
    if (highlightedIndex >= 0 && listRef.current) {
      const highlightedItem = listRef.current.children[highlightedIndex] as HTMLElement;
      if (highlightedItem) {
        highlightedItem.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }, [highlightedIndex]);

  useEffect(() => {
    if (value) {
      const selected = schools.find(s => s.id === value);
      if (selected) {
        setSearchTerm(selected.name);
      }
    } else {
      setSearchTerm('');
    }
  }, [value, schools]);

  return (
    <div ref={containerRef} className={cn("w-full space-y-2", className)}>
      {/* Country Filter */}
      <Select value={selectedCountry} onValueChange={setSelectedCountry}>
        <SelectTrigger
          className="h-10 text-sm bg-white/10 backdrop-blur-lg border-white/20 text-white hover:bg-white/15"
          data-testid="select-country-filter"
        >
          <SelectValue placeholder="All Countries" />
        </SelectTrigger>
        <SelectContent className="bg-blue-600/95 backdrop-blur-lg border-white/20">
          <SelectItem value="all" className="text-white hover:bg-white/20">All Countries</SelectItem>
          {uniqueCountries.map(country => (
            <SelectItem
              key={country}
              value={country!}
              className="text-white hover:bg-white/20"
            >
              {getFlagByCountryName(country!)} {country}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Search Input with dropdown anchored to it */}
      <div className="relative">
        <div className="relative bg-white/10">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-white" />
          <input
            ref={inputRef}
            type="text"
            value={searchTerm}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="w-full pl-10 pr-3 py-2 text-sm bg-white/10 backdrop-blur-lg border border-white/20 rounded-md text-white placeholder:text-white/70 focus:outline-none focus:ring-2 focus:ring-white/30 focus:border-white/30"
            data-testid="input-search-schools"
          />
        </div>

        {/* Schools Dropdown - absolutely positioned below the input */}
        {showDropdown && (
          <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-blue-600/100 backdrop-blur-lg border border-white/20 rounded-md shadow-2xl overflow-hidden">
            {searchTerm && (
              <div className="flex items-center gap-1 px-3 py-1.5 text-xs text-white/70 border-b border-white/10">
                <Filter className="h-3 w-3" />
                <span>{filteredSchools.length} school{filteredSchools.length !== 1 ? 's' : ''} found</span>
              </div>
            )}
            <ul
              ref={listRef}
              className="py-1 overflow-y-auto max-h-64"
              role="listbox"
            >
              {filteredSchools.length > 0 ? (
                filteredSchools.map((school, index) => (
                  <li
                    key={school.id}
                    className={cn(
                      "flex items-center space-x-3 px-3 py-2 text-sm cursor-pointer transition-colors text-white",
                      "hover:bg-white/20",
                      highlightedIndex === index && "bg-white/30",
                      value === school.id && "bg-white/40"
                    )}
                    onClick={() => handleSchoolSelect(school.id)}
                    role="option"
                    aria-selected={value === school.id}
                    data-testid={`school-option-${school.id}`}
                  >
                    <span className="text-lg">{getSchoolFlag(school)}</span>
                    <span className="flex-1 truncate text-white">{school.name}</span>
                    {value === school.id && (
                      <Check className="h-4 w-4 text-green-500" />
                    )}
                  </li>
                ))
              ) : (
                <li className="px-3 py-2 text-sm text-white/70 text-center">
                  No schools found
                </li>
              )}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
