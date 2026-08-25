import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, GraduationCap, Clock, FileImage } from "lucide-react";
import type { User, School, AlumniRequest, Memory } from "@shared/schema";

interface SchoolDashboardHomeProps {
  user: User | null;
}

export default function SchoolDashboardHome({ user }: SchoolDashboardHomeProps) {
  const { data: school } = useQuery<School>({
    queryKey: ["/api/schools", user?.id],
    enabled: !!user,
  });

  const { data: allRequests = [] } = useQuery<AlumniRequest[]>({
    queryKey: ["/api/alumni-requests/school", school?.id],
    enabled: !!school?.id,
  });

  const { data: pendingMemories = [] } = useQuery<Memory[]>({
    queryKey: ["/api/memories/pending", school?.id],
    enabled: !!school?.id,
  });

  const pendingRequests = allRequests.filter(request => request.status === 'pending');
  const approvedAlumni = allRequests.filter(request => request.status === 'approved');

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">
          Welcome back, {school?.name || user?.fullName}
        </h1>
        <p className="text-sm sm:text-base text-white/70">
          Here's an overview of your yearbook platform
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <Card className="bg-white/10 backdrop-blur-lg border-white/20">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-white/80">
              Pending Requests
            </CardTitle>
            <Clock className="h-4 w-4 text-yellow-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{pendingRequests.length}</div>
            <p className="text-xs text-white/60 mt-1">Alumni verification requests</p>
          </CardContent>
        </Card>

        <Card className="bg-white/10 backdrop-blur-lg border-white/20">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-white/80">
              Verified Alumni
            </CardTitle>
            <GraduationCap className="h-4 w-4 text-green-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{approvedAlumni.length}</div>
            <p className="text-xs text-white/60 mt-1">Active alumni badges</p>
          </CardContent>
        </Card>

        <Card className="bg-white/10 backdrop-blur-lg border-white/20">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-white/80">
              Pending Memories
            </CardTitle>
            <FileImage className="h-4 w-4 text-blue-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{pendingMemories.length}</div>
            <p className="text-xs text-white/60 mt-1">Awaiting approval</p>
          </CardContent>
        </Card>

        <Card className="bg-white/10 backdrop-blur-lg border-white/20">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-white/80">
              School Profile
            </CardTitle>
            <Users className="h-4 w-4 text-purple-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{school?.name}</div>
            <p className="text-xs text-white/60 mt-1">{school?.email}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
