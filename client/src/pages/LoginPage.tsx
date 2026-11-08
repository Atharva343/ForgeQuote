import React, { useState } from 'react';
import { useNavigate, useLocation, Navigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Factory, Eye, EyeOff, Lock, Mail, AlertCircle, Loader2, ShieldCheck } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../components/ui/card';
import { Badge } from '../components/ui/badge';

const loginFormSchema = z.object({
  email: z
    .string({ required_error: 'Email is required' })
    .trim()
    .min(1, 'Email is required')
    .email('Please enter a valid email address'),
  password: z
    .string({ required_error: 'Password is required' })
    .min(1, 'Password is required'),
});

type LoginFormData = z.infer<typeof loginFormSchema>;

export const LoginPage: React.FC = () => {
  const { login, isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [showPassword, setShowPassword] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/dashboard';

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginFormSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  // If already authenticated, redirect immediately
  if (!isAuthLoading && isAuthenticated) {
    return <Navigate to={from} replace />;
  }

  const onSubmit = async (data: LoginFormData) => {
    try {
      setApiError(null);
      setIsSubmitting(true);
      await login(data);
      navigate(from, { replace: true });
    } catch (err: unknown) {
      const errRes = (err as { response?: { data?: { message?: string } }; message?: string });
      const message = errRes?.response?.data?.message || errRes?.message || 'Authentication failed. Please verify your credentials.';
      setApiError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFillDemo = (email: string) => {
    setValue('email', email, { shouldValidate: true });
    setValue('password', 'ForgeQuote@2026', { shouldValidate: true });
    setApiError(null);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between selection:bg-amber-500 selection:text-slate-950">
      {/* Background industrial accents */}
      <div className="fixed inset-0 pointer-events-none opacity-20 bg-[radial-gradient(#f59e0b_1px,transparent_1px)] [background-size:24px_24px]"></div>

      {/* Top Header */}
      <header className="px-6 py-4 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur z-10 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="h-9 w-9 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 shadow-sm">
            <Factory className="h-5 w-5" />
          </div>
          <div>
            <span className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
              ForgeQuote
              <Badge variant="outline" className="text-[10px] font-mono py-0 text-amber-400 border-amber-400/30">
                Enterprise
              </Badge>
            </span>
          </div>
        </div>
        <div className="text-xs text-slate-400 hidden sm:flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>Role-Based Access Protected</span>
        </div>
      </header>

      {/* Main Login Card */}
      <main className="flex-1 flex items-center justify-center p-6 z-10">
        <div className="max-w-md w-full space-y-6">
          <Card className="border-slate-800 bg-slate-900/90 backdrop-blur shadow-2xl">
            <CardHeader className="space-y-1 pb-6">
              <div className="inline-flex items-center space-x-1.5 text-xs text-amber-400 uppercase tracking-wider font-semibold mb-1">
                <Lock className="w-3.5 h-3.5" />
                <span>Secure Authorization</span>
              </div>
              <CardTitle className="text-2xl font-bold tracking-tight text-white">Sign In to Platform</CardTitle>
              <CardDescription className="text-slate-400 text-sm">
                Enter your credentials to access the RFQ and Cost Estimation engine.
              </CardDescription>
            </CardHeader>

            <CardContent>
              {apiError && (
                <div className="mb-5 p-3.5 rounded-lg bg-red-950/50 border border-red-500/30 flex items-start space-x-3 text-red-200 text-xs">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <span>{apiError}</span>
                </div>
              )}

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                    Work Email
                  </Label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="name@company.com"
                      autoComplete="email"
                      className="pl-9 bg-slate-950/60 border-slate-800 text-slate-100 placeholder:text-slate-500 focus:border-amber-500"
                      {...register('email')}
                    />
                  </div>
                  {errors.email && (
                    <p className="text-xs text-red-400">{errors.email.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password" className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                    Password
                  </Label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••••••"
                      autoComplete="current-password"
                      className="pl-9 pr-10 bg-slate-950/60 border-slate-800 text-slate-100 placeholder:text-slate-500 focus:border-amber-500"
                      {...register('password')}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-3 text-slate-400 hover:text-slate-200 focus:outline-none"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {errors.password && (
                    <p className="text-xs text-red-400">{errors.password.message}</p>
                  )}
                </div>

                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold py-2 mt-2 transition-colors disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <span className="flex items-center space-x-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Authenticating...</span>
                    </span>
                  ) : (
                    <span>Sign In</span>
                  )}
                </Button>
              </form>
            </CardContent>

            <CardFooter className="pt-2 flex flex-col space-y-3 border-t border-slate-800/80">
              <div className="text-xs text-slate-400 text-center">
                Demo Quick Fill (Development Evaluation):
              </div>
              <div className="grid grid-cols-2 gap-2 w-full">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleFillDemo('estimator@forgequote.io')}
                  className="text-xs border-slate-800 bg-slate-950/40 hover:bg-slate-800 text-slate-300 hover:text-amber-400"
                >
                  Estimator Demo
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleFillDemo('saleshead@forgequote.io')}
                  className="text-xs border-slate-800 bg-slate-950/40 hover:bg-slate-800 text-slate-300 hover:text-amber-400"
                >
                  Sales Head Demo
                </Button>
              </div>
            </CardFooter>
          </Card>
        </div>
      </main>

      {/* Footer */}
      <footer className="px-6 py-4 border-t border-slate-800/80 text-center text-xs text-slate-500 z-10">
        ForgeQuote &copy; {new Date().getFullYear()} — Industrial Manufacturing RFQ Platform
      </footer>
    </div>
  );
};

export default LoginPage;

