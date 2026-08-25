import { useState, useEffect, type ReactNode } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { 
  GraduationCap, 
  User as UserIcon,
  UserCheck,
  Clock,
  Eye,
  CheckCircle,
  XCircle,
  Trash2,
  Loader2,
  Search,
  ChevronDown,
  ChevronRight
} from "lucide-react";
import type { AlumniRequest, AlumniBadge, School, User } from "@shared/schema";
import { CURRENT_YEAR } from "@shared/constants";

export default function SchoolAlumni() {
  const { toast } = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [alumniSearchTerm, setAlumniSearchTerm] = useState("");
  const [alumniGraduationYearFilter, setAlumniGraduationYearFilter] = useState<string>("all");
  const [alumniAdmissionYearFilter, setAlumniAdmissionYearFilter] = useState<string>("all");
  const [showDidNotGraduate, setShowDidNotGraduate] = useState(false);
  const [showAddViewer, setShowAddViewer] = useState(false);
  const [newViewer, setNewViewer] = useState({ fullName: "", username: "", password: "" });
  const [showRequestDialog, setShowRequestDialog] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<AlumniRequest | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

  const toggleSection = (key: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // Get user from localStorage
  useEffect(() => {
    const userData = localStorage.getItem("user");
    if (userData) {
      setUser(JSON.parse(userData));
    }
  }, []);

  // Fetch school info
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

  // Fetch alumni requests
  const { data: allRequests = [] } = useQuery<AlumniRequest[]>({
    queryKey: ["/api/alumni-requests", school?.id],
    enabled: !!school?.id,
    queryFn: async () => {
      if (!school?.id) return [];
      const res = await fetch(`/api/alumni-requests/school/${school.id}`);
      if (!res.ok) throw new Error("Failed to fetch alumni requests");
      return res.json();
    },
    refetchInterval: 10000,
  });

  const pendingRequests = allRequests.filter(request => request.status === 'pending');

  // Fetch alumni badges
  const { data: allAlumniBadges = [] } = useQuery<AlumniBadge[]>({
    queryKey: ["/api/alumni-badges/school", school?.id],
    enabled: !!school?.id,
    queryFn: async () => {
      if (!school?.id) return [];
      const res = await fetch(`/api/alumni-badges/school/${school.id}`);
      if (!res.ok) throw new Error("Failed to fetch alumni badges");
      return res.json();
    },
  });

  const alumniBadges = allAlumniBadges.filter(badge => badge.status === 'verified');

  // Mutations
  const approveAlumniRequestMutation = useMutation({
    mutationFn: async ({ requestId }: { requestId: string }) => {
      await apiRequest("PATCH", `/api/alumni-requests/${requestId}/approve`, {
        reviewedBy: user?.id
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/alumni-requests", school?.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/alumni-badges/school", school?.id] });
      toast({
        className: "bg-blue-600/60 backdrop-blur-lg border border-white/20 shadow-2xl text-white",
        title: "Alumni request approved successfully"
      });
    },
  });

  const denyAlumniRequestMutation = useMutation({
    mutationFn: async ({ requestId }: { requestId: string }) => {
      await apiRequest("PATCH", `/api/alumni-requests/${requestId}/deny`, {
        reviewedBy: user?.id
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/alumni-requests", school?.id] });
      toast({ title: "Alumni request denied successfully" });
    },
  });

  const deleteAlumniBadgeMutation = useMutation({
    mutationFn: async (badgeId: string) => {
      await apiRequest("DELETE", `/api/alumni-badges/${badgeId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/alumni-badges/school", school?.id] });
      toast({ title: "Alumni badge deleted successfully" });
    },
  });

  // Handler functions
  const handleViewRequest = (request: AlumniRequest) => {
    setSelectedRequest(request);
    setShowRequestDialog(true);
  };

  const handleApproveRequest = (requestId: string) => {
    approveAlumniRequestMutation.mutate({ requestId });
  };

  const handleDenyRequest = (requestId: string) => {
    denyAlumniRequestMutation.mutate({ requestId });
  };

  const handleAddViewer = () => {
    console.log("Adding viewer:", newViewer);
    toast({ title: "Feature coming soon", description: "Add viewer functionality will be implemented" });
    setShowAddViewer(false);
    setNewViewer({ fullName: "", username: "", password: "" });
  };

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <h2 className="text-xl sm:text-2xl font-bold text-white">Alumni Authentication</h2>      
      </div>

      {/* Pending Alumni Upgrade Requests */}
      {pendingRequests.length > 0 && (
        <Card className="bg-white/10 backdrop-blur-lg border border-white/20">
          <CardHeader>
            <CardTitle className="flex items-center text-white">
              <Clock className="h-5 w-5 mr-2 text-orange-500" />
              Pending Alumni Upgrade Requests ({pendingRequests.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {pendingRequests.map((request) => (
                <div key={request.id} className="flex items-center justify-between p-4 bg-orange-500/30 backdrop-blur-lg border border-orange-400 shadow-2xl transition-all hover:text-orange-400 rounded-lg">
                  <div>
                    <h4 className="font-medium text-orange-100 ">{request.fullName}</h4>
                    <p className="text-sm text-orange-100">Requested on {new Date(request.createdAt || "").toLocaleDateString()}</p>
                    <p className="text-xs text-orange-500">Status: {request.status}</p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => handleViewRequest(request)}
                      className="bg-blue-500/40 backdrop-blur-lg border hover:bg-blue-500/50 text-blue-200 border-blue-200 hover:text-blue-100"
                    >
                      <Eye className="h-4 w-4 sm:mr-1" />
                      <span className="hidden sm:inline">View</span>
                    </Button>
                    <Button 
                      size="sm" 
                      onClick={() => handleApproveRequest(request.id)}
                      disabled={approveAlumniRequestMutation.isPending}
                      className="bg-green-500/40 backdrop-blur-lg border hover:bg-green-500/50 text-green-400 border-green-200 hover:text-green-100"
                    >
                      <CheckCircle className="h-4 w-4 sm:mr-1" />
                      <span className="hidden sm:inline">Approve</span>
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => handleDenyRequest(request.id)}
                      disabled={denyAlumniRequestMutation.isPending}
                      className="bg-red-500/40 backdrop-blur-lg border hover:bg-red-500/50 text-red-200 border-red-200 hover:text-red-100"
                    >
                      <XCircle className="h-4 w-4 sm:mr-1" />
                      <span className="hidden sm:inline">Deny</span>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {showAddViewer && (
        <Card className="bg-white/10 backdrop-blur-lg border border-white/20">
          <CardHeader>
            <CardTitle className="text-white">Add New Viewer Account</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="viewerFullName" className="text-white">Full Name</Label>
                <Input
                  id="viewerFullName"
                  value={newViewer.fullName}
                  onChange={(e) => setNewViewer({...newViewer, fullName: e.target.value})}
                  placeholder="Viewer's full name"
                />
              </div>
              <div>
                <Label htmlFor="viewerUsername" className="text-white">Username</Label>
                <Input
                  id="viewerUsername"
                  value={newViewer.username}
                  onChange={(e) => setNewViewer({...newViewer, username: e.target.value})}
                  placeholder="Login username"
                />
              </div>
              <div>
                <Label htmlFor="viewerPassword" className="text-white">Password</Label>
                <Input
                  id="viewerPassword"
                  type="password"
                  value={newViewer.password}
                  onChange={(e) => setNewViewer({...newViewer, password: e.target.value})}
                  placeholder="Login password"
                />
              </div>
            </div>
            <div className="flex space-x-2">
              <Button onClick={handleAddViewer}>Add Viewer</Button>
              <Button variant="outline" onClick={() => setShowAddViewer(false)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="bg-white/10 backdrop-blur-lg border border-white/20">
        <CardHeader>
          <CardTitle className="flex items-center justify-between text-white">
            <span>Current Alumni Accounts</span>
            <span className="text-sm text-blue-200">{alumniBadges.length} total</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Filter Controls */}
          <div className="mb-6 space-y-4">
            {/* Dropdowns Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Graduation Year Filter */}
              <div className="space-y-2">
                <Label className="text-white text-sm">Graduation Year</Label>
                <Select 
                  value={alumniGraduationYearFilter} 
                  onValueChange={setAlumniGraduationYearFilter}
                  disabled={showDidNotGraduate}
                >
                  <SelectTrigger 
                    className="bg-white/10 backdrop-blur-lg border border-white/20 text-white disabled:opacity-50 disabled:cursor-not-allowed" 
                    data-testid="select-graduation-year-filter"
                  >
                    <SelectValue placeholder="All years" />
                  </SelectTrigger>
                  <SelectContent className="bg-blue-600/60 backdrop-blur-lg border border-white/20">
                    <SelectItem value="all" className="text-white hover:bg-white/20">All Years</SelectItem>
                    {(() => {
                      const foundingYear = school?.yearFounded || 1980;
                      const years: number[] = [];
                      for (let year = CURRENT_YEAR; year >= foundingYear; year--) {
                        years.push(year);
                      }
                      return years.map(year => (
                        <SelectItem key={year} value={year.toString()} className="text-white hover:bg-white/20">
                          {year}
                        </SelectItem>
                      ));
                    })()}
                  </SelectContent>
                </Select>
                
                {/* Did Not Graduate Checkbox */}
                <div className="flex items-center space-x-2 mt-3">
                  <Checkbox 
                    id="did-not-graduate"
                    checked={showDidNotGraduate}
                    onCheckedChange={(checked) => setShowDidNotGraduate(checked === true)}
                    className="border-white data-[state=checked]:bg-white data-[state=checked]:text-blue-600"
                    data-testid="checkbox-did-not-graduate"
                  />
                  <Label 
                    htmlFor="did-not-graduate" 
                    className="text-white text-sm cursor-pointer"
                  >
                    Did not graduate
                  </Label>
                </div>
              </div>

              {/* Admission Year Filter */}
              <div className="space-y-2">
                <Label className="text-white text-sm">Admission Year</Label>
                <Select 
                  value={alumniAdmissionYearFilter} 
                  onValueChange={setAlumniAdmissionYearFilter}
                >
                  <SelectTrigger className="bg-white/10 backdrop-blur-lg border border-white/20 text-white" data-testid="select-admission-year-filter">
                    <SelectValue placeholder="All years" />
                  </SelectTrigger>
                  <SelectContent className="bg-blue-600/60 backdrop-blur-lg border border-white/20 text-white">
                    <SelectItem value="all" className="text-white hover:bg-white/20">All Years</SelectItem>
                    {(() => {
                      const foundingYear = school?.yearFounded || 1980;
                      const years: number[] = [];
                      for (let year = CURRENT_YEAR; year >= foundingYear; year--) {
                        years.push(year);
                      }
                      return years.map(year => (
                        <SelectItem key={year} value={year.toString()} className="text-white hover:bg-white/20">
                          {year}
                        </SelectItem>
                      ));
                    })()}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Search Bar */}
            <div className="relative max-w-full">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-white/60 h-4 w-4" />
              <Input
                type="text"
                placeholder="Search alumni by name..."
                value={alumniSearchTerm}
                onChange={(e) => setAlumniSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 w-full bg-white/10 backdrop-blur-lg border border-white/20 text-white placeholder:text-white/60"
                data-testid="input-alumni-search"
              />
            </div>
          </div>

          {(() => {
            if (alumniBadges.length === 0) {
              return <p className="text-blue-200 text-center py-4">No alumni accounts found</p>;
            }

            // Filter alumni based on search term and year filters
            const filteredAlumni = alumniBadges.filter((badge) => {
              const searchLower = alumniSearchTerm.toLowerCase();
              const fullName = badge.fullName?.toLowerCase() || '';
              const graduationYear = badge.graduationYear?.toString() || '';
              const admissionYear = badge.admissionYear?.toString() || '';
              
              // Text search filter
              const matchesSearch = !alumniSearchTerm || fullName.includes(searchLower);
              
              // Did not graduate filter
              if (showDidNotGraduate) {
                const isNonGraduate = graduationYear.startsWith("Did not graduate from");
                if (!isNonGraduate) return false;
              }
              
              // Graduation year filter (only apply if not filtering for non-graduates)
              const matchesGradYear = showDidNotGraduate || 
                                     alumniGraduationYearFilter === 'all' || 
                                     graduationYear === alumniGraduationYearFilter;
              
              // Admission year filter
              const matchesAdmYear = alumniAdmissionYearFilter === 'all' || 
                                    admissionYear === alumniAdmissionYearFilter;
              
              return matchesSearch && matchesGradYear && matchesAdmYear;
            });

            // Separate into graduated and non-graduated
            const graduated = filteredAlumni.filter(badge => 
              badge.graduationYear && badge.graduationYear !== "Did not graduate from " + badge.school
            );
            const nonGraduated = filteredAlumni.filter(badge => 
              badge.graduationYear && badge.graduationYear.startsWith("Did not graduate from")
            );

            // Sort graduated alumni by graduation year (most recent first), then by school name
            const sortedGraduated = graduated.sort((a, b) => {
              const yearA = parseInt(a.graduationYear) || 0;
              const yearB = parseInt(b.graduationYear) || 0;
              if (yearA !== yearB) return yearB - yearA; // Most recent first
              return (a.school || '').localeCompare(b.school || '');
            });

            // Sort non-graduated by school name
            const sortedNonGraduated = nonGraduated.sort((a, b) => 
              (a.school || '').localeCompare(b.school || '')
            );

            // Filter based on school founding year if available
            const schoolFoundingYear = school?.yearFounded;
            const filteredByFoundingYear = schoolFoundingYear ? 
              sortedGraduated.filter(badge => {
                const gradYear = parseInt(badge.graduationYear);
                return !gradYear || gradYear >= schoolFoundingYear;
              }) : sortedGraduated;

            // Group graduated alumni by year
            const byYear: Record<number, typeof filteredByFoundingYear> = {};
            for (const badge of filteredByFoundingYear) {
              const yr = parseInt(badge.graduationYear) || 0;
              if (!byYear[yr]) byYear[yr] = [];
              byYear[yr].push(badge);
            }

            // Build ordered year list: CURRENT_YEAR down to founding year, only years that have alumni
            const foundingYear = school?.yearFounded || 1980;
            const orderedYears: number[] = [];
            for (let yr = CURRENT_YEAR; yr >= foundingYear; yr--) {
              if (byYear[yr] && byYear[yr].length > 0) orderedYears.push(yr);
            }

            const renderAlumniCard = (badge: AlumniBadge, colorScheme: 'green' | 'blue') => {
              const isGreen = colorScheme === 'green';
              return (
                <div key={badge.id} className={`flex items-center justify-between p-3 ${isGreen ? 'bg-green-300/10 border-white/20' : 'bg-blue-300/10 border-white/20'} backdrop-blur-lg border shadow-2xl rounded-lg`}>
                  <div className="flex items-center space-x-3">
                    {/* Profile Picture - scaled down */}
                    <div className={`w-10 h-10 rounded-full overflow-hidden flex-shrink-0 ${isGreen ? 'bg-white/20' : 'bg-white/20'}`}>
                      {badge.profileImage ? (
                        <img 
                          src={badge.profileImage} 
                          alt={badge.fullName}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className={`w-full h-full flex items-center justify-center ${isGreen ? 'bg-green-500/20' : 'bg-blue-500/20'}`}>
                          <UserIcon className={`w-5 h-5 ${isGreen ? 'text-green-200' : 'text-blue-200'}`} />
                        </div>
                      )}
                    </div>
                    {/* Info */}
                    <div>
                      <h4 className={`text-sm font-semibold ${isGreen ? 'text-green-50' : 'text-blue-50'}`}>{badge.fullName}</h4>
                      <p className={`text-xs ${isGreen ? 'text-green-100' : 'text-blue-100'}`}>
                        {isGreen ? `Class of ${badge.graduationYear}` : 'Did not graduate'} •{' '}
                        <span className={`font-medium ${badge.status === 'verified' ? (isGreen ? 'text-green-300' : 'text-green-300') : 'text-yellow-400'}`}>
                          {badge.status === 'verified' ? 'Verified' : 'Pending'}
                        </span>
                      </p>
                      <p className={`text-xs ${isGreen ? 'text-green-100/70' : 'text-blue-100/70'} mt-0.5`}>Admitted: {badge.admissionYear}</p>
                      {badge.email && (
                        <p className={`text-xs ${isGreen ? 'text-green-100/70' : 'text-blue-100/70'} mt-0.5`}>Email: {badge.email}</p>
                      )}
                      {badge.phoneNumber && (
                        <p className={`text-xs ${isGreen ? 'text-green-100/70' : 'text-blue-100/70'} mt-0.5`}>Phone: {badge.phoneNumber}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center space-x-2 flex-shrink-0">
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => deleteAlumniBadgeMutation.mutate(badge.id)}
                      disabled={deleteAlumniBadgeMutation.isPending}
                      className="text-red-400 border-red-400/50 hover:bg-red-500/20 h-7 w-7 p-0"
                    >
                      {deleteAlumniBadgeMutation.isPending ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </div>
                </div>
              );
            };

            const renderCollapsibleSection = (
              key: string,
              label: ReactNode,
              count: number,
              children: ReactNode,
              colorScheme: 'green' | 'blue'
            ) => {
              const isExpanded = expandedSections.has(key);
              const isGreen = colorScheme === 'green';
              return (
                <div key={key}>
                  <button
                    type="button"
                    onClick={() => toggleSection(key)}
                    className={`w-full flex items-center justify-between py-2 px-3 rounded-lg mb-1 ${isGreen ? 'bg-green-500/10 hover:bg-green-500/20' : 'bg-blue-500/10 hover:bg-blue-500/20'} transition-colors`}
                  >
                    <span className={`flex items-center text-sm font-semibold ${isGreen ? 'text-green-200' : 'text-blue-200'}`}>
                      {label}
                      <span className={`ml-2 text-xs font-normal ${isGreen ? 'text-green-300/70' : 'text-blue-300/70'}`}>({count})</span>
                    </span>
                    {isExpanded
                      ? <ChevronDown className={`h-4 w-4 ${isGreen ? 'text-green-300' : 'text-blue-300'}`} />
                      : <ChevronRight className={`h-4 w-4 ${isGreen ? 'text-green-300' : 'text-blue-300'}`} />
                    }
                  </button>
                  {isExpanded && (
                    <div className="space-y-2 mb-3 pl-1">
                      {children}
                    </div>
                  )}
                </div>
              );
            };

            return (
              <div className="space-y-1">
                {/* Did Not Graduate — shown first */}
                {sortedNonGraduated.length > 0 && renderCollapsibleSection(
                  'non-graduated',
                  <><UserCheck className="h-4 w-4 mr-2 text-blue-400" />Did Not Graduate</>,
                  sortedNonGraduated.length,
                  sortedNonGraduated.map(badge => renderAlumniCard(badge, 'blue')),
                  'blue'
                )}

                {/* Graduated alumni by year: current year down to founding year */}
                {orderedYears.map(yr =>
                  renderCollapsibleSection(
                    `year-${yr}`,
                    <><GraduationCap className="h-4 w-4 mr-2 text-green-400" />Class of {yr}</>,
                    byYear[yr].length,
                    byYear[yr].map(badge => renderAlumniCard(badge, 'green')),
                    'green'
                  )
                )}

                {/* No results message */}
                {filteredAlumni.length === 0 && alumniSearchTerm && (
                  <p className="text-gray-400 text-center py-4">No alumni found matching "{alumniSearchTerm}"</p>
                )}

                {filteredAlumni.length === 0 && !alumniSearchTerm && alumniBadges.length > 0 && (
                  <p className="text-gray-400 text-center py-4">No alumni match the selected filters</p>
                )}
              </div>
            );
          })()}
        </CardContent>
      </Card>

      {/* Request Details Dialog */}
      <Dialog open={showRequestDialog} onOpenChange={setShowRequestDialog}>
        <DialogContent className="max-w-2xl bg-white/10 backdrop-blur-lg border border-white/20 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-white">Alumni Status Request Details</DialogTitle>
            <DialogDescription className="text-blue-50">
              Review the submitted alumni verification information
            </DialogDescription>
          </DialogHeader>
          
          {selectedRequest && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-white">Full Name</Label>
                  <p className="text-white/80">{selectedRequest.fullName}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-white">Status</Label>
                  <p className={`text-sm font-medium ${
                    selectedRequest.status === 'pending' ? 'text-orange-600' :
                    selectedRequest.status === 'approved' ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {selectedRequest.status.charAt(0).toUpperCase() + selectedRequest.status.slice(1)}
                  </p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-white">Admission Year</Label>
                  <p className="text-white/80">{selectedRequest.admissionYear}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-white">Graduation Year</Label>
                  <p className="text-white/80">{selectedRequest.graduationYear}</p>
                </div>
              </div>
              
              {selectedRequest.postHeld && (
                <div>
                  <Label className="text-sm font-medium text-white">Post Held</Label>
                  <p className="text-white/80">{selectedRequest.postHeld}</p>
                </div>
              )}
              
              {selectedRequest.studentName && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-white">Student Reference Name</Label>
                    <p className="text-white/80">{selectedRequest.studentName}</p>
                  </div>
                  {selectedRequest.studentAdmissionYear && (
                    <div>
                      <Label className="text-sm font-medium text-white">Reference Admission Year</Label>
                      <p className="text-white/80">{selectedRequest.studentAdmissionYear}</p>
                    </div>
                  )}
                </div>
              )}
              
              {selectedRequest.additionalInfo && (
                <div>
                  <Label className="text-sm font-medium text-white">Additional Information</Label>
                  <p className="text-white/80 bg-white/10 backdrop-blur-lg border border-white/20 shadow-2xl p-3 rounded-md">{selectedRequest.additionalInfo}</p>
                </div>
              )}
              
              <div>
                <Label className="text-sm font-medium text-white">Request Date</Label>
                <p className="text-white/80">{new Date(selectedRequest.createdAt || "").toLocaleDateString()}</p>
              </div>
              
              {selectedRequest.status === 'pending' && (
                <div className="flex gap-3 pt-4 border-t border-gray-200">
                  <Button 
                    onClick={() => {
                      handleApproveRequest(selectedRequest.id);
                      setShowRequestDialog(false);
                    }}
                    disabled={approveAlumniRequestMutation.isPending}
                    className="bg-green-500/20 backdrop-blur-lg border border-white/20 shadow-2xl text-green-600 hover:bg-green-500 hover:text-white"
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Approve Request
                  </Button>
                  <Button 
                    variant="outline"
                    onClick={() => {
                      handleDenyRequest(selectedRequest.id);
                      setShowRequestDialog(false);
                    }}
                    disabled={denyAlumniRequestMutation.isPending}
                    className="bg-red-500/20 backdrop-blur-lg border border-white/20 shadow-2xl text-red-600 hover:bg-red-500 hover:text-white"
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Deny Request
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
