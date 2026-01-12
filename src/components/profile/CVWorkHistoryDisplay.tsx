import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Briefcase, GraduationCap, Award, Calendar, MapPin } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp } from "lucide-react";

interface WorkHistoryItem {
  title: string;
  company: string;
  location?: string;
  duration?: string;
  start_date?: string;
  end_date?: string;
  start_year?: number | null;
  end_year?: number | null;
  is_current?: boolean;
  employment_type?: string;
  highlights?: string[];
  technologies?: string[];
}

interface EducationItem {
  degree: string;
  field: string;
  institution: string;
  year?: number | null;
  gpa?: string | null;
  honors?: string | null;
}

interface CertificationItem {
  name: string;
  issuer?: string | null;
  year?: number | null;
}

interface CVWorkHistoryDisplayProps {
  workHistory?: WorkHistoryItem[];
  education?: EducationItem[];
  certifications?: CertificationItem[];
}

export function CVWorkHistoryDisplay({ 
  workHistory = [], 
  education = [],
  certifications = []
}: CVWorkHistoryDisplayProps) {
  const [showAllWork, setShowAllWork] = useState(false);
  const [showAllEducation, setShowAllEducation] = useState(false);

  const visibleWork = showAllWork ? workHistory : workHistory.slice(0, 3);
  const visibleEducation = showAllEducation ? education : education.slice(0, 2);

  if (workHistory.length === 0 && education.length === 0 && certifications.length === 0) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Work History */}
      {workHistory.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Briefcase className="w-5 h-5 text-primary" />
              Work Experience ({workHistory.length} positions)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {visibleWork.map((job, index) => (
              <div 
                key={index} 
                className="p-4 rounded-lg bg-secondary/50 border border-border/50 space-y-2"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-semibold text-foreground">{job.title}</h4>
                    <p className="text-sm text-muted-foreground flex items-center gap-2">
                      <span>{job.company}</span>
                      {job.location && (
                        <>
                          <span>•</span>
                          <MapPin className="w-3 h-3" />
                          <span>{job.location}</span>
                        </>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {job.is_current && (
                      <Badge variant="default" className="bg-success/20 text-success border-success/30">
                        Current
                      </Badge>
                    )}
                    {job.employment_type && (
                      <Badge variant="outline" className="capitalize text-xs">
                        {job.employment_type}
                      </Badge>
                    )}
                  </div>
                </div>
                
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {job.duration || `${job.start_date || job.start_year || '?'} - ${job.end_date || job.end_year || 'Present'}`}
                </p>

                {job.highlights && job.highlights.length > 0 && (
                  <ul className="text-sm text-muted-foreground space-y-1 pl-4 list-disc">
                    {job.highlights.slice(0, 4).map((highlight, hIndex) => (
                      <li key={hIndex}>{highlight}</li>
                    ))}
                    {job.highlights.length > 4 && (
                      <li className="text-xs text-muted-foreground/70">
                        +{job.highlights.length - 4} more achievements
                      </li>
                    )}
                  </ul>
                )}

                {job.technologies && job.technologies.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-2">
                    {job.technologies.map((tech, tIndex) => (
                      <Badge key={tIndex} variant="outline" className="text-xs bg-primary/5">
                        {tech}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {workHistory.length > 3 && (
              <Button 
                variant="ghost" 
                className="w-full text-muted-foreground"
                onClick={() => setShowAllWork(!showAllWork)}
              >
                {showAllWork ? (
                  <>
                    <ChevronUp className="w-4 h-4 mr-2" />
                    Show Less
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-4 h-4 mr-2" />
                    Show {workHistory.length - 3} More Positions
                  </>
                )}
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Education */}
      {education.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <GraduationCap className="w-5 h-5 text-info" />
              Education
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {visibleEducation.map((edu, index) => (
              <div 
                key={index} 
                className="p-4 rounded-lg bg-secondary/50 border border-border/50"
              >
                <h4 className="font-semibold text-foreground">
                  {edu.degree} {edu.field && `in ${edu.field}`}
                </h4>
                <p className="text-sm text-muted-foreground">{edu.institution}</p>
                <div className="flex items-center gap-2 mt-1">
                  {edu.year && (
                    <span className="text-xs text-muted-foreground">
                      <Calendar className="w-3 h-3 inline mr-1" />
                      {edu.year}
                    </span>
                  )}
                  {edu.gpa && (
                    <Badge variant="outline" className="text-xs">
                      GPA: {edu.gpa}
                    </Badge>
                  )}
                  {edu.honors && (
                    <Badge variant="outline" className="text-xs bg-warning/10 text-warning">
                      {edu.honors}
                    </Badge>
                  )}
                </div>
              </div>
            ))}

            {education.length > 2 && (
              <Button 
                variant="ghost" 
                className="w-full text-muted-foreground"
                onClick={() => setShowAllEducation(!showAllEducation)}
              >
                {showAllEducation ? (
                  <>
                    <ChevronUp className="w-4 h-4 mr-2" />
                    Show Less
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-4 h-4 mr-2" />
                    Show {education.length - 2} More
                  </>
                )}
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Certifications */}
      {certifications.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Award className="w-5 h-5 text-warning" />
              Certifications
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {certifications.map((cert, index) => (
                <Badge 
                  key={index} 
                  variant="outline" 
                  className="bg-warning/10 text-foreground border-warning/30 py-1.5 px-3"
                >
                  {cert.name}
                  {cert.issuer && ` (${cert.issuer})`}
                  {cert.year && ` - ${cert.year}`}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
