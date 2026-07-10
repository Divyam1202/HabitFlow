'use client';

import { Suspense } from 'react';
import ResetPasswordForm from './ResetPasswordForm';

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-background">
          <p className="text-sm uppercase tracking-widest text-zinc-500">
            Loading...
          </p>
        </div>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}