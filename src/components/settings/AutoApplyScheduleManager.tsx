import { useState, useMemo } from "react";
import {
  Clock,
  Plus,
  Trash2,
  CalendarDays,
  Globe,
  AlertCircle,
  Loader2,
  Play,
  Pause,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { useAutoApplySchedule, AutoApplySchedule } from "@/hooks/useAutoApplySchedule";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

const DAYS_OF_WEEK = [
  { value: 0, label: "Sun" },
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
];

const TIMEZONES = [
  { value: "UTC", label: "UTC" },
  { value: "America/New_York", label: "Eastern Time (ET)" },
  { value: "America/Chicago", label: "Central Time (CT)" },
  { value: "America/Denver", label: "Mountain Time (MT)" },
  { value: "America/Los_Angeles", label: "Pacific Time (PT)" },
  { value: "Europe/London", label: "London (GMT/BST)" },
  { value: "Europe/Paris", label: "Central European (CET)" },
  { value: "Europe/Berlin", label: "Berlin (CET)" },
  { value: "Asia/Tokyo", label: "Tokyo (JST)" },
  { value: "Asia/Singapore", label: "Singapore (SGT)" },
  { value: "Asia/Dubai", label: "Dubai (GST)" },
  { value: "Australia/Sydney", label: "Sydney (AEST)" },
];

function formatTime(timeString: string): string {
  // timeString is in HH:MM:SS format
  const [hours, minutes] = timeString.split(":");
  const hour = parseInt(hours, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${minutes} ${ampm}`;
}

function getTimezoneLabel(tz: string): string {
  const found = TIMEZONES.find((t) => t.value === tz);
  return found ? found.label : tz;
}

interface ScheduleCardProps {
  schedule: AutoApplySchedule;
  onToggle: (id: string, enabled: boolean) => void;
  onDelete: (id: string) => void;
  isUpdating: boolean;
  isDeleting: boolean;
}

function ScheduleCard({ schedule, onToggle, onDelete, isUpdating, isDeleting }: ScheduleCardProps) {
  const daysLabel = useMemo(() => {
    if (schedule.frequency === "daily") return "Every day";
    if (!schedule.days_of_week || schedule.days_of_week.length === 0) return "No days selected";
    if (schedule.days_of_week.length === 7) return "Every day";
    
    // Check for weekdays (Mon-Fri)
    const weekdays = [1, 2, 3, 4, 5];
    if (
      schedule.days_of_week.length === 5 &&
      weekdays.every((d) => schedule.days_of_week!.includes(d))
    ) {
      return "Weekdays";
    }
    
    // Check for weekends
    const weekends = [0, 6];
    if (
      schedule.days_of_week.length === 2 &&
      weekends.every((d) => schedule.days_of_week!.includes(d))
    ) {
      return "Weekends";
    }
    
    // List specific days
    return schedule.days_of_week
      .sort((a, b) => a - b)
      .map((d) => DAYS_OF_WEEK.find((day) => day.value === d)?.label)
      .join(", ");
  }, [schedule.frequency, schedule.days_of_week]);

  return (
    <div className="flex items-center justify-between p-4 border rounded-lg bg-card">
      <div className="flex items-center gap-4">
        <div className={`p-2 rounded-lg ${schedule.enabled ? "bg-primary/20" : "bg-muted"}`}>
          {schedule.enabled ? (
            <Play className="w-4 h-4 text-primary" />
          ) : (
            <Pause className="w-4 h-4 text-muted-foreground" />
          )}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-medium">{formatTime(schedule.time_of_day)}</span>
            <Badge variant={schedule.frequency === "daily" ? "default" : "secondary"}>
              {schedule.frequency}
            </Badge>
            {!schedule.enabled && (
              <Badge variant="outline" className="text-muted-foreground">
                Paused
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
            <span className="flex items-center gap-1">
              <CalendarDays className="w-3 h-3" />
              {daysLabel}
            </span>
            <span className="flex items-center gap-1">
              <Globe className="w-3 h-3" />
              {getTimezoneLabel(schedule.timezone)}
            </span>
          </div>
          {schedule.last_run_at && (
            <p className="text-xs text-muted-foreground mt-1">
              Last run: {new Date(schedule.last_run_at).toLocaleString()}
            </p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-3">
        <Switch
          checked={schedule.enabled}
          onCheckedChange={(checked) => onToggle(schedule.id, checked)}
          disabled={isUpdating}
        />
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onDelete(schedule.id)}
          disabled={isDeleting}
          className="text-destructive hover:text-destructive hover:bg-destructive/10"
        >
          {isDeleting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Trash2 className="w-4 h-4" />
          )}
        </Button>
      </div>
    </div>
  );
}

export function AutoApplyScheduleManager() {
  const {
    schedules,
    isLoading,
    createSchedule,
    toggleSchedule,
    deleteSchedule,
    isCreating,
    isUpdating,
    isDeleting,
  } = useAutoApplySchedule();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [frequency, setFrequency] = useState<"daily" | "weekly">("daily");
  const [time, setTime] = useState("09:00");
  const [timezone, setTimezone] = useState(() => {
    // Try to detect user's timezone
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      return "UTC";
    }
  });
  const [selectedDays, setSelectedDays] = useState<number[]>([1, 2, 3, 4, 5]); // Default weekdays

  const handleCreateSchedule = () => {
    createSchedule(
      {
        frequency,
        time_of_day: time,
        timezone,
        days_of_week: frequency === "weekly" ? selectedDays : undefined,
      },
      {
        onSuccess: () => {
          setIsDialogOpen(false);
          // Reset form
          setFrequency("daily");
          setTime("09:00");
          setSelectedDays([1, 2, 3, 4, 5]);
        },
      }
    );
  };

  const toggleDay = (day: number) => {
    setSelectedDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort((a, b) => a - b)
    );
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Auto-Apply Schedule
            </CardTitle>
            <CardDescription className="mt-1">
              Set exact times for automatic job applications
            </CardDescription>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="w-4 h-4 mr-2" />
                Add Schedule
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Create Auto-Apply Schedule</DialogTitle>
                <DialogDescription>
                  Set when you want automatic applications to run
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4">
                {/* Frequency */}
                <div className="space-y-2">
                  <Label>Frequency</Label>
                  <Select
                    value={frequency}
                    onValueChange={(v) => setFrequency(v as "daily" | "weekly")}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly (specific days)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Days of week (for weekly) */}
                {frequency === "weekly" && (
                  <div className="space-y-2">
                    <Label>Days</Label>
                    <div className="flex flex-wrap gap-2">
                      {DAYS_OF_WEEK.map((day) => (
                        <div key={day.value} className="flex items-center gap-2">
                          <Checkbox
                            id={`day-${day.value}`}
                            checked={selectedDays.includes(day.value)}
                            onCheckedChange={() => toggleDay(day.value)}
                          />
                          <Label
                            htmlFor={`day-${day.value}`}
                            className="text-sm cursor-pointer"
                          >
                            {day.label}
                          </Label>
                        </div>
                      ))}
                    </div>
                    {selectedDays.length === 0 && (
                      <p className="text-xs text-destructive flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        Select at least one day
                      </p>
                    )}
                  </div>
                )}

                <Separator />

                {/* Time */}
                <div className="space-y-2">
                  <Label htmlFor="time">Time</Label>
                  <Input
                    id="time"
                    type="time"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    className="w-full"
                  />
                </div>

                {/* Timezone */}
                <div className="space-y-2">
                  <Label>Timezone</Label>
                  <Select value={timezone} onValueChange={setTimezone}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TIMEZONES.map((tz) => (
                        <SelectItem key={tz.value} value={tz.value}>
                          {tz.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleCreateSchedule}
                  disabled={isCreating || (frequency === "weekly" && selectedDays.length === 0)}
                >
                  {isCreating ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    "Create Schedule"
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {schedules.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Clock className="w-10 h-10 mx-auto mb-2 opacity-50" />
            <p>No schedules configured</p>
            <p className="text-sm">Add a schedule to automate job applications</p>
          </div>
        ) : (
          schedules.map((schedule) => (
            <ScheduleCard
              key={schedule.id}
              schedule={schedule}
              onToggle={toggleSchedule}
              onDelete={deleteSchedule}
              isUpdating={isUpdating}
              isDeleting={isDeleting}
            />
          ))
        )}
      </CardContent>
    </Card>
  );
}
