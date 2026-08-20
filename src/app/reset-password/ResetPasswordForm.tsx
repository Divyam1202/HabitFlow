'use client';

import { useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { authClient } from '@/lib/auth-client';
import { CheckCircle, Lock, Eye, EyeOff } from 'lucide-react';

export default function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const token = useMemo(
    () => searchParams.get('token') ?? '',
    [searchParams]
  );

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [loading, setLoading] = useState(false);

  const [error, setError] = useState('');

  const [success, setSuccess] = useState(false);

  const handleSubmit = async (
    e: React.FormEvent
  ) => {
    e.preventDefault();

    setError('');

    if (!token) {
      setError('Invalid or expired reset link.');
      return;
    }

    if (password.length < 8) {
      setError(
        'Password must be at least 8 characters.'
      );
      return;
    }

    if (password !== confirmPassword) {
      setError(
        'Passwords do not match.'
      );
      return;
    }

    setLoading(true);

    try {
      const { error } =
        await authClient.resetPassword({
          token,
          newPassword: password,
        });

      if (error) {
        throw new Error(error.message);
      }

      setSuccess(true);

      setTimeout(() => {
        router.push('/');
      }, 2000);

    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to reset password.'
      );
    } finally {
      setLoading(false);
    }
  };
    return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md bg-card border border-border p-8 shadow-2xl text-card-foreground">
        {success ? (
          <div className="flex flex-col items-center justify-center gap-6 py-8 animate-in fade-in zoom-in">

            <CheckCircle
              size={64}
              className="text-green-500"
            />

            <div className="text-center space-y-2">
              <h2 className="text-2xl font-black uppercase tracking-tight">
                PASSWORD UPDATED
              </h2>

              <p className="text-green-500 text-xs uppercase tracking-widest font-bold">
                Redirecting to Login...
              </p>

            </div>

          </div>

        ) : (
            <>
            <div className="text-center space-y-2 mb-8">
              <div className="flex justify-center mb-5">
                <div className="border border-border p-4"> <Lock size={28} className="text-foreground"/>
                </div>
              </div>

              <h1 className="text-2xl font-bold tracking-tighter font-panchang">
                RESET PASSWORD
              </h1>

              <p className="text-zinc-500 text-xs uppercase tracking-widest font-bold">
                Create a new secure password
              </p>

            </div>

            {error && (
              <div className="mb-5 border border-red-500/50 bg-red-950/20 p-3 text-center text-xs uppercase tracking-widest font-bold text-red-500">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="flex flex-col gap-5">
                <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                    New Password
                    </label>

                    <div className="relative">
                      <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete="new-password"
                      className="w-full bg-background border border-border text-foreground p-3 pr-11 text-sm focus:outline-none focus:border-foreground transition-colors"
                      placeholder="Minimum 8 characters"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-foreground transition-colors"
                        tabIndex={-1}
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>

                    <div className="mt-2">

                    <div className="w-full h-1 bg-border rounded overflow-hidden">

                        <div
                        className={`h-full transition-all duration-300 ${
                            password.length >= 12
                            ? "w-full bg-green-500"
                            : password.length >= 8
                            ? "w-2/3 bg-yellow-500"
                            : password.length > 0
                            ? "w-1/3 bg-red-500"
                            : "w-0"
                        }`}
                        />

                    </div>

                    <p className="mt-2 text-[10px] uppercase tracking-widest text-zinc-500">

                        {password.length === 0
                        ? "Enter a password"
                        : password.length < 8
                        ? "Weak Password"
                        : password.length < 12
                        ? "Good Password"
                        : "Strong Password"}

                    </p>

                    </div>

                </div>

                    <div className="space-y-1">

                        <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                            Confirm Password
                        </label>

                        <div className="relative">
                          <input
                              type={showConfirmPassword ? 'text' : 'password'}
                              required
                              value={confirmPassword}
                              onChange={(e) =>
                                  setConfirmPassword(e.target.value)
                              }
                              autoComplete="new-password"
                              className="w-full bg-background border border-border text-foreground p-3 pr-11 text-sm focus:outline-none focus:border-foreground transition-colors"
                              placeholder="Re-enter password"
                          />
                          <button
                            type="button"
                            onClick={() => setShowConfirmPassword((v) => !v)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-foreground transition-colors"
                            tabIndex={-1}
                            aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                          >
                            {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                          </button>
                        </div>

                        {confirmPassword.length > 0 && (

                        <p className={`mt-2 text-[10px] uppercase tracking-widest font-bold ${confirmPassword === password ? "text-green-500" : "text-red-500"}`}>
                            {confirmPassword === password
                            ? "Passwords Match"
                            : "Passwords Do Not Match"}
                        </p>

                        )}

                    </div>

                        <button
                            type="submit"
                            disabled={
                            loading ||
                            password.length < 8 ||
                            password !== confirmPassword
                            }
                            className="w-full mt-2 bg-foreground text-background font-black uppercase tracking-widest py-3 text-xs hover:bg-foreground/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading
                            ? "Updating Password..."
                            : "Reset Password"}
                        </button>

                        <button
                            type="button"
                            onClick={() => router.push("/")}
                            className="text-[10px] uppercase tracking-widest font-bold text-zinc-500 hover:text-foreground transition-colors"
                        >
                            ← Back to Login
                        </button>
                </form>
          </>
        )}
      </div>
    </div>
  );
}