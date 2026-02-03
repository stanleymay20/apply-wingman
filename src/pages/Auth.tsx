import { useRef, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Loader2, AlertCircle, Mail, Lock, User, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import logoImage from "@/assets/logo.png";
import { AuthDiagnosticsPanel, type AuthError } from "@/components/auth/AuthDiagnosticsPanel";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";

const emailSchema = z.string().trim().email("Please enter a valid email address").max(255);
const passwordSchema = z.string().min(8, "Password must be at least 8 characters").max(100);
const nameSchema = z.string().trim().max(100);

export default function Auth() {
  const navigate = useNavigate();
  const { user, signIn, signUp, loading } = useAuth();

  const signInFormRef = useRef<HTMLFormElement | null>(null);
  const signUpFormRef = useRef<HTMLFormElement | null>(null);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [errors, setErrors] = useState<{ email?: string; password?: string; fullName?: string }>({});
  const [lastAuthError, setLastAuthError] = useState<AuthError | null>(null);

  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

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

    // Safe debug marker (never log passwords)
    console.info("[auth] sign-in submit", { email: email.trim() });

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

    // Safe debug marker (never log passwords)
    console.info("[auth] sign-up submit", { email: email.trim() });

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

  const handleGoogleSignIn = async () => {
    setIsGoogleLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google");
      if (result.error) {
        toast.error(result.error.message || "Google sign-in failed");
      } else if (!result.redirected) {
        toast.success("Welcome!");
        navigate("/");
      }
    } catch (err) {
      toast.error("Google sign-in failed. Please try again.");
    } finally {
      setIsGoogleLoading(false);
    }
  };

  if (loading) {
    return (
      <>
        <div className="min-h-screen flex items-center justify-center bg-background">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
        {/* Ensure toasts render on /auth (Layout is not mounted here) */}
        <Toaster />
        <Sonner />
      </>
    );
  }

  if (isRecoveryFlow) {
    return (
      <>
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
        {/* Ensure toasts render on /auth (Layout is not mounted here) */}
        <Toaster />
        <Sonner />
      </>
    );
  }

  return (
    <>
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

              {/* Google Sign-In Button */}
              <Button
                type="button"
                variant="outline"
                className="w-full mb-4"
                onClick={handleGoogleSignIn}
                disabled={isGoogleLoading || isSubmitting}
              >
                {isGoogleLoading ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24">
                    <path
                      fill="currentColor"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="currentColor"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="currentColor"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    />
                    <path
                      fill="currentColor"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    />
                  </svg>
                )}
                Continue with Google
              </Button>

              <div className="relative mb-4">
                <div className="absolute inset-0 flex items-center">
                  <Separator className="w-full" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">Or continue with email</span>
                </div>
              </div>

              <TabsContent value="signin">
                <form ref={signInFormRef} onSubmit={handleSignIn} className="space-y-4">
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
                    type="button"
                    className="w-full"
                    disabled={isSubmitting}
                    onClick={() => signInFormRef.current?.requestSubmit()}
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
                <form ref={signUpFormRef} onSubmit={handleSignUp} className="space-y-4">
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
                    type="button"
                    className="w-full"
                    disabled={isSubmitting}
                    onClick={() => signUpFormRef.current?.requestSubmit()}
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
      {/* Ensure toasts render on /auth (Layout is not mounted here) */}
      <Toaster />
      <Sonner />
    </>
  );
}
