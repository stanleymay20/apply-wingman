import { useState, useRef, useCallback } from "react";
import { 
  Upload, 
  FileText, 
  CheckCircle, 
  Edit2, 
  Plus, 
  X,
  Briefcase,
  MapPin,
  Code,
  GraduationCap,
  Loader2,
  Sparkles,
  AlertCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useCVProfile } from "@/hooks/useCVProfile";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { cvTextSchema, skillSchema, roleSchema, locationSchema } from "@/lib/validation";

export default function Profile() {
  const { profile, refreshProfile } = useAuth();
  const { cvProfile, isLoading, parseCV, isParsing, createCVProfile, refetch } = useCVProfile();
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [newSkill, setNewSkill] = useState("");
  const [newRole, setNewRole] = useState("");
  const [newLocation, setNewLocation] = useState("");
  const [cvText, setCvText] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const skills = cvProfile?.skills || [];
  const preferredRoles = profile?.preferred_roles || [];
  const preferredLocations = profile?.preferred_locations || [];

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.includes("pdf") && !file.type.includes("text")) {
      toast.error("Please upload a PDF or text file");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("File size must be less than 5MB");
      return;
    }

    setIsUploading(true);
    
    try {
      if (file.type.includes("text")) {
        const text = await file.text();
        setCvText(text);
        
        if (!cvProfile) {
          createCVProfile({ cv_file_name: file.name });
        }
      } else {
        toast.info("PDF detected. Please paste your CV text below for AI parsing.");
      }
    } catch (error) {
      toast.error("Failed to read file");
    } finally {
      setIsUploading(false);
    }
  };

  const handleParseCV = useCallback(() => {
    const validation = cvTextSchema.safeParse(cvText);
    if (!validation.success) {
      const errorMsg = validation.error.errors[0]?.message || "Invalid CV text";
      setErrors({ cvText: errorMsg });
      toast.error(errorMsg);
      return;
    }
    
    setErrors({});
    parseCV({ cvText: validation.data, cvProfileId: cvProfile?.id });
  }, [cvText, cvProfile?.id, parseCV]);

  const addSkill = useCallback(async () => {
    const validation = skillSchema.safeParse(newSkill);
    if (!validation.success) {
      setErrors({ skill: validation.error.errors[0]?.message || "Invalid skill" });
      return;
    }
    
    if (!cvProfile) {
      toast.error("Please parse your CV first");
      return;
    }
    
    if (skills.includes(validation.data)) {
      toast.error("Skill already exists");
      return;
    }
    
    const updatedSkills = [...skills, validation.data];
    const { error } = await supabase
      .from("cv_profiles")
      .update({ skills: updatedSkills })
      .eq("id", cvProfile.id);
    
    if (error) {
      toast.error("Failed to add skill");
    } else {
      setNewSkill("");
      setErrors({});
      refetch();
      toast.success("Skill added");
    }
  }, [newSkill, cvProfile, skills, refetch]);

  const removeSkill = useCallback(async (index: number) => {
    if (!cvProfile) return;
    
    const updatedSkills = skills.filter((_, i) => i !== index);
    const { error } = await supabase
      .from("cv_profiles")
      .update({ skills: updatedSkills })
      .eq("id", cvProfile.id);
    
    if (error) {
      toast.error("Failed to remove skill");
    } else {
      refetch();
    }
  }, [cvProfile, skills, refetch]);

  const addRole = useCallback(async () => {
    const validation = roleSchema.safeParse(newRole);
    if (!validation.success) {
      setErrors({ role: validation.error.errors[0]?.message || "Invalid role" });
      return;
    }
    
    if (!profile) return;
    
    if (preferredRoles.includes(validation.data)) {
      toast.error("Role already exists");
      return;
    }
    
    const updatedRoles = [...preferredRoles, validation.data];
    const { error } = await supabase
      .from("profiles")
      .update({ preferred_roles: updatedRoles })
      .eq("id", profile.id);
    
    if (error) {
      toast.error("Failed to add role");
    } else {
      setNewRole("");
      setErrors({});
      refreshProfile();
      toast.success("Role added");
    }
  }, [newRole, profile, preferredRoles, refreshProfile]);

  const removeRole = useCallback(async (index: number) => {
    if (!profile) return;
    
    const updatedRoles = preferredRoles.filter((_, i) => i !== index);
    const { error } = await supabase
      .from("profiles")
      .update({ preferred_roles: updatedRoles })
      .eq("id", profile.id);
    
    if (!error) refreshProfile();
  }, [profile, preferredRoles, refreshProfile]);

  const addLocation = useCallback(async () => {
    const validation = locationSchema.safeParse(newLocation);
    if (!validation.success) {
      setErrors({ location: validation.error.errors[0]?.message || "Invalid location" });
      return;
    }
    
    if (!profile) return;
    
    if (preferredLocations.includes(validation.data)) {
      toast.error("Location already exists");
      return;
    }
    
    const updatedLocations = [...preferredLocations, validation.data];
    const { error } = await supabase
      .from("profiles")
      .update({ preferred_locations: updatedLocations })
      .eq("id", profile.id);
    
    if (error) {
      toast.error("Failed to add location");
    } else {
      setNewLocation("");
      setErrors({});
      refreshProfile();
      toast.success("Location added");
    }
  }, [newLocation, profile, preferredLocations, refreshProfile]);

  const removeLocation = useCallback(async (index: number) => {
    if (!profile) return;
    
    const updatedLocations = preferredLocations.filter((_, i) => i !== index);
    const { error } = await supabase
      .from("profiles")
      .update({ preferred_locations: updatedLocations })
      .eq("id", profile.id);
    
    if (!error) refreshProfile();
  }, [profile, preferredLocations, refreshProfile]);

  if (isLoading) {
    return <LoadingSpinner fullPage text="Loading profile..." />;
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8 animate-fade-in">
        <h1 className="text-3xl font-bold text-foreground mb-2">My Profile</h1>
        <p className="text-muted-foreground">
          Manage your CV and candidate profile for AI-powered job matching
        </p>
      </div>

      {/* CV Upload Section */}
      <div className="glass-card p-6 mb-6 animate-scale-in">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-primary/20">
              <FileText className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">Resume / CV</h2>
              <p className="text-sm text-muted-foreground">Upload and parse with AI</p>
            </div>
          </div>
          
          {cvProfile?.last_parsed_at && (
            <div className="flex items-center gap-2 text-success">
              <CheckCircle className="w-5 h-5" />
              <span className="text-sm font-medium">Parsed</span>
            </div>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.txt,.doc,.docx"
          onChange={handleFileUpload}
          className="hidden"
        />

        {!cvProfile?.last_parsed_at ? (
          <div className="space-y-4">
            <div 
              className="border-2 border-dashed border-border/50 rounded-xl p-8 text-center hover:border-primary/50 transition-colors cursor-pointer"
              onClick={() => fileInputRef.current?.click()}
            >
              {isUploading ? (
                <Loader2 className="w-12 h-12 text-primary mx-auto mb-4 animate-spin" />
              ) : (
                <Upload className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              )}
              <p className="text-foreground font-medium mb-2">
                Drop your CV here or click to upload
              </p>
              <p className="text-sm text-muted-foreground">PDF or text format (max 5MB)</p>
            </div>

            <div className="text-center text-sm text-muted-foreground">or paste your CV text below</div>

            <div>
              <Textarea
                placeholder="Paste your CV/resume text here for AI parsing... (minimum 100 characters)"
                value={cvText}
                onChange={(e) => setCvText(e.target.value)}
                className={cn(
                  "min-h-[200px] bg-secondary border-border",
                  errors.cvText && "border-destructive"
                )}
                maxLength={50000}
              />
              {errors.cvText && (
                <p className="text-xs text-destructive mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {errors.cvText}
                </p>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                {cvText.length.toLocaleString()} / 50,000 characters
              </p>
            </div>

            <Button 
              onClick={handleParseCV} 
              className="w-full"
              disabled={isParsing || cvText.length < 100}
            >
              {isParsing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Parsing with AI...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Parse CV with AI
                </>
              )}
            </Button>
          </div>
        ) : (
          <div className="flex items-center justify-between p-4 bg-secondary/50 rounded-lg border border-border/50">
            <div className="flex items-center gap-3">
              <FileText className="w-8 h-8 text-muted-foreground" />
              <div>
                <p className="font-medium text-foreground">
                  {cvProfile.cv_file_name || "CV Parsed"}
                </p>
                <p className="text-sm text-muted-foreground">
                  Last parsed: {new Date(cvProfile.last_parsed_at).toLocaleDateString()}
                </p>
              </div>
            </div>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => {
                setCvText("");
                setErrors({});
              }}
            >
              <Edit2 className="w-4 h-4 mr-2" />
              Re-parse
            </Button>
          </div>
        )}
      </div>

      {/* Extracted Profile */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* Skills */}
        <div className="glass-card p-6 animate-scale-in" style={{ animationDelay: "100ms" }}>
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-info/20">
                <Code className="w-5 h-5 text-info" />
              </div>
              <h2 className="text-lg font-semibold text-foreground">Skills</h2>
            </div>
            <span className="text-sm text-muted-foreground">{skills.length} skills</span>
          </div>

          <div className="flex flex-wrap gap-2 mb-4">
            {skills.map((skill, index) => (
              <Badge 
                key={index} 
                variant="outline" 
                className="group cursor-pointer bg-primary/20 text-primary border-primary/30"
              >
                {skill}
                <button 
                  onClick={() => removeSkill(index)}
                  className="ml-1 opacity-0 group-hover:opacity-100 transition-opacity"
                  aria-label={`Remove ${skill}`}
                >
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            ))}
            {skills.length === 0 && (
              <p className="text-sm text-muted-foreground">No skills yet. Parse your CV to extract skills.</p>
            )}
          </div>

          <div className="space-y-1">
            <div className="flex gap-2">
              <Input
                placeholder="Add skill..."
                value={newSkill}
                onChange={(e) => {
                  setNewSkill(e.target.value);
                  if (errors.skill) setErrors({ ...errors, skill: "" });
                }}
                onKeyDown={(e) => e.key === "Enter" && addSkill()}
                className={cn("bg-secondary border-border", errors.skill && "border-destructive")}
                maxLength={50}
              />
              <Button variant="outline" size="icon" onClick={addSkill} aria-label="Add skill">
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            {errors.skill && (
              <p className="text-xs text-destructive">{errors.skill}</p>
            )}
          </div>
        </div>

        {/* Preferred Roles */}
        <div className="glass-card p-6 animate-scale-in" style={{ animationDelay: "150ms" }}>
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-lg bg-success/20">
              <Briefcase className="w-5 h-5 text-success" />
            </div>
            <h2 className="text-lg font-semibold text-foreground">Preferred Roles</h2>
          </div>

          <div className="space-y-2 mb-4">
            {preferredRoles.map((role, index) => (
              <div 
                key={index}
                className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg border border-border/50"
              >
                <span className="text-foreground">{role}</span>
                <button 
                  onClick={() => removeRole(index)}
                  className="text-muted-foreground hover:text-destructive transition-colors"
                  aria-label={`Remove ${role}`}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
            {preferredRoles.length === 0 && (
              <p className="text-sm text-muted-foreground p-3">Add roles you're interested in</p>
            )}
          </div>

          <div className="space-y-1">
            <div className="flex gap-2">
              <Input
                placeholder="Add role..."
                value={newRole}
                onChange={(e) => {
                  setNewRole(e.target.value);
                  if (errors.role) setErrors({ ...errors, role: "" });
                }}
                onKeyDown={(e) => e.key === "Enter" && addRole()}
                className={cn("bg-secondary border-border", errors.role && "border-destructive")}
                maxLength={100}
              />
              <Button variant="outline" size="icon" onClick={addRole} aria-label="Add role">
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            {errors.role && (
              <p className="text-xs text-destructive">{errors.role}</p>
            )}
          </div>
        </div>

        {/* Preferred Locations */}
        <div className="glass-card p-6 animate-scale-in" style={{ animationDelay: "200ms" }}>
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-lg bg-warning/20">
              <MapPin className="w-5 h-5 text-warning" />
            </div>
            <h2 className="text-lg font-semibold text-foreground">Locations</h2>
          </div>

          <div className="space-y-2 mb-4">
            {preferredLocations.map((location, index) => (
              <div 
                key={index}
                className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg border border-border/50"
              >
                <span className="text-foreground">{location}</span>
                <button 
                  onClick={() => removeLocation(index)}
                  className="text-muted-foreground hover:text-destructive transition-colors"
                  aria-label={`Remove ${location}`}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
            {preferredLocations.length === 0 && (
              <p className="text-sm text-muted-foreground p-3">Add your preferred work locations</p>
            )}
          </div>

          <div className="space-y-1">
            <div className="flex gap-2">
              <Input
                placeholder="Add location..."
                value={newLocation}
                onChange={(e) => {
                  setNewLocation(e.target.value);
                  if (errors.location) setErrors({ ...errors, location: "" });
                }}
                onKeyDown={(e) => e.key === "Enter" && addLocation()}
                className={cn("bg-secondary border-border", errors.location && "border-destructive")}
                maxLength={100}
              />
              <Button variant="outline" size="icon" onClick={addLocation} aria-label="Add location">
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            {errors.location && (
              <p className="text-xs text-destructive">{errors.location}</p>
            )}
          </div>
        </div>

        {/* Experience Summary */}
        <div className="glass-card p-6 animate-scale-in" style={{ animationDelay: "250ms" }}>
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-lg bg-primary/20">
              <GraduationCap className="w-5 h-5 text-primary" />
            </div>
            <h2 className="text-lg font-semibold text-foreground">Experience</h2>
          </div>

          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Years of Experience</span>
              <span className="font-medium text-foreground">
                {cvProfile?.experience_years || 0} years
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Seniority Level</span>
              <span className="font-medium text-foreground capitalize">
                {cvProfile?.seniority_level || 'Not set'}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Visa Required</span>
              <span className={cn(
                "font-medium",
                profile?.visa_required ? "text-warning" : "text-success"
              )}>
                {profile?.visa_required ? 'Yes' : 'No'}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Languages</span>
              <span className="font-medium text-foreground">
                {cvProfile?.languages?.join(", ") || 'Not set'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Summary */}
      {cvProfile?.summary && (
        <div className="glass-card p-6 mb-6 animate-scale-in">
          <h3 className="text-lg font-semibold text-foreground mb-4">Professional Summary</h3>
          <p className="text-muted-foreground leading-relaxed">{cvProfile.summary}</p>
        </div>
      )}
    </div>
  );
}
