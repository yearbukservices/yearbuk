import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ShoppingCart } from "lucide-react";

interface SchoolOrdersProps {
  user: any;
}

export default function SchoolOrders({ user }: SchoolOrdersProps) {
  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-white">Orders</h1>
      </div>
      
      <Card className="bg-white/10 backdrop-blur-lg border-white/20">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            Purchase Tracking
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12">
            <ShoppingCart className="h-16 w-16 text-white/40 mx-auto mb-4" />
            <p className="text-white/70 text-lg mb-2">No orders yet</p>
            <p className="text-white/50 text-sm">
              Alumni purchases and payments will appear here
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
