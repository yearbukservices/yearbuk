import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { 
  Shield, 
  Users, 
  School, 
  UserCheck, 
  Search,
  BarChart3,
  Activity,
  LogOut,
  AlertTriangle,
  BookOpen,
  Unlock,
  Lock,
  Calendar,
  Grid,
  List,
  CheckCircle2
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import logoImage from "@assets/logo_background_null.png";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface SuperAdminDashboardProps {
  user: any;
  onLogout: () => void;
}

export default function SuperAdminDashboard({ user, onLogout }: SuperAdminDashboardProps) {
  const [viewers, setViewers] = useState<any[]>([]);
  const [schools, setSchools] = useState<any[]>([]);
  const [pendingSchools, setPendingSchools] = useState<any[]>([]);
  const [analytics, setAnalytics] = useState<any>({});
  const [adminLogs, setAdminLogs] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState("overview");
  const [searchTerm, setSearchTerm] = useState("");
  const [pendingSchoolsSearch, setPendingSchoolsSearch] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [selectedSchoolForYears, setSelectedSchoolForYears] = useState<any>(null);
  const [schoolYears, setSchoolYears] = useState<any>(null);
  const [yearLoading, setYearLoading] = useState(false);
  const [yearsViewMode, setYearsViewMode] = useState<'grid' | 'list'>('grid');
  const [confirmationDialogOpen, setConfirmationDialogOpen] = useState(false);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [pendingUnlockData, setPendingUnlockData] = useState<{schoolId: string, year: number, schoolName: string} | null>(null);
  const [pendingApprovalData, setPendingApprovalData] = useState<{schoolId: string, schoolName: string, action: 'approve' | 'deny'} | null>(null);
  const [adminPassword, setAdminPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [unlockOrientation, setUnlockOrientation] = useState<'portrait' | 'landscape' | ''>('');
  const [unlockUploadType, setUnlockUploadType] = useState<'image' | 'pdf' | ''>('');
  const { toast } = useToast();

  // Helper function to generate Cloudinary folder path (matches server-side logic)
  const getCloudinaryFolderPath = (schoolName: string, schoolCode: string, category: string, year?: number) => {
    const safeSchoolName = schoolName.replace(/\s+/g, '').replace(/[^a-zA-Z0-9]/g, '');
    let folderPath = `yearbuk_uploads/${safeSchoolName}_${schoolCode}/${category}`;
    if (year) {
      folderPath += `/${year}`;
    }
    return folderPath;
  };

  // Helper to get all folder paths for a school
  const getAllSchoolFolderPaths = (schoolName: string, schoolCode: string) => {
    const basePath = `yearbuk_uploads/${schoolName.replace(/\s+/g, '').replace(/[^a-zA-Z0-9]/g, '')}_${schoolCode}/`;
    return {
      base: basePath,
      examples: [
        `${basePath}yearbooks/{year}/`,
        `${basePath}memories/{year}/`,
        `${basePath}logo/`,
        `${basePath}accreditation/`
      ]
    };
  };

  const getAuthHeaders = () => ({
    'Authorization': `Bearer ${localStorage.getItem('superAdminToken')}`,
    'Content-Type': 'application/json'
  });

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [usersRes, schoolsRes, pendingSchoolsRes, analyticsRes, logsRes] = await Promise.all([
        fetch('/api/super-admin/users', { headers: getAuthHeaders() }),
        fetch('/api/super-admin/schools', { headers: getAuthHeaders() }),
        fetch('/api/super-admin/pending-schools', { headers: getAuthHeaders() }),
        fetch('/api/super-admin/analytics', { headers: getAuthHeaders() }),
        fetch('/api/super-admin/login-activity', { headers: getAuthHeaders() })
      ]);

      if (usersRes.ok) {
        const allUsers = await usersRes.json();
        setViewers(allUsers.filter((u: any) => u.userType === 'viewer'));
      }
      if (schoolsRes.ok) setSchools(await schoolsRes.json());
      if (pendingSchoolsRes.ok) setPendingSchools(await pendingSchoolsRes.json());
      if (analyticsRes.ok) setAnalytics(await analyticsRes.json());
      if (logsRes.ok) setAdminLogs(await logsRes.json());
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: "Error",
        description: "Failed to fetch dashboard data",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const approveSchool = async (schoolId: string, schoolName: string) => {
    try {
      const response = await fetch(`/api/super-admin/approve-school/${schoolId}`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });

      if (response.ok) {
        toast({
          title: "School Approved",
          description: `${schoolName} has been approved successfully`,
        });
        
        fetchData();
      } else {
        const error = await response.json();
        toast({
          title: "Error",
          description: error.message || "Failed to approve school",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to approve school",
        variant: "destructive",
      });
    }
  };

  const rejectSchool = async (schoolId: string, schoolName: string, reason: string) => {
    try {
      const response = await fetch(`/api/super-admin/reject-school/${schoolId}`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ reason })
      });

      if (response.ok) {
        toast({
          title: "School Rejected",
          description: `${schoolName} registration has been rejected`,
        });
        fetchData();
      } else {
        const error = await response.json();
        toast({
          title: "Error",
          description: error.message || "Failed to reject school",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to reject school",
        variant: "destructive",
      });
    }
  };

  const fetchSchoolYears = async (schoolId: string) => {
    setYearLoading(true);
    try {
      const response = await fetch(`/api/super-admin/school-years/${schoolId}`, {
        headers: getAuthHeaders()
      });

      if (response.ok) {
        const data = await response.json();
        setSchoolYears(data);
      } else {
        let errorMessage = "Failed to fetch yearbooks";
        try {
          const error = await response.json();
          errorMessage = error.message || errorMessage;
        } catch (e) {
        }
        toast({
          title: "Error",
          description: errorMessage,
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch yearbooks. Please try again.",
        variant: "destructive",
      });
    } finally {
      setYearLoading(false);
    }
  };

  const toggleYearAccess = async (schoolId: string, year: number, unlock: boolean, orientation?: string, uploadType?: string) => {
    try {
      const response = await fetch('/api/super-admin/unlock-year', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ schoolId, year, unlock, orientation, uploadType })
      });

      if (response.ok) {
        const result = await response.json();
        const orientationText = orientation ? ` with ${orientation} orientation` : '';
        const uploadTypeText = uploadType ? ` and ${uploadType} upload` : '';
        toast({
          className: "bg-blue-600/60 backdrop-blur-lg border border-white/20 shadow-2xl text-white",
          title: "✅ Year Access Updated",
          description: `${result.message}${orientationText}${uploadTypeText}`,
        });
        
        if (selectedSchoolForYears) {
          await fetchSchoolYears(selectedSchoolForYears.id);
        }
      } else {
        const error = await response.json();
        toast({
          title: "Error",
          description: error.message || "Failed to update year access",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update year access",
        variant: "destructive",
      });
    }
  };

  const handleUnlockClick = (schoolId: string, year: number, schoolName: string) => {
    setPendingUnlockData({ schoolId, year, schoolName });
    setConfirmationDialogOpen(true);
  };

  const handleConfirmUnlock = () => {
    // Validate that orientation and upload type are selected
    if (!unlockOrientation || !unlockUploadType) {
      toast({
        title: "Missing Information",
        description: "Please select both orientation and upload type before unlocking",
        variant: "destructive",
      });
      return;
    }
    setConfirmationDialogOpen(false);
    setPasswordDialogOpen(true);
  };

  const handleApproveClick = (schoolId: string, schoolName: string) => {
    setPendingApprovalData({ schoolId, schoolName, action: 'approve' });
    setPasswordDialogOpen(true);
  };

  const handleDenyClick = (schoolId: string, schoolName: string) => {
    setPendingApprovalData({ schoolId, schoolName, action: 'deny' });
    setPasswordDialogOpen(true);
  };

  const handlePasswordSubmit = async () => {
    try {
      const response = await fetch('/api/super-admin/verify-password', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ password: adminPassword })
      });

      if (response.ok) {
        if (pendingUnlockData) {
          await toggleYearAccess(pendingUnlockData.schoolId, pendingUnlockData.year, true, unlockOrientation, unlockUploadType);
          setPendingUnlockData(null);
          setUnlockOrientation('');
          setUnlockUploadType('');
        } else if (pendingApprovalData) {
          if (pendingApprovalData.action === 'approve') {
            await approveSchool(pendingApprovalData.schoolId, pendingApprovalData.schoolName);
          } else {
            await rejectSchool(pendingApprovalData.schoolId, pendingApprovalData.schoolName, "Registration rejected by administrator");
          }
          setPendingApprovalData(null);
        }
        setPasswordDialogOpen(false);
        setAdminPassword('');
        setPasswordError('');
      } else {
        setPasswordError('Incorrect password. Please try again.');
      }
    } catch (error) {
      setPasswordError('Error verifying password. Please try again.');
    }
  };

  const cancelAction = () => {
    setConfirmationDialogOpen(false);
    setPasswordDialogOpen(false);
    setAdminPassword('');
    setPasswordError('');
    setPendingUnlockData(null);
    setPendingApprovalData(null);
    setUnlockOrientation('');
    setUnlockUploadType('');
  };

  const filteredViewers = viewers.filter(viewer => 
    viewer.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
    viewer.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (viewer.email && viewer.email.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const filteredSchools = schools.filter(school => 
    school.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    school.country.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredPendingSchools = pendingSchools.filter(school => 
    school.isEmailVerified && (
      school.name.toLowerCase().includes(pendingSchoolsSearch.toLowerCase()) ||
      school.city.toLowerCase().includes(pendingSchoolsSearch.toLowerCase()) ||
      school.country.toLowerCase().includes(pendingSchoolsSearch.toLowerCase())
    )
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 relative overflow-hidden">
      <div className="absolute inset-0 opacity-5">
        <div className="absolute top-0 left-0 w-full h-full">
          <div className="absolute top-20 left-20 w-32 h-32 bg-white rounded-full opacity-20 animate-float"></div>
          <div className="absolute top-60 right-40 w-24 h-24 bg-white rounded-full opacity-20 animate-float-delayed"></div>
          <div className="absolute bottom-40 left-40 w-20 h-20 bg-white rounded-full opacity-20 animate-float"></div>
          <div className="absolute bottom-20 right-20 w-16 h-16 bg-white rounded-full opacity-20 animate-float-delayed"></div>
        </div>
      </div>
      
      <div className="relative z-10 min-h-screen">
        <header className="bg-white/10 backdrop-blur-lg border-b border-white/20 shadow-2xl relative overflow-hidden" data-testid="header-dashboard">
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-0 left-0 w-full h-full">
              <div className="absolute top-2 left-10 w-8 h-8 bg-white rounded-full opacity-5 animate-float"></div>
              <div className="absolute top-3 right-20 w-6 h-6 bg-white rounded-full opacity-5 animate-float-delayed"></div>
              <div className="absolute bottom-2 left-20 w-5 h-5 bg-white rounded-full opacity-5 animate-float"></div>
              <div className="absolute bottom-1 right-10 w-4 h-4 bg-white rounded-full opacity-5 animate-float-delayed"></div>
            </div>
          </div>
          <div className="px-6 py-4 flex items-center justify-between relative z-10">
            <div className="flex items-center space-x-3">
              <img 
                src={logoImage} 
                alt="Logo" 
                className="w-10 h-10 object-contain" 
                data-testid="logo-header"
              />
              <div>
                <h1 className="text-xl font-bold text-white" data-testid="text-title-header">
                  Super Admin Dashboard
                </h1>
                <p className="text-sm text-blue-200" data-testid="text-subtitle">
                  Welcome back, {user.fullName}
                </p>
              </div>
            </div>
            <Button 
              variant="outline" 
              onClick={onLogout} 
              data-testid="button-logout"
              className="bg-white/10 backdrop-blur-lg border border-white/20 text-white hover:bg-white/20"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </Button>
          </div>
        </header>

      <main className="p-6" data-testid="main-dashboard">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6" data-testid="tabs-dashboard">
          <TabsList className="grid w-full grid-cols-6" data-testid="tabs-list">
            <TabsTrigger value="overview" data-testid="tab-overview">
              <BarChart3 className="w-4 h-4 mr-2" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="viewers" data-testid="tab-viewers">
              <Users className="w-4 h-4 mr-2" />
              Viewers
            </TabsTrigger>
            <TabsTrigger value="schools" data-testid="tab-schools">
              <School className="w-4 h-4 mr-2" />
              Schools
            </TabsTrigger>
            <TabsTrigger value="pending-schools" data-testid="tab-pending-schools">
              <AlertTriangle className="w-4 h-4 mr-2" />
              Pending {pendingSchools.length > 0 && <Badge variant="destructive" className="ml-1">{pendingSchools.length}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="yearbooks" data-testid="tab-yearbooks">
              <BookOpen className="w-4 h-4 mr-2" />
              Yearbooks
            </TabsTrigger>
            <TabsTrigger value="logs" data-testid="tab-logs">
              <Activity className="w-4 h-4 mr-2" />
              Activity Logs
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" data-testid="content-overview">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              <Card className="bg-white/10 backdrop-blur-lg border border-white/20 shadow-2xl" data-testid="card-total-schools">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-white">Registered Schools</CardTitle>
                  <School className="h-4 w-4 text-blue-200" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-white" data-testid="text-total-schools">{analytics.totalSchools || 0}</div>
                  <div className="text-xs text-blue-200 mt-1">Educational institutions</div>
                </CardContent>
              </Card>

              <Card className="bg-white/10 backdrop-blur-lg border border-white/20 shadow-2xl" data-testid="card-total-viewers">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-white">Total Viewers</CardTitle>
                  <Users className="h-4 w-4 text-blue-200" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-white" data-testid="text-total-viewers">{analytics.usersByType?.viewers || 0}</div>
                  <div className="text-xs text-blue-200 mt-1">Active viewer accounts</div>
                </CardContent>
              </Card>

              <Card className="bg-white/10 backdrop-blur-lg border border-white/20 shadow-2xl" data-testid="card-pending-schools">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-white">Pending Schools</CardTitle>
                  <AlertTriangle className="h-4 w-4 text-yellow-400" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-white" data-testid="text-pending-schools">{pendingSchools.length}</div>
                  <div className="text-xs text-blue-200 mt-1">Awaiting verification</div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Viewers Tab */}
          <TabsContent value="viewers" data-testid="content-viewers">
            <Card className="bg-white/10 backdrop-blur-lg border border-white/20 shadow-2xl">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-white">Viewer Accounts</CardTitle>
                  <div className="flex items-center space-x-2">
                    <Search className="w-4 h-4 text-blue-200" />
                    <Input
                      placeholder="Search viewers..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-64 bg-white/10 backdrop-blur-lg border border-white/20 text-white placeholder:text-blue-200"
                      data-testid="input-search-viewers"
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Table data-testid="table-viewers">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-white">Username</TableHead>
                      <TableHead className="text-white">Full Name</TableHead>
                      <TableHead className="text-white">Phone Number</TableHead>
                      <TableHead className="text-white">Email</TableHead>
                      <TableHead className="text-white">Created</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredViewers.map((viewer) => (
                      <TableRow key={viewer.id} data-testid={`row-viewer-${viewer.id}`}>
                        <TableCell className="font-medium text-white">{viewer.username}</TableCell>
                        <TableCell className="text-white">{viewer.fullName}</TableCell>
                        <TableCell className="text-white">{viewer.phoneNumber || "N/A"}</TableCell>
                        <TableCell className="text-white">{viewer.email || "N/A"}</TableCell>
                        <TableCell className="text-white">{new Date(viewer.createdAt).toLocaleDateString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Schools Tab */}
          <TabsContent value="schools" data-testid="content-schools">
            <Card className="bg-white/10 backdrop-blur-lg border border-white/20 shadow-2xl">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-white">Registered Schools</CardTitle>
                  <div className="flex items-center space-x-2">
                    <Search className="w-4 h-4 text-blue-200" />
                    <Input
                      placeholder="Search schools..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-64 bg-white/10 backdrop-blur-lg border border-white/20 text-white placeholder:text-blue-200"
                      data-testid="input-search-schools"
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Table data-testid="table-schools">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-white">Username</TableHead>
                      <TableHead className="text-white">School Name</TableHead>
                      <TableHead className="text-white">Cloudinary Folder</TableHead>
                      <TableHead className="text-white">Founding Year</TableHead>
                      <TableHead className="text-white">Country</TableHead>
                      <TableHead className="text-white">Email</TableHead>
                      <TableHead className="text-white">Phone Number</TableHead>
                      <TableHead className="text-white">Created</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredSchools.map((school) => (
                      <TableRow key={school.id} data-testid={`row-school-${school.id}`}>
                        <TableCell className="font-medium text-white">{school.adminUsername || 'N/A'}</TableCell>
                        <TableCell className="font-medium text-white">{school.name}</TableCell>
                        <TableCell className="text-xs text-blue-200 font-mono" data-testid={`text-cloudinary-path-${school.id}`}>
                          <div className="space-y-1">
                            <div className="text-white font-semibold">{getAllSchoolFolderPaths(school.name, school.schoolCode).base}</div>
                            <div className="text-[10px] opacity-75">
                              {getAllSchoolFolderPaths(school.name, school.schoolCode).examples.map((path, idx) => (
                                <div key={idx}>• {path}</div>
                              ))}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-white">{school.yearFounded}</TableCell>
                        <TableCell className="text-white">{school.country}</TableCell>
                        <TableCell className="text-white">{school.email}</TableCell>
                        <TableCell className="text-white">{school.phoneNumber || 'N/A'}</TableCell>
                        <TableCell className="text-white">{new Date(school.createdAt).toLocaleDateString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Pending Schools Tab */}
          <TabsContent value="pending-schools" data-testid="content-pending-schools">
            <Card className="bg-white/10 backdrop-blur-lg border border-white/20 shadow-2xl">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-white">School Registration Requests</CardTitle>
                  <div className="flex items-center space-x-2">
                    <Search className="w-4 h-4 text-blue-200" />
                    <Input
                      placeholder="Search pending schools..."
                      value={pendingSchoolsSearch}
                      onChange={(e) => setPendingSchoolsSearch(e.target.value)}
                      className="w-64 bg-white/10 backdrop-blur-lg border border-white/20 text-white placeholder:text-blue-200"
                      data-testid="input-search-pending-schools"
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {filteredPendingSchools.length === 0 ? (
                  <div className="text-center py-8">
                    <School className="w-12 h-12 mx-auto text-blue-200 mb-2" />
                    <p className="text-blue-200">
                      {pendingSchoolsSearch ? "No schools found matching your search" : "No pending school requests"}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4" data-testid="list-pending-schools">
                    {filteredPendingSchools.map((school) => (
                      <Card key={school.id} className="bg-white/10 backdrop-blur-lg border border-white/20 shadow-2xl border-l-4 border-l-yellow-500" data-testid={`card-pending-school-${school.id}`}>
                        <CardContent className="p-6">
                          <div className="flex justify-between items-start mb-4">
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <h3 className="text-lg font-semibold text-white">
                                  {school.name}
                                </h3>
                                {school.isEmailVerified && (
                                  <Badge variant="outline" className="bg-green-500/20 text-green-300 border-green-400/50">
                                    <CheckCircle2 className="w-3 h-3 mr-1" />
                                    Email Verified
                                  </Badge>
                                )}
                              </div>
                              <p className="text-sm text-blue-200">
                                Submitted on {new Date(school.createdAt).toLocaleDateString()}
                              </p>
                            </div>
                            <div className="flex space-x-2">
                              <Button 
                                size="sm" 
                                onClick={() => handleApproveClick(school.id, school.name)}
                                data-testid={`button-approve-school-${school.id}`}
                              >
                                <UserCheck className="w-4 h-4 mr-1" />
                                Approve
                              </Button>
                              <Button 
                                variant="destructive" 
                                size="sm" 
                                onClick={() => handleDenyClick(school.id, school.name)}
                                data-testid={`button-deny-school-${school.id}`}
                              >
                                Deny
                              </Button>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                            <div>
                              <h4 className="font-medium text-white mb-1">School Information</h4>
                              <div className="space-y-1">
                                <p className="text-white"><span className="text-blue-200">Location:</span> {school.city}, {school.country}</p>
                                <p className="text-white"><span className="text-blue-200">Founded:</span> {school.yearFounded}</p>
                                <p className="text-white"><span className="text-blue-200">Email:</span> {school.email}</p>
                                <p className="text-white"><span className="text-blue-200">Phone:</span> {school.phoneNumber || "Not provided"}</p>
                                <p className="text-white">
                                  <span className="text-blue-200">Website:</span>{" "}
                                  {school.website ? (
                                    <a 
                                      href={school.website.startsWith('http') ? school.website : `https://${school.website}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-blue-400 hover:text-blue-300 hover:underline"
                                      data-testid={`link-website-${school.id}`}
                                    >
                                      {school.website}
                                    </a>
                                  ) : (
                                    "Not provided"
                                  )}
                                </p>
                                {school.address && (
                                  <p className="text-white"><span className="text-blue-200">Address:</span> {school.address}</p>
                                )}
                              </div>
                            </div>

                            <div>
                              <h4 className="font-medium text-white mb-1">Admin Credentials</h4>
                              <div className="space-y-1">
                                <p className="text-white"><span className="text-blue-200">Username:</span> <code className="bg-white/10 px-1 py-0.5 rounded text-xs text-white">{school.tempAdminCredentials?.username || 'N/A'}</code></p>
                              </div>
                            </div>

                            <div>
                              <h4 className="font-medium text-white mb-1">Registration Details</h4>
                              <div className="space-y-1">
                                {school.registrationNumber ? (
                                  <p className="text-white"><span className="text-blue-200">Reg. Number:</span> {school.registrationNumber}</p>
                                ) : (
                                  <p className="text-white"><span className="text-blue-200">Reg. Number:</span> <span className="text-blue-200">Not provided</span></p>
                                )}
                                {school.accreditationDocument ? (
                                  <div className="flex items-center space-x-2">
                                    <span className="text-blue-200">Accreditation:</span>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => window.open(`/${school.accreditationDocument}`, '_blank')}
                                      className="text-xs h-6 px-2"
                                      data-testid={`button-view-document-${school.id}`}
                                    >
                                      View Document
                                    </Button>
                                  </div>
                                ) : (
                                  <p className="text-white"><span className="text-blue-200">Accreditation:</span> <span className="text-blue-200">Not provided</span></p>
                                )}
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Yearbook Management Tab */}
          <TabsContent value="yearbooks" data-testid="content-yearbooks">
            <div className="space-y-6">
              {!selectedSchoolForYears ? (
                <Card className="bg-white/10 backdrop-blur-lg border border-white/20 shadow-2xl">
                  <CardHeader>
                    <CardTitle className="text-white">Yearbook Management</CardTitle>
                    <p className="text-sm text-blue-200">
                      Select a school to manage their yearbook access and unlocked years
                    </p>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex items-center space-x-2 mb-4">
                        <Search className="w-4 h-4 text-blue-200" />
                        <Input
                          placeholder="Search schools..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="w-64 bg-white/10 backdrop-blur-lg border border-white/20 text-white placeholder:text-blue-200"
                          data-testid="input-search-schools-yearbooks"
                        />
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {filteredSchools.map((school) => (
                          <Card key={school.id} className="bg-white/10 backdrop-blur-lg border border-white/20 shadow-2xl hover-elevate active-elevate-2 cursor-pointer transition-colors" data-testid={`card-school-yearbook-${school.id}`}>
                            <CardContent className="p-4" onClick={() => {
                              setSelectedSchoolForYears(school);
                              fetchSchoolYears(school.id);
                            }}>
                              <div className="flex items-center space-x-3">
                                <Avatar className="h-10 w-10 flex-shrink-0">
                                  <AvatarImage src={school.logo || undefined} alt={school.name} />
                                  <AvatarFallback className="bg-white/10 text-blue-200 font-semibold">
                                    {school.name.charAt(0).toUpperCase()}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="flex-1">
                                  <h3 className="font-medium text-sm text-white">{school.name}</h3>
                                  <p className="text-xs text-blue-200">{school.city}, {school.country}</p>
                                  <p className="text-xs text-blue-200">Founded: {school.yearFounded}</p>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-4">
                  <Card className="bg-white/10 backdrop-blur-lg border border-white/20 shadow-2xl">
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <Avatar className="h-12 w-12 flex-shrink-0">
                            <AvatarImage src={selectedSchoolForYears.logo || undefined} alt={selectedSchoolForYears.name} />
                            <AvatarFallback className="bg-white/10 text-blue-200 font-semibold">
                              {selectedSchoolForYears.name.charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <CardTitle className="text-white">
                              {selectedSchoolForYears.name}
                            </CardTitle>
                            <p className="text-sm text-blue-200">
                              {selectedSchoolForYears.city}, {selectedSchoolForYears.country} • Founded {selectedSchoolForYears.yearFounded}
                            </p>
                          </div>
                        </div>
                        <Button variant="outline" onClick={() => {
                          setSelectedSchoolForYears(null);
                          setSchoolYears(null);
                        }} data-testid="button-back-to-schools">
                          Back to Schools
                        </Button>
                      </div>
                    </CardHeader>
                  </Card>

                  {yearLoading ? (
                    <Card className="bg-white/10 backdrop-blur-lg border border-white/20 shadow-2xl">
                      <CardContent className="p-8 text-center">
                        <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
                        <p className="text-blue-200">Loading school years...</p>
                      </CardContent>
                    </Card>
                  ) : schoolYears ? (
                    <Card className="bg-white/10 backdrop-blur-lg border border-white/20 shadow-2xl">
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <div>
                            <CardTitle className="text-white">Year Access Management</CardTitle>
                            <p className="text-sm text-blue-200">
                              Control which years {selectedSchoolForYears.name} has access to. Green = Unlocked, Red = Locked
                            </p>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Button
                              variant={yearsViewMode === 'grid' ? 'default' : 'outline'}
                              size="sm"
                              onClick={() => setYearsViewMode('grid')}
                              data-testid="button-grid-view"
                            >
                              <Grid className="w-4 h-4" />
                            </Button>
                            <Button
                              variant={yearsViewMode === 'list' ? 'default' : 'outline'}
                              size="sm"
                              onClick={() => setYearsViewMode('list')}
                              data-testid="button-list-view"
                            >
                              <List className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        {yearsViewMode === 'grid' ? (
                          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                            {schoolYears.years.map((yearData: any) => (
                              <Card key={yearData.year} className="bg-white/10 backdrop-blur-lg border border-white/20 shadow-2xl" data-testid={`card-year-${yearData.year}`}>
                                <CardContent className="p-3 text-center">
                                  <div className="flex items-center justify-center mb-2">
                                    {yearData.purchased ? (
                                      <Calendar className="w-5 h-5 text-green-400" />
                                    ) : (
                                      <Lock className="w-5 h-5 text-blue-200" />
                                    )}
                                  </div>
                                  <h3 className="font-bold text-lg text-white">{yearData.year}</h3>
                                  <p className="text-xs text-blue-200 mb-2">
                                    {yearData.purchased ? 'Access Granted' : 'Not Purchased'}
                                  </p>
                                  {yearData.purchaseDate && (
                                    <p className="text-xs text-green-400 mb-2">
                                      {new Date(yearData.purchaseDate).toLocaleDateString()}
                                    </p>
                                  )}
                                  <Button
                                    size="sm"
                                    variant={yearData.purchased ? "secondary" : "default"}
                                    disabled={yearData.purchased}
                                    onClick={yearData.purchased ? undefined : () => handleUnlockClick(selectedSchoolForYears.id, yearData.year, selectedSchoolForYears.name)}
                                    data-testid={`button-toggle-year-${yearData.year}`}
                                    className="w-full"
                                  >
                                    {yearData.purchased ? 'Purchased' : 'Unlock'}
                                  </Button>
                                </CardContent>
                              </Card>
                            ))}
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {schoolYears.years.map((yearData: any) => (
                              <Card key={yearData.year} className="bg-white/10 backdrop-blur-lg border border-white/20 shadow-2xl" data-testid={`card-year-list-${yearData.year}`}>
                                <CardContent className="p-4">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center space-x-4">
                                      {yearData.purchased ? (
                                        <Unlock className="w-5 h-5 text-green-400" />
                                      ) : (
                                        <Lock className="w-5 h-5 text-blue-200" />
                                      )}
                                      <div>
                                        <h3 className="font-bold text-lg text-white">{yearData.year}</h3>
                                        <p className="text-sm text-blue-200">
                                          {yearData.purchased ? 'Access Granted' : 'Not Purchased'}
                                        </p>
                                        {yearData.purchaseDate && (
                                          <p className="text-sm text-green-400">
                                            Unlocked: {new Date(yearData.purchaseDate).toLocaleDateString()}
                                          </p>
                                        )}
                                      </div>
                                    </div>
                                    <Button
                                      size="sm"
                                      variant={yearData.purchased ? "secondary" : "default"}
                                      disabled={yearData.purchased}
                                      onClick={yearData.purchased ? undefined : () => handleUnlockClick(selectedSchoolForYears.id, yearData.year, selectedSchoolForYears.name)}
                                      data-testid={`button-toggle-year-${yearData.year}`}
                                    >
                                      {yearData.purchased ? (yearData.unlockedByAdmin ? 'Unlocked' : 'Purchased') : 'Unlock'}
                                    </Button>
                                  </div>
                                </CardContent>
                              </Card>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ) : null}
                </div>
              )}
            </div>
          </TabsContent>

          {/* Activity Logs Tab */}
          <TabsContent value="logs" data-testid="content-logs">
            <Card className="bg-white/10 backdrop-blur-lg border border-white/20 shadow-2xl">
              <CardHeader>
                <CardTitle className="text-white">Super Admin Login Activity</CardTitle>
                <p className="text-sm text-blue-200">Recent login sessions and activity for your account</p>
              </CardHeader>
              <CardContent>
                <Table data-testid="table-logs">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-white">Timestamp</TableHead>
                      <TableHead className="text-white">Action</TableHead>
                      <TableHead className="text-white">IP Address</TableHead>
                      <TableHead className="text-white">Device/Browser</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {adminLogs.length > 0 ? adminLogs.map((log: any) => (
                      <TableRow key={log.id} data-testid={`row-log-${log.id}`}>
                        <TableCell className="text-white">{new Date(log.createdAt).toLocaleString()}</TableCell>
                        <TableCell className="text-white">
                          <Badge variant={log.loginStatus === 'success' ? 'default' : 'destructive'}>
                            {log.loginStatus === 'success' ? 'Login' : 'Failed Login'}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs text-white">{log.ipAddress || 'N/A'}</TableCell>
                        <TableCell className="text-white text-xs">
                          {log.browser && log.os ? `${log.browser} on ${log.os}` : log.userAgent || 'N/A'}
                        </TableCell>
                      </TableRow>
                    )) : (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-blue-200 py-8">
                          No login activity recorded yet
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Confirmation Dialog */}
        <AlertDialog open={confirmationDialogOpen} onOpenChange={setConfirmationDialogOpen}>
          <AlertDialogContent data-testid="dialog-confirm-unlock" className="bg-white/10 backdrop-blur-lg border border-white/20 shadow-2xl text-white max-w-md">
            <AlertDialogHeader>
              <AlertDialogTitle>Configure Yearbook Unlock</AlertDialogTitle>
              <AlertDialogDescription className="text-gray-100">
                Unlock the {pendingUnlockData?.year} yearbook for "{pendingUnlockData?.schoolName}"
              </AlertDialogDescription>
            </AlertDialogHeader>
            
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="orientation" className="text-white">Yearbook Orientation *</Label>
                <Select value={unlockOrientation} onValueChange={(value: 'portrait' | 'landscape') => setUnlockOrientation(value)}>
                  <SelectTrigger id="orientation" data-testid="select-orientation" className="bg-white/10 border-white/20 text-white">
                    <SelectValue placeholder="Select orientation" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="portrait" data-testid="option-portrait">Portrait</SelectItem>
                    <SelectItem value="landscape" data-testid="option-landscape">Landscape</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="uploadType" className="text-white">Upload Type *</Label>
                <Select value={unlockUploadType} onValueChange={(value: 'image' | 'pdf') => setUnlockUploadType(value)}>
                  <SelectTrigger id="uploadType" data-testid="select-upload-type" className="bg-white/10 border-white/20 text-white">
                    <SelectValue placeholder="Select upload type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="image" data-testid="option-image">Image Upload</SelectItem>
                    <SelectItem value="pdf" data-testid="option-pdf">PDF Upload</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <p className="text-sm text-blue-200">
                * Both fields are required. This will grant the school access without requiring payment.
              </p>
            </div>

            <AlertDialogFooter>
              <AlertDialogCancel onClick={cancelAction} data-testid="button-cancel-unlock" className="text-white bg-white/10 backdrop-blur-lg border border-white/20 shadow-2xl">
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction onClick={handleConfirmUnlock} data-testid="button-confirm-unlock">
                Continue to Password
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Password Verification Dialog */}
        <AlertDialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen}>
          <AlertDialogContent data-testid="dialog-password-verification" className="bg-white/10 backdrop-blur-lg border border-white/20 shadow-2xl text-white">
            <AlertDialogHeader className="text-white">
              <AlertDialogTitle>Enter Super Admin Password</AlertDialogTitle>
              <AlertDialogDescription className="text-white">
                {pendingApprovalData 
                  ? `Please enter your super admin password to ${pendingApprovalData.action} "${pendingApprovalData.schoolName}".`
                  : "Please enter your super admin password to confirm this action."
                }
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="py-4">
              <Input
                type="password"
                placeholder="Enter your password"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handlePasswordSubmit()}
                data-testid="input-admin-password"
                className="bg-white/10 backdrop-blur-lg border border-white/20 text-white placeholder:text-gray-200"
              />
              {passwordError && (
                <p className="text-sm text-red-400 mt-2" data-testid="text-password-error">
                  {passwordError}
                </p>
              )}
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={cancelAction} data-testid="button-cancel-password" className="bg-white/10 backdrop-blur-lg border border-white/20 shadow-2xl">
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction onClick={handlePasswordSubmit} data-testid="button-submit-password">
                Verify & Confirm
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </main>
      </div>
    </div>
  );
}
