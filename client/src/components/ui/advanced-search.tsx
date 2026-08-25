import { useState, useMemo, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Search, X } from "lucide-react";
import type { School } from "@shared/schema";

interface SearchUser {
  id: string;
  username: string;
  fullName: string;
  profileImage: string | null;
  userType: string;
}

type ResultItem =
  | { kind: "school"; school: School }
  | { kind: "user"; user: SearchUser };

interface AdvancedSearchProps {
  schools: School[];
  onSchoolClick?: (schoolUsername: string) => void;
  onUserClick?: (username: string) => void;
  onSchoolSelect?: (schoolId: string) => void;
  selectedSchool?: string;
}

export default function AdvancedSearch({ schools, onSchoolClick, onUserClick, onSchoolSelect, selectedSchool }: AdvancedSearchProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [isExpanded, setIsExpanded] = useState(false);
  const [userResults, setUserResults] = useState<SearchUser[]>([]);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const selectedSchoolData = schools.find(s => s.id === selectedSchool);

  useEffect(() => {
    if (!selectedSchoolData && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [selectedSchoolData]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!searchTerm.trim()) {
      setUserResults([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/users/search?q=${encodeURIComponent(searchTerm.trim())}`);
        if (res.ok) {
          const data: SearchUser[] = await res.json();
          setUserResults(data.filter(u => u.userType === "viewer"));
        }
      } catch {}
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [searchTerm]);

  const filteredSchools = useMemo(() => {
    if (!searchTerm.trim()) return [];
    const term = searchTerm.toLowerCase();
    return schools.filter(s =>
      s.name.toLowerCase().includes(term) ||
      s.username.toLowerCase().includes(term) ||
      s.city?.toLowerCase().includes(term) ||
      s.state?.toLowerCase().includes(term)
    ).slice(0, 6);
  }, [schools, searchTerm]);

  const results = useMemo((): ResultItem[] => {
    const items: ResultItem[] = filteredSchools.map(s => ({ kind: "school", school: s }));
    for (const u of userResults) {
      if (!filteredSchools.some(s => s.username === u.username)) {
        items.push({ kind: "user", user: u });
      }
    }
    return items.slice(0, 8);
  }, [filteredSchools, userResults]);

  const handleClearSelection = () => {
    if (onSchoolSelect) onSchoolSelect("");
    setSearchTerm("");
    setIsExpanded(false);
  };

  const handleClearSearch = () => {
    setSearchTerm("");
    setIsExpanded(false);
    setUserResults([]);
  };

  return (
    <div className="w-full space-y-4">
      {/* Selected School Display */}
      {selectedSchoolData && (
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full flex items-center justify-center overflow-hidden bg-white/10 border border-white/20">
                  {selectedSchoolData.logo ? (
                    <img
                      src={selectedSchoolData.logo.startsWith('/') ? selectedSchoolData.logo : `/${selectedSchoolData.logo}`}
                      alt={selectedSchoolData.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-sm font-bold text-white">{selectedSchoolData.name.charAt(0)}</span>
                  )}
                </div>
                <div>
                  <p className="font-semibold text-white" data-testid="text-selected-school-name">{selectedSchoolData.name}</p>
                  <p className="text-xs text-white/50">@{selectedSchoolData.username}</p>
                </div>
              </div>
              <button onClick={handleClearSelection} className="text-white/40 hover:text-white/70 transition-colors p-1">
                <X className="w-4 h-4" />
              </button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Search Interface */}
      {!selectedSchoolData && (
        <div className="space-y-3">
          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/50 w-4 h-4" />
            <Input
              ref={searchInputRef}
              placeholder="Search by name or username..."
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setIsExpanded(true); }}
              onFocus={() => setIsExpanded(true)}
              className="pl-10 pr-9 h-12 text-base bg-white/10 backdrop-blur-lg border border-white/20 shadow-2xl text-white placeholder:text-white/50"
              data-testid="input-school-search"
            />
            {searchTerm && (
              <button
                onClick={handleClearSearch}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Results */}
          {isExpanded && (
            <Card className="bg-white/10 backdrop-blur-lg border border-white/20 shadow-2xl">
              <CardContent className="p-0">
                {results.length > 0 ? (
                  <div>
                    {results.map((item, index) => {
                      const isLast = index === results.length - 1;
                      if (item.kind === "school") {
                        const s = item.school;
                        return (
                          <button
                            key={`school-${s.id}`}
                            onClick={() => onSchoolClick?.(s.username)}
                            className={`w-full p-4 text-left hover:bg-white/10 transition-colors flex items-center gap-3 ${!isLast ? "border-b border-white/10" : ""}`}
                            data-testid={`button-school-option-${s.id}`}
                          >
                            <div className="w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center overflow-hidden bg-white/10 border border-white/20">
                              {s.logo ? (
                                <img
                                  src={s.logo.startsWith('http') ? s.logo : (s.logo.startsWith('/') ? s.logo : `/${s.logo}`)}
                                  alt={s.name}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <span className="text-sm font-bold text-white">{s.name.charAt(0)}</span>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-white truncate">{s.name}</p>
                              <p className="text-xs text-white/50">@{s.username}</p>
                            </div>
                            <span className="flex-shrink-0 text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-blue-500/30 text-blue-200 border border-blue-400/30">
                              School
                            </span>
                          </button>
                        );
                      } else {
                        const u = item.user;
                        return (
                          <button
                            key={`user-${u.id}`}
                            onClick={() => onUserClick?.(u.username)}
                            className={`w-full p-4 text-left hover:bg-white/10 transition-colors flex items-center gap-3 ${!isLast ? "border-b border-white/10" : ""}`}
                            data-testid={`button-user-option-${u.id}`}
                          >
                            <div className="w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center overflow-hidden bg-white/10 border border-white/20">
                              {u.profileImage ? (
                                <img
                                  src={u.profileImage.startsWith('http') ? u.profileImage : (u.profileImage.startsWith('/') ? u.profileImage : `/${u.profileImage}`)}
                                  alt={u.fullName}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <span className="text-sm font-bold text-white">{(u.fullName || u.username).charAt(0).toUpperCase()}</span>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-white truncate">{u.fullName || u.username}</p>
                              <p className="text-xs text-white/50">@{u.username}</p>
                            </div>
                            <span className="flex-shrink-0 text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-purple-500/30 text-purple-200 border border-purple-400/30">
                              Viewer
                            </span>
                          </button>
                        );
                      }
                    })}
                  </div>
                ) : (
                  <div className="p-8 text-center text-white/50">
                    <Search className="w-8 h-8 mx-auto mb-3 opacity-40" />
                    {searchTerm ? (
                      <>
                        <p>No results for &ldquo;{searchTerm}&rdquo;</p>
                        <p className="text-sm mt-1 text-white/30">Try a different name or username</p>
                      </>
                    ) : (
                      <p>Start typing to search</p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
