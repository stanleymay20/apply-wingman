import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, AlertCircle, Mail, Lock, User, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import logoImage from "@/assets/logo.png";
import { AuthDiagnosticsPanel, type AuthError } from "@/components/auth/AuthDiagnosticsPanel";

const emailSchema = z.string().trim().email("Please enter a valid email address").max(255);
const passwordSchema = z.string().min(8, "Password must be at least 8 characters").max(100);
const nameSchema = z.string().trim().max(100);

export default function Auth() {
  const navigate = useNavigate();
  const { user, signIn, signUp, loading } = useAuth();
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [errors, setErrors] = useState<{ email?: string; password?: string; fullName?: string }>({});
  const [lastAuthError, setLastAuthError] = useState<AuthError | null>(null);

  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");

  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");

  useEffect(() => {
    if (user && !loading) {
      navigate("/");
    }
  }, [user, loading, navigate]);

  const validateForm = (isSignUp: boolean = false) => {
    const newErrors: { email?: string; password?: string; fullName?: string } = {};
    
    const emailResult = emailSchema.safeParse(email);
    if (!emailResult.success) {
      newErrors.email = emailResult.error.errors[0]?.message || "Invalid email";
    }

    const passwordResult = passwordSchema.safeParse(password);
    if (!passwordResult.success) {
      newErrors.password = passwordResult.error.errors[0]?.message || "Invalid password";
    }

    if (isSignUp && fullName.trim()) {
      const nameResult = nameSchema.safeParse(fullName);
      if (!nameResult.success) {
        newErrors.fullName = nameResult.error.errors[0]?.message || "Invalid name";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm(false)) return;

    setIsSubmitting(true);
    const { error } = await signIn(email.trim(), password);
    setIsSubmitting(false);

    if (error) {
      const authError: AuthError = {
        code: (error as any).code || "unknown",
        status: (error as any).status,
        message: error.message,
        timestamp: new Date(),
      };
      setLastAuthError(authError);
      
      if (error.message.includes("Invalid login credentials")) {
        toast.error("Invalid email or password. Please try again.");
      } else {
        toast.error(error.message);
      }
    } else {
      setLastAuthError(null);
      toast.success("Welcome back!");
      navigate("/");
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm(true)) return;

    setIsSubmitting(true);
    const { error } = await signUp(email.trim(), password, fullName.trim() || undefined);
    setIsSubmitting(false);

    if (error) {
      const authError: AuthError = {
        code: (error as any).code || "unknown",
        status: (error as any).status,
        message: error.message,
        timestamp: new Date(),
      };
      setLastAuthError(authError);
      
      if (error.message.includes("already registered")) {
        toast.error("This email is already registered. Please sign in instead.");
      } else {
        toast.error(error.message);
      }
    } else {
      setLastAuthError(null);
      toast.success("Account created successfully! Welcome to ApplyPilot.");
      navigate("/");
    }
  };

  const isRecoveryFlow = typeof window !== "undefined" && window.location.hash.includes("type=recovery");

  const handleSendResetEmail = async () => {
    const parsed = emailSchema.safeParse(forgotEmail);
    if (!parsed.success) {
      toast.error(parsed.error.errors[0]?.message || "Please enter a valid email address");
      return;
    }

    setIsSubmitting(true);
    const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail.trim(), {
      redirectTo: `${window.location.origin}/auth`,
    });
    setIsSubmitting(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Password reset email sent. Check your inbox.");
    setShowForgotPassword(false);
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    const pass = passwordSchema.safeParse(newPassword);
    if (!pass.success) {
      toast.error(pass.error.errors[0]?.message || "Invalid password");
      return;
    }

    if (newPassword !== confirmNewPassword) {
      toast.error("Passwords do not match.");
      return;
    }

    setIsSubmitting(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setIsSubmitting(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    // Clear hash so we don't keep showing recovery UI
    window.location.hash = "";

    toast.success("Password updated. You can now continue.");
    navigate("/");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (isRecoveryFlow) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="flex justify-center mb-4">
              <img src={logoImage} alt="ApplyPilot" className="w-24 h-24 object-contain" />
            </div>
            <h1 className="text-3xl font-bold mb-2">
              <span className="text-foreground">Apply</span>
              <span className="text-primary">Pilot</span>
            </h1>
            <p className="text-muted-foreground">Set a new password</p>
          </div>

          <Card className="glass-card border-primary/20">
            <CardHeader className="pb-4">
              <CardTitle className="text-xl">Update Password</CardTitle>
              <CardDescription>Choose a new password for your account.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleUpdatePassword} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="new-password">New Password</Label>
                  <Input
                    id="new-password"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    maxLength={100}
                    autoComplete="new-password"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirm-new-password">Confirm New Password</Label>
                  <Input
                    id="confirm-new-password"
                    type="password"
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    maxLength={100}
                    autoComplete="new-password"
                    required
                  />
                </div>

                <Button type="submit" className="w-full" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    "Update Password"
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8 animate-fade-in">
          <div className="flex justify-center mb-4">
            <img 
              src={logoImage} 
              alt="ApplyPilot" 
              className="w-24 h-24 object-contain"
            />
          </div>
          <h1 className="text-3xl font-bold mb-2">
            <span className="text-foreground">Apply</span>
            <span className="text-primary">Pilot</span>
          </h1>
          <p className="text-muted-foreground">Your AI-powered job application autopilot</p>
        </div>

        <Card className="glass-card border-primary/20">
          <CardHeader className="pb-4">
            <CardTitle className="text-xl">Get Started</CardTitle>
            <CardDescription>
              Sign in or create an account to automate your job search
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="signin" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="signin">Sign In</TabsTrigger>
                <TabsTrigger value="signup">Sign Up</TabsTrigger>
              </TabsList>

              <TabsContent value="signin">
                <form onSubmit={handleSignIn} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signin-email">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="signin-email"
                        type="email"
                        placeholder="you@example.com"
                        value={email}
                        onChange={(e) => {
                          setEmail(e.target.value);
                          if (errors.email) setErrors({ ...errors, email: undefined });
                        }}
                        className={`pl-10 ${errors.email ? "border-destructive" : ""}`}
                        maxLength={255}
                        autoComplete="email"
                        required
                      />
                    </div>
                    {errors.email && (
                      <p className="text-sm text-destructive flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        {errors.email}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signin-password">Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="signin-password"
                        type="password"
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => {
                          setPassword(e.target.value);
                          if (errors.password) setErrors({ ...errors, password: undefined });
                        }}
                        className={`pl-10 ${errors.password ? "border-destructive" : ""}`}
                        maxLength={100}
                        autoComplete="current-password"
                        required
                      />
                    </div>
                    {errors.password && (
                      <p className="text-sm text-destructive flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        {errors.password}
                      </p>
                    )}
                  </div>
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Signing in...
                      </>
                    ) : (
                      <>
                        Sign In
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </>
                    )}
                  </Button>

                  <div className="text-center">
                    <Button
                      type="button"
                      variant="link"
                      className="px-0 text-sm"
                      onClick={() => {
                        setForgotEmail(email.trim());
                        setShowForgotPassword((v) => !v);
                      }}
                      disabled={isSubmitting}
                    >
                      Forgot password?
                    </Button>
                  </div>

                  {showForgotPassword && (
                    <div className="rounded-lg border border-border bg-background/40 p-3 space-y-2">
                      <p className="text-sm text-muted-foreground">
                        We'll email you a secure link to reset your password.
                      </p>
                      <div className="space-y-2">
                        <Label htmlFor="forgot-email">Email</Label>
                        <Input
                          id="forgot-email"
                          type="email"
                          value={forgotEmail}
                          onChange={(e) => setForgotEmail(e.target.value)}
                          maxLength={255}
                          autoComplete="email"
                          required
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          className="flex-1"
                          onClick={handleSendResetEmail}
                          disabled={isSubmitting}
                        >
                          Send reset link
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setShowForgotPassword(false)}
                          disabled={isSubmitting}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}

                  {lastAuthError && (
                    <AuthDiagnosticsPanel 
                      lastError={lastAuthError} 
                      className="mt-4"
                    />
                  )}
                </form>
              </TabsContent>

              <TabsContent value="signup">
                <form onSubmit={handleSignUp} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-name">Full Name</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="signup-name"
                        type="text"
                        placeholder="Max Mustermann"
                        value={fullName}
                        onChange={(e) => {
                          setFullName(e.target.value);
                          if (errors.fullName) setErrors({ ...errors, fullName: undefined });
                        }}
                        className={`pl-10 ${errors.fullName ? "border-destructive" : ""}`}
                        maxLength={100}
                        autoComplete="name"
                      />
                    </div>
                    {errors.fullName && (
                      <p className="text-sm text-destructive flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        {errors.fullName}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-email">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="signup-email"
                        type="email"
                        placeholder="you@example.com"
                        value={email}
                        onChange={(e) => {
                          setEmail(e.target.value);
                          if (errors.email) setErrors({ ...errors, email: undefined });
                        }}
                        className={`pl-10 ${errors.email ? "border-destructive" : ""}`}
                        maxLength={255}
                        autoComplete="email"
                        required
                      />
                    </div>
                    {errors.email && (
                      <p className="text-sm text-destructive flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        {errors.email}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-password">Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="signup-password"
                        type="password"
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => {
                          setPassword(e.target.value);
                          if (errors.password) setErrors({ ...errors, password: undefined });
                        }}
                        className={`pl-10 ${errors.password ? "border-destructive" : ""}`}
                        maxLength={100}
                        autoComplete="new-password"
                        required
                      />
                    </div>
                    {errors.password && (
                      <p className="text-sm text-destructive flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        {errors.password}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Must be at least 8 characters
                    </p>
                  </div>
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Creating account...
                      </>
                    ) : (
                      <>
                        Create Account
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </>
                    )}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Features */}
        <div className="mt-8 text-center text-sm text-muted-foreground animate-fade-in">
          <p className="mb-2">✨ AI-powered job matching</p>
          <p className="mb-2">🚀 Automated applications</p>
          <p>📊 Real-time analytics</p>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6">
          By continuing, you agree to our Terms of Service and Privacy Policy.
        </p>
      </div>
    </div>
  );
}
