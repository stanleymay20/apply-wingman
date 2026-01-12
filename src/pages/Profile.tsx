import { useState } from "react";
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
  GraduationCap
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface Skill {
  name: string;
  level: "expert" | "advanced" | "intermediate";
}

const initialSkills: Skill[] = [
  { name: "Python", level: "expert" },
  { name: "SQL", level: "expert" },
  { name: "Machine Learning", level: "advanced" },
  { name: "Data Engineering", level: "advanced" },
  { name: "Apache Spark", level: "advanced" },
  { name: "AWS", level: "intermediate" },
  { name: "Kubernetes", level: "intermediate" },
  { name: "dbt", level: "advanced" },
];

const preferredRoles = [
  "Data Engineer",
  "ML Engineer",
  "Analytics Engineer",
  "Data Scientist",
  "Growth Analyst",
];

const preferredLocations = [
  "Berlin, Germany",
  "Munich, Germany",
  "Remote (EU)",
  "Hamburg, Germany",
];

export default function Profile() {
  const [skills, setSkills] = useState<Skill[]>(initialSkills);
  const [cvUploaded, setCvUploaded] = useState(true);
  const [newSkill, setNewSkill] = useState("");

  const levelColors = {
    expert: "bg-success/20 text-success border-success/30",
    advanced: "bg-primary/20 text-primary border-primary/30",
    intermediate: "bg-warning/20 text-warning border-warning/30",
  };

  const addSkill = () => {
    if (newSkill.trim()) {
      setSkills([...skills, { name: newSkill.trim(), level: "intermediate" }]);
      setNewSkill("");
    }
  };

  const removeSkill = (index: number) => {
    setSkills(skills.filter((_, i) => i !== index));
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8 animate-fade-in">
        <h1 className="text-3xl font-bold text-foreground mb-2">My Profile</h1>
        <p className="text-muted-foreground">
          Manage your CV and candidate profile for job matching
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
              <p className="text-sm text-muted-foreground">Your primary application document</p>
            </div>
          </div>
          
          {cvUploaded && (
            <div className="flex items-center gap-2 text-success">
              <CheckCircle className="w-5 h-5" />
              <span className="text-sm font-medium">Uploaded</span>
            </div>
          )}
        </div>

        {cvUploaded ? (
          <div className="flex items-center justify-between p-4 bg-secondary/50 rounded-lg border border-border/50">
            <div className="flex items-center gap-3">
              <FileText className="w-8 h-8 text-muted-foreground" />
              <div>
                <p className="font-medium text-foreground">Resume_2025.pdf</p>
                <p className="text-sm text-muted-foreground">Uploaded on Jan 10, 2025 • 2.4 MB</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm">
                <Edit2 className="w-4 h-4 mr-2" />
                Replace
              </Button>
              <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        ) : (
          <div className="border-2 border-dashed border-border/50 rounded-xl p-12 text-center hover:border-primary/50 transition-colors cursor-pointer">
            <Upload className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-foreground font-medium mb-2">Drop your CV here or click to upload</p>
            <p className="text-sm text-muted-foreground">PDF format, max 10MB</p>
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
            <span className="text-sm text-muted-foreground">{skills.length} detected</span>
          </div>

          <div className="flex flex-wrap gap-2 mb-4">
            {skills.map((skill, index) => (
              <Badge 
                key={index} 
                variant="outline" 
                className={cn("group cursor-pointer", levelColors[skill.level])}
              >
                {skill.name}
                <button 
                  onClick={() => removeSkill(index)}
                  className="ml-1 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            ))}
          </div>

          <div className="flex gap-2">
            <Input
              placeholder="Add skill..."
              value={newSkill}
              onChange={(e) => setNewSkill(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addSkill()}
              className="bg-secondary border-border"
            />
            <Button variant="outline" size="icon" onClick={addSkill}>
              <Plus className="w-4 h-4" />
            </Button>
          </div>

          <div className="mt-4 flex gap-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-success" />
              Expert
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-primary" />
              Advanced
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-warning" />
              Intermediate
            </div>
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

          <div className="space-y-2">
            {preferredRoles.map((role, index) => (
              <div 
                key={index}
                className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg border border-border/50"
              >
                <span className="text-foreground">{role}</span>
                <button className="text-muted-foreground hover:text-destructive transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          <Button variant="outline" className="w-full mt-4">
            <Plus className="w-4 h-4 mr-2" />
            Add Role
          </Button>
        </div>

        {/* Preferred Locations */}
        <div className="glass-card p-6 animate-scale-in" style={{ animationDelay: "200ms" }}>
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-lg bg-warning/20">
              <MapPin className="w-5 h-5 text-warning" />
            </div>
            <h2 className="text-lg font-semibold text-foreground">Locations</h2>
          </div>

          <div className="space-y-2">
            {preferredLocations.map((location, index) => (
              <div 
                key={index}
                className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg border border-border/50"
              >
                <span className="text-foreground">{location}</span>
                <button className="text-muted-foreground hover:text-destructive transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          <Button variant="outline" className="w-full mt-4">
            <Plus className="w-4 h-4 mr-2" />
            Add Location
          </Button>
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
              <span className="text-muted-foreground">Seniority Level</span>
              <span className="font-medium text-foreground">Senior (5+ years)</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Industry Focus</span>
              <span className="font-medium text-foreground">Tech / SaaS</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Visa Required</span>
              <span className="font-medium text-success">No (EU Citizen)</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Languages</span>
              <span className="font-medium text-foreground">EN (Fluent), DE (B2)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end animate-fade-in">
        <Button size="lg">
          Save Profile Changes
        </Button>
      </div>
    </div>
  );
}
