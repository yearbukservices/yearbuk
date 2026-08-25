import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Award, Heart, ChevronLeft, ChevronRight, X, ArrowLeft } from "lucide-react";
import type { AlumniBadge, Memory, School } from "@shared/schema";

interface PublicUser {
  id: string;
  username: string;
  fullName: string;
  profileImage: string | null;
  userType: string;
}

interface PublicViewerProfileProps {
  username: string;
  onBack?: () => void;
}

export default function PublicViewerProfile({ username, onBack }: PublicViewerProfileProps) {
  const [activeTab, setActiveTab] = useState<"posts" | "tagged" | "badges">("posts");
  const [selectedPostIndex, setSelectedPostIndex] = useState<number | null>(null);
  const [selectedTaggedIndex, setSelectedTaggedIndex] = useState<number | null>(null);

  const { data: profileUser, isLoading, isError } = useQuery<PublicUser>({
    queryKey: ["/api/users/by-username", username],
    queryFn: async () => {
      const res = await fetch(`/api/users/by-username/${username}`);
      if (!res.ok) throw new Error("User not found");
      return res.json();
    },
  });

  const { data: userMemories = [] } = useQuery<Memory[]>({
    queryKey: ["/api/memories/user", profileUser?.id],
    enabled: !!profileUser?.id,
    queryFn: async () => {
      const res = await fetch(`/api/memories/user/${profileUser!.id}`);
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: taggedMemories = [] } = useQuery<Memory[]>({
    queryKey: ["/api/memories/tagged", profileUser?.id],
    enabled: !!profileUser?.id,
    queryFn: async () => {
      const res = await fetch(`/api/memories/tagged/${profileUser!.id}`);
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: alumniBadges = [] } = useQuery<AlumniBadge[]>({
    queryKey: ["/api/alumni-badges", profileUser?.id],
    enabled: !!profileUser?.id,
    queryFn: async () => {
      const res = await fetch(`/api/alumni-badges/${profileUser!.id}`);
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: schools = [] } = useQuery<School[]>({
    queryKey: ["/api/schools"],
  });

  const publicMemories = useMemo(
    () => userMemories.filter((m) => m.status === "approved"),
    [userMemories]
  );

  const getSchoolLogo = (schoolName: string): string | null => {
    const school = schools.find((s) => s.name === schoolName);
    return school?.logo || null;
  };

  const getInitials = (name: string) =>
    name.split(" ").map((n) => n[0]).join("").toUpperCase();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-white/60">Loading profile...</div>
      </div>
    );
  }

  if (isError || !profileUser) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <p className="text-white/60">User not found</p>
        {onBack && (
          <Button variant="ghost" className="text-white/60" onClick={onBack}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Back
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen py-8">
      <div className="max-w-3xl mx-auto px-4">
        {/* Back Button */}
        {onBack && (
          <div className="mb-6">
            <Button
              variant="ghost"
              onClick={onBack}
              className="text-white/70 hover:text-white hover:bg-white/10"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          </div>
        )}

        {/* Header Section */}
        <div className="text-center mb-12 space-y-6">
          {/* Profile Picture */}
          <div className="flex justify-center">
            <Avatar className="h-32 w-32">
              <AvatarImage src={profileUser.profileImage || undefined} />
              <AvatarFallback className="text-2xl bg-gradient-to-br from-blue-500 to-cyan-500 text-white">
                {getInitials(profileUser.fullName || profileUser.username)}
              </AvatarFallback>
            </Avatar>
          </div>

          {/* Name & Username */}
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">{profileUser.fullName}</h1>
            <p className="text-lg text-cyan-300">@{profileUser.username}</p>
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
              <div className="text-3xl font-bold text-white">{alumniBadges.length}</div>
              <div className="text-sm text-white/60 mt-1">Badges</div>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex justify-center gap-8 mb-12 border-b border-white/10">
          {(["posts", "tagged", "badges"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`py-4 px-2 font-medium transition-colors relative capitalize ${
                activeTab === tab
                  ? "text-white"
                  : "text-white/50 hover:text-white/70"
              }`}
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
              {publicMemories.length === 0 ? (
                <div className="text-center py-12">
                  <Heart className="h-12 w-12 text-white/30 mx-auto mb-4" />
                  <p className="text-white/60">No posts yet</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {publicMemories.map((memory, index) => (
                    <Card
                      key={memory.id}
                      className="bg-white/5 border-white/10 overflow-hidden cursor-pointer hover:bg-white/10 transition-all"
                      onClick={() => setSelectedPostIndex(index)}
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
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {taggedMemories.map((memory, index) => (
                    <Card
                      key={memory.id}
                      className="bg-white/5 border-white/10 overflow-hidden cursor-pointer hover:bg-white/10 transition-all"
                      onClick={() => setSelectedTaggedIndex(index)}
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
              {alumniBadges.length === 0 ? (
                <div className="text-center py-12">
                  <Award className="h-12 w-12 text-white/30 mx-auto mb-4" />
                  <p className="text-white/60">No alumni badges yet</p>
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
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          {getSchoolLogo(badge.school) ? (
                            <img
                              src={
                                getSchoolLogo(badge.school)?.startsWith("http")
                                  ? getSchoolLogo(badge.school)!
                                  : `/public${getSchoolLogo(badge.school)}`
                              }
                              alt={badge.school}
                              className="h-7 w-7 rounded-full object-cover border border-white/20 flex-shrink-0"
                            />
                          ) : (
                            <div
                              className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold border border-white/20 flex-shrink-0 ${
                                badge.status === "verified"
                                  ? "bg-green-600/40 text-green-100"
                                  : "bg-orange-600/40 text-orange-100"
                              }`}
                            >
                              {badge.school.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span
                                className={`px-2 py-0.5 text-xs rounded-full ${
                                  badge.status === "verified"
                                    ? "bg-green-100 text-green-800"
                                    : "bg-orange-100 text-orange-800"
                                }`}
                              >
                                {badge.status === "verified" ? "Approved" : "Pending"}
                              </span>
                            </div>
                            <h4 className="font-semibold text-white text-sm">{badge.school}</h4>
                            <p className="text-sm text-gray-50">Class of {badge.graduationYear}</p>
                            <p className="text-xs text-gray-50">Admitted: {badge.admissionYear}</p>
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
              <div className="overflow-hidden">
                <div
                  className="flex transition-transform duration-300 ease-out"
                  style={{ transform: `translateX(-${selectedPostIndex * 100}%)` }}
                >
                  {publicMemories.map((memory) => (
                    <div key={memory.id} className="w-full flex-shrink-0">
                      <img
                        src={memory.imageUrl || ""}
                        alt={memory.title}
                        className="w-full h-auto max-h-[70vh] object-contain select-none pointer-events-none"
                        draggable={false}
                      />
                    </div>
                  ))}
                </div>
              </div>
              <div className="p-4">
                <h3 className="font-semibold text-lg text-white">
                  {publicMemories[selectedPostIndex].title}
                </h3>
                {publicMemories[selectedPostIndex].description && (
                  <p className="text-sm text-white/70 mt-2">
                    {publicMemories[selectedPostIndex].description}
                  </p>
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
              <div className="overflow-hidden">
                <div
                  className="flex transition-transform duration-300 ease-out"
                  style={{ transform: `translateX(-${selectedTaggedIndex * 100}%)` }}
                >
                  {taggedMemories.map((memory) => (
                    <div key={memory.id} className="w-full flex-shrink-0">
                      <img
                        src={memory.imageUrl || ""}
                        alt={memory.title}
                        className="w-full h-auto max-h-[70vh] object-contain select-none pointer-events-none"
                        draggable={false}
                      />
                    </div>
                  ))}
                </div>
              </div>
              <div className="p-4">
                <h3 className="font-semibold text-lg text-white">
                  {taggedMemories[selectedTaggedIndex].title}
                </h3>
                {taggedMemories[selectedTaggedIndex].description && (
                  <p className="text-sm text-white/70 mt-2">
                    {taggedMemories[selectedTaggedIndex].description}
                  </p>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
