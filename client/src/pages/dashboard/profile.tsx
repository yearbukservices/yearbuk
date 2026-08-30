import { useState, useEffect, useMemo, useRef, type TouchEvent as ReactTouchEvent } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Settings, Award, Plus, Heart, Trash2, ChevronLeft, ChevronRight, X } from "lucide-react";
import type { AlumniBadge, User as UserType, Memory, School } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import AlumniRequestDialog from "@/components/AlumniRequestDialog";
import { AlumniMemoryUploadDialog } from "@/components/AlumniMemoryUploadDialog";

type MemoryZoomState = {
  scale: number;
  offsetX: number;
  offsetY: number;
};

export default function ProfilePage() {
  const [, setLocation] = useLocation();
  const [user, setUser] = useState<UserType | null>(null);
  const [activeTab, setActiveTab] = useState<"posts" | "tagged" | "badges">("posts");
  const [selectedPostIndex, setSelectedPostIndex] = useState<number | null>(null);
  const [selectedTaggedIndex, setSelectedTaggedIndex] = useState<number | null>(null);
  const touchStartX = useRef<number | null>(null);
  const memoryZoomRef = useRef<MemoryZoomState>({ scale: 1, offsetX: 0, offsetY: 0 });
  const [memoryZoom, setMemoryZoom] = useState<MemoryZoomState>({ scale: 1, offsetX: 0, offsetY: 0 });
  const [memoryGestureActive, setMemoryGestureActive] = useState(false);
  const pinchStart = useRef<{ distance: number; zoom: MemoryZoomState } | null>(null);
  const panStart = useRef<{ x: number; y: number; offsetX: number; offsetY: number } | null>(null);
  const gestureMode = useRef<"swipe" | "pinch" | "pan" | null>(null);

  const updateMemoryZoom = (nextZoom: MemoryZoomState) => {
    memoryZoomRef.current = nextZoom;
    setMemoryZoom(nextZoom);
  };

  const resetMemoryZoom = () => {
    updateMemoryZoom({ scale: 1, offsetX: 0, offsetY: 0 });
  };

  const clearMemoryGesture = () => {
    touchStartX.current = null;
    pinchStart.current = null;
    panStart.current = null;
    gestureMode.current = null;
  };

  const resetMemoryInteraction = () => {
    clearMemoryGesture();
    setMemoryGestureActive(false);
    resetMemoryZoom();
  };

  const getTouchDistance = (event: ReactTouchEvent) => {
    const firstTouch = event.touches[0];
    const secondTouch = event.touches[1];
    if (!firstTouch || !secondTouch) return 0;

    return Math.hypot(
      secondTouch.clientX - firstTouch.clientX,
      secondTouch.clientY - firstTouch.clientY,
    );
  };

  const handleMemoryTouchStart = (event: ReactTouchEvent) => {
    if (event.touches.length >= 2) {
      const distance = getTouchDistance(event);
      if (distance > 0) {
        pinchStart.current = { distance, zoom: memoryZoomRef.current };
        gestureMode.current = "pinch";
        setMemoryGestureActive(true);
        touchStartX.current = null;
        panStart.current = null;
      }
      return;
    }

    const touch = event.touches[0];
    if (!touch) return;

    if (memoryZoomRef.current.scale > 1) {
      panStart.current = {
        x: touch.clientX,
        y: touch.clientY,
        offsetX: memoryZoomRef.current.offsetX,
        offsetY: memoryZoomRef.current.offsetY,
      };
      gestureMode.current = "pan";
      setMemoryGestureActive(true);
      return;
    }

    touchStartX.current = touch.clientX;
    gestureMode.current = "swipe";
  };

  const handleMemoryTouchMove = (event: ReactTouchEvent) => {
    if (event.touches.length >= 2 && pinchStart.current) {
      event.preventDefault();
      const distance = getTouchDistance(event);
      if (!distance) return;

      const rawScale = pinchStart.current.zoom.scale * (distance / pinchStart.current.distance);
      const nextScale = rawScale < 1
        ? 1 - Math.min(0.3, (1 - rawScale) * 0.4)
        : 1 + Math.min(0.75, (rawScale - 1) * 0.4);
      updateMemoryZoom({ ...pinchStart.current.zoom, scale: nextScale });
      return;
    }

    if (gestureMode.current === "pan" && panStart.current && event.touches[0]) {
      event.preventDefault();
      const touch = event.touches[0];
      const zoom = memoryZoomRef.current;
      const maxOffsetX = (window.innerWidth * (zoom.scale - 1)) / 2;
      const maxOffsetY = (window.innerHeight * (zoom.scale - 1)) / 2;
      const nextOffsetX = panStart.current.offsetX + touch.clientX - panStart.current.x;
      const nextOffsetY = panStart.current.offsetY + touch.clientY - panStart.current.y;

      updateMemoryZoom({
        ...zoom,
        offsetX: Math.min(maxOffsetX, Math.max(-maxOffsetX, nextOffsetX)),
        offsetY: Math.min(maxOffsetY, Math.max(-maxOffsetY, nextOffsetY)),
      });
    }
  };

  const handleMemoryTouchEnd = (event: ReactTouchEvent, collection: "posts" | "tagged") => {
    if (pinchStart.current || gestureMode.current === "pan") {
      resetMemoryInteraction();
      return;
    }

    const startX = touchStartX.current;
    const endX = event.changedTouches[0]?.clientX;
    clearMemoryGesture();

    if (startX === null || endX === undefined || memoryZoomRef.current.scale > 1) return;

    const distance = startX - endX;
    if (Math.abs(distance) < 50) return;

    resetMemoryZoom();
    if (collection === "posts") {
      setSelectedPostIndex(current => {
        if (current === null) return current;
        return distance > 0
          ? Math.min(current + 1, publicMemories.length - 1)
          : Math.max(current - 1, 0);
      });
    } else {
      setSelectedTaggedIndex(current => {
        if (current === null) return current;
        return distance > 0
          ? Math.min(current + 1, taggedMemories.length - 1)
          : Math.max(current - 1, 0);
      });
    }
  };
  const [showAlumniRequestDialog, setShowAlumniRequestDialog] = useState(false);
  const [showAlumniMemoryUploadDialog, setShowAlumniMemoryUploadDialog] = useState(false);
  const [deletingMemoryId, setDeletingMemoryId] = useState<string | null>(null);
  const [memoryPendingDeletion, setMemoryPendingDeletion] = useState<{
    memory: Memory;
    collection: "posts" | "tagged";
  } | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    resetMemoryInteraction();
  }, [selectedPostIndex, selectedTaggedIndex]);

  useEffect(() => {
    const userData = localStorage.getItem("user");
    if (userData) {
      const parsedUser = JSON.parse(userData);
      setUser(parsedUser);
      fetch(`/api/users/${parsedUser.id}`)
        .then(res => res.json())
        .then(updatedUser => {
          setUser(updatedUser);
          localStorage.setItem('user', JSON.stringify(updatedUser));
        })
        .catch(err => console.error('Failed to refresh user data:', err));
    }
  }, []);

  const { data: alumniBadges = [] } = useQuery<AlumniBadge[]>({
    queryKey: ["/api/alumni-badges", user?.id],
    enabled: !!user,
    queryFn: async () => {
      if (!user?.id) return [];
      const res = await fetch(`/api/alumni-badges/${user.id}`);
      if (!res.ok) throw new Error("Failed to fetch alumni badges");
      return res.json();
    }
  });

  const { data: schools = [] } = useQuery<School[]>({
    queryKey: ["/api/schools"],
    enabled: !!user,
  });

  const { data: userMemories = [] } = useQuery<Memory[]>({
    queryKey: ["/api/memories/user", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      if (!user?.id) return [];
      const res = await fetch(`/api/memories/user/${user.id}`);
      if (!res.ok) return [];
      return res.json();
    }
  });

  const getSchoolLogo = (schoolName: string): string | null => {
    const school = schools.find(s => s.name === schoolName);
    return school?.logo || null;
  };

  const getSchoolUsername = (schoolName: string): string | null => {
    const school = schools.find(s => s.name === schoolName);
    return school?.username || null;
  };

  const getMemorySchoolName = (memory: Memory): string =>
    schools.find((school) => school.id === memory.schoolId)?.name || "Unknown school";

  const deleteAlumniBadgeMutation = useMutation({
    mutationFn: async (badgeId: string) => {
      await apiRequest("DELETE", `/api/alumni-badges/${badgeId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/alumni-badges", user?.id] });
      toast({
        title: "Badge deleted",
        description: "Alumni badge has been successfully deleted.",
      });
    },
  });

  const { data: taggedMemories = [] } = useQuery<Memory[]>({
    queryKey: ["/api/memories/tagged", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      if (!user?.id) return [];
      const res = await fetch(`/api/memories/tagged/${user.id}`);
      if (!res.ok) return [];
      return res.json();
    }
  });

  const publicMemories = useMemo(() => 
    userMemories.filter(m => m.status === 'approved'), 
    [userMemories]
  );
  const hasVerifiedAlumniBadge = alumniBadges.some((badge) => badge.status === "verified");

  if (!user) return null;



  const canDeleteMemory = (memory: Memory): boolean => memory.userId === user.id;


  const requestDeleteMemory = (memory: Memory, collection: "posts" | "tagged") => {
    if (!canDeleteMemory(memory) || deletingMemoryId) return;
    setMemoryPendingDeletion({ memory, collection });
  };

  const handleDeleteMemory = async (memory: Memory, collection: "posts" | "tagged") => {
    if (!canDeleteMemory(memory) || deletingMemoryId) return;
    setDeletingMemoryId(memory.id);
    try {
      const response = await fetch("/api/memories/" + memory.id, {
        method: "DELETE",
        headers: { Authorization: "Bearer " + user.id },
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || "Failed to delete memory");
      }
      queryClient.setQueryData<Memory[]>(["/api/memories/user", user.id], (memories) =>
        memories?.filter((item) => item.id !== memory.id),
      );
      queryClient.setQueryData<Memory[]>(["/api/memories/tagged", user.id], (memories) =>
        memories?.filter((item) => item.id !== memory.id),
      );
      if (collection === "posts") setSelectedPostIndex(null);
      else setSelectedTaggedIndex(null);
      toast({
        title: "Memory deleted",
        description: "The memory was removed from your profile.",
      });
    } catch (error) {
      toast({
        title: "Could not delete memory",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setDeletingMemoryId(null);
    }
  };


  const getInitials = (name: string) => name.split(' ').map(n => n[0]).join('').toUpperCase();

  return (
    <div className="min-h-screen  py-8">
      <div className="max-w-3xl mx-auto px-4">
        {/* Header Section */}
        <div className="text-center mb-12 space-y-6">
          {/* Profile Picture */}
          <div className="flex justify-center">
            <Avatar className="h-32 w-32 ">
              <AvatarImage src={user.profileImage || undefined} />
              <AvatarFallback className="text-2xl bg-gradient-to-br from-blue-500 to-cyan-500 text-white">
                {getInitials(user.fullName || user.email)}
              </AvatarFallback>
            </Avatar>
          </div>

          {/* Name & Username */}
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">{user.fullName}</h1>
            <p className="text-lg text-cyan-300">@{user.username}</p>
          </div>

          {/* Stats Row */}
          <div className="flex justify-center gap-12 mt-8">
            <div className="text-center">
              <div className="text-3xl font-bold text-white">{publicMemories.length}</div>
              <div className="text-sm text-white/60 mt-1">Posts</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-white">{taggedMemories.length}</div>
              <div className="text-sm text-white/60 mt-1">Tagged</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-white">{alumniBadges.filter((b: any) => b.status === "verified").length}</div>
              <div className="text-sm text-white/60 mt-1">Badges</div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-center gap-4 mt-8">
            <Button
              onClick={() => setLocation("/viewer-settings")}
              className="bg-gradient-to-r from-blue-500 to-cyan-500 text-white"
              data-testid="button-settings"
            >
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </Button>
            <Button
              onClick={() => setShowAlumniRequestDialog(true)}
              variant="outline"
              className="border-cyan-400/30 bg-cyan-40 text-cyan-300 hover:bg-cyan-400/10"
              data-testid="button-request-alumni"
            >
              <Plus className="h-4 w-4 mr-2" />
              Request Alumni
            </Button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex justify-center gap-8 mb-12 border-b border-white/10">
          {["posts", "tagged", "badges"].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as typeof activeTab)}
              className={`py-4 px-2 font-medium transition-colors relative capitalize ${
                activeTab === tab
                  ? "text-white"
                  : "text-white/50 hover:text-white/70"
              }`}
              data-testid={`tab-${tab}`}
            >
              {tab}
              {activeTab === tab && (
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-400 to-blue-400" />
              )}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div>
          {/* Posts Tab */}
          {activeTab === "posts" && (
            <div>
              {publicMemories.length === 0 && !hasVerifiedAlumniBadge ? (
                <div className="text-center py-12">
                  <Heart className="h-12 w-12 text-white/30 mx-auto mb-4" />
                  <p className="text-white/60">No posts yet</p>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {hasVerifiedAlumniBadge && (
                    <Card
                      className="bg-white/5 border-white/10 overflow-hidden cursor-pointer hover:bg-white/10 transition-all"
                      onClick={() => setShowAlumniMemoryUploadDialog(true)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          setShowAlumniMemoryUploadDialog(true);
                        }
                      }}
                      role="button"
                      tabIndex={0}
                      data-testid="card-add-alumni-memory"
                    >
                      <CardContent className="p-0 aspect-square flex flex-col items-center justify-center gap-2">
                        <Plus className="h-10 w-10 text-cyan-300" />
                        <span className="text-xs font-medium text-cyan-100">Upload memory</span>
                      </CardContent>
                    </Card>
                  )}
                  {publicMemories.map((memory, index) => (
                    <Card
                      key={memory.id}
                      className="bg-white/5 border-white/10 overflow-hidden cursor-pointer hover:bg-white/10 transition-all"
                      onClick={() => setSelectedPostIndex(index)}
                      data-testid={`card-memory-${memory.id}`}
                    >
                      <CardContent className="p-0 aspect-square">
                        {memory.imageUrl ? (
                          <img
                            src={memory.imageUrl}
                            alt={memory.title}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full bg-white/5 flex items-center justify-center">
                            <Heart className="h-8 w-8 text-white/30" />
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Tagged Tab */}
          {activeTab === "tagged" && (
            <div>
              {taggedMemories.length === 0 ? (
                <div className="text-center py-12">
                  <Heart className="h-12 w-12 text-white/30 mx-auto mb-4" />
                  <p className="text-white/60">No tagged memories yet</p>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {taggedMemories.map((memory, index) => (
                    <Card 
                      key={memory.id}
                      className="bg-white/5 border-white/10 overflow-hidden cursor-pointer hover:bg-white/10 transition-all"
                      onClick={() => setSelectedTaggedIndex(index)}
                      data-testid={`card-tagged-${memory.id}`}
                    >
                      <CardContent className="p-0 aspect-square">
                        {memory.imageUrl ? (
                          <img 
                            src={memory.imageUrl} 
                            alt={memory.title}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full bg-white/5 flex items-center justify-center">
                            <Heart className="h-8 w-8 text-white/30" />
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Badges Tab */}
          {activeTab === "badges" && (
            <div className="space-y-6">
              {/* Header */}
              <Card className="bg-white/10 backdrop-blur-lg border border-white/20">
                <CardContent className="p-6">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div>
                      <h3 className="text-xl font-bold text-white mb-1">Alumni Badges</h3>
                      <p className="text-blue-200 text-sm">{alumniBadges.filter((b: any) => b.status === "verified").length} Alumni Badge{alumniBadges.filter((b: any) => b.status === "verified").length !== 1 ? 's' : ''}</p>
                    </div>
                    <Button
                      onClick={() => setShowAlumniRequestDialog(true)}
                      className="bg-gradient-to-r from-indigo-500 to-purple-500 text-white"
                      data-testid="button-request-alumni-badge"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Request Alumni Status
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Badges Grid */}
              {alumniBadges.length === 0 ? (
                <div className="text-center py-12">
                  <Award className="h-12 w-12 text-white/30 mx-auto mb-4" />
                  <p className="text-white/60 mb-6">No alumni badges yet</p>
                  <Button
                    onClick={() => setShowAlumniRequestDialog(true)}
                    className="bg-gradient-to-r from-indigo-500 to-purple-500 text-white"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Request Alumni Status
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {alumniBadges.map((badge) => (
                    <Card
                      key={badge.id}
                      className={`border-2 ${
                        badge.status === "verified"
                          ? "bg-green-500/30 border-green-500"
                          : "bg-orange-500/30 border-orange-500"
                      }`}
                      data-testid={`card-badge-${badge.id}`}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div
                            className="flex-1 cursor-pointer"
                            onClick={() => {
                              const username = getSchoolUsername(badge.school);
                              if (username) setLocation(`/${username}`);
                            }}
                          >
                            <div className="flex items-center space-x-2 mb-2">
                              {getSchoolLogo(badge.school) ? (
                                <img
                                  src={getSchoolLogo(badge.school)?.startsWith('http') ? getSchoolLogo(badge.school)! : `/public${getSchoolLogo(badge.school)}`}
                                  alt={badge.school}
                                  className="h-7 w-7 rounded-full object-cover border border-white/20"
                                />
                              ) : (
                                <div className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold border border-white/20 ${badge.status === "verified" ? "bg-green-600/40 text-green-100" : "bg-orange-600/40 text-orange-100"}`}>
                                  {badge.school.charAt(0).toUpperCase()}
                                </div>
                              )}
                              <span className={`px-2 py-1 text-xs rounded-full ${badge.status === "verified" ? "bg-green-100 text-green-800" : "bg-orange-100 text-orange-800"}`}>
                                {badge.status === "verified" ? "Approved" : "Pending"}
                              </span>
                            </div>
                            <h4 className="font-semibold text-white text-sm">{badge.school}</h4>
                            <p className="text-sm text-gray-50">Class of {badge.graduationYear}</p>
                            <p className="text-xs text-gray-50">Admitted: {badge.admissionYear}</p>
                          </div>
                          <div className="ml-2">
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1"
                                  data-testid={`button-delete-badge-${badge.id}`}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent className="bg-white/10 backdrop-blur-lg border border-white/20 shadow-2xl text-white">
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete Alumni Badge?</AlertDialogTitle>
                                  <AlertDialogDescription className="space-y-2 text-white">
                                    <p>Are you sure you want to delete this alumni badge for <strong>{badge.school}</strong>?</p>
                                    <div className="bg-amber-500/30 rounded p-3 text-sm">
                                      <p className="font-medium text-amber-50 mb-1">Important Warning:</p>
                                      <ul className="text-amber-50 space-y-1">
                                        <li>• This action is <strong>irreversible</strong></li>
                                        <li>• You will lose your verified/pending status for this school</li>
                                      </ul>
                                    </div>
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel className="bg-white/10 border border-white/20">Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => deleteAlumniBadgeMutation.mutate(badge.id)}
                                    className="bg-red-600/80 hover:bg-red-600"
                                    data-testid={`button-confirm-delete-${badge.id}`}
                                  >
                                    Delete Badge
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Posts Lightbox */}
      <Dialog open={selectedPostIndex !== null} onOpenChange={() => setSelectedPostIndex(null)}>
        <DialogContent className="max-w-4xl p-0 bg-white/10 backdrop-blur-lg border border-white/20 shadow-2xl">
          {selectedPostIndex !== null && publicMemories[selectedPostIndex] && (
            <div className="relative">
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-2 right-2 z-10 text-white hover:bg-white/20"
                onClick={() => setSelectedPostIndex(null)}
              >
                <X className="h-4 w-4" />
              </Button>
              {selectedPostIndex > 0 && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute left-2 top-1/2 -translate-y-1/2 z-10 text-white hover:bg-white/20"
                  onClick={() => setSelectedPostIndex(selectedPostIndex - 1)}
                >
                  <ChevronLeft className="h-6 w-6" />
                </Button>
              )}
              {selectedPostIndex < publicMemories.length - 1 && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-2 top-1/2 -translate-y-1/2 z-10 text-white hover:bg-white/20"
                  onClick={() => setSelectedPostIndex(selectedPostIndex + 1)}
                >
                  <ChevronRight className="h-6 w-6" />
                </Button>
              )}
              <div
                className="overflow-hidden"
                style={{ touchAction: "none" }}
                onTouchStart={handleMemoryTouchStart}
                onTouchMove={handleMemoryTouchMove}
                onTouchEnd={(event) => handleMemoryTouchEnd(event, "posts")}
                onTouchCancel={resetMemoryInteraction}
              >
                <div
                  className="flex transition-transform duration-300 ease-out"
                  style={{ transform: `translateX(-${selectedPostIndex * 100}%)` }}
                >
                  {publicMemories.map((memory, index) => (
                    <div key={memory.id} className="w-full flex-shrink-0">
                      <img
                        src={memory.imageUrl || ''}
                        alt={memory.title}
                        className="w-full h-auto max-h-[70vh] object-contain select-none pointer-events-none"
                        style={index === selectedPostIndex ? {
                          transform: "translate(" + memoryZoom.offsetX + "px, " + memoryZoom.offsetY + "px) scale(" + memoryZoom.scale + ")",
                          transformOrigin: "center center",
                          transition: memoryGestureActive ? "none" : "transform 220ms cubic-bezier(0.22, 1, 0.36, 1)",
                          willChange: "transform",
                        } : undefined}
                        draggable={false}
                      />
                    </div>
                  ))}
                </div>
              </div>
              <div className="p-4">
                <h3 className="font-semibold text-lg text-white">{publicMemories[selectedPostIndex].title}</h3>
                {publicMemories[selectedPostIndex].description && (
                  <p className="text-sm text-white/70 mt-2">{publicMemories[selectedPostIndex].description}</p>
                )}
                <div className="flex gap-2 mt-3 text-sm text-white/70">
                  {publicMemories[selectedPostIndex].eventDate && (
                    <span>{publicMemories[selectedPostIndex].eventDate}</span>
                  )}
                  {publicMemories[selectedPostIndex].category && (
                    <>
                      <span>•</span>
                      <span className="capitalize">{publicMemories[selectedPostIndex].category}</span>
                    </>
                  )}
                </div>
                <p className="text-sm text-white/70 mt-2">
                  <span className="font-medium text-white">School:</span>{" "}
                  {getMemorySchoolName(publicMemories[selectedPostIndex])}
                </p>
                {canDeleteMemory(publicMemories[selectedPostIndex]) && (
                  <div className="mt-4 flex justify-end">
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => requestDeleteMemory(publicMemories[selectedPostIndex], "posts")}
                      disabled={deletingMemoryId === publicMemories[selectedPostIndex].id}
                      data-testid={`button-delete-memory-lightbox-${publicMemories[selectedPostIndex].id}`}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      {deletingMemoryId === publicMemories[selectedPostIndex].id ? "Deleting..." : "Delete memory"}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Tagged Lightbox */}
      <Dialog open={selectedTaggedIndex !== null} onOpenChange={() => setSelectedTaggedIndex(null)}>
        <DialogContent className="max-w-4xl p-0 bg-white/10 backdrop-blur-lg border border-white/20 shadow-2xl">
          {selectedTaggedIndex !== null && taggedMemories[selectedTaggedIndex] && (
            <div className="relative">
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-2 right-2 z-10 text-white hover:bg-white/20"
                onClick={() => setSelectedTaggedIndex(null)}
              >
                <X className="h-4 w-4" />
              </Button>
              {selectedTaggedIndex > 0 && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute left-2 top-1/2 -translate-y-1/2 z-10 text-white hover:bg-white/20"
                  onClick={() => setSelectedTaggedIndex(selectedTaggedIndex - 1)}
                >
                  <ChevronLeft className="h-6 w-6" />
                </Button>
              )}
              {selectedTaggedIndex < taggedMemories.length - 1 && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-2 top-1/2 -translate-y-1/2 z-10 text-white hover:bg-white/20"
                  onClick={() => setSelectedTaggedIndex(selectedTaggedIndex + 1)}
                >
                  <ChevronRight className="h-6 w-6" />
                </Button>
              )}
              <div
                className="overflow-hidden"
                style={{ touchAction: "none" }}
                onTouchStart={handleMemoryTouchStart}
                onTouchMove={handleMemoryTouchMove}
                onTouchEnd={(event) => handleMemoryTouchEnd(event, "tagged")}
                onTouchCancel={clearMemoryGesture}
              >
                <div
                  className="flex transition-transform duration-300 ease-out"
                  style={{ transform: `translateX(-${selectedTaggedIndex * 100}%)` }}
                >
                  {taggedMemories.map((memory, index) => (
                    <div key={memory.id} className="w-full flex-shrink-0">
                      <img
                        src={memory.imageUrl || ''}
                        alt={memory.title}
                        className="w-full h-auto max-h-[70vh] object-contain select-none pointer-events-none"
                        style={index === selectedTaggedIndex ? {
                          transform: "translate(" + memoryZoom.offsetX + "px, " + memoryZoom.offsetY + "px) scale(" + memoryZoom.scale + ")",
                          transformOrigin: "center center",
                          transition: "transform 50ms linear",
                          willChange: "transform",
                        } : undefined}
                        draggable={false}
                      />
                    </div>
                  ))}
                </div>
              </div>
              <div className="p-4">
                <h3 className="font-semibold text-lg text-white">{taggedMemories[selectedTaggedIndex].title}</h3>
                {taggedMemories[selectedTaggedIndex].description && (
                  <p className="text-sm text-white/70 mt-2">{taggedMemories[selectedTaggedIndex].description}</p>
                )}
                <div className="flex gap-2 mt-3 text-sm text-white/70">
                  {taggedMemories[selectedTaggedIndex].eventDate && (
                    <span>{taggedMemories[selectedTaggedIndex].eventDate}</span>
                  )}
                  {taggedMemories[selectedTaggedIndex].category && (
                    <>
                      <span>•</span>
                      <span className="capitalize">{taggedMemories[selectedTaggedIndex].category}</span>
                    </>
                  )}
                </div>
                <p className="text-sm text-white/70 mt-2">
                  <span className="font-medium text-white">School:</span>{" "}
                  {getMemorySchoolName(taggedMemories[selectedTaggedIndex])}
                </p>
                {canDeleteMemory(taggedMemories[selectedTaggedIndex]) && (
                  <div className="mt-4 flex justify-end">
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => requestDeleteMemory(taggedMemories[selectedTaggedIndex], "tagged")}
                      disabled={deletingMemoryId === taggedMemories[selectedTaggedIndex].id}
                      data-testid={`button-delete-memory-tagged-lightbox-${taggedMemories[selectedTaggedIndex].id}`}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      {deletingMemoryId === taggedMemories[selectedTaggedIndex].id ? "Deleting..." : "Delete memory"}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={memoryPendingDeletion !== null}
        onOpenChange={(open) => {
          if (!open && !deletingMemoryId) setMemoryPendingDeletion(null);
        }}
      >
        <AlertDialogContent className="bg-white/10 backdrop-blur-lg border border-white/20 shadow-2xl text-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete memory?</AlertDialogTitle>
            <AlertDialogDescription className="text-white/80">
              Are you sure you want to delete this memory? This action cannot be undone.
              {memoryPendingDeletion && (
                <span className="mt-2 block font-medium text-white">
                  “{memoryPendingDeletion.memory.title}”
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              className="bg-white/10 border border-white/20 text-white hover:bg-white/20"
              data-testid="button-cancel-delete-memory"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete-memory"
              onClick={() => {
                if (!memoryPendingDeletion) return;
                const pendingDeletion = memoryPendingDeletion;
                setMemoryPendingDeletion(null);
                void handleDeleteMemory(pendingDeletion.memory, pendingDeletion.collection);
              }}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete memory
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlumniMemoryUploadDialog
        open={showAlumniMemoryUploadDialog}
        onClose={() => setShowAlumniMemoryUploadDialog(false)}
        userId={user.id}
        verifiedBadges={alumniBadges}
        schools={schools}
        onUploaded={() => {
          queryClient.invalidateQueries({ queryKey: ["/api/memories/user", user.id] });
        }}
      />
      <AlumniRequestDialog
        open={showAlumniRequestDialog}
        onClose={() => setShowAlumniRequestDialog(false)}
      />
    </div>
  );
}
