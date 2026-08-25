import { Card, CardContent } from "@/components/ui/card";
import { BookOpen, Users, Search } from "lucide-react";

export default function DashboardHome() {
  return (
    <div className="space-y-8">
      <Card className="bg-white/10 backdrop-blur-lg border border-white/20 shadow-2xl">
        <CardContent className="p-8">
          <div className="text-center space-y-6">
            <div>
              <h2 className="text-3xl font-bold text-white mb-4">Welcome to Yearbuk</h2>
              <p className="text-blue-200 text-lg">Your digital yearbook and alumni networking platform</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
              <div className="bg-white/5 backdrop-blur-sm rounded-xl p-6 border border-white/10">
                <BookOpen className="h-12 w-12 text-purple-400 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-white mb-2">Library</h3>
                <p className="text-blue-200">Access your purchased yearbooks</p>
              </div>
              
              <div className="bg-white/5 backdrop-blur-sm rounded-xl p-6 border border-white/10">
                <Search className="h-12 w-12 text-cyan-400 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-white mb-2">Search</h3>
                <p className="text-blue-200">Discover schools and memories</p>
              </div>
              
              <div className="bg-white/5 backdrop-blur-sm rounded-xl p-6 border border-white/10">
                <Users className="h-12 w-12 text-green-400 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-white mb-2">Connect</h3>
                <p className="text-blue-200">Network with fellow alumni</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
