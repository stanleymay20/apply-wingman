import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Bookmark,
  Play,
  MoreVertical,
  Trash2,
  Clock,
  Loader2,
} from "lucide-react";
import { useSavedSearches, SavedSearch } from "@/hooks/useSavedSearches";
import { useJobDiscovery } from "@/hooks/useJobDiscovery";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

interface SavedSearchesPanelProps {
  onSearchRun?: () => void;
}

export function SavedSearchesPanel({ onSearchRun }: SavedSearchesPanelProps) {
  const { searches, isLoading, deleteSearch, markRun } = useSavedSearches();
  const { discoverJobs, isDiscovering } = useJobDiscovery();
  const [runningId, setRunningId] = useState<string | null>(null);

  const handleRunSearch = (search: SavedSearch) => {
    setRunningId(search.id);
    discoverJobs(
      {
        keywords: search.keywords,
        locations: search.locations,
        platforms: search.platforms,
      },
      {
        onSuccess: () => {
          markRun(search.id);
          setRunningId(null);
          onSearchRun?.();
        },
        onError: () => {
          setRunningId(null);
        },
      }
    );
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6 flex justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (searches.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6 text-center text-muted-foreground">
          <Bookmark className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p>No saved searches yet</p>
          <p className="text-sm">Save a search from the discovery dialog to see it here</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Bookmark className="w-5 h-5" />
          Saved Searches
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {searches.map((search) => {
          const isRunning = runningId === search.id || (isDiscovering && runningId === search.id);
          return (
            <div
              key={search.id}
              className={cn(
                "p-3 rounded-lg border border-border/50 bg-secondary/30",
                isRunning && "opacity-70"
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{search.name}</p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {search.keywords.slice(0, 3).map((kw) => (
                      <Badge key={kw} variant="secondary" className="text-xs">
                        {kw}
                      </Badge>
                    ))}
                    {search.keywords.length > 3 && (
                      <Badge variant="outline" className="text-xs">
                        +{search.keywords.length - 3}
                      </Badge>
                    )}
                  </div>
                  {search.last_run_at && (
                    <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      Last run {formatDistanceToNow(new Date(search.last_run_at), { addSuffix: true })}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleRunSearch(search)}
                    disabled={isRunning}
                  >
                    {isRunning ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Play className="w-4 h-4" />
                    )}
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="sm" variant="ghost">
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => deleteSearch(search.id)}
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
