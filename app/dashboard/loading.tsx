import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default function DashboardLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-9 w-48 bg-slate-200 rounded-md mb-6" />
      
      {/* Alerts Skeleton */}
      <div className="h-16 w-full bg-slate-100 rounded-xl mb-6" />

      {/* Stats Skeleton */}
      <div className="grid gap-4 md:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="border-slate-100">
            <CardHeader className="h-12 bg-slate-50" />
            <CardContent className="h-16" />
          </Card>
        ))}
      </div>

      {/* Table Skeleton */}
      <Card className="border-slate-100">
        <CardHeader className="h-16 bg-slate-50" />
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-12 w-full bg-slate-50 rounded-md" />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
